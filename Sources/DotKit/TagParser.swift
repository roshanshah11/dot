import Foundation

/// A tag the talk model appends to its spoken answer. Tags are never read aloud;
/// Dot acts on them (fly the dot, draw a box, hand a job to an agent, escalate).
///
///   [POINT:x,y:label]              point at a screenshot pixel on the cursor's screen
///   [POINT:x,y:label:screen2]      ...on another screen (numbered as in the image labels)
///   [POINT:none]                   nothing worth pointing at
///   [HIGHLIGHT:x,y,w,h:label]      draw a box around a region (same coordinate rules)
///   [TARGET:x,y,r:label]           ring the thing to click next and wait for the click (a walkthrough step)
///   [HOVER:x,y,r:label]            ring the thing to hover; the step completes when the cursor rests inside
///   [SHAPE:arrow:x1,y1;x2,y2:label] draw a line, arrow, circle (center;edge), curve or polygon through the points
///   [CARD:id:x,y,w,h:title] <<< html >>>  put a card on the board (x,y,w,h in screenshot pixels, or "auto")
///   [REVEAL:id:n]                  show step n of a card and point at it
///   [CLEAR_BOARD]                  take every card down
///   [AGENT:brief]                  hand the task to a background agent
///   [NEW_AGENT:name:brief]         create a named agent for this kind of work, then hand off
///   [THINK]                        the question deserves the stronger model; Dot re-asks it
///   [FIND:phrase]                  find the phrase in the document in front, scroll to it and highlight it
///   [STOCK:NVDA]                   a live quote card on the board
///   [PLACE:coffee near campus]     a place card: the nearest matches on a map
///   [IMAGES:artemis ii launch]     a strip of pictures on the board
public enum DotTag: Equatable {
    case point(x: Int, y: Int, label: String, screen: Int?)
    case pointNone
    case highlight(x: Int, y: Int, width: Int, height: Int, label: String, screen: Int?)
    case target(x: Int, y: Int, radius: Int, label: String, screen: Int?)
    case hover(x: Int, y: Int, radius: Int, label: String, screen: Int?)
    case shape(kind: ShapeKind, points: [ShapePoint], label: String, screen: Int?)
    case card(id: String, rect: CardRect?, title: String, html: String, screen: Int?)
    /// Text for him to put into a field at x,y: Dot copies it and points; in drive mode it pastes.
    case type(x: Int, y: Int, label: String, text: String, screen: Int?)
    /// A live web page in a card on the board.
    case web(url: String, title: String)
    case reveal(id: String, step: Int)
    case clearBoard
    case agent(brief: String)
    case newAgent(name: String, brief: String)
    /// A standing agent's task on a schedule: the agent's name, when in plain words, the brief.
    case routine(agent: String, when: String, brief: String)
    case think
    /// Dot finds the phrase in the document in front (its text, not the pixels), scrolls to it and highlights it.
    case find(phrase: String)
    /// A live quote card for a ticker.
    case stock(symbol: String)
    /// A place card: the nearest matches for "what near where", on a map.
    case place(query: String)
    /// A strip of pictures of something.
    case images(query: String)
}

public enum ShapeKind: String, Equatable, Sendable { case line, arrow, circle, curve, polygon }

/// Where a card goes, in screenshot pixels (top-left origin).
public struct CardRect: Equatable, Sendable {
    public let x: Int
    public let y: Int
    public let width: Int
    public let height: Int
    public init(x: Int, y: Int, width: Int, height: Int) { self.x = x; self.y = y; self.width = width; self.height = height }
}

public struct ShapePoint: Equatable {
    public let x: Int
    public let y: Int
    public init(x: Int, y: Int) { self.x = x; self.y = y }
}

