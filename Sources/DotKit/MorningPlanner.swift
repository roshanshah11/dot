import Foundation

/// One thing Dot could take on today, from the scout's briefs or Atlas's view of the day: the line
/// he sees on the morning card and the brief an agent gets when he says "do it".
public struct MorningSuggestion: Equatable {
    public let key: String
    public let text: String
    public let brief: String
    /// From a scout brief; nil for the templates.
    public var title: String? = nil
    public var description: String? = nil
    /// The greeting's words for it ("prepping Citizen").
    public var short: String? = nil
    public var agentName: String? = nil
    /// Set when the agent is new, so the brief can tell it what it is for.
    public var agentRole: String? = nil
    public var routine: ScoutBrief.Routine? = nil
    /// What a routine run gets: the goal and the EVERY LATER RUN part.
    public var routineBrief: String? = nil
    public var sources: [ScoutBrief.Source] = []
    public var inputs: [String] = []

    public init(key: String, text: String, brief: String) { self.key = key; self.text = text; self.brief = brief }

    public init(scout b: ScoutBrief) {
        key = b.id
        text = b.title
        brief = b.brief
        title = b.title
        description = b.description
        short = b.short
        agentName = b.agent.name
        agentRole = b.agent.isNew ? b.agent.role : nil
        routine = b.routine
        if b.routine != nil, let later = b.laterRuns {
            routineBrief = [b.title + ".", b.goal, later, b.baseline.map { "Baseline file: \($0)" }].compactMap { $0 }.joined(separator: "\n\n")
        }
        sources = b.sources
        inputs = b.inputs
    }

    /// What the agent gets on "do it": [suggestion], the brief, the open inputs, a new agent's role,
    /// and WHERE THIS CAME FROM after it (MB-03; PL-A18 tells agents what the tag means).
    public var handoffBrief: String {
        var parts = ["[suggestion] " + (title.map { $0 + "\n\n" } ?? "") + brief]
        if !inputs.isEmpty, !brief.contains("Open inputs") { parts.append("Open inputs:\n" + inputs.map { "- " + $0 }.joined(separator: "\n")) }
        if let role = agentRole, let name = agentName {
            parts.append("You are new: \(name), \(role). Write that into the Persona section of your CLAUDE.md on this run.")
        }
        if let routine {
            parts.append("This becomes a routine (\(routine.title), \(routine.when)) after this run, so leave the baseline file in place for the later runs.")
        }
        if !sources.isEmpty { parts.append(ScoutBrief.whereThisCameFrom(sources)) }
        return parts.joined(separator: "\n\n")
    }
}

