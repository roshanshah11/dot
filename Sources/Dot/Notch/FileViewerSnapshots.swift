import AppKit
import DotKit
import SwiftUI

/// `Dot --snapshot <folder> viewer`: the notch file viewer drawn to PNGs (parity H2). The grid is an AppKit view, which
/// ImageRenderer can't draw, so these go through an offscreen window and cacheDisplay.
@MainActor
extension Snapshots {
    static func viewerStates() -> [(String, NSImage)] {
        var out: [(String, NSImage)] = []
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("dot-viewer-snapshot", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        // DotKit's model-shaped sample, with a cell picked so the formula bar shows a formula
        let sample = folder.appendingPathComponent("MLV Revenue Model.xlsx")
        try? XLSXSample.data.write(to: sample)
        if let image = renderViewer(sample, kind: .sheet, select: CellPos(row: 6, column: 2)) { out.append(("xlsx-sample", image)) }
        // the second tab
        if let image = renderViewer(sample, kind: .sheet, sheet: 1) { out.append(("xlsx-sample-tab2", image)) }
        // frozen panes holding while the body scrolls: the sample scrolled right and down
        if let image = renderGrid(sample, scroll: CGPoint(x: 140, y: 60), size: CGSize(width: 640, height: 300)) { out.append(("xlsx-frozen-scrolled", image)) }
        let csv = folder.appendingPathComponent("postings.csv")
        try? "firm,role,deadline,pay\nNorthwind,Summer Analyst,2026-11-01,\"$110,000\"\nContoso,\"Analyst, Restructuring\",2026-11-15,\"$105,000\"\nFabrikam,Quant Intern,rolling,\n".write(to: csv, atomically: true, encoding: .utf8)
        if let image = renderViewer(csv, kind: .sheet, size: CGSize(width: 820, height: 300)) { out.append(("csv", image)) }
        // any file of his, read only: DOT_VIEWER_FILE=~/path/model.xlsx Dot --snapshot <folder> viewer
        if let path = ProcessInfo.processInfo.environment["DOT_VIEWER_FILE"], !path.isEmpty {
            let url = URL(fileURLWithPath: (path as NSString).expandingTildeInPath)
            if let kind = FileViewer.kind(of: url), kind == .sheet, let image = renderViewer(url, kind: kind, size: CGSize(width: 1060, height: 720)) {
                out.append(("file", image))
            }
        }
        return out
    }

    private static func renderViewer(_ url: URL, kind: FileViewer.Kind, sheet: Int = 0, select: CellPos? = nil,
                                      size: CGSize = CGSize(width: 1000, height: 560)) -> NSImage? {
        let model = FileViewerModel()
        model.url = url
        model.kind = kind
        model.sheets = (try? FileViewerModel.readSheets(url)) ?? []
        model.sheetIndex = sheet
        model.selected = select
        return draw(NSHostingView(rootView: FileViewerView(model: model, topInset: 32)), size: size)
    }

    private static func renderGrid(_ url: URL, scroll: CGPoint, size: CGSize) -> NSImage? {
        guard let sheet = try? FileViewerModel.readSheets(url).first else { return nil }
        let host = SheetGridHost(frame: CGRect(origin: .zero, size: size))
        host.show(sheet, key: "snapshot")
        host.layoutSubtreeIfNeeded()
        host.scroll.contentView.scroll(to: scroll)
        host.scroll.reflectScrolledClipView(host.scroll.contentView)
        return draw(host, size: size)
    }

    private static func draw(_ view: NSView, size: CGSize) -> NSImage? {
        let window = NSWindow(contentRect: CGRect(origin: CGPoint(x: -10_000, y: -10_000), size: size), styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.contentView = view
        view.frame = CGRect(origin: .zero, size: size)
        view.layoutSubtreeIfNeeded()
        spinBriefly()
        view.layoutSubtreeIfNeeded()
        guard let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { return nil }
        view.cacheDisplay(in: view.bounds, to: rep)
        let image = NSImage(size: size)
        image.addRepresentation(rep)
        window.contentView = nil
        return image
    }

    private static func spinBriefly() {
        let until = Date().addingTimeInterval(0.25)
        while Date() < until { RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.03)) }
    }
}

