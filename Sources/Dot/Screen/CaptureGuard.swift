import AppKit
import DotKit

/// Keeps every Dot window's sharing type right (rules: DotKit CaptureSharing). On the iMac display a window is always
/// shown in capture; a window lifted there goes back to the setting when it leaves. Windows made once and kept
/// (the explainer panel, the notes window) `follow` the setting, so a toggle after they were made still reaches them.
/// It re-checks a window when it moves, resizes, changes screen or comes on screen, all of them when the displays
/// change, and all of them every second, so nothing depends on the order a window was made, placed and shown in.
@MainActor
enum CaptureGuard {
    static var visibleInRecordings = true
    private static let followed = NSHashTable<NSWindow>.weakObjects()
    private static let lifted = NSHashTable<NSWindow>.weakObjects()   // hidden by their owner, shown here for the iMac
    private static var displays: [CGRect] = []
    private static var streamed: [CGRect] = []
    private static var tick: Timer?

    static func follow(_ window: NSWindow) {
        followed.add(window)
        apply(to: window)
    }

    static func start() {
        guard tick == nil else { return }
        readScreens()
        let center = NotificationCenter.default
        for name in [NSWindow.didMoveNotification, NSWindow.didResizeNotification, NSWindow.didChangeScreenNotification,
                     NSWindow.didChangeOcclusionStateNotification] {
            center.addObserver(forName: name, object: nil, queue: .main) { note in
                guard let window = note.object as? NSWindow else { return }
                Task { @MainActor in apply(to: window) }
            }
        }
        center.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { _ in
            Task { @MainActor in readScreens(); sweep() }
        }
        tick = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in Task { @MainActor in sweep() } }
        sweep()
    }

    static func sweep() { for window in NSApp.windows { apply(to: window) } }

    private static func apply(to window: NSWindow) {
        guard let verdict = CaptureSharing.verdict(frame: window.frame, displays: displays, streamed: streamed,
                                                   visibleInRecordings: visibleInRecordings,
                                                   follows: followed.contains(window) || lifted.contains(window)) else { return }
        if verdict == .streamed { if window.sharingType == .none { lifted.add(window) } } else { lifted.remove(window) }
        let type: NSWindow.SharingType = verdict.shown ? .readOnly : .none
        guard window.sharingType != type else { return }
        window.sharingType = type
        let name = window.title.isEmpty ? String(describing: Swift.type(of: window)) : window.title
        Log.info("capture: \(name) \(verdict.shown ? "shown in" : "hidden from") capture\(verdict == .streamed ? " (on the iMac display)" : "")")
    }

    private static func readScreens() {
        displays = NSScreen.screens.map(\.frame)
        streamed = NSScreen.screens.filter { screen in
            guard let id = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID else { return false }
            return CaptureSharing.isStreamed(vendor: CGDisplayVendorNumber(id), model: CGDisplayModelNumber(id), serial: CGDisplaySerialNumber(id))
        }.map(\.frame)
    }
}
