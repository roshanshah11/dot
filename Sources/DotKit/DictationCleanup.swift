import Foundation

/// Where dictated text is about to land (parity DI-01): read through accessibility just before inserting.
public struct DictationField: Equatable {
    public var app: String
    public var bundleID: String
    /// The page, when the app is a browser.
    public var url: String?
    /// The field's title, description or placeholder.
    public var label: String
    public var role: String
    /// Up to 300 characters before the cursor.
    public var before: String
    /// A few characters after the cursor (or the selection being replaced).
    public var after: String

    public init(app: String = "", bundleID: String = "", url: String? = nil, label: String = "", role: String = "",
                before: String = "", after: String = "") {
        self.app = app
        self.bundleID = bundleID
        self.url = url
        self.label = label
        self.role = role
        self.before = before
        self.after = after
    }

    public static let beforeLimit = 300

    /// A one-line box where a sentence's period doesn't belong: search, address, subject, to, names.
    public var isShortField: Bool {
        if role == "AXSearchField" || role == "AXComboBox" { return true }
        // The label's first word: "Search Google or type a URL", "Subject", "To recipients"; not "Add a comment to this".
        let first = label.lowercased().split(whereSeparator: { !$0.isLetter }).first.map(String.init) ?? ""
        return ["search", "subject", "address", "url", "to", "cc", "bcc", "title", "name", "find", "filter"].contains(first)
    }

    /// A terminal or code editor: what he says is often a command, so no added period.
    public var isCode: Bool {
        Self.codeApps.contains(bundleID) || ["terminal", "iterm", "ghostty", "warp", "xcode", "cursor", "zed", "visual studio code"]
            .contains { app.lowercased().contains($0) }
    }

    static let codeApps: Set<String> = [
        "com.apple.Terminal", "com.googlecode.iterm2", "com.mitchellh.ghostty", "dev.warp.Warp-Stable", "com.apple.dt.Xcode",
        "com.microsoft.VSCode", "com.todesktop.230313mzl4w4u92", "dev.zed.Zed", "com.cmuxterm.app",
    ]
}

/// The cleanup pass on dictated text (parity DI-02): fillers and false starts out, his dictionary applied, then
/// spacing, casing and the closing period fitted to the field. Local and immediate; it never rewords.
public enum DictationCleanup {
    public static func clean(_ raw: String, field: DictationField?, dictionary: DictationDictionary) -> String {
        var text = dropFillers(raw)
        text = dropRepeats(text)
        text = SpeechText.dictated(text)
        text = dictionary.apply(to: text)
        guard !text.isEmpty, let field else { return text }
        return fit(text, to: field, dictionary: dictionary)
    }

    // MARK: Fillers and false starts

    static let fillers = ["um", "umm", "uh", "uhh", "uhm", "erm", "er", "hmm", "mm"]

