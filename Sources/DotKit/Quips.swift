import Foundation

/// The breaks a quip can come at. Noticer sees the app switches (sameAppRepeat, morning, lateNight,
/// deadlineToday); the animator side reports the rest (back from idle, petted, an agent's result).
public enum QuipSituation: String, CaseIterable, Codable, Sendable {
    /// Back after 3 to 15 minutes idle.
    case backShort
    /// Back after more than 15 minutes idle: Dot was asleep and wakes.
    case backLong
    /// The first sight of him in the morning.
    case morning
    /// A break after 1 am.
    case lateNight
    /// The fifth switch to the same app within ten minutes.
    case sameAppRepeat
    case agentDone
    case agentFailed
    /// Something in Atlas is due today.
    case deadlineToday
    /// He rubbed Dot with the cursor.
    case petted
}

/// What Dot has quipped, kept by the Dot side in UserDefaults and passed in, so the picker stays pure.
public struct QuipHistory: Codable, Equatable, Sendable {
    /// Each line's last showing. Lines past the no-repeat window are dropped as new ones are shown.
    public var shown: [String: Date]
    /// The last quip of any situation, for the cooldown.
    public var lastAt: Date?
    /// The day ("2026-10-17") each once-a-day situation (morning, lateNight, deadlineToday) last showed.
    public var days: [String: String]
    /// The first break seen this morning, from 5 am: "morning" means first sight, so it lapses
    /// half an hour after that break.
    public var morningSince: Date?

    public init(shown: [String: Date] = [:], lastAt: Date? = nil, days: [String: String] = [:], morningSince: Date? = nil) {
        self.shown = shown
        self.lastAt = lastAt
        self.days = days
        self.morningSince = morningSince
    }

    enum CodingKeys: String, CodingKey { case shown, lastAt, days, morningSince }

    /// A missing key decodes to empty, so an older saved history keeps working.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        shown = (try? c.decodeIfPresent([String: Date].self, forKey: .shown)) ?? [:]
        lastAt = try? c.decodeIfPresent(Date.self, forKey: .lastAt)
        days = (try? c.decodeIfPresent([String: String].self, forKey: .days)) ?? [:]
        morningSince = try? c.decodeIfPresent(Date.self, forKey: .morningSince)
    }
}

/// One cheeky line at a break, as a bubble with no voice (his call 2026-10-17). Written lines, no
/// model call, in the voice of docs/persona.md: a really cute pet with a little mischief that teases
/// the work, never him. The picker enforces the chattiness cooldown (40 minutes at the default) and
/// shows no line twice within seven days (Clippy's repeat failure, persona-C15).
public enum Quips {
    public static let maxLength = 60
    public static let noRepeat: TimeInterval = 7 * 24 * 3600
    /// How long after the first break of the morning a "morning" line may still come.
    public static let morningWindow: TimeInterval = 30 * 60
    /// The situations that come at most once a day.
    public static let onceADay: Set<QuipSituation> = [.morning, .lateNight, .deadlineToday]

