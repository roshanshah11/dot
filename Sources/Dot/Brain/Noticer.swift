import AppKit
import DotKit
import Foundation

/// The proactive beat: when he switches to something that touches a deadline or a commitment
/// Atlas knows about, Dot says one quiet line beside the cursor. Jev decides whether the
/// window relates to any item (a fraction of a cent, no Claude call); strict cooldowns keep it rare.
/// A switch with nothing to say is a break, and may get a quip (docs/persona.md).
@MainActor
final class Noticer {
    /// Replaced when Home's settings are saved (`update`), so chattiness and the quip settings apply at once.
    private var config: DotConfig
    private let atlas: AtlasBridge
    private let overlay: OverlayManager
    private let jev: Jev?
    private var lastNoticeAt = Date.distantPast
    /// Each item noticed, with the due date and app it was noticed under (BackOff.mayNotice).
    private var noticed: [String: BackOff.Seen] = [:]
    private var debounce: DispatchWorkItem?
    private var lastKey = ""
    private var switches = SwitchCount()

    /// His `chattiness` (0 to 3) mapped onto the knobs below; each still needs its own setting on.
    private var chat: Chattiness { Chattiness(config.chattiness) }
    private var notices: Bool { config.proactiveNotices && chat.notices }
    private var offers: Bool { config.suggestions && chat.offers }
    /// AppDelegate's word that Dot is free to put up an unprompted bubble: Talk idle, nothing recording.
    var canSpeakUp: (() -> Bool)?

    init(config: DotConfig, atlas: AtlasBridge, overlay: OverlayManager, jev: Jev?) {
        self.config = config
        self.atlas = atlas
        self.overlay = overlay
        self.jev = jev
        self.writer = QuipWriter(config: config)
    }

    private var watchingSwitches = false

