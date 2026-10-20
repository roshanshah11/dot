import AppKit
import Combine
import DotKit
import SwiftUI

/// The stack at the top right of the notch's screen, under the menu bar (decided item 20, HeyClicky's way):
/// agents, jobs that run behind his window, consent cards, notices that have an action, the morning card.
/// A new card shows for 5 s, then folds to a 40 pt round avatar with a breathing ring; hover opens it (the last
/// 3 steps, the elapsed time, stop, open in Home or show me, a reply field); done is a check and one line for
/// 8 s; failed, stopped or interrupted a red or amber mark and one line for 15 s; a consent card and a paused
/// job stay until he acts; hover holds; newest on top, 8 at most; each chip's clock runs from its last state
/// change (DotKit `AgentChip`); Escape folds every card; results stay in Home.
///
/// The API, for agents (through NotchHUD.upsertAgent) and for jobs (02/03, which feed it directly):
///
///     stack.upsert(StackChip(id: "job-<id>", kind: .job, title: "Listing search", line: "reading the listing",
///                            steps: lastThree, state: .running, costText: "$3.10"))
///         One chip per id; a repeat replaces it. Its clock (`stateSince`) is kept while the state stays the
///         same and restarts when it changes (AgentChip.since); pass `stateSince:` to set it yourself. A job
///         chip's id is "job-<id>". States: running, paused, done, failed, stopped, interrupted, unfinished,
///         attention, consent (a card with Allow and Not now), notice. `holdUntil` keeps a card up for reading
///         time (a muted Mac's end line).
///     stack.remove(id:)
///     stack.onStop(id)          the chip's stop
///     stack.onShow(id)          a job's "show me" (bring its window forward)
///     stack.onOpenHome(id)      an agent's "open" (its thread in Home)
///     stack.onReply(id, text)   the reply field
///     stack.onAllow(id), stack.onDeny(id)   a consent chip's buttons (cards from NotchHUD.present keep
///                               their own Allow and Not now, and a spoken yes still reaches them)
///     stack.onContinue(id)      an unfinished chip's Continue (07)
///     stack.onDismiss(id)       the chip's close button; the chip leaves either way
///     stack.onGone(id)          the policy cleared a chip (done after 8 s, failed after 15 s)
///
/// The window is sized to what it draws and lets every click outside a chip through (the 10-16 lesson: a fixed
/// transparent panel took every click under it). It follows "Show in screen recordings".
struct StackChip: Identifiable {
    let id: String
    var kind: AgentChip.Kind
    var title: String
    var line: String
    var steps: [String] = []
    var state: AgentChip.State
    /// nil: kept from the chip's last state by AgentChip.since.
    var stateSince: Date? = nil
    /// When the work began, for the elapsed time on the card.
    var startedAt = Date()
    var createdAt = Date()
    /// "$3.10", shown from $3 on (02's spend rule).
    var costText: String? = nil
    var canStop = true
    /// An agent's "open" goes to its thread in Home; the lecture ear has none.
    var canOpen = true
    var holdUntil: Date? = nil
    var result: String? = nil
    var outputs: [URL] = []
    var nextActions: [String] = []
    // A notice's pieces.
    var icon: String? = nil
    var tone: NotchNotice.Tone = .info
    var detail: String? = nil
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil
    var secondaryTitle: String? = nil
    var secondary: (() -> Void)? = nil
    var morning: MorningCard? = nil

    init(id: String, kind: AgentChip.Kind, title: String, line: String, steps: [String] = [], state: AgentChip.State,
         stateSince: Date? = nil, startedAt: Date = Date(), costText: String? = nil, canStop: Bool = true, holdUntil: Date? = nil) {
        self.id = id
        self.kind = kind
        self.title = title
        self.line = line
        self.steps = steps
        self.state = state
        self.stateSince = stateSince
        self.startedAt = startedAt
        self.costText = costText
        self.canStop = canStop
        self.holdUntil = holdUntil
    }

    var isJob: Bool { kind == .job || id.hasPrefix("job-") }
}

