import AppKit
import Combine
import DotKit
import SwiftUI

/// One row of the task bar: an agent at work, a walkthrough in progress, a lesson on the board. Agents (and
/// `.job`, which only the stack draws, never the notch) go to the stack at the top right when `notchTalkOnly` is on;
/// walkthrough, lesson and board rows stay in the notch, a live exchange.
struct AgentRow: Identifiable, Equatable {
    enum State: Equatable { case running, waiting, done, failed }
    enum Kind: Equatable { case agent, walkthrough, lesson, job }
    let id: String
    var name: String
    var line: String
    var state: State
    var result: String? = nil
    var outputCount: Int = 0
    var outputs: [URL] = []
    /// Up to four offers from the turn's "Next:" lines (TC-02), each a button that sends it back.
    var nextActions: [String] = []
    var kind: Kind = .agent
    /// The last few things it did, newest last: tool calls, a sentence it wrote, a step he took.
    var steps: [String] = []
    var canStop = false
    var startedAt = Date()
    /// The stack chip's state when the row's own four do not say it (stopped, interrupted, paused, unfinished, attention).
    var chip: AgentChip.State? = nil
    /// A card held for reading time: the line he did not hear on a muted Mac.
    var holdUntil: Date? = nil

    /// A walkthrough, lesson or board row: a live exchange, drawn in the notch. The lecture ear's row goes to the stack.
    var isLiveExchange: Bool { kind == .walkthrough || (kind == .lesson && id != "lecture") }
    /// Drawn by the stack at the top right when the notch is for talking only.
    var isStackBound: Bool { !isLiveExchange }

    /// The stack's state for this row.
    var chipState: AgentChip.State {
        if let chip { return chip }
        switch state {
        case .running: return .running
        case .waiting: return .waiting
        case .done: return line.hasPrefix("paused") ? .paused : .done
        case .failed:
            if line.hasPrefix("interrupted") { return .interrupted }
            return line == "stopped" ? .stopped : .failed
        }
    }

    /// The row as a stack chip.
    var stackChip: StackChip {
        var chip = StackChip(id: id, kind: kind == .job ? .job : .agent, title: name, line: line, steps: steps, state: chipState,
                             startedAt: startedAt, canStop: canStop, holdUntil: holdUntil)
        chip.canOpen = id != "lecture"
        chip.result = result
        chip.outputs = outputs
        chip.nextActions = nextActions
        return chip
    }
}

struct ConsentCard: Identifiable {
    let id: UUID
    /// The asking agent's slug: its cards leave with it when it stops, and its row brings them forward.
    let agentId: String
    let agent: String
    let title: String
    let detail: String
    /// A send, a payment, a delete, a push or a change to the Mac: a spoken yes has to name the act.
    let guarded: Bool
    let onAllow: () -> Void
    let onDeny: () -> Void
    /// HeyClicky's "your yes covers one conversation": allow this kind of action for the rest of the task.
    var onAlways: (() -> Void)? = nil
    /// Its agent stopped or its session ended: the question is answered no (FX-07).
    var onWithdraw: (() -> Void)? = nil

    init(id: UUID = UUID(), agentId: String = "", agent: String, title: String, detail: String, guarded: Bool = false,
         onAllow: @escaping () -> Void, onDeny: @escaping () -> Void, onAlways: (() -> Void)? = nil) {
        self.id = id
        self.agentId = agentId
        self.agent = agent
        self.title = title
        self.detail = detail
        self.guarded = guarded
        self.onAllow = onAllow
        self.onDeny = onDeny
        self.onAlways = onAlways
    }
}

/// A typed notice under the notch, after HeyClicky's notch surfaces (dictation on the clipboard,
/// a learned word, microphone trouble, a muted speaker, a meeting countdown, an app update): an
/// icon, a line, maybe a detail, and at most two buttons. One per `id`; a repeat replaces it.
struct NotchNotice: Identifiable, Equatable {
    enum Tone: Equatable { case info, good, warn }
    let id: String
    var icon: String
    var title: String
    var detail: String? = nil
    var tone: Tone = .info
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil
    var secondaryTitle: String? = nil
    var secondary: (() -> Void)? = nil
    /// How long it stays; 0 keeps it until he closes it or an action runs.
    var seconds: TimeInterval = 8

    static func == (a: NotchNotice, b: NotchNotice) -> Bool {
        a.id == b.id && a.title == b.title && a.detail == b.detail && a.tone == b.tone && a.actionTitle == b.actionTitle && a.secondaryTitle == b.secondaryTitle
    }
}

/// The morning card: a few things Dot could take on today, from Atlas, with yes and no remembered.
struct MorningCard: Equatable {
    struct Item: Identifiable, Equatable {
        let id: String
        let text: String
        /// The brief an agent gets when he says "do it".
        let brief: String
    }
    var greeting: String
    var items: [Item]
}

final class HUDModel: ObservableObject {
    enum Phase: Equatable { case hidden, listening, transcribing, thinking, speaking, done }

    @Published var phase: Phase = .hidden
    @Published var mode: HotkeyMonitor.Mode = .talk
    @Published var transcript = ""
    @Published var response = ""
    @Published var level: Float = 0
    @Published var status: String?
    @Published var error: String?
    @Published var agents: [AgentRow] = []
    @Published var consent: ConsentCard?
    /// Questions waiting behind the one on show (round seven: one card per request, never replaced).
    @Published var consentWaiting = 0
    /// When the card on show came on show: a tap in its first half second was aimed at the card before
    /// it (the buttons sit in the same place), and a bare yes or no soon after it is about this card.
    var consentShownAt = Date.distantPast
    @Published var showInput = false
    @Published var inputText = ""
    /// What the field asks for; cleared after a submit.
    @Published var inputPrompt: String?
    /// The field on show sends to an agent: decided when it opened, never inherited from an earlier ask.
    @Published var inputForAgent = false
    @Published var accent = Color(red: 1.0, green: 0.42, blue: 0.17)
    /// The agent whose result card is open to read.
    @Published var expanded: String?
    @Published var replyText = ""
    @Published var todayLine: String?
    /// The sentence Dot is saying right now (voice answers): one line in the notch, the way
    /// HeyClicky shows its state there, instead of a bubble over the page.
    @Published var caption: String?
    /// A typed question's answer, kept readable until he closes it (HeyClicky's text response surface).
    @Published var answer: String?
    @Published var answerQuestion = ""
    /// "ochem in 12 min": the next meeting, shown on the idle tab when it is close.
    @Published var meetingLine: String?
    /// "listening to the lecture, 12 min" while Dot's ear is on.
    @Published var listeningLine: String?
    /// "recording 1:23" while Murmur records (one notch for both apps), then "murmur transcribing".
    @Published var recordingLine: String?
    /// The stronger model is on the question: the header says "thinking deeper".
    @Published var deeper = false
    /// Typed notices, newest last; two show at a time.
    @Published var notices: [NotchNotice] = []
    /// The panel's corners glow for a moment when something live lands (a notice, a finished agent).
    @Published var glow = false
    @Published var morning: MorningCard?
    /// The context mode in words ("desk mode"), the idle header when nothing else is on (VI-03).
    @Published var modeWord: String?
    @Published var morningExpanded = false
    /// A small black tab under the notch when there is nothing else to show.
    @Published var presence = false
    @Published var hovering = false
    /// What the view draws, measured; the window is sized to it.
    @Published var contentSize: CGSize = .zero
    /// The typed text, and whether the field was opened for an agent (a shift tap or the region's "to an agent").
    var onSubmitInput: ((String, Bool) -> Void)?
    var onOpenAgent: ((String) -> Void)?
    /// "open" on an agent card: its thread in the Dot window.
    var onOpenHome: ((String) -> Void)?
    var onReply: ((String, String) -> Void)?
    var onDismissAgent: ((String) -> Void)?
    var onStopAgent: ((String) -> Void)?
    /// A "needs you" row was tapped: show that agent's question.
    var onFocusConsent: ((String) -> Void)?
    var onMorningDecision: ((MorningCard.Item, Bool) -> Void)?
    var onMorningDismiss: (() -> Void)?
    /// Running tasks fold into pills on the idle tab after a while; a change or a hover unfolds them.
    @Published var collapsed = false { didSet { if oldValue != collapsed { onCollapseChanged?() } } }
    var onCollapseChanged: (() -> Void)?
    /// The notch only while he talks (decided item 21, `notchTalkOnly`): agents, jobs, notices with an action and the
    /// morning card live in the stack at the top right; idle statuses, errors and plain notices go to the orb.
    @Published var talkOnly = false
    /// A consent card opens the notch (off by default: the stack has it).
    var consentInNotch = false
    /// When the typed or muted answer on show landed, for its reading time.
    var answerShownAt: Date?
    /// Drawn by `Dot --snapshot`: ImageRenderer leaves a ScrollView's content blank, so the answer is plain text there.
    var snapshot = false

