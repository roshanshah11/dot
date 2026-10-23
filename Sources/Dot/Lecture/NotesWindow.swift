import AppKit
import DotKit
import PDFKit
import UniformTypeIdentifiers
import WebKit

/// What the notes page says (protocol.md section 4).
enum NotesMessage: Equatable {
    case ready
    case edit(id: String, text: String)
    case add(id: String, after: String?, depth: Int, text: String)
    case indent(id: String, depth: Int)
    case remove(id: String)
    case focus(id: String?)
    case explain(id: String, text: String)
    case recall(String)
    case skipRecall
    case end
    /// He tapped a line's time chip: answer with `showSource` (what was said then).
    case source(id: String)
    /// He tapped a ready explainer marker.
    case showExplain(id: String)
    /// The deadlines he kept checked (empty: Skip).
    case addDeadlines([String])
    /// He closed the saved class: the whole window goes.
    case close

    init?(_ body: Any) {
        guard let d = body as? [String: Any], let type = d["type"] as? String else { return nil }
        let id = d["id"] as? String
        let text = d["text"] as? String ?? ""
        let depth = (d["depth"] as? NSNumber)?.intValue ?? 0
        switch type {
        case "ready": self = .ready
        case "edit": guard let id else { return nil }; self = .edit(id: id, text: text)
        case "add": guard let id else { return nil }; self = .add(id: id, after: d["after"] as? String, depth: depth, text: text)
        case "indent": guard let id else { return nil }; self = .indent(id: id, depth: depth)
        case "remove": guard let id else { return nil }; self = .remove(id: id)
        case "focus": self = .focus(id: id)
        case "explain": guard let id else { return nil }; self = .explain(id: id, text: text)
        case "recall": self = .recall(text)
        case "skipRecall": self = .skipRecall
        case "end": self = .end
        case "source": guard let id else { return nil }; self = .source(id: id)
        case "showExplain": guard let id else { return nil }; self = .showExplain(id: id)
        case "addDeadlines": self = .addDeadlines(d["ids"] as? [String] ?? [])
        case "close": self = .close
        default: return nil
        }
    }
}

/// The lecture window (plan 2026-10-22: "Dot writes, I add"; round three the same day: "just one window... the
/// notes/board everything combined... side by side... one full screen thing. and then if im not looking i can just swipe
/// and do smth else but then can always come back"). The class's notes on the left, an outline that Dot appends to while
/// he types in the same lines (Resources/board/notes); the board on the right, where Dot's explainer panel lives while
/// this window is open (`onBoard`). It fills its own Space, makes the course file's PDF after class, and closes as one.
@MainActor
final class NotesWindow: NSObject, NSWindowDelegate, NSSplitViewDelegate, WKNavigationDelegate, WKUIDelegate {
    /// One line of the notes as the page draws it. `author` is "dot", "him" or "added"; `kind` is "bullet", "image" (a
    /// board photo) or "slide" (`text` is the slide's title); `src` is an image path relative to the course folder; `at`
    /// is the clock time the line came from ("11:42:10"), which gives it a time chip.
    struct Block: Encodable {
        var id, text: String
        var depth: Int
        var author: String
        var kind: String
        var src: String?
        var at: String? = nil
    }

    /// A deadline heard in class, offered for Atlas after it. `line` is the notes line it came from.
    struct DeadlineItem: Encodable {
        var id, title, due: String
        var line: String?
    }

    enum Op { case append(Block), insertAfter(String, Block), replace(Block), remove(String) }

    var onMessage: ((NotesMessage) -> Void)?
    /// Off every display (the self-test and the lecture replay drive a whole class through it); nothing is remembered.
    var offscreen = false

    /// Whether any part of the window is on a display (tests refuse to run when it is).
    var isOnAnyDisplay: Bool {
        guard let window, window.isVisible else { return false }
        return NSScreen.screens.contains { $0.frame.intersects(window.frame) }
    }

    var frameForTests: CGRect { window?.frame ?? .zero }
    var paneWidthsForTests: (notes: CGFloat, board: CGFloat) { (web?.frame.width ?? 0, boardHost?.frame.width ?? 0) }

