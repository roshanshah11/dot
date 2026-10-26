import CoreGraphics
import Foundation

/// The system's own surfaces Dot steps aside for (parity NO-04, SH-01): Spotlight, Control Center and Notification
/// Center panels, the screenshot tool and Mission Control. Read off the window list (owner, layer, size, alpha); a
/// table, not code, so a live dump (`Dot --surfaces`) that shows a new signature is one row to change.
public enum SystemSurface: String, CaseIterable, Sendable {
    case spotlight, controlCenter, notificationCenter, screenshot, missionControl

    public var word: String {
        switch self {
        case .spotlight: return "Spotlight"
        case .controlCenter: return "Control Center"
        case .notificationCenter: return "Notification Center"
        case .screenshot: return "the screenshot tool"
        case .missionControl: return "Mission Control"
        }
    }
}

/// One on-screen window, as CGWindowListCopyWindowInfo describes it (top-left origin, points).
public struct SystemWindow: Equatable, Sendable {
    public var owner: String
    public var name: String
    public var layer: Int
    public var frame: CGRect
    public var alpha: Double

    public init(owner: String, name: String = "", layer: Int, frame: CGRect, alpha: Double = 1) {
        self.owner = owner
        self.name = name
        self.layer = layer
        self.frame = frame
        self.alpha = alpha
    }

    /// From a window-list entry; nil for one without an owner.
    public init?(_ entry: [String: Any]) {
        guard let owner = entry["kCGWindowOwnerName"] as? String else { return nil }
        let bounds = entry["kCGWindowBounds"] as? [String: Any] ?? [:]
        func number(_ key: String) -> CGFloat { CGFloat((bounds[key] as? NSNumber)?.doubleValue ?? 0) }
        self.init(owner: owner, name: entry["kCGWindowName"] as? String ?? "", layer: (entry["kCGWindowLayer"] as? NSNumber)?.intValue ?? 0,
                  frame: CGRect(x: number("X"), y: number("Y"), width: number("Width"), height: number("Height")),
                  alpha: (entry["kCGWindowAlpha"] as? NSNumber)?.doubleValue ?? 1)
    }
}

public enum SystemSurfaces {
    /// A surface's signature: whose window, and how big it must be to be the open surface rather than the owner's
    /// always-there pieces (Control Center's menu bar items, Notification Center's banners, the Dock itself).
    public struct Rule: Sendable {
        public let surface: SystemSurface
        public let owners: Set<String>
        public let minWidth: CGFloat
        public let minHeight: CGFloat
        /// As a share of the screen (Mission Control covers it).
        public let minScreenShare: CGFloat
    }

    public static let rules: [Rule] = [
        Rule(surface: .spotlight, owners: ["Spotlight"], minWidth: 200, minHeight: 40, minScreenShare: 0),
        Rule(surface: .controlCenter, owners: ["Control Center", "ControlCenter"], minWidth: 120, minHeight: 80, minScreenShare: 0),
        Rule(surface: .notificationCenter, owners: ["Notification Center", "NotificationCenter"], minWidth: 200, minHeight: 300, minScreenShare: 0),
        Rule(surface: .screenshot, owners: ["screencaptureui", "Screenshot"], minWidth: 60, minHeight: 30, minScreenShare: 0),
        Rule(surface: .missionControl, owners: ["Dock"], minWidth: 0, minHeight: 0, minScreenShare: 0.9),
    ]

    /// The surface that's up, if any. Negative layers (desktop, wallpaper, backstops, shields, widgets on the desktop)
    /// and see-through windows never count.
    public static func up(_ windows: [SystemWindow], screen: CGSize) -> SystemSurface? {
        for window in windows where window.layer >= 0 && window.alpha > 0.05 {
            for rule in rules where rule.owners.contains(window.owner) {
                let f = window.frame
                if rule.minScreenShare > 0 {
                    if f.width >= screen.width * rule.minScreenShare && f.height >= screen.height * rule.minScreenShare { return rule.surface }
                } else if f.width >= rule.minWidth && f.height >= rule.minHeight {
                    return rule.surface
                }
            }
        }
        return nil
    }
}

/// Whether a Focus (Do Not Disturb, Work, Sleep...) is on (parity S1). Control Center shows its Focus item while one
/// is on (its menu bar setting "When Active", the default) and records that in its preferences as
/// `NSStatusItem Visible[CC] FocusModes`; that record holds in full screen, where the menu bar and its items are off
/// screen (2026-10-26: cmux full screen, no status item windows at all). The item's window in the menu bar is the
/// second signal. Apple's Focus API needs an entitlement only a provisioned app carries, and the DoNotDisturb database
/// is closed without Full Disk Access. With the setting on "Always" the record is always 1: Settings' Quiet in Focus
/// switch is the way out.
public enum FocusSignal {
    public static let itemNames: Set<String> = ["FocusModes", "Focus"]
    public static let preferenceDomain = "com.apple.controlcenter"
    /// macOS 26 writes the CC form; Monterey to Sonoma the plain one.
    public static let preferenceKeys = ["NSStatusItem VisibleCC FocusModes", "NSStatusItem Visible FocusModes"]

    public static func isOn(_ windows: [SystemWindow], preferences: [String: Any] = [:]) -> Bool {
        let recorded = preferenceKeys.contains { key in
            switch preferences[key] {
            case let n as NSNumber: return n.boolValue
            case let b as Bool: return b
            case let i as Int: return i != 0
            default: return false
            }
        }
        return recorded || menuItem(windows)
    }

    static func menuItem(_ windows: [SystemWindow]) -> Bool {
        windows.contains { w in
            (w.owner == "Control Center" || w.owner == "ControlCenter") && itemNames.contains(w.name) && w.layer >= 0 && w.alpha > 0.05
                && w.frame.minY < 40 && w.frame.height <= 40 && w.frame.width > 0
        }
    }
}