    public static let lines: [QuipSituation: [String]] = [
        .backShort: [
            "oh, you're back. i kept your spot warm.",
            "welcome back. the work didn't do itself. rude.",
            "back already? the pdf was getting comfortable.",
            "hi again. nothing moved. i checked twice.",
            "you're back. i was definitely not napping.",
            "there you are. the cursor missed you.",
            "short break. the tabs held the line.",
            "oh good. i ran out of things to stare at.",
            "welcome back. i guarded the tabs. mostly.",
            "back. the to-do list pretended not to notice.",
        ],
        .backLong: [
            "mm. i was resting my eyes. what did i miss?",
            "you're back. i dreamt about spreadsheets.",
            "oh, hi. everything's right where you left it.",
            "i napped. ten out of ten. would recommend.",
            "welcome back. i saved you a warm window edge.",
            "oh! hi. i was guarding the screen. eyes closed.",
            "long break. the work is still here, sadly.",
            "you're back. the inbox held its ground.",
            "yawn. okay, i'm up. i'm up.",
            "back from the wild. the deadlines kept your seat.",
        ],
        .morning: [
            "oh good, you're up. the deadlines missed you.",
            "morning. i've been glowing for hours. ok, minutes.",
            "good morning. the calendar is already up to something.",
            "morning. coffee first, then the to-do list gets it.",
            "morning. i slept on the dock. very firm.",
            "rise and shine. mostly shine, that's my job.",
            "good morning. the inbox did things overnight.",
            "morning. today's deadlines are already stretching.",
            "hi. new day, same suspicious pdfs.",
            "morning. i warmed up the screen for you.",
        ],
        .lateNight: [
            "past one. me and the deadlines are both still up.",
            "late shift. i'll glow a little quieter.",
            "it's after one. the spreadsheet looks tired too.",
            "night owl hours. i brought my own light.",
            "the screen and i are the only lights on.",
            "after one. the emails can wait. probably.",
            "it's late. even the pdf is yawning.",
            "still going? okay. i'm on night duty.",
            "one am club. members: you, me, this tab.",
            "late one. the cursor and i are holding steady.",
        ],
        .sameAppRepeat: [
            "fifth time's the charm?",
            "back here again? it must have said something good.",
            "this app again. i think it likes you.",
            "you two again. should i give you a minute?",
            "we keep coming back here. it's cozy, i get it.",
            "round five. the app is winning on points.",
            "again? i'm starting to learn the furniture.",
            "this one keeps pulling you back. suspicious.",
            "same app, fifth visit. regular customer.",
            "i'll wait here. by this app. again.",
        ],
        .agentDone: [
            "done. you're welcome, as usual.",
            "put it on my tab.",
            "finished. i'd take a bow but i'm round.",
            "done and dusted. i'm glowing about it.",
            "all done. told you we'd get it.",
            "done. the hard part was the waiting.",
            "finished. small win, big glow.",
            "done. adding that one to my greatest hits.",
            "handled. i'll be over here, glowing smugly.",
            "done. that job never stood a chance.",
        ],
        .agentFailed: [
            "third time's the charm?",
            "that one fought back. round two?",
            "hm. the job won this round.",
            "it didn't land. we'll get it next try.",
            "that one got away. slippery little task.",
            "not done. the task is being difficult.",
            "it hit a wall. walls are rude.",
            "oops. the job had other plans.",
            "that didn't work. the computer's in a mood.",
            "stuck. it's the task being stubborn.",
        ],
        .deadlineToday: [
            "something's due today. it's been staring at me.",
            "a deadline's today. it thinks it's important.",
            "due today. let's not keep it waiting.",
            "today's deadline is out there, plotting.",
            "one thing's due today. i'm keeping an eye on it.",
            "heads up, today has a deadline in it.",
            "a deadline today. we've beaten scarier ones.",
            "due today. it's no match for us.",
            "today's deadline says hi. ignore its tone.",
            "deadline day. i'll glow extra supportively.",
        ],
        .petted: [
            "hehe. okay, one more.",
            "that's the spot.",
            "i don't purr. that was not a purr.",
            "more of that. for science.",
            "mm. i'm glowing about it.",
            "careful, i'll get used to this.",
            "pets accepted. work resumes shortly.",
            "best part of my job, honestly.",
            "you found my favorite spot. it's all of me.",
            "okay, now i can't focus. worth it.",
        ],
    ]

