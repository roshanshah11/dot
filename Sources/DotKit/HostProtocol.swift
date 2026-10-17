import Foundation

/// The agent host's wire format (AG-12). `Dot --host` (LaunchAgent com.roshan.dot-host) owns the
/// agents' `claude` processes so they outlive Dot; Dot talks to it over ~/Dot/host.sock, one JSON
/// object per line and one reply per request. Verbs: spawn, write, signal, list, attach, detach.
/// `attach` is a long poll: the host answers with the stdout lines after a seq as soon as there are
/// any (or after `wait` seconds with none), and Dot asks again from the last seq it saw. Every reply
/// carries `v` (the host's protocol) and `min` (the oldest client protocol it still speaks), so an
/// old host and a new Dot either talk or Dot spawns locally.
public enum HostProtocol {
    public static let version = 1
    public static let oldestClient = 1

    /// $DOT_HOST_SOCKET (tests), else ~/Dot/host.sock.
    public static func socketPath(environment: [String: String] = ProcessInfo.processInfo.environment) -> String {
        if let path = environment["DOT_HOST_SOCKET"], !path.isEmpty { return path }
        return NSHomeDirectory() + "/Dot/host.sock"
    }

    /// Whether this Dot can use a host that sent `reply`.
    public static func compatible(_ reply: [String: Any]) -> Bool {
        guard let theirs = reply["v"] as? Int, theirs >= 1 else { return false }
        return (reply["min"] as? Int ?? theirs) <= version
    }

    public static func ok(_ fields: [String: Any] = [:]) -> [String: Any] {
        fields.merging(["ok": true, "v": version, "min": oldestClient]) { _, mine in mine }
    }

    public static func failure(_ error: String) -> [String: Any] {
        ["ok": false, "error": error, "v": version, "min": oldestClient]
    }
}

/// What Dot asks the host to start: the same executable, arguments, folder and environment a local
/// `Process` would get. `id` is the agent's slug; one live process per id.
public struct HostSpawn: Equatable {
    public var id: String
    public var executable: String
    public var arguments: [String]
    public var cwd: String
    public var environment: [String: String]

    public init(id: String, executable: String, arguments: [String], cwd: String, environment: [String: String]) {
        self.id = id; self.executable = executable; self.arguments = arguments; self.cwd = cwd; self.environment = environment
    }
}

public enum HostRequest: Equatable {
    case spawn(HostSpawn)
    /// One stdin line (no newline; the host adds it).
    case write(id: String, line: String)
    /// TERM, KILL, INT, HUP, or "close": close stdin, then TERM after 3 s and KILL after 8 s.
    case signal(id: String, name: String)
    case list
    /// The stdout lines after seq `from`, waiting up to `wait` seconds for one.
    case attach(id: String, from: Int, wait: Double)
    case detach(id: String)

    public var object: [String: Any] {
        var o: [String: Any] = ["v": HostProtocol.version]
        switch self {
        case .spawn(let s):
            o.merge(["verb": "spawn", "id": s.id, "executable": s.executable, "arguments": s.arguments, "cwd": s.cwd, "environment": s.environment]) { $1 }
        case .write(let id, let line): o.merge(["verb": "write", "id": id, "line": line]) { $1 }
        case .signal(let id, let name): o.merge(["verb": "signal", "id": id, "signal": name]) { $1 }
        case .list: o["verb"] = "list"
        case .attach(let id, let from, let wait): o.merge(["verb": "attach", "id": id, "from": from, "wait": wait]) { $1 }
        case .detach(let id): o.merge(["verb": "detach", "id": id]) { $1 }
        }
        return o
    }

    public init?(object o: [String: Any]) {
        let id = o["id"] as? String ?? ""
        switch o["verb"] as? String {
        case "spawn":
            guard !id.isEmpty, let exe = o["executable"] as? String, !exe.isEmpty else { return nil }
            self = .spawn(HostSpawn(id: id, executable: exe, arguments: o["arguments"] as? [String] ?? [],
                                    cwd: o["cwd"] as? String ?? NSHomeDirectory(), environment: o["environment"] as? [String: String] ?? [:]))
        case "write":
            guard !id.isEmpty, let line = o["line"] as? String else { return nil }
            self = .write(id: id, line: line)
        case "signal":
            guard !id.isEmpty, let name = o["signal"] as? String else { return nil }
            self = .signal(id: id, name: name)
        case "list": self = .list
        case "attach":
            guard !id.isEmpty else { return nil }
            self = .attach(id: id, from: (o["from"] as? NSNumber)?.intValue ?? 0, wait: (o["wait"] as? NSNumber)?.doubleValue ?? 0)
        case "detach":
            guard !id.isEmpty else { return nil }
            self = .detach(id: id)
        default: return nil
        }
    }
}

/// One stdout line with its place in the process's output (1, 2, 3, ...).
public struct HostLine: Equatable {
    public let seq: Int
    public let text: String
    public init(seq: Int, text: String) { self.seq = seq; self.text = text }
    public var object: [String: Any] { ["seq": seq, "line": text] }
    public init?(object o: [String: Any]) {
        guard let seq = (o["seq"] as? NSNumber)?.intValue, let text = o["line"] as? String else { return nil }
        self.init(seq: seq, text: text)
    }
}

