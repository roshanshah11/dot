import XCTest
@testable import DotKit

/// Phase 3's quips: one cheeky line at a break, bubble only, never twice in a week.
final class QuipsTests: XCTestCase {
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

    /// A fixed generator, so a run picks the same lines every time.
    private struct Seeded: RandomNumberGenerator {
        var state: UInt64
        mutating func next() -> UInt64 {
            state = state &* 6364136223846793005 &+ 1442695040888963407
            return state
        }
    }

    private func pick(_ situation: QuipSituation, _ now: Date, chattiness: Int = 2, _ history: QuipHistory = QuipHistory()) -> (line: String, history: QuipHistory)? {
        var generator = Seeded(state: 7)
        return Quips.pick(situation, now: now, chattiness: chattiness, history: history, calendar: calendar, using: &generator)
    }

    func testEverySituationHasItsLines() {
        XCTAssertEqual(Set(Quips.lines.keys), Set(QuipSituation.allCases))
        XCTAssertEqual(QuipSituation.allCases.map(\.rawValue),
                       ["backShort", "backLong", "morning", "lateNight", "sameAppRepeat", "agentDone", "agentFailed", "deadlineToday", "petted"])
        for situation in QuipSituation.allCases {
            let lines = Quips.lines[situation] ?? []
            XCTAssertGreaterThanOrEqual(lines.count, 8, situation.rawValue)
            XCTAssertEqual(Set(lines).count, lines.count, "a repeated line in \(situation.rawValue)")
        }
        // His four example lines are in the bank.
        let all = Quips.lines.values.flatMap { $0 }
        for line in ["oh good, you're up. the deadlines missed you.", "third time's the charm?", "done. you're welcome, as usual.", "put it on my tab."] {
            XCTAssertTrue(all.contains(line), line)
        }
        XCTAssertEqual(Set(all).count, all.count, "a line in two situations would share its no-repeat stamp")
    }

    func testLinesAreShortLowercaseAndPlain() {
        for (situation, lines) in Quips.lines {
            for line in lines {
                XCTAssertLessThanOrEqual(line.count, Quips.maxLength, "\(situation.rawValue): \(line)")
                XCTAssertEqual(line, line.lowercased(), line)
                XCTAssertFalse(line.contains("\u{2014}") || line.contains("\u{2013}"), "no dashes as punctuation: \(line)")
                XCTAssertEqual(line, line.trimmingCharacters(in: .whitespaces), line)
            }
        }
    }

