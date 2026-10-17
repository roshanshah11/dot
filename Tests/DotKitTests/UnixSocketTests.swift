@testable import DotKit
import Darwin
import XCTest

/// Dot's control socket on real sockets at temp paths (AG-07).
final class UnixSocketTests: XCTestCase {
    private var paths: [String] = []

    private func tempPath() -> String {
        let path = (NSTemporaryDirectory() as NSString).appendingPathComponent("dk-\(UUID().uuidString.prefix(8)).sock")
        paths.append(path)
        return path
    }

    override func tearDown() {
        for path in paths { unlink(path) }
        paths = []
        super.tearDown()
    }

    func testRoundTripEchoesTheRequest() throws {
        let path = tempPath()
        let server = UnixSocketServer(path: path) { request, reply in
            reply(["verb": request["verb"] as? String ?? "", "echo": request["n"] as? Int ?? -1])
        }
        try server.start()
        defer { server.stop() }
        let reply = try UnixSocketClient.send(["verb": "gate", "n": 7], to: path, timeout: 5)
        XCTAssertEqual(reply["verb"] as? String, "gate")
        XCTAssertEqual(reply["echo"] as? Int, 7)
    }

    func testSocketFileIsMode0600AndGoneAfterStop() throws {
        let path = tempPath()
        let server = UnixSocketServer(path: path) { _, reply in reply([:]) }
        try server.start()
        var info = stat()
        XCTAssertEqual(stat(path, &info), 0)
        XCTAssertEqual(info.st_mode & 0o777, 0o600)
        XCTAssertEqual(info.st_mode & S_IFMT, S_IFSOCK)
        server.stop()
        XCTAssertFalse(FileManager.default.fileExists(atPath: path))
    }

    func testManyClientsAtOnceEachGetTheirOwnReply() throws {
        let path = tempPath()
        let server = UnixSocketServer(path: path) { request, reply in
            let n = request["n"] as? Int ?? -1
            // Out of order on purpose: later requests answer first.
            DispatchQueue.global().asyncAfter(deadline: .now() + .milliseconds(50 - n % 50)) { reply(["n": n]) }
        }
        try server.start()
        defer { server.stop() }
        let count = 40
        var answers = [Int](repeating: -1, count: count)
        let lock = NSLock()
        DispatchQueue.concurrentPerform(iterations: count) { i in
            let reply = try? UnixSocketClient.send(["n": i], to: path, timeout: 10)
            lock.lock(); answers[i] = reply?["n"] as? Int ?? -2; lock.unlock()
        }
        XCTAssertEqual(answers, Array(0..<count))
    }

    func testAReplyCanComeLongAfterTheRequest() throws {
        let path = tempPath()
        var pending: (([String: Any]) -> Void)?
        let arrived = expectation(description: "request arrived")
        let server = UnixSocketServer(path: path) { _, reply in pending = reply; arrived.fulfill() }
        try server.start()
        defer { server.stop() }
        var result: [String: Any]?
        let done = expectation(description: "reply read")
        DispatchQueue.global().async {
            result = try? UnixSocketClient.send(["verb": "gate"], to: path, timeout: 10)
            done.fulfill()
        }
        wait(for: [arrived], timeout: 5)
        // The card is answered a while later; the client is still waiting.
        Thread.sleep(forTimeInterval: 1.2)
        pending?(["decision": "allow"])
        pending?(["decision": "deny"])   // a second answer is ignored
        wait(for: [done], timeout: 5)
        XCTAssertEqual(result?["decision"] as? String, "allow")
    }

    func testClientTimesOutWhenNoReplyComes() throws {
        let path = tempPath()
        let server = UnixSocketServer(path: path) { _, _ in }
        try server.start()
        defer { server.stop() }
        let started = Date()
        XCTAssertThrowsError(try UnixSocketClient.send(["verb": "gate"], to: path, timeout: 0.3)) { error in
            XCTAssertEqual(error as? UnixSocketError, .timedOut)
        }
        XCTAssertLessThan(Date().timeIntervalSince(started), 2)
    }

    func testNoServerIsUnreachable() {
        let path = tempPath()
        XCTAssertThrowsError(try UnixSocketClient.send(["verb": "gate"], to: path, timeout: 1)) { error in
            guard case .unreachable = error as? UnixSocketError else { return XCTFail("\(error)") }
        }
    }

