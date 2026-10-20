import Foundation

/// An agent's final message, split into what to show and the turn contract it ends with (TC-01 to
/// TC-04, TC-06). HeyClicky's agents end every turn with SUMMARY, NEXT_ACTIONS, DONE_TITLE, ARTIFACTS
/// and ROUTINE blocks (C55 to C61); Dot's agents write them as plain lines:
///
///     Done: <two to five words naming the outcome>
///     Next: <an offer under 40 characters>           up to four; none when it asks him something
///     Files: <a path or URL it made>                  one per line, up to eight
///     Routine: {"action":"create","title":"...","when":"...","task":"...","mode":"watch"}
///     Notify: yes|no                                  a watch run: whether something needs him (07)
///
/// The lines close the message in any order, with blank lines between them allowed; the same words
/// higher up are the body's own. Every line of the block leaves the body, and a value that does
/// not fit its line (a title of six words, a file that is a sentence, bad routine JSON) is dropped.
public struct AgentResult: Equatable {
    public let body: String
    /// The row's line and the turn's header: "Peptides Report", not "Researched peptides".
    public let doneTitle: String?
    /// Offers the notch and Home show as buttons; tapping one sends the phrase back to the agent.
    public let nextActions: [String]
    /// Paths (with ~ expanded) and URLs, in the agent's order; not yet checked to exist (see
    /// `TurnArtifacts.merge`). A relative path is relative to the agent's folder.
    public let files: [String]
    public let routine: RoutineCommand?
    /// The body asks him something: its last line or its first sentence ends in a question mark
    /// (HeyClicky makes the SUMMARY the main question on such a turn, TC-05). Such a turn carries
    /// no next actions; any the agent wrote anyway are dropped.
    public let isQuestion: Bool
    /// A watch run's verdict (07): yes when something needs him (a reply owed, a decision, a change he must act
    /// on), no when not; nil when the line is missing or unreadable, which a watch run takes as no.
    public let notify: Bool?

    /// The first next action, for callers from before there were four.
    public var nextAction: String? { nextActions.first }

    public static let maxNextActions = 4
    public static let nextActionLength = 40
    /// Past this a "Next:" line is a paragraph, not an offer, and is dropped (the old parser's cap).
    public static let nextActionDropLength = 120
    public static let maxTitleWords = 5
    public static let maxFiles = 8

    public init(body: String, doneTitle: String? = nil, nextActions: [String] = [], files: [String] = [],
                routine: RoutineCommand? = nil, isQuestion: Bool = false, notify: Bool? = nil) {
        self.body = body
        self.doneTitle = doneTitle
        self.nextActions = nextActions
        self.files = files
        self.routine = routine
        self.isQuestion = isQuestion
        self.notify = notify
    }

    enum Key { case next, done, files, routine, notify }

    /// A contract line: the key, optionally after a list marker and in bold ("- **Next:** ..."), a colon, the value.
    static let contractLine = try! NSRegularExpression(
        pattern: #"^(?:[-*•]\s+)?\**\s*(next(?:\s+(?:step|action))?|done|files?|routine|notify)\s*\**\s*:\s*\**\s*(.*?)\s*$"#,
        options: [.caseInsensitive])

    static func contract(_ line: String) -> (Key, String)? {
        let ns = line as NSString
        guard let m = contractLine.firstMatch(in: line, range: NSRange(location: 0, length: ns.length)) else { return nil }
        let word = ns.substring(with: m.range(at: 1)).lowercased()
        let value = ns.substring(with: m.range(at: 2))
        let key: Key = word.hasPrefix("next") ? .next : word == "done" ? .done : word.hasPrefix("file") ? .files : word == "notify" ? .notify : .routine
        return (key, value)
    }

    public static func parse(_ text: String) -> AgentResult {
        var lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        // The trailing block, read bottom up and kept in the order written.
        var block: [(Key, String)] = []
        while let last = lines.last {
            let trimmed = last.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { lines.removeLast(); continue }
            guard let line = contract(trimmed) else { break }
            block.insert(line, at: 0)
            lines.removeLast()
        }
        var body = lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)