    private var window: RoomWindow?
    private var web: WKWebView?
    private var split: NSSplitView?
    /// The right side, where the explainer panel's page goes while this window is open.
    private(set) var boardHost: NSView?
    /// The board is here (a view) or gone (nil): Talk moves the explainer panel in and out.
    var onBoard: ((NSView?) -> Void)?
    /// Shown, it fills its own Space (off in tests, which keep it off every display).
    var fullScreen = true
    private var closingFromFullScreen = false
    private var relay: PanelRelay?
    private var files: NotesFiles?
    private var ready = false
    private var queued: [String] = []
    /// The last load and every call since, so a crashed page process comes back as it was.
    private var replay: [String] = []
    private var placing = false
    /// Bumped by every show, so a close's fade that ends after a new show does not hide it.
    private var generation = 0
    private let resources: URL?
    private var accentHex: String

    static let frameKey = "notesWindowFrame"
    static let splitKey = "lectureWindowSplit"
    /// The notes' share of the width.
    static let defaultSplit: CGFloat = 0.56
    static let defaultWidth: CGFloat = 400
    static let margin: CGFloat = 10

    init(accentHex: String? = nil) {
        self.accentHex = accentHex ?? DotConfig.peek().pointerColorHex
        resources = Self.findResources()
        super.init()
        if resources == nil { Log.warn("notes: Resources/board/notes not found; the notes window can't open") }
    }

    /// DOT_BOARD_DIR, the app bundle, the checkout a dev build runs from (.build/debug/Dot), then the main checkout.
    static func findResources() -> URL? {
        var candidates = [ProcessInfo.processInfo.environment["DOT_BOARD_DIR"].map { URL(fileURLWithPath: DotConfig.expand($0)) },
                          Bundle.main.resourceURL?.appendingPathComponent("board")].compactMap { $0 }
        var dir = Bundle.main.executableURL?.resolvingSymlinksInPath().deletingLastPathComponent()
        for _ in 0..<5 {
            guard let d = dir else { break }
            candidates.append(d.appendingPathComponent("Resources/board"))
            dir = d.deletingLastPathComponent()
        }
        candidates.append(URL(fileURLWithPath: DotConfig.expand("~/Projects/dot/Resources/board")))
        return candidates.first { FileManager.default.fileExists(atPath: $0.appendingPathComponent("notes/notes.html").path) }
    }

    var available: Bool { resources != nil }
    var isOpen: Bool { window?.isVisible ?? false }

    // MARK: Driving it

    /// Open (or refill) the window with a class's notes. `baseURL` is the course folder, where image blocks' relative
    /// paths (notes-images/...) live. `mode` "review" is his saved notes opened again: no End class and no hearing line;
    /// editing works and sends the same messages.
    func show(course: String, heading: String, title: String, status: String, blocks: [Block], baseURL: URL? = nil, mode: String = "live") {
        guard let resources else { return }
        ensureWindow(resources: resources)
        if let baseURL { files?.allow(baseURL) }
        let load = Load(course: course, heading: heading, title: title, status: status, blocks: blocks,
                        base: baseURL.map(NotesFiles.folderURL), mode: mode)
        replay = []
        generation += 1
        call("notes.load(\(Self.json(load)))")
        window?.title = "\(course) notes"
        if window?.isMiniaturized == true { window?.deminiaturize(nil) }
        if window?.isVisible != true || window?.alphaValue ?? 1 < 1 || closingFromFullScreen {
            closingFromFullScreen = false
            place()
            present()
        }
        Log.info("notes: show \(course) \(heading) (\(blocks.count) lines)")
    }

    func apply(_ ops: [Op]) {
        guard !ops.isEmpty else { return }
        call("notes.apply(\(Self.json(ops.map(OpJSON.init))))")
    }

    func setTitle(_ text: String) { call("notes.setTitle(\(Self.json(text)))") }
    func setStatus(_ text: String) { call("notes.status(\(Self.json(text)))") }

    func setAccent(hex: String) {
        accentHex = hex
        call("notes.setAccent(\(Self.json(hex)))")
    }

    func showRecall(seconds: Int, prompt: String) {
        call("notes.showRecall(\(Self.json(Recall(seconds: seconds, prompt: prompt))))")
    }

    /// One line of feedback on his 3 big ideas; several calls stack up in the box.
    func recallFeedback(_ text: String) { call("notes.recallFeedback(\(Self.json(text)))") }

    /// The last words the ear heard (about one call a second); the page shows the last ten or so. Empty hides it.
    func hearing(_ text: String) { call("notes.hearing(\(Self.json(text)))") }

