import AppKit
import DotKit
import Foundation

/// Named background agents: each is a folder under `~/Dot/agents/<slug>/` with a CLAUDE.md
/// identity, run as its own Claude Code session on Opus with the user's full skill set.
@MainActor
final class AgentManager {
    struct Agent: Identifiable, Equatable {
        let slug: String
        let name: String
        let folder: URL
        var id: String { slug }
        var outputFolder: URL { folder.appendingPathComponent("output", isDirectory: true) }
        var claudeMD: URL { folder.appendingPathComponent("CLAUDE.md") }
    }

    final class Run {
        let agent: Agent
        let session: ClaudeSession
        var startedAt = Date()
        var lastLine = "starting"
        var lastBrief = ""
        var finalText = ""
        var buffer = ""
        var steps: [String] = []
        var idleWork: DispatchWorkItem?
        /// A scheduled run: quiet when it finishes, and its outcome goes back to the routine.
        var isRoutine = false
        /// What he allowed for the rest of this task ("Allow for this task"), by allowanceKey; a new
        /// brief starts with none.
        var allowances: Set<String> = []
        /// Helpers (subagents) this brief has started.
        var helpers = 0
        /// The output folder when the turn began, so the turn's own files can be named (G1).
        var outputBaseline: [String: Date] = [:]
        /// A result that came while helpers still worked in the background (F5), kept in case no turn follows.
        var deferredResult: ResultInfo?
        /// Messages he sent that have not had their result yet. A result with none owed (a helper's
        /// notice, or a message the last turn already folded in) updates the row without a chime or a word (FX-05).
        var turnsOwed = 0
        /// He changed course mid-turn (VO-09): the interrupted turn's result is swallowed and this
        /// starts the next one; empty means he paused it and the session waits for his next word.
        var pendingSteer: String?
        init(agent: Agent, session: ClaudeSession) { self.agent = agent; self.session = session }
        /// A turn in flight, or helpers still at work in the background after one (F5).
        var isWorking: Bool { session.turnInFlight || session.backgroundTasks > 0 }
        func step(_ line: String) { steps.append(line); if steps.count > 6 { steps.removeFirst(steps.count - 6) } }
        func row(_ line: String, state: AgentRow.State = .running) -> AgentRow {
            let shown = helpers > 0 && state == .running ? "with \(helpers) helper\(helpers == 1 ? "" : "s"): \(line)" : line
            return AgentRow(id: agent.slug, name: agent.name, line: shown, state: state, steps: steps, canStop: state == .running, startedAt: startedAt)
        }
    }

    private let config: DotConfig
    private let hud: NotchHUD
    private let speaker: TTSProvider
    private let ledger: Ledger
    private var runs: [String: Run] = [:]
    /// What each working agent is doing now, for the orb (VI-04).
    private var activities: [String: AgentActivity] = [:]
    /// The agent he last spoke to by name or replied to: a follow-up with no name goes there (G2).
    private(set) var lastAddressed: String?
    /// Set after init: Atlas's view of his day rides along with every brief.
    var atlas: AtlasBridge?
    /// Set after init: clears unrecognised shell commands that are plainly harmless.
    var jev: Jev?
    /// What agents do on their own, ask about, or leave to him (~/Dot/rules.json); Home edits it.
    var rules: AgentRules
    private let rulesURL: URL
    /// A routine run finished: (agent slug, failed, a note); the scheduler listens.
    var routineOutcome: ((String, Bool, String?) -> Void)?

    struct Running { let slug: String; let name: String; let task: String }

    /// Agents with a turn in flight, newest first.
    func runningAgents() -> [Running] {
        runs.values.filter { $0.isWorking }
            .sorted { $0.startedAt > $1.startedAt }
            .map { Running(slug: $0.agent.slug, name: $0.agent.name, task: Log.short($0.lastBrief, 120)) }
    }
    /// The last final text of each agent, for the notch card and Home.
    private(set) var lastResults: [String: String] = [:]
    private var finishedAt: [String: Date] = [:]
    /// When an agent last reported to him out loud or with a chime (not a quiet routine run).
    private var reportedAt: [String: Date] = [:]
    private var lastBriefs: [String: String] = [:]

    /// What the talk model is told about agents: who is working on what, who just finished and what they said.
    struct Recent { let name: String; let task: String; let state: String; let line: String; let result: String?; let when: Date }

    /// Running agents and those that finished within `minutes`, newest first.
    func recentRuns(minutes: Double = 45) -> [Recent] {
        var out: [Recent] = []
        for run in runs.values where run.isWorking || hud.hasConsent(agent: run.agent.slug) {
            let waiting = hud.openConsents.first { $0.agentId == run.agent.slug }
            out.append(Recent(name: run.agent.name, task: Log.short(run.lastBrief, 160), state: waiting.map { "waiting for his yes to \($0.title)" } ?? "working",
                              line: run.lastLine, result: nil, when: run.startedAt))
        }
        let cutoff = Date().addingTimeInterval(-minutes * 60)
        for (slug, when) in finishedAt where when >= cutoff && !out.contains(where: { $0.name.lowercased() == Self.displayName(for: config.agentsRootURL.appendingPathComponent(slug))?.lowercased() }) {
            let name = Self.displayName(for: config.agentsRootURL.appendingPathComponent(slug)) ?? slug
            out.append(Recent(name: name, task: Log.short(lastBriefs[slug] ?? "", 160), state: "finished", line: "", result: lastResults[slug].map { String($0.prefix(600)) }, when: when))
        }
        return out.sorted { $0.when > $1.when }
    }

    var onRosterChanged: (() -> Void)?
    var onRunFinished: ((Agent) -> Void)?

    init(config: DotConfig, hud: NotchHUD, speaker: TTSProvider, ledger: Ledger) {
        self.config = config
        self.hud = hud
        self.speaker = speaker
        self.ledger = ledger
        self.rulesURL = config.agentRulesURL
        self.rules = AgentRules.load(from: rulesURL)
        try? FileManager.default.createDirectory(at: config.agentsRootURL, withIntermediateDirectories: true)
        _ = ensureAgent(named: "Dot")
        hud.model.onOpenAgent = { [weak self] slug in
            Task { @MainActor in
                guard let self, let agent = self.roster().first(where: { $0.slug == slug }) else { return }
                NSWorkspace.shared.open(agent.outputFolder)
            }
        }
        hud.model.onReply = { [weak self] slug, text in
            Task { @MainActor in self?.reply(to: slug, text: text) }
        }
        hud.model.onDismissAgent = { [weak self] slug in
            Task { @MainActor in self?.hud.removeAgent(id: slug) }
        }
        hud.model.onFocusConsent = { [weak self] slug in
            Task { @MainActor in self?.hud.bringConsentForward(agent: slug) }
        }
        hud.onConsentShown = { [weak self] card in
            guard let self, self.config.speakAgentResults, !(self.config.quietOnCalls && CallPresence.isOnCall()) else { return }
            self.speaker.speak("\(card.agent) wants to \(card.title).")
        }
    }

