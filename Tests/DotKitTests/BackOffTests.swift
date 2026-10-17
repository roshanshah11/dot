import XCTest
@testable import DotKit

/// Phase 3's backing off: soft declines, retirement, and an item that waits for its context to change.
final class BackOffTests: XCTestCase {
    func testSoftDeclinesCountHalf() {
        XCTAssertEqual(BackOff.Tally(soft: 1).declines, 0)
        XCTAssertEqual(BackOff.Tally(soft: 2).declines, 1)
        XCTAssertEqual(BackOff.Tally(soft: 5).declines, 2)
        XCTAssertEqual(BackOff.Tally(no: 1, soft: 3).declines, 2)
    }

    func testRetirement() {
        XCTAssertFalse(BackOff.Tally(no: 2).retired)
        XCTAssertTrue(BackOff.Tally(no: 3).retired, "three no's, as before")
        XCTAssertFalse(BackOff.Tally(soft: 5).retired, "five ignored offers are two and a half declines")
        XCTAssertTrue(BackOff.Tally(soft: 6).retired, "six ignored offers retire a kind")
        XCTAssertTrue(BackOff.Tally(no: 2, soft: 2).retired)
        XCTAssertFalse(BackOff.Tally(yes: 1, no: 5, soft: 9).retired, "one yes keeps a kind for good")
    }

    func testAnOfferTimesOutAfterTheReplyWindow() {
        let offered = Date(timeIntervalSince1970: 1_000_000)
        let pending = BackOff.Pending(kind: "gist", at: offered)
        XCTAssertFalse(pending.expired(at: offered.addingTimeInterval(44)))
        XCTAssertTrue(pending.expired(at: offered.addingTimeInterval(BackOff.replyWindow)))
    }

    func testAtlasLinesSplitIntoItemAndDueDate() {
        let item = BackOff.item("2026-10-17 Northwind Bank Sophomore Showcase application due 11:59 PM ET: short essays")
        XCTAssertEqual(item.due, "2026-10-17")
        XCTAssertEqual(item.id, String("Northwind Bank Sophomore Showcase application due 11:59 PM ET: short essays".prefix(60)))
        let moved = BackOff.item("2026-10-20 Northwind Bank Sophomore Showcase application due 11:59 PM ET: short essays")
        XCTAssertEqual(moved.id, item.id, "a moved deadline is the same item")
        XCTAssertNotEqual(moved.due, item.due)
        let commitment = BackOff.item("send Alex the deck by friday")
        XCTAssertEqual(commitment.due, "")
        XCTAssertEqual(commitment.id, "send Alex the deck by friday")
    }

    func testTheSameItemWaitsForItsContextToChange() {
        let id = "centerview coffee chats"
        let first = Date(timeIntervalSince1970: 2_000_000)
        let outlook = BackOff.Context(due: "2026-10-17", app: "com.microsoft.Outlook")
        XCTAssertTrue(BackOff.mayNotice(id, in: outlook, now: first, seen: [:]), "the first time")
        let seen = [id: BackOff.Seen(context: outlook, at: first)]
        // Same app, same due date: not again, however long it has been.
        XCTAssertFalse(BackOff.mayNotice(id, in: outlook, now: first.addingTimeInterval(60), seen: seen))
        XCTAssertFalse(BackOff.mayNotice(id, in: outlook, now: first.addingTimeInterval(30 * 3600), seen: seen))
        // Another app re-offers it, after the four hours Noticer already kept between notices of one item.
        let comet = BackOff.Context(due: "2026-10-17", app: "ai.perplexity.comet")
        XCTAssertFalse(BackOff.mayNotice(id, in: comet, now: first.addingTimeInterval(3600), seen: seen))
        XCTAssertTrue(BackOff.mayNotice(id, in: comet, now: first.addingTimeInterval(BackOff.itemGap), seen: seen))
        // A due date that moved is news: re-offered at once, even in the same app.
        let moved = BackOff.Context(due: "2026-10-19", app: "com.microsoft.Outlook")
        XCTAssertTrue(BackOff.mayNotice(id, in: moved, now: first.addingTimeInterval(60), seen: seen))
        // Other items are unaffected.
        XCTAssertTrue(BackOff.mayNotice("citi application", in: outlook, now: first.addingTimeInterval(60), seen: seen))
    }
}
