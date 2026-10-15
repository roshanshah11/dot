import AppKit
import DotKit
import Foundation

/// The voice loop: hold the key, speak, see the screen, answer aloud, point.
@MainActor
final class Talk {
    enum Phase: Equatable { case idle, listening, transcribing, thinking, speaking }

    private let config: DotConfig
    private let hud: NotchHUD
    private let overlay: OverlayManager
    private let speaker: TTSProvider
    private let transcriber: Transcriber
    private let agents: AgentManager
    private let ledger: Ledger

    private let recorder = AudioRecorder()
    private var talkSession: ClaudeSession?
    private var thinkSession: ClaudeSession?

    private(set) var phase: Phase = .idle
    private var mode: HotkeyMonitor.Mode = .talk
    private var captureTask: Task<(shots: [ScreenShot], context: ScreenContext), Never>?
    private var shots: [ScreenShot] = []
    private var context = ScreenContext.empty
    private var lastMessage = ""
    private var responseBuffer = ""
    private var heldBack = ""
    private var splitter = SentenceSplitter()
    private var activeSession: ClaudeSession?
    private var levelTimer: Timer?
    private var idleTimer: Timer?
    private var turnStartedAt = Date()
    private var turnModel = ""

    init(config: DotConfig, hud: NotchHUD, overlay: OverlayManager, speaker: TTSProvider, transcriber: Transcriber,
         agents: AgentManager, ledger: Ledger) {
        self.config = config
        self.hud = hud
        self.overlay = overlay
        self.speaker = speaker
        self.transcriber = transcriber
        self.agents = agents
        self.ledger = ledger
        self.speaker.onFinishedAll = { [weak self] in
            Task { @MainActor in self?.speakingFinished() }
        }
        hud.model.onSubmitInput = { [weak self] text in
            Task { @MainActor in self?.askTyped(text) }
        }
    }

    // MARK: Warm up

    func warmUp() {
        Task.detached { [transcriber] in
            do { try await transcriber.warmUp(); Log.info("transcriber ready") } catch { Log.error("transcriber warm-up failed: \(error)") }
        }
        _ = session(for: .talk)
    }

    private func session(for kind: SessionKind) -> ClaudeSession? {
        switch kind {
        case .talk:
            if let talkSession, talkSession.isRunning { return talkSession }
            talkSession = makeSession(kind: .talk)
            return talkSession
        case .think:
            if let thinkSession, thinkSession.isRunning { return thinkSession }
            thinkSession = makeSession(kind: .think)
            return thinkSession
        }
    }

    private enum SessionKind { case talk, think }

    private func makeSession(kind: SessionKind) -> ClaudeSession? {
        var options = ClaudeSession.Options(cwd: config.talkRootURL, model: kind == .talk ? config.talkModel : config.thinkModel)
        options.systemPrompt = kind == .talk ? Prompts.talk : Prompts.think
        options.tools = []
        options.maxTurns = 4
        options.settingSources = ""
        options.permissionMode = "default"
        options.mcpConfigPath = config.mcpConfigPath(config.talkMCPConfig)
        options.strictMCP = true
        options.allowedTools = config.talkAllowedTools
        let session = ClaudeSession(label: kind == .talk ? "talk" : "think", claudePath: config.claudeExecutable, options: options)
        session.onEvent = { [weak self, weak session] event in
            guard let self, let session, self.activeSession === session else { return }
            self.handle(event)
        }
        session.permissionHandler = { request, completion in
            // Talk mode has no tools beyond the configured read-only MCP tools; anything else is refused.
            completion(false, "Dot's talk mode only reads. Hand this to an agent.")
            Log.warn("talk: refused tool \(request.toolName)")
        }
        do {
            try session.start()
            return session
        } catch {
            Log.error("talk session failed to start: \(error)")
            hud.flash(error: "Claude Code did not start: \(error.localizedDescription)")
            return nil
        }
    }

    // MARK: Hotkey