    /// A line for this break, or nil: chattiness 0, inside the cooldown, a once-a-day situation that
    /// already showed today, or every line of the situation shown in the last seven days. The history
    /// comes back with the line stamped; keep it whether or not anything else changes.
    public static func pick<G: RandomNumberGenerator>(_ situation: QuipSituation, now: Date, chattiness: Int, history: QuipHistory,
                                                      calendar: Calendar = .current, using generator: inout G) -> (line: String, history: QuipHistory)? {
        guard let cooldown = Chattiness(chattiness).quipCooldown else { return nil }
        if let last = history.lastAt, within(cooldown, of: last, now: now) { return nil }
        let today = day(now, calendar)
        if onceADay.contains(situation), history.days[situation.rawValue] == today { return nil }
        let fresh = (lines[situation] ?? []).filter { line in
            history.shown[line].map { !within(noRepeat, of: $0, now: now) } ?? true
        }
        guard let line = fresh.randomElement(using: &generator) else { return nil }
        var next = history
        next.shown = next.shown.filter { within(noRepeat, of: $0.value, now: now) }
        next.shown[line] = now
        next.lastAt = now
        if onceADay.contains(situation) { next.days[situation.rawValue] = today }
        return (line, next)
    }

    public static func pick(_ situation: QuipSituation, now: Date, chattiness: Int, history: QuipHistory,
                            calendar: Calendar = .current) -> (line: String, history: QuipHistory)? {
        var generator = SystemRandomNumberGenerator()
        return pick(situation, now: now, chattiness: chattiness, history: history, calendar: calendar, using: &generator)
    }

    /// Notes a break (any situation, shown or not), so the morning's first sight is known.
    public static func sawBreak(at now: Date, history: QuipHistory, calendar: Calendar = .current) -> QuipHistory {
        guard let fiveAM = calendar.date(bySettingHour: 5, minute: 0, second: 0, of: now), now >= fiveAM else { return history }
        var next = history
        if (history.morningSince.map { $0 < fiveAM || $0 > now }) ?? true { next.morningSince = now }
        return next
    }

    /// The time-of-day situation a break falls in, if it is still due: a break after 1 am (until 5),
    /// or the morning's first sight (5 am to noon, within half an hour of the first break). Each once a day.
    public static func timeOfDay(now: Date, history: QuipHistory, calendar: Calendar = .current) -> QuipSituation? {
        let situation: QuipSituation
        switch calendar.component(.hour, from: now) {
        case 1..<5: situation = .lateNight
        case 5..<12:
            if let since = history.morningSince, !within(morningWindow, of: since, now: now) { return nil }
            situation = .morning
        default: return nil
        }
        return history.days[situation.rawValue] == day(now, calendar) ? nil : situation
    }

    /// A return from idle takes the time of day when one is due ("morning" for the first sight);
    /// every other situation is about an event and stays as it is.
    public static func refine(_ situation: QuipSituation, now: Date, history: QuipHistory, calendar: Calendar = .current) -> QuipSituation {
        guard situation == .backShort || situation == .backLong else { return situation }
        return timeOfDay(now: now, history: history, calendar: calendar) ?? situation
    }

    /// `then` lies within `span` before `now`. A stamp from the future (a clock set back) never blocks.
    static func within(_ span: TimeInterval, of then: Date, now: Date) -> Bool {
        let since = now.timeIntervalSince(then)
        return since >= 0 && since < span
    }

    static func day(_ date: Date, _ calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}

/// App switches by app, for "the fifth switch to the same app within ten minutes".
public struct SwitchCount: Equatable, Sendable {
    public static let window: TimeInterval = 10 * 60
    public static let threshold = 5

    private var times: [String: [Date]] = [:]

    public init() {}

    /// Notes a switch to `app`. True on the fifth within ten minutes; the count then starts over.
    public mutating func switched(to app: String, at now: Date) -> Bool {
        let inWindow = { (time: Date) in time <= now && now.timeIntervalSince(time) < Self.window }
        var recent = (times[app] ?? []).filter(inWindow)
        recent.append(now)
        // Apps not seen inside the window are forgotten, so the table stays small.
        times = times.filter { entry in entry.key != app && entry.value.contains(where: inWindow) }
        guard recent.count < Self.threshold else { return true }
        times[app] = recent
        return false
    }
}
