import XCTest
@testable import DotKit

final class AgentSuggestionsTests: XCTestCase {
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    func day(_ n: Double) -> Date { now.addingTimeInterval(-n * 86400) }

    /// Five Handshake checks, three DCF explains on different topics, two calendar asks, one old Handshake check.
    var fixture: [AgentSuggestions.Ask] {
        [
            .init(at: day(1), text: "check handshake for new postings"),
            .init(at: day(3), text: "can you check Handshake postings again"),
            .init(at: day(5), text: "any new handshake postings for banking"),
            .init(at: day(8), text: "check my handshake postings"),
            .init(at: day(12), text: "Handshake postings, anything new?"),
            .init(at: day(20), text: "check handshake postings"),          // outside the 14 days
            .init(at: day(2), text: "explain the terminal value in a dcf"),
            .init(at: day(4), text: "explain what wacc means"),
            .init(at: day(6), text: "explain this graph"),
            .init(at: day(2), text: "what's on my calendar tomorrow"),
            .init(at: day(9), text: "what's on my calendar friday"),
        ]
    }

    func testRepeatedAskBecomesASuggestion() {
        let found = AgentSuggestions.sweep(asks: fixture, owned: ["Dot"], dismissed: [:], now: now)
        XCTAssertEqual(found.count, 1, found.map(\.key).description)
        let s = found[0]
        XCTAssertEqual(s.count, 5)
        XCTAssertEqual(s.key, "handshake post")
        XCTAssertEqual(s.example, "check handshake for new postings")
        XCTAssertEqual(s.line, "You asked me to check handshake for new postings 5 times in two weeks. Start an agent for it?")
        XCTAssertEqual(s.examples.count, 3)
        XCTAssertTrue(s.brief.contains("- can you check Handshake postings again"))
        XCTAssertEqual(s.name, "Handshake Postings")
    }

    func testTeachingAndOnScreenAsksAreNotAgentWork() {
        let asks: [AgentSuggestions.Ask] = [
            .init(at: day(1), text: "walk me through how this works"), .init(at: day(2), text: "walk me through how this works again"),
            .init(at: day(3), text: "can you walk me through how this one works"),
            .init(at: day(1), text: "put it on the board please"), .init(at: day(2), text: "put that on the board"), .init(at: day(3), text: "put it on my board"),
            .init(at: day(1), text: "turn my bluetooth back on"), .init(at: day(2), text: "turn my bluetooth on"), .init(at: day(3), text: "turn bluetooth back on"),
            .init(at: day(1), text: "he answered \"q1\" on the panel with B"), .init(at: day(2), text: "he answered \"q2\" on the panel with B"),
            .init(at: day(3), text: "he answered \"q3\" on the panel with B"),
            .init(at: day(1), text: "lecture notes on vector spaces", kind: "lecture"), .init(at: day(2), text: "lecture notes on vector spaces", kind: "lecture"),
            .init(at: day(3), text: "lecture notes on vector spaces", kind: "lecture"),
        ]
        XCTAssertTrue(AgentSuggestions.sweep(asks: asks, owned: [], dismissed: [:], now: now).isEmpty)
        // one ask retried three times in a minute is not a habit
        let burst: [AgentSuggestions.Ask] = (0..<3).map { .init(at: now.addingTimeInterval(Double(-$0 * 20)), text: "download the canvas files into my downloads folder") }
        XCTAssertTrue(AgentSuggestions.sweep(asks: burst, owned: [], dismissed: [:], now: now).isEmpty)
        // asks that became jobs are work even without a work verb
        let jobs: [AgentSuggestions.Ask] = (1...3).map { .init(at: day(Double($0)), text: "canvas readings for biology this week", kind: "job") }
        XCTAssertEqual(AgentSuggestions.sweep(asks: jobs, owned: [], dismissed: [:], now: now).count, 1)
    }

    func testAnOwnedPatternIsNotSuggested() {
        let owned = ["Posting Watch\nWatches Handshake postings for banking roles and reports new ones."]
        XCTAssertTrue(AgentSuggestions.sweep(asks: fixture, owned: owned, dismissed: [:], now: now).isEmpty)
    }

    func testNotNowHoldsThirtyDays() {
        XCTAssertTrue(AgentSuggestions.sweep(asks: fixture, owned: [], dismissed: ["handshake post": day(10)], now: now).isEmpty)
        XCTAssertEqual(AgentSuggestions.sweep(asks: fixture, owned: [], dismissed: ["handshake post": day(31)], now: now).count, 1)
    }

    func testWordsAndStems() {
        XCTAssertEqual(AgentSuggestions.words("Can you check my Handshake postings?"), ["check", "handshake", "post"])
        XCTAssertEqual(AgentSuggestions.words("explain this"), [])
        XCTAssertEqual(AgentSuggestions.stem("replies"), "reply")
    }

    func testAsksFromTranscriptLines() {
        let jsonl = """
        {"kind":"typed","ts":"2026-10-15T16:28:11Z","you":"","dot":"x"}
        {"you":"explain how dna replication works","ts":"2026-10-15T17:08:28Z","kind":"typed"}
        not json
        {"you":"check handshake","ts":"bad date"}
        """
        let asks = AgentSuggestions.asks(jsonl: jsonl)
        XCTAssertEqual(asks.map(\.text), ["explain how dna replication works"])
    }

    func testSweepIsDueSundayEveningWeekly() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/Chicago")!
        let sunday7pm = cal.date(from: DateComponents(year: 2026, month: 11, day: 1, hour: 19))!
        let sunday3pm = cal.date(from: DateComponents(year: 2026, month: 11, day: 1, hour: 15))!
        XCTAssertTrue(AgentSuggestions.isDue(lastSweep: nil, now: sunday7pm, calendar: cal))
        XCTAssertFalse(AgentSuggestions.isDue(lastSweep: nil, now: sunday3pm, calendar: cal))
        XCTAssertFalse(AgentSuggestions.isDue(lastSweep: sunday7pm.addingTimeInterval(-3600), now: sunday7pm, calendar: cal), "once a week")
        XCTAssertTrue(AgentSuggestions.isDue(lastSweep: sunday7pm.addingTimeInterval(-7 * 86400), now: sunday7pm, calendar: cal))
        XCTAssertTrue(AgentSuggestions.isDue(lastSweep: sunday3pm.addingTimeInterval(-9 * 86400), now: sunday3pm, calendar: cal), "a missed Sunday catches up")
    }
}
