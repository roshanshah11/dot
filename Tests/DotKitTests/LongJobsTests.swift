import XCTest
@testable import DotKit

/// 07: watch routines with a time window, Notify, watch words, unfinished agents, the idle close, quips.
final class LongJobsTests: XCTestCase {
    private let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "America/Chicago")!
        return c
    }()

    private func at(_ text: String) -> Date {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd HH:mm"; f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = calendar.timeZone
        return f.date(from: text)!
    }

    // MARK: The routine window

    func testTheWindowParses() throws {
        let between = try XCTUnwrap(RoutineSchedule.parse("every 2 hours between 9 am and midnight"))
        XCTAssertEqual(between.kind, .hours)
        XCTAssertEqual(between.everyHours, 2)
        XCTAssertEqual(between.fromHour, 9)
        XCTAssertEqual(between.untilHour, 24, "midnight is 24 as the end")
        XCTAssertEqual(between.words, "every 2 hours, 9 am to midnight")
        XCTAssertEqual(RoutineSchedule.parse("every 2 hours from 9 am to midnight"), between)
        let dash = try XCTUnwrap(RoutineSchedule.parse("every 2 h, 9-5"))
        XCTAssertEqual(dash.everyHours, 2)
        XCTAssertEqual([dash.fromHour, dash.untilHour], [9, 17], "9-5 is 9 am to 5 pm")
        let noon = try XCTUnwrap(RoutineSchedule.parse("every 3 hours from noon to 9 pm"))
        XCTAssertEqual([noon.fromHour, noon.untilHour], [12, 21])
        XCTAssertEqual(noon.words, "every 3 hours, noon to 9 pm")
        XCTAssertEqual(RoutineSchedule.parse("every 2 h")?.everyHours, 2, "\"every 2 h\" was nil before 07")
        XCTAssertEqual(RoutineSchedule.parse("every 2h")?.everyHours, 2)
        XCTAssertNil(RoutineSchedule.parse("every 2 hours")?.window, "no window: around the clock, as before")
        XCTAssertEqual(RoutineSchedule.parse("every 2 hours")?.words, "every 2 hours")
        XCTAssertEqual(RoutineSchedule.parse("hourly from 8 am to 6 pm")?.window?.from, 8)
        XCTAssertEqual(RoutineSchedule.parse("every two hours from nine to midnight")?.window?.until, 24)
        // The other kinds are untouched.
        XCTAssertEqual(RoutineSchedule.parse("every weekday at 9:30 am")?.kind, .weekdays)
        XCTAssertEqual(RoutineSchedule.parse("hourly")?.everyHours, 1)
    }

    func testRunsFallOnTheGridAndNeverOutsideIt() throws {
        let s = try XCTUnwrap(RoutineSchedule.parse("every 2 hours between 9 am and midnight"))
        // The 10-20 probe: after 22:30 the old schedule ran at 00:30, 02:30 and 04:30.
        XCTAssertEqual(s.next(after: at("2026-10-19 22:30"), calendar: calendar), at("2026-10-19 23:00"))
        XCTAssertEqual(s.next(after: at("2026-10-19 23:00"), calendar: calendar), at("2026-10-20 09:00"), "then the next day's start")
        XCTAssertEqual(s.next(after: at("2026-10-20 03:00"), calendar: calendar), at("2026-10-20 09:00"))
        XCTAssertEqual(s.next(after: at("2026-10-20 09:00"), calendar: calendar), at("2026-10-20 11:00"))
        XCTAssertEqual(s.next(after: at("2026-10-20 10:15"), calendar: calendar), at("2026-10-20 11:00"))
        var run = at("2026-10-20 08:00")
        var hours: [Int] = []
        for _ in 0..<10 {
            run = s.next(after: run, calendar: calendar)
            hours.append(calendar.component(.hour, from: run))
        }
        XCTAssertEqual(hours, [9, 11, 13, 15, 17, 19, 21, 23, 9, 11])
    }

    func testAWindowEndingAtMidnightOnTheGridAndOneCrossingIt() throws {
        let three = try XCTUnwrap(RoutineSchedule.parse("every 3 hours from 9 am to midnight"))
        XCTAssertEqual(three.next(after: at("2026-10-20 21:00"), calendar: calendar), at("2026-10-21 00:00"), "the end is in the window")
        XCTAssertEqual(three.next(after: at("2026-10-21 00:00"), calendar: calendar), at("2026-10-21 09:00"))
        let late = try XCTUnwrap(RoutineSchedule.parse("every 2 hours from 10 pm to 2 am"))
        XCTAssertEqual([late.fromHour, late.untilHour], [22, 2])
        XCTAssertEqual(late.next(after: at("2026-10-20 23:00"), calendar: calendar), at("2026-10-21 00:00"))
        XCTAssertEqual(late.next(after: at("2026-10-21 02:00"), calendar: calendar), at("2026-10-21 22:00"))
    }

    func testDueAfterSleepRunsOnceThenKeepsTheGrid() {
        let schedule = RoutineSchedule.parse("every 2 hours from 9 am to midnight")!
        var routine = Routine(agent: "inbox", agentName: "Inbox Keeper", brief: "check outlook for Sam Rivera", schedule: schedule, now: at("2026-10-20 09:00"),
                              runFirstNow: false, mode: .watch)
        routine.nextRun = at("2026-10-20 11:00")
        var book = RoutineBook(routines: [routine])
        // The Mac slept from 10:30 to 15:40: one run on waking, then back on the grid.
        XCTAssertEqual(book.due(at: at("2026-10-20 15:40")).map(\.id), [routine.id])
        book.markStarted(routine.id, at: at("2026-10-20 15:40"))
        XCTAssertEqual(book.routines[0].nextRun, at("2026-10-20 17:00"))
        XCTAssertTrue(book.due(at: at("2026-10-20 16:59")).isEmpty)
    }

    func testAnOldRoutinesFileDecodesUnchanged() throws {
        let old = #"{"routines":[{"id":"r1","agent":"email","agentName":"Email","brief":"draft the replies","schedule":{"kind":"hours","hour":9,"minute":0,"everyHours":3},"paused":false,"created":"2026-10-16T14:00:00Z","nextRun":"2026-10-20T15:00:00Z","failures":0}]}"#
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("routines-old-\(UUID().uuidString).json")
        try old.data(using: .utf8)!.write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }
        let book = RoutineBook.load(from: url)
        XCTAssertEqual(book.routines.count, 1)
        let r = book.routines[0]
        XCTAssertNil(r.mode)
        XCTAssertEqual(r.runMode, .report)
        XCTAssertNil(r.schedule.window)
        XCTAssertEqual(r.schedule.words, "every 3 hours")
        XCTAssertEqual(r.schedule.next(after: at("2026-10-20 10:00"), calendar: calendar), at("2026-10-20 13:00"), "around the clock, as before")
        // And a new file keeps its window and mode.
        var fresh = r
        fresh.mode = .watch
        fresh.schedule = RoutineSchedule.parse("every 2 hours from 9 am to midnight")!
        let url2 = FileManager.default.temporaryDirectory.appendingPathComponent("routines-new-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url2) }
        try RoutineBook(routines: [fresh]).save(to: url2)
        XCTAssertEqual(RoutineBook.load(from: url2).routines.first, fresh)
    }

    func testTheModeReachesTheRoutineFromBothPlaces() throws {
        // From talk's tag: the brief's "watch:" prefix.
        XCTAssertEqual(RoutineMode.split(brief: "watch: anything from Sam Rivera in outlook").mode, .watch)
        // From an agent's Routine: line.
        let line = #"{"action":"create","title":"Sam Rivera watch","when":"every 2 hours from 9 am to midnight","task":"check outlook for anything from Sam Rivera","mode":"watch"}"#
        let command = try XCTUnwrap(RoutineCommand.parse(json: line))
        XCTAssertEqual(command.mode, .watch)
        var book = RoutineBook()
        guard case .created(let made) = book.apply(command, agent: "inbox", agentName: "Inbox Keeper", now: at("2026-10-20 10:00")) else { return XCTFail() }
        XCTAssertEqual(made.mode, .watch)
        XCTAssertEqual(made.schedule.words, "every 2 hours, 9 am to midnight")
        XCTAssertEqual(made.nextRun, at("2026-10-20 11:00"))
        // An update may change only the mode.
        let switchBack = try XCTUnwrap(RoutineCommand.parse(json: #"{"action":"update","title":"Sam Rivera watch","mode":"report"}"#))
        guard case .updated(let changed) = book.apply(switchBack, agent: "inbox", agentName: "Inbox Keeper") else { return XCTFail() }
        XCTAssertEqual(changed.mode, .report)
        XCTAssertNil(RoutineCommand.parse(json: #"{"action":"create","title":"x","when":"daily at 9","task":"y"}"#)?.mode, "no mode: a report routine")
        XCTAssertTrue(RoutineCommand.howTo.contains(#""mode":"report|watch""#))
    }

    func testTheNotifyLine() {
        let quiet = AgentResult.parse("Nothing new from Sam Rivera since the last run.\n\nNotify: no")
        XCTAssertEqual(quiet.notify, false)
        XCTAssertEqual(quiet.body, "Nothing new from Sam Rivera since the last run.")
        let needs = AgentResult.parse("Sam Rivera replied about the COURSE 101 study group and asked for a time.\n\nNotify: yes\nDone: Reply from Sam Rivera")
        XCTAssertEqual(needs.notify, true)
        XCTAssertEqual(needs.doneTitle, "Reply from Sam Rivera")
        XCTAssertEqual(AgentResult.parse("**Notify:** Yes.").notify, true)
        XCTAssertNil(AgentResult.parse("Checked the page.").notify, "missing: a watch run takes it as no")
        XCTAssertNil(AgentResult.parse("Checked the page.\nNotify: maybe").notify)
        XCTAssertNil(AgentResult.parse("Notify: yes\nThen I looked again and it was fine.").notify, "only the closing block counts")
    }

    // MARK: Watch words (I F16)

    func testWatchWords() {
        for yes in ["keep an eye on my outlook for anything from Sam Rivera", "tell me when COURSE 101 grades get posted",
                    "let me know as soon as Northwind replies", "can you watch my inbox for anything from Alex Example",
                    "monitor the Northwind Bank careers page", "tell me if anything comes in from Sam Rivera",
                    "ping me whenever the COURSE 101 page changes", "let me know if the posting ever opens", "watch for new listings on example.com"] {
            XCTAssertTrue(WatchWords.isWatch(yes), yes)
        }
        for no in ["watch this video", "show me the watch", "monitor brightness", "check my mail and tell me if sam wrote back",
                   "tell me if this sounds right", "let me know when you're done", "what time is it", "watch this", "can you watch the game with me",
                   "open my outlook", "tell me about Northwind Bank"] {
            XCTAssertFalse(WatchWords.isWatch(no), no)
        }
    }

    // MARK: Unfinished

    func testPromisesLater() {
        // A placeholder version of the 10-14 call-prep line.
        let callPrep = "I'm still working on your call prep for Sam Rivera. Two research passes, one on Northwind Bank and one on the team, are still running. The question list goes into your output folder as soon as they come back."
        XCTAssertTrue(AgentRecovery.promisesLater(callPrep))
        XCTAssertTrue(AgentRecovery.promisesLater("The download is still running; I will check back in a few minutes."))
        XCTAssertTrue(AgentRecovery.promisesLater("I'll let you know when Alex Example replies."))
        XCTAssertTrue(AgentRecovery.promisesLater("The summary lands in output once the searches are done."))
        for done in ["Done, the COURSE 101 summary is on your desktop.", "I checked the example.com page; nothing new since monday.",
                     "When the form is done, click Submit yourself.", "Reply as soon as you can.", "Drafted the reply to Sam Rivera; it's in your drafts.",
                     "The Northwind Bank posting is still open; it closes friday."] {
            XCTAssertFalse(AgentRecovery.promisesLater(done), done)
        }
    }

    // MARK: The idle close, on a fake session (the bench never spawns a real agent)

    func testTheIdleCloseOnAFakeSession() {
        // readings-fetch, 10-19: a brief at 0 s, two follow-ups mid-turn at 13 s and 27 s, one result at 127 s.
        let t0 = at("2026-10-19 21:45")
        var pending = 0
        var lastEvent = t0
        var lastResult: Date?
        func send(_ s: TimeInterval) { pending += 1; lastEvent = t0.addingTimeInterval(s) }
        func result(_ s: TimeInterval) { pending = max(pending - 1, 0); lastEvent = t0.addingTimeInterval(s); lastResult = lastEvent }
        send(0); send(13); send(27); result(127)
        XCTAssertEqual(pending, 2, "the count the session kept: it read as working forever")
        XCTAssertFalse(AgentIdle.folded(pendingResults: pending, lastResultAt: lastResult, lastEventAt: lastEvent, now: t0.addingTimeInterval(127 + 60)),
                       "a queued message's own turn may still start")
        XCTAssertTrue(AgentIdle.folded(pendingResults: pending, lastResultAt: lastResult, lastEventAt: lastEvent, now: t0.addingTimeInterval(127 + 90)),
                      "nothing after the result: the follow-ups were folded into it")
        // With the count settled the 15 minute timer closes it.
        XCTAssertEqual(AgentIdle.verdict(working: false, waitingOnCard: false, idleSince: lastEvent, now: t0.addingTimeInterval(127 + 900), idleMinutes: 15), .close)
        // A message queued behind the turn starts its own turn: an event after the result, never folded.
        lastEvent = t0.addingTimeInterval(130)
        XCTAssertFalse(AgentIdle.folded(pendingResults: pending, lastResultAt: lastResult, lastEventAt: lastEvent, now: t0.addingTimeInterval(1000)))
        XCTAssertFalse(AgentIdle.folded(pendingResults: 0, lastResultAt: lastResult, lastEventAt: t0, now: t0.addingTimeInterval(1000)))
    }

    func testTheIdleTimerNeverGivesUp() {
        let t0 = at("2026-10-20 10:00")
        XCTAssertEqual(AgentIdle.verdict(working: true, waitingOnCard: false, idleSince: t0, now: t0.addingTimeInterval(900), idleMinutes: 15), .wait(900),
                       "working: look again later (it used to return for good)")
        XCTAssertEqual(AgentIdle.verdict(working: false, waitingOnCard: true, idleSince: t0, now: t0.addingTimeInterval(900), idleMinutes: 15), .wait(900))
        XCTAssertEqual(AgentIdle.verdict(working: false, waitingOnCard: false, idleSince: t0, now: t0.addingTimeInterval(600), idleMinutes: 15), .wait(300),
                       "a message 10 minutes ago: 5 more")
        XCTAssertEqual(AgentIdle.verdict(working: false, waitingOnCard: false, idleSince: t0, now: t0.addingTimeInterval(899.5), idleMinutes: 15), .close)
        XCTAssertEqual(AgentIdle.verdict(working: false, waitingOnCard: false, idleSince: t0, now: t0.addingTimeInterval(60), idleMinutes: 0), .close, "at least a minute")
    }

    // MARK: Quips

    func testANotShownQuipGivesBackItsSlot() {
        let before = Date(timeIntervalSince1970: 1_800_000_000)
        var history = QuipHistory()
        history.lastAt = before.addingTimeInterval(-3600)
        let tried = Quips.attempted(.lateNight, now: before, history: history, calendar: calendar)
        XCTAssertFalse(Quips.allows(.lateNight, now: before.addingTimeInterval(120), chattiness: 2, history: tried, calendar: calendar))
        let back = Quips.abandoned(.lateNight, before: history, current: tried)
        XCTAssertEqual(back.lastAt, history.lastAt, "the cooldown is given back")
        XCTAssertNil(back.days[QuipSituation.lateNight.rawValue], "and the once-a-day slot")
        let event = "2026-10-20 course 101 midterm"
        let triedEvent = Quips.attempted(.upcoming, now: before, history: history, event: event, calendar: calendar)
        XCTAssertNil(Quips.abandoned(.upcoming, before: history, current: triedEvent, event: event).events[event], "and the event's once")
    }

    func testWhichGateClosed() {
        XCTAssertNil(Quips.closedGate(cooldownOn: true, secondsSinceKey: 10, onCall: false, busy: false, reduceMotion: false, offerUp: false))
        XCTAssertEqual(Quips.closedGate(cooldownOn: true, secondsSinceKey: 0.5, onCall: false, busy: false, reduceMotion: false, offerUp: false), "typing")
        XCTAssertEqual(Quips.closedGate(cooldownOn: true, secondsSinceKey: 10, onCall: false, busy: false, reduceMotion: false, offerUp: true), "an offer is up")
        XCTAssertEqual(Quips.closedGate(cooldownOn: true, secondsSinceKey: 10, onCall: true, busy: true, reduceMotion: false, offerUp: false), "on a call")
        XCTAssertEqual(Quips.closedGate(cooldownOn: false, secondsSinceKey: 10, onCall: false, busy: false, reduceMotion: false, offerUp: false), "chattiness is 0")
    }

    private func brief(date: String, today: [String] = [], tomorrow: [String] = [], deadlines: [String] = []) -> TodayBrief {
        let object: [String: Any] = ["date": date, "today": today, "tomorrow": tomorrow, "deadlines": deadlines]
        return TodayBrief.parse(try! JSONSerialization.data(withJSONObject: object))!
    }

    func testAnUntimedMidtermTakesTheExamsStart() throws {
        // Placeholder versions of the 10-19 brief: the Canvas item has no time, the calendar has the exam, and another
        // section's item is dated the next day.
        let b = brief(date: "2026-10-19", today: ["Mon 10-19 10:30\u{2013}11:20 COURSE 101 Midterm (I)"],
                      deadlines: ["2026-10-19 COURSE 101: Section 41: Midterm Exam (I) (Canvas)", "2026-10-20 COURSE 101: Section 40: Midterm Exam (I) (Canvas)",
                                  "2026-10-19 Northwind Bank application"])
        let events = Upcoming.events(in: b, calendar: calendar)
        let midterm = try XCTUnwrap(events.first { $0.title.contains("Section 41") })
        XCTAssertTrue(midterm.timed)
        XCTAssertEqual(midterm.start, at("2026-10-19 10:30"), "the exam's own start")
        // The two times of the 10-19 probe, when the old rule said "due today" and the quips kept coming.
        for now in [at("2026-10-19 22:56"), at("2026-10-19 23:36")] {
            XCTAssertNil(Upcoming.relevant(to: .backShort, in: events, now: now, calendar: calendar), "nothing is next after 18:00")
            XCTAssertNil(Upcoming.relevant(to: .deadlineToday, in: events, now: now, calendar: calendar))
            XCTAssertFalse(Upcoming.dueToday(events, now: now, calendar: calendar))
        }
        // Before the exam it is the next thing, timed.
        XCTAssertEqual(Upcoming.relevant(to: .backShort, in: events, now: at("2026-10-19 09:00"), calendar: calendar)?.start, at("2026-10-19 10:30"))
        XCTAssertEqual(Upcoming.relevant(to: .deadlineToday, in: events, now: at("2026-10-19 09:00"), calendar: calendar)?.title, midterm.title)
        // An untimed deadline that names no exam stays due today until 18:00.
        XCTAssertTrue(Upcoming.dueToday(events, now: at("2026-10-19 12:00"), calendar: calendar))
        XCTAssertEqual(Upcoming.relevant(to: .deadlineToday, in: events, now: at("2026-10-19 12:00"), calendar: calendar)?.title, "Northwind Bank application")
        XCTAssertFalse(Upcoming.dueToday(events, now: at("2026-10-19 18:00"), calendar: calendar))
    }

    func testAnUntimedExamWithNoMatchingEventStaysUntimed() throws {
        let b = brief(date: "2026-10-19", today: ["Mon 10-19 09:00\u{2013}09:50 COURSE 202 lecture"], deadlines: ["2026-10-19 COURSE 101: Quiz 4"])
        let quiz = try XCTUnwrap(Upcoming.events(in: b, calendar: calendar).first { $0.isDeadline })
        XCTAssertFalse(quiz.timed, "another course's event does not count")
        XCTAssertEqual(Upcoming.courseCodes(in: "COURSE 101: Section 41: Midterm Exam (I) (Canvas)"), ["COURSE101"])
    }
}
