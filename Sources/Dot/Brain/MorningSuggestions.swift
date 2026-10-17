import AppKit
import DotKit
import Foundation

/// The morning card under the notch: a few things Dot could take on today, from the scout's briefs
/// in ~/Dot/briefs/<today>.json (scripts/dot-scout.py, 06:30) or, without them, from Atlas's brief
/// (deadlines, calls, mail waiting, commitments). "do it" hands the brief to its agent, founding a
/// new one; "skip" and "not today" are remembered in ~/Dot/suggestions.json by the brief's stable
/// id, so the same offer is not made twice and the next scout run learns from them. Shown once a
/// day after seven, when he is not mid-conversation or on a call; a card he closed without deciding
/// comes back twice more, twenty minutes apart (HeyClicky's cadence).
@MainActor
final class MorningSuggestions {
    private let config: DotConfig
    private let atlas: AtlasBridge
    private let hud: NotchHUD
    private let agents: AgentManager
    private let file: URL
    private let briefsFolder: URL
    private var timer: Timer?
    /// What is on the card by item id, so "do it" has the agent, routine and sources.
    private var offered: [String: MorningSuggestion] = [:]
    private var shownToday = 0
    private var lastShownAt = Date.distantPast
    private var shownDate = ""
    /// Whether the companion can take the notch right now (idle, not on a call).
    var canShow: () -> Bool = { true }
    /// Registers a "do it" brief's routine (agent name, when, brief); true when it took. Unset until the
    /// wiring batch points it at RoutineScheduler.add with runFirstNow false: the handoff is run one.
    var addRoutine: ((_ agentName: String, _ when: String, _ brief: String) -> Bool)?

    init(config: DotConfig, atlas: AtlasBridge, hud: NotchHUD, agents: AgentManager) {
        self.config = config
        self.atlas = atlas
        self.hud = hud
        self.agents = agents
        file = config.dotHome.appendingPathComponent("suggestions.json")
        briefsFolder = config.dotHome.appendingPathComponent("briefs", isDirectory: true)
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
        guard config.morningSuggestions else { return }
        let hour = Calendar.current.component(.hour, from: Date())
        guard hour >= 7, hour < 21 else { return }
        let brief = atlas.brief
        let today = brief?.date ?? Self.dayString(Date())
        if shownDate != today { shownDate = today; shownToday = 0 }
        let state = load()
        if state.dismissed.contains(today) || shownToday >= 3 { return }
        guard Date().timeIntervalSince(lastShownAt) > 20 * 60, hud.model.morning == nil, canShow() else { return }
        let scout = ScoutBriefFile.load(from: briefsFolder)
        guard scout != nil || brief != nil else { return }
        if let scout {
            Log.info("morning: today's scout briefs: \(scout.briefs.count)" + (scout.problems.isEmpty ? "" : "; " + scout.problems.prefix(4).joined(separator: "; ")))
        }
        let declined = Set(state.decisions.filter { Self.recent($0.date, days: 7) }.map(\.key))
        let items = MorningPlanner.suggestions(scout: scout, deadlines: brief?.deadlines ?? [], today: brief?.today ?? [], unanswered: brief?.unanswered ?? [],
                                              commitments: brief?.commitments ?? [], declined: declined)
        guard !items.isEmpty else { Log.info("morning: nothing to offer today"); return }
        shownToday += 1
        lastShownAt = Date()
        offered = Dictionary(items.map { ($0.key, $0) }, uniquingKeysWith: { a, _ in a })
        let titles = items.contains { $0.title != nil } ? items.map(MorningPlanner.greetingWords) : []
        let card = MorningCard(greeting: MorningPlanner.greeting(count: items.count, hour: hour, titles: titles),
                               items: items.map { MorningCard.Item(id: $0.key, text: $0.text, brief: $0.brief) })
        hud.presentMorning(card)
        Log.info("morning: \(items.count) offer(s)\(scout != nil ? " from the scout" : ""): " + items.map { Log.short($0.text, 50) }.joined(separator: " | "))
    }

    /// By voice while the card is up (MB-07): "do it" takes the first item still on the card, "skip"
    /// passes it, "do it but ..." takes it with his change. Returns what Dot says; nil with no card.
    func decideFirst(yes: Bool, adjust: String? = nil) -> String? {
        guard let item = hud.model.morning?.items.first else { return nil }
        decided(item, yes: yes, adjust: adjust)
        let what = item.text.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: ". "))
        return yes ? "on it: \(what)." : "skipped \(what)."
    }

    private func decided(_ item: MorningCard.Item, yes: Bool, adjust: String? = nil) {
        record(key: item.id, text: item.text, decision: yes ? "yes" : "skip")
        hud.morningDecided(item)
        guard yes else { Log.info("morning: skipped: \(item.id): \(Log.short(item.text, 70))"); return }
        let suggestion = offered[item.id] ?? MorningSuggestion(key: item.id, text: item.text, brief: item.brief)
        // A scout brief names its agent; handoff founds it when it is new. A template gets a job agent of its own.
        let change = adjust.map { "\n\nHis change when he said yes: \($0)" } ?? ""
        let used = agents.handoff(brief: suggestion.handoffBrief + change, agentName: suggestion.agentName, context: nil, shots: nil)
        let who = suggestion.agentName ?? used.name   // an unnamed one founded a job agent; its routine goes there
        var line = "morning: do it: \(item.id) to \(who)" + (suggestion.agentRole.map { " (new, \($0))" } ?? "")
        if let routine = suggestion.routine {
            let brief = suggestion.routineBrief ?? suggestion.brief
            if let addRoutine {
                line += addRoutine(who, routine.when, brief) ? "; routine \"\(routine.title)\" \(routine.when) added" : "; routine \"\(routine.when)\" not understood"
            } else {
                line += "; routine \"\(routine.title)\" \(routine.when) not registered (no routine hook yet)"
            }
        }
        Log.info(line + ": \(Log.short(item.text, 70))")
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
