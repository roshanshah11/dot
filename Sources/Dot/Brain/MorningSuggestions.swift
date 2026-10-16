import AppKit
import DotKit
import Foundation

/// The morning card under the notch: a few things Dot could take on today, built from Atlas's
/// brief (deadlines, calls, mail waiting, commitments). "do it" hands the brief to an agent;
/// "skip" and "not today" are remembered in ~/Dot/suggestions.json so the same offer is not
/// made twice. Shown once a day after seven, when he is not mid-conversation or on a call; a card
/// he closed without deciding comes back twice more, twenty minutes apart (HeyClicky's cadence).
@MainActor
final class MorningSuggestions {
    private let config: DotConfig
    private let atlas: AtlasBridge
    private let hud: NotchHUD
    private let agents: AgentManager
    private let file: URL
    private var timer: Timer?
    private var shownToday = 0
    private var lastShownAt = Date.distantPast
    private var shownDate = ""
    /// Whether the companion can take the notch right now (idle, not on a call).
    var canShow: () -> Bool = { true }

    init(config: DotConfig, atlas: AtlasBridge, hud: NotchHUD, agents: AgentManager) {
        self.config = config
        self.atlas = atlas
        self.hud = hud
        self.agents = agents
        file = config.dotHome.appendingPathComponent("suggestions.json")
        hud.model.onMorningDecision = { [weak self] item, yes in self?.decided(item, yes: yes) }
        hud.model.onMorningDismiss = { [weak self] in self?.dismissed() }
    }

    func start() {
        guard config.morningSuggestions else { Log.info("morning: off in config"); return }
        timer = Timer.scheduledTimer(withTimeInterval: 120, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.consider() }
        }
        Log.info("morning: on; the card comes after seven, once he is idle")
    }

    /// Build and show the card when the day and the moment are right.
    func consider() {
        guard config.morningSuggestions, let brief = atlas.brief else { return }
        let hour = Calendar.current.component(.hour, from: Date())
        guard hour >= 7, hour < 21 else { return }
        let today = brief.date
        if shownDate != today { shownDate = today; shownToday = 0 }
        let state = load()
        if state.dismissed.contains(today) || shownToday >= 3 { return }
        guard Date().timeIntervalSince(lastShownAt) > 20 * 60, hud.model.morning == nil, canShow() else { return }
        let declined = Set(state.decisions.filter { Self.recent($0.date, days: 7) }.map(\.key))
        let items = MorningPlanner.suggestions(deadlines: brief.deadlines, today: brief.today, unanswered: brief.unanswered,
                                              commitments: brief.commitments, declined: declined)
        guard !items.isEmpty else { Log.info("morning: nothing to offer today"); return }
        shownToday += 1
        lastShownAt = Date()
        let card = MorningCard(greeting: MorningPlanner.greeting(count: items.count, hour: hour),
                               items: items.map { MorningCard.Item(id: $0.key, text: $0.text, brief: $0.brief) })
        hud.presentMorning(card)
        Log.info("morning: \(items.count) offer(s): " + items.map { Log.short($0.text, 50) }.joined(separator: " | "))
    }

    private func decided(_ item: MorningCard.Item, yes: Bool) {
        record(key: item.id, text: item.text, decision: yes ? "yes" : "skip")
        hud.morningDecided(item)
        if yes {
            agents.handoff(brief: item.brief, agentName: nil, context: nil, shots: nil)
            Log.info("morning: do it: \(Log.short(item.text, 70))")
        } else {
            Log.info("morning: skipped: \(Log.short(item.text, 70))")
        }
    }

    /// "not today" or the close button: either way the card is done for the day once he has seen the list.
    private func dismissed() {
        let today = atlas.brief?.date ?? Self.dayString(Date())
        if hud.model.morningExpanded || shownToday >= 3 {
            var state = load()
            if !state.dismissed.contains(today) { state.dismissed.append(today) }
            save(state)
        }
        hud.dismissMorning()
        Log.info("morning: dismissed")
    }

    // MARK: The file

    private struct Decision: Codable { let date: String; let key: String; let text: String; let decision: String }
    private struct State: Codable {
        var decisions: [Decision] = []
        var dismissed: [String] = []
    }

    private func load() -> State {
        guard let data = try? Data(contentsOf: file), let state = try? JSONDecoder().decode(State.self, from: data) else { return State() }
        return state
    }

    private func save(_ state: State) {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        if let data = try? encoder.encode(state) { try? data.write(to: file, options: .atomic) }
    }

    private func record(key: String, text: String, decision: String) {
        var state = load()
        state.decisions.append(Decision(date: Self.dayString(Date()), key: key, text: text, decision: decision))
        if state.decisions.count > 400 { state.decisions.removeFirst(state.decisions.count - 400) }
        save(state)
    }

    private static func dayString(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: date)
    }

    private static func recent(_ day: String, days: Int) -> Bool {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        guard let date = f.date(from: day) else { return false }
        return Date().timeIntervalSince(date) < Double(days) * 86400
    }
}
