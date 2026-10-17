import Foundation

/// The check every model-written quip passes before it shows (docs/alive.md, round two): lowercase,
/// 60 characters or fewer, no emoji, quotes or markdown, and nothing the persona never says
/// (docs/persona.md): grades, money, looks, weight, the names of people in the context, "proud of you",
/// "you deserve", praise for his work, guilt trips. Anything else comes back nil and Dot uses the
/// written bank instead.
public enum QuipLine {
    /// The characters a line may use: plain lowercase text and light punctuation. Emoji, quotes,
    /// markdown, dashes as punctuation, "$" and "%" all fall outside it.
    static let allowed = Set("abcdefghijklmnopqrstuvwxyz0123456789 .,!?'-:;()&/")

    /// Off limits in any line, as words or phrases (persona's never-does list).
    static let banned: [String] = [
        // grades
        "grade", "grades", "graded", "gpa", "score", "scores", "scored", "curve", "flunk", "flunked",
        "straight a", "straight as", "an a", "a plus", "out of 100",
        // money
        "money", "cash", "broke", "rent", "salary", "paycheck", "dollar", "dollars", "bucks", "debt", "loan", "loans",
        "afford", "poor", "rich", "wallet", "budget", "savings", "bank account",
        // looks and weight
        "you look", "looking good", "your face", "your hair", "ugly", "handsome", "attractive", "outfit", "skin",
        "weight", "fat", "skinny", "chubby", "diet", "calorie", "calories", "pounds", "lbs",
        // flattery about his work
        "proud of you", "you deserve", "good job", "great job", "nice job", "great work", "good work", "nice work",
        "well done", "amazing", "brilliant", "genius", "perfect", "flawless", "masterpiece", "impressive", "incredible",
        "excellent", "nailed it", "killed it", "crushed it", "so smart", "smartest", "you're the best", "talented", "legend",
        // guilt and asking for care
        "miss me", "missed me", "you forgot", "forgot about me", "ignored me", "ignoring me", "lonely", "love you",
    ]

    private static let bannedPattern: NSRegularExpression = {
        let words = banned.map { NSRegularExpression.escapedPattern(for: $0) }.joined(separator: "|")
        // A letter grade ("a-", "b-") rides along with the words.
        return try! NSRegularExpression(pattern: "(?<![a-z0-9'])(?:\(words)|[abcdf]-)(?![a-z0-9])")
    }()

    /// The line ready to show, or nil when it fails any rule. `names` are people's names to keep out.
    public static func check(_ text: String, names: [String] = []) -> String? {
        let line = text.replacingOccurrences(of: "\u{2019}", with: "'").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !line.isEmpty, line.count <= Quips.maxLength, line == line.lowercased(),
              line.allSatisfy({ allowed.contains($0) }) else { return nil }
        // A wrapped line ('like this') is a quote; a leading dash is a list item.
        if line.hasPrefix("-") || (line.count > 1 && line.hasPrefix("'") && line.hasSuffix("'")) { return nil }
        let range = NSRange(location: 0, length: (line as NSString).length)
        if bannedPattern.firstMatch(in: line, range: range) != nil { return nil }
        for name in names {
            let pattern = "(?<![a-z0-9])\(NSRegularExpression.escapedPattern(for: name.lowercased()))(?![a-z0-9])"
            if (try? NSRegularExpression(pattern: pattern))?.firstMatch(in: line, range: range) != nil { return nil }
        }
        return line
    }

    /// The line for this context: the same check, with the context's people kept out.
    public static func check(_ text: String, for context: QuipContext) -> String? {
        check(text, names: context.names)
    }

    // MARK: Names

    /// People's names in the context's text, one word each, lowercased: runs of two or three
    /// capitalized words ("Sam Rivera", "Casey Park") and a capitalized word after "with", "call:",
    /// "→" and the like ("Coffee chat with Jordan Lee"). Course codes are capitals (MATH 20250) and
    /// common title words (Fixed Income Competition, Linear Algebra) are skipped, so course and event
    /// names stay sayable. A guess, not a parser: a missed name still meets the prompt's rule, and a
    /// word wrongly taken for one only sends Dot to the written bank.
    public static func names(in texts: [String]) -> [String] {
        var found: [String] = []
        func add(_ run: String) {
            let words = run.split(separator: " ").map { word -> String in
                var w = word.lowercased()
                if w.hasSuffix("'s") || w.hasSuffix("\u{2019}s") { w = String(w.dropLast(2)) }
                return w
            }
            for word in words where word.count >= 2 && !titleWords.contains(word) && !commonWords.contains(word) && !found.contains(word) {
                found.append(word)
            }
        }
        for text in texts {
            let ns = text as NSString
            let range = NSRange(location: 0, length: ns.length)
            for m in capitalizedRun.matches(in: text, range: range) {
                let run = ns.substring(with: m.range)
                // A run with a title word in it is a course, event, firm or app name, not a person.
                guard !run.split(separator: " ").contains(where: { titleWords.contains($0.lowercased()) }) else { continue }
                add(run)
            }
            for m in afterMarker.matches(in: text, range: range) { add(ns.substring(with: m.range(at: 1))) }
        }
        return found
    }

