import XCTest
@testable import DotKit

final class TutorLogTests: XCTestCase {
    private let t0 = ISO8601DateFormatter().date(from: "2026-10-20T15:00:00Z")!
    private func hours(_ h: Double) -> Date { t0.addingTimeInterval(h * 3600) }

    private func tempStore() -> TutorStore {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("tutor-\(UUID().uuidString)", isDirectory: true)
        addTeardownBlock { try? FileManager.default.removeItem(at: dir) }
        return TutorStore(root: dir)
    }

    // MARK: Tags

    func testTagsParse() {
        let parsed = TagParser.parse("not quite. [MISS:math20250:rank-nullity | dim of the codomain | the theorem counts dim V, the domain]")
        XCTAssertEqual(parsed.spoken.trimmingCharacters(in: .whitespaces), "not quite.")
        XCTAssertEqual(parsed.tags, [.tutor(.miss(subject: "math20250", idea: "rank-nullity", said: "dim of the codomain", gap: "the theorem counts dim V, the domain"))])
        XCTAssertEqual(TagParser.parse("yes. [GOT:m4k2]").tags, [.tutor(.got(id: "m4k2"))])
        XCTAssertEqual(TagParser.parse("[MISS:M4K2]").tags, [.tutor(.missAgain(id: "m4k2"))])
        XCTAssertEqual(TagParser.parse("[STYLE:MATH 20250:\"just show me the figure\"]").tags, [.tutor(.style(subject: "math20250", words: "just show me the figure"))])
        XCTAssertEqual(TagParser.parse("[STYLE:ib technicals:slower please]").tags, [.tutor(.style(subject: "ib-technicals", words: "slower please"))])
    }

    func testAMissWithNoSubjectKeepsTheIdeaWhole() {
        XCTAssertEqual(TutorMark.parse(kind: "MISS", payload: "wacc weights | book values | use market values"),
                       .miss(subject: nil, idea: "wacc weights", said: "book values", gap: "use market values"))
        XCTAssertEqual(TutorMark.parse(kind: "MISS", payload: "kernel"), .miss(subject: nil, idea: "kernel", said: "", gap: ""))
        XCTAssertNil(TutorMark.parse(kind: "MISS", payload: "  "))
        XCTAssertNil(TutorMark.parse(kind: "GOT", payload: "the kernel"))
        XCTAssertFalse(DotTag.tutor(.got(id: "m4k2")).isVisual)
    }

    func testSlug() {
        XCTAssertEqual(TutorLog.slug("MATH 20250"), "math20250")
        XCTAssertEqual(TutorLog.slug("bios11140"), "bios11140")
        XCTAssertEqual(TutorLog.slug("IB technicals"), "ib-technicals")
    }

    // MARK: The schedule

    func testAMissIsDueTheNextDay() {
        let (misses, _) = TutorLog.fold([TutorEvent(kind: .miss, at: t0, id: "m001", idea: "kernel")], subject: "math20250")
        XCTAssertEqual(misses.count, 1)
        XCTAssertFalse(misses[0].isDue(now: hours(2)))
        XCTAssertTrue(misses[0].isDue(now: hours(24)))
    }

    func testTheRetryAfterAHintMovesNothing() {
        let events = [TutorEvent(kind: .miss, at: t0, id: "m001", idea: "kernel"), TutorEvent(kind: .got, at: hours(0.1), id: "m001")]
        let m = TutorLog.fold(events, subject: "x").misses[0]
        XCTAssertEqual(m.streak, 0)
        XCTAssertEqual(m.due, t0.addingTimeInterval(86400))
    }

    func testTwoRightAnswersOnDifferentDaysResolveIt() {
        var events = [TutorEvent(kind: .miss, at: t0, id: "m001", idea: "kernel"), TutorEvent(kind: .got, at: hours(24), id: "m001")]
        var m = TutorLog.fold(events, subject: "x").misses[0]
        XCTAssertEqual(m.streak, 1)
        XCTAssertEqual(m.due, hours(24 + 72))
        XCTAssertFalse(m.resolved)
        // a second right answer the same day does not count
        events.append(TutorEvent(kind: .got, at: hours(25), id: "m001"))
        XCTAssertFalse(TutorLog.fold(events, subject: "x").misses[0].resolved)
        events.append(TutorEvent(kind: .got, at: hours(96), id: "m001"))
        m = TutorLog.fold(events, subject: "x").misses[0]
        XCTAssertTrue(m.resolved)
        XCTAssertFalse(m.isDue(now: hours(200)))
    }

