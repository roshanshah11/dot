import Foundation

/// Lecture mode's after-class pass (his ask 2026-10-25: "going through it again to add anything it missed... going through
/// the lecture material or anything it has and adding it"). Once class ends, one careful read of the whole lecture (the
/// transcript made again from the kept audio, else the live one) and the course's materials against the notes: what the
/// live notes missed goes in where it belongs, marked added; Dot's own lines the whole lecture shows were wrong or unsure
/// are fixed and marked; his lines are never touched. The reply is in the notes protocol: `+after dN:`, `+under dN:`,
/// `~dN:` and `## title` (Resources/lecture/notes-afterclass.md).
public enum AfterClass {
    public struct Placed: Equatable, Sendable {
        public let after: String
        public let block: NoteBlock
    }

    public struct Outcome: Equatable, Sendable {
        public var added: [Placed] = []
        public var fixed: [NoteBlock] = []
        public var title: String?
        public init() {}
        public var summary: String { "after class: \(added.count) added, \(fixed.count) fixed" }
    }

    /// The reply onto the notes. A run of lines given the same anchor keeps its order (each goes after the one before
    /// it); `## title` only when the class has none and he didn't title it himself.
    public static func apply(_ reply: String, to notes: inout ClassNotes, titleLocked: Bool) -> Outcome {
        var out = Outcome()
        // anchor -> the last line placed for it, so "+after d5: a" then "+after d5: b" reads a, b
        var last: [String: String] = [:]
        // the line just placed: indented "  - detail" lines after it are its details, in order
        var group: (depth: Int, last: String)?
        for op in NoteProtocol.parse(reply).ops {
            switch op {
            case .addAfter(let id, let text), .addUnder(let id, let text):
                let under: Bool
                if case .addUnder = op { under = true } else { under = false }
                let key = (under ? "u:" : "a:") + id
                let anchor = id == "end" ? notes.blocks.last?.id : id
                group = nil
                guard let anchor, let base = notes.block(anchor) else { continue }
                let depth = id == "end" ? 0 : base.depth + (under ? 1 : 0)
                if let placed = notes.place(text, afterSubtreeOf: last[key] ?? anchor, depth: depth) {
                    out.added.append(Placed(after: placed.after, block: placed.block))
                    last[key] = placed.block.id
                    group = (placed.block.depth, placed.block.id)
                }
            case .append(let depth, let text):
                guard depth > 0, let head = group else { continue }
                if let placed = notes.place(text, afterSubtreeOf: head.last, depth: head.depth + depth) {
                    out.added.append(Placed(after: placed.after, block: placed.block))
                    group = (head.depth, placed.block.id)
                    // the next "+after" on the same anchor goes after these details too
                    if let key = last.first(where: { $0.value == head.last })?.key { last[key] = placed.block.id }
                }
            case .rewrite(let id, let text):
                group = nil
                if let block = notes.fix(id, text: text) { out.fixed.append(block) }
            case .title(let title):
                if !titleLocked, notes.title.isEmpty { notes.title = title; out.title = title }
            default:
                break
            }
        }
        return out
    }

    /// The one message the pass gets: the notes with ids, the whole lecture, and the materials.
    public static func message(heading: String, course: String, notes: ClassNotes, transcript: String, transcriptSource: String,
                               materials: String, slidePictures: Int, calendar: String = "") -> String {
        var parts = ["[after class] \(heading), \(course)"]
        if !calendar.isEmpty { parts.append("his calendar around the class (for names, the event, the agenda; not a source of notes):\n" + calendar) }
        parts.append("the notes now, with ids (whose each line is: dot, his, added):\n" + notes.tail(10_000).joined(separator: "\n"))
        parts.append("the whole lecture, \(transcriptSource) (names and terms may still be misspelled):\n" + transcript)
        if !materials.isEmpty { parts.append("the course's slides and readings:\n" + materials) }
        if slidePictures > 0 { parts.append("attached: \(slidePictures) slide picture(s) Dot took in class, in order.") }
        if notes.title.isEmpty {
            let his = notes.blocks.first { $0.author == .him }.map { "; his first line, which may be what he calls it: \"\($0.text)\"" } ?? ""
            parts.append("the class has no title yet: send `## title`\(his).")
        }
        parts.append("last block: \(notes.blocks.last?.id ?? "none") (use +after end: for a line after everything)")
        return parts.joined(separator: "\n\n")
    }
}

/// The words of a whole recording, from the recognizer's token timings, as paragraphs of about half a minute with where
/// each starts: the after-class transcript keeps the live one's "**11:42:10** words" form, so a line's time chip still
/// finds what was said.
public enum TranscriptParagraphs {
    public struct Token: Sendable {
        public let text: String
        public let start: TimeInterval
        public init(text: String, start: TimeInterval) { self.text = text; self.start = start }
    }