    var hasContent: Bool {
        if talkOnly {
            return NotchSurface.showsPanel(phase: surfacePhase, showInput: showInput, answerShownAt: answer == nil ? nil : answerShownAt,
                                           answerCharacters: answer?.count ?? 0, consentOpen: consent != nil, consentInNotch: consentInNotch,
                                           liveExchange: agents.contains(where: \.isLiveExchange), now: Date())
        }
        return phase != .hidden || (!notchAgents.isEmpty && !collapsed) || consent != nil || showInput || status != nil || error != nil || answer != nil
            || !notices.isEmpty || morning != nil
    }

    var surfacePhase: NotchSurface.Phase {
        switch phase {
        case .hidden: return .hidden
        case .listening: return .listening
        case .transcribing: return .transcribing
        case .thinking: return .thinking
        case .speaking: return .speaking
        case .done: return .done
        }
    }

    /// The rows the notch itself draws.
    var notchAgents: [AgentRow] { talkOnly ? agents.filter(\.isLiveExchange) : agents.filter { $0.kind != .job } }
    var foldedTasks: [AgentRow] { collapsed && !talkOnly ? notchAgents : [] }

    var showsPanel: Bool { hasContent || presence }
}

/// The black panel hanging from the notch: state, what he said, what Dot answered,
/// agent progress, the consent card, and a text field for typed questions.
@MainActor
final class NotchHUD {
    let model = HUDModel()
    private var panel: NSPanel?
    private var statusWork: DispatchWorkItem?
    private var noticeWork: [String: DispatchWorkItem] = [:]
    private var glowWork: DispatchWorkItem?
    private var visible = false
    private var contentSize: CGSize = .zero
    private var shrinkWork: DispatchWorkItem?
    private var sizeSink: AnyCancellable?
    private var mouseMonitors: [Any] = []
    /// Dot's menu, the one the ● in the menu bar opens. A right-click (or control-click) on the notch opens it too,
    /// so a menu bar too full to show the ● still leaves the menu a click away (his ask, 2026-10-17).
    var menu: NSMenu?
    /// Called when the notch starts or stops holding the menu (notch presence, a screen change).
    var onHoldsMenuChanged: (() -> Void)?
    /// Whether a right-click on the notch reaches the menu: the resting tab is up on a notched screen.
    var holdsMenu: Bool { model.presence && NotchSurface.holdsMenu(hasNotch: currentGeometry().hasNotch) }

    /// The stack at the top right (04): agents, jobs, consent cards, notices with an action and the morning card go
    /// there when the notch is for talking only. AppDelegate owns it.
    private(set) var stack: AgentStack?
    /// The orb's bubble (overlay.greet): idle statuses, errors and plain notices go there when the notch is for talking only.
    var onGreet: ((String, TimeInterval) -> Void)?
    /// The notch presence his config asks for; on a screen with no notch the talk-only notch has none (NotchSurface.presence).
    private var configuredPresence = false

    init() {
        model.onCollapseChanged = { [weak self] in self?.refreshVisibility() }
        observeContentSize()
    }

