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
                               denyTools: ["mcp__atlas__send_email"], writableRoots: ["/Users/me/Dot/agents/dot", "/Users/me", NSHomeDirectory()],
                               protectedRoots: ["/Users/me/.ssh", NSHomeDirectory() + "/.ssh"])

    func request(_ tool: String, _ input: [String: Any] = [:], description: String? = nil) -> ToolRequest {
        ToolRequest(toolName: tool, input: AnyCodableValue.object(from: input), description: description)
    }

    func testReadsPass() {
        XCTAssertEqual(policy.decide(request("Read", ["file_path": "/etc/hosts"])), .allow)
        XCTAssertEqual(policy.decide(request("WebSearch", ["query": "x"])), .allow)
        XCTAssertEqual(policy.decide(request("mcp__atlas__facts")), .allow)
        XCTAssertEqual(policy.decide(request("mcp__cua-driver__get_window_state")), .allow)
    }

    func testWritesUnderHomePassProtectedAsk() {
        XCTAssertEqual(policy.decide(request("Write", ["file_path": "/Users/me/Dot/agents/dot/output/a.md"])), .allow)
        XCTAssertEqual(policy.decide(request("Write", ["file_path": "/Users/me/Desktop/a.md"])), .allow)
        XCTAssertEqual(policy.decide(request("Write", ["file_path": "/Users/me/.ssh/config"])).isAsk, true)
        XCTAssertEqual(policy.decide(request("Write", ["file_path": NSHomeDirectory() + "/.ssh/config"])).isAsk, true)
        XCTAssertEqual(policy.decide(request("Write", ["file_path": "/etc/hosts"])).isAsk, true)
    }

    func testShellOnlyOutwardAndIrreversibleAsk() {
        XCTAssertEqual(policy.decide(request("Bash", ["command": "ls -la | head -5"])), .allow)
        XCTAssertEqual(policy.decide(request("Bash", ["command": "git status && git log -3"])), .allow)
        XCTAssertEqual(policy.decide(request("Bash", ["command": "echo hi > out.txt"])), .allow)
        XCTAssertEqual(policy.decide(request("Bash", ["command": "python3 build.py"])), .allow)
        XCTAssertEqual(policy.decide(request("Bash", ["command": "mkdir -p ~/Desktop/x && cp a.md ~/Desktop/x/"])), .allow)
        XCTAssertEqual(policy.decide(request("Bash", ["command": "open -a Notes"])), .allow)
        XCTAssertEqual(policy.decide(request("Bash", ["command": "osascript -e 'tell application \"Notes\" to make new note'"])), .allow)
        XCTAssertEqual(policy.decide(request("Bash", ["command": "hb open https://example.com && hb get text"])), .allow)
        XCTAssertEqual(policy.decide(request("Bash", ["command": "git commit -m 'draft'"])), .allow)
        XCTAssertEqual(policy.decide(request("Bash", ["command": "rm -rf build"], description: "Clean")), .ask(reason: "Clean"))
        XCTAssertEqual(policy.decide(request("Bash", ["command": "git push origin main"])), .ask(reason: "git push origin main"))
        XCTAssertEqual(policy.decide(request("Bash", ["command": "imsg send +1555 'hi'"])), .ask(reason: "imsg send +1555 'hi'"))
        XCTAssertEqual(policy.decide(request("Bash", ["command": "hb click 'Submit application'"])), .ask(reason: "hb click 'Submit application'"))
        XCTAssertEqual(policy.decide(request("Bash", ["command": "osascript -e 'tell application \"Mail\" to send msg'"])).isAsk, true)
        XCTAssertEqual(policy.decide(request("Bash", ["command": "brew install jq"])), .ask(reason: "brew install jq"))
        XCTAssertEqual(policy.decide(request("Bash", ["command": "cat ~/.ssh/id_ed25519"])), .ask(reason: "cat ~/.ssh/id_ed25519"))
    }

    func testToolsPassUnlessOutward() {
        XCTAssertEqual(policy.decide(request("mcp__cua-driver__click", ["element_index": 4], description: "Click Save")), .allow)
        XCTAssertEqual(policy.decide(request("mcp__cua-driver__click", ["element_index": 4, "label": "Send message"])), .ask(reason: "cua-driver: click"))
        XCTAssertEqual(policy.decide(request("mcp__cua-driver__type_text", ["text": "hello there"])), .allow)
        XCTAssertEqual(policy.decide(request("mcp__atlas__draft_email", ["to": "a@b.c"])), .allow)
        XCTAssertEqual(policy.decide(request("mcp__atlas__reply", ["id": "m1"])), .ask(reason: "atlas: reply"))
        XCTAssertEqual(policy.decide(request("mcp__claude_ai_Gmail__create_draft")), .allow)
        XCTAssertEqual(policy.decide(request("mcp__claude_ai_Gmail__send_message")), .ask(reason: "claude_ai_Gmail: send_message"))
        XCTAssertEqual(policy.decide(request("mcp__claude_ai_Gmail__trash_thread")), .ask(reason: "claude_ai_Gmail: trash_thread"))
        XCTAssertEqual(policy.decide(request("mcp__atlas__send_email")), .deny(reason: "mcp__atlas__send_email is on the deny list"))
    }
}

