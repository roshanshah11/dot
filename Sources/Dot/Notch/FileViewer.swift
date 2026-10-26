import AppKit
import DotKit
import PDFKit
import SwiftUI

/// The notch file viewer (parity H2): a file from a job, an agent's output or a file card drops out of the notch in a
/// read-only viewer. PDFs (PDFKit), images, plain text, and .xlsx/.csv as a grid with the sheet's own column widths,
/// frozen panes, number formats, fonts, fills, merges and sheet tabs. Markdown goes to the reader window
/// (MarkdownViewer); anything else opens in its own app. The header opens the file in its app; Escape, the close
/// button or clicking anywhere else puts the viewer away.
@MainActor
enum FileViewer {
    enum Kind: Equatable { case pdf, image, sheet, text, markdown }

    static func kind(of url: URL) -> Kind? {
        if MarkdownViewer.isMarkdown(url) { return .markdown }
        switch url.pathExtension.lowercased() {
        case "pdf": return .pdf
        case "png", "jpg", "jpeg", "gif", "heic", "tif", "tiff", "bmp", "webp": return .image
        case "xlsx", "xlsm", "csv", "tsv": return .sheet
        case "txt", "log", "json", "jsonl", "yaml", "yml", "toml", "xml", "swift", "py", "js", "ts", "sh", "css", "tex", "bib": return .text
        default: return nil
        }
    }

    static func canShow(_ url: URL) -> Bool { url.isFileURL && kind(of: url) != nil }

    private static var controller: FileViewerController?

    /// Shows a file: in the viewer when it can, Markdown in the reader, anything else in its own app.
    static func show(_ url: URL) {
        let url = url.standardizedFileURL
        guard url.isFileURL, FileManager.default.fileExists(atPath: url.path), let kind = kind(of: url) else {
            NSWorkspace.shared.open(url)
            return
        }
        if kind == .markdown { MarkdownViewer.show(file: url); return }
        let controller = controller ?? FileViewerController()
        self.controller = controller
        controller.show(url, kind: kind)
    }

    static func close() { controller?.close() }
}

struct CellPos: Equatable { var row: Int; var column: Int }

@MainActor
final class FileViewerModel: ObservableObject {
    @Published var url: URL?
    @Published var kind: FileViewer.Kind = .text
    /// The visible sheets (hidden ones stay hidden, as in Excel).
    @Published var sheets: [XLSXSheet] = []
    @Published var sheetIndex = 0
    @Published var loading = false
    @Published var problem: String?
    @Published var text = ""
    @Published var image: NSImage?
    @Published var selected: CellPos?
    var onClose: () -> Void = {}
    private var token = UUID()

    var sheet: XLSXSheet? { sheets.indices.contains(sheetIndex) ? sheets[sheetIndex] : nil }
    var sheetKey: String { "\(url?.path ?? "")#\(sheetIndex)" }

    func load(_ url: URL, kind: FileViewer.Kind) {
        self.url = url
        self.kind = kind
        problem = nil; sheets = []; sheetIndex = 0; text = ""; image = nil; selected = nil
        let token = UUID()
        self.token = token
        switch kind {
        case .sheet:
            loading = true
            // read off the main thread (his largest workbook takes most of a second), then show it if it's still the one asked for
            Task { [weak self] in
                let result = await Task.detached(priority: .userInitiated) { Result { try FileViewerModel.readSheets(url) } }.value
                guard let self, self.token == token else { return }
                self.loading = false
                switch result {
                case .success(let sheets):
                    self.sheets = sheets
                    if sheets.isEmpty { self.problem = "This workbook has no sheets to show." }
                case .failure(let error):
                    self.problem = "Couldn't read this workbook: \(error)"
                }
            }
        case .image:
            image = NSImage(contentsOf: url)
            if image == nil { problem = "Couldn't read this image." }
        case .text:
            let data = (try? FileHandle(forReadingFrom: url)).map { handle -> Data in
                defer { try? handle.close() }
                return (try? handle.read(upToCount: 2_000_000)) ?? Data()
            } ?? Data()
            text = String(decoding: data, as: UTF8.self)
        case .pdf, .markdown:
            break
        }
    }

    nonisolated static func readSheets(_ url: URL) throws -> [XLSXSheet] {
        let ext = url.pathExtension.lowercased()
        if ext == "csv" || ext == "tsv" {
            let data = try Data(contentsOf: url)
            var text = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .windowsCP1252) ?? String(decoding: data, as: UTF8.self)
            if text.hasPrefix("\u{FEFF}") { text.removeFirst() }
            return [XLSXSheet.table(name: url.deletingPathExtension().lastPathComponent, text: text,
                                    separator: DelimitedText.separator(for: text, pathExtension: ext))]
        }
        return try XLSXWorkbook(url: url).sheets.filter { !$0.hidden }
    }

    /// The selected cell's content the way Excel's formula bar shows it: the formula, else the value unformatted.
    var formulaBar: (ref: String, text: String)? {
        guard let pos = selected, let sheet else { return nil }
        let ref = "\(XLSXRef.column(pos.column))\(pos.row + 1)"
        guard let cell = sheet.cell(row: pos.row, column: pos.column) else { return (ref, "") }
        if let formula = cell.formula { return (ref, "=" + formula) }
        switch cell.value {
        case .number(let n): return (ref, ExcelFormat.isDate(cell.style.format) ? cell.shown : ExcelFormat.trimZeros(String(format: "%.15g", n)))
        case .text(let s): return (ref, s)
        case .bool(let b): return (ref, b ? "TRUE" : "FALSE")
        case .error(let e): return (ref, e)
        case .empty: return (ref, "")
        }
    }
}

