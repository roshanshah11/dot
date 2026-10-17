import XCTest
@testable import DotKit

/// Phase 3's chattiness setting: Lumière's volume control, mapped onto the knobs that already exist.
final class ChattinessTests: XCTestCase {
    func testChattinessMapsOntoTheExistingKnobs() {
        let quiet = Chattiness(0)
        XCTAssertFalse(quiet.notices)
        XCTAssertFalse(quiet.offers)
        XCTAssertNil(quiet.quipCooldown)
        XCTAssertFalse(quiet.speaksUnprompted)

        let low = Chattiness(1)
        XCTAssertTrue(low.notices, "1 keeps deadline notices")
        XCTAssertFalse(low.offers, "and only those")
        XCTAssertEqual(low.cooldown(minutes: 20), 3 * 20 * 60)
        XCTAssertEqual(low.quipCooldown, 2 * 3600)

        let normal = Chattiness(Chattiness.defaultLevel)
        XCTAssertEqual(normal.level, 2)
        XCTAssertTrue(normal.notices && normal.offers)
        XCTAssertEqual(normal.cooldown(minutes: 20), 20 * 60, "2 is today's behavior")
        XCTAssertEqual(normal.cooldown(minutes: 10), 10 * 60)
        XCTAssertEqual(normal.quipCooldown, 40 * 60)

        let chatty = Chattiness(3)
        XCTAssertTrue(chatty.notices && chatty.offers)
        XCTAssertEqual(chatty.cooldown(minutes: 20), 10 * 60)
        XCTAssertEqual(chatty.quipCooldown, 20 * 60)

        XCTAssertEqual(Chattiness(-1), quiet)
        XCTAssertEqual(Chattiness(7), chatty)
    }
}
