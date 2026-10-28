import AppKit
import DotKit
import Foundation

/// One call in call mode (his ask 2026-10-28, "build dot for calls/interviews"; design in the dot-call-mode memory).
/// The window opens with the call's prep pinned; the ear hears him and them on separate streams; in a coffee chat the
/// helper gets each new stretch of their words and puts a fact or a follow-up in the live column, the prep checklist
/// ticks off (his words or theirs covering an item, or the helper saying so) and the close-ask nudge comes up three
/// minutes before the calendar's end until he asks it. An interview is listen-only. When it ends (his End call, his
/// words, or two minutes of silence from both sides) CallAfter writes the transcript and hands the recap to an agent.
@MainActor
final class CallSession {
    let event: CallEvent
    let prepURL: URL?
    let prep: String
    private let ear: CallEar
    private let window: CallWindow
    private let config: DotConfig
    private let transcriber: Transcriber
    private var helper: CallHelper?
    private var checklist: [(text: String, done: Bool)] = []
    private var closeItem: Int?
    private var sentUpTo = 0
    private var lastSentAt = Date.distantPast
    private var nudgeUp = false
    private var tick: Timer?
    private var replaying = false
    /// When their words first came through the Mac's audio (nil until then), whether any sound has, and whether he's
    /// been told nothing has.
    private var theirWordsAt: Date?
    private var anySound = false
    private var warnedSilent = false
    private(set) var ended = false
    private(set) var helps: [CallHelp] = []
    private(set) var nudged = false
    /// A "they asked for X" from the helper, held 20 s: shown only if he hasn't started giving it by then.
    private var heldNudge: (help: CallHelp, at: Date, said: Int)?
    /// Where the transcript goes (the vault's Networking or Interview Prep folder; the replay test's sandbox).
    var folder: URL
    /// No agent after the call (the replay test).
    var dryRun = false
    /// The ear and the helper as of the end, for the replay test.
    private(set) var result: CallAfter.Result?
    var onEnded: ((CallSession) -> Void)?
    /// The after-call agent: Dot's handoff (nil in a dry run).
    var handoff: ((String) -> Void)?

    init(event: CallEvent, prepURL: URL?, prep: String, ear: CallEar, window: CallWindow, config: DotConfig, transcriber: Transcriber, folder: URL) {
        self.event = event
        self.prepURL = prepURL
        self.prep = prep
        self.ear = ear
        self.window = window
        self.config = config
        self.transcriber = transcriber
        self.folder = folder
    }

    var listenOnly: Bool { event.kind == .interview || !config.callHelper }
    var minutes: Int { ear.minutes }
    var hearsThem: Bool { ear.hearsThem }
    var firstName: String { event.person.split(separator: " ").first.map(String.init) ?? (event.firm.isEmpty ? "them" : event.firm) }
    var canDial: Bool { event.phone != nil && !event.theyCall }
    var checklistState: [(text: String, done: Bool)] { checklist }

