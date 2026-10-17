import Darwin
import Foundation

/// The agent host's working part (AG-12): starts the agents' `claude` processes, keeps their
/// stdin, a bounded buffer of their stdout and their unanswered permission requests, and answers
/// HostProtocol requests. `Dot --host` puts it behind ~/Dot/host.sock; tests call `handle` directly.
/// Foundation only, so the host process never loads AppKit.
public final class AgentHostCore {
    public struct Settings {
        /// The 30-minute rule; $DOT_HOST_DENY_AFTER (seconds) shortens it for tests.
        public var denyAfter: TimeInterval = HostPending.denyAfter
        /// How long a client counts as attached between two polls.
        public var lease: TimeInterval = 10
        /// How often the 30-minute rule and the exited-process sweep run.
        public var sweepEvery: TimeInterval = 15
        public var maxLines = 20_000
        public var maxBytes = 32 << 20
        /// One attach reply carries at most this much; `more` says ask again.
        public var replyLines = 2_000
        public var replyBytes = 2 << 20
        /// An exited process nobody collected is forgotten after this.
        public var keepExited: TimeInterval = 24 * 3600
        public init() {}

        public static func from(environment: [String: String]) -> Settings {
            var settings = Settings()
            if let seconds = environment["DOT_HOST_DENY_AFTER"].flatMap(Double.init), seconds > 0 {
                settings.denyAfter = seconds
                settings.sweepEvery = min(settings.sweepEvery, max(0.5, seconds / 4))
            }
            return settings
        }
    }

    private final class Child {
        let id: String
        let process: Process
        let stdin: FileHandle
        let started: Date
        let writes: DispatchQueue
        var buffer: HostLineBuffer
        var pending = HostPending()
        var attachment: HostAttachment
        var partial = Data()
        var terminated: Int32?
        var stdoutClosed = false
        var exitStatus: Int32?
        var exitedAt: Date?
        var stdinClosed = false
        var waiters: [Int: (from: Int, reply: ([String: Any]) -> Void)] = [:]
        var alive: Bool { exitStatus == nil }

        init(id: String, process: Process, stdin: FileHandle, started: Date, settings: Settings) {
            self.id = id; self.process = process; self.stdin = stdin; self.started = started
            self.writes = DispatchQueue(label: "com.roshan.dot.host.write.\(id)")
            self.buffer = HostLineBuffer(maxLines: settings.maxLines, maxBytes: settings.maxBytes)
            self.attachment = HostAttachment(created: started, lease: settings.lease)
        }
    }

    public let settings: Settings
    private let now: () -> Date
    private let log: (String) -> Void
    /// Owns every child and its state.
    private let queue = DispatchQueue(label: "com.roshan.dot.host")
    private var children: [String: Child] = [:]
    private var nextWaiter = 0
    private var sweeper: DispatchSourceTimer?

    public init(settings: Settings = Settings(), now: @escaping () -> Date = Date.init, log: ((String) -> Void)? = nil) {
        self.settings = settings
        self.now = now
        self.log = log ?? { line in FileHandle.standardError.write(Data("\(Date()) host: \(line)\n".utf8)) }
    }

    deinit { sweeper?.cancel() }

    /// `Dot --host`: serve at `path` until killed. Settings from the environment ($DOT_HOST_DENY_AFTER).
    public static func serve(path: String, environment: [String: String] = ProcessInfo.processInfo.environment) -> Never {
        Darwin.signal(SIGPIPE, SIG_IGN)
        let core = AgentHostCore(settings: .from(environment: environment))
        let server = UnixSocketServer(path: path, handler: core.handle)
        do {
            try server.start()
        } catch {
            core.log("could not listen at \(path): \(error)")
            exit(1)
        }
        core.startSweeping()
        core.log("listening at \(path), protocol \(HostProtocol.version), denying unanswered requests after \(Int(core.settings.denyAfter)) s")
        withExtendedLifetime(server) { dispatchMain() }
    }

    /// `Dot --host list`: what a host at `path` runs, from any protocol version that answers.
    public static func describe(path: String) -> (live: Int, lines: [String])? {
        guard let reply = try? UnixSocketClient.send(HostRequest.list.object, to: path, timeout: 3) else { return nil }
        let processes = (reply["processes"] as? [[String: Any]] ?? []).compactMap(HostProcessInfo.init(object:))
        let lines = processes.map { "\($0.id) pid \($0.pid) \($0.alive ? "alive" : "exited") seq \($0.lastSeq) waiting \($0.pending.count)\($0.attached ? " attached" : "")" }
        return (processes.filter(\.alive).count, lines + ["host: protocol \(reply["v"] as? Int ?? 0), \(processes.filter(\.alive).count) live"])
    }

    /// Runs the 30-minute rule and forgets old exited processes every `sweepEvery`.
    public func startSweeping() {
        queue.sync {
            guard sweeper == nil else { return }
            let timer = DispatchSource.makeTimerSource(queue: queue)
            timer.schedule(deadline: .now() + settings.sweepEvery, repeating: settings.sweepEvery)
            timer.setEventHandler { [weak self] in self?.sweepLocked() }
            sweeper = timer
            timer.resume()
        }
    }

