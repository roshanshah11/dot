import Foundation

/// A routine: a standing agent's task on a schedule, after HeyClicky's routines ("give me a daily
/// briefing", pause, resume, run now, delete; three failed runs in a row pause it) and the
/// Scheduled tab of OpenAI's dots. Routines run on this Mac while Dot is open. Pure data here;
/// the scheduler in the app runs them.
public struct RoutineSchedule: Codable, Equatable, Sendable {
    public enum Kind: String, Codable, Sendable { case daily, weekdays, weekly, hours }
    public var kind: Kind
    public var hour: Int
    public var minute: Int
    /// 1 = Sunday … 7 = Saturday, for `.weekly`.
    public var weekday: Int?
    /// For `.hours`.
    public var everyHours: Int?
    /// For `.hours` with a time window (07, "every 2 hours from 9 am to midnight"): the first run's hour and the last
    /// hour a run may start, 24 being midnight. Runs fall on the window's grid (9, 11, ..., 23), then the next day's
    /// start, and never outside it. An end before the start crosses midnight. Nil: around the clock, as before.
    public var fromHour: Int?
    public var untilHour: Int?

    public init(kind: Kind, hour: Int = 9, minute: Int = 0, weekday: Int? = nil, everyHours: Int? = nil, fromHour: Int? = nil, untilHour: Int? = nil) {
        self.kind = kind
        self.hour = hour
        self.minute = minute
        self.weekday = weekday
        self.everyHours = everyHours
        self.fromHour = fromHour
        self.untilHour = untilHour
    }

    /// Both ends of a window, when it has one.
    public var window: (from: Int, until: Int)? {
        guard kind == .hours, let fromHour, let untilHour, (0...23).contains(fromHour), (0...24).contains(untilHour), fromHour != untilHour % 24 || untilHour == 24 else { return nil }
        return (fromHour, untilHour)
    }

