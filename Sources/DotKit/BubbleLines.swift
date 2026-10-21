import Foundation

/// A muted or typed answer beside Dot, one sentence at a time (2026-10-21): a long sentence splits at a clause into
/// the next bubble, never cut with "…", and each piece stays up long enough to read.
public enum BubbleLines {
    /// About three lines of the 260 pt bubble.
    public static let maxCharacters = 110
    /// Seconds per character on screen, and the least any piece gets. Reading pace, not speaking pace: the old quiet
    /// pacing (0.045 s, about 265 words a minute) was too fast to read.
    public static let secondsPerCharacter = 0.06
    public static let minimumSeconds = 1.5

    /// The pieces of one sentence, in order, each at most `limit` characters unless a single word is longer.
    public static func chunks(_ sentence: String, limit: Int = maxCharacters) -> [String] {
        let text = sentence.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return [] }
        guard text.count > limit else { return [text] }
        let cut = splitPoint(in: text, limit: limit)
        let head = String(text[..<cut]).trimmingCharacters(in: .whitespaces)
        let tail = String(text[cut...]).trimmingCharacters(in: .whitespaces)
        guard !head.isEmpty, !tail.isEmpty else { return [text] }
        return [head] + chunks(tail, limit: limit)
    }

    /// How long a piece stays up.
    public static func readingTime(_ piece: String) -> TimeInterval {
        max(minimumSeconds, Double(piece.count) * secondsPerCharacter)
    }

    /// How long a whole sentence takes, piece by piece.
    public static func readingTime(of sentence: String) -> TimeInterval {
        chunks(sentence).reduce(0) { $0 + readingTime($1) }
    }

    /// Where to split: after the clause mark nearest the middle of what fits ("," ";" ":" or a dash), else before
    /// "and", "but", "then" or "so", else at the last space that fits.
    private static func splitPoint(in text: String, limit: Int) -> String.Index {
        let chars = Array(text)
        let window = min(limit, chars.count - 1)
        let target = Double(min(chars.count / 2, window))
        var best: (score: Double, at: Int)?
        func consider(_ at: Int, weight: Double) {
            guard at > 12, at <= window, chars.count - at > 8 else { return }
            let score = abs(Double(at) - target) * weight
            if best == nil || score < best!.score { best = (score, at) }
        }
        for i in 0..<window where i + 1 < chars.count {
            if [",", ";", ":"].contains(chars[i]), chars[i + 1] == " " { consider(i + 1, weight: 1) }
            if chars[i] == " ", i + 2 < chars.count, chars[i + 1] == "-" || chars[i + 1] == "–", chars[i + 2] == " " { consider(i + 2, weight: 1) }
        }
        if let best { return text.index(text.startIndex, offsetBy: best.at) }
        for word in [" and ", " but ", " then ", " so "] {
            var from = text.startIndex
            while let range = text.range(of: word, range: from..<text.endIndex) {
                consider(text.distance(from: text.startIndex, to: range.lowerBound), weight: 1.5)
                from = range.upperBound
            }
        }
        if let best { return text.index(text.startIndex, offsetBy: best.at) }
        let prefix = chars.prefix(window + 1)
        if let space = prefix.lastIndex(of: " "), space > 0 { return text.index(text.startIndex, offsetBy: space) }
        return text.index(text.startIndex, offsetBy: window)
    }
}