// MARK: The window

final class FileViewerPanel: KeyablePanel {}

@MainActor
final class FileViewerController: NSObject, NSWindowDelegate {
    let model = FileViewerModel()
    private var panel: FileViewerPanel?
    private var hosting: NSHostingView<FileViewerView>?
    private var keyMonitor: Any?
    private(set) var isShowing = false

    override init() {
        super.init()
        model.onClose = { [weak self] in self?.close() }
    }

    func show(_ url: URL, kind: FileViewer.Kind) {
        model.load(url, kind: kind)
        let panel = ensurePanel()
        let place = placement()
        hosting?.rootView = FileViewerView(model: model, topInset: place.inset)
        if isShowing {
            panel.setFrame(place.frame, display: true)
        } else {
            panel.alphaValue = 1
            panel.setFrame(place.start, display: false)
            panel.orderFrontRegardless()
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.24
                context.timingFunction = CAMediaTimingFunction(name: .easeOut)
                panel.animator().setFrame(place.frame, display: true)
            }
        }
        panel.makeKey()
        isShowing = true
        if keyMonitor == nil {
            keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
                guard let self, self.isShowing, event.window === self.panel, event.keyCode == 53 else { return event }
                self.close()
                return nil
            }
        }
    }

    func close() {
        guard isShowing, let panel else { return }
        isShowing = false
        if let keyMonitor { NSEvent.removeMonitor(keyMonitor); self.keyMonitor = nil }
        let start = placement().start
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = 0.18
            context.timingFunction = CAMediaTimingFunction(name: .easeIn)
            panel.animator().setFrame(start, display: true)
            panel.animator().alphaValue = 0
        }, completionHandler: { [weak self] in
            Task { @MainActor in
                guard let self, !self.isShowing else { return }
                panel.orderOut(nil)
                // a big workbook holds tens of megabytes; nothing is kept once the viewer is put away
                self.model.sheets = []
                self.model.image = nil
                self.model.text = ""
            }
        })
    }

    /// Clicking anywhere else (or opening the file in its app) puts the viewer away.
    func windowDidResignKey(_ notification: Notification) { close() }

    private func ensurePanel() -> FileViewerPanel {
        if let panel { return panel }
        let panel = FileViewerPanel(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.isFloatingPanel = true
        // above the notch's own window, which sits at the status bar level
        panel.level = NSWindow.Level(rawValue: NSWindow.Level.statusBar.rawValue + 1)
        panel.becomesKeyOnlyIfNeeded = false
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.delegate = self
        let hosting = NSHostingView(rootView: FileViewerView(model: model, topInset: 32))
        panel.contentView = hosting
        self.hosting = hosting
        self.panel = panel
        return panel
    }

    /// Where the viewer sits: centered under the notch (or the menu bar), its top flush with the screen's; `start` is
    /// the notch itself, which it grows out of and folds back into.
    private func placement() -> (frame: CGRect, start: CGRect, inset: CGFloat) {
        let screen = NSScreen.screens.first(where: { $0.safeAreaInsets.top > 0 }) ?? NSScreen.main ?? NSScreen.screens.first
        let full = screen?.frame ?? CGRect(x: 0, y: 0, width: 1440, height: 900)
        let visible = screen?.visibleFrame ?? full
        let menuBar = max(0, full.maxY - visible.maxY)
        let inset = max(screen?.safeAreaInsets.top ?? 0, menuBar, 24)
        let notch = screen.map { NotchGeometry.measure(frame: $0.frame, safeAreaTop: $0.safeAreaInsets.top,
                                                        auxLeft: $0.auxiliaryTopLeftArea, auxRight: $0.auxiliaryTopRightArea) }
        let centerX = notch?.centerX ?? full.midX
        let width = min(1060, full.width - 120)
        let height = min(720, full.height * 0.8)
        let frame = CGRect(x: centerX - width / 2, y: full.maxY - height, width: width, height: height)
        let notchWidth = notch?.notchWidth ?? NotchGeometry.fallbackNotchWidth
        let start = CGRect(x: centerX - notchWidth / 2, y: full.maxY - inset, width: notchWidth, height: inset)
        return (frame, start, inset)
    }
}

// MARK: The view

struct FileViewerView: View {
    @ObservedObject var model: FileViewerModel
    let topInset: CGFloat
    private let ink = Color.white