    /// Stop from the task bar: the session ends now; the folder and notes stay.
    func stop(_ slug: String) {
        guard let run = runs[slug] else { return }
        // Its questions leave with it (F1): an answer would go to a session that is gone.
        let withdrawn = hud.withdrawConsent(agent: slug)
        if withdrawn > 0 { Log.info("agent[\(slug)] stopped with \(withdrawn) question(s) open; withdrawn") }
        run.session.stop()
        runs[slug] = nil
        postActivity()
        hud.upsertAgent(run.row("stopped", state: .failed))
        appendTranscript(run.agent, role: "result", text: "stopped from the task bar")
        Log.info("agent[\(slug)] stopped from the task bar")
    }

    /// A typed follow-up from the notch or Home continues the agent's own conversation.
    func reply(to slug: String, text: String) {
        var trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let agent = roster().first(where: { $0.slug == slug }) else { return }
        lastAddressed = slug
        // The button on a turn a restart cut short (F2): say what it was, in case the thread is older than 12 h.
        if trimmed == Self.continueLabel, let brief = takeInterruptedBrief(for: agent) {
            trimmed = "Dot closed while you were working on this, so that turn stopped part-way: \"\(brief)\". Pick up where you left off; check what is already done (files in output/, drafts, Atlas) before doing anything again."
        }
        handoff(brief: trimmed, agentName: agent.name, context: nil, shots: nil, agent: agent)
    }

    /// The button an interrupted turn offers.
    static let continueLabel = "continue where you left off"
    /// Briefs of turns a restart cut short, by agent, for the continue button. Kept in
    /// `<agent>/.dot/interrupted.json` too, so a second restart before he taps it loses nothing (FX-06).
    private var interruptedBriefs: [String: String] = [:]

    private func interruptedFile(_ agent: Agent) -> URL { agent.folder.appendingPathComponent(".dot/interrupted.json") }

    private func keepInterruptedBrief(_ brief: String, for agent: Agent) {
        interruptedBriefs[agent.slug] = brief
        let record: [String: Any] = ["brief": brief, "at": ISO8601DateFormatter().string(from: Date())]
        if let data = try? JSONSerialization.data(withJSONObject: record) { try? data.write(to: interruptedFile(agent), options: .atomic) }
    }

    private func takeInterruptedBrief(for agent: Agent) -> String? {
        let file = interruptedFile(agent)
        defer { try? FileManager.default.removeItem(at: file) }
        if let brief = interruptedBriefs.removeValue(forKey: agent.slug) { return brief }
        guard let data = try? Data(contentsOf: file),
              let record = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return record["brief"] as? String
    }

