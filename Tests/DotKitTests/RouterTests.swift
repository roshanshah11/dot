import XCTest
@testable import DotKit

final class RouterTests: XCTestCase {
    private func obj(_ s: String) -> [String: Any] { RouterCore.object(s) ?? [:] }

    private func client(_ a: [RouterCore.Action]) -> [[String: Any]] {
        a.compactMap { if case .toClient(let s) = $0 { return obj(s) }; return nil }
    }

    private func child(_ a: [RouterCore.Action]) -> [[String: Any]] {
        a.compactMap { if case .toChild(let s) = $0 { return obj(s) }; return nil }
    }

    private func call(_ id: Int, _ tool: String, _ args: [String: Any] = [:]) -> String {
        RouterCore.line(["jsonrpc": "2.0", "id": id, "method": "tools/call", "params": ["name": tool, "arguments": args]])
    }

    private func text(_ m: [String: Any]) -> String {
        (((m["result"] as? [String: Any])?["content"] as? [[String: Any]])?.first?["text"] as? String) ?? ""
    }

    private func isError(_ m: [String: Any]) -> Bool { ((m["result"] as? [String: Any])?["isError"] as? Bool) ?? false }

    /// Starts the router's child: the first call sends initialize; answer it and return the forwarded messages.
    private func up(_ r: RouterCore, after first: [RouterCore.Action]) -> [[String: Any]] {
        XCTAssertTrue(first.contains(.startChild))
        let hello = child(first).first { $0["method"] as? String == "initialize" }!
        return child(r.childMessage(RouterCore.line(["jsonrpc": "2.0", "id": hello["id"]!, "result": ["protocolVersion": "2025-06-18", "capabilities": [:]]])))
    }

    private func answer(_ r: RouterCore, _ forwarded: [String: Any], _ words: String) -> [RouterCore.Action] {
        r.childMessage(RouterCore.line(["jsonrpc": "2.0", "id": forwarded["id"]!, "result": ["content": [["type": "text", "text": words]], "isError": false]]))
    }