    /// A paragraph ends at a sentence's end once it is `seconds` long, or anywhere at twice that.
    public static func group(_ tokens: [Token], seconds: TimeInterval = 30) -> [(start: TimeInterval, text: String)] {
        var out: [(start: TimeInterval, text: String)] = []
        var text = ""
        var start: TimeInterval = 0
        for token in tokens {
            // SentencePiece marks a word's start with "▁"; some decoders give a leading space instead
            let piece = token.text.replacingOccurrences(of: "\u{2581}", with: " ")
            let startsWord = piece.hasPrefix(" ")
            if text.isEmpty { start = token.start }
            else if startsWord, token.start - start >= seconds,
                    text.last.map({ ".?!".contains($0) }) == true || token.start - start >= seconds * 2 {
                out.append((start, text.trimmingCharacters(in: .whitespaces)))
                text = ""
                start = token.start
            }
            text += piece
        }
        let rest = text.trimmingCharacters(in: .whitespaces)
        if !rest.isEmpty { out.append((start, rest)) }
        return out.map { ($0.start, $0.text.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)) }
    }

    /// "**11:42:10** words" blocks from paragraphs, clocked from when the recording began.
    public static func markdown(_ paragraphs: [(start: TimeInterval, text: String)], began: Date, title: String) -> String {
        let f = DateFormatter(); f.dateFormat = "HH:mm:ss"; f.locale = Locale(identifier: "en_US_POSIX")
        let body = paragraphs.map { "**\(f.string(from: began.addingTimeInterval($0.start)))** \($0.text)" }.joined(separator: "\n\n")
        return "# \(title) transcript (made again from the class audio after class, text only)\n\n" + body + "\n"
    }
}

/// Slides are often posted on Canvas after class (his pick 2026-10-25: "re-check later"): at 8 pm that day and 8 am the
/// next, Dot looks for the class's files again and, when new ones arrived, the after-class pass reads them. Kept in a
/// small file so a restart doesn't lose them.
public struct LectureRecheck: Codable, Equatable, Sendable {
    public var course: String
    /// The class's name on the calendar, for Canvas.
    public var title: String
    /// "CLASS 7 (Thu Oct 22)": the section in the notes file.
    public var key: String
    public var notesFile: String
    public var transcriptFile: String
    public var due: Date
    /// When the Canvas job went out, and the course folder's files then (new ones are compared against them).
    public var started: Date?
    public var before: [String]

    public init(course: String, title: String, key: String, notesFile: String, transcriptFile: String, due: Date) {
        self.course = course; self.title = title; self.key = key; self.notesFile = notesFile; self.transcriptFile = transcriptFile
        self.due = due; self.started = nil; self.before = []
    }
}

public enum LectureRechecks {
    /// 8 pm the day class ended (unless it ended after 7:30 pm) and 8 am the next morning.
    public static func times(classEnded: Date, calendar: Calendar = .current) -> [Date] {
        let day = calendar.startOfDay(for: classEnded)
        var out: [Date] = []
        if let evening = calendar.date(bySettingHour: 20, minute: 0, second: 0, of: day), classEnded < evening.addingTimeInterval(-1800) {
            out.append(evening)
        }
        if let next = calendar.date(byAdding: .day, value: 1, to: day), let morning = calendar.date(bySettingHour: 8, minute: 0, second: 0, of: next) {
            out.append(morning)
        }
        return out
    }

    /// How long the Canvas job gets before the folder is compared.
    public static let jobWait: TimeInterval = 20 * 60

    public static func load(_ url: URL) -> [LectureRecheck] {
        guard let data = try? Data(contentsOf: url) else { return [] }
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([LectureRecheck].self, from: data)) ?? []
    }

    public static func save(_ items: [LectureRecheck], to url: URL) {
        let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601; encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        if let data = try? encoder.encode(items) { try? data.write(to: url, options: .atomic) }
    }

    /// Files in `now` that weren't in `before` and the pass can read.
    public static func newFiles(before: [String], now: [String], readable: Set<String>) -> [String] {
        let old = Set(before)
        return now.filter { !old.contains($0) && readable.contains(($0 as NSString).pathExtension.lowercased()) && !$0.hasPrefix(".") }.sorted()
    }
}

/// His calendar around a class, for the after-class pass: the event names a talk that isn't a course (10-25's club talk
/// sat beside the event it was), and a description can carry the agenda or the speaker.
public enum LectureCalendarNotes {
    public static func lines(_ items: [CalendarItem], from start: Date, to end: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "h:mm a"; f.locale = Locale(identifier: "en_US_POSIX")
        return items.filter { !$0.allDay && $0.start < end && $0.end > start.addingTimeInterval(-900) }
            .sorted { $0.start < $1.start }
            .map { item in
                var line = "- \(f.string(from: item.start))-\(f.string(from: item.end)): \(item.title)"
                if !item.location.isEmpty { line += " (\(item.location))" }
                let notes = item.notes.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespaces)
                if !notes.isEmpty { line += ": " + (notes.count > 400 ? String(notes.prefix(400)) + "…" : notes) }
                return line
            }
            .joined(separator: "\n")
    }
}
