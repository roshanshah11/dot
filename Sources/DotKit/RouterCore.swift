import Foundation

/// The tool router (parity IN-03): `Dot --router-mcp --server <name> --spec <file>` stands in for one MCP server under
/// that server's own name, so every tool keeps its canonical identity (`mcp__<server>__<tool>`) and Claude Code's gate,
/// deny lists and result checks see exactly what they see without it. It starts the real server on the first call that
/// needs it (tools/list is answered from the last run's list, checked again once the server is up), starts it again
/// after it dies, and turns a call still running after `handleAfter` seconds into a handle the model collects with
/// `router_check`. Every call that reaches it already passed the gate; a handle only ever stands for an allowed call.
///
/// This is the protocol logic only: messages in, actions out. Dot's runner owns the process, the pipes and the clock.
public final class RouterCore {
    public enum Action: Equatable {
        case toClient(String)
        case toChild(String)
        case startChild
        /// The real server failed its handshake: stop it, so the next call starts a fresh one.
        case stopChild
        /// Call `timerFired(id:)` after this many seconds.
        case startTimer(id: Int, seconds: Double)
        case saveToolList(String)
    }

    public static let checkTool = "router_check"

    /// A tool name (`mcp__<server>__router_check`) that only collects the result of a call the gate already allowed.
    public static func isCheck(_ toolName: String) -> Bool {
        toolName.hasPrefix("mcp__") && toolName.hasSuffix("__" + checkTool)
    }

    public let server: String
    public let handleAfter: Double
    /// Tools this caller may not have: left out of the list and refused by name.
    public let denied: Set<String>

    private var childReady = false
    private var childStarting = false
    /// Messages waiting for the child's handshake.
    private var queued: [[String: Any]] = []
    private var nextChildID = 1
    /// Child request id -> what its answer is for.
    private var inFlight: [Int: Pending] = [:]
    private var handles: [String: Handle] = [:]
    private var handleOrder: [String] = []
    private var nextHandle = 1
    /// router_check calls waiting on a handle, by their timer token.
    private var waiters: [Int: (handle: String, clientID: Any)] = [:]
    private var nextWaiter = 1
    private var tools: [[String: Any]]?
    private var toolsFromCache = false
    private var listServed = false
    private var listWaiters: [Any] = []

    struct Pending {
        var clientID: Any?
        var tool: String
        let startedAt: Date
        var handle: String?
        var listing = false
        var handshake = false
        var progressToken: Any?
    }

    struct Handle {
        let tool: String
        let startedAt: Date
        var result: [String: Any]?
    }