    init(accentHex: String) {
        if let color = Color(hex: accentHex) { model.accent = color }
        // Only init() wired this before 04, and AppDelegate uses this one: a fold left an empty "N tasks" panel up.
        model.onCollapseChanged = { [weak self] in self?.refreshVisibility() }
        observeContentSize()
        watchMouse()
        watchRightClicks()
        NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.reposition()
                // A notch screen plugged in or out: the talk-only resting tab comes or goes with it.
                if self.model.talkOnly { self.model.presence = NotchSurface.presence(configured: self.configuredPresence, hasNotch: self.currentGeometry().hasNotch, talkOnly: true) }
                self.refreshVisibility()
                self.onHoldsMenuChanged?()
            }
        }
        model.onOpenAgent = nil
        NotificationCenter.default.addObserver(forName: .dotShowInput, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.showInput() }
        }
        NotificationCenter.default.addObserver(forName: .dotDismissAnswer, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.dismissAnswer() }
        }
        NotificationCenter.default.addObserver(forName: .dotDismissNotice, object: nil, queue: .main) { [weak self] note in
            guard let id = note.object as? String else { return }
            Task { @MainActor in self?.dismissNotice(id: id) }
        }
    }

    /// Whether the notch shows up in recordings and screen shares.
    func setVisibleInRecordings(_ visible: Bool) {
        ensurePanel().sharingType = visible ? .readOnly : .none
    }

    /// 04: the notch only while talking (`notchTalkOnly`), and where consent cards go (`consentInNotch`).
    func configure(talkOnly: Bool, consentInNotch: Bool) {
        model.talkOnly = talkOnly
        model.consentInNotch = consentInNotch
        model.presence = NotchSurface.presence(configured: configuredPresence, hasNotch: currentGeometry().hasNotch, talkOnly: talkOnly)
        if talkOnly { model.collapsed = false; model.hovering = false }
        syncConsent()
        for row in model.agents where row.isStackBound && talkOnly { stack?.upsert(row.stackChip) }
        refreshVisibility()
        onHoldsMenuChanged?()
    }

    /// The stack takes the agent rows, the consent card, notices with an action and the morning card.
    func attach(stack: AgentStack) {
        self.stack = stack
        stack.rowGone = { [weak self] id in
            // The policy cleared a finished chip: its row leaves too (results stay in Home).
            guard let self, let row = self.model.agents.first(where: { $0.id == id }), row.isStackBound,
                  row.state != .running, row.state != .waiting else { return }
            self.removeAgent(id: id)
        }
        stack.rowDismissed = { [weak self] id in
            guard let self else { return }
            if id == "morning" { self.model.onMorningDismiss?(); return }
            if id.hasPrefix("notice-") { self.dismissNotice(id: String(id.dropFirst(7))); return }
            if self.model.agents.contains(where: { $0.id == id }) { self.removeAgent(id: id) }
        }
        stack.model.onMorningDecision = { [weak self] item, yes in self?.model.onMorningDecision?(item, yes) }
        stack.model.onFocusConsent = { [weak self] id in MainActor.assumeIsolated { self?.bringConsentForward(agent: id) } }
        stack.model.onMorningDismiss = { [weak self] in self?.model.onMorningDismiss?() }
    }

    /// Whether the notch's panel is up right now (talking, the typed field, an answer in its reading time).
    var panelShowing: Bool { model.hasContent }

    /// A new accent from Settings, applied live.
    func setAccent(hex: String) {
        if let color = Color(hex: hex) { model.accent = color }
    }

    // MARK: State

    func set(phase: HUDModel.Phase) {
        model.phase = phase
        if phase == .hidden {
            model.showInput = false
            model.transcript = ""
            model.response = ""
            model.caption = nil
            model.deeper = false
        }
        refreshVisibility()
    }

    /// The line being spoken, shown under the header while the voice plays.
    func setCaption(_ text: String?) {
        model.caption = text
        refreshVisibility()
    }

    private var answerWork: DispatchWorkItem?

    /// A typed or muted answer. With the notch for talking only it stays for its reading time (8 s, or 60 ms a
    /// character), longer while the pointer is on it; before 04 it stayed until he closed it or asked again.
    func presentAnswer(question: String, text: String) {
        model.answerQuestion = question
        model.answer = text
        model.answerShownAt = Date()
        model.caption = nil
        refreshVisibility()
        answerWork?.cancel()
        guard model.talkOnly else { return }
        scheduleAnswerClose(after: NotchSurface.readingTime(characters: text.count))
    }

    private func scheduleAnswerClose(after seconds: TimeInterval) {
        let work = DispatchWorkItem { [weak self] in
            guard let self, self.model.answer != nil else { return }
            if let panel = self.panel, panel.isVisible, panel.frame.contains(NSEvent.mouseLocation) {
                self.scheduleAnswerClose(after: 1)   // he is reading it
                return
            }
            self.dismissAnswer()
        }
        answerWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
    }

    func dismissAnswer() {
        answerWork?.cancel()
        guard model.answer != nil else { return }
        model.answer = nil
        model.answerQuestion = ""
        model.answerShownAt = nil
        refreshVisibility()
    }

    func flash(status: String, for seconds: TimeInterval = 2.5) {
        // Talk-only notch, not talking: the orb's bubble says it, and the notch stays empty.
        if model.talkOnly, !model.hasContent, let onGreet {
            onGreet(status, max(seconds, 2.5))
            return
        }
        model.status = status
        refreshVisibility()
        statusWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            self?.model.status = nil
            self?.refreshVisibility()
        }
        statusWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
    }

    func flash(error: String) {
        Log.error(error)
        if model.talkOnly, !model.hasContent, let onGreet {
            onGreet(error, 6)
            return
        }
        model.error = error
        refreshVisibility()
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in
            if self?.model.error == error { self?.model.error = nil; self?.refreshVisibility() }
        }
    }

    // MARK: Notices

    /// Show a typed notice; one with the same id replaces the old one and restarts its clock. With the notch for
    /// talking only, a notice with an action is a card in the stack, and a plain one shows in the notch while he
    /// talks, else as the orb's bubble.
    func notify(_ notice: NotchNotice) {
        if model.talkOnly, let stack {
            if notice.actionTitle != nil || notice.secondaryTitle != nil {
                var chip = StackChip(id: "notice-\(notice.id)", kind: .notice, title: notice.title, line: notice.detail ?? "", state: .notice)
                chip.icon = notice.icon
                chip.tone = notice.tone
                chip.detail = notice.detail
                chip.actionTitle = notice.actionTitle
                chip.action = notice.action
                chip.secondaryTitle = notice.secondaryTitle
                chip.secondary = notice.secondary
                stack.upsert(chip)
                noticeWork[notice.id]?.cancel()
                if notice.seconds > 0 {
                    let work = DispatchWorkItem { [weak self] in self?.dismissNotice(id: notice.id) }
                    noticeWork[notice.id] = work
                    DispatchQueue.main.asyncAfter(deadline: .now() + notice.seconds, execute: work)
                }
                Log.info("notice: \(notice.id) to the stack: \(Log.short(notice.title, 80))")
                return
            }
            if !model.hasContent, let onGreet {
                onGreet(notice.detail.map { "\(notice.title). \($0)" } ?? notice.title, notice.seconds > 0 ? notice.seconds : 8)
                return
            }
        }
        if let index = model.notices.firstIndex(where: { $0.id == notice.id }) {
            model.notices[index] = notice
        } else {
            model.notices.append(notice)
            if model.notices.count > 3 { model.notices.removeFirst(model.notices.count - 3) }
        }
        noticeWork[notice.id]?.cancel()
        if notice.seconds > 0 {
            let work = DispatchWorkItem { [weak self] in self?.dismissNotice(id: notice.id) }
            noticeWork[notice.id] = work
            DispatchQueue.main.asyncAfter(deadline: .now() + notice.seconds, execute: work)
        }
        pulseGlow()
        refreshVisibility()
    }

    func dismissNotice(id: String) {
        noticeWork[id]?.cancel()
        noticeWork[id] = nil
        stack?.remove(id: "notice-\(id)")
        guard model.notices.contains(where: { $0.id == id }) else { return }
        withAnimation(.easeOut(duration: 0.2)) { model.notices.removeAll { $0.id == id } }
        refreshVisibility()
    }

    /// The corners light up for a moment: something just landed (HeyClicky's live-event corner glow).
    func pulseGlow() {
        glowWork?.cancel()
        model.glow = true
        let work = DispatchWorkItem { [weak self] in self?.model.glow = false }
        glowWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4, execute: work)
    }

    // MARK: The morning card

    func presentMorning(_ card: MorningCard) {
        model.morning = card
        model.morningExpanded = false
        if model.talkOnly, let stack {
            // A card in the stack (decided item 21): it never opens the notch.
            stack.model.morningExpanded = false
            stack.upsert(morningChip(card))
            return
        }
        pulseGlow()
        refreshVisibility()
    }

    private func morningChip(_ card: MorningCard) -> StackChip {
        var chip = StackChip(id: "morning", kind: .notice, title: card.greeting, line: "", state: .notice)
        chip.morning = card
        return chip
    }

    func dismissMorning() {
        guard model.morning != nil else { return }
        model.morning = nil
        model.morningExpanded = false
        stack?.remove(id: "morning")
        refreshVisibility()
    }

    /// Drop one item once he decided on it; the card goes when nothing is left.
    func morningDecided(_ item: MorningCard.Item) {
        model.morning?.items.removeAll { $0.id == item.id }
        if model.morning?.items.isEmpty == true { dismissMorning(); return }
        if model.talkOnly, let card = model.morning { stack?.upsert(morningChip(card)) }
    }

    private var inputTimeout: DispatchWorkItem?

    /// `forAgent`: a shift tap opened it, so what he types goes to an agent; any other opening asks Dot.
    func showInput(forAgent: Bool = false) {
        model.inputForAgent = forAgent
        if forAgent, model.inputPrompt == nil { model.inputPrompt = "for an agent: what should it do?" }
        model.showInput = true
        model.phase = .hidden
        refreshVisibility()
        // A non-activating panel takes the keyboard without making Dot the frontmost app,
        // so the user's window keeps focus and the next screenshot still shows it active.
        panel?.makeKeyAndOrderFront(nil)
        Log.info("input: field shown\(forAgent ? " for an agent" : ""), panel key \(panel?.isKeyWindow == true)")
        if panel?.isKeyWindow != true {
            // The panel was still ordering in (seen 2026-10-15 15:35, "panel key false" twice): one more try.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { [weak self] in
                guard let self, self.model.showInput, self.panel?.isKeyWindow != true else { return }
                self.panel?.makeKeyAndOrderFront(nil)
                Log.info("input: field key retry \(self.panel?.isKeyWindow == true)")
            }
        }
        // An untouched field goes away on its own, so a stray tap does not pin the HUD open.
        inputTimeout?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self, self.model.showInput, self.model.inputText.isEmpty else { return }
            self.hideInput()
        }
        inputTimeout = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 12, execute: work)
    }

    func hideInput() {
        inputTimeout?.cancel()
        model.showInput = false
        model.inputText = ""
        if panel?.isKeyWindow == true { panel?.resignKey() }
        refreshVisibility()
    }

    /// An agent's row (and the walkthrough's, the lesson's, the lecture's). With the notch for talking only, agent
    /// and job rows are chips in the stack, whose clock runs from each row's last state change (AgentChip.since): a
    /// tool call or a streamed line never restarts it. The 20 s fold (scheduleCollapse) went in 04: it re-armed on
    /// every tool call and every streamed line, so a working agent never folded.
    func upsertAgent(_ row: AgentRow) {
        var changed = true
        if let index = model.agents.firstIndex(where: { $0.id == row.id }) {
            changed = model.agents[index].state != row.state || model.agents[index].line != row.line
            if model.agents[index].state == .running, row.state == .done || row.state == .failed { pulseGlow() }
            model.agents[index] = row
            if row.state == .running, model.expanded == row.id { model.expanded = nil }
        } else {
            model.agents.append(row)
        }
        // A job's row is the stack's whatever the notch does; an agent's too when the notch is for talking only.
        if (model.talkOnly && row.isStackBound) || row.kind == .job, let stack {
            stack.upsert(row.stackChip)
            return
        }
        // A new task or a finished one unfolds the panel.
        if changed, row.state != .running { model.collapsed = false }
        refreshVisibility()
    }

    func removeAgent(id: String) {
        model.agents.removeAll { $0.id == id }
        if model.expanded == id { model.expanded = nil }
        if model.agents.isEmpty { model.collapsed = false }
        stack?.remove(id: id)
        refreshVisibility()
    }

    func unfoldTasks() {
        model.collapsed = false
    }

    // MARK: Consent: one card per request, oldest first (round seven, F1)

    /// Before round seven a second card replaced the first and nothing ever answered the first; on
    /// 2026-10-16 that left the email agent waiting 78 minutes with no card on screen.
    private var consentQueue = ConsentQueue<ConsentCard>()

    func present(_ card: ConsentCard, chime: Bool = true) {
        let before = consentQueue.current?.id
        consentQueue.add(id: card.id, agent: card.agentId, item: card)
        syncConsent()
        // One chime when a question comes on show, not one for each queued behind it (FX-09).
        if chime, before != card.id, consentQueue.current?.id == card.id { playConsentChime() }
    }

    /// The card chime; `Dot --selftest` counts it instead of playing it.
    var playConsentChime: () -> Void = { Chimes.shared.play(.needsYou) }

    /// The card was answered (or withdrawn): it leaves, and the next question in line shows.
    func dismissConsent(id: UUID) {
        consentQueue.remove(id: id)
        syncConsent()
    }

    /// The agent stopped or its session ended: its questions leave with it. Returns how many.
    @discardableResult
    func withdrawConsent(agent: String) -> Int {
        let gone = consentQueue.removeAll(agent: agent)
        if !gone.isEmpty { syncConsent() }
        for entry in gone { entry.item.onWithdraw?() }
        return gone.count
    }

    func bringConsentForward(agent: String) {
        if consentQueue.bringForward(agent: agent) { syncConsent() }
    }

    /// The card on show, for an answer by voice.
    var currentConsent: ConsentCard? { consentQueue.current?.item }

    func hasConsent(agent: String) -> Bool { consentQueue.isWaiting(agent: agent) }

    /// How many questions are open, and from whom (for "what do i need to do").
    var openConsents: [ConsentCard] { consentQueue.entries.map(\.item) }

    /// A card came on show (first in line, or next after an answer): the place to announce it, so a
    /// spoken answer goes to the card he just heard about.
    var onConsentShown: ((ConsentCard) -> Void)?

    private func syncConsent() {
        let shown = consentQueue.current?.item
        let changed = shown?.id != model.consent?.id
        model.consent = shown
        model.consentWaiting = consentQueue.waitingBehind
        if changed, let shown {
            model.consentShownAt = Date()
            onConsentShown?(shown)
        }
        // Consent cards go to the stack unless consentInNotch (04, I F26).
        if model.talkOnly, !model.consentInNotch { stack?.setConsent(shown, waiting: model.consentWaiting, shownAt: model.consentShownAt) }
        else { stack?.setConsent(nil, waiting: 0, shownAt: .distantPast) }
        refreshVisibility()
    }

    /// When the card on show came on show.
    var consentShownAt: Date? { model.consent == nil ? nil : model.consentShownAt }

    /// Escape, HeyClicky's way (1.0.50): the cards under the notch go away, and every card in the stack folds
    /// into its avatar (a finished one goes). A consent card and a paused job stay, since they need a choice.
    func escapeDismiss() {
        for notice in model.notices { dismissNotice(id: notice.id) }
        if model.morning != nil { dismissMorning() }
        model.expanded = nil
        if model.talkOnly {
            stack?.foldAll()
        } else if !model.agents.isEmpty, model.agents.allSatisfy({ $0.state != .waiting }) {
            model.collapsed = true
        }
        refreshVisibility()
    }

    // MARK: Panel

    private func ensurePanel() -> NSPanel {
        if let panel { return panel }
        let panel = KeyablePanel(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        panel.isFloatingPanel = true
        panel.level = .statusBar   // set after isFloatingPanel, which would reset it to .floating
        panel.becomesKeyOnlyIfNeeded = false
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.acceptsMouseMovedEvents = true   // so the local monitor sees the mouse leave the stem for the band beside it
        panel.contentView = NSHostingView(rootView: NotchHUDView(model: model, geometry: currentGeometry(), onClose: { [weak self] in
            self?.hideInput()
            self?.dismissAnswer()
            self?.set(phase: .hidden)
        }))
        self.panel = panel
        reposition()
        return panel
    }

    private func currentGeometry() -> NotchGeometry {
        let notched = NSScreen.screens.first(where: { $0.safeAreaInsets.top > 0 })
        let screen = notched ?? NSScreen.main ?? NSScreen.screens.first
        guard let screen else {
            return NotchGeometry(centerX: 400, topY: 800, notchWidth: 215, notchHeight: 0, hasNotch: false)
        }
        return NotchGeometry.measure(frame: screen.frame, safeAreaTop: screen.safeAreaInsets.top,
                                     auxLeft: screen.auxiliaryTopLeftArea, auxRight: screen.auxiliaryTopRightArea)
    }

    /// The canvas height the snapshot harness renders into; the live window is sized to its drawing.
    static let tallPanelHeight: CGFloat = 620

    private func reposition() {
        guard let panel else { return }
        let geometry = currentGeometry()
        shrinkWork?.cancel()
        panel.setFrame(geometry.frame(fitting: contentSize == .zero ? geometry.compactSize : contentSize), display: true)
        if let hosting = panel.contentView as? NSHostingView<NotchHUDView> {
            hosting.rootView = NotchHUDView(model: model, geometry: geometry, onClose: { [weak self] in
                self?.hideInput()
                self?.dismissAnswer()
                self?.set(phase: .hidden)
            })
        }
    }

    // MARK: Fit the window to its drawing

    private func observeContentSize() {
        sizeSink = model.$contentSize
            .removeDuplicates()
            .receive(on: RunLoop.main)
            .sink { [weak self] size in self?.fit(to: size) }
    }

    /// The window hugs what is drawn, the way HeyClicky's notch window moves between its compact,
    /// hover and expanded geometries. It grows at once, so nothing is clipped, and shrinks a moment
    /// later, so a view on its way out is not cut off. Anything beyond the drawing would take the
    /// clicks meant for the tabs and toolbars under it.
    private func fit(to size: CGSize) {
        guard size.width > 0, size.height > 0 else { return }
        contentSize = size
        guard let panel else { return }
        let geometry = currentGeometry()
        let target = geometry.frame(fitting: size)
        let current = panel.frame
        shrinkWork?.cancel()
        let roomy = geometry.frame(fitting: CGSize(width: max(target.width, current.width), height: max(target.height, current.height)))
        if roomy != current { panel.setFrame(roomy, display: true) }
        updateMousePassThrough()
        guard target != roomy else { return }
        let work = DispatchWorkItem { [weak self] in
            guard let self, let panel = self.panel else { return }
            panel.setFrame(self.currentGeometry().frame(fitting: self.contentSize), display: true)
        }
        shrinkWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35, execute: work)
    }

    /// The idle tab draws only a notch-wide stem through the menu bar, but its window spans the whole tab,
    /// and this window takes the clicks under its clear parts too (the old 620 x 620 panel took every click
    /// under it, round six). So in the menu bar band beside the stem, the window lets the mouse through to
    /// the status items there.
    private func watchMouse() {
        let check: (NSEvent) -> Void = { [weak self] _ in MainActor.assumeIsolated { self?.updateMousePassThrough() } }
        if let global = NSEvent.addGlobalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged], handler: check) {
            mouseMonitors.append(global)
        }
        if let local = NSEvent.addLocalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged], handler: { check($0); return $0 }) {
            mouseMonitors.append(local)
        }
    }

    private func updateMousePassThrough() {
        guard let panel, panel.isVisible else { return }
        let geometry = currentGeometry()
        let idle = !model.hasContent && model.presence
        let through = idle && NotchGeometry.passesThrough(NSEvent.mouseLocation, geometry: geometry)
        if panel.ignoresMouseEvents != through { panel.ignoresMouseEvents = through }
    }

    private func watchRightClicks() {
        let monitor = NSEvent.addLocalMonitorForEvents(matching: [.rightMouseDown, .leftMouseDown]) { [weak self] event in
            let opened = MainActor.assumeIsolated { self?.openMenu(for: event) ?? false }
            return opened ? nil : event
        }
        if let monitor { mouseMonitors.append(monitor) }
    }

    /// A right-click or control-click on the notch, or anywhere on the idle tab and its hover peek, opens Dot's menu
    /// at the pointer. On a card hanging below, the click stays the card's.
    private func openMenu(for event: NSEvent) -> Bool {
        guard let menu, let panel, event.window === panel, let view = panel.contentView else { return false }
        guard event.type == .rightMouseDown || event.modifierFlags.contains(.control) else { return false }
        let point = panel.convertPoint(toScreen: event.locationInWindow)
        guard !model.hasContent || NotchGeometry.onNotch(point, geometry: currentGeometry()) else { return false }
        NSMenu.popUpContextMenu(menu, with: event, for: view)
        return true
    }

    func setPresence(_ on: Bool) {
        configuredPresence = on
        model.presence = NotchSurface.presence(configured: on, hasNotch: currentGeometry().hasNotch, talkOnly: model.talkOnly)
        refreshVisibility()
        onHoldsMenuChanged?()
    }

    private func refreshVisibility() {
        let panel = ensurePanel()
        if model.showsPanel {
            if !visible {
                visible = true
                panel.alphaValue = 0
                panel.orderFrontRegardless()
                NSAnimationContext.runAnimationGroup { ctx in
                    ctx.duration = 0.2
                    panel.animator().alphaValue = 1
                }
            }
        } else if visible {
            visible = false
            NSAnimationContext.runAnimationGroup({ ctx in
                ctx.duration = 0.25
                panel.animator().alphaValue = 0
            }, completionHandler: { [weak self] in
                if self?.visible == false { panel.orderOut(nil) }
            })
        }
    }
}

