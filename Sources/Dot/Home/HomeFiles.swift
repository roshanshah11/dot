import Foundation

// The files the Home pages read and write. Foundation only, so they can be checked outside the app.

/// His dictation dictionary as the editor sees it: the grammar DictationDictionary reads
/// (`# comment`, `heard => correct` or `heard -> correct`, bare terms), with comments kept.
struct DictionaryFile: Equatable {
    struct Entry: Identifiable, Equatable {
        var id = UUID()
        /// Empty for a bare term.
        var heard: String
        var correct: String

        /// The line this row writes, or nil when it has nothing to write.
        var line: String? {
            let heard = heard.trimmingCharacters(in: .whitespaces)
            let correct = correct.trimmingCharacters(in: .whitespaces)
            guard !correct.isEmpty else { return nil }
            return isRule ? "\(heard) => \(correct)" : correct
        }

        /// Same test as DictationDictionary.line(forHeard:correct:): a hearing equal to the
        /// spelling is just a term.
        var isRule: Bool {
            let heard = heard.trimmingCharacters(in: .whitespaces)
            return !heard.isEmpty && heard.lowercased() != correct.trimmingCharacters(in: .whitespaces).lowercased()
        }
    }

    var comments: [String] = []
    var entries: [Entry] = []

    init() {}

    init(text: String) {
        for raw in text.components(separatedBy: .newlines) {
            let line = raw.trimmingCharacters(in: .whitespaces)
            guard !line.isEmpty else { continue }
            if line.hasPrefix("#") {
                comments.append(line)
            } else if let range = line.range(of: "=>") ?? line.range(of: "->") {
                let heard = line[..<range.lowerBound].trimmingCharacters(in: .whitespaces)
                let correct = line[range.upperBound...].trimmingCharacters(in: .whitespaces)
                // A half-written rule stays visible so he can finish it; the writer drops it if he does not.
                entries.append(Entry(heard: heard, correct: correct))
            } else {
                entries.append(Entry(heard: "", correct: line))
            }
        }
    }

    /// Comments first, then corrections, then bare terms, one per line.
    var text: String {
        let rules = entries.filter(\.isRule).compactMap(\.line)
        let terms = entries.filter { !$0.isRule }.compactMap(\.line)
        let lines = comments + rules + terms
        return lines.isEmpty ? "" : lines.joined(separator: "\n") + "\n"
    }

    /// Lines Dot appended to the file since `base` was read ("add x to my dictionary"), so a
    /// save from the editor keeps them instead of writing over them.
    static func appended(on disk: DictionaryFile, since base: DictionaryFile) -> DictionaryFile {
        var out = DictionaryFile()
        let known = Set(base.entries.compactMap(\.line))
        out.comments = disk.comments.filter { !base.comments.contains($0) }
        out.entries = disk.entries.filter { $0.line.map { !known.contains($0) } ?? false }
        return out
    }
}

/// One skill under ~/.claude/skills, from its SKILL.md frontmatter.
struct SkillEntry: Identifiable, Equatable {
    let folder: URL
    let name: String
    let description: String
    var id: String { folder.path }

    var firstSentence: String { Self.firstSentence(description) }