    var body: some View {
        VStack(spacing: 0) {
            header
                .padding(.top, topInset + 6)
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            if model.kind == .sheet, model.sheets.count > 1 { tabs }
        }
        .background(Color.black)
        .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 18, bottomTrailingRadius: 18))
    }

    private var header: some View {
        HStack(spacing: 10) {
            if let url = model.url {
                Image(systemName: NotchHUDView.symbol(forFile: url))
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.fileColor(url) ?? ink.opacity(0.8))
                VStack(alignment: .leading, spacing: 1) {
                    Text(url.lastPathComponent).font(.system(size: 13, weight: .semibold)).foregroundStyle(ink).lineLimit(1)
                    Text(meta(url)).font(.system(size: 10.5)).foregroundStyle(ink.opacity(0.55)).lineLimit(1)
                }
                Spacer(minLength: 12)
                pill(Self.openLabel(url)) {
                    NSWorkspace.shared.open(url)
                    model.onClose()
                }
                pill("Show in Finder") {
                    NSWorkspace.shared.activateFileViewerSelecting([url])
                    model.onClose()
                }
            }
            Button { model.onClose() } label: {
                Image(systemName: "xmark").font(.system(size: 11, weight: .bold)).foregroundStyle(ink.opacity(0.7))
                    .frame(width: 24, height: 24).background(ink.opacity(0.1), in: Circle())
            }
            .buttonStyle(.plain)
            .help("Close (Esc)")
        }
    }

    @ViewBuilder private var content: some View {
        if let problem = model.problem {
            Text(problem).font(.system(size: 12.5)).foregroundStyle(ink.opacity(0.7)).padding(30)
        } else {
            switch model.kind {
            case .sheet:
                if model.loading {
                    VStack(spacing: 10) {
                        ProgressView().controlSize(.small)
                        Text("Reading the workbook…").font(.system(size: 12)).foregroundStyle(ink.opacity(0.6))
                    }
                } else if let sheet = model.sheet {
                    VStack(spacing: 0) {
                        formulaBar
                        SheetGrid(sheet: sheet, key: model.sheetKey, selected: $model.selected)
                        if sheet.truncated {
                            Text("Showing the first \(sheet.cells.count) cells; open it in its app for the rest.")
                                .font(.system(size: 11)).foregroundStyle(.black.opacity(0.6))
                                .frame(maxWidth: .infinity).padding(4).background(Color.yellow.opacity(0.35))
                        }
                    }
                }
            case .pdf:
                if let url = model.url { PDFDocView(url: url) }
            case .image:
                if let image = model.image {
                    Image(nsImage: image).resizable().interpolation(.high).scaledToFit()
                        .padding(14).frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            case .text:
                ScrollView {
                    Text(model.text.isEmpty ? "(empty file)" : model.text)
                        .font(.system(size: 12, design: .monospaced)).foregroundStyle(ink.opacity(0.88))
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(14)
                }
                .background(Color(white: 0.08))
            case .markdown:
                EmptyView()
            }
        }
    }

    private var formulaBar: some View {
        HStack(spacing: 8) {
            Text(model.formulaBar?.ref ?? " ")
                .font(.system(size: 11.5, design: .monospaced)).foregroundStyle(.black.opacity(0.7))
                .frame(width: 64, alignment: .leading)
            Divider().frame(height: 14)
            Text(model.formulaBar?.text ?? "")
                .font(.system(size: 12)).foregroundStyle(.black.opacity(0.85))
                .lineLimit(1).truncationMode(.tail).textSelection(.enabled)
            Spacer()
        }
        .padding(.horizontal, 10).frame(height: 26)
        .background(Color(white: 0.97))
        .overlay(alignment: .bottom) { Rectangle().fill(Color(white: 0.85)).frame(height: 1) }
    }

    private var tabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 2) {
                ForEach(Array(model.sheets.enumerated()), id: \.offset) { index, sheet in
                    let on = index == model.sheetIndex
                    Button {
                        model.sheetIndex = index
                        model.selected = nil
                    } label: {
                        Text(sheet.name).font(.system(size: 11.5, weight: on ? .semibold : .regular))
                            .foregroundStyle(on ? Color.black : ink.opacity(0.75))
                            .padding(.horizontal, 12).padding(.vertical, 5)
                            .background(on ? Color.white : ink.opacity(0.08), in: UnevenRoundedRectangle(bottomLeadingRadius: 6, bottomTrailingRadius: 6))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
        }
        .padding(.bottom, 10)
    }

    private func pill(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.system(size: 11.5, weight: .medium)).foregroundStyle(ink.opacity(0.9))
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(ink.opacity(0.12), in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private func meta(_ url: URL) -> String {
        let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
        var parts: [String] = []
        if let size = values?.fileSize { parts.append(ByteCountFormatter.string(fromByteCount: Int64(size), countStyle: .file)) }
        if let date = values?.contentModificationDate {
            parts.append("edited " + date.formatted(date: Calendar.current.isDateInToday(date) ? .omitted : .abbreviated, time: .shortened))
        }
        if model.kind == .sheet, model.sheets.count > 1 { parts.append("\(model.sheets.count) sheets") }
        parts.append(url.deletingLastPathComponent().path.replacingOccurrences(of: NSHomeDirectory(), with: "~"))
        return parts.joined(separator: " · ")
    }

    /// "Open in Excel": the app that opens the file, by its short name.
    static func openLabel(_ url: URL) -> String {
        guard let app = NSWorkspace.shared.urlForApplication(toOpen: url) else { return "Open" }
        var name = FileManager.default.displayName(atPath: app.path)
        if name.hasSuffix(".app") { name.removeLast(4) }
        if name.hasPrefix("Microsoft ") { name.removeFirst("Microsoft ".count) }
        return "Open in \(name)"
    }
}

struct PDFDocView: NSViewRepresentable {
    let url: URL

    func makeNSView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.backgroundColor = NSColor(calibratedWhite: 0.1, alpha: 1)
        view.document = PDFDocument(url: url)
        return view
    }

    func updateNSView(_ view: PDFView, context: Context) {
        if view.document?.documentURL != url { view.document = PDFDocument(url: url) }
    }
}

