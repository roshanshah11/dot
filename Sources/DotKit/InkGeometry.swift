import CoreGraphics
import Foundation

/// What one ink mark draws, in overlay points (top-left origin, y down): pen strokes in drawing order, words, and
/// fills (a frame's tint, a sticky's paper, a photo's mount). Each piece has its share of the mark's progress, so the
/// view draws "the first 40% of m2" without knowing what m2 is. Pure, so it is tested.
public struct InkStroke: Equatable, Sendable {
    public enum Style: Equatable, Sendable { case pen, dashed, highlighter }
    public var points: [CGPoint]
    public var width: CGFloat
    public var style: Style
    public var closed: Bool
    public var length: CGFloat { InkPen.length(points) }
}

public struct InkText: Equatable, Sendable {
    public enum Style: Equatable, Sendable {
        /// Free handwriting (the tone under it picks white or near-black).
        case hand
        /// The name pill: solid accent, white rounded words.
        case pill
        /// A step badge: an accent disc with its number.
        case badge
        /// Handwriting on a sticky's paper.
        case sticky
        /// Typed on, a letter at a time, in a monospaced face.
        case typed
    }
    public var text: String
    public var frame: CGRect
    public var style: Style
    public var fontSize: CGFloat
}

public struct InkFill: Equatable, Sendable {
    public enum Style: Equatable, Sendable { case tint, paper, photo }
    public var rect: CGRect
    public var style: Style
    /// Degrees, for a sticky that lies a touch askew.
    public var rotation: Double
    public var cornerRadius: CGFloat
}

/// One piece of a mark and its slice of the mark's progress (0...1).
public struct InkPiece: Equatable, Sendable {
    public enum Body: Equatable, Sendable { case stroke(InkStroke), text(InkText), fill(InkFill) }
    public var body: Body
    public var from: CGFloat
    public var to: CGFloat

    /// This piece's own progress when the mark is at `progress`.
    public func local(_ progress: CGFloat) -> CGFloat {
        guard to > from else { return progress >= to ? 1 : 0 }
        return min(max((progress - from) / (to - from), 0), 1)
    }
}

public struct InkDrawing: Equatable, Sendable {
    public var pieces: [InkPiece]
    public var bounds: CGRect
    /// Seconds at the natural pace (InkTiming), before a sentence stretches or squeezes it.
    public var natural: TimeInterval

    public var strokes: [InkStroke] { pieces.compactMap { if case .stroke(let s) = $0.body { return s }; return nil } }
    public var texts: [InkText] { pieces.compactMap { if case .text(let t) = $0.body { return t }; return nil } }
    public var fills: [InkFill] { pieces.compactMap { if case .fill(let f) = $0.body { return f }; return nil } }

    /// The boxes words and paper take (what other labels must not sit on).
    public var labelBoxes: [CGRect] {
        pieces.compactMap {
            switch $0.body {
            case .text(let t): return t.frame
            case .fill(let f) where f.style != .tint: return f.rect
            default: return nil
            }
        }
    }
}

/// Measures words for layout; the app passes Core Text, tests use the default estimate.
public typealias InkMeasure = (_ text: String, _ style: InkText.Style, _ size: CGFloat) -> CGSize