/// One row of `list`.
public struct HostProcessInfo: Equatable {
    public var id: String
    public var pid: Int32
    public var alive: Bool
    public var started: Date
    public var lastSeq: Int
    /// Permission requests (request ids) the process still waits on.
    public var pending: [String]
    public var exitStatus: Int32?
    public var attached: Bool

    public init(id: String, pid: Int32, alive: Bool, started: Date, lastSeq: Int, pending: [String], exitStatus: Int32? = nil, attached: Bool = false) {
        self.id = id; self.pid = pid; self.alive = alive; self.started = started; self.lastSeq = lastSeq
        self.pending = pending; self.exitStatus = exitStatus; self.attached = attached
    }

    public var object: [String: Any] {
        var o: [String: Any] = ["id": id, "pid": Int(pid), "alive": alive, "started": started.timeIntervalSince1970,
                                "lastSeq": lastSeq, "pending": pending, "attached": attached]
        if let exitStatus { o["exitStatus"] = Int(exitStatus) }
        return o
    }

    public init?(object o: [String: Any]) {
        guard let id = o["id"] as? String, let pid = (o["pid"] as? NSNumber)?.int32Value else { return nil }
        self.init(id: id, pid: pid, alive: o["alive"] as? Bool ?? false,
                  started: Date(timeIntervalSince1970: (o["started"] as? NSNumber)?.doubleValue ?? 0),
                  lastSeq: (o["lastSeq"] as? NSNumber)?.intValue ?? 0, pending: o["pending"] as? [String] ?? [],
                  exitStatus: (o["exitStatus"] as? NSNumber)?.int32Value, attached: o["attached"] as? Bool ?? false)
    }
}

/// The answer to `attach`: new lines, plus the permission requests still unanswered from before
/// `from` (a Dot that just relaunched has no card for them yet).
public struct HostAttachReply: Equatable {
    public var id: String
    public var alive: Bool
    public var exitStatus: Int32?
    public var lastSeq: Int
    /// The oldest seq the buffer still holds; lines before it were dropped.
    public var firstSeq: Int
    public var lines: [HostLine]
    public var pending: [HostLine]
    /// The reply was cut at its size limit: ask again at once.
    public var more: Bool
    /// The poll ended because someone detached this id.
    public var detached: Bool

    public init(id: String, alive: Bool, exitStatus: Int32? = nil, lastSeq: Int, firstSeq: Int, lines: [HostLine], pending: [HostLine] = [], more: Bool = false, detached: Bool = false) {
        self.id = id; self.alive = alive; self.exitStatus = exitStatus; self.lastSeq = lastSeq; self.firstSeq = firstSeq
        self.lines = lines; self.pending = pending; self.more = more; self.detached = detached
    }

    public var object: [String: Any] {
        var o: [String: Any] = ["id": id, "alive": alive, "lastSeq": lastSeq, "firstSeq": firstSeq, "lines": lines.map(\.object),
                                "pending": pending.map(\.object), "more": more, "detached": detached]
        if let exitStatus { o["exitStatus"] = Int(exitStatus) }
        return o
    }

    public init?(object o: [String: Any]) {
        guard let id = o["id"] as? String else { return nil }
        self.init(id: id, alive: o["alive"] as? Bool ?? false, exitStatus: (o["exitStatus"] as? NSNumber)?.int32Value,
                  lastSeq: (o["lastSeq"] as? NSNumber)?.intValue ?? 0, firstSeq: (o["firstSeq"] as? NSNumber)?.intValue ?? 1,
                  lines: (o["lines"] as? [[String: Any]] ?? []).compactMap(HostLine.init(object:)),
                  pending: (o["pending"] as? [[String: Any]] ?? []).compactMap(HostLine.init(object:)),
                  more: o["more"] as? Bool ?? false, detached: o["detached"] as? Bool ?? false)
    }
}

/// A process's stdout, line by line with increasing seq numbers, bounded by count and bytes: the
/// oldest lines go first. A relaunched Dot replays what it missed from here.
public struct HostLineBuffer {
    public let maxLines: Int
    public let maxBytes: Int
    private var storage: [HostLine] = []
    private var start = 0
    private var bytes = 0
    public private(set) var lastSeq = 0

    public init(maxLines: Int = 20_000, maxBytes: Int = 32 << 20) {
        self.maxLines = max(1, maxLines); self.maxBytes = max(1, maxBytes)
    }

    public var count: Int { storage.count - start }
    /// The oldest seq still held (lastSeq + 1 when empty).
    public var firstSeq: Int { start < storage.count ? storage[start].seq : lastSeq + 1 }

