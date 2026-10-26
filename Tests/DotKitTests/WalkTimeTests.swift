import XCTest
@testable import DotKit

final class WalkTimeTests: XCTestCase {
    func testPhrases() {
        XCTAssertEqual(WalkTime.phrase(seconds: 20), "1 min walk", "under a minute still reads as one")
        XCTAssertEqual(WalkTime.phrase(seconds: 389), "6 min walk")
        XCTAssertEqual(WalkTime.phrase(seconds: 3600), "1 h walk")
        XCTAssertEqual(WalkTime.phrase(seconds: 3900), "1 h 5 min walk")
        XCTAssertEqual(WalkTime.spoken(seconds: 50), "a minute's walk")
        XCTAssertEqual(WalkTime.spoken(seconds: 389), "a 6 minute walk")
        XCTAssertEqual(WalkTime.spoken(seconds: 454), "an 8 minute walk")
        XCTAssertEqual(WalkTime.spoken(seconds: 660), "an 11 minute walk")
        XCTAssertEqual(WalkTime.spoken(seconds: 720), "a 12 minute walk")
    }

    func testOnlyWalkableDistancesAskForARoute() {
        XCTAssertTrue(WalkTime.worthAsking(straightMeters: 640))
        XCTAssertTrue(WalkTime.worthAsking(straightMeters: 3_000))
        XCTAssertFalse(WalkTime.worthAsking(straightMeters: 3_001), "the Loop from Hyde Park is a train, not a walk")
        XCTAssertFalse(WalkTime.worthAsking(straightMeters: -1))
    }
}
