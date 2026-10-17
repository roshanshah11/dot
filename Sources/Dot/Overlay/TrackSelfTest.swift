import AppKit
import ApplicationServices
import ScreenCaptureKit
import Vision

/// `Dot --track-selftest` (round eight): the box-stays-on-the-content check on the real screen, run inside Dot.app
/// because the Accessibility and Screen Recording grants are Dot's. Two scenarios:
/// - Safari with a long local page: the highlight anchors to the paragraph's accessibility element; the truth is the
///   element's own frame, read again after every scroll step.
/// - Preview with a generated PDF: no usable element, so the highlight rides on the window's pixels; the truth is
///   where Vision's text recognition finds the marked line afterwards (independent of the tracker's registration).
/// Each scenario scrolls a little (drift while scrolling and at rest), far enough that the mark leaves the window
/// (it must hide, and the ring must leave a chevron), and back (it must return on the line).
/// Real scroll events are posted and the pointer moves, so it runs only while he is away. Results go to
/// ~/Dot/selftests/track-<stamp>.json and dot.log.
@MainActor
enum TrackSelfTest {
    struct Scenario: Codable {
        var name: String
        var anchor: String?
        var driftDuring: [Double] = []
        var driftRest: [Double] = []
        var hiddenOffscreen: Bool?
        var chevronOffscreen: Bool?
        var restored: Bool?
        var driftRestored: Double?
        var moved: Double = 0
        var note: String = ""
    }