public enum InkPen {
    public static func length(_ points: [CGPoint]) -> CGFloat {
        guard points.count > 1 else { return 0 }
        var total: CGFloat = 0
        for i in 1..<points.count { total += hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y) }
        return total
    }

    /// Catmull-Rom through the points, resampled about every `spacing` points: a hand's smooth line, not a polyline.
    public static func smooth(_ points: [CGPoint], closed: Bool = false, spacing: CGFloat = 2) -> [CGPoint] {
        guard points.count > 2 else { return resample(points, spacing: spacing) }
        let pts = closed ? points + [points[0]] : points
        var out: [CGPoint] = []
        let n = pts.count
        func at(_ i: Int) -> CGPoint {
            if closed { return pts[((i % (n - 1)) + (n - 1)) % (n - 1)] }
            return pts[min(max(i, 0), n - 1)]
        }
        for i in 0..<(n - 1) {
            let p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
            let seg = hypot(p2.x - p1.x, p2.y - p1.y)
            let steps = max(Int(seg / spacing), 1)
            for s in 0..<steps {
                let t = CGFloat(s) / CGFloat(steps), t2 = t * t, t3 = t2 * t
                let x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3)
                let y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
                out.append(CGPoint(x: x, y: y))
            }
        }
        out.append(pts[n - 1])
        return out
    }

    /// Straight segments cut into points about `spacing` apart.
    public static func resample(_ points: [CGPoint], spacing: CGFloat = 2) -> [CGPoint] {
        guard points.count > 1 else { return points }
        var out: [CGPoint] = [points[0]]
        for i in 1..<points.count {
            let a = points[i - 1], b = points[i]
            let steps = max(Int(hypot(b.x - a.x, b.y - a.y) / spacing), 1)
            for s in 1...steps {
                let t = CGFloat(s) / CGFloat(steps)
                out.append(CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t))
            }
        }
        return out
    }

    /// A hand's wobble: each point pushed along its normal by a smooth seeded wave, so a redraw looks the same.
    public static func wobble(_ points: [CGPoint], amplitude: CGFloat, seed: UInt64) -> [CGPoint] {
        guard points.count > 2, amplitude > 0 else { return points }
        var rng = SeededRandom(seed: seed)
        let p1 = CGFloat(rng.unit()) * 2 * .pi, p2 = CGFloat(rng.unit()) * 2 * .pi
        let f1 = 0.018 + CGFloat(rng.unit()) * 0.012, f2 = 0.05 + CGFloat(rng.unit()) * 0.03
        var s: CGFloat = 0
        var out: [CGPoint] = []
        for i in points.indices {
            if i > 0 { s += hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y) }
            let n = normal(points, i)
            let d = amplitude * (0.7 * sin(s * f1 + p1) + 0.3 * sin(s * f2 + p2))
            out.append(CGPoint(x: points[i].x + n.dx * d, y: points[i].y + n.dy * d))
        }
        return out
    }

    /// The first `progress` of the stroke, by length.
    public static func prefix(_ points: [CGPoint], progress: CGFloat) -> [CGPoint] {
        guard points.count > 1 else { return points }
        let p = min(max(progress, 0), 1)
        if p >= 1 { return points }
        let target = length(points) * p
        var walked: CGFloat = 0
        var out: [CGPoint] = [points[0]]
        for i in 1..<points.count {
            let seg = hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
            if walked + seg >= target {
                let t = seg > 0 ? (target - walked) / seg : 0
                out.append(CGPoint(x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t))
                return out
            }
            walked += seg
            out.append(points[i])
        }
        return out
    }

    /// The outline (a closed polygon) of the first `progress` of a pen stroke: full width in the middle, thin where
    /// the pen lands and where it lifts, a breath of variation along it. The lift taper shows only once the stroke is
    /// done, so the drawing end is the pen's round tip.
    public static func outline(_ points: [CGPoint], width: CGFloat, progress: CGFloat = 1, seed: UInt64 = 1) -> [CGPoint] {
        guard points.count > 1 else { return [] }
        let total = length(points)
        guard total > 0 else { return [] }
        let drawn = prefix(points, progress: progress)
        guard drawn.count > 1 else { return [] }
        var rng = SeededRandom(seed: seed)
        let phase = CGFloat(rng.unit()) * 2 * .pi
        var left: [CGPoint] = [], right: [CGPoint] = []
        var s: CGFloat = 0
        for i in drawn.indices {
            if i > 0 { s += hypot(drawn[i].x - drawn[i - 1].x, drawn[i].y - drawn[i - 1].y) }
            let u = s / total
            let landing = min(1, u / 0.08)
            let lifting = progress >= 1 ? min(1, (1 - u) / 0.16) : 1
            let half = width / 2 * (0.35 + 0.65 * sqrt(landing)) * (0.3 + 0.7 * pow(lifting, 0.6)) * (1 + 0.07 * sin(s / 19 + phase))
            let n = normal(drawn, i)
            left.append(CGPoint(x: drawn[i].x + n.dx * half, y: drawn[i].y + n.dy * half))
            right.append(CGPoint(x: drawn[i].x - n.dx * half, y: drawn[i].y - n.dy * half))
        }
        return left + right.reversed()
    }

    static func normal(_ pts: [CGPoint], _ i: Int) -> CGVector {
        let a = pts[max(i - 1, 0)], b = pts[min(i + 1, pts.count - 1)]
        let dx = b.x - a.x, dy = b.y - a.y
        let l = max(hypot(dx, dy), 0.0001)
        return CGVector(dx: -dy / l, dy: dx / l)
    }

    /// A rounded rectangle as points, clockwise from the top-left corner's end.
    public static func roundedRect(_ r: CGRect, radius: CGFloat) -> [CGPoint] {
        let rad = min(radius, r.width / 2, r.height / 2)
        var pts: [CGPoint] = []
        func arc(_ c: CGPoint, from a0: CGFloat) {
            for k in 0...6 { let a = a0 + CGFloat(k) / 6 * (.pi / 2); pts.append(CGPoint(x: c.x + cos(a) * rad, y: c.y + sin(a) * rad)) }
        }
        arc(CGPoint(x: r.maxX - rad, y: r.minY + rad), from: -.pi / 2)
        arc(CGPoint(x: r.maxX - rad, y: r.maxY - rad), from: 0)
        arc(CGPoint(x: r.minX + rad, y: r.maxY - rad), from: .pi / 2)
        arc(CGPoint(x: r.minX + rad, y: r.minY + rad), from: .pi)
        return resample(pts + [pts[0]], spacing: 4)
    }
}

