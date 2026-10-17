import Foundation

/// What Dot finds when it starts again (round seven, F2). On 2026-10-15 a relaunch left an agent's
/// `claude` process running with no Dot to answer it (its permission requests failed "Stream
/// closed", it kept editing its own files), and the turn it was on never got a result row. Now Dot
/// ends such leftovers and marks the turn interrupted, with a way to pick it up again.
public enum AgentRecovery {
    public struct Process: Equatable, Sendable {
        public let pid: Int32
        public let ppid: Int32
        public let command: String
        public init(pid: Int32, ppid: Int32, command: String) { self.pid = pid; self.ppid = ppid; self.command = command }
    }

    /// `ps -axo pid=,ppid=,command=` output, one process per line.
    public static func parsePS(_ output: String) -> [Process] {
        output.split(separator: "\n").compactMap { line in
            let parts = line.trimmingCharacters(in: .whitespaces).split(separator: " ", maxSplits: 2, omittingEmptySubsequences: true)
            guard parts.count == 3, let pid = Int32(parts[0]), let ppid = Int32(parts[1]) else { return nil }
            return Process(pid: pid, ppid: ppid, command: String(parts[2]))
        }
    }

    static let sessionArgument = try! NSRegularExpression(pattern: #"--(?:session-id|resume)\s+([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})"#)

    /// Agent sessions whose parent is gone: re-parented to launchd (ppid 1), a `claude -p` command
    /// line carrying one of the agents' session ids.
    public static func orphans(in processes: [Process], sessionIds: Set<String>) -> [Process] {
        let wanted = Set(sessionIds.map { $0.lowercased() })
        return processes.filter { process in
            guard process.ppid == 1, process.command.contains("claude"), process.command.contains(" -p") else { return false }
            let ns = process.command as NSString
            guard let match = sessionArgument.firstMatch(in: process.command, range: NSRange(location: 0, length: ns.length)) else { return false }
            return wanted.contains(ns.substring(with: match.range(at: 1)).lowercased())
        }
    }

    /// The brief of a turn that never finished: the last "user" row with no "result" row after it.
    public static func unfinishedBrief(_ rows: [(role: String, text: String)]) -> String? {
        for row in rows.reversed() {
            if row.role == "result" { return nil }
            if row.role == "user" { return row.text }
        }
        return nil
    }
}

/// Files a turn made or changed in the agent's output folder (round seven, G1): HeyClicky keeps a
/// turn's artifacts with the turn; Dot compares the folder before and after the turn.
public enum TurnArtifacts {
    /// Names (relative to the folder) that are new in `after`, or newer there than in `before`.
    public static func changed(before: [String: Date], after: [String: Date]) -> [String] {
        after.filter { name, date in
            guard let old = before[name] else { return true }
            return date > old
        }
        .keys.sorted()
    }

    /// The folder's files (not hidden), by name relative to it, with their modification dates.
    public static func listing(of folder: URL) -> [String: Date] {
        let fm = FileManager.default
        guard let walker = fm.enumerator(at: folder, includingPropertiesForKeys: [.contentModificationDateKey, .isRegularFileKey],
                                         options: [.skipsHiddenFiles]) else { return [:] }
        var out: [String: Date] = [:]
        let base = folder.standardizedFileURL.path
        for case let url as URL in walker {
            guard let values = try? url.resourceValues(forKeys: [.contentModificationDateKey, .isRegularFileKey]), values.isRegularFile == true else { continue }
            let path = url.standardizedFileURL.path
            let name = path.hasPrefix(base + "/") ? String(path.dropFirst(base.count + 1)) : url.lastPathComponent
            out[name] = values.contentModificationDate ?? .distantPast
        }
        return out
    }
}
