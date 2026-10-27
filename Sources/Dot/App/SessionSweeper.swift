import DotKit
import Foundation

/// Deletes Dot's own Claude Code sessions older than `claudeSessionDays` (SessionSweep): two minutes after launch, then
/// every 6 hours. Talk's, agents' and jobs' folders only; at 30 days (the default) it does nothing and Claude Code's own
/// cleanup is the only one.
@MainActor
enum SessionSweeper {
    private static var timer: Timer?

    /// `live`: the conversations Dot's processes are on now (Talk.liveSessionIds), never deleted however old.
    static func start(config: @escaping @MainActor () -> DotConfig, live: @escaping @MainActor () -> Set<String>) {
        timer?.invalidate()
        DispatchQueue.main.asyncAfter(deadline: .now() + 120) { run(config(), live: live) }
        timer = Timer.scheduledTimer(withTimeInterval: 6 * 3600, repeats: true) { _ in
            Task { @MainActor in run(config(), live: live) }
        }
    }

    private struct Candidate: Sendable { let id: String; let file: URL; let folder: URL; let modified: Date; let size: Int }

    /// The files are read off the main thread; each is deleted on it, where sessions start, after `live` is asked
    /// again and the file is seen unwritten since, so a conversation resumed meanwhile stays (review, 10-27).
    static func run(_ config: DotConfig, live: @escaping @MainActor () -> Set<String>) {
        let days = config.claudeSessionDays
        guard (1..<SessionSweep.claudeDefault).contains(days) else { return }
        let talk = config.talkRootURL.path, agents = config.agentsRootURL.path, jobs = JobManager.root.path
        let inUse = live()
        DispatchQueue.global(qos: .utility).async {
            let fm = FileManager.default
            let projects = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".claude/projects", isDirectory: true)
            let folders = ((try? fm.contentsOfDirectory(at: projects, includingPropertiesForKeys: nil)) ?? [])
                .filter { SessionSweep.isDots($0.lastPathComponent, talk: talk, agents: agents, jobs: jobs) }
            var found: [Candidate] = []
            var skipped = 0
            for folder in folders {
                let files = (try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.contentModificationDateKey])) ?? []
                let sessions = files.filter { $0.pathExtension == "jsonl" }.compactMap { url -> (id: String, modified: Date)? in
                    guard let date = (try? url.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate else { return nil }
                    return (url.deletingPathExtension().lastPathComponent, date)
                }
                let dates = Dictionary(sessions.map { ($0.id, $0.modified) }, uniquingKeysWith: { a, _ in a })
                for id in SessionSweep.expired(sessions, days: days, inUse: inUse, now: Date()) {
                    let file = folder.appendingPathComponent("\(id).jsonl")
                    // only a session Dot started: its recorded folder, not just the folder name, says so
                    guard let cwd = SessionSweep.startCwd(file: file), SessionSweep.isDots(cwd: cwd, talk: talk, agents: agents, jobs: jobs),
                          let modified = dates[id] else {
                        skipped += 1
                        continue
                    }
                    found.append(Candidate(id: id, file: file, folder: folder, modified: modified,
                                           size: (try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0))
                }
            }
            let candidates = found, unmatched = skipped
            DispatchQueue.main.async {
                MainActor.assumeIsolated { delete(candidates, live: live(), days: days, skipped: unmatched) }
            }
        }
    }

    private static func delete(_ found: [Candidate], live: Set<String>, days: Int, skipped: Int) {
        let fm = FileManager.default
        var removed = 0, bytes = 0
        for c in found where !live.contains(c.id) {
            let now = (try? c.file.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
            guard now == c.modified, (try? fm.removeItem(at: c.file)) != nil else { continue }   // written since: in use again
            removed += 1
            bytes += c.size
            // what Claude Code keeps beside a session (large tool results), when there is any
            try? fm.removeItem(at: c.folder.appendingPathComponent(c.id, isDirectory: true))
        }
        if removed > 0 {
            Log.info("sessions: deleted \(removed) of Dot's Claude Code sessions older than \(days) days (\(bytes / 1_000_000) MB)")
        }
        if skipped > 0 { Log.info("sessions: kept \(skipped) in Dot-named folders that Dot didn't start") }
    }
}
