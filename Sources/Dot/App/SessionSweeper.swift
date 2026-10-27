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
        DispatchQueue.main.asyncAfter(deadline: .now() + 120) { run(config(), live: live()) }
        timer = Timer.scheduledTimer(withTimeInterval: 6 * 3600, repeats: true) { _ in
            Task { @MainActor in run(config(), live: live()) }
        }
    }

    static func run(_ config: DotConfig, live inUse: Set<String>) {
        let days = config.claudeSessionDays
        guard (1..<SessionSweep.claudeDefault).contains(days) else { return }
        let talk = config.talkRootURL.path, agents = config.agentsRootURL.path, jobs = JobManager.root.path
        DispatchQueue.global(qos: .utility).async {
            let fm = FileManager.default
            let projects = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".claude/projects", isDirectory: true)
            let folders = ((try? fm.contentsOfDirectory(at: projects, includingPropertiesForKeys: nil)) ?? [])
                .filter { SessionSweep.isDots($0.lastPathComponent, talk: talk, agents: agents, jobs: jobs) }
            var removed = 0
            var bytes = 0
            var skipped = 0
            for folder in folders {
                let files = (try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.contentModificationDateKey])) ?? []
                let sessions = files.filter { $0.pathExtension == "jsonl" }.compactMap { url -> (id: String, modified: Date)? in
                    guard let date = (try? url.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate else { return nil }
                    return (url.deletingPathExtension().lastPathComponent, date)
                }
                for id in SessionSweep.expired(sessions, days: days, inUse: inUse, now: Date()) {
                    let file = folder.appendingPathComponent("\(id).jsonl")
                    // only a session Dot started: its recorded folder, not just the folder name, says so
                    guard let handle = try? FileHandle(forReadingFrom: file) else { continue }
                    let head = String(decoding: (try? handle.read(upToCount: 65_536)) ?? Data(), as: UTF8.self)
                    try? handle.close()
                    guard let cwd = SessionSweep.startCwd(head: head), SessionSweep.isDots(cwd: cwd, talk: talk, agents: agents, jobs: jobs) else {
                        skipped += 1
                        continue
                    }
                    let size = (try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
                    guard (try? fm.removeItem(at: file)) != nil else { continue }
                    removed += 1
                    bytes += size
                    // what Claude Code keeps beside a session (large tool results), when there is any
                    try? fm.removeItem(at: folder.appendingPathComponent(id, isDirectory: true))
                }
            }
            if removed > 0 {
                Log.info("sessions: deleted \(removed) of Dot's Claude Code sessions older than \(days) days (\(bytes / 1_000_000) MB)")
            }
            if skipped > 0 { Log.info("sessions: kept \(skipped) in Dot-named folders that Dot didn't start") }
        }
    }
}
