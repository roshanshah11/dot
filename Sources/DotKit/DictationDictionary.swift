import Foundation

/// His word list for dictation: course terms, names and products the recognizer gets wrong.
/// One entry per line in `~/.config/dot/dictionary.txt`:
///
///     UChicago                 a term: any case-insensitive hearing of it is written this way
///     type safe => TypeSafe    a correction: what the recognizer hears, then what to write
///     # comments start with a hash
///
/// A term also matches when the recognizer split it into words ("jev one" for "Jev1").
public struct DictationDictionary: Equatable {
    public struct Rule: Equatable {
        public let heard: String
        public let correct: String
        public init(heard: String, correct: String) { self.heard = heard; self.correct = correct }
    }

    public private(set) var rules: [Rule] = []
    public private(set) var terms: [String] = []

    public init() {}

    public init(text: String) {
        for raw in text.split(separator: "\n") {
            let line = raw.trimmingCharacters(in: .whitespaces)
            guard !line.isEmpty, !line.hasPrefix("#") else { continue }
            if let range = line.range(of: "=>") ?? line.range(of: "->") {
                let heard = line[..<range.lowerBound].trimmingCharacters(in: .whitespaces)
                let correct = line[range.upperBound...].trimmingCharacters(in: .whitespaces)
                if !heard.isEmpty, !correct.isEmpty { rules.append(Rule(heard: heard, correct: correct)) }
            } else {
                terms.append(line)
            }
        }
    }

    public var isEmpty: Bool { rules.isEmpty && terms.isEmpty }

    /// The text with every rule and term applied, whole words only, longest matches first.
    public func apply(to text: String) -> String {
        guard !isEmpty, !text.isEmpty else { return text }
        var out = text
        let ordered = rules.sorted { $0.heard.count > $1.heard.count }
        for rule in ordered { out = Self.replaceWords(in: out, heard: rule.heard, with: rule.correct) }
        for term in terms.sorted(by: { $0.count > $1.count }) { out = Self.replaceWords(in: out, heard: term, with: term) }
        return out
    }

    /// Replace `heard` wherever it appears as whole words, ignoring case and the spaces and hyphens
    /// inside it (so "type safe", "type-safe" and "typesafe" all match "TypeSafe").
    static func replaceWords(in text: String, heard: String, with replacement: String) -> String {
        let squashed = heard.lowercased().filter { $0.isLetter || $0.isNumber }
        guard !squashed.isEmpty else { return text }
        // Letters and digits of `heard`, each allowing an optional space or hyphen before it.
        var pattern = "(?<![\\p{L}\\p{N}])"
        for (index, char) in squashed.enumerated() {
            if index > 0 { pattern += "[ \\-]?" }
            pattern += NSRegularExpression.escapedPattern(for: String(char))
        }
        pattern += "(?![\\p{L}\\p{N}])"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return text }
        let range = NSRange(location: 0, length: (text as NSString).length)
        return regex.stringByReplacingMatches(in: text, range: range, withTemplate: NSRegularExpression.escapedTemplate(for: replacement))
    }

    /// Adds a term or a correction and returns the line that belongs in the file.
    public static func line(forHeard heard: String?, correct: String) -> String {
        if let heard, !heard.isEmpty, heard.lowercased() != correct.lowercased() { return "\(heard) => \(correct)" }
        return correct
    }
}
