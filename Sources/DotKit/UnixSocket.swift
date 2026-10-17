import Darwin
import Foundation

/// What can go wrong on Dot's local sockets.
public enum UnixSocketError: Error, Equatable {
    /// The path does not fit in `sockaddr_un` (104 bytes on macOS).
    case pathTooLong
    /// Another server answers at the path; it was left alone.
    case inUse
    /// socket, bind, listen or connect failed with this errno.
    case system(String, Int32)
    /// Nobody listens at the path (no file, or a stale one): the caller's offline case.
    case unreachable(Int32)
    case timedOut
    /// The other side hung up before a whole line came back.
    case closed
    /// The reply line was not a JSON object.
    case badReply
}

/// A Unix domain socket that speaks newline-delimited JSON: each line a client writes is one
/// request (a JSON object), and each request gets exactly one reply line, whenever the handler
/// gets to it (a gate waiting on a card answers minutes later). Many connections at once; a
/// connection may carry several requests, and replies go out in the order they are ready, so a
/// caller that pipelines puts its own id in the request. The socket file is mode 0600 and a stale
/// one is removed on start. What the requests mean (verbs) is the caller's business.
/// Foundation and Darwin only, so the gate process and tests use it without AppKit.
public final class UnixSocketServer {
    /// Called once per request line on `handlerQueue`. `reply` may be called later, from any
    /// thread; only its first call counts.
    public typealias Handler = (_ request: [String: Any], _ reply: @escaping ([String: Any]) -> Void) -> Void

    public let path: String
    private let handler: Handler
    private let handlerQueue: DispatchQueue
    /// Owns every descriptor and buffer below.
    private let queue = DispatchQueue(label: "com.roshan.dot.socket")
    private var listenFD: Int32 = -1
    private var listener: DispatchSourceRead?
    private var connections: [Int32: Connection] = [:]
    /// A line longer than this ends the connection (nothing Dot sends comes close).
    static let maxLine = 4 << 20

    private final class Connection {
        let fd: Int32
        var buffer = Data()
        var source: DispatchSourceRead?
        var closed = false
        init(fd: Int32) { self.fd = fd }
    }

    public init(path: String, handlerQueue: DispatchQueue? = nil, handler: @escaping Handler) {
        self.path = path
        self.handler = handler
        self.handlerQueue = handlerQueue ?? DispatchQueue(label: "com.roshan.dot.socket.handler", attributes: .concurrent)
    }

    /// Not through `queue`: the last reference can go away inside one of its own blocks.
    deinit { shutdown() }

    public var isRunning: Bool { queue.sync { listenFD >= 0 } }

    public func start() throws {
        try queue.sync {
            guard listenFD < 0 else { return }
            var address = try Self.address(for: path)
            try FileManager.default.createDirectory(atPath: (path as NSString).deletingLastPathComponent, withIntermediateDirectories: true)
            // A file left by a server that died: remove it. One that still answers belongs to a live
            // server (a second Dot), which keeps it.
            if FileManager.default.fileExists(atPath: path) {
                if Self.answers(path) { throw UnixSocketError.inUse }
                unlink(path)
            }
            let fd = socket(AF_UNIX, SOCK_STREAM, 0)
            guard fd >= 0 else { throw UnixSocketError.system("socket", errno) }
            let bound = withUnsafePointer(to: &address) {
                $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size)) }
            }
            guard bound == 0 else { let e = errno; close(fd); throw UnixSocketError.system("bind", e) }
            // Before listen nobody can connect, so the file is never reachable with a looser mode.
            guard chmod(path, 0o600) == 0, listen(fd, 64) == 0 else {
                let e = errno; close(fd); unlink(path); throw UnixSocketError.system("listen", e)
            }
            _ = fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK)
            listenFD = fd
            let source = DispatchSource.makeReadSource(fileDescriptor: fd, queue: queue)
            source.setEventHandler { [weak self] in self?.acceptAll() }
            source.setCancelHandler { close(fd) }
            listener = source
            source.resume()
        }
    }

    /// Closes every connection (their pending replies are dropped) and removes the socket file.
    public func stop() { queue.sync { shutdown() } }

    private func shutdown() {
        guard listenFD >= 0 else { return }
        listener?.cancel()
        listener = nil
        listenFD = -1
        for connection in connections.values { drop(connection) }
        connections = [:]
        unlink(path)
    }

    // MARK: Connections (on `queue`)

    private func acceptAll() {
        while true {
            let fd = accept(listenFD, nil, nil)
            guard fd >= 0 else { return }   // EAGAIN: no more waiting
            _ = fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK)
            var on: Int32 = 1
            setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &on, socklen_t(MemoryLayout<Int32>.size))
            let connection = Connection(fd: fd)
            let source = DispatchSource.makeReadSource(fileDescriptor: fd, queue: queue)
            source.setEventHandler { [weak self, weak connection] in
                guard let self, let connection else { return }
                self.read(connection)
            }
            source.setCancelHandler { close(fd) }
            connection.source = source
            connections[fd] = connection
            source.resume()
        }
    }

    private func read(_ connection: Connection) {
        var chunk = [UInt8](repeating: 0, count: 65536)
        let count = Darwin.read(connection.fd, &chunk, chunk.count)
        if count < 0, errno == EAGAIN || errno == EINTR { return }
        guard count > 0 else { drop(connection); return }
        connection.buffer.append(chunk, count: count)
        while let newline = connection.buffer.firstIndex(of: 0x0A) {
            let line = connection.buffer.subdata(in: connection.buffer.startIndex..<newline)
            connection.buffer.removeSubrange(connection.buffer.startIndex...newline)
            if line.allSatisfy({ $0 == 0x20 || $0 == 0x0D || $0 == 0x09 }) { continue }
            dispatch(line, on: connection)
        }
        if connection.buffer.count > Self.maxLine { drop(connection) }
    }

    private func dispatch(_ line: Data, on connection: Connection) {
        var once = false
        let lock = NSLock()
        let reply: ([String: Any]) -> Void = { [weak self, weak connection] object in
            lock.lock(); defer { lock.unlock() }
            guard !once else { return }
            once = true
            guard let self else { return }
            self.queue.async {
                guard let connection, !connection.closed else { return }
                self.write(Self.encode(object), to: connection)
            }
        }
        guard let object = (try? JSONSerialization.jsonObject(with: line)) as? [String: Any] else {
            reply(["error": "not a JSON object"])
            return
        }
        let handler = self.handler
        handlerQueue.async { handler(object, reply) }
    }

    private func write(_ data: Data, to connection: Connection) {
        let ok = data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) -> Bool in
            guard var pointer = raw.baseAddress else { return true }
            var left = raw.count
            while left > 0 {
                let sent = Darwin.write(connection.fd, pointer, left)
                if sent > 0 { pointer += sent; left -= sent; continue }
                guard sent < 0, errno == EAGAIN || errno == EINTR else { return false }
                // A full socket buffer: wait for room, at most five seconds.
                var poller = pollfd(fd: connection.fd, events: Int16(POLLOUT), revents: 0)
                if poll(&poller, 1, 5000) <= 0 { return false }
            }
            return true
        }
        if !ok { drop(connection) }
    }

    private func drop(_ connection: Connection) {
        guard !connection.closed else { return }
        connection.closed = true
        connection.source?.cancel()   // closes the descriptor
        connection.source = nil
        connections[connection.fd] = nil
    }

    // MARK: Shared

    static func encode(_ object: [String: Any]) -> Data {
        var data = (try? JSONSerialization.data(withJSONObject: object, options: [])) ?? Data("{}".utf8)
        data.append(0x0A)
        return data
    }

    static func address(for path: String) throws -> sockaddr_un {
        var address = sockaddr_un()
        address.sun_family = sa_family_t(AF_UNIX)
        let bytes = Array(path.utf8)
        let capacity = MemoryLayout.size(ofValue: address.sun_path)
        guard bytes.count < capacity else { throw UnixSocketError.pathTooLong }
        withUnsafeMutableBytes(of: &address.sun_path) { raw in
            raw.copyBytes(from: bytes)
            raw[bytes.count] = 0
        }
        address.sun_len = UInt8(MemoryLayout<sockaddr_un>.size)
        return address
    }

    /// Whether a server accepts connections at `path` right now.
    static func answers(_ path: String) -> Bool {
        guard let fd = try? UnixSocketClient.connect(path) else { return false }
        close(fd)
        return true
    }
}

