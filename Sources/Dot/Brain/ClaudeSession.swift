import DotKit
import Foundation

/// One long-lived `claude -p` process in streaming-input mode: Dot writes user messages
/// (text plus screenshots) to its stdin and reads stream-json events from its stdout.
/// Permission prompts arrive on the same channel (`--permission-prompt-tool stdio`) and
/// are answered by `permissionHandler`. This is the same runtime the Claude Agent SDK
/// drives, so it runs on the user's Claude subscription with no API key.
final class ClaudeSession {
    struct Options {
        var cwd: URL
        var model: String
        var systemPrompt: String? = nil
        var appendSystemPrompt: String? = nil
        /// `--tools`: nil keeps Claude Code's default set, [] removes every built-in tool.
        var tools: [String]? = nil
        var allowedTools: [String] = []
        var disallowedTools: [String] = []
        var mcpConfigPath: String? = nil
        var strictMCP = true
        var permissionMode = "default"
        var permissionPromptOverStdio = true
        /// nil: no `--max-turns` (jobs run with no step limit, 2026-10-20).
        var maxTurns: Int? = 8
        var sessionId: String = UUID().uuidString
        var resume = false
        /// nil = Claude Code's default (user, project, local); "" = none, for a fast, hookless session.
        var settingSources: String? = nil
        var includePartialMessages = true
        var effort: String? = nil
        var extraArguments: [String] = []
        /// Added to the process environment (agents: CLAUDE_CODE_DISABLE_BACKGROUND_TASKS).
        var environment: [String: String] = [:]
        /// `--settings`: a path or inline JSON, layered over the setting sources (agents: the gate's hooks, AG-07).
        var settings: String? = nil
    }

    let options: Options
    let claudePath: URL
    let label: String

    private var process: Process?
    private var stdinHandle: FileHandle?
    private var lineBuffer = Data()
    private let writeQueue = DispatchQueue(label: "com.roshan.dot.session.write")

    private(set) var sessionId: String
    private(set) var isRunning = false
    private(set) var turnInFlight = false
    private(set) var lastActivity = Date()
    /// Background tasks (helpers, long shell commands) the session reports open right now.
    private(set) var backgroundTasks = 0

    /// Main thread.
    var onEvent: ((StreamEvent) -> Void)?
    var onExit: ((Int32) -> Void)?
    /// Main thread. Completion: (allow, denial message).
    var permissionHandler: ((PermissionRequest, @escaping (Bool, String?) -> Void) -> Void)?

    /// Agents (AG-12): set to the agent's slug and `start` runs the process in Dot's agent host, so it
    /// outlives Dot; when the host is not there or refuses, it starts here exactly as before.
    var hostID: String?
    private let host = AgentHostClient()
    private var follower: HostFollower?
    /// The last host stdout line handled, saved at quit so a relaunch picks up after it.
    private(set) var lastHostSeq = 0
    var isHosted: Bool { follower != nil }

    init(label: String, claudePath: URL, options: Options) {
        self.label = label
        self.claudePath = claudePath
        self.options = options
        self.sessionId = options.sessionId
    }

    deinit { stop() }

    // MARK: Lifecycle