    /// The answer to `.source(id)`: the transcript around `time`, in a popover under that line.
    func showSource(id: String, time: String, text: String) {
        call("notes.showSource(\(Self.json(id)), \(Self.json(["time": time, "text": text])))")
    }

    /// The explainer marker on a line: "queued", "ready" (a click sends `.showExplain`), "shown", or nil to clear it.
    func markExplain(id: String, state: String?) {
        call("notes.markExplain(\(Self.json(id)), \(state.map { Self.json($0) } ?? "null"))")
    }

    /// Deadlines heard in class, each checked; "Add to Atlas" sends `.addDeadlines` with the checked ids, Skip with none.
    func offerDeadlines(_ items: [DeadlineItem]) { call("notes.offerDeadlines(\(Self.json(items)))") }

    /// The result of adding them ("added 2 to Atlas").
    func deadlinesAdded(_ text: String) { call("notes.deadlinesAdded(\(Self.json(text)))") }

    /// The class is saved: the notes file and the PDF (an empty path when there is none) as links he can open.
    func finished(pdf: String, file: String) {
        call("notes.finished(\(Self.json(["pdf": pdf, "file": file])))")
    }

    /// Back in front, in its Space, after he closed or minimized it mid-class ("open my notes").
    func bringBack() {
        guard let window else { return }
        generation += 1
        closingFromFullScreen = false
        if window.isMiniaturized { window.deminiaturize(nil) }
        if !window.isVisible { place() }
        present()
    }

    /// In front with the board beside the notes; a live window takes its own Space (full screen), so he swipes to his
    /// slides or anything else and back. Tests: in front of nothing, off every display.
    private func present() {
        guard let window else { return }
        window.alphaValue = 1
        if offscreen { window.orderFrontRegardless(); return }
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
        if fullScreen, !window.styleMask.contains(.fullScreen) { window.toggleFullScreen(nil) }
        watchSpaces()
        syncBoard()
    }

    /// He is looking at this window (it is up, on the Space in front).
    var isInView: Bool { window?.isVisible == true && window?.isOnActiveSpace == true && !closingFromFullScreen }

    /// The explainer panel is on the board while he is looking at this window; swiped away, it floats for his own
    /// questions as usual (the lecture's explainers wait for him to come back).
    private func syncBoard() {
        guard !offscreen else { return }
        onBoard?(isInView ? boardHost : nil)
    }

    private var spaceObserver: NSObjectProtocol?

