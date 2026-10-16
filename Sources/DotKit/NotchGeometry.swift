import CoreGraphics

/// Measured notch region of the built-in display and the HUD panel that hangs from it.
/// Ported from Murmur (MIT, Roshan Shah); pure data so tests can feed synthetic frames.
public struct NotchGeometry: Equatable {
    /// Horizontal midpoint of the notch, in AppKit screen coordinates.
    public var centerX: CGFloat
    /// `screen.frame.maxY`, the top edge of the physical display.
    public var topY: CGFloat
    public var notchWidth: CGFloat
    public var notchHeight: CGFloat
    public var hasNotch: Bool

    public init(centerX: CGFloat, topY: CGFloat, notchWidth: CGFloat, notchHeight: CGFloat, hasNotch: Bool) {
        self.centerX = centerX
        self.topY = topY
        self.notchWidth = notchWidth
        self.notchHeight = notchHeight
        self.hasNotch = hasNotch
    }

    public static let panelWidth: CGFloat = 620
    public static let panelHeight: CGFloat = 300
    public static let fallbackNotchWidth: CGFloat = 215
    public static let fallbackNotchHeight: CGFloat = 32

    /// The fixed canvas the snapshot harness renders into (`Dot --snapshot`). The live window is
    /// sized by `frame(fitting:)` instead.
    public var panelFrame: CGRect {
        CGRect(x: centerX - Self.panelWidth / 2, y: topY - Self.panelHeight, width: Self.panelWidth, height: Self.panelHeight)
    }

    /// The resting tab: the notch and a small margin either side, a few points below it.
    public var compactSize: CGSize { CGSize(width: notchWidth + 36, height: notchHeight + 10) }

    /// A window the size of what it draws, hanging from the top edge and centred on the notch, never
    /// smaller than the resting tab. HeyClicky's notch window works this way too (its compact, hover
    /// and expanded geometries); a window larger than its drawing takes the clicks meant for whatever
    /// sits under it: tabs, toolbars, the menu bar.
    public func frame(fitting size: CGSize) -> CGRect {
        let width = max(ceil(size.width), compactSize.width)
        let height = max(ceil(size.height), compactSize.height)
        return CGRect(x: (centerX - width / 2).rounded(), y: topY - height, width: width, height: height)
    }

    public static func measure(frame: CGRect, safeAreaTop: CGFloat, auxLeft: CGRect?, auxRight: CGRect?) -> NotchGeometry {
        let hasNotch = safeAreaTop > 0
        var centerX = frame.midX
        var width: CGFloat = hasNotch ? fallbackNotchWidth : fallbackNotchWidth
        if hasNotch, let auxLeft, let auxRight {
            centerX = (auxLeft.maxX + auxRight.minX) / 2
            width = max(80, auxRight.minX - auxLeft.maxX)
        }
        return NotchGeometry(centerX: centerX, topY: frame.maxY, notchWidth: width,
                             notchHeight: hasNotch ? safeAreaTop : 0, hasNotch: hasNotch)
    }
}
