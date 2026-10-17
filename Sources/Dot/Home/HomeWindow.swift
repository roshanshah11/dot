import AppKit
import DotKit
import Quartz
import SwiftUI
import UniformTypeIdentifiers

/// The one ordinary window, after HeyClicky's Home: a rail of agents on the left with a
/// status dot and an unread dot, the selected agent's thread in the middle (his messages,
/// the agent's words, each step it took, what it made), the outputs with a preview on the
/// right, and pages for his day, Dot's settings, his skills and the offers Dot has made.
@MainActor
final class HomeWindowController {
    private var window: NSWindow?
    private let model: HomeModel

    /// Speaks a line in the voice Dot loaded, for the Voice page's preview buttons.
    var speakSample: ((String) -> Void)? {
        get { model.speakSample }
        set { model.speakSample = newValue }
    }

    /// Called with the new settings after Save has written config.json.
    var onSettingsChanged: ((DotConfig) -> Void)? {
        get { model.onSettingsChanged }
        set { model.onSettingsChanged = newValue }
    }

    /// The routine scheduler, for the Agents page.
    var scheduler: RoutineScheduler? {
        get { model.scheduler }
        set { model.scheduler = newValue }
    }

    init(agents: AgentManager, ledger: Ledger, config: DotConfig, atlas: AtlasBridge) {
        model = HomeModel(agents: agents, ledger: ledger, config: config, atlas: atlas)
        agents.onRosterChanged = { [weak self] in Task { @MainActor in self?.model.reload() } }
        agents.onRunFinished = { [weak self] _ in Task { @MainActor in self?.model.refreshLive() } }
    }

    /// The agent thread he has open in front of him (VO-04): Home is the key window, on an agent's page.
    var focusedThread: String? {
        guard let window, window.isVisible, window.isKeyWindow, model.page == .agent else { return nil }
        return model.selected?.slug
    }

    func show(agent slug: String? = nil) {
        model.reload()
        if let slug, let agent = model.agents.first(where: { $0.slug == slug }) { model.select(agent); model.page = .agent }
        if window == nil {
            let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1120, height: 700), styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                                  backing: .buffered, defer: false)
            window.title = "Dot"
            window.titlebarAppearsTransparent = true
            window.isReleasedWhenClosed = false
            window.center()
            window.contentView = NSHostingView(rootView: HomeView(model: model))
            window.minSize = NSSize(width: 900, height: 560)
            self.window = window
        }
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}

struct TranscriptEntry: Identifiable, Equatable {
    let id: Int
    let role: String
    let text: String
    let time: Date?
}

/// A transcript row as the thread draws it. A step owns the "output" and "tool_error" rows
/// written right after it, so those are only ever seen by opening the step.
struct ThreadItem: Identifiable, Equatable {
    let entry: TranscriptEntry
    var outputs: [TranscriptEntry] = []
    var outputLines = 0
    /// The first file a turn made: Home previews it under its row (TC-04).
    var isFirstFile = false
    var id: Int { entry.id }
    var failed: Bool { outputs.contains { $0.role == "tool_error" } }

    static func group(_ entries: [TranscriptEntry]) -> [ThreadItem] {
        var items: [ThreadItem] = []
        var attaching = false
        var fileShown = false
        for entry in entries {
            if entry.role == "user" { fileShown = false }
            if entry.role == "output" || entry.role == "tool_error" {
                let text = entry.text.trimmingCharacters(in: .newlines)
                if attaching, !text.isEmpty {
                    items[items.count - 1].outputs.append(entry)
                    items[items.count - 1].outputLines += text.split(omittingEmptySubsequences: false, whereSeparator: \.isNewline).count
                }
                continue
            }
            var item = ThreadItem(entry: entry)
            if entry.role == "artifact", !fileShown { item.isFirstFile = true; fileShown = true }
            items.append(item)
            attaching = entry.role == "tool"
        }
        return items
    }
}

@MainActor
final class HomeModel: ObservableObject {
    /// `settings` is the General page.
    enum Page: Equatable { case agent, day, settings, voice, microphone, dictation, shortcuts, cursor, skills, suggestions, agents }

    @Published var page: Page = .agent
    @Published var agents: [AgentManager.Agent] = []
    @Published var selected: AgentManager.Agent?
    @Published var entries: [TranscriptEntry] = [] { didSet { items = ThreadItem.group(entries) } }
    /// The thread as drawn, regrouped once per transcript change rather than per row.
    private(set) var items: [ThreadItem] = []
    @Published var outputs: [URL] = []
    @Published var previewURL: URL?
    @Published var showOutputs = true
    @Published var showCLAUDEMD = false
    @Published var claudeMD = ""
    @Published var runs: [Ledger.Row] = []
    @Published var permissions = Permissions.status()
    @Published var today: (turns: Int, costUSD: Double) = (0, 0)
    @Published var brief: TodayBrief?
    @Published var newAgentName = ""
    @Published var newAgentBrief = ""
    @Published var composer = ""
    @Published var attachments: [URL] = []
    @Published var filter = ""
    @Published var lastLines: [String: String] = [:]
    @Published var lastActivity: [String: Date] = [:]
    @Published var unread: Set<String> = []
    @Published var running: Set<String> = []
    @Published var settings: DotConfig
    @Published var settingsNote: String?
    @Published var renaming: AgentManager.Agent?
    @Published var renameText = ""
    /// Round six: rules, routines and spend for the Agents page.
    @Published var rules = AgentRules.standard
    @Published var routines: [Routine] = []
    @Published var spend: [String: Double] = [:]
    var scheduler: RoutineScheduler? {
        didSet {
            scheduler?.onChanged = { [weak self] in Task { @MainActor in self?.refreshRoutines() } }
            refreshRoutines()
        }
    }