    private func watchSpaces() {
        guard spaceObserver == nil else { return }
        spaceObserver = NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.activeSpaceDidChangeNotification, object: nil,
                                                                          queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.syncBoard() }
        }
    }

    /// His close button: hidden, not destroyed; a class goes on being written, and "open my notes" brings it back.
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        close()
        return false
    }

    func close() {
        call("notes.flush()")   // a line he was mid-way through still reaches Dot
        guard let window, window.isVisible else { return }
        if window.styleMask.contains(.fullScreen) {
            // out of its Space first; windowDidExitFullScreen hides it
            closingFromFullScreen = true
            window.toggleFullScreen(nil)
            return
        }
        hide()
    }

    private func hide() {
        guard let window else { return }
        let closing = generation
        NSAnimationContext.runAnimationGroup({ ctx in ctx.duration = 0.18; window.animator().alphaValue = 0 }) { [weak self, weak window] in
            Task { @MainActor in if self?.generation == closing { window?.orderOut(nil) } }
        }
        onBoard?(nil)
        Log.info("notes: closed")
    }

    func windowDidExitFullScreen(_ notification: Notification) {
        if closingFromFullScreen { closingFromFullScreen = false; hide() }
    }

    func windowDidEnterFullScreen(_ notification: Notification) {
        applySplit()
        Log.info("notes: full screen, notes \(Int(paneWidthsForTests.notes)) pt and board \(Int(paneWidthsForTests.board)) pt")
    }

    /// The notes in the order he sees them, with his unsent changes sent first. Dot's lines go above the line he is
    /// typing at the bottom, so this order can differ from the order the ops arrived in.
    func snapshot() async -> [Block] {
        guard ready, let web, let rows = try? await web.evaluateJavaScript("notes.snapshot()") as? [[String: Any]] else { return [] }
        return rows.compactMap { row in
            guard let id = row["id"] as? String else { return nil }
            return Block(id: id, text: row["text"] as? String ?? "", depth: (row["depth"] as? NSNumber)?.intValue ?? 0,
                         author: row["author"] as? String ?? "dot", kind: row["kind"] as? String ?? "bullet", src: row["src"] as? String,
                         at: row["at"] as? String)
        }
    }

    /// The page's own functions, for the self-test (it drives focus and typing through the page's handlers).
    func evaluate(_ js: String, completion: @escaping (Any?, Error?) -> Void) {
        guard ready, let web else { completion(nil, nil); return }
        web.evaluateJavaScript(js) { value, error in completion(value, error) }
    }

    /// The window as drawn in light or dark, for the self-test's pictures.
    func picture(dark: Bool) async -> NSImage? {
        guard let window, let web else { return nil }
        window.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
        defer { window.appearance = nil }
        try? await Task.sleep(nanoseconds: 400_000_000)
        return try? await web.takeSnapshot(configuration: nil)
    }

    // MARK: The PDF

    enum ExportError: Error { case noResources, renderFailed(String), printFailed }

    /// A whole course file (protocol.md section 1) as a paginated Letter PDF: one boxed card per class, the way his old
    /// doc put each class in a one-cell table. `baseURL` is the course folder, so notes-images/... resolve. The page is
    /// printed by WebKit, so the page's print rules (Letter, margins, no break inside a short card) decide the pages.
    func exportPDF(markdown: String, baseURL: URL, to url: URL) async throws {
        guard let resources else { throw ExportError.noResources }
        let printer = NotesPrinter(resources: resources, base: baseURL)
        try await printer.print(markdown: markdown, to: url)
    }

    // MARK: The window

    private func ensureWindow(resources: URL) {
        if window != nil { return }
        // An ordinary window: a title bar to drag by, close, minimize and full screen, and other windows can go over it
        // ("its blocking things. u didnt even let me move it around. or minimize it", 2026-10-22; it was a floating strip
        // with no buttons). In tests it is borderless: the window server pulls a titled window back onto a display.
        let style: NSWindow.StyleMask = offscreen ? [.borderless] : [.titled, .closable, .miniaturizable, .resizable]
        let w = RoomWindow(contentRect: CGRect(x: -20_000, y: -20_000, width: Self.defaultWidth * 2, height: 700),
                           styleMask: style, backing: .buffered, defer: false)
        w.title = "Notes"
        w.backgroundColor = Self.ground
        w.hasShadow = true
        w.level = .normal
        w.collectionBehavior = offscreen ? [] : [.fullScreenPrimary]
        w.hidesOnDeactivate = false
        w.isReleasedWhenClosed = false
        w.minSize = CGSize(width: 680, height: 420)
        w.sharingType = CardPanel.visibleInRecordings ? .readOnly : .none
        w.delegate = self

        let configuration = WKWebViewConfiguration()
        let files = NotesFiles(roots: [resources])
        configuration.setURLSchemeHandler(files, forURLScheme: NotesFiles.scheme)
        let relay = PanelRelay()
        relay.onMessage = { [weak self] body in self?.received(body) }
        configuration.userContentController.add(relay, name: "notes")
        // notes left, the board right; the divider drags, and its place is kept
        let split = NSSplitView(frame: w.contentView?.bounds ?? .zero)
        split.isVertical = true
        split.dividerStyle = .thin
        split.autoresizingMask = [.width, .height]
        split.delegate = self
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: Self.defaultWidth, height: 700), configuration: configuration)
        web.setValue(false, forKey: "drawsBackground")
        web.navigationDelegate = self
        web.uiDelegate = self
        let board = NSView(frame: CGRect(x: 0, y: 0, width: Self.defaultWidth, height: 700))
        board.wantsLayer = true
        board.layer?.backgroundColor = Self.boardGround.cgColor
        split.addArrangedSubview(web)
        split.addArrangedSubview(board)
        w.contentView?.addSubview(split)
        web.load(URLRequest(url: NotesFiles.url(for: resources.appendingPathComponent("notes/notes.html"))))
        window = w
        self.split = split
        boardHost = board
        self.web = web
        self.relay = relay
        self.files = files
    }

    /// The explainer panel's ground (it is always dark), under the board before the panel's page is in.
    private static let boardGround = NSColor(srgbRed: 0.063, green: 0.059, blue: 0.051, alpha: 1)

    /// The page's own ground, so nothing flashes before the first paint.
    private static let ground = NSColor(name: nil) { appearance in
        appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            ? NSColor(srgbRed: 0.051, green: 0.047, blue: 0.043, alpha: 1) : NSColor(srgbRed: 0.984, green: 0.98, blue: 0.969, alpha: 1)
    }

    /// Out of full screen: where he left it on the screen he is using, else that whole screen. Tests: off every display,
    /// the notes at their usual width with the board beside them.
    private func place() {
        guard let window else { return }
        placing = true
        defer { placing = false }
        if offscreen {
            window.keepOffscreen = true
            window.setFrame(CGRect(x: -20_000, y: -20_000, width: Self.defaultWidth * 2, height: 900), display: true)
            split?.setPosition(Self.defaultWidth, ofDividerAt: 0)
            return
        }
        let mouse = NSEvent.mouseLocation
        guard let screen = NSScreen.screens.first(where: { NSMouseInRect(mouse, $0.frame, false) }) ?? NSScreen.main else { return }
        let visible = screen.visibleFrame
        let saved = UserDefaults.standard.string(forKey: Self.frameKey).map(NSRectFromString) ?? .zero
        let frame = saved.width >= 680 && visible.contains(CGPoint(x: saved.midX, y: saved.midY)) ? saved.intersection(visible) : visible
        window.setFrame(frame, display: true)
        applySplit()
    }

    /// The divider where he left it (the notes' share of the width).
    private func applySplit() {
        guard let split, !offscreen else { return }
        let saved = UserDefaults.standard.double(forKey: Self.splitKey)
        let share = saved > 0.2 && saved < 0.8 ? CGFloat(saved) : Self.defaultSplit
        placing = true
        split.setPosition((split.bounds.width * share).rounded(), ofDividerAt: 0)
        placing = false
    }

    private func remember() {
        guard let window, !offscreen, !placing, !window.styleMask.contains(.fullScreen) else { return }
        UserDefaults.standard.set(NSStringFromRect(window.frame), forKey: Self.frameKey)
    }

    func splitView(_ splitView: NSSplitView, constrainMinCoordinate proposed: CGFloat, ofSubviewAt index: Int) -> CGFloat { max(proposed, 320) }
    func splitView(_ splitView: NSSplitView, constrainMaxCoordinate proposed: CGFloat, ofSubviewAt index: Int) -> CGFloat {
        min(proposed, splitView.bounds.width - 320)
    }

    /// He dragged the divider: keep its place for next time.
    func splitViewDidResizeSubviews(_ notification: Notification) {
        guard let split, !offscreen, !placing, NSApp.currentEvent?.type == .leftMouseDragged, split.bounds.width > 0,
              let notes = split.arrangedSubviews.first else { return }
        UserDefaults.standard.set(Double(notes.frame.width / split.bounds.width), forKey: Self.splitKey)
    }

    func windowDidMove(_ notification: Notification) { remember() }
    func windowDidEndLiveResize(_ notification: Notification) { remember() }

    // MARK: Navigation: the page never leaves notes.html

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.scheme == NotesFiles.scheme, url.lastPathComponent == "notes.html", action.navigationType == .other || action.navigationType == .reload {
            decisionHandler(.allow); return
        }
        decisionHandler(.cancel)
        // the saved file and PDF are links: the notes open in Dot's reader, anything else in its app
        guard action.navigationType == .linkActivated else { return }
        if url.isFileURL {
            if MarkdownViewer.isMarkdown(url) { MarkdownViewer.show(file: url) } else { NSWorkspace.shared.open(url) }
        } else if url.scheme == "https" || url.scheme == "http" {
            NSWorkspace.shared.open(url)
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        nil
    }

    /// The page's process died: load it again and replay the class into it. Lines he typed since the last load come
    /// back only through Dot's own copy (a second `.ready` reaches onMessage).
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        Log.warn("notes: web content process ended; reloading")
        ready = false
        queued = replay
        webView.reload()
    }

    // MARK: Page traffic

    private func call(_ js: String) {
        if js.hasPrefix("notes.load(") {
            replay = [js]
        } else if let setter = ["notes.status(", "notes.setTitle(", "notes.setAccent("].first(where: js.hasPrefix) {
            // the status ticks every few seconds: only the latest of each setter is worth replaying
            replay.removeAll { $0.hasPrefix(setter) }
            replay.append(js)
        } else if !["notes.flush(", "notes.hearing(", "notes.showSource("].contains(where: js.hasPrefix) {
            // the hearing line and a popover are of the moment; nothing to bring back after a reload
            replay.append(js)
        }
        guard ready, let web else { queued.append(js); return }
        web.evaluateJavaScript(js) { _, error in
            if let error { Log.warn("notes: js failed: \(Log.short(error.localizedDescription, 160))") }
        }
    }

    private func received(_ body: Any) {
        if let d = body as? [String: Any], d["type"] as? String == "log" {
            Log.warn("notes: page: \(Log.short(d["text"] as? String ?? "", 200))")
            return
        }
        guard let message = NotesMessage(body) else { Log.warn("notes: unknown message \(Log.short("\(body)", 200))"); return }
        if message == .close { close() }
        if message == .ready {
            ready = true
            let pending = queued
            queued = []
            web?.evaluateJavaScript("notes.setAccent(\(Self.json(accentHex)))") { _, _ in }
            for js in pending { web?.evaluateJavaScript(js) { _, _ in } }
        }
        onMessage?(message)
    }

    // MARK: JSON for the page

    private struct Load: Encodable { let course, heading, title, status: String; let blocks: [Block]; let base: String?; let mode: String }
    private struct Recall: Encodable { let seconds: Int; let prompt: String }
    private struct OpJSON: Encodable {
        let op: String
        var block: Block?
        var after: String?
        var id: String?
        init(_ op: Op) {
            switch op {
            case .append(let b): self.op = "append"; block = b
            case .insertAfter(let after, let b): self.op = "insertAfter"; self.after = after; block = b
            case .replace(let b): self.op = "replace"; block = b
            case .remove(let id): self.op = "remove"; self.id = id
            }
        }
    }

    /// Any Encodable as a JavaScript literal (a top-level string too).
    static func json<T: Encodable>(_ value: T) -> String {
        guard let data = try? JSONEncoder().encode(value), let text = String(data: data, encoding: .utf8) else { return "null" }
        return text
    }
}

