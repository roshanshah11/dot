import DotKit
import SwiftUI

/// Home > History (parity HO-14): every day he talked to Dot, newest first, and search over all of it (talk, typed,
/// dictations, jobs, his agents' threads) with filters. A hit shows its day with the turn picked out, or opens in its
/// agent's thread. Reads the history index (HistoryService); writes nothing.
struct HistoryPage: View {
    let config: DotConfig
    var agentName: (String) -> String? = { _ in nil }
    /// An agent's slug and a turn's key: open that thread at that turn.
    var openTurn: (String, String) -> Void = { _, _ in }
    /// The live index, or a fixed one (the snapshot's sample).
    var store: HistoryService.Store = .shared
    @State private var query: String
    @State private var filter: String?
    @State private var days: [(day: String, count: Int)] = []
    @State private var day: String?
    @State private var turns: [HistoryIndex.Hit] = []
    @State private var hits: [HistoryIndex.Hit] = []
    @State private var focus: String?
    @State private var total = 0
    @State private var searched = ""

    init(config: DotConfig, agentName: @escaping (String) -> String? = { _ in nil }, openTurn: @escaping (String, String) -> Void = { _, _ in },
         store: HistoryService.Store = .shared, query: String = "") {
        self.config = config
        self.agentName = agentName
        self.openTurn = openTurn
        self.store = store
        _query = State(initialValue: query)
    }

