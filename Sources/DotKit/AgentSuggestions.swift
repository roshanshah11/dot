import Foundation

/// Agents suggested from his own asks (parity AG-17): once a week Dot reads the last 14 days of what he asked it
/// (~/Dot/transcripts/transcripts.jsonl), finds the asks he made three or more times that none of his agents owns
/// ("check Handshake postings", five times), and offers to start an agent for each: Start agent or Not now. Not now
/// on the same pattern is remembered for 30 days.
public enum AgentSuggestions {
    public struct Ask: Equatable {
        public let at: Date
        public let text: String
        /// talk, typed or job (an ask that became a job is work by definition).
        public let kind: String
        public init(at: Date, text: String, kind: String = "talk") { self.at = at; self.text = text; self.kind = kind }
    }

    public struct Suggestion: Equatable {
        /// The pattern's words, sorted: what Not now remembers.
        public let key: String
        /// Two or three words for the agent ("Handshake Postings").
        public let name: String
        public let count: Int
        /// His newest ask in the pattern, as he said it.
        public let example: String
        /// Up to three of his asks, newest first.
        public let examples: [String]

        /// The card's line.
        public var line: String { "You asked me to \(Self.lowered(example)) \(count) times in two weeks. Start an agent for it?" }

        /// The first brief of the agent it founds.
        public var brief: String {
            "He has asked Dot for this \(count) times in the last two weeks, so you are the agent for it now. His asks, newest first:\n"
                + examples.map { "- \($0)" }.joined(separator: "\n")
                + "\nDo it once now, write in your CLAUDE.md that this is your job and how he likes it, and offer a routine if it is something he checks on a schedule."
        }

        static func lowered(_ s: String) -> String {
            var t = s.trimmingCharacters(in: .whitespacesAndNewlines.union(.punctuationCharacters))
            for lead in ["can you ", "could you ", "please ", "hey dot ", "dot ", "hey "] where t.lowercased().hasPrefix(lead) { t = String(t.dropFirst(lead.count)) }
            guard let first = t.first else { return t }
            return first.lowercased() + t.dropFirst()
        }
    }

    public static let window: TimeInterval = 14 * 86400
    public static let minCount = 3
    public static let snooze: TimeInterval = 30 * 86400

    /// Words that say nothing about the task.
    static let stopwords: Set<String> = [
        "the", "and", "for", "you", "your", "with", "that", "this", "what", "whats", "what's", "how", "can", "could", "would", "please", "dot",
        "hey", "about", "from", "into", "are", "was", "were", "have", "has", "had", "does", "did", "doing", "just", "like", "get", "got", "give",
        "tell", "show", "explain", "make", "made", "draw", "open", "look", "see", "need", "want", "let", "lets", "let's", "now", "today", "again",
        "some", "any", "all", "out", "there", "here", "then", "them", "they", "its", "it's", "our", "my", "mine", "me", "him", "her", "his",
        "one", "too", "very", "really", "also", "okay", "yeah", "yes", "not", "don't", "dont", "it", "is", "of", "to", "in", "on", "at", "a", "an",
        "or", "be", "do", "go", "i", "i'm", "im", "so", "up", "if", "when", "which", "who", "why", "where", "thing", "things", "something", "stuff",
        "screen", "page", "window", "help", "mean", "means", "work", "works", "right", "think", "know", "say", "said", "use", "using",
        "new", "anything", "latest", "update", "updates",
    ]