/// The lecture window: an ordinary window that can fill a Space; ⌘C ⌘V ⌘X ⌘A ⌘Z reach the line he is in (EditKeys).
final class RoomWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }

    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        EditKeys.perform(event, in: self) || super.performKeyEquivalent(with: event)
    }

    /// Tests keep it off every display. A titled window is pulled back onto a screen when it is shown, which put the
    /// replay's notes on his screen for eight minutes (2026-10-22 12:56, "yo get ts off my screen").
    var keepOffscreen = false

    override func constrainFrameRect(_ frameRect: NSRect, to screen: NSScreen?) -> NSRect {
        keepOffscreen ? frameRect : super.constrainFrameRect(frameRect, to: screen)
    }
}

/// Serves the notes page, the board's files (KaTeX) and the course folder's images under one scheme. WebKit lets a
/// file: page read one folder only, and the page needs both the bundled board and the board photos beside the notes.
/// URL paths are absolute file paths; nothing outside the allowed folders is served.
@MainActor
final class NotesFiles: NSObject, WKURLSchemeHandler {
    static let scheme = "dotnotes"
    private var roots: [String]

    init(roots: [URL]) {
        self.roots = roots.map { ($0.path as NSString).standardizingPath }
    }

    func allow(_ folder: URL) {
        let path = (folder.path as NSString).standardizingPath
        if !roots.contains(path) { roots.append(path) }
    }

