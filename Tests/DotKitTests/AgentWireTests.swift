import XCTest
@testable import DotKit

final class AgentWireTests: XCTestCase {
    func testParseEveryVerb() {
        XCTAssertEqual(try AgentCommand.parse(flag: "--agent-start", ["scout", "find", "hackathons", "this", "week"]).get(),
                       .start(name: "scout", brief: "find hackathons this week"))
        XCTAssertEqual(try AgentCommand.parse(flag: "--agent-status", []).get(), .status(name: nil))
        XCTAssertEqual(try AgentCommand.parse(flag: "--agent-status", ["scout", "--json"]).get(), .status(name: "scout"))
        XCTAssertEqual(try AgentCommand.parse(flag: "--agent-list", ["--json"]).get(), .list)
        XCTAssertEqual(try AgentCommand.parse(flag: "--agent-start", ["scout", "--quiet", "look", "--json"]).get(), .start(name: "scout", brief: "look", quiet: true))
        XCTAssertEqual(try AgentCommand.parse(flag: "--agent-tell", ["scout", "also YC events"]).get(), .tell(name: "scout", message: "also YC events"))
        XCTAssertEqual(try AgentCommand.parse(flag: "--agent-note", ["writer", "the deck is in output/", "--from", "scout"]).get(),
                       .note(from: "scout", to: "writer", text: "the deck is in output/"))
        XCTAssertEqual(try AgentCommand.parse(flag: "--agent-note", ["writer", "hi"]).get(), .note(from: "him", to: "writer", text: "hi"))
    }

    func testParseRefusesMissingParts() {
        XCTAssertThrowsError(try AgentCommand.parse(flag: "--agent-start", ["scout"]).get())
        XCTAssertThrowsError(try AgentCommand.parse(flag: "--agent-start", ["scout", "  "]).get())
        XCTAssertThrowsError(try AgentCommand.parse(flag: "--agent-tell", ["scout"]).get())
        XCTAssertThrowsError(try AgentCommand.parse(flag: "--agent-note", ["writer", "--from", "scout"]).get())
        XCTAssertEqual(AgentCommand.Usage("--agent-start").description, "usage: Dot --agent-start <name> \"<brief>\" [--quiet] [--json]")
    }

    func testRequestRoundTrip() {
        let commands: [AgentCommand] = [.start(name: "a", brief: "b"), .start(name: "a", brief: "b", quiet: true), .status(name: nil), .status(name: "a"), .list,
                                        .tell(name: "a", message: "m"), .tell(name: "a", message: "m", quiet: true), .note(from: "x", to: "a", text: "t")]
        for c in commands { XCTAssertEqual(AgentCommand.from(request: c.request), c) }
        XCTAssertNil(AgentCommand.from(request: ["verb": "agent", "do": "start", "name": "a"]))
        XCTAssertNil(AgentCommand.from(request: ["verb": "agent", "do": "explode"]))
        XCTAssertEqual(AgentCommand.from(request: ["do": "note", "name": "a", "text": "t", "from": ""]), .note(from: "him", to: "a", text: "t"))
    }

    func testStatusLineAndJSON() {
        let row = AgentStatus(name: "Scout", slug: "scout", state: .idle, lastStep: "finished at 9:02", next: "routine at 6:00",
                              files: ["output/a.md", "output/b.md", "output/c.md", "output/d.md"], spendTodayUSD: 0.4321,
                              startedAt: Date(timeIntervalSince1970: 1_800_000_000), result: "Found 4 hackathons.", notesWaiting: 1)
        XCTAssertEqual(row.line, "Scout (scout): idle, finished at 9:02; next: routine at 6:00; last report: Found 4 hackathons.; "
                       + "files: output/a.md, output/b.md, output/c.md; $0.43 today; 1 note waiting")
        let wire = AgentStatus.wire([row])
        XCTAssertEqual(AgentStatus.decode(wire), [row])
        XCTAssertTrue(AgentStatus.json([row]).contains("\"notesWaiting\" : 1"))
        XCTAssertEqual(AgentStatus.decode(nil), [])
        var working = row
        working.state = .working
        XCTAssertFalse(working.line.contains("last report"), "a working agent's old report isn't news")
    }

