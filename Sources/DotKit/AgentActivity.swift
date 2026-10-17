import Foundation

/// What an agent is doing at this step, read from the tool it called (VI-04): the orb circles a
/// small glyph for it while the agent works. Grouped the way Home's step icons are
/// (`HomeView.stepIcon`): the web, reading, writing, running something on the Mac; planning,
/// helpers and skills are thinking. Computer use (clicks and typing through cua) counts as a
/// command: it acts on the Mac the way a shell command does.
public enum AgentActivity: String, CaseIterable, Sendable {
    case web, reading, writing, command, thinking

    /// The SF Symbol drawn for it; the first four are the ones Home's step rows use.
    public var symbol: String {
        switch self {
        case .web: return "globe"
        case .reading: return "doc.text.magnifyingglass"
        case .writing: return "pencil.line"
        case .command: return "terminal"
        case .thinking: return "sparkle"
        }
    }

    static let webTools: Set<String> = ["WebSearch", "WebFetch"]
    static let readingTools: Set<String> = ["Read", "Grep", "Glob", "LS", "NotebookRead", "ListMcpResourcesTool", "ReadMcpResourceTool"]
    static let writingTools: Set<String> = ["Write", "Edit", "MultiEdit", "NotebookEdit"]
    static let commandTools: Set<String> = ["Bash", "BashOutput", "KillShell", "KillBash"]
    static let thinkingTools: Set<String> = ["Task", "Agent", "TodoWrite", "TodoRead", "Skill", "ToolSearch", "ExitPlanMode", "EnterPlanMode", "SlashCommand", "AskUserQuestion"]

    /// Shell commands that go online: his browser and account CLIs (all through headless Comet) and the fetchers.
    static let webCommands: Set<String> = ["hb", "agent-browser", "rba", "cb", "cbg", "curl", "wget", "gmail", "outlook", "linkedin"]
    /// Computer-use servers, the same list the agent rules treat as driving an app.
    static let computerServers: Set<String> = ["cua-driver", "cua-computer-use", "computer-use", "cmux-cua"]
    /// Words in an MCP server's name that mean a browser or a web reader.
    static let webServerWords: Set<String> = ["browser", "playwright", "puppeteer", "chrome", "comet", "firecrawl", "exa", "tavily", "brave", "perplexity", "fetch", "web", "hb", "rba"]
    /// Words in an MCP tool's name that mean the web.
    static let webToolWords: Set<String> = ["web", "browse", "browser", "navigate", "url", "http", "https", "scrape", "crawl", "website", "webpage"]
    static let thinkingWords: Set<String> = ["think", "thinking", "sequentialthinking", "plan", "reason"]
    /// Verbs that make or change something (a draft, a note, an event, a send). Anything else reads.
    static let writingWords: Set<String> = [
        "create", "update", "write", "edit", "draft", "compose", "add", "set", "upsert", "move", "rename", "archive", "mark",
        "insert", "append", "copy", "upload", "share", "star", "snooze", "schedule", "label", "unlabel", "modify", "patch", "put",
        "save", "remember", "journal", "commit", "confirm", "send", "reply", "forward", "submit", "post", "publish", "delete",
        "trash", "remove", "cancel", "apply", "book", "pay", "purchase", "order", "transfer", "unsubscribe",
    ]
    /// Atlas tools that write but whose names carry no verb.
    static let atlasWrites: Set<String> = ["apple_note", "reminder"]

    /// The activity for one tool call. `command` is the Bash command, when there is one: a browser
    /// or account CLI, or anything with a URL in it, is the web. A tool this does not know is
    /// thinking, so the orb still shows that the agent works.
    public static func of(tool name: String, command: String? = nil) -> AgentActivity {
        if webTools.contains(name) { return .web }
        if readingTools.contains(name) { return .reading }
        if writingTools.contains(name) { return .writing }
        if thinkingTools.contains(name) { return .thinking }
        if commandTools.contains(name) {
            if let command, goesOnline(command) { return .web }
            return .command
        }
        guard name.hasPrefix("mcp__") else { return .thinking }
        let parts = name.components(separatedBy: "__")
        let server = parts.count > 1 ? parts[1].lowercased() : ""
        let tool = parts.count > 2 ? parts[2...].joined(separator: "_") : ""
        let serverWords = Set(words(server))
        let toolWords = Set(words(tool))
        if computerServers.contains(server) || server.contains("computer") || serverWords.contains("cua") { return .command }
        if !serverWords.isDisjoint(with: webServerWords) || !toolWords.isDisjoint(with: webToolWords) { return .web }
        if !serverWords.isDisjoint(with: thinkingWords) || !toolWords.isDisjoint(with: thinkingWords) { return .thinking }
        if !toolWords.isDisjoint(with: writingWords) { return .writing }
        if server == "atlas", atlasWrites.contains(tool.lowercased()) { return .writing }
        return .reading
    }

