import Foundation

/// The course's own words for the speech recognizer (lecture mode, 2026-10-22): the way Granola sends a meeting's
/// keyterms with the audio, Dot boosts the terms in the course map and the slides so "RT-qPCR" stops coming out as
/// "are tea q pcr". A term is an acronym or a mixed-case token (PCR, mRNA, qPCR, LC-MS), a bolded phrase, or a
/// capitalized word that isn't sentence-initial; the most frequent come first, up to `limit`.
public enum LectureTerms {
    static let stop: Set<String> = ["The", "This", "That", "These", "Those", "There", "Then", "When", "What", "Which", "Where", "While",
                                    "Week", "Exam", "Class", "Lecture", "Notes", "Slide", "Reading", "Monday", "Tuesday", "Wednesday",
                                    "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March", "April", "May", "June",
                                    "July", "August", "September", "October", "November", "December", "Chapter", "Section", "Part",
                                    "And", "But", "For", "With", "From", "Into", "About", "After", "Before", "Each", "Both", "Also"]

    public static func extract(_ text: String, limit: Int = 150) -> [String] {
        var count: [String: Int] = [:]
        func add(_ term: String, _ weight: Int = 1) {
            let t = term.trimmingCharacters(in: CharacterSet(charactersIn: " .,;:()[]\"'*`"))
            guard t.count >= 2, t.count <= 40, !stop.contains(t), t.rangeOfCharacter(from: .letters) != nil else { return }
            count[t, default: 0] += weight
        }
        // **bold phrases**
        for m in text.matches(of: #/\*\*([^*\n]{2,40})\*\*/#) { add(String(m.1), 3) }
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