    static let weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    static let numberWords = ["one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12]
    /// Ordered: the specific words win over "day".
    static let periodHours: [(String, Int)] = [("noon", 12), ("midnight", 0), ("lunch", 12), ("morning", 8), ("afternoon", 14), ("evening", 18), ("night", 21), ("day", 9)]

    /// Plain words to a schedule: "every morning at 8", "every day at 7:30 am", "weekdays at nine",
    /// "every monday at 7 pm", "every 3 hours", "hourly", "each evening". Nil when the words do not
    /// say when.
    public static func parse(_ text: String) -> RoutineSchedule? {
        var s = text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        s = s.replacingOccurrences(of: #"[.,!]"#, with: "", options: .regularExpression)
        s = s.replacingOccurrences(of: "a.m", with: "am").replacingOccurrences(of: "p.m", with: "pm")
        // Hours, with a time window when the words give one ("every 2 hours between 9 am and midnight", "every 2 h, 9-5").
        var every: Int?
        if s.range(of: #"^(hourly|every hour|each hour|once an hour)\b"#, options: .regularExpression) != nil {
            every = 1
        } else if let m = firstMatch(#"every (\d+)\s*(?:hours?|hrs?|h)\b"#, in: s) ?? firstMatch(#"every (\w+) (?:hours?|hrs?)\b"#, in: s) {
            let word = m[1]
            if let n = Int(word) ?? numberWords[word], (1...24).contains(n) { every = n }
            else if word == "few" || word == "couple" { every = 3 }
            else { return nil }
        }
        if let every {
            let window = parseWindow(in: s)
            return RoutineSchedule(kind: .hours, everyHours: every, fromHour: window?.from, untilHour: window?.until)
        }
        let time = parseTime(in: s)
        // A weekday name, singular or plural.
        for (index, name) in weekdayNames.enumerated() where s.contains(name) {
            let t = time ?? (periodTime(in: s) ?? (9, 0))
            return RoutineSchedule(kind: .weekly, hour: t.0, minute: t.1, weekday: index + 1)
        }
        if s.contains("weekday") || s.contains("work day") || s.contains("workday") || s.contains("school day") {
            let t = time ?? (periodTime(in: s) ?? (9, 0))
            return RoutineSchedule(kind: .weekdays, hour: t.0, minute: t.1)
        }
        if s.contains("every") || s.contains("each") || s.contains("daily") || s.contains("a day") || s.contains("per day") {
            if let t = time ?? periodTime(in: s) { return RoutineSchedule(kind: .daily, hour: t.0, minute: t.1) }
            if s.contains("day") { return RoutineSchedule(kind: .daily, hour: 9, minute: 0) }
            return nil
        }
        if let t = time ?? periodTime(in: s), s.contains("at") || periodTime(in: s) != nil { return RoutineSchedule(kind: .daily, hour: t.0, minute: t.1) }
        return nil
    }

    /// One end of a window: "9", "9 am", "11:30 pm", "nine", "noon", "midnight".
    static let windowTime = #"(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?|noon|midnight|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s*(?:am|pm))?)"#

    /// "between A and B", "from A to B", "A to B", "A-B"; midnight is 24 as the end and noon is 12. An end with no am or
    /// pm that would come before the start is in the afternoon ("9-5" is 9 am to 5 pm).
    static func parseWindow(in s: String) -> (from: Int, until: Int)? {
        let t = windowTime
        guard let m = firstMatch(#"\bbetween "# + t + #" and "# + t + #"\b"#, in: s)
                ?? firstMatch(#"\b"# + t + #"\s*(?:to|until|till|through|-|–)\s*"# + t + #"(?![\d:])"#, in: s),
              m.count >= 3, let start = windowHour(m[1], isEnd: false), var end = windowHour(m[2], isEnd: true) else { return nil }
        if !end.suffixed, end.hour <= start.hour, end.hour + 12 <= 24 { end.hour += 12 }
        guard (0...23).contains(start.hour), (1...24).contains(end.hour), start.hour != end.hour % 24 || end.hour == 24 else { return nil }
        return (start.hour, end.hour)
    }

    static func windowHour(_ token: String, isEnd: Bool) -> (hour: Int, suffixed: Bool)? {
        let token = token.trimmingCharacters(in: .whitespaces)
        if token == "noon" { return (12, true) }
        if token == "midnight" { return (isEnd ? 24 : 0, true) }
        guard let m = firstMatch(#"^(\d{1,2}|\w+)(?::(\d{2}))?\s*(am|pm)?$"#, in: token), var hour = Int(m[1]) ?? numberWords[m[1]] else { return nil }
        let suffix = m.count > 3 ? m[3] : ""
        if suffix == "pm", hour < 12 { hour += 12 }
        if suffix == "am", hour == 12 { hour = isEnd ? 24 : 0 }
        guard (0...24).contains(hour) else { return nil }
        return (hour, !suffix.isEmpty)
    }

    static func firstMatch(_ pattern: String, in text: String) -> [String]? {
        guard let regex = try? NSRegularExpression(pattern: pattern), let m = regex.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) else { return nil }
        return (0..<m.numberOfRanges).map { i in m.range(at: i).location == NSNotFound ? "" : (text as NSString).substring(with: m.range(at: i)) }
    }

    static func periodTime(in s: String) -> (Int, Int)? {
        for (word, hour) in periodHours where s.range(of: #"\b"# + word + #"\b"#, options: .regularExpression) != nil {
            return (hour, 0)
        }
        return nil
    }

    /// "at 8", "at 7:30 am", "at nine pm", "8am", "at noon".
    static func parseTime(in s: String) -> (Int, Int)? {
        if let m = firstMatch(#"(?:at |@ ?)?\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b"#, in: s) ?? firstMatch(#"\bat (\d{1,2})(?::(\d{2}))?\b"#, in: s) {
            guard var hour = Int(m[1]) else { return nil }
            let minute = m.count > 2 && !m[2].isEmpty ? Int(m[2]) ?? 0 : 0
            let suffix = m.count > 3 ? m[3] : ""
            if suffix == "pm", hour < 12 { hour += 12 }
            if suffix == "am", hour == 12 { hour = 0 }
            // "at 10" with no am/pm next to evening or night means pm; "at 3" in the afternoon too.
            if suffix.isEmpty, hour < 12, s.contains("evening") || s.contains("night") { hour += 12 }
            if suffix.isEmpty, hour <= 7, s.contains("afternoon") { hour += 12 }
            guard (0...23).contains(hour), (0...59).contains(minute) else { return nil }
            return (hour, minute)
        }
        if let m = firstMatch(#"\bat (\w+)(?: (am|pm))?\b"#, in: s), var hour = numberWords[m[1]] {
            if m.count > 2, m[2] == "pm", hour < 12 { hour += 12 }
            if m.count <= 2 || m[2].isEmpty {
                if hour < 12, s.contains("evening") || s.contains("night") { hour += 12 }
                if hour <= 7, s.contains("afternoon") { hour += 12 }
            }
            return (hour, 0)
        }
        return nil
    }

    /// The next run strictly after `date`.
    public func next(after date: Date, calendar: Calendar = .current) -> Date {
        switch kind {
        case .hours:
            if let window { return nextInWindow(after: date, window: window, calendar: calendar) }
            let step = TimeInterval(max(everyHours ?? 1, 1) * 3600)
            let next = date.addingTimeInterval(step).timeIntervalSinceReferenceDate
            return Date(timeIntervalSinceReferenceDate: floor(next / 60) * 60)
        case .daily, .weekdays, .weekly:
            var candidate = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: date) ?? date
            if candidate <= date { candidate = calendar.date(byAdding: .day, value: 1, to: candidate) ?? candidate }
            var guardCount = 0
            while guardCount < 14 {
                let wd = calendar.component(.weekday, from: candidate)
                let ok: Bool
                switch kind {
                case .weekdays: ok = (2...6).contains(wd)
                case .weekly: ok = wd == (weekday ?? 2)
                default: ok = true
                }
                if ok { return candidate }
                candidate = calendar.date(byAdding: .day, value: 1, to: candidate) ?? candidate
                guardCount += 1
            }
            return candidate
        }
    }

    /// The window's grid, in hours from the start of the day it begins (24 and up are the next day).
    func windowSlots(_ window: (from: Int, until: Int)) -> [Int] {
        let step = max(everyHours ?? 1, 1)
        let end = window.until > window.from ? window.until : window.until + 24
        return Array(stride(from: window.from, through: end, by: step))
    }

    func nextInWindow(after date: Date, window: (from: Int, until: Int), calendar: Calendar) -> Date {
        let slots = windowSlots(window)
        let today = calendar.startOfDay(for: date)
        for offset in -1...2 {
            guard let day = calendar.date(byAdding: .day, value: offset, to: today) else { continue }
            for slot in slots {
                guard let base = calendar.date(byAdding: .day, value: slot / 24, to: day),
                      let candidate = calendar.date(bySettingHour: slot % 24, minute: 0, second: 0, of: base), candidate > date else { continue }
                return candidate
            }
        }
        return date.addingTimeInterval(TimeInterval(max(everyHours ?? 1, 1) * 3600))
    }

    static func hourWord(_ hour: Int) -> String {
        switch hour % 24 {
        case 0: return "midnight"
        case 12: return "noon"
        case let h: return "\(h % 12 == 0 ? 12 : h % 12) \(h < 12 ? "am" : "pm")"
        }
    }

    public var words: String {
        switch kind {
        case .hours:
            let n = everyHours ?? 1
            let every = n == 1 ? "every hour" : "every \(n) hours"
            guard let window else { return every }
            return "\(every), \(Self.hourWord(window.from)) to \(Self.hourWord(window.until))"
        case .daily: return "every day at \(clock)"
        case .weekdays: return "weekdays at \(clock)"
        case .weekly:
            let name = Self.weekdayNames[((weekday ?? 2) - 1 + 7) % 7]
            return "\(name)s at \(clock)"
        }
    }

    var clock: String {
        let h12 = hour % 12 == 0 ? 12 : hour % 12
        let suffix = hour < 12 ? "am" : "pm"
        return minute == 0 ? "\(h12) \(suffix)" : String(format: "%d:%02d %@", h12, minute, suffix)
    }
}

public struct Routine: Codable, Identifiable, Equatable, Sendable {
    public var id: String
    /// The agent's slug.
    public var agent: String
    public var agentName: String
    /// Two to four words the agent names it by (TC-06: HeyClicky's routines are keyed by title).
    /// Routines made before titles, and from talk, have none; `displayTitle` stands in.
    public var title: String?
    public var brief: String
    public var schedule: RoutineSchedule
    public var paused: Bool
    public var created: Date
    public var lastRun: Date?
    public var nextRun: Date
    /// Failed runs in a row; three pause the routine.
    public var failures: Int
    public var lastNote: String?
    /// report: say what changed; watch: check, and speak up only when something needs him (07). Nil in files from
    /// before 07, which are report routines.
    public var mode: RoutineMode?

    /// The mode a run takes.
    public var runMode: RoutineMode { mode ?? .report }

    /// A new routine runs once right away unless `runFirstNow` is false (round seven, G3: HeyClicky's
    /// first run happens at once, so he sees what the routine makes); after that it keeps its schedule.
    public init(id: String = UUID().uuidString.lowercased(), agent: String, agentName: String, brief: String, schedule: RoutineSchedule,
                now: Date = Date(), runFirstNow: Bool = true, title: String? = nil, mode: RoutineMode = .report) {
        self.id = id
        self.agent = agent
        self.agentName = agentName
        self.title = title
        self.brief = brief
        self.schedule = schedule
        self.paused = false
        self.created = now
        self.lastRun = nil
        self.nextRun = runFirstNow ? now : schedule.next(after: now)
        self.failures = 0
        self.lastNote = nil
        self.mode = mode
    }

    public static let failuresBeforePause = 3
}

/// The routines file (`~/Dot/routines.json`).
public struct RoutineBook: Codable, Equatable {
    public var routines: [Routine]
    public init(routines: [Routine] = []) { self.routines = routines }

    /// Routines whose time has come: not paused, next run at or before `now`. A run missed while
    /// the Mac slept shows up here once; the next time is then computed from now, so an hourly
    /// routine asleep for eight hours runs once, not eight times.
    public func due(at now: Date) -> [Routine] {
        routines.filter { !$0.paused && $0.nextRun <= now }.sorted { $0.nextRun < $1.nextRun }
    }

    public mutating func markStarted(_ id: String, at now: Date) {
        guard let i = routines.firstIndex(where: { $0.id == id }) else { return }
        routines[i].lastRun = now
        routines[i].nextRun = routines[i].schedule.next(after: now)
    }

    /// Records the outcome; returns true when this failure paused the routine.
    @discardableResult
    public mutating func markFinished(_ id: String, failed: Bool, note: String?) -> Bool {
        guard let i = routines.firstIndex(where: { $0.id == id }) else { return false }
        if failed {
            routines[i].failures += 1
            routines[i].lastNote = note
            if routines[i].failures >= Routine.failuresBeforePause {
                routines[i].paused = true
                routines[i].lastNote = "paused after \(routines[i].failures) failed runs in a row" + (note.map { ": \($0)" } ?? "")
                return true
            }
        } else {
            routines[i].failures = 0
            routines[i].lastNote = nil
        }
        return false
    }

    public static func load(from url: URL) -> RoutineBook {
        guard let data = try? Data(contentsOf: url) else { return RoutineBook() }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode(RoutineBook.self, from: data)) ?? RoutineBook()
    }

    public func save(to url: URL) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try encoder.encode(self).write(to: url, options: .atomic)
    }
}