    func hotkey(_ event: HotkeyMonitor.Event) {
        switch event {
        case .pressed(let mode):
            beginListening(mode: mode)
        case .modeChanged(let mode):
            self.mode = mode
            hud.model.mode = mode
        case .released(let mode, let heldFor):
            self.mode = mode
            endListening(heldFor: heldFor)
        case .escape:
            interrupt()
        }
    }

    private func beginListening(mode: HotkeyMonitor.Mode) {
        guard phase == .idle || phase == .speaking else { return }
        if phase == .speaking { stopSpeaking(); activeSession?.interrupt() }
        self.mode = mode
        idleTimer?.invalidate()
        do {
            _ = try recorder.start()
        } catch {
            hud.flash(error: "\(error)")
            return
        }
        phase = .listening
        hud.model.mode = mode
        hud.model.transcript = ""
        hud.model.response = ""
        hud.set(phase: .listening)
        overlay.show(phase: .listening)
        levelTimer?.invalidate()
        levelTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                let level = self.recorder.level()
                self.hud.model.level = level
                self.overlay.setLevel(level)
            }
        }
        // Capture while they talk, so the context is the screen they were looking at.
        let maxDimension = config.screenshotMaxDimension
        let others = config.includeOtherScreens
        let maxElements = config.maxAccessibilityElements
        captureTask = Task { @MainActor in
            let context = AccessibilityContext.capture(maxElements: maxElements)
            let shots = (try? await ScreenCapture.captureAll(maxDimension: maxDimension, includeOtherScreens: others)) ?? []
            return (shots, context)
        }
    }

    private func endListening(heldFor: TimeInterval) {
        guard phase == .listening else { return }
        levelTimer?.invalidate()
        levelTimer = nil
        hud.model.level = 0
        overlay.setLevel(0)

        if heldFor < 0.35 {
            recorder.cancel()
            phase = .idle
            hud.showInput()
            return
        }

        guard let stopped = try? recorder.stop() else {
            phase = .idle
            hud.set(phase: .hidden)
            overlay.fadeOut(after: 0.2)
            return
        }
        phase = .transcribing
        hud.set(phase: .transcribing)
        overlay.show(phase: .thinking)

        Task { @MainActor in
            let text: String
            do {
                text = try await transcriber.transcribe(wavURL: stopped.url)
            } catch {
                Log.error("transcription failed: \(error)")
                hud.flash(error: "Speech recognition failed: \(error.localizedDescription)")
                phase = .idle
                overlay.fadeOut(after: 0.3)
                return
            }
            try? FileManager.default.removeItem(at: stopped.url)
            let words = text.split(separator: " ").count
            guard words >= 1, text.count >= 2 else {
                hud.flash(status: "didn't catch that")
                phase = .idle
                overlay.fadeOut(after: 0.4)
                return
            }
            hud.model.transcript = text
            await ask(text, typed: false)
        }
    }

    func askTyped(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        hud.model.transcript = trimmed
        hud.model.response = ""
        let maxDimension = config.screenshotMaxDimension
        let others = config.includeOtherScreens
        let maxElements = config.maxAccessibilityElements
        captureTask = Task { @MainActor in
            let context = AccessibilityContext.capture(maxElements: maxElements)
            let shots = (try? await ScreenCapture.captureAll(maxDimension: maxDimension, includeOtherScreens: others)) ?? []
            return (shots, context)
        }
        overlay.show(phase: .thinking)
        Task { @MainActor in await ask(trimmed, typed: true) }
    }

    // MARK: Asking

    private func ask(_ text: String, typed: Bool) async {
        if let captureTask {
            let captured = await captureTask.value
            shots = captured.shots
            context = captured.context
        }
        captureTask = nil

        if mode == .agent {
            phase = .idle
            hud.set(phase: .hidden)
            overlay.fadeOut(after: 0.6)
            speaker.speak("on it.")
            agents.handoff(brief: text, agentName: nil, context: context, shots: shots)
            return
        }

        guard let session = session(for: .talk) else {
            phase = .idle
            overlay.fadeOut(after: 0.3)
            return
        }
        let message = buildMessage(text)
        lastMessage = message
        sendTurn(message, to: session, kind: .talk)
    }

    private func sendTurn(_ message: String, to session: ClaudeSession, kind: SessionKind) {
        activeSession = session
        responseBuffer = ""
        heldBack = ""
        splitter = SentenceSplitter()
        turnStartedAt = Date()
        turnModel = kind == .talk ? config.talkModel : config.thinkModel
        phase = .thinking
        hud.set(phase: .thinking)
        overlay.show(phase: .thinking)
        let images = shots.map { (data: $0.jpeg, mediaType: "image/jpeg") }
        session.send(text: message, images: images)
        Log.info("turn[\(kind == .talk ? "talk" : "think")] sent \(images.count) image(s), \(message.count) chars: \(Log.short(hud.model.transcript))")
    }

    func buildMessage(_ transcript: String) -> String {
        var lines: [String] = ["[context]"]
        if let app = context.appName {
            lines.append("app: \(app)" + (context.bundleIdentifier.map { " (\($0))" } ?? ""))
        }
        if let title = context.windowTitle, !title.isEmpty { lines.append("window: \(title)") }
        if let url = context.url { lines.append("url: \(url)") }
        if let selected = context.selectedText, !selected.isEmpty {
            lines.append("selected text: \"\(Log.short(selected, 400))\"")
        }
        for (index, shot) in shots.enumerated() {
            lines.append("image \(index + 1): \(shot.label), \(shot.pixelDimensions) pixels")
        }
        if let cursorShot = shots.first(where: { $0.isCursorScreen }) ?? shots.first, !context.elements.isEmpty {
            lines.append("elements on the cursor's screen (role, label, center x,y in image \(shots.firstIndex(where: { $0.isCursorScreen }).map { $0 + 1 } ?? 1)):")
            var count = 0
            for element in context.elements {
                let center = CGPoint(x: element.frame.midX, y: element.frame.midY)
                guard let pixel = Coordinates.pixelPoint(fromScreen: center, in: cursorShot.frame) else { continue }
                count += 1
                let role = element.role.hasPrefix("AX") ? String(element.role.dropFirst(2)) : element.role
                lines.append("\(count). \(role) \"\(element.title)\" \(Int(pixel.x)),\(Int(pixel.y))")
            }
        }
        lines.append("[/context]")
        lines.append("")
        lines.append(transcript)
        return lines.joined(separator: "\n")
    }

    // MARK: Streaming

    private func handle(_ event: StreamEvent) {
        switch event {
        case .textDelta(let delta):
            responseBuffer += delta
            let (speak, hold) = TagParser.speakablePrefix(heldBack + delta)
            heldBack = hold
            for sentence in splitter.feed(speak) { say(sentence) }
            hud.model.response = TagParser.parse(responseBuffer).spoken
        case .assistantText(let text):
            if responseBuffer.isEmpty { responseBuffer = text }
        case .toolUse(_, let name, _):
            hud.flash(status: "checking \(Self.friendlyTool(name))")
        case .result(let result):
            finishTurn(result)
        case .rateLimit(let status, _, let kind):
            if status != "allowed" { hud.flash(status: "claude rate limit (\(kind ?? "")): \(status)") }
        default:
            break
        }
    }

    private func say(_ sentence: String) {
        let clean = TagParser.parse(sentence).spoken
        guard !clean.isEmpty else { return }
        if phase != .speaking {
            phase = .speaking
            hud.set(phase: .speaking)
            overlay.show(phase: .speaking)
        }
        speaker.speak(clean)
    }

    private func finishTurn(_ result: ResultInfo) {
        let full = responseBuffer.isEmpty ? (result.resultText ?? "") : responseBuffer
        let parsed = TagParser.parse(full)
        if let rest = splitter.flush() { say(rest) }
        hud.model.response = parsed.spoken
        let kind = activeSession === thinkSession ? "think" : "talk"
        ledger.record(kind: kind, agent: nil, model: turnModel, result: result, summary: hud.model.transcript)
        Log.info("turn[\(kind)] done in \(result.durationMs) ms, $\(String(format: "%.4f", result.costUSD)), tags \(parsed.tags.count)")

        var escalated = false
        for tag in parsed.tags {
            switch tag {
            case .point(let x, let y, let label, let screen):
                point(pixel: CGPoint(x: x, y: y), label: label, screen: screen)
            case .highlight(let x, let y, let w, let h, let label, let screen):
                highlight(pixelRect: CGRect(x: x, y: y, width: w, height: h), label: label, screen: screen)
            case .pointNone:
                break
            case .agent(let brief):
                agents.handoff(brief: brief, agentName: nil, context: context, shots: shots)
            case .newAgent(let name, let brief):
                agents.handoff(brief: brief, agentName: name, context: context, shots: shots)
            case .think:
                if kind == "talk", let think = session(for: .think) {
                    escalated = true
                    let message = lastMessage
                    // Let the "let me think" sentence finish, then ask the stronger model.
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
                        guard let self else { return }
                        self.sendTurn(message, to: think, kind: .think)
                    }
                }
            }
        }
        if escalated { return }
        if phase != .speaking || !speaker.isSpeaking {
            speakingFinished()
        }
    }

    private func speakingFinished() {
        guard phase == .speaking || phase == .thinking else { return }
        if activeSession?.turnInFlight == true { return }
        phase = .idle
        hud.set(phase: .done)
        idleTimer?.invalidate()
        idleTimer = Timer.scheduledTimer(withTimeInterval: 1.6, repeats: false) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.phase == .idle else { return }
                self.overlay.fadeOut(after: 0)
                self.hud.set(phase: .hidden)
            }
        }
    }

    // MARK: Pointing

    private func shot(forScreen screen: Int?) -> ScreenShot? {
        if let screen, screen >= 1, screen <= shots.count { return shots[screen - 1] }
        return shots.first(where: { $0.isCursorScreen }) ?? shots.first
    }

    private func point(pixel: CGPoint, label: String, screen: Int?) {
        guard let shot = shot(forScreen: screen) else { return }
        var target = Coordinates.screenPoint(fromPixel: pixel, in: shot.frame)
        if shot.isCursorScreen, let element = AccessibilityContext.element(near: target, label: label, in: context.elements) {
            target = CGPoint(x: element.frame.midX, y: element.frame.midY)
        }
        target = Coordinates.clamp(target, to: shot.frame.displayFrame)
        overlay.point(at: target, label: label)
    }

    private func highlight(pixelRect: CGRect, label: String, screen: Int?) {
        guard let shot = shot(forScreen: screen) else { return }
        var rect = Coordinates.screenRect(fromPixel: pixelRect, in: shot.frame)
        if shot.isCursorScreen, let element = AccessibilityContext.element(near: CGPoint(x: rect.midX, y: rect.midY), label: label,
                                                                           in: context.elements, maxDistance: 60),
           element.frame.width <= rect.width * 1.5, element.frame.height <= rect.height * 1.5 {
            rect = element.frame
        }
        overlay.highlight(rect.intersection(shot.frame.displayFrame), label: label)
    }

    // MARK: Interrupt

    func interrupt() {
        guard phase != .idle || speaker.isSpeaking else { return }
        stopSpeaking()
        activeSession?.interrupt()
        if phase == .listening { recorder.cancel() }
        levelTimer?.invalidate()
        phase = .idle
        overlay.fadeOut(after: 0)
        hud.set(phase: .hidden)
    }

    private func stopSpeaking() {
        speaker.stop()
        splitter = SentenceSplitter()
    }

    static func friendlyTool(_ name: String) -> String {
        let parts = name.split(separator: "__").map(String.init)
        if parts.count >= 3 { return parts[2...].joined(separator: " ").replacingOccurrences(of: "_", with: " ") }
        return name.lowercased()
    }
}
