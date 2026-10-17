import AppKit
import DotKit
import SwiftUI

// The pages that edit or list his files: Dictation (the dictionary), Skills and Suggestions.

// MARK: - Dictation

/// The dictionary while he edits it. HomeModel holds it so edits survive a page switch.
@MainActor
final class DictionaryEditor: ObservableObject {
    @Published var entries: [DictionaryFile.Entry] = []
    @Published private(set) var comments: [String] = []
    @Published var note: String?
    private var loaded = DictionaryFile()
    private(set) var path = ""

    var dirty: Bool { entries != loaded.entries }

    /// Reads the file, unless that would throw away edits he has not saved.
    func load(path: String) {
        guard path != self.path || !dirty else { return }
        read(path)
    }

    func revert() { read(path) }

    func add() { entries.append(DictionaryFile.Entry(heard: "", correct: "")) }

    func remove(_ id: UUID) { entries.removeAll { $0.id == id } }

    /// Writes comments, corrections and terms back in the file's grammar. Lines Dot appended
    /// since the editor read the file ("add x to my dictionary") are kept, not written over.
    func save() {
        guard dirty, !path.isEmpty else { return }
        let url = URL(fileURLWithPath: path)
        let disk = DictionaryFile(text: (try? String(contentsOf: url, encoding: .utf8)) ?? "")
        let appended = DictionaryFile.appended(on: disk, since: loaded)
        var seen = Set<String>()
        var file = DictionaryFile()
        file.comments = loaded.comments + appended.comments
        file.entries = (entries + appended.entries).filter { $0.line.map { seen.insert($0).inserted } ?? false }
        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try file.text.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            note = "could not write the dictionary: \(error.localizedDescription)"
            return
        }
        read(path)
        let rules = entries.filter(\.isRule).count
        var line = "dictionary saved: \(entries.count - rules) terms, \(rules) corrections"
        if !appended.entries.isEmpty { line += "; kept \(appended.entries.count) Dot added while you edited" }
        note = line
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in self?.note = nil }
    }

    /// Corrections first, then terms: the order Save writes them, so the list does not jump.
    private func read(_ path: String) {
        self.path = path
        var file = DictionaryFile(text: (try? String(contentsOfFile: path, encoding: .utf8)) ?? "")
        file.entries = file.entries.filter(\.isRule) + file.entries.filter { !$0.isRule }
        loaded = file
        entries = file.entries
        comments = file.comments
    }
}

struct DictationPage: View {
    @ObservedObject var model: HomeModel
    @ObservedObject var editor: DictionaryEditor

    private var path: String { DotConfig.expand(model.settings.dictionaryFile) }

    var body: some View {
        SettingsPage("Dictation", subtitle: "Talking into any text field, spelled your way.") {
            HomeSection("How it works") {
                Text("Hold control+fn anywhere and say a sentence: Dot writes it into the field you are in. Double-tap fn for Murmur, your long recorder; Dot reads Murmur's history, so you can ask what you said in a meeting.")
                    .font(.callout).fixedSize(horizontal: false, vertical: true)
                Text("Dot's dictation and spoken questions pass through the dictionary below.").font(.caption).foregroundStyle(.secondary)
            }
            HomeSection("Dictionary") {
                HStack(spacing: 8) {
                    Text("heard").frame(width: 200, alignment: .leading)
                    Text("write as")
                    Spacer()
                }
                .font(.caption.weight(.medium)).foregroundStyle(.secondary).padding(.leading, 2)
                LazyVStack(alignment: .leading, spacing: 6) {
                    ForEach(editor.entries) { entry in row(entry) }
                }
                if editor.entries.isEmpty {
                    Text("No words yet.").font(.callout).foregroundStyle(.secondary)
                }
                Text("Leave heard empty for a term: any hearing of it, in any case or split into words, is written this way. Fill heard to fix one mishearing.")
                    .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 8) {
                    Button { editor.add() } label: { Label("Add", systemImage: "plus") }.controlSize(.small)
                    if editor.dirty { Button("Revert") { editor.revert() }.controlSize(.small) }
                    Spacer()
                    Button("Open file") { NSWorkspace.shared.open(URL(fileURLWithPath: path)) }
                        .controlSize(.small).disabled(!FileManager.default.fileExists(atPath: path))
                }
                if !editor.comments.isEmpty {
                    Text(editor.comments.count == 1 ? "1 comment line is kept at the top of the file." : "\(editor.comments.count) comment lines are kept at the top of the file.")
                        .font(.caption).foregroundStyle(.tertiary)
                }
                Text(path.replacingOccurrences(of: NSHomeDirectory(), with: "~")).font(.caption.monospaced()).foregroundStyle(.tertiary)
                if let note = editor.note { Text(note).font(.caption).foregroundStyle(.secondary) }
            }
            HomeSection("Typed questions") {
                SettingToggle("Read typed answers aloud", detail: "answers to typed questions are spoken as well as shown in the notch", isOn: $model.settings.speakTypedAnswers)
            }
            SettingsSaveBar(model: model, pending: editor.dirty) { editor.save() }
        }
        .onAppear { editor.load(path: path) }
    }

    private func row(_ entry: DictionaryFile.Entry) -> some View {
        HStack(spacing: 8) {
            TextField("any hearing", text: binding(entry.id, \.heard)).textFieldStyle(.roundedBorder).frame(width: 200)
            Image(systemName: "arrow.right").font(.system(size: 10)).foregroundStyle(.tertiary)
            TextField("write as", text: binding(entry.id, \.correct)).textFieldStyle(.roundedBorder)
            Button { editor.remove(entry.id) } label: { Image(systemName: "minus.circle") }
                .buttonStyle(.plain).foregroundStyle(.secondary).help("Remove")
        }
    }

    /// Bound by id rather than index, so removing a row never leaves a field pointing past the end.
    private func binding(_ id: UUID, _ field: WritableKeyPath<DictionaryFile.Entry, String>) -> Binding<String> {
        Binding(
            get: { editor.entries.first { $0.id == id }?[keyPath: field] ?? "" },
            set: { value in
                guard let index = editor.entries.firstIndex(where: { $0.id == id }) else { return }
                editor.entries[index][keyPath: field] = value
            }
        )
    }
}

