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

    /// Fixed panel covering the notch and the area below it. Never resized while shown;
    /// the SwiftUI content inside grows and shrinks.
    public var panelFrame: CGRect {
        CGRect(x: centerX - Self.panelWidth / 2, y: topY - Self.panelHeight, width: Self.panelWidth, height: Self.panelHeight)
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
