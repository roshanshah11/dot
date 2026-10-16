import DotKit
import Foundation
import SQLite3

/// `~/Dot/ledger.sqlite`: one row per Claude turn (talk, think, or agent) with cost and
/// tokens as the CLI reported them, so he can see what Dot draws from the Max quota.
final class Ledger {
    struct Row: Identifiable {
        let id: Int64
        let timestamp: Date
        let kind: String
        let agent: String?
        let model: String
        let costUSD: Double
        let inputTokens: Int
        let outputTokens: Int
        let durationMs: Int
        let summary: String
    }

    private var db: OpaquePointer?
    private let queue = DispatchQueue(label: "com.roshan.dot.ledger")

    init(url: URL) {
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        if sqlite3_open(url.path, &db) != SQLITE_OK {
            Log.error("ledger: could not open \(url.path)")
            db = nil
            return
        }
        exec("""
        CREATE TABLE IF NOT EXISTS turns(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts REAL NOT NULL,
            kind TEXT NOT NULL,
            agent TEXT,
            model TEXT NOT NULL,
            cost_usd REAL NOT NULL DEFAULT 0,
            input_tokens INTEGER NOT NULL DEFAULT 0,
            output_tokens INTEGER NOT NULL DEFAULT 0,
            cache_read INTEGER NOT NULL DEFAULT 0,
            cache_create INTEGER NOT NULL DEFAULT 0,
            duration_ms INTEGER NOT NULL DEFAULT 0,
            session_id TEXT,
            summary TEXT
        );
        """)
    }

    deinit { if let db { sqlite3_close(db) } }

    func record(kind: String, agent: String?, model: String, result: ResultInfo, summary: String) {
        queue.async { [self] in
            guard let db else { return }
            var statement: OpaquePointer?
            let sql = "INSERT INTO turns(ts, kind, agent, model, cost_usd, input_tokens, output_tokens, cache_read, cache_create, duration_ms, session_id, summary) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)"
            guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return }
            defer { sqlite3_finalize(statement) }
            let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
            sqlite3_bind_double(statement, 1, Date().timeIntervalSince1970)
            sqlite3_bind_text(statement, 2, kind, -1, transient)
            if let agent { sqlite3_bind_text(statement, 3, agent, -1, transient) } else { sqlite3_bind_null(statement, 3) }
            sqlite3_bind_text(statement, 4, model, -1, transient)
            sqlite3_bind_double(statement, 5, result.costUSD)
            sqlite3_bind_int64(statement, 6, Int64(result.inputTokens))
            sqlite3_bind_int64(statement, 7, Int64(result.outputTokens))
            sqlite3_bind_int64(statement, 8, Int64(result.cacheReadTokens))
            sqlite3_bind_int64(statement, 9, Int64(result.cacheCreationTokens))
            sqlite3_bind_int64(statement, 10, Int64(result.durationMs))
            if let session = result.sessionId { sqlite3_bind_text(statement, 11, session, -1, transient) } else { sqlite3_bind_null(statement, 11) }
            sqlite3_bind_text(statement, 12, String(summary.prefix(200)), -1, transient)
            if sqlite3_step(statement) != SQLITE_DONE { Log.warn("ledger: insert failed") }
        }
    }

    func recent(limit: Int = 50, agent: String? = nil) -> [Row] {
        queue.sync { [self] in
            guard let db else { return [] }
            var statement: OpaquePointer?
            let sql = agent == nil
                ? "SELECT id, ts, kind, agent, model, cost_usd, input_tokens, output_tokens, duration_ms, summary FROM turns ORDER BY id DESC LIMIT ?"
                : "SELECT id, ts, kind, agent, model, cost_usd, input_tokens, output_tokens, duration_ms, summary FROM turns WHERE agent = ? ORDER BY id DESC LIMIT ?"
            guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return [] }
            defer { sqlite3_finalize(statement) }
            let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
            if let agent {
                sqlite3_bind_text(statement, 1, agent, -1, transient)
                sqlite3_bind_int(statement, 2, Int32(limit))
            } else {
                sqlite3_bind_int(statement, 1, Int32(limit))
            }
            var rows: [Row] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                rows.append(Row(
                    id: sqlite3_column_int64(statement, 0),
                    timestamp: Date(timeIntervalSince1970: sqlite3_column_double(statement, 1)),
                    kind: text(statement, 2) ?? "",
                    agent: text(statement, 3),
                    model: text(statement, 4) ?? "",
                    costUSD: sqlite3_column_double(statement, 5),
                    inputTokens: Int(sqlite3_column_int64(statement, 6)),
                    outputTokens: Int(sqlite3_column_int64(statement, 7)),
                    durationMs: Int(sqlite3_column_int64(statement, 8)),
                    summary: text(statement, 9) ?? ""
                ))
            }
            return rows
        }
    }

    /// (turns, cost) since the start of today.
    /// Cost per agent since `since` (the talk and think turns under "talk"), for the Agents page.
    func spendByAgent(since: Date) -> [String: Double] {
        var out: [String: Double] = [:]
        queue.sync { [self] in
            guard let db else { return }
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(db, "SELECT COALESCE(agent, ''), COALESCE(SUM(cost_usd), 0) FROM turns WHERE ts >= ? GROUP BY agent", -1, &statement, nil) == SQLITE_OK else { return }
            defer { sqlite3_finalize(statement) }
            sqlite3_bind_double(statement, 1, since.timeIntervalSince1970)
            while sqlite3_step(statement) == SQLITE_ROW {
                let agent = text(statement, 0) ?? ""
                out[agent.isEmpty ? "talk" : agent] = sqlite3_column_double(statement, 1)
            }
        }
        return out
    }

    func today() -> (turns: Int, costUSD: Double) {
        queue.sync { [self] in
            guard let db else { return (0, 0) }
            let start = Calendar.current.startOfDay(for: Date()).timeIntervalSince1970
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(db, "SELECT COUNT(*), COALESCE(SUM(cost_usd), 0) FROM turns WHERE ts >= ?", -1, &statement, nil) == SQLITE_OK else { return (0, 0) }
            defer { sqlite3_finalize(statement) }
            sqlite3_bind_double(statement, 1, start)
            guard sqlite3_step(statement) == SQLITE_ROW else { return (0, 0) }
            return (Int(sqlite3_column_int64(statement, 0)), sqlite3_column_double(statement, 1))
        }
    }

    private func text(_ statement: OpaquePointer?, _ column: Int32) -> String? {
        guard let pointer = sqlite3_column_text(statement, column) else { return nil }
        return String(cString: pointer)
    }

    private func exec(_ sql: String) {
        guard let db else { return }
        var message: UnsafeMutablePointer<CChar>?
        if sqlite3_exec(db, sql, nil, nil, &message) != SQLITE_OK {
            Log.error("ledger: \(message.map { String(cString: $0) } ?? "exec failed")")
            sqlite3_free(message)
        }
    }
}
