import AppKit
import SwiftUI

/// The one ordinary window: agents, their transcripts and outputs, the ledger, and the
/// permission checklist. Everything else Dot does happens in the notch and the overlay.
@MainActor
final class HomeWindowController {
    private var window: NSWindow?
    private let model: HomeModel

    init(agents: AgentManager, ledger: Ledger, config: DotConfig) {
        model = HomeModel(agents: agents, ledger: ledger, config: config)
        agents.onRosterChanged = { [weak self] in Task { @MainActor in self?.model.reload() } }
    }

    func show() {
        model.reload()
        if window == nil {
            let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 880, height: 580), styleMask: [.titled, .closable, .miniaturizable, .resizable],
                                  backing: .buffered, defer: false)
            window.title = "Dot"
            window.isReleasedWhenClosed = false
            window.center()
            window.contentView = NSHostingView(rootView: HomeView(model: model))
            window.minSize = NSSize(width: 720, height: 460)
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
    @Published var claudeMD = ""
    @Published var runs: [Ledger.Row] = []
    @Published var permissions = Permissions.status()
    @Published var today: (turns: Int, costUSD: Double) = (0, 0)
    @Published var newAgentName = ""
    @Published var newAgentBrief = ""

    let agentManager: AgentManager
    let ledger: Ledger
    let config: DotConfig
    private var timer: Timer?

    init(agents: AgentManager, ledger: Ledger, config: DotConfig) {
        self.agentManager = agents
        self.ledger = ledger
        self.config = config
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
    }

    func select(_ agent: AgentManager.Agent?) {
        selected = agent
        guard let agent else { transcript = []; claudeMD = ""; runs = []; return }
        transcript = agentManager.transcript(for: agent)
        claudeMD = (try? String(contentsOf: agent.claudeMD, encoding: .utf8)) ?? ""
        runs = ledger.recent(limit: 30, agent: agent.slug)
    }

    func refreshLive() {
        permissions = Permissions.status()
        today = ledger.today()
        if let selected { transcript = agentManager.transcript(for: selected); runs = ledger.recent(limit: 30, agent: selected.slug) }
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
                    Text("\(model.today.turns) turns").font(.callout)
                    Text(String(format: "$%.2f at API prices", model.today.costUSD)).font(.callout).foregroundStyle(.secondary)
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
            if let agent = model.selected {
                detail(agent)
            } else {
                Text("No agent selected").foregroundStyle(.secondary)
            }
        }
        .sheet(isPresented: $showingNew) { newAgentSheet }
        .frame(minWidth: 720, minHeight: 460)
    }

    private func permissionRow(_ name: String, _ granted: Bool, action: @escaping () -> Void) -> some View {
        HStack {
            Image(systemName: granted ? "checkmark.circle.fill" : "exclamationmark.circle").foregroundStyle(granted ? .green : .orange)
            Text(name).font(.callout)
            Spacer()
            if !granted { Button("Grant", action: action).controlSize(.small) }
        }
    }

    private func detail(_ agent: AgentManager.Agent) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading) {
                    Text(agent.name).font(.title2.weight(.semibold))
                    Text(agent.folder.path.replacingOccurrences(of: NSHomeDirectory(), with: "~")).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Button("Output folder") { NSWorkspace.shared.open(agent.outputFolder) }
                Button("Open folder") { NSWorkspace.shared.open(agent.folder) }
            }
            HSplitView {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Transcript").font(.headline)
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(alignment: .leading, spacing: 6) {
                                ForEach(Array(model.transcript.enumerated()), id: \.offset) { _, entry in
                                    HStack(alignment: .top, spacing: 8) {
                                        Text(entry.role).font(.caption.monospaced()).foregroundStyle(.secondary).frame(width: 60, alignment: .trailing)
                                        Text(entry.text).font(.callout).textSelection(.enabled)
                                    }
                                }
                                Color.clear.frame(height: 1).id("end")
                            }
                            .padding(.vertical, 4)
                        }
                        .onChange(of: model.transcript.count) { _, _ in proxy.scrollTo("end") }
                    }
                }
                .frame(minWidth: 320)
                VStack(alignment: .leading, spacing: 6) {
                    Text("CLAUDE.md").font(.headline)
                    ScrollView { Text(model.claudeMD).font(.system(.callout, design: .monospaced)).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading) }
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
                .frame(minWidth: 260)
                .padding(.leading, 8)
            }
        }
        .padding(16)
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
