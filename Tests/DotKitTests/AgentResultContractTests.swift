import XCTest
@testable import DotKit

final class AgentResultContractTests: XCTestCase {
    func testEachContractLine() {
        let text = """
        Done, the brief is on your desktop with four dated items.

        Next: Add a section on their CEO
        Next: Compare with Citadel's year
        Done: Bridgewater October Brief
        Files: ~/Desktop/bridgewater.pdf
        Files: https://example.com/report
        Routine: {"action":"create","title":"Fund News","when":"every weekday at 8 am","task":"Brief me on Bridgewater news since the last run."}
        """
        let r = AgentResult.parse(text)
        XCTAssertEqual(r.body, "Done, the brief is on your desktop with four dated items.")
        XCTAssertEqual(r.nextActions, ["Add a section on their CEO", "Compare with Citadel's year"])
        XCTAssertEqual(r.nextAction, "Add a section on their CEO")
        XCTAssertEqual(r.doneTitle, "Bridgewater October Brief")
        XCTAssertEqual(r.files, [NSHomeDirectory() + "/Desktop/bridgewater.pdf", "https://example.com/report"])
        XCTAssertEqual(r.routine?.action, .create)
        XCTAssertEqual(r.routine?.title, "Fund News")
        XCTAssertEqual(r.routine?.schedule?.kind, .weekdays)
        XCTAssertFalse(r.isQuestion)
    }

    func testMixedOrderMarkdownAndBlankLines() {
        let text = "Drafted the reply; it is in Drafts.\n\n**Done:** Reply to Saket\n\n- Next: Draft a follow-up for Friday\nFiles: `/tmp/reply.txt`\n**Next**: 1. Find his calendar slot.\n"
        let r = AgentResult.parse(text)
        XCTAssertEqual(r.body, "Drafted the reply; it is in Drafts.")
        XCTAssertEqual(r.doneTitle, "Reply to Saket")
        XCTAssertEqual(r.nextActions, ["Draft a follow-up for Friday", "Find his calendar slot"])
        XCTAssertEqual(r.files, ["/tmp/reply.txt"])
    }

    func testContractWordsInTheMiddleAreBody() {
        let text = "Next: I read the filing.\nDone: the model ties out.\nThe margin story holds.\n\nNext: Build the DCF"
        let r = AgentResult.parse(text)
        XCTAssertEqual(r.body, "Next: I read the filing.\nDone: the model ties out.\nThe margin story holds.")
        XCTAssertEqual(r.nextActions, ["Build the DCF"])
        XCTAssertNil(r.doneTitle)
    }

    func testAtMostFourNextActionsDeduped() {
        let text = "Done.\nNext: One\nNext: one\nNext: Two\nNext: Three\nNext: Four\nNext: Five"
        XCTAssertEqual(AgentResult.parse(text).nextActions, ["One", "Two", "Three", "Four"])
    }

    func testAQuestionTurnCarriesNoNextActions() {
        let last = AgentResult.parse("I drafted both versions.\nWhich account should it go from, UChicago or Gmail?\n\nNext: Send it from UChicago\nDone: Two Drafts")
        XCTAssertTrue(last.isQuestion)
        XCTAssertEqual(last.nextActions, [])
        XCTAssertNil(last.nextAction)
        XCTAssertEqual(last.doneTitle, "Two Drafts")
        let first = AgentResult.parse("Which deadline do you mean? The list has two for Friday.\nNext: Show both deadlines")
        XCTAssertTrue(first.isQuestion)
        XCTAssertEqual(first.nextActions, [])
        let bold = AgentResult.parse("Done, but one thing: **which fund did you mean?**")
        XCTAssertTrue(bold.isQuestion)
        // A question mark inside a URL or mid-body is not a question turn.
        let url = AgentResult.parse("Saved it. The source is https://x.com/a?b=1\nNext: Add the chart")
        XCTAssertFalse(url.isQuestion)
        XCTAssertEqual(url.nextActions, ["Add the chart"])
    }

    func testMissingBlocks() {
        let r = AgentResult.parse("Nothing to suggest here.")
        XCTAssertEqual(r, AgentResult(body: "Nothing to suggest here."))
        XCTAssertNil(r.doneTitle)
        XCTAssertEqual(r.nextActions, [])
        XCTAssertEqual(r.files, [])
        XCTAssertNil(r.routine)
        XCTAssertEqual(AgentResult.parse(""), AgentResult(body: ""))
    }

