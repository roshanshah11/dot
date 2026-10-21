import AppKit
import DotKit
import Foundation

/// `Dot --notch-selftest`: a typed answer through a real NotchHUD window off every display, the way a muted or typed
/// turn runs (the first sentence streams in, then the whole answer replaces it). Every line of an answer that fits in
/// 300 pt must show, with nothing left behind the scroll view (10-21 10:20: one line of three showed, and the
/// snapshot harness, which draws answers as plain text on a tall canvas, never saw it). It touches no running Dot.
@MainActor
enum NotchSelfTest {
    static let question = "whats on the schedule today"
    static let answer = "this morning is light: the COURSE 101 email to Sam Rivera by five, the Alex Example text, and the "
        + "Northwind Bank sign-up by five. the problem set is at eleven thirty. then it gets dense: interview prep at twelve "
        + "thirty-five, the Northwind Bank zoom at one thirty, and the coffee chat at three thirty."

    static func run() -> Bool {
        let activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiated, .latencyCritical], reason: "notch selftest")
        defer { ProcessInfo.processInfo.endActivity(activity) }
        var failures: [String] = []
        func check(_ ok: Bool, _ what: String) { print("\(ok ? "pass" : "FAIL"): \(what)"); if !ok { failures.append(what) } }

        for (name, streamed) in [("one line streamed first", 1), ("two lines streamed first", 2), ("nothing streamed", 0)] {
            let hud = NotchHUD(accentHex: DotConfig.peek().pointerColorHex)
            hud.geometryOverride = { NotchGeometry(centerX: -30_000, topY: -29_000, notchWidth: 185, notchHeight: 32, hasNotch: true) }
            hud.setVisibleInRecordings(false)
            hud.model.talkOnly = true
            hud.model.presence = true
            hud.model.transcript = question
            hud.set(phase: .thinking)
            if streamed > 0 {
                let sentences = answer.components(separatedBy: ". ")
                hud.model.response = sentences.prefix(streamed).joined(separator: ". ") + "."
            }
            spin(0.6)
            hud.presentAnswer(question: question, text: answer)
            spin(1.2)
            let hidden = hud.hiddenScrolledHeight
            let frame = hud.windowFrame
            check(frame != nil, "\(name): the notch is up")
            check(hidden < 1, String(format: "\(name): the whole answer shows (%.0f pt out of sight, window %.0f pt tall)", hidden, frame?.height ?? 0))
            hud.dismissAnswer()
            spin(0.2)
        }
        print(failures.isEmpty ? "notch selftest: all passed" : "notch selftest: \(failures.count) failed")
        return failures.isEmpty
    }

    private static func spin(_ seconds: Double) {
        let until = Date().addingTimeInterval(seconds)
        while Date() < until {
            while let event = NSApp.nextEvent(matching: .any, until: Date(timeIntervalSinceNow: 0.01), inMode: .default, dequeue: true) {
                NSApp.sendEvent(event)
            }
            RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.02))
        }
    }
}