    static var folder: URL { URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Dot/selftests", isDirectory: true) }

    static func run(overlay: OverlayManager) async {
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let idle = min(CGEventSource.secondsSinceLastEventType(.hidSystemState, eventType: .mouseMoved),
                       CGEventSource.secondsSinceLastEventType(.hidSystemState, eventType: .keyDown))
        // it moves the pointer and scrolls: never while he is using the Mac (a run's own events count as input, so wait a minute between runs)
        guard idle >= 60 else { Log.warn("track-selftest: he used the Mac \(Int(idle)) s ago; not running"); return }
        Log.info("track-selftest: starting (idle \(Int(idle)) s)")
        let pointer = NSEvent.mouseLocation
        MarkTracker.dumpFolder = folder
        defer { MarkTracker.dumpFolder = nil }
        var results: [Scenario] = []
        results.append(await safari(overlay: overlay))
        results.append(await preview(overlay: overlay))
        overlay.clearMarks()
        // put the pointer back where it was
        if let primary = NSScreen.screens.first?.frame.height { CGWarpMouseCursorPosition(CGPoint(x: pointer.x, y: primary - pointer.y)) }
        let stamp: String = { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd-HHmm"; return f.string(from: Date()) }()
        let url = folder.appendingPathComponent("track-\(stamp).json")
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try? encoder.encode(results).write(to: url)
        for r in results {
            Log.info("track-selftest: \(r.name) anchor \(r.anchor ?? "?") moved \(Int(r.moved)) pt; drift during max \(fmt(r.driftDuring.max())), at rest \(r.driftRest.map { fmt($0) }.joined(separator: ",")); offscreen hidden \(r.hiddenOffscreen.map { "\($0)" } ?? "?") chevron \(r.chevronOffscreen.map { "\($0)" } ?? "?"); back \(r.restored.map { "\($0)" } ?? "?") drift \(fmt(r.driftRestored)) \(r.note)")
        }
        Log.info("track-selftest: wrote \(url.path)")
    }

    private static func fmt(_ x: Double?) -> String { x.map { String(format: "%.1f", $0) } ?? "-" }

    // MARK: Scenario A: an accessibility element (Safari)

    private static func safari(overlay: OverlayManager) async -> Scenario {
        var s = Scenario(name: "safari-element")
        let page = folder.appendingPathComponent("track-page.html")
        let paragraphs = (1...150).map { "<p>Paragraph \($0). The kernel of a linear map is the set of vectors it sends to zero; line \($0) of the selftest page.</p>" }.joined()
        try? "<!doctype html><title>Dot track selftest</title><body style='font:20px -apple-system;margin:40px;max-width:700px'>\(paragraphs)</body>".write(to: page, atomically: true, encoding: .utf8)
        let wasRunning = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.Safari").first != nil
        guard let app = await open(page, bundle: "com.apple.Safari") else { s.note = "safari did not open"; return s }
        try? await Task.sleep(nanoseconds: 3_500_000_000)
        let axApp = AXUIElementCreateApplication(app.processIdentifier)
        AXUIElementSetMessagingTimeout(axApp, 1.0)
        AXUIElementSetAttributeValue(axApp, "AXEnhancedUserInterface" as CFString, kCFBooleanTrue)
        defer {
            AXUIElementSetAttributeValue(axApp, "AXEnhancedUserInterface" as CFString, kCFBooleanFalse)
            closeWindow(app: app, titled: "Dot track selftest", quit: !wasRunning)
        }
        // search the test's own window, not the menu bar (Safari's bookmarks menus alone hold thousands of items)
        var element: AXUIElement?
        for attempt in 0..<4 where element == nil {
            if attempt > 0 { try? await Task.sleep(nanoseconds: 1_000_000_000) }
            for w in windows(of: axApp) where title(of: w).contains("Dot track selftest") {
                element = findText(in: w, prefix: "Paragraph 12.", limit: 20000)
            }
        }
        guard let element, let frame0 = frame(of: element) else { s.note = "no paragraph element found (windows: \(windows(of: axApp).map { title(of: $0) }))"; return s }
        guard let window = frontWindow(pid: app.processIdentifier, titled: "Dot track selftest") else { s.note = "no window"; return s }
        try? await Task.sleep(nanoseconds: 600_000_000)
        let truth = { () -> CGRect? in frame(of: element) }
        await exercise(overlay: overlay, mark: frame0, window: window, truth: truth, sampleDuring: true, into: &s)
        return s
    }

    // MARK: Scenario B: pixels (Preview with a PDF)

    private static func preview(overlay: OverlayManager) async -> Scenario {
        var s = Scenario(name: "preview-pixels")
        let pdf = folder.appendingPathComponent("track-page.pdf")
        writePDF(to: pdf)
        let wasRunning = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.Preview").first != nil
        guard let app = await open(pdf, bundle: "com.apple.Preview") else { s.note = "preview did not open"; return s }
        try? await Task.sleep(nanoseconds: 3_500_000_000)
        defer { closeWindow(app: app, titled: "track-page.pdf", quit: !wasRunning) }
        guard let window = frontWindow(pid: app.processIdentifier, titled: "track-page") else { s.note = "no window"; return s }
        try? await Task.sleep(nanoseconds: 600_000_000)
        let target = "Line 14 "
        guard let frame0 = await ocr(window: window.id, find: target) else { s.note = "line not found by text recognition"; return s }
        let truth = { () -> CGRect? in nil }   // read with OCR at rest points instead (async)
        await exercise(overlay: overlay, mark: frame0, window: window, truth: truth, sampleDuring: false, into: &s, ocrTarget: target)
        return s
    }

    // MARK: The moves

    /// Mark `mark` (CG global), scroll a little, far, and back, measuring the mark against the truth.
    private static func exercise(overlay: OverlayManager, mark: CGRect, window: (id: CGWindowID, frame: CGRect), truth: () -> CGRect?, sampleDuring: Bool,
                                 into s: inout Scenario, ocrTarget: String? = nil) async {
        let primary = NSScreen.screens.first?.frame.height ?? 0
        func appKit(_ r: CGRect) -> CGRect { CGRect(x: r.minX, y: primary - r.maxY, width: r.width, height: r.height) }
        func cg(_ r: CGRect) -> CGRect { CGRect(x: r.minX, y: primary - r.maxY, width: r.width, height: r.height) }
        func drift(_ truthRect: CGRect?) -> Double? {
            guard let t = truthRect, let m = overlay.trackingSnapshot.highlight.map(cg) else { return nil }
            return Double(max(abs(m.midX - t.midX), abs(m.midY - t.midY)))
        }
        func currentTruth() async -> CGRect? {
            if let ocrTarget { return await ocr(window: window.id, find: ocrTarget) }
            return truth()
        }
        overlay.highlight(appKit(mark.insetBy(dx: -6, dy: -4)), label: "selftest")
        let ringCenter = CGPoint(x: mark.midX, y: mark.midY + mark.height * 2.5)
        overlay.target(at: CGPoint(x: ringCenter.x, y: primary - ringCenter.y), radius: 14, label: "selftest ring")
        try? await Task.sleep(nanoseconds: 1_200_000_000)
        s.anchor = overlay.trackingSnapshot.anchor
        let point = CGPoint(x: window.frame.midX, y: window.frame.midY)
        CGWarpMouseCursorPosition(point)
        try? await Task.sleep(nanoseconds: 300_000_000)
        Log.info("track-selftest: \(s.name) window \(window.id) at \(Int(window.frame.minX)),\(Int(window.frame.minY)) \(Int(window.frame.width))x\(Int(window.frame.height)); under the pointer: \(topWindow(at: point))")

        // 1. a little: 300 pt in 20 steps; find which way content moves (none at the top of a page: flip)
        var sign: Int32 = -1
        let before = await currentTruth()
        await scroll(steps: 20, by: 15 * sign, at: point) { if sampleDuring, let d = drift(truth()) { s.driftDuring.append(d) } }
        try? await Task.sleep(nanoseconds: 1_200_000_000)
        var after = await currentTruth()
        if let b = before, let a = after, abs(a.midY - b.midY) < 10 {
            sign = 1
            await scroll(steps: 20, by: 15 * sign, at: point) { if sampleDuring, let d = drift(truth()) { s.driftDuring.append(d) } }
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            after = await currentTruth()
        }
        // a freshly launched app may not take the first scrolls yet: up to three more tries, two seconds apart
        for _ in 0..<3 {
            guard let b = before, let a = after, abs(a.midY - b.midY) < 10 else { break }
            CGWarpMouseCursorPosition(point)
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            await scroll(steps: 20, by: 15 * sign, at: point) { if sampleDuring, let d = drift(truth()) { s.driftDuring.append(d) } }
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            after = await currentTruth()
        }
        if let b = before, let a = after { s.moved = Double(abs(a.midY - b.midY)) }
        Log.info("track-selftest: \(s.name) truth before \(before.map { "\(Int($0.minX)),\(Int($0.minY))" } ?? "none") after \(after.map { "\(Int($0.minX)),\(Int($0.minY))" } ?? "none"), sign \(sign)")
        if let d = drift(after) { s.driftRest.append(d) }

        // 2. far: the marked line leaves the window
        await scroll(steps: 40, by: 45 * sign, at: point) {}
        try? await Task.sleep(nanoseconds: 1_500_000_000)
        let snap = overlay.trackingSnapshot
        s.hiddenOffscreen = !snap.highlightShown
        s.chevronOffscreen = snap.chevron

        // 3. back the same way
        await scroll(steps: 40, by: -45 * sign, at: point) {}
        try? await Task.sleep(nanoseconds: 1_500_000_000)
        let back = await currentTruth()
        s.restored = overlay.trackingSnapshot.highlightShown
        s.driftRestored = drift(back)
        if let d = drift(back) { s.driftRest.append(d) }
        overlay.clearMarks()
    }

    private static func scroll(steps: Int, by pixels: Int32, at point: CGPoint, each: () -> Void) async {
        // WebKit routes wheel events by the last mouse move it saw; a warp moves the pointer without one
        if let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left) { move.post(tap: .cghidEventTap) }
        try? await Task.sleep(nanoseconds: 60_000_000)
        for _ in 0..<steps {
            if let e = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 1, wheel1: pixels, wheel2: 0, wheel3: 0) {
                e.location = point
                e.post(tap: .cghidEventTap)
            }
            try? await Task.sleep(nanoseconds: 45_000_000)
            each()
        }
    }

