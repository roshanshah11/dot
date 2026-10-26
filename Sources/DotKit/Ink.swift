import CoreGraphics
import Foundation

/// Ink on the live screen (parity batch 1, docs/heyclicky-drawing.md): the marks Dot writes on the real screen while
/// it talks, beside the walkthrough's point, ring and box. The model writes them as beats in Dot's tag grammar; this
/// file is what a tag means (InkSpec), what an edit does (InkEdit), and the drawing as it stands (InkBoard), so the
/// next turn can say "no, the other one" and get an edit. Pure, so it is tested.
public enum InkKind: String, CaseIterable, Equatable, Sendable {
    /// Free handwriting on calm space.
    case write
    /// A solid pill in the ink naming a thing.
    case label
    /// A numbered step badge.
    case num
    /// A dashed region with a faint tint.
    case frame
    case underline, strike, check, cross
    /// A curved arrow from one thing to another.
    case connect
    /// A closed outline around an irregular region.
    case trace
    /// A paper note on calm space.
    case sticky
    /// A real picture dropped in.
    case photo
    /// Words typed on, a letter at a time (and typed into the field in drive mode).
    case typeText = "type_text"

    /// The tag that writes it.
    public var tag: String { rawValue.uppercased() }
}

/// One place as the model wrote it: an element of the turn's numbered list (`e12`), a pixel point (`x,y`) or a pixel
/// box (`x,y,w,h`) in the screenshot. Element places snap to the element's frame and anchor to it.
public enum InkPlace: Equatable, Sendable {
    case element(Int)
    case point(CGPoint)
    case rect(CGRect)

    /// Parses one place; nil for anything else (a word, a bad number, a box with no size).
    public static func parse(_ text: String) -> InkPlace? {
        let t = text.trimmingCharacters(in: .whitespaces).lowercased()
        if t.hasPrefix("e"), let n = Int(t.dropFirst()), n >= 1 { return .element(n) }
        let pieces = t.split(separator: ",", omittingEmptySubsequences: false).map { $0.trimmingCharacters(in: .whitespaces) }
        let numbers = pieces.compactMap { Double($0) }
        guard numbers.count == pieces.count, numbers.allSatisfy({ $0.isFinite && abs($0) < 100_000 }) else { return nil }
        switch numbers.count {
        case 2: return .point(CGPoint(x: numbers[0], y: numbers[1]))
        case 4 where numbers[2] > 0 && numbers[3] > 0: return .rect(CGRect(x: numbers[0], y: numbers[1], width: numbers[2], height: numbers[3]))
        default: return nil
        }
    }

    /// Back to the grammar (for the `[on screen]` lines and logs).
    public var text: String {
        switch self {
        case .element(let n): return "e\(n)"
        case .point(let p): return "\(Int(p.x)),\(Int(p.y))"
        case .rect(let r): return "\(Int(r.minX)),\(Int(r.minY)),\(Int(r.width)),\(Int(r.height))"
        }
    }
}

/// An ink tag: its kind, its places (one, two for connect, three or more for trace), its words, its screen.
public struct InkSpec: Equatable, Sendable {
    public var kind: InkKind
    public var places: [InkPlace]
    public var text: String
    public var screen: Int?
    /// Written as `[ADD:KIND:...]`: drawn on top of what is there instead of clearing it.
    public var add: Bool

    public init(kind: InkKind, places: [InkPlace], text: String = "", screen: Int? = nil, add: Bool = false) {
        self.kind = kind; self.places = places; self.text = text; self.screen = screen; self.add = add
    }

    /// Longest words a mark carries (labels are three words or fewer in the prompt; this is the hard cap).
    public static let maxText = 140

    /// Parses `[KIND:places:text(:screenN)]`'s payload; nil when the places don't fit the kind or the words are missing.
    public static func parse(kind: InkKind, payload: String) -> InkSpec? {
        var parts = payload.split(separator: ":", omittingEmptySubsequences: false).map { String($0).trimmingCharacters(in: .whitespaces) }
        guard let first = parts.first, !first.isEmpty else { return nil }
        parts.removeFirst()
        var screen: Int?
        if let last = parts.last?.lowercased(), last.hasPrefix("screen"), let n = Int(last.dropFirst("screen".count)) {
            screen = n
            parts.removeLast()
        }
        let places = first.split(separator: ";").map(String.init).compactMap(InkPlace.parse)
        guard places.count == first.split(separator: ";").count else { return nil }
        let text = String(parts.joined(separator: ":").trimmingCharacters(in: .whitespaces).prefix(maxText))
        switch kind {
        case .write, .label, .sticky, .photo, .typeText:
            guard places.count == 1, !text.isEmpty else { return nil }
        case .num:
            guard places.count == 1, let n = Int(text), (0...99).contains(n) else { return nil }
        case .frame:
            guard places.count == 1, !Self.isPoint(places[0]) else { return nil }
        case .check, .cross:
            guard places.count == 1 else { return nil }
        case .underline, .strike:
            // two points, or the thing itself (an element or a box)
            guard places.count == 2 ? places.allSatisfy(Self.isPoint) : places.count == 1 && !Self.isPoint(places[0]) else { return nil }
        case .connect:
            guard places.count == 2 else { return nil }
        case .trace:
            guard places.count >= 3, places.allSatisfy(Self.isPoint) else { return nil }
        }
        return InkSpec(kind: kind, places: places, text: text, screen: screen)
    }

