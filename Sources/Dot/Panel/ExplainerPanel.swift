import AppKit
import DotKit
import WebKit

/// The explainer panel (round eight): one docked column on the screen he is looking at, holding the whole answer the
/// way a ChatGPT reply does (prose, math, figures, an interactive explainer, a quiz, follow-up chips), rendered from
/// Dot's UI language (docs/ui-language.md) by Resources/board/panel. It streams as the model writes, highlights the
/// step being spoken, stays until he closes it, and is saved so "show the kernel one again" can reopen it.
@MainActor
final class ExplainerPanel: NSObject, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    /// Every message the page sends: quiz answers, chips, selections, widget drags, close.
    var onMessage: ((PanelMessage) -> Void)?

    private(set) var currentID: String?
    private(set) var currentTitle = ""
    private var markup = ""
    private var window: PanelWindow?
    private var web: WKWebView?
    private var relay: PanelRelay?
    private var ready = false
    private var queued: [String] = []
    private let resources: URL?
    private var accentHex: String

    static let widthKey = "explainerPanelWidth"

    init(accentHex: String) {
        self.accentHex = accentHex
        // DOT_BOARD_DIR points a dev build at a worktree's Resources/board
        let candidates = [ProcessInfo.processInfo.environment["DOT_BOARD_DIR"].map { URL(fileURLWithPath: DotConfig.expand($0)) },
                          Bundle.main.resourceURL?.appendingPathComponent("board"),
                          URL(fileURLWithPath: DotConfig.expand("~/Projects/dot/Resources/board"))].compactMap { $0 }
        resources = candidates.first { FileManager.default.fileExists(atPath: $0.appendingPathComponent("panel/panel.html").path) }
        super.init()
        if resources == nil { Log.warn("panel: resources not found; explanations fall back to cards") }
    }

    var available: Bool { resources != nil }
    var isOpen: Bool { window?.isVisible ?? false }

    // MARK: Driving it

    /// Open (or replace) the panel with a new explanation on `screen`, docked away from `avoid` (AppKit rect of the
    /// content Dot is marking). `markup` may be empty when the answer is about to stream in.
    func open(id: String, title: String, markup: String, screen: NSScreen?, avoid: CGRect? = nil) {
        guard let resources else { return }
        ensureWindow(resources: resources)
        currentID = id
        currentTitle = title
        self.markup = markup
        place(on: screen ?? NSScreen.main, avoid: avoid)
        call("panel.load(\(Self.js(markup)), {id: \(Self.js(id)), title: \(Self.js(title))})")
        if window?.isVisible != true {
            window?.alphaValue = 0
            window?.orderFrontRegardless()
            NSAnimationContext.runAnimationGroup { ctx in ctx.duration = 0.2; window?.animator().alphaValue = 1 }
        }
        Log.info("panel: open \(id) \"\(Log.short(title, 60))\" (\(markup.count) chars)")
    }

    /// More of the explanation as the model streams it.
    func append(_ chunk: String) {
        guard currentID != nil, !chunk.isEmpty else { return }
        markup += chunk
        call("panel.append(\(Self.js(chunk)))")
    }

    /// The explanation is complete: render it fully and save it, filed under `course` (a CourseTag code) when known.
    func finish(course: ((String) -> String?)? = nil) {
        guard let id = currentID else { return }
        call("panel.finish()")
        save(id: id, title: currentTitle, markup: markup, course: course?(currentTitle + "\n" + markup))
    }

    /// Light the step Dot is saying.
    func setStep(_ n: Int) { call("panel.setStep(\(n))") }

    func setAccent(hex: String) {
        accentHex = hex
        call("document.documentElement.style.setProperty('--accent', \(Self.js(hex)))")
    }

    func close() {
        guard let window, window.isVisible else { return }
        NSAnimationContext.runAnimationGroup({ ctx in ctx.duration = 0.18; window.animator().alphaValue = 0 }) { [weak window] in
            Task { @MainActor in window?.orderOut(nil) }
        }
        Log.info("panel: closed \(currentID ?? "")")
        currentID = nil
    }

    /// Reopen a saved explanation by id or by words in its title ("the kernel one").
    @discardableResult
    func reopen(matching words: String, screen: NSScreen?) -> Bool {
        let entries = Self.savedIndex()
        let stop: Set<String> = ["the", "one", "show", "again", "back", "bring", "reopen", "open", "panel", "explanation", "that", "this",
                                 "can", "you", "please", "about", "with", "from", "last", "time", "me", "on", "of", "a", "an", "it"]
        let query = Set(words.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).filter { $0.count > 2 && !stop.contains($0) })
        // the newest panel with the most whole-word matches in its title
        let scored = entries.enumerated().map { (i, e) -> (Int, Int, SavedPanel) in
            let title = Set(e.title.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted))
            return (query.intersection(title).count, i, e)
        }
        let best = scored.filter { $0.0 > 0 }.max { ($0.0, $0.1) < ($1.0, $1.1) }
        let hit = entries.first { $0.id == words } ?? best?.2
        guard let hit, let text = try? String(contentsOf: Self.panelsDirectory.appendingPathComponent(hit.file), encoding: .utf8) else { return false }
        open(id: hit.id, title: hit.title, markup: text, screen: screen)
        return true
    }

    // MARK: The window

    private func ensureWindow(resources: URL) {
        if window != nil { return }
        let w = PanelWindow(contentRect: CGRect(x: 0, y: 0, width: PanelDock.defaultWidth, height: 600),
                            styleMask: [.titled, .fullSizeContentView, .resizable, .nonactivatingPanel], backing: .buffered, defer: false)
        w.titleVisibility = .hidden
        w.titlebarAppearsTransparent = true
        for b in [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton] { w.standardWindowButton(b)?.isHidden = true }
        w.isMovableByWindowBackground = false
        w.backgroundColor = NSColor(calibratedRed: 0.063, green: 0.059, blue: 0.051, alpha: 1)
        w.hasShadow = true
        w.isFloatingPanel = true
        w.level = .floating               // after isFloatingPanel, which resets it; above his apps, under Dot's overlay
        w.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        w.hidesOnDeactivate = false
        w.isReleasedWhenClosed = false
        w.minSize = CGSize(width: 320, height: 300)
        w.sharingType = CardPanel.visibleInRecordings ? .readOnly : .none
        w.delegate = self

        let configuration = WKWebViewConfiguration()
        configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        let relay = PanelRelay()
        relay.onMessage = { [weak self] body in self?.received(body) }
        configuration.userContentController.add(relay, name: "dot")
        let web = WKWebView(frame: w.contentView?.bounds ?? .zero, configuration: configuration)
        web.autoresizingMask = [.width, .height]
        web.setValue(false, forKey: "drawsBackground")
        web.navigationDelegate = self
        web.uiDelegate = self
        w.contentView?.addSubview(web)
        web.loadFileURL(resources.appendingPathComponent("panel/panel.html"), allowingReadAccessTo: resources)
        self.window = w
        self.web = web
        self.relay = relay
    }

    private func place(on screen: NSScreen?, avoid: CGRect?) {
        guard let window, let screen else { return }
        let saved = UserDefaults.standard.double(forKey: Self.widthKey)
        let width = saved > 0 ? CGFloat(saved) : PanelDock.defaultWidth
        window.setFrame(PanelDock.frame(in: screen.visibleFrame, width: width, avoid: avoid), display: true)
    }

    // MARK: Navigation: the panel page never leaves panel.html

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.isFileURL, url.lastPathComponent == "panel.html", action.navigationType == .other || action.navigationType == .reload {
            decisionHandler(.allow); return
        }
        // a link (a cite, an <a>) opens in his browser; anything else (a dropped file, a script's location change) goes nowhere
        if action.navigationType == .linkActivated, url.scheme == "https" { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }

    /// target=_blank links: open in his browser, never a new web view.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, url.scheme == "https" { NSWorkspace.shared.open(url) }
        return nil
    }

    /// The page's process died: load it again and put the explanation back.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        Log.warn("panel: web content process ended; reloading \(currentID ?? "")")
        ready = false
        queued = []
        if let id = currentID { call("panel.load(\(Self.js(markup)), {id: \(Self.js(id)), title: \(Self.js(currentTitle))})") }
        webView.reload()
    }

    func windowDidEndLiveResize(_ notification: Notification) {
        guard let window else { return }
        UserDefaults.standard.set(Double(window.frame.width), forKey: Self.widthKey)
    }

    // MARK: Page traffic

    private func call(_ js: String) {
        guard ready, let web else { queued.append(js); return }
        web.evaluateJavaScript(js) { _, error in
            if let error { Log.warn("panel: js failed: \(Log.short(error.localizedDescription, 160))") }
        }
    }

    private func received(_ body: Any) {
        guard let message = PanelMessage(body) else { Log.warn("panel: unknown message \(Log.short("\(body)", 200))"); return }
        switch message {
        case .ready:
            ready = true
            call("document.documentElement.style.setProperty('--accent', \(Self.js(accentHex)))")
            let pending = queued; queued = []
            pending.forEach { call($0) }
        case .close:
            close()
        case .log(let text):
            Log.warn("panel[\(currentID ?? "")] \(text)")
        default:
            break
        }
        onMessage?(message)
    }

    /// A Swift string as a JavaScript string literal.
    static func js(_ s: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [s]), var text = String(data: data, encoding: .utf8) else { return "\"\"" }
        text.removeFirst(); text.removeLast()
        return text
    }

    // MARK: Saved explanations

    struct SavedPanel: Codable { let id: String; let title: String; let file: String; let created: Date; var course: String? = nil }

    static var panelsDirectory: URL { URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Dot/talk/panels", isDirectory: true) }

    static func savedIndex() -> [SavedPanel] {
        let url = panelsDirectory.appendingPathComponent("index.json")
        guard let data = try? Data(contentsOf: url) else { return [] }
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([SavedPanel].self, from: data)) ?? []
    }

    private func save(id: String, title: String, markup: String, course: String?) {
        let dir = Self.panelsDirectory
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let name = PanelDock.fileName(title: title, date: Date(), id: id).replacingOccurrences(of: ".html", with: ".ui")
        do {
            try markup.write(to: dir.appendingPathComponent(name), atomically: true, encoding: .utf8)
            var index = Self.savedIndex().filter { $0.id != id }
            index.append(SavedPanel(id: id, title: title, file: name, created: Date(), course: course))
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601; encoder.outputFormatting = [.prettyPrinted]
            try encoder.encode(Array(index.suffix(300))).write(to: dir.appendingPathComponent("index.json"), options: .atomic)
        } catch {
            Log.warn("panel: could not save \(id): \(error.localizedDescription)")
        }
    }
}

/// Clicks on the panel's chips and quiz land without making Dot the frontmost app.
final class PanelWindow: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

/// The page's messages, relayed without the content controller retaining the panel.
final class PanelRelay: NSObject, WKScriptMessageHandler {
    var onMessage: ((Any) -> Void)?
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let body = message.body
        DispatchQueue.main.async { [weak self] in self?.onMessage?(body) }
    }
}
