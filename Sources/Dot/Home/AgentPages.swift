import AppKit
import DotKit
import SwiftUI

// The Agents page: rules (what agents do on their own, ask about, or leave to him), helpers,
// routines and spend. After the Agents page of HeyClicky's Home, the Custom Rules and Scheduled
// tab of OpenAI's dots, and Muse's per-app access choices.

struct AgentsPage: View {
    @ObservedObject var model: HomeModel
    /// "" is the defaults; else an agent's slug whose overrides are being edited.
    @State private var scope = ""
    @State private var routineAgent = "dot"
    @State private var routineWhen = ""
    @State private var routineBrief = ""
    @State private var routineNote: String?

    var body: some View {
        SettingsPage("Agents", subtitle: "Who may do what on their own, who runs on a schedule, and what it all costs.") {
            rules
            HomeSection("Helpers") {
                SettingToggle("Let an agent use helpers",
                              detail: "For independent parts of a job an agent may hand them to helpers (Claude Code subagents on Opus, two at most), then merge and report once. Dot shows \"with 2 helpers\" while they run.",
                              isOn: $model.settings.agentHelpers)
            }
            routines
            spend
            SettingsSaveBar(model: model)
        }
    }

    // MARK: Rules

    private var rules: some View {
        HomeSection("Rules") {
            Text("Each kind of action gets one of four behaviors, the way dots' custom rules work: do it, only if the brief asked for it, ask first, or leave it to you. Protected folders and risky commands keep their own checks underneath.")
                .font(.callout).foregroundStyle(.secondary)
            Picker("For", selection: $scope) {
                Text("every agent (defaults)").tag("")
                ForEach(model.agents) { agent in Text(agent.name).tag(agent.slug) }
            }
            .frame(maxWidth: 320)
            ForEach(ActionClass.allCases, id: \.rawValue) { cls in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(cls.title).font(.system(size: 13, weight: .medium))
                        Text(cls.detail).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Picker("", selection: binding(for: cls)) {
                        if !scope.isEmpty { Text("same as default (\(model.rules.behavior(for: cls).title))").tag("inherit") }
                        ForEach(ActionBehavior.allCases, id: \.rawValue) { b in Text(b.title).tag(b.rawValue) }
                    }
                    .labelsHidden()
                    .frame(width: 210)
                }
                .padding(.vertical, 2)
            }
            HStack(spacing: 10) {
                Text("Saved to ~/Dot/rules.json as you change them.").font(.caption).foregroundStyle(.tertiary)
                Spacer()
                Button("Back to Dot's defaults") { model.resetRules(scope: scope.isEmpty ? nil : scope) }.controlSize(.small)
            }
        }
    }

    private func binding(for cls: ActionClass) -> Binding<String> {
        Binding(
            get: {
                if scope.isEmpty { return model.rules.behavior(for: cls).rawValue }
                return model.rules.override(for: cls, agent: scope)?.rawValue ?? "inherit"
            },
            set: { raw in
                let behavior = ActionBehavior(rawValue: raw)
                model.setRule(behavior, for: cls, agent: scope.isEmpty ? nil : scope)
            }
        )
    }

    // MARK: Routines

    private var routines: some View {
        HomeSection("Routines") {
            SettingToggle("Run routines while Dot is open",
                          detail: "A standing agent's task on a schedule. Say it (\"every morning at eight, have Email draft the replies\") or add one here. Runs wait for the internet and for a call to end; three failed runs in a row pause one.",
                          isOn: $model.settings.routines)
            if model.routines.isEmpty {
                Text("No routines yet.").font(.callout).foregroundStyle(.secondary)
            } else {
                ForEach(model.routines) { routine in routineRow(routine) }
            }
            Divider().padding(.vertical, 4)
            VStack(alignment: .leading, spacing: 8) {
                Text("New routine").font(.system(size: 12.5, weight: .semibold))
                HStack(spacing: 8) {
                    Picker("Agent", selection: $routineAgent) {
                        ForEach(model.agents) { agent in Text(agent.name).tag(agent.slug) }
                    }
                    .frame(maxWidth: 220)
                    TextField("when: every morning at 8, weekdays at 9:30, mondays at 7 pm, every 3 hours", text: $routineWhen)
                }
                TextField("what it does, in a sentence", text: $routineBrief, axis: .vertical).lineLimit(2...4)
                HStack {
                    Button("Add routine") {
                        let note = model.addRoutine(agentSlug: routineAgent, when: routineWhen, brief: routineBrief)
                        routineNote = note
                        if note == nil { routineWhen = ""; routineBrief = "" }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 5) { routineNote = nil }
                    }
                    .controlSize(.small)
                    .disabled(routineWhen.trimmingCharacters(in: .whitespaces).isEmpty || routineBrief.trimmingCharacters(in: .whitespaces).isEmpty)
                    if let routineNote { Text(routineNote).font(.caption).foregroundStyle(.orange) }
                }
            }
        }
        .onAppear { if !model.agents.contains(where: { $0.slug == routineAgent }), let first = model.agents.first { routineAgent = first.slug } }
    }

    private func routineRow(_ routine: Routine) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: routine.paused ? "pause.circle" : "clock.arrow.2.circlepath")
                .foregroundStyle(routine.paused ? Color.orange : HomeStyle.accent).frame(width: 18).padding(.top, 2)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(routine.agentName).font(.system(size: 13, weight: .semibold))
                    Text(routine.schedule.words).font(.system(size: 12)).foregroundStyle(.secondary)
                    if routine.paused { HomeBadge(text: "paused", color: .orange) }
                    if routine.failures > 0, !routine.paused { HomeBadge(text: "\(routine.failures) failed", color: .orange) }
                }
                Text(routine.brief).font(.system(size: 12.5)).lineLimit(2)
                HStack(spacing: 6) {
                    if let last = routine.lastRun { Text("last \(HomeView.relative(last)) ago").font(.caption).foregroundStyle(.tertiary) }
                    if !routine.paused { Text("next \(routine.nextRun.formatted(date: .abbreviated, time: .shortened))").font(.caption).foregroundStyle(.tertiary) }
                    if let note = routine.lastNote { Text(note).font(.caption).foregroundStyle(.orange).lineLimit(1) }
                }
            }
            Spacer()
            HStack(spacing: 6) {
                Button(routine.paused ? "Resume" : "Pause") { model.setRoutinePaused(routine.id, !routine.paused) }
                Button("Run now") { model.runRoutineNow(routine.id) }
                Button(role: .destructive) { model.removeRoutine(routine.id) } label: { Image(systemName: "trash") }
            }
            .controlSize(.small)
        }
        .padding(.vertical, 4)
    }

    // MARK: Spend

    private var spend: some View {
        HomeSection("Spend, last 7 days") {
            if model.spend.isEmpty {
                Text("Nothing yet.").font(.callout).foregroundStyle(.secondary)
            } else {
                ForEach(model.spend.sorted { $0.value > $1.value }, id: \.key) { slug, cost in
                    HStack {
                        Text(model.agents.first(where: { $0.slug == slug })?.name ?? (slug == "talk" ? "Dot talking" : slug)).font(.system(size: 13))
                        Spacer()
                        Text(String(format: "$%.2f", cost)).font(.system(size: 13, design: .monospaced)).foregroundStyle(.secondary)
                    }
                }
                Text("What the Claude CLI reports per turn; the Max plan covers it.").font(.caption).foregroundStyle(.tertiary)
            }
        }
    }
}

