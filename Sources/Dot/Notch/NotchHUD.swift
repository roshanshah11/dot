import AppKit
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
    var nextAction: String? = nil
    var kind: Kind = .agent
    /// The last few things it did, newest last: tool calls, a sentence it wrote, a step he took.
    var steps: [String] = []
    var canStop = false
    var startedAt = Date()
}

struct ConsentCard: Identifiable {
    let id = UUID()
    let agent: String
    let title: String
    let detail: String
    let onAllow: () -> Void
    let onDeny: () -> Void
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
    /// A small black tab under the notch when there is nothing else to show.
    @Published var presence = false
    @Published var hovering = false
    var onSubmitInput: ((String) -> Void)?
    var onOpenAgent: ((String) -> Void)?
    var onReply: ((String, String) -> Void)?
    var onDismissAgent: ((String) -> Void)?
    var onStopAgent: ((String) -> Void)?
    /// Running tasks fold into pills on the idle tab after a while; a change or a hover unfolds them.
    @Published var collapsed = false { didSet { if oldValue != collapsed { onCollapseChanged?() } } }
    var onCollapseChanged: (() -> Void)?

    var hasContent: Bool {
        phase != .hidden || (!agents.isEmpty && !collapsed) || consent != nil || showInput || status != nil || error != nil || answer != nil
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
    private var visible = false

    init() {
        model.onCollapseChanged = { [weak self] in self?.refreshVisibility() }
    }

    init(accentHex: String) {
        if let color = Color(hex: accentHex) { model.accent = color }
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
    }

    /// Whether the notch shows up in recordings and screen shares.
    func setVisibleInRecordings(_ visible: Bool) {
        ensurePanel().sharingType = visible ? .readOnly : .none
    }

    // MARK: State

    func set(phase: HUDModel.Phase) {
        model.phase = phase
        if phase == .hidden {
            model.showInput = false
            model.transcript = ""
            model.response = ""
            model.caption = nil
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

    func present(_ card: ConsentCard) {
        model.consent = card
        refreshVisibility()
        NSSound(named: "Tink")?.play()
    }

    func dismissConsent() {
        model.consent = nil
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

    static let tallPanelHeight: CGFloat = 620

    private func reposition() {
        guard let panel else { return }
        let geometry = currentGeometry()
        var frame = geometry.panelFrame
        frame.origin.y -= Self.tallPanelHeight - frame.height
        frame.size.height = Self.tallPanelHeight
        panel.setFrame(frame, display: true)
        if let hosting = panel.contentView as? NSHostingView<NotchHUDView> {
            hosting.rootView = NotchHUDView(model: model, geometry: geometry, onClose: { [weak self] in
                self?.hideInput()
                self?.dismissAnswer()
                self?.set(phase: .hidden)
            })
        }
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

struct NotchHUDView: View {
    @ObservedObject var model: HUDModel
    let geometry: NotchGeometry
    let onClose: () -> Void
    @FocusState private var inputFocused: Bool

    private let ground = Color(red: 0.051, green: 0.047, blue: 0.043)
    private let text = Color(red: 0.925, green: 0.91, blue: 0.882)

    var body: some View {
        if !model.hasContent && model.presence {
            idleStrip
        } else {
            panel
        }
    }

    /// Dot's idle presence: a black tab hugging the notch, after HeyClicky's resting notch.
    /// Hover for the day in one line; click to type.
    private var idleStrip: some View {
        VStack(spacing: 0) {
            VStack(spacing: 4) {
                Color.clear.frame(height: max(geometry.notchHeight - 4, 0))
                if model.hovering {
                    VStack(spacing: 3) {
                        Text(model.todayLine ?? "hold control and option and talk").font(.system(size: 11.5)).foregroundStyle(text.opacity(0.75)).lineLimit(2)
                        Text("click to type, hold ⌃⌥ to talk").font(.system(size: 10)).foregroundStyle(text.opacity(0.4))
                    }
                    .padding(.horizontal, 14).padding(.bottom, 8)
                } else if !model.foldedTasks.isEmpty {
                    HStack(spacing: 8) {
                        ForEach(model.foldedTasks.prefix(3)) { row in taskPill(row) }
                    }
                    .padding(.horizontal, 12).padding(.bottom, 6)
                } else if let line = model.listeningLine ?? model.meetingLine {
                    // The ear is on, or a meeting is close: a quiet line on the tab, after HeyClicky's notch countdown.
                    HStack(spacing: 6) {
                        if model.listeningLine != nil {
                            BreathingDot(color: model.accent)
                        } else {
                            Image(systemName: "calendar").font(.system(size: 9.5)).foregroundStyle(model.accent)
                        }
                        Text(line).font(.system(size: 10.5, weight: .medium)).foregroundStyle(text.opacity(0.8)).lineLimit(1)
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
            .frame(width: model.hovering ? min(geometry.notchWidth + 220, 420) : (model.foldedTasks.isEmpty ? ((model.listeningLine ?? model.meetingLine) == nil ? geometry.notchWidth + 36 : geometry.notchWidth + 120) : min(geometry.notchWidth + 80 + CGFloat(min(model.foldedTasks.count, 3)) * 150, 560)), alignment: .center)
            .background(ground, in: UnevenRoundedRectangle(cornerRadii: .init(topLeading: 0, bottomLeading: 14, bottomTrailing: 14, topTrailing: 0)))
            .contentShape(Rectangle())
            .onHover { inside in withAnimation(.easeOut(duration: 0.15)) { model.hovering = inside } }
            .onTapGesture {
                if !model.foldedTasks.isEmpty { model.collapsed = false } else { NotificationCenter.default.post(name: .dotShowInput, object: nil) }
            }
            Spacer(minLength: 0)
        }
        .frame(width: NotchGeometry.panelWidth, height: NotchHUD.tallPanelHeight, alignment: .top)
    }

    private var panel: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                // Keep the notch itself black so the panel reads as one shape with it.
                Color.clear.frame(height: max(geometry.notchHeight - 6, 0))
                header
                if let error = model.error {
                    Text(error).font(.system(size: 12)).foregroundStyle(Color(red: 1, green: 0.5, blue: 0.4)).lineLimit(3)
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
                if let card = model.consent { consent(card) }
                ForEach(model.agents) { row in agentRow(row) }
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
            Spacer(minLength: 0)
        }
        .frame(width: NotchGeometry.panelWidth, height: NotchHUD.tallPanelHeight, alignment: .top)
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

    private var header: some View {
        HStack(spacing: 10) {
            Circle().fill(model.accent).frame(width: 9, height: 9)
                .shadow(color: model.accent.opacity(0.8), radius: 4)
                .scaleEffect(model.phase == .listening ? 1 + CGFloat(model.level) * 0.9 : 1)
                .animation(.easeOut(duration: 0.1), value: model.level)
            Text(headerText).font(.system(size: 12, weight: .medium)).foregroundStyle(text.opacity(0.8))
            if model.phase == .listening { waveform }
            Spacer()
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
            return model.showInput ? "ask dot" : (model.agents.isEmpty ? "dot" : (model.agents.count == 1 ? "one task" : "\(model.agents.count) tasks"))
        case .listening: return model.mode == .agent ? "listening, for an agent" : (model.mode == .dictate ? "dictating" : "listening")
        case .transcribing: return "hearing you"
        case .thinking: return "thinking"
        case .speaking: return "dot"
        case .done: return "dot"
        }
    }

    private var waveform: some View {
        HStack(spacing: 2) {
            ForEach(0..<5, id: \.self) { i in
                let profile: [CGFloat] = [0.4, 0.7, 1.0, 0.7, 0.4]
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(model.accent)
                    .frame(width: 3, height: 4 + CGFloat(model.level) * 14 * profile[i])
            }
        }
        .frame(height: 18)
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

    private func consent(_ card: ConsentCard) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(card.agent) wants to \(card.title)").font(.system(size: 13, weight: .semibold)).foregroundStyle(text)
            if !card.detail.isEmpty {
                Text(card.detail).font(.system(size: 12, design: .monospaced)).foregroundStyle(text.opacity(0.65)).lineLimit(3)
            }
            HStack(spacing: 8) {
                Button(action: card.onAllow) {
                    Text("Allow").font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).padding(.vertical, 6)
                        .background(model.accent, in: Capsule()).foregroundStyle(.black)
                }.buttonStyle(.plain)
                Button(action: card.onDeny) {
                    Text("Not now").font(.system(size: 12, weight: .medium)).padding(.horizontal, 14).padding(.vertical, 6)
                        .background(Color.white.opacity(0.1), in: Capsule()).foregroundStyle(text)
                }.buttonStyle(.plain)
            }
        }
        .padding(12)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(model.accent.opacity(0.6), lineWidth: 1))
    }

    private func agentRow(_ row: AgentRow) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Group {
                    switch row.state {
                    case .running:
                        switch row.kind {
                        case .agent: ProgressView().controlSize(.mini)
                        case .walkthrough: Image(systemName: "cursorarrow.click.2").foregroundStyle(model.accent)
                        case .lesson: Image(systemName: "book.pages").foregroundStyle(model.accent)
                        }
                    case .waiting: Image(systemName: "hand.raised.fill").foregroundStyle(model.accent)
                    case .done: Image(systemName: "checkmark.circle.fill").foregroundStyle(model.accent)
                    case .failed: Image(systemName: "xmark.circle.fill").foregroundStyle(.red)
                    }
                }.frame(width: 14)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(row.name).font(.system(size: 12, weight: .semibold)).foregroundStyle(text)
                        if row.state == .running {
                            Text(Self.elapsed(since: row.startedAt)).font(.system(size: 10.5, design: .monospaced)).foregroundStyle(text.opacity(0.4))
                        }
                    }
                    if model.expanded != row.id {
                        Text(row.line).font(.system(size: 12)).foregroundStyle(text.opacity(0.65)).lineLimit(2)
                    }
                    if row.state == .running, !row.steps.isEmpty, model.expanded != row.id {
                        ForEach(Array(row.steps.suffix(3).enumerated()), id: \.offset) { _, step in
                            Text(step).font(.system(size: 11)).foregroundStyle(text.opacity(0.42)).lineLimit(1)
                        }
                    }
                }
                Spacer()
                if row.state == .running, row.canStop {
                    smallButton("stop") { model.onStopAgent?(row.id) }
                }
                if row.result != nil {
                    Image(systemName: model.expanded == row.id ? "chevron.up" : "chevron.down")
                        .font(.system(size: 10, weight: .bold)).foregroundStyle(text.opacity(0.5))
                }
                if row.state == .done || row.state == .failed {
                    Button { model.onDismissAgent?(row.id) } label: { Image(systemName: "xmark").font(.system(size: 9, weight: .bold)) }
                        .buttonStyle(.plain).foregroundStyle(text.opacity(0.4))
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                guard row.result != nil else { return }
                withAnimation(.easeOut(duration: 0.18)) { model.expanded = model.expanded == row.id ? nil : row.id }
            }
            if model.expanded == row.id, let result = row.result {
                resultCard(row, result: result)
            }
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
            ForEach(row.outputs, id: \.self) { url in
                HStack(spacing: 6) {
                    Image(systemName: "doc").font(.system(size: 10)).foregroundStyle(model.accent)
                    Text(url.lastPathComponent).font(.system(size: 11.5)).foregroundStyle(text.opacity(0.85)).lineLimit(1)
                    Spacer()
                    smallButton("open") { NSWorkspace.shared.open(url) }
                }
            }
            HStack(spacing: 8) {
                smallButton("copy") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(result, forType: .string)
                }
                if row.outputCount > 0 {
                    smallButton("output folder") { model.onOpenAgent?(row.id) }
                }
                if let next = row.nextAction {
                    Button {
                        model.expanded = nil
                        model.onReply?(row.id, next)
                    } label: {
                        Text(next).font(.system(size: 11, weight: .semibold)).lineLimit(1).padding(.horizontal, 10).padding(.vertical, 4)
                            .background(model.accent, in: Capsule()).foregroundStyle(.black)
                    }.buttonStyle(.plain)
                }
                Spacer()
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
        .padding(10)
        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
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


extension Notification.Name {
    static let dotShowInput = Notification.Name("com.roshan.dot.showInput")
    static let dotDismissAnswer = Notification.Name("com.roshan.dot.dismissAnswer")
}

/// A borderless panel refuses to become the key window by default, so keystrokes never reached the
/// typed-question field. This one accepts the keyboard without ever becoming the main window or
/// activating Dot, which keeps the user's app frontmost for the next screenshot.
final class KeyablePanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}
