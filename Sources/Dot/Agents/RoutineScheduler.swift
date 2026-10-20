import DotKit
import Foundation
import Network

/// Runs routines: a standing agent's task on a schedule, the way HeyClicky's routines and the
/// Scheduled tab of OpenAI's dots work. Routines run on this Mac while Dot is open and online,
/// and never while he is on a call. A run that was missed while the Mac slept happens once
/// after waking; three failed runs in a row pause a routine, with the reason in Home. Results
/// land in the agent's thread with an unread dot, with no spoken line and no chime.
@MainActor
final class RoutineScheduler {
    private let config: DotConfig
    private let agents: AgentManager
    private let hud: NotchHUD
    private let url: URL
    private(set) var book: RoutineBook
    private var timer: Timer?
    private let monitor = NWPathMonitor()
    private(set) var online = true
    private var waitingOffline: Set<String> = []
    /// Running routines by agent slug, so the outcome can be matched to its routine.
    private var inFlight: [String: String] = [:]
    /// Whether a run may start now (not on a call); the app supplies it.
    var canRun: (() -> Bool)?
    var onChanged: (() -> Void)?

    init(config: DotConfig, agents: AgentManager, hud: NotchHUD) {
        self.config = config
        self.agents = agents
        self.hud = hud
        self.url = config.routinesURL
        self.book = RoutineBook.load(from: url)
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in self?.online = path.status == .satisfied }
        }
        monitor.start(queue: DispatchQueue(label: "com.roshan.dot.routines.network"))
    }

    func start() {
        guard config.routines else { Log.info("routines: off in config"); return }
        agents.routineOutcome = { [weak self] slug, failed, note in self?.outcome(slug: slug, failed: failed, note: note) }
        timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        Log.info("routines: \(book.routines.count) on file, \(book.routines.filter { !$0.paused }.count) active")
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in self?.tick() }
    }

    var routines: [Routine] { book.routines }

    // MARK: Editing

    /// Adds a routine from plain words; nil when the words do not say when.
    @discardableResult
    /// `runFirstNow: false` when the brief that founded it was just handed to the agent (a morning
    /// suggestion's "do it" is run one, MB-03), so the first scheduled run is the next one.
    /// `mode`: watch checks and speaks up only when something needs him (07); report says what changed.
    func add(agentName: String, when: String, brief: String, runFirstNow: Bool = true, mode: RoutineMode = .report) -> Routine? {
        guard let schedule = RoutineSchedule.parse(when) else { return nil }
        let agent = agents.ensureAgent(named: agentName)
        let routine = Routine(agent: agent.slug, agentName: agent.name, brief: brief, schedule: schedule, runFirstNow: runFirstNow, mode: mode)
        book.routines.append(routine)
        save()
        Log.info("routines: added \(routine.id) for \(agent.slug): \(schedule.words), \(mode.rawValue): \(Log.short(brief, 80))")
        return routine
    }

    func remove(_ id: String) {
        book.routines.removeAll { $0.id == id }
        save()
    }

    func setPaused(_ id: String, _ paused: Bool) {
        guard let i = book.routines.firstIndex(where: { $0.id == id }) else { return }
        book.routines[i].paused = paused
        if !paused {
            book.routines[i].failures = 0
            book.routines[i].lastNote = nil
            book.routines[i].nextRun = book.routines[i].schedule.next(after: Date())
        }
        save()
    }

    func runNow(_ id: String) {
        guard let routine = book.routines.first(where: { $0.id == id }) else { return }
        run(routine, now: Date(), byHand: true)
    }

    func routines(for slug: String) -> [Routine] { book.routines.filter { $0.agent == slug } }

    /// An agent's `Routine:` line (TC-06): create, update, pause, resume or delete one of its own
    /// routines by title.
    func apply(_ command: RoutineCommand, agent slug: String, agentName: String) -> RoutineChange {
        let change = book.apply(command, agent: slug, agentName: agentName)
        if case .notFound = change {} else { save() }
        Log.info("routines: \(slug) asked to \(command.action.rawValue) \"\(command.title)\": \(change.words)")
        return change
    }

    /// The line an agent's brief carries about its routines (TC-07).
    func listLine(for slug: String) -> String { book.listLine(for: slug) }

    // MARK: Running

    func tick(now: Date = Date()) {
        guard config.routines else { return }
        for routine in book.due(at: now) {
            guard !inFlight.values.contains(routine.id) else { continue }
            guard online else {
                if !waitingOffline.contains(routine.id) {
                    waitingOffline.insert(routine.id)
                    Log.info("routines: \(routine.id) waits for the internet")
                }
                continue
            }
            if canRun?() == false { continue }
            if let agent = agents.roster().first(where: { $0.slug == routine.agent }), agents.hasTurnInFlight(agent) { continue }
            run(routine, now: now, byHand: false)
        }
    }

    private func run(_ routine: Routine, now: Date, byHand: Bool) {
        waitingOffline.remove(routine.id)
        book.markStarted(routine.id, at: now)
        save()
        inFlight[routine.agent] = routine.id
        let when = routine.lastRun.map { "the last run was \(Self.relative($0, now: now))" } ?? "this is the first run"
        let brief = "[routine] \(routine.brief)"
        let mode = routine.runMode
        var note = "This is a scheduled \(mode == .watch ? "watch" : "report") run (\(routine.schedule.words); \(when)), not a fresh ask: do the task, report what changed since the last run, and say so plainly if nothing did. Keep the reply short; it lands in your thread for him to read later."
        if mode == .watch { note += " " + Self.watchNote }
        agents.handoff(brief: brief, agentName: routine.agentName, context: nil, shots: nil, note: note, routine: true, routineMode: mode)
        Log.info("routines: ran \(routine.id) (\(routine.agent), \(mode.rawValue))\(byHand ? " by hand" : "")")
        onChanged?()
    }

    private func outcome(slug: String, failed: Bool, note: String?) {
        guard let id = inFlight[slug] else { return }
        inFlight[slug] = nil
        let paused = book.markFinished(id, failed: failed, note: note)
        save()
        if paused, let routine = book.routines.first(where: { $0.id == id }) {
            // "fix it" (TC-11, HeyClicky's C102): the agent gets its brief, the last failure and where the failed runs are.
            hud.notify(NotchNotice(id: "routine-paused-\(id)", icon: "pause.circle", title: "\(routine.agentName)'s routine is paused",
                                   detail: routine.lastNote, tone: .warn, actionTitle: "resume", action: { [weak self] in self?.setPaused(id, false) },
                                   secondaryTitle: "fix it", secondary: { [weak self] in self?.fix(id) }, seconds: 0))
        }
    }

    /// Hands a paused routine to its agent to fix (TC-11). The routine stays paused until he resumes it
    /// or the agent's reply changes it with a Routine line.
    func fix(_ id: String) {
        guard let routine = book.routines.first(where: { $0.id == id }) else { return }
        agents.handoff(brief: routine.fixBrief, agentName: routine.agentName, context: nil, shots: nil)
        Log.info("routines: \(id) handed to \(routine.agent) to fix")
    }

    private func save() {
        do { try book.save(to: url) } catch { Log.error("routines: could not save: \(error)") }
        onChanged?()
    }

    /// What a watch run is told on top of the run note (07).
    static let watchNote = "End a watch run with 'Notify: yes' only when something needs him (a reply owed, a decision, a change he must act on); otherwise 'Notify: no' and one line."

    static func relative(_ date: Date, now: Date) -> String {
        let s = Int(now.timeIntervalSince(date))
        if s < 3600 { return "\(max(s / 60, 1)) minutes ago" }
        if s < 86400 { return "\(s / 3600) hours ago" }
        return "\(s / 86400) days ago"
    }
}
