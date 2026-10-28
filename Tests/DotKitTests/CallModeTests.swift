import XCTest
@testable import DotKit

final class CallModeTests: XCTestCase {
    private let t0 = Date(timeIntervalSince1970: 1_800_000_000)
    private func item(_ title: String, location: String = "", notes: String = "", minutes: Double = 30) -> CalendarItem {
        CalendarItem(title: title, start: t0, end: t0.addingTimeInterval(minutes * 60), location: location, notes: notes)
    }

    func testNetworkingCallTitle() {
        let e = CallCalendar.event(item("Call: Alex Example (Northwind Bank)", notes: "call his cell (555) 010-0199"))
        XCTAssertEqual(e?.kind, .chat)
        XCTAssertEqual(e?.person, "Alex Example")
        XCTAssertEqual(e?.firm, "Northwind Bank")
        XCTAssertEqual(e?.phone, "+15550100199")
        XCTAssertEqual(e?.theyCall, false)
        XCTAssertEqual(CallCalendar.event(item("Call: Sam Placeholder"))?.person, "Sam Placeholder")
    }

    func testOutlookInviteTitle() {
        let e = CallCalendar.event(item("Roshan Shah / Jordan Sample"))
        XCTAssertEqual(e?.kind, .chat)
        XCTAssertEqual(e?.person, "Jordan Sample")
    }

    func testInterviews() {
        let a = CallCalendar.event(item("Northwind Partners interview (2028 Investment Summer Intern)"))
        XCTAssertEqual(a?.kind, .interview)
        XCTAssertEqual(a?.firm, "Northwind Partners")
        let b = CallCalendar.event(item("Acme Capital phone interview (Casey Sample calls you)", notes: "+1 555 010 0142"))
        XCTAssertEqual(b?.firm, "Acme Capital")
        XCTAssertEqual(b?.person, "Casey Sample")
        XCTAssertEqual(b?.theyCall, true)
        XCTAssertEqual(b?.phone, "+15550100142")
        XCTAssertEqual(CallCalendar.event(item("Example Club first round"))?.kind, .interview)
        XCTAssertEqual(CallCalendar.event(item("Acme HR screen"))?.firm, "Acme")
        XCTAssertEqual(CallCalendar.event(item("Superday: Example Bank"))?.kind, .interview)
    }

    func testNotCalls() {
        for title in ["Northwind interview prep (resume walk, why us)", "done: Acme suited assessment (confirmation)", "Mock interview with career office",
                      "Mechanics: lecture", "Interview practice", "Team practice", "Wyzant: student, microeconomics", "Physics office hours"] {
            XCTAssertNil(CallCalendar.event(item(title)), title)
        }
        var allDay = item("Call: Alex Example (Northwind)")
        allDay.allDay = true
        XCTAssertNil(CallCalendar.event(allDay))
    }

    func testCurrentAndTomorrow() {
        let items = [item("Call: Alex Example (Northwind)"), item("Mechanics: lecture")]
        XCTAssertNil(CallCalendar.current(items, now: t0.addingTimeInterval(-20 * 60)))
        XCTAssertEqual(CallCalendar.current(items, now: t0.addingTimeInterval(-10 * 60))?.person, "Alex Example")
        XCTAssertEqual(CallCalendar.current(items, now: t0.addingTimeInterval(29 * 60))?.person, "Alex Example")
        XCTAssertNil(CallCalendar.current(items, now: t0.addingTimeInterval(31 * 60)))
        let cal = Calendar.current
        let evening = cal.date(byAdding: .day, value: -1, to: cal.date(bySettingHour: 21, minute: 0, second: 0, of: t0)!)!
        XCTAssertEqual(CallCalendar.tomorrow(items, now: evening).map(\.person), ["Alex Example"])
        XCTAssertEqual(CallCalendar.tomorrow(items, now: t0).count, 0)
    }

