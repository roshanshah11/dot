import AppKit
import DotKit
import Foundation

/// One browser-level DevTools connection, kept open for a job (0.2-0.3 ms a call instead of a new socket each time).
/// Calls to one page go through its flattened session id.
@MainActor
final class CDPConnection {
    let port: Int
    private var task: URLSessionWebSocketTask?
    private var nextId = 1
    private var pending: [Int: CheckedContinuation<[String: Any]?, Never>] = [:]
    private(set) var lastError: String?
    /// method, params, sessionId.
    var onEvent: ((String, [String: Any], String?) -> Void)?
    var isOpen: Bool { task != nil }

    init(port: Int) { self.port = port }

    func connect() async -> Bool {
        if task != nil { return true }
        guard let url = URL(string: "http://127.0.0.1:\(port)/json/version") else { return false }
        var request = URLRequest(url: url, timeoutInterval: 1.0)
        request.httpMethod = "GET"
        guard let (data, _) = try? await URLSession.shared.data(for: request),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let ws = json["webSocketDebuggerUrl"] as? String, let wsURL = URL(string: ws) else {
            lastError = "no devtools on port \(port)"
            return false
        }
        let t = URLSession.shared.webSocketTask(with: wsURL)
        t.maximumMessageSize = 64 * 1024 * 1024
        t.resume()
        task = t
        receive(t)
        return true
    }