    private static func isPoint(_ place: InkPlace) -> Bool { if case .point = place { return true }; return false }

    /// Back to the grammar, for logs.
    public var tagText: String {
        "[\(kind.tag):\(places.map(\.text).joined(separator: ";"))\(text.isEmpty ? "" : ":" + text)]"
    }
}

/// A change to the drawing already on the screen (D4). Every mark has an id (`m1`, `m2`, ...) that the next turn sees.
public enum InkEdit: Equatable, Sendable {
    case recolor(id: String, color: String)
    case move(id: String, to: InkPlace)
    case scale(id: String, factor: Double)
    /// The pen runs backwards over it.
    case erase(id: String)
    /// The last mark goes.
    case undo
    /// This answer draws on top of what is there instead of clearing it.
    case keep

    /// `[EDIT:m2:recolor:red]`, `[EDIT:m2:move:x,y]`, `[EDIT:m2:scale:1.4]`.
    public static func parseEdit(_ payload: String) -> InkEdit? {
        let parts = payload.split(separator: ":", maxSplits: 2, omittingEmptySubsequences: false).map { String($0).trimmingCharacters(in: .whitespaces) }
        guard parts.count == 3, let id = InkBoard.normalizedID(parts[0]) else { return nil }
        switch parts[1].lowercased() {
        case "recolor", "color", "colour":
            guard InkColors.hex(parts[2]) != nil else { return nil }
            return .recolor(id: id, color: parts[2].lowercased())
        case "move", "moveto":
            guard let place = InkPlace.parse(parts[2]) else { return nil }
            return .move(id: id, to: place)
        case "scale", "resize":
            guard let f = Double(parts[2].replacingOccurrences(of: "x", with: "")), f >= 0.25, f <= 4 else { return nil }
            return .scale(id: id, factor: f)
        case "erase", "remove", "delete":
            return .erase(id: id)
        default:
            return nil
        }
    }

    /// `[ERASE:m2]`.
    public static func parseErase(_ payload: String) -> InkEdit? {
        InkBoard.normalizedID(payload).map { .erase(id: $0) }
    }
}

/// The colours an edit may name; "ink" is Dot's accent.
public enum InkColors {
    public static let named: [String: String] = [
        "red": "#e5484d", "orange": "#f76b15", "yellow": "#ffc53d", "green": "#30a46c", "blue": "#0090ff",
        "purple": "#8e4ec6", "pink": "#d6409f", "white": "#ffffff", "black": "#1a1b1f", "grey": "#8b8d98", "gray": "#8b8d98",
    ]

    /// A name or `#rrggbb`; "ink" and "accent" are nil-hex (the accent), so they report as valid with an empty hex.
    public static func hex(_ name: String) -> String? {
        let n = name.trimmingCharacters(in: .whitespaces).lowercased()
        if n == "ink" || n == "accent" { return "" }
        if let h = named[n] { return h }
        if n.hasPrefix("#"), n.count == 7, n.dropFirst().allSatisfy({ $0.isHexDigit }) { return n }
        return nil
    }

    /// Free words read white on a dark spot and near-black on a light one (`luminance` 0...1 of what is under them).
    public static func freeWordHex(onLuminance luminance: Double) -> String { luminance < 0.55 ? "#ffffff" : "#1a1b1f" }
}

/// The drawing on the screen now: every mark by id, in drawing order, with where it went. The next talk turn gets
/// `lines` as `[on screen]` while ink is up, so the model can edit by id.
public struct InkBoard: Equatable, Sendable {
    public struct Mark: Equatable, Sendable {
        public var id: String
        public var spec: InkSpec
        /// Where it landed, screen points (AppKit): what the `[on screen]` line and the layout check use.
        public var frame: CGRect
        /// "" is the accent.
        public var color: String
        public var scale: Double
        public var landedAt: Date

        public init(id: String, spec: InkSpec, frame: CGRect, color: String = "", scale: Double = 1, landedAt: Date = Date()) {
            self.id = id; self.spec = spec; self.frame = frame; self.color = color; self.scale = scale; self.landedAt = landedAt
        }

        /// `m1 ring "Discount rate" at 412,88`: kind, words, where (screen points), colour when not the accent.
        public var line: String {
            var s = "\(id) \(spec.kind.rawValue)"
            if !spec.text.isEmpty { s += " \"\(Self.short(spec.text))\"" }
            s += " at \(Int(frame.midX)),\(Int(frame.midY))"
            if !color.isEmpty { s += " (\(color))" }
            if scale != 1 { s += " x\(String(format: "%.1f", scale))" }
            return s
        }

