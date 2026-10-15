import CoreGraphics

/// One display as the model saw it: its AppKit frame (bottom-left origin, points) and the
/// pixel size of the downscaled screenshot it was sent.
public struct CaptureFrame: Equatable {
    public let displayFrame: CGRect
    public let pixelWidth: Int
    public let pixelHeight: Int

    public init(displayFrame: CGRect, pixelWidth: Int, pixelHeight: Int) {
        self.displayFrame = displayFrame
        self.pixelWidth = pixelWidth
        self.pixelHeight = pixelHeight
    }

    var scaleX: CGFloat { displayFrame.width / CGFloat(max(pixelWidth, 1)) }
    var scaleY: CGFloat { displayFrame.height / CGFloat(max(pixelHeight, 1)) }
}

public enum Coordinates {
    /// Screenshot pixel (top-left origin) to AppKit screen point (bottom-left origin).
    public static func screenPoint(fromPixel p: CGPoint, in capture: CaptureFrame) -> CGPoint {
        let x = capture.displayFrame.minX + p.x * capture.scaleX
        let y = capture.displayFrame.maxY - p.y * capture.scaleY
        return CGPoint(x: x, y: y)
    }

    public static func screenRect(fromPixel r: CGRect, in capture: CaptureFrame) -> CGRect {
        let origin = screenPoint(fromPixel: CGPoint(x: r.minX, y: r.maxY), in: capture)
        return CGRect(x: origin.x, y: origin.y, width: r.width * capture.scaleX, height: r.height * capture.scaleY)
    }

    /// AppKit screen point to screenshot pixel for this display; nil when off the display.
    public static func pixelPoint(fromScreen p: CGPoint, in capture: CaptureFrame) -> CGPoint? {
        guard capture.displayFrame.contains(p) || capture.displayFrame.insetBy(dx: -1, dy: -1).contains(p) else { return nil }
        let x = (p.x - capture.displayFrame.minX) / capture.scaleX
        let y = (capture.displayFrame.maxY - p.y) / capture.scaleY
        return CGPoint(x: x.rounded(), y: y.rounded())
    }

    /// AppKit screen point to a top-left-origin point inside an overlay that covers `screenFrame`.
    public static func overlayPoint(fromScreen p: CGPoint, screenFrame: CGRect) -> CGPoint {
        CGPoint(x: p.x - screenFrame.minX, y: screenFrame.maxY - p.y)
    }

    public static func overlayRect(fromScreen r: CGRect, screenFrame: CGRect) -> CGRect {
        let topLeft = overlayPoint(fromScreen: CGPoint(x: r.minX, y: r.maxY), screenFrame: screenFrame)
        return CGRect(x: topLeft.x, y: topLeft.y, width: r.width, height: r.height)
    }

    /// Accessibility frames come in Core Graphics global coordinates (top-left origin of the
    /// primary display). Convert to AppKit using the primary display's height.
    public static func appKitRect(fromCG r: CGRect, primaryHeight: CGFloat) -> CGRect {
        CGRect(x: r.minX, y: primaryHeight - r.maxY, width: r.width, height: r.height)
    }

    public static func clamp(_ p: CGPoint, to frame: CGRect, inset: CGFloat = 8) -> CGPoint {
        CGPoint(x: min(max(p.x, frame.minX + inset), frame.maxX - inset),
                y: min(max(p.y, frame.minY + inset), frame.maxY - inset))
    }
}
