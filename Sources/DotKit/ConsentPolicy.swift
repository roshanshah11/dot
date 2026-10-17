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
    /// The agent's folder: relative paths in a command resolve against it.
    public var workingDirectory: String?
    /// Where `rm -r` may run without asking (the agent's own folder, the temp folders). Round seven
    /// (F3): agents now start in Claude Code's default permission mode, so every delete reaches this
    /// policy, and an agent clearing its own tmp/ must not raise a card.
    public var deletableRoots: [String]
    /// Paths under a deletable root that still ask before a delete (the agent's identity file and
    /// Dot's records of it).
    public var undeletableRoots: [String]
    /// MCP servers Dot knows (its own config's, the computer-use servers); a tool from any other
    /// server asks (F4). nil skips the check. The claude.ai connectors are always known.
    public var knownServers: Set<String>?

    /// Words in a control's label, a script or a tool's input that mean "this commits something".
    public static let commitWords = try! NSRegularExpression(
        pattern: #"\b(send|submit|pay|buy|purchase|checkout|place order|publish|post it|tweet|transfer|sign and|apply now|unsubscribe|delete|erase|empty trash|shut ?down|log ?out|sign ?out)\b"#,
        options: .caseInsensitive)

    public static func mentionsCommit(_ text: String) -> Bool {
        commitWords.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) != nil
    }

    /// Tool names (any server) that commit something outward and always ask. Round seven (F4) adds
    /// replying to an invitation, sharing and inviting: each tells someone else something.
    static let outwardToolWords = try! NSRegularExpression(pattern: #"(^|_)(send|reply|forward|submit|apply|post|publish|pay|purchase|delete|trash|remove|revoke|grant|rewrite|rollback|forget|respond|share|invite)(_|$)"#, options: .caseInsensitive)

    /// Input fields that put other people on an event: a create or update that fills one sends invitations.
    static let guestKeys: Set<String> = ["attendees", "attendee", "guests", "invitees", "addguests", "add_guests", "participants", "emails", "attendee_emails"]
    static let eventChangeWords = try! NSRegularExpression(pattern: #"(^|_)(create|update|add|insert|patch|schedule|modify|edit|move|quick)(_|$)"#, options: .caseInsensitive)

    /// An MCP tool call that reaches other people: a send, a reply, a share, an invitation, an answer
    /// to an invitation, or an event made or changed with guests on it (F4: the calendar replies,
    /// invitations and Drive shares that ran without a card on 2026-10-16's replay).
    public static func isOutwardMCP(tool: String, input: [String: AnyCodableValue]) -> Bool {
        let range = NSRange(location: 0, length: (tool as NSString).length)
        if outwardToolWords.firstMatch(in: tool, range: range) != nil { return true }
        guard eventChangeWords.firstMatch(in: tool, range: range) != nil else { return false }
        return input.contains { key, value in
            guard guestKeys.contains(key.lowercased()) else { return false }
            switch value {
            case .array(let items): return !items.isEmpty
            case .string(let text): return !text.trimmingCharacters(in: .whitespaces).isEmpty
            case .object(let object): return !object.isEmpty
            default: return false
            }
        }
    }

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
        #"\bfind\b.*\s-delete\b"#, #"-exec\s+rm\b"#, #"\bgit\s+(?:-C\s+\S+\s+)?clean\b"#,
    ]

    /// The always-ask patterns that are about `rm` itself; a delete checked against the deletable roots skips them.
    static let removePatterns: Set<String> = [#"\brm\s+-[a-zA-Z]*r"#, #"\brm\s+-[a-zA-Z]*f"#]

    /// Commands that delete (round seven, F3): inside the agent's folder or a temp folder they pass,
    /// anywhere else they ask.
    static let deleteWords: Set<String> = ["rm", "unlink", "rmdir", "shred", "srm", "trash"]

    /// A delete command named anywhere in the line: inside quotes, a subshell, `xargs`, `bash -c`,
    /// where its targets cannot be read. `git rm` is not one (the file stays in the history).
    static let deleteAnywhere = #"(?:^|[\s;&|(`'"/])(?<!git\s)(?:rm|unlink|shred|srm)(?=\s|$)"#

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
        safeGitSubcommands: Set<String> = ConsentPolicy.defaultSafeGitSubcommands,
        workingDirectory: String? = nil,
        deletableRoots: [String] = [],
        undeletableRoots: [String] = [],
        knownServers: Set<String>? = nil
    ) {
        self.allowTools = allowTools
        self.allowToolPrefixes = allowToolPrefixes
        self.denyTools = denyTools
        self.writableRoots = writableRoots
        self.protectedRoots = protectedRoots
        self.safeCommands = safeCommands
        self.safeGitSubcommands = safeGitSubcommands
        self.workingDirectory = workingDirectory
        self.deletableRoots = deletableRoots
        self.undeletableRoots = undeletableRoots
        self.knownServers = knownServers
    }

    public func decide(_ request: ToolRequest) -> ConsentDecision {
        let name = request.toolName
        if denyTools.contains(name) { return .deny(reason: "\(name) is on the deny list") }
        if allowTools.contains(name) { return .allow }
        if name.hasPrefix("mcp__") {
            let parts = name.split(separator: "__").map(String.init)
            let server = parts.count > 1 ? parts[1] : ""
            let tool = parts.count > 2 ? parts[2...].joined(separator: "_") : name
            // A send, a share or an invitation asks even under an allowed prefix (the connectors' prefixes
            // used to let a send through before the outward check ran).
            if Self.isOutwardMCP(tool: tool, input: request.input) { return .ask(reason: Self.describeMCP(name, request: request)) }
            if let knownServers, !knownServers.contains(server), !server.hasPrefix("claude_ai_") {
                return .ask(reason: "\(Self.describeMCP(name, request: request)) (a tool Dot doesn't know)")
            }
        }
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
            // A click, a keystroke or a value that names a send, a purchase or a delete asks; the rest runs.
            if Self.mentionsCommit(Self.flatten(request.input)) {
                return .ask(reason: Self.describeMCP(name, request: request))
            }
            return .allow
        }
        return .ask(reason: request.description ?? name)
    }

    public static func flatten(_ input: [String: AnyCodableValue]) -> String {
        input.values.map { value -> String in
            switch value {
            case .string(let s): return s
            case .array(let a): return a.map { "\($0.json)" }.joined(separator: " ")
            case .object(let o): return flatten(o)
            default: return ""
            }
        }.joined(separator: " ")
    }

    /// A path in one spelling for comparing: `.` and `..` resolved, and /private/var, /private/tmp and
    /// /private/etc written without "/private" whether or not the file exists yet. (Foundation's
    /// standardizingPath strips "/private" only for a path that exists, so a new file under
    /// /private/tmp and its folder used to compare as different trees.)
    static func canonical(_ path: String) -> String {
        let standardized = (path as NSString).standardizingPath
        for prefix in ["/private/var", "/private/tmp", "/private/etc"] where standardized == prefix || standardized.hasPrefix(prefix + "/") {
            return String(standardized.dropFirst("/private".count))
        }
        return standardized
    }

    func isWritable(_ path: String) -> Bool {
        guard !path.isEmpty else { return false }
        let standardized = Self.canonical(path)
        func under(_ root: String) -> Bool {
            let r = Self.canonical(root)
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
        // Deletes: an agent clearing its own folder or a temp folder passes; any other delete asks,
        // with or without -r (round seven, F3: "a delete outside the agent's folder" is his line).
        if deletesOutsideScratch(trimmed) { return .ask(reason: Self.shellReason(trimmed, description: description)) }
        let deletesChecked = Self.segments(of: trimmed).contains(where: Self.isDelete)
        for pattern in Self.alwaysAskPatterns {
            // Every delete here was checked against the deletable roots above.
            if deletesChecked, Self.removePatterns.contains(pattern) { continue }
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
        for segment in Self.segments(of: trimmed) {
            if deletesChecked, Self.isDelete(segment) { continue }
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

    /// The command with its deletes inside the deletable roots taken out, for classing what is left:
    /// nil when it has no delete, or has one outside them (that delete decides).
    public func commandWithoutScratchDeletes(_ command: String) -> String? {
        let parts = Self.segments(of: command)
        guard parts.contains(where: Self.isDelete), !deletesOutsideScratch(command) else { return nil }
        return parts.filter { !Self.isDelete($0) }.joined(separator: " ; ")
    }

    /// True when the command deletes something not plainly inside the agent's folder or a temp
    /// folder: a delete outside them, after a change of folder, or one whose targets cannot be read
    /// (a variable, a subshell, `xargs rm`, `bash -c`, `find -delete`). The outward class names this
    /// ("a delete outside the agent's folder"), and it always comes to him as a card.
    public func deletesOutsideScratch(_ command: String) -> Bool {
        let trimmed = command.trimmingCharacters(in: .whitespacesAndNewlines)
        let removes = Self.segments(of: trimmed).map(Self.unwrapped).filter { Self.deleteWords.contains(Self.firstWord(of: $0)) }
        let mentions = Self.matchCount(Self.deleteAnywhere, in: trimmed)
        let findDeletes = trimmed.range(of: #"\bfind\b.*\s-delete\b|-exec(dir)?\s+rm\b"#, options: .regularExpression) != nil
        guard !removes.isEmpty || mentions > 0 || findDeletes else { return false }
        if findDeletes { return true }
        // A delete named somewhere a segment does not start with it: its targets cannot be read.
        let readable = removes.filter { ["rm", "unlink", "shred", "srm"].contains(Self.firstWord(of: $0)) }.count
        if mentions > readable { return true }
        // After a change of folder a relative target means somewhere else; an absolute one still reads.
        let folderChange = trimmed.range(of: #"(^|[\s;&|(])(cd|pushd)\s"#, options: .regularExpression)?.lowerBound
        var cursor = trimmed.startIndex
        for segment in Self.segments(of: trimmed) {
            let found = trimmed.range(of: segment, range: cursor..<trimmed.endIndex)
            if let found { cursor = found.upperBound }
            let plain = Self.unwrapped(segment)
            guard Self.deleteWords.contains(Self.firstWord(of: plain)) else { continue }
            var afterChange = false
            if let folderChange { afterChange = (found?.lowerBound ?? trimmed.endIndex) >= folderChange }
            if !deleteInsideScratch(Self.droppingNullRedirects(plain), relativeAllowed: !afterChange) { return true }
        }
        return false
    }

    /// True when a shell command must come to him as a card and no judge may clear it: it matches
    /// the always-ask list, or it deletes something outside the agent's folder and the temp folders.
    public func mustAsk(_ command: String) -> Bool {
        let trimmed = command.trimmingCharacters(in: .whitespacesAndNewlines)
        if deletesOutsideScratch(trimmed) { return true }
        let deletesChecked = Self.segments(of: trimmed).contains(where: Self.isDelete)
        return Self.alwaysAskPatterns.contains { pattern in
            if deletesChecked, Self.removePatterns.contains(pattern) { return false }
            return trimmed.range(of: pattern, options: .regularExpression) != nil
        }
    }

    /// The command word of a shell line's first segment, wrapper words aside ("git" for
    /// `cd x && git push`'s first segment is "cd"): what "Allow for this task" covers for a command.
    public static func commandWord(_ command: String) -> String {
        firstWord(of: unwrapped(segments(of: command).first ?? ""))
    }

    /// A segment that is a delete command, wrapper words aside.
    static func isDelete(_ segment: String) -> Bool { deleteWords.contains(firstWord(of: unwrapped(segment))) }

    /// A segment with the wrapper words in front taken off (`command rm x`, `nohup rm x`, `\rm x`,
    /// `env A=b rm x`), so the delete check reads the command itself.
    static func unwrapped(_ segment: String) -> String {
        var words = segment.split(separator: " ", omittingEmptySubsequences: true).map(String.init)
        while let first = words.first,
              ["command", "builtin", "exec", "nohup", "time", "env"].contains(first) || (first.contains("=") && !first.hasPrefix("-") && !first.hasPrefix("=")) {
            words.removeFirst()
        }
        if let first = words.first, first.hasPrefix("\\") { words[0] = String(first.dropFirst()) }
        return words.joined(separator: " ")
    }

    static func matchCount(_ pattern: String, in text: String) -> Int {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return 0 }
        return regex.numberOfMatches(in: text, range: NSRange(text.startIndex..., in: text))
    }

    /// A command's pipeline and list segments, trimmed. Descriptor redirects (`2>&1`, `>&2`,
    /// `&>/dev/null`) go first, so their `&` does not split a command in two.
    static func segments(of command: String) -> [String] {
        command.replacingOccurrences(of: #"[0-9]*>&[0-9-]+|&>>?\s*/dev/null"#, with: "", options: .regularExpression)
            .components(separatedBy: CharacterSet(charactersIn: "|;&\n"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    static func firstWord(of segment: String) -> String {
        let word = segment.split(separator: " ", omittingEmptySubsequences: true).first.map(String.init) ?? ""
        return (word as NSString).lastPathComponent
    }

    /// `rm -rf tmp/x 2>/dev/null` checks as `rm -rf tmp/x`.
    static func droppingNullRedirects(_ segment: String) -> String {
        segment.replacingOccurrences(of: #"\s*[0-9]?>{1,2}\s*/dev/null"#, with: "", options: .regularExpression)
    }

    /// True for one plain delete (`rm`, `unlink`, `rmdir`...) whose every target sits strictly inside a deletable root and outside
    /// the undeletable ones. Chaining, pipes, substitutions and variables never qualify; a glob counts
    /// by the folder it sits in, and never at a root itself (`rm -rf *` in the agent's folder asks).
    public func deleteInsideScratch(_ command: String) -> Bool { deleteInsideScratch(command, relativeAllowed: true) }

    /// `relativeAllowed` false: the command changed folder before this delete, so only absolute
    /// (or ~) targets can be placed.
    func deleteInsideScratch(_ command: String, relativeAllowed: Bool) -> Bool {
        guard !deletableRoots.isEmpty else { return false }
        let trimmed = command.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.range(of: #"[;&|`\n<>]|\$"#, options: .regularExpression) != nil { return false }
        var words = Self.shellWords(Self.unwrapped(trimmed))
        guard let first = words.first, Self.deleteWords.contains((first as NSString).lastPathComponent) else { return false }
        words.removeFirst()
        var targets: [String] = []
        var flagsDone = false
        for word in words {
            if !flagsDone, word == "--" { flagsDone = true; continue }
            if !flagsDone, word.hasPrefix("-") { continue }
            targets.append(word)
        }
        guard !targets.isEmpty else { return false }
        let roots = deletableRoots.map(Self.canonical)
        let keep = undeletableRoots.map(Self.canonical)
        func strictlyInside(_ path: String, _ root: String) -> Bool { path.hasPrefix(root.hasSuffix("/") ? root : root + "/") }
        for target in targets {
            // The shell expands braces and ~user; this check cannot place what they expand to.
            if target.contains("{") || target.contains("}") { return false }
            if target.hasPrefix("~"), target != "~", !target.hasPrefix("~/") { return false }
            if !relativeAllowed, !(target.hasPrefix("/") || target == "~" || target.hasPrefix("~/")) { return false }
            var raw = target
            let glob = raw.contains("*") || raw.contains("?") || raw.contains("[")
            if glob {
                // The folder the glob sits in: "tmp/*.png" -> "tmp", "*" -> the working folder.
                if let firstGlob = raw.firstIndex(where: { "*?[".contains($0) }) {
                    let head = raw[..<firstGlob]
                    raw = head.contains("/") ? String(head[..<head.lastIndex(of: "/")!]) : "."
                }
            }
            guard let path = resolve(raw) else { return false }
            if glob {
                // Contents of a folder: the folder itself must be inside a root, or be a root's own subfolder.
                guard roots.contains(where: { strictlyInside(path, $0) }) else { return false }
            } else {
                guard roots.contains(where: { strictlyInside(path, $0) }) else { return false }
            }
            if keep.contains(where: { path == $0 || strictlyInside(path, $0) || strictlyInside($0, path) }) { return false }
        }
        return true
    }

    /// A target as an absolute, standardized path: `~` is his home, a relative path is under the
    /// working directory.
    func resolve(_ target: String) -> String? {
        let home = NSHomeDirectory()
        var path = target
        if path == "~" { path = home } else if path.hasPrefix("~/") { path = home + String(path.dropFirst(1)) }
        if !path.hasPrefix("/") {
            guard let cwd = workingDirectory else { return nil }
            path = (cwd as NSString).appendingPathComponent(path)
        }
        return Self.canonical(path)
    }

    /// Splits a command into words the way the shell would for plain words: quotes group, a
    /// backslash escapes the next character.
    static func shellWords(_ command: String) -> [String] {
        var words: [String] = []
        var current = ""
        var quote: Character?
        var escaped = false
        var inWord = false
        for ch in command {
            if escaped { current.append(ch); escaped = false; inWord = true; continue }
            if ch == "\\", quote != "'" { escaped = true; inWord = true; continue }
            if let q = quote {
                if ch == q { quote = nil } else { current.append(ch) }
                continue
            }
            if ch == "'" || ch == "\"" { quote = ch; inWord = true; continue }
            if ch == " " || ch == "\t" {
                if inWord { words.append(current); current = ""; inWord = false }
                continue
            }
            current.append(ch)
            inWord = true
        }
        if inWord { words.append(current) }
        return words
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