final class StackModel: ObservableObject {
    @Published var chips: [StackChip] = []
    @Published var hovering: String?
    /// A card he clicked open, or whose reply field he is typing in: it holds until he sends, closes or presses Escape.
    @Published var expanded: String?
    /// Escape folded these (DotKit's `folded`); a new state unfolds a chip.
    @Published var folded: Set<String> = []
    @Published var now = Date()
    @Published var replyText = ""
    @Published var accent = Color(red: 1.0, green: 0.42, blue: 0.17)
    /// The consent card on show, from NotchHUD's queue, when the stack has consent (consentInNotch off).
    @Published var consent: ConsentCard?
    @Published var consentWaiting = 0
    var consentShownAt = Date.distantPast
    @Published var morningExpanded = false
    @Published var contentSize: CGSize = .zero
    /// Drawn by `Dot --snapshot`, where AppKit-backed controls cannot render.
    var snapshot = false
    static let cardWidth: CGFloat = 280
    /// Each drawn chip's frame in the stack's own coordinates (top-left origin), for letting clicks through.
    var chipFrames: [CGRect] = []

    var onStop: ((String) -> Void)?
    var onShow: ((String) -> Void)?
    var onOpenHome: ((String) -> Void)?
    var onReply: ((String, String) -> Void)?
    var onAllow: ((String) -> Void)?
    var onDeny: ((String) -> Void)?
    var onContinue: ((String) -> Void)?
    var onDismiss: ((String) -> Void)?
    /// A "needs you" chip was tapped: its question comes forward in the consent queue.
    var onFocusConsent: ((String) -> Void)?
    var onMorningDecision: ((MorningCard.Item, Bool) -> Void)?
    var onMorningDismiss: (() -> Void)?
    var onWantsKey: (() -> Void)?

    static let consentID = "consent"

    func presentation(_ chip: StackChip) -> AgentChip.Presentation {
        AgentChip.presentation(state: chip.state, stateSince: chip.stateSince ?? chip.createdAt, hovering: hovering == chip.id, expanded: expanded == chip.id,
                               now: now, holdUntil: chip.holdUntil, folded: folded.contains(chip.id))
    }

    /// What is drawn, top to bottom: the consent card first, then newest first, 8 at most.
    var shown: [(chip: StackChip?, presentation: AgentChip.Presentation)] {
        var entries: [AgentChip.Entry] = []
        var byID: [String: (StackChip, AgentChip.Presentation)] = [:]
        for chip in chips {
            let p = presentation(chip)
            guard p != .gone else { continue }
            byID[chip.id] = (chip, p)
            entries.append(AgentChip.Entry(id: chip.id, state: chip.state, createdAt: chip.createdAt))
        }
        if consent != nil { entries.append(AgentChip.Entry(id: Self.consentID, state: .consent, createdAt: consentShownAt)) }
        return AgentChip.order(entries).map { entry in
            if entry.id == Self.consentID { return (nil, .card) }
            let (chip, p) = byID[entry.id]!
            return (chip, p)
        }
    }

    var isEmpty: Bool { shown.isEmpty }
}

@MainActor
final class AgentStack {
    let model = StackModel()
    private var panel: AgentStackPanel?
    private var visible = false
    private var tick: Timer?
    private var shrinkWork: DispatchWorkItem?
    private var sizeSink: AnyCancellable?
    private var mouseMonitors: [Any] = []
    private var visibleInRecordings = true
    /// The last presentation logged per chip, so the log has one line per fold, not one per tick.
    private var logged: [String: AgentChip.Presentation] = [:]