extension ConsentDecision {
    var isAsk: Bool { if case .ask = self { return true } else { return false } }
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


final class AgentResultTests: XCTestCase {
    func testNextLineBecomesAButton() {
        let parsed = AgentResult.parse("Done, the brief is on your desktop.\n\nNext: compare launch economics\n")
        XCTAssertEqual(parsed.body, "Done, the brief is on your desktop.")
        XCTAssertEqual(parsed.nextAction, "compare launch economics")
        let plain = AgentResult.parse("Nothing to suggest here.")
        XCTAssertEqual(plain.body, "Nothing to suggest here.")
        XCTAssertNil(plain.nextAction)
    }
}

final class AlwaysAskTests: XCTestCase {
    func testDangerousCommandsAreNeverCleared() {
        XCTAssertTrue(ConsentPolicy.isAlwaysAsk("rm -rf ~/Dot"))
        XCTAssertTrue(ConsentPolicy.isAlwaysAsk("git push origin main"))
        XCTAssertTrue(ConsentPolicy.isAlwaysAsk("imsg send +1555 hi"))
        XCTAssertFalse(ConsentPolicy.isAlwaysAsk("echo hi > ~/notes.txt"))   // writes under his home run on their own (2026-10-15)
        XCTAssertFalse(ConsentPolicy.isAlwaysAsk("sips -s format png in.icns --out tmp/out.png"))
        XCTAssertFalse(ConsentPolicy.isAlwaysAsk("python3 tmp/build_report.py"))
    }
}

final class HoverLineTests: XCTestCase {
    func testNextEventAndHoverLine() throws {
        var brief = TodayBrief.parse(Data("""
        {"built_at":"2026-10-15T01:00","weekday":"Thursday","date":"2026-10-15","deadlines":[],"today":["Thu 10-15 08:30–09:30 Intern Weekly Meeting","Thu 10-15 10:00–10:15 Call: Radha Gupta (MTS) (at Phone (her cell))","Thu 10-15 10:15–10:50 MATH 20250: terminology"],"tomorrow":[],"commitments":[],"todo":[],"waiting":[],"unanswered":[],"unanswered_count":3,"preferences":[],"priorities":[],"block":""}
        """.utf8))
        let unwrapped = try XCTUnwrap(brief)
        brief = unwrapped
        var components = DateComponents(); components.year = 2026; components.month = 10; components.day = 15; components.hour = 9; components.minute = 40
        let at940 = Calendar.current.date(from: components)!
        let next = try XCTUnwrap(unwrapped.nextEvent(from: at940))
        XCTAssertEqual(next.title, "Call: Radha Gupta (MTS)")
        XCTAssertEqual(next.startsIn, 20)
        XCTAssertEqual(next.endsIn, 35)
        XCTAssertEqual(unwrapped.hoverLine(from: at940), "next: call: radha gupta (mts) in 20 min · 3 on the calendar today · 3 mail waiting")
        components.hour = 9; components.minute = 0
        let during = unwrapped.nextEvent(from: Calendar.current.date(from: components)!)
        XCTAssertEqual(during?.title, "Intern Weekly Meeting")
        XCTAssertEqual(during?.startsIn, -30)
        components.hour = 23
        XCTAssertNil(unwrapped.nextEvent(from: Calendar.current.date(from: components)!))
    }
}

final class BeatTests: XCTestCase {
    func testHoverAndShapeTags() {
        let hover = TagParser.parse("rest on file to open the menu. [HOVER:40,12,22:file menu]")
        XCTAssertEqual(hover.tags, [.hover(x: 40, y: 12, radius: 22, label: "file menu", screen: nil)])
        let arrow = TagParser.parse("[SHAPE:arrow:100,200;300,220:drag it here] drag the clip over here.")
        XCTAssertEqual(arrow.spoken, "drag the clip over here.")
        XCTAssertEqual(arrow.tags, [.shape(kind: .arrow, points: [ShapePoint(x: 100, y: 200), ShapePoint(x: 300, y: 220)], label: "drag it here", screen: nil)])
        let circle = TagParser.parse("[SHAPE:circle:500,300;540,300:the knob:screen2] this knob.")
        XCTAssertEqual(circle.tags, [.shape(kind: .circle, points: [ShapePoint(x: 500, y: 300), ShapePoint(x: 540, y: 300)], label: "the knob", screen: 2)])
        XCTAssertEqual(TagParser.parse("[SHAPE:polygon:1,1;2,2:two points]").tags, [])
        XCTAssertEqual(TagParser.parse("[SHAPE:blob:1,1;2,2:x]").tags, [])
    }

