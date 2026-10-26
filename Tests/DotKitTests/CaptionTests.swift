import XCTest
@testable import DotKit

final class CaptionTests: XCTestCase {
    func testWordsStartAtTheirCharacterShare() {
        let words = CaptionTiming.words("Discount rate  is ten")
        XCTAssertEqual(words.map(\.word), ["Discount", "rate", "is", "ten"])
        // 8 + 1 + 4 + 1 + 2 + 1 + 3 = 20 characters, one space between words
        XCTAssertEqual(words.map(\.start), [0, 9.0 / 20, 14.0 / 20, 17.0 / 20])
    }

    func testWordsLightInTurnAndAllByTheEnd() {
        let starts = CaptionTiming.words("one two three four").map(\.start)
        XCTAssertEqual(CaptionTiming.lit(starts, elapsed: -0.1, duration: 2), 0)
        XCTAssertEqual(CaptionTiming.lit(starts, elapsed: 0, duration: 2), 1)
        XCTAssertEqual(CaptionTiming.lit(starts, elapsed: 0.6, duration: 2), 2)
        XCTAssertEqual(CaptionTiming.lit(starts, elapsed: 2 * CaptionTiming.spokenShare, duration: 2), 4)
        XCTAssertEqual(CaptionTiming.lit(starts, elapsed: 0.1, duration: 0), 4)
    }

    func testEmptyAndEstimate() {
        XCTAssertTrue(CaptionTiming.words("   ").isEmpty)
        XCTAssertEqual(CaptionTiming.estimate("hi"), 0.8)
        XCTAssertEqual(CaptionTiming.estimate(String(repeating: "a", count: 100)), 6.5, accuracy: 1e-9)
    }
}