// MARK: - View

/// The notch's palette, shared by the strip, the panel and the cards.
/// The notch's colors, from the same study look the cards wear (IF-01), so his token file
/// recolors both.
enum NotchInk {
    static var ground: Color { Theme.color(Theme.look.background) }
    static var text: Color { Theme.color(Theme.look.paper) }
    static var good: Color { Theme.color(Theme.look.color("green") ?? StyleTokens.RGBA(red: 0.55, green: 0.86, blue: 0.62)) }
    static var warn: Color { Theme.color(Theme.look.color("yellow") ?? StyleTokens.RGBA(red: 1.0, green: 0.8, blue: 0.36)) }
    static var red: Color { Theme.color(Theme.look.color("down") ?? StyleTokens.RGBA(red: 0.95, green: 0.3, blue: 0.28)) }
}

struct NotchHUDView: View {
    @ObservedObject var model: HUDModel
    let geometry: NotchGeometry
    let onClose: () -> Void
    @FocusState private var inputFocused: Bool

    private let ground = NotchInk.ground
    private let text = NotchInk.text

    var body: some View {
        Group {
            if !model.hasContent && model.presence {
                idleStrip
            } else {
                panel
            }
        }
        // Measured so the window can be sized to the drawing and nothing more (see NotchHUD.fit).
        .background(GeometryReader { proxy in
            Color.clear.preference(key: NotchContentSizeKey.self, value: proxy.size)
        })
        .onPreferenceChange(NotchContentSizeKey.self) { size in model.contentSize = size }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    // MARK: The idle tab

    /// Nothing to show and not hovered: Dot is the notch itself.
    private var resting: Bool {
        !model.hovering && model.foldedTasks.isEmpty && idleLine == nil
    }

    /// The quiet line on the idle tab. With the notch for talking only, only Murmur's recording line is left: the
    /// lecture ear is a chip in the stack and the meeting line went (decided item 21).
    private var idleLine: String? {
        model.talkOnly ? model.recordingLine : (model.recordingLine ?? model.listeningLine ?? model.meetingLine)
    }

    /// Dot's idle presence, after HeyClicky's resting notch (measured 2026-10-17): at rest exactly the notch,
    /// nothing beside it and nothing below it, so the status items either side stay uncovered. Anything it
    /// shows (a task, a meeting line, the hover peek) hangs below the menu bar from a notch-wide stem
    /// (`NotchSilhouette`). Hover the notch for "open dot"; click to type; right-click for Dot's menu.
    private var idleStrip: some View {
        let shape = NotchSilhouetteShape(stem: geometry.hasNotch ? geometry.notchWidth : 0, band: geometry.notchHeight)
        return VStack(spacing: 0) {
            VStack(spacing: 4) {
                Color.clear.frame(height: resting ? geometry.compactSize.height : geometry.notchHeight + 2)
                if resting {
                    EmptyView()
                } else if model.hovering {
                    hoverPeek
                } else if !model.foldedTasks.isEmpty {
                    HStack(spacing: 8) {
                        ForEach(model.foldedTasks.prefix(3)) { row in taskPill(row) }
                    }
                    .padding(.horizontal, 12).padding(.bottom, 6)
                } else if let line = idleLine {
                    // Murmur recording, the ear on, or a meeting close: a quiet line on the tab (one notch for both apps).
                    HStack(spacing: 6) {
                        if model.recordingLine != nil {
                            BreathingDot(color: NotchInk.red)
                        } else if model.listeningLine != nil {
                            BreathingDot(color: model.accent)
                        } else {
                            Image(systemName: "calendar").font(.system(size: 9.5)).foregroundStyle(model.accent)
                        }
                        Text(line).font(.system(size: 10.5, weight: .medium)).foregroundStyle(text.opacity(0.8)).lineLimit(1)
                            .monospacedDigit()
                    }
                    .padding(.horizontal, 12).padding(.bottom, 5)
                }
            }
            .frame(width: idleWidth, alignment: .center)
            .background(ground, in: shape)
            .overlay(shape.stroke(model.accent.opacity(model.glow ? 0.95 : 0), lineWidth: 2).blur(radius: 3)
                .animation(.easeOut(duration: model.glow ? 0.2 : 0.9), value: model.glow).allowsHitTesting(false))
            .contentShape(shape)
            // No hover peek when the notch is for talking only.
            .onHover { inside in if !model.talkOnly || !inside { withAnimation(.easeOut(duration: 0.15)) { model.hovering = inside && !model.talkOnly } } }
            .onTapGesture {
                if !model.foldedTasks.isEmpty { model.collapsed = false } else { NotificationCenter.default.post(name: .dotShowInput, object: nil) }
            }
        }
    }

    private var idleWidth: CGFloat {
        if model.hovering { return geometry.notchWidth }
        if !model.foldedTasks.isEmpty { return min(geometry.notchWidth + 80 + CGFloat(min(model.foldedTasks.count, 3)) * 150, 560) }
        return idleLine == nil ? geometry.compactSize.width : geometry.notchWidth + 120
    }

    /// The hover peek: one way in, to the Dot window. The day line, the agents' file tiles and the hints went
    /// (his verdict 2026-10-18: "it looks bad... just give me the option to open dot").
    private var hoverPeek: some View {
        Button { NotificationCenter.default.post(name: .dotOpenHome, object: nil) } label: {
            HStack(spacing: 5) {
                Image(systemName: "rectangle.grid.2x2").font(.system(size: 10.5)).foregroundStyle(model.accent)
                Text("open dot").font(.system(size: 11, weight: .medium)).foregroundStyle(text.opacity(0.85))
            }
            .padding(.horizontal, 12).padding(.vertical, 5)
            .background(Color.white.opacity(0.08), in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .padding(.bottom, 8)
    }

    static func symbol(forFile url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "pdf": return "doc.richtext"
        case "md", "txt": return "doc.text"
        case "xlsx", "csv", "numbers": return "tablecells"
        case "pptx", "key": return "rectangle.on.rectangle"
        case "png", "jpg", "jpeg", "gif", "heic": return "photo"
        case "docx", "doc", "pages": return "doc"
        case "html", "htm": return "globe"
        default: return "doc"
        }
    }

    // MARK: The panel

    private var panel: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                // Keep the notch itself black so the panel reads as one shape with it.
                Color.clear.frame(height: max(geometry.notchHeight - 6, 0))
                header
                if let error = model.error {
                    Text(error).font(.system(size: 12)).foregroundStyle(Color(red: 1, green: 0.5, blue: 0.4)).lineLimit(3)
                }
                if let recording = model.recordingLine {
                    HStack(spacing: 6) {
                        BreathingDot(color: NotchInk.red)
                        Text(recording).font(.system(size: 11.5, weight: .medium)).foregroundStyle(text.opacity(0.75)).monospacedDigit()
                    }
                }
                if !model.transcript.isEmpty, model.answer == nil {
                    Text(model.transcript).font(.system(size: 12.5)).foregroundStyle(text.opacity(0.55)).lineLimit(2)
                }
                if let caption = model.caption, !caption.isEmpty, model.answer == nil {
                    Text(caption).font(.system(size: 13.5)).foregroundStyle(text.opacity(0.92)).lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)
                        .transition(.opacity)
                        .animation(.easeOut(duration: 0.15), value: caption)
                }
                if let answer = model.answer { answerBlock(answer) }
                if !model.response.isEmpty, model.answer == nil {
                    Text(model.response).font(.system(size: 14)).foregroundStyle(text).lineLimit(6)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if model.showInput {
                    inputField
                    if let today = model.todayLine, !today.isEmpty {
                        Text(today).font(.system(size: 11.5)).foregroundStyle(text.opacity(0.5)).lineLimit(2)
                    }
                }
                ForEach(model.notices.suffix(2)) { notice in NoticeCard(notice: notice, accent: model.accent) { NotificationCenter.default.post(name: .dotDismissNotice, object: notice.id) } }
                if let morning = model.morning, !model.talkOnly { MorningCardView(card: morning, expanded: $model.morningExpanded, accent: model.accent,
                                                                  decide: { item, yes in model.onMorningDecision?(item, yes) },
                                                                  dismiss: { model.onMorningDismiss?() }) }
                if let card = model.consent, !model.talkOnly || model.consentInNotch { consent(card) }
                ForEach(model.notchAgents) { row in agentCard(row) }
                if let status = model.status, model.phase == .hidden || model.response.isEmpty {
                    Text(status).font(.system(size: 12)).foregroundStyle(text.opacity(0.6))
                }
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 14)
            .frame(width: min(NotchGeometry.panelWidth - 40, max(geometry.notchWidth + 220, 440)), alignment: .leading)
            .background(ground, in: UnevenRoundedRectangle(cornerRadii: .init(topLeading: 0, bottomLeading: 22, bottomTrailing: 22, topTrailing: 0)))
            .overlay(UnevenRoundedRectangle(cornerRadii: .init(topLeading: 0, bottomLeading: 22, bottomTrailing: 22, topTrailing: 0))
                .stroke(Color.white.opacity(0.08), lineWidth: 1))
            .overlay(cornerGlow(radius: 22))
        }
    }

    /// The idle tab's outline: the notch-wide stem through the menu bar, the rest below it.
    struct NotchSilhouetteShape: Shape {
        let stem: CGFloat
        let band: CGFloat
        func path(in rect: CGRect) -> Path { Path(NotchSilhouette.path(in: rect, stemWidth: stem > 0 ? stem : rect.width, bandHeight: band)) }
    }

    /// The accent runs along the bottom edge for a moment when something lands.
    private func cornerGlow(radius: CGFloat) -> some View {
        UnevenRoundedRectangle(cornerRadii: .init(topLeading: 0, bottomLeading: radius, bottomTrailing: radius, topTrailing: 0))
            .stroke(model.accent.opacity(model.glow ? 0.95 : 0), lineWidth: 2)
            .blur(radius: 3)
            .animation(.easeOut(duration: model.glow ? 0.2 : 0.9), value: model.glow)
            .allowsHitTesting(false)
    }

    /// The readable answer to a typed question: the question in small type, the answer with room
    /// to scroll, copy and close. It stays until he closes it, asks again, or presses escape.
    private func answerBlock(_ answer: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if !model.answerQuestion.isEmpty {
                Text(model.answerQuestion).font(.system(size: 12)).foregroundStyle(text.opacity(0.5)).lineLimit(2)
            }
            if model.snapshot {
                Text(answer).font(.system(size: 13.5)).foregroundStyle(text.opacity(0.95)).lineSpacing(3)
                    .frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true)
            } else {
                ScrollView {
                    Text(answer)
                        .font(.system(size: 13.5))
                        .foregroundStyle(text.opacity(0.95))
                        .lineSpacing(3)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 300)
            }
            HStack(spacing: 8) {
                smallButton("copy") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(answer, forType: .string)
                }
                smallButton("ask again") { NotificationCenter.default.post(name: .dotShowInput, object: nil) }
                Spacer()
                smallButton("close") { NotificationCenter.default.post(name: .dotDismissAnswer, object: nil) }
            }
        }
        .padding(.top, 2)
    }

    // MARK: Header: the state in a word and the voice as bars

    private var header: some View {
        HStack(spacing: 10) {
            Circle().fill(model.accent).frame(width: 9, height: 9)
                .shadow(color: model.accent.opacity(0.8), radius: 4)
                .scaleEffect(model.phase == .listening ? 1 + CGFloat(model.level) * 0.9 : 1)
                .animation(.easeOut(duration: 0.1), value: model.level)
            Text(headerText).font(.system(size: 12, weight: .medium)).foregroundStyle(text.opacity(0.8))
                .contentTransition(.opacity)
                .animation(.easeOut(duration: 0.15), value: headerText)
            Spacer()
            if model.phase == .listening || model.phase == .speaking || model.phase == .thinking || model.phase == .transcribing {
                VoiceBars(phase: model.phase, level: model.level, color: model.accent)
            }
            if model.showInput || model.answer != nil {
                Button(action: onClose) { Image(systemName: "xmark").font(.system(size: 10, weight: .bold)) }
                    .buttonStyle(.plain).foregroundStyle(text.opacity(0.5))
            }
        }
    }

    private var headerText: String {
        switch model.phase {
        case .hidden:
            if model.answer != nil { return "dot" }
            if model.morning != nil, !model.talkOnly, model.agents.isEmpty, !model.showInput { return "this morning" }
            let rows = model.notchAgents
            return model.showInput ? "ask dot" : (rows.isEmpty ? (model.modeWord ?? "dot") : (rows.count == 1 ? "one task" : "\(rows.count) tasks"))
        case .listening: return model.mode == .agent ? "listening, for an agent" : (model.mode == .dictate ? "dictating" : "listening")
        case .transcribing: return "hearing you"
        case .thinking: return model.deeper ? "thinking deeper" : "thinking"
        case .speaking: return "speaking"
        case .done: return "dot"
        }
    }

    private var inputField: some View {
        HStack {
            TextField(model.inputPrompt ?? "type a question about your screen", text: $model.inputText)
                .textFieldStyle(.plain)
                .font(.system(size: 14))
                .foregroundStyle(text)
                .focused($inputFocused)
                .onAppear {
                    // The panel becomes key first; the field takes the cursor a beat later.
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) { inputFocused = true }
                }
                .onExitCommand {
                    model.inputText = ""
                    onClose()
                }
                .onSubmit {
                    let value = model.inputText
                    model.inputText = ""
                    model.showInput = false
                    model.inputPrompt = nil
                    let forAgent = model.inputForAgent
                    model.inputForAgent = false
                    model.onSubmitInput?(value, forAgent)
                }
            Text("return").font(.system(size: 10)).foregroundStyle(text.opacity(0.35))
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 10))
    }

    /// A tap that lands in a card's first half second was meant for the card before it.
    private func settled(_ action: @escaping () -> Void) {
        guard Date().timeIntervalSince(model.consentShownAt) >= 0.5 else { return }
        action()
    }

    private func consent(_ card: ConsentCard) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(card.agent) wants to \(card.title)").font(.system(size: 13, weight: .semibold)).foregroundStyle(text)
                Spacer(minLength: 4)
                if model.consentWaiting > 0 {
                    Text("+\(model.consentWaiting) waiting").font(.system(size: 10.5, weight: .semibold)).foregroundStyle(NotchInk.warn)
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(NotchInk.warn.opacity(0.14), in: Capsule())
                }
            }
            if !card.detail.isEmpty {
                Text(card.detail).font(.system(size: 12, design: .monospaced)).foregroundStyle(text.opacity(0.65)).lineLimit(3)
            }
            HStack(spacing: 8) {
                GelButton(title: "Allow", accent: model.accent, primary: true, action: { settled(card.onAllow) })
                if let always = card.onAlways { GelButton(title: "Allow for this task", accent: model.accent, primary: false, action: { settled(always) }) }
                GelButton(title: "Not now", accent: model.accent, primary: false, action: { settled(card.onDeny) })
            }
        }
        .padding(12)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(model.accent.opacity(0.6), lineWidth: 1))
    }

    // MARK: Agent cards, after HeyClicky's Agent HUD: avatar, name and state, the live line, stop and open

    private func agentCard(_ row: AgentRow) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                AgentAvatar(row: row, accent: model.accent)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(row.name).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(text)
                        // The state word as a tinted chip: fill, edge and text from one color (VI-05).
                        let tone = Self.stateColor(row, accent: model.accent)
                        Text(Self.stateWord(row)).font(.system(size: 11, weight: .medium)).foregroundStyle(tone)
                            .padding(.horizontal, 7).padding(.vertical, 1.5)
                            .background(Capsule().fill(tone.opacity(0.14)))
                            .overlay(Capsule().strokeBorder(tone.opacity(0.35), lineWidth: 0.5))
                        if row.state == .running {
                            Text(Self.elapsed(since: row.startedAt)).font(.system(size: 10.5, design: .monospaced)).foregroundStyle(text.opacity(0.4))
                        }
                    }
                    if model.expanded != row.id {
                        LiveLine(text: row.line, pulsing: row.state == .running, color: text.opacity(0.68))
                    }
                    if row.state == .running, !row.steps.isEmpty, model.expanded != row.id {
                        ForEach(Array(row.steps.suffix(3).enumerated()), id: \.offset) { _, step in
                            Text(step).font(.system(size: 11)).foregroundStyle(text.opacity(0.42)).lineLimit(1)
                        }
                    }
                }
                Spacer(minLength: 6)
                VStack(alignment: .trailing, spacing: 6) {
                    HStack(spacing: 6) {
                        if row.state == .running, row.canStop {
                            GelButton(title: "stop", accent: model.accent, primary: false) { model.onStopAgent?(row.id) }
                        }
                        if row.kind == .agent {
                            GelButton(title: "open", accent: model.accent, primary: row.state != .running) { model.onOpenHome?(row.id) }
                        }
                        if row.state == .done || row.state == .failed {
                            Button { model.onDismissAgent?(row.id) } label: { Image(systemName: "xmark").font(.system(size: 9, weight: .bold)) }
                                .buttonStyle(.plain).foregroundStyle(text.opacity(0.4))
                        }
                    }
                    if row.result != nil {
                        Image(systemName: model.expanded == row.id ? "chevron.up" : "chevron.down")
                            .font(.system(size: 10, weight: .bold)).foregroundStyle(text.opacity(0.5))
                    }
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                if row.state == .waiting { model.onFocusConsent?(row.id); return }
                guard row.result != nil else { return }
                withAnimation(.easeOut(duration: 0.18)) { model.expanded = model.expanded == row.id ? nil : row.id }
            }
            if model.expanded == row.id, let result = row.result {
                resultCard(row, result: result)
            }
        }
        .padding(10)
        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.white.opacity(0.06), lineWidth: 1))
    }

    static func stateWord(_ row: AgentRow) -> String {
        switch row.state {
        case .running: return row.kind == .walkthrough ? "step by step" : (row.kind == .lesson ? "on the board" : "working")
        case .waiting: return "needs you"
        case .done: return "done"
        case .failed: return row.line.hasPrefix("interrupted") ? "interrupted" : "failed"
        }
    }

    static func stateColor(_ row: AgentRow, accent: Color) -> Color {
        switch row.state {
        case .running: return accent
        case .waiting: return NotchInk.warn
        case .done: return NotchInk.good
        case .failed: return row.line.hasPrefix("interrupted") ? NotchInk.warn : NotchInk.red
        }
    }

    private func resultCard(_ row: AgentRow, result: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ScrollView {
                Text(result)
                    .font(.system(size: 12.5))
                    .foregroundStyle(text.opacity(0.9))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxHeight: 220)
            ForEach(row.outputs.prefix(4), id: \.self) { url in
                HStack(spacing: 6) {
                    Image(systemName: Self.symbol(forFile: url)).font(.system(size: 10)).foregroundStyle(Theme.fileColor(url) ?? model.accent)
                    Text(url.lastPathComponent).font(.system(size: 11.5)).foregroundStyle(text.opacity(0.85)).lineLimit(1)
                    Spacer()
                    smallButton("open") { NSWorkspace.shared.open(url) }
                }
                .onDrag { NSItemProvider(object: url as NSURL) }
            }
            HStack(spacing: 8) {
                smallButton("copy") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(result, forType: .string)
                }
                if row.outputCount > 0 {
                    smallButton("output folder") { model.onOpenAgent?(row.id) }
                }
                Spacer()
            }
            if !row.nextActions.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(row.nextActions.prefix(4), id: \.self) { next in
                        Button {
                            model.expanded = nil
                            model.onReply?(row.id, next)
                        } label: {
                            Text(next).font(.system(size: 11, weight: .semibold)).lineLimit(1).padding(.horizontal, 10).padding(.vertical, 4)
                                .background(model.accent, in: Capsule()).foregroundStyle(.black)
                        }.buttonStyle(.plain)
                    }
                }
            }
            HStack {
                TextField("reply to \(row.name.lowercased())", text: $model.replyText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13))
                    .foregroundStyle(text)
                    .onSubmit {
                        let value = model.replyText
                        model.replyText = ""
                        model.expanded = nil
                        model.onReply?(row.id, value)
                    }
                Text("return").font(.system(size: 10)).foregroundStyle(text.opacity(0.35))
            }
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
        }
        .padding(.top, 2)
    }

    private func taskPill(_ row: AgentRow) -> some View {
        HStack(spacing: 5) {
            switch row.kind {
            case .agent, .job: Circle().fill(model.accent).frame(width: 5, height: 5).shadow(color: model.accent.opacity(0.8), radius: 3)
            case .walkthrough: Image(systemName: "cursorarrow.click.2").font(.system(size: 9)).foregroundStyle(model.accent)
            case .lesson: Image(systemName: "book.pages").font(.system(size: 9)).foregroundStyle(model.accent)
            }
            Text(row.name).font(.system(size: 10.5, weight: .semibold)).foregroundStyle(text.opacity(0.85)).lineLimit(1)
            Text(row.line).font(.system(size: 10.5)).foregroundStyle(text.opacity(0.5)).lineLimit(1).frame(maxWidth: 90, alignment: .leading)
        }
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(Color.white.opacity(0.08), in: Capsule())
    }

    static func elapsed(since date: Date) -> String {
        let s = Int(Date().timeIntervalSince(date))
        return s < 60 ? "\(s)s" : "\(s / 60)m\(String(format: "%02d", s % 60))s"
    }

    private func smallButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.system(size: 11, weight: .medium)).padding(.horizontal, 10).padding(.vertical, 4)
                .background(Color.white.opacity(0.1), in: Capsule()).foregroundStyle(text)
        }.buttonStyle(.plain)
    }
}