    func testTheBankNeverTeasesHim() {
        // It teases the work. Grades, people, money, looks and guilt are off limits (docs/persona.md).
        let banned = try! NSRegularExpression(pattern: #"(?i)\b(grade|gpa|midterm score|roommate|girlfriend|boyfriend|mom|dad|money|broke|bank account|rent|face|hair|ugly|lazy you|you forgot|you never|you left me|ignored me|lonely|sad without)\b"#)
        for line in Quips.lines.values.flatMap({ $0 }) {
            XCTAssertNil(banned.firstMatch(in: line, range: NSRange(location: 0, length: (line as NSString).length)), line)
        }
    }

    func testCooldownFollowsChattiness() throws {
        let start = at("2026-10-17 14:00")
        let first = try XCTUnwrap(pick(.agentDone, start))
        XCTAssertEqual(first.history.lastAt, start)
        XCTAssertNotNil(first.history.shown[first.line])
        // Default (2): forty minutes.
        XCTAssertNil(pick(.petted, start.addingTimeInterval(39 * 60), first.history))
        XCTAssertNotNil(pick(.petted, start.addingTimeInterval(40 * 60), first.history))
        // 1: two hours. 3: twenty minutes.
        XCTAssertNil(pick(.petted, start.addingTimeInterval(119 * 60), chattiness: 1, first.history))
        XCTAssertNotNil(pick(.petted, start.addingTimeInterval(120 * 60), chattiness: 1, first.history))
        XCTAssertNil(pick(.petted, start.addingTimeInterval(19 * 60), chattiness: 3, first.history))
        XCTAssertNotNil(pick(.petted, start.addingTimeInterval(20 * 60), chattiness: 3, first.history))
        // A stamp from the future (the clock was set back) does not silence Dot.
        XCTAssertNotNil(pick(.petted, start.addingTimeInterval(-3600), first.history))
    }

    func testChattinessZeroNeverQuips() {
        for situation in QuipSituation.allCases {
            XCTAssertNil(pick(situation, at("2026-10-17 14:00"), chattiness: 0), situation.rawValue)
        }
        XCTAssertNil(pick(.agentDone, at("2026-10-17 14:00"), chattiness: -4), "below the range clamps to 0")
        XCTAssertNotNil(pick(.agentDone, at("2026-10-17 14:00"), chattiness: 9), "above the range clamps to 3")
    }

    func testNoLineRepeatsWithinSevenDays() throws {
        var history = QuipHistory()
        var now = at("2026-10-17 09:00")
        var seen: [String] = []
        let count = Quips.lines[.agentDone]!.count
        for _ in 0..<count {
            let result = try XCTUnwrap(pick(.agentDone, now, history))
            XCTAssertFalse(seen.contains(result.line), "\(result.line) came back inside the week")
            seen.append(result.line)
            history = result.history
            now = now.addingTimeInterval(41 * 60)
        }
        XCTAssertEqual(Set(seen).count, count)
        // Every line used this week: quiet, not a repeat.
        XCTAssertNil(pick(.agentDone, now, history))
        // Seven days after the first showing, that line is free again, and only that one.
        let week = at("2026-10-24 09:00")
        let again = try XCTUnwrap(pick(.agentDone, week, history))
        XCTAssertEqual(again.line, seen[0])
        // Stamps older than the window are dropped, so the saved history stays small.
        let later = try XCTUnwrap(pick(.petted, at("2026-11-30 09:00"), again.history))
        XCTAssertEqual(later.history.shown.count, 1)
    }

    func testHistoryRoundTripsAndOldDataDecodes() throws {
        let result = try XCTUnwrap(pick(.morning, at("2026-10-17 08:00")))
        let data = try JSONEncoder().encode(result.history)
        XCTAssertEqual(try JSONDecoder().decode(QuipHistory.self, from: data), result.history)
        XCTAssertEqual(try JSONDecoder().decode(QuipHistory.self, from: Data("{}".utf8)), QuipHistory())
    }

    func testMorningIsTheFirstSightOnceADay() throws {
        var history = Quips.sawBreak(at: at("2026-10-17 07:50"), history: QuipHistory(), calendar: calendar)
        XCTAssertEqual(Quips.timeOfDay(now: at("2026-10-17 07:50"), history: history, calendar: calendar), .morning)
        XCTAssertEqual(Quips.refine(.backLong, now: at("2026-10-17 07:50"), history: history, calendar: calendar), .morning)
        // Within half an hour of the first sight it still counts (a key held at the first break blocks it).
        history = Quips.sawBreak(at: at("2026-10-17 08:10"), history: history, calendar: calendar)
        XCTAssertEqual(history.morningSince, at("2026-10-17 07:50"))
        XCTAssertEqual(Quips.timeOfDay(now: at("2026-10-17 08:10"), history: history, calendar: calendar), .morning)
        // Hours into the morning it is no longer first sight.
        XCTAssertNil(Quips.timeOfDay(now: at("2026-10-17 10:30"), history: history, calendar: calendar))
        XCTAssertEqual(Quips.refine(.backShort, now: at("2026-10-17 10:30"), history: history, calendar: calendar), .backShort)
        // Once shown, not again that day; the next morning is new.
        let shown = try XCTUnwrap(pick(.morning, at("2026-10-17 08:10"), history))
        XCTAssertNil(Quips.timeOfDay(now: at("2026-10-17 08:15"), history: shown.history, calendar: calendar))
        XCTAssertNil(pick(.morning, at("2026-10-17 11:00"), shown.history))
        let tomorrow = Quips.sawBreak(at: at("2026-10-18 07:00"), history: shown.history, calendar: calendar)
        XCTAssertEqual(Quips.timeOfDay(now: at("2026-10-18 07:00"), history: tomorrow, calendar: calendar), .morning)
    }

    func testLateNightAfterOneOnceANight() throws {
        XCTAssertNil(Quips.timeOfDay(now: at("2026-10-17 00:40"), history: QuipHistory(), calendar: calendar))
        XCTAssertEqual(Quips.timeOfDay(now: at("2026-10-18 01:10"), history: QuipHistory(), calendar: calendar), .lateNight)
        XCTAssertEqual(Quips.refine(.backShort, now: at("2026-10-18 01:10"), history: QuipHistory(), calendar: calendar), .lateNight)
        let shown = try XCTUnwrap(pick(.lateNight, at("2026-10-18 01:10")))
        XCTAssertNil(Quips.timeOfDay(now: at("2026-10-18 03:00"), history: shown.history, calendar: calendar))
        XCTAssertNil(Quips.timeOfDay(now: at("2026-10-17 15:00"), history: QuipHistory(), calendar: calendar))
        // Events keep their own situation at any hour.
        XCTAssertEqual(Quips.refine(.agentDone, now: at("2026-10-18 01:10"), history: QuipHistory(), calendar: calendar), .agentDone)
    }

    func testDeadlineTodayOnceADay() throws {
        let first = try XCTUnwrap(pick(.deadlineToday, at("2026-10-17 13:00")))
        XCTAssertNil(pick(.deadlineToday, at("2026-10-17 16:00"), first.history))
        XCTAssertNotNil(pick(.deadlineToday, at("2026-10-18 13:00"), first.history))
    }

    func testFifthSwitchToTheSameAppWithinTenMinutes() {
        var count = SwitchCount()
        let start = at("2026-10-17 14:00")
        for minute in 0..<4 {
            XCTAssertFalse(count.switched(to: "com.microsoft.Excel", at: start.addingTimeInterval(Double(minute) * 60)))
            XCTAssertFalse(count.switched(to: "ai.perplexity.comet", at: start.addingTimeInterval(Double(minute) * 60 + 10)))
        }
        XCTAssertTrue(count.switched(to: "com.microsoft.Excel", at: start.addingTimeInterval(4 * 60)))
        // The count starts over after it fires.
        XCTAssertFalse(count.switched(to: "com.microsoft.Excel", at: start.addingTimeInterval(5 * 60)))
        // Five spread over more than ten minutes is not a repeat.
        var slow = SwitchCount()
        for minute in [0, 3, 6, 9] { XCTAssertFalse(slow.switched(to: "com.apple.Preview", at: start.addingTimeInterval(Double(minute) * 60))) }
        XCTAssertFalse(slow.switched(to: "com.apple.Preview", at: start.addingTimeInterval(12 * 60)))
    }
}