    func start(replay: (me: URL, them: URL)? = nil, speed: Double = 1) async throws {
        replaying = replay != nil
        if !listenOnly {
            checklist = PrepChecklist.items(from: prep).map { ($0, false) }
            closeItem = checklist.firstIndex { CloseAsk.wasAsked($0.text) || $0.text.lowercased().contains("who else") }
            if closeItem == nil {
                checklist.append(("Ask who else they'd suggest you talk to", false))
                closeItem = checklist.count - 1
            }
        }
        window.onEnd = { [weak self] in Task { @MainActor in await self?.end(reason: "he ended it") } }
        window.onDial = { [weak self] in self?.dial() }
        window.show(.init(who: heading, kind: event.kind.rawValue, prep: prep, checklist: checklist.map { .init(text: $0.text, done: $0.done) },
                          dial: canDial && !replaying, listenOnly: listenOnly, status: "starting"))
        ear.onLine = { [weak self] line in self?.heard(line) }
        try await ear.start(replay: replay, speed: speed)
        ear.onReplayEnded = { [weak self] in Task { @MainActor in await self?.end(reason: "the replay ran out") } }
        if !listenOnly {
            let helper = CallHelper(config: config)
            do {
                try helper.start(call: describe(), lessons: Self.lessons(), prep: prep)
                self.helper = helper
            } catch {
                Log.warn("call: helper didn't start (\(error)); notes and the checklist only")
            }
        }
        tick = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.everySecond() }
        }
        // a replay plays both files; a live tap only counts once sound comes through it (theirSide)
        window.status(!ear.hearsThem ? "hearing only you: take the call on this Mac so Dot hears them"
                      : replaying ? bothSides : "hearing you; waiting for their side to come through this Mac")
        Log.info("call: on with \(event.who) (\(event.kind.rawValue)\(listenOnly ? ", listen-only" : ""))\(prepURL.map { ", prep \($0.lastPathComponent)" } ?? ", no prep file"), \(checklist.count) checklist items")
    }

    var heading: String {
        let firm = event.firm.isEmpty || event.firm == event.who ? "" : " (\(event.firm))"
        return "\(event.who)\(firm)"
    }

    private func describe() -> String {
        let f = DateFormatter(); f.dateFormat = "EEEE, MMMM d, h:mm a"; f.locale = Locale(identifier: "en_US_POSIX")
        var lines = ["\(event.kind == .chat ? "Coffee chat" : "Interview") with \(heading), \(f.string(from: event.start))"]
        if !event.title.isEmpty, event.title != heading { lines.append("Calendar: \(event.title)") }
        return lines.joined(separator: "\n")
    }

    // MARK: Live

    private func heard(_ line: CallLine) {
        guard !ended else { return }
        window.line(.init(side: line.side.rawValue, text: line.text, them: firstName))
        guard !listenOnly else { return }
        // what was said covers a prep item: ticked without waiting for the helper
        let said = ear.recent(.me, seconds: 90) + " " + ear.recent(.them, seconds: 90)
        var newly: [Int] = []
        for (i, item) in checklist.enumerated() where !item.done && i != closeItem && PrepChecklist.covered(item.text, by: said) {
            checklist[i].done = true
            newly.append(i)
        }
        if line.side == .me, let closeItem, !checklist[closeItem].done, CloseAsk.wasAsked(line.text) {
            checklist[closeItem].done = true
            newly.append(closeItem)
            Log.info("call: he asked the close")
        }
        if !newly.isEmpty { window.check(newly) }
    }

    private var bothSides: String { listenOnly ? "listening to both sides; the debrief comes after" : "hearing both sides" }

    /// The tap starting proves nothing: without System Audio Recording it records exact silence, and with the call on his
    /// phone it records only the Mac's own sounds (a notification is sound, not them). Both sides are claimed once the
    /// recognizer turns the Mac's audio into a few of their words; a minute in with him talking and none, the window
    /// says which of the two it looks like.
    private func theirSide() {
        guard ear.hearsThem, !replaying, theirWordsAt == nil else { return }
        if let peak = ear.theirPeak(), peak > 0.001 { anySound = true }
        let theirWords = ear.lines.filter { $0.side == .them }.reduce(0) { $0 + $1.text.split(separator: " ").count }
        if theirWords >= 3 {
            theirWordsAt = Date()
            window.status(bothSides)
            Log.info("call: their words are coming through the Mac's audio")
            return
        }
        guard !warnedSilent, Date().timeIntervalSince(ear.began) > 60, ear.lines.contains(where: { $0.side == .me }) else { return }
        warnedSilent = true
        window.status(anySound ? "no words from them yet: is the call on this Mac, not your phone?"
                               : "no sound from the Mac yet: is the call on this Mac? Dot needs System Audio Recording (System Settings > Privacy & Security)")
        Log.warn("call: a minute in, no words from their side (\(anySound ? "the Mac's audio has sound: the call may be on another device" : "the tap has heard nothing: no System Audio Recording, or the call isn't on this Mac"))")
    }

    private func everySecond() {
        guard !ended else { return }
        window.clock(CallTranscript.clock(Date().timeIntervalSince(ear.began)))
        theirSide()
        if !listenOnly {
            askHelper()
            releaseNudge()
            closeNudge()
        }
        // both sides quiet for two minutes, three minutes in: the call is over
        let quiet = min(Date().timeIntervalSince(ear.lastHeard(.me)), Date().timeIntervalSince(ear.lastHeard(.them)))
        if !replaying, Date().timeIntervalSince(ear.began) > 180, quiet > 120 {
            Task { @MainActor in await end(reason: "two minutes of silence") }
        }
    }

    /// Their newest words to the helper: a dozen or more, once they pause (or every 25 s while they keep talking).
    private func askHelper() {
        guard let helper, !helper.isBusy, sentUpTo < ear.lines.count else { return }
        let fresh = Array(ear.lines[sentUpTo...])
        let theirWords = fresh.filter { $0.side == .them }.reduce(0) { $0 + $1.text.split(separator: " ").count }
        guard theirWords >= 12 else { return }
        let paused = Date().timeIntervalSince(ear.lastHeard(.them)) >= 1.2
        guard paused || Date().timeIntervalSince(lastSentAt) >= 25 else { return }
        sentUpTo = ear.lines.count
        lastSentAt = Date()
        let open = checklist.enumerated().filter { !$0.element.done && $0.offset != closeItem }.map { "\($0.offset + 1). \($0.element.text)" }
        let message = "[minute \(ear.minutes)]\n" + CallTranscript.merged(fresh).map { "\($0.side == .me ? "me" : "them"): \($0.text)" }.joined(separator: "\n")
            + "\n\nopen prep items:\n" + (open.isEmpty ? "(none)" : open.joined(separator: "\n"))
        helper.send(message) { [weak self] reply in self?.helped(reply) }
    }

    private func helped(_ reply: String?) {
        guard let reply, !ended else { return }
        let help = CallHelp.parse(reply)
        let done = help.done.map { $0 - 1 }.filter { $0 >= 0 && $0 < checklist.count && !checklist[$0].done }
        for i in done { checklist[i].done = true }
        if !done.isEmpty { window.check(done) }
        if let nudge = help.nudge { heldNudge = (CallHelp(nudge: nudge), Date(), myWords) }
        let now = CallHelp(fact: help.fact, ask: help.ask)
        guard !now.isEmpty else { return }
        show(now)
    }

    private func show(_ help: CallHelp) {
        helps.append(help)
        window.help(.init(fact: help.fact, ask: help.ask, nudge: help.nudge, at: CallTranscript.clock(Date().timeIntervalSince(ear.began))))
        Log.info("call: helper: \(Log.short([help.fact, help.ask, help.nudge].compactMap { $0 }.joined(separator: " | "), 140))")
    }

    private var myWords: Int { ear.lines.filter { $0.side == .me }.reduce(0) { $0 + $1.text.split(separator: " ").count } }

    /// A held "they asked" goes up after 20 s unless he has said 25 words since (he was answering it).
    private func releaseNudge() {
        guard let held = heldNudge, Date().timeIntervalSince(held.at) >= 20 else { return }
        heldNudge = nil
        if myWords - held.said >= 25 { Log.info("call: dropped a held nudge; he answered (\(Log.short(held.help.nudge ?? "", 60)))"); return }
        show(held.help)
    }

    private func closeNudge() {
        let asked = closeItem.map { checklist[$0].done } ?? true
        if asked {
            if nudgeUp { window.nudge(""); nudgeUp = false }
            return
        }
        guard !nudgeUp, CloseAsk.nudgeDue(now: Date(), began: ear.began, endsAt: event.end, asked: false) else { return }
        window.nudge("Ask who else they'd suggest you talk to")
        nudgeUp = true
        nudged = true
        Log.info("call: the close-ask nudge is up")
    }

    /// The Mac's Phone app (Continuity) dials the number on the event.
    func dial() {
        guard let phone = event.phone, let url = URL(string: "tel:\(phone)") else { return }
        NSWorkspace.shared.open(url)
        Log.info("call: dialing \(event.who) through the Phone app")
    }

    func showWindow() { window.bringUp() }

    // MARK: The end

    func end(reason: String) async {
        guard !ended else { return }
        ended = true
        tick?.invalidate()
        tick = nil
        helper?.stop()
        helper = nil
        window.nudge("")
        window.ended("call over: writing the transcript")
        await ear.stop()
        Log.info("call: ended (\(reason)) after \(ear.minutes) min: \(ear.lines.count) lines, \(helps.count) helper lines\(nudged ? ", the close nudge shown" : "")")
        let result = await CallAfter.run(event: event, heading: heading, ear: ear, prep: prepURL, transcriber: transcriber, folder: folder,
                                         deleteAudio: !replaying, missed: checklist.filter { !$0.done }.map(\.text), helps: helps)
        self.result = result
        if let brief = result.brief, !dryRun { handoff?(brief) }
        window.ended(result.line)
        onEnded?(self)
    }

    // MARK: His lessons

    /// "Before the chat" and "During" from his running lessons file: what works on these calls.
    static func lessons() -> String {
        guard let text = try? String(contentsOfFile: DotConfig.expand("~/roshan/Career/Networking/Coffee chat lessons.md"), encoding: .utf8) else { return "" }
        var keep = false
        var out: [String] = []
        for line in text.components(separatedBy: "\n") {
            if line.hasPrefix("## ") { keep = line.lowercased().contains("before") || line.lowercased().contains("during") }
            if keep { out.append(line) }
        }
        return out.joined(separator: "\n")
    }
}