    func testCardTitleClippedToBrief() {
        // the meeting card's title is the brief's, cut to 48 characters
        let long = "Northwind video interview, hiring manager (confirmed, Teams)"
        let items = [item(long, minutes: 60), item("Call: Alex Example (Northwind)")]
        let soon = t0.addingTimeInterval(-10 * 60)
        let card = CallCalendar.current(items, now: soon, early: 11 * 60, titled: String(long.prefix(48)))
        XCTAssertEqual(card?.kind, .interview)
        XCTAssertEqual(card?.firm, "Northwind")
        XCTAssertEqual(CallCalendar.current(items, now: soon, early: 11 * 60, titled: "call: alex example (northwind)")?.person, "Alex Example")
        XCTAssertNil(CallCalendar.current(items, now: soon, early: 11 * 60, titled: "Mechanics: lecture"))
        XCTAssertNil(CallCalendar.current(items, now: soon, early: 11 * 60, titled: " "))
        // a title shorter than the clip is whole: "Northwind" is its own event, not the interview's card
        let short = [item("Northwind interview", minutes: 60), item("Northwind")]
        XCTAssertNil(CallCalendar.current(short, now: soon, early: 11 * 60, titled: "Northwind"))
        XCTAssertEqual(CallCalendar.current(short, now: soon, early: 11 * 60, titled: "Northwind interview")?.kind, .interview)
    }

    func testInterleaveAndMarkdown() {
        let lines = CallTranscript.interleave(me: [(0, "hi, thanks for taking the time"), (40, "what drew you to it?"), (44, "and how long did it take?")], meOffset: 0,
                                              them: [(5, "of course"), (60, "the sourcing side")], themOffset: 2)
        XCTAssertEqual(lines.map(\.side), [.me, .them, .me, .them])
        XCTAssertEqual(lines[2].text, "what drew you to it? and how long did it take?")
        XCTAssertEqual(lines[1].at, 7)
        let md = CallTranscript.markdown(heading: "Call with Alex Example", lines: lines, them: "Alex")
        XCTAssertTrue(md.hasPrefix("# Call with Alex Example\n\n**Roshan** (00:00): hi"))
        XCTAssertTrue(md.contains("**Alex** (01:02): the sourcing side"))
        XCTAssertEqual(CallTranscript.clock(3760), "1:02:40")
    }

    func testTurnsSplitOnSilence() {
        let tokens = [("\u{2581}hi", 0.0), ("\u{2581}there", 0.3), ("\u{2581}how", 5.0), ("\u{2581}are", 5.3), ("\u{2581}y", 5.5), ("ou", 5.6), ("?", 5.7)]
            .map { TranscriptParagraphs.Token(text: $0.0, start: $0.1) }
        let turns = CallTranscript.turns(tokens)
        XCTAssertEqual(turns.map(\.text), ["hi there", "how are you?"])
        XCTAssertEqual(turns.map(\.start), [0, 5])
        // the recognizer stamps a sentence's period at the next word, after the other side's turn
        let late = [(" now", 6.0), (".", 12.4), (" Yeah", 12.64), (",", 12.9), (" second", 13.1)].map { TranscriptParagraphs.Token(text: $0.0, start: $0.1) }
        XCTAssertEqual(CallTranscript.turns(late).map(\.text), ["now.", "Yeah, second"])
    }

    func testInterleaveDropsEcho() {
        let lines = CallTranscript.interleave(me: [(10, "we mostly source deals in cybersecurity software"), (30, "how did you size that market")],
                                              them: [(9, "so we mostly source deals in cybersecurity software these days")])
        XCTAssertEqual(lines.map(\.side), [.them, .me])
        XCTAssertEqual(lines[1].text, "how did you size that market")
    }

    func testFillingFromLive() {
        let batch = [CallLine(at: 0, side: .me, text: "hey thanks so much for making the time"), CallLine(at: 5, side: .them, text: "of course, feel free to email me")]
        let live = [CallLine(at: 3, side: .me, text: "hey thanks so much for making the time"), CallLine(at: 8, side: .them, text: "of course feel free to email me"),
                    CallLine(at: 12, side: .me, text: "will do, thanks again Alex")]
        let filled = CallTranscript.filling(batch, from: live)
        XCTAssertEqual(filled.map(\.side), [.me, .them, .me])
        XCTAssertEqual(filled.last?.text, "will do, thanks again Alex")
    }

    func testEcho() {
        XCTAssertTrue(CallEcho.isEcho("we source deals in cybersecurity software", theirRecent: "so mostly we source deals in cybersecurity software and payments"))
        XCTAssertFalse(CallEcho.isEcho("how did you size the cybersecurity market", theirRecent: "we source deals in cybersecurity software"))
        XCTAssertFalse(CallEcho.isEcho("yeah", theirRecent: "yeah"))
    }

