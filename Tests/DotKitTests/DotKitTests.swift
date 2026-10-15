import XCTest
@testable import DotKit

final class TagParserTests: XCTestCase {
    func testPointTag() {
        let parsed = TagParser.parse("click the color inspector up top. [POINT:1100,42:color inspector]")
        XCTAssertEqual(parsed.spoken, "click the color inspector up top.")
        XCTAssertEqual(parsed.tags, [.point(x: 1100, y: 42, label: "color inspector", screen: nil)])
    }

    func testPointOnOtherScreen() {
        let parsed = TagParser.parse("that's on your other monitor. [POINT:400,300:terminal:screen2]")
        XCTAssertEqual(parsed.tags, [.point(x: 400, y: 300, label: "terminal", screen: 2)])
    }

    func testPointNoneAndThink() {
        XCTAssertEqual(TagParser.parse("html is the skeleton of a page. [POINT:none]").tags, [.pointNone])
        XCTAssertEqual(TagParser.parse("let me think about that for a second [THINK]").tags, [.think])
    }

    func testTargetTag() {
        let parsed = TagParser.parse("click add modifier to open the list. [TARGET:120,210,40:add modifier]")
        XCTAssertEqual(parsed.spoken, "click add modifier to open the list.")
        XCTAssertEqual(parsed.tags, [.target(x: 120, y: 210, radius: 40, label: "add modifier", screen: nil)])
        let defaulted = TagParser.parse("now hit save. [TARGET:900,40:save:screen2]")
        XCTAssertEqual(defaulted.tags, [.target(x: 900, y: 40, radius: 28, label: "save", screen: 2)])
    }

    func testHighlight() {
        let parsed = TagParser.parse("look at this block. [HIGHLIGHT:10,20,300,40:the toolbar]")
        XCTAssertEqual(parsed.tags, [.highlight(x: 10, y: 20, width: 300, height: 40, label: "the toolbar", screen: nil)])
    }

    func testAgentBriefKeepsColons() {
        let parsed = TagParser.parse("on it. [AGENT:draft a reply to Priya: say yes to Tuesday 3pm, keep it short]")
        XCTAssertEqual(parsed.spoken, "on it.")
        XCTAssertEqual(parsed.tags, [.agent(brief: "draft a reply to Priya: say yes to Tuesday 3pm, keep it short")])
    }

    func testNewAgent() {
        let parsed = TagParser.parse("sure. [NEW_AGENT:Recruiting:track every banker I email and nudge me at day seven]")
        XCTAssertEqual(parsed.tags, [.newAgent(name: "Recruiting", brief: "track every banker I email and nudge me at day seven")])
    }

    func testMalformedTagIsDroppedButNotSpoken() {
        let parsed = TagParser.parse("hello [POINT:abc] world")
        XCTAssertEqual(parsed.tags, [])
        XCTAssertEqual(parsed.spoken, "hello world")
    }

    func testSpeakablePrefixHoldsOpenTag() {
        let (speak, hold) = TagParser.speakablePrefix("open the menu. [POI")
        XCTAssertEqual(speak, "open the menu. ")
        XCTAssertEqual(hold, "[POI")
        let (speak2, hold2) = TagParser.speakablePrefix("the array [0] holds it")
        XCTAssertEqual(speak2, "the array [0] holds it")
        XCTAssertEqual(hold2, "")
    }
}

final class SentenceSplitterTests: XCTestCase {
    func testSplitsOnTerminatorsFollowedBySpace() {
        var splitter = SentenceSplitter()
        XCTAssertEqual(splitter.feed("hello there. this is "), ["hello there."])
        XCTAssertEqual(splitter.feed("dot! what's up? nothing"), ["this is dot!", "what's up?"])
        XCTAssertEqual(splitter.flush(), "nothing")
    }

    func testDecimalsAndAbbreviationsAreNotBoundaries() {
        var splitter = SentenceSplitter()
        XCTAssertEqual(splitter.feed("it costs 3.5 dollars. e.g. this one "), ["it costs 3.5 dollars."])
        XCTAssertEqual(splitter.pending, "e.g. this one ")
    }

    func testSpeechTextCleaning() {
        XCTAssertEqual(SpeechText.clean("**bold** and `code` at https://example.com/x"), "bold and code at a link")
    }
}

