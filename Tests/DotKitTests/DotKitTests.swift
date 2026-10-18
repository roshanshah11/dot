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

    func testNotchWindowFitsItsDrawing() {
        let geometry = NotchGeometry.measure(frame: CGRect(x: 0, y: 0, width: 1512, height: 982), safeAreaTop: 32,
                                             auxLeft: CGRect(x: 0, y: 950, width: 656, height: 32), auxRight: CGRect(x: 856, y: 950, width: 656, height: 32))
        // Resting: exactly the notch (HeyClicky's resting notch), hanging from the top edge, centred on it.
        let compact = geometry.frame(fitting: .zero)
        XCTAssertEqual(compact.size, geometry.compactSize)
        XCTAssertEqual(compact.maxY, 982)
        XCTAssertEqual(compact.midX, 756, accuracy: 0.5)
        // A card: the window is exactly its size, never the old fixed canvas.
        let card = geometry.frame(fitting: CGSize(width: 480.4, height: 212.2))
        XCTAssertEqual(card.width, 481)
        XCTAssertEqual(card.height, 213)
        XCTAssertEqual(card.maxY, 982)
        XCTAssertEqual(card.midX, 756, accuracy: 0.5)
        XCTAssertLessThan(card.height, NotchGeometry.panelHeight)
        // Never narrower than the notch, so hovering the notch still finds Dot.
        XCTAssertEqual(geometry.frame(fitting: CGSize(width: 40, height: 4)).width, geometry.notchWidth)
        XCTAssertEqual(geometry.compactSize, CGSize(width: geometry.notchWidth, height: 32))
        // No notch: a thin sliver, not a block over the middle of the menu bar.
        let flat = NotchGeometry.measure(frame: CGRect(x: 0, y: 0, width: 1920, height: 1080), safeAreaTop: 0, auxLeft: nil, auxRight: nil)
        XCTAssertEqual(flat.compactSize.height, 4)
    }

    func testClicksBesideTheNotchPassThroughToTheMenuBar() {
        let geometry = NotchGeometry.measure(frame: CGRect(x: 0, y: 0, width: 1512, height: 982), safeAreaTop: 32,
                                             auxLeft: CGRect(x: 0, y: 950, width: 663, height: 32), auxRight: CGRect(x: 848, y: 950, width: 664, height: 32))
        XCTAssertTrue(NotchGeometry.passesThrough(CGPoint(x: 952, y: 966), geometry: geometry), "a status item right of the notch")
        XCTAssertTrue(NotchGeometry.passesThrough(CGPoint(x: 600, y: 975), geometry: geometry), "a menu left of the notch")
        XCTAssertFalse(NotchGeometry.passesThrough(CGPoint(x: 755, y: 966), geometry: geometry), "the notch itself is Dot's")
        XCTAssertFalse(NotchGeometry.passesThrough(CGPoint(x: 952, y: 940), geometry: geometry), "below the menu bar is the tab's")
    }

    func testRightClickOnTheNotchFindsTheMenu() {
        let geometry = NotchGeometry.measure(frame: CGRect(x: 0, y: 0, width: 1512, height: 982), safeAreaTop: 32,
                                             auxLeft: CGRect(x: 0, y: 950, width: 663, height: 32), auxRight: CGRect(x: 848, y: 950, width: 664, height: 32))
        XCTAssertTrue(NotchGeometry.onNotch(CGPoint(x: 755, y: 966), geometry: geometry), "the middle of the notch")
        XCTAssertTrue(NotchGeometry.onNotch(CGPoint(x: 665, y: 980), geometry: geometry), "its left edge")
        XCTAssertFalse(NotchGeometry.onNotch(CGPoint(x: 952, y: 966), geometry: geometry), "a status item beside it")
        XCTAssertFalse(NotchGeometry.onNotch(CGPoint(x: 755, y: 900), geometry: geometry), "a card hanging below")
    }

    func testNotchSilhouetteKeepsTheMenuBarClearBesideTheNotch() {
        // A folded-task tab 415 wide under a 185 pt notch with a 32 pt menu bar band.
        let rect = CGRect(x: 0, y: 0, width: 415, height: 57)
        let path = NotchSilhouette.path(in: rect, stemWidth: 185, bandHeight: 32)
        let stemLeft = rect.midX - 92.5, stemRight = rect.midX + 92.5
        for y in stride(from: CGFloat(8), through: 31, by: 1) {
            XCTAssertFalse(path.contains(CGPoint(x: stemLeft - 2, y: y)), "menu bar left of the notch is clear at y \(y)")
            XCTAssertFalse(path.contains(CGPoint(x: stemRight + 2, y: y)), "menu bar right of the notch is clear at y \(y)")
            XCTAssertTrue(path.contains(CGPoint(x: rect.midX, y: y)))
        }
        XCTAssertFalse(path.contains(CGPoint(x: 10, y: 16)), "far left of the band is clear")
        XCTAssertTrue(path.contains(CGPoint(x: 20, y: 50)), "the wide body is below the menu bar")
        // Resting: just the notch.
        let rest = NotchSilhouette.path(in: CGRect(x: 0, y: 0, width: 185, height: 32), stemWidth: 185, bandHeight: 32)
        XCTAssertTrue(rest.contains(CGPoint(x: 92, y: 16)))
        XCTAssertLessThanOrEqual(rest.boundingBox.maxY, 32.01)
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
        {"built_at":"2026-10-15T01:00","weekday":"Thursday","date":"2026-10-15","deadlines":[],"today":["Thu 10-15 08:30–09:30 Intern Weekly Meeting","Thu 10-15 10:00–10:15 Call: Sam Rivera (MTS) (at Phone (her cell))","Thu 10-15 10:15–10:50 MATH 20250: terminology"],"tomorrow":[],"commitments":[],"todo":[],"waiting":[],"unanswered":[],"unanswered_count":3,"preferences":[],"priorities":[],"block":""}
        """.utf8))
        let unwrapped = try XCTUnwrap(brief)
        brief = unwrapped
        var components = DateComponents(); components.year = 2026; components.month = 10; components.day = 15; components.hour = 9; components.minute = 40
        let at940 = Calendar.current.date(from: components)!
        let next = try XCTUnwrap(unwrapped.nextEvent(from: at940))
        XCTAssertEqual(next.title, "Call: Sam Rivera (MTS)")
        XCTAssertEqual(next.startsIn, 20)
        XCTAssertEqual(next.endsIn, 35)
        XCTAssertEqual(unwrapped.hoverLine(from: at940), "next: call: sam rivera (mts) in 20 min · 3 on the calendar today · 3 mail waiting")
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

final class MurmurEventTests: XCTestCase {
    func testParsesMurmurLogLines() {
        let started = MurmurEvents.parse(line: #"{"path":"dictation-1.wav","state":"recording_started","ts":"2026-10-10T15:02:46.832Z"}"#)
        guard case .recordingStarted(let at)? = started else { return XCTFail("recording_started") }
        XCTAssertEqual(Int(at.timeIntervalSince1970), 1791644566)
        guard case .transcribing(let seconds, let when)? = MurmurEvents.parse(line: #"{"frontmost_app":"Comet","recorded_ms":"3533369","state":"pipeline_started","ts":"2026-10-10T16:01:40.202Z"}"#) else { return XCTFail("pipeline_started") }
        XCTAssertEqual(seconds, 3533)
        XCTAssertEqual(Int(when.timeIntervalSince1970), 1791648100)
        guard case .pasted(let chars, let app, _)? = MurmurEvents.parse(line: #"{"chars":"41025","state":"paste_dispatched","target_app":"Terminal","target_bundle":"com.apple.Terminal","ts":"2026-10-10T16:01:50.353Z"}"#) else { return XCTFail("paste") }
        XCTAssertEqual(chars, 41025); XCTAssertEqual(app, "Terminal")
        guard case .notice(let body, _)? = MurmurEvents.parse(line: #"{"body":"Copied to clipboard — empty text","state":"notify","title":"Murmur","ts":"2026-10-02T13:26:54.885Z"}"#) else { return XCTFail("notify") }
        XCTAssertEqual(MurmurEvents.line(forNotice: body), "murmur heard nothing")
        XCTAssertEqual(MurmurEvents.line(forNotice: "Pasted into Comet"), "murmur pasted into comet")
        XCTAssertNil(MurmurEvents.parse(line: #"{"state":"volume_muted","ts":"2026-10-10T15:02:47.339Z"}"#))
        XCTAssertNil(MurmurEvents.parse(line: "not json"))
        guard case .idle? = MurmurEvents.parse(line: #"{"from":"pasting","state":"state_transition","to":"idle","ts":"2026-10-10T16:01:50.353Z"}"#) else { return XCTFail("idle") }
    }

    func testClockAndLogName() {
        XCTAssertEqual(MurmurEvents.clock(83), "1:23")
        XCTAssertEqual(MurmurEvents.clock(3723), "1:02:03")
        XCTAssertTrue(MurmurEvents.logName(for: Date()).hasPrefix("murmur-20"))
    }
}


final class CardTagTests: XCTestCase {
    func testPlaceAndImagesTags() {
        XCTAssertEqual(TagParser.makeTag(kind: "PLACE", payload: "coffee near campus"), .place(query: "coffee near campus"))
        XCTAssertEqual(TagParser.makeTag(kind: "IMAGES", payload: " artemis ii launch "), .images(query: "artemis ii launch"))
        XCTAssertNil(TagParser.makeTag(kind: "PLACE", payload: "x"))
        XCTAssertTrue(DotTag.place(query: "a").isVisual)
        XCTAssertTrue(DotTag.images(query: "a").isVisual)
        let parsed = TagParser.parse("[PLACE:chai near hyde park]\nclosest is beargrounds, a quarter mile.")
        XCTAssertEqual(parsed.tags, [.place(query: "chai near hyde park")])
        XCTAssertEqual(parsed.spoken.trimmingCharacters(in: .whitespacesAndNewlines), "closest is beargrounds, a quarter mile.")
    }
}

final class CardAskTests: XCTestCase {
    func testPlaceAsks() {
        XCTAssertEqual(CardAsks.place("find a coffee shop near me"), CardAsks.PlaceAsk(what: "coffee shop", whereWord: nil))
        XCTAssertEqual(CardAsks.place("where's the closest pharmacy around campus?"), CardAsks.PlaceAsk(what: "pharmacy", whereWord: nil))
        XCTAssertEqual(CardAsks.place("is there good ramen near wicker park"), CardAsks.PlaceAsk(what: "ramen", whereWord: "wicker park"))
        XCTAssertEqual(CardAsks.place("Find a coffee shop near Hyde Park in Chicago."), CardAsks.PlaceAsk(what: "coffee shop", whereWord: "hyde park in chicago"))
        XCTAssertNil(CardAsks.place("where does it explain the discount rate"))
        XCTAssertNil(CardAsks.place("find my notes near the end of the document"))
        XCTAssertNil(CardAsks.place("what's on my screen"))
    }

    func testImageAsks() {
        XCTAssertEqual(CardAsks.images("show me pictures of the artemis ii launch"), "the artemis ii launch")
        XCTAssertEqual(CardAsks.images("Can you pull up some photos of a golgi apparatus?"), "a golgi apparatus")
        XCTAssertEqual(CardAsks.images("what does a mitochondrion look like"), "a mitochondrion")
        XCTAssertNil(CardAsks.images("what does this formula mean"))
        XCTAssertNil(CardAsks.images("show me around this page"))
    }
}

final class MorningPlannerTests: XCTestCase {
    private let day: Date = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd HH:mm"; f.locale = Locale(identifier: "en_US_POSIX")
        return f.date(from: "2026-10-16 08:00")!
    }()

    func testBuildsFromTheDay() {
        let items = MorningPlanner.suggestions(
            deadlines: ["2026-10-16 Northwind Bank Sophomore Showcase application due 11:59 PM ET: short essays", "2026-10-25 Something far off"],
            today: ["Fri 10-16 12:30–12:45 Call: Alex Morgan (BlackRock) (at Call (555) 010-0199)", "Fri 10-16 09:30–10:20 Mechanics: Lecture (at Kersten)"],
            unanswered: ["prof@example.com: Re: Seminar Schedule (Tue 10-13 17)"],
            commitments: ["Roshan Shah → Emily Parker: Reply to Emily Parker (LMR Partners office manager) with availability (she asked)"],
            date: day)
        XCTAssertEqual(items.count, 4)
        XCTAssertTrue(items[0].text.hasPrefix("prep northwind bank sophomore showcase application due 11"))
        XCTAssertTrue(items[0].text.hasSuffix("due today"))
        XCTAssertTrue(items[0].brief.contains("nothing gets submitted"))
        XCTAssertEqual(items[1].text, "a one-page brief on alex morgan (blackrock) before 12:30")
        XCTAssertEqual(items[2].text, "draft a reply to prof: Re: Seminar Schedule")
        XCTAssertTrue(items[2].brief.contains("never send"))
        XCTAssertTrue(items[3].text.hasPrefix("do: roshan shah → emily parker: reply to emily parker"))
        XCTAssertFalse(items.contains { $0.text.contains("mechanics") })
        XCTAssertFalse(items.contains { $0.text.contains("far off") })
    }

    func testDeclinedKeysAreSkippedAndLimitHolds() {
        let unanswered = (1...4).map { "person\($0)@x.com: Subject \($0) (Tue 10-13 10)" }
        let all = MorningPlanner.suggestions(deadlines: [], today: [], unanswered: unanswered, commitments: ["a", "b", "c"], date: day)
        XCTAssertEqual(all.count, 5)
        let declined = Set(all.prefix(2).map(\.key))
        let rest = MorningPlanner.suggestions(deadlines: [], today: [], unanswered: unanswered, commitments: ["a", "b", "c"], date: day, declined: declined)
        XCTAssertFalse(rest.contains { declined.contains($0.key) })
        XCTAssertEqual(MorningPlanner.greeting(count: 1, hour: 9), "morning. i can do 1 thing for you today.")
        XCTAssertEqual(MorningPlanner.greeting(count: 3, hour: 14), "afternoon. i can do 3 things for you today.")
    }
}

final class AgentRulesTests: XCTestCase {
    func testClassifiesToolCalls() {
        XCTAssertEqual(AgentRules.classify(toolName: "Read", command: nil, flattened: ""), .read)
        XCTAssertEqual(AgentRules.classify(toolName: "Write", command: nil, flattened: "/Users/x/Dot/agents/dot/output/a.md"), .write)
        XCTAssertEqual(AgentRules.classify(toolName: "Bash", command: "ls -la ~/Desktop", flattened: ""), .read)
        XCTAssertEqual(AgentRules.classify(toolName: "Bash", command: "python3 -c 'print(2+2)'", flattened: ""), .read)
        XCTAssertEqual(AgentRules.classify(toolName: "Bash", command: "mytool --go && ffmpeg -i in.wav out.mp3", flattened: ""), .write)
        XCTAssertEqual(AgentRules.classify(toolName: "Bash", command: "git status", flattened: ""), .read)
        XCTAssertEqual(AgentRules.classify(toolName: "Bash", command: "git push origin main", flattened: ""), .outward)
        XCTAssertEqual(AgentRules.classify(toolName: "Bash", command: "brew install ffmpeg", flattened: ""), .system)
        XCTAssertEqual(AgentRules.classify(toolName: "Bash", command: "sudo launchctl load x.plist", flattened: ""), .system)
        XCTAssertEqual(AgentRules.classify(toolName: "Bash", command: "curl -X POST https://api.example.com/orders -d '{}'", flattened: ""), .outward)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__claude_ai_Gmail__send_message", command: nil, flattened: ""), .outward)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__claude_ai_Gmail__create_draft", command: nil, flattened: ""), .write)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__claude_ai_Gmail__search_threads", command: nil, flattened: ""), .read)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__cua-driver__click", command: nil, flattened: "{\"element\":\"Place order\"}"), .outward)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__cua-driver__click", command: nil, flattened: "{\"element\":\"Next page\"}"), .computer)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__atlas__search", command: nil, flattened: ""), .read)
        XCTAssertEqual(AgentRules.classify(toolName: "Agent", command: nil, flattened: ""), .read)
    }

    func testDefaultsOverridesAndBriefLine() {
        var rules = AgentRules.standard
        XCTAssertEqual(rules.behavior(for: .read), .act)
        XCTAssertEqual(rules.behavior(for: .outward), .ask)
        rules.set(.mine, for: .outward, agent: "email")
        rules.set(.ifAsked, for: .computer, agent: nil)
        XCTAssertEqual(rules.behavior(for: .outward, agent: "email"), .mine)
        XCTAssertEqual(rules.behavior(for: .outward, agent: "physics"), .ask)
        XCTAssertEqual(rules.behavior(for: .computer, agent: "physics"), .ifAsked)
        XCTAssertTrue(rules.hasOverrides(for: "email"))
        rules.set(nil, for: .outward, agent: "email")
        XCTAssertFalse(rules.hasOverrides(for: "email"))
        rules.set(.mine, for: .system, agent: nil)
        let line = rules.briefLine(for: "physics")
        XCTAssertTrue(line.contains("his to do, never yours: changing the mac"))
        XCTAssertTrue(line.contains("Dot shows him a card before: using apps, sending and paying"))
    }

    func testBriefAsks() {
        XCTAssertTrue(AgentRules.briefAsks(for: .outward, brief: "send the reply to gabriel once it reads right"))
        XCTAssertFalse(AgentRules.briefAsks(for: .outward, brief: "draft a reply to gabriel"))
        XCTAssertTrue(AgentRules.briefAsks(for: .computer, brief: "open canvas and click through to the lab report"))
        XCTAssertFalse(AgentRules.briefAsks(for: .system, brief: "summarize the paper"))
    }

    func testRoundTripsThroughJSON() throws {
        var rules = AgentRules.standard
        rules.set(.mine, for: .outward, agent: "email")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("dot-rules-\(UUID().uuidString).json")
        try rules.save(to: url)
        XCTAssertEqual(AgentRules.load(from: url), rules)
        XCTAssertEqual(AgentRules.load(from: url.appendingPathExtension("missing")), .standard)
    }
}

final class RoutineTests: XCTestCase {
    private var chicago: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Chicago")!
        return calendar
    }

    private func date(_ y: Int, _ mo: Int, _ d: Int, _ h: Int, _ mi: Int) -> Date {
        chicago.date(from: DateComponents(year: y, month: mo, day: d, hour: h, minute: mi))!
    }

    func testParsesPlainSchedules() {
        XCTAssertEqual(RoutineSchedule.parse("every morning at 8"), RoutineSchedule(kind: .daily, hour: 8))
        XCTAssertEqual(RoutineSchedule.parse("every day at 7:30 am"), RoutineSchedule(kind: .daily, hour: 7, minute: 30))
        XCTAssertEqual(RoutineSchedule.parse("weekdays at nine"), RoutineSchedule(kind: .weekdays, hour: 9))
        XCTAssertEqual(RoutineSchedule.parse("every weekday at 9:30"), RoutineSchedule(kind: .weekdays, hour: 9, minute: 30))
        XCTAssertEqual(RoutineSchedule.parse("every monday at 7 pm"), RoutineSchedule(kind: .weekly, hour: 19, weekday: 2))
        XCTAssertEqual(RoutineSchedule.parse("Every Monday."), RoutineSchedule(kind: .weekly, hour: 9, weekday: 2))
        XCTAssertEqual(RoutineSchedule.parse("every 3 hours"), RoutineSchedule(kind: .hours, everyHours: 3))
        XCTAssertEqual(RoutineSchedule.parse("every few hours"), RoutineSchedule(kind: .hours, everyHours: 3))
        XCTAssertEqual(RoutineSchedule.parse("hourly"), RoutineSchedule(kind: .hours, everyHours: 1))
        XCTAssertEqual(RoutineSchedule.parse("each evening"), RoutineSchedule(kind: .daily, hour: 18))
        XCTAssertEqual(RoutineSchedule.parse("every night at 10"), RoutineSchedule(kind: .daily, hour: 22))
        XCTAssertEqual(RoutineSchedule.parse("every day at noon"), RoutineSchedule(kind: .daily, hour: 12))
        XCTAssertEqual(RoutineSchedule.parse("at 8 every morning"), RoutineSchedule(kind: .daily, hour: 8))
        XCTAssertNil(RoutineSchedule.parse("tomorrow"))
        XCTAssertNil(RoutineSchedule.parse("whenever you can"))
    }

    func testNextRunRespectsKind() {
        let friday = date(2026, 10, 16, 10, 0)
        XCTAssertEqual(RoutineSchedule(kind: .daily, hour: 8).next(after: friday, calendar: chicago), date(2026, 10, 17, 8, 0))
        XCTAssertEqual(RoutineSchedule(kind: .daily, hour: 14).next(after: friday, calendar: chicago), date(2026, 10, 16, 14, 0))
        XCTAssertEqual(RoutineSchedule(kind: .weekdays, hour: 9).next(after: friday, calendar: chicago), date(2026, 10, 19, 9, 0))
        XCTAssertEqual(RoutineSchedule(kind: .weekly, hour: 19, weekday: 2).next(after: friday, calendar: chicago), date(2026, 10, 19, 19, 0))
        XCTAssertEqual(RoutineSchedule(kind: .hours, everyHours: 3).next(after: friday, calendar: chicago), date(2026, 10, 16, 13, 0))
    }

    func testWords() {
        XCTAssertEqual(RoutineSchedule(kind: .daily, hour: 8).words, "every day at 8 am")
        XCTAssertEqual(RoutineSchedule(kind: .weekdays, hour: 9, minute: 30).words, "weekdays at 9:30 am")
        XCTAssertEqual(RoutineSchedule(kind: .weekly, hour: 19, weekday: 2).words, "mondays at 7 pm")
        XCTAssertEqual(RoutineSchedule(kind: .hours, everyHours: 3).words, "every 3 hours")
    }

    func testDueStartedAndFailuresPause() {
        let now = date(2026, 10, 16, 8, 0)
        var book = RoutineBook(routines: [Routine(id: "a", agent: "email", agentName: "Email", brief: "draft replies", schedule: RoutineSchedule(kind: .daily, hour: 8), now: date(2026, 10, 15, 9, 0))])
        XCTAssertEqual(book.due(at: now).map(\.id), ["a"])
        book.markStarted("a", at: now)
        XCTAssertEqual(book.routines[0].nextRun, date(2026, 10, 17, 8, 0))
        XCTAssertTrue(book.due(at: now).isEmpty)
        XCTAssertFalse(book.markFinished("a", failed: true, note: "no network"))
        XCTAssertFalse(book.markFinished("a", failed: true, note: "no network"))
        XCTAssertTrue(book.markFinished("a", failed: true, note: "no network"))
        XCTAssertTrue(book.routines[0].paused)
        XCTAssertEqual(book.routines[0].lastNote, "paused after 3 failed runs in a row: no network")
        book.routines[0].paused = false
        XCTAssertFalse(book.markFinished("a", failed: false, note: nil))
        XCTAssertEqual(book.routines[0].failures, 0)
    }

    func testRoutineTagParses() {
        let tags = TagParser.parse("every morning at eight, email drafts the replies. [ROUTINE:Email:every morning at 8:draft replies to anyone waiting on him]").tags
        XCTAssertEqual(tags, [.routine(agent: "Email", when: "every morning at 8", brief: "draft replies to anyone waiting on him")])
    }
}

// MARK: - Round seven: agents managed the way HeyClicky manages them

final class ConsentQueueTests: XCTestCase {
    func testSecondQuestionWaitsInsteadOfReplacingTheFirst() {
        var queue = ConsentQueue<String>()
        let email = UUID(), physics = UUID(), email2 = UUID()
        queue.add(id: email, agent: "email", item: "delete a calendar event")
        queue.add(id: physics, agent: "physics", item: "save a draft")
        queue.add(id: email, agent: "email", item: "a repeat is ignored")
        XCTAssertEqual(queue.current?.id, email)
        XCTAssertEqual(queue.waitingBehind, 1)
        // Answering the physics card (say from its row) leaves the email agent's question on show.
        XCTAssertEqual(queue.remove(id: physics)?.agent, "physics")
        XCTAssertEqual(queue.current?.id, email)
        XCTAssertEqual(queue.waitingBehind, 0)
        queue.add(id: email2, agent: "email", item: "delete another event")
        queue.add(id: physics, agent: "physics", item: "save a draft")
        XCTAssertTrue(queue.bringForward(agent: "physics"))
        XCTAssertEqual(queue.current?.id, physics)
        XCTAssertFalse(queue.bringForward(agent: "homework"))
        // Stopping the email agent takes both of its questions with it.
        XCTAssertEqual(queue.removeAll(agent: "email").count, 2)
        XCTAssertEqual(queue.current?.id, physics)
        XCTAssertTrue(queue.isWaiting(agent: "physics"))
        XCTAssertFalse(queue.isWaiting(agent: "email"))
        queue.remove(id: physics)
        XCTAssertTrue(queue.isEmpty)
        XCTAssertNil(queue.current)
    }
}

final class AgentConsentRoundSevenTests: XCTestCase {
    private let agent = "/Users/test/Dot/agents/email"

    private func policy() -> ConsentPolicy {
        ConsentPolicy(allowToolPrefixes: ["mcp__cua-driver__", "mcp__claude_ai_Gmail__", "mcp__claude_ai_Google_Calendar__", "mcp__claude_ai_Google_Drive__"],
                      writableRoots: [agent, "/Users/test"], protectedRoots: ["/Users/test/roshan/Atlas/private"],
                      workingDirectory: agent, deletableRoots: [agent, "/tmp"],
                      undeletableRoots: [agent + "/.dot", agent + "/CLAUDE.md"], knownServers: ["atlas", "cua-driver"])
    }

    private func bash(_ command: String) -> ConsentDecision {
        policy().decide(ToolRequest(toolName: "Bash", input: ["command": .string(command)], description: "d"))
    }

    func testDeletesInsideTheAgentsFolderPassAndTheRestAsk() {
        XCTAssertEqual(bash("rm -rf ./tmp/probe-nothing"), .allow)
        XCTAssertEqual(bash("rm -rf tmp/*"), .allow)
        XCTAssertEqual(bash("rm -f output/old.md 2>/dev/null"), .allow)
        XCTAssertEqual(bash("rm -rf \(agent)/tmp/renders && ls output"), .allow)
        XCTAssertEqual(bash("rm -rf /tmp/dot-scratch-1"), .allow)
        XCTAssertEqual(bash("rm -rf *"), .ask(reason: "d"))
        XCTAssertEqual(bash("rm -rf /tmp"), .ask(reason: "d"))
        XCTAssertEqual(bash("rm -rf /tmp/*"), .ask(reason: "d"))
        XCTAssertEqual(bash("rm -rf .dot"), .ask(reason: "d"))
        XCTAssertEqual(bash("rm CLAUDE.md"), .ask(reason: "d"))
        XCTAssertEqual(bash("rm -rf ~/roshan/Career/old"), .ask(reason: "d"))
        XCTAssertEqual(bash("rm /Users/test/roshan/notes.md"), .ask(reason: "d"))
        XCTAssertEqual(bash("cd tmp && rm -rf x"), .ask(reason: "d"))
        XCTAssertEqual(bash("rm -rf \"$OUT\""), .ask(reason: "d"))
        XCTAssertEqual(bash("rm -rf ../other-agent/output"), .ask(reason: "d"))
        XCTAssertEqual(bash("find ~/roshan -name '*.tmp' -delete"), .ask(reason: "d"))
        XCTAssertEqual(bash("ls output && mkdir -p tmp/a"), .allow)
    }

    func testDeletesOutsideTheFolderAlwaysComeAsCards() {
        let p = policy()
        // A delete outside the scratch roots, however it is spelled or wrapped, is never left to a judge.
        for command in ["rm ../../Downloads/x.pdf", "rm output/../../../Downloads/x.pdf", "rm \"$HOME/Downloads/x.pdf\"", "rm CLAUDE.md",
                        "unlink ~/Downloads/x.pdf", "shred -u ~/x", "trash ~/Desktop/x.png", "command rm ~/x", "\\rm ~/x", "nohup rm -f ~/x",
                        "ls | xargs rm", "xargs rm < tmp/list.txt", "echo $(rm ~/x)", "bash -c 'rm ~/x'", "sh -c '/bin/rm ~/x'",
                        "find tmp -name '*.log' -delete", "find . -exec rm {} +", "git -C ~/Projects/dot clean -fdx"] {
            XCTAssertTrue(p.mustAsk(command), command)
            if command.hasPrefix("git") { continue }
            XCTAssertTrue(p.deletesOutsideScratch(command), command)
            XCTAssertNil(p.commandWithoutScratchDeletes(command), command)
            XCTAssertNotEqual(bash(command), .allow, command)
        }
        // Inside them: the agent tidying up, nothing to ask.
        for command in ["rm -rf tmp/build output/old.md", "rmdir tmp/empty", "unlink tmp/link", "trash tmp/x.png", "rm -f /tmp/dot-x 2>/dev/null",
                        "command rm tmp/a", "/bin/rm -rf tmp/b", "git rm --cached notes.md", "mkdir -p output/charts && rm -rf tmp/x"] {
            XCTAssertFalse(p.deletesOutsideScratch(command), command)
            XCTAssertFalse(p.mustAsk(command), command)
        }
        XCTAssertEqual(bash("rmdir tmp/empty"), .allow)
        XCTAssertEqual(bash("unlink tmp/link"), .allow)
        XCTAssertEqual(p.commandWithoutScratchDeletes("mkdir -p output/charts && rm -rf tmp/x"), "mkdir -p output/charts")
        // Braces and ~user expand to what the check cannot place; a 2>&1 is a redirect, not a split.
        XCTAssertTrue(p.deletesOutsideScratch("rm -rf {tmp,../dot}"))
        XCTAssertTrue(p.deletesOutsideScratch("rm -rf ~root/x"))
        XCTAssertFalse(p.deletesOutsideScratch("rm -rf tmp/x >/dev/null 2>&1"))
        XCTAssertFalse(p.mustAsk("rm -rf tmp/x >/dev/null 2>&1"))
        XCTAssertEqual(bash("rm -rf tmp/x >/dev/null 2>&1"), .allow)
        XCTAssertEqual(ConsentPolicy.commandWord("nohup git push origin main 2>&1"), "git")
        // A change of folder: deletes before it, or with absolute targets, still read (from the Dot agent's 10/16 run).
        XCTAssertFalse(p.deletesOutsideScratch("rm -f \(agent)/tmp/history.db; cd \(agent)/tmp && curl -sL https://example.com -o page.html"))
        XCTAssertFalse(p.deletesOutsideScratch("cd \(agent)/tmp && rm -rf \(agent)/tmp/x"))
        XCTAssertTrue(p.deletesOutsideScratch("rm -rf tmp/a; cd .. && rm -rf b"))
        XCTAssertTrue(p.deletesOutsideScratch("(cd tmp && rm -rf x)"))
        // The always-ask list still holds on its own.
        XCTAssertTrue(p.mustAsk("git push origin main"))
        XCTAssertFalse(p.mustAsk("python3 tmp/make_chart.py"))
    }

    func testPrivateTmpSpellingsCompareAlike() {
        // A file that does not exist yet under /private/tmp is still inside /tmp (Foundation strips
        // "/private" only for paths that exist).
        let missing = "/private/tmp/dot-test-\(UUID().uuidString)/x.txt"
        XCTAssertEqual(ConsentPolicy.canonical(missing), String(missing.dropFirst("/private".count)))
        XCTAssertEqual(bash("rm -f \(missing)"), .allow)
        let p = ConsentPolicy(writableRoots: ["/tmp"])
        XCTAssertEqual(p.decide(ToolRequest(toolName: "Write", input: ["file_path": .string(missing)], description: nil)), .allow)
        XCTAssertEqual(ConsentPolicy.canonical("/Users/test/Dot/agents/x/../y"), "/Users/test/Dot/agents/y")
    }

    func testWhatIsLeftOnceScratchDeletesAreSetAside() {
        let p = policy()
        XCTAssertEqual(p.commandWithoutScratchDeletes("rm -rf \(agent)/tmp/x && git push origin main"), "git push origin main")
        XCTAssertEqual(p.commandWithoutScratchDeletes("rm -rf tmp/x"), "")
        XCTAssertNil(p.commandWithoutScratchDeletes("rm -rf ~/roshan/x && ls"))
        XCTAssertNil(p.commandWithoutScratchDeletes("ls output"))
        XCTAssertNil(p.commandWithoutScratchDeletes("cd tmp && rm -rf x"))
    }

    func testSendsSharesInvitationsAndUnknownServersAsk() {
        let p = policy()
        func mcp(_ name: String, _ input: [String: AnyCodableValue] = [:]) -> ConsentDecision {
            p.decide(ToolRequest(toolName: name, input: input, description: nil))
        }
        // The connector prefixes no longer wave a send through.
        XCTAssertEqual(mcp("mcp__claude_ai_Gmail__send_message"), .ask(reason: "claude_ai_Gmail: send_message"))
        XCTAssertEqual(mcp("mcp__claude_ai_Gmail__search_threads"), .allow)
        XCTAssertEqual(mcp("mcp__claude_ai_Google_Calendar__respond_to_event", ["response": .string("declined")]), .ask(reason: "claude_ai_Google_Calendar: respond_to_event"))
        XCTAssertEqual(mcp("mcp__claude_ai_Google_Calendar__create_event", ["attendees": .array([.string("banker@firm.com")])]), .ask(reason: "claude_ai_Google_Calendar: create_event"))
        XCTAssertEqual(mcp("mcp__claude_ai_Google_Calendar__create_event", ["summary": .string("finish riverside")]), .allow)
        XCTAssertEqual(mcp("mcp__claude_ai_Google_Drive__share_file", ["role": .string("writer")]), .ask(reason: "claude_ai_Google_Drive: share_file"))
        XCTAssertEqual(mcp("mcp__rea__capture_process_scenario", ["executable": .string("git")]), .ask(reason: "rea: capture_process_scenario (a tool Dot doesn't know)"))
        XCTAssertEqual(mcp("mcp__atlas__search"), .allow)
    }

    func testClassesRoundSeven() {
        let known: Set<String> = ["atlas", "cua-driver"]
        XCTAssertEqual(AgentRules.classify(toolName: "Bash", command: "rm -rf ~/Documents/old-drafts", flattened: ""), .outward)
        XCTAssertEqual(AgentRules.classify(toolName: "Bash", command: "rm -rf ~", flattened: ""), .outward)
        XCTAssertEqual(AgentRules.classify(toolName: "Bash", command: "rm -r -f $HOME/x", flattened: ""), .outward)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__claude_ai_Google_Calendar__respond_to_event", command: nil, flattened: "declined", knownServers: known), .outward)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__claude_ai_Google_Calendar__create_event", command: nil, flattened: "",
                                           input: ["attendees": .array([.string("a@b.com")])], knownServers: known), .outward)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__claude_ai_Google_Calendar__create_event", command: nil, flattened: "",
                                           input: ["summary": .string("study")], knownServers: known), .write)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__claude_ai_Google_Drive__share_file", command: nil, flattened: "", knownServers: known), .outward)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__cua-driver__kill_app", command: nil, flattened: "", knownServers: known), .system)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__cua-driver__run_script", command: nil, flattened: "do shell script", knownServers: known), .system)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__cua-driver__click", command: nil, flattened: "Next page", knownServers: known), .computer)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__rea__capture_process_scenario", command: nil, flattened: "git push", knownServers: known), .system)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__blender__execute_blender_code", command: nil, flattened: "", knownServers: known), .system)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__claude_ai_Gmail__search_threads", command: nil, flattened: "", knownServers: known), .read)
        XCTAssertEqual(AgentRules.classify(toolName: "mcp__atlas__search", command: nil, flattened: "", knownServers: known), .read)
    }

    func testANewRoutineRunsAtOnce() {
        let now = Date(timeIntervalSince1970: 1_792_200_000)
        let schedule = RoutineSchedule(kind: .daily, hour: 8)
        let routine = Routine(agent: "email", agentName: "Email", brief: "draft replies", schedule: schedule, now: now)
        XCTAssertEqual(routine.nextRun, now)
        XCTAssertEqual(RoutineBook(routines: [routine]).due(at: now).map(\.id), [routine.id])
        let later = Routine(agent: "email", agentName: "Email", brief: "draft replies", schedule: schedule, now: now, runFirstNow: false)
        XCTAssertEqual(later.nextRun, schedule.next(after: now))
    }
}

final class AgentVoiceTests: XCTestCase {
    private let roster = [
        AgentAddress.Agent(slug: "dot", name: "Dot"),
        AgentAddress.Agent(slug: "email", name: "Email"),
        AgentAddress.Agent(slug: "inbox-keeper", name: "Inbox Keeper"),
        AgentAddress.Agent(slug: "lab-desk", name: "Lab Desk"),
    ]

    func testFindsTheAgentHeIsTalkingTo() {
        XCTAssertEqual(AgentAddress.find(in: "tell inbox keeper to also check spam", roster: roster), .init(slug: "inbox-keeper", intent: .tell))
        XCTAssertEqual(AgentAddress.find(in: "ask the email agent whether the draft went out", roster: roster), .init(slug: "email", intent: .tell))
        XCTAssertEqual(AgentAddress.find(in: "inbox keeper, skip the newsletters", roster: roster), .init(slug: "inbox-keeper", intent: .tell))
        XCTAssertEqual(AgentAddress.find(in: "tell inbox to skip the newsletters", roster: roster), .init(slug: "inbox-keeper", intent: .tell))
        XCTAssertEqual(AgentAddress.find(in: "for Lab Desk: redo figure two", roster: roster), .init(slug: "lab-desk", intent: .tell))
        XCTAssertEqual(AgentAddress.find(in: "stop the email agent", roster: roster), .init(slug: "email", intent: .stop))
        XCTAssertEqual(AgentAddress.find(in: "stop lab desk now", roster: roster), .init(slug: "lab-desk", intent: .stop))
        XCTAssertEqual(AgentAddress.find(in: "is email done yet?", roster: roster), .init(slug: "email", intent: .status))
        XCTAssertEqual(AgentAddress.find(in: "how's inbox keeper doing", roster: roster), .init(slug: "inbox-keeper", intent: .status))
        XCTAssertEqual(AgentAddress.find(in: "what's lab desk working on", roster: roster), .init(slug: "lab-desk", intent: .status))
        // Not an agent: him, the companion, a word that only looks like a name.
        XCTAssertNil(AgentAddress.find(in: "tell me about the discount rate", roster: roster))
        XCTAssertNil(AgentAddress.find(in: "dot, what's on my screen", roster: roster))
        XCTAssertNil(AgentAddress.find(in: "stop emailing professors so late", roster: roster))
        XCTAssertNil(AgentAddress.find(in: "what's the email from sebastian about", roster: roster))
    }

    func testAgentNamedInPassing() {
        XCTAssertEqual(AgentAddress.mentioned(in: "pass a note to the lab desk agent that the deadline moved", roster: roster)?.slug, "lab-desk")
        XCTAssertNil(AgentAddress.mentioned(in: "draft a reply to the dean", roster: roster))
        XCTAssertNil(AgentAddress.mentioned(in: "have email and lab desk compare notes", roster: roster))
        XCTAssertNil(AgentAddress.mentioned(in: "dot please look this up", roster: roster))
    }

    func testFirstWordAliasesOnlyInPlainAddress() {
        let roster = self.roster + [AgentAddress.Agent(slug: "deck-shop", name: "Deck Shop")]
        // "deck" is a common word: it means Deck Shop only after tell/ask/remind/message, or with "agent".
        XCTAssertNil(AgentAddress.find(in: "have the deck on the board", roster: roster))
        XCTAssertNil(AgentAddress.find(in: "stop the deck", roster: roster))
        XCTAssertNil(AgentAddress.find(in: "how's the deck doing", roster: roster))
        XCTAssertNil(AgentAddress.find(in: "deck, make the title bigger", roster: roster))
        XCTAssertEqual(AgentAddress.find(in: "stop the deck agent", roster: roster), .init(slug: "deck-shop", intent: .stop))
        XCTAssertEqual(AgentAddress.find(in: "tell deck to use the blue template", roster: roster), .init(slug: "deck-shop", intent: .tell))
        XCTAssertEqual(AgentAddress.find(in: "how's deck shop doing", roster: roster), .init(slug: "deck-shop", intent: .status))
        XCTAssertEqual(AgentAddress.find(in: "have deck shop redo slide three", roster: roster), .init(slug: "deck-shop", intent: .tell))
        // A name two agents share is a question, not a third agent.
        let labs = roster + [AgentAddress.Agent(slug: "lab-notes", name: "Lab Notes")]
        XCTAssertEqual(AgentAddress.candidates(named: "lab", in: labs).map(\.slug).sorted(), ["lab-desk", "lab-notes"])
        XCTAssertNil(AgentAddress.agent(named: "lab", in: labs))
        XCTAssertEqual(AgentAddress.candidates(named: "lab notes", in: labs).map(\.slug), ["lab-notes"])
    }

    func testNodsAreNotInstructions() {
        for said in ["ok", "thanks!", "cool, thanks", "got it", "okay thank you", "sounds good"] {
            XCTAssertTrue(AgentAddress.isAcknowledgment(said), said)
        }
        for said in ["ok draft the reply", "thanks, now send it to her", "good, do the next one"] {
            XCTAssertFalse(AgentAddress.isAcknowledgment(said), said)
        }
    }

    func testLegacyForPrefixAndNames() {
        XCTAssertEqual(AgentAddress.leadingFor("for Email: draft the reply to the club", roster: roster)?.slug, "email")
        XCTAssertEqual(AgentAddress.leadingFor("for Email: draft the reply to the club", roster: roster)?.brief, "draft the reply to the club")
        XCTAssertNil(AgentAddress.leadingFor("draft the reply for email", roster: roster))
        XCTAssertEqual(AgentAddress.agent(named: "the inbox keeper agent", in: roster)?.slug, "inbox-keeper")
        XCTAssertEqual(AgentAddress.agent(named: "lab", in: roster)?.slug, "lab-desk")
        XCTAssertNil(AgentAddress.agent(named: "physics", in: roster))
    }

    func testProgressQuestions() {
        for said in ["progress?", "is it done", "what do i need to do rn", "how's it going", "any update", "do they need anything from me"] {
            XCTAssertTrue(AgentAddress.isProgressAsk(said), said)
        }
        for said in ["what's the progress of the french revolution", "is it raining", "how do i do this"] {
            XCTAssertFalse(AgentAddress.isProgressAsk(said), said)
        }
    }

    func testSpokenAnswersToACard() {
        XCTAssertEqual(ConsentVoice.interpret("allow", guarded: false), .allow)
        XCTAssertEqual(ConsentVoice.interpret("yeah go ahead", guarded: false), .allow)
        XCTAssertEqual(ConsentVoice.interpret("allow it for the rest of this task", guarded: false), .allowForTask)
        XCTAssertEqual(ConsentVoice.interpret("not now", guarded: true), .decline)
        XCTAssertEqual(ConsentVoice.interpret("No, don’t send it.", guarded: true), .decline)
        // A guarded card wants the act named.
        XCTAssertEqual(ConsentVoice.interpret("yes", guarded: true), .needsExplicit)
        XCTAssertEqual(ConsentVoice.interpret("do it", guarded: true), .needsExplicit)
        let send = "use claude_ai_Gmail: send message", delete = "a delete outside its folder: run a command"
        XCTAssertEqual(ConsentVoice.interpret("yes, send it", guarded: true, card: send), .allow)
        XCTAssertEqual(ConsentVoice.interpret("go ahead and delete them", guarded: true, card: delete), .allow)
        XCTAssertEqual(ConsentVoice.interpret("send it", guarded: true, card: send), .allow)
        XCTAssertEqual(ConsentVoice.interpret("yes, delete it", guarded: true, card: "run a command rm -rf ~/Downloads/old"), .allow)
        // The act has to be the card's own, and "run" is never one (every command card says "run a command").
        XCTAssertEqual(ConsentVoice.interpret("yes, run it", guarded: true, card: delete), .needsExplicit)
        XCTAssertEqual(ConsentVoice.interpret("yes, delete it", guarded: true, card: send), .needsExplicit)
        XCTAssertEqual(ConsentVoice.interpret("yes, push it", guarded: true, card: "run a command git push origin main"), .allow)
        XCTAssertEqual(ConsentVoice.acts(in: "claude_ai_Gmail: send_message, calendar_delete"), ["send", "delete"])
        // A no or a pause after the yes takes it back.
        XCTAssertEqual(ConsentVoice.interpret("yes, don't send it", guarded: true, card: send), .decline)
        XCTAssertEqual(ConsentVoice.interpret("yeah, hold off", guarded: false), .decline)
        XCTAssertEqual(ConsentVoice.interpret("okay wait", guarded: false), .none)
        XCTAssertEqual(ConsentVoice.interpret("ok stop", guarded: false), .none)
        XCTAssertEqual(ConsentVoice.interpret("sure, no problem", guarded: false), .allow)
        // Not answers.
        XCTAssertEqual(ConsentVoice.interpret("yes, what is this page", guarded: false), .none)
        XCTAssertEqual(ConsentVoice.interpret("send it later", guarded: true), .none)
        XCTAssertEqual(ConsentVoice.interpret("explain the second paragraph to me", guarded: false), .none)
        // During a walkthrough "ok" moves the walkthrough on; "allow" and "yes, send it" still reach the card.
        XCTAssertFalse(ConsentVoice.isAimedAtCard("ok"))
        XCTAssertTrue(ConsentVoice.isAimedAtCard("allow"))
        XCTAssertTrue(ConsentVoice.isAimedAtCard("yes, send it"))
    }

    func testTellAndStopTags() {
        let parsed = TagParser.parse("passing that on. [TELL:Inbox Keeper:also check the spam folder]")
        XCTAssertEqual(parsed.spoken, "passing that on.")
        XCTAssertEqual(parsed.tags, [.tell(agent: "Inbox Keeper", message: "also check the spam folder")])
        XCTAssertEqual(TagParser.parse("stopping it. [STOP_AGENT:Email]").tags, [.stopAgent(name: "Email")])
        XCTAssertEqual(TagParser.parse("[STOP_AGENT:]").tags, [])
    }
}

final class AgentRecoveryTests: XCTestCase {
    func testFindsOrphanedAgentSessions() {
        let ps = """
          501     1 /Users/r/.local/bin/claude -p --input-format stream-json --session-id 6F1C2B6A-1111-4222-8333-944455556666 --model opus
          502   400 /Users/r/.local/bin/claude -p --input-format stream-json --resume 6f1c2b6a-1111-4222-8333-944455556677 --model opus
          503     1 /Users/r/.local/bin/claude -p --resume 6f1c2b6a-1111-4222-8333-944455556677 --model opus
          504     1 /Users/r/.local/bin/claude -p --session-id 0F1C2B6A-1111-4222-8333-944455556600 --model sonnet
          505     1 /usr/sbin/cfprefsd agent
        """
        let processes = AgentRecovery.parsePS(ps)
        XCTAssertEqual(processes.count, 5)
        let orphans = AgentRecovery.orphans(in: processes, sessionIds: ["6f1c2b6a-1111-4222-8333-944455556666", "6F1C2B6A-1111-4222-8333-944455556677"])
        XCTAssertEqual(orphans.map(\.pid), [501, 503])
    }

    func testTurnThatNeverFinished() {
        XCTAssertEqual(AgentRecovery.unfinishedBrief([("user", "go through my gmail"), ("tool", "searching"), ("assistant", "about 200 threads")]), "go through my gmail")
        XCTAssertNil(AgentRecovery.unfinishedBrief([("user", "go through my gmail"), ("result", "success in 1 ms, $0.1")]))
        XCTAssertEqual(AgentRecovery.unfinishedBrief([("user", "a"), ("result", "success"), ("user", "b"), ("cleared", "Bash: x")]), "b")
        XCTAssertNil(AgentRecovery.unfinishedBrief([]))
    }

    func testTurnArtifacts() {
        let t0 = Date(timeIntervalSince1970: 100), t1 = Date(timeIntervalSince1970: 200)
        XCTAssertEqual(TurnArtifacts.changed(before: ["a.pdf": t0, "b.md": t0], after: ["a.pdf": t0, "b.md": t1, "c/d.png": t1]), ["b.md", "c/d.png"])
        XCTAssertEqual(TurnArtifacts.changed(before: [:], after: [:]), [])
    }

    func testBackgroundTasksEvent() {
        XCTAssertEqual(StreamJSON.parse(line: #"{"type":"system","subtype":"background_tasks_changed","tasks":[{"task_id":"a"},{"task_id":"b"}]}"#), .backgroundTasks(count: 2))
        XCTAssertEqual(StreamJSON.parse(line: #"{"type":"system","subtype":"background_tasks_changed","tasks":[]}"#), .backgroundTasks(count: 0))
        // The runtime's own watchers (ambient) are not the agent's work.
        XCTAssertEqual(StreamJSON.parse(line: #"{"type":"system","subtype":"background_tasks_changed","tasks":[{"task_id":"a","ambient":true},{"task_id":"b","ambient":false},{"task_id":"c"}]}"#), .backgroundTasks(count: 2))
    }
}