    // MARK: Apps and windows

    private static func topWindow(at point: CGPoint) -> String {
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return "?" }
        for info in list {
            guard let b = info[kCGWindowBounds as String] as? [String: CGFloat], let x = b["X"], let y = b["Y"], let w = b["Width"], let h = b["Height"],
                  CGRect(x: x, y: y, width: w, height: h).contains(point), (info[kCGWindowAlpha as String] as? Double ?? 1) > 0.05 else { continue }
            return "\(info[kCGWindowOwnerName as String] as? String ?? "?") \"\(info[kCGWindowName as String] as? String ?? "")\" layer \(info[kCGWindowLayer as String] as? Int ?? -1) id \(info[kCGWindowNumber as String] as? Int ?? 0)"
        }
        return "nothing"
    }

    private static func open(_ file: URL, bundle: String) async -> NSRunningApplication? {
        guard let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundle) else { return nil }
        let config = NSWorkspace.OpenConfiguration()
        config.activates = true
        return await withCheckedContinuation { cont in
            NSWorkspace.shared.open([file], withApplicationAt: appURL, configuration: config) { app, error in
                if let error { Log.warn("track-selftest: open \(bundle) failed: \(error.localizedDescription)") }
                cont.resume(returning: app)
            }
        }
    }

    /// The test's own window of the app (by title when given), raised to the front so the scrolls reach it.
    private static func frontWindow(pid: pid_t, titled title: String? = nil) -> (id: CGWindowID, frame: CGRect)? {
        if let title {
            let axApp = AXUIElementCreateApplication(pid)
            for w in windows(of: axApp) where self.title(of: w).contains(title) { AXUIElementPerformAction(w, kAXRaiseAction as CFString) }
            // an accessory app's activate() request can be ignored; making it frontmost through AX is not
            AXUIElementSetAttributeValue(axApp, kAXFrontmostAttribute as CFString, kCFBooleanTrue)
            NSRunningApplication(processIdentifier: pid)?.activate()
        }
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return nil }
        for info in list where (info[kCGWindowOwnerPID as String] as? pid_t) == pid && (info[kCGWindowLayer as String] as? Int) == 0 {
            if let title, let name = info[kCGWindowName as String] as? String, !name.contains(title) { continue }
            guard let id = info[kCGWindowNumber as String] as? CGWindowID, let b = info[kCGWindowBounds as String] as? [String: CGFloat],
                  let x = b["X"], let y = b["Y"], let w = b["Width"], let h = b["Height"], w > 200, h > 200 else { continue }
            return (id, CGRect(x: x, y: y, width: w, height: h))
        }
        return nil
    }

    /// Close the test's own window (by title), and quit the app when the test launched it.
    private static func closeWindow(app: NSRunningApplication, titled title: String, quit: Bool) {
        let axApp = AXUIElementCreateApplication(app.processIdentifier)
        var value: CFTypeRef?
        if AXUIElementCopyAttributeValue(axApp, kAXWindowsAttribute as CFString, &value) == .success, let windows = value as? [AXUIElement] {
            for w in windows {
                var t: CFTypeRef?
                AXUIElementCopyAttributeValue(w, kAXTitleAttribute as CFString, &t)
                guard let name = t as? String, name.contains(title) else { continue }
                var button: CFTypeRef?
                if AXUIElementCopyAttributeValue(w, kAXCloseButtonAttribute as CFString, &button) == .success, let button {
                    AXUIElementPerformAction(button as! AXUIElement, kAXPressAction as CFString)
                }
            }
        }
        if quit { DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { app.terminate() } }
    }

    // MARK: Accessibility

    private static func windows(of app: AXUIElement) -> [AXUIElement] {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &value) == .success, let list = value as? [AXUIElement] else { return [] }
        return list
    }

    private static func title(of window: AXUIElement) -> String {
        var t: CFTypeRef?
        AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &t)
        return (t as? String) ?? ""
    }

    private static func findText(in root: AXUIElement, prefix: String, limit: Int) -> AXUIElement? {
        var queue: [AXUIElement] = [root], seen = 0
        while !queue.isEmpty, seen < limit {
            let e = queue.removeFirst(); seen += 1
            var role: CFTypeRef?, value: CFTypeRef?
            AXUIElementCopyAttributeValue(e, kAXRoleAttribute as CFString, &role)
            if (role as? String) == kAXStaticTextRole as String {
                AXUIElementCopyAttributeValue(e, kAXValueAttribute as CFString, &value)
                if let text = value as? String, text.hasPrefix(prefix) { return e }
                var desc: CFTypeRef?
                AXUIElementCopyAttributeValue(e, kAXDescriptionAttribute as CFString, &desc)
                if let text = desc as? String, text.hasPrefix(prefix) { return e }
            }
            var children: CFTypeRef?
            if AXUIElementCopyAttributeValue(e, kAXChildrenAttribute as CFString, &children) == .success, let list = children as? [AXUIElement] {
                queue.append(contentsOf: list)
            }
        }
        return nil
    }

    private static func frame(of element: AXUIElement) -> CGRect? {
        var pos: CFTypeRef?, size: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXPositionAttribute as CFString, &pos) == .success,
              AXUIElementCopyAttributeValue(element, kAXSizeAttribute as CFString, &size) == .success, let pos, let size else { return nil }
        var p = CGPoint.zero, sz = CGSize.zero
        AXValueGetValue(pos as! AXValue, .cgPoint, &p)
        AXValueGetValue(size as! AXValue, .cgSize, &sz)
        return CGRect(origin: p, size: sz)
    }

    // MARK: Pixels and text recognition

    /// Where `find` is in the window now (CG global), by Vision text recognition of a capture of the window alone.
    private static func ocr(window id: CGWindowID, find: String) async -> CGRect? {
        guard let content = try? await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true),
              let window = content.windows.first(where: { $0.windowID == id }) else { return nil }
        let frame = window.frame
        let config = SCStreamConfiguration()
        config.width = Int(frame.width) * 2
        config.height = Int(frame.height) * 2
        config.showsCursor = false
        guard let image = try? await SCScreenshotManager.captureImage(contentFilter: SCContentFilter(desktopIndependentWindow: window), configuration: config) else { return nil }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        try? VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
        let needle = find.trimmingCharacters(in: .whitespaces)
        for obs in request.results ?? [] {
            guard let cand = obs.topCandidates(1).first else { continue }
            let text = cand.string
            // "Line 14" but not "Line 140"
            guard let r = text.range(of: needle), text[r.upperBound...].first.map({ !$0.isNumber }) ?? true,
                  let box = try? cand.boundingBox(for: r)?.boundingBox else { continue }
            return CGRect(x: frame.minX + box.minX * frame.width, y: frame.minY + (1 - box.maxY) * frame.height,
                          width: box.width * frame.width, height: box.height * frame.height)
        }
        return nil
    }

    /// Four letter pages of numbered lines, the PDF Preview scrolls.
    private static func writePDF(to url: URL) {
        var box = CGRect(x: 0, y: 0, width: 612, height: 792)
        guard let ctx = CGContext(url as CFURL, mediaBox: &box, nil) else { return }
        let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 15), .foregroundColor: NSColor.black]
        var n = 1
        for _ in 0..<4 {
            ctx.beginPDFPage(nil)
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
            for row in 0..<34 {
                ("Line \(n) of the selftest PDF: a definition to keep the box on." as NSString).draw(at: CGPoint(x: 60, y: 740 - CGFloat(row) * 21), withAttributes: attrs)
                n += 1
            }
            NSGraphicsContext.restoreGraphicsState()
            ctx.endPDFPage()
        }
        ctx.closePDF()
    }
}