    /// The sweep now (tests drive it with their own clock).
    public func sweep() { queue.sync { sweepLocked() } }

    /// Ends every process (tests; the LaunchAgent's own stop takes its children with it).
    public func shutdown() {
        queue.sync {
            sweeper?.cancel(); sweeper = nil
            for child in children.values where child.alive { kill(child.process.processIdentifier, SIGKILL) }
        }
    }

    /// One request; `reply` is called once, maybe later (a long poll), from the host's queue.
    public func handle(_ object: [String: Any], reply: @escaping ([String: Any]) -> Void) {
        queue.async { [self] in
            guard let request = HostRequest(object: object) else {
                reply(HostProtocol.failure("bad request: \(object["verb"] as? String ?? "no verb")"))
                return
            }
            switch request {
            case .list: reply(HostProtocol.ok(["processes": children.values.sorted { $0.started < $1.started }.map { info($0).object }]))
            case .spawn(let spec): reply(spawn(spec))
            case .write(let id, let line): write(id: id, line: line, reply: reply)
            case .signal(let id, let name): reply(signal(id: id, name: name))
            case .attach(let id, let from, let wait): attach(id: id, from: from, wait: wait, reply: reply)
            case .detach(let id): reply(detach(id: id))
            }
        }
    }

    // MARK: Verbs (on `queue`)

    private func info(_ child: Child) -> HostProcessInfo {
        HostProcessInfo(id: child.id, pid: child.process.processIdentifier, alive: child.alive, started: child.started,
                        lastSeq: child.buffer.lastSeq, pending: child.pending.ids, exitStatus: child.exitStatus,
                        attached: child.attachment.isAttached(at: now()))
    }

