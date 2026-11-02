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
    private var running = RoutineRuns()
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
        agents.routineOutcome = { [weak self] slug, end in self?.outcome(slug: slug, end: end) }
        timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.tick()
                // the week ahead rolls forward, and a rule he just installed is found (AG-22)
                if let self, Date().timeIntervalSince(self.wakesSyncedAt) > 1800 { self.syncWakes() }
            }
        }
        syncWakes()
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
            guard !running.isRunning(routine.id) else { continue }
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
        // Due while the Mac slept or Dot was closed (AG-22): it runs once now and says it is late.
        let late = !byHand && WakePlan.isLate(due: routine.nextRun, now: now)
        book.markStarted(routine.id, at: now)
        save()
        let agent = agent(for: routine)
        running.start(routine.id, agent: agent.slug)
        let when = routine.lastRun.map { "the last run was \(Self.relative($0, now: now))" } ?? "this is the first run"
        let brief = "[routine] \(routine.brief)"
        let mode = routine.runMode
        var note = "This is a scheduled \(mode == .watch ? "watch" : "report") run (\(routine.schedule.words); \(when)), not a fresh ask: do the task, report what changed since the last run, and say so plainly if nothing did. Keep the reply short; it lands in your thread for him to read later."
        if mode == .watch { note += " " + Self.watchNote }
        if late {
            let f = DateFormatter()
            f.dateFormat = "h:mm a"
            note += " This run is late: it was due at \(f.string(from: routine.nextRun)) while the Mac was asleep or Dot was closed; say so in one clause."
            Log.info("routines: \(routine.id) is late (due \(routine.nextRun))")
        }
        agents.handoff(brief: brief, agentName: routine.agentName, context: nil, shots: nil, note: note, routine: true, agent: agent, routineMode: mode)
        Log.info("routines: ran \(routine.id) (\(agent.slug), \(mode.rawValue))\(byHand ? " by hand" : "")")
        onChanged?()
    }

    /// The routine's own agent, by its folder: by name, a renamed agent's routine founded a new agent under
    /// the new name, and its outcome never found the routine.
    private func agent(for routine: Routine) -> AgentManager.Agent {
        agents.roster().first(where: { $0.slug == routine.agent }) ?? agents.ensureAgent(named: routine.agentName)
    }

    private func outcome(slug: String, end: RoutineRunEnd) {
        guard let id = running.end(agent: slug) else { return }
        let paused = book.markEnded(id, end)
        save()
        switch end {
        case .stopped: Log.info("routines: \(id) stopped; it runs again at its next time")
        case .broke(let why): Log.info("routines: \(id) failed: \(why) (\(book.routines.first(where: { $0.id == id })?.failures ?? 0) in a row)")
        case .result: break
        }
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
        agents.handoff(brief: routine.fixBrief, agentName: routine.agentName, context: nil, shots: nil, agent: agent(for: routine))
        Log.info("routines: \(id) handed to \(routine.agent) to fix")
    }

    private func save() {
        do { try book.save(to: url) } catch { Log.error("routines: could not save: \(error)") }
        onChanged?()
        syncWakes()
    }

    // MARK: Waking the Mac for routines (parity AG-22)

    /// Whether his sudoers rule lets Dot ask pmset for wakes (`/etc/sudoers.d/dot-pmset`); checked on each sync.
    private(set) var wakeRule = false
    private var wakesSyncedAt = Date.distantPast
    private var wakeSyncPending = false
    private var wakesURL: URL { config.dotHome.appendingPathComponent(".wakes.json") }
    static let wakeOwner = "Dot"

    /// What Home says under the routines (nil with none active).
    var wakeLine: String? {
        let active = book.routines.filter { !$0.paused }
        return WakePlan.homeLine(ruleInstalled: wakeRule, activeRoutines: active.count, overnight: active.contains { WakePlan.isOvernight($0.nextRun) })
    }

    /// The one command that installs the rule (Home copies it; the rule file sits beside Dot's settings).
    var wakeInstallCommand: String {
        let file = config.dotHome.appendingPathComponent("dot-pmset")
        if !FileManager.default.fileExists(atPath: file.path) {
            try? WakePlan.sudoersRule(user: NSUserName()).write(to: file, atomically: true, encoding: .utf8)
        }
        return WakePlan.installCommand(ruleFile: file.path)
    }

    /// The wakes the routines need, asked of pmset two minutes before each next run; the ones Dot asked for that no
    /// routine needs any more are cancelled. Without his rule nothing is asked and routines wait for the Mac to wake.
    func syncWakes() {
        guard !wakeSyncPending else { return }
        wakeSyncPending = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
            guard let self else { return }
            self.wakeSyncPending = false
            let now = Date()
            let wanted = self.config.routines ? WakePlan.wakes(nextRuns: self.book.routines.filter { !$0.paused }.map(\.nextRun), now: now) : []
            let recordedURL = self.wakesURL
            let recorded = ((try? JSONDecoder().decode([Double].self, from: Data(contentsOf: recordedURL))) ?? []).map { Date(timeIntervalSince1970: $0) }
            self.wakesSyncedAt = now
            DispatchQueue.global(qos: .utility).async {
                let rule = Self.wakeRuleInstalled()
                var kept = recorded
                if rule, !(wanted.isEmpty && recorded.isEmpty) {
                    let listed = WakePlan.scheduled(pmsetOutput: Self.output("/usr/bin/pmset", ["-g", "sched"]) ?? "").filter { $0.type == "wake" }.map(\.at)
                    let mine = recorded.filter { r in listed.contains { abs($0.timeIntervalSince(r)) < 1 } }
                    let (add, cancel) = WakePlan.changes(wanted: wanted, scheduled: mine, now: now)
                    kept = mine.filter { $0 > now && !cancel.contains($0) }
                    for date in cancel {
                        let ok = Self.sudoPmset(["schedule", "cancel", "wake", WakePlan.pmsetDate(date), Self.wakeOwner])
                        Log.info("routines: wake at \(WakePlan.pmsetDate(date)) \(ok ? "cancelled" : "couldn't be cancelled")")
                    }
                    for date in add where !listed.contains(where: { abs($0.timeIntervalSince(date)) < 60 }) {
                        if Self.sudoPmset(["schedule", "wake", WakePlan.pmsetDate(date), Self.wakeOwner]) {
                            kept.append(date)
                            Log.info("routines: the Mac wakes at \(WakePlan.pmsetDate(date)) for a routine")
                        } else {
                            Log.warn("routines: pmset refused a wake at \(WakePlan.pmsetDate(date))")
                        }
                    }
                }
                if let data = try? JSONEncoder().encode(kept.sorted().map(\.timeIntervalSince1970)) { try? data.write(to: recordedURL, options: .atomic) }
                DispatchQueue.main.async { [weak self] in
                    guard let self else { return }
                    if self.wakeRule != rule { Log.info("routines: wake rule \(rule ? "found" : "not installed"); \(rule ? "Dot wakes the Mac for routines" : "routines wait while the Mac sleeps")") }
                    self.wakeRule = rule
                    self.onChanged?()
                }
            }
        }
    }

    /// The rule allows `sudo -n pmset schedule wake` (no password, no prompt).
    nonisolated static func wakeRuleInstalled() -> Bool {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/sudo")
        p.arguments = ["-n", "-l", "/usr/bin/pmset", "schedule", "wake", "01/01/30 00:00:00", wakeOwner]
        p.standardOutput = FileHandle.nullDevice
        p.standardError = FileHandle.nullDevice
        do { try p.run() } catch { return false }
        p.waitUntilExit()
        return p.terminationStatus == 0
    }

    nonisolated static func sudoPmset(_ args: [String]) -> Bool {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/sudo")
        p.arguments = ["-n", "/usr/bin/pmset"] + args
        p.standardOutput = FileHandle.nullDevice
        p.standardError = FileHandle.nullDevice
        do { try p.run() } catch { return false }
        p.waitUntilExit()
        return p.terminationStatus == 0
    }

    nonisolated static func output(_ path: String, _ args: [String]) -> String? {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: path)
        p.arguments = args
        let pipe = Pipe()
        p.standardOutput = pipe
        p.standardError = FileHandle.nullDevice
        do { try p.run() } catch { return nil }
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        return String(data: data, encoding: .utf8)
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
