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

    /// The resting tab: exactly the notch, the way HeyClicky's resting notch matches the camera housing
    /// (measured 2026-10-17: black from x 663 to 848.5 pt and 32 pt tall on a 1512 pt screen whose notch
    /// spans 663-848). Anything wider hangs below the menu bar (`NotchSilhouette`), so the status items
    /// either side of the notch stay uncovered. A screen without a notch gets a thin sliver.
    public var compactSize: CGSize { hasNotch ? CGSize(width: notchWidth, height: notchHeight) : CGSize(width: 120, height: 4) }

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

/// The notch tab's outline (after HeyClicky's NotchSilhouetteShape: a stem as wide as the notch through the
/// menu bar band, the wider body only below it). Rect coordinates are SwiftUI's: top-left origin, y down.
/// Small outward flares at the very top blend it into the screen edge.
public enum NotchSilhouette {
    public static func path(in rect: CGRect, stemWidth: CGFloat, bandHeight: CGFloat,
                            bottomRadius: CGFloat = 14, flare: CGFloat = 6) -> CGPath {
        let path = CGMutablePath()
        let stemLeft = rect.midX - min(stemWidth, rect.width) / 2
        let stemRight = rect.midX + min(stemWidth, rect.width) / 2
        let band = min(max(bandHeight, 0), rect.height)
        let body = rect.width > stemWidth + 1 && rect.height > band + 1
        let r = min(bottomRadius, (body ? rect.height - band : rect.height) / 2, (body ? rect.width : stemRight - stemLeft) / 2)
        // Down the left side from the top flare.
        path.move(to: CGPoint(x: stemLeft - flare, y: rect.minY))
        path.addQuadCurve(to: CGPoint(x: stemLeft, y: rect.minY + flare), control: CGPoint(x: stemLeft, y: rect.minY))
        if body {
            let fillet = min(10, (rect.width - stemWidth) / 2, rect.height - band)
            path.addLine(to: CGPoint(x: stemLeft, y: band - 0.01))
            path.addLine(to: CGPoint(x: stemLeft, y: band))
            path.addQuadCurve(to: CGPoint(x: stemLeft - fillet, y: band + fillet), control: CGPoint(x: stemLeft, y: band + fillet))
            path.addLine(to: CGPoint(x: rect.minX + r + 0.01, y: band + fillet))
            path.addLine(to: CGPoint(x: rect.minX, y: band + fillet))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY - r))
            path.addQuadCurve(to: CGPoint(x: rect.minX + r, y: rect.maxY), control: CGPoint(x: rect.minX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.maxX - r, y: rect.maxY))
            path.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.maxY - r), control: CGPoint(x: rect.maxX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.maxX, y: band + fillet))
            path.addLine(to: CGPoint(x: stemRight + fillet, y: band + fillet))
            path.addQuadCurve(to: CGPoint(x: stemRight, y: band), control: CGPoint(x: stemRight, y: band + fillet))
        } else {
            path.addLine(to: CGPoint(x: stemLeft, y: rect.maxY - r))
            path.addQuadCurve(to: CGPoint(x: stemLeft + r, y: rect.maxY), control: CGPoint(x: stemLeft, y: rect.maxY))
            path.addLine(to: CGPoint(x: stemRight - r, y: rect.maxY))
            path.addQuadCurve(to: CGPoint(x: stemRight, y: rect.maxY - r), control: CGPoint(x: stemRight, y: rect.maxY))
        }
        path.addLine(to: CGPoint(x: stemRight, y: rect.minY + flare))
        path.addQuadCurve(to: CGPoint(x: stemRight + flare, y: rect.minY), control: CGPoint(x: stemRight, y: rect.minY))
        path.closeSubpath()
        return path
    }
}
