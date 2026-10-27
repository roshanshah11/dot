import DotKit
import Foundation

/// Deletes Dot's own Claude Code sessions older than `claudeSessionDays` (SessionSweep): two minutes after launch, then
/// every 6 hours. Talk's, agents' and jobs' folders only; at 30 days (the default) it does nothing and Claude Code's own
/// cleanup is the only one.
@MainActor
enum SessionSweeper {
    private static var timer: Timer?

    static func start(config: @escaping @MainActor () -> DotConfig) {
        timer?.invalidate()
        DispatchQueue.main.asyncAfter(deadline: .now() + 120) { run(config()) }
        timer = Timer.scheduledTimer(withTimeInterval: 6 * 3600, repeats: true) { _ in
            Task { @MainActor in run(config()) }
        }
    }

    static func run(_ config: DotConfig) {
        let days = config.claudeSessionDays
        guard (1..<SessionSweep.claudeDefault).contains(days) else { return }
        let talk = config.talkRootURL.path, agents = config.agentsRootURL.path, jobs = JobManager.root.path
        let inUse = hostedSessions(agentsRoot: config.agentsRootURL)
        DispatchQueue.global(qos: .utility).async {
            let fm = FileManager.default
            let projects = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".claude/projects", isDirectory: true)
            let folders = ((try? fm.contentsOfDirectory(at: projects, includingPropertiesForKeys: nil)) ?? [])
                .filter { SessionSweep.isDots($0.lastPathComponent, talk: talk, agents: agents, jobs: jobs) }
            var removed = 0
            var bytes = 0
            for folder in folders {
                let files = (try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.contentModificationDateKey])) ?? []
                let sessions = files.filter { $0.pathExtension == "jsonl" }.compactMap { url -> (id: String, modified: Date)? in
                    guard let date = (try? url.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate else { return nil }
                    return (url.deletingPathExtension().lastPathComponent, date)
                }
                for id in SessionSweep.expired(sessions, days: days, inUse: inUse, now: Date()) {
                    let file = folder.appendingPathComponent("\(id).jsonl")
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
        }
    }

    /// Each agent's current session (`.dot/session-id`): a hosted agent can stay on one past the sweep's age.
    static func hostedSessions(agentsRoot: URL) -> Set<String> {
        let folders = (try? FileManager.default.contentsOfDirectory(at: agentsRoot, includingPropertiesForKeys: nil)) ?? []
        return Set(folders.compactMap {
            (try? String(contentsOf: $0.appendingPathComponent(".dot/session-id"), encoding: .utf8))?
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }.filter { !$0.isEmpty })
    }
}