    static func url(for file: URL) -> URL {
        var components = URLComponents()
        components.scheme = scheme
        components.host = "local"
        components.path = file.path
        return components.url ?? URL(string: "\(scheme)://local/")!
    }

    /// A folder as the page's base for relative image paths (a trailing slash, so "a.jpg" lands inside it).
    static func folderURL(_ folder: URL) -> String {
        let s = url(for: folder).absoluteString
        return s.hasSuffix("/") ? s : s + "/"
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { task.didFailWithError(URLError(.badURL)); return }
        let path = (url.path as NSString).standardizingPath
        let allowed = roots.contains { path == $0 || path.hasPrefix($0.hasSuffix("/") ? $0 : $0 + "/") }
        let data = allowed ? try? Data(contentsOf: URL(fileURLWithPath: path)) : nil
        let status = data == nil ? (allowed ? 404 : 403) : 200
        let headers = ["Content-Type": Self.mimeType(url.pathExtension), "Content-Length": String(data?.count ?? 0)]
        if let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) { task.didReceive(response) }
        if let data { task.didReceive(data) }
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    private static func mimeType(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        case "svg": return "image/svg+xml"
        default: return UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}

/// One PDF: the notes page in an off-screen web view, the course file rendered as cards, printed by WebKit to a file.
@MainActor
private final class NotesPrinter: NSObject, WKNavigationDelegate {
    private let resources: URL
    private let base: URL
    private var loaded: CheckedContinuation<Void, Error>?
    private var printed: CheckedContinuation<Bool, Never>?

