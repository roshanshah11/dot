import AppKit
import DotKit
import SwiftUI

/// The one ordinary window: his day as Atlas has it, the agents with their chats and
/// outputs, the ledger, and the permission checklist. Everything else Dot does happens
/// beside the cursor and in the notch.
@MainActor
final class HomeWindowController {
    private var window: NSWindow?
    private let model: HomeModel

    init(agents: AgentManager, ledger: Ledger, config: DotConfig, atlas: AtlasBridge) {
        model = HomeModel(agents: agents, ledger: ledger, config: config, atlas: atlas)
        agents.onRosterChanged = { [weak self] in Task { @MainActor in self?.model.reload() } }
        agents.onRunFinished = { [weak self] _ in Task { @MainActor in self?.model.refreshLive() } }
    }

    func show() {
        model.reload()
        if window == nil {
            let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 960, height: 640), styleMask: [.titled, .closable, .miniaturizable, .resizable],
                                  backing: .buffered, defer: false)
            window.title = "Dot"
            window.isReleasedWhenClosed = false
            window.center()
            window.contentView = NSHostingView(rootView: HomeView(model: model))
            window.minSize = NSSize(width: 760, height: 480)
            self.window = window
        }
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}

@MainActor
final class HomeModel: ObservableObject {
    @Published var agents: [AgentManager.Agent] = []
    @Published var selected: AgentManager.Agent?
    @Published var transcript: [(role: String, text: String)] = []
    @Published var outputs: [URL] = []
    @Published var claudeMD = ""
    @Published var runs: [Ledger.Row] = []
    @Published var permissions = Permissions.status()
    @Published var today: (turns: Int, costUSD: Double) = (0, 0)
    @Published var brief: TodayBrief?
    @Published var newAgentName = ""
    @Published var newAgentBrief = ""
    @Published var composer = ""
    @Published var showingCLAUDEMD = false

    let agentManager: AgentManager
    let ledger: Ledger
    let config: DotConfig
    let atlas: AtlasBridge
    private var timer: Timer?

    init(agents: AgentManager, ledger: Ledger, config: DotConfig, atlas: AtlasBridge) {
        self.agentManager = agents
        self.ledger = ledger
        self.config = config
        self.atlas = atlas
        timer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refreshLive() }
        }
    }

    func reload() {
        agents = agentManager.roster()
        if selected == nil || !agents.contains(where: { $0.slug == selected?.slug }) { selected = agents.first }
        select(selected)
        permissions = Permissions.status()
        today = ledger.today()
        brief = atlas.brief
    }

    func select(_ agent: AgentManager.Agent?) {
        selected = agent
        guard let agent else { transcript = []; claudeMD = ""; runs = []; outputs = []; return }
        transcript = agentManager.transcript(for: agent)
        claudeMD = (try? String(contentsOf: agent.claudeMD, encoding: .utf8)) ?? ""
        runs = ledger.recent(limit: 30, agent: agent.slug)
        outputs = agentManager.outputFiles(for: agent)
    }

    func refreshLive() {
        permissions = Permissions.status()
        today = ledger.today()
        brief = atlas.brief
        if let selected {
            transcript = agentManager.transcript(for: selected)
            runs = ledger.recent(limit: 30, agent: selected.slug)
            outputs = agentManager.outputFiles(for: selected)
        }
    }

    func send() {
        let text = composer.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, let selected else { return }
        composer = ""
        agentManager.reply(to: selected.slug, text: text)
        refreshLive()
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
}

struct HomeView: View {
    @ObservedObject var model: HomeModel
    @State private var showingNew = false
    @State private var tab = 0

