import XCTest
@testable import DotKit

/// AG-12: the agent host's wire format, its stdout buffer, its pending requests and the 30-minute rule.
final class HostProtocolTests: XCTestCase {
    func testRequestsRoundTrip() {
        let spawn = HostSpawn(id: "dot", executable: "/usr/local/bin/claude", arguments: ["-p", "--verbose"], cwd: "/tmp/a", environment: ["DOT": "1"])
        let requests: [HostRequest] = [.spawn(spawn), .write(id: "dot", line: "{\"type\":\"user\"}"), .signal(id: "dot", name: "close"),
                                       .list, .attach(id: "dot", from: 41, wait: 15), .detach(id: "dot")]
        for request in requests {
            // Through real JSON, the way the socket carries it.
            let data = try! JSONSerialization.data(withJSONObject: request.object)
            let object = try! JSONSerialization.jsonObject(with: data) as! [String: Any]
            XCTAssertEqual(HostRequest(object: object), request)
            XCTAssertEqual(object["v"] as? Int, HostProtocol.version)
        }
        XCTAssertNil(HostRequest(object: ["verb": "launch", "id": "dot"]))
        XCTAssertNil(HostRequest(object: ["verb": "write", "line": "x"]), "a write needs an id")
        XCTAssertNil(HostRequest(object: ["verb": "spawn", "id": "dot"]), "a spawn needs an executable")
    }

    func testRepliesRoundTripAndVersion() {
        let info = HostProcessInfo(id: "dot", pid: 4242, alive: true, started: Date(timeIntervalSince1970: 1_000), lastSeq: 7, pending: ["r1"], attached: true)
        XCTAssertEqual(HostProcessInfo(object: info.object), info)
        let reply = HostAttachReply(id: "dot", alive: false, exitStatus: 143, lastSeq: 9, firstSeq: 3,
                                    lines: [HostLine(seq: 9, text: "{}")], pending: [HostLine(seq: 4, text: "{\"x\":1}")], more: true)
        let data = try! JSONSerialization.data(withJSONObject: reply.object)
        XCTAssertEqual(HostAttachReply(object: try! JSONSerialization.jsonObject(with: data) as! [String: Any]), reply)

        XCTAssertTrue(HostProtocol.compatible(HostProtocol.ok()))
        XCTAssertTrue(HostProtocol.compatible(["v": 3, "min": 1]), "a newer host that still speaks v1")
        XCTAssertFalse(HostProtocol.compatible(["v": 3, "min": 2]), "a host that dropped v1: Dot spawns locally")
        XCTAssertFalse(HostProtocol.compatible(["ok": true]), "no version: not a host")
        XCTAssertEqual(HostProtocol.socketPath(environment: ["DOT_HOST_SOCKET": "/tmp/h.sock"]), "/tmp/h.sock")
        XCTAssertTrue(HostProtocol.socketPath(environment: [:]).hasSuffix("/Dot/host.sock"))
    }

    func testLineBufferKeepsSeqAndDropsOldest() {
        var buffer = HostLineBuffer(maxLines: 3, maxBytes: 1_000)
        XCTAssertEqual(buffer.firstSeq, 1)
        for n in 1...5 { XCTAssertEqual(buffer.append("line \(n)"), n) }
        XCTAssertEqual(buffer.count, 3)
        XCTAssertEqual(buffer.firstSeq, 3)
        XCTAssertEqual(buffer.lastSeq, 5)
        XCTAssertEqual(buffer.after(3).lines.map(\.seq), [4, 5], "only the lines after the seq")
        XCTAssertEqual(buffer.after(0).lines.map(\.seq), [3, 4, 5], "lines already dropped are skipped")
        XCTAssertEqual(buffer.after(5).lines, [])
        XCTAssertNil(buffer.line(2))
        XCTAssertEqual(buffer.line(4)?.text, "line 4")
        let (first, more) = buffer.after(0, limit: 2)
        XCTAssertEqual(first.map(\.seq), [3, 4])
        XCTAssertTrue(more)

        var bytes = HostLineBuffer(maxLines: 100, maxBytes: 10)
        bytes.append("aaaaaa"); bytes.append("bbbbbb")
        XCTAssertEqual(bytes.firstSeq, 2, "over the byte bound the oldest goes")
        bytes.append(String(repeating: "c", count: 50))
        XCTAssertEqual(bytes.count, 1, "the newest line stays even when it alone is over the bound")

        var many = HostLineBuffer(maxLines: 10)
        for n in 1...10_000 { many.append("\(n)") }
        XCTAssertEqual(many.after(9_995).lines.map(\.text), ["9996", "9997", "9998", "9999", "10000"], "still right after compaction")
    }

    static func request(_ id: String) -> String {
        #"{"type":"control_request","request_id":"\#(id)","request":{"subtype":"can_use_tool","tool_name":"Bash","input":{"command":"ls"}}}"#
    }