// MARK: The grid

struct SheetGrid: NSViewRepresentable {
    let sheet: XLSXSheet
    let key: String
    @Binding var selected: CellPos?

    func makeNSView(context: Context) -> SheetGridHost {
        let host = SheetGridHost(frame: .zero)
        update(host)
        return host
    }

    func updateNSView(_ host: SheetGridHost, context: Context) { update(host) }

    private func update(_ host: SheetGridHost) {
        host.onSelect = { selected = $0 }
        if host.key != key { host.show(sheet, key: key) }
        if host.canvas.selected != selected { host.canvas.selected = selected; host.canvas.needsDisplay = true }
    }
}

/// The grid: a drawing canvas under a transparent scroll view. The scroll view only measures out the sheet and
/// takes the scrolling; the canvas draws what shows at the scroll offset, so frozen rows and columns, and the
/// headers, stay put while the body moves under them.
final class SheetGridHost: NSView {
    let canvas = SheetCanvas()
    let scroll = NSScrollView()
    private let doc = SheetScrollDocument()
    private(set) var key = ""
    var onSelect: (CellPos?) -> Void = { _ in }

    override init(frame: NSRect) {
        super.init(frame: frame)
        canvas.autoresizingMask = [.width, .height]
        addSubview(canvas)
        scroll.autoresizingMask = [.width, .height]
        scroll.drawsBackground = false
        scroll.hasVerticalScroller = true
        scroll.hasHorizontalScroller = true
        scroll.autohidesScrollers = true
        scroll.scrollerStyle = .overlay
        scroll.documentView = doc
        doc.host = self
        addSubview(scroll)
        scroll.contentView.postsBoundsChangedNotifications = true
        NotificationCenter.default.addObserver(self, selector: #selector(scrolled), name: NSView.boundsDidChangeNotification, object: scroll.contentView)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    func show(_ sheet: XLSXSheet, key: String) {
        self.key = key
        canvas.sheet = sheet
        canvas.selected = nil
        scroll.contentView.scroll(to: .zero)
        scroll.reflectScrolledClipView(scroll.contentView)
        needsLayout = true
        window?.makeFirstResponder(doc)
    }

    override func layout() {
        super.layout()
        canvas.frame = bounds
        scroll.frame = bounds
        let size = canvas.contentSize
        doc.frame = CGRect(origin: .zero, size: CGSize(width: max(size.width, bounds.width), height: max(size.height, bounds.height)))
        scrolled()
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        window?.makeFirstResponder(doc)
    }

    @objc private func scrolled() {
        canvas.offset = scroll.contentView.bounds.origin
        canvas.needsDisplay = true
    }

    fileprivate func click(_ event: NSEvent) {
        let point = canvas.convert(event.locationInWindow, from: nil)
        let pos = canvas.cell(at: point)
        canvas.selected = pos
        canvas.needsDisplay = true
        onSelect(pos)
        window?.makeFirstResponder(doc)
    }

    fileprivate func move(rows: Int, columns: Int) {
        guard let sheet = canvas.sheet else { return }
        var pos = canvas.selected ?? CellPos(row: sheet.frozenRows, column: sheet.frozenColumns)
        if canvas.selected != nil {
            pos.row = min(max(0, pos.row + rows), canvas.rows - 1)
            pos.column = min(max(0, pos.column + columns), canvas.columns - 1)
        }
        canvas.selected = pos
        reveal(pos)
        canvas.needsDisplay = true
        onSelect(pos)
    }

    /// Scrolls the body so a cell shows (frozen cells always do).
    private func reveal(_ pos: CellPos) {
        var origin = scroll.contentView.bounds.origin
        let view = canvas.bodyViewport
        if pos.row >= canvas.frozenRows {
            let top = canvas.rowY[pos.row], bottom = canvas.rowY[pos.row + 1]
            if top < origin.y + canvas.frozenHeight { origin.y = top - canvas.frozenHeight }
            if bottom > origin.y + view.height { origin.y = bottom - view.height }
        }
        if pos.column >= canvas.frozenColumns {
            let left = canvas.colX[pos.column], right = canvas.colX[pos.column + 1]
            if left < origin.x + canvas.frozenWidth { origin.x = left - canvas.frozenWidth }
            if right > origin.x + view.width { origin.x = right - view.width }
        }
        origin.x = max(0, min(origin.x, doc.frame.width - scroll.contentView.bounds.width))
        origin.y = max(0, min(origin.y, doc.frame.height - scroll.contentView.bounds.height))
        scroll.contentView.scroll(to: origin)
        scroll.reflectScrolledClipView(scroll.contentView)
    }

    fileprivate func copySelection() {
        guard let pos = canvas.selected, let cell = canvas.sheet?.cell(row: pos.row, column: pos.column) else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(cell.shown.trimmingCharacters(in: .whitespaces), forType: .string)
    }
}

/// The scroll view's (transparent) document: the sheet's full size, and the clicks and keys over it.
private final class SheetScrollDocument: NSView {
    weak var host: SheetGridHost?
    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    override func mouseDown(with event: NSEvent) { host?.click(event) }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 123: host?.move(rows: 0, columns: -1)
        case 124, 48: host?.move(rows: 0, columns: 1)   // right, tab
        case 125, 36: host?.move(rows: 1, columns: 0)   // down, return
        case 126: host?.move(rows: -1, columns: 0)
        default: super.keyDown(with: event)
        }
    }

    @objc func copy(_ sender: Any?) { host?.copySelection() }
}