    init(resources: URL, base: URL) {
        self.resources = resources
        self.base = base
    }

    func print(markdown: String, to url: URL) async throws {
        let files = NotesFiles(roots: [resources, base])
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(files, forURLScheme: NotesFiles.scheme)
        // Letter at 96 px an inch, so the page measures its cards at the width they print at
        let frame = CGRect(x: 0, y: 0, width: 816, height: 1056)
        let web = WKWebView(frame: frame, configuration: configuration)
        web.navigationDelegate = self
        // WebKit prints from a view in a window; this one is off every display and never shown in a recording
        let window = NSWindow(contentRect: frame.offsetBy(dx: -20_000, dy: -20_000), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.sharingType = .none
        window.appearance = NSAppearance(named: .aqua)
        window.contentView = web
        window.orderFrontRegardless()
        defer { window.orderOut(nil) }

        try await withCheckedThrowingContinuation { (done: CheckedContinuation<Void, Error>) in
            loaded = done
            web.load(URLRequest(url: NotesFiles.url(for: resources.appendingPathComponent("notes/notes.html"))))
        }
        do {
            _ = try await web.callAsyncJavaScript("return await notes.renderDocument(markdown, {base: base})",
                                                  arguments: ["markdown": markdown, "base": NotesFiles.folderURL(base)], in: nil, contentWorld: .page)
        } catch {
            throw NotesWindow.ExportError.renderFailed(error.localizedDescription)
        }

        // printed beside the target and moved over it, so a failed print never costs the last good PDF
        let temp = url.deletingLastPathComponent().appendingPathComponent(".\(url.deletingPathExtension().lastPathComponent).printing.pdf")
        try? FileManager.default.removeItem(at: temp)
        let info = NSPrintInfo(dictionary: [.jobSavingURL: temp])
        info.jobDisposition = .save
        info.paperSize = NSSize(width: 612, height: 792)
        info.orientation = .portrait
        info.topMargin = 43.2; info.bottomMargin = 43.2; info.leftMargin = 43.2; info.rightMargin = 43.2
        info.horizontalPagination = .fit
        info.verticalPagination = .automatic
        info.isHorizontallyCentered = false
        info.isVerticallyCentered = false
        let operation = web.printOperation(with: info)
        operation.showsPrintPanel = false
        operation.showsProgressPanel = false
        operation.view?.frame = web.bounds   // without a frame WebKit prints blank pages
        let ok = await withCheckedContinuation { (done: CheckedContinuation<Bool, Never>) in
            printed = done
            operation.runModal(for: window, delegate: self, didRun: #selector(printOperationDidRun(_:success:contextInfo:)), contextInfo: nil)
        }
        guard ok, FileManager.default.fileExists(atPath: temp.path) else {
            try? FileManager.default.removeItem(at: temp)
            throw NotesWindow.ExportError.printFailed
        }
        if FileManager.default.fileExists(atPath: url.path) {
            _ = try FileManager.default.replaceItemAt(url, withItemAt: temp)
        } else {
            try FileManager.default.moveItem(at: temp, to: url)
        }
        Log.info("notes: pdf \(url.lastPathComponent) (\(PDFDocument(url: url)?.pageCount ?? 0) pages)")
    }

    @objc func printOperationDidRun(_ operation: NSPrintOperation, success: Bool, contextInfo: UnsafeMutableRawPointer?) {
        printed?.resume(returning: success)
        printed = nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded?.resume()
        loaded = nil
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        loaded?.resume(throwing: error)
        loaded = nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        loaded?.resume(throwing: error)
        loaded = nil
    }
}