    var onStop: ((String) -> Void)? { get { model.onStop } set { model.onStop = newValue } }
    var onShow: ((String) -> Void)? { get { model.onShow } set { model.onShow = newValue } }
    var onOpenHome: ((String) -> Void)? { get { model.onOpenHome } set { model.onOpenHome = newValue } }
    var onReply: ((String, String) -> Void)? { get { model.onReply } set { model.onReply = newValue } }
    var onAllow: ((String) -> Void)? { get { model.onAllow } set { model.onAllow = newValue } }
    var onDeny: ((String) -> Void)? { get { model.onDeny } set { model.onDeny = newValue } }
    var onContinue: ((String) -> Void)? { get { model.onContinue } set { model.onContinue = newValue } }
    var onDismiss: ((String) -> Void)?
    var onGone: ((String) -> Void)?
    /// NotchHUD's own hooks (its agent rows, notices and the morning card leave with their chips), called before the
    /// public ones above, which stay free for 02's jobs.
    var rowDismissed: ((String) -> Void)?
    var rowGone: ((String) -> Void)?
    /// Where the stack anchors instead of the notch screen's visible frame (`Dot --stack-selftest` puts it off every display).
    var anchorFrame: (() -> CGRect)?
    /// The window's frame while it is up, for the self-test.
    var windowFrame: CGRect? { visible ? panel?.frame : nil }

