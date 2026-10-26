import AppKit
import DotKit

/// Is a Focus on (parity S1)? The menu bar's Focus item, read off the window list and cached for two seconds like
/// CallPresence (the callers poll).
@MainActor
enum FocusPresence {
    private static var lastCheck = Date.distantPast
    private static var lastAnswer = false
    /// Set by the self-test.
    static var override: Bool?

    static func isOn() -> Bool {
        if let override { return override }
        if Date().timeIntervalSince(lastCheck) < 2 { return lastAnswer }
        lastCheck = Date()
        let answer = FocusSignal.isOn(StepAside.liveWindows())
        if answer != lastAnswer { Log.info("focus: \(answer ? "a Focus is on; Dot stays quiet" : "Focus off")") }
        lastAnswer = answer
        return answer
    }
}

/// One answer to "should Dot keep its voice and chimes down right now": on a call (quietOnCalls) or in a Focus
/// (quietInFocus). Spoken replies to his own asks don't ask this; results he didn't just wait for, offers, notices,
/// chimes and jobs' end lines do.
@MainActor
enum Quiet {
    static func now(_ config: DotConfig) -> Bool {
        (config.quietOnCalls && CallPresence.isOnCall()) || (config.quietInFocus && FocusPresence.isOn())
    }
}
