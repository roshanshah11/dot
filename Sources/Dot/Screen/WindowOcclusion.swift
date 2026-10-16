import AppKit
import Foundation

/// Which app's window is on top at a point on screen, so a ring is never drawn around a control
/// another window covers (HeyClicky's `[tour-visibility] occlusionState` check). Reads the
/// window list only; Dot's own windows and the menu bar layer are skipped.
enum WindowOcclusion {
    struct Owner: Equatable {
        let pid: pid_t
        let name: String
    }

    /// The owner of the topmost ordinary window containing the point (AppKit screen coordinates).
    static func topWindowOwner(at point: CGPoint) -> Owner? {
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return nil }
        let primaryHeight = NSScreen.screens.first?.frame.height ?? 0
        let flipped = CGPoint(x: point.x, y: primaryHeight - point.y)
        let own = ProcessInfo.processInfo.processIdentifier
        for window in list {
            guard let layer = window[kCGWindowLayer as String] as? Int, layer == 0,
                  let pid = window[kCGWindowOwnerPID as String] as? pid_t, pid != own,
                  let alpha = window[kCGWindowAlpha as String] as? Double, alpha > 0.05,
                  let bounds = window[kCGWindowBounds as String] as? [String: Any],
                  let x = bounds["X"] as? Double, let y = bounds["Y"] as? Double, let w = bounds["Width"] as? Double, let h = bounds["Height"] as? Double else { continue }
            if CGRect(x: x, y: y, width: w, height: h).contains(flipped) {
                return Owner(pid: pid, name: (window[kCGWindowOwnerName as String] as? String) ?? "another app")
            }
        }
        return nil
    }

    /// True when the point is covered by a window that is not the frontmost app's.
    static func isCovered(_ point: CGPoint) -> (covered: Bool, by: String) {
        guard let owner = topWindowOwner(at: point) else { return (false, "") }
        let front = NSWorkspace.shared.frontmostApplication?.processIdentifier
        return (front != nil && owner.pid != front, owner.name)
    }
}