    func testCloseAsk() {
        XCTAssertTrue(CloseAsk.wasAsked("is there anyone else you think I should talk to"))
        XCTAssertTrue(CloseAsk.wasAsked("who else on the team would be good to reach out to"))
        XCTAssertTrue(CloseAsk.wasAsked("would you be able to point me to someone in the group"))
        XCTAssertFalse(CloseAsk.wasAsked("what else does the team cover"))
        let began = t0
        let end = t0.addingTimeInterval(30 * 60)
        XCTAssertFalse(CloseAsk.nudgeDue(now: t0.addingTimeInterval(20 * 60), began: began, endsAt: end, asked: false))
        XCTAssertTrue(CloseAsk.nudgeDue(now: t0.addingTimeInterval(27.5 * 60), began: began, endsAt: end, asked: false))
        XCTAssertFalse(CloseAsk.nudgeDue(now: t0.addingTimeInterval(27.5 * 60), began: began, endsAt: end, asked: true))
        XCTAssertTrue(CloseAsk.nudgeDue(now: t0.addingTimeInterval(21 * 60), began: began, endsAt: nil, asked: false))
        XCTAssertFalse(CloseAsk.nudgeDue(now: t0.addingTimeInterval(19 * 60), began: began, endsAt: nil, asked: false))
        // a call started late on a short slot: not in its first two minutes
        let short = t0.addingTimeInterval(4 * 60)
        XCTAssertFalse(CloseAsk.nudgeDue(now: t0.addingTimeInterval(90), began: began, endsAt: short, asked: false))
        XCTAssertTrue(CloseAsk.nudgeDue(now: t0.addingTimeInterval(150), began: began, endsAt: short, asked: false))
    }

    func testPrepChecklist() {
        let prep = """
        # Call prep: Alex Example (Northwind Bank)

        ## Who
        - Analyst in the tech group, two years in.

        ## Market items
        1. **Vantaca's HOA software roll-up**: ask whether vertical software still holds its multiple.
        2. Cybersecurity take-privates this year and what drove the pricing.

        ## Questions
        - What does sourcing look like day to day for your team?
        - Ask about the deal that died and what went wrong.

        ## The close
        - Ask who else to talk to.
        """
        let items = PrepChecklist.items(from: prep)
        XCTAssertEqual(items.count, 5)
        XCTAssertEqual(items[0], "Vantaca's HOA software roll-up: ask whether vertical software still holds its multiple.")
        XCTAssertFalse(items.contains { $0.hasPrefix("Analyst") }, "the Who section is not a checklist")
        XCTAssertTrue(PrepChecklist.covered(items[2], by: "so what does sourcing actually look like for your team"))
        XCTAssertTrue(PrepChecklist.covered(items[1], by: "I was reading about the cybersecurity take privates and the pricing"))
        XCTAssertFalse(PrepChecklist.covered(items[3], by: "what does your team do"))
    }

    func testHelpReply() {
        let help = CallHelp.parse("FACT: Vantaca — HOA software, payments to documents\nASK: How did you size that niche?\nDONE: 1, 3\n")
        XCTAssertEqual(help.fact, "Vantaca, HOA software, payments to documents")
        XCTAssertEqual(help.ask, "How did you size that niche?")
        XCTAssertEqual(help.done, [1, 3])
        XCTAssertNil(help.nudge)
        XCTAssertTrue(CallHelp.parse("NONE").isEmpty)
        XCTAssertTrue(CallHelp.parse("FACT: NONE\nASK: none").isEmpty)
        XCTAssertEqual(CallHelp.parse("- NUDGE: they asked for the internship story").nudge, "they asked for the internship story")
    }

