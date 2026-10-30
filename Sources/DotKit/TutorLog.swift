import Foundation

/// What he gets wrong in a course or subject, and how he has asked for it to be taught (2026-10-29, from DeepTutor's
/// learner memory, HKUDS/DeepTutor). One append-only JSONL file per subject in `<talk root>/tutor/<subject>.jsonl`;
/// the state is folded from the events, so a line is never rewritten and every miss keeps his own words.
///
/// The talk model marks them with tags at the end of an answer that graded him:
///   [MISS:math20250:the idea | what he said | what was off]   a new miss
///   [MISS:m4k2]                                                he missed a listed one again
///   [GOT:m4k2]                                                 he got a listed one right
///   [STYLE:math20250:"just show me the figure"]               how he asked to be taught, in his words
///
/// The review schedule is DeepTutor's SM-2-style start (docs-for-dev/PRACTICE.md): a miss comes back the next day,
/// a first right answer pushes it three days out, and a second right answer on another day resolves it. A right
/// answer within six hours of the miss is the hint-and-retry of the same sitting, not recall, so it moves nothing
/// (DeepTutor's same-session rule); one lucky answer cannot resolve a miss (its confidence cap).
public enum TutorMark: Equatable {
    case miss(subject: String?, idea: String, said: String, gap: String)
    case missAgain(id: String)
    case got(id: String)
    case style(subject: String?, words: String)

    /// The payload of a MISS, GOT or STYLE tag; nil when it holds nothing usable.
    public static func parse(kind: String, payload: String) -> TutorMark? {
        let text = payload.trimmingCharacters(in: .whitespacesAndNewlines)
        switch kind {
        case "GOT":
            return TutorLog.isID(text) ? .got(id: text.lowercased()) : nil
        case "MISS":
            if TutorLog.isID(text) { return .missAgain(id: text.lowercased()) }
            let (subject, body) = splitSubject(text)
            let fields = body.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            guard let idea = fields.first, idea.count >= 3 else { return nil }
            return .miss(subject: subject, idea: idea, said: fields.count > 1 ? fields[1] : "", gap: fields.count > 2 ? fields[2...].joined(separator: " | ") : "")
        case "STYLE":
            let (subject, body) = splitSubject(text)
            let words = body.trimmingCharacters(in: CharacterSet(charactersIn: "\"'“”‘’ ").union(.whitespacesAndNewlines))
            return words.count >= 3 ? .style(subject: subject, words: words) : nil
        default:
            return nil
        }
    }

    /// "math20250:rest" or "ib technicals:rest" -> the subject and the rest; a body with no subject keeps it nil.
    /// A first field holding a "|" is the idea itself, not a subject.
    static func splitSubject(_ text: String) -> (String?, String) {
        guard let colon = text.firstIndex(of: ":") else { return (nil, text) }
        let head = text[..<colon].trimmingCharacters(in: .whitespaces)
        let rest = String(text[text.index(after: colon)...]).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !head.isEmpty, head.count <= 40, !head.contains("|"), !rest.isEmpty else { return (nil, text) }
        return (TutorLog.slug(head), rest)
    }
}

/// One line of a subject's file.
public struct TutorEvent: Codable, Equatable {
    public enum Kind: String, Codable { case miss, got, style }
    public let kind: Kind
    public let at: Date
    /// The miss this is about; for a style line, empty.
    public let id: String
    public var idea: String? = nil
    /// A miss: what he said. A style: his words.
    public var said: String? = nil
    public var gap: String? = nil
    /// What he asked that turn, so a line can be traced back to the exchange it came from.
    public var asked: String? = nil

    public init(kind: Kind, at: Date, id: String, idea: String? = nil, said: String? = nil, gap: String? = nil, asked: String? = nil) {
        self.kind = kind; self.at = at; self.id = id; self.idea = idea; self.said = said; self.gap = gap; self.asked = asked
    }
}

/// A miss as it stands after every event so far.
public struct TutorMiss: Equatable {
    public let id: String
    public let subject: String
    public let idea: String
    public let said: String
    public let gap: String
    public let firstAt: Date
    public var lastMissAt: Date
    public var times: Int
    /// Right answers that counted, on different days, since the last miss.
    public var streak: Int
    public var lastGotAt: Date?
    public var due: Date?
    public var resolved: Bool { due == nil }

    public func isDue(now: Date, calendar: Calendar = .current) -> Bool {
        guard let due else { return false }
        return calendar.startOfDay(for: due) <= calendar.startOfDay(for: now)
    }
}

public struct TutorStyle: Equatable {
    public let words: String
    public let at: Date
}

public enum TutorLog {
    /// A right answer this soon after the miss is the retry after a hint, not recall.
    static let assistedHours: Double = 6
    static let firstInterval: Double = 1, secondInterval: Double = 3
    /// Right answers on different days that resolve a miss.
    static let resolveAfter = 2