/// `Dot --snapshot <folder> history`: Home's History page (parity HO-14) on a made-up sample history, a day and a search.
@MainActor
extension Snapshots {
    static func historyStates() -> [(String, NSImage)] {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("dot-history-snapshot-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let talk = folder.appendingPathComponent("transcripts")
        let agent = folder.appendingPathComponent("agents/lab-desk/.dot")
        try? FileManager.default.createDirectory(at: talk, withIntermediateDirectories: true)
        try? FileManager.default.createDirectory(at: agent, withIntermediateDirectories: true)
        let day = ISO8601DateFormatter()
        func at(_ hoursAgo: Double) -> String { day.string(from: Date().addingTimeInterval(-hoursAgo * 3600)) }
        let talkRows: [[String: String]] = [
            ["kind": "typed", "ts": at(50), "you": "what's rank", "dot": "the number of independent columns: the dimension of the column space.", "app": "Safari"],
            ["kind": "talk", "ts": at(26), "you": "explain how dna replication works, draw it for me", "dot": "the double helix unzips at the fork; one strand is copied in one go, the other in short pieces.", "app": "Comet"],
            ["kind": "talk", "ts": at(3), "you": "is rank-nullity on the midterm?", "dot": "very likely: it ties rank to the kernel, and the review sheet lists it.", "app": "Comet"],
            ["kind": "typed", "ts": at(2), "you": "what's a basis", "dot": "a spanning set with nothing extra: every vector in the space is one combination of it.", "app": "Notes"],
        ]
        let agentRows: [[String: String]] = [
            ["ts": at(5), "role": "user", "text": "find the rank-nullity proof in the lecture slides"],
            ["ts": at(4.9), "role": "assistant", "text": "It's on slide 14 of lecture 7, right after the definition of the kernel."],
        ]
        func lines(_ rows: [[String: String]]) -> String {
            rows.compactMap { (try? JSONSerialization.data(withJSONObject: $0)).map { String(decoding: $0, as: UTF8.self) } }.joined(separator: "\n") + "\n"
        }
        try? lines(talkRows).write(to: talk.appendingPathComponent("transcripts.jsonl"), atomically: true, encoding: .utf8)
        try? lines(agentRows).write(to: agent.appendingPathComponent("transcript.jsonl"), atomically: true, encoding: .utf8)
        let indexURL = folder.appendingPathComponent("index.sqlite")
        HistoryIndex(url: indexURL)?.refresh(HistoryIndex.sources(transcripts: talk, agentsRoot: folder.appendingPathComponent("agents"), murmur: nil))
        let config = DotConfig.peek()
        var out: [(String, NSImage)] = []
        for (name, query) in [("day", ""), ("search", "rank")] {
            let page = HistoryPage(config: config, agentName: { $0 == "lab-desk" ? "Lab Desk" : nil }, store: .fixed(indexURL), query: query)
                .frame(width: 900, height: 560).background(Color(nsColor: .windowBackgroundColor))
            if let image = drawHosted(NSHostingView(rootView: page), size: CGSize(width: 900, height: 560)) { out.append(("history-\(name)", image)) }
        }
        return out
    }

    /// An SwiftUI page that loads on appear: given a moment to load before it's drawn.
    static func drawHosted(_ view: NSView, size: CGSize, wait: TimeInterval = 1.2) -> NSImage? {
        let window = NSWindow(contentRect: CGRect(origin: CGPoint(x: -10_000, y: -10_000), size: size), styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.contentView = view
        view.frame = CGRect(origin: .zero, size: size)
        let until = Date().addingTimeInterval(wait)
        while Date() < until { RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.03)) }
        view.layoutSubtreeIfNeeded()
        guard let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { return nil }
        view.cacheDisplay(in: view.bounds, to: rep)
        let image = NSImage(size: size)
        image.addRepresentation(rep)
        window.contentView = nil
        return image
    }
}