        private static func short(_ text: String) -> String { text.count <= 40 ? text : String(text.prefix(39)) + "…" }
    }

    public private(set) var marks: [Mark] = []
    private var counter = 0
    /// At most this many marks at once; the oldest goes first (five per answer in the prompt; edits add up).
    public static let cap = 24

    public init() {}

    public static func normalizedID(_ text: String) -> String? {
        let t = text.trimmingCharacters(in: .whitespaces).lowercased()
        guard t.hasPrefix("m"), let n = Int(t.dropFirst()), n >= 1 else { return nil }
        return "m\(n)"
    }

    public var isEmpty: Bool { marks.isEmpty }

    /// A new mark; returns its id and the ids that fell off the cap.
    @discardableResult
    public mutating func add(_ spec: InkSpec, frame: CGRect, at date: Date = Date()) -> (id: String, dropped: [String]) {
        counter += 1
        let id = "m\(counter)"
        marks.append(Mark(id: id, spec: spec, frame: frame, landedAt: date))
        var dropped: [String] = []
        while marks.count > Self.cap { dropped.append(marks.removeFirst().id) }
        return (id, dropped)
    }

    public func mark(_ id: String) -> Mark? { marks.first { $0.id == id } }

    /// Applies an edit; returns the ids it touched (empty when the id is unknown or there is nothing to undo).
    @discardableResult
    public mutating func apply(_ edit: InkEdit, moveTo resolved: CGRect? = nil) -> [String] {
        switch edit {
        case .keep:
            return []
        case .undo:
            guard let last = marks.popLast() else { return [] }
            return [last.id]
        case .erase(let id):
            guard let i = marks.firstIndex(where: { $0.id == id }) else { return [] }
            marks.remove(at: i)
            return [id]
        case .recolor(let id, let color):
            guard let i = marks.firstIndex(where: { $0.id == id }), let hex = InkColors.hex(color) else { return [] }
            marks[i].color = hex.isEmpty ? "" : color
            return [id]
        case .scale(let id, let factor):
            guard let i = marks.firstIndex(where: { $0.id == id }) else { return [] }
            marks[i].scale *= factor
            let f = marks[i].frame
            let w = f.width * factor, h = f.height * factor
            marks[i].frame = CGRect(x: f.midX - w / 2, y: f.midY - h / 2, width: w, height: h)
            return [id]
        case .move(let id, _):
            guard let i = marks.firstIndex(where: { $0.id == id }), let to = resolved else { return [] }
            let f = marks[i].frame
            marks[i].frame = to.width > 0 && to.height > 0 && marks[i].spec.kind == .frame
                ? to : CGRect(x: to.midX - f.width / 2, y: to.midY - f.height / 2, width: f.width, height: f.height)
            return [id]
        }
    }

    /// A tracked mark moved with its content (scroll, window move).
    public mutating func moved(_ id: String, to frame: CGRect) {
        if let i = marks.firstIndex(where: { $0.id == id }) { marks[i].frame = frame }
    }

    public mutating func removeAll() { marks.removeAll() }

    /// Marks older than `age` (seconds) at `now`, which fade (D1: ink older than two minutes goes).
    public func older(than age: TimeInterval, now: Date = Date()) -> [String] {
        marks.filter { now.timeIntervalSince($0.landedAt) > age }.map(\.id)
    }

    public mutating func remove(_ ids: [String]) { marks.removeAll { ids.contains($0.id) } }

    /// The `[on screen]` block's lines (empty when nothing is drawn).
    public var lines: [String] { marks.map(\.line) }
}

/// When each mark of a beat draws (D3): a beat's marks start with its sentence and their strokes spread across it,
/// one after another, so the pen is still moving while the words land. With no measured duration the sentence's
/// length stands in (65 ms a character).
public enum InkTiming {
    public static let msPerCharacter = 0.065

    /// How long a mark takes at its natural pace: about 600 points a second of stroke, text at 18 characters a
    /// second, never under a quarter second or over 1.6 s.
    public static func natural(strokeLength: CGFloat, characters: Int) -> TimeInterval {
        let pen = Double(strokeLength) / 600
        let words = Double(characters) / 18
        return min(max(pen + words, 0.25), 1.6)
    }

    /// (start, duration) per mark, seconds after the sentence starts. The marks fill 85% of the sentence: slow
    /// pens speed up to fit (to a third of natural at most), short drawings stretch (to 2.5x at most).
    public static func schedule(naturals: [TimeInterval], sentence duration: TimeInterval?, characters: Int) -> [(start: TimeInterval, duration: TimeInterval)] {
        guard !naturals.isEmpty else { return [] }
        let total = naturals.reduce(0, +)
        let available = (duration ?? Double(max(characters, 1)) * msPerCharacter) * 0.85
        let stretch = min(max(available / max(total, 0.001), 0.35), 2.5)
        var t = 0.0
        return naturals.map { n in
            let d = n * stretch
            defer { t += d }
            return (t, d)
        }
    }
}