    func testTagFirstBeatsAttachToTheFollowingSentence() {
        var streamer = BeatStreamer()
        var beats: [Beat] = []
        for delta in ["[POINT:10,20:sidebar] this is the sidebar. ", "[HIGH", "LIGHT:0,0,50,50:toolbar] the toolbar lives up here.", " and that's it. [POINT:none]"] {
            beats += streamer.feed(delta)
        }
        beats += streamer.flush()
        XCTAssertEqual(beats.map(\.text), ["this is the sidebar.", "the toolbar lives up here.", "and that's it.", ""])
        XCTAssertEqual(beats[0].tags, [.point(x: 10, y: 20, label: "sidebar", screen: nil)])
        XCTAssertEqual(beats[1].tags, [.highlight(x: 0, y: 0, width: 50, height: 50, label: "toolbar", screen: nil)])
        XCTAssertEqual(beats[2].tags, [])
        XCTAssertEqual(beats[3].tags, [.pointNone])
        XCTAssertEqual(streamer.spokenSoFar, "this is the sidebar. the toolbar lives up here. and that's it.")
    }

    func testTrailingTagsBecomeAWordlessBeat() {
        var streamer = BeatStreamer()
        var beats = streamer.feed("on it, i'll tell you when it's done.\n[AGENT:find the three cheapest flights to austin next weekend]")
        beats += streamer.flush()
        XCTAssertEqual(beats.count, 2)
        XCTAssertEqual(beats[0].text, "on it, i'll tell you when it's done.")
        XCTAssertEqual(beats[0].tags, [])
        XCTAssertEqual(beats[1].text, "")
        XCTAssertEqual(beats[1].tags, [.agent(brief: "find the three cheapest flights to austin next weekend")])
    }

    func testInlineTagStaysWithItsSentence() {
        var streamer = BeatStreamer()
        var beats = streamer.feed("click save [TARGET:900,40,20:save] up top. then wait.")
        beats += streamer.flush()
        XCTAssertEqual(beats.map(\.text), ["click save up top.", "then wait."])
        XCTAssertEqual(beats[0].tags, [.target(x: 900, y: 40, radius: 20, label: "save", screen: nil)])
        XCTAssertEqual(beats[1].tags, [])
        XCTAssertEqual(BeatStreamer().partial, "")
    }