    @discardableResult
    public mutating func append(_ text: String) -> Int {
        lastSeq += 1
        storage.append(HostLine(seq: lastSeq, text: text))
        bytes += text.utf8.count
        while count > 1, count > maxLines || bytes > maxBytes {
            bytes -= storage[start].text.utf8.count
            start += 1
        }
        if start > 4096, start * 2 > storage.count { storage.removeFirst(start); start = 0 }
        return lastSeq
    }

    public func line(_ seq: Int) -> HostLine? {
        let index = start + (seq - firstSeq)
        guard seq >= firstSeq, index < storage.count else { return nil }
        return storage[index]
    }

    /// The lines after `seq`, at most `limit` of them and about `byteLimit` bytes (always at least
    /// one); `more` when some were left for the next call.
    public func after(_ seq: Int, limit: Int = .max, byteLimit: Int = .max) -> (lines: [HostLine], more: Bool) {
        var index = start + max(0, seq + 1 - firstSeq)
        var out: [HostLine] = []
        var size = 0
        while index < storage.count {
            let line = storage[index]
            if !out.isEmpty, out.count >= limit || size + line.text.utf8.count > byteLimit { return (out, true) }
            out.append(line)
            size += line.text.utf8.count
            index += 1
        }
        return (out, false)
    }
}

/// The permission requests a process is waiting on, and the 30-minute rule: a request nobody can
/// answer because no Dot is attached is denied after `denyAfter`, so an agent does not hang all
/// night on a card no one will see.
public struct HostPending {
    public static let denyAfter: TimeInterval = 30 * 60

    public struct Entry: Equatable {
        public let requestId: String
        public let seq: Int
        public let since: Date
    }

    public private(set) var entries: [Entry] = []
    public init() {}

    public var ids: [String] { entries.map(\.requestId) }

    /// A stdout line: a can_use_tool request starts waiting; a cancel ends it.
    public mutating func sawOutput(_ text: String, seq: Int, at now: Date) {
        if let id = Self.requestId(inOutput: text) {
            if !entries.contains(where: { $0.requestId == id }) { entries.append(Entry(requestId: id, seq: seq, since: now)) }
        } else if text.contains("control_cancel_request"),
                  let object = (try? JSONSerialization.jsonObject(with: Data(text.utf8))) as? [String: Any],
                  object["type"] as? String == "control_cancel_request", let id = object["request_id"] as? String {
            answered(id)
        }
    }

    /// A stdin line: a control_response answers its request.
    public mutating func sawInput(_ text: String) {
        guard text.contains("control_response"), case .controlResponse(let id?, _)? = StreamJSON.parse(line: text) else { return }
        answered(id)
    }

    public mutating func answered(_ requestId: String) { entries.removeAll { $0.requestId == requestId } }
    public mutating func removeAll() { entries = [] }

    /// Requests that waited `after` seconds with nobody attached. `unattachedSince` is nil while a
    /// Dot is attached: then nothing expires.
    public func expired(now: Date, unattachedSince: Date?, after: TimeInterval = denyAfter) -> [Entry] {
        guard let unattachedSince else { return [] }
        return entries.filter { now.timeIntervalSince(max($0.since, unattachedSince)) >= after }
    }

    /// The can_use_tool request id in a stdout line, if it is one.
    public static func requestId(inOutput text: String) -> String? {
        guard text.contains("can_use_tool"), case .permissionRequest(let request)? = StreamJSON.parse(line: text),
              !request.requestId.isEmpty else { return nil }
        return request.requestId
    }

    public static func denyMessage(after seconds: TimeInterval = denyAfter) -> String {
        let span = seconds >= 120 ? "\(Int(seconds / 60)) minutes" : "\(Int(seconds)) seconds"
        return "Nobody answered: Dot was not running for \(span)."
    }

    /// The deny the host writes to the process itself, in DotKit's own permission-response format.
    public static func denyLine(requestId: String, after seconds: TimeInterval = denyAfter) -> String {
        StreamJSON.permissionResponse(requestId: requestId, allow: false, updatedInput: [:], message: denyMessage(after: seconds))
    }
}

/// Whether a Dot is attached to a process. A poll in progress is attached; between polls a client
/// counts as attached for `lease` seconds; `detach` (Dot quitting) ends it at once.
public struct HostAttachment {
    public let lease: TimeInterval
    private var polls = 0
    private var lastSeen: Date?
    private var detachedAt: Date?
    private let created: Date

    public init(created: Date, lease: TimeInterval = 10) { self.created = created; self.lease = lease }

    public mutating func pollBegan(at now: Date) { polls += 1; lastSeen = now; detachedAt = nil }
    public mutating func pollEnded(at now: Date) { polls = max(0, polls - 1); lastSeen = now }
    public mutating func detached(at now: Date) { polls = 0; detachedAt = now }

    public func isAttached(at now: Date) -> Bool { unattachedSince(now) == nil }

    /// nil while attached; else when the last Dot went away (the spawn time if none ever came).
    public func unattachedSince(_ now: Date) -> Date? {
        if let detachedAt { return detachedAt }
        if polls > 0 { return nil }
        guard let lastSeen else { return created }
        return now.timeIntervalSince(lastSeen) < lease ? nil : lastSeen
    }
}
