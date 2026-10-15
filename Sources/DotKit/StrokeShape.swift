import CoreGraphics
import Foundation

/// What a stroke drawn with the key held looks like: a ring around something, a line along
/// something, a scribble over it, or a plain mark. The words go to the model with the region,
/// so "why is this crossed out" and "what is this circled thing" read differently.
public enum StrokeShape: String, Equatable {
    case enclosure, horizontalLine, verticalLine, scribble, stroke

    /// How Dot describes the mark to the model.
    public var words: String {
        switch self {
        case .enclosure: return "circled"
        case .horizontalLine: return "drew a line along"
        case .verticalLine: return "drew a line beside"
        case .scribble: return "scribbled over"
        case .stroke: return "marked"
        }
    }
}

public enum StrokeClassifier {
    /// For tests and the log: (width, height, length, closing distance, reversals).
    public static func stats(_ points: [CGPoint]) -> String {
        guard points.count >= 2 else { return "too few points" }
        var minX = points[0].x, maxX = points[0].x, minY = points[0].y, maxY = points[0].y
        var length: CGFloat = 0
        for (index, p) in points.enumerated() {
            minX = min(minX, p.x); maxX = max(maxX, p.x); minY = min(minY, p.y); maxY = max(maxY, p.y)
            if index > 0 { length += hypot(p.x - points[index - 1].x, p.y - points[index - 1].y) }
        }
        let closing = hypot(points[points.count - 1].x - points[0].x, points[points.count - 1].y - points[0].y)
        return "w \(Int(maxX - minX)) h \(Int(maxY - minY)) length \(Int(length)) closing \(Int(closing))"
    }

    public static func classify(_ points: [CGPoint]) -> StrokeShape {
        guard points.count >= 3 else { return .stroke }
        var minX = points[0].x, maxX = points[0].x, minY = points[0].y, maxY = points[0].y
        var length: CGFloat = 0
        var reversalsX = 0, reversalsY = 0
        var lastDX: CGFloat = 0, lastDY: CGFloat = 0
        for (index, p) in points.enumerated() {
            minX = min(minX, p.x); maxX = max(maxX, p.x); minY = min(minY, p.y); maxY = max(maxY, p.y)
            guard index > 0 else { continue }
            let q = points[index - 1]
            let dx = p.x - q.x, dy = p.y - q.y
            length += hypot(dx, dy)
            if abs(dx) > 1.5 { if lastDX != 0, (dx > 0) != (lastDX > 0) { reversalsX += 1 }; lastDX = dx }
            if abs(dy) > 1.5 { if lastDY != 0, (dy > 0) != (lastDY > 0) { reversalsY += 1 }; lastDY = dy }
        }
        let width = max(maxX - minX, 1), height = max(maxY - minY, 1)
        let span = max(width, height)
        guard span >= 6, length > 0 else { return .stroke }
        let closing = hypot(points[points.count - 1].x - points[0].x, points[points.count - 1].y - points[0].y)
        let perimeter = 2 * (width + height)
        // A ring: the pen went most of the way round and ended near where it started (an open
        // ring that covers three quarters of the loop still reads as "circled").
        if closing <= max(span * 0.6, 14), length >= perimeter * 0.55, min(width, height) >= span * 0.18 { return .enclosure }
        // Back and forth many times over a small area: a scribble.
        if reversalsX + reversalsY >= 5, length >= perimeter * 1.2 { return .scribble }
        if height <= width * 0.22, reversalsX <= 1 { return .horizontalLine }
        if width <= height * 0.22, reversalsY <= 1 { return .verticalLine }
        return .stroke
    }
}