    var body: some View {
        NavigationSplitView {
            List(selection: Binding(get: { model.selected?.slug }, set: { slug in model.select(model.agents.first { $0.slug == slug }) })) {
                Section("Agents") {
                    ForEach(model.agents) { agent in
                        HStack {
                            Circle().fill(model.agentManager.isRunning(agent) ? Color.orange : Color.secondary.opacity(0.4)).frame(width: 8, height: 8)
                            Text(agent.name)
                        }.tag(agent.slug)
                    }
                }
                Section("Today") {
                    if let brief = model.brief {
                        let week = brief.deadlines(withinDays: 7)
                        Text("\(week.count) deadline\(week.count == 1 ? "" : "s") this week").font(.callout)
                        Text("\(brief.today.count) on the calendar").font(.callout)
                        if brief.unansweredCount > 0 { Text("\(brief.unansweredCount) mail waiting").font(.callout) }
                        Text("from Atlas, \(brief.builtAt.suffix(5))").font(.caption).foregroundStyle(.secondary)
                    } else {
                        Text(model.atlas.available ? "reading Atlas…" : "Atlas not found").font(.callout).foregroundStyle(.secondary)
                    }
                    Text("\(model.today.turns) turns, " + String(format: "$%.2f", model.today.costUSD)).font(.caption).foregroundStyle(.secondary)
                }
                Section("Permissions") {
                    permissionRow("Microphone", model.permissions.microphone) { Permissions.requestMicrophone { _ in model.reload() }; Permissions.openSettings(.microphone) }
                    permissionRow("Screen Recording", model.permissions.screenRecording) { Permissions.requestScreenRecording(); Permissions.openSettings(.screenRecording) }
                    permissionRow("Accessibility", model.permissions.accessibility) { Permissions.requestAccessibility(); Permissions.openSettings(.accessibility) }
                }
            }
            .navigationSplitViewColumnWidth(min: 200, ideal: 230)
            .toolbar {
                Button { showingNew = true } label: { Label("New agent", systemImage: "plus") }
            }
        } detail: {
            VStack(spacing: 0) {
                Picker("", selection: $tab) {
                    Text("Agent").tag(0)
                    Text("Day").tag(1)
                }
                .pickerStyle(.segmented)
                .frame(width: 220)
                .padding(.top, 10)
                if tab == 1 {
                    dayView
                } else if let agent = model.selected {
                    detail(agent)
                } else {
                    Spacer()
                    Text("No agent selected").foregroundStyle(.secondary)
                    Spacer()
                }
            }
        }
        .sheet(isPresented: $showingNew) { newAgentSheet }
        .frame(minWidth: 760, minHeight: 480)
    }

    private func permissionRow(_ name: String, _ granted: Bool, action: @escaping () -> Void) -> some View {
        HStack {
            Image(systemName: granted ? "checkmark.circle.fill" : "exclamationmark.circle").foregroundStyle(granted ? .green : .orange)
            Text(name).font(.callout)
            Spacer()
            if !granted { Button("Grant", action: action).controlSize(.small) }
        }
    }

    // MARK: Day