    init(accentHex: String) {
        if let color = Color(hex: accentHex) { model.accent = color }
        model.onDismiss = { [weak self] id in
            MainActor.assumeIsolated {
                self?.rowDismissed?(id)
                self?.onDismiss?(id)
                self?.remove(id: id)
            }
        }
        model.onWantsKey = { [weak self] in MainActor.assumeIsolated { self?.panel?.makeKeyAndOrderFront(nil) } }
        sizeSink = model.$contentSize
            .removeDuplicates()
            .receive(on: RunLoop.main)
            .sink { [weak self] size in MainActor.assumeIsolated { self?.fit(to: size) } }
        watchMouse()
        NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.reposition() }
        }
    }

    // MARK: The API

    func upsert(_ chip: StackChip) {
        var next = chip
        let now = Date()
        if let index = model.chips.firstIndex(where: { $0.id == chip.id }) {
            let old = model.chips[index]
            next.createdAt = old.createdAt
            next.stateSince = chip.stateSince ?? AgentChip.since(previous: (old.state, old.stateSince ?? old.createdAt), newState: chip.state, now: now)
            if old.state != chip.state { model.folded.remove(chip.id) }
            if chip.state == .running, old.state != .running, model.expanded == chip.id { model.expanded = nil }
            model.chips[index] = next
        } else {
            next.createdAt = now
            next.stateSince = chip.stateSince ?? now
            model.chips.append(next)
        }
        refresh()
    }

    func remove(id: String) {
        guard model.chips.contains(where: { $0.id == id }) else { return }
        model.chips.removeAll { $0.id == id }
        model.folded.remove(id)
        if model.expanded == id { model.expanded = nil; resignKey() }
        if model.hovering == id { model.hovering = nil }
        logged[id] = nil
        refresh()
    }

    func chip(id: String) -> StackChip? { model.chips.first { $0.id == id } }

    /// The consent card on show (NotchHUD's queue, oldest first), or none.
    func setConsent(_ card: ConsentCard?, waiting: Int, shownAt: Date) {
        model.consent = card
        model.consentWaiting = waiting
        model.consentShownAt = shownAt
        refresh()
    }

    /// Escape: every card folds into its avatar; a finished one goes; a card that needs a choice stays.
    func foldAll() {
        model.folded = Set(model.chips.map(\.id))
        if model.expanded != nil { model.expanded = nil; resignKey() }
        model.hovering = nil
        refresh()
    }

    func setAccent(hex: String) {
        if let color = Color(hex: hex) { model.accent = color }
    }

    /// Whether the stack shows up in recordings and screen shares (applyRecordingVisibility).
    func setVisibleInRecordings(_ visible: Bool) {
        visibleInRecordings = visible
        panel?.sharingType = visible ? .readOnly : .none
    }

    var isEmpty: Bool { model.isEmpty }

    // MARK: The clock

    /// Four times a second while anything is up: the presentation moves on, and a chip the policy cleared leaves.
    private func refresh() {
        model.now = Date()
        for chip in model.chips {
            let p = model.presentation(chip)
            if logged[chip.id] != p {
                logged[chip.id] = p
                Log.info("stack: \(chip.id) \(chip.state.rawValue) \(p.rawValue)")
            }
            if p == .gone {
                model.chips.removeAll { $0.id == chip.id }
                model.folded.remove(chip.id)
                logged[chip.id] = nil
                rowGone?(chip.id)
                onGone?(chip.id)
            }
        }
        let empty = model.isEmpty
        if empty {
            tick?.invalidate()
            tick = nil
        } else if tick == nil {
            tick = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
                MainActor.assumeIsolated { self?.refresh() }
            }
        }
        refreshVisibility(empty: empty)
    }

    // MARK: The window

    private func ensurePanel() -> AgentStackPanel {
        if let panel { return panel }
        let panel = AgentStackPanel(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        panel.isFloatingPanel = true
        panel.level = .statusBar   // set after isFloatingPanel, which would reset it to .floating
        panel.becomesKeyOnlyIfNeeded = false
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.acceptsMouseMovedEvents = true
        panel.sharingType = visibleInRecordings ? .readOnly : .none
        panel.contentView = NSHostingView(rootView: AgentStackView(model: model))
        self.panel = panel
        reposition()
        return panel
    }

    /// The notch's screen (the same rule as the notch), else the main one.
    static func anchorScreen() -> NSScreen? {
        NSScreen.screens.first(where: { $0.safeAreaInsets.top > 0 }) ?? NSScreen.main ?? NSScreen.screens.first
    }

    /// Its top right corner: 8 pt under the menu bar, 12 pt in from the screen's right edge.
    static func frame(fitting size: CGSize, in visibleFrame: CGRect) -> CGRect {
        CGRect(x: visibleFrame.maxX - 12 - size.width, y: visibleFrame.maxY - 8 - size.height, width: size.width, height: size.height)
    }

    private var visibleFrame: CGRect { anchorFrame?() ?? Self.anchorScreen()?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1440, height: 875) }

    private func reposition() {
        guard let panel else { return }
        let size = model.contentSize == .zero ? CGSize(width: 48, height: 48) : model.contentSize
        panel.setFrame(Self.frame(fitting: size, in: visibleFrame), display: true)
    }

    /// The window hugs what is drawn (NotchHUD.fit's rule): it grows at once, so nothing is clipped, and shrinks a
    /// moment later, so a card on its way out is not cut off.
    private func fit(to size: CGSize) {
        guard size.width > 0, size.height > 0, let panel else { return }
        let target = Self.frame(fitting: size, in: visibleFrame)
        let current = panel.frame
        shrinkWork?.cancel()
        let roomy = Self.frame(fitting: CGSize(width: max(target.width, current.width), height: max(target.height, current.height)), in: visibleFrame)
        if roomy != current { panel.setFrame(roomy, display: true) }
        updateMousePassThrough()
        guard target != roomy else { return }
        let work = DispatchWorkItem { [weak self] in
            guard let self, let panel = self.panel else { return }
            panel.setFrame(Self.frame(fitting: self.model.contentSize, in: self.visibleFrame), display: true)
            self.updateMousePassThrough()
        }
        shrinkWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35, execute: work)
    }

    private func refreshVisibility(empty: Bool) {
        if !empty {
            let panel = ensurePanel()
            if !visible {
                visible = true
                panel.alphaValue = 0
                panel.orderFrontRegardless()
                NSAnimationContext.runAnimationGroup { ctx in
                    ctx.duration = 0.2
                    panel.animator().alphaValue = 1
                }
            }
        } else if visible, let panel {
            visible = false
            resignKey()
            NSAnimationContext.runAnimationGroup({ ctx in
                ctx.duration = 0.25
                panel.animator().alphaValue = 0
            }, completionHandler: { [weak self] in
                MainActor.assumeIsolated { if self?.visible == false { panel.orderOut(nil) } }
            })
        }
    }

    private func resignKey() {
        if panel?.isKeyWindow == true { panel?.resignKey() }
    }

    /// Clicks between and beside the chips go to whatever is under them.
    private func watchMouse() {
        let check: (NSEvent) -> Void = { [weak self] _ in MainActor.assumeIsolated { self?.updateMousePassThrough() } }
        if let global = NSEvent.addGlobalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged], handler: check) { mouseMonitors.append(global) }
        if let local = NSEvent.addLocalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged], handler: { check($0); return $0 }) { mouseMonitors.append(local) }
    }

    private func updateMousePassThrough() {
        guard let panel, panel.isVisible else { return }
        let mouse = NSEvent.mouseLocation
        let frame = panel.frame
        // The drawing sits at the window's top right (the window is wider for a moment while it shrinks), and its
        // coordinates run from the drawing's top left.
        let width = model.contentSize.width > 0 ? min(model.contentSize.width, frame.width) : frame.width
        let point = CGPoint(x: mouse.x - (frame.maxX - width), y: frame.maxY - mouse.y)
        let over = model.chipFrames.contains { $0.insetBy(dx: -2, dy: -2).contains(point) }
        let through = !over && model.expanded == nil
        if panel.ignoresMouseEvents != through { panel.ignoresMouseEvents = through }
        if !over, model.hovering != nil, model.expanded == nil { model.hovering = nil }
    }
}