    func testOverlongValues() {
        // Over 40: cut at the last word that fits, minus a dangling joiner word.
        let cut = AgentResult.parse("Ok.\nNext: Compare the launch economics of the two rival plans side by side")
        XCTAssertEqual(cut.nextActions, ["Compare the launch economics of the two"])
        XCTAssertLessThanOrEqual(cut.nextActions[0].count, 40)
        let joiner = AgentResult.parse("Ok.\nNext: Pull the comps and precedent deals for the sector")
        XCTAssertEqual(joiner.nextActions, ["Pull the comps and precedent deals"])
        // Over 120, or one word too long for a button: dropped, and still out of the body.
        let long = String(repeating: "word ", count: 30)
        let dropped = AgentResult.parse("Ok.\nNext: \(long)\nNext: \(String(repeating: "x", count: 45))")
        XCTAssertEqual(dropped.nextActions, [])
        XCTAssertEqual(dropped.body, "Ok.")
        // A title of six words is a sentence: dropped.
        XCTAssertNil(AgentResult.parse("Ok.\nDone: the brief is now on your desktop").doneTitle)
        XCTAssertEqual(AgentResult.parse("Ok.\nDone: \"Peptides Report.\"").doneTitle, "Peptides Report")
        // At most eight files.
        let many = (1...10).map { "Files: /tmp/f\($0).txt" }.joined(separator: "\n")
        XCTAssertEqual(AgentResult.parse("Ok.\n" + many).files.count, 8)
    }

    func testFileValues() {
        let r = AgentResult.parse("""
        Ok.
        Files: none
        Files: the two PDFs are on your desktop
        Files: [brief](~/Desktop/brief.pdf)
        Files: file:///tmp/a%20b.txt
        Files: output/table.csv
        """)
        XCTAssertEqual(r.files, [NSHomeDirectory() + "/Desktop/brief.pdf", "/tmp/a b.txt", "output/table.csv"])
    }

    func testAMessageThatIsOnlyItsDoneLineKeepsIt() {
        let r = AgentResult.parse("Done: it's on your desktop.")
        XCTAssertEqual(r.body, "it's on your desktop.")
        XCTAssertEqual(r.doneTitle, "it's on your desktop")
    }

    func testBadRoutineLines() {
        for line in [
            "Routine: {not json",
            #"Routine: {"action":"archive","title":"Fund News"}"#,
            #"Routine: {"action":"create","title":"Fund News","task":"x"}"#,
            #"Routine: {"action":"create","title":"Fund News","when":"whenever","task":"x"}"#,
            #"Routine: {"action":"create","title":"  ","when":"every day at 8","task":"x"}"#,
            #"Routine: {"action":"update","title":"Fund News"}"#,
            #"Routine: ["create"]"#,
        ] {
            let r = AgentResult.parse("Set.\n" + line)
            XCTAssertNil(r.routine, line)
            XCTAssertEqual(r.body, "Set.", line)
        }
        let quoted = AgentResult.parse("Set.\nRoutine: `{\"action\":\"Pause\",\"title\":\"fund news\"}`")
        XCTAssertEqual(quoted.routine, RoutineCommand(action: .pause, title: "fund news"))
    }

    func testFilesMergeKeepsStatedFirstOnlyExistingDedupedCapped() throws {
        let fm = FileManager.default
        let root = fm.temporaryDirectory.appendingPathComponent("dot-merge-\(UUID().uuidString)")
        let output = root.appendingPathComponent("output")
        try fm.createDirectory(at: output, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: root) }
        let desk = root.appendingPathComponent("desk.pdf")
        let made1 = output.appendingPathComponent("a.md")
        let made2 = output.appendingPathComponent("b.md")
        for url in [desk, made1, made2] { try Data("x".utf8).write(to: url) }
        let merged = TurnArtifacts.merge(
            stated: [desk.path, root.appendingPathComponent("missing.txt").path, "output/b.md", "https://example.com/x"],
            made: [made1, made2], folder: root)
        XCTAssertEqual(merged.map { $0.isFileURL ? $0.lastPathComponent : $0.absoluteString }, ["desk.pdf", "b.md", "https://example.com/x", "a.md"])
        // The cap, with the agent's files first.
        let stated = (1...6).map { "https://example.com/\($0)" }
        let capped = TurnArtifacts.merge(stated: stated, made: [made1, made2, desk], folder: root, exists: { _ in true })
        XCTAssertEqual(capped.count, 8)
        XCTAssertEqual(capped.first?.absoluteString, "https://example.com/1")
        XCTAssertEqual(capped.last?.lastPathComponent, "b.md")
        XCTAssertEqual(TurnArtifacts.merge(stated: [], made: [], folder: nil), [])
    }
}

final class RoutineCommandTests: XCTestCase {
    let now = Date(timeIntervalSince1970: 1_792_000_000)

    func command(_ json: String) -> RoutineCommand {
        AgentResult.parse("Ok.\nRoutine: " + json).routine!
    }

