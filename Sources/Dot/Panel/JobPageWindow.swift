import AppKit
import DotKit
import WebKit

/// A job's live page in its own window (parity J1): page.md rendered by the explainer's renderer as the job writes it,
/// with the controls he can use (ticks, forms, reviews, letters) posting back through PanelMessage. One per job; it
/// never takes focus from his app until he clicks into a field.
final class JobPageWindow: NSObject, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    let jobID: String
    var onMessage: ((PanelMessage) -> Void)?
    private let resources: URL
    private var accentHex: String
    private var window: PanelWindow?
    private var web: WKWebView?
    private var relay: PanelRelay?
    private var ready = false
    private var queued: [String] = []
    private var shown: (markup: String, title: String, version: String)?
    /// Letters filled from the proposal store, applied again after every load (a reload must not lose them).
    private var letters: [String: [String: String]] = [:]

    init?(jobID: String, accentHex: String) {
        guard let resources = ExplainerPanel.boardResources else { return nil }
        self.jobID = jobID
        self.accentHex = accentHex
        self.resources = resources
        super.init()
    }

    var isOpen: Bool { window?.isVisible ?? false }
    var frame: CGRect? { window?.frame }

    /// Show the page (or bring it forward), at `frame` when given, else docked on the side of the screen he is on.
    func show(markup: String, title: String, version: String, frame: CGRect? = nil) {
        ensureWindow()
        update(markup: markup, title: title, version: version)
        guard let window else { return }
        if let frame { window.setFrame(frame, display: true) }
        else if !window.isVisible, let screen = NSScreen.screens.first(where: { $0.frame.contains(NSEvent.mouseLocation) }) ?? NSScreen.main {
            window.setFrame(PanelDock.frame(in: screen.visibleFrame, width: PanelDock.defaultWidth, avoid: nil), display: true)
        }
        window.orderFrontRegardless()
    }

    /// A new version of the page: render it again (the same version is left alone).
    func update(markup: String, title: String, version: String) {
        guard shown?.version != version || shown?.title != title else { return }
        shown = (markup, title, version)
        call("panel.load(\(ExplainerPanel.js(markup)), {id: \(ExplainerPanel.js("job-" + jobID)), title: \(ExplainerPanel.js(title)), version: \(ExplainerPanel.js(version))})")
        for (id, fields) in letters { callLetter(id, fields) }
    }

    /// Fill a `<letter>` from the proposal store: to, subject, body and its state (pending, sent, withdrawn, expired).
    func letter(_ id: String, to: String, subject: String, body: String, state: String) {
        let fields = ["to": to, "subject": subject, "body": body, "state": state]
        guard letters[id] != fields else { return }
        letters[id] = fields
        callLetter(id, fields)
    }

    private func callLetter(_ id: String, _ fields: [String: String]) {
        guard let data = try? JSONSerialization.data(withJSONObject: fields), let json = String(data: data, encoding: .utf8) else { return }
        call("panel.letter && panel.letter(\(ExplainerPanel.js(id)), \(json))")
    }

    func close() {
        window?.orderOut(nil)
    }

    /// Run script in the page (`Dot --page-selftest` clicks the controls with it).
    func evaluate(_ js: String, done: @escaping (Any?) -> Void) {
        guard let web else { done(nil); return }
        web.evaluateJavaScript(js) { value, _ in done(value) }
    }

    private func ensureWindow() {
        if window != nil { return }
        let w = PanelWindow(contentRect: CGRect(x: 0, y: 0, width: PanelDock.defaultWidth, height: 600),
                            styleMask: [.titled, .closable, .fullSizeContentView, .resizable, .nonactivatingPanel], backing: .buffered, defer: false)
        w.titleVisibility = .hidden
        w.titlebarAppearsTransparent = true
        for b in [NSWindow.ButtonType.miniaturizeButton, .zoomButton] { w.standardWindowButton(b)?.isHidden = true }
        w.backgroundColor = NSColor(calibratedRed: 0.063, green: 0.059, blue: 0.051, alpha: 1)
        w.hasShadow = true
        w.isFloatingPanel = true
        w.level = .floating
        w.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        w.hidesOnDeactivate = false
        w.isReleasedWhenClosed = false
        w.minSize = CGSize(width: 320, height: 240)
        w.sharingType = CardPanel.visibleInRecordings ? .readOnly : .none
        CaptureGuard.follow(w)
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
        window = w
        self.web = web
        self.relay = relay
    }

    private func call(_ js: String) {
        guard ready, let web else { queued.append(js); return }
        web.evaluateJavaScript(js) { _, error in
            if let error { Log.warn("page[\(self.jobID)]: js failed: \(Log.short(error.localizedDescription, 160))") }
        }
    }

    private func received(_ body: Any) {
        guard let message = PanelMessage(body) else { Log.warn("page[\(jobID)]: unknown message \(Log.short("\(body)", 200))"); return }
        switch message {
        case .ready:
            ready = true
            call("document.documentElement.style.setProperty('--accent', \(ExplainerPanel.js(accentHex)))")
            let pending = queued; queued = []
            pending.forEach { call($0) }
        case .close, .minimize:
            close()
        case .log(let text):
            Log.warn("page[\(jobID)] \(text)")
        default:
            onMessage?(message)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.isFileURL, url.lastPathComponent == "panel.html", action.navigationType == .other || action.navigationType == .reload {
            decisionHandler(.allow); return
        }
        if action.navigationType == .linkActivated, url.scheme == "https" { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, url.scheme == "https" { NSWorkspace.shared.open(url) }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        Log.warn("page[\(jobID)]: web content process ended; reloading")
        ready = false
        queued = []
        if let shown { let s = shown; self.shown = nil; update(markup: s.markup, title: s.title, version: s.version) }
        webView.reload()
    }
}