    /// "um", "uh" and their kin as whole words, with the comma the recognizer hangs on them.
    public static func dropFillers(_ text: String) -> String {
        let alternation = fillers.joined(separator: "|")
        var out = text.replacingOccurrences(of: "(?i)(?<![\\p{L}\\p{N}'])(?:\(alternation))(?![\\p{L}\\p{N}'])[,.]?", with: "",
                                            options: .regularExpression)
        out = out.replacingOccurrences(of: "\\s+([,.!?;:])", with: "$1", options: .regularExpression)
        out = out.replacingOccurrences(of: "^[\\s,]+", with: "", options: .regularExpression)
        out = out.replacingOccurrences(of: ",\\s*,", with: ",", options: .regularExpression)
        return out.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces)
    }

    /// Words said twice in a row by a false start: "the answer is the answer is 42" says it once. Runs of two to six
    /// words always; a single word only from a short list of stumbles ("I I think"), since "that that" can be meant.
    public static func dropRepeats(_ text: String) -> String {
        var words = text.split(separator: " ").map(String.init)
        func key(_ word: String) -> String { word.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "'" } }
        var changed = true
        while changed {
            changed = false
            outer: for size in stride(from: 6, through: 1, by: -1) where words.count >= size * 2 {
                for start in 0...(words.count - size * 2) {
                    let first = words[start..<start + size].map(key)
                    let second = words[start + size..<start + size * 2].map(key)
                    guard first == second, !first.contains("") else { continue }
                    if size == 1, !stumbles.contains(first[0]) { continue }
                    // "1 2 1 2" counting and "no no" answers keep their words.
                    if first.allSatisfy({ $0.allSatisfy(\.isNumber) }) { continue }
                    words.removeSubrange(start..<start + size)
                    changed = true
                    break outer
                }
            }
        }
        return words.joined(separator: " ")
    }

    static let stumbles: Set<String> = ["i", "the", "a", "an", "to", "and", "we", "so", "it", "my", "you", "of", "in", "for", "is", "i'm", "it's"]

    // MARK: Fitting the field

    /// Spacing against the text before the cursor, the first letter's case for mid-sentence, and no closing period
    /// in a short field, a terminal or the middle of a sentence.
    public static func fit(_ text: String, to field: DictationField, dictionary: DictationDictionary) -> String {
        var out = text
        let before = field.before
        let trimmedBefore = before.replacingOccurrences(of: "[ \\t]+$", with: "", options: .regularExpression)
        let startsSentence = trimmedBefore.isEmpty || trimmedBefore.hasSuffix("\n") || ".!?".contains(trimmedBefore.last ?? ".")
        if !startsSentence { out = lowerFirst(out, dictionary: dictionary) }
        let midSentence = field.after.first.map { $0.isLetter || $0.isNumber } ?? false
        if field.isShortField || field.isCode || midSentence || (!startsSentence && out.split(separator: " ").count < 4) {
            if out.hasSuffix("."), !out.hasSuffix("..") { out.removeLast() }
        }
        if let last = before.last, !last.isWhitespace, !"([{\"'/@#-".contains(last) { out = " " + out }
        if midSentence, !(out.last?.isWhitespace ?? true) { out += " " }
        return out
    }

    /// The recognizer capitalizes the first word of every utterance; mid-sentence, a common word goes back to lower
    /// case. Names, acronyms, "I" and his dictionary's terms keep theirs.
    static func lowerFirst(_ text: String, dictionary: DictationDictionary) -> String {
        let space = text.firstIndex(where: { !$0.isLetter && $0 != "'" }) ?? text.endIndex
        let word = String(text[..<space])
        guard word.count > 0, commonWords.contains(word.lowercased()), word.first?.isUppercase == true,
              word.dropFirst().allSatisfy({ !$0.isUppercase }),
              !dictionary.terms.contains(where: { $0 == word }), !dictionary.rules.contains(where: { $0.correct == word }) else { return text }
        return word.lowercased() + text[space...]
    }

    static let commonWords: Set<String> = [
        "the", "a", "an", "and", "but", "or", "so", "then", "also", "it", "it's", "this", "that", "these", "those", "we", "you",
        "they", "he", "she", "my", "our", "your", "their", "his", "her", "to", "for", "with", "in", "on", "at", "of", "from",
        "if", "because", "which", "when", "what", "where", "how", "why", "who", "just", "maybe", "please", "thanks", "yes",
        "no", "not", "can", "could", "would", "should", "will", "is", "are", "was", "were", "be", "have", "has", "do", "does",
        "did", "there", "here", "some", "all", "one", "two", "let's", "as", "about", "after", "before", "by", "into", "like",
        "more", "most", "only", "really", "still", "too", "very", "we're", "you're", "they're", "don't", "can't",
        "see", "get", "go", "make", "take", "send", "look", "check", "use", "need", "want", "think", "know", "say", "said",
        "tell", "ask", "let", "put", "keep", "try", "call", "give", "find", "show", "meet", "even", "well", "now", "though",
    ]
}

