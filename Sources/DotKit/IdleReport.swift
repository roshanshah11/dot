import Foundation

/// Whether the running Dot can be replaced by an install right now: its own answer to the control socket's `jobs`
/// verb, printed by `Dot --jobs` and read by scripts/install-when-idle. `./build.sh` quits Dot, and jobs, lecture
/// mode and in-process agent turns live in Dot's process, so an install waits until none of them is running.
public struct IdleReport: Equatable, Sendable {
    public struct Job: Equatable, Sendable {
        public var id: String
        public var phase: String
        public var goal: String
        public var waitingOnHim: Bool
        public init(id: String, phase: String, goal: String, waitingOnHim: Bool = false) {
            self.id = id; self.phase = phase; self.goal = goal; self.waitingOnHim = waitingOnHim
        }
    }

    /// Live jobs only (starting, running, paused).
    public var jobs: [Job]
    public var queued: Int
    /// Agents with a turn in flight or helpers still at work.
    public var workingAgents: [String]
    /// Allow / Not now cards waiting on him.
    public var cardsWaiting: Int
    public var lecture: Bool

    public init(jobs: [Job] = [], queued: Int = 0, workingAgents: [String] = [], cardsWaiting: Int = 0, lecture: Bool = false) {
        self.jobs = jobs; self.queued = queued; self.workingAgents = workingAgents; self.cardsWaiting = cardsWaiting
        self.lecture = lecture
    }

    /// Why an install must wait; empty when Dot is idle.
    public var reasons: [String] {
        var out: [String] = []
        for job in jobs { out.append("job \(job.id) \(job.phase)\(job.waitingOnHim ? " (waiting on him)" : ""): \(job.goal)") }
        if queued > 0 { out.append("\(queued) job\(queued == 1 ? "" : "s") queued") }
        for slug in workingAgents { out.append("agent \(slug) working") }
        if cardsWaiting > 0 { out.append("\(cardsWaiting) card\(cardsWaiting == 1 ? "" : "s") waiting on him") }
        if lecture { out.append("lecture mode is on") }
        return out
    }

    public var idle: Bool { reasons.isEmpty }

    public var wire: [String: Any] {
        ["v": 1, "idle": idle, "reasons": reasons, "queued": queued, "workingAgents": workingAgents,
         "cardsWaiting": cardsWaiting, "lecture": lecture,
         "jobs": jobs.map { ["id": $0.id, "phase": $0.phase, "goal": $0.goal, "waitingOnHim": $0.waitingOnHim] as [String: Any] }]
    }

    /// Reads a reply back; nil for anything that isn't a version-1 report (an older Dot answers "unknown verb").
    public init?(wire: [String: Any]) {
        guard wire["v"] as? Int == 1, let rows = wire["jobs"] as? [[String: Any]] else { return nil }
        var jobs: [Job] = []
        for row in rows {
            guard let id = row["id"] as? String, let phase = row["phase"] as? String else { return nil }
            jobs.append(Job(id: id, phase: phase, goal: row["goal"] as? String ?? "", waitingOnHim: row["waitingOnHim"] as? Bool ?? false))
        }
        self.init(jobs: jobs, queued: wire["queued"] as? Int ?? 0, workingAgents: wire["workingAgents"] as? [String] ?? [],
                  cardsWaiting: wire["cardsWaiting"] as? Int ?? 0, lecture: wire["lecture"] as? Bool ?? false)
    }
}
