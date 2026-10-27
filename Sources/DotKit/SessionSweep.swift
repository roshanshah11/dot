import Foundation

/// Claude Code keeps each session's messages, screenshots included, in `~/.claude/projects/<folder>/<id>.jsonl` for its
/// `cleanupPeriodDays` (30 by default), across every project. Dot's own sessions can go sooner (`claudeSessionDays`, his
/// call 2026-10-27): only the folders of Dot's talk, agents and jobs, never another project's, so his other Claude Code
/// chats (and `roshan history` over them) keep Claude Code's own retention.
public enum SessionSweep {
    /// Claude Code's own retention; at or past it Dot deletes nothing.
    public static let claudeDefault = 30

    /// Claude Code's folder name for a working directory: every character that isn't a letter or digit becomes "-".
    public static func folderName(for path: String) -> String {
        String(path.map { $0.isASCII && ($0.isLetter || $0.isNumber) ? $0 : "-" })
    }

    /// Whether a project folder holds Dot's sessions: talk's own, or one agent's or one job's (a folder per agent or job).
    public static func isDots(_ folder: String, talk: String, agents: String, jobs: String) -> Bool {
        if folder == folderName(for: talk) { return true }
        return [agents, jobs].contains { root in
            let prefix = folderName(for: root) + "-"
            return folder.hasPrefix(prefix) && folder.count > prefix.count
        }
    }

    /// The session ids to delete: last written more than `days` ago and not in use. Nothing when `days` is outside
    /// 1...29 (30 and up is Claude Code's own; 0 or less is a slip, not "delete everything").
    public static func expired(_ sessions: [(id: String, modified: Date)], days: Int, inUse: Set<String>, now: Date) -> [String] {
        guard (1..<claudeDefault).contains(days) else { return [] }
        let cutoff = now.addingTimeInterval(-Double(days) * 86400)
        return sessions.filter { $0.modified < cutoff && !inUse.contains($0.id) }.map(\.id).sorted()
    }
}
