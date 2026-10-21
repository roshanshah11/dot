import Foundation

/// Which permissions Dot's agents and jobs run with (config `permissions`). `atlas`, the default (his call 2026-10-21,
/// "fully Atlas, no Dot guards"): what an Atlas ask runs with, bypassPermissions and Atlas's deny list, and nothing of
/// Dot's on top (no card, no Jev consent call, no sentinel card on a call's input, no allowances). `guarded`: the gate as
/// it was (his rules, ConsentPolicy, Jev, cards; for jobs the sandboxed Bash and the Python forms), kept for rollback.
public enum PermissionsMode: String, Sendable {
    case atlas, guarded

    /// Anything but "guarded" is Atlas's way.
    public init(setting: String) {
        self = setting.trimmingCharacters(in: .whitespaces).lowercased() == "guarded" ? .guarded : .atlas
    }
}

/// Atlas's deny list, rule for rule: ASK_DENY in Atlas/harness/atlas/mcp.py (an ask, Atlas's run with nobody watching).
/// His private Atlas folder and the browser's cookies are closed to reads and edits; a send from the shell and a git
/// commit or push are refused, so sends go through Atlas's own gated tools. Claude Code enforces it from `--settings`;
/// the job gate and any stdio prompt an agent still sends check the same list.
public enum AtlasDeny {
    /// As Atlas writes it. Atlas runs in the vault, so `./` there is the vault.
    public static let askDeny = [
        "Read(./Atlas/private/**)", "Edit(./Atlas/private/**)", "Read(~/.atlas-browser/**)", "Edit(~/.atlas-browser/**)",
        "Bash(gmail send:*)", "Bash(gmail reply:*)", "Bash(outlook send:*)", "Bash(outlook reply:*)", "Bash(imsg send:*)",
        "Bash(osascript:*)", "Bash(linkedin message:*)", "Bash(git push:*)", "Bash(git commit:*)",
    ]

    /// The list for a session that runs anywhere (an agent's folder, a job's): `./` is the vault and `~/` his home,
    /// each path in Claude Code's absolute `//` form.
    public static func rules(home: String, vault: String) -> [String] {
        askDeny.map { rule in
            guard let (tool, pattern) = parts(rule), tool != "Bash" else { return rule }
            return "\(tool)(/\(resolve(pattern, home: home, vault: vault)))"
        }
    }

    /// The folders the Read and Edit rules close, absolute.
    public static func folders(home: String, vault: String) -> [String] {
        var out: [String] = []
        for rule in askDeny {
            guard let (tool, pattern) = parts(rule), tool != "Bash" else { continue }
            var folder = resolve(pattern, home: home, vault: vault)
            if folder.hasSuffix("/**") { folder.removeLast(3) }
            if !out.contains(folder) { out.append(folder) }
        }
        return out
    }

    /// The commands the Bash rules close, as words ("gmail send" is ["gmail", "send"]).
    public static let commands: [[String]] = askDeny.compactMap { rule in
        guard let (tool, pattern) = parts(rule), tool == "Bash" else { return nil }
        let prefix = pattern.hasSuffix(":*") ? String(pattern.dropLast(2)) : pattern
        return prefix.split(separator: " ").map(String.init)
    }

    static let readTools: Set<String> = ["Read", "Grep", "Glob", "LS", "NotebookRead"]
    static let editTools: Set<String> = ["Edit", "MultiEdit", "Write", "NotebookEdit"]

    /// Why the list refuses this call, or nil: a file tool on a path inside a closed folder (Claude Code's Read rules
    /// cover the tools that read files, its Edit rules the ones that write them), or a command any part of which starts
    /// with a closed command. `cwd` resolves a relative path.
    public static func refusal(tool: String, input: [String: AnyCodableValue], home: String, vault: String, cwd: String) -> String? {
        if tool == "Bash" {
            guard case .string(let command)? = input["command"] else { return nil }
            return closedCommand(in: command).map { "atlas's deny list closes `\($0)` from the shell; a send goes through atlas's send tools" }
        }
        guard readTools.contains(tool) || editTools.contains(tool) else { return nil }
        var paths: [String] = []
        for key in ["file_path", "path", "notebook_path"] { if case .string(let s)? = input[key], !s.isEmpty { paths.append(s) } }
        if tool == "Glob", case .string(let pattern)? = input["pattern"], pattern.hasPrefix("/") || pattern.hasPrefix("~") { paths.append(pattern) }
        let closed = folders(home: home, vault: vault)
        for raw in paths {
            let path = absolute(raw, home: home, cwd: cwd)
            if let folder = closed.first(where: { path == $0 || path.hasPrefix($0 + "/") }) {
                return "atlas's deny list closes \(folder.hasPrefix(home) ? "~" + folder.dropFirst(home.count) : folder)"
            }
        }
        return nil
    }

    /// The first closed command in a shell command, as written in the list: every segment, command substitution and
    /// `sh -c` body is read, with wrapper words (env, nohup, time, VAR=x) and a path on the command word dropped.
    public static func closedCommand(in command: String) -> String? {
        let (segments, subs) = JobGate.split(command)
        for body in subs { if let hit = closedCommand(in: body) { return hit } }
        for segment in segments {
            var words = ShellSegment.words(segment)
            while let first = words.first, ["env", "nohup", "time", "command", "builtin", "exec", "sudo"].contains((first as NSString).lastPathComponent)
                    || (first.contains("=") && !first.hasPrefix("-") && !first.hasPrefix("=")) {
                words.removeFirst()
            }
            guard let first = words.first else { continue }
            let word = (first as NSString).lastPathComponent
            if ["bash", "zsh", "sh"].contains(word), words.count >= 3, words[1] == "-c", let hit = closedCommand(in: words[2]) { return hit }
            let named = [word] + words.dropFirst()
            if let hit = commands.first(where: { named.count >= $0.count && Array(named.prefix($0.count)) == $0 }) {
                return hit.joined(separator: " ")
            }
        }
        return nil
    }

    static func parts(_ rule: String) -> (String, String)? {
        guard let open = rule.firstIndex(of: "("), rule.hasSuffix(")") else { return nil }
        return (String(rule[..<open]), String(rule[rule.index(after: open)..<rule.index(before: rule.endIndex)]))
    }

    static func resolve(_ pattern: String, home: String, vault: String) -> String {
        if pattern.hasPrefix("./") { return vault + pattern.dropFirst(1) }
        if pattern.hasPrefix("~/") { return home + pattern.dropFirst(1) }
        return pattern
    }

    static func absolute(_ raw: String, home: String, cwd: String) -> String {
        var p = raw
        if p == "~" { p = home } else if p.hasPrefix("~/") { p = home + p.dropFirst(1) }
        if !p.hasPrefix("/") { p = (cwd as NSString).appendingPathComponent(p) }
        return ConsentPolicy.canonical(p)
    }
}
