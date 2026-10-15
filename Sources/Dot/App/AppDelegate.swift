import AppKit
import DotKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private var config = DotConfig.load()
    private var hud: NotchHUD!
    private var overlay: OverlayManager!
    private var speaker: TTSProvider!
    private var transcriber: Transcriber!
    private var ledger: Ledger!
    private var agents: AgentManager!
    private var talk: Talk!
    private var home: HomeWindowController!
    private var atlas: AtlasBridge!
    private var jev: Jev?
    private var noticer: Noticer!
    private let hotkeys = HotkeyMonitor()
    private var permissionTimer: Timer?
    private var hoverTimer: Timer?
    private var presenceItem: NSMenuItem?

    func applicationDidFinishLaunching(_ notification: Notification) {
        Log.info("Dot \(Version.string) launching; config \(DotConfig.fileURL.path)")
        hud = NotchHUD(accentHex: config.pointerColorHex)
        overlay = OverlayManager(colorHex: config.pointerColorHex, presence: config.showCompanion)
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
        agents.atlas = atlas
        agents.jev = jev
        talk = Talk(config: config, hud: hud, overlay: overlay, speaker: speaker, transcriber: transcriber, agents: agents, ledger: ledger, atlas: atlas, jev: jev)
        noticer = Noticer(config: config, atlas: atlas, overlay: overlay, jev: jev)
        hud.setPresence(config.notchPresence)
        home = HomeWindowController(agents: agents, ledger: ledger, config: config, atlas: atlas)
        let hudModel = hud.model
        hudModel.onStopAgent = { [weak self] id in
            Task { @MainActor in
                guard let self else { return }
                if id == "walkthrough" || id == "lesson" { self.talk.stopTask(id) } else { self.agents.stop(id) }
            }
        }
        atlas.onUpdate = { [weak self] brief in
            hudModel.todayLine = brief.hoverLine()
            self?.talk.todayArrived(brief)
        }
        // The countdown to the next meeting moves by the minute; the brief itself every ten.
        hoverTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let brief = self.atlas.brief else { return }
                hudModel.todayLine = brief.hoverLine()
                self.noticeMeeting(brief)
            }
        }

        NotificationCenter.default.addObserver(forName: .dotAgentFinished, object: nil, queue: .main) { [weak self] note in
            let failed = (note.userInfo?["failed"] as? Bool) ?? false
            Task { @MainActor in self?.overlay.setMood(failed ? .puzzled : .happy, for: failed ? 3 : 2.5) }
        }
        installStatusItem()
        AccessibilityContext.observeForegroundApp()
        hotkeys.onEvent = { [weak self] event in self?.talk.hotkey(event) }
        installIPC()
        requestPermissionsThenStart()
        atlas.start()
        noticer.start()
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
        hud.flash(status: line, for: 20)
        overlay.greet(line, for: 12)
        if talk.isIdle, config.speakMeetingNotice {
            speaker.speak("heads up, \(next.title.lowercased()) in \(next.startsIn) minutes.")
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
            Task { @MainActor in self?.talk.askTyped(text, quiet: quiet, drive: drive) }
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
        center.addObserver(forName: DotIPC.stop, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.talk.interrupt() }
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
        // `Dot --stt file.wav`: feed a WAV through the streaming recognizer and log what it hears.
        center.addObserver(forName: DotIPC.stt, object: nil, queue: .main) { [weak self] note in
            guard let path = note.userInfo?["text"] as? String else { return }
            Task { @MainActor in await self?.talk.streamingSelfTest(wavPath: path) }
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        agents.stopAll()
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
        menu.addItem(withTitle: "Open Dot", action: #selector(openHome), keyEquivalent: "")
        let presence = NSMenuItem(title: "Dot beside the cursor", action: #selector(togglePresence), keyEquivalent: "")
        presence.state = config.showCompanion ? .on : .off
        menu.addItem(presence)
        presenceItem = presence
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
    }

    @objc private func askByTyping() { hud.showInput() }
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
    static let string = "0.3.0"
}

enum DotIPC {
    static let ask = Notification.Name("com.roshan.dot.ask")
    static let agent = Notification.Name("com.roshan.dot.agent")
    static let home = Notification.Name("com.roshan.dot.home")
    static let stop = Notification.Name("com.roshan.dot.stop")
    static let refresh = Notification.Name("com.roshan.dot.refresh")
    static let type = Notification.Name("com.roshan.dot.type")
    static let stt = Notification.Name("com.roshan.dot.stt")
    static let card = Notification.Name("com.roshan.dot.card")
}