// MARK: - Pieces

/// The voice as a row of bars, the way HeyClicky's notch shows it: his level while listening,
/// a spoken envelope while Dot talks, a slow travelling wave while it thinks.
struct VoiceBars: View {
    let phase: HUDModel.Phase
    let level: Float
    let color: Color
    private let count = 16

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            HStack(alignment: .center, spacing: 2) {
                ForEach(0..<count, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 1.25)
                        .fill(color.opacity(phase == .thinking || phase == .transcribing ? 0.6 : 0.95))
                        .frame(width: 2.5, height: height(i, t: t))
                }
            }
            .frame(height: 18)
            .shadow(color: color.opacity(0.35), radius: 3)
        }
    }

    private func height(_ i: Int, t: Double) -> CGFloat {
        // A bell across the row, so the middle bars carry the voice and the ends stay low.
        let x = (Double(i) + 0.5) / Double(count) * 2 - 1
        let bell = 0.35 + 0.65 * exp(-x * x * 2.2)
        switch phase {
        case .listening:
            let heard = pow(Double(min(level * 2.6, 1)), 0.75)
            let jitter = 0.75 + 0.25 * sin(t * 11 + Double(i) * 1.7)
            return CGFloat(3 + heard * 13 * bell * jitter)
        case .speaking:
            let slow = (sin(t * 8.5 + Double(i) * 0.25) + 1) / 2
            let fast = (sin(t * 21 + Double(i) * 0.9) + 1) / 2
            return CGFloat(3 + (slow * 0.6 + fast * 0.4) * 11 * bell)
        case .transcribing:
            return CGFloat(3 + 6 * ((sin(t * 7 - Double(i) * 0.55) + 1) / 2))
        default:
            return CGFloat(3 + 5 * ((sin(t * 3.4 - Double(i) * 0.5) + 1) / 2))
        }
    }
}

