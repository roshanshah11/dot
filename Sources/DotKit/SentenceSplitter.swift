import Foundation

/// Turns a stream of text deltas into whole sentences, so speech can start on the
/// first sentence while the model is still writing the second.
public struct SentenceSplitter {
    private var buffer = ""
    /// Cut the very first chunk at a comma once it is long enough, so the voice starts sooner;
    /// every chunk after that waits for a sentence end.
    public var eagerFirst = false
    private var emitted = 0

    public init(eagerFirst: Bool = false) { self.eagerFirst = eagerFirst }

    /// Feed a delta; returns every complete sentence now available, in order.
    public mutating func feed(_ delta: String) -> [String] {
        buffer += delta
        var sentences: [String] = []
        while let boundary = Self.boundary(in: buffer, eager: eagerFirst && emitted == 0) {
            let sentence = String(buffer[..<boundary]).trimmingCharacters(in: .whitespacesAndNewlines)
            buffer = String(buffer[boundary...].drop(while: { $0 == " " || $0 == "\t" || $0 == "\n" }))
            if !sentence.isEmpty { sentences.append(sentence); emitted += 1 }
        }
        return sentences
    }

    /// Whatever is left when the stream ends.
    public mutating func flush() -> String? {
        let rest = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
        buffer = ""
        return rest.isEmpty ? nil : rest
    }

    public var pending: String { buffer }

    /// The index just past the first sentence end: a terminator (. ! ? or a newline),
    /// optionally followed by a closing quote or bracket, then whitespace. A period
    /// between two digits (3.5) or after a single letter (e.g. "u.s.") is not an end.
    static func boundary(in text: String, eager: Bool = false) -> String.Index? {
        let scalars = Array(text.unicodeScalars)
        guard scalars.count > 1 else { return nil }
        var i = 0
        var words = 0
        while i < scalars.count - 1 {
            let c = scalars[i]
            if c == " " { words += 1 }
            if c == "\n" {
                return text.unicodeScalars.index(text.unicodeScalars.startIndex, offsetBy: i + 1)
            }
            if eager, (c == "," || c == ";" || c == ":"), scalars[i + 1] == " ", words >= 6, i >= 36 {
                return text.unicodeScalars.index(text.unicodeScalars.startIndex, offsetBy: i + 1)
            }
            if c == "." || c == "!" || c == "?" {
                var j = i + 1
                while j < scalars.count, "\"')]".unicodeScalars.contains(scalars[j]) { j += 1 }
                guard j < scalars.count else { break }
                let next = scalars[j]
                let nextIsSpace = next == " " || next == "\n" || next == "\t"
                if nextIsSpace {
                    let previous = i > 0 ? scalars[i - 1] : " "
                    let digitBoundary = c == "." && CharacterSet.decimalDigits.contains(previous)
                        && j + 1 < scalars.count && CharacterSet.decimalDigits.contains(scalars[j + 1])
                    let singleLetterAbbreviation = c == "." && i >= 2 && scalars[i - 2] == "." && CharacterSet.letters.contains(previous)
                    if !digitBoundary && !singleLetterAbbreviation {
                        return text.unicodeScalars.index(text.unicodeScalars.startIndex, offsetBy: j)
                    }
                }
            }
            i += 1
        }
        return nil
    }
}

/// Text prepared for the ear: markdown markers, code fences, and raw links removed.
public enum SpeechText {
    public static func clean(_ text: String) -> String {
        var s = text
        s = s.replacingOccurrences(of: #"```[\s\S]*?```"#, with: " code block ", options: .regularExpression)
        s = s.replacingOccurrences(of: #"`([^`]*)`"#, with: "$1", options: .regularExpression)
        s = s.replacingOccurrences(of: #"https?://\S+"#, with: "a link", options: .regularExpression)
        s = s.replacingOccurrences(of: #"[*_#>]+"#, with: "", options: .regularExpression)
        s = s.replacingOccurrences(of: #"^\s*[-•]\s+"#, with: "", options: [.regularExpression, .anchored])
        s = s.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
