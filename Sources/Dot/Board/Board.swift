import AppKit
import DotKit
import WebKit

/// The board: cards Dot puts over the screen to teach from. Each card is its own small
/// floating panel (so clicks on it land, and clicks beside it fall through), filled with the
/// model's html: typeset math (KaTeX, bundled), step blocks revealed one at a time, plots,
/// number lines, tables, hand-drawn svg diagrams. Nothing is fetched; everything renders
/// from the app bundle.
@MainActor
final class BoardManager {
    private var cards: [String: CardPanel] = [:]
    private var order: [String] = []
    private let accentHex: String
    private let resources: URL?

    init(accentHex: String) {
        self.accentHex = accentHex
        let candidates = [Bundle.main.resourceURL?.appendingPathComponent("board"),
                          URL(fileURLWithPath: DotConfig.expand("~/Projects/dot/Resources/board"))].compactMap { $0 }
        resources = candidates.first { FileManager.default.fileExists(atPath: $0.appendingPathComponent("board.html").path) }
        if resources == nil { Log.warn("board: resources not found; cards are off") }
    }

    var isEmpty: Bool { cards.isEmpty }
    var available: Bool { resources != nil }

    /// Cards with steps still hidden: "next" by voice goes to them.
    var hasHiddenSteps: Bool { cards.values.contains { $0.shown < $0.total } }

    /// One line per card for the model's context.
    func stateLines() -> [String] {
        order.compactMap { id -> String? in
            guard let card = cards[id] else { return nil }
            let steps = card.total > 0 ? ", \(card.shown) of \(card.total) steps shown" : ""
            return "card \(id) \"\(card.title)\"\(steps)"
        }
    }

    func frame(of id: String) -> CGRect? { cards[id]?.frame }

    /// Create or replace a card. `rect` is in AppKit screen coordinates; nil means "find room".
    func show(id: String, title: String, html: String, rect: CGRect?, on screenFrame: CGRect, avoiding window: CGRect?) {
        guard let resources else { return }
        let size = CGSize(width: rect.map { $0.width > 80 ? $0.width : 440 } ?? 440, height: 120)
        let origin = rect.map { CGPoint(x: $0.minX, y: $0.maxY - size.height) } ?? Self.room(for: size, on: screenFrame, avoiding: window, taken: cards.values.map(\.frame))
        if let existing = cards[id] {
            existing.load(title: title, html: html, resources: resources, accent: accentHex)
            existing.setFrameTopLeft(origin: CGPoint(x: existing.frame.minX, y: existing.frame.maxY), width: size.width)
            return
        }
        let card = CardPanel(id: id, accentHex: accentHex, screenFrame: screenFrame)
        card.onClose = { [weak self] in self?.close(id: id) }
        card.load(title: title, html: html, resources: resources, accent: accentHex)
        card.setFrameTopLeft(origin: CGPoint(x: origin.x, y: origin.y + size.height), width: size.width)
        cards[id] = card
        order.append(id)
        card.orderFrontRegardless()
        Log.info("board: card \(id) \"\(title)\" (\(html.count) chars) at \(Int(origin.x)),\(Int(origin.y))")
    }

    /// A live page in a card: the one card type that loads from the network.
    func showWeb(id: String, url: URL, title: String, on screenFrame: CGRect, avoiding window: CGRect?) {
        let size = CGSize(width: min(760, screenFrame.width * 0.46), height: min(560, screenFrame.height * 0.62))
        let origin = Self.room(for: size, on: screenFrame, avoiding: window, taken: cards.values.filter { $0.cardID != id }.map(\.frame))
        let card = cards[id] ?? CardPanel(id: id, accentHex: accentHex, screenFrame: screenFrame)
        card.onClose = { [weak self] in self?.close(id: id) }
        card.load(url: url, title: title.isEmpty ? (url.host ?? "page") : title)
        card.setWebFrame(CGRect(x: origin.x, y: origin.y, width: size.width, height: size.height))
        if cards[id] == nil { cards[id] = card; order.append(id) }
        card.orderFrontRegardless()
        Log.info("board: web card \(id) \(url.absoluteString)")
    }

    /// Reveal step n of a card; the completion gets the step's screen rect (AppKit) once laid out.
    func reveal(id: String, step: Int, completion: @escaping (CGRect?) -> Void) {
        guard let card = cards[id] ?? cards.values.first else { completion(nil); return }
        card.reveal(step, completion: completion)
    }

    func close(id: String) {
        guard let card = cards.removeValue(forKey: id) else { return }
        order.removeAll { $0 == id }
        card.fadeOut()
    }

    func clear() {
        for (_, card) in cards { card.fadeOut() }
        cards = [:]
        order = []
    }