    let agentManager: AgentManager
    let ledger: Ledger
    let config: DotConfig
    let atlas: AtlasBridge
    let dictionary = DictionaryEditor()
    var speakSample: ((String) -> Void)?
    var onSettingsChanged: ((DotConfig) -> Void)?
    /// The settings as last written, to tell the pages there is something to save.
    private var savedSettings: Data?
    private var timer: Timer?
    private let defaults = UserDefaults.standard

    init(agents: AgentManager, ledger: Ledger, config: DotConfig, atlas: AtlasBridge) {
        self.agentManager = agents
        self.ledger = ledger
        self.config = config
        self.atlas = atlas
        self.settings = config
        self.savedSettings = Self.encoded(config)
        timer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refreshLive() }
        }
    }

    // MARK: Rail

    var pinned: Set<String> {
        get { Set(defaults.stringArray(forKey: "dot.home.pinned") ?? []) }
        set { defaults.set(Array(newValue), forKey: "dot.home.pinned"); objectWillChange.send() }
    }

    func togglePin(_ agent: AgentManager.Agent) {
        var set = pinned
        if set.contains(agent.slug) { set.remove(agent.slug) } else { set.insert(agent.slug) }
        pinned = set
    }

    /// Pinned first, then whoever is working, then the most recent conversation.
    var railAgents: [AgentManager.Agent] {
        let needle = filter.trimmingCharacters(in: .whitespaces).lowercased()
        let pins = pinned
        return agents
            .filter { needle.isEmpty || $0.name.lowercased().contains(needle) || (lastLines[$0.slug] ?? "").lowercased().contains(needle) }
            .sorted { a, b in
                let pa = pins.contains(a.slug), pb = pins.contains(b.slug)
                if pa != pb { return pa }
                let ra = running.contains(a.slug), rb = running.contains(b.slug)
                if ra != rb { return ra }
                return (lastActivity[a.slug] ?? .distantPast) > (lastActivity[b.slug] ?? .distantPast)
            }
    }

    func refreshRoutines() {
        routines = scheduler?.routines ?? []
        rules = agentManager.rules
        spend = ledger.spendByAgent(since: Date().addingTimeInterval(-7 * 86400))
    }

    func setRule(_ behavior: ActionBehavior?, for cls: ActionClass, agent slug: String?) {
        agentManager.rules.set(behavior, for: cls, agent: slug)
        agentManager.saveRules()
        rules = agentManager.rules
    }

    func resetRules(scope slug: String?) {
        if let slug { agentManager.rules.agents.removeValue(forKey: slug) } else { agentManager.rules.defaults = AgentRules.standard.defaults }
        agentManager.saveRules()
        rules = agentManager.rules
    }

    /// nil when the routine was added; else a line saying why not.
    func addRoutine(agentSlug: String, when: String, brief: String) -> String? {
        guard let scheduler else { return "routines are off" }
        guard let agent = agents.first(where: { $0.slug == agentSlug }) else { return "pick an agent" }
        guard scheduler.add(agentName: agent.name, when: when, brief: brief) != nil else { return "couldn't read when: try \"every morning at 8\" or \"weekdays at 9:30\"" }
        refreshRoutines()
        return nil
    }

    func setRoutinePaused(_ id: String, _ paused: Bool) { scheduler?.setPaused(id, paused); refreshRoutines() }
    func fixRoutine(_ id: String) { scheduler?.fix(id); refreshRoutines() }
    func runRoutineNow(_ id: String) { scheduler?.runNow(id); refreshRoutines(); refreshLive() }
    func removeRoutine(_ id: String) { scheduler?.remove(id); refreshRoutines() }

    func reload() {
        refreshRoutines()
        agents = agentManager.roster()
        if selected == nil || !agents.contains(where: { $0.slug == selected?.slug }) { selected = agents.first }
        refreshLive()
        select(selected)
        permissions = Permissions.status()
        brief = atlas.brief
    }

    func select(_ agent: AgentManager.Agent?) {
        selected = agent
        guard let agent else { entries = []; claudeMD = ""; runs = []; outputs = []; previewURL = nil; return }
        entries = agentManager.transcriptEntries(for: agent)
        claudeMD = (try? String(contentsOf: agent.claudeMD, encoding: .utf8)) ?? ""
        runs = ledger.recent(limit: 30, agent: agent.slug)
        outputs = agentManager.outputFiles(for: agent)
        if previewURL == nil || !outputs.contains(previewURL!) { previewURL = outputs.first }
        markSeen(agent)
    }

    func markSeen(_ agent: AgentManager.Agent) {
        defaults.set(Date(), forKey: "dot.home.seen.\(agent.slug)")
        unread.remove(agent.slug)
    }

    func refreshLive() {
        permissions = Permissions.status()
        today = ledger.today()
        brief = atlas.brief
        running = Set(agentManager.roster().filter { agentManager.hasTurnInFlight($0) }.map(\.slug))
        var lines: [String: String] = [:], times: [String: Date] = [:], fresh: Set<String> = []
        for agent in agents {
            let file = agent.folder.appendingPathComponent(".dot/transcript.jsonl")
            let modified = (try? FileManager.default.attributesOfItem(atPath: file.path)[.modificationDate] as? Date) ?? .distantPast
            times[agent.slug] = modified
            if let last = agentManager.transcriptEntries(for: agent, limit: 3).last(where: { $0.role == "assistant" || $0.role == "user" }) {
                lines[agent.slug] = Log.short(last.text.replacingOccurrences(of: "\n", with: " "), 70)
            }
            let seen = defaults.object(forKey: "dot.home.seen.\(agent.slug)") as? Date ?? .distantPast
            if modified > seen, agent.slug != selected?.slug || !(NSApp.keyWindow?.title == "Dot") { fresh.insert(agent.slug) }
        }
        lastLines = lines
        lastActivity = times
        unread = fresh
        if let selected {
            let latest = agentManager.transcriptEntries(for: selected)
            if latest != entries { entries = latest }
            runs = ledger.recent(limit: 30, agent: selected.slug)
            let files = agentManager.outputFiles(for: selected)
            if files != outputs {
                outputs = files
                if previewURL == nil || !files.contains(previewURL!) { previewURL = files.first }
            }
            if NSApp.keyWindow?.title == "Dot" { markSeen(selected) }
        }
    }

    // MARK: Actions

    func send() {
        var text = composer.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty || !attachments.isEmpty, let selected else { return }
        if !attachments.isEmpty {
            text += (text.isEmpty ? "" : "\n\n") + "Attached files:\n" + attachments.map { "- \($0.path)" }.joined(separator: "\n")
        }
        composer = ""
        attachments = []
        agentManager.reply(to: selected.slug, text: text)
        refreshLive()
    }

    func stop(_ agent: AgentManager.Agent) {
        agentManager.stop(agent.slug)
        refreshLive()
    }

    func archive(_ agent: AgentManager.Agent) {
        agentManager.archive(agent)
        reload()
    }

    func rename() {
        guard let agent = renaming else { return }
        let name = renameText.trimmingCharacters(in: .whitespaces)
        if !name.isEmpty { agentManager.rename(agent, to: name) }
        renaming = nil
        reload()
    }

    func createAgent() {
        let name = newAgentName.trimmingCharacters(in: .whitespaces)
        let brief = newAgentBrief.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        let agent = agentManager.ensureAgent(named: name)
        if !brief.isEmpty {
            agentManager.handoff(brief: "You were just created for this. First task: \(brief)", agentName: name, context: nil, shots: nil)
        }
        newAgentName = ""
        newAgentBrief = ""
        reload()
        select(agent)
    }

    func saveSettings() {
        settings.save()
        savedSettings = Self.encoded(settings)
        onSettingsChanged?(settings)
        settingsNote = "saved to ~/.config/dot/config.json; voice, hotkey and model changes take effect when Dot relaunches"
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in self?.settingsNote = nil }
    }

    var hasUnsavedSettings: Bool { Self.encoded(settings) != savedSettings }

    private static func encoded(_ config: DotConfig) -> Data? {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        return try? encoder.encode(config)
    }

    /// Restarts Dot through its launch agent so the voice loads again. Unsaved settings are
    /// written first; working agents stop with the process.
    func relaunch() {
        if hasUnsavedSettings { saveSettings() }
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/bin/launchctl")
        task.arguments = ["kickstart", "-k", "gui/\(getuid())/com.roshan.dot"]
        // Success kills this process, so only a failure is ever reported.
        task.terminationHandler = { [weak self] process in
            let status = process.terminationStatus
            guard status != 0 else { return }
            Task { @MainActor in self?.settingsNote = "relaunch failed (launchctl exit \(status)); is Dot running from its launch agent?" }
        }
        do { try task.run() } catch { settingsNote = "relaunch failed: \(error.localizedDescription)" }
    }

    /// The next-action offers (up to four, TC-02) the selected agent made, if its latest words were a result.
    var nextActions: [String] {
        guard let last = entries.last(where: { $0.role == "assistant" }) else { return [] }
        guard let idx = entries.firstIndex(of: last), !entries[idx...].contains(where: { $0.role == "user" }) else { return [] }
        return AgentResult.parse(last.text).nextActions
    }
}

