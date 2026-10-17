import AppKit
import Combine
import DotKit
import SwiftUI

/// One row of the task bar: an agent at work, a walkthrough in progress, a lesson on the board.
struct AgentRow: Identifiable, Equatable {
    enum State: Equatable { case running, waiting, done, failed }
    enum Kind: Equatable { case agent, walkthrough, lesson }
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
    /// Files the agents made lately, as tiles on the hover peek; each can be dragged out.
    @Published var peekFiles: [URL] = []
    @Published var morning: MorningCard?
    @Published var morningExpanded = false
    /// A small black tab under the notch when there is nothing else to show.
    @Published var presence = false
    @Published var hovering = false
    /// What the view draws, measured; the window is sized to it.
    @Published var contentSize: CGSize = .zero
    var onSubmitInput: ((String) -> Void)?
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

    var hasContent: Bool {
        phase != .hidden || (!agents.isEmpty && !collapsed) || consent != nil || showInput || status != nil || error != nil || answer != nil
            || !notices.isEmpty || morning != nil
    }
    var foldedTasks: [AgentRow] { collapsed ? agents : [] }

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

    init() {
        model.onCollapseChanged = { [weak self] in self?.refreshVisibility() }
        observeContentSize()
    }

    init(accentHex: String) {
        if let color = Color(hex: accentHex) { model.accent = color }
        observeContentSize()
        NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.reposition() }
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

    /// A typed question's answer stays in the notch until he closes it or asks again.
    func presentAnswer(question: String, text: String) {
        model.answerQuestion = question
        model.answer = text
        model.caption = nil
        refreshVisibility()
    }

    func dismissAnswer() {
        guard model.answer != nil else { return }
        model.answer = nil
        model.answerQuestion = ""
        refreshVisibility()
    }

