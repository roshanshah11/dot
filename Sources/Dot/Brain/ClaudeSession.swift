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
        var maxTurns = 8
        var sessionId: String = UUID().uuidString
        var resume = false
        /// nil = Claude Code's default (user, project, local); "" = none, for a fast, hookless session.
        var settingSources: String? = nil
        var includePartialMessages = true
        var effort: String? = nil
        var extraArguments: [String] = []
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

    /// Main thread.
    var onEvent: ((StreamEvent) -> Void)?
    var onExit: ((Int32) -> Void)?
    /// Main thread. Completion: (allow, denial message).
    var permissionHandler: ((PermissionRequest, @escaping (Bool, String?) -> Void) -> Void)?

    init(label: String, claudePath: URL, options: Options) {
        self.label = label
        self.claudePath = claudePath
        self.options = options
        self.sessionId = options.sessionId
    }

    deinit { stop() }

    // MARK: Lifecycle

    func start() throws {
        guard process == nil else { return }
        try FileManager.default.createDirectory(at: options.cwd, withIntermediateDirectories: true)
        let process = Process()
        process.executableURL = claudePath
        process.arguments = arguments()
        process.currentDirectoryURL = options.cwd
        process.environment = Self.environment()

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
            DispatchQueue.main.async {
                guard let self else { return }
                self.isRunning = false
                self.turnInFlight = false
                self.process = nil
                Log.info("session[\(self.label)] exited \(proc.terminationStatus)")
                self.onExit?(proc.terminationStatus)
            }
        }

        try process.run()
        self.process = process
        self.stdinHandle = stdin.fileHandleForWriting
        isRunning = true
        lastActivity = Date()
        Log.info("session[\(label)] started pid \(process.processIdentifier) model \(options.model) cwd \(options.cwd.path)")
    }

    func stop() {
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
    }

    // MARK: Messages

    func send(text: String, images: [(data: Data, mediaType: String)] = []) {
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

    /// Claude Code reports the session's running total; Dot wants the turn's own cost.
    private var lastTotalCost = 0.0

    private func dispatch(_ incoming: StreamEvent) {
        lastActivity = Date()
        var event = incoming
        switch event {
        case .systemInit(let id, _):
            if !id.isEmpty { sessionId = id }
        case .result(let info):
            turnInFlight = false
            let turnCost = max(0, info.costUSD - lastTotalCost)
            lastTotalCost = max(lastTotalCost, info.costUSD)
            event = .result(ResultInfo(sessionId: info.sessionId, subtype: info.subtype, isError: info.isError, costUSD: turnCost,
                                       durationMs: info.durationMs, durationApiMs: info.durationApiMs, numTurns: info.numTurns,
                                       inputTokens: info.inputTokens, outputTokens: info.outputTokens, cacheReadTokens: info.cacheReadTokens,
                                       cacheCreationTokens: info.cacheCreationTokens, resultText: info.resultText))
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
        args += ["--model", options.model, "--max-turns", String(options.maxTurns), "--permission-mode", options.permissionMode]
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