/// NotchHUD's KeyablePanel: takes the keyboard for the reply field without activating Dot.
final class AgentStackPanel: KeyablePanel {}

// MARK: - View

struct StackSizeKey: PreferenceKey {
    static var defaultValue: CGSize = .zero
    static func reduce(value: inout CGSize, nextValue: () -> CGSize) {
        let next = nextValue()
        if next != .zero { value = next }
    }
}

struct StackChipFramesKey: PreferenceKey {
    static var defaultValue: [CGRect] = []
    static func reduce(value: inout [CGRect], nextValue: () -> [CGRect]) { value.append(contentsOf: nextValue()) }
}

struct AgentStackView: View {
    @ObservedObject var model: StackModel

    var body: some View {
        VStack(alignment: .trailing, spacing: 8) {
            ForEach(Array(model.shown.enumerated()), id: \.offset) { _, item in
                Group {
                    if let chip = item.chip {
                        StackChipView(model: model, chip: chip, presentation: item.presentation)
                    } else if let card = model.consent {
                        StackConsentCard(model: model, card: card)
                    }
                }
                .background(GeometryReader { proxy in
                    Color.clear.preference(key: StackChipFramesKey.self, value: [proxy.frame(in: .named("stack"))])
                })
            }
        }
        .padding(4)
        .fixedSize()
        .coordinateSpace(name: "stack")
        .onPreferenceChange(StackChipFramesKey.self) { frames in model.chipFrames = frames }
        .background(GeometryReader { proxy in Color.clear.preference(key: StackSizeKey.self, value: proxy.size) })
        .onPreferenceChange(StackSizeKey.self) { size in model.contentSize = size }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        .animation(.easeOut(duration: 0.2), value: model.shown.map { "\($0.chip?.id ?? "consent")\($0.presentation.rawValue)" })
    }
}

/// The stack's palette: the notch's ink on a slightly lifted card, the way HeyClicky's cards sit over the page.
private enum StackInk {
    static var card: Color { NotchInk.ground.opacity(0.96) }
    static var edge: Color { Color.white.opacity(0.09) }
}

struct StackChipView: View {
    @ObservedObject var model: StackModel
    let chip: StackChip
    let presentation: AgentChip.Presentation
    @FocusState private var replyFocused: Bool

    private var text: Color { NotchInk.text }
    private var open: Bool { model.hovering == chip.id || model.expanded == chip.id }

