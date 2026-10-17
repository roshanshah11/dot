import Foundation

/// One hook call from Claude Code, as it arrives on the hook's stdin (AG-07). Fields checked
/// against Claude Code 2.1.289 by a live probe on 2026-10-17: `session_id`, `transcript_path`,
/// `cwd`, `prompt_id`, `permission_mode`, `effort`, `hook_event_name`, `tool_name`, `tool_input`,
/// `tool_use_id`, and on PostToolUse `tool_response` and `duration_ms`. Inside a helper (subagent)
/// `agent_id` and `agent_type` come too, and the session id stays the parent's.
public struct HookInput: Equatable {
    public let event: String
    public let sessionId: String
    public let toolName: String
    public let toolInput: [String: AnyCodableValue]
    public let toolUseId: String?
    /// PostToolUse only: what the tool returned.
    public let toolResponse: AnyCodableValue?
    public let cwd: String?
    public let permissionMode: String?
    public let agentId: String?

    public init(event: String, sessionId: String, toolName: String, toolInput: [String: AnyCodableValue],
                toolUseId: String? = nil, toolResponse: AnyCodableValue? = nil, cwd: String? = nil,
                permissionMode: String? = nil, agentId: String? = nil) {
        self.event = event
        self.sessionId = sessionId
        self.toolName = toolName
        self.toolInput = toolInput
        self.toolUseId = toolUseId
        self.toolResponse = toolResponse
        self.cwd = cwd
        self.permissionMode = permissionMode
        self.agentId = agentId
    }

    /// nil unless it is a JSON object naming an event and a tool.
    public init?(object: [String: Any]) {
        guard let event = object["hook_event_name"] as? String, let tool = object["tool_name"] as? String else { return nil }
        self.init(event: event, sessionId: object["session_id"] as? String ?? "", toolName: tool,
                  toolInput: AnyCodableValue.object(from: object["tool_input"] as? [String: Any] ?? [:]),
                  toolUseId: object["tool_use_id"] as? String,
                  toolResponse: object["tool_response"].map { AnyCodableValue(json: $0) },
                  cwd: object["cwd"] as? String, permissionMode: object["permission_mode"] as? String,
                  agentId: object["agent_id"] as? String)
    }

    public init?(json data: Data) {
        guard let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return nil }
        self.init(object: object)
    }

    /// The same shape the stdio permission prompt brings, so the gate reuses `AgentManager.permission`.
    public var permissionRequest: PermissionRequest {
        var description: String?
        if case .string(let text)? = toolInput["description"] { description = text }
        return PermissionRequest(requestId: toolUseId ?? UUID().uuidString, toolName: toolName, input: toolInput,
                                 description: description, toolUseId: toolUseId)
    }

    /// The tool's output as plain text for a PostToolUse check: Bash's stdout and stderr, an MCP
    /// tool's text blocks, any other strings in it. At most `limit` characters.
    public func responseText(limit: Int = 20000) -> String {
        guard let response = toolResponse else { return "" }
        var parts: [String] = []
        func walk(_ value: AnyCodableValue) {
            switch value {
            case .string(let text): if !text.isEmpty { parts.append(text) }
            case .array(let items): items.forEach(walk)
            case .object(let fields):
                for key in fields.keys.sorted() where !["type", "filePath", "isImage", "interrupted", "noOutputExpected"].contains(key) {
                    walk(fields[key]!)
                }
            default: break
            }
        }
        walk(response)
        return String(parts.joined(separator: "\n").prefix(limit))
    }
}

/// What Dot answers a hook call with, and the JSON Claude Code reads back (AG-07).
///
/// The output shapes are the hooks reference's (code.claude.com/docs/en/hooks, read 2026-10-17)
/// and the schema in the 2.1.289 binary: PreToolUse prints
/// `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow|deny|ask","permissionDecisionReason":...}}`;
/// PostToolUse prints `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":...}}`.
/// Probed live: an allow ran a command that default mode would have prompted for with no
/// `can_use_tool` on stdio; a deny reached the model as "PreToolUse:Read hook error: <reason>";
/// an ask arrived on stdio as `can_use_tool` with the reason as `decision_reason`; additional
/// context reached the model next to the tool result.
public enum HookDecision: Equatable {
    case allow(String?)
    case deny(String)
    /// Claude Code's own prompt: for Dot's agents that is the stdio permission request, so Dot
    /// itself never answers ask (the gate shows the card and waits); kept for completeness.
    case ask(String)
    /// PostToolUse: a line the model reads next to the tool result.
    case context(String)
    /// No opinion: nothing printed, exit 0, Claude Code's normal flow applies.
    case pass

