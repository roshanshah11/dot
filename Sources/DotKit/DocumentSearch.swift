import Foundation

/// A page of a document's text, as the reader extracted it.
public struct DocumentPage: Equatable {
    public let number: Int
    public let text: String
    public init(number: Int, text: String) { self.number = number; self.text = text }
}

/// Where a query lands in a document: the page, the passage, and a phrase distinctive enough
/// to type into the app's own find box.
public struct DocumentHit: Equatable {
    public let page: Int
    public let passage: String
    public let score: Double
    public init(page: Int, passage: String, score: Double) { self.page = page; self.passage = passage; self.score = score }
}

/// Finds the part of a document some words are about. Pure text work, no model: the lecturer's
/// sentence or his question is scored against every passage by the rare words they share, so
/// "find the part about the discount rate" lands on the paragraph that uses those words most.
public enum DocumentSearch {
    static let stopwords: Set<String> = [
        "the", "and", "that", "this", "with", "for", "are", "was", "were", "from", "have", "has", "had", "not", "but", "you", "your",
        "about", "what", "which", "when", "where", "how", "why", "who", "they", "them", "their", "then", "than", "there", "here",
        "into", "out", "over", "under", "also", "just", "like", "very", "can", "could", "would", "should", "will", "may", "might",
        "one", "two", "three", "some", "any", "all", "each", "other", "more", "most", "such", "only", "own", "same", "too", "its",
        "it's", "i'm", "we", "our", "us", "she", "he", "his", "her", "him", "part", "section", "page", "find", "show", "talk",
        "talking", "says", "said", "say", "mean", "means", "thing", "things", "kind", "sort", "okay", "yeah", "right", "going",
        "get", "got", "let", "lets", "see", "look", "looking", "want", "need", "know", "think", "really", "actually", "basically",
        "because", "does", "did", "doing", "done", "being", "been", "much", "many", "well", "now", "today", "tell", "give", "take",
    ]

    /// Lowercase words of three letters or more, minus the words that carry no topic.
    public static func tokens(_ text: String) -> [String] {
        let lowered = text.lowercased()
        var words: [String] = []
        var current = ""
        for scalar in lowered.unicodeScalars {
            if CharacterSet.alphanumerics.contains(scalar) || scalar == "'" || scalar == "-" {
                current.unicodeScalars.append(scalar)
            } else {
                if !current.isEmpty { words.append(current); current = "" }
            }
        }
        if !current.isEmpty { words.append(current) }
        return words.map { $0.trimmingCharacters(in: CharacterSet(charactersIn: "'-")) }
            .filter { $0.count >= 3 && !stopwords.contains($0) }
    }

    /// Paragraphs of a page: blank-line blocks, with long blocks cut into windows of about 90 words.
    public static func passages(of text: String) -> [String] {
        let normalized = text.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n")
        var blocks: [String] = []
        for block in normalized.components(separatedBy: "\n\n") {
            let flat = block.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces)
            guard flat.count >= 20 else { continue }
            let words = flat.split(separator: " ")
            if words.count <= 130 { blocks.append(flat); continue }
            var index = 0
            while index < words.count {
                let end = min(index + 90, words.count)
                blocks.append(words[index..<end].joined(separator: " "))
                if end == words.count { break }
                index += 70   // windows overlap so a passage split in two still scores whole
            }
        }
        // A PDF page with no blank lines: cut by lines in groups.
        if blocks.isEmpty {
            let lines = normalized.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
            var index = 0
            while index < lines.count {
                let end = min(index + 8, lines.count)
                let flat = lines[index..<end].joined(separator: " ")
                if flat.count >= 20 { blocks.append(flat) }
                index = end
            }
        }
        return blocks
    }

    /// The best passages for the query, best first. Scores add the rarity of each shared word
    /// (rare across the document counts more), plus a bonus for shared word pairs in order.
    public static func bestPassages(for query: String, in pages: [DocumentPage], count: Int = 3) -> [DocumentHit] {
        let queryTokens = tokens(query)
        guard !queryTokens.isEmpty else { return [] }
        var all: [(page: Int, text: String, tokens: [String])] = []
        for page in pages {
            for passage in passages(of: page.text) { all.append((page.number, passage, tokens(passage))) }
        }
        guard !all.isEmpty else { return [] }
        var frequency: [String: Int] = [:]
        for item in all { for token in Set(item.tokens) { frequency[token, default: 0] += 1 } }
        let total = Double(all.count)
        func idf(_ token: String) -> Double { log(1 + total / Double(frequency[token] ?? 0 + 1)) }
        let querySet = Set(queryTokens)
        var queryPairs: Set<String> = []
        if queryTokens.count >= 2 { for i in 0..<(queryTokens.count - 1) { queryPairs.insert(queryTokens[i] + " " + queryTokens[i + 1]) } }
        var hits: [DocumentHit] = []
        for item in all {
            let shared = querySet.intersection(item.tokens)
            guard !shared.isEmpty else { continue }
            var score = shared.reduce(0.0) { $0 + idf($1) }
            if !queryPairs.isEmpty, item.tokens.count >= 2 {
                for i in 0..<(item.tokens.count - 1) where queryPairs.contains(item.tokens[i] + " " + item.tokens[i + 1]) { score += 1.5 }
            }
            // Coverage: a passage holding most of the query's words beats a long one that grazes it.
            score *= 0.5 + Double(shared.count) / Double(querySet.count)
            hits.append(DocumentHit(page: item.page, passage: item.text, score: score))
        }
        return Array(hits.sorted { $0.score > $1.score }.prefix(count))
    }

    /// A run of a few words from the passage that an app's find box will land on: the window
    /// with the longest words, no digits-only tokens, and plain characters (quotes and dashes
    /// vary between what the pdf holds and what the reader extracted).
    public static func distinctivePhrase(in passage: String, words count: Int = 5, preferring query: String? = nil) -> String {
        let cleaned = passage.replacingOccurrences(of: #"[“”"‘’'()\[\]{}]"#, with: "", options: .regularExpression)
        let words = cleaned.split(separator: " ").map(String.init).filter { !$0.isEmpty }
        guard !words.isEmpty else { return "" }
        guard words.count > count else { return words.joined(separator: " ") }
        let wanted = Set(tokens(query ?? ""))
        var best = 0, bestScore = -1.0
        for start in 0...(words.count - count) {
            let window = words[start..<(start + count)]
            var score = 0.0
            var plain = true
            for word in window {
                let letters = word.filter { $0.isLetter }
                if letters.count < max(2, word.count / 2) { plain = false }
                score += Double(min(letters.count, 10))
                if wanted.contains(word.lowercased().trimmingCharacters(in: .punctuationCharacters)) { score += 6 }
                if word.contains(where: { "-–—/:;,.!?".contains($0) }) { score -= 2 }
            }
            guard plain else { continue }
            if score > bestScore { bestScore = score; best = start }
        }
        var phrase = words[best..<(best + count)].joined(separator: " ")
        phrase = phrase.trimmingCharacters(in: .punctuationCharacters.union(.whitespaces))
        return phrase
    }

    /// Whether `haystack` holds `phrase`, ignoring case, quote and dash styles, and runs of spaces.
    public static func contains(_ haystack: String, phrase: String) -> Bool {
        let a = normalize(haystack), b = normalize(phrase)
        guard !b.isEmpty else { return false }
        return a.contains(b)
    }

    public static func normalize(_ text: String) -> String {
        text.lowercased()
            .replacingOccurrences(of: #"[“”"‘’'`]"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"[–—\-]"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"[^a-z0-9 ]"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
    }
}