    func outputFiles(for agent: Agent) -> [URL] {
        let fm = FileManager.default
        guard let items = try? fm.contentsOfDirectory(at: agent.outputFolder, includingPropertiesForKeys: [.contentModificationDateKey]) else { return [] }
        return items.filter { !$0.lastPathComponent.hasPrefix(".") }
            .sorted { (a, b) in
                let da = (try? a.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
                let db = (try? b.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
                return da > db
            }
    }

    // MARK: Roster

    func roster() -> [Agent] {
        let fm = FileManager.default
        guard let entries = try? fm.contentsOfDirectory(at: config.agentsRootURL, includingPropertiesForKeys: nil) else { return [] }
        return entries.filter { $0.hasDirectoryPath && !$0.lastPathComponent.hasPrefix(".") }
            .map { url in
                let name = Self.displayName(for: url) ?? url.lastPathComponent
                return Agent(slug: url.lastPathComponent, name: name, folder: url)
            }
            .sorted { $0.slug == "dot" ? true : ($1.slug == "dot" ? false : $0.name < $1.name) }
    }

    func isRunning(_ agent: Agent) -> Bool { runs[agent.slug]?.session.isRunning ?? false }

    @discardableResult
    func ensureAgent(named name: String) -> Agent {
        let slug = Self.slugify(name)
        let folder = config.agentsRootURL.appendingPathComponent(slug, isDirectory: true)
        let fm = FileManager.default
        let agent = Agent(slug: slug, name: name, folder: folder)
        if !fm.fileExists(atPath: folder.path) {
            try? fm.createDirectory(at: folder.appendingPathComponent("output"), withIntermediateDirectories: true)
            try? fm.createDirectory(at: folder.appendingPathComponent("tmp"), withIntermediateDirectories: true)
            try? fm.createDirectory(at: folder.appendingPathComponent(".dot"), withIntermediateDirectories: true)
            try? Prompts.agentClaudeMD(name: name).write(to: agent.claudeMD, atomically: true, encoding: .utf8)
            Log.info("agent[\(slug)] created at \(folder.path)")
            onRosterChanged?()
        }
        return agent
    }

    // MARK: Handoff

    func saveRules() {
        do { try rules.save(to: rulesURL) } catch { Log.error("rules: could not save: \(error)") }
    }

    /// `agent`: an agent already on the roster, by its folder, so a renamed one is not founded again
    /// under its new name.
    func handoff(brief: String, agentName: String?, context: ScreenContext?, shots: [ScreenShot]?,
                 extraImages: [(data: Data, mediaType: String)] = [], note: String? = nil, routine: Bool = false, agent known: Agent? = nil) {
        let agent = known ?? ensureAgent(named: agentName ?? "Dot")
        if known != nil || agentName != nil { lastAddressed = agent.slug }
        let run: Run
        if let live = runs[agent.slug], live.session.isRunning, !live.isWorking {
            run = live
            run.idleWork?.cancel()
        } else if let live = runs[agent.slug], live.session.isRunning, live.isWorking {
            // Mid-turn: Claude Code hands the message to the turn at its next step (probed 2026-10-16:
            // a message sent during a running command was acted on before the next one). The turn,
            // its brief and its steps carry on; only the row says what came in.
            if hud.hasConsent(agent: agent.slug) {
                hud.bringConsentForward(agent: agent.slug)
                hud.flash(status: "\(agent.name) is waiting for your yes first; it gets this after", for: 4)
            } else {
                hud.flash(status: "passed to \(agent.name) while it works", for: 3)
            }
            live.step(Log.short("he added: \(brief)", 90))
            live.turnsOwed += 1
            // A routine run by hand into a busy agent still reports back to its routine when the turn ends.
            if routine { live.isRoutine = true }
            hud.upsertAgent(liveRow(live, live.lastLine))
            appendTranscript(agent, role: "user", text: brief)
            live.session.send(text: brief)
            Log.info("agent[\(agent.slug)] follow-up mid-turn: \(Log.short(brief))")
            return
        } else {
            guard let fresh = startRun(for: agent) else { return }
            run = fresh
        }
        run.startedAt = Date()
        run.finalText = ""
        run.buffer = ""
        run.lastLine = "starting"
        run.lastBrief = brief
        run.steps = []
        run.helpers = 0
        run.isRoutine = routine
        run.allowances = []
        run.turnsOwed = 1
        activities[agent.slug] = .thinking
        if !routine { Chimes.shared.play(.launch) }
        run.outputBaseline = TurnArtifacts.listing(of: agent.outputFolder)
        hud.upsertAgent(run.row(Log.short(brief, 90)))

        var text = brief
        var contextLines: [String] = []
        if let about = atlas?.profileBlock(), !about.isEmpty { contextLines.append(about) }
        if let today = atlas?.shortBlock(), !today.isEmpty { contextLines.append(today) }
        if let context {
            if let app = context.appName { contextLines.append("Frontmost app when they asked: \(app)" + (context.windowTitle.map { ", window \"\($0)\"" } ?? "")) }
            if let url = context.url { contextLines.append("Page: \(url)") }
            if let selected = context.selectedText, !selected.isEmpty { contextLines.append("Selected text: \"\(Log.short(selected, 600))\"") }
        }
        if let shots, !shots.isEmpty { contextLines.append("A screenshot of their screen at the time is attached; it is context, not the task.") }
        if let note, !note.isEmpty { contextLines.append(note) }
        if !contextLines.isEmpty {
            text += "\n\n[context]\n" + contextLines.joined(separator: "\n") + "\n[/context]"
        }
        let images = (shots ?? []).filter { $0.isCursorScreen }.prefix(1).map { (data: $0.jpeg, mediaType: "image/jpeg") } + extraImages
        appendTranscript(agent, role: "user", text: brief)
        run.session.send(text: text, images: Array(images))
        postActivity(agent.slug)
        Log.info("agent[\(agent.slug)] handoff: \(Log.short(brief))")
    }

    private func startRun(for agent: Agent) -> Run? {
        var options = ClaudeSession.Options(cwd: agent.folder, model: config.agentModel)
        var appended = Prompts.agent(name: agent.name) + Prompts.agentExtras(helpers: config.agentHelpers, rulesLine: rules.briefLine(for: agent.slug))
        if let atlasPrompt = atlas?.chatPrompt(), !atlasPrompt.isEmpty {
            appended += "\n\n# Atlas: the chief-of-staff prompt every Atlas chat runs with. You have the same tools and the same mandate; Dot's rules above say where files go and when to ask.\n" + atlasPrompt
        }
        options.appendSystemPrompt = appended
        Log.info("agent[\(agent.slug)] system prompt \(appended.count) chars (atlas chat prompt \(atlas?.chatPrompt().count ?? 0))")
        options.extraArguments = ["--add-dir", DotConfig.expand(config.atlasRoot)]
        // Round seven (F3): every edit and command comes to Dot's rules; under acceptEdits Claude Code
        // approved deletes and writes inside the agent's folder and ~/roshan without asking anyone.
        options.permissionMode = config.agentPermissionMode
        // F5: helpers run in the foreground, side by side, so the turn ends when the work does.
        options.environment["CLAUDE_CODE_DISABLE_BACKGROUND_TASKS"] = "1"
        // Every command starts in the agent's folder: Claude Code otherwise keeps a cd between commands
        // (inside the folders it may work in, ~/roshan among them), and a later relative rm would land there.
        options.environment["CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR"] = "1"
        // F4: a script runner is a shell with no gate, and an extension install changes the browser.
        options.disallowedTools = Self.disallowedAgentTools
        options.permissionPromptOverStdio = true
        options.maxTurns = 200
        options.mcpConfigPath = config.mcpConfigPath(config.agentMCPConfig)
        options.strictMCP = false
        options.settingSources = nil
        options.effort = config.agentEffort
        options.includePartialMessages = true
        let sessionFile = agent.folder.appendingPathComponent(".dot/session-id")
        let touched = (try? FileManager.default.attributesOfItem(atPath: sessionFile.path)[.modificationDate] as? Date) ?? .distantPast
        let fresh = Date().timeIntervalSince(touched) < 12 * 3600
        if fresh, let saved = try? String(contentsOf: sessionFile, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines),
           UUID(uuidString: saved) != nil, Self.conversationExists(saved) {
            options.sessionId = saved
            options.resume = true
        } else if !fresh {
            Log.info("agent[\(agent.slug)] thread is older than 12 h; starting a fresh conversation (notes in CLAUDE.md carry over)")
        }
        let session = ClaudeSession(label: "agent:\(agent.slug)", claudePath: config.claudeExecutable, options: options)
        let run = Run(agent: agent, session: session)
        session.onEvent = { [weak self, weak run] event in
            guard let self, let run else { return }
            self.handle(event, run: run)
        }
        session.permissionHandler = { [weak self, weak run] request, completion in
            guard let self, let run else { completion(false, "Dot is gone."); return }
            self.permission(request, run: run, completion: completion)
        }
        session.onExit = { [weak self, weak run] status in
            guard let self, let run else { return }
            if self.runs[run.agent.slug] === run {
                self.runs[run.agent.slug] = nil
                self.hud.withdrawConsent(agent: run.agent.slug)
                self.postActivity()
            }
            if status != 0, self.hud.model.agents.first(where: { $0.id == run.agent.slug })?.state == .running {
                self.hud.upsertAgent(run.row("stopped (exit \(status))", state: .failed))
            }
        }
        do {
            try session.start()
        } catch {
            hud.flash(error: "Could not start \(agent.name): \(error.localizedDescription)")
            return nil
        }
        runs[agent.slug] = run
        return run
    }

    // MARK: Events

    private func handle(_ event: StreamEvent, run: Run) {
        let agent = run.agent
        switch event {
        case .systemInit(let id, _):
            if !id.isEmpty {
                try? id.write(to: agent.folder.appendingPathComponent(".dot/session-id"), atomically: true, encoding: .utf8)
            }
        case .result(let result):
            try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: agent.folder.appendingPathComponent(".dot/session-id").path)
            if let steer = run.pendingSteer {
                run.pendingSteer = nil
                run.turnsOwed = 0
                appendTranscript(agent, role: "progress", text: steer.isEmpty ? "paused by him" : "stopped there; he changed course")
                if steer.isEmpty {
                    hud.upsertAgent(run.row("paused; tell it what next", state: .done))
                    postActivity()
                    Log.info("agent[\(agent.slug)] paused by him; session kept")
                } else {
                    Log.info("agent[\(agent.slug)] changed course: \(Log.short(steer))")
                    handoff(brief: steer, agentName: agent.name, context: nil, shots: nil, agent: agent)
                }
                return
            }
            if run.session.backgroundTasks > 0 {
                // Helpers still at work in the background (F5): these words are progress, not the result.
                let said = run.finalText.isEmpty ? (result.resultText ?? "") : run.finalText
                ledger.record(kind: "agent", agent: agent.slug, model: config.agentModel, result: result, summary: "(helpers still working) " + Log.short(said, 160))
                run.lastLine = Log.short(Self.firstSentence(of: said), 90)
                hud.upsertAgent(liveRow(run, run.lastLine))
                appendTranscript(agent, role: "progress", text: "helpers still working: \(Log.short(said, 300))")
                Log.info("agent[\(agent.slug)] turn ended with \(run.session.backgroundTasks) background task(s) open; waiting for them")
                run.deferredResult = result
                return
            }
            run.deferredResult = nil
            finished(run, result: result)
            return
        case .backgroundTasks(let count):
            // The helpers are done; the runtime normally starts a turn to report them. If none comes, finish with what was said.
            guard count == 0, run.deferredResult != nil else { break }
            DispatchQueue.main.asyncAfter(deadline: .now() + 30) { [weak self, weak run] in
                guard let self, let run, !run.session.turnInFlight, let deferred = run.deferredResult else { return }
                run.deferredResult = nil
                self.finished(run, result: deferred)
            }
        case .textDelta(let delta):
            run.buffer += delta
            let line = run.buffer.split(separator: "\n").last.map(String.init) ?? run.buffer
            if line.count > 12 {
                run.lastLine = Log.short(line, 90)
                hud.upsertAgent(liveRow(run, run.lastLine))
            }
        case .assistantText(let text):
            if !text.isEmpty {
                run.finalText = text
                run.buffer = ""
                run.step(Log.short(Self.firstSentence(of: text), 90))
                appendTranscript(agent, role: "assistant", text: text)
            }
        case .toolUse(_, let name, let input):
            if name == "Agent" || name == "Task" { run.helpers += 1 }
            let line = Self.describe(tool: name, input: input)
            var command: String?
            if case .string(let text)? = input["command"] { command = text }
            activities[agent.slug] = AgentActivity.of(tool: name, command: command)
            postActivity(agent.slug)
            run.lastLine = line
            run.step(Log.short(line, 90))
            hud.upsertAgent(liveRow(run, line))
            appendTranscript(agent, role: "tool", text: line)
        case .toolResult(let content, let isError):
            // What the tool said back, trimmed: Home shows it under the step when he opens it.
            let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { appendTranscript(agent, role: isError ? "tool_error" : "output", text: String(trimmed.prefix(1200))) }
        default:
            break
        }
    }

    /// The orb's view of the agents (VI-04): the step the agent that just moved is on (else any
    /// working one's), and how many wait on his yes. Each post is the whole state.
    private func postActivity(_ slug: String? = nil) {
        let working = runs.values.filter { $0.isWorking }.map(\.agent.slug)
        activities = activities.filter { working.contains($0.key) }
        let activity = slug.flatMap { activities[$0] } ?? working.compactMap { activities[$0] }.first
        let waiting = Set(hud.openConsents.map(\.agentId)).count
        NotificationCenter.default.post(name: .dotAgentActivity, object: nil,
                                        userInfo: AgentActivityReport(activity: activity, waiting: waiting, agent: slug).userInfo)
    }

    /// The row for a working agent: "needs you" while one of its cards is open (a helper's step must
    /// not turn it back to working and hide that it waits on him).
    private func liveRow(_ run: Run, _ line: String) -> AgentRow {
        run.row(line, state: hud.hasConsent(agent: run.agent.slug) ? .waiting : .running)
    }

    private func finished(_ run: Run, result: ResultInfo) {
        let agent = run.agent
        let raw = run.finalText.isEmpty ? (result.resultText ?? "") : run.finalText
        let parsed = AgentResult.parse(raw)
        let text = parsed.body
        ledger.record(kind: "agent", agent: agent.slug, model: config.agentModel, result: result, summary: Log.short(text, 200))
        let summary = Self.firstSentence(of: text)
        let failed = result.isError
        lastResults[agent.slug] = text
        finishedAt[agent.slug] = Date()
        lastBriefs[agent.slug] = run.lastBrief
        let outputs = outputFiles(for: agent)
        // The turn's own files first (G1); the folder's newest otherwise.
        let made = TurnArtifacts.changed(before: run.outputBaseline, after: TurnArtifacts.listing(of: agent.outputFolder))
        let shown = made.isEmpty ? Array(outputs.prefix(4)) : made.prefix(4).map { agent.outputFolder.appendingPathComponent($0) }
        hud.upsertAgent(AgentRow(id: agent.slug, name: agent.name, line: failed ? "failed: \(summary)" : summary, state: failed ? .failed : .done,
                                 result: text, outputCount: outputs.count, outputs: shown, nextAction: parsed.nextAction))
        appendTranscript(agent, role: "result", text: "\(result.subtype) in \(result.durationMs) ms, $\(String(format: "%.3f", result.costUSD))")
        // The turn's record keeps what HeyClicky's does (G1): the next step it offered and the files it made.
        if let next = parsed.nextAction { appendTranscript(agent, role: "next", text: next) }
        for name in made { appendTranscript(agent, role: "artifact", text: name) }
        // A second result in the same brief (a message that came in during the last reply) names only its own files.
        run.outputBaseline = TurnArtifacts.listing(of: agent.outputFolder)
        let quiet = run.isRoutine   // a scheduled run lands in the thread without a chime or a word (HeyClicky's routines do the same)
        let unprompted = run.turnsOwed == 0
        run.turnsOwed = max(run.turnsOwed - 1, 0)
        if unprompted { Log.info("agent[\(agent.slug)] a result nobody asked for (a helper's notice or a folded-in message): row updated, no chime or word") }
        if !quiet, !unprompted { reportedAt[agent.slug] = Date() }
        run.isRoutine = false
        if quiet { routineOutcome?(agent.slug, failed, failed ? summary : nil) }
        // On a call the result waits in the notch: no chime, no voice (FX-11).
        let onCall = config.quietOnCalls && CallPresence.isOnCall()
        let silent = quiet || unprompted || onCall
        if !silent { Chimes.shared.play(failed ? .failed : .done) }
        activities[agent.slug] = nil
        postActivity()
        NotificationCenter.default.post(name: .dotAgentFinished, object: nil, userInfo: ["failed": failed])
        if config.speakAgentResults, !summary.isEmpty, !silent {
            let more = SpeechText.clean(text).count > summary.count + 40 ? " the rest is in the notch." : ""
            speaker.speak("\(agent.name) here. \(summary)\(more)")
        }
        Log.info("agent[\(agent.slug)] finished \(result.subtype) in \(result.durationMs) ms, \(outputs.count) output file(s)")
        atlas?.refreshSoon()
        onRunFinished?(agent)

        run.idleWork?.cancel()
        let work = DispatchWorkItem { [weak self, weak run] in
            guard let self, let run, !run.isWorking, !self.hud.hasConsent(agent: run.agent.slug) else { return }
            run.session.stop()
            if self.runs[run.agent.slug] === run { self.runs[run.agent.slug] = nil }
            Log.info("agent[\(run.agent.slug)] idle, session closed")
        }
        run.idleWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(max(config.agentIdleMinutes, 1)) * 60, execute: work)
        // A finished row stays two minutes, or as long as he has it open to read.
        DispatchQueue.main.asyncAfter(deadline: .now() + 120) { [weak self] in
            guard let self, self.runs[agent.slug]?.isWorking != true, self.hud.model.expanded != agent.slug else { return }
            if self.hud.model.agents.first(where: { $0.id == agent.slug })?.state == .done { self.hud.removeAgent(id: agent.slug) }
        }
    }

