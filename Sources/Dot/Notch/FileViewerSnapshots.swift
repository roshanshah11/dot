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