/// An agent's face on its card: its initial on a hue of its own, or the task's symbol.
struct AgentAvatar: View {
    let row: AgentRow
    let accent: Color

    var body: some View {
        ZStack {
            Circle().fill(fill).frame(width: 26, height: 26)
            switch row.kind {
            case .agent, .job:
                Text(String(row.name.prefix(1)).uppercased()).font(.system(size: 12, weight: .bold)).foregroundStyle(.black.opacity(0.8))
            case .walkthrough:
                Image(systemName: "cursorarrow.click.2").font(.system(size: 11, weight: .semibold)).foregroundStyle(.black.opacity(0.8))
            case .lesson:
                Image(systemName: "book.pages").font(.system(size: 11, weight: .semibold)).foregroundStyle(.black.opacity(0.8))
            }
            if row.state == .running {
                Circle().stroke(fill.opacity(0.5), lineWidth: 1.5).frame(width: 32, height: 32)
                    .modifier(Breathe())
            }
        }
        .frame(width: 32, height: 32)
    }

    private var fill: Color {
        guard row.kind == .agent else { return accent }
        var hash: UInt32 = 2166136261
        for byte in row.name.utf8 { hash = (hash ^ UInt32(byte)) &* 16777619 }
        return Color(hue: Double(hash % 360) / 360, saturation: 0.5, brightness: 0.9)
    }
}

