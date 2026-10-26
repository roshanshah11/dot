import Foundation
import SQLite3

/// Search over everything said to and by Dot (parity H1, HO-14): the talk log (~/Dot/transcripts/transcripts.jsonl),
/// each agent's thread (<agent>/.dot/transcript.jsonl) and Murmur's dictations, in a SQLite FTS5 index of its own
/// (~/Dot/index/transcripts.sqlite). The index is rebuildable: delete it and the next refresh reads everything again.
/// Sources are only read. A refresh reads what was appended since the last one; a source that shrank or whose start
/// changed is read again from the top.
public final class HistoryIndex {
    public static let schemaVersion = 1

    public struct Source: Equatable {
        public enum Format: Equatable { case talk, agent(slug: String), murmur }
        public let path: String
        public let format: Format
        public init(path: String, format: Format) { self.path = path; self.format = format }
    }

    public struct Hit: Equatable, Identifiable {
        public let id: String
        public let thread: String
        /// talk, typed, job, lecture (the talk log), agent, dictation
        public let kind: String
        public let at: Date
        public let you: String
        public let dot: String
        public let app: String
        /// The matching words between \u{2} and \u{3}, with … where text was cut; empty outside a search.
        public let snippet: String
    }

    /// The History page's filters and the kinds each covers.
    public static let filters: [(name: String, kinds: Set<String>)] = [
        ("Talk", ["talk", "lecture"]), ("Typed", ["typed"]), ("Dictation", ["dictation"]), ("Agents", ["agent", "job"]),
    ]

    private var db: OpaquePointer?
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    public init?(url: URL) {
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        guard sqlite3_open_v2(url.path, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
            sqlite3_close(db)
            return nil
        }
        sqlite3_busy_timeout(db, 4000)
        exec("PRAGMA journal_mode=WAL")
        if Int(scalar("SELECT value FROM meta WHERE key = 'schema'") ?? "") != Self.schemaVersion {
            // a new schema starts over: the index only ever holds copies
            exec("DROP TABLE IF EXISTS turns; DROP TABLE IF EXISTS sources; DROP TABLE IF EXISTS meta")
            exec("""
            CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE sources(path TEXT PRIMARY KEY, offset INTEGER NOT NULL, head TEXT NOT NULL);
            CREATE VIRTUAL TABLE turns USING fts5(you, dot, id UNINDEXED, thread UNINDEXED, kind UNINDEXED, at UNINDEXED,
                app UNINDEXED, source UNINDEXED, tokenize = 'porter unicode61 remove_diacritics 2');
            INSERT INTO meta(key, value) VALUES('schema', '\(Self.schemaVersion)');
            """)
        }
    }

    deinit { sqlite3_close(db) }

    /// Where Dot keeps its history: the talk log, every agent's thread, and Murmur's history if it's there.
    public static func sources(transcripts: URL, agentsRoot: URL, murmur: URL?) -> [Source] {
        var out = [Source(path: transcripts.appendingPathComponent("transcripts.jsonl").path, format: .talk)]
        let agents = (try? FileManager.default.contentsOfDirectory(atPath: agentsRoot.path)) ?? []
        for slug in agents.sorted() where !slug.hasPrefix(".") {
            let file = agentsRoot.appendingPathComponent(slug).appendingPathComponent(".dot/transcript.jsonl")
            if FileManager.default.fileExists(atPath: file.path) { out.append(Source(path: file.path, format: .agent(slug: slug))) }
        }
        if let murmur, FileManager.default.fileExists(atPath: murmur.path) { out.append(Source(path: murmur.path, format: .murmur)) }
        return out
    }

    // MARK: Refresh

    /// Reads what each source gained since the last refresh; returns the rows added.
    @discardableResult
    public func refresh(_ sources: [Source]) -> Int {
        var added = 0
        for source in sources { added += refresh(source) }
        // a source that is gone (an archived agent) takes its rows with it
        let live = Set(sources.map(\.path))
        var known: [String] = []
        query("SELECT path FROM sources", []) { st in if let p = Self.text(st, 0) { known.append(p) } }
        for path in known where !live.contains(path) {
            run("DELETE FROM turns WHERE source = ?", [path])
            run("DELETE FROM sources WHERE path = ?", [path])
        }
        return added
    }

