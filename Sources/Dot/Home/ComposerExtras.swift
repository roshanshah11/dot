import DotKit
import SwiftUI

// Home's composer extras (parity HO-06, HO-09, HO-10, HO-11): tapbacks on an agent's messages, first messages for an
// empty thread, a focus pane for one long draft, and saved prompts as coloured cards.

/// Five tapbacks over a message he is pointing at (HO-06); the one he already picked is ringed.
struct TapbackBar: View {
    let current: String?
    let pick: (String) -> Void

    var body: some View {
        HStack(spacing: 2) {
            ForEach(Tapback.choices, id: \.emoji) { choice in
                Button { pick(choice.emoji) } label: {
                    Text(choice.emoji).font(.system(size: 15)).frame(width: 28, height: 26)
                        .background(current == choice.emoji ? HomeStyle.accent.opacity(0.22) : .clear, in: Capsule())
                }
                .buttonStyle(.plain)
                .help(choice.meaning)
            }
        }
        .padding(.horizontal, 4).padding(.vertical, 2)
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().stroke(Color.primary.opacity(0.1), lineWidth: 1))
        .shadow(color: .black.opacity(0.15), radius: 6, y: 2)
    }
}

/// The tapback he left, on the message's corner.
struct TapbackBadge: View {
    let emoji: String
    var body: some View {
        Text(emoji).font(.system(size: 12)).frame(width: 24, height: 24)
            .background(Circle().fill(Color(nsColor: .windowBackgroundColor)))
            .overlay(Circle().stroke(Color.primary.opacity(0.12), lineWidth: 1))
    }
}

/// An empty thread's three first messages (HO-09), from what the agent is for.
struct StarterMessages: View {
    let agentName: String
    let starters: [String]
    let pick: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Nothing here yet. Start \(agentName) with one of these, or type your own.").font(.callout).foregroundStyle(.secondary)
            ForEach(starters, id: \.self) { line in
                Button { pick(line) } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "text.bubble").font(.system(size: 11)).foregroundStyle(HomeStyle.accent)
                        Text(line).font(.system(size: 12.5)).foregroundStyle(.primary)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(Color.primary.opacity(0.05), in: Capsule())
                    .overlay(Capsule().stroke(Color.primary.opacity(0.1), lineWidth: 1))
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// One long draft beside the thread (HO-10): the same draft as the composer, so nothing is lost switching back. Send
/// gives it to this agent; Send task starts it as a job of its own, behind his window.
struct FocusPane: View {
    @ObservedObject var model: HomeModel
    let agent: AgentManager.Agent
    /// A still text for snapshots (an AppKit text view doesn't draw offscreen until it has been shown).
    var still = false

    private var empty: Bool { model.composer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    private var words: Int { model.composer.split(whereSeparator: \.isWhitespace).count }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Focus").font(.system(size: 13, weight: .semibold))
                Text("\(words) word\(words == 1 ? "" : "s")").font(.system(size: 11)).foregroundStyle(.secondary)
                Spacer()
                Button { withAnimation(.easeOut(duration: 0.18)) { model.focusOpen = false } } label: { Image(systemName: "xmark") }
                    .buttonStyle(.plain).foregroundStyle(.secondary).help("Close (the draft stays in the composer)")
            }
            .padding(.top, 36)
            Group {
                if still {
                    Text(model.composer).font(.system(size: 13.5)).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(10)
                } else {
                    TextEditor(text: $model.composer).font(.system(size: 13.5)).scrollContentBackground(.hidden).padding(6)
                }
            }
            .background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.primary.opacity(0.08), lineWidth: 1))
            if let note = model.focusNote {
                Text(note).font(.system(size: 11.5)).foregroundStyle(.secondary)
            }
            HStack(spacing: 8) {
                Button("Save as prompt") { model.savePrompt() }.disabled(empty)
                Spacer()
                Button("Send task") { model.startTask() }.disabled(empty)
                    .help("Start it as a job of its own, behind your window; its card shows in the notch")
                Button("Send to \(agent.name)") { model.send(); model.focusNote = nil }.disabled(empty).keyboardShortcut(.return, modifiers: .command)
                    .buttonStyle(.borderedProminent).tint(HomeStyle.accent)
            }
            .controlSize(.regular)
        }
        .padding(.horizontal, 14).padding(.bottom, 14)
    }
}

/// Saved prompts as cards over the composer (HO-11): a tap puts one in the composer; right-click for its colour or to
/// delete it; + saves what's in the composer.
struct PromptCardsBar: View {
    @ObservedObject var model: HomeModel

    static let palette: [(name: String, color: Color)] = [
        ("blue", Color(red: 0.30, green: 0.52, blue: 0.95)), ("green", Color(red: 0.25, green: 0.70, blue: 0.45)),
        ("yellow", Color(red: 0.92, green: 0.72, blue: 0.15)), ("orange", HomeStyle.accent),
        ("red", Color(red: 0.90, green: 0.32, blue: 0.32)), ("purple", Color(red: 0.62, green: 0.42, blue: 0.90)),
        ("gray", Color(white: 0.55)),
    ]

    static func color(_ name: String) -> Color { palette.first { $0.name == name }?.color ?? palette[0].color }

    private var canSave: Bool {
        let text = model.composer.trimmingCharacters(in: .whitespacesAndNewlines)
        return !text.isEmpty && !model.promptCards.contains { $0.text == text }
    }

    var body: some View {
        if !model.promptCards.isEmpty || canSave {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(model.promptCards) { card in
                        let tint = Self.color(card.color)
                        Button { model.composer = card.text } label: {
                            HStack(spacing: 6) {
                                RoundedRectangle(cornerRadius: 2).fill(tint).frame(width: 3, height: 16)
                                Text(card.title).font(.system(size: 11.5, weight: .medium)).lineLimit(1)
                            }
                            .padding(.leading, 7).padding(.trailing, 10).padding(.vertical, 5)
                            .background(tint.opacity(0.14), in: RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(tint.opacity(0.35), lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .help(card.text)
                        .contextMenu {
                            ForEach(Self.palette, id: \.name) { entry in
                                Button { model.setPromptColor(card, entry.name) } label: {
                                    Label(entry.name.capitalized, systemImage: card.color == entry.name ? "checkmark.circle.fill" : "circle.fill")
                                }
                            }
                            Divider()
                            Button("Delete", role: .destructive) { model.deletePrompt(card) }
                        }
                    }
                    if canSave {
                        Button { model.savePrompt() } label: {
                            Label("Save prompt", systemImage: "plus").font(.system(size: 11)).padding(.horizontal, 8).padding(.vertical, 5)
                                .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain).foregroundStyle(.secondary)
                        .help("Keep what's in the composer as a card")
                    }
                }
            }
        }
    }
}
