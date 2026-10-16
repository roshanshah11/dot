import Foundation

/// What an agent may do on its own, class by class. The shape is OpenAI's dots Custom Rules
/// (take action without asking, only if pre-approved, ask before taking action, hand off to you)
/// applied to Dot's agents, with Meta Muse's rule that a send or a purchase always checks in and
/// HeyClicky's "your yes covers one conversation" for computer use. Reads are free, what goes
/// outward asks, and he can make any class his own. Per-agent overrides sit on the defaults.
public enum ActionClass: String, Codable, CaseIterable, Sendable {
    case read, write, computer, outward, system

    public var title: String {
        switch self {
        case .read: return "Reading"
        case .write: return "Writing"
        case .computer: return "Using apps"
        case .outward: return "Sending and paying"
        case .system: return "Changing the Mac"
        }
    }

    public var detail: String {
        switch self {
        case .read: return "files, mail, the web, the calendar, Atlas: looking things up"
        case .write: return "files under his home, drafts, notes, his own calendar"
        case .computer: return "driving an app: clicks, typing and scrolling through the computer-use tools"
        case .outward: return "a send, a submit, a post, a payment, a delete outside the agent's folder, a push"
        case .system: return "installs, system settings, launch agents, anything with sudo"
        }
    }
}

public enum ActionBehavior: String, Codable, CaseIterable, Sendable {
    case act, ifAsked, ask, mine

    public var title: String {
        switch self {
        case .act: return "do it"
        case .ifAsked: return "only if I asked"
        case .ask: return "ask first"
        case .mine: return "leave it to me"
        }
    }

    public var detail: String {
        switch self {
        case .act: return "without asking"
        case .ifAsked: return "when the brief asked for it in so many words; otherwise ask"
        case .ask: return "a card in the notch each time"
        case .mine: return "the agent prepares it and stops; he does that step himself"
        }
    }
}

public struct AgentRules: Codable, Equatable, Sendable {
    /// Behavior per class, keyed by `ActionClass.rawValue` so the JSON reads plainly.
    public var defaults: [String: ActionBehavior]
    /// Per-agent overrides: slug, then class.
    public var agents: [String: [String: ActionBehavior]]

    public init(defaults: [String: ActionBehavior], agents: [String: [String: ActionBehavior]] = [:]) {
        self.defaults = defaults
        self.agents = agents
    }

    /// Dot's behavior before rules existed: reads, writes and app driving pass (the consent policy
    /// still guards protected folders and risky commands); sends and system changes ask.
    public static let standard = AgentRules(defaults: [
        ActionClass.read.rawValue: .act, ActionClass.write.rawValue: .act, ActionClass.computer.rawValue: .act,
        ActionClass.outward.rawValue: .ask, ActionClass.system.rawValue: .ask,
    ])

    public func behavior(for cls: ActionClass, agent slug: String? = nil) -> ActionBehavior {
        if let slug, let own = agents[slug]?[cls.rawValue] { return own }
        return defaults[cls.rawValue] ?? AgentRules.standard.defaults[cls.rawValue] ?? .ask
    }

    /// nil clears an agent's override for that class (the default applies again).
    public mutating func set(_ behavior: ActionBehavior?, for cls: ActionClass, agent slug: String?) {
        if let slug {
            var own = agents[slug] ?? [:]
            if let behavior { own[cls.rawValue] = behavior } else { own.removeValue(forKey: cls.rawValue) }
            if own.isEmpty { agents.removeValue(forKey: slug) } else { agents[slug] = own }
        } else if let behavior {
            defaults[cls.rawValue] = behavior
        }
    }

    public func override(for cls: ActionClass, agent slug: String) -> ActionBehavior? { agents[slug]?[cls.rawValue] }
    public func hasOverrides(for slug: String) -> Bool { !(agents[slug] ?? [:]).isEmpty }

    /// One line for an agent's brief, so it prepares instead of attempting what is his.
    public func briefLine(for slug: String) -> String {
        let mine = ActionClass.allCases.filter { behavior(for: $0, agent: slug) == .mine }
        let asks = ActionClass.allCases.filter { [.ask, .ifAsked].contains(behavior(for: $0, agent: slug)) }
        var parts: [String] = []
        if !mine.isEmpty { parts.append("his to do, never yours: " + mine.map { $0.title.lowercased() }.joined(separator: ", ") + "; prepare it and stop, then say what is ready") }
        if !asks.isEmpty { parts.append("Dot shows him a card before: " + asks.map { $0.title.lowercased() }.joined(separator: ", ")) }
        return parts.joined(separator: ". ")
    }

    // MARK: Files

    public static func load(from url: URL) -> AgentRules {
        guard let data = try? Data(contentsOf: url), let rules = try? JSONDecoder().decode(AgentRules.self, from: data) else { return .standard }
        var merged = rules
        for (key, value) in AgentRules.standard.defaults where merged.defaults[key] == nil { merged.defaults[key] = value }
        return merged
    }