/// Where words and paper go so they cover as little as possible (the layout check, D2).
public enum InkLayout {
    /// The calmest spot for a box of `size` beside `target`: above, below, right, left (6 points off), then the same
    /// further out. A spot must stay inside `bounds` and off every `avoid` box; `busy` scores what is under it (text
    /// and controls), and nearer spots win unless a further one is clearly calmer.
    public static func beside(_ target: CGRect, size: CGSize, bounds: CGRect, avoid: [CGRect], busy: (CGRect) -> Double = { _ in 0 }) -> CGRect {
        var candidates: [(CGRect, Double)] = []
        for (ring, gap) in [(0, CGFloat(6)), (1, CGFloat(26))] {
            let spots = [
                CGRect(x: target.minX, y: target.minY - gap - size.height, width: size.width, height: size.height),
                CGRect(x: target.minX, y: target.maxY + gap, width: size.width, height: size.height),
                CGRect(x: target.maxX + gap, y: target.midY - size.height / 2, width: size.width, height: size.height),
                CGRect(x: target.minX - gap - size.width, y: target.midY - size.height / 2, width: size.width, height: size.height),
            ]
            for (order, spot) in spots.enumerated() {
                let r = clamp(spot, into: bounds)
                if avoid.contains(where: { $0.intersects(r) }) || r.intersects(target.insetBy(dx: 2, dy: 2)) { continue }
                candidates.append((r, busy(r) + Double(ring) * 0.35 + Double(order) * 0.01))
            }
        }
        if let best = candidates.min(by: { $0.1 < $1.1 }) { return best.0 }
        return nudge(clamp(CGRect(x: target.maxX + 6, y: target.minY, width: size.width, height: size.height), into: bounds), avoiding: avoid, bounds: bounds)
    }

    /// The smallest move (down, up, right, left, in 6-point steps) that takes `box` off every `avoiding` box.
    public static func nudge(_ box: CGRect, avoiding: [CGRect], bounds: CGRect) -> CGRect {
        guard avoiding.contains(where: { $0.intersects(box) }) else { return box }
        for step in 1...40 {
            let d = CGFloat(step) * 6
            for (dx, dy) in [(0, d), (0, -d), (d, 0), (-d, 0)] {
                let r = clamp(box.offsetBy(dx: dx, dy: dy), into: bounds)
                if !avoiding.contains(where: { $0.intersects(r) }) { return r }
            }
        }
        return box
    }

    public static func clamp(_ r: CGRect, into bounds: CGRect) -> CGRect {
        guard !bounds.isNull, bounds.width >= r.width, bounds.height >= r.height else { return r }
        var out = r
        out.origin.x = min(max(r.minX, bounds.minX), bounds.maxX - r.width)
        out.origin.y = min(max(r.minY, bounds.minY), bounds.maxY - r.height)
        return out
    }
}

public enum InkGeometry {
    public static let pillFont: CGFloat = 13
    public static let handFont: CGFloat = 22
    public static let typedFont: CGFloat = 15
    public static let badgeSize: CGFloat = 24

