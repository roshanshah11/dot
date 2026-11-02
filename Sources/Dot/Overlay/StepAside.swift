import AppKit
import DotKit

/// Dot steps aside for the system's own surfaces (parity NO-04, SH-01): while Spotlight, Control Center or Notification
/// Center is open, the screenshot tool is up or Mission Control runs, the notch, the orb with its ink and marks, and the
/// stack fade out and let clicks through; they come back when it closes. The window list is read four times a second,
/// only while something of Dot's is on screen. Screenshots leave Dot out anyway unless "Show Dot in screen
/// recordings" is on (CaptureGuard). A surface window still there 3 s after he moved to another app, or up 10 minutes
/// while he stays in one, is one the system left on screen, and Dot comes back past it (SurfaceClock; 2026-11-01, 58
/// hours hidden behind a stuck screenshot window).
@MainActor
final class StepAside {
    /// Whether any of Dot's floating windows is up (nothing to step aside with otherwise).
    var anythingShown: () -> Bool = { false }
    /// Fade out (true) or back (false); called on every read while a surface is up, so a window that appears then is
    /// faded too.
    var apply: (Bool) -> Void = { _ in }
    /// The other apps' on-screen windows; replaced by the self-test.
    var windows: () -> [SystemWindow] = StepAside.liveWindows
    /// The clock and the app in front the stuck-window rule reads; replaced by the self-test.
    var now: () -> Date = Date.init
    var front: () -> String? = StepAside.frontApp
    private(set) var surface: SystemSurface?
    private var clock = SurfaceClock()
    private var timer: Timer?

    func start() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.read() }
        }
    }

    func read() {
        guard anythingShown() || surface != nil else { return }
        let screens = NSScreen.screens.isEmpty ? [CGSize(width: 1512, height: 982)] : NSScreen.screens.map(\.frame.size)
        let (up, nowStuck) = clock.read(windows(), screens: screens, front: front(), now: now())
        for stuck in nowStuck {
            Log.info("step aside: \(stuck.surface.word) \(stuck.why.why), a window left on screen; Dot comes back past it while it stays")
        }
        if up != surface {
            if up != nil || nowStuck.isEmpty {
                Log.info(up.map { "step aside: \($0.word) is up; the notch, orb and stack fade out" } ?? "step aside: \(surface?.word ?? "it") closed; back")
            }
            surface = up
            apply(up != nil)
        } else if up != nil {
            apply(true)
        }
    }

    /// The regular app in front, nil for Dot or a menu bar agent (the surfaces themselves are agents).
    static func frontApp() -> String? {
        guard let app = NSWorkspace.shared.frontmostApplication, app.activationPolicy == .regular,
              app.processIdentifier != ProcessInfo.processInfo.processIdentifier else { return nil }
        return app.bundleIdentifier ?? "pid \(app.processIdentifier)"
    }

    /// Every other app's on-screen window, top first.
    static func liveWindows() -> [SystemWindow] {
        let me = Int(ProcessInfo.processInfo.processIdentifier)
        let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
        return list.compactMap { entry in
            (entry[kCGWindowOwnerPID as String] as? NSNumber)?.intValue == me ? nil : SystemWindow(entry)
        }
    }

    /// Fades a window's drawing (not the window, whose own alpha its owner animates) and back.
    static func fade(_ window: NSWindow, out: Bool) {
        guard let view = window.contentView else { return }
        let target: CGFloat = out ? 0 : 1
        guard view.alphaValue != target else { return }
        NSAnimationContext.runAnimationGroup { context in
            context.duration = out ? 0.15 : 0.25
            view.animator().alphaValue = target
        }
    }
}