    private func spawn(_ spec: HostSpawn) -> [String: Any] {
        if let existing = children[spec.id], existing.alive { return HostProtocol.failure("exists: \(spec.id) is running as pid \(existing.process.processIdentifier)") }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: spec.executable)
        process.arguments = spec.arguments
        process.currentDirectoryURL = URL(fileURLWithPath: spec.cwd, isDirectory: true)
        process.environment = spec.environment.isEmpty ? nil : spec.environment
        let stdin = Pipe(), stdout = Pipe(), stderr = Pipe()
        process.standardInput = stdin
        process.standardOutput = stdout
        process.standardError = stderr
        let child = Child(id: spec.id, process: process, stdin: stdin.fileHandleForWriting, started: now(), settings: settings)
        // A write after the process died fails with EPIPE instead of ending the host.
        _ = fcntl(stdin.fileHandleForWriting.fileDescriptor, F_SETNOSIGPIPE, 1)
        stdout.fileHandleForReading.readabilityHandler = { [weak self, weak child] handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil }
            guard let self else { return }
            self.queue.async {
                guard let child else { return }
                if data.isEmpty { child.stdoutClosed = true; self.finishIfDone(child) } else { self.consume(data, child: child) }
            }
        }
        stderr.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; return }
            let text = String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
            if !text.isEmpty { self?.log("[\(spec.id)] stderr: \(text.prefix(400))") }
        }
        process.terminationHandler = { [weak self, weak child] proc in
            let status = proc.terminationStatus
            self?.queue.async {
                guard let self, let child else { return }
                child.terminated = status
                self.finishIfDone(child)
            }
        }
        do {
            try process.run()
        } catch {
            stdout.fileHandleForReading.readabilityHandler = nil
            stderr.fileHandleForReading.readabilityHandler = nil
            return HostProtocol.failure("spawn failed: \(error.localizedDescription)")
        }
        children[spec.id] = child
        log("[\(spec.id)] started pid \(process.processIdentifier): \(spec.executable)")
        return HostProtocol.ok(["id": spec.id, "pid": Int(process.processIdentifier)])
    }

    private func consume(_ data: Data, child: Child) {
        child.partial.append(data)
        var added = false
        while let newline = child.partial.firstIndex(of: 0x0A) {
            let lineData = child.partial.subdata(in: child.partial.startIndex..<newline)
            child.partial.removeSubrange(child.partial.startIndex...newline)
            let text = String(decoding: lineData, as: UTF8.self)
            guard !text.isEmpty else { continue }
            let seq = child.buffer.append(text)
            child.pending.sawOutput(text, seq: seq, at: now())
            added = true
        }
        if added { flushWaiters(child) }
    }

    /// The process is gone once it has exited and its stdout is drained, so no line is lost.
    private func finishIfDone(_ child: Child) {
        guard child.alive, let status = child.terminated, child.stdoutClosed else { return }
        if !child.partial.isEmpty {
            let text = String(decoding: child.partial, as: UTF8.self)
            child.partial = Data()
            child.buffer.append(text)
        }
        child.exitStatus = status
        child.exitedAt = now()
        child.pending.removeAll()
        log("[\(child.id)] exited \(status)")
        flushWaiters(child)
    }

    private func write(id: String, line: String, reply: @escaping ([String: Any]) -> Void) {
        guard let child = children[id], child.alive, !child.stdinClosed else { reply(HostProtocol.failure("not running: \(id)")); return }
        child.pending.sawInput(line)
        let handle = child.stdin
        // Its own queue: a full pipe (a turn not reading yet) must not stall the other agents.
        child.writes.async {
            do {
                try handle.write(contentsOf: Data((line + "\n").utf8))
                reply(HostProtocol.ok())
            } catch {
                reply(HostProtocol.failure("write failed: \(error.localizedDescription)"))
            }
        }
    }

    private func signal(id: String, name: String) -> [String: Any] {
        guard let child = children[id], child.alive else { return HostProtocol.failure("not running: \(id)") }
        let pid = child.process.processIdentifier
        let numbers: [String: Int32] = ["TERM": SIGTERM, "KILL": SIGKILL, "INT": SIGINT, "HUP": SIGHUP]
        if name == "close" {
            // ClaudeSession.stop's ladder: end of input first, so the session is saved, then signals.
            child.stdinClosed = true
            let process = child.process
            child.writes.async { try? child.stdin.close() }
            DispatchQueue.global().asyncAfter(deadline: .now() + 3) { if process.isRunning { kill(pid, SIGTERM) } }
            DispatchQueue.global().asyncAfter(deadline: .now() + 8) { if process.isRunning { kill(pid, SIGKILL) } }
        } else if let number = numbers[name.uppercased()] ?? Int32(name) {
            kill(pid, number)
        } else {
            return HostProtocol.failure("unknown signal: \(name)")
        }
        log("[\(id)] signal \(name)")
        return HostProtocol.ok()
    }

    private func attach(id: String, from: Int, wait: Double, reply: @escaping ([String: Any]) -> Void) {
        guard let child = children[id] else { reply(HostProtocol.failure("unknown: \(id)")); return }
        let at = now()
        child.attachment.pollBegan(at: at)
        if !child.alive || wait <= 0 || child.buffer.lastSeq > from {
            child.attachment.pollEnded(at: at)
            reply(attachReply(child, from: from, detached: false))
            return
        }
        nextWaiter += 1
        let token = nextWaiter
        child.waiters[token] = (from, reply)
        queue.asyncAfter(deadline: .now() + wait) { [weak self, weak child] in
            guard let self, let child, let waiter = child.waiters.removeValue(forKey: token) else { return }
            child.attachment.pollEnded(at: self.now())
            waiter.reply(self.attachReply(child, from: waiter.from, detached: false))
        }
    }

    private func attachReply(_ child: Child, from: Int, detached: Bool) -> [String: Any] {
        let (lines, more) = child.buffer.after(from, limit: settings.replyLines, byteLimit: settings.replyBytes)
        // A request asked before `from` and not answered yet: a Dot that just came back has no card for it.
        let pending = child.pending.entries.filter { $0.seq <= from }.compactMap { child.buffer.line($0.seq) }
        let reply = HostAttachReply(id: child.id, alive: child.alive, exitStatus: child.exitStatus, lastSeq: child.buffer.lastSeq,
                                    firstSeq: child.buffer.firstSeq, lines: lines, pending: pending, more: more, detached: detached)
        // An exited process whose last line has been handed over is collected.
        if !child.alive, !more, !detached, children[child.id] === child { children[child.id] = nil; log("[\(child.id)] collected") }
        return HostProtocol.ok(reply.object)
    }

    private func flushWaiters(_ child: Child, detached: Bool = false) {
        guard !child.waiters.isEmpty else { return }
        let waiters = child.waiters
        child.waiters = [:]
        for (_, waiter) in waiters.sorted(by: { $0.key < $1.key }) {
            child.attachment.pollEnded(at: now())
            waiter.reply(attachReply(child, from: waiter.from, detached: detached))
        }
    }

    private func detach(id: String) -> [String: Any] {
        guard let child = children[id] else { return HostProtocol.failure("unknown: \(id)") }
        flushWaiters(child, detached: true)
        child.attachment.detached(at: now())
        log("[\(id)] detached at seq \(child.buffer.lastSeq)")
        return HostProtocol.ok(["id": id, "lastSeq": child.buffer.lastSeq])
    }

    private func sweepLocked() {
        let at = now()
        for child in Array(children.values) {
            if !child.alive {
                if let exitedAt = child.exitedAt, at.timeIntervalSince(exitedAt) > settings.keepExited { children[child.id] = nil }
                continue
            }
            let expired = child.pending.expired(now: at, unattachedSince: child.attachment.unattachedSince(at), after: settings.denyAfter)
            for entry in expired {
                let line = HostPending.denyLine(requestId: entry.requestId, after: settings.denyAfter)
                child.pending.answered(entry.requestId)
                log("[\(child.id)] denied \(entry.requestId): \(HostPending.denyMessage(after: settings.denyAfter))")
                let handle = child.stdin
                child.writes.async { try? handle.write(contentsOf: Data((line + "\n").utf8)) }
            }
        }
    }
}
