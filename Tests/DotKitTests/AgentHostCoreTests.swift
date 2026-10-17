import XCTest
@testable import DotKit

/// AG-12: the agent host with a fake `claude` (a /bin/sh script that prints stream-json lines,
/// echoes what it reads, asks permission on "ask", and says bye on SIGTERM).
final class AgentHostCoreTests: XCTestCase {
    static let fakeClaude = #"""
    #!/bin/sh
    trap 'echo "{\"type\":\"bye\"}"; exit 0' TERM
    echo '{"type":"system","subtype":"init","session_id":"fake-session","model":"fake"}'
    n=0
    while IFS= read -r line; do
      n=$((n+1))
      case "$line" in
        *control_response*deny*|*deny*control_response*) echo "{\"type\":\"answered\",\"n\":$n,\"behavior\":\"deny\"}" ;;
        *control_response*) echo "{\"type\":\"answered\",\"n\":$n}" ;;
        *ask*) echo "{\"type\":\"control_request\",\"request_id\":\"req-$n\",\"request\":{\"subtype\":\"can_use_tool\",\"tool_name\":\"Bash\",\"input\":{\"command\":\"ls\"}}}" ;;
        *) echo "{\"type\":\"echo\",\"n\":$n,\"text\":\"$line\"}" ;;
      esac
    done
    """#

    static func writeFake() -> String {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("dot-host-tests-\(UUID().uuidString.prefix(8))")
        try! FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let path = folder.appendingPathComponent("claude").path
        try! fakeClaude.write(toFile: path, atomically: true, encoding: .utf8)
        chmod(path, 0o755)
        return path
    }

    final class Clock { var now = Date(timeIntervalSince1970: 100_000) }

    var core: AgentHostCore!
    var fake: String!
    let clock = Clock()

    override func setUp() {
        fake = Self.writeFake()
        var settings = AgentHostCore.Settings()
        settings.lease = 10
        let clock = self.clock
        core = AgentHostCore(settings: settings, now: { clock.now }, log: { _ in })
    }

    override func tearDown() { core.shutdown() }

    @discardableResult
    func call(_ request: HostRequest, timeout: TimeInterval = 10) -> [String: Any] {
        let done = DispatchSemaphore(value: 0)
        var answer: [String: Any] = [:]
        core.handle(request.object) { reply in answer = reply; done.signal() }
        XCTAssertEqual(done.wait(timeout: .now() + timeout), .success, "no reply to \(request)")
        return answer
    }

    func attach(from: Int, wait: Double = 5) -> HostAttachReply {
        HostAttachReply(object: call(.attach(id: "dot", from: from, wait: wait)))!
    }

    func spawn() {
        let reply = call(.spawn(HostSpawn(id: "dot", executable: fake, arguments: [], cwd: NSTemporaryDirectory(), environment: ["PATH": "/usr/bin:/bin"])))
        XCTAssertEqual(reply["ok"] as? Bool, true, "\(reply)")
        XCTAssertGreaterThan(reply["pid"] as? Int ?? 0, 0)
    }

    func testSpawnWriteDetachAndAttachFromSeq() {
        spawn()
        let first = attach(from: 0)
        XCTAssertEqual(first.lines.map(\.seq), [1])
        XCTAssertTrue(first.lines[0].text.contains("fake-session"))
        call(.write(id: "dot", line: "hello"))
        let second = attach(from: 1)
        XCTAssertEqual(second.lines.map(\.seq), [2])
        XCTAssertTrue(second.lines[0].text.contains("\"text\":\"hello\""), "the fake read what Dot wrote")
        XCTAssertEqual(call(.detach(id: "dot"))["ok"] as? Bool, true)

        // While nobody is attached the process keeps going and its lines are kept.
        call(.write(id: "dot", line: "while away"))
        var later = attach(from: 2, wait: 5)
        if later.lines.isEmpty { later = attach(from: 2, wait: 5) }
        XCTAssertEqual(later.lines.map(\.seq), [3], "only the lines after the seq Dot saved")
        XCTAssertTrue(later.lines[0].text.contains("while away"))
        XCTAssertEqual(attach(from: 0, wait: 0).lines.map(\.seq), [1, 2, 3], "from 0 replays everything held")

        let list = (call(.list)["processes"] as? [[String: Any]] ?? []).compactMap(HostProcessInfo.init(object:))
        XCTAssertEqual(list.map(\.id), ["dot"])
        XCTAssertEqual(list.first?.alive, true)
        XCTAssertEqual(list.first?.lastSeq, 3)
        XCTAssertEqual(call(.spawn(HostSpawn(id: "dot", executable: fake, arguments: [], cwd: "/", environment: [:])))["ok"] as? Bool, false,
                       "one live process per agent")
    }

    func testLongPollWaitsForTheNextLine() {
        spawn()
        _ = attach(from: 0)
        let started = Date()
        let empty = attach(from: 1, wait: 0.3)
        XCTAssertEqual(empty.lines, [])
        XCTAssertGreaterThanOrEqual(Date().timeIntervalSince(started), 0.25, "a poll with nothing new waits")
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.3) { self.core.handle(HostRequest.write(id: "dot", line: "late").object) { _ in } }
        let woken = attach(from: 1, wait: 5)
        XCTAssertEqual(woken.lines.map(\.seq), [2], "a new line ends the wait")
    }

    func testPendingRequestReplayedOnAttachUntilAnswered() {
        spawn()
        _ = attach(from: 0)
        call(.write(id: "dot", line: "ask"))
        let asked = attach(from: 1)
        XCTAssertEqual(HostPending.requestId(inOutput: asked.lines.first?.text ?? ""), "req-1")
        call(.detach(id: "dot"))

        // A relaunched Dot attaches after the request's seq: the host sends it again.
        let back = attach(from: 2, wait: 0)
        XCTAssertEqual(back.lines, [])
        XCTAssertEqual(back.pending.map(\.seq), [2])
        XCTAssertEqual(HostPending.requestId(inOutput: back.pending[0].text), "req-1")
        let info = HostProcessInfo(object: (call(.list)["processes"] as! [[String: Any]])[0])!
        XCTAssertEqual(info.pending, ["req-1"])

        call(.write(id: "dot", line: StreamJSON.permissionResponse(requestId: "req-1", allow: true, updatedInput: [:], message: nil)))
        let answered = attach(from: 2)
        XCTAssertTrue(answered.lines.first?.text.contains("answered") ?? false)
        XCTAssertEqual(answered.pending, [], "answered: no longer replayed")
    }

    func testThirtyMinuteRuleDeniesWhenNobodyIsAttached() {
        spawn()
        _ = attach(from: 0)
        call(.write(id: "dot", line: "ask"))
        _ = attach(from: 1)
        call(.detach(id: "dot"))
        clock.now += 29 * 60
        core.sweep()
        XCTAssertEqual(HostProcessInfo(object: (call(.list)["processes"] as! [[String: Any]])[0])!.pending, ["req-1"], "29 minutes: still waiting")
        clock.now += 60
        core.sweep()
        let denied = attach(from: 2, wait: 5)
        XCTAssertTrue(denied.lines.first?.text.contains("\"behavior\":\"deny\"") ?? false, "the host wrote a deny to the process: \(denied.lines)")
        XCTAssertEqual(denied.pending, [])

        // Attached (a poll just ended, inside the lease): a request does not expire.
        call(.write(id: "dot", line: "ask again"))
        let again = attach(from: 3)
        XCTAssertEqual(HostPending.requestId(inOutput: again.lines.first?.text ?? ""), "req-3")
        clock.now += 5
        core.sweep()
        XCTAssertEqual(HostProcessInfo(object: (call(.list)["processes"] as! [[String: Any]])[0])!.pending, ["req-3"])
    }

    func testExitIsReportedThenCollected() {
        spawn()
        _ = attach(from: 0)
        XCTAssertEqual(call(.signal(id: "dot", name: "TERM"))["ok"] as? Bool, true)
        var seen: [HostLine] = []
        var end = attach(from: 1, wait: 5)
        seen += end.lines
        for _ in 0..<20 where end.alive { end = attach(from: seen.last?.seq ?? 1, wait: 1); seen += end.lines }
        XCTAssertFalse(end.alive)
        XCTAssertEqual(end.exitStatus, 0)
        XCTAssertTrue(seen.contains { $0.text.contains("bye") }, "the last line before the exit is not lost")
        XCTAssertEqual((call(.list)["processes"] as? [[String: Any]])?.count, 0, "collected once its last line was handed over")
        XCTAssertEqual(call(.attach(id: "dot", from: 0, wait: 0))["ok"] as? Bool, false)
    }

    func testCloseEndsInputAndBadRequestsAreRefused() {
        spawn()
        _ = attach(from: 0)
        XCTAssertEqual(call(.signal(id: "dot", name: "close"))["ok"] as? Bool, true)
        var end = attach(from: 1, wait: 5)
        for _ in 0..<20 where end.alive { end = attach(from: 1, wait: 1) }
        XCTAssertFalse(end.alive, "end of input ends the fake's read loop")
        XCTAssertEqual(end.exitStatus, 0)

        let done = DispatchSemaphore(value: 0)
        var answer: [String: Any] = [:]
        core.handle(["verb": "launch"]) { answer = $0; done.signal() }
        _ = done.wait(timeout: .now() + 5)
        XCTAssertEqual(answer["ok"] as? Bool, false)
        XCTAssertTrue(HostProtocol.compatible(answer), "a refusal still says which protocol the host speaks")
        XCTAssertEqual(call(.write(id: "nobody", line: "x"))["ok"] as? Bool, false)
        XCTAssertEqual(call(.spawn(HostSpawn(id: "bad", executable: "/no/such/claude", arguments: [], cwd: "/", environment: [:])))["ok"] as? Bool, false)
    }

    /// Dot's side over a real socket: spawn, follow, write, detach, follow again from the saved seq.
    func testClientFollowsOverTheSocketAndReplaysAWaitingRequestOnce() throws {
        let path = NSTemporaryDirectory() + "dh-\(UUID().uuidString.prefix(6)).sock"
        let server = UnixSocketServer(path: path, handler: core.handle)
        try server.start()
        defer { server.stop() }
        let client = AgentHostClient(path: path)
        XCTAssertNotNil(client.spawn(HostSpawn(id: "dot", executable: fake, arguments: [], cwd: NSTemporaryDirectory(), environment: ["PATH": "/usr/bin:/bin"])))
        XCTAssertNil(AgentHostClient(path: path + ".none").list(), "no host: nil, and Dot spawns locally")

        final class Seen { let lock = NSLock(); var lines: [HostLine] = []; var ended: Int32?? = nil
            func add(_ l: [HostLine]) { lock.lock(); lines += l; lock.unlock() }
            var snapshot: [HostLine] { lock.lock(); defer { lock.unlock() }; return lines } }
        func waitFor(_ what: String, _ condition: () -> Bool) {
            let deadline = Date().addingTimeInterval(8)
            while !condition(), Date() < deadline { Thread.sleep(forTimeInterval: 0.05) }
            XCTAssertTrue(condition(), what)
        }
        let first = Seen()
        let follower = client.follow(id: "dot", from: 0, onLines: first.add, onEnd: { first.ended = $0 })
        follower.wait = 1
        client.write(id: "dot", line: "ask")
        waitFor("the request arrives") { first.snapshot.contains { HostPending.requestId(inOutput: $0.text) == "req-1" } }
        let requests = { (seen: Seen) in seen.snapshot.filter { HostPending.requestId(inOutput: $0.text) != nil }.count }
        Thread.sleep(forTimeInterval: 1.5)   // a poll or two more: the request is not delivered again
        XCTAssertEqual(requests(first), 1)
        let saved = first.snapshot.last!.seq
        follower.cancel()
        XCTAssertTrue(client.detach(id: "dot"))

        let second = Seen()
        let again = client.follow(id: "dot", from: saved, onLines: second.add, onEnd: { second.ended = $0 })
        again.wait = 1
        waitFor("a relaunched Dot gets the waiting request back") { requests(second) == 1 }
        client.write(id: "dot", line: "after")
        waitFor("then only newer lines") { second.snapshot.contains { $0.text.contains("after") } }
        XCTAssertTrue(second.snapshot.allSatisfy { $0.seq > saved || HostPending.requestId(inOutput: $0.text) != nil })
        XCTAssertEqual(requests(second), 1)
        client.signal(id: "dot", "TERM")
        waitFor("the exit reaches the follower") { second.ended != nil }
        XCTAssertEqual(second.ended, .some(0))
    }
}