// MARK: - View

struct HomeView: View {
    @ObservedObject var model: HomeModel
    @State private var showingNew = false
    @State private var openSteps: Set<String> = []

    private let accent = HomeStyle.accent

    var body: some View {
        HStack(spacing: 0) {
            rail.frame(width: 240)
            Divider()
            switch model.page {
            case .agent:
                if let agent = model.selected {
                    thread(agent)
                    if model.showOutputs {
                        Divider()
                        outputsColumn(agent).frame(width: 300)
                    }
                } else {
                    VStack { Spacer(); Text("No agent yet. Make one, or hold control+option+shift and say what it should do.").foregroundStyle(.secondary); Spacer() }
                        .frame(maxWidth: .infinity)
                }
            case .day: dayView
            case .settings: settingsView
            case .voice: VoicePage(model: model)
            case .microphone: MicrophonePage(model: model)
            case .dictation: DictationPage(model: model, editor: model.dictionary)
            case .shortcuts: ShortcutsPage()
            case .cursor: CursorPage(model: model)
            case .skills: SkillsPage()
            case .suggestions: SuggestionsPage(model: model)
            case .agents: AgentsPage(model: model)
            }
        }
        .sheet(isPresented: $showingNew) { newAgentSheet }
        .sheet(item: $model.renaming) { agent in renameSheet(agent) }
        .frame(minWidth: 900, minHeight: 560)
        .onAppear { model.reload() }
    }

    // MARK: Rail