    private static let word = #"[A-Z][a-z]+(?:['’][a-z]+)?"#
    private static let capitalizedRun = try! NSRegularExpression(pattern: #"(?<![A-Za-z])"# + word + "(?: " + word + "){1,2}" + #"(?![A-Za-z])"#)
    private static let afterMarker = try! NSRegularExpression(pattern: #"(?:(?i:\b(?:with|w/|call:|chat:|dear|hi|hey|from|cc:?))|→|<>)\s+("# + word + "(?: " + word + ")?)")

    /// Capitalized words that are not people: academic subjects and event words, so course and event
    /// names stay sayable, plus apps, firms' common words, days and months.
    static let titleWords: Set<String> = [
        "the", "a", "an", "and", "of", "for", "with", "to", "in", "on", "at", "by", "or", "my", "your", "re", "fwd", "fw", "new", "untitled", "copy",
        "call", "coffee", "chat", "meeting", "sync", "standup", "interview", "superday", "exam", "midterm", "final", "finals", "test", "quiz",
        "problem", "set", "pset", "homework", "lab", "lecture", "section", "discussion", "seminar", "review", "session", "office", "hours",
        "class", "course", "reading", "paper", "essay", "draft", "notes", "slides", "deck", "chapter", "syllabus", "worksheet", "study", "drill",
        "info", "recruiting", "networking", "application", "applications", "deadline", "due", "submission", "competition", "case", "pitch",
        "club", "social", "practice", "brunch", "lunch", "dinner", "breakfast", "party", "workshop", "panel", "trek", "fair", "career", "event",
        "fund", "capital", "partners", "group", "bank", "banking", "investment", "investments", "analyst", "analysts", "associate", "associates",
        "summer", "internship", "program", "programs", "fellowship", "innovation", "fixed", "income", "equity", "research", "global", "team",
        "markets", "market", "management", "advisors", "advisory", "securities", "holdings", "company", "inc", "llc", "street",
        "algebra", "linear", "calculus", "analysis", "physics", "chemistry", "biology", "economics", "finance", "accounting", "statistics",
        "history", "humanities", "writing", "literature", "philosophy", "math", "mathematics", "computer", "science", "sciences", "theory",
        "intro", "introduction", "honors", "principles", "organic", "general", "micro", "macro", "microeconomics", "macroeconomics",
        "corporate", "valuation", "data", "structures", "programming", "probability", "discrete", "real", "abstract", "differential",
        "equations", "modern", "world", "american", "core", "elementary", "advanced", "methods", "models", "model", "comps", "dcf", "lbo",
        "university", "college", "school", "center", "hall", "house", "library", "room", "dance", "physical", "gym", "campus",
        "google", "docs", "sheets", "microsoft", "excel", "word", "powerpoint", "preview", "safari", "chrome", "comet", "messages", "mail",
        "calendar", "finder", "terminal", "claude", "dot", "atlas", "canvas", "gradescope", "linkedin", "handshake", "zoom", "teams", "slack",
        "inbox", "sent", "drafts", "document", "documents", "downloads", "desktop", "home", "settings",
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "mon", "tue", "wed", "thu", "fri", "sat", "sun",
        "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
        "today", "tomorrow", "tonight", "morning", "afternoon", "evening", "night", "week", "day",
    ]

    /// First names that are also everyday words; banning them would block ordinary lines ("u will").
    static let commonWords: Set<String> = [
        "will", "may", "mark", "grace", "hope", "joy", "faith", "frank", "max", "ray", "drew", "chase", "bill", "pat", "art", "sky",
        "dean", "jack", "page", "lane", "rose", "june", "summer", "young", "king", "long", "price", "rice", "gold", "white", "black",
        "brown", "green", "wood", "hill", "rich", "sage", "rob", "sue", "gene", "skip", "dawn", "eve", "mike",
    ]
}
