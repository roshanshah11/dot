import XCTest
@testable import DotKit

final class TurnTimingTests: XCTestCase {
    func testReleaseToFirstSentence() {
        var clock = FirstAudioClock()
        clock.released(at: 100)
        clock.asked(at: 101.2, typed: false)   // the transcript arrives; the wait still counts from the key
        let heard = clock.heard(at: 101.84)
        XCTAssertEqual(heard?.ms, 1840)
        XCTAssertEqual(heard?.from, .release)
        XCTAssertNil(clock.heard(at: 103), "only the first sentence counts")
        XCTAssertEqual(FirstAudioClock.line(ms: 1840, from: .release), "speech: first-audio 1840 ms from release")
    }

    func testTypedStartsAtTheAsk() {
        var clock = FirstAudioClock()
        clock.released(at: 100)
        clock.asked(at: 105, typed: true)
        XCTAssertEqual(clock.heard(at: 106.5)?.from, .ask)
    }

    func testSpokenWithoutAKeyStartsAtTheAsk() {
        var clock = FirstAudioClock()
        clock.asked(at: 50, typed: false)
        XCTAssertEqual(clock.heard(at: 50.9)?.ms, 900)
        clock.released(at: 10)
        clock.asked(at: 80, typed: false)   // a release from 70 s ago is another turn's
        XCTAssertEqual(clock.heard(at: 81)?.from, .ask)
    }

    func testQuietAndStaleTurnsLogNothing() {
        var clock = FirstAudioClock()
        clock.released(at: 100)
        clock.cancel()
        XCTAssertNil(clock.heard(at: 101))
        clock.released(at: 100)
        XCTAssertNil(clock.heard(at: 100 + FirstAudioClock.stale + 1), "a quip a minute later isn't the answer")
        XCTAssertNil(clock.started, "and it doesn't wait around for another")
        clock.released(at: 100)
        XCTAssertNil(clock.heard(at: 99), "a sentence that started before the key came up is the old answer")
    }

    func testRingToRing() {
        var rings = RingClock()
        XCTAssertNil(rings.ringShown(at: 10, step: 1), "the first ring has nothing before it")
        rings.stepDone(at: 20, how: "clicked")
        XCTAssertEqual(rings.ringShown(at: 22.75, step: 2), "walkthrough: ring-to-ring 2750 ms (step 2, clicked)")
        XCTAssertNil(rings.ringShown(at: 23, step: 2), "once per finished step")
        rings.stepDone(at: 30, how: "rested on")
        rings.reset()
        XCTAssertNil(rings.ringShown(at: 31, step: 3))
        rings.stepDone(at: 40, how: "clicked")
        XCTAssertNil(rings.ringShown(at: 40 + RingClock.stale + 1, step: 4))
    }
}
