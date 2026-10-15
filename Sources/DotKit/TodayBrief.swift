import Foundation

/// What `scripts/dot-atlas-today.py` prints: Roshan's day as Atlas knows it. The `block`
/// rides along in every talk turn; the lists feed the morning line and the Home window.
public struct TodayBrief: Codable, Equatable {
    public var builtAt: String
    public var weekday: String
    public var date: String
    public var deadlines: [String]
    public var today: [String]
    public var tomorrow: [String]
    public var commitments: [String]
    public var todo: [String]
    public var waiting: [String]
    public var unanswered: [String]
    public var unansweredCount: Int
    public var preferences: [String]
    public var priorities: [String]
    public var facts: [String]
    public var profileBlock: String
    public var chatPrompt: String
    public var stateHead: String?
    public var block: String
    public var elapsedS: Double?

    enum CodingKeys: String, CodingKey {
        case builtAt = "built_at", weekday, date, deadlines, today, tomorrow, commitments, todo, waiting, unanswered
        case unansweredCount = "unanswered_count", preferences, priorities, facts, profileBlock = "profile_block", chatPrompt = "chat_prompt", stateHead = "state_head", block, elapsedS = "elapsed_s"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        builtAt = try c.decodeIfPresent(String.self, forKey: .builtAt) ?? ""
        weekday = try c.decodeIfPresent(String.self, forKey: .weekday) ?? ""
        date = try c.decodeIfPresent(String.self, forKey: .date) ?? ""
        deadlines = try c.decodeIfPresent([String].self, forKey: .deadlines) ?? []
        today = try c.decodeIfPresent([String].self, forKey: .today) ?? []
        tomorrow = try c.decodeIfPresent([String].self, forKey: .tomorrow) ?? []
        commitments = try c.decodeIfPresent([String].self, forKey: .commitments) ?? []
        todo = try c.decodeIfPresent([String].self, forKey: .todo) ?? []
        waiting = try c.decodeIfPresent([String].self, forKey: .waiting) ?? []
        unanswered = try c.decodeIfPresent([String].self, forKey: .unanswered) ?? []
        unansweredCount = try c.decodeIfPresent(Int.self, forKey: .unansweredCount) ?? unanswered.count
        preferences = try c.decodeIfPresent([String].self, forKey: .preferences) ?? []
        priorities = try c.decodeIfPresent([String].self, forKey: .priorities) ?? []
        facts = try c.decodeIfPresent([String].self, forKey: .facts) ?? []
        profileBlock = try c.decodeIfPresent(String.self, forKey: .profileBlock) ?? ""
        chatPrompt = try c.decodeIfPresent(String.self, forKey: .chatPrompt) ?? ""
        stateHead = try c.decodeIfPresent(String.self, forKey: .stateHead)
        block = try c.decodeIfPresent(String.self, forKey: .block) ?? ""
        elapsedS = try c.decodeIfPresent(Double.self, forKey: .elapsedS)
    }

    public static func parse(_ data: Data) -> TodayBrief? {
        try? JSONDecoder().decode(TodayBrief.self, from: data)
    }

    /// Deadlines whose ISO date falls within the next `days` days (inclusive of today).
    public func deadlines(withinDays days: Int, from date: Date = Date()) -> [String] {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let start = Calendar.current.startOfDay(for: date)
        guard let end = Calendar.current.date(byAdding: .day, value: days, to: start) else { return [] }
        return deadlines.filter { line in
            guard line.count >= 10, let due = formatter.date(from: String(line.prefix(10))) else { return false }
            return due >= start && due <= end
        }
    }

    /// The event happening now or the next one today, from lines like
    /// "Thu 10-15 10:00–10:15 Call: Radha Gupta (at Phone)". Returns the title and minutes until it
    /// starts (negative while it is on) and minutes until it ends.
    public func nextEvent(from date: Date = Date()) -> (title: String, startsIn: Int, endsIn: Int)? {
        let pattern = try! NSRegularExpression(pattern: #"^\w{3} \d{2}-\d{2} (\d{1,2}):(\d{2})[–-](\d{1,2}):(\d{2}) (.+)$"#)
        let calendar = Calendar.current
        let minuteOfDay = calendar.component(.hour, from: date) * 60 + calendar.component(.minute, from: date)
        var best: (String, Int, Int)?
        for line in today {
            let ns = line as NSString
            guard let m = pattern.firstMatch(in: line, range: NSRange(location: 0, length: ns.length)),
                  let sh = Int(ns.substring(with: m.range(at: 1))), let sm = Int(ns.substring(with: m.range(at: 2))),
                  let eh = Int(ns.substring(with: m.range(at: 3))), let em = Int(ns.substring(with: m.range(at: 4))) else { continue }
            let start = sh * 60 + sm, end = eh * 60 + em
            guard end > minuteOfDay else { continue }
            var title = ns.substring(with: m.range(at: 5))
            if let paren = title.range(of: " (at ") { title = String(title[..<paren.lowerBound]) }
            let candidate = (String(title.prefix(48)), start - minuteOfDay, end - minuteOfDay)
            if best == nil || candidate.1 < best!.1 { best = candidate }
        }
        return best
    }

    /// The notch tab's hover line: what is on now or next, the day's count, the mail waiting.
    public func hoverLine(from date: Date = Date()) -> String {
        var parts: [String] = []
        if let event = nextEvent(from: date) {
            if event.startsIn <= 0 {
                parts.append("now: \(event.title.lowercased()), \(event.endsIn) min left")
            } else if event.startsIn < 60 {
                parts.append("next: \(event.title.lowercased()) in \(event.startsIn) min")
            } else {
                parts.append("next: \(event.title.lowercased()) in \(event.startsIn / 60) h \(event.startsIn % 60) min")
            }
        }
        if !today.isEmpty { parts.append("\(today.count) on the calendar today") }
        let week = deadlines(withinDays: 7, from: date)
        if !week.isEmpty { parts.append("\(week.count) deadline\(week.count == 1 ? "" : "s") this week") }
        if unansweredCount > 0 { parts.append("\(unansweredCount) mail waiting") }
        return parts.joined(separator: " · ")
    }

    /// One quiet line for the morning bubble, like "3 deadlines this week, first centerview by 6 pm. 2 mail waiting."
    public func morningLine(from date: Date = Date()) -> String {
        var parts: [String] = []
        let week = deadlines(withinDays: 7, from: date)
        if !week.isEmpty {
            let first = String(week[0].dropFirst(10)).trimmingCharacters(in: .whitespaces)
            let short = first.split(separator: ":").first.map(String.init) ?? first
            parts.append("\(week.count) deadline\(week.count == 1 ? "" : "s") this week, first \(String(short.prefix(60)).lowercased())")
        }
        if !today.isEmpty { parts.append("\(today.count) on the calendar today") }
        if unansweredCount > 0 { parts.append("\(unansweredCount) mail waiting") }
        return parts.joined(separator: ". ")
    }
}
