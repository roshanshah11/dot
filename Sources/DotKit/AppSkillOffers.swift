import Foundation

/// One offer of a skill for what is in front: the line beside the cursor and what a yes asks for.
public struct AppSkillOffer: Equatable, Sendable {
    /// The table row ("powerpoint", "excel", "filing", "canvas"), offered at most once a day.
    public let row: String
    /// The skill's folder name under ~/.claude/skills; the agent is told to use it.
    public let skill: String
    /// The quiet line beside the cursor, as the SK-01 block words it.
    public let line: String
    /// What a yes asks Dot, in his words: hand it to an agent with the skill named.
    public let ask: String
    /// Noticer's kind for the yes and no counts (three no's and no yes retire it).
    public var kind: String { "app." + row }
}

/// SK-01: the skill that fits the app in front ("want a check of this model?"). A table from the
/// app (bundle id), the page (url host) or a filing on screen to one of his skills. Pure, so the
/// table and the once-a-day memory are tested; Noticer makes the offer on an app switch.
public enum AppSkillOffers {
    public enum Key {
        case bundle(String)
        case host(String)
        /// A 10-K, 10-Q, 8-K, S-1, 20-F or DEF 14A in a PDF reader or browser (`ContextMode.isFiling`).
        case filing
    }

    public struct Row {
        public let id: String
        public let key: Key
        /// The first skill whose title pattern matches; a nil pattern always matches. None, no offer.
        let skills: [(pattern: NSRegularExpression?, skill: String)]
        public let line: String
        /// One line for Home's offer counts.
        public let about: String
        /// The ask; {skill} and {what} (the title and the file or page) are filled in.
        let ask: String
        public var skillNames: [String] { skills.map(\.skill) }
        /// The same kind its offers carry, for Home's counts.
        public var kind: String { "app." + id }
    }

    /// A DCF by its words; checked first, so "DCF model.xlsx" goes to dcf-valuation.
    static let dcfWords = try! NSRegularExpression(pattern: #"(?i)\b(?:dcf|valuation|wacc|intrinsic|terminal value|football field|sensitivity)\b"#)
    /// Any other model. A workbook with neither (a tracker, Book1) gets no offer, so a few no's on
    /// trackers cannot retire the offer for his models.
    static let modelWords = try! NSRegularExpression(pattern: #"(?i)\b(?:models?|modell?ing|lbo|3[- ]?statements?|three[- ]statements?|projections?|forecasts?|merger|m&a|accretion|dilution|operating)\b"#)

    static let handOff = "hand this to an agent and tell it to use the {skill} skill: "

    /// In order; the first row that matches makes the offer. Every skill was checked to exist under
    /// ~/.claude/skills on 2026-10-17. The course map is not a skill (it is the markdown in
    /// ~/Dot/talk/context), so Canvas names course-notes, the closest real one, kept to one assignment.
    public static let rows: [Row] = [
        Row(id: "powerpoint", key: .bundle(KnownApps.powerPoint), skills: [(nil, "powerpoint-design")],
            line: "want me to make this deck look designed?",
            about: "PowerPoint in front: powerpoint-design on the deck",
            ask: handOff + "make the deck I have open in PowerPoint look designed ({what}). brief me first, and save the new version as a copy, never over my file."),
        Row(id: "excel", key: .bundle(KnownApps.excel), skills: [(dcfWords, "dcf-valuation"), (modelWords, "financial-modeling")],
            line: "want a check of this model?",
            about: "a model in Excel: a check with dcf-valuation or financial-modeling",
            ask: handOff + "check the model I have open in Excel ({what}): formulas, hard-coded numbers, links between sheets and the assumptions. tell me what's wrong and where; change nothing in the file."),
        Row(id: "filing", key: .filing, skills: [(nil, "source-notes")],
            line: "want notes on this filing?",
            about: "a 10-K, 10-Q, 8-K or S-1 on screen: source-notes",
            ask: handOff + "take my notes on the filing I have open ({what})."),
        Row(id: "canvas", key: .host("canvas.uchicago.edu"), skills: [(nil, "course-notes")],
            line: "want the plan for this assignment?",
            about: "a Canvas page: the plan for the assignment, from the course map",
            ask: handOff + "this one assignment only, not the whole course. read the canvas assignment I have open ({what}) and what it links, then give me the plan for it: the parts, what each needs from the course map in ~/Dot/talk/context, and the order to do them in. the plan, not the answers."),
    ]

    /// The offer for what is in front, or nil. `url` is the page a browser shows; `documentPath` the
    /// file a window shows (both from ScreenContext), named in the ask so the agent can find it.
    public static func match(bundleID: String?, windowTitle: String?, url: String?, documentPath: String? = nil) -> AppSkillOffer? {
        let title = windowTitle ?? ""
        for row in rows {
            let hit: Bool
            switch row.key {
            case .bundle(let id): hit = bundleID?.lowercased() == id.lowercased()
            case .host(let host): hit = ContextMode.host(of: url).map { $0 == host || $0.hasSuffix("." + host) } ?? false
            case .filing: hit = ContextMode.isFiling(bundleID: bundleID, windowTitle: windowTitle, url: url)
            }
            guard hit else { continue }
            let range = NSRange(location: 0, length: (title as NSString).length)
            guard let skill = row.skills.first(where: { $0.pattern == nil || $0.pattern!.firstMatch(in: title, range: range) != nil })?.skill else { return nil }
            let ask = row.ask.replacingOccurrences(of: "{skill}", with: skill)
                .replacingOccurrences(of: "{what}", with: describe(title: title, place: url ?? documentPath))
            return AppSkillOffer(row: row.id, skill: skill, line: row.line, ask: ask)
        }
        return nil
    }

    /// "\"AAPL DCF.xlsx\", /Users/.../AAPL DCF.xlsx": the title in quotes (one line, at most 100
    /// characters) and where it lives.
    static func describe(title: String, place: String?) -> String {
        let clean = String(title.replacingOccurrences(of: "\"", with: "'").split(whereSeparator: \.isNewline).joined(separator: " ").prefix(100))
            .trimmingCharacters(in: .whitespaces)
        let parts = [clean.isEmpty ? nil : "\"\(clean)\"", place.flatMap { $0.isEmpty ? nil : String($0.prefix(300)) }].compactMap { $0 }
        return parts.isEmpty ? "the window in front" : parts.joined(separator: ", ")
    }

    // MARK: Once per row per day

    /// The day in his time zone, "2026-10-17".
    public static func day(_ date: Date, timeZone: TimeZone = .current) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// True when the row has not been offered today. `lastOffered` maps a row to the day it last was.
    public static func isDue(_ row: String, lastOffered: [String: String], today: String) -> Bool {
        lastOffered[row] != today
    }
}