    /// Whether a shell command goes online: one of its pieces (split on `;`, `&&`, `|`) starts with a
    /// web command, or it names a URL.
    static func goesOnline(_ command: String) -> Bool {
        let lowered = command.lowercased()
        if lowered.contains("http://") || lowered.contains("https://") { return true }
        let pieces = lowered.split(whereSeparator: { ";|&\n(".contains($0) })
        for piece in pieces {
            // Skip `FOO=bar` assignments and sudo/env/exec in front of the real command.
            let tokens = piece.split(separator: " ").map(String.init).filter { !$0.contains("=") && !["sudo", "env", "exec", "command"].contains($0) }
            guard let first = tokens.first else { continue }
            let program = first.split(separator: "/").last.map(String.init) ?? first
            if webCommands.contains(program) { return true }
        }
        return false
    }

    /// A name in lowercase words: `get_window_state`, `brave-search` and `getWebPage` all split.
    static func words(_ name: String) -> [String] {
        var out: [String] = []
        var current = ""
        var previous: Character?
        for ch in name {
            if !(ch.isLetter || ch.isNumber) {
                if !current.isEmpty { out.append(current) }
                current = ""
            } else if ch.isUppercase, let p = previous, p.isLowercase || p.isNumber {
                if !current.isEmpty { out.append(current) }
                current = String(ch)
            } else {
                current.append(ch)
            }
            previous = ch
        }
        if !current.isEmpty { out.append(current) }
        return out.map { $0.lowercased() }
    }
}

// MARK: - The orb's notification

public extension Notification.Name {
    /// What the agents are doing, for the orb (VI-04). Posted on the main queue by whoever tracks
    /// the agents (AgentManager, from its tool-use events); OverlayManager observes it. Each post is
    /// the whole state across every agent, not a change: the orb shows exactly what the last one
    /// says. userInfo is `AgentActivityReport.userInfo`:
    /// - "activity": String, an `AgentActivity` raw value for the step an agent is on now; absent
    ///   when no agent works. A tool name ("Bash", "mcp__atlas__search") is read as one too.
    /// - "waiting": Int, how many agents wait on his yes (an open consent card); absent means 0.
    /// - "agent": String, optional, the slug whose step this was; for the log only.
    static let dotAgentActivity = Notification.Name("com.roshan.dot.agentActivity")
}

/// The `.dotAgentActivity` userInfo, both ways, so the poster and the orb read the same keys.
public struct AgentActivityReport: Equatable, Sendable {
    public static let activityKey = "activity"
    public static let waitingKey = "waiting"
    public static let agentKey = "agent"

    /// nil: no agent is working.
    public var activity: AgentActivity?
    /// Agents waiting on him; never below zero.
    public var waiting: Int
    public var agent: String?

    public init(activity: AgentActivity?, waiting: Int = 0, agent: String? = nil) {
        self.activity = activity
        self.waiting = max(0, waiting)
        self.agent = agent
    }

    /// Reads a posted userInfo. A missing or empty activity (or "idle", "none") is idle; an unknown
    /// string is read as a tool name, so a poster that sends "Bash" still draws the terminal.
    public init(userInfo: [AnyHashable: Any]?) {
        let raw = (userInfo?[Self.activityKey] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let idle = raw.isEmpty || ["idle", "none"].contains(raw.lowercased())
        let activity = idle ? nil : (AgentActivity(rawValue: raw.lowercased()) ?? AgentActivity.of(tool: raw))
        let waiting = (userInfo?[Self.waitingKey] as? Int) ?? (userInfo?[Self.waitingKey] as? NSNumber)?.intValue ?? 0
        self.init(activity: activity, waiting: waiting, agent: userInfo?[Self.agentKey] as? String)
    }

    public var userInfo: [String: Any] {
        var info: [String: Any] = [Self.waitingKey: waiting]
        if let activity { info[Self.activityKey] = activity.rawValue }
        if let agent { info[Self.agentKey] = agent }
        return info
    }
}

// MARK: - File kinds and their colors (VI-05)

/// The kind of a file Dot shows (a notch tile, a Home row, an agent's output), for its color.
public enum FileKind: String, CaseIterable, Sendable {
    case pdf, xlsx, pptx, docx, md, html, image, code, folder, other

