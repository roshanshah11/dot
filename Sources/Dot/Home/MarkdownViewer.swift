import AppKit
import UniformTypeIdentifiers
import WebKit

/// A reading window for long Markdown, after HeyClicky's markdown viewer: agent reports and
/// the long answers that are cramped in a chat bubble get a page with real tables, typeset
/// math and code blocks. It renders offline from the bundled board resources (marked and
/// KaTeX) and follows the system appearance.
@MainActor
enum MarkdownViewer {
    /// One window per document, so showing the same one again refreshes it in place instead
    /// of stacking copies.
    private static var windows: [String: MarkdownWindow] = [:]
    private static var cascade = NSPoint.zero

    /// The installed app's board first; a bundle built before the reader existed has no
    /// marked.min.js, so the source checkout is the fallback, as it is for the board.
    fileprivate static let resources: URL? = {
        let candidates = [Bundle.main.resourceURL?.appendingPathComponent("board"),
                          URL(fileURLWithPath: DotConfig.expand("~/Projects/dot/Resources/board"))].compactMap { $0 }
        let found = candidates.first { FileManager.default.fileExists(atPath: $0.appendingPathComponent("vendor/marked.min.js").path) }
        if found == nil { Log.warn("markdown: marked.min.js not found; the reader shows plain text") }
        return found
    }()

    /// Text has no file of its own, so the caller names the document by its title: the same
    /// title and base folder land in the same window.
    static func show(text: String, title: String, baseURL: URL?) {
        let base = baseURL?.standardizedFileURL
        present(key: "text:\(base?.path ?? ""):\(title)", text: text, fallbackTitle: title, baseURL: base, file: nil)
    }

    static func show(file: URL) {
        let file = file.standardizedFileURL
        guard let text = read(file) else {
            Log.warn("markdown: could not read \(file.path); handing it to its app")
            NSWorkspace.shared.open(file)
            return
        }
        present(key: "file:\(file.path)", text: text, fallbackTitle: file.lastPathComponent, baseURL: file.deletingLastPathComponent(), file: file)
    }

    /// Today's conversation with Dot (TranscriptLog's day file), newest at the bottom (10-21: Control+Command+T, Dot's
    /// menu, or "show the transcript"). `toggle`: the shortcut closes it again when it is the window in front.
    static func showTranscript(toggle: Bool = false) {
        let file = TranscriptLog.today.standardizedFileURL
        let key = "file:\(file.path)"
        if toggle, let window = windows[key], window.isVisible, window.isKeyWindow {
            window.performClose(nil)
            return
        }
        guard FileManager.default.fileExists(atPath: file.path) else {
            show(text: "# Today with Dot\n\nnothing said to Dot yet today.", title: "Today with Dot", baseURL: nil)
            return
        }
        show(file: file)
        windows[key]?.scrollToEnd()
    }

    static func isMarkdown(_ url: URL) -> Bool {
        ["md", "markdown", "mdown", "mkd"].contains(url.pathExtension.lowercased())
    }

    private static func present(key: String, text: String, fallbackTitle: String, baseURL: URL?, file: URL?) {
        let window: MarkdownWindow
        if let existing = windows[key] {
            window = existing
        } else {
            window = MarkdownWindow()
            window.onClose = {
                windows[key] = nil
                if windows.isEmpty { cascade = .zero }
            }
            window.center()
            cascade = window.cascadeTopLeft(from: cascade)
            windows[key] = window
        }
        window.show(text: text, title: firstHeading(in: text) ?? fallbackTitle, baseURL: baseURL, file: file)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private static func read(_ file: URL) -> String? {
        if let text = try? String(contentsOf: file, encoding: .utf8) { return text }
        var encoding = String.Encoding.utf8
        return try? String(contentsOf: file, usedEncoding: &encoding)
    }

    /// The document's own name: the first H1 outside front matter and code fences, in either
    /// the "# Title" or the underlined form.
    static func firstHeading(in text: String) -> String? {
        let lines = text.components(separatedBy: .newlines)
        var index = 0
        if lines.first?.trimmingCharacters(in: .whitespaces) == "---",
           let end = lines.dropFirst().firstIndex(where: { $0.trimmingCharacters(in: .whitespaces) == "---" }) {
            index = end + 1
        }
        var fence: Character?
        var previous = ""
        while index < lines.count {
            let line = lines[index].trimmingCharacters(in: .whitespaces)
            index += 1
            if let marker = line.first, marker == "`" || marker == "~", line.hasPrefix(String(repeating: marker, count: 3)) {
                if fence == nil { fence = marker } else if fence == marker { fence = nil }
                previous = ""
                continue
            }
            if fence != nil { continue }
            if line.hasPrefix("# ") {
                var title = String(line.dropFirst(2))
                while title.hasSuffix("#") { title.removeLast() }
                return plain(title)
            }
            if !line.isEmpty, line.allSatisfy({ $0 == "=" }), !previous.isEmpty { return plain(previous) }
            previous = line
        }
        return nil
    }

    private static func plain(_ markdown: String) -> String? {
        let text = (try? AttributedString(markdown: markdown)).map { String($0.characters) } ?? markdown
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? nil : trimmed
    }
}

@MainActor
private final class MarkdownWindow: NSWindow, WKNavigationDelegate {
    var onClose: (() -> Void)?
    private let web: WKWebView
    private let handler: MarkdownSchemeHandler
    private let pathLabel = NSTextField(labelWithString: "")
    private let copyButton = NSButton()
    private let editButton = NSButton()
    private let revealButton = NSButton()
    private var markdown = ""
    private var file: URL?
    private var loaded = false

