import XCTest
@testable import DotKit

final class BargeInTests: XCTestCase {
    /// Frames every 20 ms from `from` to `to` at a mic and far-end level.
    private func run(_ d: inout BargeDetector, from: TimeInterval, to: TimeInterval, mic: Float, farEnd: Float = 0) {
        var t = from
        while t < to { d.frame(mic: mic, farEnd: farEnd, at: t); t += 0.02 }
    }

    func testTwoRealWordsOverSustainedSoundBarge() {
        var d = BargeDetector()
        run(&d, from: 0, to: 0.4, mic: 0.08)
        XCTAssertEqual(d.verdict(heard: "wait stop", dotSaying: "the dividend discount model values a share"), .barge(words: "wait stop"))
    }

    func testACoughIsNotABarge() {
        var d = BargeDetector()
        run(&d, from: 0, to: 0.12, mic: 0.2)        // a burst shorter than the sustain
        run(&d, from: 0.12, to: 0.6, mic: 0.003)
        XCTAssertEqual(d.verdict(heard: "hmm", dotSaying: "x"), .quiet)
        var e = BargeDetector()
        run(&e, from: 0, to: 0.5, mic: 0.08)       // long enough, but only fillers
        XCTAssertEqual(e.verdict(heard: "uh hmm", dotSaying: "x"), .sound)
        XCTAssertEqual(e.verdict(heard: "a", dotSaying: "x"), .sound)
    }

    func testDotsOwnEchoIsRejected() {
        var d = BargeDetector()
        // Dot plays loud; what leaks past the canceller (8% of its level at worst, measured) stays under the gate
        run(&d, from: 0, to: 1.0, mic: 0.024, farEnd: 0.3)
        XCTAssertEqual(d.verdict(heard: "values a share", dotSaying: "the dividend discount model values a share"), .quiet)
        // loud enough to pass the gate, but the words are Dot's own sentence
        var e = BargeDetector()
        run(&e, from: 0, to: 0.5, mic: 0.2, farEnd: 0.3)
        XCTAssertEqual(e.verdict(heard: "discount model values", dotSaying: "the dividend discount model values a share"), .echo)
        // his words over Dot's voice still cut it off
        XCTAssertEqual(e.verdict(heard: "no stop that", dotSaying: "the dividend discount model values a share"), .barge(words: "no stop that"))
    }

    func testSpeechWithSyllableGapsHoldsTheStretch() {
        // "one, two, three" over Dot: 120 ms syllables with 80 ms dips, frames every 20 ms
        var d = BargeDetector()
        var t: TimeInterval = 0
        for _ in 0..<3 {
            run(&d, from: t, to: t + 0.12, mic: 0.06, farEnd: 0.1)
            run(&d, from: t + 0.12, to: t + 0.2, mic: 0.004, farEnd: 0.1)
            t += 0.2
        }
        XCTAssertEqual(d.verdict(heard: "one two three", dotSaying: "the terminal value"), .barge(words: "one two three"))
        // a dip longer than the gap ends it: two bursts 300 ms apart never add up
        var e = BargeDetector()
        run(&e, from: 0, to: 0.15, mic: 0.06)
        run(&e, from: 0.15, to: 0.45, mic: 0.003)
        run(&e, from: 0.45, to: 0.6, mic: 0.06)
        run(&e, from: 0.6, to: 0.8, mic: 0.003)
        XCTAssertEqual(e.verdict(heard: "one two", dotSaying: ""), .quiet)
    }

    func testLoudStretchIsRememberedThenForgotten() {
        var d = BargeDetector()
        run(&d, from: 0, to: 0.4, mic: 0.08)
        run(&d, from: 0.4, to: 1.2, mic: 0.002)
        XCTAssertEqual(d.verdict(heard: "hold on", dotSaying: ""), .barge(words: "hold on"), "the words arrive after the sound")
        run(&d, from: 1.2, to: 2.2, mic: 0.002)
        XCTAssertEqual(d.verdict(heard: "hold on", dotSaying: ""), .quiet)
    }