public extension DotTag {
    /// Tags that draw or move something on screen (as opposed to handing off or escalating).
    var isVisual: Bool {
        switch self {
        case .point, .highlight, .target, .hover, .shape, .card, .reveal, .clearBoard, .type, .web, .find, .stock, .place, .images: return true
        case .pointNone, .agent, .newAgent, .routine, .think: return false
        }
    }

    /// CARD and TYPE carry a `<<< ... >>>` block after the tag.
    public var hasBlock: Bool {
        switch self {
        case .card, .type: return true
        default: return false
        }
    }

    /// The tag with its block body filled in.
    public func filled(with body: String) -> DotTag {
        switch self {
        case .card(let id, let rect, let title, _, let screen): return .card(id: id, rect: rect, title: title, html: body, screen: screen)
        case .type(let x, let y, let label, _, let screen): return .type(x: x, y: y, label: label, text: body.trimmingCharacters(in: .whitespacesAndNewlines), screen: screen)
        default: return self
        }
    }
}

public struct ParsedResponse: Equatable {
    /// The answer with every tag removed and whitespace tidied: what gets spoken and shown.
    public let spoken: String
    public let tags: [DotTag]

    public init(spoken: String, tags: [DotTag]) {
        self.spoken = spoken
        self.tags = tags
    }
}

public enum TagParser {
    static let tagNames = ["POINT", "HIGHLIGHT", "TARGET", "HOVER", "SHAPE", "CARD", "REVEAL", "CLEAR_BOARD", "TYPE", "WEB", "FIND", "STOCK", "PLACE", "IMAGES", "AGENT", "NEW_AGENT", "ROUTINE", "THINK"]

    // swiftlint:disable:next force_try
    static let pattern = try! NSRegularExpression(
        pattern: #"\[(POINT|HIGHLIGHT|TARGET|HOVER|SHAPE|CARD|REVEAL|CLEAR_BOARD|TYPE|WEB|FIND|STOCK|PLACE|IMAGES|AGENT|NEW_AGENT|ROUTINE|THINK)(?::([^\]]*))?\]"#,
        options: []
    )

    /// The content block that follows a CARD tag: `<<<` on its own, the html, `>>>` on its own.
    static let blockPattern = try! NSRegularExpression(pattern: #"^\s*<<<[ \t]*\n?([\s\S]*?)\n?[ \t]*>>>"#, options: [])

    public static func parse(_ text: String) -> ParsedResponse {
        let ns = text as NSString
        var tags: [DotTag] = []
        var spoken = ""
        var cursor = 0
        for match in pattern.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            guard match.range.location >= cursor else { continue }   // inside a card block already consumed
            spoken += ns.substring(with: NSRange(location: cursor, length: match.range.location - cursor))
            cursor = match.range.location + match.range.length
            let kind = ns.substring(with: match.range(at: 1))
            let payloadRange = match.range(at: 2)
            let payload = payloadRange.location == NSNotFound ? "" : ns.substring(with: payloadRange)
            guard var tag = makeTag(kind: kind, payload: payload) else { continue }
            if tag.hasBlock {
                let rest = ns.substring(from: cursor)
                if let block = blockPattern.firstMatch(in: rest, range: NSRange(location: 0, length: (rest as NSString).length)) {
                    let body = (rest as NSString).substring(with: block.range(at: 1))
                    tag = tag.filled(with: body)
                    cursor += block.range.location + block.range.length
                }
            }
            tags.append(tag)
        }
        spoken += ns.substring(from: cursor)
        return ParsedResponse(spoken: tidy(spoken), tags: tags)
    }

    /// While text is still streaming, everything before an unfinished `[...` that could
    /// become a tag is safe to speak; the rest is held back until it closes.
    public static func speakablePrefix(_ buffer: String) -> (speak: String, hold: String) {
        guard let open = buffer.lastIndex(of: "["), !buffer[open...].contains("]") else {
            return (buffer, "")
        }
        let candidate = String(buffer[buffer.index(after: open)...])
        let head = candidate.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? ""
        let tagChars = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZ_")
        let couldBeTag = head.unicodeScalars.allSatisfy { tagChars.contains($0) }
            && (head.isEmpty || tagNames.contains(where: { $0.hasPrefix(head) || head.hasPrefix($0) }))
        if couldBeTag {
            return (String(buffer[..<open]), String(buffer[open...]))
        }
        return (buffer, "")
    }

