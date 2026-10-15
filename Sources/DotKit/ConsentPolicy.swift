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

/// Decides which agent tool calls pass silently and which need his tap.
/// Mirrors HeyClicky's rule that observation is free and input needs consent,
/// and his standing rule that nothing is sent on its own.
public struct ConsentPolicy: Equatable {
    public var allowTools: Set<String>
    public var allowToolPrefixes: [String]
    public var denyTools: Set<String>
    /// Absolute paths (expanded) that agents may write under without asking.
    public var writableRoots: [String]
    public var safeCommands: Set<String>
    public var safeGitSubcommands: Set<String>

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
        "git", "python3", "swift", "node", "npx", "uv", "pip", "pip3", "brew", "mkdir", "touch", "cp", "mv",
        "open", "say", "osascript", "cd", "export", "source", "sleep", "time", "curl", "wget",
    ]

    /// Commands that are safe only as reads; writes with them still ask.
    static let readOnlyIfNoWriteFlags: Set<String> = ["git", "brew", "python3", "swift", "node", "npx", "uv", "pip", "pip3", "curl", "wget"]

    public static let defaultSafeGitSubcommands: Set<String> = [
        "status", "log", "diff", "show", "branch", "remote", "rev-parse", "ls-files", "blame", "describe", "tag", "stash",
    ]

    /// Anything matching these always asks, even if the command word is safe.
    static let alwaysAskPatterns: [String] = [
        #"\bsudo\b"#, #"\brm\s+-[a-zA-Z]*r"#, #"\brm\s+-[a-zA-Z]*f"#, #"\bgit\s+push\b"#, #"\bgit\s+reset\s+--hard"#,
        #"\bgit\s+commit\b"#, #"\bosascript\b"#, #"\bopen\b"#, #"\bsay\b"#, #"\bkill(all)?\b"#, #"\blaunchctl\b"#,
        #"\bdefaults\s+write\b"#, #"\bcurl\b.*\s-(X|d|F|T)\b"#, #"\bcurl\b.*--(data|upload-file|form)\b"#,
        #"\bnpm\s+publish\b"#, #"\bpip3?\s+install\b"#, #"\buv\s+pip\s+install\b"#, #"\bbrew\s+(install|uninstall|upgrade)\b"#,
        #">\s*\S"#, #"\bmv\b"#, #"\bcp\b"#, #"\bmkdir\b"#, #"\btouch\b"#, #"\bchmod\b"#, #"\bchown\b"#, #"\bssh\b"#, #"\bscp\b"#,
        #"\bimsg\s+send\b"#, #"\bgmail\s+send\b"#, #"\boutlook\s+send\b"#, #"\bhb\b"#, #"\brba\b"#, #"\bcbg?\b"#,
    ]

    public init(
        allowTools: Set<String> = [],
        allowToolPrefixes: [String] = [],
        denyTools: Set<String> = [],
        writableRoots: [String] = [],
        safeCommands: Set<String> = ConsentPolicy.defaultSafeCommands,
        safeGitSubcommands: Set<String> = ConsentPolicy.defaultSafeGitSubcommands
    ) {
        self.allowTools = allowTools
        self.allowToolPrefixes = allowToolPrefixes
        self.denyTools = denyTools
        self.writableRoots = writableRoots
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
            return .ask(reason: Self.describeMCP(name, request: request))
        }
        return .ask(reason: request.description ?? name)
    }

    func isWritable(_ path: String) -> Bool {
        guard !path.isEmpty else { return false }
        let standardized = (path as NSString).standardizingPath
        return writableRoots.contains { root in
            let r = (root as NSString).standardizingPath
            return standardized == r || standardized.hasPrefix(r.hasSuffix("/") ? r : r + "/")
        }
    }

    func decideShell(_ command: String, description: String?) -> ConsentDecision {
        let trimmed = command.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .ask(reason: "Run an empty command") }
        for pattern in Self.alwaysAskPatterns {
            if trimmed.range(of: pattern, options: .regularExpression) != nil {
                return .ask(reason: Self.shellReason(trimmed, description: description))
            }
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
            if Self.readOnlyIfNoWriteFlags.contains(word) && word != "git" {
                // Interpreters and package managers: only version/help style reads pass silently.
                let rest = words.dropFirst().joined(separator: " ")
                let readish = rest.isEmpty || rest.hasPrefix("--version") || rest.hasPrefix("-V") || rest.hasPrefix("--help")
                    || rest.hasPrefix("-c \"print") || rest.hasPrefix("-c 'print") || rest.hasPrefix("list") || rest.hasPrefix("show")
                    || rest.hasPrefix("-sS") || rest.hasPrefix("-s ") || rest.hasPrefix("-I ")
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
