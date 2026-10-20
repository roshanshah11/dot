import AppKit
import DotKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private var config = DotConfig.load()
    private var hud: NotchHUD!
    /// The stack at the top right (04): agents, jobs, consent cards, notices with an action, the morning card.
    private var stack: AgentStack!
    private var overlay: OverlayManager!
    private var speaker: TTSProvider!
    private var transcriber: Transcriber!
    private var ledger: Ledger!
    private var agents: AgentManager!
    private var talk: Talk!
    private var home: HomeWindowController!
    private var atlas: AtlasBridge!
    private var jev: Jev?
    private var control: ControlServer?
    private var noticer: Noticer!
    private var murmur: MurmurWatcher?
    private var morning: MorningSuggestions!
    private var routines: RoutineScheduler!
    private let hotkeys = HotkeyMonitor()
    private var permissionTimer: Timer?
    private var hoverTimer: Timer?
    private var presenceItem: NSMenuItem?

    /// The alive pass (docs/alive.md): what the orb reacts to, and the quips at its breaks.
    private func wireAlive() {
        overlay.isQuiet = { [weak self] in self.map { $0.config.quietOnCalls && CallPresence.isOnCall() } ?? false }
        overlay.isRecording = { [weak self] in self.map { $0.talk.lecture.isListening || ($0.murmur?.isRecording ?? false) } ?? false }
        overlay.onWake = { [weak self] idle in self?.noticer.quip(idle > 15 * 60 ? .backLong : .backShort) }
        overlay.onPetted = { [weak self] in self?.noticer.quip(.petted) }
        SpeechActivity.onSentence = { [weak self] duration, isLast in
            MainActor.assumeIsolated { self?.overlay.sentenceStarted(duration: duration, isLast: isLast) }
        }
        SpeechActivity.onLevel = { [weak self] level, metered in
            MainActor.assumeIsolated { self?.overlay.setSpeechLevel(level, metered: metered) }
        }
        NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] note in
            let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
            guard app?.processIdentifier != ProcessInfo.processInfo.processIdentifier else { return }
            Task { @MainActor in self?.overlay.appSwitched() }
        }
        NotificationCenter.default.addObserver(forName: .dotDismissNotice, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.overlay.react(.dismissed) }
        }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        Log.info("Dot \(Version.string) launching; config \(DotConfig.fileURL.path)")
        hud = NotchHUD(accentHex: config.pointerColorHex)
        overlay = OverlayManager(colorHex: config.pointerColorHex, presence: config.showCompanion, orbSize: CGFloat(config.orbSize))
        stack = AgentStack(accentHex: config.pointerColorHex)
        hud.attach(stack: stack)
        hud.onGreet = { [weak self] text, seconds in self?.overlay.greet(text, for: seconds) }
        hud.configure(talkOnly: config.notchTalkOnly, consentInNotch: config.consentInNotch)
        Log.info("notch: \(config.notchTalkOnly ? "only while talking; agents, jobs and cards in the stack at the top right" : "as before 04")"
                 + "; consent cards in the \(config.notchTalkOnly && !config.consentInNotch ? "stack" : "notch")")
        atlas = AtlasBridge(config: config)
        let apple = AppleSpeaker(voiceIdentifier: config.voiceIdentifier, rate: config.speechRate)
        if let command = config.resolvedTTSCommand() {
            let worker = CommandSpeaker(command: command, fallback: apple)
            worker.start()
            speaker = worker
        } else {
            speaker = apple
        }
        ledger = Ledger(url: config.dotHome.appendingPathComponent("ledger.sqlite"))
        let hud = self.hud!
        transcriber = Transcriber(onDownloadProgress: { progress in
            Task { @MainActor in hud.flash(status: "downloading speech model \(Int(progress * 100))%", for: 3) }
        })
        jev = Jev(config: config)
        Log.info("jev: \(jev == nil ? "off (no TYPESAFE_API_KEY in the environment or \(config.jevKeyFile))" : "on")")
        agents = AgentManager(config: config, hud: hud, speaker: speaker, ledger: ledger)
        // His style tokens (VI-01): file colors and the sound set come from ~/Dot/style/tokens.json over the defaults.
        let tokens = StyleTokens.load()
        tokens.problems.forEach { Log.warn("style: \($0)") }
        Theme.fileColors = tokens.fileColors
        Theme.look = tokens.look("study")
        Chimes.shared.configure(names: ["launch": tokens.chimes.launch, "needsYou": tokens.chimes.needsYou, "done": tokens.chimes.done, "failed": tokens.chimes.failed])
        // The sound set (AU-04) holds on a call, like every other chime (FX-11).
        Chimes.shared.isSilenced = { [weak self] in self.map { $0.config.quietOnCalls && CallPresence.isOnCall() } ?? false }
        agents.atlas = atlas
        agents.jev = jev
        // AG-07: every agent tool call asks Dot here first (`Dot --gate`), before it runs.
        let control = ControlServer(path: ControlServer.path(dotHome: config.dotHome))
        control.register("gate") { [weak self] request, reply in
            guard let self, let input = (request["input"] as? [String: Any]).flatMap(HookInput.init(object:)) else { reply(HookDecision.pass.wire); return }
            self.agents.gate(input, agent: request["agent"] as? String) { reply($0.wire) }
        }
        control.register("post") { [weak self] request, reply in
            guard let self, let input = (request["input"] as? [String: Any]).flatMap(HookInput.init(object:)) else { reply(HookDecision.pass.wire); return }
            self.agents.checkOutput(input) { reply($0.wire) }
        }
        if control.start() { agents.controlSocket = control.path }
        self.control = control
        quitCleanlyOnSignals()
        agents.recoverAfterLaunch()
        talk = Talk(config: config, hud: hud, overlay: overlay, speaker: speaker, transcriber: transcriber, agents: agents, ledger: ledger, atlas: atlas, jev: jev)
        // The fast lane: a job's dot tools ask the running Dot here (`Dot --hands-mcp`).
        control.register("hands") { [weak self] request, reply in
            guard let self else { reply(["error": "dot is quitting"]); return }
            self.talk.jobs.hands(request, reply)
        }
        if control.isRunning { talk.jobs.socketPath = control.path }
        noticer = Noticer(config: config, atlas: atlas, overlay: overlay, jev: jev)
        noticer.onSuggest = { [weak self] suggestion in Task { @MainActor in self?.talk.offerSuggestion(suggestion) } }
        // Quips and an offer's "ok, later." wait while Dot is busy, a lecture is heard or Murmur records.
        noticer.canSpeakUp = { [weak self] in
            guard let self else { return false }
            return self.talk.isIdle && !self.talk.lecture.isListening && !(self.murmur?.isRecording ?? false)
        }
        wireAlive()
        wireContextQuips()
        hud.setPresence(config.notchPresence)
        applyRecordingVisibility()
        home = HomeWindowController(agents: agents, ledger: ledger, config: config, atlas: atlas)
        home.speakSample = { [weak self] text in SpeakLog.as("sample") { self?.speaker.speak(text) } }
        home.onSettingsChanged = { [weak self] changed in Task { @MainActor in self?.applySettings(changed) } }
        routines = RoutineScheduler(config: config, agents: agents, hud: hud)
        routines.canRun = { [weak self] in
            guard let self else { return false }
            return !(self.config.quietOnCalls && CallPresence.isOnCall())
        }
        talk.scheduler = routines
        // A job that turned out to be watching ends with a Routine: line; the routine runs as an agent (07).
        talk.jobs.onRoutine = { [weak self] name, when, task in
            _ = self?.routines.add(agentName: name, when: when, brief: task)
        }
        home.scheduler = routines
        // Agents edit their own routines by title (TC-06) and see the full list each turn (TC-07).
        agents.onRoutineCommand = { [weak self] slug, name, command in self?.routines.apply(command, agent: slug, agentName: name) }
        agents.routineList = { [weak self] slug in self?.routines.listLine(for: slug) ?? "" }
        morning = MorningSuggestions(config: config, atlas: atlas, hud: hud, agents: agents)
        // A scout brief's "do it" hands the brief over (run one) and registers its routine (MB-03).
        morning.addRoutine = { [weak self] name, when, brief in
            self?.routines.add(agentName: name, when: when, brief: brief, runFirstNow: false) != nil
        }
        // The voice verbs that reach past Talk (VO-01, VO-04, VO-13, MB-07).
        talk.openHome = { [weak self] slug in self?.home.show(agent: slug) }
        talk.focusedThread = { [weak self] in self?.home.focusedThread }
        // A result for the agent whose thread he has open is read there, not spoken (TC-03).
        agents.isThreadOpen = { [weak self] slug in self?.home.focusedThread == slug }
        talk.resumeRoutines = { [weak self] slug in
            guard let routines = self?.routines else { return 0 }
            let paused = routines.routines(for: slug).filter(\.paused)
            paused.forEach { routines.setPaused($0.id, false) }
            return paused.count
        }
        talk.morningAnswer = { [weak self] yes, adjust in self?.morning.decideFirst(yes: yes, adjust: adjust) }
        morning.canShow = { [weak self] in
            guard let self else { return false }
            return self.talk.isIdle && !(self.config.quietOnCalls && CallPresence.isOnCall())
        }
        let hudModel = hud.model
        hudModel.onOpenHome = { [weak self] slug in Task { @MainActor in self?.home.show(agent: slug) } }
        NotificationCenter.default.addObserver(forName: .dotOpenHome, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.home.show() }
        }
        hudModel.onStopAgent = { [weak self] id in
            Task { @MainActor in
                guard let self else { return }
                if id == "walkthrough" || id == "lesson" || id == "lecture" { self.talk.stopTask(id) } else { self.agents.stop(id) }
            }
        }
        wireStack()
        atlas.onUpdate = { [weak self] brief in
            hudModel.todayLine = brief.hoverLine()
            self?.talk.todayArrived(brief)
            self?.morning.consider()
        }
        // The countdown to the next meeting moves by the minute; the brief itself every ten.
        hoverTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let brief = self.atlas.brief else { return }
                hudModel.todayLine = brief.hoverLine()
                self.noticeMeeting(brief)
                // The countdown on the idle tab, from half an hour out (HeyClicky's meeting countdown notch).
                if let next = brief.nextEvent(), next.startsIn > 0, next.startsIn <= 30 {
                    hudModel.meetingLine = "\(String(next.title.lowercased().prefix(28))) in \(next.startsIn) min"
                } else {
                    hudModel.meetingLine = nil
                }
            }
        }

        NotificationCenter.default.addObserver(forName: .dotAgentFinished, object: nil, queue: .main) { [weak self] note in
            let failed = (note.userInfo?["failed"] as? Bool) ?? false
            Task { @MainActor in
                // A hop when it lands, a droop when it fails (docs/alive.md 2.6), and maybe a quip.
                self?.overlay.react(failed ? .agentFailed : .agentDone)
                self?.noticer.quip(failed ? .agentFailed : .agentDone)
            }
        }
        installStatusItem()
        AccessibilityContext.observeForegroundApp()
        hotkeys.onEvent = { [weak self] event in self?.talk.hotkey(event) }
        installIPC()
        requestPermissionsThenStart()
        atlas.start()
        noticer.start()
        if config.mirrorMurmur {
            murmur = MurmurWatcher(directory: config.murmurLogDirectory, hud: hud)
            murmur?.start()
        }
        morning.start()
        routines.start()
        announceUpdate()
    }

    /// Once after an update: what changed, with the README a click away.
    private func announceUpdate() {
        guard config.lastSeenVersion != Version.string else { return }
        config.lastSeenVersion = Version.string
        config.save()
        hud.notify(NotchNotice(id: "updated", icon: "sparkles", title: "dot \(Version.string) is in",
                               detail: "place cards, pictures, the morning card, typed notices, settings pages for voice, mic, dictation and cursor",
                               tone: .good, actionTitle: "what's new", action: {
                                   let readme = URL(fileURLWithPath: DotConfig.expand("~/Projects/dot/README.md"))
                                   if FileManager.default.fileExists(atPath: readme.path) { MarkdownViewer.show(file: readme) }
                               }, seconds: 20))
    }

    /// Settings saved in the Dot window: the parts that can change while running change now.
    private func applySettings(_ changed: DotConfig) {
        let before = config
        config = changed
        // The window saves the copy it took at launch; keys the app set since must not go back.
        if config.lastSeenVersion != before.lastSeenVersion { config.lastSeenVersion = before.lastSeenVersion; config.save() }
        if changed.showCompanion != before.showCompanion {
            presenceItem?.state = changed.showCompanion ? .on : .off
            overlay.setPresence(changed.showCompanion)
        }
        if changed.showInRecordings != before.showInRecordings {
            recordingsItem?.state = changed.showInRecordings ? .on : .off
            applyRecordingVisibility()
        }
        if changed.pointerColorHex != before.pointerColorHex {
            overlay.setColor(hex: changed.pointerColorHex)
            hud.setAccent(hex: changed.pointerColorHex)
            stack.setAccent(hex: changed.pointerColorHex)
        }
        if changed.notchTalkOnly != before.notchTalkOnly || changed.consentInNotch != before.consentInNotch {
            hud.configure(talkOnly: changed.notchTalkOnly, consentInNotch: changed.consentInNotch)
        }
        if changed.notchPresence != before.notchPresence { hud.setPresence(changed.notchPresence) }
        if changed.menuBarIcon != before.menuBarIcon { placeStatusItem() }
        if changed.microphoneName != before.microphoneName { talk.setMicrophone(name: changed.microphoneName) }
        applyAliveSettings(changed, before: before)
        Log.info("settings: applied from the dot window")
    }

    /// Context lines (docs/alive.md, round two): what a just-finished agent said, for the quip after it.
    /// It runs before the quip, which the observer in applicationDidFinishLaunching starts in a Task.
    private func wireContextQuips() {
        NotificationCenter.default.addObserver(forName: .dotAgentFinished, object: nil, queue: .main) { [weak self] note in
            let line = (note.userInfo?["line"] as? String) ?? ""
            let failed = (note.userInfo?["failed"] as? Bool) ?? false
            MainActor.assumeIsolated { self?.noticer.agentFinished(line: line, failed: failed) }
        }
    }

    /// Home's size and chattiness pickers apply without a relaunch, and so does everything else Noticer
    /// reads (the quip settings, the notice and offer switches on the Suggestions page).
    private func applyAliveSettings(_ changed: DotConfig, before: DotConfig) {
        if changed.orbSize != before.orbSize { overlay.setOrbSize(CGFloat(changed.orbSize)) }
        noticer.update(config)
    }

    private var noticedMeetings: Set<String> = []

    /// Ten minutes before the next event, once: a line in the notch and, when he is not
    /// mid-conversation, a short spoken heads-up. Configurable with `meetingNoticeMinutes`.
    private func noticeMeeting(_ brief: TodayBrief) {
        let minutes = config.meetingNoticeMinutes
        guard minutes > 0, let next = brief.nextEvent(), next.startsIn > 0, next.startsIn <= minutes else { return }
        let key = "\(brief.date) \(next.title)"
        guard !noticedMeetings.contains(key) else { return }
        noticedMeetings.insert(key)
        let line = "\(next.title.lowercased()) in \(next.startsIn) min"
        let title = next.title
        let startsIn = next.startsIn
        hud.notify(NotchNotice(id: "meeting", icon: "calendar", title: line,
                               detail: brief.today.first(where: { $0.contains(title) }).map { String($0.dropFirst(10)).trimmingCharacters(in: .whitespaces) },
                               tone: .info, actionTitle: "brief me", action: { [weak self] in
                                   guard let self else { return }
                                   SpeakLog.as("notice") { self.speaker.speak("on it, a brief in a minute.") }
                                   self.agents.handoff(brief: "in \(startsIn) minutes roshan has: \(title). write a short brief fast: who or what it is, two talking points, two questions to ask. put it on the clipboard and in the output folder; keep it under a page.", agentName: nil, context: nil, shots: nil)
                               }, secondaryTitle: "dismiss", secondary: {}, seconds: 60))
        let onCall = config.quietOnCalls && CallPresence.isOnCall()
        if !onCall { overlay.greet(line, for: 12) }
        if talk.isIdle, config.speakMeetingNotice, !onCall {
            SpeakLog.as("notice") { speaker.speak("heads up, \(next.title.lowercased()) in \(next.startsIn) minutes.") }
        }
        Log.info("notice: \(line)")
    }

    /// `Dot --ask ...` and `Dot --agent ...` from a shell reach the running app here.
    private func installIPC() {
        let center = DistributedNotificationCenter.default()
        center.addObserver(forName: DotIPC.ask, object: nil, queue: .main) { [weak self] note in
            guard let text = note.userInfo?["text"] as? String else { return }
            let quiet = (note.userInfo?["quiet"] as? Bool) ?? false
            let drive = (note.userInfo?["drive"] as? Bool) ?? false
            let dry = (note.userInfo?["dry"] as? Bool) ?? false
            let bench = (note.userInfo?["bench"] as? Bool) ?? false
            let spoken = (note.userInfo?["spoken"] as? Bool) ?? false
            let shift = (note.userInfo?["shift"] as? Bool) ?? false
            let port = (note.userInfo?["cometPort"] as? Int) ?? 0
            Task { @MainActor in
                self?.talk.askTyped(text, quiet: quiet || dry, drive: drive, dry: dry, bench: bench, spoken: spoken, shift: shift, cometPort: port > 0 ? port : nil)
            }
        }
        center.addObserver(forName: DotIPC.agent, object: nil, queue: .main) { [weak self] note in
            guard let text = note.userInfo?["text"] as? String else { return }
            Task { @MainActor in
                guard let self else { return }
                let context = AccessibilityContext.capture(maxElements: 20)
                self.agents.handoff(brief: text, agentName: nil, context: context, shots: nil)
            }
        }
        center.addObserver(forName: DotIPC.home, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.home.show() }
        }
        // `Dot --input`: open the typed-question field under the notch, as a tap of the hotkey does.
        center.addObserver(forName: DotIPC.input, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.talk.showTypedField() }
        }
        center.addObserver(forName: DotIPC.stop, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.talk.interrupt() }
        }
        // `Dot --job-test click|key`: the bench's stand-in for his input in a bench job's tab.
        center.addObserver(forName: DotIPC.jobTest, object: nil, queue: .main) { [weak self] note in
            let kind = (note.userInfo?["kind"] as? String) == "key" ? JobInput.key : JobInput.click
            Task { @MainActor in
                guard let self else { return }
                Log.info("job-test: \(self.talk.jobs.simulateInput(kind))")
            }
        }
        // `Dot --occlusion x,y`: both covered-check verdicts, with Dot.app's own Accessibility grant.
        center.addObserver(forName: DotIPC.occlusion, object: nil, queue: .main) { note in
            guard let text = note.userInfo?["text"] as? String else { return }
            let parts = text.split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
            guard parts.count == 2 else { return }
            Task { @MainActor in WindowOcclusion.logVerdicts(topLeft: CGPoint(x: parts[0], y: parts[1])) }
        }
        center.addObserver(forName: DotIPC.refresh, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.atlas.refresh(reason: "cli") }
        }
        // `Dot --type "text"`: the dictation insert path on whatever field has focus.
        center.addObserver(forName: DotIPC.type, object: nil, queue: .main) { [weak self] note in
            guard let text = note.userInfo?["text"] as? String else { return }
            Task { @MainActor in
                let method = TextInjection.insert(text)
                self?.hud.flash(status: "inserted via \(method.rawValue)", for: 3)
                Log.info("type: \(method.rawValue): \(Log.short(text, 80))")
            }
        }
        // `Dot --card file.html`: put a card on the board from a file, to test rendering.
        center.addObserver(forName: DotIPC.card, object: nil, queue: .main) { [weak self] note in
            guard let path = note.userInfo?["text"] as? String else { return }
            Task { @MainActor in self?.talk.showCardFile(path) }
        }
        // `Dot --track-selftest`: marks stay on scrolled content, checked on the real screen (round eight).
        center.addObserver(forName: DotIPC.trackSelftest, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                await TrackSelfTest.run(overlay: self.overlay)
            }
        }
        // `Dot --panel file.ui`: a UI-language explanation in the explainer panel (round eight).
        center.addObserver(forName: DotIPC.panel, object: nil, queue: .main) { [weak self] note in
            guard let path = note.userInfo?["text"] as? String else { return }
            Task { @MainActor in self?.talk.showPanelFile(path) }
        }
        // `Dot --find "phrase"`: search the app in front and highlight the match (the FIND tag's path).
        center.addObserver(forName: DotIPC.find, object: nil, queue: .main) { [weak self] note in
            guard let text = note.userInfo?["text"] as? String else { return }
            Task { @MainActor in self?.talk.findOnScreen(text) }
        }
        // `Dot --listen [title]` and `Dot --stop-listening`: the lecture ear.
        center.addObserver(forName: DotIPC.listen, object: nil, queue: .main) { [weak self] note in
            let title = (note.userInfo?["text"] as? String) ?? ""
            Task { @MainActor in await self?.talk.startLecture(title: title) }
        }
        center.addObserver(forName: DotIPC.stopListening, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in await self?.talk.stopLecture() }
        }
        // `Dot --dictionary "heard => correct"` or a bare term.
        center.addObserver(forName: DotIPC.dictionary, object: nil, queue: .main) { [weak self] note in
            guard let text = note.userInfo?["text"] as? String else { return }
            let parts = text.components(separatedBy: "=>").map { $0.trimmingCharacters(in: .whitespaces) }
            Task { @MainActor in self?.talk.addToDictionary(heard: parts.count == 2 ? parts[0] : nil, correct: parts.last ?? text) }
        }
        // `Dot --stack-demo [--muted] [--job]`: a fake agent (or behind job) through the stack, for G7 to G9 (04).
        center.addObserver(forName: DotIPC.stackDemo, object: nil, queue: .main) { [weak self] note in
            let muted = (note.userInfo?["muted"] as? Bool) ?? false
            let job = (note.userInfo?["job"] as? Bool) ?? false
            Task { @MainActor in
                guard let self else { return }
                StackDemo.run(stack: self.stack, config: self.config, muted: muted, job: job)
            }
        }
        // `Dot --stt file.wav`: feed a WAV through the streaming recognizer and log what it hears.
        center.addObserver(forName: DotIPC.stt, object: nil, queue: .main) { [weak self] note in
            guard let path = note.userInfo?["text"] as? String else { return }
            Task { @MainActor in await self?.talk.streamingSelfTest(wavPath: path) }
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        for job in talk?.jobs.running ?? [] { Log.info("job[\(job.id)] lost at quit") }
        talk?.jobs.stopAll(reason: "quit")
        agents.prepareForQuit()
        control?.stop()
        Log.info("quit: agents ended")
        Log.flush()
    }

    /// launchd stops Dot with SIGTERM (build.sh, Home's relaunch, logout), which by default ends the
    /// process at once: applicationWillTerminate never ran and agents ran on without Dot (F2,
    /// 2026-10-15). The signal now goes through AppKit's normal quit.
    private var signalSources: [DispatchSourceSignal] = []
    private func quitCleanlyOnSignals() {
        for sig in [SIGTERM, SIGINT, SIGHUP] {
            signal(sig, SIG_IGN)
            let source = DispatchSource.makeSignalSource(signal: sig, queue: .main)
            source.setEventHandler {
                Log.info("quit on signal \(sig)")
                NSApp.terminate(nil)
            }
            source.resume()
            signalSources.append(source)
        }
    }

    // MARK: Permissions and start

    private func requestPermissionsThenStart() {
        let status = Permissions.status()
        if !status.microphone {
            Permissions.requestMicrophone { [weak self] granted in
                Log.info("microphone \(granted ? "granted" : "not granted")")
                self?.continueStart()
            }
        } else {
            continueStart()
        }
    }

    private func continueStart() {
        if !Permissions.status().screenRecording { Permissions.requestScreenRecording() }
        if !Permissions.status().accessibility { Permissions.requestAccessibility() }
        startHotkeysWhenTrusted()
        talk.warmUp()
        talk.jobs.warm()
        Log.info("messages: live chat.db readable=\(MessagesProbe.liveReadable())")
        // Spotify's search instance, 60 s after launch, so the cold start never lands on his first ask (05).
        DispatchQueue.main.asyncAfter(deadline: .now() + 60) { Hands.warmSpotify() }
        // This Mac's calendar (the basics pass): macOS asks him once; until he allows it, Atlas's copy is used.
        talk.localCalendar.requestAccess()
        let status = Permissions.status()
        if !status.allGranted {
            home.show()
            hud.flash(status: "grant the permissions in the Dot window, then hold control+option", for: 8)
        } else {
            hud.flash(status: "hold control+option and talk", for: 4)
        }
    }

    private func startHotkeysWhenTrusted() {
        if Permissions.status().accessibility, hotkeys.start() { return }
        permissionTimer?.invalidate()
        permissionTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] timer in
            Task { @MainActor in
                guard let self else { timer.invalidate(); return }
                if Permissions.status().accessibility, self.hotkeys.start() {
                    timer.invalidate()
                    self.hud.flash(status: "ready: hold control+option and talk", for: 4)
                }
            }
        }
    }

    // MARK: Status item

    private func installStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = item.button {
            let image = NSImage(systemSymbolName: "circle.fill", accessibilityDescription: "Dot")
            button.image = image?.withSymbolConfiguration(.init(pointSize: 11, weight: .bold))
            button.contentTintColor = NSColor(red: 1.0, green: 0.42, blue: 0.17, alpha: 1)
        }
        let menu = NSMenu()
        menu.addItem(withTitle: "Ask by typing", action: #selector(askByTyping), keyEquivalent: "")
        menu.addItem(withTitle: "Listen to the lecture", action: #selector(toggleLecture), keyEquivalent: "")
        menu.addItem(withTitle: "Open Dot", action: #selector(openHome), keyEquivalent: "")
        let presence = NSMenuItem(title: "Dot beside the cursor", action: #selector(togglePresence), keyEquivalent: "")
        presence.state = config.showCompanion ? .on : .off
        menu.addItem(presence)
        presenceItem = presence
        let sit = NSMenuItem(title: "Dot stays put", action: #selector(toggleSit), keyEquivalent: "")
        sit.state = overlay.isSitting ? .on : .off
        menu.addItem(sit)
        overlay.onSitChanged = { [weak sit] on in sit?.state = on ? .on : .off }
        let recordings = NSMenuItem(title: "Show Dot in screen recordings", action: #selector(toggleRecordings), keyEquivalent: "")
        recordings.state = config.showInRecordings ? .on : .off
        menu.addItem(recordings)
        recordingsItem = recordings
        menu.addItem(.separator())
        menu.addItem(withTitle: "Stop talking", action: #selector(interrupt), keyEquivalent: "")
        menu.addItem(withTitle: "Refresh today from Atlas", action: #selector(refreshToday), keyEquivalent: "")
        menu.addItem(withTitle: "Open config file", action: #selector(openConfig), keyEquivalent: "")
        menu.addItem(withTitle: "Open log", action: #selector(openLog), keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Dot", action: #selector(quit), keyEquivalent: "q")
        for menuItem in menu.items { menuItem.target = self }
        item.menu = menu
        statusItem = item
        hud.menu = menu
        hud.onHoldsMenuChanged = { [weak self] in self?.placeStatusItem() }
        placeStatusItem()
    }

    /// The ● stays out of the menu bar while a right-click on the notch opens the same menu, unless `menuBarIcon` asks
    /// for it. With no notch tab to click (notch presence off, no notched screen) it comes back, so the menu is never lost.
    private func placeStatusItem() {
        guard let statusItem else { return }
        let show = config.menuBarIcon || !hud.holdsMenu
        if statusItem.isVisible != show {
            statusItem.isVisible = show
            Log.info("menu: the ● \(show ? "is in the menu bar" : "steps aside; right-click the notch for the menu")")
        }
    }

    @objc private func askByTyping() { hud.showInput() }
    /// Sit Dot where it is (it stops following; it can still be petted), or let it follow again. A long press on
    /// Dot does the same.
    @objc private func toggleSit() { overlay.setSitting(!overlay.isSitting) }
    @objc private func toggleLecture() {
        Task { @MainActor in
            if talk.lecture.isListening { await talk.stopLecture() } else { await talk.startLecture(title: AccessibilityContext.capture(maxElements: 0, timeBudget: 0.1).windowTitle ?? "") }
        }
    }
    private var recordingsItem: NSMenuItem?
    @objc private func toggleRecordings() {
        config.showInRecordings.toggle()
        config.save()
        recordingsItem?.state = config.showInRecordings ? .on : .off
        applyRecordingVisibility()
    }
    /// HeyClicky's "Show in screen recordings": every Dot window takes the same sharing type.
    private func applyRecordingVisibility() {
        overlay.setVisibleInRecordings(config.showInRecordings)
        hud.setVisibleInRecordings(config.showInRecordings)
        stack.setVisibleInRecordings(config.showInRecordings)
        ActionBarPanel.visibleInRecordings = config.showInRecordings
        CardPanel.visibleInRecordings = config.showInRecordings
    }

    /// The stack's buttons (04). Agent chips reach AgentManager and Home; job chips are 02's, which wires them
    /// after the merge (`JobManager`): until then each logs and does nothing.
    private func wireStack() {
        let hudModel = hud.model
        stack.onStop = { [weak self] id in
            guard let self else { return }
            if id.hasPrefix("job-") { self.jobAction("stop", id); return }
            hudModel.onStopAgent?(id)
        }
        stack.onOpenHome = { [weak self] id in self?.home.show(agent: id) }
        stack.onReply = { [weak self] id, text in
            guard let self else { return }
            if id.hasPrefix("job-") { self.jobAction("reply", id); return }
            self.agents.reply(to: id, text: text)
        }
        stack.onShow = { [weak self] id in self?.jobAction("show me", id) }
        stack.onAllow = { [weak self] id in self?.jobAction("allow", id) }
        stack.onDeny = { [weak self] id in self?.jobAction("deny", id) }
        // 07: an unfinished agent's Continue.
        stack.onContinue = { [weak self] id in
            guard let self else { return }
            if id.hasPrefix("job-") { self.jobAction("continue", id); return }
            Log.info("agent[\(id)] continue from the stack")
            self.agents.reply(to: id, text: AgentManager.continueLabel)
        }
        Log.info("stack: job feed not wired yet (02's JobManager feeds stack.upsert with job-<id> chips after the merge)")
    }

    /// A job chip's button before 02's JobManager is wired: logged, nothing else.
    private func jobAction(_ what: String, _ id: String) {
        Log.info("stack: \(what) on \(id): no job feed wired yet")
    }
    @objc private func openHome() { home.show() }
    @objc private func interrupt() { talk.interrupt() }
    @objc private func refreshToday() { atlas.refresh(reason: "menu"); hud.flash(status: "reading atlas") }
    @objc private func togglePresence() {
        config.showCompanion.toggle()
        config.save()
        presenceItem?.state = config.showCompanion ? .on : .off
        overlay.setPresence(config.showCompanion)
    }
    @objc private func openConfig() { NSWorkspace.shared.open(DotConfig.fileURL) }
    @objc private func openLog() {
        NSWorkspace.shared.open(URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Logs/Dot/dot.log"))
    }
    @objc private func quit() { NSApp.terminate(nil) }
}

enum Version {
    static let string = "0.5.0"
}

enum DotIPC {
    static let ask = Notification.Name("com.roshan.dot.ask")
    static let panel = Notification.Name("com.roshan.dot.panel")
    static let trackSelftest = Notification.Name("com.roshan.dot.track-selftest")
    static let agent = Notification.Name("com.roshan.dot.agent")
    static let home = Notification.Name("com.roshan.dot.home")
    static let stop = Notification.Name("com.roshan.dot.stop")
    static let refresh = Notification.Name("com.roshan.dot.refresh")
    static let type = Notification.Name("com.roshan.dot.type")
    static let stt = Notification.Name("com.roshan.dot.stt")
    static let card = Notification.Name("com.roshan.dot.card")
    static let input = Notification.Name("com.roshan.dot.input")
    static let find = Notification.Name("com.roshan.dot.find")
    static let listen = Notification.Name("com.roshan.dot.listen")
    static let stopListening = Notification.Name("com.roshan.dot.stopListening")
    static let dictionary = Notification.Name("com.roshan.dot.dictionary")
    static let jobTest = Notification.Name("com.roshan.dot.job-test")
    static let occlusion = Notification.Name("com.roshan.dot.occlusion")
    static let stackDemo = Notification.Name("com.roshan.dot.stack-demo")
}
