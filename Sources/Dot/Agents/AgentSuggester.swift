import DotKit
import Foundation

/// Agents suggested from his asks (parity AG-17): Sunday evening, once a week, Dot reads the last 14 days of what he
/// asked it and offers an agent for each ask he made three or more times that no agent owns. A quiet card in the
/// stack (no voice, no chime): Start agent founds it and runs it once; Not now is remembered for 30 days.
@MainActor
final class AgentSuggester {
    private let config: DotConfig
    private let agents: AgentManager
    private let hud: NotchHUD
    private var timer: Timer?
    /// Whether a card may go up now (not on a call, Dot idle); the app supplies it.
    var canShow: (() -> Bool)?

    struct State: Codable { var lastSweep: Date?; var dismissed: [String: Date] = [:] }

    private var stateURL: URL { config.dotHome.appendingPathComponent(".agent-suggestions.json") }

    init(config: DotConfig, agents: AgentManager, hud: NotchHUD) {
        self.config = config
        self.agents = agents
        self.hud = hud
    }

    func start() {
        timer = Timer.scheduledTimer(withTimeInterval: 900, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 120) { [weak self] in self?.tick() }
    }

    func tick(now: Date = Date()) {
        var state = loadState()
        guard AgentSuggestions.isDue(lastSweep: state.lastSweep, now: now), canShow?() ?? true else { return }
        state.lastSweep = now
        saveState(state)
        let found = Self.suggestions(config: config, agents: agents.roster(), dismissed: state.dismissed, now: now)
        Log.info("agent suggestions: weekly sweep found \(found.count)\(found.isEmpty ? "" : ": " + found.map { "\($0.name) (\($0.count))" }.joined(separator: ", "))")
        for s in found.prefix(2) { show(s) }
    }

    private func show(_ s: AgentSuggestions.Suggestion) {
        hud.notify(NotchNotice(id: "agent-suggestion-\(s.key)", icon: "person.badge.plus", title: "An agent for this?", detail: s.line, tone: .info,
                               actionTitle: "Start agent", action: { [weak self] in self?.startAgent(s) },
                               secondaryTitle: "Not now", secondary: { [weak self] in self?.notNow(s) }, seconds: 0))
    }

    private func startAgent(_ s: AgentSuggestions.Suggestion) {
        let agent = agents.handoff(brief: s.brief, agentName: s.name, context: nil, shots: nil, fresh: true)
        Log.info("agent suggestions: started \(agent.slug) for \"\(s.key)\"")
    }

    private func notNow(_ s: AgentSuggestions.Suggestion) {
        var state = loadState()
        state.dismissed[s.key] = Date()
        // a dismissal older than the snooze no longer says anything
        state.dismissed = state.dismissed.filter { Date().timeIntervalSince($0.value) < AgentSuggestions.snooze }
        saveState(state)
        Log.info("agent suggestions: not now for \"\(s.key)\" (30 days)")
    }

    /// The sweep itself, also run by `Dot --agent-suggest` (prints, shows no card).
    nonisolated static func suggestions(config: DotConfig, agents: [AgentManager.Agent], dismissed: [String: Date], now: Date) -> [AgentSuggestions.Suggestion] {
        let file = TranscriptLog.directory.appendingPathComponent("transcripts.jsonl")
        let asks = AgentSuggestions.asks(jsonl: (try? String(contentsOf: file, encoding: .utf8)) ?? "")
        let owned = agents.filter { $0.slug != "dot" }.map { agent -> String in
            let md = (try? String(contentsOf: agent.claudeMD, encoding: .utf8)) ?? ""
            let brief = (try? String(contentsOf: agent.folder.appendingPathComponent(".dot/brief.txt"), encoding: .utf8)) ?? ""
            return [agent.name, String(md.prefix(4000)), brief].joined(separator: "\n")
        }
        return AgentSuggestions.sweep(asks: asks, owned: owned, dismissed: dismissed, now: now)
    }

    private func loadState() -> State {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode(State.self, from: Data(contentsOf: stateURL))) ?? State()
    }

    private func saveState(_ state: State) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(state) { try? data.write(to: stateURL, options: .atomic) }
    }
}
