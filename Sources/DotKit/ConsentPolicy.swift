import Foundation

/// One tool call an agent wants to make, as Claude Code reports it over the
/// stream-json permission channel (`can_use_tool`).
public struct ToolRequest: Equatable {
    public let toolName: String
    public let input: [String: AnyCodableValue]
    public let description: String?

    public init(toolName: String, input: [String: AnyCodableValue], description: String?) {
        self.toolName = toolName
        self.input = input
        self.description = description
    }

    public func string(_ key: String) -> String? {
        if case .string(let s)? = input[key] { return s }
        return nil
    }
}

public enum ConsentDecision: Equatable {
    /// Silent: reads, safe shell, writes inside the agent's own folder.
    case allow
    /// Show the Allow / Not now card with this one-line reason.
    case ask(reason: String)
    /// Refuse without asking (config deny list).
    case deny(reason: String)
}

/// Decides which agent tool calls pass silently and which need his tap. His rule
/// (2026-10-15, "it asks me for everything"): agents run on their own and the card appears
/// only for what goes outward or cannot be undone: a send, a submit, a post, a payment, a
/// delete outside their own folder, a push, a system-wide install, a click on a control
/// whose label reads like one of those. Reads, writes under his home, scripts, opening
/// apps and pages, and driving an app to look at it all pass silently.
public struct ConsentPolicy: Equatable {
    public var allowTools: Set<String>
    public var allowToolPrefixes: [String]
    public var denyTools: Set<String>
    /// Absolute paths (expanded) that agents may write under without asking.
    public var writableRoots: [String]
    /// Paths under a writable root that still ask (his vault's private store, keys, settings).
    public var protectedRoots: [String]
    public var safeCommands: Set<String>
    public var safeGitSubcommands: Set<String>

    /// Words in a control's label, a script or a tool's input that mean "this commits something".
    public static let commitWords = try! NSRegularExpression(
        pattern: #"\b(send|submit|pay|buy|purchase|checkout|place order|publish|post it|tweet|transfer|sign and|apply now|unsubscribe|delete|erase|empty trash|shut ?down|log ?out|sign ?out)\b"#,
        options: .caseInsensitive)

