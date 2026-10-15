import AppKit
import Foundation

/// Is he on a call or sharing his screen? HeyClicky holds its morning card and goes quiet when
/// another app has the microphone (observed 2026-10-15: a recorder holding the mic kept its card
/// back). Dot reads the same signal from CoreAudio and adds the meeting apps it can see.
@MainActor
enum CallPresence {
    static let meetingBundles: Set<String> = [
        "us.zoom.xos", "com.microsoft.teams2", "com.microsoft.teams", "com.apple.FaceTime", "com.cisco.webexmeetingsapp",
        "com.webex.meetingmanager", "com.google.meet", "com.tinyspeck.slackmacgap", "com.hnc.Discord", "com.loom.desktop",
    ]
    static let meetingTitles = try! NSRegularExpression(pattern: #"(?i)\b(meet\.google\.com|zoom meeting|teams meeting|webex|google meet|\bmeeting\b.*\bjoin)"#)

    private static var lastCheck = Date.distantPast
    private static var lastAnswer = false
    private static var ownMicUse: () -> Bool = { false }

    /// Dot's own recorder sets this so its own microphone use does not count as a call.
    static func setOwnMicrophoneCheck(_ check: @escaping () -> Bool) { ownMicUse = check }

    /// Cached for two seconds; the CoreAudio read is cheap but the callers poll.
    static func isOnCall() -> Bool {
        if Date().timeIntervalSince(lastCheck) < 2 { return lastAnswer }
        lastCheck = Date()
        var answer = false
        if !ownMicUse(), AudioDevices.microphoneInUseElsewhere() { answer = true }
        if !answer, let front = NSWorkspace.shared.frontmostApplication?.bundleIdentifier, meetingBundles.contains(front) { answer = true }
        if !answer {
            let title = AccessibilityContext.capture(maxElements: 0, timeBudget: 0.05).windowTitle ?? ""
            if meetingTitles.firstMatch(in: title, range: NSRange(location: 0, length: (title as NSString).length)) != nil { answer = true }
        }
        if answer != lastAnswer { Log.info("call presence: \(answer ? "on a call" : "off the call")") }
        lastAnswer = answer
        return answer
    }
}