    func testEagerFirstClauseStartsTheVoiceEarly() {
        var eager = SentenceSplitter(eagerFirst: true)
        let text = "this is the start here page for your midterm prep folder, and the table is a map of seven files. then more."
        var out = eager.feed(text)
        XCTAssertEqual(out.first, "this is the start here page for your midterm prep folder,")
        XCTAssertEqual(out.count, 2)
        XCTAssertEqual(out[1], "and the table is a map of seven files.")
        out += eager.flush().map { [$0] } ?? []
        XCTAssertEqual(out.last, "then more.")
        var plain = SentenceSplitter()
        XCTAssertEqual(plain.feed(text).count, 1)   // the last sentence waits for a space or a flush
        var short = SentenceSplitter(eagerFirst: true)
        XCTAssertEqual(short.feed("yes, that one. "), ["yes, that one."])   // too short to cut at the comma
    }

    func testPartialShowsTheSentenceInProgressWithoutTags() {
        var streamer = BeatStreamer()
        _ = streamer.feed("first one. [POINT:1,2:x] second is still goi")
        XCTAssertEqual(streamer.partial, "second is still goi")
    }
}

final class BoardTagTests: XCTestCase {
    func testCardBlockIsParsedAndNeverSpoken() {
        let text = "[CARD:p1:auto:quadratic] <<<\n<h2>solve $x^2-5x+6=0$</h2>\n<section class=\"step\">factor: $(x-2)(x-3)=0$</section>\n>>>\nhere's the problem laid out. [REVEAL:p1:1] first, factor it."
        let parsed = TagParser.parse(text)
        XCTAssertEqual(parsed.spoken, "here's the problem laid out. first, factor it.")
        XCTAssertEqual(parsed.tags.count, 2)
        guard case .card(let id, let rect, let title, let html, _) = parsed.tags[0] else { return XCTFail("no card") }
        XCTAssertEqual(id, "p1"); XCTAssertNil(rect); XCTAssertEqual(title, "quadratic")
        XCTAssertTrue(html.contains("<section class=\"step\">"))
        XCTAssertEqual(parsed.tags[1], .reveal(id: "p1", step: 1))
        guard case .card(_, let placed, _, _, _) = TagParser.parse("[CARD:c:700,120,420,300:comps] <<<x>>>").tags[0] else { return XCTFail() }
        XCTAssertEqual(placed, CardRect(x: 700, y: 120, width: 420, height: 300))
        XCTAssertEqual(TagParser.parse("done. [CLEAR_BOARD]").tags, [.clearBoard])
    }

    func testCardBlockStreamsAcrossDeltas() {
        var streamer = BeatStreamer()
        var beats: [Beat] = []
        for delta in ["[CARD:p1:auto:fields] <<", "<\n<h2>a field</h2>\n<section class=\"ste", "p\">closure</section>\n>>", ">\nhere's what a field is. ", "[REVEAL:p1:1] first, closure."] {
            beats += streamer.feed(delta)
        }
        beats += streamer.flush()
        XCTAssertEqual(beats.map(\.text), ["here's what a field is.", "first, closure."])
        guard case .card(_, _, _, let html, _)? = beats[0].tags.first else { return XCTFail("card missing on beat 1") }
        XCTAssertEqual(html, "<h2>a field</h2>\n<section class=\"step\">closure</section>")
        XCTAssertEqual(beats[1].tags, [.reveal(id: "p1", step: 1)])
        XCTAssertFalse(streamer.spokenSoFar.contains("<h2>"))
    }
}


final class TalkGuardTests: XCTestCase {
    func testPythonProgramsPass() {
        XCTAssertTrue(TalkGuard.isComputationCommand("/opt/homebrew/bin/python3.13 -c 'from sympy import *; print(Matrix([[1,2],[3,4]]).rank())'"))
        XCTAssertTrue(TalkGuard.isComputationCommand("python3 -c \"import sympy; print(sympy.Matrix([[1,2],[2,4]]).rref())\""))
        XCTAssertTrue(TalkGuard.isComputationCommand("/opt/homebrew/bin/python3.13 - <<'PY'\nfrom sympy import Matrix\nprint(Matrix([[1,0],[0,1]]).det())\nPY"))
    }

