import Foundation

/// The done check (parity CU-03): a job proves its result before Dot lets it count as done. Its end text carries one or
/// more `check:` lines; Dot takes a fresh look and verifies each one in code. A check that fails goes back to the job as
/// "[check] not done: <what Dot saw>"; the second failure ends the job as not done.
///
///     check: text "Saved"                  the words are on the page or window now
///     check: gone "Unsaved changes"        the words are not
///     check: url /confirmation             the address contains it (* matches anything)
///     check: element "Email alerts" on     a control's state: on, off, enabled, disabled, exists, gone
///     check: file ~/Desktop/Deck.pptx      the file exists and is not empty
public struct DoneCheck: Equatable, CustomStringConvertible {
    public enum Kind: String, Equatable { case text, gone, url, element, file }
    public let kind: Kind
    public let target: String
    /// An element's wanted state.
    public let state: String?

    public init(kind: Kind, target: String, state: String? = nil) {
        self.kind = kind; self.target = target; self.state = state
    }

    public var description: String {
        switch kind {
        case .element: return "element \"\(target)\" \(state ?? "exists")"
        case .text, .gone: return "\(kind.rawValue) \"\(target)\""
        case .url, .file: return "\(kind.rawValue) \(target)"
        }
    }

    public static let elementStates: Set<String> = ["on", "off", "checked", "unchecked", "selected", "enabled", "disabled", "exists", "gone"]

    /// One `check:` line, or nil.
    public static func parse(_ line: String) -> DoneCheck? {
        let l = line.trimmingCharacters(in: .whitespaces)
        guard l.lowercased().hasPrefix("check:") else { return nil }
        let body = l.dropFirst("check:".count).trimmingCharacters(in: .whitespaces)
        guard let space = body.firstIndex(of: " "), let kind = Kind(rawValue: body[..<space].lowercased()) else { return nil }
        var rest = body[body.index(after: space)...].trimmingCharacters(in: .whitespaces)
        func quoted() -> String {
            for (open, close) in [("\"", "\""), ("“", "”"), ("'", "'")] where rest.hasPrefix(open) {
                let after = rest.dropFirst(open.count)
                if let end = after.range(of: close) {
                    let value = String(after[..<end.lowerBound])
                    rest = String(after[end.upperBound...]).trimmingCharacters(in: .whitespaces)
                    return value
                }
            }
            defer { rest = "" }
            return rest
        }
        switch kind {
        case .text, .gone:
            let words = quoted()
            return words.isEmpty ? nil : DoneCheck(kind: kind, target: words)
        case .url, .file:
            return rest.isEmpty ? nil : DoneCheck(kind: kind, target: rest)
        case .element:
            if rest.hasPrefix("\"") || rest.hasPrefix("“") || rest.hasPrefix("'") {
                let label = quoted()
                let state = rest.lowercased().split(separator: " ").first.map(String.init) ?? "exists"
                guard !label.isEmpty, elementStates.contains(state) else { return nil }
                return DoneCheck(kind: .element, target: label, state: state)
            }
            // unquoted: the last word is the state when it is one
            var words = rest.split(separator: " ").map(String.init)
            let state = words.last.map { $0.lowercased() }.flatMap { elementStates.contains($0) ? $0 : nil }
            if state != nil { words.removeLast() }
            let label = words.joined(separator: " ")
            return label.isEmpty ? nil : DoneCheck(kind: .element, target: label, state: state ?? "exists")
        }
    }

    /// The check lines in a job's end text, and the text without them.
    public static func split(_ text: String) -> (checks: [DoneCheck], rest: String) {
        var checks: [DoneCheck] = []
        var kept: [String] = []
        for line in text.components(separatedBy: .newlines) {
            if let c = parse(line) { checks.append(c) } else { kept.append(line) }
        }
        return (checks, kept.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines))
    }

    /// What Dot saw on a fresh look.
    public struct Seen {
        public struct Element: Equatable {
            public let on: Bool?
            public let enabled: Bool
            public init(on: Bool?, enabled: Bool = true) { self.on = on; self.enabled = enabled }
        }
        public var url: String
        public var text: String
        public var element: (String) -> Element?
        public var fileSize: (String) -> Int?
        public init(url: String = "", text: String = "", element: @escaping (String) -> Element? = { _ in nil }, fileSize: @escaping (String) -> Int? = { _ in nil }) {
            self.url = url; self.text = text; self.element = element; self.fileSize = fileSize
        }
    }

    /// Passed, and in either case what Dot saw (the job reads it when it failed).
    public func verify(_ seen: Seen) -> (passed: Bool, saw: String) {
        switch kind {
        case .text, .gone:
            let has = Self.fold(seen.text).contains(Self.fold(target))
            let passed = kind == .text ? has : !has
            let saw = kind == .text ? (has ? "it says \"\(target)\"" : "\"\(target)\" isn't on \(Self.place(seen))")
                                    : (has ? "\"\(target)\" is still on \(Self.place(seen))" : "\"\(target)\" is gone")
            return (passed, saw)
        case .url:
            let passed = Self.matches(seen.url, target)
            return (passed, passed ? "the address is \(seen.url)" : "the address is \(seen.url.isEmpty ? "unknown" : seen.url), not \(target)")
        case .file:
            let size = seen.fileSize(target)
            if let size, size > 0 { return (true, "\(target) is there (\(size) bytes)") }
            return (false, size == nil ? "\(target) doesn't exist" : "\(target) is empty")
        case .element:
            let want = state ?? "exists"
            guard let e = seen.element(target) else { return (want == "gone", want == "gone" ? "\"\(target)\" is gone" : "no control \"\(target)\" on \(Self.place(seen))") }
            let passed: Bool
            switch want {
            case "on", "checked", "selected": passed = e.on == true
            case "off", "unchecked": passed = e.on == false
            case "enabled": passed = e.enabled
            case "disabled": passed = !e.enabled
            case "gone": passed = false
            default: passed = true
            }
            let now = e.on.map { $0 ? "on" : "off" } ?? (e.enabled ? "there" : "disabled")
            return (passed, "\"\(target)\" is \(now)")
        }
    }

    static func fold(_ s: String) -> String {
        s.lowercased().replacingOccurrences(of: "’", with: "'").split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    static func place(_ seen: Seen) -> String { seen.url.isEmpty ? "the window" : "the page" }

    /// `*` matches anything; otherwise the address contains it (case aside).
    static func matches(_ url: String, _ pattern: String) -> Bool {
        let u = url.lowercased(), p = pattern.lowercased()
        guard p.contains("*") else { return u.contains(p) }
        let re = "^" + p.split(separator: "*", omittingEmptySubsequences: false).map { NSRegularExpression.escapedPattern(for: String($0)) }.joined(separator: ".*") + "$"
        return u.range(of: re, options: .regularExpression) != nil || u.range(of: re.dropFirst().dropLast().description, options: .regularExpression) != nil
    }
}
