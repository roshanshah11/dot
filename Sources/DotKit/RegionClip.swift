import Foundation

/// A circled region going into another app (parity HA-01): what the clipboard carries, and whether the app he was in
/// is still the one to paste into. The AppKit half (RTFD, TIFF, focus, Command-V) is Dot's RegionPaste.
public enum RegionClip {
    public static let pngType = "public.png"
    public static let htmlType = "public.html"
    public static let textType = "public.utf8-plain-text"

    /// The clipboard item for the region and his note, as (type, data). The image for anything that takes one; HTML
    /// with the note above the image for web editors; the note alone for a plain text field. No note, no text type.
    public static func payload(png: Data, note: String) -> [(type: String, data: Data)] {
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        var out: [(type: String, data: Data)] = [(pngType, png)]
        out.append((htmlType, Data(html(note: trimmed, png: png).utf8)))
        if !trimmed.isEmpty { out.append((textType, Data(trimmed.utf8))) }
        return out
    }

    public static func html(note: String, png: Data) -> String {
        let paragraph = note.isEmpty ? "" : "<p>" + escape(note).replacingOccurrences(of: "\n", with: "<br>") + "</p>"
        return "<meta charset=\"utf-8\">" + paragraph + "<img src=\"data:image/png;base64,\(png.base64EncodedString())\" alt=\"circled region\">"
    }

    static func escape(_ text: String) -> String {
        text.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;").replacingOccurrences(of: "\"", with: "&quot;")
    }
}

/// The app and field he was in when he circled something, read before Dot's bar opens.
public struct PasteTarget: Equatable {
    public let appName: String
    public let bundleID: String
    public let pid: Int32
    /// The app's front window when he circled (CGWindowID); nil when it had none on screen.
    public let windowID: UInt32?
    /// The focused element's accessibility role then.
    public let role: String

    public init(appName: String, bundleID: String, pid: Int32, windowID: UInt32?, role: String) {
        self.appName = appName; self.bundleID = bundleID; self.pid = pid; self.windowID = windowID; self.role = role
    }
}

/// What is true right before the paste.
public struct PasteState: Equatable {
    /// The bundle id of the process with the target's pid, nil when none runs.
    public let bundleID: String?
    /// That process's windows now.
    public let windowIDs: [UInt32]
    /// The captured element still answers, and its role now.
    public let elementAlive: Bool
    public let role: String?

    public init(bundleID: String?, windowIDs: [UInt32], elementAlive: Bool, role: String?) {
        self.bundleID = bundleID; self.windowIDs = windowIDs; self.elementAlive = elementAlive; self.role = role
    }
}

public enum PasteCheck {
    public static let secureRole = "AXSecureTextField"

    /// Whether the bar offers "paste into" at all: another app, with a field focused that isn't a password.
    public static func offers(_ target: PasteTarget?, ownBundleID: String) -> Bool {
        guard let target else { return false }
        return !target.bundleID.isEmpty && target.bundleID != ownBundleID && !target.role.isEmpty && target.role != secureRole
    }

    /// Why Dot won't paste, or nil when the app, window and field are the ones he circled from. Said aloud; the clip
    /// stays on the clipboard either way.
    public static func refusal(_ target: PasteTarget, _ now: PasteState) -> String? {
        if target.role == secureRole || now.role == secureRole { return "that's a password field" }
        guard now.bundleID == target.bundleID else { return "\(target.appName) closed or restarted since you circled it" }
        if let window = target.windowID, !now.windowIDs.contains(window) { return "that \(target.appName) window closed" }
        guard now.elementAlive else { return "the field you were in isn't there any more" }
        return nil
    }

    /// The last gate before Command-V: his app in front, the captured field holding the keyboard, and no Dot window
    /// holding it instead.
    public static func focusLanded(frontPid: Int32?, targetPid: Int32, capturedFocused: Bool, dotHasKeyWindow: Bool) -> Bool {
        frontPid == targetPid && capturedFocused && !dotHasKeyWindow
    }
}