private struct Breathe: ViewModifier {
    @State private var on = false
    func body(content: Content) -> some View {
        content.scaleEffect(on ? 1.08 : 0.96).opacity(on ? 0.4 : 0.9)
            .onAppear { withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) { on = true } }
    }
}

/// The agent's live line, with a slow ellipsis while it works so a still line never reads as stuck.
struct LiveLine: View {
    let text: String
    let pulsing: Bool
    let color: Color
    var size: CGFloat = 12
    var weight: Font.Weight = .regular
    /// HeyClicky's working line: the text, then a row of three accent dots that breathe under it (the stack).
    var dots: Color? = nil

    var body: some View {
        if let dots, pulsing {
            VStack(alignment: .leading, spacing: 5) {
                Text(text).font(.system(size: size, weight: weight)).foregroundStyle(color).lineLimit(2)
                TimelineView(.periodic(from: .now, by: 0.4)) { context in
                    let n = Int(context.date.timeIntervalSinceReferenceDate * 2.5) % 3
                    HStack(spacing: 4) {
                        ForEach(0..<3, id: \.self) { i in Circle().fill(dots.opacity(i == n ? 1 : 0.35)).frame(width: 5, height: 5) }
                    }
                }
            }
        } else if pulsing {
            TimelineView(.periodic(from: .now, by: 0.5)) { context in
                let n = Int(context.date.timeIntervalSinceReferenceDate * 2) % 4
                Text(text.trimmingCharacters(in: CharacterSet(charactersIn: ". ")) + String(repeating: ".", count: n))
                    .font(.system(size: size, weight: weight)).foregroundStyle(color).lineLimit(2)
            }
        } else {
            Text(text).font(.system(size: size, weight: weight)).foregroundStyle(color).lineLimit(2)
        }
    }
}

