import AppKit
import DotKit
import ApplicationServices
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

    /// The pid that owns the accessibility element at the point (AppKit coordinates), or nil.
    static func axOwner(at point: CGPoint) -> pid_t? {
        let primaryHeight = NSScreen.screens.first?.frame.height ?? 0
        var element: AXUIElement?
        guard AXUIElementCopyElementAtPosition(AXUIElementCreateSystemWide(), Float(point.x), Float(primaryHeight - point.y), &element) == .success,
              let element else { return nil }
        var pid: pid_t = 0
        return AXUIElementGetPid(element, &pid) == .success ? pid : nil
    }

    /// True when the point is covered by something that is neither the frontmost app nor Dot. The accessibility hit test
    /// decides first: an invisible full-screen window (Cua Driver's) has no elements, so the app underneath answers and
    /// presses aren't blocked; the window list is the fallback.
    static func isCovered(_ point: CGPoint) -> (covered: Bool, by: String) {
        let owner = topWindowOwner(at: point)
        let front = NSWorkspace.shared.frontmostApplication?.processIdentifier
        let ax = axOwner(at: point)
        let verdict = OcclusionRule.decide(axPid: ax, cgTopPid: owner?.pid, frontPid: front, ownPid: ProcessInfo.processInfo.processIdentifier)
        let name = ax.flatMap { NSRunningApplication(processIdentifier: $0)?.localizedName } ?? owner?.name ?? ""
        return (verdict, name)
    }

    /// `Dot --occlusion x,y` (top-left screen points): both verdicts, in the log.
    static func logVerdicts(topLeft: CGPoint) {
        let primaryHeight = NSScreen.screens.first?.frame.height ?? 0
        let point = CGPoint(x: topLeft.x, y: primaryHeight - topLeft.y)
        let ax = axOwner(at: point)
        let cg = topWindowOwner(at: point)?.pid
        let covered = isCovered(point).covered
        Log.info("occlusion: \(Int(topLeft.x)),\(Int(topLeft.y)) ax=\(ax.map(String.init) ?? "none") cg=\(cg.map(String.init) ?? "none") covered=\(covered)")
    }
}