final class SheetCanvas: NSView {
    override var isFlipped: Bool { true }

    var sheet: XLSXSheet? { didSet { rebuild() } }
    var offset: CGPoint = .zero
    var selected: CellPos?

    /// Left edges of columns and top edges of rows from the sheet's origin, one more than the count (the far edge).
    private(set) var colX: [CGFloat] = [0]
    private(set) var rowY: [CGFloat] = [0]
    private(set) var rows = 0
    private(set) var columns = 0
    private(set) var rowHeaderWidth: CGFloat = 36
    let columnHeaderHeight: CGFloat = 20
    private var merges: [XLSXRange] = []
    private var covered: Set<Int> = []        // cells inside a merge, other than its first
    private var fonts: [String: NSFont] = [:]
    private var colors: [String: NSColor] = [:]

    /// Excel's units: about 7 px per width unit at 100% zoom; row heights are points (96/72 px each).
    static func pixels(width: Double) -> CGFloat { CGFloat((width * 7).rounded()) }
    static func pixels(height: Double) -> CGFloat { CGFloat((height * 4 / 3).rounded()) }

    var frozenRows: Int { min(sheet?.frozenRows ?? 0, rows) }
    var frozenColumns: Int { min(sheet?.frozenColumns ?? 0, columns) }
    var frozenWidth: CGFloat { colX[frozenColumns] }
    var frozenHeight: CGFloat { rowY[frozenRows] }
    var contentSize: CGSize { CGSize(width: rowHeaderWidth + (colX.last ?? 0), height: columnHeaderHeight + (rowY.last ?? 0)) }
    /// The cells' part of the view (inside the headers).
    var bodyViewport: CGSize { CGSize(width: bounds.width - rowHeaderWidth, height: bounds.height - columnHeaderHeight) }

    private func rebuild() {
        guard let sheet else { colX = [0]; rowY = [0]; rows = 0; columns = 0; return }
        // the used range plus a margin, and at least a screenful of empty grid
        columns = max(sheet.columnCount + 2, 26)
        rows = max(sheet.rowCount + 3, 60)
        colX = [0]
        colX.reserveCapacity(columns + 1)
        for c in 0..<columns {
            colX.append(colX[c] + (sheet.hiddenColumns.contains(c) ? 0 : Self.pixels(width: sheet.width(column: c))))
        }
        rowY = [0]
        rowY.reserveCapacity(rows + 1)
        for r in 0..<rows {
            rowY.append(rowY[r] + (sheet.hiddenRows.contains(r) ? 0 : Self.pixels(height: sheet.height(row: r))))
        }
        rowHeaderWidth = max(34, CGFloat(String(rows).count) * 8 + 14)
        merges = sheet.merges
        covered = []
        for m in merges where (m.lastRow - m.firstRow + 1) * (m.lastColumn - m.firstColumn + 1) <= 20_000 {
            for r in m.firstRow...m.lastRow { for c in m.firstColumn...m.lastColumn where r != m.firstRow || c != m.firstColumn { covered.insert(r &* 16_384 &+ c) } }
        }
        needsDisplay = true
    }

    // MARK: Geometry

    func x(_ c: Int) -> CGFloat { rowHeaderWidth + colX[c] - (c < frozenColumns ? 0 : offset.x) }
    func y(_ r: Int) -> CGFloat { columnHeaderHeight + rowY[r] - (r < frozenRows ? 0 : offset.y) }
    func width(_ c: Int) -> CGFloat { colX[c + 1] - colX[c] }
    func height(_ r: Int) -> CGFloat { rowY[r + 1] - rowY[r] }
    func rect(_ r: Int, _ c: Int) -> CGRect { CGRect(x: x(c), y: y(r), width: width(c), height: height(r)) }