    func testAnythingElseIsRefused() {
        XCTAssertFalse(TalkGuard.isComputationCommand("/opt/homebrew/bin/python3.13 -c 'print(1)'; rm -rf ~"))
        XCTAssertFalse(TalkGuard.isComputationCommand("/opt/homebrew/bin/python3.13 -c 'print(1)' && curl x"))
        XCTAssertFalse(TalkGuard.isComputationCommand("/opt/homebrew/bin/python3.13 script.py"))
        XCTAssertFalse(TalkGuard.isComputationCommand("python3 - <<'PY'\nimport os\nPY; ls"))
        XCTAssertFalse(TalkGuard.isComputationCommand("ls"))
        XCTAssertFalse(TalkGuard.isComputationCommand("echo hi | python3 -c 'import sys'"))
    }

}


final class TypeTagTests: XCTestCase {
    func testTypeTagCarriesItsBlock() {
        let parsed = TagParser.parse("[TYPE:120,340:search box]\n<<<\nquarterly report\n>>>\nit's on your clipboard, paste it there.")
        XCTAssertEqual(parsed.tags, [.type(x: 120, y: 340, label: "search box", text: "quarterly report", screen: nil)])
        XCTAssertEqual(parsed.spoken, "it's on your clipboard, paste it there.")
    }

    func testTypeTagStreams() {
        var streamer = BeatStreamer()
        var beats = streamer.feed("[TYPE:10,20:to field] <<< hi ")
        XCTAssertTrue(beats.isEmpty)
        beats += streamer.feed("there >>> paste it in. ")
        beats += streamer.flush()
        XCTAssertEqual(beats.count, 1)
        XCTAssertEqual(beats[0].tags, [.type(x: 10, y: 20, label: "to field", text: "hi there", screen: nil)])
        XCTAssertEqual(beats[0].text, "paste it in.")
    }
}


final class DictationTextTests: XCTestCase {
    func testDictatedTextIsTidied() {
        XCTAssertEqual(SpeechText.dictated("  um, this is a test to see how the dictation is "), "This is a test to see how the dictation is.")
        XCTAssertEqual(SpeechText.dictated("hello there"), "Hello there")
        XCTAssertEqual(SpeechText.dictated("Send it by friday, please."), "Send it by friday, please.")
        XCTAssertEqual(SpeechText.dictated("   "), "")
    }
}

final class FindAndStockTagTests: XCTestCase {
    func testFindTagCarriesThePhrase() {
        let parsed = TagParser.parse("[FIND:discount rate]\nit's in the appendix, highlighted now.")
        XCTAssertEqual(parsed.tags, [.find(phrase: "discount rate")])
        XCTAssertEqual(parsed.spoken, "it's in the appendix, highlighted now.")
        XCTAssertEqual(TagParser.parse("[FIND:\"theory and experiment\"]").tags, [.find(phrase: "theory and experiment")])
        XCTAssertEqual(TagParser.parse("[FIND:x]").tags, [])
    }

    func testStockTag() {
        XCTAssertEqual(TagParser.parse("nvidia is up. [STOCK:nvda]").tags, [.stock(symbol: "NVDA")])
        XCTAssertEqual(TagParser.parse("[STOCK:not a ticker]").tags, [])
        XCTAssertTrue(DotTag.find(phrase: "a b").isVisual)
    }
}

final class DictationDictionaryTests: XCTestCase {
    func testTermsAndCorrections() {
        let dictionary = DictationDictionary(text: "# mine\nUChicago\nTypeSafe\njev => Jev\ncenter view => Centerview\n")
        XCTAssertEqual(dictionary.terms, ["UChicago", "TypeSafe"])
        XCTAssertEqual(dictionary.rules.count, 2)
        XCTAssertEqual(dictionary.apply(to: "I go to uchicago and use type safe with jev at center view."),
                       "I go to UChicago and use TypeSafe with Jev at Centerview.")
        XCTAssertEqual(dictionary.apply(to: "typesafety is a word"), "typesafety is a word")
    }