    func testNoteDeliveryRules() {
        XCTAssertEqual(AgentNote.delivery(from: "scout", to: "writer", exists: true, working: true, text: "x"), .now)
        XCTAssertEqual(AgentNote.delivery(from: "scout", to: "writer", exists: true, working: false, text: "x"), .nextTurn)
        XCTAssertEqual(AgentNote.delivery(from: "scout", to: "ghost", exists: false, working: false, text: "x"), .refused("no agent named ghost"))
        XCTAssertEqual(AgentNote.delivery(from: "Scout", to: "scout", exists: true, working: true, text: "x"), .refused("a note to itself"))
        XCTAssertEqual(AgentNote.delivery(from: "a", to: "b", exists: true, working: true, text: " \n"), .refused("an empty note"))
        if case .refused = AgentNote.delivery(from: "a", to: "b", exists: true, working: true, text: String(repeating: "x", count: 4001)) {} else {
            XCTFail("a long note is refused")
        }
    }

    func testNoteText() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/Chicago")!
        let note = AgentNote(from: "scout", to: "writer", text: "use the Q3 numbers", at: Date(timeIntervalSince1970: 1_800_000_000))
        XCTAssertEqual(note.markdown(calendar: cal), "## 2027-01-15 02:00 from scout\n\nuse the Q3 numbers\n\n")
        XCTAssertTrue(note.message.hasPrefix("[note from scout] use the Q3 numbers"))
        XCTAssertNil(AgentNote.block([]))
        XCTAssertEqual(AgentNote.block([note, AgentNote(from: "him", to: "writer", text: "shorter")]),
                       "[notes] left for you since your last turn:\n- from scout: use the Q3 numbers\n- from him: shorter")
    }

    func testWakeMath() {
        let tz = TimeZone(identifier: "America/Chicago")!
        let now = Date(timeIntervalSince1970: 1_800_000_000)   // 2027-01-15 02:00 CST
        let runs = [now.addingTimeInterval(4 * 3600),          // 06:00 -> wake 05:58
                    now.addingTimeInterval(4 * 3600 + 120),    // 06:02 -> 06:00, within 5 min of 05:58: one wake
                    now.addingTimeInterval(90),                // wake would be in the past
                    now.addingTimeInterval(8 * 86400),         // past the week
                    now.addingTimeInterval(86400 + 0.7)]       // tomorrow, fractional second dropped
        let wakes = WakePlan.wakes(nextRuns: runs, now: now)
        XCTAssertEqual(wakes.map { WakePlan.pmsetDate($0, timeZone: tz) }, ["01/15/27 05:58:00", "01/16/27 01:58:00"])
        let (add, cancel) = WakePlan.changes(wanted: wakes, scheduled: [wakes[0], now.addingTimeInterval(3600), now.addingTimeInterval(-60)], now: now)
        XCTAssertEqual(add, [wakes[1]])
        XCTAssertEqual(cancel, [now.addingTimeInterval(3600)], "a moved routine's wake goes; a past one is gone already")
        XCTAssertTrue(WakePlan.isLate(due: now.addingTimeInterval(-600), now: now))
        XCTAssertFalse(WakePlan.isLate(due: now.addingTimeInterval(-30), now: now))
    }

    func testWakeAcrossDST() {
        let tz = TimeZone(identifier: "America/Chicago")!
        // 2027-03-14 02:00 CST springs to 03:00 CDT: a 03:05 run wakes at 03:03 local
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        let run = cal.date(from: DateComponents(year: 2027, month: 3, day: 14, hour: 3, minute: 5))!
        let now = cal.date(from: DateComponents(year: 2027, month: 3, day: 13, hour: 23))!
        XCTAssertEqual(WakePlan.wakes(nextRuns: [run], now: now).map { WakePlan.pmsetDate($0, timeZone: tz) }, ["03/14/27 03:03:00"])
    }

    func testPmsetScheduleParse() {
        let tz = TimeZone(identifier: "America/Chicago")!
        let out = """
        Scheduled power events:
         [0]  wake at 10/26/2026 06:52:20 by 'com.apple.alarm.user-invisible-com.apple.acmd.alarm'
         [1]  wake at 10/27/2026 05:58:00 by 'Dot'
         [2]  wakepoweron at 10/28/2026 09:00:00
        """
        let rows = WakePlan.scheduled(pmsetOutput: out, timeZone: tz)
        XCTAssertEqual(rows.map(\.type), ["wake", "wake", "wakepoweron"])
        XCTAssertEqual(rows.map(\.owner), ["com.apple.alarm.user-invisible-com.apple.acmd.alarm", "Dot", ""])
        XCTAssertEqual(WakePlan.pmsetDate(rows[1].at, timeZone: tz), "10/27/26 05:58:00")
        XCTAssertTrue(WakePlan.scheduled(pmsetOutput: "No scheduled events.", timeZone: tz).isEmpty)
    }

    func testWakeHomeLine() {
        XCTAssertNil(WakePlan.homeLine(ruleInstalled: false, activeRoutines: 0, overnight: false))
        XCTAssertTrue(WakePlan.homeLine(ruleInstalled: false, activeRoutines: 2, overnight: true)!.hasPrefix("Routines wait while the Mac sleeps"))
        XCTAssertEqual(WakePlan.homeLine(ruleInstalled: true, activeRoutines: 1, overnight: false), "Dot wakes the Mac two minutes before each routine.")
        XCTAssertTrue(WakePlan.homeLine(ruleInstalled: true, activeRoutines: 1, overnight: true)!.contains("plugged in"))
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/Chicago")!
        XCTAssertTrue(WakePlan.isOvernight(cal.date(from: DateComponents(year: 2026, month: 10, day: 27, hour: 6))!, calendar: cal))
        XCTAssertFalse(WakePlan.isOvernight(cal.date(from: DateComponents(year: 2026, month: 10, day: 27, hour: 8))!, calendar: cal))
        XCTAssertEqual(WakePlan.installCommand(ruleFile: "/p/dot-pmset"),
                       "sudo visudo -cf /p/dot-pmset && sudo install -m 0440 -o root -g wheel /p/dot-pmset /etc/sudoers.d/dot-pmset")
    }

    func testSudoersRuleAllowsOnlyPmset() {
        let rule = WakePlan.sudoersRule(user: "roshanshah")
        let grant = rule.split(separator: "\n").filter { !$0.hasPrefix("#") }
        XCTAssertEqual(grant.count, 1)
        XCTAssertTrue(grant[0].hasPrefix("roshanshah ALL=(root) NOPASSWD: /usr/bin/pmset schedule wake *"))
        XCTAssertFalse(grant[0].contains("ALL, "), "no blanket grant")
    }
    func testAgentMCPWire() {
        XCTAssertEqual(AgentMCPWire.toolNames, ["note_to", "list_agents", "make_image"])
        let initialize = HandsMCPWire.parse(#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}"#)!
        XCTAssertTrue(AgentMCPWire.localReply(initialize)!.contains("\"name\":\"dot-agents\""))
        let call = HandsMCPWire.parse(#"{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"note_to"}}"#)!
        XCTAssertNil(AgentMCPWire.localReply(call), "calls are relayed")
        XCTAssertEqual(AgentMCPWire.timeout("make_image"), 200)
    }

    func testAgentMCPConfigKeepsOtherServers() throws {
        let base = Data(#"{"mcpServers":{"atlas":{"command":"/x/atlas","args":["mcp"]},"dot-agents":{"command":"old"}}}"#.utf8)
        let out = try XCTUnwrap(AgentMCPWire.adding(to: base, executable: "/Apps/Dot", agent: "scout", socket: "/tmp/c.sock"))
        let servers = try XCTUnwrap((try JSONSerialization.jsonObject(with: out) as? [String: Any])?["mcpServers"] as? [String: Any])
        XCTAssertNotNil(servers["atlas"], "Atlas is kept")
        let mine = try XCTUnwrap(servers["dot-agents"] as? [String: Any])
        XCTAssertEqual(mine["args"] as? [String], ["--agent-mcp", "--agent", "scout"])
        XCTAssertEqual((mine["env"] as? [String: String])?["DOT_CONTROL_SOCKET"], "/tmp/c.sock")
        XCTAssertNotNil(AgentMCPWire.adding(to: nil, executable: "/Apps/Dot", agent: "a", socket: nil))
        XCTAssertNil(AgentMCPWire.adding(to: Data("not json".utf8), executable: "/Apps/Dot", agent: "a", socket: nil))
        // the router leaves Dot's own servers direct
        let routed = try XCTUnwrap(RouterConfig.wrap(out, executable: "/Apps/Dot", specPath: "/tmp/spec.json", deny: []))
        let routedServers = (try JSONSerialization.jsonObject(with: routed.config) as? [String: Any])?["mcpServers"] as? [String: Any]
        XCTAssertEqual((routedServers?["dot-agents"] as? [String: Any])?["args"] as? [String], ["--agent-mcp", "--agent", "scout"])
        XCTAssertFalse(routed.routed.contains("dot-agents"))
    }

    func testImageRequestChecks() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let ok = try? ImageRequest.make(prompt: " a clean diagram of a DCF ", aspect: nil, file: nil, now: now).get()
        XCTAssertEqual(ok?.prompt, "a clean diagram of a DCF")
        XCTAssertEqual(ok?.aspect, "1:1")
        XCTAssertTrue(ok?.file.hasPrefix("clean-diagram-of-dcf-") == true && ok?.file.hasSuffix(".png") == true, ok?.file ?? "")
        XCTAssertEqual(try? ImageRequest.make(prompt: "x", aspect: "16:9", file: "cover slide", now: now).get().file, "cover-slide.png")
        XCTAssertEqual(try? ImageRequest.make(prompt: "x", aspect: "16:9", file: "Thumb.PNG", now: now).get().file, "Thumb.PNG")
        XCTAssertThrowsError(try ImageRequest.make(prompt: "  ", aspect: nil, file: nil).get())
        XCTAssertThrowsError(try ImageRequest.make(prompt: "x", aspect: "5:1", file: nil).get())
        XCTAssertThrowsError(try ImageRequest.make(prompt: "x", aspect: nil, file: "../../.ssh/a.png").get())
        XCTAssertThrowsError(try ImageRequest.make(prompt: "x", aspect: nil, file: "/tmp/a.png").get())
        XCTAssertThrowsError(try ImageRequest.make(prompt: String(repeating: "x", count: 4001), aspect: nil, file: nil).get())
        let body = ImageRequest(prompt: "p", aspect: "16:9", file: "a.png").body(model: "m")
        XCTAssertEqual(body["modalities"] as? [String], ["image", "text"])
        XCTAssertEqual((body["image_config"] as? [String: String])?["aspect_ratio"], "16:9")
    }

    func testImageModelPickAndReply() {
        let models: [[String: Any]] = [
            ["id": "google/gemini-2.5-flash-image", "created": 1.0, "architecture": ["output_modalities": ["image", "text"]]],
            ["id": "openai/gpt-5.4-image-2", "created": 3.0, "architecture": ["output_modalities": ["image", "text"]]],
            ["id": "openrouter/auto", "created": 9.0, "architecture": ["output_modalities": ["text", "image"]]],
            ["id": "anthropic/claude-opus-5.5", "created": 8.0, "architecture": ["output_modalities": ["text"]]],
        ]
        XCTAssertEqual(ImageRequest.pickModel(preferred: ["google/gemini-nano-banana-2.1", "openai/gpt-5.4-image-2"], models: models), "openai/gpt-5.4-image-2")
        XCTAssertEqual(ImageRequest.pickModel(preferred: ["gone/model"], models: models), "openai/gpt-5.4-image-2", "else the newest real image model")
        XCTAssertNil(ImageRequest.pickModel(preferred: [], models: []))
        let png = Data([0x89, 0x50, 0x4E, 0x47])
        let reply: [String: Any] = ["choices": [["message": ["content": "here", "images": [["type": "image_url", "image_url": ["url": "data:image/png;base64," + png.base64EncodedString()]]]]]]]
        XCTAssertEqual(try? ImageRequest.images(in: reply).get(), [png])
        if case .failure(let p) = ImageRequest.images(in: ["choices": [["message": ["content": "I can't draw that person."]]]]) {
            XCTAssertEqual(p.why, "no image came back; the model said: I can't draw that person.")
        } else { XCTFail("a refusal is not an image") }
        if case .failure(let p) = ImageRequest.images(in: ["error": ["message": "insufficient credits"]]) {
            XCTAssertEqual(p.why, "the image model said: insufficient credits")
        } else { XCTFail("an error is not an image") }
    }

    func testDotEnv() {
        let text = "export JINA_API_KEY=abc\nOPENROUTER_API_KEY=\"sk-or-1\"\n# EMPTY_KEY=\nEMPTY_KEY=\n"
        XCTAssertEqual(DotEnv.value("OPENROUTER_API_KEY", in: text), "sk-or-1")
        XCTAssertEqual(DotEnv.value("JINA_API_KEY", in: text), "abc")
        XCTAssertNil(DotEnv.value("EMPTY_KEY", in: text))
        XCTAssertNil(DotEnv.value("JINA", in: text), "a prefix of a name is not the name")
    }
}
