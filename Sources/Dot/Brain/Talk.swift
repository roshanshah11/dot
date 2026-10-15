import AVFoundation
import FluidAudio
import AppKit
import DotKit
import Foundation

/// The voice loop: hold the key, speak (or draw a box), see the screen, answer aloud beside
/// the cursor in beats that land on what they describe, walk him through a task one click at
/// a time, hand real work to an agent.
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
    private let driver = Driver()
    let board: BoardManager

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
    private var streamer = BeatStreamer()
    private var activeSession: ClaudeSession?
    private var levelTimer: Timer?
    private var idleTimer: Timer?
    private var idleCheckTimer: Timer?
    private var turnStartedAt = Date()
    private var turnModel = ""
    private var turnsInSession = 0
    private var lastTurnAt = Date()

    // Beats: what the bubble shows follows the voice, not the text stream.
    private var speechStarted = false
    private var bubbleGroup = ""
    private var bubbleLabel: String?
    /// A quiet turn (tests, `Dot --ask --quiet`) paces its beats on a timer instead of the voice.
    private var quietTurn = false
    private var quietWork: [DispatchWorkItem] = []
    private var quietClock = Date()
    private var beatsFired = 0

    /// A step-by-step walkthrough: the ringed control Dot waits for him to click (or rest on).
    private struct Walkthrough {
        enum Kind { case click, hover }
        var kind: Kind
        var target: CGPoint
        var radius: CGFloat
        var label: String
        var step: Int
        var appBundle: String?
        var history: [String] = []
        var offTargetClicks = 0
        var userActedWhileWaiting = false
        /// The step was completed and the next one is being asked for.
        var awaitingNextStep = false
        var hoverSince: Date?
        /// Dot clicks the steps itself while he watches.
        var driving = false
    }
    private var walkthrough: Walkthrough?
    private var walkthroughTimeout: DispatchWorkItem?
    private var hoverTimer: Timer?
    /// He asked Dot to do the clicking for the walkthrough about to start.
    private var driveRequested = false
    private static let driveWords = try! NSRegularExpression(pattern: #"\b(do it( for me)?|you (do|click) it|take over|take the (mouse|wheel)|click (it|them|through)( for me)?|drive|go ahead and do it)\b"#, options: .caseInsensitive)

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
        self.board = BoardManager(accentHex: config.pointerColorHex)
        (speaker as? CommandSpeaker)?.warm(Self.acks + Self.thinkAcks)
        self.speaker.onFinishedAll = { [weak self] in
            Task { @MainActor in self?.scheduleIdleCheck() }
        }
        hud.model.onSubmitInput = { [weak self] text in
            Task { @MainActor in
                guard let self else { return }
                if self.pendingRegionAgent { self.pendingRegionAgent = false; self.handRegionToAgent(text) } else { self.askTyped(text) }
            }
        }
        driver.onAbort = { [weak self] what in
            guard let self else { return }
            self.walkthrough?.driving = false
            self.driveRequested = false
            self.speaker.speak("okay, you've got it.")
            self.overlay.setBubble("okay, you've got it.", label: nil)
        }
        NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] note in
            guard let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication else { return }
            Task { @MainActor in self?.appActivated(app) }
        }
    }

    /// Called when Atlas's view of the day arrives or changes.
    func todayArrived(_ brief: TodayBrief) {
        greetIfNew(brief)
    }

    // MARK: Warm up

    func warmUp() {
        Task.detached { [transcriber] in
            do {
                try await transcriber.warmUp()
                Log.info("transcriber ready")
                await MainActor.run { self.prepareStream() }
            } catch { Log.error("transcriber warm-up failed: \(error)") }
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
            talkSession = makeSession(kind: .talk)
            return talkSession
        case .think:
            if let thinkSession, thinkSession.isRunning { return thinkSession }
            thinkSession = makeSession(kind: .think)
            return thinkSession
        }
    }

    private func makeSession(kind: SessionKind) -> ClaudeSession? {
        var options = ClaudeSession.Options(cwd: config.talkRootURL, model: kind == .talk ? config.talkModel : config.thinkModel)
        options.systemPrompt = (kind == .talk ? Prompts.talk : Prompts.think) + Prompts.contextFiles(in: config.talkRootURL)
        options.tools = ["Bash", "WebSearch", "WebFetch"]
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
        let allowed = Set(config.talkAllowedTools + ["WebSearch", "WebFetch"])
        session.permissionHandler = { request, completion in
            if allowed.contains(request.toolName) || Talk.isComputation(request) {
                completion(true, nil)
            } else {
                completion(false, "dot's talk mode only reads, remembers and computes with python; hand this to an agent with [AGENT:...].")
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
            if mode == .dictate { beginDictation() } else { beginListening(mode: mode) }
        case .modeChanged(let mode):
            self.mode = mode
            hud.model.mode = mode
        case .released(let mode, let heldFor):
            self.mode = mode
            overlay.setMouseCapture(false)
            if mode == .dictate { endDictation(heldFor: heldFor) } else { endListening(heldFor: heldFor) }
        case .escape:
            interrupt()
        case .mouseDown(let point, let own):
            clicked(at: point, own: own)
        case .dragChanged(let rect):
            if rect.isNull { region = nil; overlay.setDrawRect(nil) } else { overlay.setDrawRect(rect) }
        case .dragPath(let points):
            overlay.setDrawPath(points)
        case .dragEnded(let rect):
            region = rect
            overlay.setDrawRect(rect)
            hud.flash(status: "asking about what you circled")
        }
    }

    private func beginListening(mode: HotkeyMonitor.Mode) {
        guard phase == .idle || phase == .speaking || phase == .thinking else { return }
        if phase == .speaking || phase == .thinking { stopSpeaking(); activeSession?.interrupt() }
        self.mode = mode
        quietTurn = false   // a spoken question is always answered aloud, whatever the last test turn was
        idleTimer?.invalidate()
        overlay.clearMarks(keepRing: walkthrough != nil)
        overlay.hideBubble(after: 0)
        overlay.showTransient()
        overlay.setMouseCapture(true)
        region = nil
        let live = config.streamingTranscription ? readyStream : nil
        readyStream = nil
        do {
            _ = try recorder.start(stream: live)
        } catch {
            overlay.setMouseCapture(false)
            hud.flash(error: "\(error)")
            return
        }
        startPartials(live)
        phase = .listening
        overlay.setMood(.focused)
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
            stopPartials(cancel: true)
            phase = .idle
            hud.set(phase: .hidden)
            settle()
            return
        }
        phase = .transcribing
        hud.set(phase: .transcribing)
        overlay.setPhase(.thinking)
        overlay.setMood(.neutral)
        let live = liveStream
        stopPartials(cancel: false)

        Task { @MainActor in
            let text: String
            do {
                text = try await finalText(from: live, wavURL: stopped.url)
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
                showRegionBar()
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

    var isIdle: Bool { phase == .idle && walkthrough == nil }

    // MARK: A circled region with nothing said

    private var pendingRegionAgent = false
    private var regionTextCache: String?

    /// He drew around something and let go without a word: offer what to do with it.
    private func showRegionBar() {
        guard let region else { return }
        phase = .idle
        hud.set(phase: .hidden)
        overlay.setPhase(.idle)
        regionTextCache = nil
        let accent = hud.model.accent
        ActionBarPanel.show(near: region, accent: accent, actions: [
            .init(title: "ask", icon: "bubble.left") { [weak self] in
                ActionBarPanel.dismiss()
                self?.hud.model.inputPrompt = "what about it?"
                self?.hud.showInput()
            },
            .init(title: "to an agent", icon: "person.badge.clock") { [weak self] in
                ActionBarPanel.dismiss()
                self?.pendingRegionAgent = true
                self?.hud.model.inputPrompt = "what should the agent do with it?"
                self?.hud.showInput()
            },
            .init(title: "copy text", icon: "doc.on.doc") { [weak self] in
                ActionBarPanel.dismiss()
                Task { @MainActor in
                    guard let self else { return }
                    let text = await self.regionText()
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(text, forType: .string)
                    let words = text.split(whereSeparator: { $0.isWhitespace }).count
                    self.hud.flash(status: words == 0 ? "no text in there" : "copied \(words) word\(words == 1 ? "" : "s")", for: 3)
                    self.clearRegion()
                }
            },
            .init(title: "look it up", icon: "magnifyingglass") { [weak self] in
                ActionBarPanel.dismiss()
                Task { @MainActor in
                    guard let self else { return }
                    let text = await self.regionText()
                    let head = String(text.replacingOccurrences(of: "\n", with: " ").prefix(240))
                    self.askTyped(head.isEmpty ? "look up what i circled and tell me what it is." : "look this up and tell me what it is: \(head)")
                }
            }
        ]) { [weak self] in self?.clearRegion() }
        hud.flash(status: "circled it: ask, hand it off, copy its text, or look it up", for: 6)
    }

    private func clearRegion() {
        region = nil
        pendingRegionAgent = false
        overlay.setDrawRect(nil)
        settle()
    }

    /// The circled region cut from the cursor screen's screenshot.
    private func regionCrop() async -> (data: Data, width: Int, height: Int)? {
        if let captureTask {
            let captured = await captureTask.value
            shots = captured.shots
            context = captured.context
            self.captureTask = nil
        }
        guard let region, let shot = shots.first(where: { $0.isCursorScreen }) ?? shots.first else { return nil }
        let pixels = Coordinates.pixelRect(fromScreen: region, in: shot.frame)
        guard pixels.width > 2, pixels.height > 2 else { return nil }
        return ImageCrop.crop(jpeg: shot.jpeg, pixelRect: pixels)
    }

    private func regionText() async -> String {
        if let regionTextCache { return regionTextCache }
        guard let crop = await regionCrop() else { return "" }
        let text = await TextRecognizer.recognize(jpeg: crop.data)
        regionTextCache = text
        return text
    }

    /// The region, its text and his brief go to an agent together.
    private func handRegionToAgent(_ brief: String) {
        let trimmed = brief.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { clearRegion(); return }
        Task { @MainActor in
            let crop = await regionCrop()
            let text = await regionText()
            var note = "He circled a region of his screen while asking this; the last attached image is that region, enlarged."
            if !text.isEmpty { note += " Its text reads:\n" + text }
            speaker.speak("on it.")
            agents.handoff(brief: trimmed, agentName: nil, context: context, shots: shots,
                           extraImages: crop.map { [(data: $0.data, mediaType: "image/jpeg")] } ?? [], note: note)
            clearRegion()
        }
    }
    private var lastAskWasTyped = false
    private var lastAsked = ""

    // MARK: Streaming transcription

    /// A recognizer made ahead of time so the key press costs nothing; replaced after each use.
    private var readyStream: SlidingWindowAsrManager?
    private var liveStream: SlidingWindowAsrManager?
    private var partialTask: Task<Void, Never>?
    private var partialText = ""

    func prepareStream() {
        guard config.streamingTranscription, readyStream == nil else { return }
        Task { @MainActor in
            do {
                let stream = try await transcriber.makeStream()
                if readyStream == nil { readyStream = stream }
            } catch {
                Log.warn("streaming transcription unavailable: \(error)")
            }
        }
    }

    private func startPartials(_ stream: SlidingWindowAsrManager?) {
        liveStream = stream
        partialText = ""
        guard let stream else { return }
        partialTask = Task { @MainActor in
            do { try await stream.startStreaming(source: .microphone) } catch { Log.warn("stream start: \(error)"); return }
            for await update in await stream.transcriptionUpdates {
                if Task.isCancelled { break }
                let text = update.text.trimmingCharacters(in: .whitespaces)
                guard !text.isEmpty else { continue }
                partialText = text
                hud.model.transcript = text
                overlay.setChip(Log.short(text, 48))
            }
        }
    }

    private func stopPartials(cancel: Bool) {
        partialTask?.cancel()
        partialTask = nil
        overlay.setChip(nil)
        if cancel, let stream = liveStream { Task { await stream.cancel() } }
        if cancel { liveStream = nil }
        prepareStream()
    }

    /// The streamed recognizer's full text when it has one, else the WAV through the offline model.
    private func finalText(from stream: SlidingWindowAsrManager?, wavURL: URL) async throws -> String {
        if let stream {
            let started = Date()
            if let text = try? await stream.finish(), !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Log.info("transcript (streamed) in \(Int(Date().timeIntervalSince(started) * 1000)) ms")
                liveStream = nil
                return text
            }
            liveStream = nil
        }
        return try await transcriber.transcribe(wavURL: wavURL)
    }

    /// A card from a file on disk, for `Dot --card file.html`: the file's first <h2> is the title.
    func showCardFile(_ path: String) {
        let url = URL(fileURLWithPath: (path as NSString).expandingTildeInPath)
        guard let html = try? String(contentsOf: url, encoding: .utf8) else { Log.error("card: cannot read \(url.path)"); return }
        let title = html.range(of: #"<h2[^>]*>([^<]*)</h2>"#, options: .regularExpression).map { String(html[$0]).replacingOccurrences(of: #"<[^>]+>"#, with: "", options: .regularExpression) } ?? url.deletingPathExtension().lastPathComponent
        Task { @MainActor in
            let shots = (try? await ScreenCapture.captureAll(maxDimension: config.screenshotMaxDimension, includeOtherScreens: false)) ?? []
            self.shots = shots
            context = AccessibilityContext.capture(maxElements: 10)
            showCard(id: url.deletingPathExtension().lastPathComponent, rect: nil, title: title, html: html, screen: nil)
            board.reveal(id: url.deletingPathExtension().lastPathComponent, step: 1) { _ in }
        }
    }

    /// Pushes a WAV through the streaming recognizer the way the microphone would, logging each
    /// partial and the final text with timings. For `Dot --stt file.wav`.
    func streamingSelfTest(wavPath: String) async {
        let url = URL(fileURLWithPath: (wavPath as NSString).expandingTildeInPath)
        guard let file = try? AVAudioFile(forReading: url) else { Log.error("stt test: cannot read \(url.path)"); return }
        let stream: SlidingWindowAsrManager
        do { stream = try await transcriber.makeStream() } catch { Log.error("stt test: \(error)"); return }
        let started = Date()
        let format = file.processingFormat
        let chunk = AVAudioFrameCount(format.sampleRate * 0.1)
        let consumer = Task {
            do { try await stream.startStreaming(source: .microphone) } catch { Log.error("stt test start: \(error)"); return }
            for await update in await stream.transcriptionUpdates {
                Log.info("stt test partial +\(Int(Date().timeIntervalSince(started) * 1000)) ms\(update.isConfirmed ? " (confirmed)" : ""): \(update.text)")
            }
        }
        while file.framePosition < file.length {
            guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: chunk) else { break }
            do { try file.read(into: buffer, frameCount: chunk) } catch { break }
            if buffer.frameLength == 0 { break }
            await stream.streamAudio(buffer)
            try? await Task.sleep(nanoseconds: 100_000_000)   // real time, like the microphone
        }
        let final = (try? await stream.finish()) ?? "(failed)"
        consumer.cancel()
        Log.info("stt test final +\(Int(Date().timeIntervalSince(started) * 1000)) ms: \(final)")
        hud.flash(status: "stt test: \(Log.short(final, 80))", for: 5)
    }

    // MARK: Dictation

    /// Hold control and fn: what he says lands in the field he is typing in.
    private func beginDictation() {
        guard phase == .idle else { return }
        quietTurn = false
        let live = config.streamingTranscription ? readyStream : nil
        readyStream = nil
        do { _ = try recorder.start(stream: live) } catch { hud.flash(error: "\(error)"); return }
        startPartials(live)
        phase = .listening
        mode = .dictate
        hud.model.mode = .dictate
        hud.model.transcript = ""
        hud.model.response = ""
        hud.set(phase: .listening)
        overlay.showTransient()
        overlay.setPhase(.listening)
        overlay.setMood(.focused)
        levelTimer?.invalidate()
        levelTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                let level = self.recorder.level()
                self.hud.model.level = level
                self.overlay.setLevel(level)
            }
        }
    }

    private func endDictation(heldFor: TimeInterval) {
        guard phase == .listening else { return }
        levelTimer?.invalidate()
        levelTimer = nil
        hud.model.level = 0
        overlay.setLevel(0)
        guard heldFor >= 0.35, let stopped = try? recorder.stop() else {
            recorder.cancel()
            stopPartials(cancel: true)
            phase = .idle
            hud.set(phase: .hidden)
            overlay.setPhase(.idle)
            settle()
            return
        }
        let live = liveStream
        stopPartials(cancel: false)
        phase = .transcribing
        hud.set(phase: .transcribing)
        overlay.setMood(.neutral)
        Task { @MainActor in
            defer { phase = .idle; overlay.setPhase(.idle); settle() }
            let text: String
            do { text = try await finalText(from: live, wavURL: stopped.url) } catch {
                hud.flash(error: "didn't catch that: \(error.localizedDescription)"); return
            }
            try? FileManager.default.removeItem(at: stopped.url)
            let cleaned = SpeechText.dictated(text)
            guard !cleaned.isEmpty else { hud.flash(status: "didn't catch that"); return }
            hud.model.transcript = cleaned
            let method = TextInjection.insert(cleaned)
            switch method {
            case .accessibility: hud.flash(status: "typed it", for: 2)
            case .paste: hud.flash(status: "pasted it", for: 2)
            case .clipboard: hud.flash(status: "on your clipboard, press command v", for: 6)
            }
            hud.set(phase: .hidden)
            Log.info("dictation (\(method.rawValue)): \(Log.short(cleaned, 120))")
            TranscriptLog.append(kind: .dictation, you: cleaned, dot: nil, app: AccessibilityContext.frontmostAppName(), extra: ["via": method.rawValue])
        }
    }

    func askTyped(_ text: String, quiet: Bool = false, drive: Bool = false) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        if phase == .speaking || phase == .thinking { stopSpeaking(); activeSession?.interrupt() }
        quietTurn = quiet
        if drive, config.driveEnabled { driveRequested = true }
        hud.model.transcript = trimmed
        hud.model.response = ""
        overlay.showTransient()
        overlay.clearMarks(keepRing: walkthrough != nil)
        overlay.hideBubble(after: 0)
        startCapture()
        overlay.setPhase(.thinking)
        Task { @MainActor in await ask(trimmed, typed: true) }
    }

    // MARK: Asking

    private func ask(_ text: String, typed: Bool) async {
        lastAskWasTyped = typed
        lastAsked = text
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

        let route = await self.route(text)
        switch route {
        case .continueWalkthrough:
            if walkthrough != nil { continueWalkthrough(said: text) } else { continueBoard(said: text) }
            return
        case .closeBoard:
            clearBoard()
            phase = .idle
            overlay.setPhase(.speaking)
            speaker.speak("closed.")
            overlay.setBubble("closed.")
            scheduleIdleCheck()
            return
        case .drive:
            startDriving()
            return
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

        guard let session = session(for: .talk) else {
            phase = .idle
            settle()
            return
        }
        acknowledge()
        let (message, images) = buildMessage(text, kind: .talk)
        lastMessage = message
        lastImages = images
        sendTurn(message, images: images, to: session, kind: .talk)
    }

    /// He spoke while a card still has hidden steps ("next", an answer to a question, "why"):
    /// the model reveals the next step or responds, with the board's state in front of it.
    private func continueBoard(said text: String) {
        guard let session = session(for: .talk) else { return }
        acknowledge()
        let message = "[board] he said: \"\(text)\". if that answers a question you asked, grade it in a sentence first. then reveal the next step with [REVEAL:id:n] and explain it, or answer what he asked and keep the board as it is; when the card is done, say so."
        let (built, images) = buildMessage(message, kind: .talk)
        lastMessage = built
        lastImages = images
        sendTurn(built, images: images, to: session, kind: .talk)
    }

    private enum Route { case answer, agent, think, followUp(String), continueWalkthrough, drive, closeBoard }

    /// Said the instant a question is understood, before Claude's first word: no dead air.
    static let acks = ["mm-hm.", "okay.", "let me look.", "one sec.", "let me see.", "right."]
    static let thinkAcks = ["let me think about that for a second."]
    private var ackIndex = 0

    private func acknowledge() {
        guard !quietTurn else { return }
        let line = Self.acks[ackIndex % Self.acks.count]
        ackIndex += 1
        speaker.speak(line)
    }

    private static let closeWords = try! NSRegularExpression(pattern: #"^(close|clear|hide|dismiss) (it|that|this|them|the (board|cards?|card))\W*$"#, options: .caseInsensitive)
    static let boardWords = try! NSRegularExpression(pattern: #"(?i)\b(on the board|on my screen|put (it|this|that|them) up|pull up|draw (it|me|this|that|a|the)|open (the|a|that|this) (page|site|article|link|wikipedia)|show me (the|a|that|this)? ?(page|site|article|picture|photo|image|diagram|figure|structure|molecule))\b"#)

    private func saysDrive(_ text: String) -> Bool {
        Self.driveWords.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) != nil
    }

    private static let continueWords = try! NSRegularExpression(pattern: #"^(ok(ay)?|yes|yep|done|next|continue|go on|what('s| is) next|now what|did it|i did( it| that)?|keep going|and now)\W*$"#, options: .caseInsensitive)

    /// One Jev call (about 150 ms) while the screen capture finishes: where does this go, and
    /// which element did he mean. A confident "agent" skips the talk model entirely; a likely
    /// element gets the dot moving before Claude has said a word. During a walkthrough, "next"
    /// and "done" continue it instead of starting over.
    private func route(_ text: String) async -> Route {
        let inWalkthrough = walkthrough != nil
        let range = NSRange(location: 0, length: (text as NSString).length)
        if !board.isEmpty, Self.closeWords.firstMatch(in: text, range: range) != nil { return .closeBoard }
        // Showing is Dot's own job: a page, a picture, a drawing or a card goes on the board, never to an agent.
        if Self.boardWords.firstMatch(in: text, range: range) != nil { return .answer }
        if inWalkthrough || board.hasHiddenSteps, Self.continueWords.firstMatch(in: text, range: range) != nil {
            return .continueWalkthrough
        }
        if config.driveEnabled, saysDrive(text) {
            if inWalkthrough, walkthrough?.awaitingNextStep == false { return .drive }
            driveRequested = true   // the walkthrough about to start is his to watch, not to click
        }
        guard let jev else {
            if inWalkthrough { endWalkthrough(reason: "new question") }
            return .answer
        }
        let running = agents.runningAgents()
        var state: [String: Any] = [
            "user_said": text,
            "frontmost_app": context.appName ?? "",
            "window_title": String((context.windowTitle ?? "").prefix(120)),
            "agents_working": running.map { ["name": $0.name, "task": $0.task] },
            "elements_on_screen": context.elements.prefix(40).map { "\($0.role.dropFirst(2)) \($0.title)" },
        ]
        if let selected = context.selectedText, !selected.isEmpty { state["selected_text"] = String(selected.prefix(200)) }
        if let step = walkthrough {
            state["walkthrough_in_progress"] = ["last_instruction": "\(step.kind == .hover ? "rest on" : "click") \(step.label)", "steps_done": step.history]
        }
        var questions: [String: Jev.Question] = [
            "route": .choice(instructions: "How should a voice companion that can see the screen handle what the user just said? Pick one.", criteria: [
                "answer": "answer out loud from the screen, the day's calendar and deadlines, or general knowledge, including a quick web lookup; or show something on the board: a card, a drawing, a picture, a live web page (the companion opens pages itself); no files, nothing to operate",
                "agent": "real work in the background: looking something up properly across apps or sites, drafting or writing, making or changing files, going through mail, operating an app for a while, anything that sends or submits",
                "think": "a hard reasoning question (a calculation, a tricky technical or finance judgment) that deserves a stronger model",
            ]),
        ]
        if !running.isEmpty {
            questions["followup"] = .yesNo(instructions: "Is this a follow-up, a steer or a question for the agent that is already working, rather than a new request?", yes: "it continues the agent's current task", no: "a new request or a question about the screen")
        }
        if inWalkthrough {
            questions["walkthrough"] = .yesNo(instructions: "A step-by-step walkthrough is in progress (see walkthrough_in_progress). Is what the user said part of it: saying they did the step, asking what's next, a question about this step, or a request to show it or do it for them?", yes: "it continues the current walkthrough", no: "a new, unrelated question or request")
            if config.driveEnabled, walkthrough?.awaitingNextStep == false {
                questions["drive"] = .yesNo(instructions: "Did the user ask the companion to perform the click itself (take over the mouse, do it for them) rather than keep showing them?", yes: "they want the companion to click it", no: "they will click it themselves, or said something else")
            }
        }
        var elementCriteria: [String: String] = [:]
        for (index, element) in context.elements.prefix(40).enumerated() where !element.title.isEmpty {
            elementCriteria["e\(index)"] = String(element.title.prefix(60))
        }
        if config.driveEnabled, driveRequested, !inWalkthrough {
            questions["on_screen"] = .yesNo(instructions: "Is the user asking to operate something visible in the frontmost window right now, in a few clicks (a dialog, a button, a menu, a setting), rather than a longer task done elsewhere?", yes: "a few clicks on what is on screen now", no: "a longer task: research, writing, files, another app or site")
        }
        if elementCriteria.count >= 2, !inWalkthrough {
            elementCriteria["none"] = "the user is not asking about one specific element on screen"
            questions["element"] = .choice(instructions: "If the user is asking where something is, how to do something here, or about one specific control, which on-screen element do they mean?", criteria: elementCriteria)
        }
        let answers: [String: Jev.Answer]? = await withCheckedContinuation { continuation in
            jev.evaluate("route", state: state, questions: questions) { continuation.resume(returning: $0) }
        }
        if inWalkthrough {
            if let d = answers?["drive"]?.probability, d >= 0.7 { return .drive }
            if let p = answers?["walkthrough"]?.probability, p >= 0.55 { return .continueWalkthrough }
            endWalkthrough(reason: "new question")
        }
        guard let answers, let route = answers["route"]?.choice else { return .answer }
        if driveRequested, let onScreen = answers["on_screen"]?.probability, onScreen >= 0.55 {
            Log.info("jev: on-screen task (\(String(format: "%.2f", onScreen))); dot will click it through")
            return .answer
        }
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
        streamer = BeatStreamer(eagerFirst: config.eagerSpeech && !quietTurn)
        speechStarted = false
        bubbleGroup = ""
        bubbleLabel = nil
        beatsFired = 0
        quietWork.forEach { $0.cancel() }
        quietWork = []
        quietClock = Date()
        turnStartedAt = Date()
        lastTurnAt = Date()
        if kind == .talk { turnsInSession += 1 }
        turnModel = kind == .talk ? config.talkModel : config.thinkModel
        phase = .thinking
        hud.set(phase: .thinking)
        overlay.setPhase(.thinking)
        session.send(text: message, images: images)
        Log.info("turn[\(kind.rawValue)] sent \(images.count) image(s), \(message.count) chars: \(Log.short(hud.model.transcript))")
    }

    /// The user message: the screen context, the element list, the box he drew, then his words.
    /// Returns the text and the images to attach.
    nonisolated static func isComputation(_ request: PermissionRequest) -> Bool {
        guard request.toolName == "Bash", case .string(let command)? = request.input["command"] else { return false }
        return TalkGuard.isComputationCommand(command)
    }

    private func buildMessage(_ transcript: String, kind: SessionKind) -> (String, [(data: Data, mediaType: String)]) {
        var lines: [String] = []
        var images = shots.map { (data: $0.jpeg, mediaType: "image/jpeg") }
        lines.append("[context]")
        lines.append("now: \(Self.nowLine())")
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
                    lines.append("he drew around a region of image \(cursorIndex + 1): its box is at \(Int(pixels.minX)),\(Int(pixels.minY)) size \(Int(pixels.width))x\(Int(pixels.height)) pixels; image \(images.count) is that region enlarged (\(crop.width)x\(crop.height)). answer about what he circled.")
                } else {
                    lines.append("he drew around a region of image \(cursorIndex + 1): its box is at \(Int(pixels.minX)),\(Int(pixels.minY)) size \(Int(pixels.width))x\(Int(pixels.height)) pixels. answer about what he circled.")
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
        if !board.isEmpty {
            lines.append("board: " + board.stateLines().joined(separator: "; "))
        }
        if let step = walkthrough {
            let left = max(config.walkthroughMaxSteps - step.step, 0)
            lines.append("walkthrough: step \(step.step) was \"\(step.kind == .hover ? "rest on" : "click") \(step.label)\"; \(left) click-to-advance steps left" +
                         (step.history.isEmpty ? "" : "; so far: " + step.history.joined(separator: "; ")))
        }
        lines.append("[/context]")
        lines.append("")
        lines.append(transcript)
        return (lines.joined(separator: "\n"), images)
    }

    static func nowLine() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.dateFormat = "EEEE, MMMM d, yyyy, h:mm a"
        return formatter.string(from: Date())
    }

    // MARK: Streaming and beats

    private func handle(_ event: StreamEvent) {
        switch event {
        case .textDelta(let delta):
            for beat in streamer.feed(delta) { enqueue(beat) }
            if !speechStarted, config.bubbleText {
                let ahead = (streamer.spokenSoFar + " " + streamer.partial).trimmingCharacters(in: .whitespaces)
                if !ahead.isEmpty { overlay.setBubble(ahead) }
            }
            if config.hudShowsResponse { hud.model.response = streamer.spokenSoFar }
        case .assistantText(let text):
            if streamer.spokenSoFar.isEmpty, streamer.partial.isEmpty { for beat in streamer.feed(text) { enqueue(beat) } }
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

    /// Queue one beat: its words go to the voice, and its visuals fire the moment those words start.
    private func enqueue(_ beat: Beat) {
        let visuals = beat.tags.filter { $0.isVisual }
        guard !beat.text.isEmpty || !visuals.isEmpty else { return }
        if quietTurn {
            let delay = max(quietClock.timeIntervalSinceNow, 0)
            let work = DispatchWorkItem { [weak self] in self?.beatStarted(beat) }
            quietWork.append(work)
            DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
            quietClock = Date(timeIntervalSinceNow: delay + (beat.text.isEmpty ? 0.3 : max(0.9, Double(beat.text.count) * 0.045)))
            return
        }
        speaker.speak(beat.text) { [weak self] in self?.beatStarted(beat) }
    }

    private func beatStarted(_ beat: Beat) {
        beatsFired += 1
        speechStarted = true
        if phase != .speaking, !beat.text.isEmpty {
            phase = .speaking
            overlay.setPhase(.speaking)
            if config.hudShowsResponse {
                hud.set(phase: .speaking)
            } else {
                // The answer lives in the bubble beside Dot; the notch steps back unless it holds agents or a card.
                hud.set(phase: .hidden)
            }
        }
        let visuals = beat.tags.filter { $0.isVisual }
        Log.info("beat \(beatsFired)\(quietTurn ? " (quiet)" : ""): " + (visuals.isEmpty ? "" : visuals.map { "\($0)" }.joined(separator: " ") + " ") + Log.short(beat.text, 120))
        if !visuals.isEmpty { overlay.fadeOldMarks() }
        var label: String?
        for tag in visuals {
            switch tag {
            case .point(let x, let y, let text, let screen):
                point(pixel: CGPoint(x: x, y: y), label: text, screen: screen)
                label = label ?? text
            case .highlight(let x, let y, let w, let h, let text, let screen):
                highlight(pixelRect: CGRect(x: x, y: y, width: w, height: h), label: text, screen: screen)
                label = label ?? text
            case .shape(let kind, let points, let text, let screen):
                shape(kind: kind, pixels: points.map { CGPoint(x: $0.x, y: $0.y) }, label: text, screen: screen)
                label = label ?? text
            case .target(let x, let y, let radius, let text, let screen):
                _ = target(pixel: CGPoint(x: x, y: y), radius: CGFloat(radius), label: text, screen: screen, hover: false)
                label = label ?? text
            case .hover(let x, let y, let radius, let text, let screen):
                _ = target(pixel: CGPoint(x: x, y: y), radius: CGFloat(radius), label: text, screen: screen, hover: true)
                label = label ?? text
            case .type(let x, let y, let text, let body, let screen):
                if !body.isEmpty {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(body, forType: .string)
                }
                point(pixel: CGPoint(x: x, y: y), label: text.isEmpty ? "paste here" : text, screen: screen)
                if walkthrough?.driving == true || driveRequested, let shot = shot(forScreen: screen), !body.isEmpty {
                    let target = Coordinates.screenPoint(fromPixel: CGPoint(x: x, y: y), in: shot.frame)
                    driver.begin()
                    driver.go(to: target, click: true) { ok in
                        if ok { DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { Driver.paste() } }
                    }
                }
                label = label ?? (text.isEmpty ? "paste" : text)
            case .web(let urlText, let title):
                if let url = URL(string: urlText) {
                    let shot = shot(forScreen: nil)
                    let screenFrame = shot?.frame.displayFrame ?? NSScreen.main?.frame ?? CGRect(x: 0, y: 0, width: 1440, height: 900)
                    board.showWeb(id: "web", url: url, title: title, on: screenFrame, avoiding: context.windowFrame)
                    hud.upsertAgent(AgentRow(id: "lesson", name: title.isEmpty ? (url.host ?? "page") : title, line: "a page on the board; say close it when done",
                                             state: .running, kind: .lesson, canStop: true, startedAt: lessonStartedAt ?? Date()))
                    if lessonStartedAt == nil { lessonStartedAt = Date() }
                    overlay.bringToFront()
                }
                label = label ?? title
            case .card(let id, let rect, let title, let html, let screen):
                showCard(id: id, rect: rect, title: title, html: html, screen: screen)
                label = label ?? title
            case .reveal(let id, let step):
                board.reveal(id: id, step: step) { [weak self] rect in
                    guard let self, let rect else { return }
                    let tail = CGPoint(x: rect.minX + 4, y: rect.midY)
                    let frame = self.board.frame(of: id) ?? rect
                    let seat = CGPoint(x: frame.minX - 22, y: rect.midY - 4)
                    self.overlay.point(at: tail, label: "", seat: seat)
                    self.overlay.bringToFront()
                }
                label = label ?? "step \(step)"
            case .clearBoard:
                clearBoard()
            default:
                break
            }
        }
        guard config.bubbleText else { return }
        if beat.hasVisual || bubbleGroup.count > 240 {
            bubbleGroup = beat.text
            bubbleLabel = label.map { String($0.prefix(40)) }
        } else {
            bubbleGroup = (bubbleGroup + " " + beat.text).trimmingCharacters(in: .whitespaces)
        }
        if !bubbleGroup.isEmpty { overlay.setBubble(bubbleGroup, label: bubbleLabel) }
    }

    private func finishTurn(_ result: ResultInfo) {
        for beat in streamer.flush() { enqueue(beat) }
        if streamer.spokenSoFar.isEmpty, streamer.allTags.isEmpty, let text = result.resultText, !text.isEmpty {
            for beat in streamer.feed(text) { enqueue(beat) }
            for beat in streamer.flush() { enqueue(beat) }
        }
        let tags = streamer.allTags
        let spoken = streamer.spokenSoFar
        if config.hudShowsResponse { hud.model.response = spoken }
        let kind = activeSession === thinkSession ? "think" : "talk"
        ledger.record(kind: kind, agent: nil, model: turnModel, result: result, summary: hud.model.transcript)
        TranscriptLog.append(kind: lastAskWasTyped ? .typed : .talk, you: lastAsked, dot: spoken, app: context.appName,
                             extra: ["model": turnModel, "ms": String(result.durationMs)])
        Log.info("turn[\(kind)] done in \(result.durationMs) ms, $\(String(format: "%.4f", result.costUSD)), \(tags.filter { $0.isVisual }.count) visual beat(s), tags \(tags.map { "\($0)" }.joined(separator: " | "))")
        Log.info("turn[\(kind)] said: \(Log.short(spoken, 240))")
        if result.isError, spoken.isEmpty {
            hud.flash(error: Log.short(result.resultText ?? "the turn failed", 160))
            overlay.setMood(.puzzled, for: 3)
            Log.error("turn[\(kind)] failed: \(result.subtype) \(Log.short(result.resultText ?? "", 300))")
        }

        var escalated = false
        for tag in tags {
            switch tag {
            case .agent(let brief):
                agents.handoff(brief: brief, agentName: nil, context: context, shots: shots)
            case .newAgent(let name, let brief):
                agents.handoff(brief: brief, agentName: name, context: context, shots: shots)
            case .think:
                if kind == "talk", let think = session(for: .think) {
                    escalated = true
                    let question = lastAsked.isEmpty ? hud.model.transcript : lastAsked
                    let said = spoken.trimmingCharacters(in: .whitespacesAndNewlines)
                    let handed = "[escalated] he asked: \"\(question)\". the quick model already said \"\(Log.short(said, 240))\" and handed the rest to you: answer the question itself now, and if a card or figure was promised, build it in full."
                    let (message, images) = buildMessage(handed, kind: .think)
                    // Let the "let me think" sentence finish, then ask the stronger model.
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
                        guard let self else { return }
                        self.sendTurn(message, images: images, to: think, kind: .think)
                    }
                }
            default:
                break
            }
        }
        let rings = tags.contains { if case .target = $0 { return true }; if case .hover = $0 { return true }; return false }
        if !rings, walkthrough != nil, !escalated { endWalkthrough(reason: "the model gave a step with no target") }
        region = nil
        overlay.setDrawRect(nil)
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
                if self.activeSession?.turnInFlight == true || self.speaker.isSpeaking || self.quietPending { return }
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

    private var quietPending: Bool { quietTurn && quietClock > Date() }

    /// Bubble fades, marks clear and Dot returns to the cursor, unless a walkthrough is waiting for a click.
    private func settle() {
        overlay.setPhase(.idle)
        let teaching = walkthrough != nil || board.hasHiddenSteps
        overlay.hideBubble(after: teaching ? 14.0 : 4.0)
        if !teaching {
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
        if shot.isCursorScreen, let element = AccessibilityContext.element(near: target, label: label, in: context.elements),
           max(element.frame.width, element.frame.height) <= 420 {
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

    private func showCard(id: String, rect: CardRect?, title: String, html: String, screen: Int?) {
        guard board.available, !html.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        let shot = shot(forScreen: screen)
        let screenFrame = shot?.frame.displayFrame ?? NSScreen.main?.frame ?? CGRect(x: 0, y: 0, width: 1440, height: 900)
        var placed: CGRect?
        if let rect, let shot {
            if rect.width > 0, rect.height > 0 {
                placed = Coordinates.screenRect(fromPixel: CGRect(x: rect.x, y: rect.y, width: rect.width, height: rect.height), in: shot.frame)
            } else {
                let corner = Coordinates.screenPoint(fromPixel: CGPoint(x: rect.x, y: rect.y), in: shot.frame)
                placed = CGRect(x: corner.x, y: corner.y - 120, width: 440, height: 120)
            }
        }
        board.show(id: id, title: title, html: html, rect: placed, on: screenFrame, avoiding: context.windowFrame)
        hud.upsertAgent(AgentRow(id: "lesson", name: title.isEmpty ? "on the board" : title, line: "on the board; say next, or close it",
                                 state: .running, kind: .lesson, canStop: true, startedAt: lessonStartedAt ?? Date()))
        if lessonStartedAt == nil { lessonStartedAt = Date() }
        overlay.bringToFront()
        if let frame = board.frame(of: id) {
            let edge = CGPoint(x: frame.minX + 4, y: frame.maxY - 16)
            overlay.point(at: edge, label: "", seat: CGPoint(x: frame.minX - 22, y: frame.maxY - 20))
            overlay.bringToFront()
        }
    }

    private func shape(kind: ShapeKind, pixels: [CGPoint], label: String, screen: Int?) {
        guard let shot = shot(forScreen: screen) else { return }
        let points = pixels.map { Coordinates.clamp(Coordinates.screenPoint(fromPixel: $0, in: shot.frame), to: shot.frame.displayFrame, inset: 2) }
        overlay.shape(kind: kind, points: points, label: label)
    }

    /// Ring the next control and wait for the click (or the hover). Returns false when the walkthrough has run long enough.
    private func target(pixel: CGPoint, radius: CGFloat, label: String, screen: Int?, hover: Bool) -> Bool {
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
        var next = Walkthrough(kind: hover ? .hover : .click, target: target, radius: screenRadius, label: label, step: step,
                               appBundle: context.bundleIdentifier)
        if let previous = walkthrough {
            next.history = previous.history
            next.appBundle = previous.appBundle ?? context.bundleIdentifier
            next.driving = previous.driving
        }
        if driveRequested, config.driveEnabled { next.driving = true; driveRequested = false }
        walkthrough = next
        overlay.target(at: target, radius: screenRadius, label: label, hover: hover)
        hud.flash(status: "step \(step): \(hover ? "rest on" : "click") \(label)", for: 6)
        hud.upsertAgent(AgentRow(id: "walkthrough", name: next.driving ? "dot is clicking" : "walkthrough", line: "step \(step): \(hover ? "rest on" : "click") \(label)",
                                 state: .running, kind: .walkthrough, steps: Array(next.history.suffix(3)), canStop: true, startedAt: walkthroughStartedAt ?? Date()))
        if walkthroughStartedAt == nil { walkthroughStartedAt = Date() }
        walkthroughTimeout?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.endWalkthrough(reason: "no click in 120 s") }
        walkthroughTimeout = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 120, execute: work)
        if hover { startHoverWatch() } else { hoverTimer?.invalidate() }
        if next.driving { driveStep() }
        return true
    }

    // MARK: Driving (he said "do it")

    /// Take the current ringed step and every one after it, until the task ends or he moves.
    private func startDriving() {
        guard config.driveEnabled, walkthrough != nil else { return }
        walkthrough?.driving = true
        let line = "okay, i'll click through it. move the mouse or press a key and i stop."
        speaker.speak(line)
        overlay.setBubble(line, label: nil)
        Log.info("drive: taking over the walkthrough at step \(walkthrough?.step ?? 0)")
        // Let the sentence land, then go.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in self?.driveStep() }
    }

    private func driveStep() {
        guard let step = walkthrough, step.driving, !step.awaitingNextStep else { return }
        if Driver.isCommitLabel(step.label) {
            let line = "this one looks like it commits something, so it's yours: \(step.kind == .hover ? "rest on" : "click") \(step.label)."
            Log.info("drive: leaving \"\(step.label)\" to him")
            speaker.speak(line)
            overlay.setBubble(line, label: step.label)
            return
        }
        driver.begin()
        // The glide starts once the instruction has been spoken, so the voice and the hand agree.
        let delay: TimeInterval = quietTurn ? 0.3 : 1.0
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self, let current = self.walkthrough, current.driving, current.step == step.step, !current.awaitingNextStep else { return }
            self.driver.go(to: current.target, click: current.kind == .click) { done in
                Log.info("drive: step \(current.step) \(current.kind == .click ? "clicked" : "rested on") \(current.label): \(done ? "ok" : "stopped")")
            }
        }
    }

    /// A hover step completes when the cursor rests inside the ring for most of a second.
    private func startHoverWatch() {
        hoverTimer?.invalidate()
        hoverTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] timer in
            Task { @MainActor in
                guard let self, let step = self.walkthrough, step.kind == .hover, !step.awaitingNextStep else { timer.invalidate(); return }
                let mouse = NSEvent.mouseLocation
                let inside = hypot(mouse.x - step.target.x, mouse.y - step.target.y) <= step.radius * 1.2 + 6
                if inside {
                    if self.walkthrough?.hoverSince == nil { self.walkthrough?.hoverSince = Date() }
                    if let since = self.walkthrough?.hoverSince, Date().timeIntervalSince(since) >= 0.7 {
                        timer.invalidate()
                        self.stepCompleted(how: "rested on")
                    }
                } else {
                    self.walkthrough?.hoverSince = nil
                }
            }
        }
    }

    private func clicked(at point: CGPoint, own: Bool = false) {
        guard var step = walkthrough else { return }
        if step.awaitingNextStep {
            if !own {
                walkthrough?.userActedWhileWaiting = true
                Log.info("walkthrough: he clicked again while the next step was being worked out")
            }
            return
        }
        let distance = hypot(point.x - step.target.x, point.y - step.target.y)
        guard distance <= step.radius * 1.6 + 16 else {
            step.offTargetClicks += 1
            walkthrough = step
            Log.info("walkthrough: click \(Int(distance)) pt from \(step.label) (off-target \(step.offTargetClicks))")
            if step.offTargetClicks >= 3 { endWalkthrough(reason: "he went elsewhere") }
            return
        }
        Log.info("walkthrough: click on \(step.label) (step \(step.step)), \(Int(distance)) pt from center")
        stepCompleted(how: "clicked")
    }

    /// The ringed step is done: look at what it opened and ask for the next one.
    private func stepCompleted(how: String) {
        guard var step = walkthrough else { return }
        walkthroughTimeout?.cancel()
        hoverTimer?.invalidate()
        step.awaitingNextStep = true
        step.history.append("\(step.step). \(how) \(step.label)")
        walkthrough = step
        overlay.clearRing()
        hud.flash(status: "saw that, looking", for: 3)
        stopSpeaking()
        // Give the app a moment to redraw what the step opened, then ask for the next one.
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
                self.hud.model.transcript = "[\(how) \(step.label)]"
                var text = "[step_done] \(self.walkthrough?.driving == true ? "dot" : "i") \(how) \(step.label) (step \(step.step)). look at the new screenshot as the truth and give the next step, or say it's finished with no tag."
                if self.walkthrough?.userActedWhileWaiting == true {
                    text += " i also clicked again while you were thinking, so the next thing may already be done; don't ask me to repeat it."
                }
                let (message, images) = self.buildMessage(text, kind: .talk)
                self.lastMessage = message
                self.lastImages = images
                self.sendTurn(message, images: images, to: session, kind: .talk)
            }
        }
    }

    /// He spoke during a walkthrough ("done", "next", "what's this", "do it"): continue it with a fresh look.
    private func continueWalkthrough(said text: String) {
        guard var step = walkthrough else { return }
        walkthroughTimeout?.cancel()
        step.awaitingNextStep = true
        walkthrough = step
        guard let session = session(for: .talk) else { return }
        let message = "[walkthrough] he said: \"\(text)\". \(step.driving ? "dot is clicking the steps for him; keep giving one target at a time. " : "")the ringed step was \"\(step.kind == .hover ? "rest on" : "click") \(step.label)\". look at the new screenshot as the truth: if that step looks done, give the next one; if he asked something, answer it and keep the current step ringed with the same tag; if the task is finished, say so with no tag."
        let (built, images) = buildMessage(message, kind: .talk)
        lastMessage = built
        lastImages = images
        sendTurn(built, images: images, to: session, kind: .talk)
    }

    private func appActivated(_ app: NSRunningApplication) {
        guard let step = walkthrough, app.processIdentifier != ProcessInfo.processInfo.processIdentifier else { return }
        guard let expected = step.appBundle, let actual = app.bundleIdentifier, actual != expected else { return }
        Log.info("walkthrough: step-away to \(actual)")
        endWalkthrough(reason: "he switched to \(app.localizedName ?? actual)")
    }

    private var walkthroughStartedAt: Date?
    private var lessonStartedAt: Date?

    private func clearBoard() {
        board.clear()
        lessonStartedAt = nil
        hud.removeAgent(id: "lesson")
    }

    /// Stop from the task bar.
    func stopTask(_ id: String) {
        switch id {
        case "walkthrough": endWalkthrough(reason: "stopped from the task bar")
        case "lesson": clearBoard()
        default: break
        }
    }

    private func endWalkthrough(reason: String) {
        guard walkthrough != nil else { return }
        Log.info("walkthrough: ended (\(reason))")
        walkthrough = nil
        walkthroughStartedAt = nil
        hud.removeAgent(id: "walkthrough")
        driveRequested = false
        driver.end()
        walkthroughTimeout?.cancel()
        hoverTimer?.invalidate()
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
        guard hour >= 6 else { return }   // a new day's brief at one in the morning is not a greeting
        let opener = hour < 12 ? "morning." : (hour < 17 ? "afternoon." : "evening.")
        overlay.greet("\(opener) \(line).", for: 10)
        Log.info("greeting: \(line)")
    }

    // MARK: Interrupt

    func interrupt() {
        ActionBarPanel.dismiss()
        let wasBusy = phase != .idle || speaker.isSpeaking || walkthrough != nil
        stopSpeaking()
        activeSession?.interrupt()
        if phase == .listening { recorder.cancel(); overlay.setMouseCapture(false) }
        levelTimer?.invalidate()
        phase = .idle
        endWalkthrough(reason: "escape")
        clearBoard()
        overlay.clearMarks()
        overlay.hideBubble(after: 0)
        overlay.setPhase(.idle)
        overlay.releaseTransient(after: 0.3)
        hud.set(phase: .hidden)
        if wasBusy { Log.info("interrupted") }
    }

    private func stopSpeaking() {
        speaker.stop()
        quietWork.forEach { $0.cancel() }
        quietWork = []
        quietClock = Date()
    }

    static func friendlyTool(_ name: String) -> String {
        let parts = name.split(separator: "__").map(String.init)
        if parts.count >= 3 { return parts[2...].joined(separator: " ").replacingOccurrences(of: "_", with: " ") }
        return name.lowercased()
    }
}
