import AppKit
import DotKit
import MapKit
import PDFKit
import SwiftUI
import WebKit

/// `Dot --snapshot [folder]`: every surface Dot draws, rendered to PNG without a screen turn, so
/// the visuals can be judged and tuned from files (and shown to him as one contact sheet). The
/// notch in each state, the orb and its marks, the cards on the board. Nothing here touches the
/// running app.
@MainActor
enum Snapshots {
    static func run(into folder: URL, only group: String? = nil) {
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        func wanted(_ name: String) -> Bool { group == nil || group == name }
        let accent = DotConfig.load().pointerColorHex
        var sheet: [(String, NSImage)] = []
        func keep(_ name: String, _ image: NSImage?) {
            guard let image, let data = png(image) else { print("snapshot: \(name) failed"); return }
            let url = folder.appendingPathComponent("\(name).png")
            try? data.write(to: url)
            print("snapshot: \(url.path)")
            sheet.append((name, image))
        }

        if wanted("notch") {
            for (name, model) in notchStates(accentHex: accent) {
                keep("notch-\(name)", render(NotchHUDView(model: model, geometry: geometry, onClose: {}), width: NotchGeometry.panelWidth, height: NotchHUD.tallPanelHeight))
            }
        }
        if wanted("overlay") {
            for (name, model) in overlayStates(accentHex: accent) {
                keep("overlay-\(name)", render(CompanionView(model: model), width: 640, height: 400, trim: false, ground: NSColor(calibratedWhite: 0.96, alpha: 1)))
            }
        }
        if wanted("cards") {
            for (name, title, html) in cards(accentHex: accent) {
                keep("card-\(name)", renderCard(title: title, html: html, accentHex: accent))
            }
        }
        if let composite = contactSheet(sheet), let data = png(composite) {
            let url = folder.appendingPathComponent("sheet.png")
            try? data.write(to: url)
            print("snapshot: \(url.path)")
        }
    }

    private static var geometry: NotchGeometry {
        NotchGeometry(centerX: NotchGeometry.panelWidth / 2, topY: NotchHUD.tallPanelHeight, notchWidth: 200, notchHeight: 32, hasNotch: true)
    }

    // MARK: The notch

