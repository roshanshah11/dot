import Foundation

/// A routine change an agent asks for at the end of its turn (TC-06): one line
/// `Routine: {"action":"create|update|pause|resume|delete","title":...,"when":...,"task":...}`.
/// HeyClicky's agents edit their own routines through a ROUTINE block keyed by a two-to-four-word
/// title (C60); Dot's take is the same shape with `when` in plain words, as talk's routines are.
public struct RoutineCommand: Equatable, Sendable {
    public enum Action: String, CaseIterable, Sendable { case create, update, pause, resume, delete }

    public let action: Action
    public let title: String
    /// Plain words for the schedule ("every weekday at 8 am"); create needs it, update may change it.
    public let when: String?
    /// The brief each run gets, self-contained; create needs it, update may change it.
    public let task: String?

    /// Nil when the command could not be carried out: no title, a create without a schedule Dot can
    /// read or without a task, an update that changes nothing or names a schedule Dot cannot read.
    public init?(action: Action, title: String, when: String? = nil, task: String? = nil) {
        let title = RoutineCommand.clean(title)
        guard !title.isEmpty, title.count <= 80 else { return nil }
        let when = when.map(RoutineCommand.clean).flatMap { $0.isEmpty ? nil : $0 }
        let task = task?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        switch action {
        case .create:
            guard let when, RoutineSchedule.parse(when) != nil, task != nil else { return nil }
        case .update:
            guard when != nil || task != nil else { return nil }
            if let when, RoutineSchedule.parse(when) == nil { return nil }
        case .pause, .resume, .delete:
            break
        }
        self.action = action
        self.title = title
        self.when = action == .create || action == .update ? when : nil
        self.task = action == .create || action == .update ? task : nil
    }

    public var schedule: RoutineSchedule? { when.flatMap(RoutineSchedule.parse) }

    /// The JSON after `Routine:`; nil for anything that is not an object with a known action and a
    /// usable title, schedule and task.
    public static func parse(json text: String) -> RoutineCommand? {
        guard let data = text.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let actionWord = object["action"] as? String,
              let action = Action(rawValue: actionWord.trimmingCharacters(in: .whitespaces).lowercased()),
              let title = object["title"] as? String else { return nil }
        return RoutineCommand(action: action, title: title, when: object["when"] as? String, task: object["task"] as? String)
    }

    /// How an agent asks for one, for its brief's context lines.
    public static let howTo = #"To make, change, pause, resume or delete one of your routines, end your reply with one line Routine: {"action":"create|update|pause|resume|delete","title":"<two to four words>","when":"<plain words, like every weekday at 8 am>","task":"<the whole brief for each run, without the schedule>"}; the other actions name a title from this list."#

    /// One spelling for comparing titles: lowercased, single spaces, no wrapping quotes or end punctuation.
    static func key(_ title: String) -> String { clean(title).lowercased() }

    static func clean(_ text: String) -> String {
        var s = text.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: " ")
        s = s.trimmingCharacters(in: CharacterSet(charactersIn: "\"'`*“”‘’"))
        while let last = s.last, ".,;:!".contains(last) { s.removeLast() }
        return s.trimmingCharacters(in: .whitespaces)
    }
}

/// What a routine command did, for the agent's thread and the log.
public enum RoutineChange: Equatable {
    case created(Routine)
    case updated(Routine)
    case paused(Routine)
    case resumed(Routine)
    case deleted(Routine)
    /// Update, pause, resume or delete named a title this agent has no routine by.
    case notFound(String)

    public var words: String {
        switch self {
        case .created(let r): return "made the routine \(r.displayTitle), \(r.schedule.words)"
        case .updated(let r): return "changed the routine \(r.displayTitle), \(r.schedule.words)"
        case .paused(let r): return "paused the routine \(r.displayTitle)"
        case .resumed(let r): return "resumed the routine \(r.displayTitle), \(r.schedule.words)"
        case .deleted(let r): return "deleted the routine \(r.displayTitle)"
        case .notFound(let title): return "no routine called \(title)"
        }
    }
}

extension Routine {
    /// Its title, or for one made without a title the brief's first four words, so the list an
    /// agent is sent (TC-07) names every routine by something it can hand back.
    public var displayTitle: String {
        if let title, !title.trimmingCharacters(in: .whitespaces).isEmpty { return title }
        let words = brief.components(separatedBy: .whitespacesAndNewlines)
            .map { $0.trimmingCharacters(in: .punctuationCharacters) }
            .filter { !$0.isEmpty }
        return words.prefix(4).joined(separator: " ")
    }

    /// The brief for "fix it" on a paused routine's notice (TC-11, HeyClicky's C102).
    public var fixBrief: String {
        var out = "Your routine \"\(displayTitle)\" (\(schedule.words)) is paused after failing."
        out += " Its brief: \(brief)"
        if let lastNote, !lastNote.isEmpty { out += "\nThe last failure: \(lastNote)" }
        out += "\nRead .dot/transcript.jsonl for the failed runs; fix the brief or say what is wrong."
        return out
    }
}

extension RoutineBook {
    /// The agent's routine by title (its own routines only), matched without regard to case.
    public func routine(titled title: String, agent slug: String) -> Routine? {
        let wanted = RoutineCommand.key(title)
        return routines.first { $0.agent == slug && RoutineCommand.key($0.displayTitle) == wanted }
    }

    /// Carries out an agent's command on its own routines. A create whose title the agent already
    /// uses updates that routine instead of making a second. A new routine waits for its first
    /// scheduled time: the turn that asked for it did the work once already (as MB-03's do).
    public mutating func apply(_ command: RoutineCommand, agent slug: String, agentName: String, now: Date = Date()) -> RoutineChange {
        let index = routine(titled: command.title, agent: slug).flatMap { found in routines.firstIndex { $0.id == found.id } }
        switch command.action {
        case .create, .update:
            guard let i = index else {
                guard command.action == .create, let schedule = command.schedule, let task = command.task else { return .notFound(command.title) }
                let routine = Routine(agent: slug, agentName: agentName, brief: task, schedule: schedule, now: now, runFirstNow: false, title: command.title)
                routines.append(routine)
                return .created(routine)
            }
            if let task = command.task { routines[i].brief = task }
            if let schedule = command.schedule {
                routines[i].schedule = schedule
                routines[i].nextRun = schedule.next(after: now)
            }
            if routines[i].title == nil { routines[i].title = command.title }
            return .updated(routines[i])
        case .pause:
            guard let i = index else { return .notFound(command.title) }
            routines[i].paused = true
            return .paused(routines[i])
        case .resume:
            guard let i = index else { return .notFound(command.title) }
            routines[i].paused = false
            routines[i].failures = 0
            routines[i].lastNote = nil
            routines[i].nextRun = routines[i].schedule.next(after: now)
            return .resumed(routines[i])
        case .delete:
            guard let i = index else { return .notFound(command.title) }
            return .deleted(routines.remove(at: i))
        }
    }

    /// The context line every agent turn carries (TC-07): its routines by title and time, and that
    /// the list is complete (HeyClicky's C61: "a routine that is not listed here does not exist").
    public func listLine(for slug: String) -> String {
        let own = routines.filter { $0.agent == slug }
        let items = own.map { "\($0.displayTitle), \($0.schedule.words)" + ($0.paused ? " (paused)" : "") }
        return "Your routines: " + (items.isEmpty ? "none" : items.joined(separator: "; ")) + ". This list is complete."
    }
}

fileprivate extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
