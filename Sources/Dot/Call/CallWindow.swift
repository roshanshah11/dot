import AppKit
import DotKit
import WebKit

/// The call window (call mode, 2026-10-28): an ordinary window he can drag, minimize and close ("windows act like
/// windows"), with the prep on the left and the live column on the right (Resources/board/call). Never in a screen
/// share or a recording, whatever "show in recordings" says: the other side of a Teams interview must not see it.
@MainActor
final class CallWindow: NSObject, WKNavigationDelegate, NSWindowDelegate {
    private var window: RoomWindow?
    private var web: WKWebView?
    private var relay: PanelRelay?
    private var ready = false
    private var queued: [String] = []
    private var loaded: String?
    /// Tests keep it off every display.
    var offscreen = false
    var onEnd: (() -> Void)?
    var onDial: (() -> Void)?
    /// He closed the window: the call goes on, the window comes back with "show the call".
    var onClose: (() -> Void)?

    struct Load: Encodable {
        struct Item: Encodable { let text: String; let done: Bool }
        let who: String
        let kind: String
        let prep: String
        let checklist: [Item]
        let dial: Bool
        let listenOnly: Bool
        let status: String
    }
    struct Help: Encodable { let fact: String?; let ask: String?; let nudge: String?; let at: String }
    struct Line: Encodable { let side: String; let text: String; let them: String }

    var isVisible: Bool { window?.isVisible ?? false }

    func show(_ load: Load) {
        guard let resources = NotesWindow.findResources() else { Log.warn("call: Resources/board/call not found; no window"); return }
        ensureWindow(resources: resources)
        ready = false
        queued = []
        loaded = "call.load(\(Self.json(load)))"
        web?.load(URLRequest(url: NotesFiles.url(for: resources.appendingPathComponent("call/call.html"))))
        bringUp()
    }

    func bringUp() {
        guard let window else { return }
        if offscreen {
            window.setFrameOrigin(CGPoint(x: -20_000, y: -20_000))
            window.orderBack(nil)
            return
        }
        if !window.isVisible, let screen = NSScreen.main {
            let size = CGSize(width: 900, height: 620)
            let v = screen.visibleFrame
            window.setFrame(CGRect(x: v.maxX - size.width - 24, y: v.maxY - size.height - 24, width: size.width, height: size.height), display: true)
        }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func close() {
        window?.orderOut(nil)
    }

    func check(_ done: [Int]) { run("call.check(\(Self.json(done)))") }
    func help(_ help: Help) { run("call.help(\(Self.json(help)))") }
    func nudge(_ text: String) { run("call.nudge(\(Self.json(text)))") }
    func line(_ line: Line) { run("call.line(\(Self.json(line)))") }
    func status(_ text: String) { run("call.status(\(Self.json(text)))") }
    func clock(_ text: String) { run("call.clock(\(Self.json(text)))") }
    func ended(_ text: String) { run("call.ended(\(Self.json(text)))") }

    /// What the page shows, for the replay test.
    func snapshot() async -> String {
        guard ready, let web else { return "" }
        return (try? await web.evaluateJavaScript("document.getElementById('app').innerText") as? String) ?? ""
    }

    private func run(_ js: String) {
        guard ready, let web else { queued.append(js); return }
        web.evaluateJavaScript(js) { _, error in
            if let error { Log.warn("call: js failed: \(Log.short(error.localizedDescription, 160))") }
        }
    }

    private func received(_ body: Any) {
        guard let d = body as? [String: Any], let type = d["type"] as? String else { return }
        switch type {
        case "ready":
            ready = true
            let pending = (loaded.map { [$0] } ?? []) + queued
            queued = []
            for js in pending { web?.evaluateJavaScript(js) { _, _ in } }
        case "end": onEnd?()
        case "dial": onDial?()
        case "open":
            if let href = d["href"] as? String, let url = URL(string: href), ["http", "https", "mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        case "log": Log.warn("call: page: \(Log.short(d["text"] as? String ?? "", 200))")
        default: break
        }
    }

    private func ensureWindow(resources: URL) {
        if window != nil { return }
        let style: NSWindow.StyleMask = offscreen ? [.borderless] : [.titled, .closable, .miniaturizable, .resizable]
        let w = RoomWindow(contentRect: CGRect(x: -20_000, y: -20_000, width: 900, height: 620), styleMask: style, backing: .buffered, defer: false)
        w.keepOffscreen = offscreen
        w.title = "Call"
        w.level = .normal
        w.hidesOnDeactivate = false
        w.isReleasedWhenClosed = false
        w.minSize = CGSize(width: 620, height: 380)
        // never shared: not CaptureGuard's to follow, which would show it again with "show in recordings"
        w.sharingType = .none
        w.delegate = self
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(NotesFiles(roots: [resources]), forURLScheme: NotesFiles.scheme)
        let relay = PanelRelay()
        relay.onMessage = { [weak self] body in self?.received(body) }
        configuration.userContentController.add(relay, name: "call")
        let web = NotesWebView(frame: w.contentView?.bounds ?? .zero, configuration: configuration)
        web.autoresizingMask = [.width, .height]
        web.setValue(false, forKey: "drawsBackground")
        web.navigationDelegate = self
        w.contentView?.addSubview(web)
        window = w
        self.web = web
        self.relay = relay
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        Log.warn("call: web content process ended; reloading")
        ready = false
        webView.reload()
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        onClose?()
        return false
    }

    static func json<T: Encodable>(_ value: T) -> String {
        (try? String(data: JSONEncoder().encode(value), encoding: .utf8)) ?? "null"
    }
}
