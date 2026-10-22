import DotKit
import Foundation

/// Explainers built in the background (his call, 2026-10-22: "multi agents can be working on things at the same time...
/// smth else can focus / set it up while dot transcripts... im happy to be on a delay"). Each "? topic" from the note
/// writer gets its own short-lived `claude -p` that writes one panel explainer while the lecture and the notes go on;
/// finished ones wait and are shown one at a time at the next pause in speech, because a pop-up mid-sentence costs the
/// most (interruptions of 3 to 4 s doubled errors; extras he can't pause for cut learning, g = -0.66).
@MainActor
final class LectureExplainers {
    struct Item {
        let id: String
        let topic: String
        let why: String
        let line: String?
        let tapped: Bool
        let queuedAt: Date
        var markup: String?
        var failed = false
    }

    private let config: DotConfig
    private let course: String
    private var items: [Item] = []
    private var running: [String: ClaudeSession] = [:]
    private var replies: [String: String] = [:]
    private var shownAt = Date.distantPast
    private var counter = 0

    static let parallel = 2
    /// Time for him to read one before the next opens.
    var readGap: TimeInterval = 45
    /// One still unbuilt or unshown after this long is about a moment the lecture has left.
    var stale: TimeInterval = 300

    /// A line's marker in the notes: "queued", "ready", "shown" or nil.
    var onMark: ((String, String?) -> Void)?
    /// Open the panel with this title and markup; false when it can't now (talk busy), and it waits.
    var onShow: ((String, String) -> Bool)?

    init(config: DotConfig, course: String) {
        self.config = config
        self.course = course
    }

    var shown = 0
    var pending: Int { items.count }

    /// A topic to explain; `context` is the last minute and a half of speech and the slide. A tapped line jumps the queue.
    func request(topic: String, why: String, line: String?, context: String, tapped: Bool) {
        guard !items.contains(where: { $0.topic.lowercased() == topic.lowercased() }) else { return }
        counter += 1
        let item = Item(id: "x\(counter)", topic: topic, why: why, line: line, tapped: tapped, queuedAt: Date())
        if tapped { items.insert(item, at: 0) } else { items.append(item) }
        if let line { onMark?(line, "queued") }
        Log.info("lecture: explainer \(item.id) queued: \"\(Log.short(topic, 60))\"\(tapped ? " (tapped)" : "")")
        build(item.id, context: context)
    }

    private func build(_ id: String, context: String) {
        guard running.count < Self.parallel, let index = items.firstIndex(where: { $0.id == id }) else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
                guard let self, self.items.contains(where: { $0.id == id && $0.markup == nil && !$0.failed }), self.running[id] == nil else { return }
                self.build(id, context: context)
            }
            return
        }
        let item = items[index]
        var options = ClaudeSession.Options(cwd: config.talkRootURL, model: config.lectureModel)
        options.systemPrompt = NoteWriter.resource("explainer-system.md")
            .replacingOccurrences(of: "{{PANEL_RULES}}", with: Prompts.panelRules)
            .replacingOccurrences(of: "{{COURSE}}", with: course)
        options.tools = []
        options.maxTurns = 1
        options.settingSources = ""
        options.permissionPromptOverStdio = false
        options.includePartialMessages = false
        options.extraArguments = ["--no-session-persistence"]
        options.environment = ["MAX_THINKING_TOKENS": "0"]
        let session = ClaudeSession(label: "explain-\(id)", claudePath: config.claudeExecutable, options: options)
        let started = Date()
        session.onEvent = { [weak self] event in
            guard let self else { return }
            switch event {
            case .assistantText(let text): self.replies[id, default: ""] += text
            case .result(let info): self.finished(id, text: info.isError ? nil : (info.resultText ?? self.replies[id]), seconds: Date().timeIntervalSince(started))
            default: break
            }
        }
        session.onExit = { [weak self] _ in self?.finished(id, text: nil, seconds: Date().timeIntervalSince(started)) }
        do { try session.start() } catch {
            Log.warn("lecture: explainer \(id) didn't start: \(error)")
            items[index].failed = true
            return
        }
        running[id] = session
        session.send(text: "[explain] topic: \(item.topic)" + (item.why.isEmpty ? "" : " | why: \(item.why)") + "\n" + context)
        DispatchQueue.main.asyncAfter(deadline: .now() + 120) { [weak self] in
            guard let self, self.running[id] != nil else { return }
            Log.warn("lecture: explainer \(id) took over 2 min; dropped")
            self.finished(id, text: nil, seconds: 120)
        }
    }

    private func finished(_ id: String, text: String?, seconds: Double) {
        guard let session = running.removeValue(forKey: id) else { return }
        session.stop()
        replies[id] = nil
        guard let index = items.firstIndex(where: { $0.id == id }) else { return }
        let markup = text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if markup.isEmpty {
            items[index].failed = true
            if let line = items[index].line { onMark?(line, nil) }
            Log.warn("lecture: explainer \(id) came back empty after \(Int(seconds)) s")
        } else {
            items[index].markup = markup
            if let line = items[index].line { onMark?(line, "ready") }
            Log.info(String(format: "lecture: explainer %@ ready in %.1f s (%d chars)", id, seconds, markup.count))
        }
        items.removeAll { $0.failed }
    }

    /// Called about every second: drop stale ones, and at a pause show the next ready one (a tapped one right away).
    func tick(paused: Bool) {
        let now = Date()
        for item in items where item.markup == nil && running[item.id] == nil && now.timeIntervalSince(item.queuedAt) > stale {
            if let line = item.line { onMark?(line, nil) }
        }
        items.removeAll { $0.markup == nil && running[$0.id] == nil && now.timeIntervalSince($0.queuedAt) > stale }
        guard let next = items.first(where: { $0.markup != nil }) else { return }
        guard next.tapped || (paused && now.timeIntervalSince(shownAt) >= readGap) else { return }
        show(next.id)
    }

    /// Show one now (he clicked its ready marker, or its turn came).
    func show(_ id: String) {
        guard let index = items.firstIndex(where: { $0.id == id }), let markup = items[index].markup else { return }
        let item = items[index]
        guard onShow?(item.topic, markup) == true else { return }
        items.remove(at: index)
        shownAt = Date()
        shown += 1
        if let line = item.line { onMark?(line, "shown") }
        Log.info("lecture: explainer \(id) shown: \"\(Log.short(item.topic, 60))\" (\(items.count) waiting)")
    }

    /// The ready one marked on this line, if any.
    func readyID(forLine line: String) -> String? {
        items.first { $0.line == line && $0.markup != nil }?.id
    }

    func stopAll() {
        for (_, session) in running { session.stop() }
        running = [:]
        items = []
    }
}