        var title: String?
        var doneValue: String?
        var next: [String] = []
        var files: [String] = []
        var routine: RoutineCommand?
        var notify: Bool?
        for (key, value) in block {
            switch key {
            case .done:
                if doneValue == nil { doneValue = value }
                if title == nil { title = doneTitle(value) }
            case .next:
                if let offer = nextAction(value), next.count < maxNextActions, !next.contains(where: { $0.lowercased() == offer.lowercased() }) {
                    next.append(offer)
                }
            case .files:
                if let path = filePath(value), files.count < maxFiles, !files.contains(path) { files.append(path) }
            case .routine:
                if routine == nil { routine = RoutineCommand.parse(json: unwrapped(value)) }
            case .notify:
                if notify == nil { notify = notifyValue(value) }
            }
        }
        // A message that was only its Done line ("Done: it's on your desktop.") keeps it as the body.
        if body.isEmpty, let doneValue { body = doneValue.trimmingCharacters(in: .whitespaces) }
        let question = asks(body)
        return AgentResult(body: body, doneTitle: title, nextActions: question ? [] : next, files: files, routine: routine, isQuestion: question,
                           notify: notify)
    }

    /// "yes", "Yes.", "**no**", "true": the first word decides; anything else is unreadable (nil).
    static func notifyValue(_ value: String) -> Bool? {
        let word = trimmingEnd(unwrapped(value), ".!,;:").lowercased().split(separator: " ").first.map(String.init) ?? ""
        switch word {
        case "yes", "y", "true": return true
        case "no", "n", "false": return false
        default: return nil
        }
    }

    // MARK: Values

    /// Wrapping quotes, backticks, angle brackets and bold off.
    static func unwrapped(_ value: String) -> String {
        var s = value.trimmingCharacters(in: .whitespaces)
        for (open, close) in [("**", "**"), ("`", "`"), ("\"", "\""), ("'", "'"), ("“", "”"), ("<", ">")] {
            if s.count >= open.count + close.count, s.hasPrefix(open), s.hasSuffix(close) {
                s = String(s.dropFirst(open.count).dropLast(close.count)).trimmingCharacters(in: .whitespaces)
            }
        }
        return s
    }

    static func collapsed(_ s: String) -> String {
        s.components(separatedBy: .whitespaces).filter { !$0.isEmpty }.joined(separator: " ")
    }

    static func trimmingEnd(_ s: String, _ marks: String) -> String {
        var t = s
        while let last = t.last, marks.contains(last) { t.removeLast() }
        return t.trimmingCharacters(in: .whitespaces)
    }

    /// One to five words; a longer value is a sentence, not a title, and is dropped.
    static func doneTitle(_ value: String) -> String? {
        let s = trimmingEnd(collapsed(unwrapped(value)), ".!,;:")
        let words = s.split(separator: " ").count
        return (1...maxTitleWords).contains(words) ? s : nil
    }

    static let joinerWords: Set<String> = ["a", "an", "the", "and", "or", "to", "of", "for", "in", "on", "with", "from", "by", "at", "into", "about", "vs", "versus", "plus"]

    /// An offer as a button shows it: no numbering, quotes or end punctuation, under 40 characters.
    /// A longer one is cut at the last word that fits, minus a dangling "and" or "the"; one past 120
    /// characters, or one word longer than 40, is dropped.
    static func nextAction(_ value: String) -> String? {
        var s = collapsed(unwrapped(value))
        s = s.replacingOccurrences(of: #"^\d+[.)]\s+"#, with: "", options: .regularExpression)
        s = trimmingEnd(unwrapped(s), ".,;:!")
        guard !s.isEmpty, s.count <= nextActionDropLength else { return nil }
        guard s.count > nextActionLength else { return s }
        var kept: [Substring] = []
        var length = 0
        for word in s.split(separator: " ") {
            let added = length == 0 ? word.count : length + 1 + word.count
            if added > nextActionLength { break }
            kept.append(word)
            length = added
        }
        while let last = kept.last, joinerWords.contains(last.lowercased().trimmingCharacters(in: .punctuationCharacters)) || last.allSatisfy({ ",;:-(".contains($0) }) {
            kept.removeLast()
        }
        let cut = trimmingEnd(kept.joined(separator: " "), ",;:-(")
        return cut.isEmpty ? nil : cut
    }

    static let noFiles: Set<String> = ["none", "n/a", "na", "-", "nothing", "no files"]

    /// A path (~ expanded, file: URLs as paths) or a web URL; a value that reads as a sentence is dropped.
    static func filePath(_ value: String) -> String? {
        var s = unwrapped(value)
        // A markdown link: the target.
        if let m = s.range(of: #"^\[[^\]]*\]\(([^)]+)\)$"#, options: .regularExpression) {
            let link = String(s[m])
            if let open = link.lastIndex(of: "(") { s = String(link[link.index(after: open)...].dropLast()) }
        }
        s = unwrapped(s)
        guard !s.isEmpty, !noFiles.contains(s.lowercased()) else { return nil }
        let lowered = s.lowercased()
        if lowered.hasPrefix("http://") || lowered.hasPrefix("https://") { return s.contains(" ") ? nil : s }
        if lowered.hasPrefix("file://") { return URL(string: s)?.path }
        if s.hasPrefix("~") { return (s as NSString).expandingTildeInPath }
        let pathLike = s.hasPrefix("/") || s.hasPrefix("./") || s.hasPrefix("../")
            || (!s.contains(where: { $0.isWhitespace }) && (s.contains("/") || s.contains(".")))
        return pathLike ? s : nil
    }

    // MARK: Question turns

    /// The body's last line, or its first sentence, ends in "?" (after closing quotes, brackets or bold).
    static func asks(_ body: String) -> Bool {
        let lines = body.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        guard let last = lines.last else { return false }
        if endsInQuestion(last) { return true }
        var splitter = SentenceSplitter()
        if let first = splitter.feed(body + " ").first, endsInQuestion(first) { return true }
        return false
    }

    static func endsInQuestion(_ text: String) -> Bool {
        trimmingEnd(text, "*_)]\"'”’`").hasSuffix("?")
    }
}