    /// The line printed on the hook's stdout, or "" for `.pass`.
    public func output(for event: String) -> String {
        var specific: [String: Any] = ["hookEventName": event]
        switch self {
        case .pass:
            return ""
        case .context(let line):
            guard !line.isEmpty else { return "" }
            specific["additionalContext"] = String(line.prefix(9000))   // Claude Code caps it at 10,000
        case .allow(let reason):
            specific["permissionDecision"] = "allow"
            if let reason { specific["permissionDecisionReason"] = reason }
        case .deny(let reason):
            specific["permissionDecision"] = "deny"
            specific["permissionDecisionReason"] = reason
        case .ask(let reason):
            specific["permissionDecision"] = "ask"
            specific["permissionDecisionReason"] = reason
        }
        guard let data = try? JSONSerialization.data(withJSONObject: ["hookSpecificOutput": specific], options: [.sortedKeys]),
              let text = String(data: data, encoding: .utf8) else { return "" }
        return text
    }

    /// On the control socket: `{"decision": "allow|deny|ask|context|pass", "reason": ...}`.
    public var wire: [String: Any] {
        switch self {
        case .allow(let reason): return reason.map { ["decision": "allow", "reason": $0] } ?? ["decision": "allow"]
        case .deny(let reason): return ["decision": "deny", "reason": reason]
        case .ask(let reason): return ["decision": "ask", "reason": reason]
        case .context(let line): return ["decision": "context", "reason": line]
        case .pass: return ["decision": "pass"]
        }
    }

    public init?(wire: [String: Any]) {
        let reason = wire["reason"] as? String
        switch wire["decision"] as? String {
        case "allow": self = .allow(reason)
        case "deny": self = .deny(reason ?? "Dot said no.")
        case "ask": self = .ask(reason ?? "Dot wants him to look first.")
        case "context": self = reason.map { .context($0) } ?? .pass
        case "pass": self = .pass
        default: return nil
        }
    }

    // MARK: When Dot is unreachable

    /// What the reason names, so the agent tells him why it stopped.
    public static let offlineReason = "Dot is not running, so only plain reads can run now. Do not retry this step; finish what reads allow and say what is left for when Dot is back."

    /// The gate's rule when no Dot answers (no socket, a refusal, a hang-up mid-wait): plain reads
    /// run; anything else is denied. A PostToolUse call passes (the tool already ran).
    public static func offline(_ input: HookInput) -> HookDecision {
        guard input.event == "PreToolUse" else { return .pass }
        return isPlainRead(toolName: input.toolName, input: input.toolInput) ? .allow("Dot is not running; a plain read") : .deny(offlineReason)
    }

    /// Reads by round seven's classes (`AgentRules.classify` says read), narrowed for a time with
    /// nobody to ask: a shell command passes only when every part of it is a looking command with
    /// no redirect or substitution (the class counts any known command word as read and leaves the
    /// rest to the policy, which is not there), and an MCP tool only when its name is a lookup
    /// (get, list, search...) on a server that is not a computer-use driver.
    public static func isPlainRead(toolName: String, input: [String: AnyCodableValue]) -> Bool {
        var command: String?
        if case .string(let text)? = input["command"] { command = text }
        let cls = AgentRules.classify(toolName: toolName, command: command, flattened: ConsentPolicy.flatten(input), input: input)
        guard cls == .read else { return false }
        if toolName == "Bash" { return isPlainReadCommand(command ?? "") }
        if toolName.hasPrefix("mcp__") {
            let parts = toolName.split(separator: "__").map(String.init)
            let server = parts.count > 1 ? parts[1] : ""
            let tool = parts.count > 2 ? parts[2...].joined(separator: "_") : ""
            if AgentRules.computerServers.contains(server) || ConsentPolicy.isOutwardMCP(tool: tool, input: input) { return false }
            return AgentRules.matches(lookupToolWords, tool)
        }
        return true
    }

