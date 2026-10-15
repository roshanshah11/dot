import Foundation

/// A tag the talk model appends to its spoken answer. Tags are never read aloud;
/// Dot acts on them (fly the dot, draw a box, hand a job to an agent, escalate).
///
///   [POINT:x,y:label]              point at a screenshot pixel on the cursor's screen
///   [POINT:x,y:label:screen2]      ...on another screen (numbered as in the image labels)
///   [POINT:none]                   nothing worth pointing at
///   [HIGHLIGHT:x,y,w,h:label]      draw a box around a region (same coordinate rules)
///   [TARGET:x,y,r:label]           ring the thing to click next and wait for the click (a walkthrough step)
///   [AGENT:brief]                  hand the task to a background agent
///   [NEW_AGENT:name:brief]         create a named agent for this kind of work, then hand off
///   [THINK]                        the question deserves the stronger model; Dot re-asks it
public enum DotTag: Equatable {
    case point(x: Int, y: Int, label: String, screen: Int?)
    case pointNone
    case highlight(x: Int, y: Int, width: Int, height: Int, label: String, screen: Int?)
    case target(x: Int, y: Int, radius: Int, label: String, screen: Int?)
    case agent(brief: String)
    case newAgent(name: String, brief: String)
    case think
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
    static let tagNames = ["POINT", "HIGHLIGHT", "TARGET", "AGENT", "NEW_AGENT", "THINK"]

    // swiftlint:disable:next force_try
    static let pattern = try! NSRegularExpression(
        pattern: #"\[(POINT|HIGHLIGHT|TARGET|AGENT|NEW_AGENT|THINK)(?::([^\]]*))?\]"#,
        options: []
    )

    public static func parse(_ text: String) -> ParsedResponse {
        let ns = text as NSString
        var tags: [DotTag] = []
        var spoken = ""
        var cursor = 0
        for match in pattern.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            spoken += ns.substring(with: NSRange(location: cursor, length: match.range.location - cursor))
            cursor = match.range.location + match.range.length
            let kind = ns.substring(with: match.range(at: 1))
            let payloadRange = match.range(at: 2)
            let payload = payloadRange.location == NSNotFound ? "" : ns.substring(with: payloadRange)
            if let tag = makeTag(kind: kind, payload: payload) {
                tags.append(tag)
            }
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
        case "AGENT":
            let brief = payload.trimmingCharacters(in: .whitespacesAndNewlines)
            return brief.isEmpty ? nil : .agent(brief: brief)
        case "NEW_AGENT":
            let parts = payload.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
                .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            guard parts.count == 2, !parts[0].isEmpty, !parts[1].isEmpty else { return nil }
            return .newAgent(name: parts[0], brief: parts[1])
        case "POINT":
            if payload.trimmingCharacters(in: .whitespaces).lowercased() == "none" { return .pointNone }
            var parts = splitPayload(payload)
            guard let coords = parts.first else { return nil }
            let numbers = integers(in: coords)
            guard numbers.count == 2 else { return nil }
            parts.removeFirst()
            let screen = takeScreen(&parts)
            return .point(x: numbers[0], y: numbers[1], label: parts.joined(separator: ":"), screen: screen)
        case "TARGET":
            var parts = splitPayload(payload)
            guard let coords = parts.first else { return nil }
            let numbers = integers(in: coords)
            guard numbers.count == 2 || numbers.count == 3 else { return nil }
            parts.removeFirst()
            let screen = takeScreen(&parts)
            let radius = numbers.count == 3 ? max(numbers[2], 10) : 28
            return .target(x: numbers[0], y: numbers[1], radius: radius, label: parts.joined(separator: ":"), screen: screen)
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
