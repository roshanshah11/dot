import DotKit
import Foundation

/// The live helper in a coffee chat (call mode, his pick 2026-10-28: "cluely type tool", facts and follow-ups): one
/// long-lived `claude -p` on the talk model for the whole call, with Atlas's reads and the web, so the call stays in its
/// context and each message is only the newest stretch. It answers in CallHelp's lines (Resources/call/helper-system.md).
/// One message in flight at a time; a late one is given up on, so a slow search never stacks up behind the talk.
@MainActor
final class CallHelper {
    private let config: DotConfig
    private var session: ClaudeSession?
    private var waiting: ((String?) -> Void)?
    private var sentAt = Date()
    private var reply = ""
    private var mcpFile: URL?
    private(set) var replies = 0
    private(set) var costUSD = 0.0
    var timeout: TimeInterval = 25

    init(config: DotConfig) { self.config = config }

    var isBusy: Bool { waiting != nil }

    static let atlasTools = ["search", "facts", "people", "mail"]

    func start(call: String, lessons: String, prep: String) throws {
        var options = ClaudeSession.Options(cwd: config.talkRootURL, model: config.talkModel)
        options.systemPrompt = Self.resource("helper-system.md")
            .replacingOccurrences(of: "{{CALL}}", with: call)
            .replacingOccurrences(of: "{{LESSONS}}", with: lessons.isEmpty ? "(none saved)" : String(lessons.prefix(6000)))
            .replacingOccurrences(of: "{{PREP}}", with: prep.isEmpty ? "(no prep file for this call)" : String(prep.prefix(8000)))
        options.tools = ["WebSearch"]
        options.allowedTools = ["WebSearch"] + Self.atlasTools.map { "mcp__atlas__\($0)" }
        options.permissionMode = "dontAsk"
        if let talk = config.talkMCPConfig.flatMap({ try? Data(contentsOf: URL(fileURLWithPath: DotConfig.expand($0))) }),
           let data = ResearchConfigFile.make(talkMCP: talk, session: "dot-call-\(ResearchConfigFile.stamp(Date()))", tools: Self.atlasTools) {
            let file = FileManager.default.temporaryDirectory.appendingPathComponent("dot-call-helper-\(UUID().uuidString.prefix(8)).json")
            if (try? data.write(to: file)) != nil { options.mcpConfigPath = file.path; mcpFile = file }
        }
        options.maxTurns = nil
        options.settingSources = ""
        options.permissionPromptOverStdio = false
        options.includePartialMessages = false
        options.extraArguments = ["--no-session-persistence"]
        // a reply is a line or two on a long context: thinking would only cost seconds he doesn't have
        options.environment = ["MAX_THINKING_TOKENS": "0"]
        let session = ClaudeSession(label: "call", claudePath: config.claudeExecutable, options: options)
        session.onEvent = { [weak self, weak session] event in
            guard let self, let session, self.session === session else { return }
            self.received(event)
        }
        session.onExit = { [weak self, weak session] code in
            guard let self, let session, self.session === session else { return }
            Log.warn("call: helper exited (\(code))")
            self.finish(nil)
            self.session = nil
        }
        try session.start()
        self.session = session
        Log.info("call: helper up (\(config.talkModel)\(mcpFile == nil ? ", no Atlas" : ", Atlas + web"))")
    }

    func send(_ text: String, done: @escaping (String?) -> Void) {
        guard let session, waiting == nil else { return done(nil) }
        waiting = done
        reply = ""
        sentAt = Date()
        session.send(text: text, images: [])
        let started = sentAt
        DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { [weak self] in
            guard let self, self.waiting != nil, self.sentAt == started else { return }
            Log.warn("call: a helper reply took over \(Int(self.timeout)) s; skipped")
            self.session?.interrupt()
            self.finish(nil)
        }
    }

    func stop() {
        session?.stop()
        session = nil
        finish(nil)
        if let mcpFile { try? FileManager.default.removeItem(at: mcpFile) }
        mcpFile = nil
    }

    private func received(_ event: StreamEvent) {
        switch event {
        case .assistantText(let text): reply += text
        case .result(let info):
            costUSD = info.costUSD
            replies += 1
            if info.isError { Log.warn("call: helper error: \(Log.short(info.resultText ?? info.subtype, 160))") }
            finish(info.isError ? nil : (info.resultText ?? reply))
        default: break
        }
    }

    private func finish(_ text: String?) {
        guard let done = waiting else { return }
        waiting = nil
        done(text)
    }

    static func resource(_ name: String) -> String {
        let candidates = [ProcessInfo.processInfo.environment["DOT_CALL_DIR"].map { DotConfig.expand($0) + "/" + name },
                          Bundle.main.resourceURL?.appendingPathComponent("call/" + name).path,
                          DotConfig.expand("~/Projects/dot/Resources/call/" + name)].compactMap { $0 }
        for path in candidates { if let text = try? String(contentsOfFile: path, encoding: .utf8) { return text } }
        Log.warn("call: \(name) not found")
        return ""
    }
}