    func start() throws {
        guard process == nil, follower == nil else { return }
        try FileManager.default.createDirectory(at: options.cwd, withIntermediateDirectories: true)
        if let id = hostID {
            var environment = Self.environment().merging(options.environment) { _, added in added }
            environment["DOT_AGENT_HOST"] = "1"   // the gate waits for a relaunched Dot instead of denying (AG-12)
            if let pid = host.spawn(HostSpawn(id: id, executable: claudePath.path, arguments: arguments(), cwd: options.cwd.path, environment: environment)) {
                follow(id: id, from: 0, turnInFlight: false)
                Log.info("session[\(label)] started in the agent host, pid \(pid) model \(options.model) cwd \(options.cwd.path)")
                return
            }
            Log.info("session[\(label)] agent host not available; starting it here")
        }
        let process = Process()
        process.executableURL = claudePath
        process.arguments = arguments()
        process.currentDirectoryURL = options.cwd
        process.environment = Self.environment().merging(options.environment) { _, added in added }

        let stdin = Pipe(), stdout = Pipe(), stderr = Pipe()
        process.standardInput = stdin
        process.standardOutput = stdout
        process.standardError = stderr

        stdout.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard let self else { return }
            if data.isEmpty { return }
            self.consume(data)
        }
        stderr.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { Log.warn("session[\(self?.label ?? "?")] stderr: \(Log.short(trimmed, 300))") }
        }
        process.terminationHandler = { [weak self] proc in
            stdout.fileHandleForReading.readabilityHandler = nil
            stderr.fileHandleForReading.readabilityHandler = nil
            DispatchQueue.main.async { self?.exited(proc.terminationStatus) }
        }

        try process.run()
        self.process = process
        self.stdinHandle = stdin.fileHandleForWriting
        // A late write (an answer to a card after the process died) fails with EPIPE instead of
        // SIGPIPE, which would end Dot itself.
        _ = fcntl(stdin.fileHandleForWriting.fileDescriptor, F_SETNOSIGPIPE, 1)
        isRunning = true
        lastActivity = Date()
        Log.info("session[\(label)] started pid \(process.processIdentifier) model \(options.model) cwd \(options.cwd.path)")
    }

    private func exited(_ status: Int32) {
        isRunning = false
        turnInFlight = false
        pendingResults = 0
        process = nil
        stdinHandle = nil
        follower = nil
        Log.info("session[\(label)] exited \(status)")
        onExit?(status)
    }

    /// Takes over a process the agent host already runs (a relaunch, AG-12): its output from `seq`
    /// on, and any permission request it still waits on. False when the host does not answer.
    func attachToHost(id: String, from seq: Int, turnInFlight inFlight: Bool) -> Bool {
        guard process == nil, follower == nil, host.list(timeout: 2)?.contains(where: { $0.id == id }) == true else { return false }
        hostID = id
        follow(id: id, from: seq, turnInFlight: inFlight)
        Log.info("session[\(label)] attached to the agent host from seq \(seq)")
        return true
    }

    private func follow(id: String, from seq: Int, turnInFlight inFlight: Bool) {
        lastHostSeq = seq
        follower = host.follow(id: id, from: seq, onLines: { [weak self] lines in
            let parsed = lines.map { ($0.seq, StreamJSON.parse(line: $0.text)) }
            DispatchQueue.main.async {
                guard let self, self.follower != nil else { return }
                for (seq, event) in parsed {
                    self.lastHostSeq = max(self.lastHostSeq, seq)
                    if let event { self.dispatch(event) }
                }
            }
        }, onEnd: { [weak self] status in
            DispatchQueue.main.async {
                guard let self, self.follower != nil else { return }
                if status == nil { Log.warn("session[\(self.label)] the agent host went away") }
                self.exited(status ?? 1)
            }
        })
        isRunning = true
        turnInFlight = inFlight
        pendingResults = inFlight ? 1 : 0
        lastActivity = Date()
    }

    /// Dot is quitting and the process stays in the host: stop following and say so, so the host
    /// knows nobody can answer until Dot is back. Returns the seq to pick up from.
    func detachFromHost() -> Int {
        guard let follower else { return lastHostSeq }
        follower.cancel()
        self.follower = nil
        host.detach(id: follower.id)
        isRunning = false
        turnInFlight = false
        pendingResults = 0
        return lastHostSeq
    }

    func stop() {
        if let id = follower?.id {
            // The host runs the same ladder: end of input, then TERM after 3 s, KILL after 8 s.
            host.signal(id: id, "close")
            isRunning = false
            turnInFlight = false
            return
        }
        guard let process else { return }
        try? stdinHandle?.close()
        stdinHandle = nil
        let pid = process.processIdentifier
        DispatchQueue.global().asyncAfter(deadline: .now() + 3) {
            if process.isRunning { kill(pid, SIGTERM) }
        }
        DispatchQueue.global().asyncAfter(deadline: .now() + 8) {
            if process.isRunning { kill(pid, SIGKILL) }
        }
        self.process = nil
        isRunning = false
        turnInFlight = false
        pendingResults = 0
    }

    /// Dot is quitting: end the process now. `stop()` waits three seconds before its signal, and a
    /// quitting app never gets there, which left agents running on without Dot (F2, 2026-10-15).
    func terminateNow() {
        if let id = follower?.id {
            host.signal(id: id, "TERM")
            DispatchQueue.global().asyncAfter(deadline: .now() + 2) { [host] in _ = host.signal(id: id, "KILL") }
            follower?.cancel()
            follower = nil
            isRunning = false
            turnInFlight = false
            return
        }
        guard let process else { return }
        try? stdinHandle?.close()
        stdinHandle = nil
        let pid = process.processIdentifier
        if process.isRunning { kill(pid, SIGTERM) }
        // A process that ignores TERM (a hung quip run) still goes.
        DispatchQueue.global().asyncAfter(deadline: .now() + 2) { if process.isRunning { kill(pid, SIGKILL) } }
        self.process = nil
        isRunning = false
        turnInFlight = false
        pendingResults = 0
    }

    // MARK: Messages

    /// Messages sent whose result has not come back. A message sent right after an interrupt waits behind the cut-off
    /// turn, whose result arrives first: the session is still busy after that one (the basics pass, 2026-10-18).
    private(set) var pendingResults = 0

    func send(text: String, images: [(data: Data, mediaType: String)] = []) {
        pendingResults += 1
        turnInFlight = true
        lastActivity = Date()
        write(StreamJSON.userMessage(text: text, images: images))
    }

    /// Ends the turn in flight; the session stays usable.
    func interrupt() {
        guard turnInFlight else { return }
        write(StreamJSON.controlRequest(id: UUID().uuidString, subtype: "interrupt"))
    }

    func answerPermission(requestId: String, allow: Bool, input: [String: AnyCodableValue], message: String?) {
        write(StreamJSON.permissionResponse(requestId: requestId, allow: allow, updatedInput: input, message: message))
    }

    private func write(_ line: String) {
        if let id = follower?.id {
            let host = self.host
            writeQueue.async { if !host.write(id: id, line: line) { Log.error("session write to the agent host failed (\(id))") } }
            return
        }
        guard let handle = stdinHandle, let data = (line + "\n").data(using: .utf8) else { return }
        writeQueue.async {
            do { try handle.write(contentsOf: data) } catch { Log.error("session write failed: \(error)") }
        }
    }

    // MARK: Reading

    private func consume(_ data: Data) {
        lineBuffer.append(data)
        while let newline = lineBuffer.firstIndex(of: 0x0A) {
            let lineData = lineBuffer.subdata(in: lineBuffer.startIndex..<newline)
            lineBuffer.removeSubrange(lineBuffer.startIndex...newline)
            guard let line = String(data: lineData, encoding: .utf8), !line.isEmpty,
                  let event = StreamJSON.parse(line: line) else { continue }
            DispatchQueue.main.async { [weak self] in self?.dispatch(event) }
        }
    }

    /// Claude Code reports the session's running total; Dot wants the turn's own cost. A resumed session's total
    /// includes every earlier process (an agent's "say hi in one sentence" was ledgered at $10.34 on 2026-10-15, and
    /// agent spend read $158 against about $52 by 10-19), so each session's total is kept in its folder.
    private lazy var lastTotalCost: Double? = CostBaseline.load(Self.costFile(options.cwd), sessionId: sessionId) ?? (options.resume ? nil : 0)
    private static func costFile(_ cwd: URL) -> URL { cwd.appendingPathComponent(".dot-cost.json") }

    private func dispatch(_ incoming: StreamEvent) {
        lastActivity = Date()
        var event = incoming
        switch event {
        case .systemInit(let id, _, _):
            if !id.isEmpty { sessionId = id }
        case .result(let info):
            pendingResults = max(0, pendingResults - 1)
            turnInFlight = pendingResults > 0
            let (turnCost, total) = CostBaseline.turnCost(reported: info.costUSD, baseline: lastTotalCost)
            if lastTotalCost == nil { Log.info("session[\(label)] resumed with no saved cost total; this turn's cost isn't counted") }
            lastTotalCost = total
            CostBaseline.save(Self.costFile(options.cwd), sessionId: sessionId, total: total)
            event = .result(ResultInfo(sessionId: info.sessionId, subtype: info.subtype, isError: info.isError, costUSD: turnCost,
                                       durationMs: info.durationMs, durationApiMs: info.durationApiMs, numTurns: info.numTurns,
                                       inputTokens: info.inputTokens, outputTokens: info.outputTokens, cacheReadTokens: info.cacheReadTokens,
                                       cacheCreationTokens: info.cacheCreationTokens, resultText: info.resultText))
        case .backgroundTasks(let count):
            backgroundTasks = count
        case .textDelta, .assistantText, .toolUse, .contentBlockStart:
            // The runtime started a turn on its own (helpers' notifications come back as one).
            if !turnInFlight, isRunning { turnInFlight = true }
        case .permissionRequest(let request):
            guard let handler = permissionHandler else {
                answerPermission(requestId: request.requestId, allow: false, input: request.input, message: "Dot has no one to ask.")
                break
            }
            handler(request) { [weak self] allow, message in
                self?.answerPermission(requestId: request.requestId, allow: allow, input: request.input, message: message)
            }
        default:
            break
        }
        onEvent?(event)
    }

    // MARK: Arguments

    func arguments() -> [String] {
        var args = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose"]
        if options.includePartialMessages { args.append("--include-partial-messages") }
        args += options.resume ? ["--resume", options.sessionId] : ["--session-id", options.sessionId]
        args += ["--model", options.model]
        if let maxTurns = options.maxTurns { args += ["--max-turns", String(maxTurns)] }
        args += ["--permission-mode", options.permissionMode]
        if options.permissionPromptOverStdio { args += ["--permission-prompt-tool", "stdio"] }
        if let systemPrompt = options.systemPrompt { args += ["--system-prompt", systemPrompt] }
        if let append = options.appendSystemPrompt { args += ["--append-system-prompt", append] }
        if let tools = options.tools { args += ["--tools", tools.isEmpty ? "" : tools.joined(separator: ",")] }
        if !options.allowedTools.isEmpty { args += ["--allowedTools", options.allowedTools.joined(separator: ",")] }
        if !options.disallowedTools.isEmpty { args += ["--disallowedTools", options.disallowedTools.joined(separator: ",")] }
        if let mcp = options.mcpConfigPath {
            args += ["--mcp-config", mcp]
        } else if options.strictMCP {
            args += ["--mcp-config", "{\"mcpServers\":{}}"]
        }
        if options.strictMCP { args.append("--strict-mcp-config") }
        if let sources = options.settingSources { args += ["--setting-sources", sources] }
        if let settings = options.settings { args += ["--settings", settings] }
        if let effort = options.effort { args += ["--effort", effort] }
        args += options.extraArguments
        return args
    }

    static func environment() -> [String: String] {
        var env = ProcessInfo.processInfo.environment
        let home = NSHomeDirectory()
        let extra = ["\(home)/.local/bin", "\(home)/bin", "/opt/homebrew/bin", "/usr/local/bin"]
        let current = (env["PATH"] ?? "/usr/bin:/bin:/usr/sbin:/sbin").split(separator: ":").map(String.init)
        env["PATH"] = (extra.filter { !current.contains($0) } + current).joined(separator: ":")
        env.removeValue(forKey: "CLAUDECODE")
        env.removeValue(forKey: "CLAUDE_CODE_ENTRYPOINT")
        env["DOT"] = "1"
        return env
    }
}
