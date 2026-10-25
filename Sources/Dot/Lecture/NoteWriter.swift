import DotKit
import Foundation

/// The model that writes a class's notes (lecture mode, 2026-10-22). One long-lived `claude -p` per class with no
/// tools and nothing saved, so the whole lecture stays in its context and each cycle only sends what is new: about 45
/// seconds of speech, the slide when it changed, his edits and the end of the notes with ids. It answers in the line
/// protocol NoteProtocol reads (Resources/lecture/notes-system.md). One message is in flight at a time.
@MainActor
final class NoteWriter {
    struct Setup {
        var course: String
        var courseText: String
        var materials: String
        var heading: String
    }

    private let config: DotConfig
    private var session: ClaudeSession?
    private var waiting: ((String?, Double) -> Void)?
    private var sentAt = Date()
    private var reply = ""
    private(set) var cycles = 0
    /// The session's cost as its last result reported it.
    private(set) var costUSD = 0.0
    /// The model's own time for the last reply (the rest of a slow cycle is waiting on Dot or the network).
    private(set) var lastApiMs = 0
    /// A reply this late is given up on; the session is then replaced (a slow one only gets slower).
    var timeout: TimeInterval = 45

    init(config: DotConfig) { self.config = config }

    var isBusy: Bool { waiting != nil }
    var isRunning: Bool { session?.isRunning ?? false }

    func start(_ setup: Setup) throws {
        var options = ClaudeSession.Options(cwd: config.talkRootURL, model: config.lectureModel)
        options.systemPrompt = Self.systemPrompt(setup)
        options.tools = []
        options.maxTurns = nil
        options.settingSources = ""
        options.permissionPromptOverStdio = false
        options.includePartialMessages = false
        options.extraArguments = ["--no-session-persistence"]
        // A cycle is a short reply on a long context: thinking would only add seconds.
        options.environment = ["MAX_THINKING_TOKENS": "0"]
        let session = ClaudeSession(label: "lecture", claudePath: config.claudeExecutable, options: options)
        // a writer replaced by restartWriter may still report in: only the current one counts
        session.onEvent = { [weak self, weak session] event in
            guard let self, let session, self.session === session else { return }
            self.received(event)
        }
        session.onExit = { [weak self, weak session] code in
            guard let self, let session, self.session === session else { return }
            Log.warn("lecture: note writer exited (\(code))")
            self.finish(nil)
            self.session = nil
        }
        try session.start()
        self.session = session
        Log.info("lecture: note writer up (\(config.lectureModel)), system prompt \(options.systemPrompt?.count ?? 0) chars")
    }

    /// Send one message; `done` gets the reply text (nil on failure) and its seconds.
    func send(_ text: String, images: [Data] = [], done: @escaping (String?, Double) -> Void) {
        guard let session, waiting == nil else { return done(nil, 0) }
        waiting = done
        reply = ""
        sentAt = Date()
        session.send(text: text, images: images.map { (data: $0, mediaType: "image/jpeg") })
        // A reply that never comes would stall every cycle after it.
        let started = sentAt
        DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { [weak self] in
            guard let self, self.waiting != nil, self.sentAt == started else { return }
            Log.warn("lecture: a note cycle took over \(Int(self.timeout)) s; skipping it")
            self.session?.interrupt()
            self.finish(nil)
        }
    }

    func stop() {
        session?.stop()
        session = nil
        finish(nil)
    }

    private func received(_ event: StreamEvent) {
        switch event {
        case .assistantText(let text): reply += text
        case .rateLimit(let status, let resetsAt, let kind):
            Log.warn("lecture: note writer rate limit \(status) \(kind ?? "")\(resetsAt.map { " resets \(Date(timeIntervalSince1970: $0))" } ?? "")")
        case .result(let info):
            costUSD = info.costUSD
            lastApiMs = info.durationApiMs
            cycles += 1
            if info.isError { Log.warn("lecture: note writer error: \(Log.short(info.resultText ?? info.subtype, 160))") }
            finish(info.isError ? nil : (info.resultText ?? reply))
        default: break
        }
    }

    private func finish(_ text: String?) {
        guard let done = waiting else { return }
        waiting = nil
        done(text, Date().timeIntervalSince(sentAt))
    }

    // MARK: Prompts (Resources/lecture; his style in ~/Dot/talk/notes-style.md)

    static func resource(_ name: String) -> String {
        let candidates = [ProcessInfo.processInfo.environment["DOT_LECTURE_DIR"].map { DotConfig.expand($0) + "/" + name },
                          Bundle.main.resourceURL?.appendingPathComponent("lecture/" + name).path,
                          DotConfig.expand("~/Projects/dot/Resources/lecture/" + name)].compactMap { $0 }
        for path in candidates { if let text = try? String(contentsOfFile: path, encoding: .utf8) { return text } }
        Log.warn("lecture: \(name) not found")
        return ""
    }

    static var style: String {
        (try? String(contentsOfFile: DotConfig.expand("~/Dot/talk/notes-style.md"), encoding: .utf8)) ?? resource("notes-style-default.md")
    }

    static func systemPrompt(_ setup: Setup) -> String {
        resource("notes-system.md")
            .replacingOccurrences(of: "{{STYLE}}", with: style)
            .replacingOccurrences(of: "{{COURSE}}", with: setup.course + (setup.courseText.isEmpty ? "" : "\n\n" + setup.courseText))
            .replacingOccurrences(of: "{{MATERIALS}}", with: setup.materials.isEmpty ? "(none yet)" : setup.materials)
            .replacingOccurrences(of: "{{CLASS}}", with: setup.heading)
    }
}
