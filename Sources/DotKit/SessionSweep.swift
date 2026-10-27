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

    /// The folder a session started in: the first "cwd" in the head of its file (Claude Code writes one on each record,
    /// ahead of the message). nil when the head has none.
    public static func startCwd(head: String) -> String? {
        guard let re = try? NSRegularExpression(pattern: #""cwd"\s*:\s*("(?:[^"\\]|\\.)*")"#),
              let m = re.firstMatch(in: head, range: NSRange(head.startIndex..., in: head)),
              let r = Range(m.range(at: 1), in: head) else { return nil }
        return (try? JSONSerialization.jsonObject(with: Data(head[r].utf8), options: .fragmentsAllowed)) as? String
    }

    /// startCwd over a session file, read a MiB at a time until its first "cwd" (a first message with a screenshot puts
    /// it far in: 114 of the 163 Dot sessions on his Mac had it past 64 KiB, one at 553 KB, 2026-10-27). nil when the
    /// first `limit` bytes have none.
    public static func startCwd(file: URL, limit: Int = 32 << 20) -> String? {
        guard let handle = try? FileHandle(forReadingFrom: file) else { return nil }
        defer { try? handle.close() }
        let key = Data("\"cwd\"".utf8)
        var carry = Data()   // a key split across two reads
        var read = 0
        while read < limit {
            guard let piece = try? handle.read(upToCount: 1 << 20), !piece.isEmpty else { return nil }
            read += piece.count
            var window = Data(carry + piece)
            if let r = window.range(of: key) {
                let start = r.lowerBound - window.startIndex
                if window.count - start < 8192, let more = try? handle.read(upToCount: 8192) { window.append(more) }   // the value, whole
                let tail = window.subdata(in: (window.startIndex + start)..<min(window.endIndex, window.startIndex + start + 8192))
                return startCwd(head: String(decoding: tail, as: UTF8.self))
            }
            carry = Data(window.suffix(key.count - 1))
        }
        return nil
    }

    /// Whether Dot started a session in `cwd`: talk's folder, or one agent's or one job's own folder. The folder name
    /// alone can't tell (`/Dot/agents-email/x` and `/Dot/agents/email-x` both name `-Dot-agents-email-x`).
    public static func isDots(cwd: String, talk: String, agents: String, jobs: String) -> Bool {
        func std(_ p: String) -> String { (p as NSString).standardizingPath }
        let path = std(cwd)
        if path == std(talk) { return true }
        let parent = (path as NSString).deletingLastPathComponent
        return parent == std(agents) || parent == std(jobs)
    }

    /// The session ids to delete: last written more than `days` ago and not in use. Nothing when `days` is outside
    /// 1...29 (30 and up is Claude Code's own; 0 or less is a slip, not "delete everything").
    public static func expired(_ sessions: [(id: String, modified: Date)], days: Int, inUse: Set<String>, now: Date) -> [String] {
        guard (1..<claudeDefault).contains(days) else { return [] }
        let cutoff = now.addingTimeInterval(-Double(days) * 86400)
        return sessions.filter { $0.modified < cutoff && !inUse.contains($0.id) }.map(\.id).sorted()
    }

    /// What a swept session's sidecar folder is renamed to before it is deleted off the main thread, so a sweep cut off
    /// by a quit is finished by the next one rather than left beside no session forever (review, 10-27).
    static let tombstonePrefix = ".dot-swept-"

    /// Renames the folder Claude Code keeps beside session `id` (large tool results) to its tombstone: one rename, safe
    /// on the main thread. Nil when the session has none.
    public static func tombstone(_ id: String, in folder: URL) -> URL? {
        let dead = folder.appendingPathComponent(tombstonePrefix + id, isDirectory: true)
        return (try? FileManager.default.moveItem(at: folder.appendingPathComponent(id, isDirectory: true), to: dead)) != nil ? dead : nil
    }

    /// The tombstones in a folder: this sweep's, or ones a quit left behind.
    public static func tombstones(in folder: URL) -> [URL] {
        ((try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? [])
            .filter { $0.lastPathComponent.hasPrefix(tombstonePrefix) }
    }
}