    // MARK: Consent

    private func permission(_ request: PermissionRequest, run: Run, completion: @escaping (Bool, String?) -> Void) {
        let policy = consentPolicy(for: run.agent)
        // His rules first (dots' custom rules): the class of the action decides whether it runs, asks or stays his.
        // A delete inside the agent's own folder or a temp folder is the agent tidying up, not a delete of his;
        // any other delete is "a delete outside the agent's folder", which the outward class names (F3).
        var command = request.toolRequest.string("command")
        let deletesOutside = request.toolName == "Bash" && command.map(policy.deletesOutsideScratch) == true
        if request.toolName == "Bash", let full = command, let rest = policy.commandWithoutScratchDeletes(full) { command = rest }
        let cls: ActionClass = deletesOutside ? .outward
            : request.toolName == "Bash" && command?.isEmpty == true ? .write
            : AgentRules.classify(toolName: request.toolName, command: command, flattened: ConsentPolicy.flatten(request.toolRequest.input),
                                  input: request.toolRequest.input, knownServers: knownServers)
        let label = deletesOutside ? "a delete outside its folder" : cls.title.lowercased()
        let behavior = rules.behavior(for: cls, agent: run.agent.slug)
        let classKey = allowanceKey(request, cls: cls, deletesOutside: deletesOutside, classAsks: true)
        switch behavior {
        case .mine:
            appendTranscript(run.agent, role: "denied", text: "\(request.toolName): \(label) is his to do")
            hud.upsertAgent(run.row("left \(label) to him"))
            completion(false, "That step (\(label)) is Roshan's to do, by his rules: prepare everything for it, stop there, and say what is ready for him.")
            return
        case .ask, .ifAsked:
            if let classKey, run.allowances.contains(classKey) {
                appendTranscript(run.agent, role: "allowed", text: "\(request.toolName): allowed for this task")
                completion(true, nil)
                return
            }
            if behavior == .ifAsked, AgentRules.briefAsks(for: cls, brief: run.lastBrief) {
                appendTranscript(run.agent, role: "allowed", text: "\(request.toolName): his brief asked for it")
                completion(true, nil)
                return
            }
            if case .deny(let reason) = policy.decide(request.toolRequest) {
                appendTranscript(run.agent, role: "denied", text: "\(request.toolName): \(reason)")
                completion(false, "Dot refused: \(reason)")
                return
            }
            askCard(request, run: run, reason: "\(label): \(Self.consentTitle(request))", cls: cls, allowanceKey: classKey, completion: completion)
            return
        case .act:
            break
        }
        let guardKey = allowanceKey(request, cls: cls, deletesOutside: deletesOutside, classAsks: false)
        switch policy.decide(request.toolRequest) {
        case .allow:
            completion(true, nil)
        case .deny(let reason):
            appendTranscript(run.agent, role: "denied", text: "\(request.toolName): \(reason)")
            completion(false, "Dot refused: \(reason)")
        case .ask(let reason):
            if let guardKey, run.allowances.contains(guardKey) {
                appendTranscript(run.agent, role: "allowed", text: "\(request.toolName): allowed for this task")
                completion(true, nil)
                return
            }
            if let jev, request.toolName == "Bash", let command = request.toolRequest.string("command"), !policy.mustAsk(command) {
                // Unrecognised, not on the always-ask list: let Jev judge whether it is plainly harmless.
                let state: [String: Any] = [
                    "command": String(command.prefix(1500)), "description": request.description ?? "",
                    "agent_folder": run.agent.folder.path, "task": Log.short(run.lastBrief, 200),
                ]
                jev.evaluate("consent", state: state, questions: [
                    "risky": .yesNo(instructions: "Would running this shell command send a message or mail, submit or post something, pay for something, delete or overwrite the user's own files outside the agent's folder, or install or change something system-wide? Reading, computing, writing files under the user's home, opening apps and pages, and driving an app to look at it are not risky.", yes: "yes, it goes outward or cannot be undone", no: "no, it stays on this Mac and can be undone"),
                ]) { [weak self] answers in
                    guard let self else { completion(false, "Dot is gone."); return }
                    // Stopped or archived while Jev thought: no card for a session that is gone.
                    guard self.runs[run.agent.slug] === run, run.session.isRunning else { completion(false, "The task was stopped."); return }
                    if let p = answers?["risky"]?.probability, p <= 0.4 {
                        Log.info("consent: jev cleared `\(Log.short(command, 80))` (risk \(String(format: "%.2f", p)))")
                        self.appendTranscript(run.agent, role: "cleared", text: "\(request.toolName): \(reason)")
                        completion(true, nil)
                    } else {
                        self.askCard(request, run: run, reason: reason, cls: cls, allowanceKey: guardKey, completion: completion)
                    }
                }
                return
            }
            askCard(request, run: run, reason: reason, cls: cls, allowanceKey: guardKey, completion: completion)
        }
    }