    static let lookupToolWords = try! NSRegularExpression(pattern: #"(^|_)(get|list|search|read|find|fetch|query|view|show|lookup|describe|status|info)(_|$)"#, options: [.caseInsensitive])

    /// Commands that only look. No `sed` (`-i`), `awk` (`system`), `xargs`, `tee`, `env`, interpreters.
    static let lookingCommands: Set<String> = [
        "ls", "cat", "head", "tail", "wc", "grep", "egrep", "fgrep", "rg", "pwd", "echo", "printf", "which", "whoami",
        "date", "uname", "stat", "file", "du", "df", "sort", "uniq", "cut", "tr", "jq", "diff", "cmp", "basename",
        "dirname", "realpath", "readlink", "column", "mdfind", "mdls", "md5", "shasum", "true", "test", "id", "hostname",
        "sw_vers", "tree", "fd", "find", "git", "cd",
    ]
    static let lookingGitSubcommands: Set<String> = ["status", "log", "diff", "show", "rev-parse", "ls-files", "blame", "describe", "grep", "shortlog"]

    static func isPlainReadCommand(_ command: String) -> Bool {
        let quiet = command.replacingOccurrences(of: #"[0-9]*>&[0-9-]+|\s*[0-9]?>{1,2}\s*/dev/null"#, with: "", options: .regularExpression)
        if quiet.contains(">") || quiet.contains("`") || quiet.contains("$(") || quiet.contains("<(") { return false }
        let segments = ConsentPolicy.segments(of: quiet)
        guard !segments.isEmpty else { return false }
        return segments.allSatisfy { segment in
            let words = ConsentPolicy.unwrapped(segment).split(separator: " ").map(String.init)
            // `./ls` is a script of its own; only the bare word or the system's copy counts.
            guard let word = words.first, !word.contains("/") || word.hasPrefix("/bin/") || word.hasPrefix("/usr/bin/") else { return false }
            let first = (word as NSString).lastPathComponent
            guard lookingCommands.contains(first) else { return false }
            switch first {
            case "find": return !words.contains { ["-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprint0", "-fprintf", "-fls"].contains($0) }
            case "sort": return !words.contains { $0 == "-o" || $0.hasPrefix("--output") }
            case "git":
                let sub = words.dropFirst().first { !$0.hasPrefix("-") } ?? ""
                return lookingGitSubcommands.contains(sub) && !words.contains("--output")
            default: return true
            }
        }
    }

    // MARK: Installing the hook

    /// Seconds Claude Code waits on the gate before giving up on it. A card can wait on him a long
    /// time, and a hook that times out lets the call go on to the stdio prompt (a second card, which
    /// AgentManager folds into the first by tool_use_id), so the hook waits a day. The docs give
    /// 600 as the command default and no upper limit.
    public static let gateTimeout = 86400
    /// The gate answers itself this much before Claude Code's limit, so a decision is always printed.
    public static let gateMargin = 60
    /// PostToolUse runs only where the injection check can apply (Sentinel.checksOutput): web, shell
    /// (hb, rba, the mail CLIs) and MCP tools.
    public static let postMatcher = "^(WebFetch|WebSearch|Bash|mcp__.*)$"
    public static let postTimeout = 30

    /// The `--settings` JSON that sends every tool call through `<executable> --gate` (AG-07) and
    /// web, shell and MCP results through it again after they run. Shell form, the form the probe
    /// ran: the executable and every argument single-quoted.
    public static func settingsJSON(executable: String, arguments: [String] = ["--gate"],
                                    timeout: Int = gateTimeout, postMatcher: String? = HookDecision.postMatcher) -> String {
        let command = ([executable] + arguments).map(shellQuoted).joined(separator: " ")
        var hooks: [String: Any] = [
            "PreToolUse": [["matcher": "*", "hooks": [["type": "command", "command": command, "timeout": timeout]]]],
        ]
        if let postMatcher {
            hooks["PostToolUse"] = [["matcher": postMatcher, "hooks": [["type": "command", "command": command, "timeout": postTimeout]]]]
        }
        guard let data = try? JSONSerialization.data(withJSONObject: ["hooks": hooks], options: [.sortedKeys, .withoutEscapingSlashes]),
              let text = String(data: data, encoding: .utf8) else { return "{}" }
        return text
    }

    static func shellQuoted(_ word: String) -> String {
        "'" + word.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }
}