    /// Matches the page's own background so nothing flashes white before the first paint.
    private static let paper = NSColor(name: nil) { appearance in
        appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? NSColor(srgbRed: 0.118, green: 0.118, blue: 0.118, alpha: 1) : .white
    }

    init() {
        let handler = MarkdownSchemeHandler()
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(handler, forURLScheme: MarkdownSchemeHandler.scheme)
        self.handler = handler
        web = WKWebView(frame: .zero, configuration: configuration)
        let height = min((NSScreen.main?.visibleFrame.height ?? 900) * 0.85, 1000)
        super.init(contentRect: NSRect(x: 0, y: 0, width: 880, height: height), styleMask: [.titled, .closable, .miniaturizable, .resizable],
                   backing: .buffered, defer: false)
        isReleasedWhenClosed = false
        minSize = NSSize(width: 420, height: 320)
        backgroundColor = Self.paper
        web.navigationDelegate = self
        web.setValue(false, forKey: "drawsBackground")
        web.underPageBackgroundColor = Self.paper

        configure(copyButton, title: "copy", symbol: "doc.on.doc", action: #selector(copyMarkdown))
        configure(editButton, title: "open in editor", symbol: "square.and.pencil", action: #selector(openInEditor))
        configure(revealButton, title: "reveal", symbol: "folder", action: #selector(reveal))
        pathLabel.font = .systemFont(ofSize: 11)
        pathLabel.textColor = .secondaryLabelColor
        pathLabel.lineBreakMode = .byTruncatingMiddle
        pathLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        let root = NSView()
        let strip = NSView()
        let rule = NSBox()
        rule.boxType = .separator
        let buttons = NSStackView(views: [copyButton, editButton, revealButton])
        buttons.spacing = 2
        for view in [strip, rule, web, pathLabel, buttons] as [NSView] { view.translatesAutoresizingMaskIntoConstraints = false }
        root.addSubview(strip)
        root.addSubview(rule)
        root.addSubview(web)
        strip.addSubview(pathLabel)
        strip.addSubview(buttons)
        contentView = root
        NSLayoutConstraint.activate([
            strip.topAnchor.constraint(equalTo: root.topAnchor),
            strip.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            strip.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            strip.heightAnchor.constraint(equalToConstant: 34),
            rule.topAnchor.constraint(equalTo: strip.bottomAnchor),
            rule.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            rule.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            rule.heightAnchor.constraint(equalToConstant: 1),
            web.topAnchor.constraint(equalTo: rule.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            web.bottomAnchor.constraint(equalTo: root.bottomAnchor),
            pathLabel.leadingAnchor.constraint(equalTo: strip.leadingAnchor, constant: 14),
            pathLabel.centerYAnchor.constraint(equalTo: strip.centerYAnchor),
            pathLabel.trailingAnchor.constraint(lessThanOrEqualTo: buttons.leadingAnchor, constant: -10),
            buttons.trailingAnchor.constraint(equalTo: strip.trailingAnchor, constant: -10),
            buttons.centerYAnchor.constraint(equalTo: strip.centerYAnchor),
        ])
    }

    private func configure(_ button: NSButton, title: String, symbol: String, action: Selector) {
        button.title = title
        button.image = NSImage(systemSymbolName: symbol, accessibilityDescription: title)?.withSymbolConfiguration(.init(pointSize: 11, weight: .regular))
        button.imagePosition = .imageLeading
        button.bezelStyle = .accessoryBarAction
        button.controlSize = .small
        button.font = .systemFont(ofSize: 11.5)
        button.target = self
        button.action = action
    }

    func show(text: String, title: String, baseURL: URL?, file: URL?) {
        markdown = text
        self.file = file
        self.title = title
        pathLabel.stringValue = file.map { $0.path.replacingOccurrences(of: NSHomeDirectory(), with: "~") } ?? ""
        editButton.isHidden = file == nil
        revealButton.isHidden = file == nil
        let base = baseURL?.path ?? MarkdownViewer.resources?.path ?? NSHomeDirectory()
        let pagePath = (base as NSString).appendingPathComponent("__dot_reader__.html")
        // A refresh of a page already showing re-renders in place, which keeps the scroll position.
        if loaded, pagePath == handler.pagePath {
            web.evaluateJavaScript("window.dotRender(\(MarkdownPage.json(text)))") { _, error in
                if let error { Log.warn("markdown: re-render failed: \(error.localizedDescription)") }
            }
            return
        }
        handler.pagePath = pagePath
        handler.roots = [base, MarkdownViewer.resources?.path].compactMap { $0 }.map { ($0 as NSString).standardizingPath }
        handler.page = Data(MarkdownPage.html(markdown: text, resources: MarkdownViewer.resources).utf8)
        loaded = false
        web.load(URLRequest(url: MarkdownSchemeHandler.url(for: pagePath)))
    }

    @objc private func copyMarkdown() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(markdown, forType: .string)
        copyButton.title = "copied"
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in self?.copyButton.title = "copy" }
    }

    @objc private func openInEditor() {
        if let file { NSWorkspace.shared.open(file) }
    }

    @objc private func reveal() {
        if let file { NSWorkspace.shared.activateFileViewerSelecting([file]) }
    }

    /// Dot runs without a menu bar, so the usual window keys would otherwise do nothing here.
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        guard event.modifierFlags.intersection(.deviceIndependentFlagsMask) == .command, let key = event.charactersIgnoringModifiers else {
            return super.performKeyEquivalent(with: event)
        }
        switch key {
        case "w": performClose(nil); return true
        case "c": return NSApp.sendAction(#selector(NSText.copy(_:)), to: web, from: self)
        case "a": return NSApp.sendAction(#selector(NSText.selectAll(_:)), to: web, from: self)
        default: return super.performKeyEquivalent(with: event)
        }
    }

    override func close() {
        super.close()
        onClose?()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded = true
        if endOnLoad { endOnLoad = false; scrollToEnd() }
    }

    /// The newest part in view (the transcript): now if the page is up, else once it loads. A re-render queued before
    /// this runs first, so the scroll lands on the new text.
    private var endOnLoad = false
    func scrollToEnd() {
        guard loaded else { endOnLoad = true; return }
        web.evaluateJavaScript("window.scrollTo(0, document.documentElement.scrollHeight)") { _, _ in }
    }

    /// Escape closes the reader, as it closes Dot's other surfaces.
    override func cancelOperation(_ sender: Any?) {
        performClose(nil)
    }

    /// The reader never navigates away from the document: web links go to the browser,
    /// another Markdown file opens in its own reader, any other local file opens in its app.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
        guard navigationAction.navigationType == .linkActivated, let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        let local: URL? = url.scheme == MarkdownSchemeHandler.scheme ? URL(fileURLWithPath: url.path) : (url.isFileURL ? url : nil)
        if local?.path == handler.pagePath {
            decisionHandler(.allow)
            return
        }
        decisionHandler(.cancel)
        if let local {
            if MarkdownViewer.isMarkdown(local) { MarkdownViewer.show(file: local) } else { NSWorkspace.shared.open(local) }
        } else {
            NSWorkspace.shared.open(url)
        }
    }
}

/// Serves the page and everything it references from disk. A custom scheme rather than a
/// file URL because WebKit grants a file page read access to one folder only, and the page
/// needs both the bundled scripts and the images beside the document. URL paths are absolute
/// file paths, so "../figure.png" and absolute image paths written by agents both resolve.
@MainActor
private final class MarkdownSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "dotmd"
    var pagePath = ""
    var page = Data()
    /// Folders the page may read from: the document's own folder and the bundled resources.
    /// Agent-written Markdown can name any path in an image tag; nothing outside these is served.
    var roots: [String] = []

    static func url(for path: String) -> URL {
        var components = URLComponents()
        components.scheme = scheme
        components.host = "doc"
        components.path = path
        return components.url ?? URL(string: "\(scheme)://doc/")!
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        let path = url.path
        let standardized = (path as NSString).standardizingPath
        let allowed = path == pagePath || roots.contains { root in standardized == root || standardized.hasPrefix(root.hasSuffix("/") ? root : root + "/") }
        let data = !allowed ? nil : (path == pagePath ? page : try? Data(contentsOf: URL(fileURLWithPath: path)))
        let status = data == nil ? (allowed ? 404 : 403) : 200
        let headers = ["Content-Type": path == pagePath ? "text/html; charset=utf-8" : Self.mimeType(url.pathExtension),
                       "Content-Length": String(data?.count ?? 0)]
        if let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) {
            urlSchemeTask.didReceive(response)
        }
        if let data { urlSchemeTask.didReceive(data) }
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private static func mimeType(_ ext: String) -> String {
        switch ext.lowercased() {
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "woff2": return "font/woff2"
        case "svg": return "image/svg+xml"
        default: return UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}

@MainActor
private enum MarkdownPage {
    /// The source rides in the page as JSON. Escaping "<" means nothing in it can close or
    /// reopen the script element that holds it.
    static func json(_ text: String) -> String {
        let data = (try? JSONEncoder().encode(text)) ?? Data("\"\"".utf8)
        return String(decoding: data, as: UTF8.self).replacingOccurrences(of: "<", with: "\\u003c")
    }

    static func html(markdown: String, resources: URL?) -> String {
        let nonce = UUID().uuidString.replacingOccurrences(of: "-", with: "")
        func asset(_ path: String) -> String {
            guard let resources else { return "" }
            return MarkdownSchemeHandler.url(for: resources.appendingPathComponent(path).path).absoluteString
        }
        let scripts = resources == nil ? "" : #"""
        <link rel="stylesheet" href="\#(asset("katex/katex.min.css"))">
        <script src="\#(asset("vendor/marked.min.js"))"></script>
        <script src="\#(asset("katex/katex.min.js"))"></script>
        """#
        // Agent-written Markdown may carry raw html; only the bundled scripts and this page's
        // own nonce may run, so an onerror attribute in a document stays inert.
        let policy = "default-src 'none'; script-src dotmd: 'nonce-\(nonce)'; style-src dotmd: 'unsafe-inline'; "
            + "font-src dotmd: data:; img-src dotmd: data: https: http:; media-src dotmd: https: http:"
        return #"""
        <!doctype html>
        <html>
        <head>
        <meta charset="utf-8">
        <meta name="color-scheme" content="light dark">
        <meta http-equiv="Content-Security-Policy" content="\#(policy)">
        \#(scripts)
        <style>
        :root {
          --fg: #1f2328; --muted: #59636e; --bg: #ffffff; --line: #d1d9e0; --soft: #f6f8fa;
          --code: rgba(129, 139, 152, 0.15); --link: #c4501b; --select: rgba(255, 107, 43, 0.25);
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --fg: #e3e3e3; --muted: #9a9a9a; --bg: #1e1e1e; --line: #3b3b3b; --soft: #262626;
            --code: rgba(255, 255, 255, 0.09); --link: #ff8a50; --select: rgba(255, 107, 43, 0.35);
          }
        }
        html { background: var(--bg); }
        body {
          margin: 0; background: var(--bg); color: var(--fg);
          font: 15px/1.65 -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        ::selection { background: var(--select); }
        #doc { max-width: 760px; margin: 0 auto; padding: 40px 56px 96px; overflow-wrap: break-word; }
        #doc > :first-child { margin-top: 0; }
        h1, h2, h3, h4, h5, h6 { line-height: 1.25; font-weight: 600; margin: 1.6em 0 0.6em; }
        h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid var(--line); }
        h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--line); }
        h3 { font-size: 1.25em; }
        h4 { font-size: 1em; }
        h5 { font-size: 0.9em; }
        h6 { font-size: 0.85em; color: var(--muted); }
        p, ul, ol, blockquote, table, pre, details, .math { margin: 0 0 1em; }
        ul, ol { padding-left: 1.8em; }
        li + li { margin-top: 0.25em; }
        li > ul, li > ol { margin: 0.25em 0 0; }
        li:has(> input[type=checkbox]) { list-style: none; }
        input[type=checkbox] { margin: 0 0.45em 0 -1.35em; vertical-align: middle; }
        a { color: var(--link); text-decoration: none; }
        a:hover { text-decoration: underline; }
        blockquote { margin-left: 0; padding: 0 1em; color: var(--muted); border-left: 0.25em solid var(--line); }
        hr { height: 1px; border: 0; background: var(--line); margin: 1.8em 0; }
        code, pre, kbd { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 13px; }
        code { background: var(--code); padding: 0.15em 0.4em; border-radius: 5px; }
        pre { background: var(--soft); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; overflow-x: auto; line-height: 1.5; }
        pre code { background: none; padding: 0; border-radius: 0; font-size: inherit; }
        table { border-collapse: collapse; display: block; width: max-content; max-width: 100%; overflow-x: auto; font-variant-numeric: tabular-nums; }
        th, td { border: 1px solid var(--line); padding: 6px 13px; }
        th { font-weight: 600; background: var(--soft); }
        tr:nth-child(2n) td { background: var(--soft); }
        img { max-width: 100%; border-radius: 4px; }
        .math, .katex-display { overflow-x: auto; overflow-y: hidden; }
        .katex { font-size: 1.1em; }
        </style>
        </head>
        <body>
        <article id="doc"></article>
        <script type="application/json" id="source">\#(json(markdown))</script>
        <script nonce="\#(nonce)">
        (function () {
          const doc = document.getElementById('doc');
          const escape = s => s.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
          const tex = (src, display) => window.katex
            ? katex.renderToString(src, {displayMode: display, throwOnError: false})
            : escape(src);
          // Math is taken out before marked reads the line, so the underscores and backslashes
          // inside it reach KaTeX intact instead of turning into emphasis and escapes.
          const blockRules = [/^ {0,3}\$\$([\s\S]+?)\$\$[ \t]*(?:\n+|$)/, /^ {0,3}\\\[([\s\S]+?)\\\][ \t]*(?:\n+|$)/];
          const matchBlock = src => { for (const re of blockRules) { const m = re.exec(src); if (m) return m; } return null; };
          const inlineRules = [
            [/^\$\$([\s\S]+?)\$\$/, true],
            [/^\\\[([\s\S]+?)\\\]/, true],
            [/^\\\(([\s\S]+?)\\\)/, false],
            // A lone $ needs a non-space just inside each end, no digit after it and no backtick inside,
            // so "$5 and $10" stays prices and a code span after a price stays code.
            [/^\$(?![\s$])((?:\\[\s\S]|[^\\$\n`])+?)(?<!\s)\$(?!\d)/, false],
          ];
          if (window.marked) {
            marked.use({gfm: true, extensions: [
              {
                name: 'blockMath', level: 'block',
                start(src) {
                  const re = /^ {0,3}(?:\$\$|\\\[)/gm;
                  let m;
                  while ((m = re.exec(src))) { if (matchBlock(src.slice(m.index))) return m.index; }
                },
                tokenizer(src) {
                  const m = matchBlock(src);
                  if (m) return {type: 'blockMath', raw: m[0], text: m[1].trim()};
                },
                renderer(token) { return '<div class="math">' + tex(token.text, true) + '</div>\n'; },
              },
              {
                name: 'inlineMath', level: 'inline',
                start(src) { const i = src.search(/\$|\\[(\[]/); return i < 0 ? undefined : i; },
                tokenizer(src) {
                  for (const [re, display] of inlineRules) {
                    const m = re.exec(src);
                    if (m) return {type: 'inlineMath', raw: m[0], text: m[1].trim(), display};
                  }
                },
                renderer(token) { return tex(token.text, token.display); },
              },
            ]});
          }
          const frontMatter = /^---\r?\n[\w-]+:[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;
          const slug = text => text.toLowerCase().trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-') || 'section';
          window.dotRender = function (source) {
            const text = source.replace(frontMatter, '');
            if (window.marked) {
              doc.innerHTML = marked.parse(text);
            } else {
              const pre = document.createElement('pre');
              pre.textContent = text;
              doc.replaceChildren(pre);
            }
            // marked leaves headings without ids; GitHub-style ids keep a table of contents working.
            const seen = {};
            doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
              const base = slug(h.textContent);
              seen[base] = (seen[base] ?? -1) + 1;
              h.id = seen[base] ? base + '-' + seen[base] : base;
            });
            // The page lives on its own scheme, so file:// images are routed back through it.
            doc.querySelectorAll('img[src^="file://"]').forEach(img => {
              try { img.src = 'dotmd://doc' + new URL(img.getAttribute('src')).pathname; } catch (e) {}
            });
          };
          window.dotRender(JSON.parse(document.getElementById('source').textContent));
        })();
        </script>
        </body>
        </html>
        """#
    }
}
