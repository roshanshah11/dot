import Foundation

/// What macOS has granted, per executable it holds responsible (parity ON-01, ON-03). Only grants with a real status
/// probe get a state; the rest say "check manually". A report is `[key: state]` so the agent host can send its own
/// over its socket: keys `microphone`, `screen`, `accessibility`, `calendar`, `fullDisk`, `files`, `automation:<bundle>`.
public enum PermissionState: String, Equatable, CaseIterable {
    case granted
    /// Denied, or never asked where macOS can't tell the two apart (Screen Recording, Accessibility).
    case missing
    case notAsked
    /// Calendar's write-only access.
    case partial
    case unknown

    public var word: String {
        switch self {
        case .granted: return "allowed"
        case .missing: return "not allowed"
        case .notAsked: return "not asked yet"
        case .partial: return "partly"
        case .unknown: return "check manually"
        }
    }
}

public struct PermissionRow: Equatable, Identifiable {
    public let id: String
    public let title: String
    public let state: PermissionState
    public let why: String
    /// The Privacy & Security anchor (x-apple.systempreferences:com.apple.preference.security?<pane>).
    public let pane: String?
    /// Settings needs the app dragged (or added with +) into the list when it isn't there.
    public let drag: Bool
    public let note: String?

    public init(id: String, title: String, state: PermissionState, why: String, pane: String?, drag: Bool = false, note: String? = nil) {
        self.id = id; self.title = title; self.state = state; self.why = why; self.pane = pane; self.drag = drag; self.note = note
    }
}

/// One executable macOS holds responsible, and its rows.
public struct PermissionHolder: Equatable, Identifiable {
    public let id: String
    public let name: String
    /// What it runs ("talk, jobs and Dot's own agents").
    public let runs: String
    public let executable: String
    public let rows: [PermissionRow]
    /// Why the rows may be missing ("not running", "an older host").
    public let note: String?

    public init(id: String, name: String, runs: String, executable: String, rows: [PermissionRow], note: String? = nil) {
        self.id = id; self.name = name; self.runs = runs; self.executable = executable; self.rows = rows; self.note = note
    }

    public var missing: [PermissionRow] { rows.filter { $0.state == .missing || $0.state == .notAsked } }
}

public enum PermissionGuide {
    /// The apps Dot sends Apple events to (MacSettings, SpotifyControls).
    public static let automationTargets: [(bundle: String, name: String, why: String)] = [
        ("com.apple.systemevents", "System Events", "dark mode and the other Mac settings you ask for"),
        ("com.spotify.client", "Spotify", "playing, pausing and picking music in Spotify"),
    ]

    // MARK: Probe results to states

    /// AVAuthorizationStatus: 0 not determined, 1 restricted, 2 denied, 3 authorized.
    public static func av(_ raw: Int) -> PermissionState {
        switch raw { case 3: return .granted; case 0: return .notAsked; case 1, 2: return .missing; default: return .unknown }
    }

    /// EKAuthorizationStatus: 0 not determined, 1 restricted, 2 denied, 3 full access, 4 write only.
    public static func calendar(_ raw: Int) -> PermissionState {
        switch raw { case 3: return .granted; case 4: return .partial; case 0: return .notAsked; case 1, 2: return .missing; default: return .unknown }
    }

    /// AEDeterminePermissionToAutomateTarget: noErr, errAEEventNotPermitted (-1743), errAEEventWouldRequireUserConsent
    /// (-1744); procNotFound (-600) means the app isn't running, so nothing can be told.
    public static func automation(_ status: Int32) -> PermissionState {
        switch status { case 0: return .granted; case -1743: return .missing; case -1744: return .notAsked; default: return .unknown }
    }

    /// Full Disk Access from opening a file only it opens (TCC.db): the errno, or 0 when it opened.
    public static func fullDisk(errno: Int32) -> PermissionState {
        switch errno { case 0: return .granted; case EPERM, EACCES: return .missing; default: return .unknown }
    }

    // MARK: Rows