    static func makeTag(kind: String, payload: String) -> DotTag? {
        switch kind {
        case "THINK":
            return .think
        case "CLEAR_BOARD":
            return .clearBoard
        case "FIND":
            let phrase = payload.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
            return phrase.count >= 2 ? .find(phrase: phrase) : nil
        case "PLACE", "IMAGES":
            let query = payload.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
            guard query.count >= 2, query.count <= 90 else { return nil }
            return kind == "PLACE" ? .place(query: query) : .images(query: query)
        case "STOCK":
            let symbol = payload.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            guard !symbol.isEmpty, symbol.count <= 12, symbol.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "." || $0 == "-" || $0 == "^" || $0 == "=" }) else { return nil }
            return .stock(symbol: symbol)
        case "REVEAL":
            let parts = splitPayload(payload)
            guard parts.count >= 1, !parts[0].isEmpty else { return nil }
            let step = parts.count >= 2 ? Int(parts[1].filter { $0.isNumber }) ?? 1 : 1
            return .reveal(id: parts[0], step: max(step, 1))
        case "CARD":
            // id : x,y,w,h | auto : title [: screenN]
            var parts = splitPayload(payload)
            guard parts.count >= 2, !parts[0].isEmpty else { return nil }
            let id = parts.removeFirst()
            let screen = takeScreen(&parts)
            var rect: CardRect?
            let place = parts.first ?? ""
            let numbers = integers(in: place)
            if numbers.count == 4, numbers[2] > 0, numbers[3] > 0 {
                rect = CardRect(x: numbers[0], y: numbers[1], width: numbers[2], height: numbers[3])
                parts.removeFirst()
            } else if place.lowercased() == "auto" || numbers.count == 2 {
                if numbers.count == 2 { rect = CardRect(x: numbers[0], y: numbers[1], width: 0, height: 0) }
                parts.removeFirst()
            }
            return .card(id: id, rect: rect, title: parts.joined(separator: ":"), html: "", screen: screen)
        case "AGENT":
            let brief = payload.trimmingCharacters(in: .whitespacesAndNewlines)
            return brief.isEmpty ? nil : .agent(brief: brief)
        case "NEW_AGENT":
            let parts = payload.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
                .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            guard parts.count == 2, !parts[0].isEmpty, !parts[1].isEmpty else { return nil }
            return .newAgent(name: parts[0], brief: parts[1])
        case "ROUTINE":
            let parts = payload.split(separator: ":", maxSplits: 2, omittingEmptySubsequences: false)
                .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            guard parts.count == 3, !parts[0].isEmpty, !parts[1].isEmpty, !parts[2].isEmpty else { return nil }
            return .routine(agent: parts[0], when: parts[1], brief: parts[2])
        case "POINT":
            if payload.trimmingCharacters(in: .whitespaces).lowercased() == "none" { return .pointNone }
            var parts = splitPayload(payload)
            guard let coords = parts.first else { return nil }
            let numbers = integers(in: coords)
            guard numbers.count == 2 else { return nil }
            parts.removeFirst()
            let screen = takeScreen(&parts)
            return .point(x: numbers[0], y: numbers[1], label: parts.joined(separator: ":"), screen: screen)
        case "TARGET", "HOVER":
            var parts = splitPayload(payload)
            guard let coords = parts.first else { return nil }
            let numbers = integers(in: coords)
            guard numbers.count == 2 || numbers.count == 3 else { return nil }
            parts.removeFirst()
            let screen = takeScreen(&parts)
            let radius = numbers.count == 3 ? max(numbers[2], 10) : 28
            let label = parts.joined(separator: ":")
            if kind == "HOVER" { return .hover(x: numbers[0], y: numbers[1], radius: radius, label: label, screen: screen) }
            return .target(x: numbers[0], y: numbers[1], radius: radius, label: label, screen: screen)
        case "SHAPE":
            var parts = splitPayload(payload)
            guard parts.count >= 2, let shapeKind = ShapeKind(rawValue: parts[0].lowercased()) else { return nil }
            parts.removeFirst()
            let pointText = parts.removeFirst()
            let points: [ShapePoint] = pointText.split(separator: ";").compactMap { pair in
                let numbers = integers(in: String(pair))
                return numbers.count == 2 ? ShapePoint(x: numbers[0], y: numbers[1]) : nil
            }
            let minimum = shapeKind == .polygon ? 3 : 2
            guard points.count >= minimum else { return nil }
            let screen = takeScreen(&parts)
            return .shape(kind: shapeKind, points: points, label: parts.joined(separator: ":"), screen: screen)
        case "WEB":
            let text = payload.trimmingCharacters(in: .whitespaces)
            guard let match = try? NSRegularExpression(pattern: #"^(https?://[^\s:]+(?::\d+)?[^\s]*?)(?::(.*))?$"#).firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) else { return nil }
            let ns = text as NSString
            var url = ns.substring(with: match.range(at: 1))
            var title = match.range(at: 2).location == NSNotFound ? "" : ns.substring(with: match.range(at: 2))
            // "https://a.b/c:title" splits at the last colon that is not part of the url's scheme or port.
            if title.isEmpty, let colon = text.range(of: ":", options: .backwards), !text[colon.upperBound...].contains("/"), text.distance(from: text.startIndex, to: colon.lowerBound) > 8 {
                url = String(text[..<colon.lowerBound]); title = String(text[colon.upperBound...])
            }
            guard url.hasPrefix("http") else { return nil }
            return .web(url: url.trimmingCharacters(in: .whitespaces), title: title.trimmingCharacters(in: .whitespaces))
        case "TYPE":
            var parts = splitPayload(payload)
            guard let coords = parts.first else { return nil }
            let numbers = integers(in: coords)
            guard numbers.count == 2 else { return nil }
            parts.removeFirst()
            let screen = takeScreen(&parts)
            return .type(x: numbers[0], y: numbers[1], label: parts.joined(separator: ":"), text: "", screen: screen)
        case "HIGHLIGHT":
            var parts = splitPayload(payload)
            guard let coords = parts.first else { return nil }
            let numbers = integers(in: coords)
            guard numbers.count == 4, numbers[2] > 0, numbers[3] > 0 else { return nil }
            parts.removeFirst()
            let screen = takeScreen(&parts)
            return .highlight(x: numbers[0], y: numbers[1], width: numbers[2], height: numbers[3],
                              label: parts.joined(separator: ":"), screen: screen)
        default:
            return nil
        }
    }

    private static func splitPayload(_ payload: String) -> [String] {
        payload.split(separator: ":", omittingEmptySubsequences: false)
            .map { String($0).trimmingCharacters(in: .whitespaces) }
    }

    private static func integers(in text: String) -> [Int] {
        let pieces = text.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        let numbers = pieces.compactMap { Int($0.filter { $0.isNumber || $0 == "-" }) }
        return numbers.count == pieces.count ? numbers : []
    }

    private static func takeScreen(_ parts: inout [String]) -> Int? {
        guard let last = parts.last?.lowercased(), last.hasPrefix("screen"),
              let n = Int(last.dropFirst("screen".count)) else { return nil }
        parts.removeLast()
        return n
    }

    static func tidy(_ text: String) -> String {
        let collapsed = text.replacingOccurrences(of: #"[ \t]+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\s*\n\s*"#, with: "\n", options: .regularExpression)
        return collapsed.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
