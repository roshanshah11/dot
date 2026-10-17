import Foundation

/// Dot's side of the agent host (AG-12): one request per call over the host's socket. Every call
/// returns nil when the host is unreachable, refuses, or speaks a protocol this Dot does not, and
/// the caller then does what it did before there was a host.
public struct AgentHostClient {
    public let path: String
    public init(path: String = HostProtocol.socketPath()) { self.path = path }

    public func call(_ request: HostRequest, timeout: TimeInterval = 5) -> [String: Any]? {
        guard let reply = try? UnixSocketClient.send(request.object, to: path, timeout: timeout),
              HostProtocol.compatible(reply), reply["ok"] as? Bool == true else { return nil }
        return reply
    }

    /// The host's processes; nil when there is no host to ask.
    public func list(timeout: TimeInterval = 2) -> [HostProcessInfo]? {
        call(.list, timeout: timeout).map { ($0["processes"] as? [[String: Any]] ?? []).compactMap(HostProcessInfo.init(object:)) }
    }

    /// The new process's pid, or nil (no host, or it refused: Dot spawns locally).
    public func spawn(_ spec: HostSpawn) -> Int32? {
        (call(.spawn(spec), timeout: 10)?["pid"] as? NSNumber)?.int32Value
    }

    @discardableResult
    public func write(id: String, line: String) -> Bool { call(.write(id: id, line: line), timeout: 30) != nil }

    @discardableResult
    public func signal(id: String, _ name: String) -> Bool { call(.signal(id: id, name: name)) != nil }

    @discardableResult
    public func detach(id: String) -> Bool { call(.detach(id: id), timeout: 2) != nil }

    /// Follows a process's output from `seq` on a thread of its own until it ends or is cancelled.
    public func follow(id: String, from seq: Int, onLines: @escaping ([HostLine]) -> Void, onEnd: @escaping (Int32?) -> Void) -> HostFollower {
        let follower = HostFollower(client: self, id: id, from: seq, onLines: onLines, onEnd: onEnd)
        follower.start()
        return follower
    }
}

/// The long poll behind `follow`. Lines come to `onLines` in seq order, the replayed permission
/// requests first, each request id once however often the host re-sends it. `onEnd` gets the exit
/// status, or nil when the host is gone (its processes went with it); not called after `cancel`.
public final class HostFollower {
    public let id: String
    private let client: AgentHostClient
    private let onLines: ([HostLine]) -> Void
    private let onEnd: (Int32?) -> Void
    private let lock = NSLock()
    private var cancelled = false
    private var from: Int
    private var seen = Set<String>()
    /// How long one poll waits for a line.
    public var wait: Double = 15

    init(client: AgentHostClient, id: String, from: Int, onLines: @escaping ([HostLine]) -> Void, onEnd: @escaping (Int32?) -> Void) {
        self.client = client; self.id = id; self.from = from; self.onLines = onLines; self.onEnd = onEnd
    }

    public var isCancelled: Bool { lock.lock(); defer { lock.unlock() }; return cancelled }

    public func cancel() { lock.lock(); cancelled = true; lock.unlock() }

    func start() {
        let thread = Thread { [self] in run() }
        thread.name = "dot.host.follow.\(id)"
        thread.start()
    }

    private func run() {
        var failures = 0
        while !isCancelled {
            guard let object = try? UnixSocketClient.send(HostRequest.attach(id: id, from: from, wait: wait).object, to: client.path, timeout: wait + 10),
                  HostProtocol.compatible(object) else {
                // A host restarting is back within seconds; three misses in a row means it is gone.
                failures += 1
                if failures >= 3 { if !isCancelled { onEnd(nil) }; return }
                Thread.sleep(forTimeInterval: 1)
                continue
            }
            failures = 0
            guard object["ok"] as? Bool == true, let reply = HostAttachReply(object: object) else {
                if !isCancelled { onEnd(nil) }   // the host no longer knows this id
                return
            }
            if isCancelled { return }
            let fresh = reply.pending.filter { line in HostPending.requestId(inOutput: line.text).map { !seen.contains($0) } ?? false }
            let batch = fresh + reply.lines
            for line in batch { if let request = HostPending.requestId(inOutput: line.text) { seen.insert(request) } }
            if let last = reply.lines.last { from = max(from, last.seq) }
            if !batch.isEmpty { onLines(batch) }
            if !reply.alive, !reply.more { onEnd(reply.exitStatus); return }
        }
    }
}