    private let accent = HomeStyle.accent
    private var kinds: Set<String>? { filter.flatMap { name in HistoryIndex.filters.first { $0.name == name }?.kinds } }
    private var searching: Bool { !query.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider()
            HStack(spacing: 0) {
                dayList.frame(width: 200)
                Divider()
                if searching { results } else { dayTurns }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .onAppear { reloadDays() }
        .onChange(of: filter) { _, _ in reloadDays() }
        .task(id: "\(query)|\(filter ?? "")") {
            guard searching else { hits = []; searched = ""; return }
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            let q = query, k = kinds
            HistoryService.read(config, store: store, { $0.search(q, kinds: k, limit: 60) }) { found in
                guard q == query else { return }
                hits = found ?? []
                searched = q
            }
        }
    }

    // MARK: Parts

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("History").font(.system(size: 20, weight: .semibold))
                Text("\(total.formatted()) turns").font(.system(size: 12)).foregroundStyle(.secondary)
                Spacer()
            }
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("Search everything you've said to Dot", text: $query).textFieldStyle(.plain)
                    if searching {
                        Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary) }.buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
                .frame(maxWidth: 420)
                chip("All", on: filter == nil) { filter = nil }
                ForEach(HistoryIndex.filters, id: \.name) { f in chip(f.name, on: filter == f.name) { filter = f.name } }
            }
        }
        .padding(.horizontal, 20).padding(.top, 36).padding(.bottom, 12)
    }

    private func chip(_ title: String, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.system(size: 12, weight: on ? .semibold : .regular))
                .foregroundStyle(on ? Color.white : Color.primary.opacity(0.8))
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(on ? accent : Color.primary.opacity(0.06), in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private var dayList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 1) {
                ForEach(days, id: \.day) { entry in
                    let on = !searching && entry.day == day
                    Button {
                        query = ""
                        focus = nil
                        show(day: entry.day)
                    } label: {
                        HStack {
                            Text(Self.label(day: entry.day)).font(.system(size: 12.5, weight: on ? .semibold : .regular))
                            Spacer()
                            Text("\(entry.count)").font(.system(size: 11, design: .monospaced)).foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(on ? Color.primary.opacity(0.08) : .clear, in: RoundedRectangle(cornerRadius: 7))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                if days.isEmpty {
                    Text("Nothing yet.").font(.system(size: 12)).foregroundStyle(.secondary).padding(10)
                }
            }
            .padding(8)
        }
    }

    private var dayTurns: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 10) {
                    if let day {
                        Text(Self.label(day: day, long: true)).font(.system(size: 14, weight: .semibold)).padding(.bottom, 2)
                    }
                    ForEach(turns) { turn in
                        turnRow(turn, highlighted: turn.id == focus).id(turn.id)
                    }
                }
                .padding(20)
            }
            .onChange(of: turns) { _, _ in
                guard let focus else { return }
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 80_000_000)
                    withAnimation { proxy.scrollTo(focus, anchor: .center) }
                }
            }
        }
    }

    private var results: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                if hits.isEmpty, !searched.isEmpty {
                    Text("Nothing matches \u{201C}\(searched)\u{201D}\(filter.map { " in \($0)" } ?? "").")
                        .font(.system(size: 13)).foregroundStyle(.secondary)
                }
                ForEach(hits) { hit in
                    VStack(alignment: .leading, spacing: 6) {
                        meta(hit, withDate: true)
                        Text(Self.snippet(hit.snippet.isEmpty ? (hit.you.isEmpty ? hit.dot : hit.you) : hit.snippet))
                            .font(.system(size: 13)).textSelection(.enabled)
                        HStack(spacing: 10) {
                            Button("Show the day") {
                                focus = hit.id
                                query = ""
                                show(day: Self.dayString(hit.at))
                            }
                            if hit.thread.hasPrefix("agent:") {
                                Button("Open in thread") { openTurn(String(hit.thread.dropFirst(6)), hit.id) }
                            }
                        }
                        .buttonStyle(.link).font(.system(size: 11.5))
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
                }
            }
            .padding(20)
        }
    }

    private func turnRow(_ turn: HistoryIndex.Hit, highlighted: Bool) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            meta(turn, withDate: false)
            if !turn.you.isEmpty {
                Text(turn.you).font(.system(size: 13, weight: .medium)).textSelection(.enabled)
            }
            if !turn.dot.isEmpty {
                Text(turn.dot).font(.system(size: 13)).foregroundStyle(.secondary).lineLimit(highlighted ? nil : 8).textSelection(.enabled)
            }
            if turn.thread.hasPrefix("agent:") {
                Button("Open in thread") { openTurn(String(turn.thread.dropFirst(6)), turn.id) }
                    .buttonStyle(.link).font(.system(size: 11.5))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(highlighted ? accent.opacity(0.13) : Color.primary.opacity(0.03), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(highlighted ? accent.opacity(0.6) : .clear, lineWidth: 1))
    }

    private func meta(_ hit: HistoryIndex.Hit, withDate: Bool) -> some View {
        HStack(spacing: 6) {
            Image(systemName: Self.icon(hit.kind)).font(.system(size: 10.5)).foregroundStyle(accent)
            Text(withDate ? hit.at.formatted(date: .abbreviated, time: .shortened) : hit.at.formatted(date: .omitted, time: .shortened))
            Text("·")
            Text(where_(hit))
        }
        .font(.system(size: 11)).foregroundStyle(.secondary)
    }

    private func where_(_ hit: HistoryIndex.Hit) -> String {
        if hit.thread.hasPrefix("agent:") {
            let slug = String(hit.thread.dropFirst(6))
            return agentName(slug) ?? slug
        }
        return hit.app.isEmpty ? hit.kind : "\(hit.kind) in \(hit.app)"
    }

    // MARK: Loading

    private func reloadDays() {
        let k = kinds
        HistoryService.read(config, store: store, { index in (index.days(kinds: k), index.count) }) { result in
            days = result?.0 ?? []
            total = result?.1 ?? 0
            if day == nil || !days.contains(where: { $0.day == day }) { day = days.first?.day }
            if let day { show(day: day) }
        }
    }

    private func show(day: String) {
        self.day = day
        let k = kinds
        HistoryService.read(config, store: store, { $0.turns(day: day, kinds: k) }) { found in
            guard self.day == day else { return }
            turns = found ?? []
        }
    }

    // MARK: Text

    static func icon(_ kind: String) -> String {
        switch kind {
        case "talk": return "waveform"
        case "typed": return "keyboard"
        case "dictation": return "text.cursor"
        case "job": return "hammer"
        case "agent": return "person.2"
        case "lecture": return "graduationcap"
        default: return "bubble.left"
        }
    }

    /// FTS5's snippet with the matched words (between \u{2} and \u{3}) in bold.
    static func snippet(_ text: String) -> AttributedString {
        var out = AttributedString()
        var bold = false
        var run = ""
        func flush() {
            guard !run.isEmpty else { return }
            var piece = AttributedString(run)
            if bold { piece.font = .system(size: 13, weight: .bold) }
            out += piece
            run = ""
        }
        for ch in text {
            if ch == "\u{2}" { flush(); bold = true } else if ch == "\u{3}" { flush(); bold = false } else { run.append(ch) }
        }
        flush()
        return out
    }

    private static let dayFormat: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func dayString(_ date: Date) -> String { dayFormat.string(from: date) }

    static func label(day: String, long: Bool = false) -> String {
        guard let date = dayFormat.date(from: day) else { return day }
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "Today" }
        if calendar.isDateInYesterday(date) { return "Yesterday" }
        let sameYear = calendar.component(.year, from: date) == calendar.component(.year, from: Date())
        let style = Date.FormatStyle.dateTime.weekday(long ? .wide : .abbreviated).month(long ? .wide : .abbreviated).day()
        return date.formatted(sameYear ? style : style.year())
    }
}