    func testMissingItAgainStartsOver() {
        let events = [TutorEvent(kind: .miss, at: t0, id: "m001", idea: "kernel"), TutorEvent(kind: .got, at: hours(24), id: "m001"),
                      TutorEvent(kind: .miss, at: hours(96), id: "m001")]
        let m = TutorLog.fold(events, subject: "x").misses[0]
        XCTAssertEqual(m.times, 2)
        XCTAssertEqual(m.streak, 0)
        XCTAssertEqual(m.due, hours(96 + 24))
        XCTAssertEqual(m.idea, "kernel")
    }

    // MARK: The block and the card

    func testTheBlockPutsDueMissesFirstAndQuotesHim() {
        let events = [TutorEvent(kind: .miss, at: t0, id: "m001", idea: "kernel", said: "the outputs", gap: "it is the inputs sent to zero"),
                      TutorEvent(kind: .miss, at: hours(30), id: "m002", idea: "basis"),
                      TutorEvent(kind: .style, at: hours(31), id: "", said: "just show me the figure")]
        let (misses, styles) = TutorLog.fold(events, subject: "math20250")
        let lines = TutorLog.block(label: "MATH 20250", misses: misses, styles: styles, now: hours(32))
        XCTAssertTrue(lines[0].hasPrefix("[his misses] MATH 20250"))
        XCTAssertTrue(lines[1].hasPrefix("- m001 (due)"), lines[1])
        XCTAssertTrue(lines[1].contains("he said: \"the outputs\"; off: it is the inputs sent to zero"))
        XCTAssertTrue(lines[2].hasPrefix("- m002 (due "), lines[2])
        XCTAssertTrue(lines.contains { $0.contains("\"just show me the figure\"") })
        XCTAssertEqual(lines.last, "[/his misses]")
        XCTAssertEqual(TutorLog.block(label: "X", misses: [], styles: [], now: t0), [])
    }

    func testMorningLine() {
        XCTAssertNil(TutorLog.morningLine(due: [("MATH 20250", 0)]))
        XCTAssertEqual(TutorLog.morningLine(due: [("MATH 20250", 1)]), "review 1 miss due in math 20250")
        XCTAssertEqual(TutorLog.morningLine(due: [("MATH 20250", 2), ("ib technicals", 1)]), "review 3 misses due: 2 in math 20250, 1 in ib technicals")
    }

    func testAsksForPractice() {
        XCTAssertTrue(TutorLog.asksForPractice("Quiz me on chapter two"))
        XCTAssertTrue(TutorLog.asksForPractice("can you drill me on dcf"))
        XCTAssertTrue(TutorLog.asksForPractice("what did I get wrong last time?"))
        XCTAssertFalse(TutorLog.asksForPractice("what is the kernel of this map"))
    }

    // MARK: The store

    func testTheStoreRecordsAndResolvesBySubject() throws {
        let store = tempStore()
        XCTAssertTrue(store.record(.miss(subject: "math20250", idea: "kernel", said: "the outputs", gap: "inputs"), subject: nil, asked: "", now: t0).hasPrefix("miss m"))
        let id = try XCTUnwrap(store.state("math20250").misses.first?.id)
        // the same idea again is that miss again, not a second one
        XCTAssertTrue(store.record(.miss(subject: nil, idea: "Kernel", said: "", gap: ""), subject: "math20250", asked: "", now: hours(1)).hasPrefix("missed again"))
        XCTAssertEqual(store.state("math20250").misses.count, 1)
        XCTAssertEqual(store.state("math20250").misses[0].times, 2)
        XCTAssertEqual(store.record(.got(id: id), subject: nil, asked: "", now: hours(30)), "got: \(id) in math20250")
        XCTAssertEqual(store.record(.got(id: "mzzz"), subject: nil, asked: "", now: hours(30)), "no miss mzzz")
        XCTAssertEqual(store.subjects(), ["math20250"])
    }

    func testAStyleMustBeHisWords() {
        let store = tempStore()
        XCTAssertTrue(store.record(.style(subject: "math20250", words: "slower"), subject: nil, asked: "go slower please", now: t0).hasPrefix("style refused") == false)
        XCTAssertTrue(store.record(.style(subject: "math20250", words: "he likes figures"), subject: nil, asked: "ok next one", now: t0).hasPrefix("style refused"))
        XCTAssertEqual(store.state("math20250").styles.map(\.words), ["slower"])
    }

    func testNewIDAvoidsTaken() {
        var calls: [UInt32] = [0, 0, 1]
        let id = TutorLog.newID(taken: ["m000"], random: { calls.removeFirst() })
        XCTAssertEqual(id, "m001")
        XCTAssertTrue(TutorLog.isID(id))
    }
}