    public func save(to url: URL) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try encoder.encode(self).write(to: url, options: .atomic)
    }

    // MARK: Which class a tool call falls in

    static let systemWords = try! NSRegularExpression(pattern: #"(^|[\s;&|(])(sudo|brew\s+(install|uninstall|upgrade|services|tap)|pip3?\s+install|npm\s+(i|install)\s+-g|gem\s+install|defaults\s+write|launchctl|tccutil|csrutil|spctl|chsh|dscl|systemsetup|networksetup|softwareupdate|xcode-select\s+--install|killall)\b"#)
    static let outwardCommandWords = try! NSRegularExpression(pattern: #"(^|[\s;&|(])(git\s+push|gh\s+(pr\s+create|pr\s+merge|release\s+create|issue\s+create|repo\s+(create|delete))|npm\s+publish|vercel(\s+deploy|\s+--prod|\s*$)|imsg\s+send|gmail\s+send|outlook\s+send|sendmail|rm\s+-rf?\s+(~|/|\$HOME))\b|curl\s[^\n]*(-X\s*(POST|PUT|DELETE|PATCH)|--data|-d\s)"#, options: [.caseInsensitive])
    static let outwardToolWords = try! NSRegularExpression(pattern: #"(^|_)(send|reply|forward|submit|apply|post|publish|pay|purchase|checkout|order|book|delete|trash|remove|cancel|transfer|unsubscribe)(_|$)"#, options: [.caseInsensitive])
    static let writeToolWords = try! NSRegularExpression(pattern: #"(^|_)(create|update|write|edit|draft|label|unlabel|add|set|upsert|move|rename|archive|mark|insert|append|copy|upload|share|star|snooze|schedule)(_|$)"#, options: [.caseInsensitive])
    static let computerServers: Set<String> = ["cua-driver", "cua-computer-use", "computer-use", "cmux-cua"]
    static let readTools: Set<String> = ["Read", "Grep", "Glob", "LS", "WebSearch", "WebFetch", "TodoWrite", "TodoRead", "Skill", "Agent", "Task", "ToolSearch", "NotebookRead", "ListMcpResourcesTool", "ReadMcpResourceTool"]
    static let writeTools: Set<String> = ["Write", "Edit", "MultiEdit", "NotebookEdit"]

    static func matches(_ regex: NSRegularExpression, _ text: String) -> Bool {
        regex.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) != nil
    }

    /// The class of one tool call. `flattened` is the whole input as text (for a click whose
    /// target names a send or a purchase).
    public static func classify(toolName: String, command: String?, flattened: String) -> ActionClass {
        if readTools.contains(toolName) { return .read }
        if writeTools.contains(toolName) { return .write }
        if toolName == "Bash" {
            let cmd = command ?? ""
            if matches(systemWords, cmd) { return .system }
            if ConsentPolicy.mentionsCommit(cmd) || matches(outwardCommandWords, cmd) { return .outward }
            let first = cmd.trimmingCharacters(in: .whitespaces).split(separator: " ").first.map(String.init) ?? ""
            if ConsentPolicy.defaultSafeCommands.contains(first) { return .read }
            if first == "git", let sub = cmd.split(separator: " ").dropFirst().first, ConsentPolicy.defaultSafeGitSubcommands.contains(String(sub)) { return .read }
            return .write
        }
        if toolName.hasPrefix("mcp__") {
            let parts = toolName.split(separator: "__").map(String.init)
            let server = parts.count > 1 ? parts[1] : ""
            let tool = parts.count > 2 ? parts[2...].joined(separator: "_") : toolName
            if computerServers.contains(server) { return ConsentPolicy.mentionsCommit(flattened) ? .outward : .computer }
            if matches(outwardToolWords, tool) { return .outward }
            if matches(writeToolWords, tool) { return .write }
            return .read
        }
        return .write
    }

    /// Whether his brief asked for an action of this class in so many words (dots' "pre-approved":
    /// a draft he asked for does not approve a send).
    static let askedWords: [ActionClass: NSRegularExpression] = [
        .outward: try! NSRegularExpression(pattern: #"\b(send|submit|post|publish|pay|buy|order|book|push|email (him|her|them|\w+@)|text (him|her|them)|delete|trash|unsubscribe)\b"#, options: [.caseInsensitive]),
        .computer: try! NSRegularExpression(pattern: #"\b(click|open|drive|navigate|use (the )?(app|browser)|type (it )?in(to)?|fill (in|out)|scroll)\b"#, options: [.caseInsensitive]),
        .write: try! NSRegularExpression(pattern: #"\b(write|make|create|save|draft|edit|update|build|put together|rename|move)\b"#, options: [.caseInsensitive]),
        .system: try! NSRegularExpression(pattern: #"\b(install|set up|configure|uninstall|upgrade)\b"#, options: [.caseInsensitive]),
        .read: try! NSRegularExpression(pattern: #"\b(read|look|find|check|search|research|summari[sz]e|compare)\b"#, options: [.caseInsensitive]),
    ]

    public static func briefAsks(for cls: ActionClass, brief: String) -> Bool {
        guard let regex = askedWords[cls] else { return false }
        return matches(regex, brief)
    }
}
