import CoreGraphics
import Foundation

/// A 3D figure you can turn and click (parity D5), from the talk model's `[FIGURE]` tag:
///
///     [FIGURE:animal cell|membrane: sphere 3 glass #9ecbff; nucleus: sphere 1.1 @0.4,0.2,0 #7b5cff;
///             mitochondrion: capsule 0.35x1.2 @-1.5,0.5,0.8 rot 0,0,40 #ff6b2c]
///     [FIGURE:e12:a piston|...]          placed beside element 12 (or x,y in the screenshot)
///     [FIGURE:B-DNA|molecule 1bna]       a real structure by its PDB id goes to a card (3Dmol)
///
/// A part is `name: shape size [@x,y,z] [rot a,b,c] [matte|glossy|metal|glass] [#hex]`. Sizes by shape: box WxHxD,
/// sphere R, cylinder RxH, capsule RxH, cone RxH or TOPxBOTTOMxH, torus RINGxPIPE, tube OUTERxINNERxH,
/// extrude x,y/x,y/x,y [depth D] (a flat outline pushed into 3D). Units are loose (the figure is fitted to its panel);
/// rotations are degrees. A part that does not parse is skipped and named in `skipped`; a recipe with no part left is nil.
public struct FigureRecipe: Equatable {
    public var title: String
    public var place: InkPlace?
    public var parts: [FigurePart]
    /// A PDB id instead of parts: the figure is a real molecule, shown on a card.
    public var molecule: String?
    /// Parts that did not parse, each as "name: why" (for dot.log; never a blank stage).
    public var skipped: [String] = []

    public static let maxParts = 40
    public static let maxTitle = 60

    public init(title: String, place: InkPlace? = nil, parts: [FigurePart], molecule: String? = nil) {
        self.title = title; self.place = place; self.parts = parts; self.molecule = molecule
    }

