import AVFoundation
import FluidAudio
import AppKit
import DotKit
import Foundation
import MapKit

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
    /// Dot's own hands for the small things: open, scroll, back, click, type, keys (the basics pass).
    private let hands: Hands
    /// The fast lane (2026-10-20): every action with more than one small step is a job Dot runs itself.
    let jobs: JobManager
    /// When this ask arrived, for a job's first-action time.
    private var askReceivedAt = Date()
    /// The job he spoke to last, for a follow-up.
    private var lastJobAddressed: String?
    /// This Mac's calendar (EventKit); Atlas's copy until he grants access.
    let localCalendar = LocalCalendar()
    /// `Dot --ask --bench`: write tools refused, agents logged and not started, actions only on the bench fixture.
    private var benchMode = false
    private var talkSessionIsBench = false
    /// Results still owed by turns Dot cut off, by session: each is dropped with everything it streams, so a cut-off
    /// turn is never spoken, retried or acted on (2026-10-18: "I" was spoken and the old question asked again).
    private var drainCounts: [ObjectIdentifier: Int] = [:]
    /// Sessions whose next message should say the last turn was cut by a new question, not declined.
    private var cutNoteOwed: Set<ObjectIdentifier> = []
    /// Acts from one answer run one after another ([INSERT] then [KEY:return] must not race).
    private var actChain: Task<Void, Never>?
    /// Bumped by every new turn and by escape: an act queued by an earlier answer is dropped.
    private var actGeneration = 0
    /// The course on screen last, and when: a proof in "pset7.pdf" still gets the math map.
    private var lastCourse: (code: String, at: Date)?
    /// How many of this turn's tags have been acted on as they streamed in.
    private var actsDone = 0
    /// He asked for something to be done, not explained: this turn's rings are pressed by Dot.
    private var doIntent = false
    /// A [GO] goal waiting for the turn that wrote it to end.
    private var pendingGo: String?
    /// Driven steps allowed in a [GO] or a do-request (the plan: at most six).
    private var driveCap: Int?
    /// The goal of the driven run in progress and when it began, for its closing `act: go` line.
    private var goRun: (goal: String, started: Date)?
    /// Course maps already in each conversation.
    private var coursesInSession: [ObjectIdentifier: Set<String>] = [:]
    /// The question before this one, for "start another agent on that".
    private var previousAsked = ""
    /// What talk and think each said lately, so a follow-up to one ("show it to me") reaches the other with its referent.
    private var shared = SharedTurns()
    let board: BoardManager
    /// The explainer panel's talk side (round eight).
    let panels: PanelCoach

    private let recorder = AudioRecorder()
    private var talkSession: ClaudeSession?
    /// The next talk conversation, started before the current one reaches its turn limit.
    private var spareTalk: ClaudeSession?
    private var thinkSession: ClaudeSession?

    private(set) var phase: Phase = .idle
    private var mode: HotkeyMonitor.Mode = .talk
    private var captureTask: Task<(shots: [ScreenShot], context: ScreenContext), Never>?
    private var shots: [ScreenShot] = []
    private var context = ScreenContext.empty
    private var region: CGRect?
    /// Every stroke he drew with the key held this turn: its box, its points and what it looks like.
    private var marks: [(rect: CGRect, points: [CGPoint], shape: StrokeShape)] = []
    /// The document in front, read once and cached, so a question can land on its words.
    private let documents = DocumentReader()
    /// Dot's ear in a lecture: a rolling transcript the companion can answer from.
    let lecture: LectureListener
    private var dictionary = DictationDictionary()
    private var dictionaryLoadedAt = Date.distantPast
    /// The answer goes to the notch as text (a typed question, a muted Mac) instead of a bubble.
    private var textSurface = false
    private var lastMessage = ""
    private var lastImages: [(data: Data, mediaType: String)] = []
    /// A turn that dies inside the CLI before the model is even called gets one more try.
    private var retriedTurn = false

    // MARK: Lesson pacing: a stage shows one step at a time and waits for him between steps
    private var lessonCard: String?
    private var lessonHeld: [Beat] = []
    private var lessonHolding = false
    private var lessonStep = 0
    private var lessonSpokenMax = 0
    private var lessonSaid: [Int: String] = [:]
    private var turnRevealsEnqueued = 0
    private var streamer = BeatStreamer()
    private var activeSession: ClaudeSession?
    /// Routines (set by the app): a [ROUTINE] tag from the model lands here.
    var scheduler: RoutineScheduler?
    private var levelTimer: Timer?
    private var idleTimer: Timer?
    private var idleCheckTimer: Timer?
    private var turnStartedAt = Date()
    private var firstSentenceLogged = false
    private var turnModel = ""
    private var turnsInSession = 0
    /// Think's turns in its conversation and its last one, for its recycle.
    private var thinkTurns = 0
    private var lastThinkAt = Date.distantPast
    static let thinkMaxTurns = 16
    private var lastTurnAt = Date()

    // Beats: what the bubble shows follows the voice, not the text stream.
    private var speechStarted = false
    /// The one "checking your calendar." a talk turn may say while a lookup runs.
    private var toolLineSaid = false
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
        /// What he asked that this walkthrough answers, for a "do it" handed to a job.
        var ask = ""
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
        self.hands = Hands(cometPort: config.cometDebugPort)
        self.jobs = JobManager(config: config, overlay: overlay, speaker: speaker, ledger: ledger)
        self.board = BoardManager(accentHex: config.pointerColorHex)
        self.panels = PanelCoach(accentHex: config.pointerColorHex)
        self.lecture = LectureListener(transcriber: transcriber)
        recorder.preferredInputName = config.microphoneName
        (speaker as? CommandSpeaker)?.warm(Self.acks + Self.thinkAcks)
        lecture.onStatus = { [weak self] line in self?.hud.model.listeningLine = line }
        CallPresence.setOwnMicrophoneCheck { [weak self] in
            guard let self else { return false }
            return self.recorder.isRecording || self.lecture.isListening
        }
        self.speaker.onFinishedAll = { [weak self] in
            Task { @MainActor in self?.scheduleIdleCheck() }
        }
        // He moved a figure (VI-06): a quiet turn that speaks only if the move changes the answer.
        board.onEvent = { [weak self] event in self?.cardEvent(event) }
        board.onNav = { [weak self] id, action, step in
            guard let self else { return }
            if self.lessonCard != id, self.board.isStage(id) { self.resetLesson(); self.lessonCard = id }
            switch action {
            case "next": self.advanceLesson(); self.scheduleIdleCheck()
            case "back": self.lessonBack()
            case "step": self.jumpLesson(to: step)
            default: break
            }
        }
        hud.model.onSubmitInput = { [weak self] text in
            Task { @MainActor in
                guard let self else { return }
                if self.pendingRegionAgent { self.pendingRegionAgent = false; self.handRegionToAgent(text) } else { self.askTyped(text, fromField: true) }
            }
        }
        panels.placement = { [weak self] in
            // the screen he is on, docked away from whatever Dot is marking
            let mouse = NSEvent.mouseLocation
            let screen = NSScreen.screens.first { $0.frame.contains(mouse) } ?? NSScreen.main
            return (screen, self?.overlay.markedRect ?? self?.context.windowFrame)
        }
        panels.onAsk = { [weak self] text in self?.askTyped(text) }
        panels.courses = CourseTag.load(from: config.talkRootURL.appendingPathComponent("context"))
        panels.courseContext = { [weak self] in
            guard let self else { return "" }
            return [self.context.windowTitle, self.context.url, self.lastAsked].compactMap { $0 }.joined(separator: " ")
        }
        panels.onQuiz = { [weak self] line in self?.panelEvent(line) }
        driver.onAbort = { [weak self] what in
            guard let self else { return }
            self.walkthrough?.driving = false
            self.driveRequested = false
            self.speaker.speak("okay, you've got it.")
            self.overlay.setBubble("okay, you've got it.", label: nil)
        }
        jobs.talkIsIdle = { [weak self] in self.map { $0.phase == .idle && !$0.speaker.isSpeaking } ?? true }
        jobs.presentCard = { [weak hud] card in hud?.present(card, chime: true) }
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
                if talkSessionIsBench != benchMode {
                    // a bench turn never runs where write tools are pre-allowed, and a normal one never in the bench's
                    Log.info("talk: \(benchMode ? "bench" : "normal") session for this turn")
                    if talkSession.turnInFlight, activeSession === talkSession { cutActiveTurn() }
                    talkSession.stop()
                } else if let spare = spareTalk, spare.isRunning, turnsInSession >= config.talkSessionMaxTurns || stale, !talkSession.turnInFlight {
                    // the next conversation was started ahead (pre-warm), so the recycle costs nothing
                    Log.info("talk: recycling the session after \(turnsInSession) turns into the warm spare")
                    talkSession.stop()
                    spareTalk = nil
                    turnsInSession = 0
                    self.talkSession = spare
                    return spare
                } else if (turnsInSession >= config.talkSessionMaxTurns || stale), !talkSession.turnInFlight {
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
            if let thinkSession, thinkSession.isRunning {
                // It had no limit: one ran 14:03 to 21:44 on 2026-10-18, its input growing from 33k to 151k tokens a turn.
                // A fresh one still gets the open panel and talk's last exchanges in its context.
                let idle = Date().timeIntervalSince(lastThinkAt) > 45 * 60
                if (idle || thinkTurns >= Self.thinkMaxTurns), !thinkSession.turnInFlight {
                    Log.info("think: recycling the session after \(thinkTurns) turns\(idle ? " (idle)" : "")")
                    thinkSession.stop()
                } else {
                    return thinkSession
                }
            }
            thinkTurns = 0
            thinkSession = makeSession(kind: .think)
            return thinkSession
        }
    }

    private func makeSession(kind: SessionKind) -> ClaudeSession? {
        var options = ClaudeSession.Options(cwd: config.talkRootURL, model: kind == .talk ? config.talkModel : config.thinkModel)
        options.systemPrompt = (kind == .talk ? Prompts.talk(jobs: config.jobsEnabled) : Prompts.think) + Prompts.courseIndex(in: config.talkRootURL)
        options.tools = ["Bash", "WebSearch", "WebFetch"]
        options.maxTurns = 6
        options.settingSources = ""
        options.permissionMode = "default"
        options.mcpConfigPath = config.mcpConfigPath(config.talkMCPConfig)
        options.strictMCP = true
        // Events with guests go out to them (FX-08): those two tools are judged per call below, never pre-allowed.
        options.allowedTools = options.mcpConfigPath == nil ? [] : config.talkAllowedTools.filter { !Talk.guestTools.contains($0) }
        let bench = kind == .talk && benchMode
        if bench {
            // a bench turn reads only: nothing remembered, drafted or put on his calendar
            let writes = Set(DotConfig.talkWriteTools.map { "mcp__atlas__\($0)" })
            options.allowedTools = options.allowedTools.filter { !writes.contains($0) }
        }
        if kind == .talk {
            options.effort = config.talkEffort
            // Thinking showed up on 23% of talk turns even at effort low and cost about 1.2 s to the first word
            // (2026-10-18); quips turn it off the same way.
            options.environment["MAX_THINKING_TOKENS"] = "0"
        }
        let session = ClaudeSession(label: kind.rawValue, claudePath: config.claudeExecutable, options: options)
        session.onEvent = { [weak self, weak session] event in
            guard let self, let session else { return }
            if self.drain(event, from: session) { return }
            guard self.activeSession === session else { return }
            self.handle(event)
        }
        var allowed = Set(config.talkAllowedTools + ["WebSearch", "WebFetch"])
        if bench { allowed.subtract(DotConfig.talkWriteTools.map { "mcp__atlas__\($0)" }) }
        let handOff = config.jobsEnabled ? "dot can do it as a job: [GO:...]." : "hand it to an agent with [AGENT:...]."
        let handThis = config.jobsEnabled ? "dot can do it as a job: [GO:...]." : "hand this to an agent with [AGENT:...]."
        session.permissionHandler = { request, completion in
            if Talk.guestTools.contains(request.toolName), ConsentPolicy.isOutwardMCP(tool: request.toolName, input: request.toolRequest.input) {
                completion(false, "an event with guests sends them an invitation, which needs his yes on a card; \(handOff)")
                Log.warn("talk: refused \(request.toolName) with guests")
            } else if allowed.contains(request.toolName) || Talk.isComputation(request) {
                completion(true, nil)
            } else {
                completion(false, "dot's talk mode only reads, remembers and computes with python; \(handThis)")
                Log.warn("talk: refused tool \(request.toolName)")
            }
        }
        if kind == .talk { talkSessionIsBench = bench }
        coursesInSession[ObjectIdentifier(session)] = []
        drainCounts[ObjectIdentifier(session)] = nil
        cutNoteOwed.remove(ObjectIdentifier(session))
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
            if config.jobsEnabled { jobs.userInput(kind: .click, point: point, own: own) }
        case .input(let kind, let point, let own):
            if config.jobsEnabled { jobs.userInput(kind: kind, point: point, own: own) }
        case .dragChanged(let rect):
            if rect.isNull { region = nil; overlay.setDrawRect(nil) } else { overlay.setDrawRect(rect) }
        case .dragPath(let points):
            overlay.setDrawPath(points)
        case .dragEnded(let rect, let points):
            let shape = StrokeClassifier.classify(points)
            marks.append((rect, points, shape))
            region = marks.map(\.rect).reduce(CGRect.null) { $0.union($1) }
            overlay.keepStroke(points)
            overlay.setDrawRect(nil)
            hud.flash(status: marks.count == 1 ? "asking about what you \(shape.words == "marked" ? "marked" : shape == .enclosure ? "circled" : "drew on")" : "\(marks.count) marks")
        }
    }

    private func beginListening(mode: HotkeyMonitor.Mode) {
        guard phase == .idle || phase == .speaking || phase == .thinking else { return }
        if phase == .speaking || phase == .thinking { stopSpeaking(); cutActiveTurn() }
        self.mode = mode
        quietTurn = false   // a spoken question is always answered aloud, whatever the last test turn was
        endBench()          // nor is it ever a bench turn
        driveRequested = false   // a ring in this new question is his to click unless he asks Dot to do it
        idleTimer?.invalidate()
        overlay.clearMarks(keepRing: walkthrough != nil)
        overlay.hideBubble(after: 0)
        overlay.showTransient()
        overlay.setMouseCapture(true)
        region = nil
        marks = []
        hud.dismissAnswer()
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

        let peak = recorder.peak()
        let inputName = recorder.inputName
        guard let stopped = try? recorder.stop() else {
            stopPartials(cancel: true)
            phase = .idle
            hud.set(phase: .hidden)
            settle()
            return
        }
        if heldFor >= 1.2, peak < 0.002 { microphoneHeardNothing(named: inputName) }
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
            loadDictionaryIfNeeded()
            let spoken = dictionary.apply(to: text.trimmingCharacters(in: .whitespacesAndNewlines))
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

    /// The key was held for a while and the stream never moved: the chosen mic is dead or muted.
    /// Say which one, and fall over to the built-in microphone for the next hold (HeyClicky's
    /// RealtimeMicrophoneCapture fails over the same way).
    private func microphoneHeardNothing(named name: String) {
        let devices = AudioDevices.inputDevices()
        let soundSettings: () -> Void = { _ = NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.Sound-Settings.extension")!) }
        if let builtIn = devices.first(where: { $0.builtIn }), AudioDevices.defaultInput != builtIn.id, AudioDevices.setDefaultInput(builtIn.id) {
            hud.notify(NotchNotice(id: "mic", icon: "mic.slash.fill", title: "\(name.lowercased()) heard nothing", detail: "switched to \(builtIn.name.lowercased()) for the next hold",
                                   tone: .warn, actionTitle: "sound settings", action: soundSettings, seconds: 10))
            Log.warn("mic: \(name) silent for the whole hold; default input now \(builtIn.name)")
        } else {
            hud.notify(NotchNotice(id: "mic", icon: "mic.slash.fill", title: "\(name.lowercased()) heard nothing", detail: "no other microphone to fall over to; check the input in sound settings",
                                   tone: .warn, actionTitle: "sound settings", action: soundSettings, seconds: 10))
            Log.warn("mic: \(name) silent for the whole hold; no other input to fall over to")
        }
        overlay.setMood(.puzzled, for: 3)
    }

    // MARK: Dictionary: his terms, written his way

    private func loadDictionaryIfNeeded() {
        let path = DotConfig.expand(config.dictionaryFile)
        let modified = (try? FileManager.default.attributesOfItem(atPath: path)[.modificationDate] as? Date) ?? .distantPast
        guard modified > dictionaryLoadedAt || (dictionary.isEmpty && dictionaryLoadedAt == .distantPast) else { return }
        dictionaryLoadedAt = Date()
        if let text = try? String(contentsOfFile: path, encoding: .utf8) {
            dictionary = DictationDictionary(text: text)
            Log.info("dictionary: \(dictionary.terms.count) term(s), \(dictionary.rules.count) correction(s)")
        }
    }

    /// "add centerview to my dictionary", "jev is spelled j e v": one line in the file, applied from now on.
    func addToDictionary(heard: String?, correct: String) {
        let path = DotConfig.expand(config.dictionaryFile)
        let line = DictationDictionary.line(forHeard: heard, correct: correct)
        try? FileManager.default.createDirectory(atPath: (path as NSString).deletingLastPathComponent, withIntermediateDirectories: true)
        let existing = (try? String(contentsOfFile: path, encoding: .utf8)) ?? "# dot's dictionary: one term per line, or \"heard => correct\"\n"
        try? (existing.hasSuffix("\n") || existing.isEmpty ? existing : existing + "\n").appending(line + "\n").write(toFile: path, atomically: true, encoding: .utf8)
        dictionaryLoadedAt = .distantPast
        loadDictionaryIfNeeded()
        hud.notify(NotchNotice(id: "dictionary", icon: "character.book.closed.fill", title: "learned: \(correct)",
                               detail: heard.map { "\($0) is written \(correct) from now on" } ?? "the recognizer writes it that way from now on",
                               tone: .good, actionTitle: "undo", action: { [weak self] in self?.removeFromDictionary(line: line) }, seconds: 8))
        Log.info("dictionary: added \(line)")
    }

    /// Undo from the notice: the last line that matches goes.
    private func removeFromDictionary(line: String) {
        let path = DotConfig.expand(config.dictionaryFile)
        guard let text = try? String(contentsOfFile: path, encoding: .utf8) else { return }
        var lines = text.components(separatedBy: "\n")
        if let index = lines.lastIndex(where: { $0.trimmingCharacters(in: .whitespaces) == line }) { lines.remove(at: index) }
        try? lines.joined(separator: "\n").write(toFile: path, atomically: true, encoding: .utf8)
        dictionaryLoadedAt = .distantPast
        loadDictionaryIfNeeded()
        Log.info("dictionary: removed \(line)")
    }

    /// The microphone picked in Settings, applied to the next hold.
    func setMicrophone(name: String?) {
        recorder.preferredInputName = name
    }

    private static let dictionaryWords = try! NSRegularExpression(pattern: #"^(?:add|put) (.+?) (?:to|in|into) (?:my |the )?dictionary\W*$"#, options: .caseInsensitive)
    private static let spelledWords = try! NSRegularExpression(pattern: #"^(.+?) is spell(?:ed|t) (.+?)\W*$"#, options: .caseInsensitive)

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
        marks = []
        pendingRegionAgent = false
        overlay.setDrawRect(nil)
        overlay.clearStrokes()
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
            let id = url.deletingPathExtension().lastPathComponent
            resetLesson()
            if BoardManager.isStageHTML(html) { lessonCard = id }
            showCard(id: id, rect: nil, title: title, html: html, screen: nil)
            board.reveal(id: id, step: 1) { _ in }
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
                // A tap too short to hold a word is not an error worth reading aloud (2026-10-16: the
                // notch showed "Invalid audio data provided. Must be at least 300ms of 16kHz audio").
                Log.warn("didn't catch that: \(error.localizedDescription)")
                hud.flash(status: "didn't catch that"); return
            }
            try? FileManager.default.removeItem(at: stopped.url)
            loadDictionaryIfNeeded()
            let cleaned = dictionary.apply(to: SpeechText.dictated(text))
            guard !cleaned.isEmpty else { hud.flash(status: "didn't catch that"); return }
            hud.model.transcript = cleaned
            let secure = TextInjection.focusedRole() == "AXSecureTextField"
            let method = TextInjection.insert(cleaned)
            switch method {
            case .accessibility: hud.flash(status: "typed it", for: 2)
            case .paste: hud.flash(status: "pasted it", for: 2)
            case .clipboard: hud.flash(status: secure ? "that's a password field, so it's on your clipboard instead" : "on your clipboard, press command v", for: 6)
            }
            hud.set(phase: .hidden)
            Log.info("dictation (\(method.rawValue)): \(Log.short(cleaned, 120))")
            TranscriptLog.append(kind: .dictation, you: cleaned, dot: nil, app: AccessibilityContext.frontmostAppName(), extra: ["via": method.rawValue])
        }
    }

    /// The typed-question field, the same one a tap of the hotkey opens.
    func showTypedField() { hud.showInput() }

    /// `fromField`: he typed in the notch, so the answer is text there (and spoken only when
    /// `speakTypedAnswers` is on); the command line keeps the voice unless `quiet`.
    func askTyped(_ text: String, quiet: Bool = false, drive: Bool = false, fromField: Bool = false, dry: Bool = false,
                  bench: Bool = false, spoken: Bool = false, shift: Bool = false, cometPort: Int? = nil) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        dryRun = dry
        benchMode = bench
        hands.bench = bench ? Hands.Bench(cometPort: cometPort ?? 9471) : nil
        driveRequested = false
        if phase == .speaking || phase == .thinking { stopSpeaking(); cutActiveTurn() }
        quietTurn = quiet || bench || (fromField && !config.speakTypedAnswers)
        textSurface = fromField
        if drive, config.driveEnabled { driveRequested = true }
        hud.dismissAnswer()
        hud.model.transcript = trimmed
        hud.model.response = ""
        if fromField { hud.set(phase: .thinking) }
        overlay.showTransient()
        overlay.clearMarks(keepRing: walkthrough != nil)
        overlay.hideBubble(after: 0)
        startCapture()
        overlay.setPhase(.thinking)
        if shift { mode = .agent }
        Task { @MainActor in
            await ask(trimmed, typed: !spoken)
            if shift { self.mode = .talk }
        }
    }

    /// Interrupt the turn in flight and drop its result when it comes (the basics pass).
    private func cutActiveTurn() {
        guard let session = activeSession, session.turnInFlight else { return }
        let key = ObjectIdentifier(session)
        // a turn already cut once owes one result, not two (Escape then a quick ask, a cut during a slow tool)
        guard drainCounts[key, default: 0] < session.pendingResults else { return }
        drainCounts[key, default: 0] += 1
        cutNoteOwed.insert(key)
        session.interrupt()
        Log.info("talk: interrupted")
    }

    /// Back to normal after a bench turn: write tools, agents and his own apps again.
    private func endBench() {
        guard benchMode || hands.bench != nil else { return }
        benchMode = false
        hands.bench = nil
    }

    /// Events from a turn Dot cut off: swallowed through its result.
    private func drain(_ event: StreamEvent, from session: ClaudeSession) -> Bool {
        let key = ObjectIdentifier(session)
        guard let owed = drainCounts[key], owed > 0 else { return false }
        if case .result(let result) = event {
            drainCounts[key] = owed - 1
            Log.info("talk: dropped the cut-off turn (\(result.subtype), \(result.durationMs) ms)")
            Log.info("turn[\(session === thinkSession ? "think" : "talk")] done in \(result.durationMs) ms, $\(String(format: "%.4f", result.costUSD)), cut off")
            if !benchMode { ledger.record(kind: session === thinkSession ? "think" : "talk", agent: nil, model: turnModel, result: result, summary: "(cut off)") }
        }
        return true
    }

    // MARK: Asking

    private var lastAskWasLecture = false

    private func ask(_ text: String, typed: Bool) async {
        Log.info("ask: received bench=\(benchMode ? 1 : 0) \(typed ? "typed" : "spoken") text=\(Log.short(text, 120))")
        askReceivedAt = Date()
        if !typed, !benchMode { dryRun = false }
        doIntent = false
        driveCap = nil
        pendingGo = nil
        goRun = nil
        lastAskWasTyped = typed
        lastAskWasLecture = false
        retriedTurn = false   // each question gets its own retry, even after the last one's retry failed
        if !lastAsked.isEmpty { previousAsked = lastAsked }
        lastAsked = text
        if Gratitude.isThanks(text) { overlay.react(.thanks) }
        if !typed { textSurface = false }
        if let captureTask {
            let captured = await captureTask.value
            shots = captured.shots
            context = captured.context
        }
        captureTask = nil
        // The other screen's picture rides along only when he points at it in words (each image is ~1.2k tokens).
        if shots.count > 1, !Self.mentionsOtherScreen(text) { shots = shots.filter { $0.isCursorScreen } }
        // A muted Mac would lose a spoken answer: show it in the notch as well.
        if !textSurface, !quietTurn, AudioDevices.outputIsSilent() {
            textSurface = true
            hud.notify(NotchNotice(id: "muted", icon: "speaker.slash.fill", title: "your sound is off, so the answer is here as text", tone: .warn,
                                   actionTitle: "turn sound on", action: { _ = AudioDevices.restoreOutput() }, seconds: 12))
            Log.info("output is muted; answer goes to the notch")
        }
        // In a lecture or on a call the answer is text in the notch, not a voice (VI-03); the mode's
        // "speak" in his token file decides, so he can turn the voice back on for either.
        if !typed {
            let place = ContextMode.decide(onCall: CallPresence.isOnCall(), lectureListening: lecture.isListening, bundleID: context.bundleIdentifier,
                                           windowTitle: context.windowTitle, url: context.url, boardLesson: lessonCard != nil, override: modeOverride)
            if !StyleTokens.load().mode(place.rawValue).speak {
                textSurface = true
                quietTurn = true
                Log.info("\(place.rawValue) mode: the answer goes to the notch as text")
            }
        }
        Log.info("context: app \(context.appName ?? "?") window \(Log.short(context.windowTitle ?? "", 60)) url \(context.url != nil) selected \(context.selectedText?.count ?? 0) elements \(context.elements.count) shots \(shots.count)\(region != nil ? " box" : "")")

        // Held shift but said "stop the email agent" or "is inbox keeper done": that is for Dot, not a
        // message to the agent (FX-02); it takes the ordinary route, which stops it or answers.
        let addressed = AgentAddress.find(in: text, roster: addressBook)
        let agentMode = mode == .agent && (addressed.map { $0.intent == .tell } ?? true)
        // Shift held over a stray word or two ("Yeah.", "Sam like.") is not a job (2026-10-18 01:34 made two agents).
        if agentMode, addressed == nil, hud.currentConsent == nil, walkthrough == nil, AgentModeFilter.isStray(text) {
            Log.info("jev: nothing asked (shift): \(Log.short(text, 60))")
            hud.flash(status: "didn't catch a request", for: 2)
            phase = .idle
            settle()
            return
        }
        if agentMode, benchMode {
            Log.info("bench: would spawn agent (shift) for \"\(Log.short(text, 80))\"")
            phase = .idle
            settle()
            return
        }
        if agentMode, dryRun {
            // The last hotkey press held shift; a dry run still hands nothing to an agent.
            let named = addressed.flatMap { $0.intent == .tell ? $0.slug : nil }
                ?? AgentAddress.mentioned(in: text, roster: addressBook)?.slug
            Log.info("dry-run: agent mode, would go to \(named ?? "a new handoff") for \"\(Log.short(text, 100))\"")
            hud.flash(status: "dry run: agent mode", for: 4)
            phase = .idle
            settle()
            return
        }
        if agentMode {
            phase = .idle
            hud.set(phase: .hidden)
            overlay.setPhase(.idle)
            speaker.speak("on it.")
            // Held shift and named an agent: it goes to that one (G2).
            if let slug = addressed.flatMap({ $0.intent == .tell ? $0.slug : nil })
                ?? AgentAddress.mentioned(in: text, roster: addressBook)?.slug {
                replyToAgent(slug, text)
            } else {
                startAgent(brief: text, name: nil, fresh: AgentModeFilter.wantsFreshAgent(text))
            }
            region = nil
            settle()
            return
        }

        let route = await self.route(text)
        if dryRun {
            Log.info("dry-run: route \(route) for \"\(Log.short(text, 100))\"")
            switch route {
            case .answer, .think: break   // the model turn runs; its tags are logged, not acted on
            default:
                hud.flash(status: "dry run: \(route)", for: 4)
                phase = .idle
                settle()
                return
            }
        }
        switch route {
        case .consentAnswer(let answer):
            answerConsent(answer)
            return
        case .tellAgent(let slug):
            phase = .idle
            let name = agents.roster().first(where: { $0.slug == slug })?.name ?? slug
            sayLocal("passing that to \(name.lowercased()).")
            replyToAgent(slug, text)
            region = nil
            return
        case .stopAgent(let slug):
            let name = agents.roster().first(where: { $0.slug == slug })?.name ?? slug
            if agents.runningAgents().contains(where: { $0.slug == slug }) || hud.hasConsent(agent: slug) {
                agents.stop(slug)
                sayLocal("stopped \(name.lowercased()).")
            } else {
                sayLocal("\(name.lowercased()) isn't working on anything right now.")
            }
            return
        case .agentStatus(let slug):
            sayLocal(agents.statusLine(for: slug).lowercased())
            if let slug, hud.hasConsent(agent: slug) { hud.bringConsentForward(agent: slug) }
            return
        case .openAgent(let slug):
            openHome?(slug)
            sayLocal("here's \(agentName(slug)).")
            return
        case .openArtifact(let slug, let kind):
            if let file = agents.openNewest(slug, kind: kind) { sayLocal("opening \(file).") } else { sayLocal("\(agentName(slug)) hasn't made a \(kind) yet.") }
            return
        case .pauseAgent(let slug):
            sayLocal(agents.steer(slug, to: nil) ? "paused \(agentName(slug))." : "\(agentName(slug)) isn't working on anything right now.")
            return
        case .steerAgent(let slug, let instruction):
            sayLocal(agents.steer(slug, to: instruction) ? "changing course. \(agentName(slug)) has it." : "\(agentName(slug)) isn't working on anything right now.")
            return
        case .retryAgent(let slug):
            sayLocal(agents.retry(slug) ? "trying that again with \(agentName(slug))." : "there's nothing to retry.")
            return
        case .resumeRoutine(let slug):
            let resumed = resumeRoutines?(slug) ?? 0
            sayLocal(resumed > 0 ? "\(agentName(slug))'s routine is back on." : "\(agentName(slug)) has no paused routine.")
            return
        case .askWhichCard:
            pendingCardChoice = (text, Date().addingTimeInterval(20))
            sayLocal(AgentVoice.whichCard(hud.openConsents.map { (agent: $0.agent, act: $0.title) }))
            return
        case .morning(let yes, let adjust):
            sayLocal(morningAnswer?(yes, adjust) ?? "the morning card is gone.")
            return
        case .setMode(let mode):
            modeOverride = mode
            sayLocal(mode.map { "\($0.rawValue) mode." } ?? "back to normal.")
            return
        case .homeThread(let slug):
            // Typed or spoken, the open thread gets it; Dot says nothing (HeyClicky's thread focus).
            phase = .idle
            agents.reply(to: slug, text: text)
            hud.flash(status: "sent to \(agentName(slug))", for: 2)
            region = nil
            settle()
            return
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
        case .lessonNext:
            advanceLesson()
            scheduleIdleCheck()
            return
        case .lessonBack:
            lessonBack()
            phase = .idle
            settle()
            scheduleIdleCheck()
            return
        case .lessonAgain:
            lessonAgain()
            return
        case .lecture:
            await askLecture(text)
            return
        case .suggestion(let askText):
            await ask(askText, typed: typed)
            return
        case .find(let query):
            await findInDocument(query)
            return
        case .listen:
            await startLecture(title: context.windowTitle.map { String($0.prefix(60)) } ?? "")
            return
        case .stopListening:
            await stopLecture()
            return
        case .recapLecture:
            await recapLecture()
            return
        case .dictionary(let heard, let correct):
            addToDictionary(heard: heard, correct: correct)
            sayLocal("got it, \(correct) is in your dictionary.")
            return
        case .place(let what, let whereWord):
            hud.set(phase: .thinking)
            overlay.setPhase(.thinking)
            let line = await placeCard(what: what, whereWord: whereWord)
            sayLocal(line)
            return
        case .images(let subject):
            hud.set(phase: .thinking)
            overlay.setPhase(.thinking)
            let line = await imagesCard(subject)
            sayLocal(line)
            return
        case .dismiss:
            overlay.hideBubble(after: 0)
            phase = .idle
            settle()
            return
        case .drive:
            if config.jobsEnabled {
                let ask = walkthrough?.ask ?? previousAsked
                let steps = walkthrough?.history.joined(separator: "; ") ?? ""
                endWalkthrough(reason: "handed to a job")
                startJob(goal: steps.isEmpty ? ask : "\(ask) (steps done so far: \(steps))", placement: .front, words: ask)
                return
            }
            startDriving()
            return
        case .job(let placement, let goal, _):
            startJob(goal: goal, placement: placement, words: text)
            return
        case .stopJob(let id):
            if let job = jobs.job(id) { jobs.stop(job, reason: "he said stop") }
            jobLine("stopped.")
            return
        case .stopAllJobs:
            jobs.stopAll(reason: "he said stop everything")
            jobLine("stopped everything.")
            return
        case .resumeJob(let id):
            if let job = jobs.job(id) { jobs.resume(job); lastJobAddressed = id }
            jobLine("going on.")
            return
        case .showJob(let id):
            phase = .idle
            settle()
            if let job = jobs.job(id) { lastJobAddressed = id; Task { @MainActor in await self.jobs.show(job) } }
            return
        case .steerJob(let id, let instruction):
            if let job = jobs.job(id) { jobs.steer(job, instruction: instruction); lastJobAddressed = id }
            jobLine("changing course.")
            return
        case .followUpJob(let id):
            if let job = jobs.job(id) { jobs.followUp(job, text: text); lastJobAddressed = id }
            jobLine("got it.")
            return
        case .jobStatus:
            jobLine(jobs.spokenStatus())
            return
        case .agentAsked:
            phase = .idle
            overlay.setPhase(.speaking)
            speaker.speak("on it, an agent has it.")
            overlay.setBubble("on it, an agent has it.")
            hud.set(phase: .hidden)
            startAgent(brief: text, name: nil, fresh: true)
            region = nil
            scheduleIdleCheck()
            return
        case .act(let command):
            await performAct(command, local: true)
            return
        case .agentFresh:
            phase = .idle
            overlay.setPhase(.speaking)
            speaker.speak("on it, a separate agent has that.")
            overlay.setBubble("on it, a separate agent has that.")
            hud.set(phase: .hidden)
            let brief = previousAsked.isEmpty ? text : "\(text)\n(what he was asking about just before: \(previousAsked))"
            startAgent(brief: brief, name: nil, fresh: true)
            region = nil
            scheduleIdleCheck()
            return
        case .agent:
            phase = .idle
            overlay.setPhase(.speaking)
            speaker.speak("on it, i'll tell you when it's done.")
            overlay.setBubble("on it, i'll tell you when it's done.")
            hud.set(phase: .hidden)
            startAgent(brief: text, name: nil)
            region = nil
            scheduleIdleCheck()
            return
        case .followUp(let slug):
            phase = .idle
            overlay.setPhase(.speaking)
            speaker.speak("passing that along.")
            overlay.setBubble("passing that along.")
            hud.set(phase: .hidden)
            replyToAgent(slug, text)
            region = nil
            scheduleIdleCheck()
            return
        case .closePanel:
            panels.close()
            sayLocal("closed.")
            return
        case .reopenPanel:
            if panels.reopen(text) { sayLocal("here it is again.") } else { sayLocal("i don't have a saved panel that matches that.") }
            return
        case .explain:
            if let think = session(for: .think) {
                // one line at once covers Opus's slower start; the panel fills as it writes
                speaker.speak("putting it on the panel.")
                overlay.setBubble("putting it on the panel.")
                let (message, images) = buildMessage(text, kind: .think)
                lastMessage = message
                lastImages = images
                sendTurn(message, images: images, to: think, kind: .think)
                return
            }
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
    /// What the key heard was the lecturer, not him (his ask 2026-10-15: "try to explain what was just
    /// said, find the part in the paper he was talking about"). Dot reads the screen's words with
    /// on-device OCR, hands them to the model with the screenshot, and explains the passage.
    private func askLecture(_ heard: String) async {
        guard let session = session(for: .talk) else { phase = .idle; settle(); return }
        lastAskWasLecture = true
        hud.flash(status: "lecture: finding the passage", for: 4)
        overlay.setPhase(.thinking)
        // What the lecturer said: the held key's words plus the last minute of the ear, when it is on.
        var said = heard
        let recent = lecture.isListening ? lecture.recent(seconds: 60) : ""
        if !recent.isEmpty, !recent.contains(heard.prefix(40)) { said = recent + " " + heard }
        let located = await locate(query: said, highlightLabel: "the passage")
        var lines: [String] = ["[lecture] dot heard the lecturer (or a video), not a question from him: \"\(heard)\""]
        if !recent.isEmpty { lines.append("the last minute of the lecture, from dot's ear: \"\(Log.short(recent, 900))\"") }
        if let located {
            lines.append("the document in front is \"\(located.title)\"\(located.isPDF ? " (\(located.pageCount) pages)" : ""). the passage the lecturer is on\(located.isPDF ? ", page \(located.page)" : ""):")
            lines.append("\"\(Log.short(located.passage, 1200))\"")
            lines.append(located.highlighted ? "dot has scrolled to it and highlighted it; do not add a highlight of your own." : (located.navigated ? "dot scrolled the document to that page." : "it is on page \(located.page); dot could not scroll there, so say where it is."))
            lines.append("explain the concept in two or three sentences tied to that passage, in the lecturer's own terms. never say that it was not a question.")
        } else {
            var screenText = located?.screenText ?? ""
            if screenText.isEmpty, let shot = shots.first(where: { $0.isCursorScreen }) ?? shots.first { screenText = await TextRecognizer.recognize(jpeg: shot.jpeg) }
            if screenText.count > 3000 { screenText = String(screenText.prefix(3000)) + "…" }
            lines.append("words on his screen, read top to bottom by ocr:\n\(screenText.isEmpty ? "(nothing readable)" : screenText)")
            lines.append("find the passage, figure, slide or formula the lecturer is on. if it is visible, highlight it with [HIGHLIGHT:x,y,w,h:label] (coordinates from the screenshot) and explain the concept in two or three sentences tied to it, in the lecturer's own terms. if it is elsewhere in the document, say where and still explain the idea. never say that it was not a question.")
        }
        let (built, images) = buildMessage(lines.joined(separator: "\n"), kind: .talk)
        lastMessage = built
        lastImages = images
        sendTurn(built, images: images, to: session, kind: .talk)
    }

    struct Located {
        let title: String
        let isPDF: Bool
        let pageCount: Int
        let page: Int
        let passage: String
        let phrase: String
        let navigated: Bool
        let highlighted: Bool
        let screenText: String
    }

    /// Read the document in front, find the passage the words are about, bring it on screen with
    /// the app's own find box when it is not, and box it where the OCR sees it. Nil when there is
    /// no readable document or nothing in it matches.
    private func locate(query: String, highlightLabel: String) async -> Located? {
        guard let document = await documents.document(for: context) else { return nil }
        let hits = DocumentSearch.bestPassages(for: query, in: document.pages, count: 3)
        guard let best = hits.first, best.score >= 1.0 else {
            Log.info("locate: nothing in \"\(Log.short(document.title, 40))\" matches \(Log.short(query, 60))")
            return nil
        }
        let phrase = DocumentSearch.distinctivePhrase(in: best.passage, preferring: query)
        var shot = shots.first(where: { $0.isCursorScreen }) ?? shots.first
        var lines: [RecognizedLine] = []
        if let shot { lines = await TextRecognizer.lines(jpeg: shot.jpeg) }
        var screenText = lines.map(\.text).joined(separator: "\n")
        var navigated = false
        let onScreen = DocumentSearch.contains(screenText, phrase: phrase) || TextRecognizer.box(for: phrase, in: lines) != nil
        Log.info("locate: page \(best.page) score \(String(format: "%.1f", best.score)) phrase \"\(phrase)\" \(onScreen ? "on screen" : "off screen")")
        if !onScreen, !phrase.isEmpty {
            hud.flash(status: "page \(best.page): scrolling there", for: 4)
            var moved = false
            if document.isPDF, let bundle = context.bundleIdentifier, Navigator.pdfApps.contains(bundle) { moved = await Navigator.goToPage(best.page, in: bundle) }
            if await Navigator.find(phrase, in: context.bundleIdentifier) { moved = true }
            if moved {
                navigated = true
                _ = await ScreenSettle.wait(minimum: 0.3, timeout: 1.6)
                if let fresh = try? await ScreenCapture.captureAll(maxDimension: config.screenshotMaxDimension, includeOtherScreens: false) {
                    shots = fresh
                    shot = fresh.first(where: { $0.isCursorScreen }) ?? fresh.first
                    lines = []
                    if let shot { lines = await TextRecognizer.lines(jpeg: shot.jpeg) }
                    screenText = lines.map(\.text).joined(separator: "\n")
                }
            }
        }
        var highlighted = false
        if let shot, let box = TextRecognizer.box(for: phrase, in: lines) {
            let rect = Coordinates.screenRect(fromPixel: box.insetBy(dx: -6, dy: -4), in: shot.frame)
            overlay.highlight(rect.intersection(shot.frame.displayFrame), label: highlightLabel)
            highlighted = true
        }
        return Located(title: document.title, isPDF: document.isPDF, pageCount: document.pageCount, page: best.page, passage: best.passage, phrase: phrase,
                       navigated: navigated, highlighted: highlighted, screenText: screenText)
    }

    /// "find the part about x": answered from the document itself, instantly, with the passage
    /// boxed on screen; the model only comes in when the document has nothing for it.
    private func findInDocument(_ query: String) async {
        hud.flash(status: "looking in the document for \(Log.short(query, 40))", for: 4)
        overlay.setPhase(.thinking)
        if let located = await locate(query: query, highlightLabel: Log.short(query, 24)) {
            phase = .speaking
            overlay.setPhase(.speaking)
            var sentence = located.passage
            var splitter = SentenceSplitter()
            if let first = splitter.feed(located.passage + " ").first { sentence = first }
            let where_ = located.isPDF ? "page \(located.page)" : (located.highlighted ? "found it" : (located.navigated ? "found it, further down" : "it's in there"))
            let line = "\(where_): \(Log.short(sentence, 200))"
            hud.setCaption(line)
            hud.set(phase: .speaking)
            speaker.speak("\(located.isPDF ? "it's on page \(located.page)" : where_). \(Log.short(sentence, 220))")
            if !benchMode { TranscriptLog.append(kind: .talk, you: lastAsked, dot: line, app: context.appName, extra: ["via": "document"]) }
            scheduleIdleCheck()
            return
        }
        guard let session = session(for: .talk) else { phase = .idle; settle(); return }
        acknowledge()
        var screenText = ""
        if let shot = shots.first(where: { $0.isCursorScreen }) ?? shots.first { screenText = await TextRecognizer.recognize(jpeg: shot.jpeg) }
        if screenText.count > 3000 { screenText = String(screenText.prefix(3000)) + "…" }
        let message = "[find] he asked: \"\(lastAsked)\". dot could not read the document's text itself. words on his screen by ocr:\n\(screenText)\nif the thing is visible, highlight it; if it is likely elsewhere, say [FIND:a distinctive phrase that would appear there] on its own line and dot will search the document with the app's find box and highlight the match; then say in a sentence what it covers."
        let (built, images) = buildMessage(message, kind: .talk)
        lastMessage = built
        lastImages = images
        sendTurn(built, images: images, to: session, kind: .talk)
    }

    /// [FIND:phrase] from the model: search the app in front, re-look, box the match.
    private func findOnScreen(phrase: String, label: String) {
        Task { @MainActor in
            let bundle = context.bundleIdentifier
            var lines: [RecognizedLine] = []
            if let shot = shots.first(where: { $0.isCursorScreen }) ?? shots.first { lines = await TextRecognizer.lines(jpeg: shot.jpeg) }
            if TextRecognizer.box(for: phrase, in: lines) == nil {
                guard await Navigator.find(phrase, in: bundle) else { return }
                _ = await ScreenSettle.wait(minimum: 0.3, timeout: 1.6)
                if let fresh = try? await ScreenCapture.captureAll(maxDimension: config.screenshotMaxDimension, includeOtherScreens: false) { shots = fresh }
                if let shot = shots.first(where: { $0.isCursorScreen }) ?? shots.first { lines = await TextRecognizer.lines(jpeg: shot.jpeg) }
            }
            guard let shot = shots.first(where: { $0.isCursorScreen }) ?? shots.first, let box = TextRecognizer.box(for: phrase, in: lines) else {
                Log.info("find: \"\(Log.short(phrase, 50))\" not on screen after the search")
                return
            }
            let rect = Coordinates.screenRect(fromPixel: box.insetBy(dx: -6, dy: -4), in: shot.frame)
            overlay.highlight(rect.intersection(shot.frame.displayFrame), label: label)
            overlay.bringToFront()
        }
    }

    /// Public entry for `Dot --find "phrase"`.
    func findOnScreen(_ phrase: String) {
        startCapture()
        Task { @MainActor in
            if let captureTask { let captured = await captureTask.value; shots = captured.shots; context = captured.context }
            captureTask = nil
            overlay.showTransient()
            findOnScreen(phrase: phrase, label: Log.short(phrase, 24))
        }
    }

    // MARK: The lecture ear

    func startLecture(title: String) async {
        phase = .idle
        hud.set(phase: .hidden)
        if lecture.isListening {
            speaker.speak("still listening, \(lecture.elapsedMinutes) minutes in.")
            scheduleIdleCheck()
            return
        }
        let ok = await lecture.start(title: title)
        hud.model.listeningLine = ok ? "listening to the lecture" : nil
        overlay.setPhase(.speaking)
        speaker.speak(ok ? "listening. ask me about what he says any time, and say stop listening when it's over." : "i couldn't open the microphone for that.")
        if ok { hud.upsertAgent(AgentRow(id: "lecture", name: "lecture", line: "listening; say stop listening when it's over", state: .running, kind: .lesson, canStop: true)) }
        Log.info("lecture: \(ok ? "listening" : "failed to start")")
        scheduleIdleCheck()
    }

    func stopLecture() async {
        guard lecture.isListening else { return }
        let minutes = lecture.elapsedMinutes
        let text = await lecture.stop()
        hud.model.listeningLine = nil
        hud.removeAgent(id: "lecture")
        phase = .idle
        overlay.setPhase(.speaking)
        let words = text.split(separator: " ").count
        speaker.speak(words < 30 ? "stopped. i barely heard anything, so there's no transcript worth keeping." : "stopped after \(minutes) minutes; the transcript is saved. say recap the lecture for the short version.")
        if let file = lecture.transcriptFile, words >= 30 {
            hud.flash(status: "saved \(file.lastPathComponent)", for: 6)
            TranscriptLog.append(kind: .lecture, you: "(lecture, \(minutes) min)", dot: nil, app: context.appName, extra: ["file": file.path, "words": String(words)])
        }
        scheduleIdleCheck()
    }

    private func recapLecture() async {
        guard let session = session(for: .talk) else { phase = .idle; settle(); return }
        let text = lecture.transcript
        guard !text.isEmpty else {
            phase = .idle; overlay.setPhase(.speaking)
            speaker.speak("i haven't heard a lecture yet; say listen to the lecture at the start of one.")
            scheduleIdleCheck()
            return
        }
        acknowledge()
        let clipped = text.count > 24_000 ? "…" + text.suffix(24_000) : text
        let message = "[recap] his ask: \"\(lastAsked)\". the lecture transcript dot heard (\(lecture.elapsedMinutes) minutes, machine transcribed, names may be misspelled):\n\(clipped)\n\ngive the recap he asked for in five or six spoken sentences: the main thread, the two or three ideas that matter, anything that sounded like an announcement (a deadline, an exam, a reading), and the one thing to review. if a card would help (a short outline of the lecture), put one up."
        let (built, images) = buildMessage(message, kind: .talk)
        lastMessage = built
        lastImages = images
        sendTurn(built, images: images, to: session, kind: .talk)
    }

    /// A figure on a card reported a drag, a slider or a tap (VI-06). It only ever starts a talk turn,
    /// never an action; while a turn is running the move waits for the next one he makes.
    private func cardEvent(_ event: CardEvent) {
        endBench()
        driveRequested = false
        if let active = activeSession, active.turnInFlight {
            Log.info("board: event while a turn runs, not sent: \(event.summary)")
            return
        }
        guard let session = session(for: .talk) else { return }
        let message = "[card event] \(event.summary)"
        let (built, _) = buildMessage(message, kind: .talk)
        lastMessage = built
        lastImages = []
        sendTurn(built, images: [], to: session, kind: .talk)
    }

    private func continueBoard(said text: String) {
        guard let session = session(for: .talk) else { return }
        acknowledge()
        let message = "[board] he said: \"\(text)\". if that answers a question you asked, grade it in a sentence first. then reveal the next step with [REVEAL:id:n] and explain it, or answer what he asked and keep the board as it is; when the card is done, say so."
        let (built, images) = buildMessage(message, kind: .talk)
        lastMessage = built
        lastImages = images
        sendTurn(built, images: images, to: session, kind: .talk)
    }

    private enum Route: CustomStringConvertible {
        /// The basics pass: a small thing Dot does itself; a job for a new agent, never the running one.
        case act(ActionCommand), agentFresh
        case answer, agent, think, explain, reopenPanel, closePanel, followUp(String), continueWalkthrough, drive, closeBoard, lessonNext, lessonBack, lessonAgain, lecture, suggestion(String), dismiss, find(String), listen, stopListening, recapLecture, dictionary(heard: String?, correct: String), place(what: String, whereWord: String?), images(String)
        /// Round seven (G2): his spoken answer to the card on show; a named agent told, stopped or asked after.
        case consentAnswer(ConsentVoice.Answer), tellAgent(String), stopAgent(String), agentStatus(String?)
        /// Tonight's voice verbs (VO-01 to VO-13, MB-07).
        case openAgent(String), openArtifact(String, String), pauseAgent(String), steerAgent(String, String), retryAgent(String),
             resumeRoutine(String), askWhichCard(ConsentVoice.Answer), morning(Bool, String?), homeThread(String), setMode(ContextMode?)
        /// The fast lane: a job Dot runs itself, and his words to a running one; an agent only on his words.
        case job(JobPlacement, goal: String, why: String), stopJob(String), stopAllJobs, resumeJob(String), showJob(String),
             steerJob(String, String), followUpJob(String), jobStatus, agentAsked
        var description: String {
            switch self {
            case .act(let command): return "act(\(command.verb) \(command.object))"
            case .agentFresh: return "agentFresh"
            case .answer: return "answer"
            case .agent: return "agent"
            case .think: return "think"
            case .explain: return "explain"
            case .reopenPanel: return "reopenPanel"
            case .closePanel: return "closePanel"
            case .followUp(let slug): return "followUp(\(slug))"
            case .continueWalkthrough: return "continueWalkthrough"
            case .drive: return "drive"
            case .closeBoard: return "closeBoard"
            case .lessonNext: return "lessonNext"
            case .lessonBack: return "lessonBack"
            case .lessonAgain: return "lessonAgain"
            case .lecture: return "lecture"
            case .suggestion: return "suggestion"
            case .dismiss: return "dismiss"
            case .find: return "find"
            case .listen: return "listen"
            case .stopListening: return "stopListening"
            case .recapLecture: return "recapLecture"
            case .dictionary: return "dictionary"
            case .place: return "place"
            case .images: return "images"
            case .consentAnswer(let answer): return "consentAnswer(\(answer))"
            case .tellAgent(let slug): return "tellAgent(\(slug))"
            case .stopAgent(let slug): return "stopAgent(\(slug))"
            case .agentStatus(let slug): return "agentStatus(\(slug ?? "all"))"
            case .openAgent(let slug): return "openAgent(\(slug))"
            case .openArtifact(let slug, let kind): return "openArtifact(\(slug), \(kind))"
            case .pauseAgent(let slug): return "pauseAgent(\(slug))"
            case .steerAgent(let slug, let to): return "steerAgent(\(slug), \(to))"
            case .retryAgent(let slug): return "retryAgent(\(slug))"
            case .resumeRoutine(let slug): return "resumeRoutine(\(slug))"
            case .askWhichCard(let answer): return "askWhichCard(\(answer))"
            case .morning(let yes, let adjust): return "morning(\(yes ? "do it" : "skip")\(adjust.map { ", \($0)" } ?? ""))"
            case .homeThread(let slug): return "homeThread(\(slug))"
            case .setMode(let mode): return "setMode(\(mode?.rawValue ?? "auto"))"
            case .job(let placement, let goal, let why): return "job(\(placement.rawValue)) model=\(JobModel.decide(text: goal)) (\(why))"
            case .stopJob(let id): return "stopJob(\(id))"
            case .stopAllJobs: return "stopAllJobs"
            case .resumeJob(let id): return "resumeJob(\(id))"
            case .showJob(let id): return "showJob(\(id))"
            case .steerJob(let id, let to): return "steerJob(\(id), \(to))"
            case .followUpJob(let id): return "followUpJob(\(id))"
            case .jobStatus: return "jobStatus"
            case .agentAsked: return "agentAsked"
            }
        }
    }

    /// `Dot --ask --dry`: the route and the tags are logged, nothing is handed to an agent, stopped or
    /// answered (round seven: checks voice routing at night without starting agents).
    private var dryRun = false

    /// Set by AppDelegate for the voice verbs: Home's thread for an agent (nil: Home itself), its
    /// paused routines back on (how many), the agent thread open in front of him, the morning card.
    var openHome: ((String?) -> Void)?
    var resumeRoutines: ((String) -> Int)?
    var focusedThread: (() -> String?)?
    var morningAnswer: ((Bool, String?) -> String?)?
    /// Several cards waited and his yes named none: his next words say which (VO-03).
    private var pendingCardChoice: (said: String, until: Date)?
    /// The kind of session the turn in flight belongs to, for the cut-off note (VO-07).
    private var activeKind: SessionKind?
    /// The mode he named ("desk mode"); nil lets the detector decide (VI-03).
    private var modeOverride: ContextMode?

    /// When Dot last ended an answer on a question: a "yes" or "no" soon after is his answer to it.
    private var askedHimAt = Date.distantPast

    /// The roster in AgentAddress's terms.
    private var addressBook: [AgentAddress.Agent] { agents.roster().map { AgentAddress.Agent(slug: $0.slug, name: $0.name) } }

    /// "find the part about x", "where does it talk about x", "go to the section on x": Dot reads
    /// the document itself and scrolls there, no model needed when the words are plainly in it.
    private static let findWords = try! NSRegularExpression(pattern: #"^(?:(?:can you |could you |please )?(?:find|go to|jump to|scroll to|take me to|show me|navigate to) (?:the |that |a )?(?:part|section|bit|page|place|paragraph|passage|spot|where it talks?|where it says)(?: of (?:the|this) (?:paper|pdf|document|reading|chapter))?(?: (?:about|on|that talks about|that says|where it says|about the|on the))?|where (?:does|do|is) (?:it|this|the (?:paper|pdf|document|reading|chapter|text)) (?:talk about|explain|mention|discuss|say|cover|define|introduce|go over)|which page (?:is|has|talks about|covers)) (.+?)\W*$"#, options: .caseInsensitive)
    private static let listenWords = try! NSRegularExpression(pattern: #"^(?:(?:dot,? )?(?:start )?listen(?:ing)? (?:to )?(?:the |this )?(?:lecture|class|talk|lecturer|meeting)|(?:start|begin) (?:the )?lecture(?: mode)?|lecture mode(?: on)?)\W*$"#, options: .caseInsensitive)
    private static let stopListenWords = try! NSRegularExpression(pattern: #"^(?:(?:dot,? )?stop listening|(?:the )?lecture(?:'s| is)? (?:over|done|finished)|end (?:the )?lecture|lecture mode off|stop the lecture)\W*$"#, options: .caseInsensitive)
    private static let recapWords = try! NSRegularExpression(pattern: #"^(?:(?:can you |could you |please )?(?:recap|summarize|summarise|sum up|review|go over) (?:the |this |today's )?(?:lecture|class|talk)|what did i miss(?: in (?:the )?lecture)?|what (?:was|is) (?:the |this )?lecture about)\W*$"#, options: .caseInsensitive)

    private static let yesWords = try! NSRegularExpression(pattern: #"^(yes|yeah|yep|yup|sure|ok(ay)?|go( ahead)?|do it|please|yes please|sounds good)\W*$"#, options: .caseInsensitive)
    private static let noWords = try! NSRegularExpression(pattern: #"^(no|nah|nope|not now|later|no thanks|skip|never mind|nevermind)\W*$"#, options: .caseInsensitive)

    // MARK: Doing the small things (the basics pass, 2026-10-18)

    /// "my other screen", "the left monitor", "on screen two": the other screens' pictures ride along.
    /// "how do i", "show me how", "teach me", "where is": he wants to learn it, so the rings stay his to click.
    static func teachWords(_ text: String) -> Bool {
        text.range(of: #"\b(how (do|can|would|should) (i|you|we)|show me how|teach me|walk me through|where('s| is| do i find)|what('s| is) the way to)\b"#, options: [.regularExpression, .caseInsensitive]) != nil
    }

    static func mentionsOtherScreen(_ text: String) -> Bool {
        text.range(of: #"\b(other|second|left|right|external|top|bottom) (screen|monitor|display|mac)\b|\bscreen (two|2|one|1)\b|\bboth screens\b"#, options: [.regularExpression, .caseInsensitive]) != nil
    }

    /// Run one action now. `local`: a fixed phrase with no model turn, so Dot says the line itself; from a tag, the
    /// model's own sentence already says it, and only a failure gets words.
    private func performAct(_ command: ActionCommand, local: Bool) async {
        if dryRun {
            Log.info("dry-run: act \(command.verb) \(Log.short(command.object, 60))")
            if local { phase = .idle; settle() }
            return
        }
        if case .go(let goal) = command {
            if config.jobsEnabled {
                // [GO] starts a job at once; talk already said its line.
                startJob(goal: lastAsked + "\n" + goal, placement: JobPlacementRule.decide(text: lastAsked, frontApp: context.appName).placement,
                         words: lastAsked, announce: local)
                return
            }
            if local { startGo(goal) } else { pendingGo = goal }
            return
        }
        let started = Date()
        // "go to the part about x" in a document: Dot's own finder reads the text and highlights it
        if case .scroll(.toText(let phrase)) = command, context.bundleIdentifier != Hands.cometBundle {
            if benchMode, !hands.benchAllows(context) { Log.info("bench: blocked action scroll outside the fixture"); return }
            Log.info("act: scroll \(Log.short(phrase, 60)) handed to the document finder")
            await findInDocument(phrase)
            return
        }
        let outcome = await hands.perform(command, context: context)
        let ms = Int(Date().timeIntervalSince(started) * 1000)
        Log.info("act: \(command.verb) \(Log.short(command.object, 60)) \(outcome.ok ? "ok" : "fail") \(ms) ms (\(outcome.detail))")
        if let point = outcome.point { overlay.point(at: point, label: Log.short(command.object, 24)) }
        if let commit = outcome.commitLabel {
            // his rule: ring it for his own hand, never press it
            if let point = outcome.point { overlay.target(at: point, radius: 24, label: commit, hover: false) }
            let line = "that one sends or commits something, so it's yours to press: \(commit.lowercased())."
            if local { sayLocal(line) } else { speaker.speak(line) }
            return
        }
        if case .scroll(.toText(let phrase)) = command, outcome.ok {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in self?.findOnScreen(phrase: phrase, label: Log.short(phrase, 24)) }
        }
        if outcome.unresolved { askedHimAt = Date() }
        if local {
            if outcome.line.isEmpty { phase = .idle; settle() } else { sayLocal(outcome.line) }
        } else if !outcome.ok, !outcome.line.isEmpty {
            speaker.speak(outcome.line)
        }
    }

    /// Several steps on what is in front: a walkthrough Dot drives itself, one ring at a time, six steps at most.
    private func startGo(_ goal: String) {
        guard let session = session(for: .talk) else { return }
        doIntent = true
        if config.driveEnabled { driveRequested = true; driveCap = 6 }
        let text = "[go] do this on the screen for him, one step at a time: \(goal). ring the next control with [TARGET] and dot presses it; use [INSERT] to type into a field and [KEY:return] to run a search; when the result is on screen, point at it and stop, without opening it. anything that sends, submits, applies or pays stays his."
        let (message, images) = buildMessage(text, kind: .talk)
        lastMessage = message
        lastImages = images
        Log.info("act: go \(Log.short(goal, 80)) (driven walkthrough)")
        goRun = (goal, Date())
        sendTurn(message, images: images, to: session, kind: .talk)
    }

    /// He asked for an agent in this ask (his words, or shift held): talk's own agent tags start one only then.
    private var explicitAgent: Bool {
        AgentWords.asksForAgent(lastAsked) || AgentModeFilter.wantsFreshAgent(lastAsked) || mode == .agent
    }

    /// Start a job; Dot says its own start line unless talk already said one.
    private func startJob(goal: String, placement: JobPlacement, words: String, announce: Bool = true) {
        phase = .idle
        hud.set(phase: .hidden)
        overlay.setPhase(.idle)
        let started = jobs.start(goal: goal, placement: placement, context: context, askedAt: askReceivedAt, bench: benchMode,
                                 benchPort: hands.bench?.cometPort, hisWords: words, announce: announce)
        if started == nil { jobLine("i couldn't start that job.") }
        lastJobAddressed = jobs.newest?.id
        region = nil
        scheduleIdleCheck()
    }

    /// A short line about a job: spoken, or in the bench only logged (the bench runs in his room at night).
    private func jobLine(_ line: String) {
        if benchMode {
            Log.info("speak: job (bench, silent) \(line)")
            phase = .idle
            settle()
            return
        }
        sayLocal(line)
    }

    /// Every new agent goes through here: a bench turn logs it instead.
    private func startAgent(brief: String, name: String?, fresh: Bool = false) {
        if benchMode {
            Log.info("bench: would spawn agent \(name ?? "(unnamed)") for \"\(Log.short(brief, 80))\"")
            return
        }
        agents.handoff(brief: brief, agentName: name, context: context, shots: shots, fresh: fresh)
    }

    private func replyToAgent(_ slug: String, _ text: String) {
        if benchMode { Log.info("bench: would spawn agent \(slug) (follow-up) for \"\(Log.short(text, 80))\""); return }
        agents.reply(to: slug, text: text)
    }

    /// Acts the model wrote, run the moment their tag is complete in the stream.
    private func runNewActs() {
        let tags = streamer.allTags
        guard actsDone < tags.count else { return }
        let fresh = tags[actsDone...]
        actsDone = tags.count
        for tag in fresh {
            guard case .act(let command) = tag else { continue }
            let previous = actChain
            let generation = actGeneration
            actChain = Task { @MainActor in
                await previous?.value
                guard generation == self.actGeneration else { Log.info("act: \(command.verb) dropped (its answer was cut off)"); return }
                await self.performAct(command, local: false)
            }
        }
    }

    // MARK: Suggestions in context (from the noticer: "want the gist of this? say yes.")
    private var pendingSuggestion: (Noticer.Suggestion, Date)?
    func offerSuggestion(_ suggestion: Noticer.Suggestion) {
        pendingSuggestion = (suggestion, Date().addingTimeInterval(BackOff.replyWindow))
    }

    private static let backWords = try! NSRegularExpression(pattern: #"^(go )?(back|previous|one back|back one|back up)\W*$"#, options: .caseInsensitive)
    private static let againWords = try! NSRegularExpression(pattern: #"^(again|say (that|it) again|repeat( that| it)?|one more time|once more|what\??)\W*$"#, options: .caseInsensitive)

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

    private static let closePanelWords = try! NSRegularExpression(pattern: #"^(close|clear|hide|dismiss)\b"#, options: .caseInsensitive)
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
        // He was just asked which card his yes was for (VO-03): his next words name the agent.
        if let pending = pendingCardChoice {
            pendingCardChoice = nil
            if Date() < pending.until,
               let slug = AgentVoice.cardAgent(in: text, among: hud.openConsents.map { (slug: $0.agentId, name: $0.agent) }) {
                hud.bringConsentForward(agent: slug)
                // His first words, judged against the card he picked: a guarded one still wants its act named.
                guard let picked = hud.currentConsent else { return .dismiss }
                let answer = ConsentVoice.interpret(pending.said, guarded: picked.guarded, card: picked.title + " " + picked.detail)
                return .consentAnswer(answer == .none ? .needsExplicit : answer)
            }
        }
        // A card on show: "allow", "not now", "yes, send it" answer it (HeyClicky: "by voice too").
        if var card = hud.currentConsent {
            var answer = ConsentVoice.interpret(text, guarded: card.guarded, card: card.title + " " + card.detail)
            // A bare "ok", "yes" or "no" answers the card only when it just came on show and nothing else
            // is waiting on one: a walkthrough, a lesson, board steps, a suggestion, or a question Dot just
            // asked. Otherwise only words aimed at the card ("allow", "not now", "yes, send it") answer it.
            let suggestionLive = pendingSuggestion.map { Date() < $0.1 } ?? false
            let fresh = hud.consentShownAt.map { Date().timeIntervalSince($0) < 20 } ?? false
            let otherAsk = inWalkthrough || lessonCard != nil || board.hasHiddenSteps || suggestionLive || Date().timeIntervalSince(askedHimAt) < 45
            if !ConsentVoice.isAimedAtCard(text), !fresh || otherAsk { answer = .none }
            if answer != .none, answer != .decline {
                // Several agents wait (VO-03): a yes that names one answers that one; one that names none asks which.
                let asking = hud.openConsents.map { (slug: $0.agentId, name: $0.agent) }
                if Set(asking.map(\.slug)).count > 1 {
                    guard let slug = AgentVoice.cardAgent(in: text, among: asking) else { return .askWhichCard(answer) }
                    if slug != card.agentId {
                        hud.bringConsentForward(agent: slug)
                        if let named = hud.currentConsent {
                            card = named
                            answer = ConsentVoice.interpret(text, guarded: card.guarded, card: card.title + " " + card.detail)
                        }
                    }
                }
            }
            if answer != .none { return .consentAnswer(answer) }
        }
        // The morning card is up: "do it", "skip", "do it but ..." answer its first item (MB-07).
        // Not while a walkthrough, a lesson, board steps, a suggestion or a question of Dot's waits on his word.
        let otherAsking = inWalkthrough || lessonCard != nil || board.hasHiddenSteps
            || (pendingSuggestion.map { Date() < $0.1 } ?? false) || Date().timeIntervalSince(askedHimAt) < 45
        if hud.model.morning != nil, !otherAsking, let reply = AgentVoice.morningAnswer(text) { return .morning(reply.yes, reply.adjust) }
        // He named an agent: tell it, stop it, or ask how it is doing (G2).
        if let match = AgentAddress.find(in: text, roster: addressBook) {
            switch match.intent {
            case .tell: return .tellAgent(match.slug)
            case .stop: return .stopAgent(match.slug)
            case .status: return .agentStatus(match.slug)
            case .open: return .openAgent(match.slug)
            case .openArtifact: return .openArtifact(match.slug, match.detail ?? "file")
            case .pause: return .pauseAgent(match.slug)
            case .resumeRoutine: return .resumeRoutine(match.slug)
            }
        }
        // "stop, do X instead" for the agent at work; "retry" for the one he spoke to in the last 15
        // minutes, never into a turn still running. The agent whose Home thread is open comes first (VO-09, VO-06).
        let focused = focusedThread?().flatMap { slug in addressBook.contains(where: { $0.slug == slug }) ? slug : nil }
        let working = agents.runningAgents()
        if let instruction = AgentVoice.steer(text) {
            let target = working.first(where: { $0.slug == focused })?.slug ?? working.first(where: { $0.slug == agents.lastAddressed })?.slug
                ?? (working.count == 1 ? working[0].slug : nil)
            if let target { return .steerAgent(target, instruction) }
        }
        if AgentVoice.isRetry(text) {
            let idle = { (slug: String) in !working.contains(where: { $0.slug == slug }) }
            let recent = Date().timeIntervalSince(agents.lastAddressedAt) < 900 ? agents.lastAddressed : nil
            if let slug = [focused, recent, agents.justReported(within: 900)?.slug].compactMap({ $0 }).first(where: idle) { return .retryAgent(slug) }
        }
        if AgentAddress.isProgressAsk(text), !agents.runningAgents().isEmpty || !hud.openConsents.isEmpty {
            return .agentStatus(nil)
        }
        // The fast lane: his words to a running job (stop, go on after a pause, show me, change course).
        if config.jobsEnabled, !jobs.jobs.isEmpty {
            if let paused = jobs.pausedJob {
                if JobWords.isResume(text) { return .resumeJob(paused.id) }
                jobs.drop(paused, reason: "he moved on")
            }
            if JobWords.isStopAll(text), !jobs.running.isEmpty { return .stopAllJobs }
            if JobWords.isStop(text), let job = jobs.frontJob ?? jobs.newest { return .stopJob(job.id) }
            if JobWords.isShowMe(text), let job = jobs.newestBehind() { return .showJob(job.id) }
            if let instruction = AgentVoice.steer(text), let job = jobs.running.first(where: { $0.id == lastJobAddressed }) ?? jobs.frontJob ?? jobs.newest {
                return .steerJob(job.id, instruction)
            }
            if AgentAddress.isProgressAsk(text), !jobs.running.isEmpty { return .jobStatus }
        }
        // "close the panel" closes the panel; a bare "close it" closes the board, or the panel when it just opened
        // (later, "close this" is likely about his own tab or window)
        let saysClose = Self.closeWords.firstMatch(in: text, range: range) != nil
        if panels.isOpen, PanelCoach.namesPanel(text) || PanelWords.namesPanelLoosely(text), Self.closePanelWords.firstMatch(in: text, range: range) != nil { return .closePanel }
        if saysClose, !board.isEmpty { return .closeBoard }
        if saysClose, panels.isOpen, panels.openedRecently { return .closePanel }
        if panels.available, PanelCoach.wantsReopen(text) { return .reopenPanel }
        if Self.listenWords.firstMatch(in: text, range: range) != nil { return .listen }
        // "desk mode", "study mode", "back to normal" (VI-03): his word beats the detector until he changes it.
        if let override = ContextMode.parseOverride(text) {
            if case .force(let forced) = override { return .setMode(forced) }
            return .setMode(nil)
        }
        if lecture.isListening, Self.stopListenWords.firstMatch(in: text, range: range) != nil { return .stopListening }
        if Self.recapWords.firstMatch(in: text, range: range) != nil, lecture.isListening || !lecture.transcript.isEmpty { return .recapLecture }
        if let match = Self.dictionaryWords.firstMatch(in: text, range: range) {
            return .dictionary(heard: nil, correct: (text as NSString).substring(with: match.range(at: 1)).trimmingCharacters(in: CharacterSet(charactersIn: "\"' ")))
        }
        if let match = Self.spelledWords.firstMatch(in: text, range: range) {
            let heard = (text as NSString).substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespaces)
            let spelled = (text as NSString).substring(with: match.range(at: 2)).replacingOccurrences(of: #"[\s\-.,]"#, with: "", options: .regularExpression)
            if spelled.count >= 2, spelled.count <= 40 { return .dictionary(heard: heard, correct: spelled) }
        }
        // His Home thread for an agent is in front of him: what is left is for that agent (VO-04), after
        // Dot's own commands above (stop, listen, close, a mode, the dictionary).
        if let focused { return .homeThread(focused) }
        if let match = Self.findWords.firstMatch(in: text, range: range), DocumentReader.key(for: context) != nil {
            let query = (text as NSString).substring(with: match.range(at: 1))
            if !query.lowercased().contains("explain") { return .find(query) }
        }
        if let (suggestion, until) = pendingSuggestion {
            pendingSuggestion = nil
            Noticer.clearPending()
            if Date() < until {
                if Self.yesWords.firstMatch(in: text, range: range) != nil { Noticer.record(kind: suggestion.kind, accepted: true); return .suggestion(suggestion.ask) }
                if Self.noWords.firstMatch(in: text, range: range) != nil { Noticer.record(kind: suggestion.kind, accepted: false); return .dismiss }
            }
        }
        // A place or pictures: Dot's own cards, no model turn (HeyClicky's place and image widgets).
        if let ask = Places.parseAsk(text) { return .place(what: ask.what, whereWord: ask.where) }
        if let subject = Images.parseAsk(text) { return .images(subject) }
        // Showing is Dot's own job: a page, a picture, a drawing or a card goes on the board, never to an agent.
        if Self.boardWords.firstMatch(in: text, range: range) != nil { return .answer }
        // A lesson on a stage: next, back and again are Dot's own moves, no model needed.
        if let id = lessonCard, board.isStage(id) {
            if Self.againWords.firstMatch(in: text, range: range) != nil { return .lessonAgain }
            if Self.backWords.firstMatch(in: text, range: range) != nil { return .lessonBack }
            if !lessonHeld.isEmpty || board.shown(of: id) < lessonSpokenMax, Self.continueWords.firstMatch(in: text, range: range) != nil { return .lessonNext }
        } else if lessonCard != nil {
            resetLesson()
        }
        if inWalkthrough || board.hasHiddenSteps, Self.continueWords.firstMatch(in: text, range: range) != nil {
            return .continueWalkthrough
        }
        if config.jobsEnabled, saysDrive(text) {
            // "do it": Dot takes it over as a job, in a walkthrough or after one.
            if inWalkthrough { return .drive }
            let bare = Self.driveWords.stringByReplacingMatches(in: text, range: range, withTemplate: "")
                .trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
            return .job(.front, goal: bare.count < 4 && !previousAsked.isEmpty ? previousAsked : text, why: "do it")
        } else if config.driveEnabled, saysDrive(text) {
            if inWalkthrough, walkthrough?.awaitingNextStep == false { return .drive }
            driveRequested = true   // the walkthrough about to start is his to watch, not to click
        }
        // The small things, with no model (the basics pass): "scroll down", "go back", "open spotify", "pause".
        // An "open X" Dot can't name goes on to the model, which asks one short question.
        if !inWalkthrough, let command = ActionPhrases.match(text) {
            if case .open(let name) = command, !hands.canResolve(name) {
                Log.info("act: \"\(name)\" is no app, folder or bookmark; the model takes it")
            } else {
                Log.info("route: fixed phrase \(command.verb) \(Log.short(command.object, 60))")
                return .act(command)
            }
        }
        if AgentModeFilter.wantsFreshAgent(text), !inWalkthrough { return .agentFresh }
        if config.jobsEnabled, AgentWords.asksForAgent(text) {
            // His words for an agent: nothing else starts one when jobs are on.
            if inWalkthrough { endWalkthrough(reason: "he asked for an agent") }
            return .agentAsked
        }
        guard let jev else {
            if inWalkthrough { endWalkthrough(reason: "new question") }
            return .answer
        }
        let running = agents.runningAgents()
        // No agent at work, but one just reported: his next words may be for it (G2).
        let reporter = running.isEmpty ? agents.justReported() : nil
        var state: [String: Any] = [
            "user_said": text,
            "frontmost_app": context.appName ?? "",
            "window_title": String((context.windowTitle ?? "").prefix(120)),
            "agents_working": running.map { ["name": $0.name, "task": $0.task] },
            "jobs_working": jobs.running.map { ["goal": Log.short($0.goal, 100), "placement": $0.placement.rawValue, "phase": $0.phase.rawValue, "last_step": $0.steps.last ?? ""] },
            "elements_on_screen": context.elements.prefix(40).map { "\($0.role.dropFirst(2)) \($0.title)" },
        ]
        if let selected = context.selectedText, !selected.isEmpty { state["selected_text"] = String(selected.prefix(200)) }
        if let reporter { state["agent_just_reported"] = ["name": reporter.name, "said": reporter.said] }
        if let step = walkthrough {
            state["walkthrough_in_progress"] = ["last_instruction": "\(step.kind == .hover ? "rest on" : "click") \(step.label)", "steps_done": step.history]
        }
        var routeCriteria = [
            "answer": "answer out loud from the screen, the day's calendar and deadlines, or general knowledge, including a quick web lookup; or show something on the board: a card, a drawing, a picture, a live web page (the companion opens pages itself)",
            "act": "a small thing for the companion to do itself right now: open an app, a site, a file or a folder; scroll; go back; click, type into or search something in the window in front; find something on this page or site in a few clicks",
            "agent": "real work in the background that takes minutes: researching across many sources, drafting or writing, making or changing files, going through mail, a long job in another app, anything that sends or submits",
            "think": "a hard reasoning question (a calculation, a tricky technical or finance judgment) that deserves a stronger model",
        ]
        if config.jobsEnabled {
            // The fast lane: doing is the companion's own, any number of steps; agents start only on his words.
            routeCriteria["act"] = "anything for the companion to do rather than answer: open an app, a site, a file or a folder; go somewhere and do something there; click, type, search, scroll; download or save files; fill a form up to its submit button; check a site or an account; make a file or a deck; go through mail; research across sources and write it up; any number of steps, in front of him or in a window behind"
            routeCriteria["agent"] = nil
        }
        if !lastAskWasTyped, text.count >= 40 || lecture.isListening {
            // The held key in a lecture hall picks up the lecturer: statements, not a question to the companion.
            routeCriteria["lecture"] = "the microphone picked up someone else speaking (a lecturer, a video, a conversation): statements about a subject, not a question or request addressed to the companion"
        }
        if !lastAskWasTyped, text.count < 60 {
            // A cough, a half word, a stray "okay yeah": nothing to answer (2026-10-15, "Oh uh" and "But we're um um" each cost a turn).
            routeCriteria["ignore"] = "a fragment with no request in it: a stray word or two, a cough, someone else's half sentence, filler like okay or um with nothing asked"
        }
        var questions: [String: Jev.Question] = [
            "route": .choice(instructions: "How should a voice companion that can see the screen handle what the user just said? Pick one.", criteria: routeCriteria),
        ]
        if config.jobsEnabled, !jobs.running.isEmpty {
            questions["followup"] = .yesNo(instructions: "Is this a follow-up, a steer or more detail for the job or agent that is already working (jobs_working, agents_working), rather than a new request?", yes: "it continues the work already running", no: "a new request or a question about the screen")
        } else if !running.isEmpty {
            questions["followup"] = .yesNo(instructions: "Is this a follow-up, a steer or a question for the agent that is already working, rather than a new request?", yes: "it continues the agent's current task", no: "a new request or a question about the screen")
        } else if reporter != nil {
            questions["followup"] = .yesNo(instructions: "An agent just reported back (agent_just_reported). Is what the user said a reply to it or more work for that same agent (a correction, a next step, a 'now do this'), rather than a new request or a question about the screen?", yes: "it continues that agent's work", no: "a new request or a question about the screen")
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
        if route.choice == "ignore", route.probability >= 0.7, route.confidence >= 0.5 {
            // Before any follow-up: an "ok" or a "thanks" is not a message for an agent.
            Log.info("jev: nothing asked (\(String(format: "%.2f", route.probability))): \(Log.short(text, 60))")
            hud.flash(status: "didn't catch a question", for: 2)
            return .dismiss
        }
        if config.jobsEnabled, let follow = answers["followup"]?.probability, follow >= 0.7,
           let job = jobs.running.first(where: { $0.id == lastJobAddressed }) ?? jobs.newest {
            Log.info("jev: follow-up for job[\(job.id)] (\(String(format: "%.2f", follow)))")
            return .followUpJob(job.id)
        }
        if let follow = answers["followup"]?.probability, follow >= 0.7 {
            // The agent he last spoke to when it is still working, else the newest; with none working,
            // the one that just reported (G2), but never for a bare acknowledgment, which its offered
            // next step would read as a yes.
            if let live = running.first(where: { $0.slug == agents.lastAddressed }) ?? running.first {
                Log.info("jev: follow-up for \(live.name) (\(String(format: "%.2f", follow)))")
                return .followUp(live.slug)
            }
            if let reporter, !AgentAddress.isAcknowledgment(text) {
                Log.info("jev: reply to \(reporter.name), which just reported (\(String(format: "%.2f", follow)))")
                return .followUp(reporter.slug)
            }
        }
        // 0.6: of 13 pre-points to 10-19 the one under it (0.51, "Voice Mode" for "no audio so show visually") was the one wrong
        if let element = answers["element"]?.choice, element.choice != "none", element.probability >= 0.6, element.confidence >= 0.6,
           let index = Int(element.choice.dropFirst()), context.elements.indices.contains(index) {
            let hit = context.elements[index]
            Log.info("jev: pre-pointing at \(hit.role) \"\(hit.title)\" (\(String(format: "%.2f", element.probability)))")
            overlay.point(at: CGPoint(x: hit.frame.midX, y: hit.frame.midY), label: String(hit.title.prefix(24)))
        }
        if route.choice == "lecture", route.probability >= 0.6, route.confidence >= 0.5 { return .lecture }
        if config.jobsEnabled, route.choice == "act", route.probability >= 0.5, route.confidence >= 0.5, !PanelCoach.wantsPanel(text), !Self.teachWords(text) {
            if config.jobsSmallActsInTalk, JobWords.isSingleAct(text) {
                // One small act on what is in front stays a talk tag, as fast as before.
                Log.info("jev: one small act (\(String(format: "%.2f", route.probability))); talk writes the tag")
                return .answer
            }
            let (placement, why) = JobPlacementRule.decide(text: text, frontApp: context.appName)
            Log.info("route: job placement=\(placement.rawValue) (\(why))")
            return .job(placement, goal: text, why: why)
        }
        if route.choice == "act", route.probability >= 0.5, route.confidence >= 0.5, !PanelCoach.wantsPanel(text), !Self.teachWords(text) {
            // done, not explained: the talk model writes the action tags, and any rings it gives are pressed by Dot
            Log.info("jev: do it (\(String(format: "%.2f", route.probability)))")
            doIntent = true
            if config.driveEnabled { driveRequested = true; driveCap = 6 }
            goRun = (text, Date())
            return .answer
        }
        if !config.jobsEnabled, route.choice == "agent", route.probability >= config.jevRouteThreshold, route.confidence >= 0.6 {
            // Agent work that names one of his agents goes to that agent (G2), not the default one.
            if let named = AgentAddress.mentioned(in: text, roster: addressBook) { return .tellAgent(named.slug) }
            return .agent
        }
        if route.choice == "think", route.probability >= 0.75, route.confidence >= 0.6 { return panels.available && PanelCoach.wantsPanel(text) ? .explain : .think }
        // Round eight: an explanation (explain, walk me through, visualize, why does...) is written on the panel by Opus.
        if panels.available, PanelCoach.wantsPanel(text) { return .explain }
        return .answer
    }

    /// A quiz answer on the panel: the quick model grades it in one spoken sentence with no routing and no screenshot
    /// (the plan: Sonnet grades and moves on); when the next step needs a new panel it hands over with [THINK]. It promises
    /// nothing about the next step: on 2026-10-18 21:16 it said "on to the next step on the panel" and think, which wrote
    /// the panel, answered "there isn't a next step".
    func panelEvent(_ line: String) {
        endBench()
        driveRequested = false
        guard let session = session(for: .talk) else { return }
        lastAsked = line
        lastAskWasTyped = false
        retriedTurn = false
        let message = "[panel] \(line). grade it in one spoken sentence, saying why when it is wrong, and stop there; if he was walking through steps, append [THINK] so the stronger model decides what comes next. never say what comes next yourself (you can't see whether the panel has another step), and don't ask whether to go on.\n[context]\nnow: \(Self.nowLine())\n" + panels.contextLines().joined(separator: "\n") + "\n[/context]"
        sendTurn(message, images: [], to: session, kind: .talk)
    }

    /// `Dot --panel file.ui`: show a UI-language file in the panel (tests, and reopening by hand).
    func showPanelFile(_ path: String) { if path == "close" { panels.close() } else { panels.showFile(path) } }

    /// Talk may make and move his own events, but one with guests goes through an agent and a card.
    static let guestTools: Set<String> = ["mcp__atlas__calendar_create", "mcp__atlas__calendar_update"]

    private func sendTurn(_ message: String, images: [(data: Data, mediaType: String)], to session: ClaudeSession, kind: SessionKind) {
        // A new question supersedes the one still being answered, like talking over someone; its result is dropped.
        if let active = activeSession, active.turnInFlight {
            cutActiveTurn()
            stopSpeaking()
        }
        actsDone = 0
        hud.hideInput()
        activeSession = session
        streamer = BeatStreamer(eagerFirst: config.eagerSpeech && !quietTurn)
        panels.beginTurn()
        speechStarted = false
        toolLineSaid = false
        bubbleGroup = ""
        bubbleLabel = nil
        turnRevealsEnqueued = 0
        beatsFired = 0
        quietWork.forEach { $0.cancel() }
        quietWork = []
        quietClock = Date()
        actGeneration += 1
        turnStartedAt = Date()
        firstSentenceLogged = false
        lastTurnAt = Date()
        if kind == .talk { turnsInSession += 1 } else { thinkTurns += 1; lastThinkAt = Date() }
        turnModel = kind == .talk ? config.talkModel : config.thinkModel
        phase = .thinking
        hud.model.deeper = kind == .think
        activeKind = kind
        hud.set(phase: .thinking)
        overlay.setPhase(.thinking)
        // the retry resends what this session got: an escalated think turn used to get talk's message again (2026-10-18 21:05)
        lastMessage = message
        lastImages = images
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
        // The context mode (VI-03, PL-T10): how the answer should look and sound here.
        let mode = ContextMode.decide(onCall: CallPresence.isOnCall(), lectureListening: lecture.isListening, bundleID: context.bundleIdentifier,
                                      windowTitle: context.windowTitle, url: context.url, boardLesson: lessonCard != nil, override: modeOverride)
        board.mode = mode.rawValue
        hud.model.modeWord = mode == .normal ? nil : "\(mode.rawValue) mode"
        speaker.setRate(StyleTokens.load().mode(mode.rawValue).voiceRate)
        if mode != .normal { lines.append("[mode] \(mode.rawValue)") }
        // This message cuts off the answer still being given in the same conversation (VO-07). Claude Code records the
        // cut as "the user doesn't want to proceed": it isn't a refusal (2026-10-18 12:49, "i held off searching").
        let target = kind == .talk ? talkSession : thinkSession
        if let target, cutNoteOwed.remove(ObjectIdentifier(target)) != nil || activeSession?.turnInFlight == true && activeKind == kind {
            lines.append("note: dot cut off the last turn because he asked something new; he declined nothing, and a \"doesn't want to proceed\" in the history is only that cut. don't mention it; redo any lookup this question needs.")
        }
        if doIntent { lines.append("[do] he wants this done, not explained: use the action tags; for several steps ring one at a time and dot presses each.") }
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
                // Each stroke in its own words: circled, a line along, scribbled over (HeyClicky's ScreenAnnotationManager does the same).
                let described: String
                if marks.count >= 2 {
                    described = marks.enumerated().map { index, mark in
                        let p = Coordinates.pixelRect(fromScreen: mark.rect, in: cursorShot.frame)
                        return "mark \(index + 1): he \(mark.shape.words) the region at \(Int(p.minX)),\(Int(p.minY)) size \(Int(p.width))x\(Int(p.height))"
                    }.joined(separator: "; ") + " (in that order; a question like \"why does this follow from that\" refers to them in order)"
                } else {
                    let shape = marks.first?.shape ?? .enclosure
                    described = "he \(shape.words) a region of image \(cursorIndex + 1): its box is at \(Int(pixels.minX)),\(Int(pixels.minY)) size \(Int(pixels.width))x\(Int(pixels.height)) pixels"
                }
                if let crop = ImageCrop.crop(jpeg: cursorShot.jpeg, pixelRect: pixels), crop.width >= 16, crop.height >= 12 {
                    images.append((data: crop.data, mediaType: "image/jpeg"))
                    lines.append("\(described); image \(images.count) is that region enlarged (\(crop.width)x\(crop.height)). answer about what he marked.")
                } else {
                    lines.append("\(described). answer about what he marked.")
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
        lines.append(contentsOf: panels.contextLines())
        lines.append(contentsOf: calendarLines(for: transcript))
        if let stale = AtlasFreshness.parse(replicaState: try? Data(contentsOf: replicaStateURL), boxWatch: try? Data(contentsOf: boxWatchURL)).staleLine(now: Date()) {
            lines.append(stale)
        }
        lines.append(contentsOf: courseMapLines(for: transcript, kind: kind))
        // Who is working for him and what they just said, so "what did the agent find" has an answer.
        let recent = agents.recentRuns()
        if !recent.isEmpty {
            lines.append("agents: " + recent.map { run -> String in
                var line = "\(run.name) (\(run.state)): \(run.task)"
                if let result = run.result, !result.isEmpty { line += "; it said: \"\(Log.short(result, 320))\"" }
                else if !run.line.isEmpty { line += "; now: \(Log.short(run.line, 80))" }
                return line
            }.joined(separator: " | "))
        }
        if config.jobsEnabled {
            let jobsLine = jobs.statusLine()
            if !jobsLine.isEmpty { lines.append(jobsLine) }
        }
        // Every agent he has, not only the last 45 minutes' (G2): an idle one is reached by name, not founded twice.
        let busy = Set(recent.map { $0.name.lowercased() })
        let idle = agents.roster().filter { $0.slug != "dot" && !busy.contains($0.name.lowercased()) }.map(\.name)
        if !idle.isEmpty {
            lines.append("his other agents, idle (reach one with [TELL:name:message]): " + idle.joined(separator: ", "))
        }
        if lecture.isListening {
            lines.append("dot's ear is on: listening to the lecture for \(lecture.elapsedMinutes) min; the last minute: \"\(Log.short(lecture.recent(seconds: 60), 600))\"")
        }
        // His long recordings live in Murmur; they ride along only when he asks about them.
        if MurmurHistory.asksAboutRecordings(transcript), let block = MurmurHistory.block(file: config.murmurHistoryFile) {
            lines.append(block)
        }
        if let step = walkthrough {
            let left = max(config.walkthroughMaxSteps - step.step, 0)
            lines.append("walkthrough: step \(step.step) was \"\(step.kind == .hover ? "rest on" : "click") \(step.label)\"; \(left) click-to-advance steps left" +
                         (step.history.isEmpty ? "" : "; so far: " + step.history.joined(separator: "; ")))
        }
        // The other conversation's last exchanges, for "it" and "show me" (2026-10-19 08:58).
        let unseen = shared.unseen(by: kind == .talk ? .talk : .think, now: Date())
        if !unseen.isEmpty { lines.append(contentsOf: SharedTurns.lines(unseen)) }
        lines.append("[/context]")
        lines.append("")
        lines.append(transcript)
        return (lines.joined(separator: "\n"), images)
    }

    /// Atlas's replica files (present only on a Mac that holds a copy of the brain): how old the copy is.
    private var replicaStateURL: URL { URL(fileURLWithPath: DotConfig.expand(config.atlasRoot)).appendingPathComponent("Atlas/private/replica-state.json") }
    private var boxWatchURL: URL { URL(fileURLWithPath: DotConfig.expand(config.atlasRoot)).appendingPathComponent("Atlas/private/box-watch.json") }

    /// His calendar for this turn: this Mac's own (live) once he has granted it, else Atlas's copy with its age.
    private func calendarLines(for transcript: String) -> [String] {
        let wide = CalendarLines.isCalendarAsk(transcript)
        if let items = localCalendar.items(days: 15) {
            return CalendarLines.block(items, now: Date(), wide: wide, source: "this mac's calendar, live")
        }
        guard let brief = atlas.brief else { return [] }
        let lines = wide && !brief.calendar14.isEmpty ? brief.calendar14 : brief.today
        let age = brief.builtAt.isEmpty ? "" : ", read \(brief.builtAt.replacingOccurrences(of: "T", with: " "))"
        let span = wide && !brief.calendar14.isEmpty ? "the next \(lines.count) events, up to 14 days out" : "today"
        var block = ["[calendar] atlas's copy\(age)\(brief.calendarCoverage.map { " (\($0))" } ?? ""); \(span)" + (lines.isEmpty ? ": nothing" : ":")]
        block += lines.prefix(45).map { "- \($0)" }
        block.append("[/calendar]")
        return block
    }

    /// A course's map joins the conversation once, the first time that course is on screen or named.
    private func courseMapLines(for transcript: String, kind: SessionKind) -> [String] {
        guard let session = kind == .talk ? talkSession : thinkSession else { return [] }
        let key = ObjectIdentifier(session)
        let seen = coursesInSession[key] ?? []
        let where_ = [context.windowTitle, context.url, transcript, context.documentPath].compactMap { $0 }.joined(separator: " ")
        let screenWords = ([context.selectedText ?? ""] + context.elements.prefix(60).map(\.title)).joined(separator: " ")
        var detected = CourseTag.detect(context: where_, content: screenWords, among: panels.courses)
        if detected == nil, let last = lastCourse, Date().timeIntervalSince(last.at) < 2 * 3600 {
            detected = panels.courses.first { $0.code == last.code }
        }
        guard let course = detected else { return [] }
        lastCourse = (course.code, Date())
        guard !seen.contains(course.code), let map = Prompts.courseMap(course.code, in: config.talkRootURL) else { return [] }
        coursesInSession[key] = seen.union([course.code])
        Log.info("talk: \(course.label) course map joins this conversation")
        return ["[course map] \(course.label), for this and later questions in this conversation:", map, "[/course map]"]
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
            for beat in streamer.feed(panels.filter(delta)) { enqueue(beat) }
            runNewActs()
            if textSurface {
                // A typed question: the words appear in the notch as they are written.
                let ahead = (streamer.spokenSoFar + " " + streamer.partial).trimmingCharacters(in: .whitespaces)
                if !ahead.isEmpty { hud.model.response = ahead; hud.set(phase: .thinking) }
            } else if config.hudShowsResponse {
                hud.model.response = streamer.spokenSoFar
            }
        case .assistantText(let text):
            if streamer.spokenSoFar.isEmpty, streamer.partial.isEmpty, !panels.openedThisTurn { for beat in streamer.feed(panels.filter(text)) { enqueue(beat) } }
        case .toolUse(_, let name, let input):
            Log.info("talk: tool \(name) \(Log.short(input.map { "\($0.key)=\($0.value.json)" }.joined(separator: " "), 120))")
            hud.flash(status: "checking \(Self.friendlyTool(name))")
            // A talk turn with a lookup said nothing for 9.8 s (median, to 10-19) after the ack: one line while it looks.
            if !toolLineSaid, !quietTurn, activeKind == .talk, streamer.spokenSoFar.isEmpty, let what = Self.spokenTool(name) {
                toolLineSaid = true
                speaker.speak("checking \(what).")
            }
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
        if holdForLesson(beat) { return }
        play(beat)
    }

    private static func revealTag(_ beat: Beat) -> (String, Int)? {
        for tag in beat.tags { if case .reveal(let id, let step) = tag { return (id, step) } }
        return nil
    }

    /// A stage shows one step at a time. The card and its first step play as they arrive; from the
    /// second [REVEAL] on, the beats wait in order until he says next, presses next, or the board
    /// is cleared. A card or [CLEAR_BOARD] in a later turn drops whatever was still waiting.
    private func holdForLesson(_ beat: Beat) -> Bool {
        for tag in beat.tags {
            if case .card(let id, _, _, let html, _) = tag {
                resetLesson()
                if BoardManager.isStageHTML(html) { lessonCard = id }
                return false
            }
            if case .clearBoard = tag { resetLesson(); return false }
        }
        if let (id, step) = Self.revealTag(beat), id == lessonCard {
            turnRevealsEnqueued += 1
            // A second reveal in the same turn, for a step not yet spoken: hold from here on.
            if turnRevealsEnqueued >= 2, step > lessonSpokenMax, !lessonHolding {
                lessonHolding = true
                Log.info("lesson[\(id)] holding from step \(step)")
            } else if turnRevealsEnqueued == 1 {
                // The model took the lesson back (a continuation or a re-explanation): leftovers go.
                lessonHeld = []
                lessonHolding = false
            }
        }
        if lessonHolding { lessonHeld.append(beat); return true }
        return false
    }

    private func resetLesson() {
        lessonCard = nil
        lessonHeld = []
        lessonHolding = false
        lessonStep = 0
        lessonSpokenMax = 0
        lessonSaid = [:]
    }

    /// "next": the step he has not heard yet plays from the held beats; a step he went back over
    /// comes forward again without a word; a card with nothing held just shows its next step.
    private func advanceLesson() {
        guard let id = lessonCard, board.isStage(id) else { return }
        board.setWaiting(id: id, on: false)
        let shown = board.shown(of: id)
        if shown < lessonSpokenMax {
            board.reveal(id: id, step: shown + 1) { _ in }
            return
        }
        guard !lessonHeld.isEmpty else {
            // Nothing written ahead (a hand-made card, or the model stopped to ask): the model narrates the next step.
            if shown < board.total(of: id) { continueBoard(said: "next") }
            else { clearBoard() }
            return
        }
        var batch = [lessonHeld.removeFirst()]
        while let next = lessonHeld.first, Self.revealTag(next) == nil { batch.append(lessonHeld.removeFirst()) }
        Log.info("lesson[\(id)] next: \(batch.count) beat(s), \(lessonHeld.count) still held")
        stopSpeaking()
        for beat in batch { play(beat) }
        scheduleIdleCheck()
    }

    private func lessonBack() {
        guard let id = lessonCard, board.isStage(id) else { return }
        let shown = board.shown(of: id)
        guard shown > 1 else { return }
        stopSpeaking()
        overlay.hideBubble(after: 0)
        board.reveal(id: id, step: shown - 1) { _ in }
    }

    private func lessonAgain() {
        guard let id = lessonCard, board.isStage(id) else { return }
        let step = board.shown(of: id)
        guard let text = lessonSaid[step]?.trimmingCharacters(in: .whitespaces), !text.isEmpty else { return }
        stopSpeaking()
        phase = .speaking
        overlay.setPhase(.speaking)
        speaker.speak(text)
        scheduleIdleCheck()
    }

    private func jumpLesson(to step: Int) {
        guard let id = lessonCard, board.isStage(id), step >= 1 else { return }
        if step <= lessonSpokenMax || lessonHeld.isEmpty {
            stopSpeaking()
            board.reveal(id: id, step: min(step, max(board.total(of: id), 1))) { _ in }
        } else {
            advanceLesson()
        }
    }

    private func play(_ beat: Beat) {
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
        if !beat.text.isEmpty, !firstSentenceLogged {
            firstSentenceLogged = true
            Log.info("turn[\(activeKind?.rawValue ?? "talk")] first sentence \(Int(Date().timeIntervalSince(turnStartedAt) * 1000)) ms")
        }
        speechStarted = true
        if phase != .speaking, !beat.text.isEmpty {
            phase = .speaking
            overlay.setPhase(.speaking)
            // The notch shows the state and the line being said, the way HeyClicky's does.
            hud.set(phase: .speaking)
        }
        let visuals = beat.tags.filter { $0.isVisual }
        Log.info("beat \(beatsFired)\(quietTurn ? " (quiet)" : ""): " + (visuals.isEmpty ? "" : visuals.map { "\($0)" }.joined(separator: " ") + " ") + Log.short(beat.text, 120))
        // a STEP only lights the panel: the box on his notes stays while he reads
        if visuals.contains(where: { if case .step = $0 { return false }; return true }) { overlay.fadeOldMarks() }
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
                if walkthrough?.driving == true || driveRequested, let shot = shot(forScreen: screen), !body.isEmpty, !benchMode || hands.benchAllows(context) {
                    // his cursor never moves: focus the field through accessibility and put the text in
                    let target = Coordinates.screenPoint(fromPixel: CGPoint(x: x, y: y), in: shot.frame)
                    if Hands.focus(atAppKit: target) {
                        let method = TextInjection.insert(body)
                        Log.info("act: insert (type tag) via \(method.rawValue)")
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
                if id == lessonCard { lessonStep = step; lessonSpokenMax = max(lessonSpokenMax, step) }
                board.reveal(id: id, step: step) { [weak self] rect in
                    guard let self, let rect else { return }
                    let tail = CGPoint(x: rect.minX + 4, y: rect.midY)
                    let frame = self.board.frame(of: id) ?? rect
                    let seat = CGPoint(x: frame.minX - 22, y: rect.midY - 4)
                    self.overlay.point(at: tail, label: "", seat: seat)
                    self.overlay.bringToFront()
                }
                label = label ?? "step \(step)"
            case .step(_, let n):
                panels.setStep(n)
                label = label ?? "step \(n)"
            case .clearBoard:
                // "closing the panel." with [CLEAR_BOARD] and nothing on the board closed nothing (2026-10-19 09:55, twice)
                // (never the panel this same answer just opened)
                if board.isEmpty, panels.isOpen, !panels.openedThisTurn { panels.close() } else { clearBoard() }
            case .find(let phrase):
                findOnScreen(phrase: phrase, label: label ?? Log.short(phrase, 24))
                label = label ?? Log.short(phrase, 24)
            case .stock(let symbol):
                showStock(symbol)
                label = label ?? symbol
            case .place(let query):
                let ask = Places.parseAsk(query) ?? (what: query, where: nil)
                Task { @MainActor in _ = await self.placeCard(what: ask.what, whereWord: ask.where) }
                label = label ?? Log.short(ask.what, 24)
            case .images(let query):
                Task { @MainActor in _ = await self.imagesCard(query) }
                label = label ?? Log.short(query, 24)
            default:
                break
            }
        }
        if lessonCard != nil, !beat.text.isEmpty {
            lessonSaid[lessonStep, default: ""] += (lessonSaid[lessonStep, default: ""].isEmpty ? "" : " ") + beat.text
        }
        guard !beat.text.isEmpty else { return }
        // The words are in the voice. The notch shows the line being said; the page stays clear
        // (his verdict on the bubble, 2026-10-15: "this looks bad"). A typed answer is already
        // streaming into the notch as text, so no caption on top of it.
        if textSurface { return }
        if config.cursorBubble {
            if let id = lessonCard, board.isStage(id) { overlay.hideBubble(after: 0); return }
            if beat.hasVisual { bubbleLabel = label.map { String($0.prefix(32)) } }
            bubbleGroup = Self.bubbleLine(beat.text)
            if !bubbleGroup.isEmpty { overlay.setBubble(bubbleGroup, label: bubbleLabel) }
        } else {
            hud.setCaption(Self.bubbleLine(beat.text, limit: 170))
        }
    }

    /// [STOCK:NVDA]: a live quote card on the board.
    private func showStock(_ symbol: String) {
        Task { @MainActor in
            guard let quote = await Quotes.quote(symbol) else { hud.flash(status: "no quote for \(symbol)", for: 3); return }
            showCard(id: "stock-\(symbol.lowercased())", rect: nil, title: "\(quote.name) (\(symbol))", html: Quotes.cardHTML(quote), screen: nil)
        }
    }

    /// [PLACE:coffee near campus]: the nearest matches from Maps, on a map, on the board. Returns the spoken line.
    @discardableResult
    private func placeCard(what: String, whereWord: String?) async -> String {
        let home = CLLocationCoordinate2D(latitude: config.homeLatitude, longitude: config.homeLongitude)
        let query = whereWord.map { "\(what) near \($0)" } ?? what
        let places = await Places.search(query, near: home, radiusMeters: whereWord == nil ? 6000 : 30000)
        guard !places.isEmpty else {
            hud.flash(status: "no places for \(what)", for: 3)
            return "i couldn't find \(what) \(whereWord.map { "near \($0)" } ?? "nearby")."
        }
        let center = whereWord == nil ? home : places[0].coordinate
        let map = await Places.snapshot(of: places, center: center, accentHex: config.pointerColorHex)
        showCard(id: "place", rect: nil, title: "\(what) near \(whereWord ?? "campus")",
                 html: Places.cardHTML(query: query, places: places, mapPNG: map, nearName: whereWord ?? "hyde park"), screen: nil)
        Log.info("place: \(places.count) for \"\(query)\": " + places.map { "\($0.name) \(Int($0.distanceMeters)) m" }.joined(separator: ", "))
        return Places.spokenLine(query: what, places: places)
    }

    /// [IMAGES:subject]: a strip of pictures on the board. Returns the spoken line.
    @discardableResult
    private func imagesCard(_ query: String) async -> String {
        let items = await Images.search(query)
        guard !items.isEmpty else { hud.flash(status: "no pictures for \(query)", for: 3); return "i couldn't find pictures of \(query)." }
        showCard(id: "images", rect: nil, title: "pictures: \(query)", html: Images.cardHTML(query: query, items: items), screen: nil)
        Log.info("images: \(items.count) for \"\(query)\"")
        return "here are some pictures of \(query)."
    }

    /// His spoken answer to the card on show (G2): allow, allow for the rest of the task, or not now.
    /// A guarded card (a send, a payment, a delete, a push, a change to the Mac) wants the act named,
    /// so a bare yes gets one sentence saying how instead.
    private func answerConsent(_ answer: ConsentVoice.Answer) {
        guard let card = hud.currentConsent else { return }
        let agent = card.agent.lowercased()
        Log.info("consent by voice: \(answer) for \(card.agent): \(card.title)")
        switch answer {
        case .allow:
            card.onAllow()
            sayLocal("okay, \(agent) can \(card.title).")
        case .allowForTask:
            if let always = card.onAlways {
                always()
                sayLocal("okay, \(agent) can do that for the rest of this task.")
            } else {
                card.onAllow()
                sayLocal("okay, \(agent) can \(card.title).")
            }
        case .decline:
            card.onDeny()
            sayLocal("okay, \(agent) won't.")
        case .needsExplicit:
            sayLocal("that one goes out or can't be undone, so say it in words, like yes, send it, or click allow.")
        case .none:
            break
        }
    }

    /// A local answer with no model turn: the line in the notch and the voice, then settle.
    private func agentName(_ slug: String) -> String {
        (agents.roster().first(where: { $0.slug == slug })?.name ?? slug).lowercased()
    }

    private func sayLocal(_ line: String) {
        phase = .idle
        overlay.setPhase(.speaking)
        hud.set(phase: .speaking)
        hud.setCaption(line)
        speaker.speak(line)
        scheduleIdleCheck()
    }

    /// The bubble holds one spoken sentence, cut at a word when it runs long.
    static func bubbleLine(_ text: String, limit: Int = 110) -> String {
        let line = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard line.count > limit else { return line }
        let head = String(line.prefix(limit))
        if let space = head.lastIndex(of: " "), head.distance(from: head.startIndex, to: space) > limit / 2 {
            return String(head[..<space]) + "…"
        }
        return head + "…"
    }

    private func finishTurn(_ result: ResultInfo) {
        for beat in streamer.feed(panels.endTurn()) { enqueue(beat) }
        for beat in streamer.flush() { enqueue(beat) }
        runNewActs()
        // A failed turn's result is the CLI's diagnostic ("[ede_diagnostic] ..." was spoken aloud on
        // 2026-10-15 13:22), never words for him.
        if !result.isError, streamer.spokenSoFar.isEmpty, streamer.allTags.isEmpty, !panels.openedThisTurn, let text = result.resultText, !text.isEmpty,
           !text.hasPrefix("[ede_diagnostic]") {
            panels.beginTurn()
            for beat in streamer.feed(panels.filter(text) + panels.endTurn()) { enqueue(beat) }
            for beat in streamer.flush() { enqueue(beat) }
        }
        let tags = streamer.allTags
        let spoken = streamer.spokenSoFar
        if spoken.trimmingCharacters(in: .whitespacesAndNewlines).hasSuffix("?") { askedHimAt = Date() }
        if config.hudShowsResponse { hud.model.response = spoken }
        if textSurface, !spoken.isEmpty {
            hud.model.response = ""
            hud.presentAnswer(question: lastAsked, text: spoken)
        }
        let kind = activeSession === thinkSession ? "think" : "talk"
        // bench turns are tests, not his history or his spend
        if !benchMode { ledger.record(kind: kind, agent: nil, model: turnModel, result: result, summary: hud.model.transcript) }
        if !benchMode { TranscriptLog.append(kind: lastAskWasTyped ? .typed : (lastAskWasLecture ? .lecture : .talk), you: lastAsked, dot: spoken, app: context.appName,
                             extra: ["model": turnModel, "ms": String(result.durationMs)]) }
        if !benchMode, !result.isError {
            let handedOff = kind == "talk" && tags.contains { if case .think = $0 { return true }; return false }
            shared.record(kind == "think" ? .think : .talk, asked: lastAsked, said: spoken, at: Date(), handedOff: handedOff)
        }
        Log.info("turn[\(kind)] done in \(result.durationMs) ms, $\(String(format: "%.4f", result.costUSD)), \(tags.filter { $0.isVisual }.count) visual beat(s), tags \(tags.map { "\($0)" }.joined(separator: " | "))")
        Log.info("turn[\(kind)] said: \(Log.short(spoken, 240))")
        if !result.isError { retriedTurn = false }
        if result.isError, spoken.isEmpty {
            // 2026-10-15: two turns in class failed with error_during_execution in 44 and 413 ms, nothing
            // said and nothing spent: the CLI dropped them before the model saw them. One retry covers that.
            // A cut-off turn never gets here (drain drops it); only a turn the CLI dropped on its own is sent again.
            if TurnRetry.shouldRetry(subtype: result.subtype, durationMs: result.durationMs, cutOffByDot: false, alreadyRetried: retriedTurn, hasMessage: !lastMessage.isEmpty),
               let session = activeSession {
                retriedTurn = true
                Log.warn("turn[\(kind)] failed in \(result.durationMs) ms with nothing said: \(Log.short(result.resultText ?? "no detail", 200)); sending it once more")
                let message = lastMessage, images = lastImages
                let sessionKind: SessionKind = kind == "think" ? .think : .talk
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
                    self?.sendTurn(message, images: images, to: session, kind: sessionKind)
                }
                return
            }
            hud.flash(error: Log.short(result.resultText ?? "the turn failed", 160))
            overlay.setMood(.puzzled, for: 3)
            Log.error("turn[\(kind)] failed: \(result.subtype) \(Log.short(result.resultText ?? "", 300))")
        }

        var escalated = false
        if dryRun, !tags.isEmpty {
            Log.info("dry-run: tags \(tags.filter { !$0.isVisual })")
        }
        for tag in tags {
            if dryRun, !tag.isVisual { continue }
            switch tag {
            case .agent(let brief) where config.jobsEnabled && !explicitAgent && AgentAddress.leadingFor(brief, roster: addressBook) == nil,
                 .newAgent(_, let brief) where config.jobsEnabled && !explicitAgent:
                Log.info("job: talk's [AGENT] became a job (no agent words)")
                startJob(goal: lastAsked + "\n" + brief, placement: JobPlacementRule.decide(text: lastAsked, frontApp: context.appName).placement,
                         words: lastAsked, announce: false)
            case .agent(let brief):
                // "for <name>: ..." was the prompt's way to reach a named agent before [TELL]; honour it.
                if let named = AgentAddress.leadingFor(brief, roster: addressBook) {
                    replyToAgent(named.slug, named.brief)
                } else {
                    startAgent(brief: brief, name: nil)
                }
            case .newAgent(let name, let brief):
                startAgent(brief: brief, name: name, fresh: true)
            case .tell(let name, let message):
                let fits = AgentAddress.candidates(named: name, in: addressBook)
                if fits.count == 1 {
                    replyToAgent(fits[0].slug, message)
                } else if fits.count > 1 {
                    // "Lab" with Lab Desk and Lab Notes: ask, rather than found a third agent called Lab.
                    let names = fits.map { $0.name.lowercased() }
                    hud.flash(status: "which one: \(names.joined(separator: " or "))?", for: 6)
                    Log.warn("tell tag for \"\(name)\" fits \(names.joined(separator: ", ")); asked which")
                } else if config.jobsEnabled, !explicitAgent {
                    Log.info("job: talk's [TELL] to no agent became a job")
                    startJob(goal: lastAsked + "\n" + message, placement: JobPlacementRule.decide(text: lastAsked, frontApp: context.appName).placement,
                             words: lastAsked, announce: false)
                } else {
                    // No agent by that name yet: the message founds one, the way NEW_AGENT does.
                    startAgent(brief: message, name: name)
                }
            case .stopAgent(let name):
                if let agent = AgentAddress.agent(named: name, in: addressBook) {
                    agents.stop(agent.slug)
                    hud.flash(status: "stopped \(agent.name.lowercased())", for: 3)
                } else {
                    Log.warn("stop tag for an unknown agent: \(name)")
                }
            case .routine(let agentName, let when, let brief):
                if let scheduler {
                    if let routine = scheduler.add(agentName: agentName, when: when, brief: brief) {
                        hud.notify(NotchNotice(id: "routine-\(routine.id)", icon: "clock.arrow.2.circlepath", title: "routine set: \(routine.schedule.words)",
                                               detail: "\(routine.agentName): \(Log.short(brief, 90))", tone: .good,
                                               actionTitle: "undo", action: { [weak scheduler] in scheduler?.remove(routine.id) }, seconds: 14))
                    } else {
                        hud.flash(error: "couldn't read when: \"\(when)\"")
                        Log.warn("routine tag with an unreadable schedule: \(when)")
                    }
                }
            case .think:
                if kind == "talk", let think = session(for: .think) {
                    escalated = true
                    let question = lastAsked.isEmpty ? hud.model.transcript : lastAsked
                    let said = spoken.trimmingCharacters(in: .whitespacesAndNewlines)
                    let handed = "[escalated] he asked: \"\(question)\". the quick model already said \"\(Log.short(said, 240))\" and handed the rest to you: answer the question itself now, and if a panel, card or figure was promised, build it in full; don't open by repeating what it already said."
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
        // A do-request answered with action tags and no rings ends here.
        if let run = goRun, walkthrough == nil, pendingGo == nil, !escalated, kind == "talk" {
            let acted = tags.contains { if case .act = $0 { return true }; return false }
            Log.info("act: go \(Log.short(run.goal, 80)) \(acted ? "ok \(Int(Date().timeIntervalSince(run.started) * 1000)) ms" : "fail no action or ring in the answer")")
            goRun = nil
        }
        if let goal = pendingGo, !escalated, walkthrough == nil {
            pendingGo = nil
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in self?.startGo(goal) }
        }
        // Pre-warm: the next conversation starts before this one reaches its turn limit, so the recycle is free.
        if kind == "talk", spareTalk == nil, !benchMode, turnsInSession >= config.talkSessionMaxTurns - 1 {
            spareTalk = makeSession(kind: .talk)
            if spareTalk != nil { Log.info("talk: next conversation warming up") }
        }
        region = nil
        marks = []
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
                if let id = self.lessonCard, !self.lessonHeld.isEmpty { self.board.setWaiting(id: id, on: true) }
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
        let teaching = walkthrough != nil || board.hasHiddenSteps || panels.isOpen
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
        if let run = goRun, (walkthrough?.driving == true || driveRequested), Date().timeIntervalSince(run.started) > 45 {
            Log.info("walkthrough: driven run past 45 s")
            endWalkthrough(reason: "driven time cap")
            speaker.speak("that's taking too long for me; tell me what to do next.")
            return false
        }
        if let cap = driveCap, (walkthrough?.driving == true || driveRequested), step > cap {
            Log.info("walkthrough: driven steps capped at \(cap)")
            endWalkthrough(reason: "driven step cap")
            speaker.speak("that's as far as i'll click on my own; tell me what to do next.")
            return false
        }
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
        // A control behind another window cannot be clicked: say so instead of ringing thin air.
        let cover = WindowOcclusion.isCovered(target)
        if cover.covered {
            hud.flash(status: "\(label) is behind \(cover.by.lowercased()); bring the window forward", for: 6)
            Log.info("walkthrough: target \"\(label)\" is covered by \(cover.by)")
        }
        var next = Walkthrough(kind: hover ? .hover : .click, target: target, radius: screenRadius, label: label, step: step,
                               appBundle: context.bundleIdentifier)
        next.ask = walkthrough?.ask ?? lastAsked
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
        let under = Hands.label(atAppKit: step.target) ?? ""
        if Driver.isCommitLabel(step.label) || CommitGuard.isCommit(step.label) || CommitGuard.isCommit(under) {
            let line = "this one looks like it commits something, so it's yours: \(step.kind == .hover ? "rest on" : "click") \(step.label)."
            Log.info("drive: leaving \"\(step.label)\" to him")
            speaker.speak(line)
            overlay.setBubble(line, label: step.label)
            return
        }
        driver.begin()
        // The press comes once the instruction has been spoken, so the voice and the hand agree. His cursor never
        // moves (his call, 2026-10-18): accessibility presses the control; his own mouse or key still stops the drive.
        let delay: TimeInterval = quietTurn ? 0.3 : 0.8
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self, let current = self.walkthrough, current.driving, current.step == step.step, !current.awaitingNextStep, self.driver.active else { return }
            guard current.kind == .click else {
                let line = "rest the cursor on \(current.label.lowercased()) and i'll keep going."
                self.speaker.speak(line)
                return
            }
            if self.benchMode, !self.hands.benchAllows(self.context) {
                Log.info("bench: blocked action press outside the fixture")
                return
            }
            if WindowOcclusion.isCovered(current.target).covered {
                Log.info("drive: step \(current.step) \(current.label) is covered; left to him")
                self.speaker.speak("\(current.label.lowercased()) is behind another window, so that click is yours.")
                return
            }
            switch Hands.press(atAppKit: current.target, frontPid: NSWorkspace.shared.frontmostApplication?.processIdentifier) {
            case .pressed:
                Log.info("drive: step \(current.step) pressed \(current.label) (accessibility, cursor still)")
                self.stepCompleted(how: "clicked")
            case .commit(let words):
                Log.info("drive: step \(current.step) reads like a commit (\(Log.short(words, 40))); left to him")
                self.speaker.speak("this one looks like it commits something, so it's yours: \(current.label.lowercased()).")
            case .otherApp:
                Log.info("drive: step \(current.step) \(current.label) belongs to another app; left to him")
                self.speaker.speak("something else is on top of \(current.label.lowercased()), so that click is yours.")
            case .failed:
                Log.info("drive: step \(current.step) \(current.label) takes no press from accessibility; left to him")
                self.speaker.speak("i can't press \(current.label.lowercased()) from here; click it and i'll keep going.")
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
        overlay.completeRing()
        hud.flash(status: "saw that, looking", for: 3)
        stopSpeaking()
        // Wait for what the step opened to finish drawing (a pane, a sheet, a page), then look.
        Task { @MainActor in
            let settled = await ScreenSettle.wait(minimum: 0.35, timeout: config.walkthroughSettleSeconds)
            guard self.walkthrough?.step == step.step else { return }
            self.startCapture()
            do {
                if let captureTask = self.captureTask {
                    let captured = await captureTask.value
                    self.shots = captured.shots
                    self.context = captured.context
                }
                self.captureTask = nil
                guard let session = self.session(for: .talk) else { return }
                self.hud.model.transcript = "[\(how) \(step.label)]"
                var text = "[step_done] \(self.walkthrough?.driving == true ? "dot" : "i") \(how) \(step.label) (step \(step.step)). look at the new screenshot as the truth and give the next step, or say it's finished with no tag."
                if !settled {
                    text += " the screen was still changing when dot looked: if the pane or page has not finished loading, say so in one sentence and tell me to say next when it has, with no tag."
                }
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
        resetLesson()
        board.clear()
        lessonStartedAt = nil
        hud.removeAgent(id: "lesson")
    }

    /// Stop from the task bar.
    func stopTask(_ id: String) {
        switch id {
        case "walkthrough": endWalkthrough(reason: "stopped from the task bar")
        case "lesson": clearBoard()
        case "lecture": Task { @MainActor in await stopLecture() }
        default: break
        }
    }

    private func endWalkthrough(reason: String) {
        guard walkthrough != nil else { return }
        Log.info("walkthrough: ended (\(reason))")
        if let run = goRun, walkthrough?.driving == true {
            let ms = Int(Date().timeIntervalSince(run.started) * 1000)
            let finished = reason == "the model gave a step with no target"
            Log.info("act: go \(Log.short(run.goal, 80)) \(finished ? "ok \(ms) ms" : "fail \(reason)")")
            goRun = nil
        }
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
        if config.jobsEnabled { jobs.escape() }
        let wasBusy = phase != .idle || speaker.isSpeaking || walkthrough != nil
        stopSpeaking()
        cutActiveTurn()
        driveRequested = false
        actGeneration += 1   // acts still queued from the answer he stopped don't run
        if phase == .listening { recorder.cancel(); overlay.setMouseCapture(false) }
        levelTimer?.invalidate()
        phase = .idle
        endWalkthrough(reason: "escape")
        clearBoard()
        hud.dismissAnswer()
        hud.escapeDismiss()
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

    /// What a lookup is, said aloud; nil for tools that need no line.
    static func spokenTool(_ name: String) -> String? {
        switch name.split(separator: "__").last.map(String.init) ?? name {
        case "calendar", "free": return "your calendar"
        case "mail", "thread", "unanswered": return "your mail"
        case "messages": return "your messages"
        case "search", "facts", "people", "commitments", "todo": return "your notes"
        case "canvas_find", "canvas_read": return "canvas"
        case "docs", "read_doc": return "your docs"
        case "WebSearch", "WebFetch": return "the web"
        default: return nil
        }
    }

    static func friendlyTool(_ name: String) -> String {
        let parts = name.split(separator: "__").map(String.init)
        if parts.count >= 3 { return parts[2...].joined(separator: " ").replacingOccurrences(of: "_", with: " ") }
        return name.lowercased()
    }
}