    public init(server: String, handleAfter: Double = 20, denied: Set<String> = [], cachedToolList: String? = nil) {
        self.server = server
        self.handleAfter = handleAfter
        self.denied = denied
        if let cachedToolList, let data = cachedToolList.data(using: .utf8),
           let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            tools = list
            toolsFromCache = true
        }
    }

    /// The name the model calls a tool of this server by.
    public func canonical(_ tool: String) -> String { "mcp__\(server)__\(tool)" }

    // MARK: From Claude Code

    public func clientMessage(_ line: String) -> [Action] {
        guard let m = Self.object(line) else { return [] }
        let id = m["id"].flatMap { $0 is NSNull ? nil : $0 }
        let method = m["method"] as? String ?? ""
        let params = m["params"] as? [String: Any] ?? [:]
        switch method {
        case "initialize":
            guard let id else { return [] }
            return [.toClient(Self.reply(id, ["protocolVersion": (params["protocolVersion"] as? String) ?? HandsMCPWire.protocolVersion,
                                              "capabilities": ["tools": ["listChanged": true]],
                                              "serverInfo": ["name": server, "version": "dot-router"]]))]
        case "ping":
            return id.map { [.toClient(Self.reply($0, [:]))] } ?? []
        case "tools/list":
            guard let id else { return [] }
            if let tools {
                listServed = true
                return [.toClient(Self.reply(id, ["tools": listed(tools)]))]
            }
            listWaiters.append(id)
            if inFlight.values.contains(where: \.listing) { return [] }
            return send(["method": "tools/list", "params": [String: Any]()], Pending(tool: "tools/list", startedAt: Date(), listing: true)).actions
        case "tools/call":
            guard let id else { return [] }
            let name = params["name"] as? String ?? ""
            if name == Self.checkTool { return check(id: id, handle: ((params["arguments"] as? [String: Any])?["handle"] as? String) ?? "") }
            if denied.contains(name) {
                return [.toClient(Self.reply(id, Self.text("refused: \(canonical(name)) isn't one of this session's tools", error: true)))]
            }
            let (actions, childID) = send(["method": "tools/call", "params": params], Pending(clientID: id, tool: name, startedAt: Date()))
            return actions + [.startTimer(id: childID, seconds: handleAfter)]
        case "notifications/cancelled":
            // his stop reaches the real server; a call already turned into a handle keeps going (its answer was sent)
            guard let request = params["requestId"],
                  let (childID, _) = inFlight.first(where: { $0.value.handle == nil && Self.same($0.value.clientID, request) }) else { return [] }
            inFlight[childID] = nil
            guard childReady else { queued.removeAll { ($0["id"] as? Int) == childID }; return [] }
            return [.toChild(Self.line(["jsonrpc": "2.0", "method": "notifications/cancelled",
                                        "params": ["requestId": childID, "reason": (params["reason"] as? String) ?? "cancelled"]]))]
        default:
            if method.hasPrefix("notifications/") { return [] }
            guard let id else { return [] }
            return [.toClient(Self.error(id, -32601, "method not found: \(method)"))]
        }
    }

    // MARK: From the real server

    public func childMessage(_ line: String) -> [Action] {
        guard let m = Self.object(line) else { return [] }
        if let method = m["method"] as? String {
            // a request from the server (sampling, roots, elicitation): this client offers none of them
            if let id = m["id"], !(id is NSNull) { return [.toChild(Self.error(id, -32601, "not offered through dot's router"))] }
            if method == "notifications/tools/list_changed" {
                // fetch the new list now; Claude Code hears about it once it is in
                tools = nil
                if inFlight.values.contains(where: \.listing) { return [] }
                return send(["method": "tools/list", "params": [String: Any]()], Pending(tool: "tools/list", startedAt: Date(), listing: true)).actions
            }
            if method == "notifications/progress", let token = (m["params"] as? [String: Any])?["progressToken"],
               inFlight.values.contains(where: { $0.handle == nil && $0.clientID != nil && Self.same($0.progressToken, token) }) {
                return [.toClient(line)]
            }
            if method == "notifications/message" { return [.toClient(line)] }
            return []
        }
        guard let id = (m["id"] as? NSNumber)?.intValue, let pending = inFlight.removeValue(forKey: id) else { return [] }
        if pending.handshake {
            // an error (or no result) means the server never initialized: the calls waiting on it fail now with its
            // reason, and the next call starts it again, instead of being sent to a server that can't answer them
            guard m["result"] is [String: Any] else {
                let why = ((m["error"] as? [String: Any])?["message"] as? String) ?? "no result"
                childReady = false
                childStarting = false
                queued = []
                return [.stopChild] + failInFlight { _ in "the \(self.server) server failed to start (initialize: \(why)); dot starts it again on the next call, so call it again" }
            }
            childReady = true
            childStarting = false
            var actions: [Action] = [.toChild(Self.line(["jsonrpc": "2.0", "method": "notifications/initialized"]))]
            let waiting = queued
            queued = []
            for message in waiting { actions.append(.toChild(Self.line(message))) }
            if toolsFromCache {
                // the list Claude Code got came from the last run: ask the live server, and say so if it changed
                toolsFromCache = false
                actions += send(["method": "tools/list", "params": [String: Any]()], Pending(tool: "tools/list", startedAt: Date(), listing: true)).actions
            }
            return actions
        }
        let result = m["result"] as? [String: Any]
        let error = m["error"] as? [String: Any]
        if pending.listing {
            var actions: [Action] = []
            let waiters = listWaiters
            listWaiters = []
            if let error {
                for w in waiters { actions.append(.toClient(Self.error(w, (error["code"] as? Int) ?? -32603, (error["message"] as? String) ?? "tools/list failed"))) }
                return actions
            }
            let fresh = (result?["tools"] as? [[String: Any]]) ?? []
            let changed = tools.map { Self.json($0) != Self.json(fresh) } ?? true
            tools = fresh
            if changed { actions.append(.saveToolList(Self.json(fresh))) }
            for w in waiters { actions.append(.toClient(Self.reply(w, ["tools": listed(fresh)]))) }
            if changed && listServed && waiters.isEmpty {
                actions.append(.toClient(Self.line(["jsonrpc": "2.0", "method": "notifications/tools/list_changed"])))
            }
            if !waiters.isEmpty { listServed = true }
            return actions
        }
        let answer: [String: Any] = result ?? Self.text("error from \(server): \((error?["message"] as? String) ?? "unknown")", error: true)
        if let handle = pending.handle { return finish(handle, with: answer) }
        guard let clientID = pending.clientID else { return [] }
        return [.toClient(Self.reply(clientID, answer))]
    }

    /// The real server exited: every call it held gets an error now, and the next call starts it again.
    public func childExited() -> [Action] {
        childReady = false
        childStarting = false
        queued = []
        return failInFlight { "the \(self.server) server stopped during \($0.tool); dot starts it again on the next call, so call it again" }
    }

    /// Every call the server held (or that waited on its handshake) gets `message` as its error.
    private func failInFlight(_ message: (Pending) -> String) -> [Action] {
        var actions: [Action] = []
        for (_, pending) in inFlight.sorted(by: { $0.key < $1.key }) {
            let why = message(pending)
            if pending.listing {
                for w in listWaiters { actions.append(.toClient(Self.error(w, -32603, why))) }
                listWaiters = []
            } else if let handle = pending.handle {
                actions += finish(handle, with: Self.text(why, error: true))
            } else if let clientID = pending.clientID {
                actions.append(.toClient(Self.reply(clientID, Self.text(why, error: true))))
            }
        }
        inFlight = [:]
        return actions
    }

    // MARK: The clock

    /// A call's time is up (`id` is its child request id): still running, it becomes a handle. A router_check's time is
    /// up (`id` is minus its token): it answers "still running".
    public func timerFired(id: Int) -> [Action] {
        if id < 0 {
            guard let w = waiters.removeValue(forKey: -id), let h = handles[w.handle] else { return [] }
            let seconds = Int(Date().timeIntervalSince(h.startedAt))
            return [.toClient(Self.reply(w.clientID, Self.text("still running (\(seconds) s so far): \(canonical(h.tool)). call \(canonical(Self.checkTool)) with handle \(w.handle) again later; do other work meanwhile.")))]
        }
        guard var pending = inFlight[id], pending.handle == nil, let clientID = pending.clientID else { return [] }
        let name = "h\(nextHandle)"
        nextHandle += 1
        pending.handle = name
        inFlight[id] = pending
        handles[name] = Handle(tool: pending.tool, startedAt: pending.startedAt, result: nil)
        handleOrder.append(name)
        while handleOrder.count > 50 { handles[handleOrder.removeFirst()] = nil }
        return [.toClient(Self.reply(clientID, Self.text("still running after \(Int(handleAfter)) s: \(canonical(pending.tool)) keeps going in the background. its handle is \(name): call \(canonical(Self.checkTool)) with handle \(name) to get the result (it waits up to \(Int(handleAfter)) s); do other work meanwhile.")))]
    }

    // MARK: Inside

    private func send(_ message: [String: Any], _ pending: Pending) -> (actions: [Action], id: Int) {
        var actions: [Action] = []
        let id = nextChildID
        nextChildID += 1
        var m = message
        m["jsonrpc"] = "2.0"
        m["id"] = id
        var p = pending
        p.progressToken = ((m["params"] as? [String: Any])?["_meta"] as? [String: Any])?["progressToken"]
        inFlight[id] = p
        if childReady {
            actions.append(.toChild(Self.line(m)))
        } else {
            queued.append(m)
            if !childStarting {
                childStarting = true
                let hid = nextChildID
                nextChildID += 1
                inFlight[hid] = Pending(tool: "initialize", startedAt: Date(), handshake: true)
                actions.append(.startChild)
                actions.append(.toChild(Self.line(["jsonrpc": "2.0", "id": hid, "method": "initialize",
                                                   "params": ["protocolVersion": HandsMCPWire.protocolVersion, "capabilities": [String: Any](),
                                                              "clientInfo": ["name": "dot-router", "version": "1"]]])))
            }
        }
        return (actions, id)
    }

    /// A handle's call ended: answer whoever is waiting on it, or keep the result for the next router_check.
    private func finish(_ handle: String, with answer: [String: Any]) -> [Action] {
        guard handles[handle] != nil else { return [] }
        let waiting = waiters.filter { $0.value.handle == handle }.sorted { $0.key < $1.key }
        guard !waiting.isEmpty else {
            handles[handle]?.result = answer
            return []
        }
        for (token, _) in waiting { waiters[token] = nil }
        collected(handle)
        return waiting.map { .toClient(Self.reply($0.value.clientID, answer)) }
    }

    private func collected(_ handle: String) {
        handles[handle] = nil
        handleOrder.removeAll { $0 == handle }
    }

    private func check(id: Any, handle: String) -> [Action] {
        guard let h = handles[handle] else {
            return [.toClient(Self.reply(id, Self.text("no handle \(handle) on \(server) (its result was already collected, or the session restarted)", error: true)))]
        }
        if let result = h.result {
            collected(handle)
            return [.toClient(Self.reply(id, result))]
        }
        let token = nextWaiter
        nextWaiter += 1
        waiters[token] = (handle, id)
        return [.startTimer(id: -token, seconds: handleAfter)]
    }

    private func listed(_ tools: [[String: Any]]) -> [[String: Any]] {
        tools.filter { !denied.contains(($0["name"] as? String) ?? "") } + [[
            "name": Self.checkTool,
            "description": "Collect the result of a \(server) call that ran past \(Int(handleAfter)) s and came back with a handle (h1, h2...). Waits up to \(Int(handleAfter)) s, then says it is still running.",
            "inputSchema": ["type": "object", "properties": ["handle": ["type": "string"]], "required": ["handle"], "additionalProperties": false],
        ]]
    }

    // MARK: JSON

    static func object(_ line: String) -> [String: Any]? {
        guard let data = line.data(using: .utf8) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    /// Two JSON-RPC ids (numbers or strings) are the same id.
    static func same(_ a: Any?, _ b: Any?) -> Bool {
        guard let a, let b else { return false }
        if let x = a as? NSNumber, let y = b as? NSNumber { return x == y }
        if let x = a as? String, let y = b as? String { return x == y }
        return false
    }

    static func json(_ value: Any) -> String {
        guard JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }

    static func line(_ object: [String: Any]) -> String { HandsMCPWire.line(object) }
    static func reply(_ id: Any, _ result: [String: Any]) -> String { line(["jsonrpc": "2.0", "id": id, "result": result]) }
    static func error(_ id: Any, _ code: Int, _ message: String) -> String { line(["jsonrpc": "2.0", "id": id, "error": ["code": code, "message": message]]) }
    static func text(_ s: String, error: Bool = false) -> [String: Any] { ["content": [["type": "text", "text": s]], "isError": error] }
}

extension RouterCore.Pending {
    init(clientID: Any? = nil, tool: String, startedAt: Date, listing: Bool = false, handshake: Bool = false) {
        self.clientID = clientID
        self.tool = tool
        self.startedAt = startedAt
        self.listing = listing
        self.handshake = handshake
    }
}
