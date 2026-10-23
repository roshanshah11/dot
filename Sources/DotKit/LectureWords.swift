import Foundation

/// Lecture mode's command words, spelled the way he types them in class (10-23 12:18: "lecutre mode" went to the chat model,
/// which said lecture mode was on while nothing was listening). A word one slip from "lecture" (a swapped, missing, extra or
/// wrong letter) reads as "lecture", and the word after it one slip from "mode" reads as "mode", before Dot's command
/// patterns look. Real words that start with "lecture" (lecturer, lectures, lectured) stay as typed.
public enum LectureWords {
    public static func correctingTypos(_ text: String) -> String {
        var words = text.components(separatedBy: " ")
        var afterLecture = false
        for (i, word) in words.enumerated() {
            let letters = word.trimmingCharacters(in: CharacterSet.letters.inverted)
            let lower = letters.lowercased()
            if lower.count >= 6, !realWords.contains(lower), slips(lower, "lecture") == 1 {
                words[i] = word.replacingOccurrences(of: letters, with: "lecture")
                afterLecture = true
                continue
            }
            if afterLecture, lower.count >= 3, lower != "mode", !notMode.contains(lower), slips(lower, "mode") == 1 {
                words[i] = word.replacingOccurrences(of: letters, with: "mode")
            }
            afterLecture = lower == "lecture"
        }
        return words.joined(separator: " ")
    }

    /// Words one slip from "lecture" that are words.
    static let realWords: Set<String> = ["lecturer", "lectures", "lectured"]

    /// Words one slip from "mode" that mean something else after "lecture".
    static let notMode: Set<String> = ["more", "made", "node", "code", "model", "modes", "mood", "move", "notes"]

    /// How many slips apart two words are: a letter added, dropped or changed, or two neighbours swapped (optimal string
    /// alignment distance).
    static func slips(_ a: String, _ b: String) -> Int {
        let x = Array(a), y = Array(b)
        if x.isEmpty { return y.count }
        if y.isEmpty { return x.count }
        var d = Array(repeating: Array(repeating: 0, count: y.count + 1), count: x.count + 1)
        for i in 0...x.count { d[i][0] = i }
        for j in 0...y.count { d[0][j] = j }
        for i in 1...x.count {
            for j in 1...y.count {
                let cost = x[i - 1] == y[j - 1] ? 0 : 1
                d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
                if i > 1, j > 1, x[i - 1] == y[j - 2], x[i - 2] == y[j - 1] { d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1) }
            }
        }
        return d[x.count][y.count]
    }
}