    func flash(status: String, for seconds: TimeInterval = 2.5) {
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
        model.error = error
        refreshVisibility()
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in
            if self?.model.error == error { self?.model.error = nil; self?.refreshVisibility() }
        }
    }

    // MARK: Notices

    /// Show a typed notice; one with the same id replaces the old one and restarts its clock.
    func notify(_ notice: NotchNotice) {
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
        pulseGlow()
        refreshVisibility()
    }

    func dismissMorning() {
        guard model.morning != nil else { return }
        model.morning = nil
        model.morningExpanded = false
        refreshVisibility()
    }

    /// Drop one item once he decided on it; the card goes when nothing is left.
    func morningDecided(_ item: MorningCard.Item) {
        model.morning?.items.removeAll { $0.id == item.id }
        if model.morning?.items.isEmpty == true { dismissMorning() }
    }

    private var inputTimeout: DispatchWorkItem?

    func showInput() {
        model.showInput = true
        model.phase = .hidden
        refreshVisibility()
        // A non-activating panel takes the keyboard without making Dot the frontmost app,
        // so the user's window keeps focus and the next screenshot still shows it active.
        panel?.makeKeyAndOrderFront(nil)
        Log.info("input: field shown, panel key \(panel?.isKeyWindow == true)")
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

    private var collapseWork: DispatchWorkItem?

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
        // A new task or a finished one unfolds the panel; steady work folds back into pills.
        if changed, row.state != .running || !model.agents.contains(where: { $0.id == row.id && $0.state == .running }) == false {
            if row.state != .running || model.agents.count == 1 && !model.collapsed { model.collapsed = false }
        }
        scheduleCollapse()
        refreshVisibility()
    }

    func removeAgent(id: String) {
        model.agents.removeAll { $0.id == id }
        if model.expanded == id { model.expanded = nil }
        if model.agents.isEmpty { model.collapsed = false }
        refreshVisibility()
    }

    /// Fold running tasks into the idle tab after 20 s of steady work; finished rows stay open.
    private func scheduleCollapse() {
        collapseWork?.cancel()
        guard model.agents.contains(where: { $0.state == .running }),
              !model.agents.contains(where: { $0.state == .done || $0.state == .failed || $0.state == .waiting }) else { return }
        let work = DispatchWorkItem { [weak self] in
            guard let self, !self.model.hovering, self.model.expanded == nil, self.model.phase == .hidden else { return }
            self.model.collapsed = true
        }
        collapseWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 20, execute: work)
    }

    func unfoldTasks() {
        model.collapsed = false
        scheduleCollapse()
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
        refreshVisibility()
    }

    /// When the card on show came on show.
    var consentShownAt: Date? { model.consent == nil ? nil : model.consentShownAt }

    /// Escape, HeyClicky's way (1.0.50): the cards under the notch go away. A consent card stays,
    /// since it needs a choice.
    func escapeDismiss() {
        for notice in model.notices { dismissNotice(id: notice.id) }
        if model.morning != nil { dismissMorning() }
        model.expanded = nil
        if !model.agents.isEmpty, model.agents.allSatisfy({ $0.state != .waiting }) { model.collapsed = true }
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
        guard target != roomy else { return }
        let work = DispatchWorkItem { [weak self] in
            guard let self, let panel = self.panel else { return }
            panel.setFrame(self.currentGeometry().frame(fitting: self.contentSize), display: true)
        }
        shrinkWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35, execute: work)
    }

    func setPresence(_ on: Bool) {
        model.presence = on
        refreshVisibility()
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
enum NotchInk {
    static let ground = Color(red: 0.051, green: 0.047, blue: 0.043)
    static let text = Color(red: 0.925, green: 0.91, blue: 0.882)
    static let good = Color(red: 0.55, green: 0.86, blue: 0.62)
    static let warn = Color(red: 1.0, green: 0.8, blue: 0.36)
    static let red = Color(red: 0.95, green: 0.3, blue: 0.28)
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

    /// Dot's idle presence: a black tab hugging the notch, after HeyClicky's resting notch.
    /// Hover for the day in one line and the agents' latest files; click to type.
    private var idleStrip: some View {
        VStack(spacing: 0) {
            VStack(spacing: 4) {
                Color.clear.frame(height: max(geometry.notchHeight - 4, 0))
                if model.hovering {
                    hoverPeek
                } else if !model.foldedTasks.isEmpty {
                    HStack(spacing: 8) {
                        ForEach(model.foldedTasks.prefix(3)) { row in taskPill(row) }
                    }
                    .padding(.horizontal, 12).padding(.bottom, 6)
                } else if let line = model.recordingLine ?? model.listeningLine ?? model.meetingLine {
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
                } else {
                    HStack(spacing: 5) {
                        Circle().fill(model.accent).frame(width: 5, height: 5).shadow(color: model.accent.opacity(0.8), radius: 3)
                    }
                    .frame(height: 8)
                    .padding(.bottom, 2)
                }
            }
            .frame(width: idleWidth, alignment: .center)
            .background(ground, in: UnevenRoundedRectangle(cornerRadii: .init(topLeading: 0, bottomLeading: 14, bottomTrailing: 14, topTrailing: 0)))
            .overlay(cornerGlow(radius: 14))
            .contentShape(Rectangle())
            .onHover { inside in withAnimation(.easeOut(duration: 0.15)) { model.hovering = inside } }
            .onTapGesture {
                if !model.foldedTasks.isEmpty { model.collapsed = false } else { NotificationCenter.default.post(name: .dotShowInput, object: nil) }
            }
        }
    }

    private var idleWidth: CGFloat {
        if model.hovering { return min(geometry.notchWidth + (model.peekFiles.isEmpty ? 220 : 300), 500) }
        if !model.foldedTasks.isEmpty { return min(geometry.notchWidth + 80 + CGFloat(min(model.foldedTasks.count, 3)) * 150, 560) }
        return (model.recordingLine ?? model.listeningLine ?? model.meetingLine) == nil ? geometry.notchWidth + 36 : geometry.notchWidth + 120
    }

    /// The hover peek: the day in a line, the ways in, and the agents' latest files as tiles he can drag out.
    private var hoverPeek: some View {
        VStack(spacing: 6) {
            Text(model.todayLine ?? "hold control and option and talk").font(.system(size: 11.5)).foregroundStyle(text.opacity(0.75)).lineLimit(2)
            if !model.peekFiles.isEmpty {
                HStack(spacing: 8) {
                    ForEach(model.peekFiles.prefix(4), id: \.self) { url in fileTile(url) }
                    Button { NotificationCenter.default.post(name: .dotOpenHome, object: nil) } label: {
                        VStack(spacing: 3) {
                            Image(systemName: "rectangle.grid.2x2").font(.system(size: 14)).foregroundStyle(model.accent)
                            Text("open dot").font(.system(size: 9.5)).foregroundStyle(text.opacity(0.6))
                        }
                        .frame(width: 56, height: 44)
                        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }.buttonStyle(.plain)
                }
            }
            Text("click to type, hold ⌃⌥ to talk, double-tap fn to record").font(.system(size: 10)).foregroundStyle(text.opacity(0.4))
        }
        .padding(.horizontal, 14).padding(.bottom, 8)
    }

    private func fileTile(_ url: URL) -> some View {
        VStack(spacing: 3) {
            Image(systemName: Self.symbol(forFile: url)).font(.system(size: 14)).foregroundStyle(Theme.fileColor(url) ?? model.accent)
            Text(url.lastPathComponent).font(.system(size: 9.5)).foregroundStyle(text.opacity(0.8)).lineLimit(1).truncationMode(.middle)
        }
        .frame(width: 72, height: 44)
        .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .onTapGesture { NSWorkspace.shared.open(url) }
        .onDrag { NSItemProvider(object: url as NSURL) }
        .help(url.lastPathComponent)
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
                if let morning = model.morning { MorningCardView(card: morning, expanded: $model.morningExpanded, accent: model.accent,
                                                                  decide: { item, yes in model.onMorningDecision?(item, yes) },
                                                                  dismiss: { model.onMorningDismiss?() }) }
                if let card = model.consent { consent(card) }
                ForEach(model.agents) { row in agentCard(row) }
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
            ScrollView {
                Text(answer)
                    .font(.system(size: 13.5))
                    .foregroundStyle(text.opacity(0.95))
                    .lineSpacing(3)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxHeight: 300)
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
            if model.morning != nil, model.agents.isEmpty, !model.showInput { return "this morning" }
            return model.showInput ? "ask dot" : (model.agents.isEmpty ? "dot" : (model.agents.count == 1 ? "one task" : "\(model.agents.count) tasks"))
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
                    model.onSubmitInput?(value)
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
                        Text("•").font(.system(size: 11)).foregroundStyle(text.opacity(0.35))
                        Text(Self.stateWord(row)).font(.system(size: 11.5, weight: .medium)).foregroundStyle(Self.stateColor(row, accent: model.accent))
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
            case .agent: Circle().fill(model.accent).frame(width: 5, height: 5).shadow(color: model.accent.opacity(0.8), radius: 3)
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
            case .agent:
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

    var body: some View {
        if pulsing {
            TimelineView(.periodic(from: .now, by: 0.5)) { context in
                let n = Int(context.date.timeIntervalSinceReferenceDate * 2) % 4
                Text(text.trimmingCharacters(in: CharacterSet(charactersIn: ". ")) + String(repeating: ".", count: n))
                    .font(.system(size: 12)).foregroundStyle(color).lineLimit(2)
            }
        } else {
            Text(text).font(.system(size: 12)).foregroundStyle(color).lineLimit(2)
        }
    }
}

/// A capsule button: the accent with black text when it is the one to press, else quiet.
struct GelButton: View {
    let title: String
    let accent: Color
    let primary: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title).font(.system(size: 11.5, weight: .semibold)).padding(.horizontal, 12).padding(.vertical, 5)
                .background(primary ? accent : Color.white.opacity(0.1), in: Capsule())
                .foregroundStyle(primary ? .black : NotchInk.text)
                .shadow(color: primary ? accent.opacity(0.35) : .clear, radius: 4, y: 1)
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

final class KeyablePanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}