    private func refresh(_ source: Source) -> Int {
        guard let handle = FileHandle(forReadingAtPath: source.path) else { return 0 }
        defer { try? handle.close() }
        let size = Int((try? handle.seekToEnd()) ?? 0)
        // the start of what was already read stands for the file: changed means rewritten, not appended to
        func head(_ upTo: Int) -> String {
            try? handle.seek(toOffset: 0)
            return Self.digest((try? handle.read(upToCount: min(512, upTo))) ?? Data())
        }
        exec("BEGIN IMMEDIATE")
        var offset = 0, knownHead = ""
        query("SELECT offset, head FROM sources WHERE path = ?", [source.path]) { st in
            offset = Int(sqlite3_column_int64(st, 0)); knownHead = Self.text(st, 1) ?? ""
        }
        if size < offset || (offset > 0 && head(offset) != knownHead) {
            // rewritten, not appended to: read it again from the top
            run("DELETE FROM turns WHERE source = ?", [source.path])
            offset = 0
        }
        guard size > offset else { exec("COMMIT"); return 0 }
        try? handle.seek(toOffset: UInt64(offset))
        let data = (try? handle.readToEnd()) ?? Data()
        // only whole lines; a line still being written waits for the next refresh
        guard let lastNewline = data.lastIndex(of: 0x0A) else { exec("COMMIT"); return 0 }
        let complete = data[data.startIndex...lastNewline]
        var added = 0
        for line in String(decoding: complete, as: UTF8.self).split(whereSeparator: \.isNewline) {
            guard let row = Self.row(line, source) else { continue }
            run("INSERT INTO turns(you, dot, id, thread, kind, at, app, source) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
                [row.you, row.dot, row.id, row.thread, row.kind, row.at.timeIntervalSince1970, row.app, source.path])
            added += 1
        }
        run("INSERT OR REPLACE INTO sources(path, offset, head) VALUES(?, ?, ?)", [source.path, offset + complete.count, head(offset + complete.count)])
        exec("COMMIT")
        return added
    }

