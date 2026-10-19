import AppKit
import ApplicationServices
import DotKit
import Foundation

/// Dot's own hands for the small things (the basics pass, 2026-10-18): open an app, a folder, a file or
/// a site; scroll; go back; click a named control; type into a field; press keys; play or pause. Each
/// one is checked after acting and confirmed in one line, in about a second, with no agent.
///
/// His cursor never moves. Native apps are driven through accessibility (AXPress, the scroll bar's
/// value, the focused field); Comet through its own DevTools port, bound only to the tab that matches
/// the window in front. His standing rule holds over every verb: a control that reads like a send,
/// a submit, a payment or a delete is never pressed (CommitGuard); Return only goes to a search field.
@MainActor
final class Hands {
    struct Outcome {
        var ok: Bool
        /// Said aloud: the confirmation, or what went wrong in his terms.
        var line: String
        /// For the log: what was done or why not.
        var detail: String
        /// Where the orb should fly (AppKit coordinates), when the action touched something.
        var point: CGPoint?
        /// A control his rule keeps for him: ring it, don't press it.
        var commitLabel: String?
        /// The target could not be named ("open chain stream"): ask one short question.
        var unresolved = false
    }

    /// Bench mode (`Dot --ask --bench`): actions only on the bench fixture, Comet only on its own port.
    struct Bench {
        var cometPort: Int
    }

    var cometPort: Int
    var bench: Bench?

    init(cometPort: Int) { self.cometPort = cometPort }

    static let cometBundle = "ai.perplexity.comet"

    /// The DevTools port for the action in progress, read once so a bench action can't switch ports partway.
    private var port: Int = 9222

    // MARK: Entry

    func perform(_ command: ActionCommand, context: ScreenContext) async -> Outcome {
        port = bench?.cometPort ?? cometPort
        if bench != nil, port == 9222 { return Outcome(ok: false, line: "", detail: "bench on 9222 refused") }
        if let bench, let refusal = benchRefusal(command, context: context, bench: bench) {
            Log.info("bench: blocked action \(command.verb) \(refusal)")
            return Outcome(ok: false, line: "that's outside the bench, so i left it.", detail: "bench: \(refusal)")
        }
        let isComet = context.bundleIdentifier == Self.cometBundle
        switch command {
        case .open(let name): return await open(named: name)
        case .openURL(let url, let newTab): return await openURL(url, newTab: newTab, context: context)
        case .openPath(let path): return open(path: path)
        case .scroll(let move):
            if isComet, let r = await cometScroll(move, context: context) { return r }
            return nativeScroll(move, context: context)
        case .browser(let move):
            if isComet, let r = await cometBrowser(move, context: context) { return r }
            return keyBrowser(move, context: context)
        case .key(let chord):
            if isComet, KeyChord.parse(chord)?.isPlainReturn == true, let r = await cometSubmitSearch(context: context) { return r }
            return key(chord, context: context)
        case .click(let label):
            if CommitGuard.isCommit(label) { return Outcome(ok: false, line: "", detail: "commit word in \"\(label)\"", commitLabel: label) }
            if isComet, let r = await cometClick(label, context: context) { return r }
            return nativeClick(label, context: context)
        case .insert(let label, let text):
            if isComet, let r = await cometInsert(label: label, text: text, context: context) { return r }
            return nativeInsert(label: label, text: text, context: context)
        case .media(let move): return media(move)
        case .go: return Outcome(ok: true, line: "on it.", detail: "go: handed to a driven walkthrough")
        }
    }

    // MARK: Open

    /// An app, a folder or a bookmarked site named in words. Nil-resolving names come back unresolved.
    func resolve(_ name: String) -> (kind: String, url: URL)? {
        let lower = name.lowercased().trimmingCharacters(in: .whitespaces)
        let home = FileManager.default.homeDirectoryForCurrentUser
        let folders: [String: String] = ["downloads": "Downloads", "desktop": "Desktop", "documents": "Documents", "pictures": "Pictures",
                                         "music": "Music", "movies": "Movies", "applications": "Applications", "home": ""]
        let folderKey = lower.replacingOccurrences(of: " folder", with: "")
        if let sub = folders[folderKey] { return ("folder", sub.isEmpty ? home : home.appendingPathComponent(sub)) }
        if let app = Self.appURL(named: lower) { return ("app", app) }
        if let site = Self.bookmark(named: lower) { return ("site", site) }
        return nil
    }

    func canResolve(_ name: String) -> Bool { resolve(name) != nil }

