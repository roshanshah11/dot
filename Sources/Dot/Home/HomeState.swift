import DotKit
import Foundation
import SQLite3

/// Home's own state (parity batch 6 storage contract), in ~/Dot/home-state.sqlite with a schema version: the draft and
/// scroll place per thread (HO-07, HO-08), reactions per turn (HO-06), prompt cards (HO-11). The talk log and the
/// agents' transcripts are never written here or from here.
@MainActor
final class HomeState {
    static let shared = HomeState(url: URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Dot/home-state.sqlite"))
    static let schemaVersion = 2

    private var db: OpaquePointer?
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    init(url: URL) {
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        guard sqlite3_open(url.path, &db) == SQLITE_OK else { Log.warn("home state: can't open \(url.path)"); db = nil; return }
        migrate()
    }

    private func exec(_ sql: String) { sqlite3_exec(db, sql, nil, nil, nil) }

    private func migrate() {
        exec("CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT)")
        let version = Int(scalar("SELECT value FROM meta WHERE key = 'schema'") ?? "0") ?? 0
        if version < 1 {
            exec("""
            CREATE TABLE IF NOT EXISTS drafts(thread TEXT PRIMARY KEY, text TEXT NOT NULL, attachments TEXT NOT NULL DEFAULT '[]', updated REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS scroll(thread TEXT PRIMARY KEY, anchor TEXT, newest TEXT, updated REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS reactions(turn TEXT PRIMARY KEY, thread TEXT NOT NULL, emoji TEXT NOT NULL, text TEXT NOT NULL DEFAULT '', at REAL NOT NULL, told INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS prompt_cards(id TEXT PRIMARY KEY, title TEXT NOT NULL, text TEXT NOT NULL, color TEXT NOT NULL, ord INTEGER NOT NULL);
            INSERT OR REPLACE INTO meta(key, value) VALUES('schema', '1');
            """)
        }
        if version < 2 {
            exec("""
            CREATE TABLE IF NOT EXISTS agent_icons(slug TEXT PRIMARY KEY, symbol TEXT NOT NULL);
            INSERT OR REPLACE INTO meta(key, value) VALUES('schema', '2');
            """)
        }
    }

    private func scalar(_ sql: String) -> String? {
        var st: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &st, nil) == SQLITE_OK else { return nil }
        defer { sqlite3_finalize(st) }
        guard sqlite3_step(st) == SQLITE_ROW, let c = sqlite3_column_text(st, 0) else { return nil }
        return String(cString: c)
    }

    private func run(_ sql: String, _ binds: [Any?], row: ((OpaquePointer) -> Void)? = nil) {
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
        while sqlite3_step(st) == SQLITE_ROW { row?(st) }
    }

    private static func text(_ st: OpaquePointer, _ i: Int32) -> String? {
        sqlite3_column_text(st, i).map { String(cString: $0) }
    }

    // MARK: Drafts (HO-07)

    func saveDraft(thread: String, text: String, attachments: [URL]) {
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && attachments.isEmpty {
            run("DELETE FROM drafts WHERE thread = ?", [thread])
            return
        }
        let files = (try? JSONEncoder().encode(attachments.map(\.path))).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
        run("INSERT OR REPLACE INTO drafts(thread, text, attachments, updated) VALUES(?, ?, ?, ?)", [thread, text, files, Date().timeIntervalSince1970])
    }

    func draft(thread: String) -> (text: String, attachments: [URL]) {
        var out: (String, [URL]) = ("", [])
        run("SELECT text, attachments FROM drafts WHERE thread = ?", [thread]) { st in
            let files = (Self.text(st, 1)?.data(using: .utf8)).flatMap { try? JSONDecoder().decode([String].self, from: $0) } ?? []
            out = (Self.text(st, 0) ?? "", files.map { URL(fileURLWithPath: $0) }.filter { FileManager.default.fileExists(atPath: $0.path) })
        }
        return out
    }

