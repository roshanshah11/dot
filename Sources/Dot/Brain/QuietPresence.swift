import AppKit
import DotKit

/// Is a Focus on (parity S1)? Control Center's record of its Focus item, then the item in the window list (FocusSignal
/// says why both); cached for two seconds like CallPresence (the callers poll).
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
        let answer = FocusSignal.isOn(StepAside.liveWindows(), preferences: preferences())
        if answer != lastAnswer { Log.info("focus: \(answer ? "a Focus is on; Dot stays quiet" : "Focus off")") }
        lastAnswer = answer
        return answer
    }

    /// Control Center's Focus keys, read fresh (another app's preferences are cached until synchronized).
    static func preferences() -> [String: Any] {
        let domain = FocusSignal.preferenceDomain as CFString
        CFPreferencesAppSynchronize(domain)
        var out: [String: Any] = [:]
        for key in FocusSignal.preferenceKeys {
            if let value = CFPreferencesCopyAppValue(key as CFString, domain) { out[key] = value }
        }
        return out
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