    /// An ask's content words, lightly stemmed.
    public static func words(_ text: String) -> Set<String> {
        let raw = text.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber && $0 != "'" }).map(String.init)
        return Set(raw.filter { $0.count >= 3 && !stopwords.contains($0) }.map(stem))
    }

    static func stem(_ w: String) -> String {
        for suffix in ["ings", "ing", "ies", "es", "ed", "s"] where w.count > suffix.count + 3 && w.hasSuffix(suffix) {
            return String(w.dropLast(suffix.count)) + (suffix == "ies" ? "y" : "")
        }
        return w
    }

    /// Verbs of work an agent does on its own and again.
    static let workVerbs: Set<String> = [
        "check", "find", "download", "draft", "reply", "email", "mail", "track", "watch", "monitor", "collect", "gather", "research",
        "summarize", "summarise", "organize", "organise", "sort", "file", "apply", "schedule", "book", "remind", "fill", "scrape",
        "pull", "compile", "search", "send", "post", "write", "update", "clean", "save", "export", "follow", "list", "look", "prep",
        "prepare", "build", "make", "plan", "review", "grab", "fetch", "log", "record", "add", "move", "copy", "upload", "submit",
    ]

    /// What marks an ask as teaching, a correction, or something Dot does on screen in the moment: never an agent.
    static let notWork = ["explain", "walk me through", "why ", "what is", "what's the difference", "how does", "how do i", "prove",
                          "confused", "understand", "draw", "board", "panel", "quiz", "i meant", " no,", " no ", "turn my", "turn on", "turn off",
                          "mean", "he answered", "what does", "teach", "help me understand", "graph", "diagram", "figure"]

    /// Half the asks in a pattern name work (a verb of work early on, or a job), and few are teaching or in-the-moment.
    static func isAgentWork(_ asks: [Ask]) -> Bool {
        let work = asks.filter { ask in
            ask.kind == "job" || ask.text.lowercased().split(whereSeparator: { !$0.isLetter }).prefix(12).contains { workVerbs.contains(String($0)) }
        }.count
        let teach = asks.filter { ask in let t = " " + ask.text.lowercased() + " "; return notWork.contains { t.contains($0) } }.count
        return work * 2 >= asks.count && teach * 3 < asks.count
    }

    /// A habit, not one ask retried: the asks spread over more than half a day.
    static func spansDays(_ times: [Date]) -> Bool {
        guard let first = times.min(), let last = times.max() else { return false }
        return last.timeIntervalSince(first) >= 12 * 3600
    }

    /// Two asks are the same task when they share most of their content words.
    static func similar(_ a: Set<String>, _ b: Set<String>) -> Bool {
        let shared = a.intersection(b).count
        guard shared >= 2 else { return false }
        return Double(shared) / Double(a.union(b).count) >= 0.4 || shared >= 3
    }

    /// The suggestions for this week. `owned`: each agent's name and what it is for (its CLAUDE.md and founding ask);
    /// `dismissed`: Not now by key, when.
    public static func sweep(asks: [Ask], owned: [String], dismissed: [String: Date], now: Date) -> [Suggestion] {
        let recent = asks.filter { now.timeIntervalSince($0.at) <= window && $0.at <= now && $0.kind != "lecture" && !$0.text.hasPrefix("he answered") }
            .map { (ask: $0, words: words($0.text)) }
            .filter { $0.words.count >= 2 }
            .sorted { $0.ask.at > $1.ask.at }
        // greedy clusters, newest ask first, each compared with its cluster's first ask
        var clusters: [[(ask: Ask, words: Set<String>)]] = []
        for item in recent {
            if let i = clusters.firstIndex(where: { similar($0[0].words, item.words) }) { clusters[i].append(item) } else { clusters.append([item]) }
        }
        let ownedWords = owned.map(words)
        var out: [Suggestion] = []
        for cluster in clusters where cluster.count >= minCount && isAgentWork(cluster.map(\.ask)) && spansDays(cluster.map(\.ask.at)) {
            // the pattern: words in three quarters of its asks (the two commonest when fewer qualify)
            var tally: [String: Int] = [:]
            for item in cluster { for w in item.words { tally[w, default: 0] += 1 } }
            let ranked = tally.sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }
            var core = ranked.filter { $0.value * 4 >= cluster.count * 3 }.map(\.key)
            if core.count < 2 { core = ranked.prefix(2).filter { $0.value * 2 >= cluster.count }.map(\.key) }
            guard core.count >= 2 else { continue }
            let key = core.prefix(4).sorted().joined(separator: " ")
            if let when = dismissed[key], now.timeIntervalSince(when) < snooze { continue }
            // an agent owns it when its own words carry most of the pattern
            let pattern = Set(core.prefix(4))
            if ownedWords.contains(where: { Double($0.intersection(pattern).count) >= Double(pattern.count) * 0.6 }) { continue }
            let texts = cluster.map(\.ask.text)
            let name = Self.name(from: texts[0], core: Array(core.prefix(2)))
            out.append(Suggestion(key: key, name: name, count: cluster.count, example: texts[0], examples: Array(texts.prefix(3))))
        }
        return out.sorted { $0.count > $1.count }
    }

    /// The agent's name in his own words: the pattern's words as his newest ask spells them ("Handshake Postings").
    static func name(from example: String, core: [String]) -> String {
        var seen: Set<String> = []
        var picked: [String] = []
        for token in example.split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init) {
            let s = stem(token.lowercased())
            guard core.contains(s), !seen.contains(s) else { continue }
            seen.insert(s)
            picked.append(token.prefix(1).uppercased() + token.dropFirst().lowercased())
        }
        return picked.isEmpty ? core.map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined(separator: " ") : picked.joined(separator: " ")
    }

    /// His asks from transcripts.jsonl lines (`you` and `ts`; empty asks skipped).
    public static func asks(jsonl: String) -> [Ask] {
        let iso = ISO8601DateFormatter()
        return jsonl.split(whereSeparator: \.isNewline).compactMap { line in
            guard let data = line.data(using: .utf8), let row = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                  let you = row["you"] as? String, !you.trimmingCharacters(in: .whitespaces).isEmpty,
                  let ts = row["ts"] as? String, let at = iso.date(from: ts) else { return nil }
            return Ask(at: at, text: you, kind: row["kind"] as? String ?? "talk")
        }
    }

    /// The sweep runs Sunday from 6 pm, once a week (a missed Sunday runs at the next chance after eight days).
    public static func isDue(lastSweep: Date?, now: Date, calendar: Calendar = .current) -> Bool {
        guard let last = lastSweep else { return isSundayEvening(now, calendar: calendar) }
        let since = now.timeIntervalSince(last)
        if since >= 8 * 86400 { return true }
        return since >= 6 * 86400 && isSundayEvening(now, calendar: calendar)
    }

    static func isSundayEvening(_ date: Date, calendar: Calendar) -> Bool {
        calendar.component(.weekday, from: date) == 1 && calendar.component(.hour, from: date) >= 18
    }
}