    func testInitializeAnswersAsTheServerWithoutStartingIt() {
        let r = RouterCore(server: "atlas")
        let a = r.clientMessage(#"{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}"#)
        XCTAssertFalse(a.contains(.startChild))
        let reply = client(a)[0]["result"] as! [String: Any]
        XCTAssertEqual((reply["serverInfo"] as! [String: Any])["name"] as? String, "atlas")
        XCTAssertNotNil((reply["capabilities"] as! [String: Any])["tools"])
    }

    func testCachedListServesWithoutStartingAndAddsCheck() {
        let r = RouterCore(server: "atlas", cachedToolList: #"[{"name":"search","inputSchema":{"type":"object"}},{"name":"send_email","inputSchema":{"type":"object"}}]"#)
        let a = r.clientMessage(#"{"jsonrpc":"2.0","id":1,"method":"tools/list"}"#)
        XCTAssertFalse(a.contains(.startChild))
        let names = ((client(a)[0]["result"] as! [String: Any])["tools"] as! [[String: Any]]).map { $0["name"] as! String }
        XCTAssertEqual(names, ["search", "send_email", "router_check"])
    }

    func testListWithoutCacheStartsTheServerAndSavesIt() {
        let r = RouterCore(server: "atlas")
        let first = r.clientMessage(#"{"jsonrpc":"2.0","id":1,"method":"tools/list"}"#)
        let forwarded = up(r, after: first)
        let list = forwarded.first { $0["method"] as? String == "tools/list" }!
        XCTAssertEqual(forwarded.first?["method"] as? String, "notifications/initialized")
        let a = r.childMessage(RouterCore.line(["jsonrpc": "2.0", "id": list["id"]!, "result": ["tools": [["name": "search"]]]]))
        XCTAssertTrue(a.contains { if case .saveToolList(let s) = $0 { return s.contains("search") }; return false })
        XCTAssertEqual((client(a)[0]["id"] as? NSNumber)?.intValue, 1)
    }

    func testHandleLifecycleStartCheckDone() {
        let r = RouterCore(server: "atlas", handleAfter: 20)
        let first = r.clientMessage(call(7, "deck_render", ["deck": "x"]))
        XCTAssertTrue(first.contains { if case .startTimer(_, 20) = $0 { return true }; return false })
        let forwarded = up(r, after: first).first { $0["method"] as? String == "tools/call" }!
        XCTAssertEqual((forwarded["params"] as! [String: Any])["name"] as? String, "deck_render")
        let childID = (forwarded["id"] as! NSNumber).intValue
        // 20 s pass: the call becomes h1 and Claude Code gets its answer now
        let handed = client(r.timerFired(id: childID))
        XCTAssertEqual((handed[0]["id"] as? NSNumber)?.intValue, 7)
        XCTAssertTrue(text(handed[0]).contains("handle is h1"))
        XCTAssertTrue(text(handed[0]).contains("mcp__atlas__router_check"))
        XCTAssertFalse(isError(handed[0]))
        // a check before it ends waits, then says still running
        let waiting = r.clientMessage(call(8, "router_check", ["handle": "h1"]))
        guard case .startTimer(let token, _)? = waiting.first else { return XCTFail("no wait") }
        XCTAssertTrue(token < 0)
        XCTAssertTrue(text(client(r.timerFired(id: token))[0]).contains("still running"))
        // the result arrives with nobody waiting: the next check gets it, and only once
        XCTAssertTrue(client(answer(r, forwarded, "deck saved")).isEmpty)
        let got = client(r.clientMessage(call(9, "router_check", ["handle": "h1"])))
        XCTAssertEqual(text(got[0]), "deck saved")
        XCTAssertTrue(isError(client(r.clientMessage(call(10, "router_check", ["handle": "h1"])))[0]))
    }

    func testCheckWaitingGetsTheResultWhenItArrives() {
        let r = RouterCore(server: "atlas")
        let forwarded = up(r, after: r.clientMessage(call(1, "slow"))).first { $0["method"] as? String == "tools/call" }!
        _ = r.timerFired(id: (forwarded["id"] as! NSNumber).intValue)
        let w1 = r.clientMessage(call(2, "router_check", ["handle": "h1"]))
        let w2 = r.clientMessage(call(3, "router_check", ["handle": "h1"]))
        let done = client(answer(r, forwarded, "ok"))
        XCTAssertEqual(Set(done.map { ($0["id"] as! NSNumber).intValue }), [2, 3])
        // the waits' timers firing later answer nothing
        for a in [w1, w2] { if case .startTimer(let t, _)? = a.first { XCTAssertTrue(r.timerFired(id: t).isEmpty) } }
    }

    func testFastCallAnswersDirectlyAndItsTimerDoesNothing() {
        let r = RouterCore(server: "atlas")
        let forwarded = up(r, after: r.clientMessage(call(4, "search", ["q": "x"]))).first { $0["method"] as? String == "tools/call" }!
        let got = client(answer(r, forwarded, "3 hits"))
        XCTAssertEqual((got[0]["id"] as? NSNumber)?.intValue, 4)
        XCTAssertEqual(text(got[0]), "3 hits")
        XCTAssertTrue(r.timerFired(id: (forwarded["id"] as! NSNumber).intValue).isEmpty)
    }

    func testDiedAndRestarted() {
        let r = RouterCore(server: "atlas")
        let forwarded = up(r, after: r.clientMessage(call(1, "slow"))).first { $0["method"] as? String == "tools/call" }!
        _ = r.timerFired(id: (forwarded["id"] as! NSNumber).intValue)
        _ = r.clientMessage(call(2, "search"))
        let died = client(r.childExited())
        // the plain call errors at once; the handle keeps the error for its check
        XCTAssertEqual((died[0]["id"] as? NSNumber)?.intValue, 2)
        XCTAssertTrue(isError(died[0]))
        XCTAssertTrue(text(died[0]).contains("stopped"))
        XCTAssertTrue(text(client(r.clientMessage(call(3, "router_check", ["handle": "h1"])))[0]).contains("stopped during slow"))
        // the next call starts it again
        let again = r.clientMessage(call(4, "search"))
        XCTAssertTrue(again.contains(.startChild))
        let resent = up(r, after: again).first { $0["method"] as? String == "tools/call" }!
        XCTAssertEqual(text(client(answer(r, resent, "back"))[0]), "back")
    }

    func testFailedHandshakeFailsTheWaitingCallsAndStartsAgainNextTime() {
        let r = RouterCore(server: "atlas")
        let first = r.clientMessage(call(5, "search", ["q": "x"]))
        let hello = child(first).first { $0["method"] as? String == "initialize" }!
        let a = r.childMessage(RouterCore.line(["jsonrpc": "2.0", "id": hello["id"]!, "error": ["code": -32602, "message": "unsupported protocol version"]]))
        XCTAssertTrue(a.contains(.stopChild))
        XCTAssertTrue(child(a).isEmpty, "nothing queued is sent to a server that never initialized")
        let reply = client(a).first { RouterCore.same($0["id"], 5) }!
        XCTAssertTrue(isError(reply))
        XCTAssertTrue(text(reply).contains("unsupported protocol version"))
        let again = r.clientMessage(call(6, "search", ["q": "y"]))
        let forwarded = up(r, after: again)
        XCTAssertEqual(forwarded.compactMap { ($0["params"] as? [String: Any])?["name"] as? String }, ["search"])
    }

    func testDeniedToolIsNotListedAndIsRefusedByName() {
        let r = RouterCore(server: "atlas", denied: ["send_email"], cachedToolList: #"[{"name":"search"},{"name":"send_email"}]"#)
        let names = ((client(r.clientMessage(#"{"jsonrpc":"2.0","id":1,"method":"tools/list"}"#))[0]["result"] as! [String: Any])["tools"] as! [[String: Any]]).map { $0["name"] as! String }
        XCTAssertFalse(names.contains("send_email"))
        let a = r.clientMessage(call(2, "send_email", ["to": "x"]))
        XCTAssertFalse(a.contains(.startChild))
        XCTAssertTrue(child(a).isEmpty)
        XCTAssertTrue(isError(client(a)[0]))
        XCTAssertTrue(text(client(a)[0]).contains("refused: mcp__atlas__send_email"))
    }

    func testStaleCacheIsCheckedOnceTheServerIsUp() {
        let r = RouterCore(server: "atlas", cachedToolList: #"[{"name":"search"}]"#)
        _ = r.clientMessage(#"{"jsonrpc":"2.0","id":1,"method":"tools/list"}"#)
        let forwarded = up(r, after: r.clientMessage(call(2, "search")))
        let relist = forwarded.first { $0["method"] as? String == "tools/list" }!
        let a = r.childMessage(RouterCore.line(["jsonrpc": "2.0", "id": relist["id"]!, "result": ["tools": [["name": "search"], ["name": "deck_render"]]]]))
        XCTAssertTrue(client(a).contains { $0["method"] as? String == "notifications/tools/list_changed" })
        XCTAssertTrue(a.contains { if case .saveToolList = $0 { return true }; return false })
        // the same list again: nothing to say
        let r2 = RouterCore(server: "atlas", cachedToolList: #"[{"name":"search"}]"#)
        _ = r2.clientMessage(#"{"jsonrpc":"2.0","id":1,"method":"tools/list"}"#)
        let f2 = up(r2, after: r2.clientMessage(call(2, "search"))).first { $0["method"] as? String == "tools/list" }!
        XCTAssertTrue(r2.childMessage(RouterCore.line(["jsonrpc": "2.0", "id": f2["id"]!, "result": ["tools": [["name": "search"]]]])).isEmpty)
    }

    func testCancelReachesTheServer() {
        let r = RouterCore(server: "atlas")
        let forwarded = up(r, after: r.clientMessage(call(5, "slow"))).first { $0["method"] as? String == "tools/call" }!
        let a = child(r.clientMessage(#"{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":5}}"#))
        XCTAssertEqual(a.first?["method"] as? String, "notifications/cancelled")
        XCTAssertEqual(((a.first?["params"] as? [String: Any])?["requestId"] as? NSNumber), forwarded["id"] as? NSNumber)
        XCTAssertTrue(client(answer(r, forwarded, "late")).isEmpty)
    }

    func testServerRequestsAreRefused() {
        let r = RouterCore(server: "atlas")
        let a = child(r.childMessage(#"{"jsonrpc":"2.0","id":"s1","method":"sampling/createMessage","params":{}}"#))
        XCTAssertNotNil(a.first?["error"])
    }

    func testIsCheck() {
        XCTAssertTrue(RouterCore.isCheck("mcp__atlas__router_check"))
        XCTAssertTrue(RouterCore.isCheck("mcp__atlas-send__router_check"))
        XCTAssertFalse(RouterCore.isCheck("router_check"))
        XCTAssertFalse(RouterCore.isCheck("mcp__atlas__send_email"))
    }

    func testGateAndOutputCheckTreatACheckAsTheCallItCollects() {
        for bench in [true, false] {
            let c = JobGateContext(bench: bench, jobFolder: "/tmp/j", protectedRoots: [], queuedSends: [], hisWords: "")
            XCTAssertEqual(JobGate.decide(tool: "mcp__atlas__router_check", input: ["handle": .string("h1")], context: c), .allow)
        }
        XCTAssertTrue(Sentinel.checksOutput(toolName: "mcp__atlas__router_check", input: [:]))
        XCTAssertTrue(Sentinel.checksOutput(toolName: "mcp__cua-driver__router_check", input: [:]))
    }

    // MARK: Config

    func testWrapKeepsNamesAndSettingsAndLeavesHandsDirect() throws {
        let original = #"""
        {"mcpServers":{
          "dot":{"command":"/x/Dot","args":["--hands-mcp","--job","abc"],"alwaysLoad":true,"timeout":130000},
          "atlas":{"command":"/py","args":["-m","atlas.mcp"],"env":{"ATLAS_CHAT_SESSION":"s1","SECRET":"k"},"timeout":300000},
          "atlas-send":{"command":"/py","args":["-m","atlas.mcp"],"timeout":60000},
          "remote":{"type":"http","url":"https://example.com/mcp"}
        }}
        """#
        let w = try XCTUnwrap(RouterConfig.wrap(Data(original.utf8), executable: "/x/Dot", specPath: "/tmp/spec.json",
                                                deny: ["mcp__atlas__delete_note", "Bash"]))
        XCTAssertEqual(w.routed, ["atlas", "atlas-send"])
        let servers = (try JSONSerialization.jsonObject(with: w.config) as! [String: Any])["mcpServers"] as! [String: Any]
        XCTAssertEqual(Set(servers.keys), ["dot", "atlas", "atlas-send", "remote"])
        XCTAssertEqual((servers["dot"] as! [String: Any])["args"] as? [String], ["--hands-mcp", "--job", "abc"])
        let atlas = servers["atlas"] as! [String: Any]
        XCTAssertEqual(atlas["command"] as? String, "/x/Dot")
        XCTAssertEqual(atlas["args"] as? [String], ["--router-mcp", "--server", "atlas", "--spec", "/tmp/spec.json", "--deny", "delete_note", "--after", "20"])
        XCTAssertEqual(atlas["timeout"] as? Int, 300000)
        XCTAssertNil(atlas["env"], "the real env stays in the spec file")
        XCTAssertEqual((servers["remote"] as! [String: Any])["url"] as? String, "https://example.com/mcp")
        let real = try XCTUnwrap(RouterConfig.entry(w.spec, server: "atlas"))
        XCTAssertEqual((real["env"] as? [String: String])?["SECRET"], "k")
        XCTAssertNil(RouterConfig.entry(w.spec, server: "dot"))
    }

    func testWrapDropsAWhollyDeniedServer() throws {
        let w = try XCTUnwrap(RouterConfig.wrap(Data(#"{"mcpServers":{"a":{"command":"/a"},"b":{"command":"/b"}}}"#.utf8),
                                                executable: "/x/Dot", specPath: "/s", deny: ["mcp__b"]))
        XCTAssertEqual(w.routed, ["a"])
    }

    func testHandleAfterFitsTheServerTimeout() {
        XCTAssertEqual(RouterConfig.handleAfter(timeoutMs: 300_000), 20)
        XCTAssertEqual(RouterConfig.handleAfter(timeoutMs: 15_000), 10)
        XCTAssertEqual(RouterConfig.handleAfter(timeoutMs: 3_000), 5)
    }

    func testCacheKeyIgnoresTheSession() {
        let a = RouterConfig.cacheKey(server: "atlas", entry: ["command": "/py", "env": ["ATLAS_CHAT_SESSION": "dot-job-1", "ATLAS_MCP_TOOLS": "search"]])
        let b = RouterConfig.cacheKey(server: "atlas", entry: ["command": "/py", "env": ["ATLAS_CHAT_SESSION": "dot-job-2", "ATLAS_MCP_TOOLS": "search"]])
        let c = RouterConfig.cacheKey(server: "atlas", entry: ["command": "/py", "env": ["ATLAS_CHAT_SESSION": "dot-job-1", "ATLAS_MCP_TOOLS": "search,send"]])
        XCTAssertEqual(a, b)
        XCTAssertNotEqual(a, c)
        XCTAssertTrue(a.hasPrefix("atlas-"))
    }
}