    private var dayView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let brief = model.brief {
                    daySection("Deadlines", brief.deadlines)
                    daySection("Today", brief.today)
                    daySection("Tomorrow", brief.tomorrow)
                    daySection("Open commitments", brief.commitments)
                    daySection("To do", brief.todo)
                    daySection("Mail waiting (\(brief.unansweredCount))", brief.unanswered)
                    daySection("Priorities", brief.priorities)
                    daySection("Waiting on a decision", brief.waiting)
                    HStack {
                        Text("Read from Atlas at \(brief.builtAt.suffix(5))").font(.caption).foregroundStyle(.secondary)
                        Button("Refresh") { model.atlas.refresh(reason: "home") }.controlSize(.small)
                    }
                } else {
                    Text(model.atlas.available ? "Reading Atlas…" : "Atlas is not set up on this Mac (atlasRoot / atlasHarness in the config).")
                        .foregroundStyle(.secondary)
                }
            }
            .padding(16)
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

    // MARK: Agent

    private func detail(_ agent: AgentManager.Agent) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading) {
                    Text(agent.name).font(.title2.weight(.semibold))
                    Text(agent.folder.path.replacingOccurrences(of: NSHomeDirectory(), with: "~")).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Toggle("CLAUDE.md", isOn: $model.showingCLAUDEMD).toggleStyle(.button)
                Button("Open folder") { NSWorkspace.shared.open(agent.folder) }
            }
            HSplitView {
                chat
                    .frame(minWidth: 380)
                VStack(alignment: .leading, spacing: 8) {
                    if model.showingCLAUDEMD {
                        Text("CLAUDE.md").font(.headline)
                        ScrollView { Text(model.claudeMD).font(.system(.callout, design: .monospaced)).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading) }
                    } else {
                        Text("Output").font(.headline)
                        if model.outputs.isEmpty {
                            Text("Nothing in output/ yet.").font(.callout).foregroundStyle(.secondary)
                        }
                        ForEach(model.outputs.prefix(12), id: \.self) { url in
                            HStack {
                                Image(systemName: "doc").foregroundStyle(.secondary)
                                Text(url.lastPathComponent).font(.callout).lineLimit(1)
                                Spacer()
                                Button("Open") { NSWorkspace.shared.open(url) }.controlSize(.small)
                                Button("Reveal") { NSWorkspace.shared.activateFileViewerSelecting([url]) }.controlSize(.small)
                            }
                        }
                        Spacer(minLength: 8)
                        Text("Recent runs").font(.headline)
                        ForEach(model.runs.prefix(8)) { row in
                            HStack {
                                Text(row.timestamp, style: .time).font(.caption).foregroundStyle(.secondary)
                                Text(row.summary).font(.caption).lineLimit(1)
                                Spacer()
                                Text(String(format: "$%.3f", row.costUSD)).font(.caption.monospaced()).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .frame(minWidth: 260)
                .padding(.leading, 8)
            }
        }
        .padding(16)
    }

    private var chat: some View {
        VStack(spacing: 6) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 8) {
                        ForEach(Array(model.transcript.enumerated()), id: \.offset) { _, entry in
                            chatEntry(entry.role, entry.text)
                        }
                        Color.clear.frame(height: 1).id("end")
                    }
                    .padding(.vertical, 6)
                }
                .onChange(of: model.transcript.count) { _, _ in proxy.scrollTo("end") }
                .onAppear { proxy.scrollTo("end") }
            }
            HStack {
                TextField("Message \(model.selected?.name ?? "the agent")…", text: $model.composer, axis: .vertical)
                    .lineLimit(1...4)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { model.send() }
                Button("Send") { model.send() }.keyboardShortcut(.return, modifiers: .command)
                    .disabled(model.composer.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    @ViewBuilder
    private func chatEntry(_ role: String, _ text: String) -> some View {
        switch role {
        case "user":
            HStack {
                Spacer(minLength: 60)
                Text(text).font(.callout).textSelection(.enabled)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(Color.accentColor.opacity(0.18), in: RoundedRectangle(cornerRadius: 12))
            }
        case "assistant", "result":
            HStack {
                Text(text).font(.callout).textSelection(.enabled)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(role == "result" ? .secondary : .primary)
                Spacer(minLength: 60)
            }
        default:
            HStack(alignment: .top, spacing: 6) {
                Text(role).font(.caption2.monospaced()).foregroundStyle(.secondary).frame(width: 52, alignment: .trailing)
                Text(text).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                Spacer()
            }
        }
    }

    private var newAgentSheet: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("New agent").font(.title3.weight(.semibold))
            TextField("Name, like Recruiting or Notes", text: $model.newAgentName)
            TextField("First task or what it is for (optional)", text: $model.newAgentBrief, axis: .vertical).lineLimit(3...6)
            HStack {
                Spacer()
                Button("Cancel") { showingNew = false }
                Button("Create") { model.createAgent(); showingNew = false }.keyboardShortcut(.defaultAction)
                    .disabled(model.newAgentName.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(20)
        .frame(width: 440)
    }
}