    func testEachActionByTitle() {
        var book = RoutineBook()
        let created = book.apply(command(#"{"action":"create","title":"Fund News","when":"every weekday at 8 am","task":"Brief me on fund news."}"#),
                                 agent: "research-buddy", agentName: "Research Buddy", now: now)
        guard case .created(let routine) = created else { return XCTFail("\(created)") }
        XCTAssertEqual(routine.title, "Fund News")
        XCTAssertEqual(routine.brief, "Brief me on fund news.")
        XCTAssertEqual(routine.schedule.kind, .weekdays)
        XCTAssertGreaterThan(routine.nextRun, now, "the turn that made it was the first run")
        XCTAssertEqual(book.routines.count, 1)

        let updated = book.apply(command(#"{"action":"update","title":"fund news","when":"every day at 7 am"}"#), agent: "research-buddy", agentName: "Research Buddy", now: now)
        guard case .updated(let changed) = updated else { return XCTFail("\(updated)") }
        XCTAssertEqual(changed.schedule.kind, .daily)
        XCTAssertEqual(changed.brief, "Brief me on fund news.")

        // A create with a title it already uses changes that one.
        _ = book.apply(command(#"{"action":"create","title":"Fund News","when":"every day at 9","task":"New brief."}"#), agent: "research-buddy", agentName: "Research Buddy", now: now)
        XCTAssertEqual(book.routines.count, 1)
        XCTAssertEqual(book.routines[0].brief, "New brief.")

        guard case .paused = book.apply(command(#"{"action":"pause","title":"Fund News"}"#), agent: "research-buddy", agentName: "Research Buddy", now: now) else { return XCTFail() }
        XCTAssertTrue(book.routines[0].paused)
        book.routines[0].failures = 3
        guard case .resumed = book.apply(command(#"{"action":"resume","title":"Fund News"}"#), agent: "research-buddy", agentName: "Research Buddy", now: now) else { return XCTFail() }
        XCTAssertFalse(book.routines[0].paused)
        XCTAssertEqual(book.routines[0].failures, 0)

        // Another agent's routine is not this one's to change.
        XCTAssertEqual(book.apply(command(#"{"action":"delete","title":"Fund News"}"#), agent: "inbox-keeper", agentName: "Inbox Keeper", now: now), .notFound("Fund News"))
        XCTAssertEqual(book.apply(command(#"{"action":"update","title":"Nope","task":"x"}"#), agent: "research-buddy", agentName: "Research Buddy", now: now), .notFound("Nope"))
        guard case .deleted = book.apply(command(#"{"action":"delete","title":"Fund News"}"#), agent: "research-buddy", agentName: "Research Buddy", now: now) else { return XCTFail() }
        XCTAssertEqual(book.routines, [])
    }

    func testListLineAndUntitledRoutines() {
        var book = RoutineBook()
        XCTAssertEqual(book.listLine(for: "dot"), "Your routines: none. This list is complete.")
        let schedule = RoutineSchedule(kind: .daily, hour: 8)
        book.routines.append(Routine(agent: "dot", agentName: "Dot", brief: "Check my inbox, then summarize it.", schedule: schedule, now: now))
        var paused = Routine(agent: "dot", agentName: "Dot", brief: "x", schedule: RoutineSchedule(kind: .hours, everyHours: 3), now: now, title: "Desk Sweep")
        paused.paused = true
        book.routines.append(paused)
        book.routines.append(Routine(agent: "other", agentName: "Other", brief: "y", schedule: schedule, now: now, title: "Not Mine"))
        XCTAssertEqual(book.listLine(for: "dot"), "Your routines: Check my inbox then, every day at 8 am; Desk Sweep, every 3 hours (paused). This list is complete.")
        // An untitled routine answers to the title the list gave it.
        XCTAssertEqual(book.routine(titled: "check my inbox then", agent: "dot")?.brief, "Check my inbox, then summarize it.")
    }

    func testOldRoutineFilesDecodeWithoutTitle() throws {
        let book = RoutineBook(routines: [Routine(agent: "dot", agentName: "Dot", brief: "b", schedule: RoutineSchedule(kind: .daily), now: now)])
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: encoder.encode(book)) as? [String: Any])
        var routines = try XCTUnwrap(object["routines"] as? [[String: Any]])
        routines[0].removeValue(forKey: "title")
        object["routines"] = routines
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("routines-\(UUID().uuidString).json")
        try JSONSerialization.data(withJSONObject: object).write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }
        let loaded = RoutineBook.load(from: url)
        XCTAssertEqual(loaded.routines.count, 1)
        XCTAssertNil(loaded.routines[0].title)
        XCTAssertEqual(loaded.routines[0].displayTitle, "b")
    }

    func testFixBrief() {
        var routine = Routine(agent: "dot", agentName: "Dot", brief: "Sweep the inbox.", schedule: RoutineSchedule(kind: .daily, hour: 8), now: now, title: "Inbox Sweep")
        routine.lastNote = "paused after 3 failed runs in a row: gmail timed out"
        XCTAssertEqual(routine.fixBrief, """
        Your routine "Inbox Sweep" (every day at 8 am) is paused after failing. Its brief: Sweep the inbox.
        The last failure: paused after 3 failed runs in a row: gmail timed out
        Read .dot/transcript.jsonl for the failed runs; fix the brief or say what is wrong.
        """)
    }
}
