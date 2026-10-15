import AppKit
import DotKit
import Foundation

/// The voice loop: hold the key, speak (or draw a box), see the screen, answer aloud beside
/// the cursor, point, ring the next click in a walkthrough, hand real work to an agent.
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
    private let atlas: AtlasBridge
    private let jev: Jev?

    private let recorder = AudioRecorder()
    private var talkSession: ClaudeSession?
    private var thinkSession: ClaudeSession?

    private(set) var phase: Phase = .idle
    private var mode: HotkeyMonitor.Mode = .talk
    private var captureTask: Task<(shots: [ScreenShot], context: ScreenContext), Never>?
    private var shots: [ScreenShot] = []
    private var context = ScreenContext.empty
    private var region: CGRect?
    private var lastMessage = ""
    private var lastImages: [(data: Data, mediaType: String)] = []
    private var responseBuffer = ""
    private var heldBack = ""
    private var splitter = SentenceSplitter()
    private var activeSession: ClaudeSession?
    private var levelTimer: Timer?
    private var idleTimer: Timer?
    private var idleCheckTimer: Timer?
    private var turnStartedAt = Date()
    private var turnModel = ""
    private var turnsInSession = 0
    private var lastTurnAt = Date()
    private var todayStamp: [String: String] = [:]

    /// A step-by-step walkthrough: the ringed control Dot waits for the user to click.
    private struct Walkthrough {
        var target: CGPoint
        var radius: CGFloat
        var label: String
        var step: Int
    }
    private var walkthrough: Walkthrough?
    private var walkthroughTimeout: DispatchWorkItem?

    init(config: DotConfig, hud: NotchHUD, overlay: OverlayManager, speaker: TTSProvider, transcriber: Transcriber,
         agents: AgentManager, ledger: Ledger, atlas: AtlasBridge, jev: Jev?) {
        self.config = config
        self.hud = hud
        self.overlay = overlay
        self.speaker = speaker
        self.transcriber = transcriber
        self.agents = agents
        self.ledger = ledger
        self.atlas = atlas
        self.jev = jev
        self.speaker.onFinishedAll = { [weak self] in
            Task { @MainActor in self?.scheduleIdleCheck() }
        }
        hud.model.onSubmitInput = { [weak self] text in
            Task { @MainActor in self?.askTyped(text) }
        }
    }

    /// Called when Atlas's view of the day arrives or changes.
    func todayArrived(_ brief: TodayBrief) {
        greetIfNew(brief)
    }

    // MARK: Warm up

    func warmUp() {
        Task.detached { [transcriber] in
            do { try await transcriber.warmUp(); Log.info("transcriber ready") } catch { Log.error("transcriber warm-up failed: \(error)") }
        }
        _ = session(for: .talk)
    }

    private enum SessionKind: String { case talk, think }

    private func session(for kind: SessionKind) -> ClaudeSession? {
        switch kind {
        case .talk:
            if let talkSession, talkSession.isRunning {
                let stale = Date().timeIntervalSince(lastTurnAt) > 3 * 3600
                if (turnsInSession >= config.talkSessionMaxTurns || stale), !talkSession.turnInFlight {
                    Log.info("talk: recycling the session after \(turnsInSession) turns\(stale ? " (idle)" : "")")
                    talkSession.stop()
                } else {
                    return talkSession
                }
            }
            turnsInSession = 0
            todayStamp[SessionKind.talk.rawValue] = nil
            talkSession = makeSession(kind: .talk)
            return talkSession
        case .think:
            if let thinkSession, thinkSession.isRunning { return thinkSession }
            todayStamp[SessionKind.think.rawValue] = nil
            thinkSession = makeSession(kind: .think)
            return thinkSession
        }
    }

    private func makeSession(kind: SessionKind) -> ClaudeSession? {
        var options = ClaudeSession.Options(cwd: config.talkRootURL, model: kind == .talk ? config.talkModel : config.thinkModel)
        options.systemPrompt = kind == .talk ? Prompts.talk : Prompts.think
        options.tools = []
        options.maxTurns = 6
        options.settingSources = ""
        options.permissionMode = "default"
        options.mcpConfigPath = config.mcpConfigPath(config.talkMCPConfig)
        options.strictMCP = true
        options.allowedTools = options.mcpConfigPath == nil ? [] : config.talkAllowedTools
        if kind == .talk { options.effort = config.talkEffort }
        let session = ClaudeSession(label: kind.rawValue, claudePath: config.claudeExecutable, options: options)
        session.onEvent = { [weak self, weak session] event in
            guard let self, let session, self.activeSession === session else { return }
            self.handle(event)
        }
        let allowed = Set(config.talkAllowedTools)
        session.permissionHandler = { request, completion in
            if allowed.contains(request.toolName) {
                completion(true, nil)
            } else {
                completion(false, "dot's talk mode only reads; hand this to an agent with [AGENT:...].")
                Log.warn("talk: refused tool \(request.toolName)")
            }
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

    // MARK: Hotkey and mouse

    func hotkey(_ event: HotkeyMonitor.Event) {
        switch event {
        case .pressed(let mode):
            beginListening(mode: mode)
        case .modeChanged(let mode):
            self.mode = mode
            hud.model.mode = mode
        case .released(let mode, let heldFor):
            self.mode = mode
            overlay.setMouseCapture(false)
            endListening(heldFor: heldFor)
        case .escape:
            interrupt()
        case .mouseDown(let point):
            clicked(at: point)
        case .dragChanged(let rect):
            if rect.isNull { region = nil; overlay.setDrawRect(nil) } else { overlay.setDrawRect(rect) }
        case .dragEnded(let rect):
            region = rect
            overlay.setDrawRect(rect)
            hud.flash(status: "asking about the box")
        }
    }

    private func beginListening(mode: HotkeyMonitor.Mode) {
        guard phase == .idle || phase == .speaking || phase == .thinking else { return }
        if phase == .speaking || phase == .thinking { stopSpeaking(); activeSession?.interrupt() }
        self.mode = mode
        idleTimer?.invalidate()
        endWalkthrough(reason: "new question")
        overlay.clearMarks()
        overlay.hideBubble(after: 0)
        overlay.showTransient()
        overlay.setMouseCapture(true)
        region = nil
        do {
            _ = try recorder.start()
        } catch {
            overlay.setMouseCapture(false)
            hud.flash(error: "\(error)")
            return
        }
        phase = .listening
        hud.model.mode = mode
        hud.model.transcript = ""
        hud.model.response = ""
        hud.set(phase: .listening)
        overlay.setPhase(.listening)
        levelTimer?.invalidate()
        levelTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                let level = self.recorder.level()
                self.hud.model.level = level
                self.overlay.setLevel(level)
            }
        }
        startCapture()
    }

    private func startCapture() {
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

        if heldFor < 0.35, region == nil {
            recorder.cancel()
            phase = .idle
            overlay.setPhase(.idle)
            hud.showInput()
            return
        }

        guard let stopped = try? recorder.stop() else {
            phase = .idle
            hud.set(phase: .hidden)
            settle()
            return
        }
        phase = .transcribing
        hud.set(phase: .transcribing)
        overlay.setPhase(.thinking)

        Task { @MainActor in
            let text: String
            do {
                text = try await transcriber.transcribe(wavURL: stopped.url)
            } catch {
                Log.error("transcription failed: \(error)")
                hud.flash(error: "Speech recognition failed: \(error.localizedDescription)")
                phase = .idle
                settle()
                return
            }
            try? FileManager.default.removeItem(at: stopped.url)
            let spoken = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if spoken.count < 2, region != nil {
                hud.model.transcript = "what's this?"
                await ask("what is in the box i drew? tell me what matters here.", typed: false)
                return
            }
            guard spoken.count >= 2 else {
                hud.flash(status: "didn't catch that")
                phase = .idle
                settle()
                return
            }
            hud.model.transcript = spoken
            await ask(spoken, typed: false)
        }
    }

    func askTyped(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        endWalkthrough(reason: "typed question")
        hud.model.transcript = trimmed
        hud.model.response = ""
        overlay.showTransient()
        overlay.clearMarks()
        overlay.hideBubble(after: 0)
        startCapture()
        overlay.setPhase(.thinking)
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
        Log.info("context: app \(context.appName ?? "?") window \(Log.short(context.windowTitle ?? "", 60)) url \(context.url != nil) selected \(context.selectedText?.count ?? 0) elements \(context.elements.count) shots \(shots.count)\(region != nil ? " box" : "")")

        if mode == .agent {
            phase = .idle
            hud.set(phase: .hidden)
            overlay.setPhase(.idle)
            speaker.speak("on it.")
            agents.handoff(brief: text, agentName: nil, context: context, shots: shots)
            region = nil
            settle()
            return
        }

        if let jev, walkthrough == nil {
            let route = await self.route(text, with: jev)
            switch route {
            case .agent:
                phase = .idle
                overlay.setPhase(.speaking)
                speaker.speak("on it, i'll tell you when it's done.")
                overlay.setBubble("on it, i'll tell you when it's done.")
                hud.set(phase: .hidden)
                agents.handoff(brief: text, agentName: nil, context: context, shots: shots)
                region = nil
                scheduleIdleCheck()
                return
            case .followUp(let slug):
                phase = .idle
                overlay.setPhase(.speaking)
                speaker.speak("passing that along.")
                overlay.setBubble("passing that along.")
                hud.set(phase: .hidden)
                agents.reply(to: slug, text: text)
                region = nil
                scheduleIdleCheck()
                return
            case .think:
                if let think = session(for: .think) {
                    speaker.speak("let me think about that for a second.")
                    overlay.setBubble("let me think about that for a second.")
                    let (message, images) = buildMessage(text, kind: .think)
                    lastMessage = message
                    lastImages = images
                    sendTurn(message, images: images, to: think, kind: .think)
                    return
                }
            case .answer:
                break
            }
        }

        guard let session = session(for: .talk) else {
            phase = .idle
            settle()
            return
        }
        let (message, images) = buildMessage(text, kind: .talk)
        lastMessage = message
        lastImages = images
        sendTurn(message, images: images, to: session, kind: .talk)
    }

    private enum Route { case answer, agent, think, followUp(String) }

    /// One Jev call (about 150 ms) while the screen capture finishes: where does this go, and
    /// which element did he mean. A confident "agent" skips the talk model entirely; a likely
    /// element gets the dot moving before Claude has said a word.
    private func route(_ text: String, with jev: Jev) async -> Route {
        let running = agents.runningAgents()
        var state: [String: Any] = [
            "user_said": text,
            "frontmost_app": context.appName ?? "",
            "window_title": String((context.windowTitle ?? "").prefix(120)),
            "agents_working": running.map { ["name": $0.name, "task": $0.task] },
            "elements_on_screen": context.elements.prefix(40).map { "\($0.role.dropFirst(2)) \($0.title)" },
        ]
        if let selected = context.selectedText, !selected.isEmpty { state["selected_text"] = String(selected.prefix(200)) }
        var questions: [String: Jev.Question] = [
            "route": .choice(instructions: "How should a voice companion that can see the screen handle what the user just said? Pick one.", criteria: [
                "answer": "answer out loud in a sentence or two from the screen, the day's calendar and deadlines, or general knowledge; no files, no browsing, nothing to operate",
                "agent": "real work in the background: looking something up properly across apps or sites, drafting or writing, making or changing files, going through mail, operating an app for a while, anything that sends or submits",
                "think": "a hard reasoning question (a calculation, a tricky technical or finance judgment) that deserves a stronger model",
            ]),
        ]
        if !running.isEmpty {
            questions["followup"] = .yesNo(instructions: "Is this a follow-up, a steer or a question for the agent that is already working, rather than a new request?", yes: "it continues the agent's current task", no: "a new request or a question about the screen")
        }
        var elementCriteria: [String: String] = [:]
        for (index, element) in context.elements.prefix(40).enumerated() where !element.title.isEmpty {
            elementCriteria["e\(index)"] = String(element.title.prefix(60))
        }
        if elementCriteria.count >= 2 {
            elementCriteria["none"] = "the user is not asking about one specific element on screen"
            questions["element"] = .choice(instructions: "If the user is asking where something is, how to do something here, or about one specific control, which on-screen element do they mean?", criteria: elementCriteria)
        }
        let answers: [String: Jev.Answer]? = await withCheckedContinuation { continuation in
            jev.evaluate("route", state: state, questions: questions) { continuation.resume(returning: $0) }
        }
        guard let answers, let route = answers["route"]?.choice else { return .answer }
        if let follow = answers["followup"]?.probability, follow >= 0.7, let live = running.first {
            Log.info("jev: follow-up for \(live.name) (\(String(format: "%.2f", follow)))")
            return .followUp(live.slug)
        }
        if let element = answers["element"]?.choice, element.choice != "none", element.probability >= 0.5, element.confidence >= 0.5,
           let index = Int(element.choice.dropFirst()), context.elements.indices.contains(index) {
            let hit = context.elements[index]
            Log.info("jev: pre-pointing at \(hit.role) \"\(hit.title)\" (\(String(format: "%.2f", element.probability)))")
            overlay.point(at: CGPoint(x: hit.frame.midX, y: hit.frame.midY), label: String(hit.title.prefix(24)))
        }
        if route.choice == "agent", route.probability >= config.jevRouteThreshold, route.confidence >= 0.6 { return .agent }
        if route.choice == "think", route.probability >= 0.75, route.confidence >= 0.6 { return .think }
        return .answer
    }

    private func sendTurn(_ message: String, images: [(data: Data, mediaType: String)], to session: ClaudeSession, kind: SessionKind) {
        // A new question supersedes the one still being answered, like talking over someone.
        if let active = activeSession, active.turnInFlight {
            active.interrupt()
            stopSpeaking()
        }
        hud.hideInput()
        activeSession = session
        responseBuffer = ""
        heldBack = ""
        splitter = SentenceSplitter()
        turnStartedAt = Date()
        lastTurnAt = Date()
        if kind == .talk { turnsInSession += 1 }
        turnModel = kind == .talk ? config.talkModel : config.thinkModel
        phase = .thinking
        hud.set(phase: .thinking)
        overlay.setPhase(.thinking)
        if let brief = atlas.brief { todayStamp[kind.rawValue] = brief.builtAt }
        session.send(text: message, images: images)
        Log.info("turn[\(kind.rawValue)] sent \(images.count) image(s), \(message.count) chars: \(Log.short(hud.model.transcript))")
    }

    /// The user message: today's shape from Atlas (when it changed), the screen context, the
    /// element list, the box he drew, then his words. Returns the text and the images to attach.
    private func buildMessage(_ transcript: String, kind: SessionKind) -> (String, [(data: Data, mediaType: String)]) {
        var lines: [String] = []
        if let brief = atlas.brief, !brief.block.isEmpty {
            if todayStamp[kind.rawValue] != brief.builtAt {
                lines.append(brief.block)
            } else {
                lines.append("[today] unchanged since \(brief.builtAt.suffix(5)) [/today]")
            }
            lines.append("")
        }
        var images = shots.map { (data: $0.jpeg, mediaType: "image/jpeg") }
        lines.append("[context]")
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
        let cursorIndex = shots.firstIndex(where: { $0.isCursorScreen }) ?? 0
        let cursorShot = shots.indices.contains(cursorIndex) ? shots[cursorIndex] : nil
        var boxPixels: CGRect?
        if let region, let cursorShot {
            let pixels = Coordinates.pixelRect(fromScreen: region, in: cursorShot.frame)
            if pixels.width > 2, pixels.height > 2 {
                boxPixels = pixels
                if let crop = ImageCrop.crop(jpeg: cursorShot.jpeg, pixelRect: pixels) {
                    images.append((data: crop.data, mediaType: "image/jpeg"))
                    lines.append("he drew a box on image \(cursorIndex + 1) at \(Int(pixels.minX)),\(Int(pixels.minY)) size \(Int(pixels.width))x\(Int(pixels.height)) pixels; image \(images.count) is that region enlarged (\(crop.width)x\(crop.height)). answer about what is in the box.")
                } else {
                    lines.append("he drew a box on image \(cursorIndex + 1) at \(Int(pixels.minX)),\(Int(pixels.minY)) size \(Int(pixels.width))x\(Int(pixels.height)) pixels. answer about what is in the box.")
                }
            }
        }
        if let cursorShot, !context.elements.isEmpty {
            lines.append("elements on the cursor's screen (role, label, center x,y in image \(cursorIndex + 1)\(boxPixels != nil ? "; (in box) marks those inside his box" : "")):")
            var count = 0
            for element in context.elements {
                let center = CGPoint(x: element.frame.midX, y: element.frame.midY)
                guard let pixel = Coordinates.pixelPoint(fromScreen: center, in: cursorShot.frame) else { continue }
                count += 1
                let role = element.role.hasPrefix("AX") ? String(element.role.dropFirst(2)) : element.role
                let inBox = boxPixels.map { $0.insetBy(dx: -4, dy: -4).contains(pixel) } ?? false
                lines.append("\(count). \(role) \"\(element.title)\" \(Int(pixel.x)),\(Int(pixel.y))\(inBox ? " (in box)" : "")")
            }
        }
        lines.append("[/context]")
        lines.append("")
        lines.append(transcript)
        return (lines.joined(separator: "\n"), images)
    }

    // MARK: Streaming

    private func handle(_ event: StreamEvent) {
        switch event {
        case .textDelta(let delta):
            responseBuffer += delta
            let (speak, hold) = TagParser.speakablePrefix(heldBack + delta)
            heldBack = hold
            for sentence in splitter.feed(speak) { say(sentence) }
            let spoken = TagParser.parse(responseBuffer).spoken
            if config.hudShowsResponse { hud.model.response = spoken }
            if config.bubbleText { overlay.setBubble(spoken) }
        case .assistantText(let text):
            if responseBuffer.isEmpty { responseBuffer = text }
        case .toolUse(_, let name, let input):
            Log.info("talk: tool \(name) \(Log.short(input.map { "\($0.key)=\($0.value.json)" }.joined(separator: " "), 120))")
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
            overlay.setPhase(.speaking)
            if config.hudShowsResponse {
                hud.set(phase: .speaking)
            } else {
                // The answer lives in the bubble beside Dot; the notch steps back unless it holds agents or a card.
                hud.set(phase: .hidden)
            }
        }
        speaker.speak(clean)
    }

    private func finishTurn(_ result: ResultInfo) {
        let full = responseBuffer.isEmpty ? (result.resultText ?? "") : responseBuffer
        let parsed = TagParser.parse(full)
        if let rest = splitter.flush() { say(rest) }
        if config.hudShowsResponse { hud.model.response = parsed.spoken }
        if config.bubbleText, !parsed.spoken.isEmpty { overlay.setBubble(parsed.spoken) }
        let kind = activeSession === thinkSession ? "think" : "talk"
        ledger.record(kind: kind, agent: nil, model: turnModel, result: result, summary: hud.model.transcript)
        Log.info("turn[\(kind)] done in \(result.durationMs) ms, $\(String(format: "%.4f", result.costUSD)), tags \(parsed.tags.map { "\($0)" }.joined(separator: " | "))")
        Log.info("turn[\(kind)] said: \(Log.short(parsed.spoken, 240))")
        if result.isError, parsed.spoken.isEmpty {
            hud.flash(error: Log.short(result.resultText ?? "the turn failed", 160))
        }

        var escalated = false
        var ringed = false
        for tag in parsed.tags {
            switch tag {
            case .point(let x, let y, let label, let screen):
                point(pixel: CGPoint(x: x, y: y), label: label, screen: screen)
            case .highlight(let x, let y, let w, let h, let label, let screen):
                highlight(pixelRect: CGRect(x: x, y: y, width: w, height: h), label: label, screen: screen)
            case .target(let x, let y, let radius, let label, let screen):
                ringed = target(pixel: CGPoint(x: x, y: y), radius: CGFloat(radius), label: label, screen: screen)
            case .pointNone:
                break
            case .agent(let brief):
                agents.handoff(brief: brief, agentName: nil, context: context, shots: shots)
            case .newAgent(let name, let brief):
                agents.handoff(brief: brief, agentName: name, context: context, shots: shots)
            case .think:
                if kind == "talk", let think = session(for: .think) {
                    escalated = true
                    let (message, images) = buildMessage(hud.model.transcript, kind: .think)
                    // Let the "let me think" sentence finish, then ask the stronger model.
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
                        guard let self else { return }
                        self.sendTurn(message, images: images, to: think, kind: .think)
                    }
                }
            }
        }
        if !ringed, walkthrough != nil { endWalkthrough(reason: "step without a target") }
        region = nil
        overlay.setDrawRect(nil)
        responseBuffer = ""
        heldBack = ""
        if escalated { return }
        scheduleIdleCheck()
    }

    /// Polled after a result and when the speaker drains: with nothing speaking and no turn in
    /// flight, settle back to idle, hide the notch, and let Dot drift back to the cursor.
    private func scheduleIdleCheck() {
        idleCheckTimer?.invalidate()
        idleCheckTimer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { [weak self] timer in
            Task { @MainActor in
                guard let self else { timer.invalidate(); return }
                if self.phase == .listening || self.phase == .transcribing { timer.invalidate(); return }
                if self.activeSession?.turnInFlight == true || self.speaker.isSpeaking { return }
                timer.invalidate()
                self.phase = .idle
                self.overlay.setPhase(.idle)
                self.hud.set(phase: .done)
                self.idleTimer?.invalidate()
                self.idleTimer = Timer.scheduledTimer(withTimeInterval: 1.6, repeats: false) { [weak self] _ in
                    Task { @MainActor in
                        guard let self, self.phase == .idle else { return }
                        self.hud.set(phase: .hidden)
                    }
                }
                self.settle()
            }
        }
    }

    /// Bubble fades, marks clear and Dot returns to the cursor, unless a walkthrough is waiting for a click.
    private func settle() {
        overlay.setPhase(.idle)
        overlay.hideBubble(after: walkthrough == nil ? 4.0 : 12.0)
        if walkthrough == nil {
            overlay.release(after: 2.5)
            overlay.releaseTransient(after: 5.0)
        }
    }

    // MARK: Pointing

    private func shot(forScreen screen: Int?) -> ScreenShot? {
        if let screen, screen >= 1, screen <= shots.count { return shots[screen - 1] }
        return shots.first(where: { $0.isCursorScreen }) ?? shots.first
    }

    private func snapped(pixel: CGPoint, label: String, in shot: ScreenShot) -> (point: CGPoint, element: AXElementInfo?) {
        var target = Coordinates.screenPoint(fromPixel: pixel, in: shot.frame)
        var hit: AXElementInfo?
        if shot.isCursorScreen, let element = AccessibilityContext.element(near: target, label: label, in: context.elements) {
            target = CGPoint(x: element.frame.midX, y: element.frame.midY)
            hit = element
        }
        return (Coordinates.clamp(target, to: shot.frame.displayFrame), hit)
    }

    private func point(pixel: CGPoint, label: String, screen: Int?) {
        guard let shot = shot(forScreen: screen) else { return }
        let (target, _) = snapped(pixel: pixel, label: label, in: shot)
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

    /// Ring the next control and wait for the click. Returns false when the walkthrough has run long enough.
    private func target(pixel: CGPoint, radius: CGFloat, label: String, screen: Int?) -> Bool {
        guard let shot = shot(forScreen: screen) else { return false }
        let step = (walkthrough?.step ?? 0) + 1
        if step > config.walkthroughMaxSteps {
            Log.info("walkthrough: stopping at step \(step), max reached")
            endWalkthrough(reason: "max steps")
            return false
        }
        let raw = Coordinates.screenPoint(fromPixel: pixel, in: shot.frame)
        var target = Coordinates.clamp(raw, to: shot.frame.displayFrame)
        var screenRadius = radius * (shot.frame.displayFrame.width / CGFloat(max(shot.frame.pixelWidth, 1)))
        // Snap to an element only when it is control-sized and clearly the one meant: a label match,
        // or the point landing inside it. A window-sized "nearest" element would swallow the ring.
        if shot.isCursorScreen, let element = AccessibilityContext.element(near: raw, label: label, in: context.elements, maxDistance: 60),
           max(element.frame.width, element.frame.height) <= 360,
           element.frame.insetBy(dx: -8, dy: -8).contains(raw) || element.title.lowercased().contains(label.lowercased()) {
            target = CGPoint(x: element.frame.midX, y: element.frame.midY)
            screenRadius = max(screenRadius, max(element.frame.width, element.frame.height) / 2 + 6)
        }
        screenRadius = min(max(screenRadius, 14), 90)
        walkthrough = Walkthrough(target: target, radius: screenRadius, label: label, step: step)
        overlay.target(at: target, radius: screenRadius, label: label)
        hud.flash(status: "step \(step): click \(label)", for: 6)
        walkthroughTimeout?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.endWalkthrough(reason: "no click in 90 s") }
        walkthroughTimeout = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 90, execute: work)
        return true
    }

    private func clicked(at point: CGPoint) {
        guard let step = walkthrough else { return }
        let distance = hypot(point.x - step.target.x, point.y - step.target.y)
        guard distance <= step.radius * 1.6 + 16 else { return }
        Log.info("walkthrough: click on \(step.label) (step \(step.step)), \(Int(distance)) pt from center")
        walkthroughTimeout?.cancel()
        overlay.clearRing()
        hud.flash(status: "saw the click, looking", for: 3)
        stopSpeaking()
        // Give the app a moment to redraw what the click opened, then ask for the next step.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) { [weak self] in
            guard let self, self.walkthrough?.step == step.step else { return }
            self.startCapture()
            Task { @MainActor in
                if let captureTask = self.captureTask {
                    let captured = await captureTask.value
                    self.shots = captured.shots
                    self.context = captured.context
                }
                self.captureTask = nil
                guard let session = self.session(for: .talk) else { return }
                self.hud.model.transcript = "[clicked \(step.label)]"
                let (message, images) = self.buildMessage("[clicked_on_target] i clicked \(step.label) (step \(step.step)). what's next? if that finished it, say so with no tag.", kind: .talk)
                self.lastMessage = message
                self.lastImages = images
                self.sendTurn(message, images: images, to: session, kind: .talk)
            }
        }
    }

    private func endWalkthrough(reason: String) {
        guard walkthrough != nil else { return }
        Log.info("walkthrough: ended (\(reason))")
        walkthrough = nil
        walkthroughTimeout?.cancel()
        overlay.clearRing()
        if phase == .idle { settle() }
    }

    // MARK: Greeting

    private func greetIfNew(_ brief: TodayBrief) {
        guard config.morningGreeting else { return }
        let key = "dot.greeted.\(brief.date)"
        guard !UserDefaults.standard.bool(forKey: key) else { return }
        let line = brief.morningLine()
        guard !line.isEmpty else { return }
        UserDefaults.standard.set(true, forKey: key)
        let hour = Calendar.current.component(.hour, from: Date())
        let opener = hour < 12 ? "morning." : (hour < 17 ? "afternoon." : "evening.")
        overlay.greet("\(opener) \(line).", for: 10)
        Log.info("greeting: \(line)")
    }

    // MARK: Interrupt

    func interrupt() {
        let wasBusy = phase != .idle || speaker.isSpeaking || walkthrough != nil
        stopSpeaking()
        activeSession?.interrupt()
        if phase == .listening { recorder.cancel(); overlay.setMouseCapture(false) }
        levelTimer?.invalidate()
        phase = .idle
        endWalkthrough(reason: "escape")
        overlay.clearMarks()
        overlay.hideBubble(after: 0)
        overlay.setPhase(.idle)
        overlay.releaseTransient(after: 0.3)
        hud.set(phase: .hidden)
        if wasBusy { Log.info("interrupted") }
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