extension TurnArtifacts {
    /// The files a turn shows (TC-04): the ones the agent named first, in its order, then the files
    /// it made in its output folder; only paths that exist (a web URL passes), each once, at most
    /// eight. `folder` resolves a relative path (the agent's folder, where it runs); `exists` is the
    /// check, replaceable in tests.
    public static func merge(stated: [String], made: [URL], folder: URL?, limit: Int = AgentResult.maxFiles,
                             exists: (String) -> Bool = { FileManager.default.fileExists(atPath: $0) }) -> [URL] {
        var out: [URL] = []
        var seen: Set<String> = []
        func add(_ url: URL) {
            guard out.count < limit else { return }
            let key: String
            if url.isFileURL {
                guard exists(url.path) else { return }
                key = url.resolvingSymlinksInPath().standardizedFileURL.path
            } else {
                key = url.absoluteString
            }
            guard seen.insert(key).inserted else { return }
            out.append(url)
        }
        for value in stated {
            let lowered = value.lowercased()
            if lowered.hasPrefix("http://") || lowered.hasPrefix("https://") {
                if let url = URL(string: value) { add(url) }
                continue
            }
            let expanded = (value as NSString).expandingTildeInPath
            if expanded.hasPrefix("/") {
                add(URL(fileURLWithPath: expanded).standardizedFileURL)
            } else if let folder {
                add(folder.appendingPathComponent(expanded).standardizedFileURL)
            }
        }
        for url in made { add(url.standardizedFileURL) }
        return out
    }
}