    public static func isID(_ text: String) -> Bool {
        text.range(of: #"^[mM][0-9a-zA-Z]{3}$"#, options: .regularExpression) != nil
    }

    /// "MATH 20250", "math20250" -> "math20250"; "IB technicals" -> "ib-technicals".
    public static func slug(_ text: String) -> String {
        let lower = text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        if let m = lower.range(of: #"^([a-z]{3,5})\s*(\d{5})$"#, options: .regularExpression) {
            return lower[m].replacingOccurrences(of: " ", with: "")
        }
        let parts = lower.components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }
        return String(parts.joined(separator: "-").prefix(40))
    }

    /// A fresh id that none of `taken` has: "m" and three base-36 characters.
    public static func newID(taken: Set<String>, random: () -> UInt32 = { UInt32.random(in: 0..<46656) }) -> String {
        let digits = Array("0123456789abcdefghijklmnopqrstuvwxyz")
        for _ in 0..<64 {
            var n = Int(random() % 46656), s = ""
            for _ in 0..<3 { s = String(digits[n % 36]) + s; n /= 36 }
            if !taken.contains("m" + s) { return "m" + s }
        }
        return "m" + String(taken.count, radix: 36)
    }

    /// Every miss and style in one subject's events, in order.
    public static func fold(_ events: [TutorEvent], subject: String) -> (misses: [TutorMiss], styles: [TutorStyle]) {
        var misses: [String: TutorMiss] = [:], order: [String] = [], styles: [TutorStyle] = []
        let calendar = Calendar.current
        for e in events.sorted(by: { $0.at < $1.at }) {
            switch e.kind {
            case .miss:
                if var m = misses[e.id] {
                    m.lastMissAt = e.at; m.times += 1; m.streak = 0; m.lastGotAt = nil
                    m.due = e.at.addingTimeInterval(firstInterval * 86400)
                    misses[e.id] = m
                } else if let idea = e.idea, !idea.isEmpty {
                    misses[e.id] = TutorMiss(id: e.id, subject: subject, idea: idea, said: e.said ?? "", gap: e.gap ?? "", firstAt: e.at,
                                             lastMissAt: e.at, times: 1, streak: 0, lastGotAt: nil, due: e.at.addingTimeInterval(firstInterval * 86400))
                    order.append(e.id)
                }
            case .got:
                guard var m = misses[e.id], !m.resolved else { continue }
                if e.at.timeIntervalSince(m.lastMissAt) < assistedHours * 3600 { continue }
                if let last = m.lastGotAt, calendar.isDate(last, inSameDayAs: e.at) { continue }
                m.streak += 1; m.lastGotAt = e.at
                m.due = m.streak >= resolveAfter ? nil : e.at.addingTimeInterval(secondInterval * 86400)
                misses[e.id] = m
            case .style:
                guard let words = e.said, !words.isEmpty else { continue }
                styles.removeAll { normalized($0.words) == normalized(words) }
                styles.append(TutorStyle(words: words, at: e.at))
            }
        }
        return (order.compactMap { misses[$0] }, styles)
    }

    static func normalized(_ text: String) -> String {
        text.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }.joined(separator: " ")
    }

    /// His own words, or not: a STYLE line counts only when what it quotes is in what he said that turn.
    public static func isHisWords(_ words: String, in asked: String) -> Bool {
        let w = normalized(words), a = normalized(asked)
        return w.count >= 3 && a.contains(w)
    }

    /// The block that joins a conversation: open misses, the due ones first, and how he asked to be taught.
    public static func block(label: String, misses: [TutorMiss], styles: [TutorStyle], now: Date, limit: Int = 8) -> [String] {
        let open = misses.filter { !$0.resolved }
        guard !open.isEmpty || !styles.isEmpty else { return [] }
        let due = open.filter { $0.isDue(now: now) }.sorted { ($0.due ?? now) < ($1.due ?? now) }
        let later = open.filter { !$0.isDue(now: now) }.sorted { $0.lastMissAt > $1.lastMissAt }
        let resolvedCount = misses.count - open.count
        var lines = ["[his misses] \(label): what he got wrong before\(open.isEmpty ? " (none open)" : ", the due ones first")"
                     + (resolvedCount > 0 ? "; \(resolvedCount) resolved" : "") + ":"]
        for m in (due + later).prefix(limit) {
            var line = "- \(m.id) (\(m.isDue(now: now) ? "due" : "due \(day(m.due ?? now))")\(m.times > 1 ? ", missed \(m.times) times" : "")) \(m.idea)"
            if !m.said.isEmpty { line += "; he said: \"\(m.said)\"" }
            if !m.gap.isEmpty { line += "; off: \(m.gap)" }
            lines.append(line)
        }
        if open.count > limit { lines.append("- and \(open.count - limit) more") }
        if !styles.isEmpty {
            lines.append("how he asked to be taught here: " + styles.suffix(5).reversed().map { "\"\($0.words)\" (\(day($0.at)))" }.joined(separator: "; "))
        }
        lines.append("[/his misses]")
        return lines
    }

    static func day(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: date)
    }

    /// Words that ask for a quiz or a review of what he got wrong.
    public static func asksForPractice(_ text: String) -> Bool {
        let t = " " + normalized(text) + " "
        return [" quiz me ", " quiz ", " test me ", " drill ", " drill me ", " review my ", " what did i get wrong ", " what have i missed ",
                " my misses ", " practice questions ", " practice problems "].contains { t.contains($0) }
    }

    /// The morning card's line, when misses are due today: "review 3 misses due: 2 in math 20250, 1 in ib technicals".
    public static func morningLine(due: [(label: String, count: Int)]) -> String? {
        let shown = due.filter { $0.count > 0 }
        let total = shown.reduce(0) { $0 + $1.count }
        guard total > 0 else { return nil }
        let parts = shown.map { "\($0.count) in \($0.label.lowercased())" }
        return "review \(total) \(total == 1 ? "miss" : "misses") due" + (shown.count == 1 ? " in \(shown[0].label.lowercased())" : ": " + parts.joined(separator: ", "))
    }
}

