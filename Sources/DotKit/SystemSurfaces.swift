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