    private static func notchStates(accentHex: String) -> [(String, HUDModel)] {
        func make(_ build: (HUDModel) -> Void) -> HUDModel {
            let m = HUDModel()
            if let color = Color(hex: accentHex) { m.accent = color }
            m.presence = true
            build(m)
            return m
        }
        let agentRunning = AgentRow(id: "research-buddy", name: "Research Buddy", line: "reading bridgewater's last month of filings", state: .running,
                                    steps: ["searched: bridgewater news october 2026", "read: reuters.com/markets/...", "writing the brief"], canStop: true, startedAt: Date().addingTimeInterval(-83))
        let agentDone = AgentRow(id: "research-buddy", name: "Research Buddy", line: "done: a one-page brief, saved as a pdf", state: .done,
                                 result: "Bridgewater's October: the Pure Alpha fund was reported up about 9% for the year through September; Nir Bar Dea said the firm is expanding its AI strategies; the brief has four dated items with sources.",
                                 outputCount: 1, outputs: [URL(fileURLWithPath: "/Users/roshanshah/Dot/agents/research-buddy/output/bridgewater_news_brief.pdf")],
                                 nextActions: ["Add a section on their CEO", "Compare with Citadel's year", "Turn it into a one-pager"], startedAt: Date().addingTimeInterval(-176))
        return [
            ("idle", make { _ in }),
            ("idle-hover", make { m in m.hovering = true; m.todayLine = "next: ugе interview in 42 min · 8 on the calendar today · 48 mail waiting"
                m.peekFiles = [URL(fileURLWithPath: "/tmp/bridgewater_news_brief.pdf"), URL(fileURLWithPath: "/tmp/comps.xlsx"), URL(fileURLWithPath: "/tmp/notes.md")] }),
            ("idle-recording", make { m in m.recordingLine = "recording 1:23" }),
            ("listening", make { m in m.phase = .listening; m.level = 0.55; m.transcript = "where does it explain the discount rate" }),
            ("thinking", make { m in m.phase = .thinking; m.transcript = "where does it explain the discount rate" }),
            ("thinking-deeper", make { m in m.phase = .thinking; m.deeper = true; m.transcript = "walk me through how a dcf treats the terminal value" }),
            ("speaking", make { m in m.phase = .speaking; m.transcript = "where does it explain the discount rate"
                m.caption = "it's in the mathematics section, right under the formula: the discount rate is the cost of capital, so a riskier project gets a higher one." }),
            ("typed-answer", make { m in m.answer = "the discount rate is the return you would need to be paid to wait: the cost of capital. it shows up as r in the denominator, so every future cash flow is divided by (1 plus r) to the power of the year.\n\nhigher r, smaller present value. a riskier project earns a higher r, which is why the same cash flows are worth less when they are less sure."
                m.answerQuestion = "what's the discount rate for" }),
            ("input", make { m in m.showInput = true; m.todayLine = "next: ugе interview in 42 min · 8 on the calendar today" }),
            ("notice-clipboard", make { m in m.notices = [NotchNotice(id: "murmur", icon: "doc.on.clipboard", title: "murmur put it on your clipboard", detail: "no field to type into; press command v where it should go", tone: .info, seconds: 0)] }),
            ("notice-muted", make { m in m.notices = [NotchNotice(id: "muted", icon: "speaker.slash.fill", title: "your sound is off, so the answer is here as text", tone: .warn, actionTitle: "turn sound on", action: {}, seconds: 0)] }),
            ("notice-meeting", make { m in m.notices = [NotchNotice(id: "meeting", icon: "calendar", title: "call: alex morgan (blackrock) in 8 min", detail: "12:30 to 12:45, (555) 010-0199", tone: .info, actionTitle: "brief me", action: {}, secondaryTitle: "dismiss", secondary: {}, seconds: 0)] }),
            ("notice-dictionary", make { m in m.notices = [NotchNotice(id: "dictionary", icon: "character.book.closed", title: "learned: jev", detail: "the recognizer writes it that way from now on", tone: .good, actionTitle: "undo", action: {}, seconds: 0)]; m.glow = true }),
            ("morning", make { m in m.morning = MorningCard(greeting: "morning. i can do 4 things for you today.", items: []) }),
            ("morning-open", make { m in m.morningExpanded = true; m.morning = MorningCard(greeting: "morning. i can do 4 things for you today.", items: [
                MorningCard.Item(id: "a", text: "prep raymond james sophomore showcase application, due today", brief: ""),
                MorningCard.Item(id: "b", text: "a one-page brief on alex morgan (blackrock) before 12:30", brief: ""),
                MorningCard.Item(id: "c", text: "draft a reply to prof: re: seminar schedule", brief: ""),
                MorningCard.Item(id: "d", text: "do: reply to emily parker (lmr partners) with availability", brief: "")]) }),
            ("agent-working", make { m in m.agents = [agentRunning] }),
            ("agent-done", make { m in m.agents = [agentDone]; m.glow = true }),
            ("agent-open", make { m in m.agents = [agentDone]; m.expanded = "research-buddy" }),
            ("consent", make { m in m.consent = ConsentCard(agent: "mail buddy", title: "send an email to emily parker", detail: "outlook send: \"Re: Summer 2028 internship, availability\"", onAllow: {}, onDeny: {}) }),
            // Round seven: two more questions wait behind the one on show; the asking agents' rows say "needs you".
            ("consent-queued", make { m in
                m.consent = ConsentCard(agentId: "email", agent: "Email", title: "use atlas: calendar delete", detail: "outward: delete the 4 pm hold on friday", guarded: true,
                                        onAllow: {}, onDeny: {}, onAlways: {})
                m.consentWaiting = 2
                m.agents = [AgentRow(id: "email", name: "Email", line: "waiting for you: outward: delete the 4 pm hold on friday", state: .waiting, startedAt: Date().addingTimeInterval(-64)),
                            AgentRow(id: "physics", name: "Physics", line: "waiting for you: run a command", state: .waiting, startedAt: Date().addingTimeInterval(-30))]
            }),
            // Round seven: a turn a restart cut short, with the way back in.
            ("agent-interrupted", make { m in
                m.agents = [AgentRow(id: "dot", name: "Dot", line: "interrupted when Dot closed", state: .failed,
                                     result: "Dot closed while Dot was working on: go through my gmail and trash the marketing mail\n\nIts conversation is saved; continue picks it up where it stopped.",
                                     nextActions: ["continue where you left off"])]
                m.expanded = "dot"
            }),
            ("walkthrough", make { m in m.agents = [AgentRow(id: "walkthrough", name: "walkthrough", line: "step 3: click schedule", state: .running, kind: .walkthrough, steps: ["clicked displays", "clicked night shift"], canStop: true, startedAt: Date().addingTimeInterval(-40))] }),
        ]
    }

