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
    /// `fixAdded`: the research pass may correct a line the after-class pass added, too.
    public static func apply(_ reply: String, to notes: inout ClassNotes, titleLocked: Bool, fixAdded: Bool = false) -> Outcome {
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
                if let block = notes.fix(id, text: text, added: fixAdded) { out.fixed.append(block) }
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
                               materials: String, slidePictures: Int, calendar: String = "", ahead: String = "") -> String {
        var parts = ["[after class] \(heading), \(course)"]
        if !calendar.isEmpty { parts.append("his calendar around the class (for names, the event, the agenda; not a source of notes):\n" + calendar) }
        if !ahead.isEmpty { parts.append("his calendar for the week after (a meeting with the speakers or their firm says who they are and what he went for; not a source of notes):\n" + ahead) }
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

    /// One voice's stretch of the recording, from the diarizer ("S1", "S2": numbered in the order they first speak).
    public struct Turn: Equatable, Sendable {
        public let speaker: String
        public let start: TimeInterval
        public let end: TimeInterval
        public init(speaker: String, start: TimeInterval, end: TimeInterval) { self.speaker = speaker; self.start = start; self.end = end }
    }

    /// The diarizer's raw speaker ids as S1, S2, ... in the order each first speaks, with stretches of one voice under
    /// `minimum` seconds dropped (a cough, a crosstalk blip) so they never split a paragraph.
    public static func turns(_ raw: [(speaker: String, start: TimeInterval, end: TimeInterval)], minimum: TimeInterval = 1) -> [Turn] {
        var label: [String: String] = [:]
        return raw.filter { $0.end - $0.start >= minimum }.sorted { $0.start < $1.start }.map { seg in
            let name = label[seg.speaker] ?? { let n = "S\(label.count + 1)"; label[seg.speaker] = n; return n }()
            return Turn(speaker: name, start: seg.start, end: seg.end)
        }
    }

    /// The voice speaking at `time`: the turn holding it, else the nearest within 1.5 s (tokens land in the gaps).
    static func speaker(at time: TimeInterval, in turns: [Turn]) -> String? {
        if let hit = turns.last(where: { $0.start <= time && time <= $0.end }) { return hit.speaker }
        let near = turns.min { min(abs($0.start - time), abs($0.end - time)) < min(abs($1.start - time), abs($1.end - time)) }
        guard let near, min(abs(near.start - time), abs(near.end - time)) <= 1.5 else { return nil }
        return near.speaker
    }

    /// A paragraph ends at a sentence's end once it is `seconds` long, or anywhere at twice that; with `turns`, also
    /// wherever the voice changes at a word, so each paragraph is one speaker's.
    public static func group(_ tokens: [Token], seconds: TimeInterval = 30, turns: [Turn] = []) -> [(start: TimeInterval, text: String)] {
        grouped(tokens, seconds: seconds, turns: turns).map { ($0.start, $0.text) }
    }

    public static func grouped(_ tokens: [Token], seconds: TimeInterval = 30, turns: [Turn]) -> [(start: TimeInterval, speaker: String?, text: String)] {
        var out: [(start: TimeInterval, speaker: String?, text: String)] = []
        var text = ""
        var start: TimeInterval = 0
        var voice: String?
        for token in tokens {
            // SentencePiece marks a word's start with "▁"; some decoders give a leading space instead
            let piece = token.text.replacingOccurrences(of: "\u{2581}", with: " ")
            let startsWord = piece.hasPrefix(" ")
            let now = turns.isEmpty ? nil : speaker(at: token.start, in: turns)
            if text.isEmpty { start = token.start; voice = now }
            else if startsWord, (now != nil && now != voice) || (token.start - start >= seconds &&
                    (text.last.map({ ".?!".contains($0) }) == true || token.start - start >= seconds * 2)) {
                out.append((start, voice, text.trimmingCharacters(in: .whitespaces)))
                text = ""
                start = token.start
                voice = now ?? voice
            }
            text += piece
        }
        let rest = text.trimmingCharacters(in: .whitespaces)
        if !rest.isEmpty { out.append((start, voice, rest)) }
        return out.map { ($0.start, $0.speaker, $0.text.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)) }
    }

    /// "**11:42:10** words" blocks from paragraphs, clocked from when the recording began; a paragraph with a voice reads
    /// "**11:42:10** [S2] words".
    public static func markdown(_ paragraphs: [(start: TimeInterval, text: String)], began: Date, title: String) -> String {
        markdown(paragraphs.map { ($0.start, nil, $0.text) }, began: began, title: title)
    }

    public static func markdown(_ paragraphs: [(start: TimeInterval, speaker: String?, text: String)], began: Date, title: String) -> String {
        let f = DateFormatter(); f.dateFormat = "HH:mm:ss"; f.locale = Locale(identifier: "en_US_POSIX")
        let body = paragraphs.map { "**\(f.string(from: began.addingTimeInterval($0.start)))** \($0.speaker.map { "[\($0)] " } ?? "")\($0.text)" }
            .joined(separator: "\n\n")
        let voices = Set(paragraphs.compactMap(\.speaker)).count
        let note = voices > 1 ? ", \(voices) voices told apart by machine as [S1], [S2], ...; one person can be split in two or two merged" : ""
        return "# \(title) transcript (made again from the class audio after class, text only\(note))\n\n" + body + "\n"
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

    /// The days after a class or talk, one line per timed event: a meeting with the same people or firm tells the pass
    /// and the research who this was and what it was for (10-27: a founders' talk the night before his meeting with
    /// that startup, and Dot knew neither).
    public static func ahead(_ items: [CalendarItem], from start: Date, days: Int = 7, cap: Int = 80) -> String {
        let f = DateFormatter(); f.dateFormat = "EEE MM-dd h:mm a"; f.locale = Locale(identifier: "en_US_POSIX")
        let t = DateFormatter(); t.dateFormat = "h:mm a"; t.locale = Locale(identifier: "en_US_POSIX")
        let end = start.addingTimeInterval(Double(days) * 86_400)
        return items.filter { !$0.allDay && $0.start >= start && $0.start < end }
            .sorted { $0.start < $1.start }
            .prefix(cap)
            .map { "- \(f.string(from: $0.start))-\(t.string(from: $0.end)): \($0.title)" + ($0.location.isEmpty ? "" : " (\($0.location))") }
            .joined(separator: "\n")
    }
}