    /// A free spot: beside the frontmost window when there is room, else the screen's right edge.
    static func room(for size: CGSize, on screen: CGRect, avoiding window: CGRect?, taken: [CGRect]) -> CGPoint {
        let margin: CGFloat = 16
        let top = screen.maxY - 56
        var candidates: [CGPoint] = []
        if let window {
            if screen.maxX - window.maxX >= size.width + margin * 2 { candidates.append(CGPoint(x: window.maxX + margin, y: top - size.height)) }
            if window.minX - screen.minX >= size.width + margin * 2 { candidates.append(CGPoint(x: window.minX - margin - size.width, y: top - size.height)) }
        }
        candidates.append(CGPoint(x: screen.maxX - size.width - margin * 1.5, y: top - size.height))
        candidates.append(CGPoint(x: screen.minX + margin * 1.5, y: top - size.height))
        for var point in candidates {
            // Stack below cards already there.
            var tries = 0
            while taken.contains(where: { $0.intersects(CGRect(origin: point, size: size).insetBy(dx: 4, dy: 4)) }), tries < 6 {
                let lowest = taken.filter { $0.minX < point.x + size.width && $0.maxX > point.x }.map(\.minY).min() ?? point.y
                point.y = lowest - margin - size.height
                tries += 1
            }
            if point.y >= screen.minY + margin { return point }
        }
        return candidates[0]
    }
}

/// One card: a title strip with a close button over a transparent web view, draggable by its strip.
final class CardPanel: NSPanel, WKNavigationDelegate {
    let cardID: String
    private(set) var title_ = ""
    private(set) var shown = 0
    private(set) var total = 0
    var onClose: (() -> Void)?
    private let web: WKWebView
    private let strip = NSView()
    private let titleLabel = NSTextField(labelWithString: "")
    private let container = NSView()
    private let screenFrame: CGRect
    private let stripHeight: CGFloat = 30
    private var pendingReveal: (Int, (CGRect?) -> Void)?
    private var loaded = false

    override var title: String { get { title_ } set { title_ = newValue; titleLabel.stringValue = newValue } }

    init(id: String, accentHex: String, screenFrame: CGRect) {
        cardID = id
        self.screenFrame = screenFrame
        let configuration = WKWebViewConfiguration()
        configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        let relay = CardMessageRelay(cardID: id)
        configuration.userContentController.add(relay, name: "dot")
        web = WKWebView(frame: .zero, configuration: configuration)
        super.init(contentRect: CGRect(x: 0, y: 0, width: 440, height: 160), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        isFloatingPanel = true
        level = .screenSaver
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        isMovableByWindowBackground = true
        hidesOnDeactivate = false
        isReleasedWhenClosed = false
        alphaValue = 0

        container.wantsLayer = true
        container.layer?.backgroundColor = NSColor(calibratedRed: 0.05, green: 0.047, blue: 0.043, alpha: 0.95).cgColor
        container.layer?.cornerRadius = 14
        container.layer?.masksToBounds = true
        container.layer?.borderWidth = 1
        container.layer?.borderColor = NSColor.white.withAlphaComponent(0.12).cgColor
        contentView = container

        strip.wantsLayer = true
        strip.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.04).cgColor
        container.addSubview(strip)
        titleLabel.font = .systemFont(ofSize: 12, weight: .semibold)
        titleLabel.textColor = NSColor(hex: accentHex) ?? NSColor.orange
        titleLabel.lineBreakMode = .byTruncatingTail
        strip.addSubview(titleLabel)
        let close = NSButton(title: "", target: self, action: #selector(closeTapped))
        close.bezelStyle = .inline
        close.isBordered = false
        close.image = NSImage(systemSymbolName: "xmark", accessibilityDescription: "close")?.withSymbolConfiguration(.init(pointSize: 10, weight: .bold))
        close.contentTintColor = NSColor.white.withAlphaComponent(0.55)
        close.frame = CGRect(x: 0, y: 0, width: 24, height: 24)
        close.autoresizingMask = [.minXMargin]
        strip.addSubview(close)
        closeButton = close

        web.setValue(false, forKey: "drawsBackground")
        if #available(macOS 12.0, *) { web.underPageBackgroundColor = .clear }
        web.navigationDelegate = self
        container.addSubview(web)
        layoutViews()
    }

    private var closeButton: NSButton?

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }

    @objc private func closeTapped() { onClose?() }

    private func layoutViews() {
        let bounds = container.bounds
        strip.frame = CGRect(x: 0, y: bounds.height - stripHeight, width: bounds.width, height: stripHeight)
        titleLabel.frame = CGRect(x: 14, y: 7, width: bounds.width - 52, height: 16)
        closeButton?.frame = CGRect(x: bounds.width - 30, y: 3, width: 24, height: 24)
        web.frame = CGRect(x: 0, y: 0, width: bounds.width, height: bounds.height - stripHeight)
    }

    private(set) var isWeb = false

    func load(url: URL, title: String) {
        self.title = title
        isWeb = true
        loaded = false
        shown = 0
        total = 0
        web.load(URLRequest(url: url))
    }

    func setWebFrame(_ rect: CGRect) {
        setFrame(rect, display: true)
        layoutViews()
    }