    var body: some View {
        Group {
            if presentation == .avatar {
                StackAvatar(chip: chip, accent: model.accent, size: AgentChip.avatarSize)
                    .padding(0)
            } else if let morning = chip.morning {
                MorningCardView(card: morning, expanded: $model.morningExpanded, accent: model.accent,
                                decide: { item, yes in model.onMorningDecision?(item, yes) },
                                dismiss: { model.onMorningDismiss?() })
                    .frame(width: StackModel.cardWidth)
                    .background(StackInk.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .shadow(color: .black.opacity(0.3), radius: 8, y: 3)
            } else if chip.kind == .notice {
                noticeCard
            } else {
                card
            }
        }
        .contentShape(Rectangle())
        .onHover { inside in
            if inside { model.hovering = chip.id } else if model.hovering == chip.id { model.hovering = nil }
        }
    }

    // MARK: The card

    private var tone: Color {
        switch chip.state {
        case .running: return model.accent
        case .done: return NotchInk.good
        case .failed: return NotchInk.red
        case .stopped, .interrupted, .unfinished, .paused, .waiting, .attention, .consent: return NotchInk.warn
        case .notice: return model.accent
        }
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                StackAvatar(chip: chip, accent: model.accent, size: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text(chip.title).font(.system(size: 13, weight: .semibold)).foregroundStyle(text).lineLimit(1)
                    HStack(spacing: 5) {
                        Circle().fill(tone).frame(width: 6, height: 6)
                        Text(AgentChip.stateWord(chip.state, kind: chip.kind)).font(.system(size: 11, weight: .medium)).foregroundStyle(tone)
                        if chip.state == .running || chip.state == .paused {
                            Text(NotchHUDView.elapsed(since: chip.startedAt)).font(.system(size: 10.5, design: .monospaced)).foregroundStyle(text.opacity(0.4))
                        }
                        if let cost = chip.costText {
                            Text(cost).font(.system(size: 10.5, design: .monospaced)).foregroundStyle(text.opacity(0.45))
                        }
                    }
                }
                Spacer(minLength: 8)
                Button { model.onDismiss?(chip.id) } label: {
                    Image(systemName: "xmark").font(.system(size: 9, weight: .bold)).frame(width: 18, height: 18)
                        .background(Color.white.opacity(0.08), in: Circle())
                }
                .buttonStyle(.plain).foregroundStyle(text.opacity(0.55))
            }
            if !chip.line.isEmpty {
                if chip.holdUntil != nil, chip.state != .running {
                    // The line he did not hear (a muted Mac): all of it, to read.
                    Text(chip.line).font(.system(size: 12)).foregroundStyle(text.opacity(0.85)).lineLimit(6)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    LiveLine(text: chip.line, pulsing: chip.state == .running, color: text.opacity(0.75))
                }
            }
            if open, !chip.steps.isEmpty, chip.state == .running || chip.state == .paused || chip.state == .waiting {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(Array(chip.steps.suffix(3).enumerated()), id: \.offset) { _, step in
                        Text(step).font(.system(size: 11)).foregroundStyle(text.opacity(0.45)).lineLimit(1)
                    }
                }
            }
            if open, let result = chip.result, !result.isEmpty, chip.state != .running {
                if model.snapshot {
                    Text(result).font(.system(size: 12)).foregroundStyle(text.opacity(0.88)).lineLimit(8)
                        .frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true)
                } else {
                    ScrollView {
                        Text(result).font(.system(size: 12)).foregroundStyle(text.opacity(0.88)).textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(maxHeight: 150)
                }
            }
            if open, !chip.nextActions.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(chip.nextActions.prefix(3), id: \.self) { next in
                        Button {
                            model.expanded = nil
                            if next == AgentManager.continueLabel { model.onContinue?(chip.id) } else { model.onReply?(chip.id, next) }
                        } label: {
                            Text(next).font(.system(size: 11, weight: .semibold)).lineLimit(1).padding(.horizontal, 10).padding(.vertical, 4)
                                .background(model.accent, in: Capsule()).foregroundStyle(.black)
                        }.buttonStyle(.plain)
                    }
                }
            }
            buttons
            if open, chip.kind == .agent || chip.kind == .job, chip.canOpen || chip.isJob {
                replyField
            }
        }
        .padding(12)
        .frame(width: StackModel.cardWidth, alignment: .leading)
        .background(StackInk.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(StackInk.edge, lineWidth: 1))
        .shadow(color: .black.opacity(0.35), radius: 10, y: 4)
        .onTapGesture {
            if chip.state == .waiting { model.onFocusConsent?(chip.id); return }
            withAnimation(.easeOut(duration: 0.15)) { model.expanded = model.expanded == chip.id ? nil : chip.id }
        }
    }

    @ViewBuilder private var buttons: some View {
        HStack(spacing: 8) {
            Spacer(minLength: 0)
            if chip.state == .unfinished {
                GelButton(title: "Continue", accent: model.accent, primary: true) { model.onContinue?(chip.id) }
            }
            if chip.state == .consent {
                GelButton(title: "Not now", accent: model.accent, primary: false) { model.onDeny?(chip.id) }
                GelButton(title: "Allow", accent: model.accent, primary: true) { model.onAllow?(chip.id) }
            }
            if chip.canStop, chip.state == .running || chip.state == .paused {
                GelButton(title: "Stop", accent: model.accent, primary: false) { model.onStop?(chip.id) }
            }
            if chip.isJob, chip.state != .consent {
                GelButton(title: "Show me", accent: model.accent, primary: chip.state != .running) { model.onShow?(chip.id) }
            } else if chip.kind == .agent, chip.canOpen {
                GelButton(title: "Open", accent: model.accent, primary: chip.state != .running) { model.onOpenHome?(chip.id) }
            }
        }
    }

    private var replyField: some View {
        HStack {
            if model.snapshot {
                // ImageRenderer cannot draw an AppKit text field; the snapshot shows the field's look.
                Text("reply to \(chip.title.lowercased())").font(.system(size: 12.5)).foregroundStyle(text.opacity(0.35))
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
            TextField("reply to \(chip.title.lowercased())", text: $model.replyText)
                .textFieldStyle(.plain)
                .font(.system(size: 12.5))
                .foregroundStyle(text)
                .focused($replyFocused)
                .onChange(of: replyFocused) { _, focused in if focused { model.expanded = chip.id; model.onWantsKey?() } }
                .onSubmit {
                    let value = model.replyText.trimmingCharacters(in: .whitespacesAndNewlines)
                    model.replyText = ""
                    model.expanded = nil
                    replyFocused = false
                    if !value.isEmpty { model.onReply?(chip.id, value) }
                }
                .onExitCommand { model.replyText = ""; model.expanded = nil; replyFocused = false }
            }
            Text("return").font(.system(size: 10)).foregroundStyle(text.opacity(0.35))
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 9))
        .onTapGesture { model.expanded = chip.id; model.onWantsKey?(); replyFocused = true }
    }

    // MARK: A notice with an action

    private var noticeCard: some View {
        NoticeCard(notice: NotchNotice(id: chip.id, icon: chip.icon ?? "bell", title: chip.title, detail: chip.detail, tone: chip.tone,
                                       actionTitle: chip.actionTitle, action: chip.action, secondaryTitle: chip.secondaryTitle, secondary: chip.secondary,
                                       seconds: 0),
                   accent: model.accent) { model.onDismiss?(chip.id) }
            .frame(width: StackModel.cardWidth)
            .background(StackInk.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .shadow(color: .black.opacity(0.3), radius: 8, y: 3)
    }
}