    private var rail: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Circle().fill(accent).frame(width: 10, height: 10).shadow(color: accent.opacity(0.7), radius: 4)
                Text("Dot").font(.system(size: 15, weight: .semibold))
                Spacer()
                Button { showingNew = true } label: { Image(systemName: "plus") }.buttonStyle(.plain).help("New agent")
            }
            .padding(.horizontal, 14).padding(.top, 36).padding(.bottom, 8)
            TextField("Search agents", text: $model.filter)
                .textFieldStyle(.roundedBorder).controlSize(.small)
                .padding(.horizontal, 12).padding(.bottom, 6)
            ScrollView {
                LazyVStack(spacing: 2) {
                    ForEach(model.railAgents) { agent in railRow(agent) }
                }
                .padding(.horizontal, 8)
            }
            Divider().padding(.vertical, 4)
            pageRow("Day", icon: "sun.max", page: .day, detail: model.brief.map { "\($0.today.count) today · \($0.deadlines(withinDays: 7).count) due" })
            // HeyClicky's sidebar groups: its own settings, then Work.
            railHeader("Dot")
            pageRow("General", icon: "slider.horizontal.3", page: .settings, detail: nil)
            pageRow("Voice", icon: "waveform", page: .voice, detail: nil)
            pageRow("Microphone", icon: "mic", page: .microphone, detail: nil)
            pageRow("Dictation", icon: "text.cursor", page: .dictation, detail: nil)
            pageRow("Shortcuts", icon: "keyboard", page: .shortcuts, detail: nil)
            pageRow("Cursor", icon: "cursorarrow", page: .cursor, detail: nil)
            railHeader("Work")
            pageRow("Skills", icon: "books.vertical", page: .skills, detail: nil)
            pageRow("Suggestions", icon: "lightbulb", page: .suggestions, detail: nil)
            pageRow("Agents", icon: "person.2", page: .agents, detail: model.routines.isEmpty ? nil : "\(model.routines.filter { !$0.paused }.count) routine\(model.routines.filter { !$0.paused }.count == 1 ? "" : "s") on")
            HStack(spacing: 8) {
                usageRing
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(model.today.turns) turns today").font(.system(size: 11, weight: .medium))
                    Text(String(format: "$%.2f", model.today.costUSD)).font(.system(size: 10.5)).foregroundStyle(.secondary)
                }
                Spacer()
                if !model.permissions.allGranted {
                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange).help("A permission is missing; see General")
                        .onTapGesture { model.page = .settings }
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var usageRing: some View {
        ZStack {
            Circle().stroke(Color.primary.opacity(0.1), lineWidth: 3)
            Circle().trim(from: 0, to: min(CGFloat(model.today.turns) / 60, 1)).stroke(accent, style: .init(lineWidth: 3, lineCap: .round)).rotationEffect(.degrees(-90))
        }
        .frame(width: 22, height: 22)
    }

    private func railHeader(_ title: String) -> some View {
        Text(title).font(.system(size: 10.5, weight: .semibold)).foregroundStyle(.tertiary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 18).padding(.top, 8).padding(.bottom, 2)
    }

    private func pageRow(_ title: String, icon: String, page: HomeModel.Page, detail: String?) -> some View {
        Button { model.page = page } label: {
            HStack(spacing: 10) {
                Image(systemName: icon).frame(width: 18).foregroundStyle(model.page == page ? accent : .secondary)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).font(.system(size: 13, weight: .medium))
                    if let detail { Text(detail).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1) }
                }
                Spacer()
            }
            .padding(.horizontal, 10).padding(.vertical, detail == nil ? 4 : 6)
            .background(model.page == page ? Color.primary.opacity(0.07) : .clear, in: RoundedRectangle(cornerRadius: 8))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 8)
    }

    private func railRow(_ agent: AgentManager.Agent) -> some View {
        let selected = model.page == .agent && model.selected?.slug == agent.slug
        let running = model.running.contains(agent.slug)
        return Button {
            model.page = .agent
            model.select(agent)
        } label: {
            HStack(spacing: 10) {
                ZStack(alignment: .bottomTrailing) {
                    Circle().fill(accent.opacity(0.18)).frame(width: 32, height: 32)
                        .overlay(Text(String(agent.name.prefix(1)).uppercased()).font(.system(size: 14, weight: .semibold)).foregroundStyle(accent))
                    if running {
                        Circle().fill(Color.orange).frame(width: 9, height: 9).overlay(Circle().stroke(Color(nsColor: .windowBackgroundColor), lineWidth: 2))
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text(agent.name).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                        if model.pinned.contains(agent.slug) { Image(systemName: "pin.fill").font(.system(size: 8)).foregroundStyle(.secondary) }
                        Spacer()
                        if let time = model.lastActivity[agent.slug], time > .distantPast {
                            Text(Self.relative(time)).font(.system(size: 10.5)).foregroundStyle(.secondary)
                        }
                    }
                    Text(running ? "working…" : (model.lastLines[agent.slug] ?? "nothing yet"))
                        .font(.system(size: 11.5)).foregroundStyle(running ? accent : .secondary).lineLimit(1)
                }
                if model.unread.contains(agent.slug) {
                    Circle().fill(accent).frame(width: 7, height: 7)
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 6)
            .background(selected ? Color.primary.opacity(0.08) : .clear, in: RoundedRectangle(cornerRadius: 9))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(model.pinned.contains(agent.slug) ? "Unpin" : "Pin to the top") { model.togglePin(agent) }
            Button("Rename…") { model.renameText = agent.name; model.renaming = agent }
            Button("Open folder") { NSWorkspace.shared.open(agent.folder) }
            Button("Open output folder") { NSWorkspace.shared.open(agent.outputFolder) }
            Divider()
            if running { Button("Stop") { model.stop(agent) } }
            if agent.slug != "dot" { Button("Archive") { model.archive(agent) } }
        }
    }

    static func relative(_ date: Date) -> String {
        let s = Int(Date().timeIntervalSince(date))
        if s < 60 { return "now" }
        if s < 3600 { return "\(s / 60)m" }
        if s < 86400 { return "\(s / 3600)h" }
        return "\(s / 86400)d"
    }

    // MARK: Thread

    private func thread(_ agent: AgentManager.Agent) -> some View {
        let running = model.running.contains(agent.slug)
        return VStack(spacing: 0) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(agent.name).font(.system(size: 17, weight: .semibold))
                    HStack(spacing: 6) {
                        if running {
                            BreathingDot(color: accent)
                            Text("working").font(.system(size: 11.5)).foregroundStyle(accent)
                        } else {
                            Text("idle").font(.system(size: 11.5)).foregroundStyle(.secondary)
                        }
                        Text(agent.folder.path.replacingOccurrences(of: NSHomeDirectory(), with: "~")).font(.system(size: 11)).foregroundStyle(.tertiary).lineLimit(1)
                    }
                }
                Spacer()
                if running { Button("Stop") { model.stop(agent) }.controlSize(.small) }
                Toggle(isOn: $model.showCLAUDEMD) { Image(systemName: "doc.text") }.toggleStyle(.button).controlSize(.small).help("Identity (CLAUDE.md)")
                Toggle(isOn: $model.showOutputs) { Image(systemName: "sidebar.right") }.toggleStyle(.button).controlSize(.small).help("Outputs")
            }
            .padding(.horizontal, 18).padding(.top, 34).padding(.bottom, 8)
            Divider()
            AgentProfileStrip(model: model, agent: agent)
            Divider()
            if model.showCLAUDEMD {
                ScrollView {
                    Text(model.claudeMD).font(.system(.callout, design: .monospaced)).textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(18)
                }
            } else {
                transcript(agent, running: running)
            }
            Divider()
            composer(agent)
        }
    }

    private func transcript(_ agent: AgentManager.Agent, running: Bool) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 10) {
                    if model.entries.isEmpty {
                        Text("Nothing yet. Hold shift as well to send it to an agent, or type below.").font(.callout).foregroundStyle(.secondary).padding(.top, 20)
                    }
                    ForEach(model.items) { item in entryView(item) }
                    if running {
                        HStack(spacing: 8) {
                            BreathingDot(color: accent)
                            Text(model.lastLines[agent.slug].map { "working: \($0)" } ?? "working").font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
                        }
                        .padding(.leading, 4)
                    } else if !model.nextActions.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(model.nextActions.prefix(4), id: \.self) { next in
                                Button {
                                    model.composer = next
                                    model.send()
                                } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: "arrow.turn.down.right").font(.system(size: 10, weight: .bold))
                                        Text(next).font(.system(size: 12, weight: .semibold))
                                    }
                                    .padding(.horizontal, 12).padding(.vertical, 6)
                                    .background(accent.opacity(0.18), in: Capsule())
                                    .overlay(Capsule().stroke(accent.opacity(0.5), lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    Color.clear.frame(height: 1).id("end")
                }
                .padding(.horizontal, 18).padding(.vertical, 12)
            }
            .onChange(of: model.entries.count) { _, _ in withAnimation { proxy.scrollTo("end") } }
            .onAppear { proxy.scrollTo("end") }
        }
    }

    @ViewBuilder
    private func entryView(_ item: ThreadItem) -> some View {
        let entry = item.entry
        switch entry.role {
        case "user":
            HStack(alignment: .bottom) {
                Spacer(minLength: 80)
                VStack(alignment: .trailing, spacing: 3) {
                    Text(entry.text).font(.system(size: 13)).textSelection(.enabled)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(accent.opacity(0.2), in: RoundedRectangle(cornerRadius: 14))
                    if let time = entry.time { Text(time, style: .time).font(.system(size: 10)).foregroundStyle(.tertiary) }
                }
            }
        case "assistant":
            let body = AgentResult.parse(entry.text).body
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(Self.markdown(body)).font(.system(size: 13)).textSelection(.enabled)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
                    // Past a screenful the bubble loses tables, math and headings; the reader keeps them.
                    if body.count > 600 { readButton { read(message: body, at: entry.time) }.padding(.leading, 6) }
                }
                Spacer(minLength: 60)
            }
        case "result":
            HStack(spacing: 6) {
                Image(systemName: entry.text.hasPrefix("success") ? "checkmark.circle.fill" : "exclamationmark.circle").font(.system(size: 10)).foregroundStyle(entry.text.hasPrefix("success") ? .green : .orange)
                Text(entry.text).font(.system(size: 10.5)).foregroundStyle(.secondary)
                Spacer()
            }
            .padding(.leading, 4)
        case "tool":
            if item.outputs.isEmpty {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: Self.stepIcon(entry.text)).font(.system(size: 10)).foregroundStyle(.secondary).frame(width: 14)
                    Text(entry.text).font(.system(size: 11.5, design: .monospaced)).foregroundStyle(.secondary).lineLimit(2).textSelection(.enabled)
                    Spacer()
                }
                .padding(.leading, 6)
            } else {
                let key = Self.stepKey(entry)
                let open = openSteps.contains(key)
                VStack(alignment: .leading, spacing: 6) {
                    Button {
                        withAnimation(.easeOut(duration: 0.15)) {
                            if open { openSteps.remove(key) } else { openSteps.insert(key) }
                        }
                    } label: {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: Self.stepIcon(entry.text)).font(.system(size: 10)).foregroundStyle(.secondary).frame(width: 14)
                            Text(entry.text).font(.system(size: 11.5, design: .monospaced)).foregroundStyle(.secondary).lineLimit(2)
                            HStack(spacing: 3) {
                                Text(item.outputLines == 1 ? "1 line" : "\(item.outputLines) lines")
                                Image(systemName: "chevron.right").font(.system(size: 7, weight: .bold)).rotationEffect(.degrees(open ? 90 : 0))
                            }
                            .font(.system(size: 10)).foregroundStyle(item.failed ? Color.orange : Color.secondary).opacity(0.75).padding(.top, 1)
                            Spacer()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if open { stepOutput(item.outputs) }
                }
                .padding(.leading, 6)
            }
        case "output", "tool_error":
            EmptyView()
        case "artifact":
            // A file the turn made or changed (round seven, G1): open it or drag it out.
            // By name inside output/; by full path or URL when the agent named a file elsewhere (TC-04).
            let url = entry.text.hasPrefix("/") ? URL(fileURLWithPath: entry.text)
                : entry.text.contains("://") ? URL(string: entry.text) : model.selected?.outputFolder.appendingPathComponent(entry.text)
            HStack(spacing: 8) {
                Image(systemName: url.map(Self.fileIcon) ?? "doc").font(.system(size: 10)).foregroundStyle(url.flatMap(Theme.fileColor) ?? accent).frame(width: 14)
                Text(entry.text).font(.system(size: 11.5)).lineLimit(1)
                if let url, !url.isFileURL || FileManager.default.fileExists(atPath: url.path) {
                    Button("open") { NSWorkspace.shared.open(url) }.buttonStyle(.link).font(.system(size: 11))
                }
                Spacer()
            }
            .padding(.leading, 6)
            .onDrag { url.map { NSItemProvider(object: $0 as NSURL) } ?? NSItemProvider() }
            if item.isFirstFile, let url, url.isFileURL, FileManager.default.fileExists(atPath: url.path),
               ["pdf", "png", "jpg", "jpeg", "gif", "heic", "html", "pptx", "key", "docx", "xlsx", "md"].contains(url.pathExtension.lowercased()) {
                QuickLookPreview(url: url).frame(width: 300, height: 190).clipShape(RoundedRectangle(cornerRadius: 8)).padding(.leading, 28)
            }
        case "title":
            // The turn's done title (TC-01).
            Text(entry.text).font(.system(size: 12, weight: .semibold)).foregroundStyle(.secondary).padding(.leading, 6)
        case "routine":
            HStack(spacing: 8) {
                Image(systemName: "clock.arrow.circlepath").font(.system(size: 10)).foregroundStyle(.secondary).frame(width: 14)
                Text(entry.text).font(.system(size: 11.5)).foregroundStyle(.secondary).lineLimit(1)
                Spacer()
            }
            .padding(.leading, 6)
        case "next":
            HStack(spacing: 8) {
                Image(systemName: "arrow.turn.down.right").font(.system(size: 10)).foregroundStyle(.secondary).frame(width: 14)
                Text("offered next: \(entry.text)").font(.system(size: 11.5)).foregroundStyle(.secondary).lineLimit(1)
                Spacer()
            }
            .padding(.leading, 6)
        case "progress":
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "person.2").font(.system(size: 10)).foregroundStyle(.secondary).frame(width: 14)
                Text(entry.text).font(.system(size: 11.5)).foregroundStyle(.secondary).lineLimit(2)
                Spacer()
            }
            .padding(.leading, 6)
        default:
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "hand.raised").font(.system(size: 10)).foregroundStyle(.orange).frame(width: 14)
                Text("\(entry.role): \(entry.text)").font(.system(size: 11.5)).foregroundStyle(.secondary).lineLimit(2)
                Spacer()
            }
            .padding(.leading, 6)
        }
    }

    static func stepIcon(_ line: String) -> String {
        let l = line.lowercased()
        if l.hasPrefix("reading") || l.hasPrefix("looking at") { return "doc.text.magnifyingglass" }
        if l.hasPrefix("writing") || l.hasPrefix("editing") || l.hasPrefix("saving") { return "pencil.line" }
        if l.hasPrefix("searching") || l.contains("web") || l.contains("http") { return "globe" }
        if l.contains("atlas") { return "circle.hexagongrid" }
        if l.hasPrefix("running") || l.hasPrefix("$") { return "terminal" }
        if l.contains("click") || l.contains("window") || l.contains("screen") { return "cursorarrow.click" }
        return "circle.dotted"
    }

    /// Steps are remembered by time and text, not by row id: ids are positions in the last 300
    /// rows and shift as the transcript grows, which would open the wrong step.
    static func stepKey(_ entry: TranscriptEntry) -> String {
        "\(entry.time?.timeIntervalSince1970 ?? 0)|\(entry.text)"
    }

    /// What a step returned, under the step on demand; an error reads in orange so a failed
    /// step stands out from a long successful one.
    private func stepOutput(_ outputs: [TranscriptEntry]) -> some View {
        let failed = outputs.contains { $0.role == "tool_error" }
        return VStack(alignment: .leading, spacing: 6) {
            ForEach(outputs) { row in
                Text(row.text).font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(row.role == "tool_error" ? Color.orange : Color.primary.opacity(0.75))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.leading, 10).padding(.trailing, 44).padding(.vertical, 8)
        .background((failed ? Color.orange : Color.primary).opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
        .overlay(alignment: .topTrailing) {
            Button("copy") {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(outputs.map(\.text).joined(separator: "\n"), forType: .string)
            }
            .buttonStyle(.plain).font(.system(size: 10.5)).foregroundStyle(.secondary).padding(7)
        }
        .padding(.leading, 22)
    }

    private func readButton(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: "book").font(.system(size: 9.5, weight: .semibold))
                Text("read").font(.system(size: 11, weight: .medium))
            }
            .foregroundStyle(accent)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(accent.opacity(0.12), in: Capsule())
        }
        .buttonStyle(.plain)
        .help("Open in a reading window")
    }

    /// The reader keys text by title, so the message time keeps two long answers from the
    /// same agent in separate windows.
    private func read(message body: String, at time: Date?) {
        guard let agent = model.selected else { return }
        let when = time.map { $0.formatted(date: .omitted, time: .standard) } ?? "message"
        MarkdownViewer.show(text: body, title: "\(agent.name) · \(when)", baseURL: agent.folder)
    }

    static func markdown(_ text: String) -> AttributedString {
        (try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(text)
    }

    private func composer(_ agent: AgentManager.Agent) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if !model.attachments.isEmpty {
                HStack(spacing: 6) {
                    ForEach(model.attachments, id: \.self) { url in
                        HStack(spacing: 4) {
                            Image(systemName: "paperclip").font(.system(size: 9))
                            Text(url.lastPathComponent).font(.system(size: 11)).lineLimit(1)
                            Button { model.attachments.removeAll { $0 == url } } label: { Image(systemName: "xmark").font(.system(size: 8, weight: .bold)) }.buttonStyle(.plain)
                        }
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color.primary.opacity(0.07), in: Capsule())
                    }
                    Spacer()
                }
            }
            HStack(alignment: .bottom, spacing: 8) {
                TextField("Message \(agent.name)… (drop files here to attach)", text: $model.composer, axis: .vertical)
                    .lineLimit(1...6)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13))
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
                    .onSubmit { model.send() }
                Button {
                    model.send()
                } label: {
                    Image(systemName: "arrow.up").font(.system(size: 12, weight: .bold)).frame(width: 30, height: 30)
                        .background(accent, in: Circle()).foregroundStyle(.black)
                }
                .buttonStyle(.plain)
                .keyboardShortcut(.return, modifiers: .command)
                .disabled(model.composer.trimmingCharacters(in: .whitespaces).isEmpty && model.attachments.isEmpty)
            }
            Text("return to send · drop a file to attach it · a card asks you before anything sends or submits").font(.system(size: 10.5)).foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 18).padding(.vertical, 10)
        .onDrop(of: [.fileURL], isTargeted: nil) { providers in
            for provider in providers {
                provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier) { item, _ in
                    guard let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) else { return }
                    Task { @MainActor in if !model.attachments.contains(url) { model.attachments.append(url) } }
                }
            }
            return true
        }
    }

    // MARK: Outputs

    private func outputsColumn(_ agent: AgentManager.Agent) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Outputs").font(.system(size: 13, weight: .semibold))
                Spacer()
                Button { NSWorkspace.shared.open(agent.outputFolder) } label: { Image(systemName: "folder") }.buttonStyle(.plain).foregroundStyle(.secondary)
            }
            .padding(.top, 36)
            if let url = model.previewURL {
                QuickLookPreview(url: url)
                    .frame(maxWidth: .infinity, minHeight: 200, maxHeight: 320)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.primary.opacity(0.1), lineWidth: 1))
                HStack(spacing: 6) {
                    Button("Open") { NSWorkspace.shared.open(url) }.controlSize(.small)
                    Button("Reveal") { NSWorkspace.shared.activateFileViewerSelecting([url]) }.controlSize(.small)
                    Button("Copy path") { NSPasteboard.general.clearContents(); NSPasteboard.general.setString(url.path, forType: .string) }.controlSize(.small)
                }
            } else {
                Text("Nothing in output/ yet.").font(.callout).foregroundStyle(.secondary)
            }
            ScrollView {
                LazyVStack(spacing: 2) {
                    ForEach(model.outputs.prefix(40), id: \.self) { url in
                        let markdown = MarkdownViewer.isMarkdown(url)
                        HStack(spacing: 6) {
                            Button { model.previewURL = url } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: Self.fileIcon(url)).foregroundStyle(Theme.fileColor(url) ?? .secondary).frame(width: 16)
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(url.lastPathComponent).font(.system(size: 12)).lineLimit(1)
                                        Text(Self.fileMeta(url)).font(.system(size: 10)).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                }
                                .padding(.leading, 8).padding(.vertical, 5)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            // QuickLook shows Markdown as raw text, so a double-click on a Markdown output opens the reader.
                            .simultaneousGesture(TapGesture(count: 2).onEnded { if markdown { MarkdownViewer.show(file: url) } })
                            if markdown { readButton { MarkdownViewer.show(file: url) } }
                        }
                        .padding(.trailing, 8)
                        .background(model.previewURL == url ? Color.primary.opacity(0.08) : .clear, in: RoundedRectangle(cornerRadius: 7))
                        .contextMenu {
                            Button("Open") { NSWorkspace.shared.open(url) }
                            Button("Reveal in Finder") { NSWorkspace.shared.activateFileViewerSelecting([url]) }
                            Button("Copy to Desktop") {
                                let dest = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Desktop").appendingPathComponent(url.lastPathComponent)
                                try? FileManager.default.copyItem(at: url, to: dest)
                            }
                        }
                    }
                }
            }
            if !model.runs.isEmpty {
                Divider()
                Text("Runs").font(.system(size: 12, weight: .semibold))
                ForEach(model.runs.prefix(5)) { row in
                    HStack {
                        Text(row.timestamp, style: .time).font(.system(size: 10.5)).foregroundStyle(.secondary)
                        Text(row.summary).font(.system(size: 10.5)).lineLimit(1)
                        Spacer()
                        Text(String(format: "$%.2f", row.costUSD)).font(.system(size: 10.5, design: .monospaced)).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(.horizontal, 14).padding(.bottom, 12)
    }

    static func fileIcon(_ url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "pdf": return "doc.richtext"
        case "png", "jpg", "jpeg", "gif", "heic": return "photo"
        case "html", "htm": return "globe"
        case "pptx", "key": return "rectangle.on.rectangle"
        case "xlsx", "csv": return "tablecells"
        case "md", "txt": return "doc.text"
        default: return "doc"
        }
    }

    static func fileMeta(_ url: URL) -> String {
        let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
        let size = values?.fileSize.map { ByteCountFormatter.string(fromByteCount: Int64($0), countStyle: .file) } ?? ""
        let when = values?.contentModificationDate.map { Self.relative($0) } ?? ""
        return [size, when].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    // MARK: Day

    private var dayView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Your day").font(.title2.weight(.semibold)).padding(.top, 30)
                if let brief = model.brief {
                    daySection("Deadlines", brief.deadlines)
                    daySection("Today", brief.today)
                    daySection("Tomorrow", brief.tomorrow)
                    daySection("Open commitments", brief.commitments)
                    daySection("To do", brief.todo)
                    daySection("Mail waiting (\(brief.unansweredCount))", brief.unanswered)
                    daySection("Priorities", brief.priorities)
                    daySection("Waiting on a decision", brief.waiting)
                    daySection("How he likes things", brief.preferences)
                    HStack {
                        Text("Read from Atlas at \(brief.builtAt.suffix(5))").font(.caption).foregroundStyle(.secondary)
                        Button("Refresh") { model.atlas.refresh(reason: "home") }.controlSize(.small)
                    }
                } else {
                    Text(model.atlas.available ? "Reading Atlas…" : "Atlas is not set up on this Mac (atlasRoot / atlasHarness in the config).")
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 24).padding(.bottom, 24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private func daySection(_ title: String, _ lines: [String]) -> some View {
        if !lines.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                    Text(line).font(.callout).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    // MARK: Settings

    /// General. Voice speed and the notch tab moved to the Voice and Cursor pages.
    private var settingsView: some View {
        SettingsPage("General") {
            HomeSection("Talking") {
                Toggle("Speak the first sentence while the rest is still coming", isOn: $model.settings.eagerSpeech)
                Toggle("Good-morning line once a day", isOn: $model.settings.morningGreeting)
            }
            HomeSection("Speaking up") {
                ChattinessPicker(level: $model.settings.chattiness)
                SettingToggle("Context lines", detail: "a small model writes each quip for the moment: the app, the next event, the time; off keeps to the written lines",
                              isOn: $model.settings.contextQuips)
                    .disabled(model.settings.chattiness == 0)
                    .padding(.top, 4)
            }
            HomeSection("Agents") {
                Toggle("Say when an agent finishes", isOn: $model.settings.speakAgentResults)
                Toggle("Dot may move the cursor and click the ringed steps on \"do it\"", isOn: $model.settings.driveEnabled)
                HStack { Text("Close an idle agent after"); Stepper("\(model.settings.agentIdleMinutes) min", value: $model.settings.agentIdleMinutes, in: 1...120).frame(width: 130) }
            }
            HomeSection("Models") {
                HStack { Text("Talk").frame(width: 60, alignment: .leading); TextField("sonnet", text: $model.settings.talkModel).frame(width: 160); Text("effort"); TextField("low", text: Binding(get: { model.settings.talkEffort ?? "" }, set: { model.settings.talkEffort = $0.isEmpty ? nil : $0 })).frame(width: 70) }
                HStack { Text("Think").frame(width: 60, alignment: .leading); TextField("opus", text: $model.settings.thinkModel).frame(width: 160) }
                HStack { Text("Quips").frame(width: 60, alignment: .leading); TextField("haiku", text: $model.settings.quipModel).frame(width: 160) }
                HStack { Text("Agents").frame(width: 60, alignment: .leading); TextField("opus", text: $model.settings.agentModel).frame(width: 160); Text("effort"); TextField("", text: Binding(get: { model.settings.agentEffort ?? "" }, set: { model.settings.agentEffort = $0.isEmpty ? nil : $0 })).frame(width: 70) }
            }
            HomeSection("What Dot knows") {
                Text("Markdown files in ~/Dot/talk/context ride along in every talk turn: a course map, a project brief, the names it should know.").font(.callout).foregroundStyle(.secondary)
                HStack {
                    Button("Open context folder") {
                        let dir = model.config.talkRootURL.appendingPathComponent("context")
                        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
                        NSWorkspace.shared.open(dir)
                    }.controlSize(.small)
                    Button("Open config.json") { NSWorkspace.shared.open(DotConfig.fileURL) }.controlSize(.small)
                    Button("Open agents folder") { NSWorkspace.shared.open(model.config.agentsRootURL) }.controlSize(.small)
                }
            }
            HomeSection("Permissions") {
                permissionRow("Microphone", model.permissions.microphone) { Permissions.requestMicrophone { _ in model.reload() }; Permissions.openSettings(.microphone) }
                permissionRow("Screen Recording", model.permissions.screenRecording) { Permissions.requestScreenRecording(); Permissions.openSettings(.screenRecording) }
                permissionRow("Accessibility", model.permissions.accessibility) { Permissions.requestAccessibility(); Permissions.openSettings(.accessibility) }
            }
            SettingsSaveBar(model: model)
        }
    }

    private func permissionRow(_ name: String, _ granted: Bool, action: @escaping () -> Void) -> some View {
        HStack {
            Image(systemName: granted ? "checkmark.circle.fill" : "exclamationmark.circle").foregroundStyle(granted ? .green : .orange)
            Text(name).font(.callout)
            Spacer()
            if !granted { Button("Grant", action: action).controlSize(.small) }
        }
    }

    // MARK: Sheets

    private var newAgentSheet: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("New agent").font(.title3.weight(.semibold))
            Text("A named agent keeps its own folder, notes and conversation. Give it a job and it keeps that job.").font(.callout).foregroundStyle(.secondary)
            TextField("Name, like Inbox Keeper or Lab Desk", text: $model.newAgentName)
            TextField("First task or what it is for (optional)", text: $model.newAgentBrief, axis: .vertical).lineLimit(3...6)
            HStack {
                Spacer()
                Button("Cancel") { showingNew = false }
                Button("Create") { model.createAgent(); showingNew = false }.keyboardShortcut(.defaultAction)
                    .disabled(model.newAgentName.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(20)
        .frame(width: 460)
    }

    private func renameSheet(_ agent: AgentManager.Agent) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Rename \(agent.name)").font(.title3.weight(.semibold))
            TextField("Name", text: $model.renameText)
            HStack {
                Spacer()
                Button("Cancel") { model.renaming = nil }
                Button("Rename") { model.rename() }.keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 380)
    }
}

struct BreathingDot: View {
    let color: Color
    @State private var on = false
    var body: some View {
        Circle().fill(color).frame(width: 8, height: 8)
            .scaleEffect(on ? 1.25 : 0.85).opacity(on ? 1 : 0.55)
            .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: on)
            .onAppear { on = true }
    }
}

/// QuickLook's own preview for an output: PDFs, images, html, decks.
struct QuickLookPreview: NSViewRepresentable {
    let url: URL
    func makeNSView(context: Context) -> QLPreviewView {
        let view = QLPreviewView(frame: NSRect(x: 0, y: 0, width: 280, height: 300), style: .normal) ?? QLPreviewView()
        view.autostarts = true
        view.shouldCloseWithWindow = false
        view.previewItem = url as QLPreviewItem
        return view
    }
    func updateNSView(_ view: QLPreviewView, context: Context) {
        if (view.previewItem as? URL) != url {
            view.previewItem = url as QLPreviewItem
            view.refreshPreviewItem()
        }
    }
}