    public static func mentionsCommit(_ text: String) -> Bool {
        commitWords.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) != nil
    }

    /// Tool names (any server) that commit something outward and always ask.
    static let outwardToolWords = try! NSRegularExpression(pattern: #"(^|_)(send|reply|forward|submit|apply|post|publish|pay|purchase|delete|trash|remove|revoke|grant|rewrite|rollback|forget)(_|$)"#, options: .caseInsensitive)

    public static let readOnlyTools: Set<String> = [
        "Read", "Glob", "Grep", "LS", "WebSearch", "WebFetch", "TodoWrite", "Task", "Agent",
        "NotebookRead", "ToolSearch", "Skill", "ListMcpResourcesTool", "ReadMcpResourceTool",
        "BashOutput", "TaskOutput", "AskUserQuestion", "EnterPlanMode", "ExitPlanMode",
    ]

    public static let defaultSafeCommands: Set<String> = [
        "ls", "cat", "head", "tail", "wc", "grep", "rg", "ugrep", "find", "fd", "pwd", "echo", "printf",
        "which", "whoami", "date", "uname", "stat", "file", "du", "df", "env", "printenv", "true",
        "sort", "uniq", "cut", "tr", "awk", "sed", "jq", "yq", "diff", "cmp", "md5", "shasum", "sha256sum",
        "basename", "dirname", "realpath", "readlink", "test", "[", "xargs", "tee", "column", "less", "more",
        "git", "python3", "python", "swift", "node", "npx", "npm", "uv", "pip", "pip3", "brew", "mkdir", "touch", "cp", "mv", "rm", "ln",
        "open", "say", "osascript", "cd", "export", "source", "sleep", "time", "curl", "wget", "zip", "unzip", "tar", "gzip",
        "hb", "rba", "cb", "cbg", "gmail", "outlook", "imsg", "linkedin", "cliclick", "cua-driver", "screencapture", "pbcopy", "pbpaste",
        "ffmpeg", "ffprobe", "pdftotext", "qlmanage", "sips", "textutil", "mdfind", "mdls", "defaults", "plutil", "sqlite3", "make",
        "cargo", "go", "ruby", "perl", "bash", "zsh", "sh", "env", "nohup", "caffeinate", "chmod", "atlasctl", "./atlasctl", "claude",
    ]

    /// Package managers and the system: only these still ask.
    static let readOnlyIfNoWriteFlags: Set<String> = ["brew"]

    public static let defaultSafeGitSubcommands: Set<String> = [
        "status", "log", "diff", "show", "branch", "remote", "rev-parse", "ls-files", "blame", "describe", "tag", "stash",
        "add", "commit", "checkout", "switch", "restore", "fetch", "pull", "merge", "rebase", "init", "clone", "mv", "rm",
    ]

    /// Anything matching these always asks, even if the command word is safe: it goes outward,
    /// touches the system, or cannot be undone.
    static let alwaysAskPatterns: [String] = [
        #"\bsudo\b"#, #"\brm\s+-[a-zA-Z]*r"#, #"\brm\s+-[a-zA-Z]*f"#, #"\bgit\s+push\b"#, #"\bgit\s+reset\s+--hard"#,
        #"\bkill(all)?\b"#, #"\blaunchctl\b"#, #"\bdefaults\s+write\b"#, #"\bchown\b"#, #"\bdiskutil\b"#, #"\bmkfs\b"#,
        #"\bnpm\s+publish\b"#, #"\bbrew\s+(install|uninstall|upgrade|remove)\b"#, #"\bssh\b"#, #"\bscp\b"#,
        #"\bimsg\s+send\b"#, #"\bgmail\s+(send|reply|forward)\b"#, #"\boutlook\s+(send|reply|forward)\b"#,
        #"\brba\b.*--authorize\b"#, #"\bhandshake_submit\b"#, #"\bshutdown\b"#, #"\breboot\b"#,
    ]

    /// Commands that drive his apps or browser: fine on their own, but a send, submit, post,
    /// payment or delete inside them asks.
    static let driverWords: Set<String> = ["osascript", "hb", "rba", "cb", "cbg", "cliclick", "cua-driver", "gmail", "outlook", "imsg", "linkedin"]

    public init(
        allowTools: Set<String> = [],
        allowToolPrefixes: [String] = [],
        denyTools: Set<String> = [],
        writableRoots: [String] = [],
        protectedRoots: [String] = [],
        safeCommands: Set<String> = ConsentPolicy.defaultSafeCommands,
        safeGitSubcommands: Set<String> = ConsentPolicy.defaultSafeGitSubcommands
    ) {
        self.allowTools = allowTools
        self.allowToolPrefixes = allowToolPrefixes
        self.denyTools = denyTools
        self.writableRoots = writableRoots
        self.protectedRoots = protectedRoots
        self.safeCommands = safeCommands
        self.safeGitSubcommands = safeGitSubcommands
    }

    public func decide(_ request: ToolRequest) -> ConsentDecision {
        let name = request.toolName
        if denyTools.contains(name) { return .deny(reason: "\(name) is on the deny list") }
        if allowTools.contains(name) { return .allow }
        if allowToolPrefixes.contains(where: { name.hasPrefix($0) }) { return .allow }
        if Self.readOnlyTools.contains(name) { return .allow }

        switch name {
        case "Write", "Edit", "MultiEdit", "NotebookEdit":
            let path = request.string("file_path") ?? request.string("notebook_path") ?? ""
            if isWritable(path) { return .allow }
            return .ask(reason: "Write \(Self.shortPath(path))")
        case "Bash":
            let command = request.string("command") ?? ""
            return decideShell(command, description: request.description)
        default:
            break
        }

        if name.hasPrefix("mcp__") {
            let parts = name.split(separator: "__").map(String.init)
            let tool = parts.count > 2 ? parts[2...].joined(separator: "_") : name
            if Self.outwardToolWords.firstMatch(in: tool, range: NSRange(location: 0, length: (tool as NSString).length)) != nil {
                return .ask(reason: Self.describeMCP(name, request: request))
            }
            // A click, a keystroke or a value that names a send, a purchase or a delete asks; the rest runs.
            if Self.mentionsCommit(Self.flatten(request.input)) {
                return .ask(reason: Self.describeMCP(name, request: request))
            }
            return .allow
        }
        return .ask(reason: request.description ?? name)
    }

    static func flatten(_ input: [String: AnyCodableValue]) -> String {
        input.values.map { value -> String in
            switch value {
            case .string(let s): return s
            case .array(let a): return a.map { "\($0.json)" }.joined(separator: " ")
            case .object(let o): return flatten(o)
            default: return ""
            }
        }.joined(separator: " ")
    }

    func isWritable(_ path: String) -> Bool {
        guard !path.isEmpty else { return false }
        let standardized = (path as NSString).standardizingPath
        func under(_ root: String) -> Bool {
            let r = (root as NSString).standardizingPath
            return standardized == r || standardized.hasPrefix(r.hasSuffix("/") ? r : r + "/")
        }
        if protectedRoots.contains(where: under) { return false }
        return writableRoots.contains(where: under)
    }

    /// True when the command matches a pattern that always asks (sudo, rm -rf, sends, pushes...).
    /// A command that asks without matching is merely unrecognised, and a cheap judge may clear it.
    public static func isAlwaysAsk(_ command: String) -> Bool {
        let trimmed = command.trimmingCharacters(in: .whitespacesAndNewlines)
        return alwaysAskPatterns.contains { trimmed.range(of: $0, options: .regularExpression) != nil }
    }

    func decideShell(_ command: String, description: String?) -> ConsentDecision {
        let trimmed = command.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .ask(reason: "Run an empty command") }
        for pattern in Self.alwaysAskPatterns {
            if trimmed.range(of: pattern, options: .regularExpression) != nil {
                return .ask(reason: Self.shellReason(trimmed, description: description))
            }
        }
        // Driving an app or his browser is fine; a send, submit, post, payment or delete inside it asks.
        let lower = trimmed.lowercased()
        if Self.driverWords.contains(where: { lower.range(of: "\\b\($0)\\b", options: .regularExpression) != nil }), Self.mentionsCommit(trimmed) {
            return .ask(reason: Self.shellReason(trimmed, description: description))
        }
        // Writes under a protected root ask however they are spelled.
        for root in protectedRoots where trimmed.contains((root as NSString).standardizingPath) || trimmed.contains(Self.shortPath(root)) {
            return .ask(reason: Self.shellReason(trimmed, description: description))
        }
        // Every pipeline segment must start with a safe command.
        let segments = trimmed.components(separatedBy: CharacterSet(charactersIn: "|;&\n"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        for segment in segments {
            let words = segment.split(separator: " ", omittingEmptySubsequences: true).map(String.init)
            guard let first = words.first else { continue }
            let word = (first as NSString).lastPathComponent
            guard safeCommands.contains(word) else {
                return .ask(reason: Self.shellReason(trimmed, description: description))
            }
            if word == "git" {
                let sub = words.dropFirst().first(where: { !$0.hasPrefix("-") }) ?? ""
                if !safeGitSubcommands.contains(sub) {
                    return .ask(reason: Self.shellReason(trimmed, description: description))
                }
            }
            if Self.readOnlyIfNoWriteFlags.contains(word) {
                // brew: only reads pass silently; installs are on the always-ask list.
                let rest = words.dropFirst().joined(separator: " ")
                let readish = rest.isEmpty || rest.hasPrefix("--version") || rest.hasPrefix("--help") || rest.hasPrefix("list")
                    || rest.hasPrefix("info") || rest.hasPrefix("search") || rest.hasPrefix("--prefix") || rest.hasPrefix("outdated")
                if !readish {
                    return .ask(reason: Self.shellReason(trimmed, description: description))
                }
            }
        }
        return .allow
    }

    static func shellReason(_ command: String, description: String?) -> String {
        if let description, !description.isEmpty { return description }
        let oneLine = command.replacingOccurrences(of: "\n", with: " ")
        return oneLine.count > 90 ? String(oneLine.prefix(87)) + "..." : oneLine
    }

    public static func shortPath(_ path: String) -> String {
        let home = NSHomeDirectory()
        if path.hasPrefix(home) { return "~" + path.dropFirst(home.count) }
        return path
    }

    static func describeMCP(_ name: String, request: ToolRequest) -> String {
        // mcp__server__tool -> "server: tool"
        let parts = name.split(separator: "__").map(String.init)
        let server = parts.count > 1 ? parts[1] : "tool"
        let tool = parts.count > 2 ? parts[2...].joined(separator: "_") : name
        if let description = request.description, !description.isEmpty { return "\(server): \(description)" }
        return "\(server): \(tool)"
    }
}

/// A JSON value that can be compared and carried without Foundation's `Any`.
public enum AnyCodableValue: Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case null
    case array([AnyCodableValue])
    case object([String: AnyCodableValue])

    public init(json: Any) {
        switch json {
        case let s as String: self = .string(s)
        case let b as Bool: self = .bool(b)
        case let n as NSNumber:
            if CFGetTypeID(n) == CFBooleanGetTypeID() { self = .bool(n.boolValue) } else { self = .number(n.doubleValue) }
        case let a as [Any]: self = .array(a.map { AnyCodableValue(json: $0) })
        case let d as [String: Any]: self = .object(d.mapValues { AnyCodableValue(json: $0) })
        default: self = .null
        }
    }

    public var json: Any {
        switch self {
        case .string(let s): return s
        case .number(let n): return n == n.rounded() && abs(n) < 1e15 ? Int(n) : n
        case .bool(let b): return b
        case .null: return NSNull()
        case .array(let a): return a.map { $0.json }
        case .object(let o): return o.mapValues { $0.json }
        }
    }

    public static func object(from dictionary: [String: Any]) -> [String: AnyCodableValue] {
        dictionary.mapValues { AnyCodableValue(json: $0) }
    }
}