/// The consent card from NotchHUD's queue: who asks, what for, Allow, Allow for this task, Not now.
struct StackConsentCard: View {
    @ObservedObject var model: StackModel
    let card: ConsentCard

    /// A tap in a card's first half second was aimed at the card before it (the buttons sit in the same place).
    private func settled(_ action: @escaping () -> Void) {
        guard Date().timeIntervalSince(model.consentShownAt) >= 0.5 else { return }
        action()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                StackAvatar(chip: StackChip(id: card.agentId, kind: .consent, title: card.agent, line: "", state: .consent), accent: model.accent, size: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(card.agent) wants to \(card.title)").font(.system(size: 13, weight: .semibold)).foregroundStyle(NotchInk.text)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 5) {
                        Circle().fill(NotchInk.warn).frame(width: 6, height: 6)
                        Text("needs your yes").font(.system(size: 11, weight: .medium)).foregroundStyle(NotchInk.warn)
                        if model.consentWaiting > 0 {
                            Text("+\(model.consentWaiting) waiting").font(.system(size: 10.5, weight: .semibold)).foregroundStyle(NotchInk.warn)
                                .padding(.horizontal, 6).padding(.vertical, 1)
                                .background(NotchInk.warn.opacity(0.14), in: Capsule())
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            if !card.detail.isEmpty {
                Text(card.detail).font(.system(size: 11.5, design: .monospaced)).foregroundStyle(NotchInk.text.opacity(0.65)).lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 8) {
                Spacer(minLength: 0)
                GelButton(title: "Not now", accent: model.accent, primary: false) { settled(card.onDeny) }
                if let always = card.onAlways { GelButton(title: "For this task", accent: model.accent, primary: false) { settled(always) } }
                GelButton(title: "Allow", accent: model.accent, primary: true) { settled(card.onAllow) }
            }
        }
        .padding(12)
        .frame(width: StackModel.cardWidth, alignment: .leading)
        .background(StackInk.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(model.accent.opacity(0.6), lineWidth: 1))
        .shadow(color: .black.opacity(0.35), radius: 10, y: 4)
    }
}

/// A chip's face: the agent's initial on a hue of its own (a job wears a window, the lecture an ear), with a
/// breathing ring while it works and a small mark for how it ended or what it needs.
struct StackAvatar: View {
    let chip: StackChip
    let accent: Color
    let size: CGFloat

