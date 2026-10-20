import XCTest
@testable import DotKit

/// The dot tools a job acts through (03): the MCP wire, the page snapshot, his rule on the resolved element, and
/// downloads by Comet's own handling.
final class HandsMCPWireTests: XCTestCase {
    func testInitializeNamesDotAndEchoesTheVersion() {
        let req = HandsMCPWire.parse(#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26"}}"#)!
        let reply = HandsMCPWire.localReply(req)!
        let json = try! JSONSerialization.jsonObject(with: reply.data(using: .utf8)!) as! [String: Any]
        let result = json["result"] as! [String: Any]
        XCTAssertEqual(result["protocolVersion"] as? String, "2025-03-26")
        XCTAssertEqual((result["serverInfo"] as? [String: Any])?["name"] as? String, "dot")
        XCTAssertEqual(json["id"] as? Int, 1)
    }

    func testToolsList() {
        let list = HandsMCPWire.toolsList()["tools"] as! [[String: Any]]
        XCTAssertEqual(list.map { $0["name"] as! String },
                       ["look", "open", "click", "type", "select", "key", "scroll", "back", "wait", "download", "upload", "show", "play"])
        for tool in list {
            let schema = tool["inputSchema"] as! [String: Any]
            XCTAssertEqual(schema["type"] as? String, "object")
            XCTAssertEqual(schema["additionalProperties"] as? Bool, false)
            let props = schema["properties"] as! [String: Any]
            for banned in ["session", "namespace", "extraArgs", "port", "eval", "script"] { XCTAssertNil(props[banned], "\(tool["name"]!) \(banned)") }
            XCTAssertEqual((tool["_meta"] as? [String: Any])?["anthropic/alwaysLoad"] as? Bool, true)
        }
        let data = try! JSONSerialization.data(withJSONObject: HandsMCPWire.toolsList())
        XCTAssertLessThan(data.count, 10_000, "the whole list stays under about 2.5k tokens")
    }

    func testNotificationsAndUnknownMethods() {
        XCTAssertNil(HandsMCPWire.localReply(HandsMCPWire.parse(#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#)!))
        let unknown = HandsMCPWire.localReply(HandsMCPWire.parse(#"{"jsonrpc":"2.0","id":"a","method":"resources/list"}"#)!)!
        XCTAssertTrue(unknown.contains("-32601"))
        XCTAssertTrue(unknown.contains("\"id\":\"a\""), "string ids come back as strings")
        XCTAssertNil(HandsMCPWire.localReply(HandsMCPWire.parse(#"{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"look"}}"#)!), "the caller relays calls")
        XCTAssertNotNil(HandsMCPWire.localReply(HandsMCPWire.parse(#"{"jsonrpc":"2.0","id":3,"method":"ping"}"#)!))
    }

    func testCallResultWithAnImage() {
        let r = HandsMCPWire.callResult(text: "ok", isError: false, imageBase64: "AAAA")
        XCTAssertEqual((r["content"] as! [[String: Any]]).count, 2)
        XCTAssertEqual(HandsMCPWire.callResult(text: "Dot is not running", isError: true)["isError"] as? Bool, true)
    }
}

final class PageSnapshotTests: XCTestCase {
    func fixture(_ name: String) -> [[String: Any]] {
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Fixtures/page/\(name)")
        let json = try! JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
        return json["nodes"] as! [[String: Any]]
    }

    func testDownloadPage() {
        let items = PageSnapshot.candidates(axNodes: fixture("dl-ax.json"))
        let (text, refs) = PageSnapshot.format(url: "http://127.0.0.1:8766/dl.html", title: "Dot bench - Week 3 readings", items: items, viewportHeight: nil)
        XCTAssertTrue(text.contains("heading \"COURSE 101 · Week 3 readings\""), text)
        XCTAssertTrue(text.contains("link \"Week 3 reading (PDF)\""), text)
        XCTAssertFalse(text.contains("StaticText"))
        XCTAssertFalse(text.contains("InlineTextBox"))
        let ref = text.split(separator: "\n").first { $0.contains("Week 3 lecture notes") }!.split(separator: " ").first!
        XCTAssertNotNil(refs[String(ref)])
    }

    func testApplyPageFlagsHisButtons() {
        let items = PageSnapshot.candidates(axNodes: fixture("apply-ax.json"))
        let (text, _) = PageSnapshot.format(url: "http://127.0.0.1:8766/apply.html", title: "Dot bench - Apply", items: items, viewportHeight: nil)
        XCTAssertTrue(text.contains("button \"Submit application\" [his]"), text)
        XCTAssertTrue(text.contains("button \"Save draft\"\n") || text.hasSuffix("button \"Save draft\""), text)
        XCTAssertTrue(text.contains("textbox \"Full name\""), text)
    }

    func testCapsAndOffScreen() {
        let items = (0..<80).map { PageSnapshot.Item(backendId: $0, role: "link", name: "Item \($0)", top: Double($0 * 40), bottom: Double($0 * 40 + 20)) }
        let (text, refs) = PageSnapshot.format(url: "u", title: "t", items: items, viewportHeight: 800)
        XCTAssertEqual(refs.count, 20, "only what's on screen by default")
        XCTAssertTrue(text.contains("...60 more"))
        let (allText, allRefs) = PageSnapshot.format(url: "u", title: "t", items: items, viewportHeight: 800, all: true)
        XCTAssertEqual(allRefs.count, 80)
        XCTAssertTrue(allText.contains("(off screen)"))
        let long = (0..<200).map { PageSnapshot.Item(backendId: $0, role: "link", name: String(repeating: "x", count: 70)) }
        XCTAssertLessThanOrEqual(PageSnapshot.format(url: "u", title: "t", items: long, viewportHeight: nil, all: true).text.count, 6000)
    }
}

final class PageCommitRuleTests: XCTestCase {
    func v(_ name: String, tag: String = "button", type: String = "button", role: String = "button", form: Bool = false, search: Bool = false,
           ancestors: [String] = []) -> PageVerdict {
        PageCommitRule.verdict(name: name, role: role, tag: tag, type: type, inForm: form, formIsSearch: search, ancestors: ancestors)
    }

    func testHis() {
        for name in ["Submit application", "Send", "Buy now", "Place your order", "Book appointment", "Pay $12.00", "Reply all",
                     "Upload & Complete »", "Submit my Booking", "Print", "Sign in", "Log in", "Schedule"] {
            if case .his = v(name) {} else { XCTFail(name) }
        }
        if case .his = v("", tag: "button", type: "", form: true) {} else if case .unnamed = v("", tag: "button", type: "", form: true) {} else { XCTFail("unnamed default button") }
        if case .his = v("Go", tag: "input", type: "submit", role: "button", form: true) {} else { XCTFail("submit input in a non-search form") }
        if case .his = v("Continue", tag: "button", type: "", form: true) {} else { XCTFail("a default button in a form submits it") }
        if case .his = v("I'm not a robot", tag: "input", type: "checkbox", role: "checkbox") {} else { XCTFail("captcha") }
        if case .his = v("Quick Check", tag: "input", type: "checkbox", role: "checkbox") {} else { XCTFail("tal.net quick check") }
        if case .his = v("Continue", ancestors: ["Submit order"]) {} else { XCTFail("an ancestor's label counts") }
    }

    func testOk() {
        for name in ["Save draft", "Next", "Continue", "Download", "Apply filters", "Accept all cookies", "Open the reading"] {
            XCTAssertEqual(v(name), .ok, name)
        }
        XCTAssertEqual(v("Week 3 reading (PDF)", tag: "a", type: "", role: "link"), .ok)
        XCTAssertEqual(v("Search", tag: "button", type: "submit", form: true, search: true), .ok)
        XCTAssertEqual(v("Accept"), .his("Accept"), "a bare accept is his")
    }

    func testUnnamed() {
        XCTAssertEqual(v("➤", tag: "div", type: "", role: "button"), .unnamed)
        XCTAssertEqual(v("  ", tag: "button"), .unnamed)
    }

    func testTypingAndKeys() {
        if case .his = PageCommitRule.typeVerdict(inputType: "password") {} else { XCTFail("password") }
        XCTAssertEqual(PageCommitRule.typeVerdict(inputType: "text"), .ok)
        XCTAssertEqual(PageCommitRule.keyVerdict(key: "Enter", focusedTag: "input", focusedType: "search"), .ok)
        XCTAssertEqual(PageCommitRule.keyVerdict(key: "Enter", focusedTag: "input", placeholder: "Search jobs"), .ok)
        if case .his = PageCommitRule.keyVerdict(key: "Enter", focusedTag: "textarea", placeholder: "Write a message") {} else { XCTFail("enter in a message box") }
        if case .his = PageCommitRule.keyVerdict(key: "Enter", focusedTag: "input", placeholder: "Name") {} else { XCTFail("enter in a form field") }
        if case .his = PageCommitRule.keyVerdict(key: "Enter", command: true, focusedTag: "input", focusedType: "search") {} else { XCTFail("cmd+enter") }
        if case .his = PageCommitRule.keyVerdict(key: "Enter", focusedTag: "input", focusedType: "search", host: "boards.greenhouse.io") {} else { XCTFail("greenhouse") }
        if case .his = PageCommitRule.keyVerdict(key: "Escape", host: "example.myworkdayjobs.com") {} else { XCTFail("workday escape") }
        for key in ["Tab", "Escape", "ArrowDown", "PageDown", "Space", "Home"] { XCTAssertEqual(PageCommitRule.keyVerdict(key: key), .ok, key) }
    }
}

final class DownloadWatchTests: XCTestCase {
    func testTheObservedEventPair() {
        var watch = DownloadWatch(frames: ["EDE28A9A"])
        let begin: [String: Any] = ["frameId": "EDE28A9A", "guid": "24aa9628", "url": "http://127.0.0.1:8766/dotbench-week3-reading.pdf",
                                    "suggestedFilename": "dotbench-week3-reading.pdf"]
        XCTAssertNotNil(watch.fold(method: "Browser.downloadWillBegin", params: begin))
        XCTAssertNil(watch.fold(method: "Page.downloadWillBegin", params: begin), "Page.* repeats it")
        let done = watch.fold(method: "Browser.downloadProgress", params: ["guid": "24aa9628", "totalBytes": 45, "receivedBytes": 45,
                                                                           "state": "completed", "filePath": "/tmp/dot-bench/downloads/dotbench-week3-reading (1).pdf"])
        XCTAssertEqual(done?.state, "completed")
        XCTAssertEqual(done?.filePath, "/tmp/dot-bench/downloads/dotbench-week3-reading (1).pdf")
        XCTAssertEqual(watch.completed.count, 1)
    }

    func testHisOwnDownloadsAreNotTheJobs() {
        var watch = DownloadWatch(frames: ["JOBFRAME"])
        XCTAssertNil(watch.fold(method: "Browser.downloadWillBegin", params: ["frameId": "HISFRAME", "guid": "g2", "suggestedFilename": "his.pdf"]))
        XCTAssertNil(watch.fold(method: "Browser.downloadProgress", params: ["guid": "g2", "state": "completed", "filePath": "/x/his.pdf"]))
        XCTAssertTrue(watch.completed.isEmpty)
    }

    func testUniquePath() {
        let taken: Set<String> = ["/d/x.pdf", "/d/x (1).pdf"]
        XCTAssertEqual(DownloadWatch.uniquePath(in: "/d", name: "x.pdf", exists: { taken.contains($0) }), "/d/x (2).pdf")
        XCTAssertEqual(DownloadWatch.uniquePath(in: "/d", name: "y.pdf", exists: { taken.contains($0) }), "/d/y.pdf")
        XCTAssertEqual(DownloadWatch.uniquePath(in: "/d", name: "protein : Nature.pdf", exists: { _ in false }), "/d/protein - Nature.pdf")
    }
}