    /// Starts what the settings call for. Safe to call again: what already runs is left as it is.
    func start() {
        if offers, jev != nil, titleTimer == nil {
            titleTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
                Task { @MainActor in self?.pollDocument() }
            }
            Log.info("noticer: suggestions on, watching for documents")
        }
        // App switches carry the deadline notices (Jev) and the skill offers (a table, no Jev).
        let deadlineNotices = notices && jev != nil
        let quips = chat.quipCooldown != nil
        guard deadlineNotices || offers || quips else {
            Log.info("noticer: off (\(chat.level == 0 ? "chattiness 0" : notices ? "no jev key" : "disabled in config"))")
            return
        }
        guard !watchingSwitches else { return }
        watchingSwitches = true
        NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] note in
            guard let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
                  app.processIdentifier != ProcessInfo.processInfo.processIdentifier else { return }
            Task { @MainActor in self?.appChanged(app) }
        }
        Log.info("noticer: watching app switches\(deadlineNotices ? " against Atlas deadlines" : "")\(offers ? " for skill offers" : "")\(quips ? " for quips" : "") (chattiness \(chat.level))")
    }

    /// Settings saved in Home: chattiness and the quip settings count from the next break. Raising
    /// chattiness from 0 starts watching app switches; lowering it closes each gate as it is reached.
    func update(_ config: DotConfig) {
        self.config = config
        writer.config = config
        start()
    }

    private func appChanged(_ app: NSRunningApplication) {
        // Counted as they happen, so flipping back and forth counts even inside the debounce.
        let repeated = switches.switched(to: app.bundleIdentifier ?? app.localizedName ?? "?", at: Date())
        debounce?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.consider(app, repeated: repeated) }
        debounce = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5, execute: work)
    }

    private func consider(_ app: NSRunningApplication, repeated: Bool) {
        if config.quietOnCalls, CallPresence.isOnCall() { return }
        let context = AccessibilityContext.capture(maxElements: 0, timeBudget: 0.15)
        if offers, offerSkill(app: app, context: context) { return }
        // One line per switch: a deadline notice comes first; with none to give, the switch is a break.
        notice(app: app, context: context) { [weak self] in self?.quipAtSwitch(repeated: repeated, screen: context) }
    }

    /// A deadline notice for the window in front, or `otherwise` when there is none to give.
    private func notice(app: NSRunningApplication, context: ScreenContext, otherwise: @escaping () -> Void) {
        guard notices, let jev, let brief = atlas.brief,
              Date().timeIntervalSince(lastNoticeAt) > chat.cooldown(minutes: config.noticeCooldownMinutes) else { return otherwise() }
        let items = Array((brief.deadlines(withinDays: 2) + brief.commitments.prefix(4)).prefix(8))
        guard !items.isEmpty else { return otherwise() }
        let title = context.windowTitle ?? ""
        let appID = app.bundleIdentifier ?? app.localizedName ?? "?"
        let key = "\(appID)|\(title.prefix(60))"
        guard key != lastKey else { return otherwise() }
        lastKey = key
        var criteria: [String: String] = ["none": "nothing on screen relates to these items"]
        for (index, item) in items.enumerated() { criteria["i\(index + 1)"] = String(item.prefix(220)) }
        let state: [String: Any] = [
            "frontmost_app": app.localizedName ?? "", "window_title": String(title.prefix(160)), "url": context.url ?? "",
            "now": ISO8601DateFormatter().string(from: Date()),
        ]
        jev.evaluate("notice", state: state, questions: [
            "item": .choice(instructions: "The user just switched to this app and window. Does it clearly relate to one of these deadlines or commitments (the same firm, form, course or person)? Pick that item, else none.", criteria: criteria),
        ]) { [weak self] answers in
            guard let self else { return }
            guard let choice = answers?["item"]?.choice, choice.choice != "none",
                  choice.probability >= 0.7, choice.confidence >= 0.55,
                  let index = Int(choice.choice.dropFirst()), items.indices.contains(index - 1) else { return otherwise() }
            let item = items[index - 1]
            // Not again until its due date or the app in front changes (persona-C7), and never within four hours.
            let (id, due) = BackOff.item(item)
            let here = BackOff.Context(due: due, app: appID)
            guard BackOff.mayNotice(id, in: here, now: Date(), seen: self.noticed) else { return otherwise() }
            self.noticed[id] = BackOff.Seen(context: here, at: Date())
            self.lastNoticeAt = Date()
            let line = Self.line(for: item)
            Log.info("notice: \(app.localizedName ?? "?") -> \(Log.short(item, 80))")
            self.overlay.greet(line, for: 9)
        }
    }

    // MARK: Quips (docs/persona.md)
    // His call 2026-10-17: one cheeky line at a break, at most every 40 minutes, a bubble with no voice.
    // The lines and every rule about which one are DotKit's Quips; this is where the gates live.

    private static let quipKey = "dot.quips.history"
    private var quipHistory: QuipHistory = Noticer.loadQuips() {
        didSet {
            guard quipHistory != oldValue, let data = try? JSONEncoder().encode(quipHistory) else { return }
            UserDefaults.standard.set(data, forKey: Self.quipKey)
        }
    }

    private static func loadQuips() -> QuipHistory {
        guard let data = UserDefaults.standard.data(forKey: quipKey),
              let history = try? JSONDecoder().decode(QuipHistory.self, from: data) else { return QuipHistory() }
        return history
    }

    /// One quip at a break, through every gate: chattiness, not while he types (a key in the last two
    /// seconds), on a call, while Talk is busy or something records, or with Reduce Motion on; then the
    /// cooldown and the week without repeats. A return from idle becomes "morning" or "lateNight" when
    /// one is due. A bubble, never the voice. The animator side calls this for backShort, backLong,
    /// petted, agentDone and agentFailed; app switches come in from here. True when a line is on its way.
    @discardableResult
    func quip(_ situation: QuipSituation) -> Bool {
        quip(among: { history in [Quips.refine(situation, now: Date(), history: history)] })
    }

    /// A switch with nothing to notice: an event about to start (once per event, past the cooldown),
    /// then the time of day, a deadline due today, or the fifth visit to one app in ten minutes.
    private func quipAtSwitch(repeated: Bool, screen: ScreenContext) {
        let dueToday = !(atlas.brief?.deadlines(withinDays: 0).isEmpty ?? true)
        let events = upcomingEvents()
        quip(among: { history in
            let soon: [QuipSituation] = Upcoming.due(events, now: Date(), history: history) == nil ? [] : [.upcoming]
            return soon + Quips.atSwitch(now: Date(), history: history, dueToday: dueToday, repeated: repeated)
        }, screen: screen)
    }

    /// Notes the break (the morning's first sight counts even when nothing shows), then the first
    /// situation that may have a line gets one: the quip model's for the moment when context lines are
    /// on (round two), else, or when its line fails the check, errs or takes over six seconds, the bank's.
    @discardableResult
    private func quip(among situations: (QuipHistory) -> [QuipSituation], screen: ScreenContext? = nil) -> Bool {
        let now = Date()
        quipHistory = Quips.sawBreak(at: now, history: quipHistory)
        let history = quipHistory
        guard chat.quipCooldown != nil, !writer.isBusy, quipGatesOpen else { return false }
        let writes = config.contextQuips
        guard let situation = situations(history).first(where: { situation in
            Quips.allows(situation, now: now, chattiness: chat.level, history: history)
                && (writes || !Quips.fresh(situation, now: now, history: history).isEmpty)
        }) else { return false }
        let events = upcomingEvents()
        let event = situation == .upcoming ? Upcoming.due(events, now: now, history: history) : nil
        // At most one quip-model run a minute, and the try takes the slot, so a line that fails the
        // check can't start another run at every break.
        guard writes, lastWriteAt.map({ now.timeIntervalSince($0) >= 60 }) ?? true else { return showWritten(situation, event: event) }
        lastWriteAt = now
        quipHistory = Quips.attempted(situation, now: now, history: quipHistory, event: event.map { Upcoming.key($0) })
        let screen = screen ?? AccessibilityContext.capture(maxElements: 0, timeBudget: 0.12)
        let context = QuipContext(situation: situation, now: now, app: screen.appName, windowTitle: screen.windowTitle,
                                  next: event ?? Upcoming.relevant(to: situation, in: events, now: now), agent: recentAgent(at: now))
        writer.write(context) { [weak self] outcome in
            guard let self else { return }
            // Up to six seconds have passed: long enough to start typing, take a call or get an offer up.
            guard self.chat.quipCooldown != nil, self.quipGatesOpen, Self.pending == nil else {
                Log.info("quip: \(situation.rawValue): a gate closed while the line was written")
                return
            }
            let model = self.config.quipModel
            if let line = outcome.line, Quips.isFresh(line, now: Date(), history: self.quipHistory) {
                Log.info(String(format: "quip: %@ wrote it in %.1f s ($%.4f)", model, outcome.seconds, outcome.costUSD))
                self.show(line, situation, event: event)
            } else {
                let why = outcome.raw.map { "\"\(Log.short($0, 80))\" failed the check" } ?? (outcome.timedOut ? "took over six seconds" : "gave no line")
                Log.info("quip: \(model) \(why); the written lines instead")
                self.showWritten(situation, event: event)
            }
        }
        return true
    }

    /// A written line for the situation, when one is fresh.
    @discardableResult
    private func showWritten(_ situation: QuipSituation, event: UpcomingEvent?) -> Bool {
        guard let line = Quips.fresh(situation, now: Date(), history: quipHistory).randomElement() else { return false }
        show(line, situation, event: event)
        return true
    }

    /// Up it goes: stamped for the cooldown, the week without repeats and, for an upcoming event, once per event.
    private func show(_ line: String, _ situation: QuipSituation, event: UpcomingEvent?) {
        quipHistory = Quips.stamp(line, situation, now: Date(), history: quipHistory, event: event.map { Upcoming.key($0) })
        Log.info("quip: \(situation.rawValue)\(event.map { " (\(Log.short($0.title, 50)))" } ?? ""): \(line)")
        overlay.greet(line, for: 6)
    }

    // MARK: Context lines (docs/alive.md, round two)

    private let writer: QuipWriter
    private var lastWriteAt: Date?
    /// The last agent result, for a line in the minute or two after it lands.
    private var lastAgent: (agent: QuipContext.Agent, at: Date)?

    /// An agent finished or failed; its one-line result is the context for the quip that follows.
    func agentFinished(line: String, failed: Bool) {
        let line = line.trimmingCharacters(in: .whitespacesAndNewlines)
        lastAgent = line.isEmpty ? nil : (QuipContext.Agent(line: line, failed: failed), Date())
    }

    private func recentAgent(at now: Date) -> QuipContext.Agent? {
        guard let lastAgent, now.timeIntervalSince(lastAgent.at) < 120 else { return nil }
        return lastAgent.agent
    }

    /// Today's and tomorrow's events and the deadlines, from the TodayBrief AtlasBridge refreshes.
    private func upcomingEvents() -> [UpcomingEvent] {
        atlas.brief.map { Upcoming.events(in: $0) } ?? []
    }

    /// The mischief guard for quips (docs/alive.md, Phase 2 item 8), read from the system.
    private var quipGatesOpen: Bool {
        Quips.gatesOpen(secondsSinceKey: CGEventSource.secondsSinceLastEventType(.hidSystemState, eventType: .keyDown),
                        onCall: config.quietOnCalls && CallPresence.isOnCall(),
                        busy: !(canSpeakUp?() ?? true),
                        reduceMotion: NSWorkspace.shared.accessibilityDisplayShouldReduceMotion)
    }

    // MARK: Suggestions in context
    // His ask 2026-10-15: "suggestions actually aren't bad. not just for the morning, but like have it
    // be on where if i go to a new pdf it might suggest something". A new document in front (a pdf,
    // slides, a problem set, a paper) gets one quiet offer beside the cursor; "yes" runs it, "no" is
    // remembered, and a kind he has turned down three times stops being offered.

    struct Suggestion {
        let kind: String
        let line: String
        let ask: String
    }

    var onSuggest: ((Suggestion) -> Void)?
    private var titleTimer: Timer?
    private var lastDocKey = ""
    private var lastSuggestAt = Date.distantPast
    private static let documentWords = try! NSRegularExpression(pattern: #"(?i)\.pdf\b|\.pptx?\b|\.docx?\b|\blecture\b|\bslides?\b|\bproblem set\b|\bpset\b|\bhomework\b|\bchapter\b|\bsyllabus\b|arxiv|\bpaper\b|\breading\b|\bworksheet\b|\bexam\b|\bmidterm\b|canvas\.uchicago|\.edu/.*\.pdf"#)

    private func pollDocument() {
        guard offers, jev != nil else { return }
        let context = AccessibilityContext.capture(maxElements: 0, timeBudget: 0.12)
        let title = context.windowTitle ?? ""
        let url = context.url ?? ""
        let key = "\(context.appName ?? "")|\(title.prefix(80))|\(url.prefix(80))"
        guard key != lastDocKey else { return }
        lastDocKey = key
        let probe = title + " " + url
        guard Self.documentWords.firstMatch(in: probe, range: NSRange(location: 0, length: (probe as NSString).length)) != nil else { return }
        guard Date().timeIntervalSince(lastSuggestAt) > chat.cooldown(minutes: config.suggestionCooldownMinutes) else { return }
        if config.quietOnCalls, CallPresence.isOnCall() { return }
        suggest(app: context.appName ?? "", title: title, url: url)
    }

    private func suggest(app: String, title: String, url: String) {
        guard let jev else { return }
        var criteria = ["none": "nothing; he is browsing, working, or this is not something he studies from"]
        if Self.allowed("gist") { criteria["gist"] = "a one-minute gist: what this document is and its three main points, on a card" }
        if Self.allowed("find") { criteria["find"] = "find the part of this document that today's lecture or an upcoming deadline is about" }
        if Self.allowed("quiz") { criteria["quiz"] = "a few quick questions on this document once he has read it" }
        guard criteria.count > 1 else { return }
        var state: [String: Any] = ["frontmost_app": app, "window_title": String(title.prefix(160)), "url": String(url.prefix(200)),
                                    "now": ISO8601DateFormatter().string(from: Date())]
        if let brief = atlas.brief { state["deadlines"] = Array(brief.deadlines(withinDays: 14).prefix(6)) }
        jev.evaluate("suggest", state: state, questions: [
            "offer": .choice(instructions: "The user just opened this document. Would one of these help right now? Pick the single most useful, else none.", criteria: criteria),
        ]) { [weak self] answers in
            guard let self, let choice = answers?["offer"]?.choice, choice.choice != "none",
                  choice.probability >= 0.6, choice.confidence >= 0.5 else { return }
            let kind = choice.choice
            let line: String, ask: String
            switch kind {
            case "gist":
                line = "want the gist of this? say yes."
                ask = "give me the gist of what's on my screen: what this document is and its three main points, on a card, then stop."
            case "find":
                line = "want me to find today's part in this? say yes."
                ask = "find the part of this document that today's lecture or my nearest deadline is about, point me to it, and say what it covers."
            default:
                line = "quiz me on this later? say yes."
                ask = "ask me three quick questions about what's on my screen, one at a time, and grade each answer."
            }
            self.lastSuggestAt = Date()
            Log.info("suggest: \(kind) for \(Log.short(title, 60)) (\(String(format: "%.2f", choice.probability)))")
            self.overlay.greet(line, for: 12)
            self.onSuggest?(Suggestion(kind: kind, line: line, ask: ask))
            self.awaitReply(kind, bubble: 12)
        }
    }

    // MARK: Skills for the app in front (SK-01)
    // HeyClicky offers an app's skill while he is in it. PowerPoint, a model in Excel, a filing or
    // Canvas gets the matching skill offered (AppSkillOffers), once per row per day, through the same
    // yes and no counts and cooldown as the document offers; a yes hands it to an agent with the
    // skill named in the ask, the way Talk runs any suggestion.

    private static let offeredKey = "dot.appskill.offered"

    /// Returns true when it made an offer, so the deadline notice waits for the next switch.
    private func offerSkill(app: NSRunningApplication, context: ScreenContext) -> Bool {
        let bundle = context.bundleIdentifier ?? app.bundleIdentifier
        guard let offer = AppSkillOffers.match(bundleID: bundle, windowTitle: context.windowTitle, url: context.url, documentPath: context.documentPath),
              Self.allowed(offer.kind) else { return false }
        let today = AppSkillOffers.day(Date())
        var offered = UserDefaults.standard.dictionary(forKey: Self.offeredKey) as? [String: String] ?? [:]
        guard AppSkillOffers.isDue(offer.row, lastOffered: offered, today: today),
              Date().timeIntervalSince(lastSuggestAt) > chat.cooldown(minutes: config.suggestionCooldownMinutes) else { return false }
        offered[offer.row] = today
        UserDefaults.standard.set(offered, forKey: Self.offeredKey)
        lastSuggestAt = Date()
        let line = offer.line + " say yes."
        Log.info("suggest: \(offer.kind) (\(offer.skill)) for \(Log.short(context.windowTitle ?? "", 60))")
        overlay.greet(line, for: 12)
        onSuggest?(Suggestion(kind: offer.kind, line: line, ask: offer.ask))
        awaitReply(offer.kind, bubble: 12)
        return true
    }

    // MARK: Backing off (persona-C6, C7, C15)
    // An offer he lets time out ends on "ok, later." and counts as a soft decline; two of those are
    // one no, and three no's with no yes retire the kind (BackOff, tested in DotKit).

    /// The offer on show until he answers it or the reply window closes.
    private static var pending: BackOff.Pending?

    /// After an offer goes up: if he hasn't answered when its bubble fades, the bubble ends on
    /// "ok, later."; if the reply window (Talk's 45 s) closes with no yes or no, a soft decline.
    private func awaitReply(_ kind: String, bubble seconds: TimeInterval) {
        let offer = BackOff.Pending(kind: kind, at: Date())
        Self.pending = offer
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds) { [weak self] in
            guard let self, Self.pending == offer, self.canSpeakUp?() ?? true,
                  CGEventSource.secondsSinceLastEventType(.hidSystemState, eventType: .keyDown) >= Quips.typingWindow else { return }
            self.overlay.greet("ok, later.", for: 2)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + BackOff.replyWindow + 1) {
            guard Self.pending == offer, offer.expired(at: Date()) else { return }
            Self.pending = nil
            Self.recordTimeout(kind: kind)
        }
    }

    /// He moved on to something else while an offer was up: no "ok, later." over his new answer, and
    /// no soft decline for an offer he engaged past.
    static func clearPending() { pending = nil }

    /// Yes/no history per kind; three declines with no acceptance retire a kind.
    static func record(kind: String, accepted: Bool) {
        if pending?.kind == kind { pending = nil }
        let key = "dot.suggest.\(kind).\(accepted ? "yes" : "no")"
        UserDefaults.standard.set(UserDefaults.standard.integer(forKey: key) + 1, forKey: key)
        Log.info("suggest: \(kind) \(accepted ? "accepted" : "declined")")
    }

    /// An offer that got no reply: half a decline.
    static func recordTimeout(kind: String) {
        let key = "dot.suggest.\(kind).soft"
        UserDefaults.standard.set(UserDefaults.standard.integer(forKey: key) + 1, forKey: key)
        Log.info("suggest: \(kind) timed out with no reply")
    }

    static func tally(_ kind: String) -> BackOff.Tally {
        let defaults = UserDefaults.standard
        return BackOff.Tally(yes: defaults.integer(forKey: "dot.suggest.\(kind).yes"), no: defaults.integer(forKey: "dot.suggest.\(kind).no"),
                             soft: defaults.integer(forKey: "dot.suggest.\(kind).soft"))
    }

    static func allowed(_ kind: String) -> Bool { !tally(kind).retired }

    /// "heads up: centerview coffee chats, due 2026-10-15." from a deadline line that starts with its date.
    static func line(for item: String) -> String {
        var text = item
        var due = ""
        if text.count >= 10, text.prefix(4).allSatisfy(\.isNumber) {
            due = String(text.prefix(10))
            text = String(text.dropFirst(10)).trimmingCharacters(in: .whitespaces)
        }
        let head = text.split(separator: ":").first.map(String.init) ?? text
        let short = String(head.prefix(80)).lowercased()
        return due.isEmpty ? "heads up, this one is open: \(short)." : "heads up: \(short), due \(due)."
    }
}