    func testEmptyDictionaryLeavesTextAlone() {
        XCTAssertEqual(DictationDictionary(text: "").apply(to: "hello"), "hello")
        XCTAssertEqual(DictationDictionary.line(forHeard: "jeff", correct: "Jev"), "jeff => Jev")
        XCTAssertEqual(DictationDictionary.line(forHeard: "jev", correct: "Jev"), "Jev")
        XCTAssertEqual(DictationDictionary.line(forHeard: nil, correct: "Centerview"), "Centerview")
    }
}

final class StrokeShapeTests: XCTestCase {
    private func ring(cx: CGFloat, cy: CGFloat, r: CGFloat, closeTo: CGFloat = 0.98) -> [CGPoint] {
        (0...40).map { i in
            let t = Double(i) / 40.0 * 2 * .pi * Double(closeTo)
            return CGPoint(x: cx + r * CGFloat(cos(t)), y: cy + r * CGFloat(sin(t)))
        }
    }

    func testRingIsAnEnclosure() {
        XCTAssertEqual(StrokeClassifier.classify(ring(cx: 100, cy: 100, r: 40)), .enclosure)
        XCTAssertEqual(StrokeClassifier.classify(ring(cx: 100, cy: 100, r: 40, closeTo: 0.8)), .enclosure)
    }

    func testLinesAndScribbles() {
        let underline = (0...30).map { CGPoint(x: 100 + CGFloat($0) * 6, y: 200 + CGFloat($0 % 2)) }
        XCTAssertEqual(StrokeClassifier.classify(underline), .horizontalLine)
        let vertical = (0...30).map { CGPoint(x: 100 + CGFloat($0 % 2), y: 200 + CGFloat($0) * 6) }
        XCTAssertEqual(StrokeClassifier.classify(vertical), .verticalLine)
        var scribble: [CGPoint] = []
        for i in 0..<60 { scribble.append(CGPoint(x: 100 + CGFloat(i) * 2, y: 200 + (i % 2 == 0 ? 0 : 18))) }
        XCTAssertEqual(StrokeClassifier.classify(scribble), .scribble)
        XCTAssertEqual(StrokeClassifier.classify([CGPoint(x: 0, y: 0)]), .stroke)
    }
}

final class DocumentSearchTests: XCTestCase {
    let pages = [
        DocumentPage(number: 1, text: "Introduction\n\nThis lab is about estimating uncertainty from repeated measurements of a falling paper square.\n\nYou will time the drops with a stopwatch and record every value in your notebook."),
        DocumentPage(number: 2, text: "Theory and experiment\n\nTheory and experiment depend on each other: a prediction is only as good as the measurement that tests it, and the pendulum's period is the prediction you will test.\n\nThe period of a simple pendulum depends on its length and on gravity."),
        DocumentPage(number: 3, text: "Appendix\n\nThe discount rate converts future cash flows to present value; a higher discount rate lowers the present value."),
    ]

    func testFindsThePageTheWordsAreAbout() {
        let hits = DocumentSearch.bestPassages(for: "so the pendulum's period is what we predict and then test with the experiment", in: pages)
        XCTAssertEqual(hits.first?.page, 2)
        XCTAssertTrue(hits.first?.passage.contains("pendulum") ?? false)
        let discount = DocumentSearch.bestPassages(for: "where does it explain the discount rate", in: pages)
        XCTAssertEqual(discount.first?.page, 3)
        XCTAssertTrue(DocumentSearch.bestPassages(for: "the and of", in: pages).isEmpty)
    }

    func testDistinctivePhraseIsPlainAndFindable() {
        let passage = pages[2].text.components(separatedBy: "\n\n")[1]
        let phrase = DocumentSearch.distinctivePhrase(in: passage, preferring: "discount rate")
        XCTAssertEqual(phrase.split(separator: " ").count, 5)
        XCTAssertTrue(DocumentSearch.contains(passage, phrase: phrase))
        XCTAssertTrue(DocumentSearch.contains("Theory and experiment depend on each other", phrase: "theory and experiment"))
        XCTAssertTrue(DocumentSearch.contains("the pendulum’s period", phrase: "pendulum's period"))
        XCTAssertFalse(DocumentSearch.contains("nothing here", phrase: "pendulum"))
    }

    func testPassagesSplitLongBlocksIntoWindows() {
        let long = (1...300).map { "word\($0)" }.joined(separator: " ")
        let parts = DocumentSearch.passages(of: long)
        XCTAssertGreaterThan(parts.count, 2)
        XCTAssertTrue(parts.allSatisfy { $0.split(separator: " ").count <= 90 })
    }
}
