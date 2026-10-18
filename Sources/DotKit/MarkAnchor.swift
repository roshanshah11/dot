import CoreGraphics
import Foundation

/// How a mark on the screen (a highlight box, a ring, a pointed-at spot, a drawn shape) stays on the content
/// it was placed on while he scrolls. Round eight: marks used to be pinned to screen coordinates, so a box
/// drawn around a definition in a PDF stayed put while the page scrolled away under it.
///
/// Coordinates here are screen points with a top-left origin (the Accessibility and CGWindow convention).
public enum MarkAnchorKind: String, Equatable, Sendable {
    /// The mark sits on an accessibility element; its frame is re-read while he scrolls.
    case element
    /// No element matches (PDF text, canvases, images): the pixels under the mark are tracked.
    case pixels
    /// Nothing to track (the anchor could not be read): the mark stays where it was drawn.
    case fixed
}

public enum MarkEdge: String, Equatable, Sendable { case top, bottom, left, right }

public enum MarkTrackMath {
    /// The element is the mark's anchor only if it is roughly the thing that was marked: intersection over
    /// union of at least `minIoU`, or the mark sits inside a small element (a ring around a button).
    public static func elementMatches(mark: CGRect, element: CGRect, minIoU: CGFloat = 0.45) -> Bool {
        guard mark.width > 0, mark.height > 0, element.width > 0, element.height > 0 else { return false }
        let inter = mark.intersection(element)
        guard !inter.isNull, inter.width > 0, inter.height > 0 else { return false }
        let iou = (inter.width * inter.height) / (mark.width * mark.height + element.width * element.height - inter.width * inter.height)
        if iou >= minIoU { return true }
        // a ring or point inside a control no bigger than about three times the mark
        let small = element.width * element.height <= mark.width * mark.height * 3
        return small && element.contains(CGPoint(x: mark.midX, y: mark.midY))
    }

    /// Where the mark goes when the element it sits on moved from `oldFrame` to `newFrame` (scrolled, or the
    /// window moved): the same offset from the element's origin, scaled if the element changed size.
    public static func follow(mark: CGRect, from oldFrame: CGRect, to newFrame: CGRect) -> CGRect {
        let sx = oldFrame.width > 0 ? newFrame.width / oldFrame.width : 1
        let sy = oldFrame.height > 0 ? newFrame.height / oldFrame.height : 1
        // Scrolling never resizes; a resize changes the layout, so only scale when the change is small.
        let scale = abs(sx - 1) < 0.25 && abs(sy - 1) < 0.25
        let dx = (mark.minX - oldFrame.minX) * (scale ? sx : 1), dy = (mark.minY - oldFrame.minY) * (scale ? sy : 1)
        return CGRect(x: newFrame.minX + dx, y: newFrame.minY + dy,
                      width: mark.width * (scale ? sx : 1), height: mark.height * (scale ? sy : 1))
    }

    /// The on-screen translation a scroll-wheel event predicts, in top-left screen points. The event's point
    /// delta is the distance the content moves (positive = content moves down, toward the bottom of the screen),
    /// for trackpads and wheels alike once `isContinuous` is accounted for (line deltas become ~ lines * lineHeight).
    public static func predictedTranslation(pointDeltaX: Double, pointDeltaY: Double, lineDeltaX: Double, lineDeltaY: Double,
                                            isContinuous: Bool, lineHeight: CGFloat = 16) -> CGVector {
        if isContinuous || pointDeltaX != 0 || pointDeltaY != 0 {
            return CGVector(dx: pointDeltaX, dy: pointDeltaY)
        }
        return CGVector(dx: lineDeltaX * Double(lineHeight), dy: lineDeltaY * Double(lineHeight))
    }

    /// Combine the prediction (instant, sometimes off: apps scale and smooth wheel deltas) with a measured
    /// translation from image registration (exact, a frame late). A measurement wins when it is confident and
    /// plausible: within `slack` points of the prediction plus a generous factor for acceleration. A shy one
    /// (at least `agreeing`) still wins when it is close to the prediction: on a dark page (ChatGPT, 2026-10-17)
    /// Vision's confidence stayed at 0.07-0.39 through a whole scroll while its shifts were right, and the
    /// rare wrong ones (a fast flick past the captured region) are far off the prediction.
    public static func reconcile(predicted: CGVector, measured: CGVector?, confidence: Double, minConfidence: Double = 0.5,
                                 slack: CGFloat = 80, agreeing: Double = 0.05) -> CGVector {
        guard let m = measured else { return predicted }
        if confidence >= minConfidence {
            let limitY = abs(predicted.dy) * 3 + slack, limitX = abs(predicted.dx) * 3 + slack
            guard abs(m.dy) <= limitY, abs(m.dx) <= limitX else { return predicted }
            return m
        }
        guard confidence >= agreeing else { return predicted }
        let toleranceY = max(16, abs(predicted.dy) * 0.35), toleranceX = max(16, abs(predicted.dx) * 0.35)
        guard abs(m.dy - predicted.dy) <= toleranceY, abs(m.dx - predicted.dx) <= toleranceX else { return predicted }
        return m
    }

