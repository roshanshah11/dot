import Foundation

/// What he did to a figure on a card: let go of a JSXGraph point, set a slider, tapped a labelled
/// part. board.js posts `{type: "event", kind, data, card}` through the `dot` handler, at most once
/// per 1.5 s and only when the value changed; this reads the message, drops repeats, and says it
/// in one line for the log and for talk ("he dragged the eigenvector to (2, 1)").
///
/// A card is model-written html with file access, so an event is only ever words for a talk
/// turn. Nothing here names a tool, a file or an action, and nothing here runs one.
public struct CardEvent: Equatable {
    public indirect enum Value: Equatable {
        case number(Double)
        case text(String)
        case bool(Bool)
        case list([Value])
        case object([String: Value])
        case null

        public var numberValue: Double? { if case .number(let v) = self { return v }; return nil }
        public var textValue: String? { if case .text(let v) = self { return v }; return nil }
        public var objectValue: [String: Value]? { if case .object(let v) = self { return v }; return nil }
    }

    /// The card's id from the relay that received it (what the page says about itself is ignored).
    public let card: String
    /// "drag", "slider", "tap", or a word a card's own script chose.
    public let kind: String
    public let data: [String: Value]

    public init(card: String, kind: String, data: [String: Value] = [:]) {
        self.card = card; self.kind = kind; self.data = data
    }

    static let maxText = 120
    static let maxItems = 16
    static let maxDepth = 3

    /// The event in a message body, or nil when the body is not one.
    public static func parse(_ body: Any, card: String) -> CardEvent? {
        guard let object = body as? [String: Any], object["type"] as? String == "event",
              let rawKind = object["kind"] as? String else { return nil }
        let kind = rawKind.lowercased().trimmingCharacters(in: .whitespaces)
        guard kind.range(of: #"^[a-z][a-z0-9_-]{0,23}$"#, options: .regularExpression) != nil else { return nil }
        var data: [String: Value] = [:]
        if let raw = object["data"] {
            guard case .object(let fields)? = value(raw, depth: 0) else { return nil }
            data = fields
        }
        return CardEvent(card: card, kind: kind, data: data)
    }

    /// A JSON-ish value from WebKit's bridge (NSNumber, NSString, NSArray, NSDictionary, NSNull),
    /// cut down to size: strings to 120 characters, lists and groups to 16 entries, three levels.
    static func value(_ raw: Any, depth: Int) -> Value? {
        switch raw {
        case let n as NSNumber:
            if CFGetTypeID(n) == CFBooleanGetTypeID() { return .bool(n.boolValue) }
            return n.doubleValue.isFinite ? .number(n.doubleValue) : .null
        case let s as String:
            return .text(s.count > maxText ? String(s.prefix(maxText)) : s)
        case let list as [Any]:
            guard depth < maxDepth else { return nil }
            return .list(list.prefix(maxItems).compactMap { value($0, depth: depth + 1) })
        case let dict as [String: Any]:
            guard depth < maxDepth else { return nil }
            var out: [String: Value] = [:]
            for key in dict.keys.sorted().prefix(maxItems) {
                if let v = dict[key].flatMap({ value($0, depth: depth + 1) }) { out[String(key.prefix(40))] = v }
            }
            return .object(out)
        case is NSNull:
            return .null
        default:
            return nil
        }
    }

    /// The thing moved or tapped: a point, a slider or a part, else the figure.
    public var subject: String {
        for key in ["point", "name", "part", "figure"] {
            if let s = data[key]?.textValue?.trimmingCharacters(in: .whitespaces), !s.isEmpty { return s }
        }
        return ""
    }

    /// One line for Dot's log and the talk turn.
    public var summary: String {
        let name = subject
        switch kind {
        case "drag":
            let thing = name.isEmpty ? "a point" : (name.count <= 2 ? "point \(name)" : "the \(name)")
            if let x = data["x"]?.numberValue, let y = data["y"]?.numberValue {
                return "he dragged \(thing) to (\(Self.number(x)), \(Self.number(y)))"
            }
            return "he dragged \(thing)"
        case "slider":
            let thing = name.isEmpty ? "a slider" : name
            var line = "he set \(thing)"
            if let v = data["value"] {
                line += " to \(Self.amount(v, unit: data["unit"]?.textValue ?? ""))"
            }
            if let result = data["result"]?.objectValue {
                let label = result["label"]?.textValue ?? "the result"
                let shown = result["text"]?.textValue ?? result["value"].map { Self.amount($0, unit: result["unit"]?.textValue ?? "") } ?? ""
                if !shown.isEmpty { line += "; \(label) \(shown)" }
            }
            return line
        case "tap":
            let label = data["label"]?.textValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let thing = label.isEmpty ? name : label
            return thing.isEmpty ? "he tapped the card" : "he tapped the \(thing)"
        default:
            let fields = data.keys.sorted().prefix(4).map { "\($0) \(Self.describe(data[$0]!))" }
            return "he used the card (\(kind))" + (fields.isEmpty ? "" : ": " + fields.joined(separator: ", "))
        }
    }

    /// A number as he would say it: at most two decimals, no trailing zeros, never "-0".
    public static func number(_ v: Double) -> String {
        let r = (v * 100).rounded() / 100
        if r == 0 { return "0" }
        if r == r.rounded(), abs(r) < 1e15 { return String(Int(r)) }
        var s = String(format: "%.2f", r)
        while s.hasSuffix("0") { s.removeLast() }
        return s
    }

    static func amount(_ value: Value, unit: String) -> String {
        guard let v = value.numberValue else { return describe(value) }
        let n = number(v)
        switch unit {
        case "": return n
        case "$": return v < 0 ? "-$" + number(-v) : "$" + n
        case "%", "x", "bp": return n + unit
        default: return n + " " + unit
        }
    }

    static func describe(_ value: Value) -> String {
        switch value {
        case .number(let v): return number(v)
        case .text(let s): return s
        case .bool(let b): return b ? "yes" : "no"
        case .list(let items): return "(" + items.prefix(4).map(describe).joined(separator: ", ") + ")"
        case .object(let fields): return "(" + fields.keys.sorted().prefix(3).map { "\($0) \(describe(fields[$0]!))" }.joined(separator: ", ") + ")"
        case .null: return "nothing"
        }
    }

    /// A burst of events cut to the latest per card, kind and subject, in the order they last changed.
    public static func coalesce(_ events: [CardEvent]) -> [CardEvent] {
        var latest: [String: Int] = [:]
        for (index, event) in events.enumerated() { latest[event.key] = index }
        return events.indices.filter { latest[events[$0].key] == $0 }.map { events[$0] }
    }

    var key: String { "\(card)\u{1F}\(kind)\u{1F}\(subject)" }
}

/// The gate in front of talk: drops an event equal to the last one let through for the same card,
/// kind and subject, and holds a runaway card to one event per `minimumGap` (board.js already
/// spaces them 1.5 s apart, so this only bites on a card misusing the handler).
public struct CardEventFilter {
    public let minimumGap: TimeInterval
    private var lastAdmitted: [String: CardEvent] = [:]
    private var lastTime: [String: Date] = [:]

    public init(minimumGap: TimeInterval = 0.5) { self.minimumGap = minimumGap }

    public mutating func admit(_ event: CardEvent, at time: Date = Date()) -> Bool {
        if lastAdmitted[event.key] == event { return false }
        if let last = lastTime[event.card], time.timeIntervalSince(last) < minimumGap { return false }
        lastAdmitted[event.key] = event
        lastTime[event.card] = time
        return true
    }
}
