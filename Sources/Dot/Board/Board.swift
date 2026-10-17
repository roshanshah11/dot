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

    /// Back, next and the dots on a stage: (card id, action "next" | "back" | "step", step).
    var onNav: ((String, String, Int) -> Void)?

    /// What he did to a figure: a point let go, a slider set, a part tapped (CardEvent). Nil by
    /// default; Dot's log gets a one-line summary either way. Cards run model-written JS, so a
    /// receiver may start a talk turn with an event and nothing more: never a tool, never an action.
    var onEvent: ((CardEvent) -> Void)?
    private var eventFilter = CardEventFilter()

    /// Style tokens, read again for every card so an edit to ~/Dot/style/tokens.json shows on the next one.
    private var tokenProblems: [String] = []
    /// The context mode the next card is drawn for (VI-03): desk and study pick their look.
    var mode: String?
    private func tokens() -> StyleTokens {
        let tokens = StyleTokens.load()
        if tokens.problems != tokenProblems {
            tokenProblems = tokens.problems
            for problem in tokens.problems { Log.warn("style: \(problem)") }
        }
        return tokens.applyingPointerAccent(accentHex)
    }

    private func received(_ event: CardEvent) {
        guard eventFilter.admit(event) else { return }
        Log.info("board[\(event.card)] event: \(event.summary)")
        onEvent?(event)
    }

    static func isStageHTML(_ html: String) -> Bool { html.contains("class=\"stage") || html.contains("class='stage") }
    func isStage(_ id: String) -> Bool { cards[id]?.isStage ?? false }
    func shown(of id: String) -> Int { cards[id]?.shown ?? 0 }
    func total(of id: String) -> Int { cards[id]?.total ?? 0 }
    var openStage: String? { order.first { cards[$0]?.isStage == true } }
    func setWaiting(id: String, on: Bool) { cards[id]?.setWaiting(on) }

    /// One line per card for the model's context.
    func stateLines() -> [String] {
        order.compactMap { id -> String? in
            guard let card = cards[id] else { return nil }
            let steps = card.total > 0 ? ", \(card.shown) of \(card.total) steps shown" : ""
            return "card \(id) \"\(card.title)\"\(card.isStage ? " (a stage, one step at a time)" : "")\(steps)"
        }
    }

    func frame(of id: String) -> CGRect? { cards[id]?.frame }

    /// Create or replace a card. `rect` is in AppKit screen coordinates; nil means "find room".
    func show(id: String, title: String, html: String, rect: CGRect?, on screenFrame: CGRect, avoiding window: CGRect?) {
        guard let resources else { return }
        let stage = Self.isStageHTML(html)
        // A stage is opaque and fixed: 720 by 440 points of picture, never a tower of text.
        let size = stage ? CGSize(width: min(720, screenFrame.width * 0.5), height: min(470, screenFrame.height * 0.56))
                         : CGSize(width: rect.map { $0.width > 80 ? $0.width : 440 } ?? 440, height: 120)
        let taken = cards.values.filter { $0.cardID != id }.map(\.frame)
        let origin = (stage ? nil : rect).map { CGPoint(x: $0.minX, y: $0.maxY - size.height) } ?? Self.room(for: size, on: screenFrame, avoiding: window, taken: taken)
        let card = cards[id] ?? CardPanel(id: id, accentHex: accentHex, screenFrame: screenFrame)
        let isNew = cards[id] == nil
        card.onClose = { [weak self] in self?.close(id: id) }
        card.onNav = { [weak self] action, step in self?.onNav?(id, action, step) }
        card.onEvent = { [weak self] event in self?.received(event) }
        card.load(title: title, html: html, resources: resources, tokens: tokens(), mode: mode)
        if stage {
            card.setStageFrame(isNew ? CGRect(origin: origin, size: size) : CGRect(x: card.frame.minX, y: card.frame.maxY - size.height, width: size.width, height: size.height))
        } else if isNew {
            card.setFrameTopLeft(origin: CGPoint(x: origin.x, y: origin.y + size.height), width: size.width)
        } else {
            card.setFrameTopLeft(origin: CGPoint(x: card.frame.minX, y: card.frame.maxY), width: size.width)
        }
        if isNew { cards[id] = card; order.append(id) }
        card.orderFrontRegardless()
        Log.info("board: \(stage ? "stage" : "card") \(id) \"\(title)\" (\(html.count) chars) at \(Int(origin.x)),\(Int(origin.y))")
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
    /// Cards follow the same recordings setting as the orb and the notch.
    static var visibleInRecordings = true { didSet { for panel in all.allObjects { panel.sharingType = visibleInRecordings ? .readOnly : .none } } }
    private static let all = NSHashTable<CardPanel>.weakObjects()
    let cardID: String
    private(set) var title_ = ""
    private(set) var shown = 0
    private(set) var total = 0
    var onClose: (() -> Void)?
    var onNav: ((String, Int) -> Void)?
    var onEvent: ((CardEvent) -> Void)?
    private(set) var isStage = false
    private let relay: CardMessageRelay
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
        relay = CardMessageRelay(cardID: id)
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
        sharingType = Self.visibleInRecordings ? .readOnly : .none
        Self.all.add(self)

        container.wantsLayer = true
        container.layer?.backgroundColor = Self.color(StyleTokens.defaults.look("study").background, alpha: 0.95).cgColor
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
        relay.onNav = { [weak self] action, step in self?.onNav?(action, step) }
        // A live web page shares the handler; only Dot's own card pages may report figure events.
        relay.onEvent = { [weak self] event in
            guard let self, !self.isWeb else { return }
            self.onEvent?(event)
        }
    }

    static func color(_ c: StyleTokens.RGBA, alpha: Double? = nil) -> NSColor {
        NSColor(calibratedRed: CGFloat(c.red), green: CGFloat(c.green), blue: CGFloat(c.blue), alpha: CGFloat(alpha ?? c.alpha))
    }

    private var closeButton: NSButton?

    /// A stage takes the arrow keys once clicked; other cards never take the keyboard.
    override var canBecomeKey: Bool { isStage }
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

    /// The page is board.html with the tokens filled in (StyleTokens.cardPage); the frame around it
    /// (ground, border, strip, title) wears the same look, desk when the card holds a finance piece.
    func load(title: String, html: String, resources: URL, tokens: StyleTokens, mode: String? = nil) {
        self.title = title
        isWeb = false
        isStage = BoardManager.isStageHTML(html)
        loaded = false
        shown = 0
        total = 0
        guard let template = try? String(contentsOf: resources.appendingPathComponent("board.html"), encoding: .utf8) else { return }
        let (page, lookName) = tokens.cardPage(template: template, content: html, mode: mode)
        let look = tokens.look(lookName)
        container.layer?.backgroundColor = Self.color(look.background, alpha: isStage ? look.stageAlpha : look.backgroundAlpha).cgColor
        container.layer?.borderColor = Self.color(look.border).cgColor
        strip.layer?.backgroundColor = Self.color(look.glass, alpha: 0.04).cgColor
        titleLabel.textColor = Self.color(look.accent)
        let file = resources.appendingPathComponent("card-\(cardID).html")
        do {
            try page.write(to: file, atomically: true, encoding: .utf8)
            web.loadFileURL(file, allowingReadAccessTo: resources)
        } catch {
            Log.warn("board: could not write the card page: \(error)")
            web.loadHTMLString(page, baseURL: resources)
        }
    }

    /// A stage has one fixed frame; nothing is measured.
    func setStageFrame(_ rect: CGRect) {
        setFrame(rect, display: true)
        layoutViews()
    }

    func setWaiting(_ on: Bool) {
        guard loaded else { return }
        web.evaluateJavaScript("window.board && window.board.setWaiting && window.board.setWaiting(\(on))") { _, _ in }
    }

    /// Place the card by its top-left corner and width; the height follows the content.
    func setFrameTopLeft(origin: CGPoint, width: CGFloat) {
        let height = max(frame.height, 120)
        setFrame(CGRect(x: origin.x, y: origin.y - height, width: width, height: height), display: true)
        layoutViews()
    }

    /// A link in a card opens outside (Maps, a browser): the card itself never navigates away.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if !isWeb, navigationAction.navigationType == .linkActivated, let url = navigationAction.request.url, url.scheme != "file" {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if isWeb {
            loaded = true
            NSAnimationContext.runAnimationGroup { context in context.duration = 0.25; animator().alphaValue = 1 }
            return
        }
        loaded = true
        if isStage {
            NSAnimationContext.runAnimationGroup { ctx in ctx.duration = 0.25; self.animator().alphaValue = 1 }
            web.evaluateJavaScript("window.board ? window.board.stepCount() : 0") { [weak self] value, _ in
                guard let self else { return }
                self.total = (value as? Int) ?? 0
                if let (step, completion) = self.pendingReveal {
                    self.pendingReveal = nil
                    self.reveal(step, completion: completion)
                }
            }
            return
        }
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
                if self.isStage {
                    self.stepRect(step, scrollIfNeeded: false, completion: completion)
                    return
                }
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

