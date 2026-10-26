import Foundation

/// Each agent's own tools (parity AG-08): the MCP servers its work calls for, Atlas and computer use always kept.
///
/// Claude Code's `--strict-mcp-config` would do this by listing only the chosen servers, but it also drops his
/// claude.ai connectors (Gmail, Calendar, Drive, Claude Docs), which no mcp.json can name (re-tested 2026-10-26). So an
/// agent keeps the servers it inherits and the ones it should not have are disallowed by server (`mcp__<server>`),
/// which removes every tool of that server from the session.
///
/// The choice: a rule table over the agent's brief (its CLAUDE.md and the ask that founded it), a server he named in
/// the brief, and his own adds and removes from Home (`.dot/tools.json`). A server Dot has not seen yet is not denied
/// (the list of known servers grows from each session's init line).
public enum AgentTools {
    /// Always kept: Atlas (his chief of staff's tools) and the computer-use servers (an agent's hands).
    public static let always: Set<String> = ["atlas", "cua-driver", "cua-computer-use", "computer-use", "cmux-cua"]

    /// Servers chosen when the brief talks about their work (claude.ai connectors by their tool prefix).
    public static let rules: [(server: String, words: [String])] = [
        ("claude_ai_Gmail", ["mail", "email", "e-mail", "inbox", "gmail", "reply", "replies", "newsletter", "unsubscribe"]),
        ("claude_ai_Google_Calendar", ["calendar", "schedule", "scheduling", "meeting", "meetings", "event", "events", "availability", "invite", "office hours"]),
        ("claude_ai_Google_Drive", ["drive", "google doc", "google docs", "google sheet", "sheets", "spreadsheet", "slides", "shared folder"]),
        ("claude_ai_Claude_Docs", ["claude doc", "claude docs", "living doc", "shared doc", "artifact"]),
    ]

    /// The name a server's tools carry: "claude.ai Gmail" -> "claude_ai_Gmail" (Claude Code's own rule: anything but
    /// letters, digits, _ and - becomes _).
    public static func toolPrefix(_ serverName: String) -> String {
        String(serverName.map { $0.isLetter && $0.isASCII || $0.isNumber && $0.isASCII || $0 == "_" || $0 == "-" ? $0 : "_" })
    }

    /// His overrides from Home (`.dot/tools.json`): servers he added and ones he took away.
    public struct Overrides: Codable, Equatable {
        public var add: [String]
        public var remove: [String]
        public init(add: [String] = [], remove: [String] = []) { self.add = add; self.remove = remove }
    }

    /// The servers this agent gets, among `known`.
    public static func chosen(brief: String, known: [String], overrides: Overrides = Overrides()) -> Set<String> {
        let text = " " + brief.lowercased() + " "
        var out = Set(known.filter { always.contains($0) })
        for (server, words) in rules where known.contains(server) {
            if words.contains(where: { mentions(text, $0) }) { out.insert(server) }
        }
        // a server he named in the brief ("use blender", "the rea server")
        for server in known where !server.hasPrefix("claude_ai_") {
            let name = server.replacingOccurrences(of: "_", with: " ").replacingOccurrences(of: "-", with: " ").lowercased()
            if name.count >= 3, mentions(text, name) { out.insert(server) }
        }
        out.formUnion(overrides.add.filter { known.contains($0) })
        out.subtract(overrides.remove.filter { !always.contains($0) })
        return out
    }

    /// The disallow rules for the servers it does not get.
    public static func denied(known: [String], chosen: Set<String>) -> [String] {
        known.filter { !chosen.contains($0) }.sorted().map { "mcp__\($0)" }
    }

    /// A readable name for Home: "claude_ai_Google_Calendar" -> "Google Calendar".
    public static func label(_ server: String) -> String {
        let s = server.hasPrefix("claude_ai_") ? String(server.dropFirst("claude_ai_".count)) : server
        return s.replacingOccurrences(of: "_", with: " ")
    }

    static func mentions(_ text: String, _ phrase: String) -> Bool {
        text.range(of: #"\b\#(NSRegularExpression.escapedPattern(for: phrase))\b"#, options: .regularExpression) != nil
    }
}

/// The servers Dot has seen agents' sessions come up with, kept in `~/Dot/agents/.servers.json`.
public enum KnownServers {
    public static func merge(_ old: [String], _ seen: [String]) -> [String] {
        Array(Set(old).union(seen)).sorted()
    }
}
