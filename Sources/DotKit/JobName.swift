import Foundation

/// A two-word name for a new job's agent, made from its brief when nothing named it (a held-shift handoff, an
/// [AGENT] tag with no name): "Nomura Application", "Amazon Cable". Every new job gets its own agent under such a
/// name, so two jobs run side by side and the task bar says which is which (2026-10-17: a second job was poured
/// into the one agent called "Dot", which read as Dot itself).
public enum JobName {
    /// Words that never name a job: fillers, his and Dot's names, the browser and tools a job runs in.
    static let skip: Set<String> = [
        "a", "an", "the", "and", "or", "but", "to", "of", "in", "on", "at", "for", "with", "from", "by", "into", "onto", "about",
        "hey", "hi", "hello", "ok", "okay", "so", "um", "uh", "like", "please", "thanks", "just", "also", "then", "now", "today",
        "tonight", "tomorrow", "can", "could", "would", "will", "should", "need", "needs", "want", "wants", "get", "got", "do", "does",
        "doing", "done", "make", "made", "go", "goes", "work", "working", "start", "help", "find", "look", "check", "see", "use", "using",
        "put", "take", "give", "write", "draft", "send", "run", "open", "set", "keep", "have", "has", "had", "is", "are", "was", "be",
        "it", "its", "it's", "this", "that", "these", "those", "there", "here", "what", "which", "who", "how", "why", "when", "where",
        "i", "i'm", "i'll", "me", "my", "mine", "you", "your", "he", "he's", "his", "him", "she", "her", "they", "their", "them", "we", "our",
        "dot", "roshan", "roshan's", "agent", "agents", "another", "separate", "new", "one", "thing", "things", "stuff", "something",
        "comet", "chrome", "safari", "browser", "tab", "window", "page", "pages", "site", "sites", "web", "perplexity", "atlas", "claude",
        "cmux", "terminal", "app", "screen", "currently", "blank", "very", "all", "any", "every", "some", "more", "most", "less",
        "due", "saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "pm", "am", "week", "next", "last",
        "good", "best", "well", "reviewed", "reasonably", "high", "certainty", "likely", "up", "down", "out", "over", "not", "no", "yes",
    ]

    /// What a job is: the second word of the name when the brief has one, earliest first.
    static let jobNouns: [String] = [
        "application", "applications", "essay", "essays", "cover", "letter", "resume", "email", "emails", "reply", "replies", "inbox",
        "deck", "slides", "memo", "brief", "briefs", "pitch", "model", "dcf", "lbo", "comps", "valuation", "screen", "research", "report",
        "summary", "notes", "study", "homework", "problem", "proof", "review", "plan", "schedule", "calendar", "trip", "flight", "hotel",
        "booking", "order", "purchase", "cable", "charger", "gift", "budget", "tracker", "spreadsheet", "list", "website", "post", "video",
        "outreach", "networking", "prep", "interview", "form", "forms", "postings", "jobs", "fix", "bug", "build", "setup", "backup",
    ]

    /// The name for a brief, kept apart from `taken` (lowercased names already on the roster and busy) by a number.
    public static func make(from brief: String, taken: Set<String> = []) -> String {
        var name = base(brief)
        if taken.contains(name.lowercased()) {
            var n = 2
            while taken.contains("\(name) \(n)".lowercased()) { n += 1 }
            name = "\(name) \(n)"
        }
        return name
    }

    static func base(_ brief: String) -> String {
        let text = brief.replacingOccurrences(of: "\u{2019}", with: "'")
        // a site named in the brief is the strongest subject: "amazon.com" -> Amazon
        var proper: String?
        if let m = text.range(of: #"\b([A-Za-z0-9-]{3,})\.(com|org|net|io|co|edu|gov)\b"#, options: .regularExpression) {
            let host = String(text[m]).split(separator: ".").first.map(String.init) ?? ""
            if !skip.contains(host.lowercased()) { proper = host.prefix(1).uppercased() + host.dropFirst().lowercased() }
        }
        let words = text.components(separatedBy: CharacterSet(charactersIn: " \t\n,;:()[]{}\"!?/")).map {
            $0.trimmingCharacters(in: CharacterSet(charactersIn: ".'-"))
        }.filter { !$0.isEmpty }
        let lower = words.map { $0.lowercased() }
        if proper == nil {
            // a capitalized word that is not a filler: Nomura, Riverside, BlackRock
            // the first word is capitalized because it starts the sentence ("Record the Riverside..."), not because it names anything
            for (i, (w, l)) in zip(words, lower).enumerated() where i > 0 && l.count >= 3 && !skip.contains(l) && !l.hasSuffix("'s") {
                if let first = w.unicodeScalars.first, CharacterSet.uppercaseLetters.contains(first), !jobNouns.contains(l) {
                    proper = w.count <= 4 && w == w.uppercased() ? w : w.prefix(1).uppercased() + w.dropFirst()
                    break
                }
            }
        }
        let job = lower.first { jobNouns.contains($0) }
        let content = lower.filter { $0.count >= 3 && !skip.contains($0) && !$0.hasSuffix("'s") && Int($0) == nil }
        let first = proper ?? content.first { $0 != job }.map(title)
        let second = job.map(title) ?? content.first { title($0) != first }.map(title)
        let parts = [first, second].compactMap { $0 }
        return parts.isEmpty ? "New Job" : parts.joined(separator: " ")
    }

    static func title(_ w: String) -> String { w.prefix(1).uppercased() + w.dropFirst() }
}