    /// What "Allow for this task" on a request's card covers. A class he set to ask covers that class,
    /// except that deletes outside the agent's folder and each MCP server Dot doesn't hand agents get
    /// their own (one yes to a send must not pass a delete, one yes to a lookup must not pass sudo). A
    /// request his rules let run but a guard stopped covers its command word or tool; a write into a
    /// protected folder covers nothing, so it asks each time.
    private func allowanceKey(_ request: PermissionRequest, cls: ActionClass, deletesOutside: Bool, classAsks: Bool) -> String? {
        if deletesOutside { return "delete" }
        let name = request.toolName
        if name.hasPrefix("mcp__") {
            let server = name.split(separator: "__").dropFirst().first.map(String.init) ?? ""
            if !server.hasPrefix("claude_ai_"), !knownServers.contains(server) { return "mcp:\(server)" }
            return classAsks ? cls.rawValue : "tool:\(name)"
        }
        if classAsks { return cls.rawValue }
        if name == "Bash" {
            let word = ConsentPolicy.commandWord(request.toolRequest.string("command") ?? "")
            return word.isEmpty ? nil : "bash:\(word)"
        }
        if ["Write", "Edit", "MultiEdit", "NotebookEdit"].contains(name) { return nil }
        return "tool:\(name)"
    }