/// A capsule button: the accent with black text when it is the one to press, else quiet.
struct GelButton: View {
    let title: String
    let accent: Color
    let primary: Bool
    /// The stack's cards (04 review): HeyClicky's 30 pt gel capsules, the primary one near white to light blue with a
    /// dark outline, the others dark with a light rim.
    var gel = false
    let action: () -> Void

    init(title: String, accent: Color, primary: Bool, gel: Bool = false, action: @escaping () -> Void) {
        self.title = title; self.accent = accent; self.primary = primary; self.gel = gel; self.action = action
    }

    var body: some View {
        Button(action: action) {
            if gel {
                Text(title).font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 30)
                    .background(
                        primary
                            ? AnyShapeStyle(LinearGradient(colors: [Color(red: 239 / 255, green: 244 / 255, blue: 249 / 255),
                                                                    Color(red: 152 / 255, green: 189 / 255, blue: 225 / 255)],
                                                           startPoint: .top, endPoint: .bottom))
                            : AnyShapeStyle(Color(red: 39 / 255, green: 41 / 255, blue: 45 / 255)),
                        in: Capsule())
                    .overlay(Capsule().stroke(primary ? Color(red: 60 / 255, green: 55 / 255, blue: 127 / 255) : Color(red: 55 / 255, green: 60 / 255, blue: 67 / 255), lineWidth: 1))
                    .foregroundStyle(primary ? Color(red: 0.08, green: 0.08, blue: 0.12) : NotchInk.text)
            } else {
                Text(title).font(.system(size: 11.5, weight: .semibold)).padding(.horizontal, 12).padding(.vertical, 5)
                    .background(primary ? accent : Color.white.opacity(0.1), in: Capsule())
                    .foregroundStyle(primary ? .black : NotchInk.text)
                    .shadow(color: primary ? accent.opacity(0.35) : .clear, radius: 4, y: 1)
            }
        }.buttonStyle(.plain)
    }
}

struct NoticeCard: View {
    let notice: NotchNotice
    let accent: Color
    let dismiss: () -> Void

    private var tone: Color {
        switch notice.tone {
        case .info: return accent
        case .good: return NotchInk.good
        case .warn: return NotchInk.warn
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 7, style: .continuous).fill(tone.opacity(0.18)).frame(width: 26, height: 26)
                Image(systemName: notice.icon).font(.system(size: 12, weight: .semibold)).foregroundStyle(tone)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(notice.title).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(NotchInk.text).lineLimit(2)
                if let detail = notice.detail, !detail.isEmpty {
                    Text(detail).font(.system(size: 11.5)).foregroundStyle(NotchInk.text.opacity(0.6)).lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if notice.actionTitle != nil || notice.secondaryTitle != nil {
                    HStack(spacing: 6) {
                        if let title = notice.actionTitle {
                            GelButton(title: title, accent: tone, primary: true) { notice.action?(); dismiss() }
                        }
                        if let title = notice.secondaryTitle {
                            GelButton(title: title, accent: tone, primary: false) { notice.secondary?(); dismiss() }
                        }
                    }
                    .padding(.top, 4)
                }
            }
            Spacer(minLength: 4)
            Button(action: dismiss) { Image(systemName: "xmark").font(.system(size: 9, weight: .bold)) }
                .buttonStyle(.plain).foregroundStyle(NotchInk.text.opacity(0.4))
        }
        .padding(10)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(tone.opacity(0.35), lineWidth: 1))
        .transition(.opacity.combined(with: .move(edge: .top)))
    }
}

/// "i can do four things for you today": show me, or not today; then one row per thing.
struct MorningCardView: View {
    let card: MorningCard
    @Binding var expanded: Bool
    let accent: Color
    let decide: (MorningCard.Item, Bool) -> Void
    let dismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "sun.max.fill").font(.system(size: 12, weight: .semibold)).foregroundStyle(accent)
                Text(card.greeting).font(.system(size: 13, weight: .semibold)).foregroundStyle(NotchInk.text).lineLimit(2)
                Spacer(minLength: 4)
                Button(action: dismiss) { Image(systemName: "xmark").font(.system(size: 9, weight: .bold)) }
                    .buttonStyle(.plain).foregroundStyle(NotchInk.text.opacity(0.4))
            }
            if expanded {
                ForEach(card.items) { item in
                    HStack(alignment: .top, spacing: 8) {
                        Circle().fill(accent.opacity(0.7)).frame(width: 5, height: 5).padding(.top, 6)
                        Text(item.text).font(.system(size: 12.5)).foregroundStyle(NotchInk.text.opacity(0.9)).lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 6)
                        GelButton(title: "do it", accent: accent, primary: true) { decide(item, true) }
                        GelButton(title: "skip", accent: accent, primary: false) { decide(item, false) }
                    }
                }
                HStack { Spacer(); GelButton(title: "that's all", accent: accent, primary: false, action: dismiss) }
            } else {
                HStack(spacing: 8) {
                    GelButton(title: "show me", accent: accent, primary: true) { withAnimation(.easeOut(duration: 0.2)) { expanded = true } }
                    GelButton(title: "not today", accent: accent, primary: false, action: dismiss)
                }
            }
        }
        .padding(12)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(accent.opacity(0.4), lineWidth: 1))
    }
}

extension Notification.Name {
    static let dotShowInput = Notification.Name("com.roshan.dot.showInput")
    static let dotDismissAnswer = Notification.Name("com.roshan.dot.dismissAnswer")
    static let dotDismissNotice = Notification.Name("com.roshan.dot.dismissNotice")
    static let dotOpenHome = Notification.Name("com.roshan.dot.openHome")
}

/// A borderless panel refuses to become the key window by default, so keystrokes never reached the
/// typed-question field. This one accepts the keyboard without ever becoming the main window or
/// activating Dot, which keeps the user's app frontmost for the next screenshot.
/// The size of what the notch view draws, reported up so the window can be sized to it.
struct NotchContentSizeKey: PreferenceKey {
    static var defaultValue: CGSize = .zero
    static func reduce(value: inout CGSize, nextValue: () -> CGSize) {
        let next = nextValue()
        if next != .zero { value = next }
    }
}

class KeyablePanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}
