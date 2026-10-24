import Foundation

/// Which of his courses something belongs to (round eight: per-course panel history and the "last time" recap).
/// The courses come from the course maps in ~/Dot/talk/context ("# MATH 20250 (Abstract Linear Algebra, ...)"): a window
/// title, URL or question naming the code or the course name decides it; otherwise the words of an explanation are
/// scored against each map's own vocabulary.
public struct CourseTag: Equatable {
    public let code: String        // "math20250"
    public let label: String       // "MATH 20250"
    public let name: String        // "Abstract Linear Algebra"
    let vocabulary: Set<String>

    /// A course from one context file; nil when its first heading names no course code.
    public init?(fileName: String, text: String) {
        guard let heading = text.split(separator: "\n").first(where: { $0.hasPrefix("#") }).map(String.init),
              let m = try? NSRegularExpression(pattern: #"^#+\s*([A-Za-z]{3,5})\s*(\d{5})\b\s*(.*)$"#).firstMatch(in: heading, range: NSRange(heading.startIndex..., in: heading)),
              let dept = Range(m.range(at: 1), in: heading), let num = Range(m.range(at: 2), in: heading), let rest = Range(m.range(at: 3), in: heading) else { return nil }
        let d = heading[dept].uppercased(), n = String(heading[num])
        code = d.lowercased() + n
        label = d + " " + n
        // "(Abstract Linear Algebra, UChicago, ...)" or ", Biotechnology for the 21st Century (UChicago, ...)"
        var tail = heading[rest].trimmingCharacters(in: .whitespaces)
        if tail.hasPrefix("(") { tail = String(tail.dropFirst()) } else if tail.hasPrefix(",") { tail = String(tail.dropFirst()).trimmingCharacters(in: .whitespaces) }
        name = String(tail.prefix { $0 != "," && $0 != "(" && $0 != ")" && $0 != ":" }).trimmingCharacters(in: .whitespaces)
        vocabulary = Set(Self.words(text))
    }

    static func words(_ text: String) -> [String] {
        text.lowercased().components(separatedBy: CharacterSet.letters.inverted).filter { $0.count >= 5 }
    }

    /// Does this text name the course outright: "MATH 20250", "math20250", "20250", or its name?
    public func isNamed(in text: String) -> Bool {
        let lower = text.lowercased()
        let digits = String(code.drop { $0.isLetter })
        if lower.range(of: #"(?<!\d)"# + digits + #"(?!\d)"#, options: .regularExpression) != nil { return true }
        return name.count >= 8 && lower.contains(name.lowercased())
    }

    /// The course these words belong to: one named in `context` (window title, URL, his question) wins; otherwise the
    /// course whose map shares the most distinctive words with `content`, when it is clearly ahead.
    public static func detect(context: String, content: String = "", among courses: [CourseTag]) -> CourseTag? {
        if let named = courses.first(where: { $0.isNamed(in: context) }) { return named }
        let words = Set(Self.words(context + " " + content)).subtracting(commonWords)
        guard !words.isEmpty, courses.count > 0 else { return nil }
        // a word counts for a course only when no other course's map has it too
        let scored = courses.map { course -> (CourseTag, Int) in
            let others = courses.filter { $0 != course }.reduce(into: Set<String>()) { $0.formUnion($1.vocabulary) }
            return (course, words.intersection(course.vocabulary.subtracting(others)).count)
        }.sorted { $0.1 > $1.1 }
        guard let best = scored.first, best.1 >= 3 else { return nil }
        if scored.count > 1, scored[1].1 * 2 > best.1 { return nil }
        return best.0
    }

    /// Words that say nothing about a subject: everyday English, school words every course shares, and a browser's
    /// chrome. On 2026-10-24 a chat page about bacteria scored for the math map on "canvas", "containing", "other",
    /// "positive" and "system" (a bookmark, "Menu containing hidden bookmarks", sidebar chat titles) because the
    /// longer map has more ordinary words, and the math map joined a biology conversation.
    static let commonWords: Set<String> = [
        // everyday English
        "about", "above", "after", "again", "against", "almost", "along", "already", "although", "always", "among",
        "another", "answer", "anything", "around", "because", "become", "before", "begin", "being", "below", "better",
        "between", "bring", "build", "building", "called", "cannot", "change", "changes", "could", "different", "doing",
        "during", "early", "either", "enough", "every", "example", "first", "follow", "found", "general", "given",
        "going", "great", "group", "having", "important", "include", "including", "instead", "itself", "large", "later",
        "least", "little", "looks", "making", "means", "might", "never", "number", "often", "order", "other", "others",
        "place", "point", "possible", "positive", "negative", "problem", "quick", "quite", "rather", "really", "right",
        "second", "seems", "several", "should", "shows", "since", "small", "something", "start", "state", "still",
        "their", "there", "these", "thing", "things", "think", "those", "though", "three", "through", "today",
        "together", "under", "until", "using", "various", "where", "which", "while", "whole", "would", "write",
        "years", "system", "systems", "simple", "connect", "private", "guide", "skills", "practice", "final", "finals",
        // school words every course has
        "class", "classes", "course", "courses", "lecture", "lectures", "notes", "review", "study", "homework",
        "midterm", "exams", "quizzes", "worksheet", "assignment", "assignments", "problems", "question", "questions",
        "solution", "solutions", "chapter", "section", "reading", "readings", "slides", "syllabus", "office", "hours",
        "explain", "uchicago", "autumn", "spring", "winter", "summer", "canvas",
        // a browser's and an app's chrome
        "button", "buttons", "window", "windows", "toolbar", "bookmark", "bookmarks", "containing", "hidden", "reload",
        "forward", "search", "share", "sidebar", "settings", "profile", "library", "projects", "recents", "pinned",
        "unpin", "explore", "plugins", "scheduled", "assistant", "summarize", "webpage", "current", "action", "actions",
        "comet", "chrome", "safari", "chatgpt", "claude", "google", "gmail", "outlook", "notion", "email", "inbox",
        "select", "selected", "click", "close", "dialog", "popup", "image", "images", "video", "account", "login",
        "logout", "password", "update", "upload", "download", "refresh", "enable", "disable", "voice", "dictation",
        "switch", "toggle", "option", "options", "filter", "display", "screen", "scroll", "pages", "label", "title",
        "untitled", "document", "documents", "folder", "files", "insert", "format", "tools", "privacy", "terms",
        "cookie", "cookies", "notifications", "messages", "message", "chats", "people", "static", "statictext",
        "popupbutton", "remaining"
    ]

    /// Every course map in a context folder.
    public static func load(from folder: URL) -> [CourseTag] {
        guard let names = try? FileManager.default.contentsOfDirectory(atPath: folder.path) else { return [] }
        return names.filter { $0.hasSuffix(".md") }.sorted().compactMap { name in
            (try? String(contentsOf: folder.appendingPathComponent(name), encoding: .utf8)).flatMap { CourseTag(fileName: name, text: $0) }
        }
    }
}