    /// The first index whose edge is past `value` (edges ascend).
    private static func after(_ edges: [CGFloat], _ value: CGFloat) -> Int {
        var lo = 0, hi = edges.count
        while lo < hi { let mid = (lo + hi) / 2; if edges[mid] <= value { lo = mid + 1 } else { hi = mid } }
        return lo
    }

    /// The scrolled body's rows and columns in view.
    private var bodyRows: Range<Int> {
        let top = offset.y + frozenHeight, bottom = offset.y + bodyViewport.height
        let first = max(frozenRows, Self.after(rowY, top) - 1)
        let end = min(rows, Self.after(rowY, bottom))
        return first < end ? first..<end : first..<first
    }

    private var bodyColumns: Range<Int> {
        let left = offset.x + frozenWidth, right = offset.x + bodyViewport.width
        let first = max(frozenColumns, Self.after(colX, left) - 1)
        let end = min(columns, Self.after(colX, right))
        return first < end ? first..<end : first..<first
    }

    func cell(at point: CGPoint) -> CellPos? {
        guard sheet != nil, point.x >= rowHeaderWidth, point.y >= columnHeaderHeight else { return nil }
        let nx = point.x - rowHeaderWidth, ny = point.y - columnHeaderHeight
        let c = Self.after(colX, nx < frozenWidth ? nx : nx + offset.x) - 1
        let r = Self.after(rowY, ny < frozenHeight ? ny : ny + offset.y) - 1
        guard (0..<rows).contains(r), (0..<columns).contains(c) else { return nil }
        if let m = merges.first(where: { $0.contains(row: r, column: c) }) { return CellPos(row: m.firstRow, column: m.firstColumn) }
        return CellPos(row: r, column: c)
    }

    // MARK: Drawing

    static let grid = NSColor(calibratedWhite: 0.88, alpha: 1)
    static let headerFill = NSColor(calibratedWhite: 0.955, alpha: 1)
    static let headerInk = NSColor(calibratedWhite: 0.38, alpha: 1)
    static let freezeLine = NSColor(calibratedWhite: 0.62, alpha: 1)
    static let selection = NSColor(calibratedRed: 0.13, green: 0.45, blue: 0.27, alpha: 1)   // Excel's green

    override func draw(_ dirtyRect: NSRect) {
        // the sheet is paper, as in Excel, whatever the system appearance
        NSColor.white.setFill()
        bounds.fill()
        guard sheet != nil, rows > 0 else { return }
        let left = rowHeaderWidth, top = columnHeaderHeight
        let fw = frozenWidth, fh = frozenHeight
        let rightRoom = max(0, bounds.width - left - fw), downRoom = max(0, bounds.height - top - fh)
        let bodyR = bodyRows, bodyC = bodyColumns
        let frozenR = 0..<frozenRows, frozenC = 0..<frozenColumns
        region(rows: bodyR, columns: bodyC, clip: CGRect(x: left + fw, y: top + fh, width: rightRoom, height: downRoom))
        if !frozenR.isEmpty { region(rows: frozenR, columns: bodyC, clip: CGRect(x: left + fw, y: top, width: rightRoom, height: fh)) }
        if !frozenC.isEmpty { region(rows: bodyR, columns: frozenC, clip: CGRect(x: left, y: top + fh, width: fw, height: downRoom)) }
        if !frozenR.isEmpty && !frozenC.isEmpty { region(rows: frozenR, columns: frozenC, clip: CGRect(x: left, y: top, width: fw, height: fh)) }
        headers(columns: Array(frozenC) + Array(bodyC), rows: Array(frozenR) + Array(bodyR))
        Self.freezeLine.setFill()
        if fh > 0 { CGRect(x: left, y: top + fh - 1, width: bounds.width - left, height: 1).fill() }
        if fw > 0 { CGRect(x: left + fw - 1, y: top, width: 1, height: bounds.height - top).fill() }
        if let pos = selected, pos.row < rows, pos.column < columns {
            var box = rect(pos.row, pos.column)
            if let m = merges.first(where: { $0.firstRow == pos.row && $0.firstColumn == pos.column }) { box = mergeRect(m) }
            NSGraphicsContext.saveGraphicsState()
            CGRect(x: left, y: top, width: bounds.width - left, height: bounds.height - top).clip()
            Self.selection.setStroke()
            let path = NSBezierPath(rect: box.insetBy(dx: 0.5, dy: 0.5))
            path.lineWidth = 2
            path.stroke()
            NSGraphicsContext.restoreGraphicsState()
        }
    }

    private func mergeRect(_ m: XLSXRange) -> CGRect {
        let last = min(m.lastColumn, columns - 1), bottom = min(m.lastRow, rows - 1)
        return CGRect(x: x(m.firstColumn), y: y(m.firstRow), width: x(last) + width(last) - x(m.firstColumn), height: y(bottom) + height(bottom) - y(m.firstRow))
    }

