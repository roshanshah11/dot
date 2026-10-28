import Foundation

/// The course's own words for the speech recognizer (lecture mode, 2026-10-22): the way Granola sends a meeting's
/// keyterms with the audio, Dot boosts the terms in the course map and the slides so "RT-qPCR" stops coming out as
/// "are tea q pcr". A term is an acronym or a mixed-case token (PCR, mRNA, qPCR, LC-MS), a bolded phrase, or a
/// capitalized word that isn't sentence-initial; the most frequent come first, up to `limit`. An ordinary word in capitals
/// is not a term: a page header ("LA CHAPTER III LINEAR MAPS AND QUOTIENT SPACES") and a book title ("Linear Algebra Done
/// Wrong") boosted AND, SPACES and Done, and "V one" came out "V Done" (MATH 20250, 10-28).
public enum LectureTerms {
    static let stop: Set<String> = ["The", "This", "That", "These", "Those", "There", "Then", "When", "What", "Which", "Where", "While",
                                    "Week", "Exam", "Class", "Lecture", "Notes", "Slide", "Reading", "Monday", "Tuesday", "Wednesday",
                                    "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March", "April", "May", "June",
                                    "July", "August", "September", "October", "November", "December", "Chapter", "Section", "Part",
                                    "And", "But", "For", "With", "From", "Into", "About", "After", "Before", "Each", "Both", "Also"]

    /// The Mac's word list split by case: lowercase entries are ordinary words, capitalized ones names. A name stays a term
    /// even when it is also a word (Jordan and jordan, Mark and mark are both listed); Krebs and Golgi are only names.
    static let dictionary: (ordinary: Set<String>, names: Set<String>) = {
        guard let list = try? String(contentsOfFile: "/usr/share/dict/words", encoding: .utf8) else { return ([], []) }
        var ordinary = Set<String>(), names = Set<String>()
        for w in list.split(separator: "\n") { if w.first?.isLowercase == true { ordinary.insert(String(w)) } else { names.insert(String(w)) } }
        return (ordinary, names)
    }()

    public static func extract(_ text: String, limit: Int = 150) -> [String] {
        var count: [String: Int] = [:]
        let lowercase = Set(text.split(whereSeparator: { !$0.isLetter }).filter { $0.first?.isLowercase == true }.map(String.init))
        func add(_ term: String, _ weight: Int = 1, bold: Bool = false) {
            let t = term.trimmingCharacters(in: CharacterSet(charactersIn: " .,;:()[]\"'*`"))
            guard t.count >= 2, t.count <= 40, !stop.contains(t), t.rangeOfCharacter(from: .letters) != nil else { return }
            if t.allSatisfy(\.isLetter) {
                guard t.wholeMatch(of: #/[IVX]+/#) == nil else { return }
                let lower = t.lowercased()
                let singular = lower.hasSuffix("s") ? String(lower.dropLast()) : lower
                // an ordinary word is a term only when the course bolds it (**REST**, **field**)
                guard bold || ((dictionary.names.contains(t) || !dictionary.ordinary.contains(lower)) && !lowercase.contains(lower) && !lowercase.contains(singular)) else { return }
            }
            count[t, default: 0] += weight
        }
        // **bold phrases**
        for m in text.matches(of: #/\*\*([^*\n]{2,40})\*\*/#) { add(String(m.1), 3, bold: true) }
        // acronyms and mixed case: PCR, mRNA, qPCR, LC-MS, CRISPR-Cas9, t(9;22) left out
        for m in text.matches(of: #/\b(?:[a-z]{0,2}[A-Z]{2,}[a-z]?[A-Z0-9]*(?:-[A-Za-z0-9]+)*|[A-Z][a-z]+[A-Z][A-Za-z0-9]*)\b/#) { add(String(m.0), 2) }
        // capitalized words that aren't the first word of a sentence or line
        for line in text.split(whereSeparator: \.isNewline) {
            let words = line.split(separator: " ")
            for (i, w) in words.enumerated() where i > 0 {
                let prev = words[i - 1]
                guard let first = w.first, first.isUppercase, w.count >= 4, !(prev.last.map { ".!?:".contains($0) } ?? false) else { continue }
                let word = w.trimmingCharacters(in: CharacterSet(charactersIn: ".,;:()[]\"'*`"))
                if word.allSatisfy({ $0.isLetter || $0 == "-" }) { add(word) }
            }
        }
        return count.sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }.prefix(limit).map(\.key)
    }
}