    static func load(from root: URL) -> [SkillEntry] {
        guard let names = try? FileManager.default.contentsOfDirectory(atPath: root.path) else { return [] }
        return names.filter { !$0.hasPrefix(".") }.compactMap { folderName -> SkillEntry? in
            let folder = root.appendingPathComponent(folderName, isDirectory: true)
            guard let text = try? String(contentsOf: folder.appendingPathComponent("SKILL.md"), encoding: .utf8) else { return nil }
            let fields = frontmatter(text)
            let name = fields["name"].flatMap { $0.isEmpty ? nil : $0 } ?? folderName
            return SkillEntry(folder: folder, name: name, description: fields["description"] ?? "")
        }
        .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    /// Top-level `key: value` pairs between the first two `---` lines. Indented lines continue the
    /// key above them, which covers the `>` and `|` blocks and wrapped quotes some skills use.
    static func frontmatter(_ text: String) -> [String: String] {
        let lines = text.components(separatedBy: "\n").map { $0.hasSuffix("\r") ? String($0.dropLast()) : $0 }
        guard lines.first?.trimmingCharacters(in: .whitespaces) == "---" else { return [:] }
        var fields: [String: String] = [:]
        var key: String?
        var head = ""
        var rest: [String] = []

        func finish() {
            guard let key else { return }
            fields[key] = value(head: head, continuation: rest)
        }

        for line in lines.dropFirst() {
            if line.trimmingCharacters(in: .whitespaces) == "---" { break }
            if let first = line.first, first != " ", first != "\t", let colon = line.firstIndex(of: ":") {
                finish()
                key = String(line[..<colon]).trimmingCharacters(in: .whitespaces)
                head = String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
                rest = []
            } else if key != nil {
                rest.append(line)
            }
        }
        finish()
        return fields
    }

    private static func value(head: String, continuation: [String]) -> String {
        let body = continuation.map { $0.trimmingCharacters(in: .whitespaces) }
        if let indicator = head.first, indicator == ">" || indicator == "|", head.count <= 2 {
            // Folded blocks read as one paragraph per blank-line gap; literal blocks keep their lines.
            let trimmed = Array(body.reversed().drop(while: { $0.isEmpty }).reversed())
            if indicator == "|" { return trimmed.joined(separator: "\n") }
            return trimmed.split(separator: "", omittingEmptySubsequences: true).map { $0.joined(separator: " ") }.joined(separator: "\n")
        }
        let joined = ([head] + body.filter { !$0.isEmpty }).joined(separator: " ")
        if joined.count >= 2, joined.hasPrefix("\""), joined.hasSuffix("\"") {
            return String(joined.dropFirst().dropLast()).replacingOccurrences(of: "\\\"", with: "\"").replacingOccurrences(of: "\\\\", with: "\\")
        }
        if joined.count >= 2, joined.hasPrefix("'"), joined.hasSuffix("'") {
            return String(joined.dropFirst().dropLast()).replacingOccurrences(of: "''", with: "'")
        }
        return joined
    }

    /// Up to the first full stop that ends a sentence: one followed by a space or the end, after
    /// any closing quote or bracket, and not the stop in "e.g." or "i.e.".
    static func firstSentence(_ text: String) -> String {
        let flat = text.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespaces)
        let chars = Array(flat)
        var i = 0
        while i < chars.count {
            if ".!?".contains(chars[i]) {
                var end = i + 1
                while end < chars.count, "\"'\u{201D}\u{2019})".contains(chars[end]) { end += 1 }
                let before = String(chars[max(0, i - 3)..<i]).lowercased()
                let abbreviation = chars[i] == "." && (before.hasSuffix("e.g") || before.hasSuffix("i.e") || before.hasSuffix(" vs"))
                if !abbreviation, end == chars.count || chars[end] == " " {
                    return String(chars[0..<end])
                }
            }
            i += 1
        }
        return flat
    }
}

/// One answer to an offer, from ~/Dot/suggestions.json:
/// `{"decisions":[{"date":"2026-10-16","key":"reply:...","text":"...","decision":"yes"}]}`.
struct SuggestionDecision: Identifiable, Equatable {
    /// Position in the file; later rows are newer when two share a date.
    let id: Int
    let date: String
    let key: String
    let text: String
    let decision: String

    /// Newest first. A missing or unreadable file is an empty history.
    static func load(_ url: URL) -> [SuggestionDecision] {
        guard let data = try? Data(contentsOf: url),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rows = object["decisions"] as? [[String: Any]] else { return [] }
        return rows.enumerated().map { index, row in
            func field(_ name: String) -> String { (row[name] as? String) ?? "" }
            return SuggestionDecision(id: index, date: field("date"), key: field("key"), text: field("text"), decision: field("decision"))
        }
        .sorted { $0.date != $1.date ? $0.date > $1.date : $0.id > $1.id }
    }
}
