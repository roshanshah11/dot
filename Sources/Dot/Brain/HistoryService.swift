import DotKit
import Foundation

/// The app's side of past-chat search (parity H1, HO-14): one index, refreshed in the background at launch and a moment
/// after each new turn, for Home's History page. Talk's search_history tool runs in its own process (`Dot --history-mcp`)
/// over the same file.
enum HistoryService {
    static let indexURL = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Dot/index/transcripts.sqlite")
    private static let queue = DispatchQueue(label: "dot.history", qos: .utility)
    nonisolated(unsafe) private static var index: HistoryIndex?
    nonisolated(unsafe) private static var pending: DispatchWorkItem?

    static func sources(_ config: DotConfig) -> [HistoryIndex.Source] {
        HistoryIndex.sources(transcripts: TranscriptLog.directory, agentsRoot: config.agentsRootURL,
                             murmur: URL(fileURLWithPath: DotConfig.expand(config.murmurHistoryFile)))
    }

    /// The live index (refreshed before each read), or a fixed file read as it is.
    enum Store { case shared, fixed(URL) }

    /// Runs `body` on the index's queue; nil when the index can't open.
    static func read<T>(_ config: DotConfig, store: Store = .shared, _ body: @escaping (HistoryIndex) -> T, then done: @escaping @MainActor (T?) -> Void) {
        let sources = sources(config)
        queue.async {
            let result: T?
            switch store {
            case .shared:
                result = open().map { index in
                    index.refresh(sources)
                    return body(index)
                }
            case .fixed(let url):
                result = HistoryIndex(url: url).map(body)
            }
            Task { @MainActor in done(result) }
        }
    }

    /// A refresh a couple of seconds from now (several turns in a row make one).
    static func refreshSoon(_ config: DotConfig) {
        let sources = sources(config)
        queue.async {
            pending?.cancel()
            let work = DispatchWorkItem { open()?.refresh(sources) }
            pending = work
            queue.asyncAfter(deadline: .now() + 2, execute: work)
        }
    }

    private static func open() -> HistoryIndex? {
        if index == nil { index = HistoryIndex(url: indexURL) }
        return index
    }

    /// The MCP config file talk gets alongside his own (`--mcp-config` takes several), written by Dot, never his file.
    static func talkMCPConfig() -> String? {
        guard let executable = Bundle.main.executablePath, let data = HistoryMCPWire.config(executable: executable) else { return nil }
        let url = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Dot/.mcp/talk-history.json")
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        if (try? Data(contentsOf: url)) != data { try? data.write(to: url, options: .atomic) }
        return FileManager.default.fileExists(atPath: url.path) ? url.path : nil
    }
}

/// `Dot --history-mcp`: talk's search_history tool as a stdio MCP server. It opens the index, reads what's new, and
/// searches; nothing goes to the running app. Nothing but JSON-RPC goes to stdout.
enum HistoryMCPServer {
    static func run() -> Never {
        let config = DotConfig.peek()
        var index: HistoryIndex?
        while let line = readLine(strippingNewline: true) {
            guard !line.trimmingCharacters(in: .whitespaces).isEmpty, let request = HandsMCPWire.parse(line) else { continue }
            if let reply = HistoryMCPWire.localReply(request) { write(reply); continue }
            guard request.method == "tools/call", let id = request.id else { continue }
            let args = request.params["arguments"] as? [String: Any] ?? [:]
            guard request.params["name"] as? String == HistoryMCPWire.tool else {
                write(HandsMCPWire.response(id: id, result: HandsMCPWire.callResult(text: "error: no such tool", isError: true)))
                continue
            }
            let query = (args["query"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if index == nil { index = HistoryIndex(url: HistoryService.indexURL) }
            guard let index, !query.isEmpty else {
                write(HandsMCPWire.response(id: id, result: HandsMCPWire.callResult(text: index == nil ? "error: the history index can't open" : "error: query is empty", isError: true)))
                continue
            }
            index.refresh(HistoryService.sources(config))
            let days = (args["days"] as? Int) ?? (args["days"] as? Double).map { Int($0) } ?? (args["days"] as? String).flatMap { Int($0) }
            let hits = index.search(query, days: days, kinds: HistoryMCPWire.kinds(args["kind"] as? String), limit: 8)
            write(HandsMCPWire.response(id: id, result: HandsMCPWire.callResult(text: HistoryIndex.lines(hits, query: query), isError: false)))
        }
        exit(0)
    }

    private static func write(_ line: String) { FileHandle.standardOutput.write(Data((line + "\n").utf8)) }
}