    /// One source line as a row, or nil for lines that hold nothing he said or read (an agent's tool calls).
    static func row(_ line: Substring, _ source: Source) -> Hit? {
        switch source.format {
        case .talk:
            guard let r = TranscriptRow.parse(line) else { return nil }
            let dot = r.dot ?? ""
            guard !(r.you.isEmpty && dot.isEmpty) else { return nil }
            return Hit(id: r.id, thread: r.thread, kind: r.kind, at: r.at, you: r.you, dot: dot, app: r.app ?? "", snippet: "")
        case .agent(let slug):
            guard let o = (try? JSONSerialization.jsonObject(with: Data(line.utf8))) as? [String: Any],
                  let ts = o["ts"] as? String, let at = TranscriptRow.iso.date(from: ts) ?? Self.isoFractional.date(from: ts),
                  let role = o["role"] as? String, let text = o["text"] as? String,
                  ["user", "assistant", "result", "note"].contains(role), !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else { return nil }
            return Hit(id: TranscriptRow.legacyID(ts: ts, kind: role, text: text), thread: ThreadID.agent(slug), kind: "agent", at: at,
                       you: role == "user" ? text : "", dot: role == "user" ? "" : text, app: "", snippet: "")
        case .murmur:
            guard let o = (try? JSONSerialization.jsonObject(with: Data(line.utf8))) as? [String: Any],
                  let ts = o["ts"] as? String, let at = Self.isoFractional.date(from: ts) ?? TranscriptRow.iso.date(from: ts) else { return nil }
            let cleaned = (o["cleaned"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            guard let text = cleaned ?? (o["raw"] as? String), text.trimmingCharacters(in: .whitespaces).count > 2 else { return nil }
            let id = (o["id"] as? String) ?? TranscriptRow.legacyID(ts: ts, kind: "dictation", text: text)
            return Hit(id: id, thread: "murmur", kind: "dictation", at: at, you: text, dot: "", app: o["target_app"] as? String ?? "", snippet: "")
        }
    }

    // MARK: Reading

    /// Turns matching words, best first with a lean toward recent ones; all the words must match, else any of them.
    public func search(_ text: String, days: Int? = nil, kinds: Set<String>? = nil, now: Date = Date(), limit: Int = 20) -> [Hit] {
        for any in [false, true] {
            guard let match = HistoryQuery.match(text, any: any) else { return [] }
            var sql = "SELECT id, thread, kind, at, you, dot, app, snippet(turns, -1, char(2), char(3), '…', 16), bm25(turns, 1.0, 0.8) FROM turns WHERE turns MATCH ?"
            var binds: [Any?] = [match]
            if let days { sql += " AND at >= ?"; binds.append(now.addingTimeInterval(-Double(days) * 86_400).timeIntervalSince1970) }
            if let kinds, !kinds.isEmpty { sql += " AND kind IN (\(kinds.map { _ in "?" }.joined(separator: ",")))"; binds += kinds.sorted() }
            sql += " ORDER BY bm25(turns, 1.0, 0.8) LIMIT 200"
            var scored: [(Hit, Double)] = []
            query(sql, binds) { st in
                let hit = Self.hit(st, snippet: true)
                let ageDays = max(0, now.timeIntervalSince(hit.at) / 86_400)
                // bm25 is negative, better is lower: recent turns get up to half again its weight
                scored.append((hit, sqlite3_column_double(st, 8) * (1 + 0.5 * exp(-ageDays / 14))))
            }
            if !scored.isEmpty { return scored.sorted { $0.1 < $1.1 }.prefix(limit).map(\.0) }
        }
        return []
    }

    /// Each day with turns, newest first: "yyyy-MM-dd" in local time and how many.
    public func days(kinds: Set<String>? = nil) -> [(day: String, count: Int)] {
        var sql = "SELECT date(at, 'unixepoch', 'localtime') AS d, count(*) FROM turns"
        var binds: [Any?] = []
        if let kinds, !kinds.isEmpty { sql += " WHERE kind IN (\(kinds.map { _ in "?" }.joined(separator: ",")))"; binds += kinds.sorted() }
        sql += " GROUP BY d ORDER BY d DESC"
        var out: [(String, Int)] = []
        query(sql, binds) { st in out.append((Self.text(st, 0) ?? "", Int(sqlite3_column_int64(st, 1)))) }
        return out
    }

    /// A day's turns in order (local "yyyy-MM-dd").
    public func turns(day: String, kinds: Set<String>? = nil) -> [Hit] {
        var sql = "SELECT id, thread, kind, at, you, dot, app FROM turns WHERE date(at, 'unixepoch', 'localtime') = ?"
        var binds: [Any?] = [day]
        if let kinds, !kinds.isEmpty { sql += " AND kind IN (\(kinds.map { _ in "?" }.joined(separator: ",")))"; binds += kinds.sorted() }
        sql += " ORDER BY at"
        var out: [Hit] = []
        query(sql, binds) { st in out.append(Self.hit(st, snippet: false)) }
        return out
    }

    public var count: Int { Int(scalar("SELECT count(*) FROM turns") ?? "0") ?? 0 }

    /// Hits as lines for a model (the talk tool): when, what kind, his words and Dot's.
    public static func lines(_ hits: [Hit], query: String, timeZone: TimeZone = .current) -> String {
        guard !hits.isEmpty else { return "nothing in his history matches \"\(query)\"." }
        let clock = DateFormatter()
        clock.locale = Locale(identifier: "en_US_POSIX")
        clock.timeZone = timeZone
        clock.dateFormat = "EEE MMM d yyyy, h:mm a"
        func cut(_ s: String, _ n: Int) -> String {
            let flat = s.replacingOccurrences(of: "\n", with: " ")
            return flat.count > n ? String(flat.prefix(n)) + "…" : flat
        }
        var out = ["\(hits.count) from his history for \"\(query)\" (best first):"]
        for h in hits {
            var where_ = h.kind
            if h.thread.hasPrefix("agent:") { where_ = "agent \(h.thread.dropFirst(6))" }
            if !h.app.isEmpty { where_ += " in \(h.app)" }
            var parts: [String] = []
            if !h.you.isEmpty { parts.append("he: \"\(cut(h.you, 300))\"") }
            if !h.dot.isEmpty { parts.append("\(h.kind == "agent" ? "agent" : "dot"): \"\(cut(h.dot, 300))\"") }
            out.append("- \(clock.string(from: h.at)) · \(where_) · " + parts.joined(separator: " · "))
        }
        return out.joined(separator: "\n")
    }

    // MARK: SQLite

    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static func digest(_ data: Data) -> String { TranscriptRow.legacyID(ts: "", kind: "", text: String(decoding: data, as: UTF8.self)) }

    private static func hit(_ st: OpaquePointer, snippet: Bool) -> Hit {
        Hit(id: text(st, 0) ?? "", thread: text(st, 1) ?? "", kind: text(st, 2) ?? "", at: Date(timeIntervalSince1970: sqlite3_column_double(st, 3)),
            you: text(st, 4) ?? "", dot: text(st, 5) ?? "", app: text(st, 6) ?? "", snippet: snippet ? text(st, 7) ?? "" : "")
    }

    private func exec(_ sql: String) { sqlite3_exec(db, sql, nil, nil, nil) }

    private func scalar(_ sql: String) -> String? {
        var out: String?
        query(sql, []) { st in out = Self.text(st, 0) }
        return out
    }

    private func run(_ sql: String, _ binds: [Any?]) { query(sql, binds) { _ in } }

    private func query(_ sql: String, _ binds: [Any?], row: (OpaquePointer) -> Void) {
        guard let db else { return }
        var st: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &st, nil) == SQLITE_OK, let st else { return }
        defer { sqlite3_finalize(st) }
        for (i, value) in binds.enumerated() {
            let n = Int32(i + 1)
            switch value {
            case let s as String: sqlite3_bind_text(st, n, s, -1, transient)
            case let d as Double: sqlite3_bind_double(st, n, d)
            case let v as Int: sqlite3_bind_int64(st, n, Int64(v))
            default: sqlite3_bind_null(st, n)
            }
        }
        while sqlite3_step(st) == SQLITE_ROW { row(st) }
    }

    private static func text(_ st: OpaquePointer, _ i: Int32) -> String? {
        sqlite3_column_text(st, i).map { String(cString: $0) }
    }
}

/// His words as an FTS5 query: each word quoted (so nothing in it is FTS syntax), longer words as prefixes, the
/// question words of "what did I ask about X" dropped when real words remain.
public enum HistoryQuery {
    static let filler: Set<String> = [
        "a", "about", "an", "and", "any", "anything", "ask", "asked", "did", "do", "for", "from", "i", "in", "is", "it", "last",
        "me", "my", "of", "on", "said", "say", "talk", "talked", "that", "the", "thing", "time", "to", "we", "what", "when",
        "where", "which", "with", "you",
    ]