    /// A rough measure for tests and as a fallback: average glyph widths per style.
    public static let estimate: InkMeasure = { text, style, size in
        let factor: CGFloat
        switch style {
        case .hand, .sticky: factor = 0.48
        case .typed: factor = 0.6
        case .pill, .badge: factor = 0.56
        }
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false)
        let widest = lines.map(\.count).max() ?? 0
        return CGSize(width: ceil(CGFloat(widest) * size * factor), height: ceil(CGFloat(max(lines.count, 1)) * size * 1.25))
    }

    /// Where the mark sits and what is around it: its anchors in overlay points (a point is a zero-size rect at that
    /// point, an element or a box its frame), the screen's bounds, the label boxes already drawn, and how busy a spot is.
    public struct Context {
        public var anchors: [CGRect]
        public var bounds: CGRect
        public var avoid: [CGRect]
        public var busy: (CGRect) -> Double
        public var measure: InkMeasure
        public var seed: UInt64
        public init(anchors: [CGRect], bounds: CGRect, avoid: [CGRect] = [], busy: @escaping (CGRect) -> Double = { _ in 0 },
                    measure: @escaping InkMeasure = InkGeometry.estimate, seed: UInt64 = 1) {
            self.anchors = anchors; self.bounds = bounds; self.avoid = avoid; self.busy = busy; self.measure = measure; self.seed = seed
        }
    }

    /// The drawing for one mark; nil when its anchors don't fit its kind.
    public static func make(_ kind: InkKind, text: String, in c: Context) -> InkDrawing? {
        guard let first = c.anchors.first else { return nil }
        var pieces: [(InkPiece.Body, Double)] = []   // body and its natural weight in seconds
        func stroke(_ pts: [CGPoint], width: CGFloat, style: InkStroke.Style = .pen, closed: Bool = false, wobble: CGFloat = 0.9, seedOffset: UInt64 = 0) {
            var p = pts.count > 2 ? InkPen.smooth(pts, closed: false) : InkPen.resample(pts)
            p = InkPen.wobble(p, amplitude: wobble, seed: c.seed &+ seedOffset)
            let s = InkStroke(points: p, width: width, style: style, closed: closed)
            pieces.append((.stroke(s), InkTiming.natural(strokeLength: s.length, characters: 0)))
        }
        func words(_ t: String, _ style: InkText.Style, size: CGFloat, at frame: CGRect) {
            pieces.append((.text(InkText(text: t, frame: frame, style: style, fontSize: size)), InkTiming.natural(strokeLength: 0, characters: t.count)))
        }
        func pillBox(_ t: String) -> CGSize {
            let m = c.measure(t, .pill, pillFont)
            return CGSize(width: ceil(m.width) + 20, height: pillFont + 12)
        }
        let isPoint = first.width == 0 && first.height == 0
        let p = CGPoint(x: first.midX, y: first.midY)

        switch kind {
        case .label:
            let size = pillBox(text)
            let box = isPoint ? InkLayout.nudge(InkLayout.clamp(CGRect(origin: p, size: size), into: c.bounds), avoiding: c.avoid, bounds: c.bounds)
                              : InkLayout.beside(first, size: size, bounds: c.bounds, avoid: c.avoid, busy: c.busy)
            words(text, .pill, size: pillFont, at: box)
        case .write:
            let m = c.measure(text, .hand, handFont)
            let size = CGSize(width: m.width + 4, height: m.height)
            let box = isPoint ? InkLayout.nudge(InkLayout.clamp(CGRect(origin: p, size: size), into: c.bounds), avoiding: c.avoid, bounds: c.bounds)
                              : InkLayout.beside(first, size: size, bounds: c.bounds, avoid: c.avoid, busy: c.busy)
            words(text, .hand, size: handFont, at: box)
        case .typeText:
            let m = c.measure(text, .typed, typedFont)
            let origin = isPoint ? p : CGPoint(x: first.minX + 8, y: first.midY - m.height / 2)
            words(text, .typed, size: typedFont, at: CGRect(origin: origin, size: m))
        case .num:
            let center = isPoint ? p : CGPoint(x: first.minX - badgeSize / 2 - 6, y: first.midY)
            var box = CGRect(x: center.x - badgeSize / 2, y: center.y - badgeSize / 2, width: badgeSize, height: badgeSize)
            box = InkLayout.nudge(InkLayout.clamp(box, into: c.bounds), avoiding: c.avoid, bounds: c.bounds)
            words(text, .badge, size: pillFont, at: box)
        case .frame:
            let r = first.insetBy(dx: -5, dy: -5)
            pieces.append((.fill(InkFill(rect: r, style: .tint, rotation: 0, cornerRadius: min(10, r.height / 2))), 0.1))
            let outline = InkPen.roundedRect(r, radius: min(10, r.height / 2))
            let s = InkStroke(points: InkPen.wobble(outline, amplitude: 0.6, seed: c.seed), width: 2, style: .dashed, closed: true)
            pieces.append((.stroke(s), InkTiming.natural(strokeLength: s.length, characters: 0)))
            if !text.isEmpty {
                let size = pillBox(text)
                let box = InkLayout.nudge(InkLayout.clamp(CGRect(x: r.minX, y: r.minY - size.height - 4, width: size.width, height: size.height), into: c.bounds),
                                          avoiding: c.avoid, bounds: c.bounds)
                words(text, .pill, size: pillFont, at: box)
            }
        case .underline, .strike:
            let (a, b): (CGPoint, CGPoint)
            if c.anchors.count >= 2 {
                let a0 = CGPoint(x: c.anchors[0].midX, y: c.anchors[0].midY), b0 = CGPoint(x: c.anchors[1].midX, y: c.anchors[1].midY)
                (a, b) = kind == .underline ? (CGPoint(x: a0.x, y: a0.y + 3), CGPoint(x: b0.x, y: b0.y + 3)) : (a0, b0)
            } else {
                let y = kind == .underline ? first.maxY + 3 : first.midY
                (a, b) = (CGPoint(x: first.minX - (kind == .strike ? 2 : 0), y: y), CGPoint(x: first.maxX + (kind == .strike ? 2 : 0), y: y))
            }
            guard hypot(b.x - a.x, b.y - a.y) >= 4 else { return nil }
            // a hand's line rises a touch in the middle
            let mid = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 1.2)
            stroke([a, mid, b], width: kind == .underline ? 2.6 : 2.4, wobble: 0.7)
        case .check:
            let at = isPoint ? p : CGPoint(x: first.maxX + 16, y: first.midY)
            stroke([CGPoint(x: at.x - 8, y: at.y - 1), CGPoint(x: at.x - 3, y: at.y + 6), CGPoint(x: at.x + 9, y: at.y - 10)], width: 3.2, wobble: 0.3)
        case .cross:
            let at = isPoint ? p : CGPoint(x: first.maxX + 16, y: first.midY)
            stroke([CGPoint(x: at.x - 7, y: at.y - 7), CGPoint(x: at.x + 7, y: at.y + 7)], width: 3.2, wobble: 0.3)
            stroke([CGPoint(x: at.x + 7, y: at.y - 7), CGPoint(x: at.x - 7, y: at.y + 7)], width: 3.2, wobble: 0.3, seedOffset: 7)
        case .connect:
            guard c.anchors.count == 2 else { return nil }
            let a = edgePoint(of: c.anchors[0], toward: CGPoint(x: c.anchors[1].midX, y: c.anchors[1].midY))
            let b = edgePoint(of: c.anchors[1], toward: CGPoint(x: c.anchors[0].midX, y: c.anchors[0].midY))
            let len = hypot(b.x - a.x, b.y - a.y)
            guard len >= 12 else { return nil }
            let n = CGVector(dx: -(b.y - a.y) / len, dy: (b.x - a.x) / len)
            let control = CGPoint(x: (a.x + b.x) / 2 + n.dx * len * 0.22, y: (a.y + b.y) / 2 + n.dy * len * 0.22)
            let curve = (0...40).map { k -> CGPoint in
                let t = CGFloat(k) / 40
                return CGPoint(x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * control.x + t * t * b.x,
                               y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * control.y + t * t * b.y)
            }
            stroke(curve, width: 2.6, wobble: 0.6)
            let tip = curve[curve.count - 1], back = curve[curve.count - 5]
            let ang = atan2(tip.y - back.y, tip.x - back.x)
            for (i, side) in [CGFloat(-1), 1].enumerated() {
                let a2 = ang + .pi - side * 0.5
                stroke([tip, CGPoint(x: tip.x + cos(a2) * 11, y: tip.y + sin(a2) * 11)], width: 2.6, wobble: 0, seedOffset: UInt64(20 + i))
            }
            if !text.isEmpty {
                let size = pillBox(text)
                let mid = curve[20]
                let box = InkLayout.nudge(InkLayout.clamp(CGRect(x: mid.x + n.dx * 14 - size.width / 2, y: mid.y + n.dy * 14 - size.height / 2,
                                                                 width: size.width, height: size.height), into: c.bounds), avoiding: c.avoid, bounds: c.bounds)
                words(text, .pill, size: pillFont, at: box)
            }
        case .trace:
            let pts = c.anchors.map { CGPoint(x: $0.midX, y: $0.midY) }
            let loop = InkPen.wobble(InkPen.smooth(pts, closed: true), amplitude: 1.1, seed: c.seed)
            let s = InkStroke(points: loop, width: 2.4, style: .pen, closed: true)
            pieces.append((.stroke(s), InkTiming.natural(strokeLength: s.length, characters: 0)))
            if !text.isEmpty {
                let b = bounds(of: loop)
                let size = pillBox(text)
                let box = InkLayout.nudge(InkLayout.clamp(CGRect(x: b.minX, y: b.minY - size.height - 4, width: size.width, height: size.height), into: c.bounds),
                                          avoiding: c.avoid, bounds: c.bounds)
                words(text, .pill, size: pillFont, at: box)
            }
        case .sticky:
            let m = c.measure(wrap(text, width: 24), .sticky, 18)
            let size = CGSize(width: min(max(m.width + 28, 140), 240), height: max(m.height + 28, 96))
            let box = isPoint ? InkLayout.nudge(InkLayout.clamp(CGRect(origin: p, size: size), into: c.bounds), avoiding: c.avoid, bounds: c.bounds)
                              : InkLayout.beside(first, size: size, bounds: c.bounds, avoid: c.avoid, busy: c.busy)
            var rng = SeededRandom(seed: c.seed)
            pieces.append((.fill(InkFill(rect: box, style: .paper, rotation: -1.2 - rng.unit() * 1.6, cornerRadius: 3)), 0.25))
            words(wrap(text, width: 24), .sticky, size: 18, at: box.insetBy(dx: 14, dy: 14))
        case .photo:
            let size = CGSize(width: 176, height: 148)
            let box = isPoint ? InkLayout.nudge(InkLayout.clamp(CGRect(origin: p, size: size), into: c.bounds), avoiding: c.avoid, bounds: c.bounds)
                              : InkLayout.beside(first, size: size, bounds: c.bounds, avoid: c.avoid, busy: c.busy)
            var rng = SeededRandom(seed: c.seed)
            pieces.append((.fill(InkFill(rect: box, style: .photo, rotation: 1.5 - rng.unit() * 3, cornerRadius: 2)), 0.35))
        }
        guard !pieces.isEmpty else { return nil }
        let total = max(pieces.reduce(0) { $0 + $1.1 }, 0.001)
        var t: Double = 0
        var placed: [InkPiece] = []
        for (body, weight) in pieces {
            let from = CGFloat(t / total)
            t += weight
            placed.append(InkPiece(body: body, from: from, to: CGFloat(t / total)))
        }
        let box = placed.reduce(CGRect.null) { acc, piece in
            switch piece.body {
            case .stroke(let s): return acc.union(bounds(of: s.points).insetBy(dx: -s.width, dy: -s.width))
            case .text(let tx): return acc.union(tx.frame)
            case .fill(let f): return acc.union(f.rect)
            }
        }
        return InkDrawing(pieces: placed, bounds: box, natural: min(max(total, 0.25), 2.4))
    }

    /// Where a line from inside `rect` toward `point` leaves it (4 points outside); a zero-size rect is its point.
    static func edgePoint(of rect: CGRect, toward point: CGPoint) -> CGPoint {
        let c = CGPoint(x: rect.midX, y: rect.midY)
        guard rect.width > 0 || rect.height > 0 else { return c }
        let dx = point.x - c.x, dy = point.y - c.y
        guard dx != 0 || dy != 0 else { return c }
        let sx = dx == 0 ? CGFloat.infinity : (rect.width / 2 + 4) / abs(dx)
        let sy = dy == 0 ? CGFloat.infinity : (rect.height / 2 + 4) / abs(dy)
        let s = min(sx, sy, 1)
        return CGPoint(x: c.x + dx * s, y: c.y + dy * s)
    }

    static func bounds(of pts: [CGPoint]) -> CGRect {
        guard let f = pts.first else { return .null }
        var r = CGRect(origin: f, size: .zero)
        for p in pts { r = r.union(CGRect(origin: p, size: .zero)) }
        return r
    }

    /// Breaks words into lines of about `width` characters (sticky notes).
    public static func wrap(_ text: String, width: Int) -> String {
        var lines: [String] = [], line = ""
        for word in text.split(separator: " ") {
            if !line.isEmpty, line.count + 1 + word.count > width { lines.append(line); line = "" }
            line += (line.isEmpty ? "" : " ") + word
        }
        if !line.isEmpty { lines.append(line) }
        return lines.joined(separator: "\n")
    }
}
