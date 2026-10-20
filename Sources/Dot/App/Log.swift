import Foundation
import os

/// One log file at `~/Library/Logs/Dot/dot.log` plus the unified log. Never logs
/// screenshot bytes, transcripts, or agent messages beyond their first 120 characters.
enum Log {
    private static let logger = Logger(subsystem: "com.roshan.dot", category: "dot")
    private static let queue = DispatchQueue(label: "com.roshan.dot.log")
    private static let fileURL: URL = {
        // The headless job harness writes its own file, never his dot.log.
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
