import Foundation

/// Captions while Dot talks (parity D7): the sentence being said, each word lighting when its share of the
/// sentence's characters comes up in the sentence's measured length.
public enum CaptionTiming {
    /// The voice is done a little before the clip ends (the tail is breath and room).
    public static let spokenShare = 0.94
    /// How long a caption stays once its sentence ends, when nothing follows.
    public static let linger: TimeInterval = 2.2

    /// The words of a sentence, each with the fraction (0..<1) of the sentence where it lights.
    public static func words(_ text: String) -> [(word: String, start: Double)] {
        let parts = text.split(whereSeparator: \.isWhitespace).map(String.init)
        let total = Double(max(parts.reduce(0) { $0 + $1.count } + max(parts.count - 1, 0), 1))
        var before = 0
        return parts.map { word in
            defer { before += word.count + 1 }
            return (word, Double(before) / total)
        }
    }

    /// How many words are lit `elapsed` seconds into a sentence that lasts `duration`.
    public static func lit(_ starts: [Double], elapsed: TimeInterval, duration: TimeInterval) -> Int {
        guard elapsed >= 0 else { return 0 }
        guard duration > 0 else { return starts.count }
        let at = elapsed / (duration * spokenShare)
        return starts.reduce(0) { $1 <= at ? $0 + 1 : $0 }
    }

    /// A sentence's length when the voice gives none (Apple's voice): about Dot's speaking pace.
    public static func estimate(_ text: String) -> TimeInterval {
        max(0.8, Double(text.count) * InkTiming.msPerCharacter)
    }
}