    /// Is enough of the mark inside the visible part of the window to keep drawing it? Otherwise, which edge
    /// did it leave by (the chevron points there).
    public static func visibility(of mark: CGRect, in visible: CGRect, minFraction: CGFloat = 0.35) -> (visible: Bool, edge: MarkEdge?) {
        guard mark.width > 0, mark.height > 0 else { return (false, nil) }
        let inter = mark.intersection(visible)
        if !inter.isNull, inter.width > 0, inter.height > 0, (inter.width * inter.height) / (mark.width * mark.height) >= minFraction {
            return (true, nil)
        }
        if mark.midY < visible.minY { return (false, .top) }
        if mark.midY > visible.maxY { return (false, .bottom) }
        if mark.midX < visible.minX { return (false, .left) }
        if mark.midX > visible.maxX { return (false, .right) }
        return (false, nil)
    }

    /// Where an edge chevron sits for a mark that scrolled out of `visible`: on that edge, in line with the mark,
    /// inset so it never touches the corner.
    public static func chevron(for mark: CGRect, in visible: CGRect, edge: MarkEdge, inset: CGFloat = 26) -> CGPoint {
        let x = min(max(mark.midX, visible.minX + inset), visible.maxX - inset)
        let y = min(max(mark.midY, visible.minY + inset), visible.maxY - inset)
        switch edge {
        case .top: return CGPoint(x: x, y: visible.minY + inset)
        case .bottom: return CGPoint(x: x, y: visible.maxY - inset)
        case .left: return CGPoint(x: visible.minX + inset, y: y)
        case .right: return CGPoint(x: visible.maxX - inset, y: y)
        }
    }

    /// The screen region captured around a pixel-anchored mark for registration: the mark plus a margin,
    /// kept inside the window, and wide enough to carry texture.
    public static func registrationRegion(for mark: CGRect, in window: CGRect, margin: CGFloat = 140, minWidth: CGFloat = 240) -> CGRect {
        var r = mark.insetBy(dx: -40, dy: -margin)
        if r.width < minWidth { r = r.insetBy(dx: -(minWidth - r.width) / 2, dy: 0) }
        // near a window edge, slide the region inward instead of losing its width
        if r.width <= window.width {
            if r.minX < window.minX { r.origin.x = window.minX }
            if r.maxX > window.maxX { r.origin.x = window.maxX - r.width }
        }
        let clipped = r.intersection(window)
        return clipped.isNull ? .null : clipped.integral
    }
}

/// A scroll gesture moves content along one axis: NSScrollView scrolls only along the predominant axis
/// (`usesPredominantAxisScrolling`, on by default) and browsers rail the same way. A trackpad stroke up a page
/// still reports some sideways delta, and moving a mark by it walked a box 120 points off a ChatGPT equation
/// in one scroll (2026-10-17) while the page never moved sideways. The axis is the one the gesture starts along,
/// kept through its momentum.
public struct ScrollRails: Equatable {
    public enum Axis: Equatable, Sendable { case vertical, horizontal }
    public private(set) var axis: Axis?
    private var pending = CGVector.zero
    private var lastEvent = -Double.infinity

    public init() {}

    /// One event's predicted translation kept to its gesture's axis. `began` is the event's scroll phase
    /// "began"; a momentum event, or one within `gap` seconds of the last, continues the gesture.
    public mutating func rail(_ delta: CGVector, at time: Double, began: Bool, isMomentum: Bool, gap: Double = 0.3) -> CGVector {
        if began || (!isMomentum && time - lastEvent > gap) {
            axis = nil
            pending = .zero
        }
        lastEvent = time
        if axis == nil {
            pending.dx += delta.dx
            pending.dy += delta.dy
            if abs(pending.dx) + abs(pending.dy) >= 3 { axis = abs(pending.dy) >= abs(pending.dx) ? .vertical : .horizontal }
        }
        switch axis ?? (abs(delta.dy) >= abs(delta.dx) ? .vertical : .horizontal) {
        case .vertical: return CGVector(dx: 0, dy: delta.dy)
        case .horizontal: return CGVector(dx: delta.dx, dy: 0)
        }
    }
}