    private func open(named name: String) async -> Outcome {
        guard let (kind, url) = resolve(name) else {
            return Outcome(ok: false, line: "i don't see an app, folder or bookmark called \(name.lowercased()). if it's a site, say the address and i'll open it.",
                           detail: "unresolved \"\(name)\"", unresolved: true)
        }
        if kind == "site" { return await openURL(url.absoluteString, newTab: true, context: ScreenContext.empty) }
        let config = NSWorkspace.OpenConfiguration()
        config.activates = true
        do {
            if kind == "app" { _ = try await NSWorkspace.shared.openApplication(at: url, configuration: config) }
            else { _ = try await NSWorkspace.shared.open(url, configuration: config) }
        } catch {
            return Outcome(ok: false, line: "\(name.lowercased()) didn't open.", detail: "open failed: \(error.localizedDescription)")
        }
        // Check after acting: the app (or Finder) is in front within a second and a half.
        let want = kind == "app" ? Bundle(url: url)?.bundleIdentifier : "com.apple.finder"
        let front = await waitFront(want, seconds: 1.5)
        return Outcome(ok: front, line: front ? "opened \(name.lowercased())." : "opening \(name.lowercased()).", detail: "\(kind) \(url.path) front=\(front)")
    }

    private func open(path: String) -> Outcome {
        let url = URL(fileURLWithPath: (path as NSString).expandingTildeInPath)
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir) else {
            return Outcome(ok: false, line: "i can't find \((path as NSString).lastPathComponent).", detail: "no file at \(url.path)", unresolved: true)
        }
        // Opening a script, an app or an installer runs code: those stay his.
        let runs: Set<String> = ["command", "sh", "zsh", "bash", "app", "pkg", "mpkg", "workflow", "tool", "terminal", "scpt", "applescript",
                                 "jar", "py", "rb", "pl", "dmg", "action", "prefpane", "kext", "plugin"]
        if runs.contains(url.pathExtension.lowercased()) || (!isDir.boolValue && FileManager.default.isExecutableFile(atPath: url.path)) {
            return Outcome(ok: false, line: "\(url.lastPathComponent.lowercased()) would run something, so open it yourself.", detail: "refused executable \(url.path)", commitLabel: url.lastPathComponent)
        }
        let config = NSWorkspace.OpenConfiguration()
        config.activates = true
        NSWorkspace.shared.open(url, configuration: config)
        return Outcome(ok: true, line: "opened \(url.lastPathComponent.lowercased()).", detail: "path \(url.path)")
    }

    private func openURL(_ text: String, newTab: Bool, context: ScreenContext) async -> Outcome {
        guard let url = URL(string: text), let scheme = url.scheme, ["http", "https"].contains(scheme) else {
            return Outcome(ok: false, line: "that address doesn't look right.", detail: "bad url \(text)")
        }
        let host = url.host ?? "it"
        // Same tab in Comet: navigate the tab in front.
        if !newTab, context.bundleIdentifier == Self.cometBundle, let tab = await bindTab(context) {
            if await cdp(tab, "Page.navigate", ["url": url.absoluteString]) != nil {
                return Outcome(ok: true, line: "opened \(host).", detail: "cdp navigate \(url.absoluteString)")
            }
        }
        // A new tab in Comet when it is running (his browser); otherwise the default browser.
        let config = NSWorkspace.OpenConfiguration()
        config.activates = true
        if let comet = NSWorkspace.shared.urlForApplication(withBundleIdentifier: Self.cometBundle), bench == nil {
            _ = try? await NSWorkspace.shared.open([url], withApplicationAt: comet, configuration: config)
        } else if bench != nil {
            // bench: the throwaway Comet only, never the default browser (his Comet)
            guard let tab = await anyTab(), await cdpBrowserNewTab(url, near: tab) else {
                return Outcome(ok: false, line: "", detail: "bench: no bench comet to open it in")
            }
        } else {
            NSWorkspace.shared.open(url)
        }
        return Outcome(ok: true, line: "opened \(host).", detail: "open url \(url.absoluteString) newTab=\(newTab)")
    }

    // MARK: Native scroll, keys, click, type

    private func frontIs(_ context: ScreenContext) -> Bool {
        guard let front = NSWorkspace.shared.frontmostApplication, front.processIdentifier != ProcessInfo.processInfo.processIdentifier else { return false }
        return context.bundleIdentifier == nil || front.bundleIdentifier == context.bundleIdentifier
    }

    private func nativeScroll(_ move: ActionCommand.Scroll, context: ScreenContext) -> Outcome {
        if case .toText = move { return Outcome(ok: false, line: "", detail: "native find: caller uses the document finder") }
        guard frontIs(context) else { return Outcome(ok: false, line: "the app in front changed, so i didn't scroll.", detail: "front app changed") }
        if let bar = verticalScrollBar(), setScroll(bar, move) {
            return Outcome(ok: true, line: ActionCommand.scroll(move).doneLine, detail: "ax scroll bar")
        }
        let codes: [String: UInt16] = ["down": 121, "up": 116, "top": 115, "bottom": 119]
        let key: String
        switch move { case .up: key = "up"; case .down: key = "down"; case .top: key = "top"; case .bottom: key = "bottom"; case .toText: key = "down" }
        guard let code = codes[key] else { return Outcome(ok: false, line: "", detail: "no key") }
        Navigator.chord(key: CGKeyCode(code), flags: [])
        return Outcome(ok: true, line: ActionCommand.scroll(move).doneLine, detail: "page key \(key)")
    }

    private func verticalScrollBar() -> AXUIElement? {
        guard let app = NSWorkspace.shared.frontmostApplication else { return nil }
        let root = AXUIElementCreateApplication(app.processIdentifier)
        guard let window = Self.ax(root, kAXFocusedWindowAttribute) else { return nil }
        // the biggest scroll area in the window, breadth first, bounded
        var queue: [(AXUIElement, Int)] = [(window, 0)]
        var best: (AXUIElement, CGFloat)?
        var visited = 0
        let deadline = Date().addingTimeInterval(0.3)
        while !queue.isEmpty, visited < 600, Date() < deadline {
            let (element, depth) = queue.removeFirst()
            visited += 1
            if Self.string(element, kAXRoleAttribute) == "AXScrollArea", let bar = Self.ax(element, kAXVerticalScrollBarAttribute) {
                let area = Self.frame(element).map { $0.width * $0.height } ?? 0
                if best == nil || area > best!.1 { best = (bar, area) }
            }
            if depth < 8, let kids = Self.children(element) { for kid in kids.prefix(80) { queue.append((kid, depth + 1)) } }
        }
        return best?.0
    }

    private func setScroll(_ bar: AXUIElement, _ move: ActionCommand.Scroll) -> Bool {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(bar, kAXValueAttribute as CFString, &value) == .success, let now = (value as? NSNumber)?.doubleValue else { return false }
        let next: Double
        switch move {
        case .down: next = min(now + 0.12, 1)
        case .up: next = max(now - 0.12, 0)
        case .top: next = 0
        case .bottom: next = 1
        case .toText: return false
        }
        return AXUIElementSetAttributeValue(bar, kAXValueAttribute as CFString, NSNumber(value: next)) == .success
    }

    private func keyBrowser(_ move: ActionCommand.Browser, context: ScreenContext) -> Outcome {
        let chord: String
        switch move {
        case .back: chord = "cmd+["
        case .forward: chord = "cmd+]"
        case .reload: chord = "cmd+r"
        case .newTab: chord = "cmd+t"
        case .closeTab: chord = "cmd+w"
        }
        var outcome = key(chord, context: context)
        if outcome.ok { outcome.line = ActionCommand.browser(move).doneLine }
        return outcome
    }

    /// A key chord to the app in front, after checking it is still the app he was looking at.
    func key(_ chordText: String, context: ScreenContext) -> Outcome {
        guard let chord = KeyChord.parse(chordText) else { return Outcome(ok: false, line: "", detail: "bad chord \(chordText)") }
        guard let front = NSWorkspace.shared.frontmostApplication, front.processIdentifier != ProcessInfo.processInfo.processIdentifier,
              context.bundleIdentifier == nil || front.bundleIdentifier == context.bundleIdentifier else {
            return Outcome(ok: false, line: "the app in front changed, so i didn't press anything.", detail: "front app changed")
        }
        guard chord.isAllowedForDot else {
            return Outcome(ok: false, line: "that key could change or send something, so it's yours.", detail: "chord \(chordText) not on Dot's list", commitLabel: chordText)
        }
        if chord.isReturn, !chord.isPlainReturn || !returnAllowedInFocusedField() {
            return Outcome(ok: false, line: "return there could send something, so that one's yours.", detail: "return outside a search field", commitLabel: "return")
        }
        var flags: CGEventFlags = []
        if chord.command { flags.insert(.maskCommand) }
        if chord.shift { flags.insert(.maskShift) }
        if chord.option { flags.insert(.maskAlternate) }
        if chord.control { flags.insert(.maskControl) }
        Navigator.chord(key: CGKeyCode(chord.keyCode), flags: flags)
        return Outcome(ok: true, line: "done.", detail: "key \(chordText) to \(front.bundleIdentifier ?? "?")")
    }

    private func returnAllowedInFocusedField() -> Bool {
        let system = AXUIElementCreateSystemWide()
        guard let focused = Self.ax(system, kAXFocusedUIElementAttribute) else { return false }
        return CommitGuard.returnAllowed(role: Self.string(focused, kAXRoleAttribute), subrole: Self.string(focused, kAXSubroleAttribute),
                                         placeholder: Self.string(focused, kAXPlaceholderValueAttribute) ?? Self.string(focused, kAXDescriptionAttribute))
    }

    private func nativeClick(_ label: String, context: ScreenContext) -> Outcome {
        guard let element = Self.bestElement(label, in: context.elements) else {
            return Outcome(ok: false, line: "i don't see \(label.lowercased()) on screen.", detail: "no element \"\(label)\"")
        }
        if CommitGuard.isCommit(element.title) { return Outcome(ok: false, line: "", detail: "commit word in \"\(element.title)\"", commitLabel: element.title) }
        let center = CGPoint(x: element.frame.midX, y: element.frame.midY)
        switch Self.press(atAppKit: center, frontPid: NSWorkspace.shared.frontmostApplication?.processIdentifier) {
        case .pressed:
            return Outcome(ok: true, line: "clicked \(element.title.lowercased()).", detail: "axpress \(element.role) \"\(element.title)\"", point: center)
        case .commit(let label):
            return Outcome(ok: false, line: "", detail: "commit word in \"\(label)\"", point: center, commitLabel: label)
        case .otherApp:
            return Outcome(ok: false, line: "something else is on top of \(element.title.lowercased()), so i left it.", detail: "element belongs to another app", point: center)
        case .failed:
            return Outcome(ok: false, line: "\(element.title.lowercased()) didn't take a click from me.", detail: "axpress failed", point: center)
        }
    }

    private func nativeInsert(label: String?, text: String, context: ScreenContext) -> Outcome {
        guard !text.isEmpty else { return Outcome(ok: false, line: "", detail: "nothing to type") }
        guard frontIs(context) else { return Outcome(ok: false, line: "the app in front changed, so i didn't type.", detail: "front app changed") }
        if let label, let element = Self.bestElement(label, in: context.elements.filter { ["AXTextField", "AXSearchField", "AXTextArea", "AXComboBox"].contains($0.role) } ) ?? Self.bestElement(label, in: context.elements) {
            _ = Self.focus(atAppKit: CGPoint(x: element.frame.midX, y: element.frame.midY))
        }
        let method = TextInjection.insert(text)
        let ok = method == .accessibility || method == .paste
        return Outcome(ok: ok, line: ok ? "typed it in." : "it's on your clipboard, paste it where you want it.", detail: "insert via \(method.rawValue)")
    }

    private func media(_ move: ActionCommand.Media) -> Outcome {
        let key: Int32 = move == .playPause ? 16 : (move == .next ? 17 : 18)   // NX_KEYTYPE_PLAY, NEXT, PREVIOUS
        for down in [true, false] {
            let flags = NSEvent.ModifierFlags(rawValue: down ? 0xa00 : 0xb00)
            let data1 = Int((key << 16) | ((down ? 0xa : 0xb) << 8))
            let event = NSEvent.otherEvent(with: .systemDefined, location: .zero, modifierFlags: flags, timestamp: 0, windowNumber: 0,
                                           context: nil, subtype: 8, data1: data1, data2: -1)
            event?.cgEvent?.post(tap: .cghidEventTap)
        }
        return Outcome(ok: true, line: ActionCommand.media(move).doneLine, detail: "media key \(move.rawValue)")
    }

    // MARK: Comet through DevTools

    private struct Tab: Decodable { let id: String; let type: String; let title: String; let url: String; let webSocketDebuggerUrl: String? }

    private func tabs() async -> [Tab]? {
        guard let url = URL(string: "http://127.0.0.1:\(port)/json/list") else { return nil }
        var request = URLRequest(url: url, timeoutInterval: 0.8)
        request.httpMethod = "GET"
        guard let (data, _) = try? await URLSession.shared.data(for: request) else { return nil }
        return (try? JSONDecoder().decode([Tab].self, from: data))?.filter { $0.type == "page" }
    }

    private func anyTab() async -> Tab? { await tabs()?.first }

    /// The one tab whose URL is the window's and whose title the window title carries; nil when none or several match.
    private func bindTab(_ context: ScreenContext) async -> Tab? {
        guard let list = await tabs(), !list.isEmpty else { return nil }
        let title = context.windowTitle ?? ""
        func norm(_ u: String) -> String { var s = u; if let hash = s.firstIndex(of: "#") { s = String(s[..<hash]) }; return s.hasSuffix("/") ? String(s.dropLast()) : s }
        var matches = list.filter { !$0.title.isEmpty && title.contains($0.title) }
        // the url decides when Dot knows it: a title alone binds only when the window gave no url
        if let url = context.url { matches = matches.filter { norm($0.url) == norm(url) } }
        if matches.count == 1 { return matches[0] }
        if bench != nil, matches.isEmpty, list.count == 1 { return list[0] }   // the bench Comet holds one tab
        Log.info("act: comet tab binding found \(matches.count) matches; refusing")
        return nil
    }

    /// One DevTools call on a tab. Returns the `result` object.
    private func cdp(_ tab: Tab, _ method: String, _ params: [String: Any]) async -> [String: Any]? {
        guard let socket = tab.webSocketDebuggerUrl, let url = URL(string: socket) else { return nil }
        let task = URLSession.shared.webSocketTask(with: url)
        task.resume()
        defer { task.cancel(with: .goingAway, reason: nil) }
        let id = Int.random(in: 1...1_000_000)
        guard let body = try? JSONSerialization.data(withJSONObject: ["id": id, "method": method, "params": params]),
              let text = String(data: body, encoding: .utf8) else { return nil }
        // A page stuck in an alert or a beforeunload dialog never answers: three seconds, then the socket goes.
        let timeout = Task { try? await Task.sleep(nanoseconds: 3_000_000_000); task.cancel(with: .goingAway, reason: nil) }
        defer { timeout.cancel() }
        do {
            try await task.send(.string(text))
            while true {
                let message = try await task.receive()
                guard case .string(let reply) = message, let data = reply.data(using: .utf8),
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any], (json["id"] as? Int) == id else { continue }
                return json["result"] as? [String: Any] ?? [:]
            }
        } catch {
            Log.warn("act: cdp \(method) failed or timed out: \(error.localizedDescription)")
        }
        return nil
    }

    /// Run one of Dot's own fixed scripts in the page (never model-written code); arguments go in as JSON.
    private func evaluate(_ tab: Tab, _ script: String, _ args: [String: Any] = [:]) async -> Any? {
        guard let data = try? JSONSerialization.data(withJSONObject: args), let json = String(data: data, encoding: .utf8) else { return nil }
        let expression = "(function(args){\(script)})(\(json))"
        let result = await cdp(tab, "Runtime.evaluate", ["expression": expression, "returnByValue": true, "awaitPromise": true])
        return (result?["result"] as? [String: Any])?["value"]
    }

    private func cdpBrowserNewTab(_ url: URL, near tab: Tab) async -> Bool {
        guard var comps = URLComponents(string: "http://127.0.0.1:\(port)/json/new") else { return false }
        comps.percentEncodedQuery = url.absoluteString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        guard let target = comps.url else { return false }
        var request = URLRequest(url: target, timeoutInterval: 1.5)
        request.httpMethod = "PUT"
        return (try? await URLSession.shared.data(for: request)) != nil
    }

    private static let scrollScript = """
    const move = args.move;
    let el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    while (el && el !== document.body && !(el.scrollHeight > el.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    if (!el || el === document.body || el === document.documentElement) el = document.scrollingElement || document.documentElement;
    const before = el.scrollTop;
    if (move === 'down') el.scrollBy({top: el.clientHeight * 0.8, behavior: 'instant'});
    else if (move === 'up') el.scrollBy({top: -el.clientHeight * 0.8, behavior: 'instant'});
    else if (move === 'top') el.scrollTo({top: 0, behavior: 'instant'});
    else if (move === 'bottom') el.scrollTo({top: el.scrollHeight, behavior: 'instant'});
    return {before: before, after: el.scrollTop};
    """

    private static let findScript = """
    const needle = args.text.toLowerCase();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.data.toLowerCase().indexOf(needle);
      if (i < 0) continue;
      const parent = node.parentElement;
      if (!parent || parent.offsetParent === null && getComputedStyle(parent).position !== 'fixed') continue;
      const range = document.createRange();
      range.setStart(node, i); range.setEnd(node, i + needle.length);
      parent.scrollIntoView({block: 'center', behavior: 'instant'});
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      const r = range.getBoundingClientRect();
      return {found: true, x: r.left + r.width / 2, y: r.top + r.height / 2, text: node.data.substr(i, needle.length)};
    }
    return {found: false};
    """

    /// The control a label names: exact, then starts with, then contains; visible ones only.
    private static let locateScript = """
    const want = args.label.toLowerCase().trim();
    const fields = args.fields;
    const sel = fields ? 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true],[role=searchbox],[role=textbox]'
      : 'a,button,summary,label,[role=button],[role=link],[role=tab],[role=menuitem],[role=switch],[role=checkbox],[role=option],input[type=checkbox],input[type=radio],input[type=submit],input[type=button],[onclick]';
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
      const style = getComputedStyle(e); if (style.visibility === 'hidden' || style.display === 'none') continue;
      const n = name(e).toLowerCase(); if (!n) continue;
      let s = n === want ? 3 : n.startsWith(want) ? 2 : n.includes(want) ? 1 : 0;
      if (s && r.top >= 0 && r.bottom <= innerHeight) s += 0.5;
      if (s > bestScore) { best = e; bestScore = s; }
    }
    if (!best) return {found: false};
    best.scrollIntoView({block: 'center', behavior: 'instant'});
    const r = best.getBoundingClientRect();
    if (fields) best.focus();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    const onTop = !!top && (top === best || best.contains(top) || top.contains(best));
    const tag = best.tagName.toLowerCase();
    const type = (best.type || best.getAttribute('type') || '').toLowerCase();
    const submits = !!best.form && (tag === 'button' && type === 'submit' || tag === 'input' && (type === 'submit' || type === 'image'));
    return {found: true, x: cx, y: cy, name: name(best), role: best.getAttribute('role') || '', tag: tag, type: type, submits: submits,
            onTop: onTop, covering: onTop || !top ? '' : (top.innerText || top.getAttribute('aria-label') || top.tagName).slice(0, 60),
            placeholder: best.getAttribute('placeholder') || '', chromeTop: outerHeight - innerHeight, value: fields ? (best.value || best.innerText || '') : ''};
    """

    private func cometScroll(_ move: ActionCommand.Scroll, context: ScreenContext) async -> Outcome? {
        guard let tab = await bindTab(context) else { return nil }
        if case .toText(let text) = move {
            guard let found = await evaluate(tab, Self.findScript, ["text": text]) as? [String: Any] else { return nil }
            if (found["found"] as? Bool) == true { return Outcome(ok: true, line: "here it is.", detail: "cdp find \"\(text)\"") }
            return Outcome(ok: false, line: "i couldn't find \"\(text.lowercased())\" on this page.", detail: "cdp find: none")
        }
        let name: String
        switch move { case .up: name = "up"; case .down: name = "down"; case .top: name = "top"; case .bottom: name = "bottom"; case .toText: name = "down" }
        guard let r = await evaluate(tab, Self.scrollScript, ["move": name]) as? [String: Any] else { return nil }
        let before = (r["before"] as? Double) ?? 0, after = (r["after"] as? Double) ?? 0
        let moved = abs(after - before) > 1 || name == "top" && after == 0
        return Outcome(ok: moved, line: moved ? ActionCommand.scroll(move).doneLine : "this page can't scroll that way.", detail: "cdp scroll \(name) \(Int(before))->\(Int(after))")
    }

    private func cometBrowser(_ move: ActionCommand.Browser, context: ScreenContext) async -> Outcome? {
        guard let tab = await bindTab(context) else { return nil }
        let ok: Bool
        switch move {
        case .back: ok = await evaluate(tab, "history.back(); return true;") != nil
        case .forward: ok = await evaluate(tab, "history.forward(); return true;") != nil
        case .reload: ok = await cdp(tab, "Page.reload", [:]) != nil
        case .newTab: ok = await cdpBrowserNewTab(URL(string: "about:blank")!, near: tab)
        case .closeTab:
            guard let url = URL(string: "http://127.0.0.1:\(port)/json/close/\(tab.id)") else { return nil }
            ok = (try? await URLSession.shared.data(for: URLRequest(url: url, timeoutInterval: 1.5))) != nil
        }
        return Outcome(ok: ok, line: ok ? ActionCommand.browser(move).doneLine : "that didn't work here.", detail: "cdp \(move.rawValue)")
    }

    /// The orb's point for a spot in the page: the window's frame plus the browser's chrome above the page.
    private func screenPoint(x: Double, y: Double, chromeTop: Double, context: ScreenContext) -> CGPoint? {
        guard let frame = context.windowFrame else { return nil }
        return CGPoint(x: frame.minX + x, y: frame.maxY - chromeTop - y)
    }

    private func cometClick(_ label: String, context: ScreenContext) async -> Outcome? {
        guard let tab = await bindTab(context) else { return nil }
        guard let hit = await evaluate(tab, Self.locateScript, ["label": label, "fields": false]) as? [String: Any] else { return nil }
        guard (hit["found"] as? Bool) == true, let x = hit["x"] as? Double, let y = hit["y"] as? Double else {
            return Outcome(ok: false, line: "i don't see \(label.lowercased()) on this page.", detail: "cdp locate: none")
        }
        let name = (hit["name"] as? String) ?? label
        let point = screenPoint(x: x, y: y, chromeTop: (hit["chromeTop"] as? Double) ?? 80, context: context)
        let submits = (hit["submits"] as? Bool) ?? false
        if CommitGuard.isCommit(name) || submits && !name.lowercased().contains("search") {
            return Outcome(ok: false, line: "", detail: "commit control \"\(name)\"", point: point, commitLabel: name)
        }
        if (hit["onTop"] as? Bool) == false {
            let cover = (hit["covering"] as? String) ?? "something"
            return Outcome(ok: false, line: "something is covering \(name.lowercased()) on the page, so i left it.", detail: "covered by \"\(cover)\"", point: point)
        }
        for kind in ["mouseMoved", "mousePressed", "mouseReleased"] {
            var params: [String: Any] = ["type": kind, "x": x, "y": y, "button": "left", "clickCount": 1]
            if kind == "mouseMoved" { params["button"] = "none"; params["clickCount"] = 0 }
            guard await cdp(tab, "Input.dispatchMouseEvent", params) != nil else {
                return Outcome(ok: false, line: "\(name.lowercased()) didn't take a click from me.", detail: "cdp click failed", point: point)
            }
        }
        return Outcome(ok: true, line: "clicked \(name.lowercased()).", detail: "cdp click \"\(name)\" at \(Int(x)),\(Int(y))", point: point)
    }

    private func cometInsert(label: String?, text: String, context: ScreenContext) async -> Outcome? {
        guard !text.isEmpty, let tab = await bindTab(context) else { return nil }
        var point: CGPoint?
        if let label {
            guard let hit = await evaluate(tab, Self.locateScript, ["label": label, "fields": true]) as? [String: Any], (hit["found"] as? Bool) == true else {
                return Outcome(ok: false, line: "i don't see a \(label.lowercased()) field here.", detail: "cdp field: none")
            }
            if let x = hit["x"] as? Double, let y = hit["y"] as? Double { point = screenPoint(x: x, y: y, chromeTop: (hit["chromeTop"] as? Double) ?? 80, context: context) }
        }
        guard await cdp(tab, "Input.insertText", ["text": text]) != nil else { return nil }
        let value = await evaluate(tab, "const e = document.activeElement; return e ? (e.value || e.innerText || '') : '';") as? String ?? ""
        let landed = value.contains(text)
        return Outcome(ok: landed, line: landed ? "typed it in." : "i typed it, but i can't see it in the field.", detail: "cdp insert landed=\(landed)", point: point)
    }

    /// Return in the focused page field, only when it is a search field.
    func cometSubmitSearch(context: ScreenContext) async -> Outcome? {
        guard let tab = await bindTab(context) else { return nil }
        let info = await evaluate(tab, "const e = document.activeElement; return e ? {tag: e.tagName.toLowerCase(), type: (e.getAttribute('type')||'').toLowerCase(), role: e.getAttribute('role')||'', placeholder: e.getAttribute('placeholder')||e.getAttribute('aria-label')||''} : null;") as? [String: Any]
        let role = (info?["type"] as? String) == "search" ? "searchbox" : (info?["role"] as? String)
        guard CommitGuard.returnAllowed(role: role, subrole: nil, placeholder: info?["placeholder"] as? String) else {
            return Outcome(ok: false, line: "return there could send something, so that one's yours.", detail: "cdp return outside search", commitLabel: "return")
        }
        for kind in ["keyDown", "keyUp"] {
            _ = await cdp(tab, "Input.dispatchKeyEvent", ["type": kind, "key": "Enter", "code": "Enter", "windowsVirtualKeyCode": 13, "text": kind == "keyDown" ? "\r" : ""])
        }
        return Outcome(ok: true, line: "searched.", detail: "cdp return in search field")
    }

    // MARK: Bench

    /// A driven press or a [TYPE] in a bench turn: only on the fixture window.
    func benchAllows(_ context: ScreenContext) -> Bool {
        guard let bench else { return true }
        return benchRefusal(.click(label: "bench"), context: context, bench: bench) == nil
    }

    private func benchRefusal(_ command: ActionCommand, context: ScreenContext, bench: Bench) -> String? {
        if bench.cometPort == 9222 { return "comet port 9222 is his browser" }
        let fixtureFront: Bool = {
            let title = (context.windowTitle ?? "").lowercased(), url = context.url ?? ""
            return title.contains("dot bench") || url.hasPrefix("http://127.0.0.1:") || url.hasPrefix("http://localhost:")
        }()
        switch command {
        case .open(let name):
            return ["textedit", "calculator"].contains(name.lowercased()) || name.lowercased().contains("bench") ? nil : "open \(name) outside the bench list"
        case .openPath(let path):
            return (path as NSString).expandingTildeInPath.hasPrefix("/tmp/dot-bench") || path.hasPrefix("/private/tmp/dot-bench") ? nil : "path outside /tmp/dot-bench"
        case .openURL(let url, _):
            return url.hasPrefix("http://127.0.0.1:") || url.hasPrefix("http://localhost:") ? nil : "url outside the fixture"
        case .media: return "media keys reach his music"
        default:
            if context.bundleIdentifier == Self.cometBundle, !fixtureFront { return "comet window is not the bench" }
            let allowedApps: Set<String> = ["com.apple.Safari", Self.cometBundle, "com.apple.TextEdit", "com.apple.finder"]
            if !allowedApps.contains(context.bundleIdentifier ?? "") { return "front app \(context.bundleIdentifier ?? "?") is not a bench app" }
            if ["com.apple.Safari", Self.cometBundle].contains(context.bundleIdentifier ?? ""), !fixtureFront { return "front page is not the fixture" }
            return nil
        }
    }

    // MARK: AX helpers

    static func bestElement(_ label: String, in elements: [AXElementInfo]) -> AXElementInfo? {
        let want = label.lowercased().trimmingCharacters(in: .whitespaces)
        guard !want.isEmpty else { return nil }
        let scored = elements.compactMap { e -> (AXElementInfo, Int)? in
            let t = e.title.lowercased()
            if t == want { return (e, 3) }
            if t.hasPrefix(want) { return (e, 2) }
            if t.contains(want) || (want.contains(t) && t.count >= 3) { return (e, 1) }
            return nil
        }
        return scored.max { $0.1 < $1.1 }?.0
    }

    enum Press: Equatable { case pressed, commit(String), otherApp, failed }

    /// AXPress on the element under an AppKit point (or its nearest pressable ancestor). The cursor stays put.
    /// Every element on the way up is checked against his rule, so an icon inside a Send button can't slip past;
    /// an element of another app than the one in front (a window on top) is never pressed.
    static func press(atAppKit point: CGPoint, frontPid: pid_t?) -> Press {
        guard let element = elementAt(point) else { return .failed }
        var pid: pid_t = 0
        if let frontPid, AXUIElementGetPid(element, &pid) == .success, pid != frontPid { return .otherApp }
        var current: AXUIElement? = element
        for _ in 0..<6 {
            guard let e = current else { break }
            for name in [kAXTitleAttribute, kAXDescriptionAttribute, kAXHelpAttribute, kAXValueAttribute] {
                if let words = string(e, name), CommitGuard.isCommit(words) { return .commit(words) }
            }
            var names: CFArray?
            if AXUIElementCopyActionNames(e, &names) == .success, let list = names as? [String], list.contains(kAXPressAction as String) {
                return AXUIElementPerformAction(e, kAXPressAction as CFString) == .success ? .pressed : .failed
            }
            current = ax(e, kAXParentAttribute)
        }
        return .failed
    }

    static func focus(atAppKit point: CGPoint) -> Bool {
        guard let element = elementAt(point) else { return false }
        return AXUIElementSetAttributeValue(element, kAXFocusedAttribute as CFString, kCFBooleanTrue) == .success
    }

    /// The label of whatever is under a point: the commit check for a ringed step Dot is about to press.
    static func label(atAppKit point: CGPoint) -> String? {
        guard let element = elementAt(point) else { return nil }
        for name in [kAXTitleAttribute, kAXDescriptionAttribute, kAXValueAttribute] {
            if let s = string(element, name), !s.isEmpty { return s }
        }
        return nil
    }

    private static func elementAt(_ point: CGPoint) -> AXUIElement? {
        let primaryHeight = NSScreen.screens.first?.frame.height ?? 0
        var element: AXUIElement?
        let system = AXUIElementCreateSystemWide()
        guard AXUIElementCopyElementAtPosition(system, Float(point.x), Float(primaryHeight - point.y), &element) == .success else { return nil }
        return element
    }

    private func waitFront(_ bundle: String?, seconds: Double) async -> Bool {
        guard let bundle else { return true }
        let deadline = Date().addingTimeInterval(seconds)
        while Date() < deadline {
            if NSWorkspace.shared.frontmostApplication?.bundleIdentifier == bundle { return true }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        return NSWorkspace.shared.frontmostApplication?.bundleIdentifier == bundle
    }

    static func appURL(named name: String) -> URL? {
        let want = name.lowercased().replacingOccurrences(of: ".app", with: "")
        if let running = NSWorkspace.shared.runningApplications.first(where: { ($0.localizedName ?? "").lowercased() == want }), let url = running.bundleURL { return url }
        let dirs = ["/Applications", "/System/Applications", "/System/Applications/Utilities", "/Applications/Utilities",
                    FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Applications").path]
        var loose: URL?
        for dir in dirs {
            guard let names = try? FileManager.default.contentsOfDirectory(atPath: dir) else { continue }
            for file in names where file.hasSuffix(".app") {
                let base = String(file.dropLast(4)).lowercased()
                if base == want { return URL(fileURLWithPath: dir).appendingPathComponent(file) }
                if loose == nil, want.count >= 4, base.hasPrefix(want) || base.replacingOccurrences(of: " ", with: "") == want.replacingOccurrences(of: " ", with: "") {
                    loose = URL(fileURLWithPath: dir).appendingPathComponent(file)
                }
            }
        }
        return loose
    }

    /// A site he bookmarked in Comet, by its title ("canvas", "handshake").
    static func bookmark(named name: String) -> URL? {
        let file = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Comet/Default/Bookmarks")
        guard let data = try? Data(contentsOf: file), let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let roots = json["roots"] as? [String: Any] else { return nil }
        let want = name.lowercased()
        var hits: [(String, String)] = []
        func walk(_ node: Any) {
            guard let dict = node as? [String: Any] else { return }
            if dict["type"] as? String == "url", let title = dict["name"] as? String, let url = dict["url"] as? String { hits.append((title.lowercased(), url)) }
            (dict["children"] as? [Any])?.forEach(walk)
        }
        roots.values.forEach(walk)
        let exact = hits.first { $0.0 == want } ?? (want.count >= 4 ? hits.first { $0.0.hasPrefix(want + " ") || $0.0.hasPrefix(want + " -") || $0.0 == want } : nil)
        return exact.flatMap { URL(string: $0.1) }
    }

    private static func ax(_ element: AXUIElement, _ name: String) -> AXUIElement? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success, let value, CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
        return unsafeBitCast(value, to: AXUIElement.self)
    }

    private static func children(_ element: AXUIElement) -> [AXUIElement]? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &value) == .success else { return nil }
        return value as? [AXUIElement]
    }

    private static func string(_ element: AXUIElement, _ name: String) -> String? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success, let value else { return nil }
        return value as? String
    }

    private static func frame(_ element: AXUIElement) -> CGRect? {
        var p: CFTypeRef?, s: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXPositionAttribute as CFString, &p) == .success,
              AXUIElementCopyAttributeValue(element, kAXSizeAttribute as CFString, &s) == .success, let p, let s else { return nil }
        var point = CGPoint.zero, size = CGSize.zero
        guard AXValueGetValue(unsafeBitCast(p, to: AXValue.self), .cgPoint, &point), AXValueGetValue(unsafeBitCast(s, to: AXValue.self), .cgSize, &size) else { return nil }
        return CGRect(origin: point, size: size)
    }
}