    private func askCard(_ request: PermissionRequest, run: Run, reason: String, cls: ActionClass?, allowanceKey: String?, completion: @escaping (Bool, String?) -> Void) {
        do {
            let title = Self.consentTitle(request)
            let cardId = UUID()
            let agent = run.agent
            // One answer per card: a click and a spoken answer can arrive together.
            var answered = false
            func answer(_ allow: Bool, _ message: String?) {
                guard !answered else { return }
                answered = true
                completion(allow, message)
            }
            // A spoken yes to these has to name the act (G2): sends, payments, deletes, pushes, changes to the Mac.
            let guarded = cls == .outward || cls == .system
                || (request.toolName == "Bash" && consentPolicy(for: run.agent).mustAsk(request.toolRequest.string("command") ?? ""))
            hud.upsertAgent(run.row("waiting for you: \(reason)", state: .waiting))
            var card = ConsentCard(id: cardId, agentId: agent.slug, agent: agent.name, title: title, detail: reason, guarded: guarded, onAllow: { [weak self, weak run] in
                guard !answered else { return }
                self?.settleCard(cardId, run: run, line: reason)
                self?.appendTranscript(agent, role: "allowed", text: "\(request.toolName): \(reason)")
                answer(true, nil)
            }, onDeny: { [weak self, weak run] in
                guard !answered else { return }
                self?.settleCard(cardId, run: run, line: run?.lastLine ?? reason)
                self?.appendTranscript(agent, role: "declined", text: "\(request.toolName): \(reason)")
                answer(false, "The user said not now. Do the rest of the task without this step and say what you skipped.")
            })
            if let allowanceKey {
                // HeyClicky's "your yes covers one conversation": the same kind of action passes for the rest of this task.
                card.onAlways = { [weak self, weak run] in
                    guard !answered else { return }
                    run?.allowances.insert(allowanceKey)
                    self?.settleCard(cardId, run: run, line: reason)
                    self?.appendTranscript(agent, role: "allowed", text: "\(request.toolName): \(Self.allowanceWords(allowanceKey)) allowed for the rest of this task")
                    answer(true, nil)
                }
            }
            // Spoken when it comes on show (NotchHUD.onConsentShown), not now: one queued behind
            // another would be announced while the other is the one a spoken yes answers.
            // Each question is answered no if its agent stops or its session ends, so nothing waits on it (FX-07).
            card.onWithdraw = { [weak self, weak run] in
                guard !answered else { return }
                self?.appendTranscript(agent, role: "declined", text: "\(request.toolName): \(reason) (the task stopped)")
                if run?.session.isRunning == true { answer(false, "The task was stopped.") } else { answered = true }
            }
            hud.present(card, chime: !(config.quietOnCalls && CallPresence.isOnCall()))
            postActivity(agent.slug)
        }
    }

    /// An allowance key in words, for the transcript.
    static func allowanceWords(_ key: String) -> String {
        if key == "delete" { return "deletes outside its folder" }
        if key.hasPrefix("mcp:") { return "\(key.dropFirst(4)) tools" }
        if key.hasPrefix("bash:") { return "`\(key.dropFirst(5))` commands" }
        if key.hasPrefix("tool:") { return String(key.dropFirst(5)) }
        return ActionClass(rawValue: key)?.title.lowercased() ?? key
    }

    /// A card was answered: it leaves the queue, and the agent's row says waiting while it has another.
    private func settleCard(_ id: UUID, run: Run?, line: String) {
        hud.dismissConsent(id: id)
        defer { postActivity(run?.agent.slug) }
        guard let run else { return }
        if hud.hasConsent(agent: run.agent.slug) {
            hud.upsertAgent(run.row("waiting for you: another question", state: .waiting))
        } else {
            hud.upsertAgent(run.row(line))
        }
    }

    /// MCP servers Dot hands agents itself (its mcp config) plus the computer-use servers; a tool from
    /// any other server the agent inherits from his Claude Code setup asks first (F4).
    private var knownServers: Set<String> {
        let configured = config.mcpToolNames(config.agentMCPConfig).map { name -> String in
            var server = name
            if server.hasPrefix("mcp__") { server.removeFirst(5) }
            if server.hasSuffix("__") { server.removeLast(2) }
            return server
        }
        return Set(configured).union(["cua-driver", "cua-computer-use", "computer-use", "cmux-cua"])
    }

    /// Computer-use tools agents never get (F4): a script runner is a shell with no gate (osascript
    /// through Bash covers AppleScript, with Jev and the rules watching), and an extension install
    /// changes his browser.
    static let disallowedAgentTools: [String] = ["cua-driver", "cua-computer-use", "computer-use", "cmux-cua"].flatMap { server in
        ["run_script", "install_extension"].map { "mcp__\(server)__\($0)" }
    }

    func consentPolicy(for agent: Agent) -> ConsentPolicy {
        var allow = Set(config.allowTools)
        var prefixes = config.allowToolPrefixes
        // Computer use passes, observation and input alike; a click whose input names a send,
        // a purchase or a delete still asks (ConsentPolicy.mentionsCommit).
        prefixes.append(contentsOf: ["mcp__cua-driver__", "mcp__cua-computer-use__", "mcp__computer-use__", "mcp__cmux-cua__"])
        // Atlas read tools, when Atlas is configured for agents.
        if config.mcpToolNames(config.agentMCPConfig).contains("mcp__atlas__") {
            for name in ["search", "get", "calendar", "calendars", "mail", "messages", "messages_thread", "contacts", "people", "facts", "history",
                         "journal", "harness_status", "now", "free", "thread", "unanswered", "attachments", "postings", "proposals", "status",
                         "docs", "read_doc", "view_note", "apple_note_read", "recent_files", "commitments", "vocabulary", "sec_lookup", "sec_facts",
                         "sec_batch", "sec_filings", "sec_section", "quote", "fin_calc", "web_text", "canvas_courses", "canvas_find", "canvas_read",
                         "state", "preferences", "lesson", "deliverable", "project", "todo", "reminder", "remember", "deadline_add", "commit", "file"] {
                allow.insert("mcp__atlas__\(name)")
            }
        }
        // Google connectors through Claude Code: reads, drafts, labels and his own calendar pass;
        // send, reply, forward, trash and delete ask (ConsentPolicy.outwardToolWords).
        prefixes.append(contentsOf: ["mcp__claude_ai_Gmail__", "mcp__claude_ai_Google_Calendar__", "mcp__claude_ai_Google_Drive__"])
        prefixes.removeAll { $0.hasSuffix("send") }
        let home = NSHomeDirectory()
        let writable = [agent.folder.path, config.dotHome.path, FileManager.default.temporaryDirectory.path, "/private/tmp", "/tmp", home]
        let protected = ["\(home)/roshan/Atlas/private", "\(home)/roshan/Atlas/objects", "\(home)/roshan/Atlas/qmd-state", "\(home)/.ssh",
                         "\(home)/.claude", "\(home)/.claude-1", "\(home)/.claude-2", "\(home)/.config", "\(home)/Library/Keychains",
                         "\(home)/Library/Application Support", "\(home)/Library/Preferences", "\(home)/Projects/browser-agent/.env"]
        let temp = FileManager.default.temporaryDirectory.path
        return ConsentPolicy(allowTools: allow, allowToolPrefixes: prefixes, denyTools: Set(config.denyTools), writableRoots: writable, protectedRoots: protected,
                             workingDirectory: agent.folder.path, deletableRoots: [agent.folder.path, temp, "/private/tmp", "/tmp"],
                             undeletableRoots: [agent.folder.appendingPathComponent(".dot").path, agent.claudeMD.path],
                             knownServers: knownServers)
    }

    static func consentTitle(_ request: PermissionRequest) -> String {
        let name = request.toolName
        if name == "Bash" { return "run a command" }
        if ["Write", "Edit", "MultiEdit", "NotebookEdit"].contains(name) {
            return "write \(ConsentPolicy.shortPath(request.toolRequest.string("file_path") ?? "a file"))"
        }
        let parts = name.split(separator: "__").map(String.init)
        if parts.count >= 3 {
            let tool = parts[2...].joined(separator: " ").replacingOccurrences(of: "_", with: " ")
            return "use \(parts[1]): \(tool)"
        }
        return "use \(name)"
    }