final class ConsentPolicyTests: XCTestCase {
    let policy = ConsentPolicy(allowTools: ["mcp__atlas__facts"], allowToolPrefixes: ["mcp__cua-driver__get_"],
                               denyTools: ["mcp__atlas__send_email"], writableRoots: ["/Users/me/Dot/agents/dot"])

    func request(_ tool: String, _ input: [String: Any] = [:], description: String? = nil) -> ToolRequest {
        ToolRequest(toolName: tool, input: AnyCodableValue.object(from: input), description: description)
    }

    func testReadsPass() {
        XCTAssertEqual(policy.decide(request("Read", ["file_path": "/etc/hosts"])), .allow)
        XCTAssertEqual(policy.decide(request("WebSearch", ["query": "x"])), .allow)
        XCTAssertEqual(policy.decide(request("mcp__atlas__facts")), .allow)
        XCTAssertEqual(policy.decide(request("mcp__cua-driver__get_window_state")), .allow)
    }

    func testWritesInsideAgentFolderPassOutsideAsk() {
        XCTAssertEqual(policy.decide(request("Write", ["file_path": "/Users/me/Dot/agents/dot/output/a.md"])), .allow)
        XCTAssertEqual(policy.decide(request("Write", ["file_path": "/Users/me/Desktop/a.md"])), .ask(reason: "Write /Users/me/Desktop/a.md"))
    }

    func testShellReadsPassWritesAsk() {
        XCTAssertEqual(policy.decide(request("Bash", ["command": "ls -la | head -5"])), .allow)
        XCTAssertEqual(policy.decide(request("Bash", ["command": "git status && git log -3"])), .allow)
        XCTAssertEqual(policy.decide(request("Bash", ["command": "rm -rf build"], description: "Clean")), .ask(reason: "Clean"))
        XCTAssertEqual(policy.decide(request("Bash", ["command": "git push origin main"])), .ask(reason: "git push origin main"))
        XCTAssertEqual(policy.decide(request("Bash", ["command": "imsg send +1555 'hi'"])), .ask(reason: "imsg send +1555 'hi'"))
        XCTAssertEqual(policy.decide(request("Bash", ["command": "echo hi > out.txt"])), .ask(reason: "echo hi > out.txt"))
        XCTAssertEqual(policy.decide(request("Bash", ["command": "python3 build.py"])), .ask(reason: "python3 build.py"))
    }

    func testInputToolsAskAndDenyListDenies() {
        XCTAssertEqual(policy.decide(request("mcp__cua-driver__click", description: "Click Save")), .ask(reason: "cua-driver: Click Save"))
        XCTAssertEqual(policy.decide(request("mcp__atlas__send_email")), .deny(reason: "mcp__atlas__send_email is on the deny list"))
    }
}

final class StreamJSONTests: XCTestCase {
    func testPermissionRequest() {
        let line = #"{"type":"control_request","request_id":"r1","request":{"subtype":"can_use_tool","tool_name":"Bash","input":{"command":"ls"},"description":"List","tool_use_id":"t1"}}"#
        guard case .permissionRequest(let request)? = StreamJSON.parse(line: line) else { return XCTFail("not a permission request") }
        XCTAssertEqual(request.requestId, "r1")
        XCTAssertEqual(request.toolName, "Bash")
        XCTAssertEqual(request.toolRequest.string("command"), "ls")
    }

    func testResultAndDelta() {
        let result = #"{"type":"result","subtype":"success","is_error":false,"duration_ms":1664,"duration_api_ms":1552,"num_turns":1,"total_cost_usd":0.017,"session_id":"s","usage":{"input_tokens":4,"output_tokens":99,"cache_read_input_tokens":10,"cache_creation_input_tokens":20},"result":"done"}"#
        guard case .result(let info)? = StreamJSON.parse(line: result) else { return XCTFail("not a result") }
        XCTAssertEqual(info.outputTokens, 99)
        XCTAssertEqual(info.costUSD, 0.017, accuracy: 0.0001)
        XCTAssertEqual(info.resultText, "done")
        let delta = #"{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}}"#
        XCTAssertEqual(StreamJSON.parse(line: delta), .textDelta("hi"))
    }