// MARK: - Skills

struct SkillsPage: View {
    @State private var skills: [SkillEntry] = []
    @State private var query = ""
    @State private var open: Set<String> = []

    static var root: URL { URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".claude/skills", isDirectory: true) }

    private var shown: [SkillEntry] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return skills }
        return skills.filter { $0.name.lowercased().contains(needle) || $0.description.lowercased().contains(needle) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("Skills").font(.title2.weight(.semibold))
                    Text(query.isEmpty ? "\(skills.count)" : "\(shown.count) of \(skills.count)").font(.callout).foregroundStyle(.secondary)
                    Spacer()
                    Button { NSWorkspace.shared.open(Self.root) } label: { Image(systemName: "folder") }
                        .buttonStyle(.plain).foregroundStyle(.secondary).help("Open ~/.claude/skills")
                    Button { reload() } label: { Image(systemName: "arrow.clockwise") }
                        .buttonStyle(.plain).foregroundStyle(.secondary).help("Read the skills again")
                }
                Text("agents can use every skill here; talk mode routes deliverables through them").font(.callout).foregroundStyle(.secondary)
                TextField("Search skills", text: $query).textFieldStyle(.roundedBorder).frame(maxWidth: 320)
            }
            .padding(.horizontal, 24).padding(.top, 30).padding(.bottom, 10)
            Divider()
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 2) {
                    ForEach(shown) { skill in row(skill) }
                    if shown.isEmpty {
                        Text(skills.isEmpty ? "No skills in ~/.claude/skills." : "No skill matches \"\(query)\".").font(.callout).foregroundStyle(.secondary).padding(.top, 12)
                    }
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .frame(maxWidth: 720, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .onAppear(perform: reload)
    }

    private func reload() { skills = SkillEntry.load(from: Self.root) }

    private func row(_ skill: SkillEntry) -> some View {
        let expanded = open.contains(skill.id)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 10) {
                Button {
                    withAnimation(.easeOut(duration: 0.15)) {
                        if expanded { open.remove(skill.id) } else { open.insert(skill.id) }
                    }
                } label: {
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "chevron.right").font(.system(size: 8, weight: .bold)).foregroundStyle(.tertiary)
                            .rotationEffect(.degrees(expanded ? 90 : 0)).frame(width: 10).padding(.top, 5)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(skill.name).font(.system(size: 13, weight: .semibold))
                            if !expanded {
                                Text(skill.firstSentence).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(2)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Button("open") { NSWorkspace.shared.open(skill.folder) }.controlSize(.small).help(skill.folder.path)
            }
            if expanded {
                Text(skill.description.isEmpty ? "No description in its SKILL.md." : skill.description)
                    .font(.system(size: 12)).foregroundStyle(.secondary).textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.leading, 18)
            }
        }
        .padding(.horizontal, 8).padding(.vertical, 7)
        .background(expanded ? Color.primary.opacity(0.05) : .clear, in: RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Suggestions

struct SuggestionsPage: View {
    @ObservedObject var model: HomeModel
    @State private var history: [SuggestionDecision] = []
    @State private var counts: [String: BackOff.Tally] = [:]
    @State private var confirmingHistory = false
    @State private var confirmingCounts = false

    struct OfferKind: Identifiable {
        let name: String
        let about: String
        var id: String { name }
    }

    /// The document offers Noticer makes, and what each one is, then its skill offers for the app in front.
    static let kinds = [
        OfferKind(name: "gist", about: "a one-minute gist of the document"),
        OfferKind(name: "find", about: "the part today's lecture or deadline is about"),
        OfferKind(name: "quiz", about: "three quick questions on what is on screen"),
    ] + AppSkillOffers.rows.map { OfferKind(name: $0.kind, about: $0.about) }

    private var file: URL { model.config.dotHome.appendingPathComponent("suggestions.json") }

    var body: some View {
        SettingsPage("Suggestions", subtitle: "What Dot offers before you ask, and what you said back.") {
            HomeSection("Offers") {
                SettingToggle("Morning card", detail: "the morning card: a few things Dot could take on today, from Atlas", isOn: $model.settings.morningSuggestions)
                SettingToggle("Document offers", detail: "offers when a document opens", isOn: $model.settings.suggestions)
                SettingToggle("Deadline notices", detail: "a quiet line when an app touches a deadline", isOn: $model.settings.proactiveNotices)
            }
            HomeSection("Offers so far") {
                ForEach(Self.kinds) { kind in
                    let tally = counts[kind.name] ?? BackOff.Tally()
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(kind.name).font(.system(size: 13, weight: .medium))
                            Text(kind.about).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        // Noticer.allowed: three no's (two ignored offers count as one) with no yes retire a kind.
                        if tally.retired { HomeBadge(text: "retired", color: .orange) }
                        Text("yes \(tally.yes) · no \(tally.no) · ignored \(tally.soft)").font(.system(size: 12, design: .monospaced)).foregroundStyle(.secondary)
                    }
                }
                HStack {
                    Text("Three no's and no yes retire a kind until the counts are reset; two ignored offers count as one no.").font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Button("Reset counts…") { confirmingCounts = true }.controlSize(.small)
                        .confirmationDialog("Reset the offer counts?", isPresented: $confirmingCounts) {
                            Button("Reset counts", role: .destructive) { resetCounts() }
                        } message: {
                            Text("Dot forgets how often you took or turned down each kind, and retired kinds come back.")
                        }
                }
            }
            HomeSection("History") {
                if history.isEmpty {
                    Text("Nothing yet. Each yes, no, skip or dismiss on an offer is kept in \(displayPath).").font(.callout).foregroundStyle(.secondary)
                } else {
                    HStack(spacing: 10) {
                        Text("date").frame(width: 84, alignment: .leading)
                        Text("offer")
                        Spacer()
                        Text("answer")
                    }
                    .font(.caption.weight(.medium)).foregroundStyle(.secondary)
                    LazyVStack(alignment: .leading, spacing: 5) {
                        ForEach(history) { row in historyRow(row) }
                    }
                }
                HStack {
                    Text(history.isEmpty ? "" : "\(history.count) answers, newest first, from \(displayPath)").font(.caption).foregroundStyle(.tertiary)
                    Spacer()
                    Button("Reload") { reload() }.controlSize(.small)
                    Button("Reset history…") { confirmingHistory = true }.controlSize(.small)
                        .disabled(!FileManager.default.fileExists(atPath: file.path))
                        .confirmationDialog("Reset the suggestion history?", isPresented: $confirmingHistory) {
                            Button("Delete history", role: .destructive) { resetHistory() }
                        } message: {
                            Text("This deletes \(displayPath). Dot forgets which offers you took and turned down.")
                        }
                }
            }
            SettingsSaveBar(model: model)
        }
        .onAppear(perform: reload)
    }

    private var displayPath: String { file.path.replacingOccurrences(of: NSHomeDirectory(), with: "~") }

    private func historyRow(_ row: SuggestionDecision) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(row.date).font(.system(size: 11, design: .monospaced)).foregroundStyle(.secondary).frame(width: 84, alignment: .leading)
            Text(row.text.isEmpty ? row.key : row.text).font(.system(size: 12)).lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .help(row.key)
            HomeBadge(text: row.decision.isEmpty ? "?" : row.decision, color: Self.color(row.decision))
        }
    }

    static func color(_ decision: String) -> Color {
        switch decision {
        case "yes": return .green
        case "no": return .orange
        default: return .secondary
        }
    }

    private func reload() {
        history = SuggestionDecision.load(file)
        counts = Dictionary(uniqueKeysWithValues: Self.kinds.map { kind in (kind.name, Noticer.tally(kind.name)) })
    }

    private func resetHistory() {
        try? FileManager.default.removeItem(at: file)
        reload()
    }

    private func resetCounts() {
        for kind in Self.kinds {
            UserDefaults.standard.removeObject(forKey: "dot.suggest.\(kind.name).yes")
            UserDefaults.standard.removeObject(forKey: "dot.suggest.\(kind.name).no")
            UserDefaults.standard.removeObject(forKey: "dot.suggest.\(kind.name).soft")
        }
        reload()
    }
}