    public static func parse(_ payload: String) -> FigureRecipe? {
        guard let bar = payload.firstIndex(of: "|") else { return nil }
        var head = String(payload[..<bar]).trimmingCharacters(in: .whitespaces)
        let body = String(payload[payload.index(after: bar)...])
        var place: InkPlace?
        if let colon = head.firstIndex(of: ":"), let p = InkPlace.parse(String(head[..<colon])) {
            place = p
            head = String(head[head.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
        }
        let title = String(head.prefix(maxTitle))
        guard !title.isEmpty else { return nil }

        let pieces = body.split(separator: ";").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        if pieces.count == 1, let pdb = molecule(pieces[0]) {
            return FigureRecipe(title: title, place: place, parts: [], molecule: pdb)
        }
        var recipe = FigureRecipe(title: title, place: place, parts: [])
        var names = Set<String>()
        for piece in pieces {
            guard recipe.parts.count < maxParts else { recipe.skipped.append("\(piece.prefix(30)): over \(maxParts) parts"); continue }
            switch FigurePart.parse(piece) {
            case .success(var part):
                // two parts with one name would answer a click with the wrong one
                var name = part.name, n = 2
                while names.contains(name.lowercased()) { name = "\(part.name) \(n)"; n += 1 }
                part.name = name
                names.insert(name.lowercased())
                recipe.parts.append(part)
            case .failure(let why):
                recipe.skipped.append(why.text)
            }
        }
        return recipe.parts.isEmpty ? nil : recipe
    }

    private static func molecule(_ piece: String) -> String? {
        let words = piece.split(separator: " ").map(String.init)
        guard words.count == 2, words[0].lowercased() == "molecule", words[1].range(of: #"^[0-9][A-Za-z0-9]{3}$"#, options: .regularExpression) != nil
        else { return nil }
        return words[1].lowercased()
    }

    /// The farthest any part reaches from the origin (for fitting the camera).
    public var radius: Double {
        parts.map { p in sqrt(p.position.x * p.position.x + p.position.y * p.position.y + p.position.z * p.position.z) + p.shape.extent }.max() ?? 1
    }

    /// Back to tag text (logs, the `[on screen]` line).
    public var tagText: String {
        let head = (place.map { $0.text + ":" } ?? "") + title
        if let molecule { return "[FIGURE:\(head)|molecule \(molecule)]" }
        return "[FIGURE:\(head)|" + parts.map(\.text).joined(separator: "; ") + "]"
    }
}

public struct FigurePoint: Equatable {
    public var x: Double, y: Double, z: Double
    public init(_ x: Double, _ y: Double, _ z: Double) { self.x = x; self.y = y; self.z = z }
    public static let zero = FigurePoint(0, 0, 0)
}

public enum FigureMaterial: String, CaseIterable, Equatable {
    case matte, glossy, metal, glass
}

public enum FigureShape: Equatable {
    case box(width: Double, height: Double, depth: Double)
    case sphere(radius: Double)
    case cylinder(radius: Double, height: Double)
    case capsule(radius: Double, height: Double)
    case cone(top: Double, bottom: Double, height: Double)
    case torus(ring: Double, pipe: Double)
    case tube(outer: Double, inner: Double, height: Double)
    case extrude(points: [CGPoint], depth: Double)

    public static let names = ["box", "sphere", "cylinder", "capsule", "cone", "torus", "tube", "extrude"]

    /// About how far the shape reaches from its centre.
    public var extent: Double {
        switch self {
        case .box(let w, let h, let d): return sqrt(w * w + h * h + d * d) / 2
        case .sphere(let r): return r
        case .cylinder(let r, let h), .capsule(let r, let h): return max(r, h / 2)
        case .cone(let t, let b, let h): return max(t, b, h / 2)
        case .torus(let ring, let pipe): return ring + pipe
        case .tube(let outer, _, let h): return max(outer, h / 2)
        case .extrude(let points, let depth): return max(points.map { hypot($0.x, $0.y) }.max() ?? 0, depth / 2)
        }
    }

    /// Vertices the shape makes at `segments` (radial) detail; the panel lowers the detail until a part fits its cap.
    public func vertices(segments: Int) -> Int {
        let s = max(segments, 3)
        switch self {
        case .box: return 24
        case .sphere: return (s + 1) * (s / 2 + 1)
        case .cylinder: return (s + 1) * 2 + 2 * (s + 2)
        case .capsule: return (s + 1) * (s / 2 + 3)
        case .cone: return (s + 1) * 2 + 2 * (s + 2)
        case .torus: return (s + 1) * (s / 2 + 1)
        case .tube: return (s + 1) * 8
        case .extrude(let points, _): return points.count * 6 + 2
        }
    }

    /// The most detail (radial segments, 6...48) that keeps the part at or under `cap` vertices.
    public func segments(cap: Int) -> Int {
        var s = 48
        while s > 6, vertices(segments: s) > cap { s -= 2 }
        return s
    }

    var sizeText: String {
        func n(_ v: Double) -> String { CardEvent.number(v) }
        switch self {
        case .box(let w, let h, let d): return "box \(n(w))x\(n(h))x\(n(d))"
        case .sphere(let r): return "sphere \(n(r))"
        case .cylinder(let r, let h): return "cylinder \(n(r))x\(n(h))"
        case .capsule(let r, let h): return "capsule \(n(r))x\(n(h))"
        case .cone(let t, let b, let h): return "cone \(n(t))x\(n(b))x\(n(h))"
        case .torus(let ring, let pipe): return "torus \(n(ring))x\(n(pipe))"
        case .tube(let o, let i, let h): return "tube \(n(o))x\(n(i))x\(n(h))"
        case .extrude(let points, let d): return "extrude " + points.map { "\(n($0.x)),\(n($0.y))" }.joined(separator: "/") + " depth \(n(d))"
        }
    }
}

public struct FigurePart: Equatable {
    public var name: String
    public var shape: FigureShape
    public var position: FigurePoint
    /// Degrees about x, y and z.
    public var rotation: FigurePoint
    public var material: FigureMaterial
    /// "#rrggbb", or "" for the accent.
    public var colorHex: String

    public static let maxName = 40
    static let size = 0.01...50.0
    static let reach = -50.0...50.0

    public init(name: String, shape: FigureShape, position: FigurePoint = .zero, rotation: FigurePoint = .zero,
                material: FigureMaterial = .matte, colorHex: String = "") {
        self.name = name; self.shape = shape; self.position = position; self.rotation = rotation
        self.material = material; self.colorHex = colorHex
    }

    public struct Problem: Error, Equatable {
        public let text: String
    }

    public static func parse(_ text: String) -> Result<FigurePart, Problem> {
        guard let colon = text.firstIndex(of: ":") else { return .failure(Problem(text: "\(text.prefix(30)): no name")) }
        let name = String(text[..<colon].trimmingCharacters(in: .whitespaces).prefix(maxName))
        guard !name.isEmpty else { return .failure(Problem(text: "\(text.prefix(30)): no name")) }
        func fail(_ why: String) -> Result<FigurePart, Problem> { .failure(Problem(text: "\(name): \(why)")) }
        var words = text[text.index(after: colon)...].split(whereSeparator: \.isWhitespace).map(String.init)
        guard !words.isEmpty else { return fail("no shape") }
        let kind = words.removeFirst().lowercased()
        guard FigureShape.names.contains(kind) else { return fail("unknown shape \(kind)") }
        guard !words.isEmpty else { return fail("no size") }
        let sizeWord = words.removeFirst()

        var position = FigurePoint.zero, rotation = FigurePoint.zero, material = FigureMaterial.matte, color = "", depth = 0.3
        var i = 0
        while i < words.count {
            let w = words[i].lowercased()
            if w.hasPrefix("@") {
                guard let p = triple(String(w.dropFirst()), in: reach) else { return fail("bad position \(w)") }
                position = p
            } else if w == "rot" || w.hasPrefix("rot") {
                let rest = w == "rot" ? (i + 1 < words.count ? words[i + 1] : "") : String(w.dropFirst(3))
                if w == "rot" { i += 1 }
                guard let r = triple(rest, in: -720...720) else { return fail("bad rotation \(rest)") }
                rotation = r
            } else if w == "depth", i + 1 < words.count, let d = Double(words[i + 1]), size.contains(d) {
                depth = d
                i += 1
            } else if let m = FigureMaterial(rawValue: w) {
                material = m
            } else if w.range(of: #"^#[0-9a-f]{6}$"#, options: .regularExpression) != nil {
                color = w
            } else {
                return fail("unknown word \(words[i])")
            }
            i += 1
        }

        let dims = sizeWord.lowercased().split(separator: "x").map { Double($0) }
        let ok = !dims.contains(nil) && dims.allSatisfy { size.contains($0!) }
        let d = dims.compactMap { $0 }
        let shape: FigureShape
        switch kind {
        case "box" where ok && d.count == 3: shape = .box(width: d[0], height: d[1], depth: d[2])
        case "box" where ok && d.count == 1: shape = .box(width: d[0], height: d[0], depth: d[0])
        case "sphere" where ok && d.count == 1: shape = .sphere(radius: d[0])
        case "cylinder" where ok && d.count == 2: shape = .cylinder(radius: d[0], height: d[1])
        case "capsule" where ok && d.count == 2: shape = .capsule(radius: d[0], height: max(d[1], 2 * d[0]))
        case "cone" where d.count == 2 && ok: shape = .cone(top: 0, bottom: d[0], height: d[1])
        case "cone" where d.count == 3:
            // a cone's top may be 0 (a point)
            let raw = sizeWord.lowercased().split(separator: "x").compactMap { Double($0) }
            guard raw.count == 3, (0...50).contains(raw[0]), size.contains(raw[1]), size.contains(raw[2]) else { return fail("bad size \(sizeWord)") }
            shape = .cone(top: raw[0], bottom: raw[1], height: raw[2])
        case "torus" where ok && d.count == 2 && d[1] < d[0]: shape = .torus(ring: d[0], pipe: d[1])
        case "tube" where ok && d.count == 3 && d[1] < d[0]: shape = .tube(outer: d[0], inner: d[1], height: d[2])
        case "extrude":
            let points = sizeWord.split(separator: "/").compactMap { pair -> CGPoint? in
                let xy = pair.split(separator: ",").compactMap { Double($0) }
                guard xy.count == 2, xy.allSatisfy({ reach.contains($0) }) else { return nil }
                return CGPoint(x: xy[0], y: xy[1])
            }
            guard points.count >= 3, points.count == sizeWord.split(separator: "/").count, points.count <= 64 else { return fail("bad outline \(sizeWord)") }
            shape = .extrude(points: points, depth: depth)
        default:
            return fail("bad size \(sizeWord) for \(kind)")
        }
        return .success(FigurePart(name: name, shape: shape, position: position, rotation: rotation, material: material, colorHex: color))
    }

    private static func triple(_ text: String, in range: ClosedRange<Double>) -> FigurePoint? {
        let n = text.split(separator: ",", omittingEmptySubsequences: false).map { Double($0) }
        guard n.count == 3, let x = n[0], let y = n[1], let z = n[2], [x, y, z].allSatisfy({ range.contains($0) }) else { return nil }
        return FigurePoint(x, y, z)
    }

    public var text: String {
        func n(_ v: Double) -> String { CardEvent.number(v) }
        var out = "\(name): \(shape.sizeText)"
        if position != .zero { out += " @\(n(position.x)),\(n(position.y)),\(n(position.z))" }
        if rotation != .zero { out += " rot \(n(rotation.x)),\(n(rotation.y)),\(n(rotation.z))" }
        if material != .matte { out += " \(material.rawValue)" }
        if !colorHex.isEmpty { out += " \(colorHex)" }
        return out
    }
}
