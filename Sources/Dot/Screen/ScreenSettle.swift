import AppKit
import DotKit
import ScreenCaptureKit

/// Waits for the screen to stop changing: after a walkthrough click opens a pane, or after
/// Dot scrolls a document, the next look should see the finished redraw, not the animation.
/// HeyClicky samples until the frame settles ("Give it a moment, then say continue" when it
/// does not); Dot compares small thumbnails of the cursor's display a few times a second.
@MainActor
enum ScreenSettle {
    /// Returns true once two consecutive thumbnails match (within `tolerance` of pixels), false
    /// when `timeout` passes first. The first comparison happens after `minimum` seconds.
    static func wait(minimum: TimeInterval = 0.35, timeout: TimeInterval = 2.5, interval: TimeInterval = 0.3, tolerance: Double = 0.004) async -> Bool {
        let started = Date()
        try? await Task.sleep(nanoseconds: UInt64(minimum * 1_000_000_000))
        var previous = await thumbnail()
        while Date().timeIntervalSince(started) < timeout {
            try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
            let current = await thumbnail()
            if let a = previous, let b = current, a.count == b.count, difference(a, b) <= tolerance {
                Log.info("settle: screen still after \(Int(Date().timeIntervalSince(started) * 1000)) ms")
                return true
            }
            previous = current
        }
        Log.info("settle: still changing after \(Int(timeout * 1000)) ms")
        return false
    }

    /// Fraction of bytes that differ by more than a little.
    private static func difference(_ a: [UInt8], _ b: [UInt8]) -> Double {
        guard !a.isEmpty else { return 0 }
        var changed = 0
        for i in stride(from: 0, to: a.count, by: 4) where abs(Int(a[i]) - Int(b[i])) > 24 { changed += 1 }
        return Double(changed) / Double(a.count / 4)
    }

    /// A 160-pixel-wide grayscale-ish byte sample of the cursor's display.
    private static func thumbnail() async -> [UInt8]? {
        guard let content = try? await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true) else { return nil }
        let mouse = NSEvent.mouseLocation
        var screensByID: [CGDirectDisplayID: NSScreen] = [:]
        for screen in NSScreen.screens {
            if let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID { screensByID[number] = screen }
        }
        guard let display = content.displays.first(where: { screensByID[$0.displayID]?.frame.contains(mouse) ?? false }) ?? content.displays.first else { return nil }
        let ownPid = ProcessInfo.processInfo.processIdentifier
        let ownWindows = content.windows.filter { $0.owningApplication?.processID == ownPid }
        let filter = SCContentFilter(display: display, excludingWindows: ownWindows)
        let configuration = SCStreamConfiguration()
        configuration.width = 160
        configuration.height = max(Int(160.0 * Double(display.height) / Double(max(display.width, 1))), 1)
        configuration.showsCursor = false
        guard let image = try? await SCScreenshotManager.captureImage(contentFilter: filter, configuration: configuration),
              let data = image.dataProvider?.data else { return nil }
        return [UInt8](data as Data)
    }
}