/// The other end: one request, one reply line, on a fresh connection each time.
public enum UnixSocketClient {
    /// Sends `request` and waits for its reply. `timeout` nil waits as long as the server takes.
    public static func send(_ request: [String: Any], to path: String, timeout: TimeInterval? = nil) throws -> [String: Any] {
        let fd = try connect(path)
        defer { close(fd) }
        var on: Int32 = 1
        setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &on, socklen_t(MemoryLayout<Int32>.size))
        let deadline = timeout.map { Date().addingTimeInterval($0) }
        let data = UnixSocketServer.encode(request)
        let sent = data.withUnsafeBytes { raw -> Bool in
            guard var pointer = raw.baseAddress else { return true }
            var left = raw.count
            while left > 0 {
                let n = Darwin.write(fd, pointer, left)
                if n > 0 { pointer += n; left -= n } else if n < 0, errno == EINTR { continue } else { return false }
            }
            return true
        }
        guard sent else { throw UnixSocketError.closed }
        var buffer = Data()
        var chunk = [UInt8](repeating: 0, count: 65536)
        while true {
            if let newline = buffer.firstIndex(of: 0x0A) {
                let line = buffer.subdata(in: buffer.startIndex..<newline)
                guard let object = (try? JSONSerialization.jsonObject(with: line)) as? [String: Any] else { throw UnixSocketError.badReply }
                return object
            }
            var wait: Int32 = -1
            if let deadline {
                let left = deadline.timeIntervalSinceNow
                guard left > 0 else { throw UnixSocketError.timedOut }
                wait = Int32(min(left * 1000, Double(Int32.max)).rounded(.up))
            }
            var poller = pollfd(fd: fd, events: Int16(POLLIN), revents: 0)
            let ready = poll(&poller, 1, wait)
            if ready < 0, errno == EINTR { continue }
            guard ready > 0 else { throw UnixSocketError.timedOut }
            let n = Darwin.read(fd, &chunk, chunk.count)
            if n < 0, errno == EINTR || errno == EAGAIN { continue }
            guard n > 0 else { throw UnixSocketError.closed }
            buffer.append(chunk, count: n)
        }
    }

    /// A connected descriptor, or `.unreachable` when nobody listens (no file, a stale file, a
    /// refusal), which callers treat as "the server is not running".
    static func connect(_ path: String) throws -> Int32 {
        var address = try UnixSocketServer.address(for: path)
        let fd = socket(AF_UNIX, SOCK_STREAM, 0)
        guard fd >= 0 else { throw UnixSocketError.system("socket", errno) }
        let result = withUnsafePointer(to: &address) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.connect(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size)) }
        }
        guard result == 0 else { let e = errno; close(fd); throw UnixSocketError.unreachable(e) }
        return fd
    }
}