/// A correction he types into the text Dot just dictated (parity DI-05), as a dictionary candidate. Dot remembers
/// exactly where it inserted, keeps watching that field, and counts only a change inside that range while the rest of
/// the field stays as it was; typing elsewhere, the text moving, or the field losing focus drops it. Offsets are
/// UTF-16, as accessibility reports them.
public struct DictationEditTracker: Equatable {
    public let inserted: String
    public let start: Int
    private let prefix: String
    private let suffix: String
    public private(set) var current: String
    public private(set) var tainted = false
    public private(set) var edited = false

    /// nil unless `value` holds `inserted` at `start` (the insert went where Dot meant it to).
    public init?(value: String, start: Int, inserted: String) {
        let whole = value as NSString
        let length = (inserted as NSString).length
        guard start >= 0, length > 0, start + length <= whole.length,
              whole.substring(with: NSRange(location: start, length: length)) == inserted else { return nil }
        self.inserted = inserted
        self.start = start
        prefix = whole.substring(to: start)
        suffix = whole.substring(from: start + length)
        current = inserted
    }

    /// The field's text after a change. The range keeps its edges only when the text before and after it is
    /// unchanged; anything else taints the watch for good.
    public mutating func observe(_ value: String?) {
        guard !tainted else { return }
        guard let value else { tainted = true; return }
        let whole = value as NSString
        let head = (prefix as NSString).length, tail = (suffix as NSString).length
        guard whole.length >= head + tail, value.hasPrefix(prefix), value.hasSuffix(suffix) else { tainted = true; return }
        let middle = whole.substring(with: NSRange(location: head, length: whole.length - head - tail))
        if middle != current { edited = true; current = middle }
    }

    /// The correction, when there is exactly one: one to three dictated words replaced by one to three typed ones that
    /// look alike (a mishearing, not a change of mind), and not a rule he already has.
    public func candidate(dictionary: DictationDictionary = DictationDictionary()) -> DictationCandidate? {
        guard edited, !tainted else { return nil }
        let old = Self.words(inserted), new = Self.words(current)
        var head = 0
        while head < old.count, head < new.count, old[head] == new[head] { head += 1 }
        var tail = 0
        while tail < old.count - head, tail < new.count - head, old[old.count - 1 - tail] == new[new.count - 1 - tail] { tail += 1 }
        let heard = Array(old[head..<(old.count - tail)]), correct = Array(new[head..<(new.count - tail)])
        guard (1...3).contains(heard.count), (1...3).contains(correct.count) else { return nil }
        let h = heard.joined(separator: " "), c = correct.joined(separator: " ")
        if h.lowercased() == c.lowercased() {
            // Case alone counts only for a word written with inner capitals or as an acronym ("Typesafe" to "TypeSafe").
            let inner = c.dropFirst().contains(where: \.isUppercase) || (c.count >= 2 && c.allSatisfy { !$0.isLetter || $0.isUppercase })
            guard inner else { return nil }
        } else {
            guard Self.alike(h, c) else { return nil }
        }
        if dictionary.apply(to: h) == c { return nil }
        return DictationCandidate(heard: h, correct: c)
    }

    static func words(_ text: String) -> [String] {
        text.split(whereSeparator: { !($0.isLetter || $0.isNumber || $0 == "'" || $0 == "-") }).map(String.init)
    }

    /// Letters and digits within half an edit of each other ("you chicago" and "UChicago"; not "Friday" and "Monday").
    static func alike(_ a: String, _ b: String) -> Bool {
        let x = Array(a.lowercased().filter { $0.isLetter || $0.isNumber }), y = Array(b.lowercased().filter { $0.isLetter || $0.isNumber })
        guard !x.isEmpty, !y.isEmpty else { return false }
        if x == y { return true }
        var row = Array(0...y.count)
        for i in 1...x.count {
            var next = [i] + Array(repeating: 0, count: y.count)
            for j in 1...y.count { next[j] = min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (x[i - 1] == y[j - 1] ? 0 : 1)) }
            row = next
        }
        return Double(row[y.count]) / Double(max(x.count, y.count)) < 0.5
    }
}

public struct DictationCandidate: Equatable, Hashable {
    public let heard: String
    public let correct: String
    public init(heard: String, correct: String) { self.heard = heard; self.correct = correct }
}