/// Errors and console output from a card into Dot's log, so a broken drawing is visible; the
/// stage's back, next and dots, which arrive as {type: "nav", action, step}; and figure events,
/// {type: "event", kind, data, card}, from board.js's dot.report.
final class CardMessageRelay: NSObject, WKScriptMessageHandler {
    let cardID: String
    var onNav: ((String, Int) -> Void)?
    var onEvent: ((CardEvent) -> Void)?
    init(cardID: String) { self.cardID = cardID }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if let object = message.body as? [String: Any], object["type"] as? String == "event" {
            // A figure he moved. The page is model-written JS with file access, so this is words for
            // a talk turn at most (board.onEvent): it can never start a tool, an agent or an action.
            guard let event = CardEvent.parse(object, card: cardID) else {
                Log.warn("board[\(cardID)] unreadable event \(Log.short("\(object)", 200))")
                return
            }
            DispatchQueue.main.async { [weak self] in self?.onEvent?(event) }
            return
        }
        if let object = message.body as? [String: Any], object["type"] as? String == "nav", let action = object["action"] as? String {
            let step = (object["step"] as? Int) ?? Int((object["step"] as? Double) ?? 0)
            Log.info("board[\(cardID)] nav \(action)\(step > 0 ? " \(step)" : "")")
            DispatchQueue.main.async { [weak self] in self?.onNav?(action, step) }
            return
        }
        Log.warn("board[\(cardID)] \(Log.short("\(message.body)", 300))")
    }
}
