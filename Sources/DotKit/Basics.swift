import Foundation

// The basics pass (2026-10-18): the pure pieces behind the calendar block, the stale-data line, the
// shift-mode stray-word filter and the retry rule, kept here so the DotKit tests cover them.

/// One calendar event, from this Mac's own calendar (EventKit) or from Atlas's copy.
public struct CalendarItem: Equatable, Sendable {
    public var title: String
    public var start: Date
    public var end: Date
    public var allDay: Bool
    public var location: String
    public var notes: String
    public var calendar: String

    public init(title: String, start: Date, end: Date, allDay: Bool = false, location: String = "", notes: String = "", calendar: String = "") {
        self.title = title; self.start = start; self.end = end; self.allDay = allDay
        self.location = location; self.notes = notes; self.calendar = calendar
    }

    /// Title, place and notes, each case-insensitive: "dance" finds "... Dance Room", "bhangra" the title.
    public func matches(_ query: String) -> Bool {
        let words = query.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init).filter { $0.count >= 3 }
        guard !words.isEmpty else { return false }
        let hay = (title + " " + location + " " + notes).lowercased()
        return words.contains { hay.contains($0) }
    }
}

public enum CalendarLines {
    /// "when is X", "where is my dinner", "what's on today", "do I have class": the turn gets the next 14 days.
    static let asks = try! NSRegularExpression(
        pattern: #"\b(when|where)('s| is| are| was| do| does| did)\b|\bwhat time\b|\b(today|tonight|tomorrow|this week|next week|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(calendar|schedule|meeting|class|lecture|practice|rehearsal|appointment|reservation|dinner|lunch|breakfast|interview|event|plans?|free|busy|due|deadline)\b"#,
        options: .caseInsensitive)

    public static func isCalendarAsk(_ text: String) -> Bool {
        asks.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) != nil
    }

    /// One line per event: "Sun 10-18 17:00–19:00 Bhangra practice (at Ida Noyes Dance Room)".
    public static func line(_ item: CalendarItem, calendar cal: Calendar = .current) -> String {
        let day = DateFormatter()
        day.locale = Locale(identifier: "en_US"); day.calendar = cal; day.timeZone = cal.timeZone
        day.dateFormat = "EEE MM-dd"
        let time = DateFormatter()
        time.locale = Locale(identifier: "en_US"); time.calendar = cal; time.timeZone = cal.timeZone
        time.dateFormat = "HH:mm"
        let when = item.allDay ? "\(day.string(from: item.start)) all day" : "\(day.string(from: item.start)) \(time.string(from: item.start))–\(time.string(from: item.end))"
        let place = item.location.trimmingCharacters(in: .whitespacesAndNewlines)
        return "\(when) \(item.title.trimmingCharacters(in: .whitespacesAndNewlines))" + (place.isEmpty ? "" : " (at \(place.prefix(70)))")
    }

    /// The block for a turn: what is left of today always; the next 14 days when the question is about time or place.
    /// Events already over are dropped; at most `limit` lines.
    public static func block(_ items: [CalendarItem], now: Date, wide: Bool, source: String, limit: Int = 45, calendar cal: Calendar = .current) -> [String] {
        let endOfToday = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: now)) ?? now
        let horizon = wide ? (cal.date(byAdding: .day, value: 14, to: cal.startOfDay(for: now)) ?? now) : endOfToday
        let upcoming = items.filter { $0.end > now && $0.start < horizon }.sorted { $0.start < $1.start }
        var lines = ["[calendar] \(source); \(wide ? "today and the next 14 days" : "the rest of today")" + (upcoming.isEmpty ? ": nothing" : ":")]
        lines += upcoming.prefix(limit).map { "- " + line($0, calendar: cal) }
        if upcoming.count > limit { lines.append("- (\(upcoming.count - limit) more not shown)") }
        lines.append("[/calendar]")
        return lines
    }
}

/// How old this Mac's copy of Atlas is, from the replica's own files: `replica-state.json` ("synced") and
/// `box-watch.json` ("down_since"). Atlas's sources sync on the other MacBook; when it is offline the copy freezes.
public struct AtlasFreshness: Equatable {
    public var synced: Date?
    public var downSince: Date?