    // MARK: The overlay

    private static func overlayStates(accentHex: String) -> [(String, CompanionModel)] {
        func make(_ build: (CompanionModel) -> Void) -> CompanionModel {
            let m = CompanionModel(screenSize: CGSize(width: 640, height: 400))
            if let color = Color(hex: accentHex) { m.color = color }
            m.visible = true
            m.position = CGPoint(x: 320, y: 200)
            build(m)
            return m
        }
        return [
            ("orb-idle", make { _ in }),
            ("orb-listening", make { m in m.phase = .listening; m.level = 0.5 }),
            ("orb-thinking", make { m in m.phase = .thinking }),
            ("orb-speaking-happy", make { m in m.phase = .speaking; m.mood = .happy }),
            ("orb-puzzled", make { m in m.mood = .puzzled }),
            ("point", make { m in m.motion = .parked; m.position = CGPoint(x: 360, y: 230); m.chip = "discount rate"; m.tailTo = CGPoint(x: 300, y: 180) }),
            ("highlight", make { m in m.motion = .parked; m.position = CGPoint(x: 470, y: 150); m.highlight = CGRect(x: 120, y: 140, width: 330, height: 90); m.highlightLabel = "the formula" }),
            ("target", make { m in m.motion = .parked; m.position = CGPoint(x: 380, y: 250); m.ring = Ring(center: CGPoint(x: 300, y: 200), radius: 28, label: "night shift") }),
            ("hover-target", make { m in m.motion = .parked; m.position = CGPoint(x: 380, y: 250); m.ring = Ring(center: CGPoint(x: 300, y: 200), radius: 28, label: "schedule menu", hover: true) }),
            ("arrow", make { m in m.motion = .parked; m.position = CGPoint(x: 470, y: 260); var mark = ShapeMark(kind: .arrow, points: [CGPoint(x: 150, y: 120), CGPoint(x: 420, y: 240)], label: "drag it here"); mark.progress = 1; m.shapes = [mark] }),
            ("circle", make { m in m.motion = .parked; m.position = CGPoint(x: 430, y: 240); var mark = ShapeMark(kind: .circle, points: [CGPoint(x: 300, y: 200), CGPoint(x: 370, y: 200)], label: "this term"); mark.progress = 1; m.shapes = [mark] }),
            ("strokes", make { m in m.strokes = [[CGPoint(x: 150, y: 150), CGPoint(x: 260, y: 140), CGPoint(x: 330, y: 170), CGPoint(x: 310, y: 240), CGPoint(x: 200, y: 250), CGPoint(x: 145, y: 200), CGPoint(x: 152, y: 152)]]; m.stroke = [CGPoint(x: 400, y: 160), CGPoint(x: 500, y: 165), CGPoint(x: 560, y: 160)] }),
            ("bubble", make { m in m.bubbleVisible = true; m.bubbleText = "morning. 9 deadlines this week, first u-ship by tonight. 48 mail waiting." }),
        ]
    }

    // MARK: Cards