    func threadsWithDrafts() -> Set<String> {
        var out: Set<String> = []
        run("SELECT thread FROM drafts", []) { st in if let t = Self.text(st, 0) { out.insert(t) } }
        return out
    }

    // MARK: Scroll (HO-08)

    func saveScroll(thread: String, anchor: String?, newest: String?) {
        run("INSERT OR REPLACE INTO scroll(thread, anchor, newest, updated) VALUES(?, ?, ?, ?)", [thread, anchor, newest, Date().timeIntervalSince1970])
    }

    func scroll(thread: String) -> (anchor: String?, newest: String?) {
        var out: (String?, String?) = (nil, nil)
        run("SELECT anchor, newest FROM scroll WHERE thread = ?", [thread]) { st in out = (Self.text(st, 0), Self.text(st, 1)) }
        return out
    }

    // MARK: Reactions (HO-06)

    func react(turn: String, thread: String, emoji: String?, text: String) {
        if let emoji {
            run("INSERT OR REPLACE INTO reactions(turn, thread, emoji, text, at, told) VALUES(?, ?, ?, ?, ?, 0)", [turn, thread, emoji, String(text.prefix(300)), Date().timeIntervalSince1970])
        } else {
            run("DELETE FROM reactions WHERE turn = ?", [turn])
        }
    }

    func reactions(thread: String) -> [String: String] {
        var out: [String: String] = [:]
        run("SELECT turn, emoji FROM reactions WHERE thread = ?", [thread]) { st in
            if let t = Self.text(st, 0), let e = Self.text(st, 1) { out[t] = e }
        }
        return out
    }

    /// Reactions the thread's agent hasn't been told about, marked told (its next turn carries them).
    func takeUntold(thread: String) -> [(emoji: String, text: String)] {
        var out: [(String, String)] = []
        run("SELECT emoji, text FROM reactions WHERE thread = ? AND told = 0 ORDER BY at", [thread]) { st in
            out.append((Self.text(st, 0) ?? "", Self.text(st, 1) ?? ""))
        }
        if !out.isEmpty { run("UPDATE reactions SET told = 1 WHERE thread = ?", [thread]) }
        return out
    }

    // MARK: Prompt cards (HO-11)

    struct PromptCard: Identifiable, Equatable { let id: String; var title: String; var text: String; var color: String; var ord: Int }

    func promptCards() -> [PromptCard] {
        var out: [PromptCard] = []
        run("SELECT id, title, text, color, ord FROM prompt_cards ORDER BY ord", []) { st in
            out.append(PromptCard(id: Self.text(st, 0) ?? "", title: Self.text(st, 1) ?? "", text: Self.text(st, 2) ?? "",
                                  color: Self.text(st, 3) ?? "blue", ord: Int(sqlite3_column_int64(st, 4))))
        }
        return out
    }

    func savePromptCard(_ card: PromptCard) {
        run("INSERT OR REPLACE INTO prompt_cards(id, title, text, color, ord) VALUES(?, ?, ?, ?, ?)", [card.id, card.title, card.text, card.color, card.ord])
    }

    func deletePromptCard(_ id: String) { run("DELETE FROM prompt_cards WHERE id = ?", [id]) }

    // MARK: Agent icons (HO-15)

    /// His picks; an agent without one gets the rule table's.
    func agentIcons() -> [String: String] {
        var out: [String: String] = [:]
        run("SELECT slug, symbol FROM agent_icons", []) { st in if let a = Self.text(st, 0), let b = Self.text(st, 1) { out[a] = b } }
        return out
    }

    /// nil goes back to the rule table's pick.
    func setAgentIcon(_ slug: String, _ symbol: String?) {
        if let symbol { run("INSERT OR REPLACE INTO agent_icons(slug, symbol) VALUES(?, ?)", [slug, symbol]) }
        else { run("DELETE FROM agent_icons WHERE slug = ?", [slug]) }
    }

    var version: Int { Int(scalar("SELECT value FROM meta WHERE key = 'schema'") ?? "0") ?? 0 }
}