    private func region(rows rs: Range<Int>, columns cs: Range<Int>, clip: CGRect) {
        guard let sheet, !rs.isEmpty, !cs.isEmpty, clip.width > 0, clip.height > 0 else { return }
        NSGraphicsContext.saveGraphicsState()
        clip.clip()
        // fills
        for r in rs where height(r) > 0 {
            for c in cs where width(c) > 0 {
                if let fill = sheet.cell(row: r, column: c)?.style.fill { color(fill).setFill(); rect(r, c).fill() }
            }
        }
        // grid lines along each column's right edge and each row's bottom edge
        Self.grid.setFill()
        let x0 = x(cs.lowerBound), x1 = x(cs.upperBound - 1) + width(cs.upperBound - 1)
        let y0 = y(rs.lowerBound), y1 = y(rs.upperBound - 1) + height(rs.upperBound - 1)
        for c in cs where width(c) > 0 { CGRect(x: x(c) + width(c) - 1, y: y0, width: 1, height: y1 - y0).fill() }
        for r in rs where height(r) > 0 { CGRect(x: x0, y: y(r) + height(r) - 1, width: x1 - x0, height: 1).fill() }
        // merges reaching into this pane: one box, no inner lines (one crossing the freeze line is drawn in each pane it
        // reaches, clipped, so its frozen part stays and the rest scrolls)
        let rowsFrozen = rs.lowerBound < frozenRows, colsFrozen = cs.lowerBound < frozenColumns
        func reaches(_ first: Int, _ last: Int, frozen: Bool, line: Int) -> Bool { frozen ? first < line : last >= line }
        for m in merges where reaches(m.firstRow, m.lastRow, frozen: rowsFrozen, line: frozenRows)
            && reaches(m.firstColumn, m.lastColumn, frozen: colsFrozen, line: frozenColumns)
            && m.firstRow < rows && m.firstColumn < columns {
            let box = mergeRect(m)
            guard box.intersects(clip) else { continue }
            let cell = sheet.cell(row: m.firstRow, column: m.firstColumn)
            (cell?.style.fill.map(color) ?? .white).setFill()
            box.fill()
            Self.grid.setFill()
            CGRect(x: box.maxX - 1, y: box.minY, width: 1, height: box.height).fill()
            CGRect(x: box.minX, y: box.maxY - 1, width: box.width, height: 1).fill()
            if let cell { text(cell, in: box, clip: box) }
        }
        // text
        for r in rs where height(r) > 0 {
            for c in cs where width(c) > 0 {
                guard let cell = sheet.cell(row: r, column: c), !cell.shown.isEmpty, !covered.contains(r &* 16_384 &+ c),
                      !merges.contains(where: { $0.firstRow == r && $0.firstColumn == c }) else { continue }
                var box = rect(r, c)
                var clip = box
                func empty(_ col: Int) -> Bool {
                    (sheet.cell(row: r, column: col)?.shown.isEmpty ?? true) && !covered.contains(r &* 16_384 &+ col)
                }
                if cell.style.align == "centerContinuous" {
                    // a heading centered across the run of blank centerContinuous cells after it
                    var next = c + 1
                    while next < columns, let n = sheet.cell(row: r, column: next), n.shown.isEmpty, n.style.align == "centerContinuous" {
                        box.size.width += width(next)
                        next += 1
                    }
                    clip = box
                } else if case .text = cell.value {
                    // text runs on over empty neighbors, as in Excel: rightward when left-aligned, leftward when
                    // right-aligned, both ways when centered
                    let align = cell.style.align ?? "left"
                    if align == "left" || align == "center" {
                        var next = c + 1
                        while next < cs.upperBound, next - c <= 12, empty(next) { clip.size.width += width(next); next += 1 }
                    }
                    if align == "right" || align == "center" {
                        var next = c - 1
                        while next >= cs.lowerBound, c - next <= 12, empty(next) { clip.origin.x -= width(next); clip.size.width += width(next); next -= 1 }
                    }
                }
                text(cell, in: box, clip: clip)
            }
        }
        NSGraphicsContext.restoreGraphicsState()
    }