    private static func cards(accentHex: String) -> [(String, String, String)] {
        var out: [(String, String, String)] = []
        let stock = Quotes.Quote(symbol: "NVDA", name: "NVIDIA Corporation", price: 216.09, previousClose: 221.3, currency: "USD",
                                 closes: [198.2, 201.4, 199.8, 204.1, 207.6, 206.2, 210.9, 214.4, 212.8, 217.5, 220.1, 219.4, 223.8, 225.2, 221.3, 216.09], asOf: Date())
        out.append(("stock", "NVIDIA Corporation (NVDA)", Quotes.cardHTML(stock)))
        let sample = Places.Place(name: "Plein Air Cafe", category: "cafe", address: "5751 S Woodlawn Ave, Chicago, IL", phone: "(773) 966-7531", url: nil, latitude: 41.7906, longitude: -87.5967, distanceMeters: 640)
        let second = Places.Place(name: "Hyde Park Hub", category: "coffee", address: "1508 E 53rd St, Chicago, IL", phone: nil, url: nil, latitude: 41.7996, longitude: -87.5876, distanceMeters: 1100)
        let third = Places.Place(name: "Medici on 57th", category: "restaurant", address: "1327 E 57th St, Chicago, IL", phone: "(773) 667-7394", url: nil, latitude: 41.7913, longitude: -87.5932, distanceMeters: 450)
        let group = DispatchGroup()
        var mapPNG: Data?
        group.enter()
        Task { @MainActor in
            mapPNG = await Places.snapshot(of: [third, sample, second], center: CLLocationCoordinate2D(latitude: 41.7943, longitude: -87.5907), accentHex: accentHex)
            group.leave()
        }
        wait(for: group, seconds: 12)
        out.append(("place", "coffee near campus", Places.cardHTML(query: "coffee near campus", places: [third, sample, second], mapPNG: mapPNG, nearName: "hyde park")))
        var pictures: [Images.Item] = []
        group.enter()
        Task { @MainActor in
            pictures = await Images.search("Artemis II launch", count: 6)
            group.leave()
        }
        wait(for: group, seconds: 12)
        if !pictures.isEmpty { out.append(("images", "pictures: artemis ii launch", Images.cardHTML(query: "artemis ii launch", items: pictures))) }
        out.append(("lesson", "completing the square", """
        <h2>x² + 6x + 5 = 0</h2>
        <section class="step shown"><p>move the constant: <span class="rule">step 1</span></p><p>$$x^2 + 6x = -5$$</p><p class="why">half of 6 is 3, and 3² is 9: that is what completes the square.</p></section>
        <section class="step shown current"><p>add 9 to both sides: <span class="rule">step 2</span></p><p>$$(x+3)^2 = 4$$</p></section>
        <section class="step"><p>$$x = -1 \\text{ or } x = -5$$</p></section>
        <div class="callout good">check: (-1)² + 6(-1) + 5 = 0</div>
        """))
        return out
    }

    private static func wait(for group: DispatchGroup, seconds: Double) {
        let deadline = Date().addingTimeInterval(seconds)
        while group.wait(timeout: .now()) == .timedOut, Date() < deadline { spin(0.05) }
    }