    func testRouteTable() {
        func plan(_ output: BargeRoute.Output, lid: Bool = false, call: Bool = false, lecture: Bool = false,
                  probe: BargeRoute.Probe? = .passed, btMic: Bool = false, enabled: Bool = true) -> BargeRoute.Plan {
            BargeRoute.plan(enabled: enabled, output: output, lidClosed: lid, onCall: call, lecture: lecture, probe: probe, inputIsBluetooth: btMic)
        }
        XCTAssertEqual(plan(.builtIn), .listen(mic: .systemDefault))
        XCTAssertEqual(plan(.wired), .listen(mic: .systemDefault))
        XCTAssertEqual(plan(.bluetooth), .listen(mic: .builtIn))
        XCTAssertEqual(plan(.bluetooth, lid: true), .off("bluetooth out with the lid shut: no built-in mic to listen on"))
        XCTAssertEqual(plan(.bluetooth, probe: nil), .off("bluetooth not tested yet: run Dot --barge-selftest --talk with it connected"),
                       "an untested headset is never probed in ordinary use")
        XCTAssertEqual(BargeRoute.plan(enabled: true, output: .bluetooth, lidClosed: false, onCall: false, lecture: false, probe: nil,
                                       inputIsBluetooth: false, selfTest: true), .probe(mic: .builtIn), "only the self-test probes it")
        XCTAssertEqual(plan(.builtIn, probe: nil), .probe(mic: .systemDefault), "wired and built-in outputs still probe on first use")
        XCTAssertEqual(plan(.bluetooth, probe: .failed), .off("voice processing changed this output when it was probed"))
        XCTAssertEqual(plan(.builtIn, btMic: true), .listen(mic: .builtIn))
        if case .off = plan(.builtIn, lid: true, btMic: true) {} else { XCTFail("a bluetooth-only mic with the lid shut is off") }
        if case .off = plan(.airplay) {} else { XCTFail("airplay is off") }
        if case .off = plan(.display) {} else { XCTFail("display audio is off") }
        XCTAssertEqual(plan(.builtIn, call: true), .off("on a call"))
        XCTAssertEqual(plan(.builtIn, lecture: true), .off("in lecture mode"))
        XCTAssertEqual(plan(.builtIn, enabled: false), .off("talk over dot is off"))
    }

    func testSnapshotChanges() {
        let a2dp = RouteSnapshot(deviceID: 71, transport: "bluetooth", nominalRate: 48000, channels: 2, format: "lpcm 48000 2ch f32")
        XCTAssertEqual(a2dp.changes(to: a2dp), [])
        var hfp = a2dp
        hfp.nominalRate = 16000
        hfp.channels = 1
        hfp.format = "lpcm 16000 1ch f32"
        XCTAssertEqual(a2dp.changes(to: hfp), ["rate 48000 to 16000", "channels 2 to 1", "format lpcm 48000 2ch f32 to lpcm 16000 1ch f32"])
    }

    func testRouteMemoryRoundTrip() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("barge-\(UUID().uuidString).json")
        var m = BargeRouteMemory()
        m.results["BuiltInSpeakerDevice"] = .passed
        m.results["AA-BB-CC:output"] = .failed
        m.save(url)
        XCTAssertEqual(BargeRouteMemory.load(url), m)
        try? FileManager.default.removeItem(at: url)
    }

    func testMergeKeepsTheWordsAlreadyHeard() {
        XCTAssertEqual(BargeDetector.merge(heard: "wait stop", recorded: "what does that mean"), "wait stop what does that mean")
        XCTAssertEqual(BargeDetector.merge(heard: "wait stop", recorded: "stop what does that mean"), "wait stop what does that mean")
        XCTAssertEqual(BargeDetector.merge(heard: "hold on", recorded: "hold on is that right"), "hold on is that right")
        XCTAssertEqual(BargeDetector.merge(heard: "", recorded: "go back"), "go back")
        XCTAssertEqual(BargeDetector.merge(heard: "no stop", recorded: ""), "no stop")
    }
}
