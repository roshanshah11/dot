import AppKit
import DotKit
import Foundation

/// Dot does the work itself (the fast lane, 2026-10-20). Every action he asks for that takes more than one small step
/// is a job: its own Claude Code session (Sonnet by default) acting through Dot's hands (the `dot` MCP server), all of
/// Atlas's reads and his own safe writes, his skills, and no step or time limit. A front job works in his own tab or app
/// while he watches; a behind job gets a Comet window of its own behind his app. His click or key in the job's tab pauses
/// it, and "go on" picks it up. Talk stays free while jobs run. An agent starts only when he says agent.
@MainActor
final class JobManager {
    final class Job {
        let id: String
        var goal: String
        let hisWords: String
        var placement: JobPlacement
        let model: String
        var session: ClaudeSession?
        let page: PageDriver
        let hands: Hands
        /// A front job in a native app (or Safari): its bundle; nil for a Comet job.
        var appBundle: String?
        var appName: String?
        var phase: JobPhase = .starting
        let startedAt = Date()
        let askedAt: Date?
        var steps: [String] = []
        var lastLine = ""
        /// A control he must press, kept for "show me".
        var rung: (label: String, point: CGPoint?)?
        let bench: Bool
        let folder: URL
        let stamp: String
        var firstActLogged = false
        var cost: Double = 0
        var endedAt: Date?
        var endLine = ""
        var nativeRefs: [String: String] = [:]
        /// The last page whose text went through the injection check.
        var checkedURL = ""
        var lastEventAt = Date()
        var pendingDone: DispatchWorkItem?
        var repeatNudged = false
        /// Proposals already shown as cards.
        var cardsShown: Set<String> = []

        init(id: String, goal: String, hisWords: String, placement: JobPlacement, model: String, page: PageDriver, hands: Hands,
             askedAt: Date?, bench: Bool, folder: URL, stamp: String) {
            self.id = id; self.goal = goal; self.hisWords = hisWords; self.placement = placement; self.model = model
            self.page = page; self.hands = hands; self.askedAt = askedAt; self.bench = bench; self.folder = folder; self.stamp = stamp
        }

        var isBrowserJob: Bool { appBundle == nil }
        var bundle: String { appBundle ?? Hands.cometBundle }
    }

    private let config: DotConfig
    /// nil in the headless bench harness (`Dot --job-run`).
    private let overlay: OverlayManager?
    private let speaker: TTSProvider?
    private let ledger: Ledger?
    var socketPath: String?
    private(set) var jobs: [Job] = []
    private var queue: [(goal: String, placement: JobPlacement, context: ScreenContext, askedAt: Date?, bench: Bool)] = []
    private struct Spare { let id: String; let stamp: String; let session: ClaudeSession; let folder: URL; let spawnedAt: Date; let bench: Bool; let model: String }
    private var spare: Spare?
    private var benchSpare: Spare?
    /// nil: not checked yet; the sandbox must refuse a write outside the job folder before a job gets Bash.
    private(set) var sandboxVerified: Bool?
    private var sandboxChecking = false
    private var inputDebounce: DispatchWorkItem?
    /// Talk's state, for when a job's end line may be spoken.
    var talkIsIdle: () -> Bool = { true }
    /// Ring a control he must press (front) or show a line in the bubble.
    var onChange: (() -> Void)?
    /// A Routine: line at the end of a job (07's backstop): name, when, task.
    var onRoutine: ((String, String, String) -> Void)?
    /// Shows a consent card (the stack once 04 lands; the notch's consent path until then).
    var presentCard: ((ConsentCard) -> Void)?
    /// Jev's injection check on page text (the agents' PostToolUse check isn't in a job's path).
    var jev: Jev?

    init(config: DotConfig, overlay: OverlayManager?, speaker: TTSProvider?, ledger: Ledger?) {
        self.config = config
        self.overlay = overlay
        self.speaker = speaker
        self.ledger = ledger
    }