    func testStaleSocketFileIsReplacedOnStart() throws {
        let path = tempPath()
        // A socket file left by a server that died: bound, never listening, closed.
        var address = try UnixSocketServer.address(for: path)
        let fd = socket(AF_UNIX, SOCK_STREAM, 0)
        let bound = withUnsafePointer(to: &address) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.bind(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size)) }
        }
        XCTAssertEqual(bound, 0)
        close(fd)
        XCTAssertTrue(FileManager.default.fileExists(atPath: path))
        XCTAssertThrowsError(try UnixSocketClient.send([:], to: path, timeout: 1))   // stale: nobody answers

        let server = UnixSocketServer(path: path) { _, reply in reply(["ok": true]) }
        try server.start()
        defer { server.stop() }
        XCTAssertEqual(try UnixSocketClient.send([:], to: path, timeout: 5)["ok"] as? Bool, true)
    }

    func testALiveServerIsNotReplaced() throws {
        let path = tempPath()
        let first = UnixSocketServer(path: path) { _, reply in reply(["who": "first"]) }
        try first.start()
        defer { first.stop() }
        let second = UnixSocketServer(path: path) { _, reply in reply(["who": "second"]) }
        XCTAssertThrowsError(try second.start()) { XCTAssertEqual($0 as? UnixSocketError, .inUse) }
        XCTAssertEqual(try UnixSocketClient.send([:], to: path, timeout: 5)["who"] as? String, "first")
    }

    func testSeveralRequestsOnOneConnectionAndABadLine() throws {
        let path = tempPath()
        let server = UnixSocketServer(path: path) { request, reply in reply(["id": request["id"] as? Int ?? -1]) }
        try server.start()
        defer { server.stop() }
        let fd = try UnixSocketClient.connect(path)
        defer { close(fd) }
        let lines = "{\"id\":1}\nnot json\n{\"id\":2}\n"
        _ = lines.withCString { Darwin.write(fd, $0, strlen($0)) }
        var received = ""
        let deadline = Date().addingTimeInterval(5)
        var chunk = [UInt8](repeating: 0, count: 4096)
        while received.filter({ $0 == "\n" }).count < 3, Date() < deadline {
            var poller = pollfd(fd: fd, events: Int16(POLLIN), revents: 0)
            guard poll(&poller, 1, 500) > 0 else { continue }
            let n = Darwin.read(fd, &chunk, chunk.count)
            guard n > 0 else { break }
            received += String(decoding: chunk[0..<n], as: UTF8.self)
        }
        let replies = received.split(separator: "\n").map(String.init)
        XCTAssertEqual(replies.count, 3)
        XCTAssertTrue(replies.contains("{\"id\":1}"))
        XCTAssertTrue(replies.contains("{\"id\":2}"))
        XCTAssertTrue(replies.contains { $0.contains("not a JSON object") })
    }

    func testAReplyToAClientThatHungUpIsDropped() throws {
        let path = tempPath()
        var pending: (([String: Any]) -> Void)?
        let arrived = expectation(description: "request arrived")
        let server = UnixSocketServer(path: path) { request, reply in
            if request["ping"] != nil { reply(["pong": true]); return }
            pending = reply; arrived.fulfill()
        }
        try server.start()
        defer { server.stop() }
        let fd = try UnixSocketClient.connect(path)
        _ = "{\"verb\":\"gate\"}\n".withCString { Darwin.write(fd, $0, strlen($0)) }
        wait(for: [arrived], timeout: 5)
        close(fd)
        Thread.sleep(forTimeInterval: 0.2)
        pending?(["decision": "allow"])   // must not crash Dot (SIGPIPE) or throw
        Thread.sleep(forTimeInterval: 0.2)
        XCTAssertTrue(server.isRunning)
        XCTAssertEqual(try UnixSocketClient.send(["ping": 1], to: path, timeout: 2)["pong"] as? Bool, true)
    }

    func testTooLongPathIsRefused() {
        let path = "/tmp/" + String(repeating: "x", count: 120)
        XCTAssertThrowsError(try UnixSocketServer(path: path) { _, _ in }.start()) { XCTAssertEqual($0 as? UnixSocketError, .pathTooLong) }
    }
}