    private func receive(_ t: URLSessionWebSocketTask) {
        t.receive { [weak self] result in
            Task { @MainActor in
                guard let self, self.task === t else { return }
                switch result {
                case .failure(let error):
                    self.lastError = error.localizedDescription
                    self.closeAll()
                case .success(let message):
                    var text: String?
                    if case .string(let s) = message { text = s }
                    if case .data(let d) = message { text = String(data: d, encoding: .utf8) }
                    if let text, let data = text.data(using: .utf8), let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        self.dispatch(json)
                    }
                    self.receive(t)
                }
            }
        }
    }

    private func dispatch(_ json: [String: Any]) {
        if let id = json["id"] as? Int {
            guard let waiter = pending.removeValue(forKey: id) else { return }
            if let error = json["error"] as? [String: Any] {
                lastError = error["message"] as? String ?? "error"
                waiter.resume(returning: nil)
            } else {
                waiter.resume(returning: json["result"] as? [String: Any] ?? [:])
            }
            return
        }
        if let method = json["method"] as? String {
            onEvent?(method, json["params"] as? [String: Any] ?? [:], json["sessionId"] as? String)
        }
    }

    /// One call; nil on an error or after `timeout` seconds (a page stuck in a dialog never answers).
    func send(_ method: String, _ params: [String: Any] = [:], session: String? = nil, timeout: Double = 5) async -> [String: Any]? {
        guard let task else { return nil }
        let id = nextId
        nextId += 1
        var body: [String: Any] = ["id": id, "method": method, "params": params]
        if let session { body["sessionId"] = session }
        guard let data = try? JSONSerialization.data(withJSONObject: body), let text = String(data: data, encoding: .utf8) else { return nil }
        let started = Date()
        defer {
            let ms = Int(Date().timeIntervalSince(started) * 1000)
            if ms > 1000 { Log.info("page: cdp \(method) took \(ms) ms") }
        }
        return await withCheckedContinuation { (continuation: CheckedContinuation<[String: Any]?, Never>) in
            pending[id] = continuation
            task.send(.string(text)) { [weak self] error in
                guard let error else { return }
                Task { @MainActor in
                    self?.lastError = error.localizedDescription
                    self?.pending.removeValue(forKey: id)?.resume(returning: nil)
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { [weak self] in
                MainActor.assumeIsolated {
                    guard let self, let waiter = self.pending.removeValue(forKey: id) else { return }
                    self.lastError = "\(method) timed out"
                    waiter.resume(returning: nil)
                }
            }
        }
    }

    private func closeAll() {
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        let waiting = pending
        pending = [:]
        waiting.values.forEach { $0.resume(returning: nil) }
    }

    func close() { closeAll() }
}

/// A job's hands in Comet: its own pinned tab (front: his tab, behind: a window of its own), read through the
/// accessibility tree, acted on with trusted DevTools input that never moves his cursor, with his rule checked on the
/// resolved element before every press (PageCommitRule). Downloads go through Comet's own handling with events, never
/// allowAndName. Hands keeps its one-shot verbs for talk's tags.
@MainActor
final class PageDriver {
    struct Result {
        enum Status: String { case ok, stopped, paused, error }
        var status: Status
        var detail: String
        /// AppKit screen point of what was touched, for the orb (front) or the ring.
        var point: CGPoint?
        /// A control that's his to press.
        var his: String?
        /// A file saved by a download.
        var savedPath: String?

        static func ok(_ d: String, point: CGPoint? = nil) -> Result { Result(status: .ok, detail: d, point: point) }
        static func error(_ d: String) -> Result { Result(status: .error, detail: d) }
        static func stopped(_ d: String, his: String? = nil, point: CGPoint? = nil) -> Result { Result(status: .stopped, detail: d, point: point, his: his) }
    }

    let port: Int
    let bench: Bool
    let cdp: CDPConnection
    /// Where downloads land: Comet's own default folder live, /tmp/dot-bench/downloads in the bench.
    let downloadDir: String
    private(set) var targetId: String?
    private(set) var sessionId: String?
    private(set) var ownsWindow = false
    private var frames: Set<String> = []
    private var refs: [String: Int] = [:]
    private var watch = DownloadWatch()
    private var completedDownload: ((DownloadWatch.Item) -> Void)?
    private var downloadStarted: (() -> Void)?
    private var leaveDialog = false
    private var mainFrameLoading = false
    private var popupTarget: String?
    private var downloadsEnabled = false
    /// Files this job downloaded, which `upload` may use.
    private(set) var downloaded: [String] = []
    var log: (String) -> Void = { Log.info($0) }

    init(port: Int, bench: Bool) {
        self.port = port
        self.bench = bench
        self.cdp = CDPConnection(port: port)
        self.downloadDir = bench ? "/tmp/dot-bench/downloads" : PageDriver.cometDownloadDir()
        cdp.onEvent = { [weak self] method, params, session in self?.event(method, params, session) }
    }

    /// A JavaScript string literal (JSON quoting).
    static func js(_ s: String) -> String {
        guard let d = try? JSONSerialization.data(withJSONObject: [s]), let t = String(data: d, encoding: .utf8) else { return "\"\"" }
        return String(t.dropFirst().dropLast())
    }

    static func cometDownloadDir() -> String {
        let prefs = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Comet/Default/Preferences")
        if let data = try? Data(contentsOf: prefs), let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let d = (json["download"] as? [String: Any])?["default_directory"] as? String, !d.isEmpty { return d }
            if let d = (json["savefile"] as? [String: Any])?["default_directory"] as? String, !d.isEmpty { return d }
        }
        return FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Downloads").path
    }

    var isBound: Bool { sessionId != nil }
    /// A beforeunload dialog is up: the page waits on him and answers nothing until he decides.
    var asksToLeave: Bool { leaveDialog }

    // MARK: Connecting and binding

    func connect() async -> String? {
        if bench, port == 9222 { return "bench on 9222 refused: that is his browser" }
        if await cdp.connect() {
            _ = await cdp.send("Target.setDiscoverTargets", ["discover": true])
            return nil
        }
        return "blocked: comet's devtools port is off"
    }

    struct TabInfo { let id: String; let title: String; let url: String }

    func pageTabs() async -> [TabInfo] {
        guard let r = await cdp.send("Target.getTargets"), let infos = r["targetInfos"] as? [[String: Any]] else { return [] }
        return infos.compactMap { info in
            guard info["type"] as? String == "page", let id = info["targetId"] as? String else { return nil }
            return TabInfo(id: id, title: info["title"] as? String ?? "", url: info["url"] as? String ?? "")
        }
    }

    /// His tab in front: the tab whose url and title the window shows; several matches are settled by focus.
    func bindFront(windowTitle: String?, url: String?) async -> Bool {
        let started = Date()
        defer { log("page: bindFront \(Int(Date().timeIntervalSince(started) * 1000)) ms") }
        if let e = await connect() { log("page: \(e)"); return false }
        let tabs = await pageTabs()
        func norm(_ u: String) -> String { var s = u; if let h = s.firstIndex(of: "#") { s = String(s[..<h]) }; return s.hasSuffix("/") ? String(s.dropLast()) : s }
        var matches = tabs.filter { !$0.title.isEmpty && (windowTitle ?? "").contains($0.title) }
        if let url { matches = matches.filter { norm($0.url) == norm(url) } }
        if matches.isEmpty, let url { matches = tabs.filter { norm($0.url) == norm(url) } }
        if bench, matches.isEmpty { matches = tabs.filter { $0.url.hasPrefix("http://127.0.0.1:") } }
        if matches.count > 1 {
            var focused: [TabInfo] = []
            for tab in matches {
                // 1 s: a tab held by a dialog never answers, and must not cost the job 5 s per candidate
                if await attach(tab.id, enable: false), await evaluate("document.hasFocus()", timeout: 1) as? Bool == true { focused.append(tab) }
                await detach()
            }
            matches = focused
        }
        guard matches.count == 1 else { log("page: front tab binding found \(matches.count) matches"); return false }
        return await attach(matches[0].id, enable: true)
    }

    /// A window of its own behind his app. If the window takes focus anyway, his app gets it back at once, by pid.
    func createBehind(url: String) async -> Bool {
        if let e = await connect() { log("page: \(e)"); return false }
        let front = NSWorkspace.shared.frontmostApplication
        // The window opens on about:blank, so attaching and enabling the domains doesn't wait on the first page load
        // (Runtime.enable on a loading new window took 5 s, and the open 11.5 s, bench J3 on 10-21); then it navigates.
        let params: [String: Any] = ["url": "about:blank", "newWindow": true, "background": false, "focus": false, "width": 1280, "height": 900]
        guard let r = await cdp.send("Target.createTarget", params), let id = r["targetId"] as? String else {
            log("page: createTarget failed: \(cdp.lastError ?? "?")")
            return false
        }
        ownsWindow = true
        handBackFocus(to: front)
        let started = Date()
        let ok = await attach(id, enable: true)
        handBackFocus(to: front)
        guard ok, let s = sessionId else { return false }
        log("page: behind window ready in \(Int(Date().timeIntervalSince(started) * 1000)) ms")
        mainFrameLoading = true
        _ = await cdp.send("Page.navigate", ["url": url], session: s)
        await settle(limit: 10)
        handBackFocus(to: front)
        return true
    }

    private func handBackFocus(to front: NSRunningApplication?) {
        guard let front, front.processIdentifier != ProcessInfo.processInfo.processIdentifier else { return }
        if let now = NSWorkspace.shared.frontmostApplication, now.processIdentifier != front.processIdentifier {
            front.activate()
            log("page: window took focus; handed back to \(front.localizedName ?? "his app") (pid \(front.processIdentifier))")
        }
    }

    @discardableResult
    func attach(_ id: String, enable: Bool) async -> Bool {
        guard let r = await cdp.send("Target.attachToTarget", ["targetId": id, "flatten": true]), let s = r["sessionId"] as? String else { return false }
        targetId = id
        sessionId = s
        refs = [:]
        guard enable else { return true }
        _ = await cdp.send("Page.enable", session: s)
        _ = await cdp.send("Page.setLifecycleEventsEnabled", ["enabled": true], session: s)
        _ = await cdp.send("Runtime.enable", session: s)
        _ = await cdp.send("Accessibility.enable", session: s)
        _ = await cdp.send("DOM.enable", session: s)
        if let tree = await cdp.send("Page.getFrameTree", session: s), let root = tree["frameTree"] as? [String: Any] {
            frames = Self.frameIds(root)
            watch.frames = frames
        }
        return true
    }

    private func detach() async {
        if let s = sessionId { _ = await cdp.send("Target.detachFromTarget", ["sessionId": s]) }
        sessionId = nil
        targetId = nil
    }

    static func frameIds(_ tree: [String: Any]) -> Set<String> {
        var out = Set<String>()
        if let frame = tree["frame"] as? [String: Any], let id = frame["id"] as? String { out.insert(id) }
        for child in (tree["childFrames"] as? [[String: Any]]) ?? [] { out.formUnion(frameIds(child)) }
        return out
    }

    private func event(_ method: String, _ params: [String: Any], _ session: String?) {
        switch method {
        case "Browser.downloadWillBegin", "Page.downloadWillBegin":
            if watch.fold(method: method, params: params) != nil { downloadStarted?() }
        case "Browser.downloadProgress", "Page.downloadProgress":
            if let item = watch.fold(method: method, params: params), item.state == "completed" || item.state == "canceled" { completedDownload?(item) }
        case "Page.frameAttached", "Page.frameNavigated":
            if session == sessionId, let frame = (params["frame"] as? [String: Any])?["id"] as? String ?? params["frameId"] as? String {
                frames.insert(frame); watch.frames = frames
            }
        case "Page.frameStartedLoading":
            if session == sessionId { mainFrameLoading = true }
        case "Page.loadEventFired", "Page.frameStoppedLoading":
            if session == sessionId { mainFrameLoading = false }
        case "Page.javascriptDialogOpening":
            if session == sessionId { leaveDialog = (params["type"] as? String) == "beforeunload" || leaveDialog }
        case "Target.targetCreated":
            // A page this tab opened (target=_blank) becomes the job's tab.
            if let info = params["targetInfo"] as? [String: Any], info["type"] as? String == "page", let opener = info["openerId"] as? String,
               opener == targetId, let id = info["targetId"] as? String {
                popupTarget = id
            }
        default: break
        }
    }

    // MARK: Page helpers

    func evaluate(_ expression: String, awaitPromise: Bool = false, timeout: Double = 5) async -> Any? {
        guard let s = sessionId else { return nil }
        let r = await cdp.send("Runtime.evaluate", ["expression": expression, "returnByValue": true, "awaitPromise": awaitPromise], session: s, timeout: timeout)
        return (r?["result"] as? [String: Any])?["value"]
    }

    private func callOn(_ objectId: String, _ function: String) async -> [String: Any]? {
        guard let s = sessionId else { return nil }
        let r = await cdp.send("Runtime.callFunctionOn", ["objectId": objectId, "functionDeclaration": function, "returnByValue": true, "awaitPromise": true], session: s)
        return (r?["result"] as? [String: Any])?["value"] as? [String: Any]
    }

    private func objectId(ref: String?, label: String?, fields: Bool) async -> String? {
        guard let s = sessionId else { return nil }
        if let ref, let backend = refs[ref] {
            let r = await cdp.send("DOM.resolveNode", ["backendNodeId": backend], session: s)
            return (r?["object"] as? [String: Any])?["objectId"] as? String
        }
        if let label, !label.isEmpty {
            let args = (try? JSONSerialization.data(withJSONObject: ["label": label, "fields": fields])).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
            let r = await cdp.send("Runtime.evaluate", ["expression": "(function(args){\(Self.locateFunction)})(\(args))", "returnByValue": false], session: s)
            let obj = r?["result"] as? [String: Any]
            if obj?["subtype"] as? String == "null" { return nil }
            return obj?["objectId"] as? String
        }
        return nil
    }

    /// Follow a popup the last action opened.
    private func followPopup() async -> Bool {
        guard let id = popupTarget else { return false }
        popupTarget = nil
        guard await attach(id, enable: true) else { return false }
        log("page: followed a new tab the page opened")
        return true
    }

    /// Up to `limit` seconds for the page to settle: loading done, then a quiet beat. A page still loading may not
    /// answer at all, so each check waits a second at most.
    private func settle(limit: Double = 3) async {
        let deadline = Date().addingTimeInterval(limit)
        try? await Task.sleep(nanoseconds: 150_000_000)
        while Date() < deadline {
            if leaveDialog { return }
            let state = await evaluate("document.readyState", timeout: 1) as? String
            if !mainFrameLoading, state == "complete" { break }
            if state == "complete" || state == "interactive", Date().addingTimeInterval(limit / 2) > deadline { break }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        try? await Task.sleep(nanoseconds: 200_000_000)
        _ = await followPopup()
    }

    /// The screen point (AppKit, bottom-left origin) of a spot in the page, from the window's bounds and its chrome.
    func screenPoint(x: Double, y: Double, chromeTop: Double) async -> CGPoint? {
        guard let id = targetId, let r = await cdp.send("Browser.getWindowForTarget", ["targetId": id]),
              let b = r["bounds"] as? [String: Any], let left = (b["left"] as? NSNumber)?.doubleValue, let top = (b["top"] as? NSNumber)?.doubleValue else { return nil }
        let primary = NSScreen.screens.first?.frame.height ?? 0
        return CGPoint(x: left + x, y: primary - (top + chromeTop + y))
    }

    /// The job's window in screen coordinates (top-left origin), for the pause rule.
    func windowBounds() async -> CGRect? {
        guard let id = targetId, let r = await cdp.send("Browser.getWindowForTarget", ["targetId": id], timeout: 1),
              let b = r["bounds"] as? [String: Any] else { return nil }
        func n(_ k: String) -> Double { (b[k] as? NSNumber)?.doubleValue ?? 0 }
        return CGRect(x: n("left"), y: n("top"), width: n("width"), height: n("height"))
    }

    func tabFocused() async -> Bool? {
        guard sessionId != nil else { return nil }
        return await evaluate("document.hasFocus()") as? Bool
    }

    var host: String {
        get async { (await evaluate("location.host") as? String) ?? "" }
    }

    // MARK: Look

    func look(all: Bool = false, text: Bool = false, shot: Bool = false) async -> (text: String, image: String?) {
        guard let s = sessionId else { return ("(no page yet: open one first)", nil) }
        let meta = await evaluate("({url: location.href, title: document.title, h: innerHeight})") as? [String: Any] ?? [:]
        let url = meta["url"] as? String ?? "", title = meta["title"] as? String ?? ""
        let viewport = (meta["h"] as? NSNumber)?.doubleValue
        let tree = await cdp.send("Accessibility.getFullAXTree", session: s, timeout: 8)
        var items = PageSnapshot.candidates(axNodes: (tree?["nodes"] as? [[String: Any]]) ?? [])
        if items.count > 300 { items = Array(items.prefix(300)) }
        // Where each item is, so what's on screen comes first.
        for i in items.indices {
            if let q = await cdp.send("DOM.getContentQuads", ["backendNodeId": items[i].backendId], session: s, timeout: 1),
               let quads = q["quads"] as? [[Double]], let quad = quads.first, quad.count == 8 {
                let ys = [quad[1], quad[3], quad[5], quad[7]]
                items[i].top = ys.min(); items[i].bottom = ys.max()
            } else {
                items[i].top = -10_000; items[i].bottom = -10_000   // not rendered
            }
        }
        items = items.filter { !($0.top == -10_000 && !all) }
        var note: String?
        if leaveDialog { note = "(the page is asking to leave; that's his call)" }
        // Cross-origin frames (a Greenhouse embed, a Canvas tool) aren't in this tree tonight.
        if let frames = await evaluate("(function(){try{return Array.from(document.querySelectorAll('iframe')).filter(f=>{const r=f.getBoundingClientRect(); if(r.width<80||r.height<60) return false; try{return !f.contentDocument}catch(e){return true}}).length}catch(e){return 0}})()", timeout: 1) as? Int,
           frames > 0 {
            note = (note.map { $0 + "\n" } ?? "") + "(part of this page is in a frame dot can't read yet: \(frames) frame\(frames == 1 ? "" : "s"); say so if what he wants is in it)"
        }
        let snap = PageSnapshot.format(url: url, title: title, items: items, viewportHeight: viewport, all: all, note: note)
        refs = snap.refs
        var out = snap.text
        if text, let words = await evaluate("document.body ? document.body.innerText : ''") as? String {
            out += "\n--- page text ---\n" + String(words.prefix(8000))
        }
        var image: String?
        if shot, let r = await cdp.send("Page.captureScreenshot", ["format": "jpeg", "quality": 60], session: s, timeout: 8) {
            image = r["data"] as? String
        }
        return (out, image)
    }

    // MARK: Actions

    func navigate(_ url: String) async -> Result {
        guard let s = sessionId else { return .error("no tab bound") }
        if bench, !(url.hasPrefix("http://127.0.0.1:") || url.hasPrefix("http://localhost:")) { return .error("bench: url outside the fixture") }
        guard await cdp.send("Page.navigate", ["url": url], session: s) != nil else {
            if leaveDialog { return .stopped("the page asks to leave; his call", his: "leave page") }
            return .error("navigate failed: \(cdp.lastError ?? "?")")
        }
        mainFrameLoading = true
        await settle(limit: 8)
        if leaveDialog { return .stopped("the page asks to leave; his call", his: "leave page") }
        return .ok("opened \(URL(string: url)?.host ?? url)")
    }

    static let elementInfo = """
    function() {
      const e = this;
      const tag = (e.tagName || '').toLowerCase();
      const type = (e.type || e.getAttribute('type') || '').toLowerCase();
      function nm(x) {
        let n = x.getAttribute && x.getAttribute('aria-label') || '';
        if (!n && x.id) { const l = document.querySelector('label[for="' + CSS.escape(x.id) + '"]'); if (l) n = l.innerText; }
        if (!n) n = (x.innerText || x.value || (x.getAttribute && (x.getAttribute('title') || x.getAttribute('alt'))) || '');
        return String(n).replace(/\\s+/g, ' ').trim().slice(0, 120);
      }
      const form = e.form || e.closest('form');
      let search = false;
      if (form) {
        const role = (form.getAttribute('role') || '').toLowerCase();
        const txt = form.querySelectorAll('input[type=text],input:not([type]),input[type=email],input[type=search],textarea');
        search = role === 'search' || !!form.querySelector('input[type=search]') ||
          (!form.querySelector('textarea') && txt.length === 1 && /search|query|^q$|find/i.test((txt[0].name || '') + ' ' + (txt[0].placeholder || '') + ' ' + (txt[0].getAttribute('aria-label') || '')));
      }
      const anc = []; let p = e.parentElement;
      for (let i = 0; i < 4 && p; i++, p = p.parentElement) { const a = (p.getAttribute('aria-label') || p.getAttribute('title') || '').trim(); if (a) anc.push(a); }
      e.scrollIntoView({block: 'center', inline: 'center', behavior: 'instant'});
      const r = e.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      const onTop = !!top && (top === e || e.contains(top) || top.contains(e));
      return {tag: tag, type: type, role: (e.getAttribute('role') || ''), name: nm(e), inForm: !!form, formIsSearch: search, ancestors: anc,
              x: cx, y: cy, w: r.width, h: r.height, onTop: onTop, covering: onTop || !top ? '' : (top.innerText || top.getAttribute('aria-label') || top.tagName || '').slice(0, 60),
              chromeTop: outerHeight - innerHeight, autocomplete: (e.getAttribute('autocomplete') || ''), placeholder: (e.getAttribute('placeholder') || ''),
              multiple: !!e.multiple, accept: e.getAttribute('accept') || '', href: e.href || ''};
    }
    """

    /// The control a label names: exact, then starts with, then contains; visible ones only. Returns the element.
    static let locateFunction = """
    const want = args.label.toLowerCase().trim();
    const sel = args.fields ? 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select,[contenteditable=true],[role=searchbox],[role=textbox],[role=combobox]'
      : 'a,button,summary,label,select,[role=button],[role=link],[role=tab],[role=menuitem],[role=switch],[role=checkbox],[role=option],input[type=checkbox],input[type=radio],input[type=submit],input[type=button],input[type=file],[onclick]';
    function name(e) {
      let n = e.getAttribute('aria-label') || '';
      if (!n && e.id) { const l = document.querySelector('label[for="' + CSS.escape(e.id) + '"]'); if (l) n = l.innerText; }
      if (!n) n = e.getAttribute('placeholder') || e.innerText || e.value || e.getAttribute('title') || e.getAttribute('name') || '';
      return n.replace(/\\s+/g, ' ').trim();
    }
    let best = null, bestScore = 0;
    for (const e of document.querySelectorAll(sel)) {
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const st = getComputedStyle(e); if (st.visibility === 'hidden' || st.display === 'none') continue;
      const n = name(e).toLowerCase(); if (!n) continue;
      let s = n === want ? 3 : n.startsWith(want) ? 2 : n.includes(want) ? 1 : 0;
      if (s && r.top >= 0 && r.bottom <= innerHeight) s += 0.5;
      if (s > bestScore) { best = e; bestScore = s; }
    }
    return best;
    """

    struct Target { let objectId: String; let info: [String: Any] }

    private func resolve(ref: String?, label: String?, fields: Bool) async -> Target? {
        guard let id = await objectId(ref: ref, label: label, fields: fields), let info = await callOn(id, Self.elementInfo) else { return nil }
        return Target(objectId: id, info: info)
    }

    private func point(_ info: [String: Any]) async -> CGPoint? {
        guard let x = info["x"] as? Double, let y = info["y"] as? Double else { return nil }
        return await screenPoint(x: x, y: y, chromeTop: (info["chromeTop"] as? Double) ?? 80)
    }

    private func verdict(_ info: [String: Any]) -> PageVerdict {
        PageCommitRule.verdict(name: info["name"] as? String ?? "", role: info["role"] as? String ?? "", tag: info["tag"] as? String ?? "",
                               type: info["type"] as? String ?? "", inForm: info["inForm"] as? Bool ?? false,
                               formIsSearch: info["formIsSearch"] as? Bool ?? false, ancestors: info["ancestors"] as? [String] ?? [])
    }

    private func mouseClick(x: Double, y: Double) async -> Bool {
        guard let s = sessionId else { return false }
        for kind in ["mouseMoved", "mousePressed", "mouseReleased"] {
            var p: [String: Any] = ["type": kind, "x": x, "y": y, "button": "left", "clickCount": 1]
            if kind == "mouseMoved" { p["button"] = "none"; p["clickCount"] = 0 }
            guard await cdp.send("Input.dispatchMouseEvent", p, session: s) != nil else { return false }
        }
        return true
    }

    func click(ref: String?, label: String?) async -> Result {
        guard sessionId != nil else { return .error("no page yet: open one first") }
        guard let t = await resolve(ref: ref, label: label, fields: false) else {
            return .error(ref != nil ? "no \(ref!) on the page now; look again" : "i don't see \(label ?? "that") on this page")
        }
        let name = t.info["name"] as? String ?? (label ?? "")
        let pt = await point(t.info)
        switch verdict(t.info) {
        case .his(let what): return .stopped("his to press: \(what.isEmpty ? name : what)", his: what.isEmpty ? name : what, point: pt)
        case .unnamed: return .stopped("that button has no name, so it's his: name it or leave it", his: "unnamed button", point: pt)
        case .ok: break
        }
        if (t.info["type"] as? String) == "file" { return .error("that's a file input: use upload") }
        if (t.info["onTop"] as? Bool) == false {
            return .error("something covers \(name) (\(t.info["covering"] as? String ?? "?")); close it first")
        }
        guard let x = t.info["x"] as? Double, let y = t.info["y"] as? Double, await mouseClick(x: x, y: y) else { return .error("the click didn't go through") }
        await settle()
        if leaveDialog { return .stopped("the page asks to leave; his call", his: "leave page") }
        return .ok("clicked \(name)", point: pt)
    }

    /// The control he presses himself (click with his: true): found and ringed, never pressed.
    func ring(ref: String?, label: String?) async -> Result {
        guard sessionId != nil else { return .error("no page yet: open one first") }
        guard let t = await resolve(ref: ref, label: label, fields: false) else {
            return .error(ref != nil ? "no \(ref!) on the page now; look again" : "i don't see \(label ?? "that") on this page")
        }
        let name = (t.info["name"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? (label ?? "that button")
        return .stopped("ready for his press: \(name)", his: name, point: await point(t.info))
    }

    func type(ref: String?, label: String?, text: String, replace: Bool, enter: Bool) async -> Result {
        guard let s = sessionId else { return .error("no page yet: open one first") }
        guard let t = await resolve(ref: ref, label: label, fields: true) else { return .error("i don't see that field") }
        if case .his(let why) = PageCommitRule.typeVerdict(inputType: t.info["type"] as? String ?? "", autocomplete: t.info["autocomplete"] as? String ?? "",
                                                          name: t.info["name"] as? String ?? "") {
            return .stopped(why, his: t.info["name"] as? String ?? "password", point: await point(t.info))
        }
        _ = await callOn(t.objectId, "function() { this.focus(); if (\(replace ? "true" : "false")) { if (this.select) this.select(); else { const r = document.createRange(); r.selectNodeContents(this); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } } return {}; }")
        guard await cdp.send("Input.insertText", ["text": text], session: s) != nil else { return .error("typing failed") }
        let value = await evaluate("(function(){const e=document.activeElement; return e ? (e.value || e.innerText || '') : '';})()") as? String ?? ""
        let pt = await point(t.info)
        var detail = value.contains(text) ? "typed it" : "typed it, but the field shows \"\(String(value.prefix(60)))\""
        if enter {
            let h = await host
            let v = PageCommitRule.keyVerdict(key: "Enter", focusedTag: t.info["tag"] as? String ?? "", focusedRole: t.info["role"] as? String ?? "",
                                              focusedType: t.info["type"] as? String ?? "", placeholder: (t.info["placeholder"] as? String ?? "") + " " + (t.info["name"] as? String ?? ""), host: h)
            if case .his(let why) = v { return .stopped("\(detail); enter is his here (\(why))", his: "enter", point: pt) }
            await pressKey("Enter")
            await settle()
            detail += " and searched"
        }
        return .ok(detail, point: pt)
    }

    func select(ref: String, option: String) async -> Result {
        guard sessionId != nil else { return .error("no page yet") }
        guard let t = await resolve(ref: ref, label: nil, fields: true) else { return .error("no \(ref) now; look again") }
        let js = """
        function(want) { const w = want.toLowerCase(); const o = Array.from(this.options || []).find(o => o.text.trim().toLowerCase() === w || o.value.toLowerCase() === w) ||
          Array.from(this.options || []).find(o => o.text.toLowerCase().includes(w)); if (!o) return {ok: false, options: Array.from(this.options || []).map(o => o.text.trim()).slice(0, 20)};
          this.value = o.value; this.dispatchEvent(new Event('input', {bubbles: true})); this.dispatchEvent(new Event('change', {bubbles: true})); return {ok: true, text: o.text.trim()}; }
        """
        guard let s = sessionId else { return .error("no page") }
        let r = await cdp.send("Runtime.callFunctionOn", ["objectId": t.objectId, "functionDeclaration": js, "arguments": [["value": option]], "returnByValue": true], session: s)
        let v = (r?["result"] as? [String: Any])?["value"] as? [String: Any] ?? [:]
        if (v["ok"] as? Bool) != true { return .error("no option \"\(option)\"; it has: \((v["options"] as? [String] ?? []).joined(separator: ", "))") }
        await settle(limit: 1.5)
        return .ok("picked \(v["text"] as? String ?? option)", point: await point(t.info))
    }

    private func pressKey(_ key: String, modifiers: Int = 0) async {
        guard let s = sessionId else { return }
        let codes: [String: (String, Int, String)] = [
            "Enter": ("Enter", 13, "\r"), "Tab": ("Tab", 9, ""), "Escape": ("Escape", 27, ""), "ArrowDown": ("ArrowDown", 40, ""),
            "ArrowUp": ("ArrowUp", 38, ""), "ArrowLeft": ("ArrowLeft", 37, ""), "ArrowRight": ("ArrowRight", 39, ""),
            "PageDown": ("PageDown", 34, ""), "PageUp": ("PageUp", 33, ""), "Home": ("Home", 36, ""), "End": ("End", 35, ""),
            "Space": (" ", 32, " "), "Backspace": ("Backspace", 8, ""),
        ]
        let (k, code, text) = codes[key] ?? (key, 0, "")
        for kind in ["keyDown", "keyUp"] {
            var p: [String: Any] = ["type": kind, "key": k, "code": k == " " ? "Space" : k, "windowsVirtualKeyCode": code, "modifiers": modifiers]
            if kind == "keyDown", !text.isEmpty { p["text"] = text }
            _ = await cdp.send("Input.dispatchKeyEvent", p, session: s)
        }
    }

    static func canonicalKey(_ raw: String) -> String {
        let k = raw.trimmingCharacters(in: .whitespaces).lowercased()
        let map = ["enter": "Enter", "return": "Enter", "tab": "Tab", "escape": "Escape", "esc": "Escape", "down": "ArrowDown",
                   "arrowdown": "ArrowDown", "up": "ArrowUp", "arrowup": "ArrowUp", "left": "ArrowLeft", "arrowleft": "ArrowLeft",
                   "right": "ArrowRight", "arrowright": "ArrowRight", "pagedown": "PageDown", "page down": "PageDown", "pageup": "PageUp",
                   "page up": "PageUp", "home": "Home", "end": "End", "space": "Space", "backspace": "Backspace"]
        return map[k] ?? raw
    }

    func key(_ keys: String) async -> Result {
        guard sessionId != nil else { return .error("no page yet") }
        var parts = keys.lowercased().split(separator: "+").map { String($0).trimmingCharacters(in: .whitespaces) }
        let base = parts.popLast() ?? ""
        let cmd = parts.contains("cmd") || parts.contains("command") || parts.contains("meta")
        let ctrl = parts.contains("ctrl") || parts.contains("control")
        let opt = parts.contains("alt") || parts.contains("option") || parts.contains("opt")
        let shift = parts.contains("shift")
        let key = Self.canonicalKey(base)
        let focus = await evaluate("(function(){const e=document.activeElement; return e ? {tag: e.tagName.toLowerCase(), role: e.getAttribute('role')||'', type: (e.getAttribute('type')||'').toLowerCase(), ph: (e.getAttribute('placeholder')||e.getAttribute('aria-label')||'')} : {};})()") as? [String: Any] ?? [:]
        if key == " " || key.lowercased() == "space",
           PageCommitRule.spacePresses(tag: focus["tag"] as? String ?? "", role: focus["role"] as? String ?? "", type: focus["type"] as? String ?? "") {
            return .error("space would press the focused \(focus["tag"] as? String ?? "control"); click it instead, so dot checks it")
        }
        let h = await host
        let v = PageCommitRule.keyVerdict(key: key, command: cmd, control: ctrl, option: opt, focusedTag: focus["tag"] as? String ?? "",
                                          focusedRole: focus["role"] as? String ?? "", focusedType: focus["type"] as? String ?? "",
                                          placeholder: focus["ph"] as? String ?? "", host: h)
        if case .his(let why) = v { return .stopped("\(keys) is his here: \(why)", his: keys) }
        await pressKey(key, modifiers: shift ? 8 : 0)
        await settle(limit: 1.5)
        return .ok("pressed \(keys)")
    }

    func scroll(_ to: String) async -> Result {
        guard sessionId != nil else { return .error("no page yet") }
        let move = to.lowercased().trimmingCharacters(in: .whitespaces)
        if ["down", "up", "top", "bottom"].contains(move) {
            let js = """
            (function(move){ let el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
            while (el && el !== document.body && !(el.scrollHeight > el.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
            if (!el || el === document.body || el === document.documentElement) el = document.scrollingElement || document.documentElement;
            const before = el.scrollTop;
            if (move === 'down') el.scrollBy({top: el.clientHeight * 0.8, behavior: 'instant'}); else if (move === 'up') el.scrollBy({top: -el.clientHeight * 0.8, behavior: 'instant'});
            else if (move === 'top') el.scrollTo({top: 0, behavior: 'instant'}); else el.scrollTo({top: el.scrollHeight, behavior: 'instant'});
            return {before: before, after: el.scrollTop}; })(\(Self.js(move)))
            """
            let r = await evaluate(js) as? [String: Any] ?? [:]
            let before = (r["before"] as? NSNumber)?.doubleValue ?? 0, after = (r["after"] as? NSNumber)?.doubleValue ?? 0
            return abs(after - before) > 1 || move == "top" ? .ok("scrolled \(move)") : .ok("the page can't scroll \(move) any further")
        }
        let js = """
        (function(needle){ needle = needle.toLowerCase(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) { const i = n.data.toLowerCase().indexOf(needle); if (i < 0) continue; const p = n.parentElement; if (!p) continue;
        p.scrollIntoView({block: 'center', behavior: 'instant'}); return true; } return false; })(\(Self.js(to)))
        """
        let found = await evaluate(js) as? Bool ?? false
        return found ? .ok("scrolled to \"\(to)\"") : .error("\"\(to)\" isn't on this page")
    }

    func back() async -> Result {
        guard sessionId != nil else { return .error("no page yet") }
        _ = await evaluate("history.back()")
        mainFrameLoading = true
        await settle()
        if leaveDialog { return .stopped("the page asks to leave; his call", his: "leave page") }
        return .ok("went back")
    }

    func wait(for text: String?, ms: Int?) async -> Result {
        guard sessionId != nil else { return .error("no page yet") }
        let limit = min(Double(ms ?? 10_000) / 1000, 10)
        let deadline = Date().addingTimeInterval(limit)
        if let text, !text.isEmpty {
            while Date() < deadline {
                if let body = await evaluate("document.body ? document.body.innerText : ''") as? String, body.localizedCaseInsensitiveContains(text) {
                    return .ok("\"\(text)\" is on the page")
                }
                try? await Task.sleep(nanoseconds: 250_000_000)
            }
            return .error("\"\(text)\" didn't show in \(Int(limit)) s")
        }
        if ms != nil { try? await Task.sleep(nanoseconds: UInt64(limit * 1_000_000_000)); return .ok("waited") }
        await settle(limit: limit)
        return .ok("the page settled")
    }

    /// A trusted click with Comet's own download handling and events; the saved path comes back.
    func download(ref: String) async -> Result {
        guard let s = sessionId else { return .error("no page yet") }
        guard let t = await resolve(ref: ref, label: nil, fields: false) else { return .error("no \(ref) now; look again") }
        switch verdict(t.info) {
        case .his(let what): return .stopped("his to press: \(what)", his: what, point: await point(t.info))
        case .unnamed: return .stopped("that button has no name, so it's his", his: "unnamed button", point: await point(t.info))
        case .ok: break
        }
        if !downloadsEnabled {
            // never allow or allowAndName on his Comet: his own downloads would go to Dot's folder
            _ = await cdp.send("Browser.setDownloadBehavior", ["behavior": "default", "eventsEnabled": true])
            downloadsEnabled = true
        }
        if let tree = await cdp.send("Page.getFrameTree", session: s), let root = tree["frameTree"] as? [String: Any] {
            frames.formUnion(Self.frameIds(root)); watch.frames = frames
        }
        guard let x = t.info["x"] as? Double, let y = t.info["y"] as? Double else { return .error("can't place \(ref)") }
        var began = false
        var finished: DownloadWatch.Item?
        downloadStarted = { began = true }
        completedDownload = { item in finished = item }
        defer { downloadStarted = nil; completedDownload = nil }
        guard await mouseClick(x: x, y: y) else { return .error("the click didn't go through") }
        let startDeadline = Date().addingTimeInterval(3)
        while !began, Date() < startDeadline { try? await Task.sleep(nanoseconds: 100_000_000) }
        if !began {
            // It opened in the viewer instead: fetch the bytes in the page (his cookies) and save them with a new name.
            let href = t.info["href"] as? String ?? ""
            let current = await evaluate("location.href") as? String ?? ""
            let source = !href.isEmpty ? href : current
            guard source.lowercased().contains(".pdf") || current.lowercased().hasSuffix(".pdf") else { return .error("nothing started downloading") }
            return await fetchSave(source)
        }
        let doneDeadline = Date().addingTimeInterval(120)
        while finished == nil, Date() < doneDeadline { try? await Task.sleep(nanoseconds: 100_000_000) }
        guard let item = finished else { return .error("the download didn't finish in 120 s") }
        guard item.state == "completed", let path = item.filePath else { return .error("the download was canceled") }
        downloaded.append(path)
        return Result(status: .ok, detail: "saved \(path)", savedPath: path)
    }

    private func fetchSave(_ url: String) async -> Result {
        let js = "fetch(\(Self.js(url)), {credentials: 'include'}).then(r => r.arrayBuffer()).then(b => { let s = ''; const a = new Uint8Array(b); for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode.apply(null, a.subarray(i, i + 32768)); return btoa(s); })"
        guard let b64 = await evaluate(js, awaitPromise: true) as? String, let data = Data(base64Encoded: b64), data.count > 4 else {
            return .error("it opened in the viewer and i couldn't fetch the file")
        }
        let name = URL(string: url)?.lastPathComponent.removingPercentEncoding ?? "download.pdf"
        try? FileManager.default.createDirectory(atPath: downloadDir, withIntermediateDirectories: true)
        // An exclusive create, so a file that appears between the free-name check and the write is never overwritten (review M6).
        var path = ""
        for _ in 0..<5 {
            let candidate = DownloadWatch.uniquePath(in: downloadDir, name: name.isEmpty ? "download.pdf" : name)
            let fd = open(candidate, O_WRONLY | O_CREAT | O_EXCL, 0o644)
            if fd < 0 { if errno == EEXIST { continue } else { break } }
            let written = data.withUnsafeBytes { write(fd, $0.baseAddress, data.count) }
            close(fd)
            if written == data.count { path = candidate } else { unlink(candidate) }
            break
        }
        guard !path.isEmpty else { return .error("couldn't save it") }
        downloaded.append(path)
        return Result(status: .ok, detail: "it opened in the viewer; saved a copy at \(path)", savedPath: path)
    }

    /// A file into a file input: only one he named, one the job made, or one it downloaded.
    func upload(ref: String, path: String, allowed: Bool) async -> Result {
        guard let s = sessionId else { return .error("no page yet") }
        guard let t = await resolve(ref: ref, label: nil, fields: false) else { return .error("no \(ref) now; look again") }
        guard allowed else { return .stopped("pick the file yourself: dot only uploads a file you named or one this job made", his: "file input", point: await point(t.info)) }
        guard FileManager.default.fileExists(atPath: path) else { return .error("no file at \(path)") }
        guard let node = await cdp.send("DOM.requestNode", ["objectId": t.objectId], session: s), let nodeId = node["nodeId"] as? Int else {
            _ = await cdp.send("DOM.getDocument", ["depth": 0], session: s)
            return .error("couldn't reach the file input")
        }
        guard await cdp.send("DOM.setFileInputFiles", ["files": [path], "nodeId": nodeId], session: s) != nil else { return .error("the file didn't attach") }
        await settle(limit: 2)
        return .ok("attached \((path as NSString).lastPathComponent)")
    }

    /// Bring the job's window in front of him.
    func show() async -> Result {
        guard let id = targetId else { return .error("no window to show") }
        _ = await cdp.send("Target.activateTarget", ["targetId": id])
        if let s = sessionId { _ = await cdp.send("Page.bringToFront", session: s) }
        let pid = Self.cometPid(port: port)
        if let pid, let app = NSRunningApplication(processIdentifier: pid) { app.activate() }
        try? await Task.sleep(nanoseconds: 250_000_000)
        // Comet in front with the job's window first among its windows; else raise that window by its bounds.
        if let pid, let bounds = await windowBounds(), !Self.isFirstWindow(of: pid, bounds: bounds) {
            Self.raiseWindow(of: pid, bounds: bounds)
            try? await Task.sleep(nanoseconds: 150_000_000)
        }
        let front = NSWorkspace.shared.frontmostApplication?.processIdentifier
        return front == pid ? .ok("it's in front of you") : .ok("asked comet to show it")
    }

    /// Whether the window with these bounds (screen points, top-left) is the first on-screen window of the app.
    static func isFirstWindow(of pid: pid_t, bounds: CGRect) -> Bool {
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return false }
        for w in list where (w[kCGWindowLayer as String] as? Int) == 0 {
            guard let owner = w[kCGWindowOwnerPID as String] as? pid_t, let b = w[kCGWindowBounds as String] as? [String: Any] else { continue }
            let r = CGRect(x: b["X"] as? Double ?? 0, y: b["Y"] as? Double ?? 0, width: b["Width"] as? Double ?? 0, height: b["Height"] as? Double ?? 0)
            return owner == pid && abs(r.minX - bounds.minX) < 4 && abs(r.minY - bounds.minY) < 4
        }
        return false
    }

    /// AXRaise the app's window whose frame matches the bounds (the fallback when activating the tab didn't raise it).
    static func raiseWindow(of pid: pid_t, bounds: CGRect) {
        let app = AXUIElementCreateApplication(pid)
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &value) == .success, let windows = value as? [AXUIElement] else { return }
        for w in windows {
            var p: CFTypeRef?
            guard AXUIElementCopyAttributeValue(w, kAXPositionAttribute as CFString, &p) == .success, let p else { continue }
            var point = CGPoint.zero
            guard AXValueGetValue(unsafeBitCast(p, to: AXValue.self), .cgPoint, &point) else { continue }
            if abs(point.x - bounds.minX) < 4, abs(point.y - bounds.minY) < 4 {
                AXUIElementPerformAction(w, kAXRaiseAction as CFString)
                return
            }
        }
    }

    /// The pid of the Comet listening on this DevTools port (the bench Comet shares Comet's bundle id).
    static func cometPid(port: Int) -> pid_t? {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
        p.arguments = ["-nP", "-iTCP:\(port)", "-sTCP:LISTEN", "-t"]
        let out = Pipe()
        p.standardOutput = out
        p.standardError = FileHandle.nullDevice
        do { try p.run() } catch { return nil }
        p.waitUntilExit()
        let text = String(data: out.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        return text.split(separator: "\n").first.flatMap { pid_t($0.trimmingCharacters(in: .whitespaces)) }
    }

    /// The job is over: its own window closes, unless it stopped at his button; the connection goes.
    func finish(keepWindow: Bool) async {
        if ownsWindow, !keepWindow, let id = targetId { _ = await cdp.send("Target.closeTarget", ["targetId": id]) }
        cdp.close()
    }
}
