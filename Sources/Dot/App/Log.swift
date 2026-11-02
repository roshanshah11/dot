import Foundation
import os

/// One log file at `~/Library/Logs/Dot/dot.log` plus the unified log. Never logs
/// screenshot bytes, transcripts, or agent messages beyond their first 120 characters.
enum Log {
    private static let logger = Logger(subsystem: "com.roshan.dot", category: "dot")
    private static let queue = DispatchQueue(label: "com.roshan.dot.log")
    private static let fileURL: URL = {
        // A self-test run or the headless job harness writes its own file (DOT_LOG_FILE), never his dot.log.
        if let path = ProcessInfo.processInfo.environment["DOT_LOG_FILE"], !path.isEmpty { return URL(fileURLWithPath: path) }
        let dir = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Logs/Dot", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("dot.log")
    }()
    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
        return f
    }()

    static func info(_ message: String) { write("INFO", message); logger.info("\(message, privacy: .public)") }
    static func warn(_ message: String) { write("WARN", message); logger.warning("\(message, privacy: .public)") }
    static func error(_ message: String) { write("ERROR", message); logger.error("\(message, privacy: .public)") }

    /// Waits until every line written so far is in the file: the lines of a quit are written
    /// last thing before the process ends.
    static func flush() { queue.sync {} }

    /// The newest line in the file's last megabyte that contains `text`, written after the newest line containing `since`
    /// (a running Dot's latest decision since it launched, for a CLI).
    static func lastLine(containing text: String, since: String) -> String? {
        guard let handle = try? FileHandle(forReadingFrom: fileURL) else { return nil }
        defer { try? handle.close() }
        let end = (try? handle.seekToEnd()) ?? 0
        try? handle.seek(toOffset: end > 1_000_000 ? end - 1_000_000 : 0)
        guard let data = try? handle.readToEnd() else { return nil }
        let lines = String(decoding: data, as: UTF8.self).split(separator: "\n")
        let start = lines.lastIndex { $0.contains(since) } ?? lines.startIndex
        return lines[start...].last { $0.contains(text) }.map(String.init)
    }

    static func short(_ text: String, _ limit: Int = 120) -> String {
        let one = text.replacingOccurrences(of: "\n", with: " ")
        return one.count > limit ? String(one.prefix(limit)) + "…" : one
    }

    private static func write(_ level: String, _ message: String) {
        let line = "\(formatter.string(from: Date())) \(level) \(message)\n"
        queue.async {
            guard let data = line.data(using: .utf8) else { return }
            if let handle = try? FileHandle(forWritingTo: fileURL) {
                defer { try? handle.close() }
                _ = try? handle.seekToEnd()
                try? handle.write(contentsOf: data)
            } else {
                try? data.write(to: fileURL)
            }
        }
    }
}