/// Turns the day into a few offers, after HeyClicky's morning card ("I can do 7 things for you
/// today"). Today's scout briefs win when there are any (MB-02); otherwise the day (deadlines,
/// calls, mail waiting, commitments) fills four templates. Pure: what to offer is decided here and
/// tested; when and whether to show it is the app's call.
public enum MorningPlanner {
    public static func suggestions(scout: ScoutBriefFile? = nil, deadlines: [String], today: [String], unanswered: [String], commitments: [String],
                                   date: Date = Date(), declined: Set<String> = [], limit: Int = 5) -> [MorningSuggestion] {
        var out: [MorningSuggestion] = []
        func add(_ s: MorningSuggestion) {
            guard !declined.contains(s.key), !out.contains(where: { $0.key == s.key }) else { return }
            out.append(s)
        }
        // Only a file for this very day counts; its briefs are the whole card, up to seven.
        if let scout, scout.date == ScoutBriefFile.dayString(date), !scout.briefs.isEmpty {
            for b in scout.briefs { add(MorningSuggestion(scout: b)) }
            return Array(out.prefix(max(limit, ScoutBriefFile.maxBriefs)))
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let start = Calendar.current.startOfDay(for: date)
        let soon = Calendar.current.date(byAdding: .day, value: 2, to: start) ?? start

        // Deadlines in the next two days: prepare what can be prepared, never submit.
        for line in deadlines {
            guard line.count > 11, let due = formatter.date(from: String(line.prefix(10))), due >= start, due <= soon else { continue }
            let rest = String(line.dropFirst(10)).trimmingCharacters(in: .whitespaces)
            let short = String((rest.split(separator: ":").first.map(String.init) ?? rest).prefix(70)).lowercased()
            let when = Calendar.current.isDate(due, inSameDayAs: start) ? "today" : (Calendar.current.isDate(due, inSameDayAs: Calendar.current.date(byAdding: .day, value: 1, to: start) ?? start) ? "tomorrow" : String(line.prefix(10)))
            add(MorningSuggestion(key: "deadline:" + String(rest.prefix(48)).lowercased(),
                                  text: "prep \(short), due \(when)",
                                  brief: "prepare what this deadline needs, due \(String(line.prefix(10))): \(rest). make the deliverable (a draft, the filled answers, or a checklist of what is still missing) in the output folder. nothing gets submitted or sent."))
        }

        // A call, interview or coffee chat on the calendar with a person in it: a brief before it.
        let callWords = try! NSRegularExpression(pattern: #"(?i)\b(call|interview|coffee chat|chat with|meeting with|1:1|zoom|info session)\b"#)
        let timePattern = try! NSRegularExpression(pattern: #"^\w{3} \d{2}-\d{2} (\d{1,2}:\d{2})[–-]\d{1,2}:\d{2} (.+)$"#)
        for line in today {
            let ns = line as NSString
            guard let m = timePattern.firstMatch(in: line, range: NSRange(location: 0, length: ns.length)) else { continue }
            var title = ns.substring(with: m.range(at: 2))
            if let paren = title.range(of: " (at ") { title = String(title[..<paren.lowerBound]) }
            guard callWords.firstMatch(in: title, range: NSRange(location: 0, length: (title as NSString).length)) != nil else { continue }
            let time = ns.substring(with: m.range(at: 1))
            let who = title.replacingOccurrences(of: #"(?i)^(call|interview|coffee chat|chat|meeting)[: ]+(with )?"#, with: "", options: .regularExpression)
            add(MorningSuggestion(key: "brief:" + String(title.prefix(48)).lowercased(),
                                  text: "a one-page brief on \(String(who.prefix(50)).lowercased()) before \(time)",
                                  brief: "today at \(time) roshan has: \(title). research the person and the firm (public sources, atlas's notes on them) and write a one-page brief: who they are, what the firm does, three talking points and three questions to ask."))
        }

        // Mail waiting on him: a draft he can send himself.
        for line in unanswered.prefix(3) {
            let parts = line.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            let sender = parts.first ?? line
            let subject = parts.count > 1 ? parts[1].replacingOccurrences(of: #"\s*\(\w{3} \d{2}-\d{2} \d{1,2}\)$"#, with: "", options: .regularExpression) : ""
            let senderShort = sender.split(separator: "@").first.map(String.init) ?? sender
            add(MorningSuggestion(key: "reply:" + String(line.prefix(48)).lowercased(),
                                  text: "draft a reply to \(senderShort)\(subject.isEmpty ? "" : ": " + String(subject.prefix(44)))",
                                  brief: "draft a reply to this email, waiting on roshan: \(line). use the roshan-email skill for the voice, keep it short, leave it as a draft in the right mailbox (outlook for uchicago mail, gmail otherwise). never send."))
        }

        // Open commitments: the message or document, ready for him to send.
        for line in commitments.prefix(2) {
            let short = String(line.prefix(90)).replacingOccurrences(of: #"\s*\(.*$"#, with: "", options: .regularExpression).lowercased()
            add(MorningSuggestion(key: "commit:" + String(line.prefix(48)).lowercased(),
                                  text: "do: \(short)",
                                  brief: "roshan committed to this: \(line). prepare it (the message in his voice, or the document) and leave it in the output folder for him to send."))
        }
        return Array(out.prefix(limit))
    }

    /// "morning. i can do 5 things for you today." With the scout's titles it names the first two or
    /// three (MB-06): "morning. i can do 5 things today, like prepping Citizen and the week plan."
    public static func greeting(count: Int, hour: Int, titles: [String] = []) -> String {
        let opener = hour < 12 ? "morning" : (hour < 17 ? "afternoon" : "evening")
        let things = "\(count) thing\(count == 1 ? "" : "s")"
        var names = titles.prefix(3).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        guard !names.isEmpty else { return "\(opener). i can do \(things) for you today." }
        // Three only when they still read as one breath.
        while names.count > 2, names.joined(separator: ", ").count > 60 { names.removeLast() }
        let list = names.count == 1 ? names[0] : names.dropLast().joined(separator: ", ") + " and " + names[names.count - 1]
        return names.count >= count ? "\(opener). i can do \(things) today: \(list)." : "\(opener). i can do \(things) today, like \(list)."
    }

    /// A title as greeting words: lowercase like the rest of the greeting unless it opens on an
    /// acronym ("SEC filings"). The scout's `short` is already written that way.
    public static func greetingWords(_ s: MorningSuggestion) -> String { s.short ?? lowerFirst(s.title ?? s.text) }

    static func lowerFirst(_ text: String) -> String {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "."))
        guard let first = t.first else { return "" }
        let second = t.dropFirst().first
        if second == nil || second!.isLowercase || second == " " { return first.lowercased() + t.dropFirst() }
        return t
    }
}