    /// A report as rows, in the order Settings shows them. `forAgents` is the agent host: the same probes, its own why.
    public static func rows(_ report: [String: String], forAgents: Bool = false) -> [PermissionRow] {
        func state(_ key: String) -> PermissionState { report[key].flatMap(PermissionState.init(rawValue:)) ?? .unknown }
        var rows = [
            PermissionRow(id: "microphone", title: "Microphone", state: state("microphone"),
                          why: forAgents ? "agents that record or listen" : "hearing you while you hold the chord", pane: "Privacy_Microphone"),
            PermissionRow(id: "screen", title: "Screen Recording", state: state("screen"),
                          why: forAgents ? "agents that look at your screen" : "seeing your screen when you ask about it",
                          pane: "Privacy_ScreenCapture", drag: true,
                          note: state("screen") == .missing ? "macOS doesn't say whether it was refused or never asked" : nil),
            PermissionRow(id: "accessibility", title: "Accessibility", state: state("accessibility"),
                          why: forAgents ? "agents that read or press things in other apps" : "the hotkeys, the field you dictate into, typing and clicking",
                          pane: "Privacy_Accessibility", drag: true),
            PermissionRow(id: "calendar", title: "Calendar", state: state("calendar"),
                          why: "this Mac's calendar, for what's on today", pane: "Privacy_Calendars"),
            PermissionRow(id: "fullDisk", title: "Full Disk Access", state: state("fullDisk"),
                          why: forAgents ? "agents reading Messages, Mail and other apps' data" : "reading Messages and files outside Dot's folders",
                          pane: "Privacy_AllFiles", drag: true),
        ]
        let files = state("fullDisk") == .granted ? PermissionState.granted : .unknown
        rows.append(PermissionRow(id: "files", title: "Desktop, Documents, Downloads", state: files, why: "files you point it at",
                                  pane: "Privacy_FilesAndFolders",
                                  note: files == .granted ? "covered by Full Disk Access" : "macOS gives no status without asking; look in Files and Folders"))
        for target in automationTargets {
            let key = "automation:\(target.bundle)"
            let s = state(key)
            rows.append(PermissionRow(id: key, title: "Automation: \(target.name)", state: s, why: target.why, pane: "Privacy_Automation",
                                      note: s == .unknown ? "\(target.name) isn't running or didn't answer; open it and check again" : nil))
        }
        return rows
    }

    /// cua-driver's own `permissions status --json` (it answers for its daemon, com.trycua.driver).
    public static func cuaRows(_ json: [String: Any]?) -> [PermissionRow] {
        func state(_ key: String) -> PermissionState {
            guard let json, let value = json[key] as? Bool else { return .unknown }
            return value ? .granted : .missing
        }
        return [
            PermissionRow(id: "cua.accessibility", title: "Accessibility", state: state("accessibility"),
                          why: "clicking and typing for an agent in other apps", pane: "Privacy_Accessibility", drag: true),
            PermissionRow(id: "cua.screen", title: "Screen Recording", state: state("screen_recording"),
                          why: "an agent's screenshots of other apps", pane: "Privacy_ScreenCapture", drag: true),
        ]
    }

    /// Lines for `Dot --permissions`.
    public static func lines(_ holders: [PermissionHolder]) -> [String] {
        var out: [String] = []
        for holder in holders {
            out.append("\(holder.name) (\(holder.executable)): \(holder.runs)\(holder.note.map { "; \($0)" } ?? "")")
            for row in holder.rows {
                out.append("  \(row.title.padding(toLength: 30, withPad: " ", startingAt: 0)) \(row.state.word)\(row.note.map { " (\($0))" } ?? "")")
            }
        }
        return out
    }
}

/// Is screen capture working (parity ON-02)? After a macOS update the Screen Recording grant can be reset or left
/// stale: the capture throws, or it comes back as the wallpaper alone (no other app's windows), or pure black while
/// other apps have windows up. A dark app is not black: his full-screen terminal's background is not 0, and its text
/// lifts the averaged thumbnail.
public enum CaptureHealth {
    public enum Verdict: String, Equatable { case ok, denied, blank }

    /// `errorCode`: the capture's error, nil when it worked (-3801 is ScreenCaptureKit's "user declined").
    /// `shareableWindows`: other apps' windows ScreenCaptureKit offered; `listedWindows`: the window server's count of
    /// the same, which needs no grant. `luma`: a small grey thumbnail of the shot.
    public static func verdict(preflight: Bool, errorCode: Int?, shareableWindows: Int, listedWindows: Int, luma: [UInt8]) -> Verdict {
        if !preflight || errorCode == -3801 { return .denied }
        if errorCode != nil { return .ok }   // other failures (no display, a busy capture) are not the grant
        if listedWindows > 0, shareableWindows == 0 { return .blank }
        if listedWindows > 0, luma.count >= 16, let high = luma.max(), high <= 2 { return .blank }
        return .ok
    }
}