    func load(title: String, html: String, resources: URL, accent: String) {
        self.title = title
        isWeb = false
        loaded = false
        shown = 0
        total = 0
        guard var page = try? String(contentsOf: resources.appendingPathComponent("board.html"), encoding: .utf8) else { return }
        page = page.replacingOccurrences(of: "{{ACCENT}}", with: accent).replacingOccurrences(of: "{{CONTENT}}", with: html)
        let file = resources.appendingPathComponent("card-\(cardID).html")
        do {
            try page.write(to: file, atomically: true, encoding: .utf8)
            web.loadFileURL(file, allowingReadAccessTo: resources)
        } catch {
            Log.warn("board: could not write the card page: \(error)")
            web.loadHTMLString(page, baseURL: resources)
        }
    }

    /// Place the card by its top-left corner and width; the height follows the content.
    func setFrameTopLeft(origin: CGPoint, width: CGFloat) {
        let height = max(frame.height, 120)
        setFrame(CGRect(x: origin.x, y: origin.y - height, width: width, height: height), display: true)
        layoutViews()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if isWeb {
            loaded = true
            NSAnimationContext.runAnimationGroup { context in context.duration = 0.25; animator().alphaValue = 1 }
            return
        }
        loaded = true
        // Fonts and typesetting settle a moment after load; measure again then.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in self?.fitToContent {} }
        fitToContent { [weak self] in
            guard let self else { return }
            NSAnimationContext.runAnimationGroup { ctx in ctx.duration = 0.25; self.animator().alphaValue = 1 }
            self.web.evaluateJavaScript("window.board ? window.board.stepCount() : 0") { value, _ in
                self.total = (value as? Int) ?? 0
            }
            if let (step, completion) = self.pendingReveal {
                self.pendingReveal = nil
                self.reveal(step, completion: completion)
            }
        }
    }

    private func fitToContent(_ then: @escaping () -> Void) {
        web.evaluateJavaScript("document.documentElement.scrollHeight") { [weak self] value, _ in
            guard let self else { return }
            let content = CGFloat((value as? Double) ?? 160) + self.stripHeight + 2
            let maxHeight = self.screenFrame.height * 0.78
            let height = min(max(content, 90), maxHeight)
            let top = self.frame.maxY
            var newFrame = CGRect(x: self.frame.minX, y: top - height, width: self.frame.width, height: height)
            if newFrame.minY < self.screenFrame.minY + 12 { newFrame.origin.y = self.screenFrame.minY + 12 }
            self.setFrame(newFrame, display: true)
            self.layoutViews()
            then()
        }
    }

    func reveal(_ step: Int, completion: @escaping (CGRect?) -> Void) {
        guard loaded else { pendingReveal = (step, completion); return }
        web.evaluateJavaScript("window.board ? window.board.reveal(\(step)) : null") { [weak self] value, _ in
            guard let self else { completion(nil); return }
            if let text = value as? String, let data = text.data(using: .utf8),
               let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                self.shown = object["shown"] as? Int ?? self.shown
                self.total = object["total"] as? Int ?? self.total
            }
            // The step unfolds over a third of a second; measure after, grow the card, then find the step.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.42) { [weak self] in
                guard let self else { completion(nil); return }
                self.fitToContent {
                    self.stepRect(step, scrollIfNeeded: true, completion: completion)
                }
            }
        }
    }

    /// The step's rect in AppKit screen coordinates; scrolls the card when the step sits below the fold.
    private func stepRect(_ step: Int, scrollIfNeeded: Bool, completion: @escaping (CGRect?) -> Void) {
        web.evaluateJavaScript("window.board ? window.board.stepRect(\(step)) : null") { [weak self] value, _ in
            guard let self, let text = value as? String, let data = text.data(using: .utf8),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let x = object["x"] as? Double, let y = object["y"] as? Double, let w = object["w"] as? Double, let h = object["h"] as? Double else {
                completion(nil); return
            }
            let viewHeight = object["viewH"] as? Double ?? Double(self.web.frame.height)
            if scrollIfNeeded, y + h > viewHeight + 2 || y < 0 {
                self.web.evaluateJavaScript("document.body.classList.add('scrolls'); window.board.scrollToStep(\(step))") { _, _ in
                    self.stepRect(step, scrollIfNeeded: false, completion: completion)
                }
                return
            }
            let webTop = self.frame.maxY - self.stripHeight
            completion(CGRect(x: self.frame.minX + x, y: webTop - y - h, width: w, height: h))
        }
    }

    func fadeOut() {
        NSAnimationContext.runAnimationGroup({ ctx in ctx.duration = 0.2; self.animator().alphaValue = 0 }, completionHandler: { self.orderOut(nil) })
    }
}

extension NSColor {
    convenience init?(hex: String) {
        var text = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.hasPrefix("#") { text.removeFirst() }
        guard text.count == 6, let value = UInt32(text, radix: 16) else { return nil }
        self.init(calibratedRed: CGFloat((value >> 16) & 0xFF) / 255, green: CGFloat((value >> 8) & 0xFF) / 255, blue: CGFloat(value & 0xFF) / 255, alpha: 1)
    }
}

/// Errors and console output from a card, into Dot's log, so a broken drawing is visible.
final class CardMessageRelay: NSObject, WKScriptMessageHandler {
    let cardID: String
    init(cardID: String) { self.cardID = cardID }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        Log.warn("board[\(cardID)] \(Log.short("\(message.body)", 300))")
    }
}
