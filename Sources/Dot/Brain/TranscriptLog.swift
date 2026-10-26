import DotKit
import Foundation

/// Everything said to Dot and by Dot, saved as it happens: a Markdown file per day for
/// reading and a JSONL file for tools, under `~/Dot/transcripts/`. Nothing is only on the
/// clipboard or only in a log line. Rows are only ever appended; each new one carries a ULID `id` and its `thread`
/// (TranscriptRow, the batch-6 storage contract), and older rows get their ids on read.
enum TranscriptLog {
    static let directory = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Dot/transcripts", isDirectory: true)

    enum Kind: String { case talk, typed, dictation, agent, lecture, job }

    /// Today's Markdown file (it may not exist yet).
    static var today: URL {
        let day = DateFormatter(); day.dateFormat = "yyyy-MM-dd"; day.locale = Locale(identifier: "en_US_POSIX")
        return directory.appendingPathComponent("\(day.string(from: Date())).md")
    }

    /// The new row's id.
    @discardableResult
    static func append(kind: Kind, you: String, dot: String?, app: String?, thread: String = TranscriptRow.dotThread, extra: [String: String] = [:]) -> String {
        let now = Date()
        let day = DateFormatter(); day.dateFormat = "yyyy-MM-dd"; day.locale = Locale(identifier: "en_US_POSIX")
        let clock = DateFormatter(); clock.dateFormat = "HH:mm"; clock.locale = Locale(identifier: "en_US_POSIX")
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let md = directory.appendingPathComponent("\(day.string(from: now)).md")
        var block = ""
        if !FileManager.default.fileExists(atPath: md.path) {
            let title = DateFormatter(); title.dateFormat = "EEEE, MMMM d, yyyy"; title.locale = Locale(identifier: "en_US_POSIX")
            block += "# Dot, \(title.string(from: now))\n\n"
        }
        let where_ = app.map { " · \($0)" } ?? ""
        block += "## \(clock.string(from: now)) · \(kind.rawValue)\(where_)\n\n"
        switch kind {
        case .dictation:
            block += "> \(you.replacingOccurrences(of: "\n", with: "\n> "))\n\n"
        default:
            block += "**You:** \(you)\n\n"
            if let dot, !dot.isEmpty { block += "**Dot:** \(dot)\n\n" }
        }
        appendText(block, to: md)
        let id = ULID.make(at: now)
        var entry: [String: Any] = ["id": id, "thread": thread, "ts": ISO8601DateFormatter().string(from: now), "kind": kind.rawValue, "you": you]
        if let dot { entry["dot"] = dot }
        if let app { entry["app"] = app }
        for (k, v) in extra { entry[k] = v }
        if let data = try? JSONSerialization.data(withJSONObject: entry), let line = String(data: data, encoding: .utf8) {
            appendText(line + "\n", to: directory.appendingPathComponent("transcripts.jsonl"))
        }
        HistoryService.refreshSoon(DotConfig.peek())
        return id
    }

    /// Every row so far, oldest first, ids included (computed for rows from before ids).
    static func rows() -> [TranscriptRow] {
        TranscriptRow.parseAll((try? String(contentsOf: directory.appendingPathComponent("transcripts.jsonl"), encoding: .utf8)) ?? "")
    }

    private static func appendText(_ text: String, to url: URL) {
        guard let data = text.data(using: .utf8) else { return }
        if let handle = try? FileHandle(forWritingTo: url) {
            defer { try? handle.close() }
            _ = try? handle.seekToEnd()
            try? handle.write(contentsOf: data)
        } else {
            try? data.write(to: url)
        }
    }
}