    var body: some View {
        ZStack {
            if chip.state == .running {
                Circle().stroke(fill.opacity(0.55), lineWidth: 2).frame(width: size, height: size).modifier(StackBreathe())
            }
            Circle().fill(fill).frame(width: size * 0.86, height: size * 0.86)
                .shadow(color: fill.opacity(0.6), radius: size * 0.12)
            symbol
            if let badge {
                ZStack {
                    Circle().fill(badge.color).frame(width: size * 0.36, height: size * 0.36)
                    Image(systemName: badge.icon).font(.system(size: size * 0.2, weight: .heavy)).foregroundStyle(.black.opacity(0.85))
                }
                .overlay(Circle().stroke(NotchInk.ground, lineWidth: 1.5))
                .offset(x: size * 0.34, y: -size * 0.34)
            }
        }
        .frame(width: size, height: size)
    }

    @ViewBuilder private var symbol: some View {
        if chip.isJob {
            Image(systemName: "macwindow").font(.system(size: size * 0.36, weight: .semibold)).foregroundStyle(.black.opacity(0.78))
        } else if chip.id == "lecture" {
            Image(systemName: "ear").font(.system(size: size * 0.36, weight: .semibold)).foregroundStyle(.black.opacity(0.78))
        } else {
            Text(String(chip.title.prefix(1)).uppercased()).font(.system(size: size * 0.4, weight: .bold)).foregroundStyle(.black.opacity(0.8))
        }
    }

    private var badge: (icon: String, color: Color)? {
        switch chip.state {
        case .done: return ("checkmark", NotchInk.good)
        case .failed: return ("xmark", NotchInk.red)
        case .stopped, .interrupted: return ("stop.fill", NotchInk.warn)
        case .waiting, .attention, .consent: return ("exclamationmark", NotchInk.warn)
        case .unfinished: return ("ellipsis", NotchInk.warn)
        case .paused: return ("pause.fill", NotchInk.warn)
        case .running, .notice: return nil
        }
    }

    private var fill: Color {
        if chip.isJob || chip.id == "lecture" { return accent }
        var hash: UInt32 = 2166136261
        for byte in chip.title.utf8 { hash = (hash ^ UInt32(byte)) &* 16777619 }
        return Color(hue: Double(hash % 360) / 360, saturation: 0.45, brightness: 0.92)
    }
}

/// The working ring's slow breath, HeyClicky's soft glow around a busy avatar.
private struct StackBreathe: ViewModifier {
    @State private var on = false
    func body(content: Content) -> some View {
        content.scaleEffect(on ? 1.06 : 0.94).opacity(on ? 0.35 : 0.95)
            .onAppear { withAnimation(.easeInOut(duration: 1.3).repeatForever(autoreverses: true)) { on = true } }
    }
}