    // MARK: Transcript

    private func appendTranscript(_ agent: Agent, role: String, text: String) {
        let url = agent.folder.appendingPathComponent(".dot/transcript.jsonl")
        let entry: [String: Any] = ["ts": ISO8601DateFormatter().string(from: Date()), "role": role, "text": text]
        guard let data = try? JSONSerialization.data(withJSONObject: entry), var line = String(data: data, encoding: .utf8) else { return }
        line += "\n"
        if let handle = try? FileHandle(forWritingTo: url) {
            defer { try? handle.close() }
            _ = try? handle.seekToEnd()
            try? handle.write(contentsOf: line.data(using: .utf8)!)
        } else {
            try? line.write(to: url, atomically: true, encoding: .utf8)
        }
    }

    func hasTurnInFlight(_ agent: Agent) -> Bool { runs[agent.slug]?.isWorking ?? false }

    /// Archive: the folder moves under `.archive/` with the date; the roster no longer lists it.
    func archive(_ agent: Agent) {
        hud.withdrawConsent(agent: agent.slug)
        if let run = runs[agent.slug] { run.session.stop(); runs[agent.slug] = nil }
        let archive = config.agentsRootURL.appendingPathComponent(".archive", isDirectory: true)
        try? FileManager.default.createDirectory(at: archive, withIntermediateDirectories: true)
        let stamp = ISO8601DateFormatter().string(from: Date()).prefix(10)
        let dest = archive.appendingPathComponent("\(agent.slug)-\(stamp)", isDirectory: true)
        do {
            try FileManager.default.moveItem(at: agent.folder, to: dest)
            hud.removeAgent(id: agent.slug)
            Log.info("agent[\(agent.slug)] archived to \(dest.path)")
            onRosterChanged?()
        } catch {
            Log.error("agent[\(agent.slug)] archive failed: \(error)")
        }
    }

    /// Rename: the first "# name" line of CLAUDE.md is the display name.
    func rename(_ agent: Agent, to name: String) {
        guard var text = try? String(contentsOf: agent.claudeMD, encoding: .utf8) else { return }
        if let range = text.range(of: #"^# .*$"#, options: .regularExpression) {
            text.replaceSubrange(range, with: "# \(name)")
        } else {
            text = "# \(name)\n\n" + text
        }
        try? text.write(to: agent.claudeMD, atomically: true, encoding: .utf8)
        onRosterChanged?()
    }

    func transcriptEntries(for agent: Agent, limit: Int = 300) -> [TranscriptEntry] {
        let url = agent.folder.appendingPathComponent(".dot/transcript.jsonl")
        guard let content = try? String(contentsOf: url, encoding: .utf8) else { return [] }
        let iso = ISO8601DateFormatter()
        let lines = content.split(separator: "\n").suffix(limit)
        return lines.enumerated().compactMap { index, line in
            guard let data = line.data(using: .utf8), let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let role = object["role"] as? String, let text = object["text"] as? String else { return nil }
            return TranscriptEntry(id: index, role: role, text: text, time: (object["ts"] as? String).flatMap { iso.date(from: $0) })
        }
    }

    func transcript(for agent: Agent, limit: Int = 200) -> [(role: String, text: String)] {
        let url = agent.folder.appendingPathComponent(".dot/transcript.jsonl")
        guard let content = try? String(contentsOf: url, encoding: .utf8) else { return [] }
        return content.split(separator: "\n").suffix(limit).compactMap { line in
            guard let data = line.data(using: .utf8), let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let role = object["role"] as? String, let text = object["text"] as? String else { return nil }
            return (role, text)
        }
    }

    /// Dot is quitting (F2): each agent's process ends now instead of running on alone. A turn cut
    /// short this way is found and marked at the next launch, the same way a crash's is.
    func prepareForQuit() {
        for run in runs.values {
            if run.isWorking { Log.info("agent[\(run.agent.slug)] stopped by quit mid-turn: \(Log.short(run.lastBrief, 80))") }
            run.session.terminateNow()
        }
        runs = [:]
    }

    /// Dot just started (F2): end agent sessions left running without it, and mark a turn that never
    /// got its result as interrupted, with a button to pick it up again. On 2026-10-15 a relaunch
    /// left the dot agent's Gmail clean-up running unseen, with no record that the turn ended.
    func recoverAfterLaunch() {
        let agents = roster()
        let sessionIds = Set(agents.compactMap { agent -> String? in
            (try? String(contentsOf: agent.folder.appendingPathComponent(".dot/session-id"), encoding: .utf8))?.trimmingCharacters(in: .whitespacesAndNewlines)
        }.filter { !$0.isEmpty })
        if !sessionIds.isEmpty, let listing = Self.output(of: "/bin/ps", ["-axo", "pid=,ppid=,command="]) {
            for orphan in AgentRecovery.orphans(in: AgentRecovery.parsePS(listing), sessionIds: sessionIds) {
                kill(orphan.pid, SIGTERM)
                Log.warn("agent: ended pid \(orphan.pid), a session left running without Dot")
            }
        }
        let dayAgo = Date().addingTimeInterval(-24 * 3600)
        for agent in agents {
            let entries = transcriptEntries(for: agent, limit: 400)
            guard let brief = AgentRecovery.unfinishedBrief(entries.map { ($0.role, $0.text) }) else { continue }
            appendTranscript(agent, role: "result", text: "stopped: Dot closed while this was running")
            let asked = entries.last(where: { $0.role == "user" })?.time ?? .distantPast
            Log.info("agent[\(agent.slug)] a turn was cut short by a restart: \(Log.short(brief, 80))")
            // An old one is written down quietly; a recent one gets a row with the way back in.
            guard asked > dayAgo else { continue }
            keepInterruptedBrief(brief, for: agent)
            hud.upsertAgent(AgentRow(id: agent.slug, name: agent.name, line: "interrupted when Dot closed", state: .failed,
                                     result: "Dot closed while \(agent.name) was working on: \(Log.short(brief, 240))\n\nIts conversation is saved; continue picks it up where it stopped.",
                                     nextAction: Self.continueLabel))
        }
    }

    /// The agent whose result came in last, within `seconds`, and is not at work again: his next words
    /// may be for it ("good, now draft the reply"), the way HeyClicky binds a reply to the agent that
    /// just reported (G2).
    /// A routine's quiet result never counts: he did not hear it, so his next words are not a reply to it.
    func justReported(within seconds: TimeInterval = 120) -> (slug: String, name: String, said: String)? {
        guard let (slug, when) = reportedAt.max(by: { $0.value < $1.value }), Date().timeIntervalSince(when) <= seconds,
              runs[slug]?.isWorking != true, !hud.hasConsent(agent: slug) else { return nil }
        let name = roster().first(where: { $0.slug == slug })?.name ?? slug
        return (slug, name, Self.firstSentence(of: lastResults[slug] ?? ""))
    }