    private func text(_ cell: XLSXCell, in box: CGRect, clip: CGRect) {
        let style = cell.style
        let font = self.font(size: style.size ?? 11, bold: style.bold, italic: style.italic)
        let ink = cell.formatColor.map(Self.named) ?? style.fontColor.map(color) ?? .black
        var attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: ink]
        if style.underline { attrs[.underlineStyle] = NSUnderlineStyle.single.rawValue }
        let alignment: String = style.align ?? {
            switch cell.value {
            case .number: return "right"
            case .bool, .error: return "center"
            default: return "left"
            }
        }()
        let pad: CGFloat = 3, indent = CGFloat(style.indent) * 10
        var string = cell.shown
        var size = (string as NSString).size(withAttributes: attrs)
        if cell.isNumber, size.width > box.width - 2 * pad {
            // a number that doesn't fit shows as ### (Excel never cuts a number)
            let hash = ("#" as NSString).size(withAttributes: attrs).width
            string = String(repeating: "#", count: max(1, Int((box.width - 2 * pad) / max(hash, 1))))
            size = (string as NSString).size(withAttributes: attrs)
        }
        let y = box.minY + max(0, (box.height - size.height) / 2)
        let x: CGFloat
        switch alignment {
        case "right": x = box.maxX - pad - indent - size.width
        case "center", "centerContinuous", "distributed": x = box.midX - size.width / 2
        default: x = box.minX + pad + indent
        }
        NSGraphicsContext.saveGraphicsState()
        clip.insetBy(dx: 1, dy: 0).clip()
        (string as NSString).draw(at: CGPoint(x: x, y: y), withAttributes: attrs)
        NSGraphicsContext.restoreGraphicsState()
    }

    private func headers(columns cs: [Int], rows rs: [Int]) {
        let left = rowHeaderWidth, top = columnHeaderHeight
        let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 10.5), .foregroundColor: Self.headerInk]
        let bold: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 10.5, weight: .semibold), .foregroundColor: NSColor.black]
        Self.headerFill.setFill()
        CGRect(x: 0, y: 0, width: bounds.width, height: top).fill()
        CGRect(x: 0, y: 0, width: left, height: bounds.height).fill()
        // column letters, clipped per pane like the cells under them
        let fw = frozenWidth, fh = frozenHeight
        for (frozen, clip) in [(true, CGRect(x: left, y: 0, width: fw, height: top)),
                               (false, CGRect(x: left + fw, y: 0, width: max(0, bounds.width - left - fw), height: top))] where clip.width > 0 {
            NSGraphicsContext.saveGraphicsState()
            clip.clip()
            for c in cs where width(c) > 0 && (c < frozenColumns) == frozen {
                let box = CGRect(x: x(c), y: 0, width: width(c), height: top)
                let label = XLSXRef.column(c) as NSString
                let a = selected?.column == c ? bold : attrs
                let s = label.size(withAttributes: a)
                label.draw(at: CGPoint(x: box.midX - s.width / 2, y: (top - s.height) / 2), withAttributes: a)
                Self.grid.setFill()
                CGRect(x: box.maxX - 1, y: 3, width: 1, height: top - 6).fill()
            }
            NSGraphicsContext.restoreGraphicsState()
        }
        // row numbers
        for (frozen, clip) in [(true, CGRect(x: 0, y: top, width: left, height: fh)),
                               (false, CGRect(x: 0, y: top + fh, width: left, height: max(0, bounds.height - top - fh)))] where clip.height > 0 {
            NSGraphicsContext.saveGraphicsState()
            clip.clip()
            for r in rs where height(r) > 0 && (r < frozenRows) == frozen {
                let box = CGRect(x: 0, y: y(r), width: left, height: height(r))
                let label = String(r + 1) as NSString
                let a = selected?.row == r ? bold : attrs
                let s = label.size(withAttributes: a)
                label.draw(at: CGPoint(x: left - 6 - s.width, y: box.midY - s.height / 2), withAttributes: a)
                Self.grid.setFill()
                CGRect(x: 3, y: box.maxY - 1, width: left - 6, height: 1).fill()
            }
            NSGraphicsContext.restoreGraphicsState()
        }
        Self.grid.setFill()
        CGRect(x: 0, y: top - 1, width: bounds.width, height: 1).fill()
        CGRect(x: left - 1, y: 0, width: 1, height: bounds.height).fill()
    }

    private func font(size: Double, bold: Bool, italic: Bool) -> NSFont {
        let key = "\(size)|\(bold)|\(italic)"
        if let hit = fonts[key] { return hit }
        // the system face a little larger than the sheet's points, which reads like Calibri at Excel's 100%
        var font = NSFont.systemFont(ofSize: CGFloat(size) * 1.08, weight: bold ? .semibold : .regular)
        if italic { font = NSFontManager.shared.convert(font, toHaveTrait: .italicFontMask) }
        fonts[key] = font
        return font
    }

    private func color(_ hex: String) -> NSColor {
        if let hit = colors[hex] { return hit }
        let v = Int(hex, radix: 16) ?? 0
        let made = NSColor(srgbRed: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: 1)
        colors[hex] = made
        return made
    }

    private static func named(_ name: String) -> NSColor {
        switch name.lowercased() {
        case "red": return NSColor(srgbRed: 1, green: 0, blue: 0, alpha: 1)
        case "blue": return NSColor(srgbRed: 0, green: 0, blue: 1, alpha: 1)
        case "green": return NSColor(srgbRed: 0, green: 0.5, blue: 0, alpha: 1)
        case "magenta": return NSColor(srgbRed: 1, green: 0, blue: 1, alpha: 1)
        case "cyan": return NSColor(srgbRed: 0, green: 0.6, blue: 0.7, alpha: 1)
        case "yellow": return NSColor(srgbRed: 0.75, green: 0.65, blue: 0, alpha: 1)
        case "white": return .white
        default: return .black
        }
    }
}