    func testFiles() {
        let chat = CallEvent(title: "Call: Alex Example (Northwind)", start: t0, end: t0, kind: .chat, person: "Alex Example", firm: "Northwind")
        let day = CallFiles.day(t0)
        XCTAssertEqual(CallFiles.prepName(chat), "\(day)_Alex_Example_call_prep.md")
        XCTAssertEqual(CallFiles.recapName(chat), "\(day)_Alex_Example_coffee_chat_recap.md")
        XCTAssertEqual(CallFiles.transcriptName(chat), "\(day)_Alex_Example_call_transcript.md")
        let interview = CallEvent(title: "Northwind & Co. interview", start: t0, end: t0, kind: .interview, firm: "Northwind & Co.")
        XCTAssertEqual(CallFiles.recapName(interview), "\(day)_Northwind_Co_interview_debrief.md")
        let yesterday = CallFiles.day(t0.addingTimeInterval(-86_400))
        let names = ["\(yesterday)_Alex_Example_call_prep.md", "\(day)_Other_Person_call_prep.md", "2020-01-01_Alex_Example_call_prep.md",
                     "\(day)_Alex_Example_coffee_chat_recap.md"]
        XCTAssertEqual(CallFiles.findPrep(in: names, for: chat), "\(yesterday)_Alex_Example_call_prep.md")
        XCTAssertEqual(CallFiles.findPrep(in: ["\(day)_Northwind_Partners_prep.md"], for: interview), "\(day)_Northwind_Partners_prep.md")
        // another Alex's prep is not this call's; a file under his first name alone is, when nothing names him in full
        let jones = CallEvent(title: "Call: Alex Jones", start: t0, end: t0, kind: .chat, person: "Alex Jones")
        XCTAssertNil(CallFiles.findPrep(in: ["\(day)_Alex_Smith_call_prep.md", "\(day)_Alexandra_Jones_call_prep.md"], for: jones))
        XCTAssertEqual(CallFiles.findPrep(in: ["\(day)_Alex_Smith_call_prep.md", "\(day)_Alex_call_prep.md"], for: jones), "\(day)_Alex_call_prep.md")
        XCTAssertEqual(CallFiles.findPrep(in: ["\(day)_Alex_call_prep.md", "\(day)_Alex_Jones_call_prep.md"], for: jones), "\(day)_Alex_Jones_call_prep.md")
        // "Kevin Wu": the short surname still counts, so Kevin Lee's prep doesn't match
        let wu = CallEvent(title: "Call: Kevin Wu", start: t0, end: t0, kind: .chat, person: "Kevin Wu")
        XCTAssertNil(CallFiles.findPrep(in: ["\(day)_Kevin_Lee_call_prep.md"], for: wu))
    }

    func testSecondCallSameDayGetsItsOwnFiles() {
        let chat = CallEvent(title: "Call: Alex Example", start: t0, end: t0, kind: .chat, person: "Alex Example")
        let day = CallFiles.day(t0)
        let folder = URL(fileURLWithPath: "/v", isDirectory: true)
        func number(_ taken: Set<String>) -> Int { CallFiles.callNumber(chat, in: folder, exists: { taken.contains($0.lastPathComponent) }) }
        XCTAssertEqual(number([]), 1)
        // the first call's transcript is saved and its recap agent hasn't written yet: the second call is still 2
        XCTAssertEqual(number(["\(day)_Alex_Example_call_transcript.md"]), 2)
        XCTAssertEqual(number(["\(day)_Alex_Example_coffee_chat_recap.md"]), 2)
        XCTAssertEqual(CallFiles.transcriptName(chat, n: 2), "\(day)_Alex_Example_call_transcript_2.md")
        XCTAssertEqual(CallFiles.recapName(chat, n: 2), "\(day)_Alex_Example_coffee_chat_recap_2.md")
        XCTAssertEqual(CallFiles.recapName(chat), "\(day)_Alex_Example_coffee_chat_recap.md")
    }

    func testPrepSchedule() {
        let cal = Calendar.current
        let morning = cal.date(bySettingHour: 9, minute: 0, second: 0, of: t0)!
        XCTAssertEqual(cal.component(.hour, from: CallPrepSchedule.nextRun(after: morning, hour: 21)), 21)
        XCTAssertTrue(cal.isDate(CallPrepSchedule.nextRun(after: morning, hour: 21), inSameDayAs: morning))
        let late = cal.date(bySettingHour: 22, minute: 0, second: 0, of: t0)!
        XCTAssertFalse(cal.isDate(CallPrepSchedule.nextRun(after: late, hour: 21), inSameDayAs: late))
    }
}