    func testPendingRequestsStartAndEnd() {
        var pending = HostPending()
        let t0 = Date(timeIntervalSince1970: 10_000)
        pending.sawOutput(#"{"type":"assistant","message":{"content":[]}}"#, seq: 1, at: t0)
        pending.sawOutput(#"{"type":"control_request","request_id":"i1","request":{"subtype":"interrupt"}}"#, seq: 2, at: t0)
        XCTAssertEqual(pending.ids, [], "only can_use_tool waits on him")
        pending.sawOutput(Self.request("r1"), seq: 3, at: t0)
        pending.sawOutput(Self.request("r2"), seq: 4, at: t0)
        pending.sawOutput(Self.request("r1"), seq: 5, at: t0)
        XCTAssertEqual(pending.ids, ["r1", "r2"])
        XCTAssertEqual(pending.entries.first?.seq, 3)
        pending.sawInput(StreamJSON.permissionResponse(requestId: "r1", allow: true, updatedInput: [:], message: nil))
        XCTAssertEqual(pending.ids, ["r2"], "Dot's answer, written through the host, ends the wait")
        pending.sawOutput(#"{"type":"control_cancel_request","request_id":"r2"}"#, seq: 6, at: t0)
        XCTAssertEqual(pending.ids, [], "the runtime withdrew it")
    }

    func testThirtyMinuteRule() {
        let t0 = Date(timeIntervalSince1970: 50_000)
        var pending = HostPending()
        pending.sawOutput(Self.request("r1"), seq: 1, at: t0)
        var attachment = HostAttachment(created: t0.addingTimeInterval(-60), lease: 10)

        // Attached: a poll in flight, or one that ended within the lease. Nothing expires, however long.
        attachment.pollBegan(at: t0)
        XCTAssertTrue(pending.expired(now: t0.addingTimeInterval(7_200), unattachedSince: attachment.unattachedSince(t0.addingTimeInterval(7_200))).isEmpty)
        attachment.pollEnded(at: t0.addingTimeInterval(100))
        XCTAssertNil(attachment.unattachedSince(t0.addingTimeInterval(105)), "between polls, within the lease")

        // Dot quit at t0 + 100: the clock starts there, not at the request.
        attachment.detached(at: t0.addingTimeInterval(100))
        let gone = attachment.unattachedSince(t0.addingTimeInterval(200))
        XCTAssertEqual(gone, t0.addingTimeInterval(100))
        XCTAssertEqual(pending.expired(now: t0.addingTimeInterval(100 + 29 * 60), unattachedSince: gone), [])
        XCTAssertEqual(pending.expired(now: t0.addingTimeInterval(100 + 30 * 60), unattachedSince: gone).map(\.requestId), ["r1"])

        // A request asked while nobody was attached counts from when it was asked.
        var later = HostPending()
        later.sawOutput(Self.request("r2"), seq: 2, at: t0.addingTimeInterval(1_000))
        XCTAssertEqual(later.expired(now: t0.addingTimeInterval(1_000 + 29 * 60), unattachedSince: gone), [])
        XCTAssertEqual(later.expired(now: t0.addingTimeInterval(1_000 + 30 * 60), unattachedSince: gone).count, 1)

        // A client that stops polling without detaching (a crash) is gone once its lease ends.
        var crashed = HostAttachment(created: t0, lease: 10)
        crashed.pollBegan(at: t0); crashed.pollEnded(at: t0)
        XCTAssertEqual(crashed.unattachedSince(t0.addingTimeInterval(11)), t0)
        XCTAssertEqual(HostAttachment(created: t0).unattachedSince(t0.addingTimeInterval(5)), t0, "never attached: since the spawn")
    }

    func testDenyLineIsDotKitsOwnPermissionResponse() {
        XCTAssertEqual(HostPending.denyMessage(), "Nobody answered: Dot was not running for 30 minutes.")
        XCTAssertEqual(HostPending.denyMessage(after: 3), "Nobody answered: Dot was not running for 3 seconds.")
        let line = HostPending.denyLine(requestId: "r9")
        let object = try! JSONSerialization.jsonObject(with: Data(line.utf8)) as! [String: Any]
        let own = StreamJSON.permissionResponse(requestId: "r9", allow: false, updatedInput: [:], message: "Nobody answered: Dot was not running for 30 minutes.")
        XCTAssertEqual(object as NSDictionary, try! JSONSerialization.jsonObject(with: Data(own.utf8)) as! NSDictionary)
        let response = object["response"] as! [String: Any]
        XCTAssertEqual(response["request_id"] as? String, "r9")
        XCTAssertEqual((response["response"] as? [String: Any])?["behavior"] as? String, "deny")
        XCTAssertEqual(HostPending.requestId(inOutput: Self.request("r9")), "r9")
        XCTAssertNil(HostPending.requestId(inOutput: line))
    }

    func testSettingsFromEnvironment() {
        XCTAssertEqual(AgentHostCore.Settings.from(environment: [:]).denyAfter, 1_800)
        let short = AgentHostCore.Settings.from(environment: ["DOT_HOST_DENY_AFTER": "4"])
        XCTAssertEqual(short.denyAfter, 4)
        XCTAssertLessThanOrEqual(short.sweepEvery, 1)
        XCTAssertEqual(AgentHostCore.Settings.from(environment: ["DOT_HOST_DENY_AFTER": "soon"]).denyAfter, 1_800)
    }
}