    public init(synced: Date?, downSince: Date?) { self.synced = synced; self.downSince = downSince }

    public static func parse(replicaState: Data?, boxWatch: Data?) -> AtlasFreshness {
        func date(_ data: Data?, _ key: String) -> Date? {
            guard let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let text = json[key] as? String else { return nil }
            return parseISO(text)
        }
        return AtlasFreshness(synced: date(replicaState, "synced"), downSince: date(boxWatch, "down_since"))
    }

    static func parseISO(_ text: String) -> Date? {
        for options in [ISO8601DateFormatter.Options.withInternetDateTime.union(.withFractionalSeconds), .withInternetDateTime] {
            let f = ISO8601DateFormatter(); f.formatOptions = options
            if let d = f.date(from: text) { return d }
        }
        return nil
    }

    public func ageHours(now: Date) -> Double? { synced.map { now.timeIntervalSince($0) / 3600 } }

    /// The one line a turn carries when the copy is more than three hours old; nil when it is fresh or unknown.
    public func staleLine(now: Date) -> String? {
        guard let age = ageHours(now: now), age > 3 else { return nil }
        let ageText = age < 48 ? "\(Int(age.rounded())) h" : "\(Int((age / 24).rounded())) days"
        var line = "atlas copy is \(ageText) old"
        if let down = downSince {
            let f = DateFormatter(); f.locale = Locale(identifier: "en_US"); f.dateFormat = "EEE h:mm a"
            line += " (the other macbook has been offline since \(f.string(from: down).lowercased()))"
        }
        return line + ": mail, messages and anything from atlas may be missing recent items; say how old in one clause when the answer depends on it."
    }
}

/// Shift held means "give this to an agent". A stray word or two ("Yeah.", "Lori like.") is not a job.
public enum AgentModeFilter {
    static let filler = try! NSRegularExpression(
        pattern: #"^(?:\W*(?:yeah|yes|yep|yup|no|nope|ok(?:ay)?|um+|uh+|hmm+|mm+|so|like|right|sure|well|oh|ah|and|but|the|i|you|it|that|this|thanks|thank you|cool|nice|wait|what)\W*)+$"#,
        options: .caseInsensitive)

    /// True when the words carry no job: fewer than three words, or nothing but filler.
    public static func isStray(_ text: String) -> Bool {
        let words = text.split(whereSeparator: { $0.isWhitespace }).filter { $0.contains(where: { $0.isLetter }) }
        if words.count < 3 { return true }
        return filler.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) != nil
    }

    /// "start another agent on that", "get a separate agent", "not you, another agent": found a new agent, never
    /// follow up the running one. Asking about one ("what did the new agent find") is not a request for one.
    static let freshWords = try! NSRegularExpression(
        pattern: #"\b(start|spin up|get|use|make|create|spawn|launch|have|put|assign|give (?:it|this|that) to|hand (?:it|this|that) to|send (?:it|this|that) to)\b[^.?!]{0,30}\b(another|a new|a separate|a different|new|separate|different)\b[^.?!]{0,12}\bagent\b|\bnot you\b[^.?!]{0,40}\b(agent|someone else|another one)\b|\b(another|a separate|a different|a new) agent\b[^.?!]{0,30}\bnot you\b"#,
        options: .caseInsensitive)

    public static func wantsFreshAgent(_ text: String) -> Bool {
        freshWords.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) != nil
    }
}

/// The one retry a failed turn gets: only when the CLI dropped it on its own. A turn Dot cut off because he
/// asked something new is never sent again (2026-10-18: the cut-off question came back and "I" was spoken).
public enum TurnRetry {
    public static func shouldRetry(subtype: String, durationMs: Int, cutOffByDot: Bool, alreadyRetried: Bool, hasMessage: Bool) -> Bool {
        subtype == "error_during_execution" && durationMs < 2000 && !cutOffByDot && !alreadyRetried && hasMessage
    }
}