    static let byExtension: [String: FileKind] = {
        var map: [String: FileKind] = [:]
        let groups: [(FileKind, [String])] = [
            (.pdf, ["pdf"]),
            (.xlsx, ["xlsx", "xls", "xlsm", "xlsb", "csv", "tsv", "numbers"]),
            (.pptx, ["pptx", "ppt", "pptm", "key"]),
            (.docx, ["docx", "doc", "rtf", "pages", "odt"]),
            (.md, ["md", "markdown", "txt"]),
            (.html, ["html", "htm", "xhtml", "mhtml", "webarchive"]),
            (.image, ["png", "jpg", "jpeg", "gif", "heic", "heif", "webp", "tif", "tiff", "bmp", "svg", "ico"]),
            (.code, ["swift", "py", "js", "mjs", "ts", "tsx", "jsx", "json", "yaml", "yml", "toml", "sh", "zsh", "bash", "rb", "go",
                     "rs", "c", "h", "cc", "cpp", "hpp", "m", "mm", "java", "kt", "css", "scss", "sql", "r", "ipynb", "xml", "plist",
                     "lua", "php", "cs", "pl", "tex", "vue", "svelte"]),
        ]
        for (kind, extensions) in groups { for ext in extensions { map[ext] = kind } }
        return map
    }()

    /// "PDF", ".pdf" and "pdf" are the same kind.
    public init(extension ext: String) {
        var text = ext.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        while text.hasPrefix(".") { text.removeFirst() }
        self = Self.byExtension[text] ?? .other
    }

    /// A path ending in "/" (or `isDirectory`) is a folder; otherwise its extension decides. Pure:
    /// nothing is read from disk, so pass `isDirectory` when the path may be a folder without a slash.
    public init(path: String, isDirectory: Bool? = nil) {
        let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
        if isDirectory == true || (isDirectory == nil && trimmed.hasSuffix("/")) {
            self = .folder
            return
        }
        self.init(extension: (trimmed as NSString).pathExtension)
    }

    /// A file URL; one made with `isDirectory: true` (or from a folder listing) is a folder.
    public init(url: URL) {
        self.init(path: url.path, isDirectory: url.hasDirectoryPath)
    }
}

/// One color per file kind, in each app's own family (Excel green, PowerPoint orange-red, Word
/// blue, the PDF red) and light enough to read on Dot's dark glass: each is at least 4.5:1 against
/// #1C1C1E. His token file's "fileColors" (keyed by kind name, "#RRGGBB") overrides any of them.
public enum FileKindColor {
    public static let defaults: [FileKind: String] = [
        .pdf: "#F04A4F",
        .xlsx: "#33C481",
        .pptx: "#F27A3E",
        .docx: "#4C9BF0",
        .md: "#A78BFA",
        .html: "#2EC4C9",
        .image: "#F472B6",
        .code: "#E5B93C",
        .folder: "#8DB3DD",
        .other: "#9A9AA3",
    ]

    /// The kind's color as "#RRGGBB": his override when it is a valid hex color, the default otherwise
    /// (a bad value such as "green" or "#12345" falls back per kind, never to another kind's).
    public static func color(for kind: FileKind, overrides: [String: String] = [:]) -> String {
        let override = overrides[kind.rawValue] ?? overrides.first(where: { $0.key.lowercased() == kind.rawValue })?.value
        if let override, let hex = normalizedHex(override) { return hex }
        return defaults[kind] ?? defaults[.other]!
    }

    public static func color(forPath path: String, isDirectory: Bool? = nil, overrides: [String: String] = [:]) -> String {
        color(for: FileKind(path: path, isDirectory: isDirectory), overrides: overrides)
    }

    /// "#rrggbb" or "rrggbb" as "#RRGGBB"; nil for anything else.
    public static func normalizedHex(_ text: String) -> String? {
        var hex = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") { hex.removeFirst() }
        guard hex.count == 6, hex.allSatisfy({ $0.isASCII && $0.isHexDigit }) else { return nil }
        return "#" + hex.uppercased()
    }
}