    /// One line for him on how an agent is doing (nil slug: every agent that is busy or waiting), from
    /// what Dot already knows: no turn for the agent, nothing spent (G2, "progress?").
    /// "retry" (VO-06): the agent's last brief again, told first to check what already happened.
    @discardableResult
    func retry(_ slug: String) -> Bool {
        guard let agent = roster().first(where: { $0.slug == slug }) else { return false }
        var brief = lastBriefs[slug] ?? runs[slug]?.lastBrief ?? transcript(for: agent).last(where: { $0.role == "user" })?.text ?? ""
        if brief.hasPrefix("[retry]"), let cut = brief.range(of: "\n\n") { brief = String(brief[cut.upperBound...]) }
        guard !brief.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        handoff(brief: "[retry] Do this again. First check what already happened (Atlas's ledger, sent mail, drafts, output/) and never repeat a send, a submit or a post that went through.\n\n" + brief,
                agentName: agent.name, context: nil, shots: nil, agent: agent)
        return true
    }

    /// "stop, do X instead" (VO-09): the turn stops where it is, its open cards are answered no, and
    /// the new instruction starts the next turn in the same conversation. `to: nil` is "pause": the
    /// turn stops and the session waits for his next word. false when the agent has no session.
    @discardableResult
    func steer(_ slug: String, to instruction: String?) -> Bool {
        guard let run = runs[slug], run.session.isRunning else { return false }
        lastAddressed = slug
        hud.withdrawConsent(agent: slug)
        if run.session.turnInFlight {
            run.pendingSteer = instruction ?? ""
            run.session.interrupt()
            hud.upsertAgent(run.row(instruction == nil ? "pausing" : "changing course"))
        } else if let instruction {
            handoff(brief: instruction, agentName: run.agent.name, context: nil, shots: nil, agent: run.agent)
        }
        return true
    }

    /// "open the deck email made" (VO-01): the newest file of that kind in the agent's output/, opened.
    func openNewest(_ slug: String, kind: String) -> String? {
        guard let agent = roster().first(where: { $0.slug == slug }) else { return nil }
        let wanted = AgentVoice.extensions(forKind: kind)
        guard let newest = outputFiles(for: agent).first(where: { wanted.isEmpty || wanted.contains($0.pathExtension.lowercased()) }) else { return nil }
        NSWorkspace.shared.open(newest)
        Log.info("agent[\(slug)] opened \(newest.lastPathComponent) by voice")
        return newest.lastPathComponent
    }

    func statusLine(for slug: String?) -> String {
        let cards = hud.openConsents
        func one(_ agent: Agent) -> String {
            if let card = cards.first(where: { $0.agentId == agent.slug }) {
                return "\(agent.name) is waiting for your yes to \(card.title)."
            }
            if let run = runs[agent.slug], run.isWorking {
                let minutes = Int(Date().timeIntervalSince(run.startedAt) / 60)
                let elapsed = minutes < 1 ? "just started" : "\(minutes) minute\(minutes == 1 ? "" : "s") in"
                return "\(agent.name) is still on it, \(elapsed): \(run.lastLine)."
            }
            if let result = lastResults[agent.slug], let when = finishedAt[agent.slug], Date().timeIntervalSince(when) < 6 * 3600 {
                return "\(agent.name) finished: \(Self.firstSentence(of: result))"
            }
            // After a relaunch the memory is empty; its transcript still has what it last reported (VO-02).
            if let found = AgentVoice.lastFinding(in: transcript(for: agent, limit: 150)) {
                return "\(agent.name) last reported: \(Self.firstSentence(of: found))"
            }
            return "\(agent.name) isn't working on anything right now."
        }
        let all = roster()
        if let slug, let agent = all.first(where: { $0.slug == slug }) { return one(agent) }
        let busy = all.filter { agent in cards.contains { $0.agentId == agent.slug } || runs[agent.slug]?.isWorking == true }
        guard !busy.isEmpty else { return "no agents are working right now." }
        let waiting = busy.filter { agent in cards.contains { $0.agentId == agent.slug } }
        let lead = waiting.isEmpty ? "" : "\(waiting.count == 1 ? "one thing needs" : "\(waiting.count) things need") you. "
        return lead + busy.prefix(3).map(one).joined(separator: " ")
    }

    private static func output(of executable: String, _ arguments: [String]) -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice
        do { try process.run() } catch { return nil }
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        return String(data: data, encoding: .utf8)
    }

    // MARK: Helpers

    static func slugify(_ name: String) -> String {
        let lowered = name.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-"))
        let dashed = lowered.replacingOccurrences(of: #"[\s_]+"#, with: "-", options: .regularExpression)
        let slug = String(dashed.unicodeScalars.filter { allowed.contains($0) })
        return slug.isEmpty ? "agent" : slug
    }

    static func displayName(for folder: URL) -> String? {
        guard let text = try? String(contentsOf: folder.appendingPathComponent("CLAUDE.md"), encoding: .utf8),
              let first = text.split(separator: "\n").first(where: { $0.hasPrefix("# ") }) else { return nil }
        return String(first.dropFirst(2)).trimmingCharacters(in: .whitespaces)
    }

    static func conversationExists(_ sessionId: String) -> Bool {
        let projects = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".claude/projects")
        guard let dirs = try? FileManager.default.contentsOfDirectory(at: projects, includingPropertiesForKeys: nil) else { return false }
        return dirs.contains { FileManager.default.fileExists(atPath: $0.appendingPathComponent("\(sessionId).jsonl").path) }
    }

    static func firstSentence(of text: String) -> String {
        let clean = SpeechText.clean(text)
        var splitter = SentenceSplitter()
        if let first = splitter.feed(clean + " ").first { return String(first.prefix(240)) }
        return String(clean.prefix(240))
    }

    static func describe(tool name: String, input: [String: AnyCodableValue]) -> String {
        func str(_ key: String) -> String? { if case .string(let s)? = input[key] { return s } else { return nil } }
        switch name {
        case "Read": return "reading \(ConsentPolicy.shortPath(str("file_path") ?? ""))"
        case "Write", "Edit", "MultiEdit": return "writing \(ConsentPolicy.shortPath(str("file_path") ?? ""))"
        case "Bash": return "running: \(Log.short(str("description") ?? str("command") ?? "", 80))"
        case "Grep", "Glob": return "searching files"
        case "WebSearch": return "searching the web: \(Log.short(str("query") ?? "", 60))"
        case "WebFetch": return "reading \(Log.short(str("url") ?? "", 70))"
        case "Agent", "Task": return "delegating: \(Log.short(str("description") ?? "", 70))"
        case "Skill": return "using skill \(str("skill") ?? "")"
        default:
            let parts = name.split(separator: "__").map(String.init)
            if parts.count >= 3 { return "\(parts[1]): \(parts[2...].joined(separator: " ").replacingOccurrences(of: "_", with: " "))" }
            return name.lowercased()
        }
    }
}

extension Notification.Name {
    static let dotAgentFinished = Notification.Name("com.roshan.dot.agentFinished")
}
