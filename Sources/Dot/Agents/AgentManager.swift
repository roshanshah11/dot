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
        init(agent: Agent, session: ClaudeSession) { self.agent = agent; self.session = session }
        func step(_ line: String) { steps.append(line); if steps.count > 6 { steps.removeFirst(steps.count - 6) } }
        func row(_ line: String, state: AgentRow.State = .running) -> AgentRow {
            AgentRow(id: agent.slug, name: agent.name, line: line, state: state, steps: steps, canStop: state == .running, startedAt: startedAt)
        }
    }

    private let config: DotConfig
    private let hud: NotchHUD
    private let speaker: TTSProvider
    private let ledger: Ledger
    private var runs: [String: Run] = [:]
    private var pendingConsent: [UUID: (String, Bool, String?) -> Void] = [:]
    /// Set after init: Atlas's view of his day rides along with every brief.
    var atlas: AtlasBridge?
    /// Set after init: clears unrecognised shell commands that are plainly harmless.
    var jev: Jev?

    struct Running { let slug: String; let name: String; let task: String }

    /// Agents with a turn in flight, newest first.
    func runningAgents() -> [Running] {
        runs.values.filter { $0.session.turnInFlight }
            .sorted { $0.startedAt > $1.startedAt }
            .map { Running(slug: $0.agent.slug, name: $0.agent.name, task: Log.short($0.lastBrief, 120)) }
    }
    /// The last final text of each agent, for the notch card and Home.
    private(set) var lastResults: [String: String] = [:]

    var onRosterChanged: (() -> Void)?
    var onRunFinished: ((Agent) -> Void)?

    init(config: DotConfig, hud: NotchHUD, speaker: TTSProvider, ledger: Ledger) {
        self.config = config
        self.hud = hud
        self.speaker = speaker
        self.ledger = ledger
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
    }

    /// Stop from the task bar: the session ends now; the folder and notes stay.
    func stop(_ slug: String) {
        guard let run = runs[slug] else { return }
        run.session.stop()
        runs[slug] = nil
        hud.upsertAgent(run.row("stopped", state: .failed))
        appendTranscript(run.agent, role: "result", text: "stopped from the task bar")
        Log.info("agent[\(slug)] stopped from the task bar")
    }

    /// A typed follow-up from the notch or Home continues the agent's own conversation.
    func reply(to slug: String, text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let agent = roster().first(where: { $0.slug == slug }) else { return }
        handoff(brief: trimmed, agentName: agent.name, context: nil, shots: nil)
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

    func handoff(brief: String, agentName: String?, context: ScreenContext?, shots: [ScreenShot]?,
                 extraImages: [(data: Data, mediaType: String)] = [], note: String? = nil) {
        let agent = ensureAgent(named: agentName ?? "Dot")
        let run: Run
        if let live = runs[agent.slug], live.session.isRunning, !live.session.turnInFlight {
            run = live
            run.idleWork?.cancel()
        } else if let live = runs[agent.slug], live.session.isRunning, live.session.turnInFlight {
            hud.flash(status: "\(agent.name) is still busy; queued")
            // Claude Code queues a second user message behind the turn in flight.
            run = live
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
        Log.info("agent[\(agent.slug)] handoff: \(Log.short(brief))")
    }

    private func startRun(for agent: Agent) -> Run? {
        var options = ClaudeSession.Options(cwd: agent.folder, model: config.agentModel)
        var appended = Prompts.agent(name: agent.name)
        if let atlasPrompt = atlas?.chatPrompt(), !atlasPrompt.isEmpty {
            appended += "\n\n# Atlas: the chief-of-staff prompt every Atlas chat runs with. You have the same tools and the same mandate; Dot's rules above say where files go and when to ask.\n" + atlasPrompt
        }
        options.appendSystemPrompt = appended
        Log.info("agent[\(agent.slug)] system prompt \(appended.count) chars (atlas chat prompt \(atlas?.chatPrompt().count ?? 0))")
        options.extraArguments = ["--add-dir", DotConfig.expand(config.atlasRoot)]
        options.permissionMode = "acceptEdits"
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
            if self.runs[run.agent.slug] === run { self.runs[run.agent.slug] = nil }
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
        case .result:
            try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: agent.folder.appendingPathComponent(".dot/session-id").path)
            finished(run, result: {
                if case .result(let result) = event { return result }
                fatalError("unreachable")
            }())
            return
        case .textDelta(let delta):
            run.buffer += delta
            let line = run.buffer.split(separator: "\n").last.map(String.init) ?? run.buffer
            if line.count > 12 {
                run.lastLine = Log.short(line, 90)
                hud.upsertAgent(run.row(run.lastLine))
            }
        case .assistantText(let text):
            if !text.isEmpty {
                run.finalText = text
                run.buffer = ""
                run.step(Log.short(Self.firstSentence(of: text), 90))
                appendTranscript(agent, role: "assistant", text: text)
            }
        case .toolUse(_, let name, let input):
            let line = Self.describe(tool: name, input: input)
            run.lastLine = line
            run.step(Log.short(line, 90))
            hud.upsertAgent(run.row(line))
            appendTranscript(agent, role: "tool", text: line)
        default:
            break
        }
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
        let outputs = outputFiles(for: agent)
        hud.upsertAgent(AgentRow(id: agent.slug, name: agent.name, line: failed ? "failed: \(summary)" : summary, state: failed ? .failed : .done,
                                 result: text, outputCount: outputs.count, outputs: Array(outputs.prefix(4)), nextAction: parsed.nextAction))
        appendTranscript(agent, role: "result", text: "\(result.subtype) in \(result.durationMs) ms, $\(String(format: "%.3f", result.costUSD))")
        NSSound(named: failed ? "Basso" : "Glass")?.play()
        NotificationCenter.default.post(name: .dotAgentFinished, object: nil, userInfo: ["failed": failed])
        if config.speakAgentResults, !summary.isEmpty {
            let more = SpeechText.clean(text).count > summary.count + 40 ? " the rest is in the notch." : ""
            speaker.speak("\(agent.name) here. \(summary)\(more)")
        }
        Log.info("agent[\(agent.slug)] finished \(result.subtype) in \(result.durationMs) ms, \(outputs.count) output file(s)")
        atlas?.refreshSoon()
        onRunFinished?(agent)

        run.idleWork?.cancel()
        let work = DispatchWorkItem { [weak self, weak run] in
            guard let self, let run, !run.session.turnInFlight else { return }
            run.session.stop()
            if self.runs[run.agent.slug] === run { self.runs[run.agent.slug] = nil }
            Log.info("agent[\(run.agent.slug)] idle, session closed")
        }
        run.idleWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(max(config.agentIdleMinutes, 1)) * 60, execute: work)
        // A finished row stays two minutes, or as long as he has it open to read.
        DispatchQueue.main.asyncAfter(deadline: .now() + 120) { [weak self] in
            guard let self, self.runs[agent.slug]?.session.turnInFlight != true, self.hud.model.expanded != agent.slug else { return }
            if self.hud.model.agents.first(where: { $0.id == agent.slug })?.state == .done { self.hud.removeAgent(id: agent.slug) }
        }
    }

    // MARK: Consent

    private func permission(_ request: PermissionRequest, run: Run, completion: @escaping (Bool, String?) -> Void) {
        let policy = consentPolicy(for: run.agent)
        switch policy.decide(request.toolRequest) {
        case .allow:
            completion(true, nil)
        case .deny(let reason):
            appendTranscript(run.agent, role: "denied", text: "\(request.toolName): \(reason)")
            completion(false, "Dot refused: \(reason)")
        case .ask(let reason):
            if let jev, request.toolName == "Bash", let command = request.toolRequest.string("command"), !ConsentPolicy.isAlwaysAsk(command) {
                // Unrecognised, not on the always-ask list: let Jev judge whether it is plainly harmless.
                let state: [String: Any] = [
                    "command": String(command.prefix(1500)), "description": request.description ?? "",
                    "agent_folder": run.agent.folder.path, "task": Log.short(run.lastBrief, 200),
                ]
                jev.evaluate("consent", state: state, questions: [
                    "risky": .yesNo(instructions: "Would running this shell command send a message or mail, submit or post something, pay for something, delete or overwrite the user's own files outside the agent's folder, or install or change something system-wide? Reading, computing, writing files under the user's home, opening apps and pages, and driving an app to look at it are not risky.", yes: "yes, it goes outward or cannot be undone", no: "no, it stays on this Mac and can be undone"),
                ]) { [weak self] answers in
                    guard let self else { completion(false, "Dot is gone."); return }
                    if let p = answers?["risky"]?.probability, p <= 0.4 {
                        Log.info("consent: jev cleared `\(Log.short(command, 80))` (risk \(String(format: "%.2f", p)))")
                        self.appendTranscript(run.agent, role: "cleared", text: "\(request.toolName): \(reason)")
                        completion(true, nil)
                    } else {
                        self.askCard(request, run: run, reason: reason, completion: completion)
                    }
                }
                return
            }
            askCard(request, run: run, reason: reason, completion: completion)
        }
    }

    private func askCard(_ request: PermissionRequest, run: Run, reason: String, completion: @escaping (Bool, String?) -> Void) {
        do {
            let title = Self.consentTitle(request)
            hud.upsertAgent(AgentRow(id: run.agent.slug, name: run.agent.name, line: "waiting for you: \(reason)", state: .waiting))
            let card = ConsentCard(agent: run.agent.name, title: title, detail: reason, onAllow: { [weak self] in
                self?.hud.dismissConsent()
                self?.hud.upsertAgent(AgentRow(id: run.agent.slug, name: run.agent.name, line: reason, state: .running))
                self?.appendTranscript(run.agent, role: "allowed", text: "\(request.toolName): \(reason)")
                completion(true, nil)
            }, onDeny: { [weak self] in
                self?.hud.dismissConsent()
                self?.hud.upsertAgent(AgentRow(id: run.agent.slug, name: run.agent.name, line: run.lastLine, state: .running))
                self?.appendTranscript(run.agent, role: "declined", text: "\(request.toolName): \(reason)")
                completion(false, "The user said not now. Do the rest of the task without this step and say what you skipped.")
            })
            hud.present(card)
            if config.speakAgentResults {
                speaker.speak("\(run.agent.name) wants to \(title).")
            }
        }
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
        return ConsentPolicy(allowTools: allow, allowToolPrefixes: prefixes, denyTools: Set(config.denyTools), writableRoots: writable, protectedRoots: protected)
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

    func hasTurnInFlight(_ agent: Agent) -> Bool { runs[agent.slug]?.session.turnInFlight ?? false }

    /// Archive: the folder moves under `.archive/` with the date; the roster no longer lists it.
    func archive(_ agent: Agent) {
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

    func stopAll() {
        for run in runs.values { run.session.stop() }
        runs = [:]
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