    /// A card as the board draws it: the same page, resources and accent, 440 wide, as tall as it needs.
    private static func renderCard(title: String, html: String, accentHex: String) -> NSImage? {
        let candidates = [Bundle.main.resourceURL?.appendingPathComponent("board"), URL(fileURLWithPath: DotConfig.expand("~/Projects/dot/Resources/board"))].compactMap { $0 }
        guard let resources = candidates.first(where: { FileManager.default.fileExists(atPath: $0.appendingPathComponent("board.html").path) }),
              var page = try? String(contentsOf: resources.appendingPathComponent("board.html"), encoding: .utf8) else { return nil }
        // The same tokens the board uses (VI-01), so a snapshot shows the look a card really gets.
        page = StyleTokens.load().applyingPointerAccent(accentHex).cardPage(template: page, content: html).html
        let file = resources.appendingPathComponent("card-snapshot.html")
        try? page.write(to: file, atomically: true, encoding: .utf8)
        let configuration = WKWebViewConfiguration()
        configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        // Forty points tall to start, so the page's scroll height is the content's, not the viewport's.
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 440, height: 40), configuration: configuration)
        web.setValue(false, forKey: "drawsBackground")
        // WebKit paints only into a window that is on a display and not covered, so this one floats
        // above everything at zero alpha: invisible, untouchable, out of recordings, and rendering.
        let screen = NSScreen.main?.frame ?? CGRect(x: 0, y: 0, width: 1440, height: 900)
        let window = NSWindow(contentRect: CGRect(x: screen.maxX - 460, y: screen.minY + 20, width: 440, height: 40), styleMask: .borderless, backing: .buffered, defer: false)
        window.isOpaque = false
        window.backgroundColor = .clear
        window.alphaValue = 0.02   // zero reads as hidden and stops the paint
        window.level = .floating
        window.ignoresMouseEvents = true
        window.sharingType = .none
        window.collectionBehavior = [.stationary, .ignoresCycle, .canJoinAllSpaces, .fullScreenAuxiliary]
        window.contentView = web
        window.orderFrontRegardless()
        spin(0.3)
        if !window.occlusionState.contains(.visible) {
            // Still counted as hidden (a fullscreen Space, or the alpha): show two points of it at full alpha at the screen's edge.
            window.alphaValue = 1
            window.setFrameOrigin(CGPoint(x: screen.maxX - 2, y: screen.minY + 20))
            spin(0.3)
        }
        if !window.occlusionState.contains(.visible) { print("snapshot: the card window never became visible; cards may come out blank") }
        let delegate = LoadWatcher()
        web.navigationDelegate = delegate
        web.loadFileURL(file, allowingReadAccessTo: resources)
        let deadline = Date().addingTimeInterval(12)
        while !delegate.done, Date() < deadline { spin(0.05) }
        // Fonts, math and pictures settle a moment after load.
        spin(html.contains("gallery") ? 3.5 : 2.2)   // the entrance animation runs half a second; pictures longer
        var height: CGFloat = 300
        var measured = false
        web.evaluateJavaScript("document.documentElement.scrollHeight") { value, _ in height = CGFloat((value as? Double) ?? 300); measured = true }
        let measureDeadline = Date().addingTimeInterval(3)
        while !measured, Date() < measureDeadline { spin(0.05) }
        height = min(max(height, 90), 700)
        window.setContentSize(CGSize(width: 440, height: height))
        web.frame = CGRect(x: 0, y: 0, width: 440, height: height)
        spin(0.6)
        // A PDF of the page, rasterised at 2x: the web process draws it whether or not the view is on screen.
        var pdf: Data?
        var done = false
        web.createPDF(configuration: WKPDFConfiguration()) { result in pdf = try? result.get(); done = true }
        let pdfDeadline = Date().addingTimeInterval(8)
        while !done, Date() < pdfDeadline { spin(0.05) }
        window.orderOut(nil)
        guard let pdf, let document = PDFDocument(data: pdf), let page = document.page(at: 0) else { print("snapshot: no pdf for \(title)"); return nil }
        // PDFKit's thumbnail paints a white page under the transparent content; draw the page ourselves instead.
        let box = page.bounds(for: .mediaBox)
        let shot = NSImage(size: CGSize(width: 440, height: height), flipped: false) { rect in
            guard let context = NSGraphicsContext.current?.cgContext else { return false }
            context.saveGState()
            context.scaleBy(x: rect.width / max(box.width, 1), y: rect.height / max(box.height, 1))
            page.draw(with: .mediaBox, to: context)
            context.restoreGState()
            return true
        }
        // Draw it the way the board does: on the dark card with its title strip and rounded corners.
        let strip: CGFloat = 30
        let size = CGSize(width: 440, height: height + strip)
        let image = NSImage(size: size, flipped: true) { rect in
            let path = NSBezierPath(roundedRect: rect, xRadius: 14, yRadius: 14)
            NSColor(calibratedRed: 0.05, green: 0.047, blue: 0.043, alpha: 0.97).setFill()
            path.fill()
            NSColor.white.withAlphaComponent(0.04).setFill()
            CGRect(x: 0, y: 0, width: size.width, height: strip).fill()
            let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 12, weight: .semibold), .foregroundColor: NSColor(hex: accentHex) ?? .orange]
            (title as NSString).draw(at: CGPoint(x: 14, y: 8), withAttributes: attributes)
            NSGraphicsContext.current?.saveGraphicsState()
            path.addClip()
            shot.draw(in: CGRect(x: 0, y: strip, width: size.width, height: height), from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
            NSGraphicsContext.current?.restoreGraphicsState()
            NSColor.white.withAlphaComponent(0.12).setStroke()
            path.lineWidth = 1
            path.stroke()
            return true
        }
        return image
    }

    /// Run the loop for a while, pumping AppKit's event queue as well: the window server's word that a
    /// window is on screen arrives as an event, and WebKit paints nothing until it has heard it.
    private static func spin(_ seconds: Double) {
        let until = Date().addingTimeInterval(seconds)
        while Date() < until {
            while let event = NSApp.nextEvent(matching: .any, until: Date(timeIntervalSinceNow: 0.02), inMode: .default, dequeue: true) {
                NSApp.sendEvent(event)
            }
            RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.03))
        }
    }

    private final class LoadWatcher: NSObject, WKNavigationDelegate {
        var done = false
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { done = true }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { done = true }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { done = true }
    }

    // MARK: Rendering

    /// A SwiftUI view to an image at 2x, trimmed to its content on a given ground.
    private static func render<V: View>(_ view: V, width: CGFloat, height: CGFloat, trim: Bool = true, ground: NSColor = NSColor(calibratedWhite: 0.93, alpha: 1)) -> NSImage? {
        let renderer = ImageRenderer(content: view.frame(width: width, height: height))
        renderer.scale = 2
        guard let rendered = renderer.nsImage else { return nil }
        let content = trim ? contentRect(of: rendered) : CGRect(origin: .zero, size: rendered.size)
        let padded = content.insetBy(dx: -8, dy: -8)
        let image = NSImage(size: padded.size, flipped: false) { rect in
            ground.setFill()
            rect.fill()
            rendered.draw(in: rect, from: padded, operation: .sourceOver, fraction: 1)
            return true
        }
        return image
    }

    /// The bounds of the opaque pixels (the HUD sits at the top of a tall, empty frame).
    private static func contentRect(of image: NSImage) -> CGRect {
        guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) else { return CGRect(origin: .zero, size: image.size) }
        let w = rep.pixelsWide, h = rep.pixelsHigh
        var minX = w, minY = h, maxX = 0, maxY = 0
        for y in stride(from: 0, to: h, by: 2) {
            for x in stride(from: 0, to: w, by: 2) where (rep.colorAt(x: x, y: y)?.alphaComponent ?? 0) > 0.05 {
                minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
            }
        }
        guard maxX > minX, maxY > minY else { return CGRect(origin: .zero, size: image.size) }
        let scale = image.size.width / CGFloat(w)
        // Bitmap rows count from the top; NSImage rects from the bottom.
        return CGRect(x: CGFloat(minX) * scale, y: image.size.height - CGFloat(maxY + 2) * scale, width: CGFloat(maxX - minX + 2) * scale, height: CGFloat(maxY - minY + 2) * scale)
    }

    private static func png(_ image: NSImage) -> Data? {
        guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) else { return nil }
        return rep.representation(using: .png, properties: [:])
    }

    /// Every snapshot on one page, three to a row, each with its name.
    private static func contactSheet(_ items: [(String, NSImage)]) -> NSImage? {
        guard !items.isEmpty else { return nil }
        let columns = 3
        let cell = CGSize(width: 480, height: 360)
        let rows = (items.count + columns - 1) / columns
        let size = CGSize(width: cell.width * CGFloat(columns), height: cell.height * CGFloat(rows))
        return NSImage(size: size, flipped: true) { _ in
            NSColor(calibratedWhite: 0.9, alpha: 1).setFill()
            CGRect(origin: .zero, size: size).fill()
            for (index, (name, image)) in items.enumerated() {
                let origin = CGPoint(x: CGFloat(index % columns) * cell.width, y: CGFloat(index / columns) * cell.height)
                let box = CGRect(x: origin.x + 12, y: origin.y + 30, width: cell.width - 24, height: cell.height - 42)
                let scale = min(box.width / image.size.width, box.height / image.size.height, 1)
                let drawn = CGSize(width: image.size.width * scale, height: image.size.height * scale)
                image.draw(in: CGRect(x: box.minX, y: box.minY, width: drawn.width, height: drawn.height), from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
                let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 13, weight: .semibold), .foregroundColor: NSColor(calibratedWhite: 0.2, alpha: 1)]
                (name as NSString).draw(at: CGPoint(x: origin.x + 12, y: origin.y + 8), withAttributes: attributes)
            }
            return true
        }
    }
}
