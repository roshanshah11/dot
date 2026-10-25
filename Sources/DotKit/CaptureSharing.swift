import CoreGraphics

/// Which Dot windows may hide from screen capture. "Show in screen recordings" off sets a window's sharing type to
/// none, which keeps it out of screenshots, shares and recordings. The iMac display (~/Projects/imac/vdisplay) is
/// different: he sees it only through a ScreenCaptureKit stream, so a window hidden from capture there is invisible
/// to him and still takes every click under it (2026-10-24: the explainer panel sat unseen over Spotify on the iMac,
/// made hidden before the setting was turned back on). A window with any part on a streamed display is always shown
/// in capture; elsewhere a window that follows the setting takes it, and any other window is left as its owner set it.
public enum CaptureSharing {
    /// A display Dot is seen through a capture of, matched on the numbers it reports (its display ID changes each
    /// time it is made). The iMac's: vendor 0x610, model 0x2014, serial 0x1404, the same three vdisplay.m sets and
    /// the stream sender (imac-stream.m findVirtualDisplay) looks for.
    public struct Display: Equatable, Sendable {
        public let vendor: UInt32, model: UInt32, serial: UInt32
        public init(vendor: UInt32, model: UInt32, serial: UInt32) { self.vendor = vendor; self.model = model; self.serial = serial }
    }
    public static let streamedDisplays = [Display(vendor: 0x610, model: 0x2014, serial: 0x1404)]

    public static func isStreamed(vendor: UInt32, model: UInt32, serial: UInt32) -> Bool {
        streamedDisplays.contains(Display(vendor: vendor, model: model, serial: serial))
    }

    public enum Verdict: Equatable, Sendable {
        case streamed            // on a streamed display: shown, whatever the setting
        case setting(Bool)       // follows "Show in screen recordings": shown when it is on
        public var shown: Bool { self == .streamed || self == .setting(true) }
    }

    /// nil: leave the window as its owner set it (off every display, like the print and snapshot windows, or a window
    /// that does not follow the setting and is not on a streamed display).
    public static func verdict(frame: CGRect, displays: [CGRect], streamed: [CGRect], visibleInRecordings: Bool, follows: Bool) -> Verdict? {
        guard displays.contains(where: { overlaps($0, frame) }) else { return nil }
        if streamed.contains(where: { overlaps($0, frame) }) { return .streamed }
        return follows ? .setting(visibleInRecordings) : nil
    }

    /// A real overlap: two rects that only share an edge do not count.
    static func overlaps(_ a: CGRect, _ b: CGRect) -> Bool {
        let i = a.intersection(b)
        return !i.isNull && i.width > 0 && i.height > 0
    }
}