/// The files: `<root>/<subject>.jsonl`, one event a line.
public struct TutorStore {
    public let root: URL
    public init(root: URL) { self.root = root }

    static let encoder: JSONEncoder = { let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601; e.outputFormatting = [.sortedKeys]; return e }()
    static let decoder: JSONDecoder = { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }()

    func file(_ subject: String) -> URL { root.appendingPathComponent(subject + ".jsonl") }

    public func subjects() -> [String] {
        ((try? FileManager.default.contentsOfDirectory(atPath: root.path)) ?? []).filter { $0.hasSuffix(".jsonl") }.map { String($0.dropLast(6)) }.sorted()
    }

    public func events(_ subject: String) -> [TutorEvent] {
        guard let text = try? String(contentsOf: file(subject), encoding: .utf8) else { return [] }
        return text.split(separator: "\n").compactMap { try? Self.decoder.decode(TutorEvent.self, from: Data($0.utf8)) }
    }

    public func state(_ subject: String) -> (misses: [TutorMiss], styles: [TutorStyle]) {
        TutorLog.fold(events(subject), subject: subject)
    }

    /// Which subject holds this miss id.
    public func subject(of id: String) -> String? {
        subjects().first { s in events(s).contains { $0.id == id } }
    }

    public func allIDs() -> Set<String> {
        Set(subjects().flatMap { events($0).map(\.id) }.filter { !$0.isEmpty })
    }

    public func append(_ event: TutorEvent, subject: String) throws {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        var data = try Self.encoder.encode(event)
        data.append(0x0A)
        let url = file(subject)
        if let handle = try? FileHandle(forWritingTo: url) {
            defer { try? handle.close() }
            try handle.seekToEnd()
            try handle.write(contentsOf: data)
        } else {
            try data.write(to: url, options: .atomic)
        }
    }

    /// Record one tag; returns what happened, for the log. `subject` is the course Dot thinks he is in, for a tag
    /// that names none; `asked` is what he said that turn (a STYLE must quote it).
    @discardableResult
    public func record(_ mark: TutorMark, subject current: String?, asked: String, now: Date = Date()) -> String {
        do {
            switch mark {
            case .miss(let named, let idea, let said, let gap):
                let subject = named ?? current ?? "general"
                // the same idea missed again in the same subject is that miss again, not a second one
                if let open = state(subject).misses.first(where: { !$0.resolved && TutorLog.normalized($0.idea) == TutorLog.normalized(idea) }) {
                    try append(TutorEvent(kind: .miss, at: now, id: open.id, said: said, gap: gap, asked: asked), subject: subject)
                    return "missed again: \(open.id) in \(subject)"
                }
                let id = TutorLog.newID(taken: allIDs())
                try append(TutorEvent(kind: .miss, at: now, id: id, idea: idea, said: said, gap: gap, asked: asked), subject: subject)
                return "miss \(id) in \(subject): \(idea)"
            case .missAgain(let id), .got(let id):
                guard let subject = subject(of: id) else { return "no miss \(id)" }
                let again: Bool = { if case .missAgain = mark { return true }; return false }()
                try append(TutorEvent(kind: again ? .miss : .got, at: now, id: id, asked: asked), subject: subject)
                return (again ? "missed again: " : "got: ") + "\(id) in \(subject)"
            case .style(let named, let words):
                guard TutorLog.isHisWords(words, in: asked) else { return "style refused, not his words: \(words)" }
                let subject = named ?? current ?? "general"
                try append(TutorEvent(kind: .style, at: now, id: "", said: words, asked: asked), subject: subject)
                return "style in \(subject): \(words)"
            }
        } catch {
            return "tutor log write failed: \(error.localizedDescription)"
        }
    }
}