/// The strip under an agent's name in its thread: its rules, its routines and its spend, in a line.
struct AgentProfileStrip: View {
    @ObservedObject var model: HomeModel
    let agent: AgentManager.Agent

    var body: some View {
        let routines = model.routines.filter { $0.agent == agent.slug }
        let custom = model.rules.hasOverrides(for: agent.slug)
        HStack(spacing: 14) {
            Label(custom ? "custom rules" : "default rules", systemImage: "shield").font(.system(size: 11.5)).foregroundStyle(.secondary)
            if routines.isEmpty {
                Label("no routines", systemImage: "clock").font(.system(size: 11.5)).foregroundStyle(.secondary)
            } else {
                Label(routines.map { ($0.paused ? "paused: " : "") + $0.schedule.words }.joined(separator: ", "), systemImage: "clock.arrow.2.circlepath")
                    .font(.system(size: 11.5)).foregroundStyle(.secondary).lineLimit(1)
            }
            if let cost = model.spend[agent.slug] { Text(String(format: "$%.2f this week", cost)).font(.system(size: 11.5, design: .monospaced)).foregroundStyle(.tertiary) }
            Spacer()
            Button("Agents page") { model.page = .agents }.controlSize(.mini)
        }
        .padding(.horizontal, 18).padding(.vertical, 6)
        .background(Color.primary.opacity(0.03))
    }
}