    func testUserMessageCarriesImageThenText() throws {
        let line = StreamJSON.userMessage(text: "hello", images: [(Data([1, 2, 3]), "image/jpeg")])
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any])
        let message = try XCTUnwrap(object["message"] as? [String: Any])
        let content = try XCTUnwrap(message["content"] as? [[String: Any]])
        XCTAssertEqual(content.count, 2)
        XCTAssertEqual(content[0]["type"] as? String, "image")
        XCTAssertEqual(content[1]["type"] as? String, "text")
    }
}

final class CoordinatesTests: XCTestCase {
    // A 2560x1600-point display captured at 1280x800, sitting to the right of a primary display.
    let capture = CaptureFrame(displayFrame: CGRect(x: 1512, y: 0, width: 2560, height: 1600), pixelWidth: 1280, pixelHeight: 800)

    func testPixelToScreenAndBack() {
        let screen = Coordinates.screenPoint(fromPixel: CGPoint(x: 640, y: 400), in: capture)
        XCTAssertEqual(screen, CGPoint(x: 1512 + 1280, y: 800))
        XCTAssertEqual(Coordinates.pixelPoint(fromScreen: screen, in: capture), CGPoint(x: 640, y: 400))
        XCTAssertNil(Coordinates.pixelPoint(fromScreen: CGPoint(x: 10, y: 10), in: capture))
    }

    func testOverlayPointFlipsY() {
        let frame = CGRect(x: 1512, y: 0, width: 2560, height: 1600)
        XCTAssertEqual(Coordinates.overlayPoint(fromScreen: CGPoint(x: 1512, y: 1600), screenFrame: frame), .zero)
    }

    func testAppKitRectFromCG() {
        let rect = Coordinates.appKitRect(fromCG: CGRect(x: 100, y: 50, width: 200, height: 30), primaryHeight: 1000)
        XCTAssertEqual(rect, CGRect(x: 100, y: 920, width: 200, height: 30))
    }

    func testNotchGeometry() {
        let geometry = NotchGeometry.measure(frame: CGRect(x: 0, y: 0, width: 1512, height: 982), safeAreaTop: 32,
                                             auxLeft: CGRect(x: 0, y: 950, width: 650, height: 32), auxRight: CGRect(x: 862, y: 950, width: 650, height: 32))
        XCTAssertTrue(geometry.hasNotch)
        XCTAssertEqual(geometry.centerX, 756)
        XCTAssertEqual(geometry.notchWidth, 212)
        XCTAssertEqual(geometry.panelFrame.maxY, 982)
    }
}


final class TodayBriefTests: XCTestCase {
    func testParsesAndSummarises() throws {
        let formatter = DateFormatter(); formatter.dateFormat = "yyyy-MM-dd"; formatter.locale = Locale(identifier: "en_US_POSIX")
        let tomorrow = formatter.string(from: Calendar.current.date(byAdding: .day, value: 1, to: Date())!)
        let farAway = formatter.string(from: Calendar.current.date(byAdding: .day, value: 20, to: Date())!)
        let json = """
        {"built_at":"2026-10-14T22:18","weekday":"Wednesday","date":"2026-10-14",
         "deadlines":["\(tomorrow) Centerview Coffee Chats: email resume by 6 PM CT","\(farAway) Something later"],
         "today":["Wed 10-14 09:30–10:20 Mechanics"],"tomorrow":[],"commitments":[],"todo":[],"waiting":[],
         "unanswered":["a@b.co: hi"],"unanswered_count":3,"preferences":[],"priorities":[],"block":"[today]\\n[/today]"}
        """
        let brief = try XCTUnwrap(TodayBrief.parse(Data(json.utf8)))
        XCTAssertEqual(brief.deadlines(withinDays: 7).count, 1)
        XCTAssertEqual(brief.unansweredCount, 3)
        XCTAssertEqual(brief.morningLine(), "1 deadline this week, first centerview coffee chats. 1 on the calendar today. 3 mail waiting")
        XCTAssertTrue(brief.block.hasPrefix("[today]"))
    }

    func testMissingKeysDecodeToDefaults() throws {
        let brief = try XCTUnwrap(TodayBrief.parse(Data("{\"block\":\"x\"}".utf8)))
        XCTAssertEqual(brief.block, "x")
        XCTAssertEqual(brief.deadlines, [])
        XCTAssertEqual(brief.morningLine(), "")
    }
}
