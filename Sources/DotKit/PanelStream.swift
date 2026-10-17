import Foundation

/// Splits the talk model's streamed text into what is spoken and what goes on the explainer panel (round eight).
/// A panel block is `[PANEL:id:title]` followed by `<<<`, the UI-language markup, and `>>>`. The markup streams to
/// the panel as it arrives; the words around it go on to the beat streamer and the voice. Tags split across deltas
/// are held until they are whole.
public struct PanelStream {
    public enum Event: Equatable {
        case text(String)
        case open(id: String, title: String)
        case chunk(String)
        case close
    }

    private enum State { case outside, awaitingBlock(id: String, title: String), inside }
    private var state = State.outside
    private var buffer = ""

    public init() {}

    /// Feed one delta; returns what can be acted on now, in order.
    public mutating func feed(_ delta: String) -> [Event] {
        buffer += delta
        var out: [Event] = []
        while true {
            switch state {
            case .outside:
                guard let start = buffer.range(of: "[PANEL") else {
                    // keep a possible partial "[PAN..." at the end
                    let keep = Self.partialSuffix(of: buffer, for: "[PANEL")
                    let emit = String(buffer.dropLast(keep))
                    if !emit.isEmpty { out.append(.text(emit)) }
                    buffer = String(buffer.suffix(keep))
                    return Self.merged(out)
                }
                guard let end = buffer[start.lowerBound...].firstIndex(of: "]") else {
                    let before = String(buffer[..<start.lowerBound])
                    if !before.isEmpty { out.append(.text(before)) }
                    buffer = String(buffer[start.lowerBound...])
                    if buffer.count > 300 { out.append(.text(buffer)); buffer = "" }   // not a tag after all
                    return Self.merged(out)
                }
                let before = String(buffer[..<start.lowerBound])
                if !before.isEmpty { out.append(.text(before)) }
                let inner = String(buffer[buffer.index(start.lowerBound, offsetBy: 6)..<end])   // ":id:title"
                let parts = inner.drop(while: { $0 == ":" }).split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
                let id = parts.first.map { String($0).trimmingCharacters(in: .whitespaces) } ?? ""
                let title = parts.count > 1 ? String(parts[1]).trimmingCharacters(in: .whitespaces) : ""
                buffer = String(buffer[buffer.index(after: end)...])
                state = .awaitingBlock(id: id.isEmpty ? "panel" : id, title: title)
            case .awaitingBlock(let id, let title):
                let trimmed = buffer.drop(while: { $0 == " " || $0 == "\t" || $0 == "\n" || $0 == "\r" })
                if trimmed.isEmpty { return Self.merged(out) }
                if trimmed.hasPrefix("<<<") {
                    out.append(.open(id: id, title: title))
                    buffer = String(trimmed.dropFirst(3))
                    state = .inside
                } else if "<<<".hasPrefix(trimmed) {
                    return Self.merged(out)       // "<" or "<<" so far
                } else {
                    // a PANEL tag with no block: open an empty panel and go on speaking
                    out.append(.open(id: id, title: title))
                    out.append(.close)
                    state = .outside
                }
            case .inside:
                if let close = buffer.range(of: ">>>") {
                    let body = String(buffer[..<close.lowerBound])
                    if !body.isEmpty { out.append(.chunk(body)) }
                    out.append(.close)
                    buffer = String(buffer[close.upperBound...])
                    state = .outside
                } else {
                    let keep = Self.partialSuffix(of: buffer, for: ">>>")
                    let emit = String(buffer.dropLast(keep))
                    if !emit.isEmpty { out.append(.chunk(emit)) }
                    buffer = String(buffer.suffix(keep))
                    return Self.merged(out)
                }
            }
        }
    }

    /// The turn ended: whatever is held goes out, and an unclosed panel closes.
    public mutating func finish() -> [Event] {
        var out: [Event] = []
        switch state {
        case .outside: if !buffer.isEmpty { out.append(.text(buffer)) }
        case .awaitingBlock(let id, let title): out.append(.open(id: id, title: title)); out.append(.close)
        case .inside: if !buffer.isEmpty { out.append(.chunk(buffer)) }; out.append(.close)
        }
        buffer = ""
        state = .outside
        return Self.merged(out)
    }

    public var isInsidePanel: Bool { if case .inside = state { return true }; return false }

    /// How many trailing characters of `text` could be the start of `token`.
    static func partialSuffix(of text: String, for token: String) -> Int {
        let maxLen = min(token.count - 1, text.count)
        guard maxLen > 0 else { return 0 }
        for n in stride(from: maxLen, through: 1, by: -1) where token.hasPrefix(String(text.suffix(n))) { return n }
        return 0
    }

    /// Adjacent text (or chunk) events joined.
    static func merged(_ events: [Event]) -> [Event] {
        var out: [Event] = []
        for e in events {
            switch (out.last, e) {
            case (.text(let a)?, .text(let b)): out[out.count - 1] = .text(a + b)
            case (.chunk(let a)?, .chunk(let b)): out[out.count - 1] = .chunk(a + b)
            default: out.append(e)
            }
        }
        return out
    }
}