    public static func match(_ text: String, any: Bool = false) -> String? {
        let words = text.lowercased()
            .split { !($0.isLetter || $0.isNumber) }
            .map(String.init)
            .filter { !$0.isEmpty }
        let kept = words.filter { !filler.contains($0) }
        let use = kept.isEmpty ? words : kept
        guard !use.isEmpty else { return nil }
        var seen: Set<String> = []
        let terms = use.filter { seen.insert($0).inserted }.prefix(12).map { $0.count >= 3 ? "\"\($0)\"*" : "\"\($0)\"" }
        return terms.joined(separator: any ? " OR " : " ")
    }
}

/// Talk's history tool (`dot-history`, from `Dot --history-mcp`): search_history over the index. The server reads the
/// index itself (refreshing it first), so it answers whether or not the app is running.
public enum HistoryMCPWire {
    public static let server = "dot-history"
    public static let tool = "search_history"
    public static var allowedName: String { "mcp__\(server)__\(tool)" }

    public static let tools: [(String, String, [String: Any])] = [
        (tool, "Search everything he has said to Dot and Dot said back: talk, typed questions, dictations, jobs and his agents' "
            + "threads, with when and where. For \"what did I ask about X\", \"when did we talk about Y\", \"that thing from last "
            + "week about Z\". query: the topic words. days: only the last N days (optional). kind: talk, typed, dictation or "
            + "agents (optional).",
         HandsMCPWire.schema(["query": HandsMCPWire.str, "days": ["type": "integer"], "kind": HandsMCPWire.str], required: ["query"])),
    ]

    public static func localReply(_ request: HandsMCPWire.Request) -> String? {
        guard let id = request.id else { return nil }
        switch request.method {
        case "initialize":
            return HandsMCPWire.response(id: id, result: ["protocolVersion": request.params["protocolVersion"] as? String ?? HandsMCPWire.protocolVersion,
                                                          "capabilities": ["tools": [String: Any]()],
                                                          "serverInfo": ["name": server, "version": "1"]])
        case "tools/list":
            return HandsMCPWire.response(id: id, result: ["tools": tools.map { name, description, schema -> [String: Any] in
                ["name": name, "description": description, "inputSchema": schema, "_meta": ["anthropic/alwaysLoad": true]]
            }])
        case "ping": return HandsMCPWire.response(id: id, result: [:])
        case "tools/call": return nil
        default: return HandsMCPWire.error(id: id, code: -32601, message: "method not found: \(request.method)")
        }
    }

    /// The kinds a `kind` argument means; nil for none or one it doesn't know.
    public static func kinds(_ name: String?) -> Set<String>? {
        guard let name = name?.lowercased(), !name.isEmpty else { return nil }
        let key = name.hasSuffix("s") && name != "agents" ? String(name.dropLast()) : name
        return HistoryIndex.filters.first { $0.name.lowercased() == key || $0.name.lowercased() == key + "s" }?.kinds
    }

    /// The MCP config talk gets alongside his own: only this server.
    public static func config(executable: String) -> Data? {
        let root: [String: Any] = ["mcpServers": [server: ["type": "stdio", "command": executable, "args": ["--history-mcp"]]]]
        return try? JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
    }
}