    static var root: URL { URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Dot/jobs", isDirectory: true) }

    var running: [Job] { jobs.filter { $0.phase.isLive } }
    var pausedJob: Job? { jobs.last { $0.phase == .paused } }
    var frontJob: Job? { running.last { $0.placement == .front } }
    var newest: Job? { running.last }

    func job(_ id: String) -> Job? { jobs.first { $0.id == id } }

    /// A behind job running, or one that finished in the last `within` seconds ("show me").
    func newestBehind(within: TimeInterval = 600) -> Job? {
        jobs.last { $0.placement == .behind && ($0.phase.isLive || ($0.endedAt.map { Date().timeIntervalSince($0) < within } ?? false)) }
    }

    // MARK: The warm spare

    func warm() {
        guard config.jobsEnabled else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            guard let self else { return }
            self.verifySandbox { [weak self] in
                guard let self, self.config.jobSpare else { return }
                self.spawnSpare(bench: false)
            }
        }
        Timer.scheduledTimer(withTimeInterval: 600, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.recycleSpare() }
        }
    }

    private func recycleSpare() {
        guard let s = spare, Date().timeIntervalSince(s.spawnedAt) > 3 * 3600 else { return }
        Log.info("job: spare recycled after 3 h idle")
        s.session.stop()
        spare = nil
        spawnSpare(bench: false)
    }

    private func spawnSpare(bench: Bool) {
        let started = Date()
        Log.info("job: spare warming\(bench ? " (bench)" : "")")
        guard let made = makeSession(model: config.jobModel, bench: bench, benchPort: nil) else { return }
        let s = Spare(id: made.id, stamp: made.stamp, session: made.session, folder: made.folder, spawnedAt: started, bench: bench, model: config.jobModel)
        if bench { benchSpare = s } else { spare = s }
        Log.info("job: spare ready in \(Int(Date().timeIntervalSince(started) * 1000)) ms\(bench ? " (bench)" : "")")
    }

    private static func newId() -> String {
        let alphabet = Array("abcdefghjkmnpqrstuvwxyz23456789")
        return String((0..<6).map { _ in alphabet.randomElement()! })
    }

    private static func stampNow() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyyMMddHHmm"; f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: Date())
    }

    // MARK: Sessions

    private func makeSession(model: String, bench: Bool, benchPort: Int?) -> (id: String, stamp: String, session: ClaudeSession, folder: URL)? {
        let id = Self.newId()
        let stamp = Self.stampNow()
        let folder = bench ? URL(fileURLWithPath: "/tmp/dot-bench/jobs/\(id)", isDirectory: true) : Self.root.appendingPathComponent(id, isDirectory: true)
        try? FileManager.default.createDirectory(at: folder.appendingPathComponent("output"), withIntermediateDirectories: true)
        var options = ClaudeSession.Options(cwd: folder, model: model)
        options.appendSystemPrompt = Prompts.job + Prompts.courseIndex(in: config.talkRootURL)
        options.tools = nil
        var disallowed = ["Task", "Agent", "NotebookEdit", "AskUserQuestion", "EnterPlanMode", "ExitPlanMode", "Bash(security *)"] + AgentManager.disallowedAgentTools
        let bashOn = !bench && sandboxVerified == true
        if !bashOn { disallowed.append("Bash") }
        options.disallowedTools = disallowed
        let reads = DotConfig.talkAtlasTools.filter { !DotConfig.talkWriteTools.contains($0) }.map { "mcp__atlas__\($0)" }
            .filter { !Talk.guestTools.contains($0) }
        options.allowedTools = ["mcp__dot", "WebSearch", "WebFetch", "Skill", "Glob", "Grep", "TodoWrite"] + reads
        options.maxTurns = nil
        options.permissionMode = "default"
        options.permissionPromptOverStdio = true
        options.settingSources = "user"
        options.strictMCP = true
        options.effort = config.jobEffort
        options.environment["MAX_THINKING_TOKENS"] = "0"
        options.environment["CLAUDE_CODE_DISABLE_BACKGROUND_TASKS"] = "1"
        options.environment["CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR"] = "1"
        if let socketPath { options.environment["DOT_CONTROL_SOCKET"] = socketPath }
        if bashOn {
            let sandbox: [String: Any] = ["sandbox": [
                "enabled": true, "failIfUnavailable": true, "allowUnsandboxedCommands": false, "autoAllowBashIfSandboxed": false,
                "network": ["allowedDomains": [String](), "allowUnixSockets": [String](), "allowLocalBinding": false],
                "filesystem": ["allowWrite": [folder.path, "/tmp", "/private/tmp"]],
            ]]
            if let data = try? JSONSerialization.data(withJSONObject: sandbox), let text = String(data: data, encoding: .utf8) { options.settings = text }
        }
        // The MCP config: dot, atlas (reads), atlas-send (queues only).
        let agentMCP = config.agentMCPConfig.flatMap { try? Data(contentsOf: URL(fileURLWithPath: ($0 as NSString).expandingTildeInPath)) } ?? Data("{}".utf8)
        let socket = socketPath ?? ControlServer.path(dotHome: config.dotHome)
        let exe = Bundle.main.executablePath ?? CommandLine.arguments[0]
        if let data = JobConfigFile.make(agentMCP: agentMCP, dotExecutable: exe, jobId: id, socket: socket, bench: bench, stamp: stamp) {
            let dir = (bench ? URL(fileURLWithPath: "/tmp/dot-bench/jobs/.mcp") : Self.root.appendingPathComponent(".mcp"))
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let file = dir.appendingPathComponent("\(id).json")
            try? data.write(to: file)
            options.mcpConfigPath = file.path
        }
        let session = ClaudeSession(label: "job:\(id)", claudePath: config.claudeExecutable, options: options)
        session.onEvent = { [weak self, weak session] event in
            guard let self, let session else { return }
            self.handle(event, sessionOf: session)
        }
        session.onExit = { [weak self] code in
            Task { @MainActor in self?.sessionExited(id: id, code: code) }
        }
        session.permissionHandler = { [weak self] request, completion in
            guard let self else { completion(false, "dot is gone"); return }
            self.gate(request, jobId: id, bench: bench, folder: folder, completion: completion)
        }
        do {
            try session.start()
        } catch {
            Log.error("job: session failed to start: \(error)")
            return nil
        }
        Log.info("job[\(id)] bash \(bashOn ? "sandbox on" : (bench ? "off (bench)" : "off (sandbox not verified)"))")
        return (id, stamp, session, folder)
    }

    /// Once per launch: a cheap haiku turn runs a write outside its folder under the same sandbox settings; Bash goes to
    /// jobs only when that write was refused and one inside the folder went through.
    private func verifySandbox(then done: @escaping () -> Void) {
        if sandboxVerified != nil || sandboxChecking { done(); return }
        sandboxChecking = true
        let started = Date()
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("dot-sandbox-\(ProcessInfo.processInfo.processIdentifier)", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let outside = (NSHomeDirectory() as NSString).appendingPathComponent(".dot-sandbox-probe")
        let inside = dir.appendingPathComponent("inside.txt").path
        try? FileManager.default.removeItem(atPath: outside)
        let sandbox = #"{"sandbox":{"enabled":true,"failIfUnavailable":true,"allowUnsandboxedCommands":false,"autoAllowBashIfSandboxed":false,"network":{"allowedDomains":[],"allowUnixSockets":[],"allowLocalBinding":false},"filesystem":{"allowWrite":["\#(dir.path)","/tmp","/private/tmp"]}}}"#
        let command = "python3 -c \"open('\(outside)','w').write('x')\"; python3 -c \"open('\(inside)','w').write('y')\""
        let claude = config.claudeExecutable
        Task.detached {
            let p = Process()
            p.executableURL = claude
            p.currentDirectoryURL = dir
            p.arguments = ["-p", "--model", "haiku", "--setting-sources", "", "--settings", sandbox, "--tools", "Bash", "--allowedTools", "Bash",
                           "--permission-mode", "default", "--strict-mcp-config", "--mcp-config", "{\"mcpServers\":{}}", "--output-format", "json",
                           "--no-session-persistence", "Run exactly this bash command once, then reply with one word, done: \(command)"]
            p.environment = ClaudeSession.environment()
            p.standardOutput = FileHandle.nullDevice
            p.standardError = FileHandle.nullDevice
            var ok = false
            do {
                try p.run()
                let deadline = Date().addingTimeInterval(90)
                while p.isRunning, Date() < deadline { try? await Task.sleep(nanoseconds: 200_000_000) }
                if p.isRunning { p.terminate() }
                let fm = FileManager.default
                ok = !fm.fileExists(atPath: outside) && fm.fileExists(atPath: inside)
                if fm.fileExists(atPath: outside) { try? fm.removeItem(atPath: outside) }
            } catch {}
            let verified = ok
            await MainActor.run {
                self.sandboxVerified = verified
                self.sandboxChecking = false
                Log.info(verified ? "job: bash sandbox verified in \(Int(Date().timeIntervalSince(started) * 1000)) ms"
                                  : "job: bash off (sandbox not enforced or the check didn't run)")
                done()
            }
        }
    }

    // MARK: Starting

    /// Start a job. Returns the line Dot says (it says it itself, so nothing waits on the model), or nil when it couldn't.
    @discardableResult
    func start(goal: String, placement asked: JobPlacement, context: ScreenContext, askedAt: Date?, bench: Bool, benchPort: Int? = nil,
               hisWords: String? = nil, announce: Bool = true) -> String? {
        let words = hisWords ?? goal
        if running.count >= config.jobsMax {
            queue.append((goal, asked, context, askedAt, bench))
            Log.info("job: queued (\(running.count) running): \(Log.short(goal, 80))")
            return "\(running.count) jobs are running; i'll start this when one ends."
        }
        var placement = asked
        var line = placement == .front ? "on it." : "on it, behind your window."
        if placement == .front, let other = frontJob {
            placement = .behind
            line = "the other one's still going in front, so this one's behind."
            Log.info("job: a second front ask while job[\(other.id)] runs; this one runs behind")
        }
        let model = JobModel.decide(text: words, floor: config.jobModel, proseModel: config.jobProseModel)
        var warm = false
        var made: (id: String, stamp: String, session: ClaudeSession, folder: URL)?
        if !bench, let s = spare, s.model == model, s.session.isRunning {
            made = (s.id, s.stamp, s.session, s.folder); spare = nil; warm = true
        } else if bench, let s = benchSpare, s.model == model, s.session.isRunning {
            made = (s.id, s.stamp, s.session, s.folder); benchSpare = nil; warm = true
        } else {
            if model != config.jobModel { Log.info("job: \(model) job starts cold") }
            made = makeSession(model: model, bench: bench, benchPort: benchPort)
        }
        guard let made else { return nil }
        let port = bench ? (benchPort ?? 9471) : config.cometDebugPort
        let page = PageDriver(port: port, bench: bench)
        let hands = Hands(cometPort: config.cometDebugPort)
        if bench { hands.bench = Hands.Bench(cometPort: port) }
        let job = Job(id: made.id, goal: goal, hisWords: words, placement: placement, model: model, page: page, hands: hands,
                      askedAt: askedAt, bench: bench, folder: made.folder, stamp: made.stamp)
        job.session = made.session
        page.log = { line in Log.info("job[\(job.id)] \(line)") }
        let comet = context.bundleIdentifier == Hands.cometBundle
        if placement == .front, !comet, let b = context.bundleIdentifier, b != Bundle.main.bundleIdentifier {
            job.appBundle = b
            job.appName = context.appName
        }
        jobs.append(job)
        job.phase = job.phase.next(.started) ?? .running
        var first = "[job] id \(job.id), placement \(placement.rawValue), output folder \(job.folder.appendingPathComponent("output").path), now: \(Talk.nowLine())"
        if placement == .front {
            first += "\nin front: app \(context.appName ?? "?"), window \"\(Log.short(context.windowTitle ?? "", 100))\"\(context.url.map { ", url \($0)" } ?? "")"
            if comet { first += " (dot is bound to this tab)" }
        }
        first += "\nhe said: \"\(words)\""
        if goal != words { first += "\nwhat talk saw that matters: \(goal)" }
        Log.info("job[\(job.id)] started placement=\(placement.rawValue) warm=\(warm ? 1 : 0) model=\(model) goal=\(Log.short(goal, 120))")
        if placement == .front, comet {
            // Pin his tab now, while the model writes its first step.
            Task { @MainActor in
                if await page.bindFront(windowTitle: context.windowTitle, url: context.url) {
                    Log.info("job[\(job.id)] bound to his tab")
                } else {
                    Log.info("job[\(job.id)] couldn't pin his tab; its first open makes one")
                }
            }
        }
        made.session.send(text: first)
        if config.jobSpare, !bench, spare == nil, warm || model == config.jobModel {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
                guard let self, self.spare == nil else { return }
                self.spawnSpare(bench: false)
            }
        }
        if bench, config.jobSpare, benchSpare == nil {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
                guard let self, self.benchSpare == nil else { return }
                self.spawnSpare(bench: true)
            }
        }
        onChange?()
        if announce || placement != asked { say(line, job: job, start: true) } else { Log.info("job[\(job.id)] said: (talk said the start line)") }
        return line
    }

    // MARK: Events

    private func handle(_ event: StreamEvent, sessionOf session: ClaudeSession) {
        guard let job = jobs.first(where: { $0.session === session }) else {
            if case .systemInit(_, _, let mode) = event, let mode, mode != "default" {
                Log.warn("job: session refused (permission mode \(mode))")
                session.stop()
                if spare?.session === session { spare = nil }
                if benchSpare?.session === session { benchSpare = nil }
            }
            return
        }
        job.lastEventAt = Date()
        switch event {
        case .systemInit(_, _, let mode):
            if let mode, mode != "default" {
                Log.warn("job: session refused (permission mode \(mode))")
                finish(job, failed: true, line: "blocked: the job session came up without dot's permission check", stopReason: nil)
            }
        case .toolUse(_, let name, let input):
            job.steps.append(Self.stepLine(name, input))
            Log.info("job[\(job.id)] step \(job.steps.count) \(name) \(Log.short(ConsentPolicy.flatten(input), 80))")
            NotificationCenter.default.post(name: .dotAgentActivity, object: nil,
                                            userInfo: AgentActivityReport(activity: AgentActivity.of(tool: name), agent: "job-\(job.id)").userInfo)
            if job.steps.count % 10 == 0 { Log.info("job[\(job.id)] cost $\(String(format: "%.4f", job.cost)) at step \(job.steps.count)") }
            if !job.repeatNudged, JobRepeat.isStuck(lastSteps: Array(job.steps.suffix(JobRepeat.limit))) {
                job.repeatNudged = true
                job.session?.send(text: "[dot] you are repeating the same step; try another way or end with blocked:")
                Log.info("job[\(job.id)] nudged (the same step \(JobRepeat.limit) times)")
            } else if job.steps.count >= 2, job.steps.suffix(2).allSatisfy({ $0 != job.steps.last }) {
                job.repeatNudged = false
            }
            onChange?()
        case .assistantText(let text):
            let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if !t.isEmpty { job.lastLine = t }
        case .toolResult(let content, _):
            if content.localizedCaseInsensitiveContains("queued for his approval") || content.localizedCaseInsensitiveContains("queued for approval") {
                showProposals(job)
            }
        case .result(let info):
            job.cost += info.costUSD
            if job.phase == .paused {
                Log.info("job[\(job.id)] turn ended (paused)")
                return
            }
            if job.phase.isTerminal { return }
            if let session = job.session, session.pendingResults > 0 {
                // A follow-up is folded in or queued: done only if nothing streams for 5 s.
                job.pendingDone?.cancel()
                let work = DispatchWorkItem { [weak self, weak job] in
                    guard let self, let job, job.phase.isLive, Date().timeIntervalSince(job.lastEventAt) >= 5 else { return }
                    self.complete(job, info)
                }
                job.pendingDone = work
                DispatchQueue.main.asyncAfter(deadline: .now() + 5.2, execute: work)
                return
            }
            complete(job, info)
        default:
            break
        }
    }

    static func stepLine(_ name: String, _ input: [String: AnyCodableValue]) -> String {
        let short = name.replacingOccurrences(of: "mcp__dot__", with: "").replacingOccurrences(of: "mcp__atlas__", with: "atlas ")
        let keys = ["ref", "label", "target", "to", "keys", "text", "query", "url", "command", "file_path"]
        let parts = keys.compactMap { k -> String? in if case .string(let s)? = input[k] { return "\(k)=\(Log.short(s, 40))" }; return nil }
        return ([short] + parts).joined(separator: " ")
    }

    private func complete(_ job: Job, _ info: ResultInfo) {
        let text = (info.resultText ?? job.lastLine).trimmingCharacters(in: .whitespacesAndNewlines)
        let blocked = text.lowercased().hasPrefix("blocked:") || text.lowercased().contains("\nblocked:")
        let failed = info.isError || blocked
        // Files for his folders: "saved: <output path> -> <folder>".
        var copied: [String] = []
        for line in text.components(separatedBy: .newlines) {
            if let (from, to) = Self.savedLine(line), let path = copyOut(job, from: from, to: to) { copied.append(path) }
            if line.hasPrefix("Routine:"), let command = RoutineCommand.parse(json: String(line.dropFirst("Routine:".count)).trimmingCharacters(in: .whitespaces)),
               command.action == .create, let when = command.when, let task = command.task {
                if job.bench { Log.info("bench: would add routine \(command.title) \(when) watch") } else { onRoutine?(command.title, when, task) }
            }
        }
        let spoken = text.components(separatedBy: .newlines).first { line in
            let l = line.trimmingCharacters(in: .whitespaces)
            return !l.isEmpty && !l.hasPrefix("saved:") && !l.hasPrefix("Routine:")
        } ?? ""
        var line = AgentManager.spokenSummary(AgentManager.firstSentence(of: spoken))
        if !copied.isEmpty, !line.lowercased().contains("desktop"), !line.lowercased().contains("download") {
            line += line.isEmpty ? "" : " "
            line += "it's at \(copied.map { ConsentPolicy.shortPath($0) }.joined(separator: ", "))."
        }
        if line.isEmpty { line = failed ? "that didn't work." : "done." }
        // A text he wants written for him, on a model that isn't the prose one: the same goal again on Opus (05).
        if blocked, text.lowercased().contains("needs writing"), job.model != config.jobProseModel, !job.bench {
            Log.info("job[\(job.id)] needs writing; restarting it on \(config.jobProseModel)")
            finish(job, failed: true, line: "", stopReason: "needs writing")
            restartOnProse(job)
            return
        }
        if info.isError { Log.warn("job[\(job.id)] error result: \(Log.short(info.resultText ?? info.subtype, 200))") }
        finish(job, failed: failed, line: line, stopReason: nil, result: info)
    }

    static func savedLine(_ line: String) -> (String, String)? {
        let l = line.trimmingCharacters(in: .whitespaces)
        guard l.lowercased().hasPrefix("saved:"), let arrow = l.range(of: "->") else { return nil }
        let from = l[l.index(l.startIndex, offsetBy: 6)..<arrow.lowerBound].trimmingCharacters(in: .whitespaces)
        let to = l[arrow.upperBound...].trimmingCharacters(in: CharacterSet.whitespaces.union(CharacterSet(charactersIn: ".")))
        return from.isEmpty || to.isEmpty ? nil : (from, to)
    }

    /// Copy a job's file to his desktop, documents or downloads under a name that is free: never over his files.
    private func copyOut(_ job: Job, from: String, to: String) -> String? {
        let home = NSHomeDirectory()
        let src = from.hasPrefix("/") ? from : job.folder.appendingPathComponent(from).path
        let canonical = (src as NSString).standardizingPath
        guard canonical.hasPrefix(job.folder.path + "/"), FileManager.default.fileExists(atPath: canonical) else {
            Log.warn("job[\(job.id)] saved line names a file outside its folder: \(from)")
            return nil
        }
        let dest: String
        switch to.lowercased() {
        case "desktop", "~/desktop": dest = home + "/Desktop"
        case "downloads", "~/downloads": dest = job.bench ? "/tmp/dot-bench/downloads" : home + "/Downloads"
        case "documents", "~/documents": dest = home + "/Documents"
        default:
            let expanded = (to as NSString).expandingTildeInPath
            guard expanded.hasPrefix(home + "/Documents/") || expanded.hasPrefix(home + "/Desktop") || expanded.hasPrefix(home + "/Downloads") else {
                Log.warn("job[\(job.id)] saved line names a folder dot doesn't copy to: \(to)"); return nil
            }
            dest = expanded
        }
        if job.bench, !dest.hasPrefix("/tmp/dot-bench") { Log.info("bench: would copy \(from) to \(to)"); return nil }
        try? FileManager.default.createDirectory(atPath: dest, withIntermediateDirectories: true)
        let target = DownloadWatch.uniquePath(in: dest, name: (canonical as NSString).lastPathComponent)
        do {
            try FileManager.default.copyItem(atPath: canonical, toPath: target)
            Log.info("job[\(job.id)] copied \(ConsentPolicy.shortPath(canonical)) -> \(ConsentPolicy.shortPath(target))")
            return target
        } catch {
            Log.warn("job[\(job.id)] copy failed: \(error.localizedDescription)")
            return nil
        }
    }

    private func finish(_ job: Job, failed: Bool, line: String, stopReason: String?, result: ResultInfo? = nil) {
        guard job.phase.isLive else { return }
        job.phase = stopReason != nil ? .stopped : (failed ? .failed : .done)
        job.endedAt = Date()
        job.endLine = line
        job.pendingDone?.cancel()
        let ms = Int(Date().timeIntervalSince(job.startedAt) * 1000)
        if let stopReason {
            Log.info("job[\(job.id)] stopped (\(stopReason)) after \(ms) ms, $\(String(format: "%.4f", job.cost))")
            Log.info("act: go \(Log.short(job.goal, 80)) fail stopped (\(stopReason))")
        } else if failed {
            Log.info("job[\(job.id)] failed in \(ms) ms ($\(String(format: "%.4f", job.cost))): \(Log.short(line, 160))")
            Log.info("act: go \(Log.short(job.goal, 80)) fail \(Log.short(line, 100))")
        } else {
            Log.info("job[\(job.id)] done in \(ms) ms, \(job.steps.count) steps, $\(String(format: "%.4f", job.cost))")
            Log.info("act: go \(Log.short(job.goal, 80)) ok \(ms) ms")
        }
        if let result, !job.bench { ledger?.record(kind: "job", agent: nil, model: job.model, result: result, summary: Log.short(job.goal, 200)) }
        if !job.bench {
            TranscriptLog.append(kind: .job, you: job.hisWords, dot: line, app: job.appName,
                                 extra: ["model": job.model, "ms": String(ms), "steps": String(job.steps.count), "placement": job.placement.rawValue])
        }
        let keep = job.rung != nil
        let session = job.session
        Task { @MainActor in
            await job.page.finish(keepWindow: keep)
            session?.stop()
        }
        if stopReason == nil { say(line, job: job, start: false) }
        if running.isEmpty { NotificationCenter.default.post(name: .dotAgentActivity, object: nil, userInfo: AgentActivityReport(activity: nil).userInfo) }
        onChange?()
        // A queued ask starts now.
        if !queue.isEmpty, running.count < config.jobsMax {
            let next = queue.removeFirst()
            start(goal: next.goal, placement: next.placement, context: next.context, askedAt: next.askedAt, bench: next.bench)
        }
        // Keep the last 20 jobs in memory.
        if jobs.count > 20 { jobs.removeFirst(jobs.count - 20) }
    }

    private func restartOnProse(_ old: Job) {
        var context = ScreenContext()
        context.appName = old.appName
        context.bundleIdentifier = old.appBundle
        startForced(goal: old.goal, placement: old.placement, context: context, askedAt: nil, model: config.jobProseModel, words: old.hisWords)
    }

    /// A job on a given model (the prose restart), without the model rule.
    private func startForced(goal: String, placement: JobPlacement, context: ScreenContext, askedAt: Date?, model: String, words: String) {
        guard let made = makeSession(model: model, bench: false, benchPort: nil) else { return }
        let page = PageDriver(port: config.cometDebugPort, bench: false)
        let hands = Hands(cometPort: config.cometDebugPort)
        let job = Job(id: made.id, goal: goal, hisWords: words, placement: placement, model: model, page: page, hands: hands,
                      askedAt: askedAt, bench: false, folder: made.folder, stamp: made.stamp)
        job.session = made.session
        job.appBundle = context.bundleIdentifier == Hands.cometBundle ? nil : context.bundleIdentifier
        job.appName = context.appName
        page.log = { line in Log.info("job[\(job.id)] \(line)") }
        jobs.append(job)
        job.phase = .running
        let first = "[job] id \(job.id), placement \(placement.rawValue), output folder \(job.folder.appendingPathComponent("output").path), now: \(Talk.nowLine())\nhe said: \"\(words)\""
        Log.info("job[\(job.id)] started placement=\(placement.rawValue) warm=0 model=\(model) goal=\(Log.short(goal, 120))")
        made.session.send(text: first)
        onChange?()
    }

    private func sessionExited(id: String, code: Int32) {
        if let s = spare, s.id == id { spare = nil; Log.info("job: spare exited (\(code))"); return }
        if let s = benchSpare, s.id == id { benchSpare = nil; return }
        guard let job = job(id), job.phase.isLive else { return }
        finish(job, failed: true, line: "blocked: the job's session ended", stopReason: nil)
    }

    // MARK: The gate

    private func gate(_ request: PermissionRequest, jobId: String, bench: Bool, folder: URL, completion: @escaping (Bool, String?) -> Void) {
        let job = self.job(jobId)
        let home = NSHomeDirectory()
        let protected = ["\(home)/roshan/Atlas/private", "\(home)/roshan/Atlas/objects", "\(home)/roshan/Atlas/qmd-state", "\(home)/.ssh",
                         "\(home)/.claude", "\(home)/.claude-1", "\(home)/.claude-2", "\(home)/.config", "\(home)/Library/Keychains",
                         "\(home)/Library/Application Support", "\(home)/Library/Preferences", "\(home)/Projects/browser-agent/.env"]
        let context = JobGateContext(bench: bench, jobFolder: folder.path, protectedRoots: protected, queuedSends: Self.queuedSends,
                                     hisWords: job?.hisWords ?? "")
        let decision = JobGate.decide(tool: request.toolName, input: request.input, context: context)
        switch decision {
        case .allow:
            if request.toolName == "mcp__atlas__handshake_apply" {
                Log.info("job[\(jobId)] handshake_apply \(Log.short(ConsentPolicy.flatten(request.input), 80))")
            }
            completion(true, nil)
        case .deny(let why):
            Log.info("job[\(jobId)] refused \(request.toolName): \(why)")
            completion(false, why)
        }
    }

    /// The atlas-send tools proven to only queue in an `ask-` session (scripts/test_dot_atlas_approve.py, 2026-10-20).
    static let queuedSends: Set<String> = ["imessage_send", "send_email", "reply"]

    // MARK: Hands

    /// The control verb "hands": one dot tool call from a job's MCP server.
    func hands(_ request: [String: Any], _ reply: @escaping ([String: Any]) -> Void) {
        let id = request["job"] as? String ?? ""
        let tool = request["tool"] as? String ?? ""
        let args = request["args"] as? [String: Any] ?? [:]
        guard let job = job(id) else { reply(["text": "error: no job \(id) (it ended)", "isError": true]); return }
        if job.phase == .paused { reply(["text": "paused: he is using the tab; stop and wait", "isError": true]); return }
        if job.phase.isTerminal { reply(["text": "stopped: the job is over; end your turn", "isError": true]); return }
        Task { @MainActor in
            let started = Date()
            let (text, isError, image) = await self.perform(job, tool: tool, args: args)
            if !job.firstActLogged, tool != "look", let asked = job.askedAt {
                job.firstActLogged = true
                Log.info("job[\(job.id)] first action \(Int(Date().timeIntervalSince(asked) * 1000)) ms")
            }
            _ = started
            var out: [String: Any] = ["text": text, "isError": isError]
            if let image { out["image"] = image }
            reply(out)
        }
    }

    private func str(_ args: [String: Any], _ key: String) -> String? {
        (args[key] as? String).flatMap { $0.trimmingCharacters(in: .whitespaces).isEmpty ? nil : $0 }
    }

    private func perform(_ job: Job, tool: String, args: [String: Any]) async -> (String, Bool, String?) {
        let started = Date()
        if !job.isBrowserJob { return await performNative(job, tool: tool, args: args) }
        var result: PageDriver.Result
        switch tool {
        case "look":
            if !job.page.isBound, !(await bindIfNeeded(job)) { return ("(no page yet: open one first)", false, nil) }
            if job.page.asksToLeave { return ("stopped: the page is asking to leave; that's his call, so stop here and say so", true, nil) }
            let l = await job.page.look(all: args["all"] as? Bool ?? false, text: args["text"] as? Bool ?? false, shot: args["shot"] as? Bool ?? false)
            Log.info("act: look ok \(Int(Date().timeIntervalSince(started) * 1000)) ms (job \(job.id): \(l.text.count) chars)")
            return (await checked(job, l.text, force: args["text"] as? Bool ?? false), false, l.image)
        case "open":
            guard let target = str(args, "target") else { return ("error: open what?", true, nil) }
            result = await open(job, target: target, where: str(args, "where"))
        case "click":
            _ = await bindIfNeeded(job)
            result = await job.page.click(ref: str(args, "ref"), label: str(args, "label"))
        case "type":
            _ = await bindIfNeeded(job)
            result = await job.page.type(ref: str(args, "ref"), label: str(args, "label"), text: args["text"] as? String ?? "",
                                         replace: args["replace"] as? Bool ?? true, enter: args["enter"] as? Bool ?? false)
        case "select":
            _ = await bindIfNeeded(job)
            result = await job.page.select(ref: str(args, "ref") ?? "", option: str(args, "option") ?? "")
        case "key":
            _ = await bindIfNeeded(job)
            result = await job.page.key(str(args, "keys") ?? "")
        case "scroll":
            _ = await bindIfNeeded(job)
            result = await job.page.scroll(str(args, "to") ?? "down")
        case "back":
            _ = await bindIfNeeded(job)
            result = await job.page.back()
        case "wait":
            _ = await bindIfNeeded(job)
            result = await job.page.wait(for: str(args, "for"), ms: (args["ms"] as? NSNumber)?.intValue)
        case "download":
            _ = await bindIfNeeded(job)
            result = await job.page.download(ref: str(args, "ref") ?? "")
        case "upload":
            _ = await bindIfNeeded(job)
            let path = ((str(args, "path") ?? "") as NSString).expandingTildeInPath
            result = await job.page.upload(ref: str(args, "ref") ?? "", path: path, allowed: uploadAllowed(job, path))
            if result.status == .ok { Log.info("job[\(job.id)] upload \((path as NSString).lastPathComponent) -> \(await job.page.host)") }
        case "show":
            return await show(job)
        case "play":
            let kind = SpotifyPlay.Kind(rawValue: str(args, "kind") ?? "playlist") ?? .playlist
            guard let play = SpotifyPlay.make(kind, str(args, "words") ?? "") else { return ("error: play what?", true, nil) }
            let outcome = await job.hands.perform(.play(play), context: AccessibilityContext.capture(maxElements: 10))
            result = outcome.ok ? .ok(outcome.line) : .error(outcome.line.isEmpty ? outcome.detail : outcome.line)
        default:
            return ("error: no tool \(tool)", true, nil)
        }
        let ms = Int(Date().timeIntervalSince(started) * 1000)
        Log.info("act: \(tool) \(Log.short(str(args, "ref") ?? str(args, "label") ?? str(args, "target") ?? str(args, "to") ?? "", 60)) \(result.status == .ok ? "ok" : "fail") \(ms) ms (job \(job.id): \(Log.short(result.detail, 100)))")
        if let his = result.his { rang(job, label: his, point: result.point) }
        else if let p = result.point, job.placement == .front { pointAt(job, p, label: str(args, "label") ?? str(args, "ref") ?? tool) }
        var text = "\(result.status.rawValue): \(result.detail)"
        if result.his != nil { text += ". stop here and tell him it's ready for his press." }
        if job.page.asksToLeave {
            text += "\n(the page is asking to leave; that's his call, so stop here and say so)"
        } else if job.page.isBound, tool != "show" {
            let l = await job.page.look()
            text += "\n" + l.text
            text = await checked(job, text, force: false)
        }
        return (text, result.status == .error, nil)
    }

    /// Page text reaches a session with skills and files, so it goes through Jev's injection check once per page (or
    /// whenever the page's words are read): a flagged page gets the sentinel's note in front.
    private func checked(_ job: Job, _ text: String, force: Bool) async -> String {
        guard let jev else { return text }
        let url = text.split(separator: "\n").first.map(String.init) ?? ""
        guard force || url != job.checkedURL else { return text }
        job.checkedURL = url
        let note: String? = await withCheckedContinuation { continuation in
            jev.injectionCheck(toolName: "mcp__dot-browser__look", output: String(text.prefix(6000))) { continuation.resume(returning: $0) }
        }
        guard let note else { return text }
        Log.warn("job[\(job.id)] page text carries instructions; the sentinel's note goes in front")
        return note + "\n" + text
    }

    /// The first page call: a front job pins his tab if the start didn't; a behind job has no window until it opens one.
    private func bindIfNeeded(_ job: Job) async -> Bool {
        if job.page.isBound { return true }
        guard job.placement == .front else { return false }
        let context = AccessibilityContext.capture(maxElements: 5)
        guard context.bundleIdentifier == Hands.cometBundle else { return false }
        return await job.page.bindFront(windowTitle: context.windowTitle, url: context.url)
    }

    private func open(_ job: Job, target: String, where place: String?) async -> PageDriver.Result {
        var url = target
        if !(target.hasPrefix("http://") || target.hasPrefix("https://")) {
            if target.hasPrefix("spotify:") || target.hasPrefix("/") || target.hasPrefix("~") || !target.contains(".") || job.hands.resolve(target) != nil {
                if let site = job.hands.resolve(target), site.kind == "site" {
                    url = site.url.absoluteString
                } else if target.hasPrefix("spotify:") {
                    let o = await job.hands.perform(.openURL(target, newTab: false), context: AccessibilityContext.capture(maxElements: 10))
                    return o.ok ? .ok(o.detail) : .error(o.detail)
                } else if target.hasPrefix("/") || target.hasPrefix("~") {
                    let o = await job.hands.perform(.openPath(target), context: AccessibilityContext.capture(maxElements: 10))
                    return o.ok ? .ok(o.detail) : .error(o.detail)
                } else {
                    let o = await job.hands.perform(.open(target), context: AccessibilityContext.capture(maxElements: 10))
                    return o.ok ? .ok(o.detail) : .error(o.detail.isEmpty ? o.line : o.detail)
                }
            } else {
                url = "https://" + target
            }
        }
        if job.bench, !(url.hasPrefix("http://127.0.0.1:") || url.hasPrefix("http://localhost:")) { return .error("bench: url outside the fixture") }
        if job.placement == .behind {
            if !job.page.isBound {
                guard await job.page.createBehind(url: url) else { return .error(job.page.cdp.lastError.map { "couldn't open a window: \($0)" } ?? "blocked: comet's devtools port is off") }
                return .ok("opened \(URL(string: url)?.host ?? url) in your own window behind his")
            }
            return await job.page.navigate(url)
        }
        // Front: his tab when the page is on the same site or he said same; else a new tab beside it, in front of him.
        if !job.page.isBound { _ = await bindIfNeeded(job) }
        if job.page.isBound {
            let currentHost = URL(string: (await job.page.evaluate("location.href") as? String) ?? "")?.host
            if place == "same" || (place == nil && currentHost != nil && currentHost == URL(string: url)?.host) {
                return await job.page.navigate(url)
            }
        }
        if let e = await job.page.connect() { return .error(e) }
        guard let r = await job.page.cdp.send("Target.createTarget", ["url": url]), let id = r["targetId"] as? String,
              await job.page.attach(id, enable: true) else { return .error("couldn't open a tab: \(job.page.cdp.lastError ?? "?")") }
        _ = await job.page.cdp.send("Target.activateTarget", ["targetId": id])
        if !job.bench, let comet = NSRunningApplication.runningApplications(withBundleIdentifier: Hands.cometBundle).first(where: { $0.processIdentifier == PageDriver.cometPid(port: job.page.port) }) {
            comet.activate()
        }
        _ = await job.page.wait(for: nil, ms: nil)
        return .ok("opened \(URL(string: url)?.host ?? url) in a new tab")
    }

    private func uploadAllowed(_ job: Job, _ path: String) -> Bool {
        let canonical = (path as NSString).standardizingPath
        if canonical.hasPrefix(job.folder.appendingPathComponent("output").path + "/") { return true }
        if job.page.downloaded.contains(canonical) { return true }
        let name = (canonical as NSString).lastPathComponent.lowercased()
        let base = (name as NSString).deletingPathExtension
        let words = job.hisWords.lowercased()
        return name.count >= 4 && (words.contains(name) || (base.count >= 4 && words.contains(base)))
    }

    /// A front job in a native app or Safari: Hands' accessibility paths, with the window read again before every call.
    private func performNative(_ job: Job, tool: String, args: [String: Any]) async -> (String, Bool, String?) {
        func capture() -> ScreenContext? {
            let c = AccessibilityContext.capture(maxElements: config.maxAccessibilityElements)
            return c.bundleIdentifier == job.appBundle ? c : nil
        }
        func lookText(_ c: ScreenContext) -> String {
            var lines = ["app: \(c.appName ?? "?"), window \"\(Log.short(c.windowTitle ?? "", 100))\"\(c.url.map { " \($0)" } ?? "")"]
            job.nativeRefs = [:]
            var n = 0
            for e in c.elements where !e.title.isEmpty {
                n += 1
                if n > 60 { lines.append("...more"); break }
                job.nativeRefs["e\(n)"] = e.title
                var line = "e\(n) \(e.role.replacingOccurrences(of: "AX", with: "").lowercased()) \"\(Log.short(e.title, 80))\""
                if CommitGuard.isCommit(e.title) { line += " [his]" }
                lines.append(line)
            }
            return lines.joined(separator: "\n")
        }
        if tool == "look" {
            guard let c = capture() else { return ("paused: \(job.appName ?? "the app") isn't in front; he moved away. end your turn and wait", true, nil) }
            return (lookText(c), false, nil)
        }
        if tool == "show" {
            if let b = job.appBundle, let app = NSRunningApplication.runningApplications(withBundleIdentifier: b).first { app.activate() }
            return ("ok: it's in front", false, nil)
        }
        guard let c = capture() else { return ("error: \(job.appName ?? "the app") isn't in front now, so dot didn't act", true, nil) }
        let label = str(args, "ref").flatMap { job.nativeRefs[$0] } ?? str(args, "label")
        let command: ActionCommand
        switch tool {
        case "open": command = ActionTags.openCommand(str(args, "target") ?? "") ?? .open(str(args, "target") ?? "")
        case "click":
            guard let label else { return ("error: click what?", true, nil) }
            command = .click(label: label)
        case "type": command = .insert(label: label, text: args["text"] as? String ?? "")
        case "key": command = .key(str(args, "keys") ?? "")
        case "scroll":
            let to = (str(args, "to") ?? "down").lowercased()
            command = .scroll(to == "up" ? .up : to == "top" ? .top : to == "bottom" ? .bottom : to == "down" ? .down : .toText(str(args, "to") ?? ""))
        case "back": command = .browser(.back)
        case "wait":
            try? await Task.sleep(nanoseconds: UInt64(min(10_000, (args["ms"] as? NSNumber)?.intValue ?? 1000)) * 1_000_000)
            return ("ok: waited\n" + (capture().map(lookText) ?? ""), false, nil)
        default:
            return ("error: \(tool) works in comet only", true, nil)
        }
        let started = Date()
        let outcome = await job.hands.perform(command, context: c)
        Log.info("act: \(command.verb) \(Log.short(command.object, 60)) \(outcome.ok ? "ok" : "fail") \(Int(Date().timeIntervalSince(started) * 1000)) ms (job \(job.id): \(outcome.detail))")
        if let his = outcome.commitLabel { rang(job, label: his, point: outcome.point) }
        else if let p = outcome.point { pointAt(job, p, label: label ?? tool) }
        try? await Task.sleep(nanoseconds: 300_000_000)
        var text = outcome.commitLabel != nil ? "stopped: his to press: \(outcome.commitLabel!). stop here and tell him it's ready for his press."
            : "\(outcome.ok ? "ok" : "error"): \(outcome.ok ? (outcome.line.isEmpty ? outcome.detail : outcome.line) : (outcome.line.isEmpty ? outcome.detail : outcome.line))"
        if let after = capture() { text += "\n" + lookText(after) }
        return (text, !outcome.ok && outcome.commitLabel == nil, nil)
    }

    private func pointAt(_ job: Job, _ point: CGPoint, label: String) {
        let primary = NSScreen.screens.first?.frame.height ?? 0
        Log.info("job[\(job.id)] point(x: \(Int(point.x)), y: \(Int(primary - point.y))) \(Log.short(label, 40))")
        if !job.bench || job.placement == .front { overlay?.point(at: point, label: Log.short(label, 24)) }
    }

    private func rang(_ job: Job, label: String, point: CGPoint?) {
        job.rung = (label, point)
        let primary = NSScreen.screens.first?.frame.height ?? 0
        let where_ = point.map { "target(x: \(Int($0.x)), y: \(Int(primary - $0.y)))" } ?? "target(none)"
        Log.info("job[\(job.id)] rang \(where_) \(Log.short(label, 40))")
        if job.placement == .front, let point {
            overlay?.target(at: point, radius: 24, label: label, hover: false)
            say("that one's yours to press: \(label.lowercased()).", job: job, start: false)
        }
        onChange?()
    }

    // MARK: Queued sends become his cards (02 E)

    private func approveScript() -> String? {
        DotConfig.bundledScript("dot-atlas-approve.py", fallback: "~/Projects/dot-fast/scripts/dot-atlas-approve.py")
    }

    /// Runs the approve script off the main thread and hands back its JSON.
    private func runApprove(_ args: [String], done: @escaping (Int32, Any?) -> Void) {
        guard let script = approveScript() else { Log.warn("proposal: no dot-atlas-approve.py"); done(-1, nil); return }
        let python = config.atlasPython
        let root = DotConfig.expand(config.atlasRoot), harness = DotConfig.expand(config.atlasHarness)
        DispatchQueue.global(qos: .userInitiated).async {
            let p = Process()
            p.executableURL = URL(fileURLWithPath: python)
            p.arguments = [script] + args + ["--root", root, "--harness", harness]
            let out = Pipe()
            p.standardOutput = out
            p.standardError = FileHandle.nullDevice
            var code: Int32 = -1
            var json: Any?
            do {
                try p.run()
                let data = out.fileHandleForReading.readDataToEndOfFile()
                p.waitUntilExit()
                code = p.terminationStatus
                let last = String(data: data, encoding: .utf8)?.split(separator: "\n").last.map(String.init) ?? ""
                json = try? JSONSerialization.jsonObject(with: Data(last.utf8))
            } catch {}
            DispatchQueue.main.async { done(code, json) }
        }
    }

    private func showProposals(_ job: Job) {
        let session = JobConfigFile.sendSession(jobId: job.id, stamp: job.stamp)
        runApprove(["list", "--session", session]) { [weak self, weak job] code, json in
            guard let self, let job else { return }
            guard code == 0, let list = json as? [[String: Any]] else { Log.warn("proposal: list failed (\(code))"); return }
            for entry in list {
                guard let card = ProposalCard(json: entry), !job.cardsShown.contains(card.proposal) else { continue }
                job.cardsShown.insert(card.proposal)
                self.present(card, job: job, session: session)
            }
        }
    }

    private func present(_ card: ProposalCard, job: Job, session: String) {
        let pid8 = String(card.proposal.prefix(8))
        var answered = false
        let consent = ConsentCard(agentId: "job-\(job.id)", agent: "dot", title: card.title, detail: card.detail, guarded: card.guarded, onAllow: { [weak self, weak job] in
            guard let self, !answered else { return }
            answered = true
            self.runApprove(["approve", "--session", session, "--proposal", card.proposal, "--digest", card.digest]) { code, json in
                let status = ((json as? [String: Any])?["status"] as? String) ?? ((json as? [String: Any])?["error"] as? String) ?? "error \(code)"
                Log.info("proposal: card \(pid8) \(card.operation) allowed \(status)")
                let sent = code == 0 && status == "succeeded"
                job?.session?.send(text: sent ? "[dot] he said yes; sent (\(card.title))." : "[dot] he said yes but it didn't go: \(status). say so in one line.")
            }
        }, onDeny: { [weak self, weak job] in
            guard let self, !answered else { return }
            answered = true
            self.runApprove(["deny", "--session", session, "--proposal", card.proposal, "--digest", card.digest]) { code, json in
                let status = ((json as? [String: Any])?["status"] as? String) ?? "error \(code)"
                Log.info("proposal: card \(pid8) \(card.operation) denied \(status)")
                job?.session?.send(text: "[dot] he said no; nothing was sent.")
            }
        })
        Log.info("proposal: card \(pid8) \(card.operation) shown for job[\(job.id)]")
        if let presentCard { presentCard(consent) } else { Log.warn("proposal: no card surface; \(pid8) waits in Atlas") }
    }

    // MARK: His input, pause and go on

    /// His click or key (from the HID tap). Dot's own events are tagged and never count.
    func userInput(kind: JobInput, point: CGPoint?, own: Bool, simulated: Bool = false) {
        guard !own, kind == .click || kind == .key else { return }
        let candidates = running.filter { $0.phase == .running }
        guard !candidates.isEmpty else { return }
        inputDebounce?.cancel()
        let work = DispatchWorkItem { [weak self] in
            Task { @MainActor in
                guard let self else { return }
                try? await Task.sleep(nanoseconds: 80_000_000)
                for job in candidates where job.phase == .running {
                    let front = simulated ? job.bundle : NSWorkspace.shared.frontmostApplication?.bundleIdentifier
                    var focused: Bool?
                    var inside: Bool?
                    if job.isBrowserJob {
                        guard job.page.isBound else { continue }
                        focused = simulated ? true : await job.page.tabFocused()
                        if let point, let bounds = await job.page.windowBounds() {
                            let primary = NSScreen.screens.first?.frame.height ?? 0
                            inside = bounds.contains(CGPoint(x: point.x, y: primary - point.y))
                        }
                        if simulated { inside = true }
                    }
                    if JobPauseRule.shouldPause(input: kind, own: false, phase: job.phase, frontBundle: front, jobBundle: job.bundle,
                                                isBrowserJob: job.isBrowserJob, jobTabFocused: focused, pointInJobWindow: inside) {
                        self.pause(job, reason: kind == .click ? "he clicked" : "he typed")
                    }
                }
            }
        }
        inputDebounce = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25, execute: work)
    }

    func pause(_ job: Job, reason: String) {
        guard let next = job.phase.next(.paused) else { return }
        job.phase = next
        job.session?.interrupt()
        Log.info("job[\(job.id)] paused (\(reason))")
        say("paused.", job: job, start: false, short: true)
        onChange?()
    }

    func resume(_ job: Job) {
        guard let next = job.phase.next(.resumed) else { return }
        job.phase = next
        job.session?.send(text: "[resume] he used the tab and said go on. continue where you left off; look first, the page may have changed.")
        Log.info("job[\(job.id)] resumed")
        onChange?()
    }

    func drop(_ job: Job, reason: String) {
        guard job.phase.isLive else { return }
        Log.info("job[\(job.id)] dropped (\(reason))")
        finish(job, failed: false, line: "", stopReason: "dropped: \(reason)")
    }

    func stop(_ job: Job, reason: String) {
        guard job.phase.isLive else { return }
        job.session?.interrupt()
        finish(job, failed: false, line: "", stopReason: reason)
    }

    func stopAll(reason: String) {
        for job in running { stop(job, reason: reason) }
        queue.removeAll()
        if reason == "quit" {
            spare?.session.stop(); spare = nil
            benchSpare?.session.stop(); benchSpare = nil
        }
    }

    /// Escape: a front job stops only while its app is in front (Escape in his own apps is common); behind jobs keep going.
    @discardableResult
    func escape() -> Bool {
        guard let job = frontJob else { return false }
        let front = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
        guard front == job.bundle else { return false }
        stop(job, reason: "escape")
        return true
    }

    func followUp(_ job: Job, text: String) {
        job.session?.send(text: "[he added] \"\(text)\"")
        Log.info("job[\(job.id)] follow-up: \(Log.short(text, 100))")
    }

    func steer(_ job: Job, instruction: String) {
        job.session?.interrupt()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            job.session?.send(text: "[he changed course] \(instruction)")
        }
        Log.info("job[\(job.id)] steered: \(Log.short(instruction, 100))")
    }

    @discardableResult
    func show(_ job: Job) async -> (String, Bool, String?) {
        Log.info("job[\(job.id)] shown")
        if job.page.isBound {
            let r = await job.page.show()
            if let rung = job.rung, let point = rung.point {
                try? await Task.sleep(nanoseconds: 300_000_000)
                overlay?.target(at: point, radius: 24, label: rung.label, hover: false)
            }
            return ("\(r.status.rawValue): \(r.detail)", r.status == .error, nil)
        }
        if let newest = (try? FileManager.default.contentsOfDirectory(at: job.folder.appendingPathComponent("output"), includingPropertiesForKeys: [.contentModificationDateKey]))?
            .max(by: { ((try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) < ((try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) }) {
            if !job.bench { NSWorkspace.shared.open(newest) }
            return ("ok: opened \(newest.lastPathComponent)", false, nil)
        }
        return ("error: nothing to show yet", true, nil)
    }

    /// For talk's context and "what's it doing".
    func statusLine() -> String {
        let live = jobs.filter { $0.phase.isLive || ($0.endedAt.map { Date().timeIntervalSince($0) < 600 } ?? false) }
        guard !live.isEmpty else { return "" }
        return "jobs: " + live.map { job in
            var s = "\(Log.short(job.goal, 80)) (\(job.placement.rawValue), \(job.phase.rawValue))"
            if job.phase.isLive, let step = job.steps.last { s += "; last step: \(Log.short(step, 60))" }
            if !job.endLine.isEmpty { s += "; it said: \"\(Log.short(job.endLine, 160))\"" }
            if job.rung != nil { s += "; waiting on his press: \(job.rung!.label)" }
            if job.cost >= 3 { s += String(format: "; $%.2f so far", job.cost) }
            return s
        }.joined(separator: " | ")
    }

    /// "what's it doing", out loud.
    func spokenStatus() -> String {
        let live = running
        guard !live.isEmpty else { return "nothing's running." }
        return live.map { job in
            let what = Log.short(job.goal.components(separatedBy: .newlines).first ?? job.goal, 60).lowercased()
            switch job.phase {
            case .paused: return "\(what) is paused; say go on."
            default:
                if let rung = job.rung { return "\(what) is waiting on your press: \(rung.label.lowercased())." }
                return "\(what) is \(job.placement == .behind ? "running behind your window" : "going"), \(job.steps.count) steps in."
            }
        }.joined(separator: " ")
    }

    /// Bench input (`Dot --job-test click|key`): his click or key for the newest bench job, through the pause rule.
    func simulateInput(_ kind: JobInput) -> String {
        guard let job = running.last(where: { $0.bench }) else { return "no bench job running" }
        userInput(kind: kind, point: nil, own: false, simulated: true)
        return "job-test \(kind.rawValue) for job \(job.id)"
    }

    // MARK: Speech

    /// Start lines Dot says itself; end lines when talk is idle and the Mac isn't muted, else as text. Bench jobs never speak.
    private func say(_ line: String, job: Job, start: Bool, short: Bool = false, attempt: Int = 0) {
        guard !line.isEmpty else { return }
        Log.info("job[\(job.id)] said: \(Log.short(line, 160))")
        if job.bench {
            Log.info("speak: job (bench, silent) \(Log.short(line, 60))")
            return
        }
        if !start, !talkIsIdle(), attempt < 60 {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in self?.say(line, job: job, start: start, short: short, attempt: attempt + 1) }
            return
        }
        overlay?.greet(line, for: short ? 3 : 6)
        if AudioDevices.outputIsSilent() {
            Log.info("speak: job (muted, text) \(Log.short(line, 60))")
            return
        }
        Log.info("speak: job \(Log.short(line, 60))")
        speaker?.speak(line)
    }
}
