import XCTest
@testable import DotKit

final class JobsMoreTests: XCTestCase {
    func testRetryRules() {
        XCTAssertTrue(JobRetry.canRetry(.failed, endLine: "it broke"))
        XCTAssertTrue(JobRetry.canRetry(.stopped, endLine: ""))
        XCTAssertFalse(JobRetry.canRetry(.done, endLine: "booked the room for 3 pm"))
        XCTAssertFalse(JobRetry.canRetry(.running, endLine: ""))
        XCTAssertTrue(JobRetry.message.contains("continue from where it stopped"))
    }

    func testHowToRoundTripAndKeys() {
        let d = Date(timeIntervalSince1970: 1_793_000_000)
        let book = HowToBook.saving(HowTo(task: "apply to a job", steps: "open /jobs\nclick Apply", saved: d, job: "abc123"), into: [])
        let text = HowToBook.render(key: "wyzant.com", book)
        XCTAssertEqual(HowToBook.parse(text).first?.steps, "open /jobs click Apply")
        XCTAssertEqual(HowToBook.parse(text).first?.job, "abc123")
        XCTAssertEqual(HowToBook.key(site: "https://www.Wyzant.com/tutor/jobs"), "wyzant.com")
        XCTAssertEqual(HowToBook.key(site: "Google Sheets"), "google-sheets")
        XCTAssertEqual(HowToBook.keys(for: "apply to the new jobs on wyzant", url: nil, app: nil, among: ["wyzant.com", "handshake.com"]), ["wyzant.com"])
        XCTAssertEqual(HowToBook.keys(for: "do it", url: "https://app.joinhandshake.com/x", app: nil, among: ["app.joinhandshake.com"]), ["app.joinhandshake.com"])
        XCTAssertEqual(HowToBook.keys(for: "the wyzantish thing", url: nil, app: nil, among: ["wyzant.com"]), [], "whole words only")
    }

    func testHowToReplaceExpireAndFailures() {
        let now = Date(timeIntervalSince1970: 1_793_000_000)
        var book = HowToBook.saving(HowTo(task: "apply", steps: "old way", saved: now.addingTimeInterval(-10), job: "a", failures: 1), into: [])
        book = HowToBook.saving(HowTo(task: "Apply", steps: "new way", saved: now, job: "b"), into: book)
        XCTAssertEqual(book.map(\.steps), ["new way"])
        XCTAssertEqual(book.first?.failures, 0)
        let old = HowTo(task: "old", steps: "x", saved: now.addingTimeInterval(-61 * 86_400), job: "c")
        XCTAssertEqual(HowToBook.live(book + [old], now: now).map(\.task), ["Apply"])
        let twice = HowToBook.failed(["Apply"], in: HowToBook.failed(["Apply"], in: book))
        XCTAssertTrue(HowToBook.live(twice, now: now).isEmpty, "two failures retire it")
        XCTAssertEqual(HowToBook.brief([("wyzant.com", book)]), "[how-to] what worked before (follow it unless the page changed):\nlast time on wyzant.com, Apply: new way (2026-10-26)")
    }

    func testTakeoverOffer() {
        XCTAssertNil(TakeoverOffer.shouldOffer(stepsDone: 1, alreadyOffered: false, driving: false))
        XCTAssertEqual(TakeoverOffer.shouldOffer(stepsDone: 2, alreadyOffered: false, driving: false), .secondStep)
        XCTAssertNil(TakeoverOffer.shouldOffer(stepsDone: 3, alreadyOffered: false, driving: false), "once, at the second step")
        XCTAssertEqual(TakeoverOffer.shouldOffer(stepsDone: 0, said: "ugh I'm lost", alreadyOffered: false, driving: false), .lost)
        XCTAssertEqual(TakeoverOffer.shouldOffer(stepsDone: 1, stalledFor: 21, alreadyOffered: false, driving: false), .stalled)
        XCTAssertNil(TakeoverOffer.shouldOffer(stepsDone: 2, said: "this is taking forever", alreadyOffered: true, driving: false))
        XCTAssertNil(TakeoverOffer.shouldOffer(stepsDone: 2, alreadyOffered: false, driving: true))
    }

    func testEdgeDeck() {
        let visible = CGRect(x: 0, y: 0, width: 1512, height: 944)
        XCTAssertTrue(EdgeDeck.frames(count: 3, visible: visible, side: .corner).isEmpty)
        let right = EdgeDeck.frames(count: 3, visible: visible, side: .right, hovered: 1)
        XCTAssertEqual(right.count, 3)
        XCTAssertEqual(right[0].maxX, 1502)
        XCTAssertEqual(right[1].width, EdgeDeck.wideWidth)
        XCTAssertEqual(right[0].maxY, 934)
        XCTAssertTrue(zip(right, right.dropFirst()).allSatisfy { $0.minY - $1.maxY == EdgeDeck.gap })
        let left = EdgeDeck.frames(count: 20, visible: visible, side: .left)
        XCTAssertEqual(left.count, 6, "only what fits; the rest collapse to chips")
        XCTAssertTrue(left.allSatisfy { visible.contains($0) && $0.minX == 10 })
    }
}
