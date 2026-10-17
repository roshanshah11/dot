import AppKit
import ApplicationServices
import DotKit
import ImageIO
import ScreenCaptureKit

/// Keeps Dot's marks (the highlight box, the walkthrough ring, the pointed-at spot, a drawn shape) on the content
/// they were placed on while he scrolls, moves or covers the window. Round eight: before this, a box drawn around
/// a definition in a PDF stayed fixed on the screen while the page scrolled away under it.
///
/// Each mark gets an anchor when it lands:
/// - an accessibility element that is roughly the marked thing: its frame is re-read while he scrolls;
/// - otherwise the pixels of its window: a scroll event moves the mark by the event's delta at once, then a
///   capture of the same window region, registered against the previous one with Vision, corrects it;
/// - otherwise nothing (fixed).
/// Nothing runs while there are no marks: the scroll tap and timers exist only while something is tracked.
/// Geometry is in Core Graphics global points (top-left origin of the primary display), like AX and CGWindow.
@MainActor
final class MarkTracker {
    enum Kind: Hashable { case highlight, ring, point, shape }

    /// A mark moved, left the window (edge says which way) or came back. The rect is AppKit screen points.
    var onUpdate: ((Kind, CGRect, Bool, MarkEdge?) -> Void)?

    private enum Anchor {
        case element(AXUIElement, lastFrame: CGRect)
        case pixels
        case fixed
    }

    private struct Tracked {
        var rect: CGRect              // CG global
        var anchor: Anchor
        var windowID: CGWindowID?
        var pid: pid_t?
        var visible = true
        var edge: MarkEdge?
        /// What the mark covered when it landed (pixel anchors), and whether a scroll since calls for finding it again.
        var patch: CGImage?
        var landedAt = ProcessInfo.processInfo.systemUptime   // tells a replaced mark of the same kind apart
        var patchOffset = CGVector.zero      // the patch's whole-point origin minus the mark's origin
        var needsRefind = false

        var anchorName: String {
            switch anchor { case .element: return "element"; case .pixels: return "pixels"; case .fixed: return "nothing (fixed)" }
        }
    }

    /// The window whose pixels are being registered (one at a time: marks are on the window he is reading).
    private struct PixelSource {
        let windowID: CGWindowID
        var windowFrame: CGRect       // CG global
        var region: CGRect            // window-relative points
        var image: CGImage?
        var moveSinceImage = CGVector.zero
    }

    private var marks: [Kind: Tracked] = [:]
    /// The selftest's folder: re-find writes the patch and the band it searched there.
    static var dumpFolder: URL?
    private var pixel: PixelSource?
    private var tap: CFMachPort?
    private var tapSource: CFRunLoopSource?
    private var lastScroll: TimeInterval = 0
    private var frameTimer: Timer?
    private var registering = false
    private var activationObserver: NSObjectProtocol?
    private let ownPid = ProcessInfo.processInfo.processIdentifier

    // MARK: Public

    /// Start tracking a mark placed at `appKitRect` (AppKit screen points).
    func track(_ kind: Kind, appKitRect: CGRect) {
        let rect = Self.cgRect(fromAppKit: appKitRect)
        var tracked = Tracked(rect: rect, anchor: .fixed)
        if let (element, frame, pid) = elementAnchor(for: rect) {
            tracked.anchor = .element(element, lastFrame: frame)
            tracked.pid = pid
            tracked.windowID = windowUnder(rect).map { $0.id }
        } else if let window = windowUnder(rect) {
            tracked.anchor = .pixels
            tracked.windowID = window.id
            tracked.pid = window.pid
            preparePixels(window: window, around: rect)
        }
        marks[kind] = tracked
        if case .pixels = tracked.anchor, let window = windowUnder(rect) { capturePatch(kind, window: window, rect: rect) }
        startIfNeeded()
        Log.info("track: \(kind) anchored by \(tracked.anchorName) at \(Int(rect.minX)),\(Int(rect.minY)) \(Int(rect.width))x\(Int(rect.height))")
    }

    func clear(_ kind: Kind? = nil) {
        if let kind { marks[kind] = nil } else { marks.removeAll() }
        if !marks.values.contains(where: { if case .pixels = $0.anchor { return true }; return false }) { pixel = nil }
        if marks.isEmpty { stop() }
    }

    var isTracking: Bool { !marks.isEmpty }

    /// A scroll event as the tap would deliver it; DotTrackProbe uses this to test prediction and correction
    /// without posting real events.
    func simulateScroll(dy: Double, at point: CGPoint) {
        scrolled(dx: 0, dy: dy, lx: 0, ly: 0, continuous: true, at: point)
    }

    /// The tracked rect of a mark, AppKit screen points (for the probe).
    func currentRect(_ kind: Kind) -> CGRect? { marks[kind].map { Self.appKitRect(fromCG: $0.rect) } }

    /// How a mark is anchored ("element", "pixels", "nothing (fixed)"), for the selftest.
    func anchorName(_ kind: Kind) -> String? { marks[kind]?.anchorName }

    // MARK: Anchors

    /// Is this point (CG global) over one of Dot's own windows that takes the mouse (the explainer panel, a card)?
    private func isOverOwnWindow(_ point: CGPoint) -> Bool {
        let p = CGPoint(x: point.x, y: (NSScreen.screens.first?.frame.height ?? 0) - point.y)
        return NSApp.windows.contains { $0.isVisible && !$0.ignoresMouseEvents && $0.alphaValue > 0.05 && $0.frame.contains(p) }
    }

    private func elementAnchor(for rect: CGRect) -> (AXUIElement, CGRect, pid_t)? {
        guard AXIsProcessTrusted() else { return nil }
        let system = AXUIElementCreateSystemWide()
        // a busy app must not stall Dot: every AX call here gives up after a quarter second
        AXUIElementSetMessagingTimeout(system, 0.25)
        var hit: AXUIElement?
        guard AXUIElementCopyElementAtPosition(system, Float(rect.midX), Float(rect.midY), &hit) == .success, var element = hit else { return nil }
        for _ in 0..<4 {
            var pid: pid_t = 0
            AXUIElementGetPid(element, &pid)
            if pid == ownPid { return nil }
            AXUIElementSetMessagingTimeout(element, 0.25)
            if let frame = Self.frame(of: element), MarkTrackMath.elementMatches(mark: rect, element: frame) {
                return (element, frame, pid)
            }
            var parent: CFTypeRef?
            guard AXUIElementCopyAttributeValue(element, kAXParentAttribute as CFString, &parent) == .success, let p = parent,
                  CFGetTypeID(p) == AXUIElementGetTypeID() else { break }
            element = unsafeBitCast(p, to: AXUIElement.self)
        }
        return nil
    }

    private struct WindowInfo { let id: CGWindowID; let frame: CGRect; let pid: pid_t }

    /// The frontmost ordinary window under the rect's center that is not Dot's.
    private func windowUnder(_ rect: CGRect) -> WindowInfo? {
        let center = CGPoint(x: rect.midX, y: rect.midY)
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return nil }
        for info in list {
            guard (info[kCGWindowLayer as String] as? Int) == 0,
                  let pid = info[kCGWindowOwnerPID as String] as? pid_t, pid != ownPid,
                  let id = info[kCGWindowNumber as String] as? CGWindowID,
                  let b = info[kCGWindowBounds as String] as? [String: CGFloat],
                  let x = b["X"], let y = b["Y"], let w = b["Width"], let h = b["Height"] else { continue }
            let frame = CGRect(x: x, y: y, width: w, height: h)
            if frame.contains(center) { return WindowInfo(id: id, frame: frame, pid: pid) }
        }
        return nil
    }

    private func preparePixels(window: WindowInfo, around rect: CGRect) {
        let inWindow = rect.offsetBy(dx: -window.frame.minX, dy: -window.frame.minY)
        let region = MarkTrackMath.registrationRegion(for: inWindow, in: CGRect(origin: .zero, size: window.frame.size).insetBy(dx: 0, dy: 0))
        guard !region.isNull else { return }
        pixel = PixelSource(windowID: window.id, windowFrame: window.frame, region: region, image: nil)
        Task { [weak self] in
            guard let image = await Self.capture(windowID: window.id, region: region) else {
                Log.info("track: window capture failed (screen recording permission?); pixel marks follow scroll deltas only")
                return
            }
            // a newer mark may have replaced the source meanwhile: only fill the one this capture was for
            guard let self, self.pixel?.windowID == window.id, self.pixel?.region == region else { return }
            self.pixel?.image = image
        }
    }

    // MARK: Running

    private func startIfNeeded() {
        if tap == nil { installTap() }
        if frameTimer == nil {
            // 4 Hz while anything is tracked: window moves, element frames, visibility; 60 Hz right after a scroll.
            frameTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
                Task { @MainActor in self?.tick() }
            }
        }
        if activationObserver == nil {
            activationObserver = NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] note in
                let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
                Task { @MainActor in self?.appActivated(pid: app?.processIdentifier) }
            }
        }
    }

    private func stop() {
        frameTimer?.invalidate(); frameTimer = nil
        if let tap { CGEvent.tapEnable(tap: tap, enable: false) }
        if let tapSource { CFRunLoopRemoveSource(CFRunLoopGetMain(), tapSource, .commonModes) }
        tap = nil; tapSource = nil
        if let activationObserver { NSWorkspace.shared.notificationCenter.removeObserver(activationObserver) }
        activationObserver = nil
        pixel = nil
    }

    private func installTap() {
        let mask = (1 << CGEventType.scrollWheel.rawValue)
        let refcon = Unmanaged.passUnretained(self).toOpaque()
        guard let tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .tailAppendEventTap, options: .listenOnly,
                                          eventsOfInterest: CGEventMask(mask), callback: { _, type, event, refcon in
            if type == .scrollWheel, let refcon {
                let me = Unmanaged<MarkTracker>.fromOpaque(refcon).takeUnretainedValue()
                let dx = event.getDoubleValueField(.scrollWheelEventPointDeltaAxis2), dy = event.getDoubleValueField(.scrollWheelEventPointDeltaAxis1)
                let lx = event.getDoubleValueField(.scrollWheelEventDeltaAxis2), ly = event.getDoubleValueField(.scrollWheelEventDeltaAxis1)
                let continuous = event.getIntegerValueField(.scrollWheelEventIsContinuous) != 0
                let at = event.location
                let target = pid_t(truncatingIfNeeded: event.getIntegerValueField(.eventTargetUnixProcessID))
                MainActor.assumeIsolated {
                    // scrolling Dot's own panel or a card is not scrolling the window under it
                    guard target != me.ownPid, !me.isOverOwnWindow(at) else { return }
                    me.scrolled(dx: dx, dy: dy, lx: lx, ly: ly, continuous: continuous, at: at)
                }
            }
            return Unmanaged.passUnretained(event)
        }, userInfo: refcon) else {
            Log.info("track: scroll tap unavailable; marks follow elements and window moves only")
            return
        }
        self.tap = tap
        tapSource = CFMachPortCreateRunLoopSource(nil, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetMain(), tapSource, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
    }

    /// Keep what the mark covers, to find it again after a scroll (PatchFinder).
    private func capturePatch(_ kind: Kind, window: WindowInfo, rect: CGRect) {
        let inWindow = rect.offsetBy(dx: -window.frame.minX, dy: -window.frame.minY).intersection(CGRect(origin: .zero, size: window.frame.size))
        guard !inWindow.isNull, inWindow.width >= 8, inWindow.height >= 8, abs(inWindow.width - rect.width) < 1, abs(inWindow.height - rect.height) < 1 else {
            Log.info("track: no patch for \(kind): the mark is not wholly inside its window")
            return
        }
        // whole points: a fractional source rect comes back with a black column at its edge
        let region = inWindow.integral.intersection(CGRect(origin: .zero, size: window.frame.size))
        let landedAt = marks[kind]?.landedAt
        Task { [weak self] in
            let image = await Self.capture(windowID: window.id, region: region)
            guard let self, var m = self.marks[kind], m.windowID == window.id, m.landedAt == landedAt else { return }
            m.patch = image
            m.patchOffset = CGVector(dx: region.minX - inWindow.minX, dy: region.minY - inWindow.minY)
            self.marks[kind] = m
        }
    }

    /// After a scroll settles, look for each pixel mark's own patch in a band around where it is now, and snap to it
    /// when the match is clear: frame-to-frame registration can lock one line off on repetitive text.
    private func refind() {
        guard let source = pixel else { return }
        for (kind, m) in marks {
            guard case .pixels = m.anchor, m.needsRefind else { continue }
            guard m.visible, m.windowID == source.windowID, let patch = m.patch else {
                // out of view, no patch, or another window: nothing to look for now (a scroll that brings it back sets the flag again)
                var c = m; c.needsRefind = false; marks[kind] = c
                continue
            }
            var cleared = m; cleared.needsRefind = false; marks[kind] = cleared
            let windowFrame = source.windowFrame
            let inWindow = m.rect.offsetBy(dx: -windowFrame.minX, dy: -windowFrame.minY)
            let band = inWindow.insetBy(dx: -24, dy: -48).intersection(CGRect(origin: .zero, size: windowFrame.size)).integral
            guard !band.isNull, band.width >= CGFloat(patch.width), band.height >= CGFloat(patch.height) else { continue }
            let windowID = source.windowID
            registering = true
            Task { [weak self] in
                let image = await Self.capture(windowID: windowID, region: band)
                if let dir = Self.dumpFolder, let image {
                    let stamp = Int(Date().timeIntervalSince1970 * 1000)
                    Self.writePNG(patch, to: dir.appendingPathComponent("refind-\(stamp)-\(kind)-patch.png"))
                    Self.writePNG(image, to: dir.appendingPathComponent("refind-\(stamp)-\(kind)-band.png"))
                }
                let match: PatchFinder.Match? = await Task.detached(priority: .userInitiated) {
                    guard let image, let p = PatchFinder.Gray(patch), let b = PatchFinder.Gray(image) else { return nil }
                    return PatchFinder.find(p, in: b)
                }.value
                await MainActor.run {
                    guard let self else { return }
                    self.registering = false
                    guard let match, var now = self.marks[kind], now.windowID == windowID else { return }
                    let found = CGPoint(x: windowFrame.minX + band.minX + CGFloat(match.x) - now.patchOffset.dx,
                                        y: windowFrame.minY + band.minY + CGFloat(match.y) - now.patchOffset.dy)
                    let d = CGVector(dx: found.x - now.rect.minX, dy: found.y - now.rect.minY)
                    Log.info("track: re-found \(kind) at \(Int(d.dx)),\(Int(d.dy)) from the mark, score \(String(format: "%.2f", match.score)) vs \(String(format: "%.2f", match.runnerUp))")
                    guard match.score >= 0.8, match.score - match.runnerUp >= 0.02, abs(d.dx) > 0.5 || abs(d.dy) > 0.5 else { return }
                    now.rect = now.rect.offsetBy(dx: d.dx, dy: d.dy)
                    self.marks[kind] = now
                    self.publish(kind)
                }
            }
            return   // one at a time
        }
    }

    private func scrolled(dx: Double, dy: Double, lx: Double, ly: Double, continuous: Bool, at point: CGPoint) {
        lastScroll = ProcessInfo.processInfo.systemUptime
        guard var source = pixel, source.windowFrame.contains(point) else { return }
        let predicted = MarkTrackMath.predictedTranslation(pointDeltaX: dx, pointDeltaY: dy, lineDeltaX: lx, lineDeltaY: ly, isContinuous: continuous)
        source.moveSinceImage.dx += predicted.dx
        source.moveSinceImage.dy += predicted.dy
        pixel = source
        for (kind, var m) in marks {
            guard case .pixels = m.anchor, m.windowID == source.windowID else { continue }
            m.rect = m.rect.offsetBy(dx: predicted.dx, dy: predicted.dy)
            m.needsRefind = true
            marks[kind] = m
            publish(kind)
        }
    }

    private var tickCount = 0

    private func tick() {
        tickCount += 1
        let now = ProcessInfo.processInfo.systemUptime
        let scrolling = now - lastScroll < 0.45
        // between scrolls only every 15th tick (4 Hz) does any work
        guard scrolling || tickCount % 15 == 0 else { return }
        for (kind, var m) in marks {
            if case .element(let element, let last) = m.anchor {
                guard let frame = Self.frame(of: element) else {
                    // the element went away (page changed): hide the mark
                    if m.visible { m.visible = false; marks[kind] = m; onUpdate?(kind, Self.appKitRect(fromCG: m.rect), false, nil) }
                    continue
                }
                if frame != last {
                    m.rect = MarkTrackMath.follow(mark: m.rect, from: last, to: frame)
                    m.anchor = .element(element, lastFrame: frame)
                    marks[kind] = m
                    publish(kind)
                }
            }
        }
        // a pixel source's window moved without scrolling: carry its marks along
        if !scrolling, var source = pixel, let frame = Self.windowFrame(source.windowID), frame.origin != source.windowFrame.origin {
            let d = CGVector(dx: frame.minX - source.windowFrame.minX, dy: frame.minY - source.windowFrame.minY)
            source.windowFrame = frame
            pixel = source
            for (kind, var m) in marks where m.windowID == source.windowID {
                if case .pixels = m.anchor { m.rect = m.rect.offsetBy(dx: d.dx, dy: d.dy); marks[kind] = m; publish(kind) }
            }
        }
        // registration: ~10 Hz while scrolling and once right after it settles
        if pixel?.image != nil, !registering, (scrolling && tickCount % 6 == 0) || (!scrolling && (pixel?.moveSinceImage ?? .zero) != .zero && now - lastScroll > 0.18) {
            register()
        } else if !scrolling, !registering, now - lastScroll > 0.5, (pixel?.moveSinceImage ?? .zero) == .zero,
                  marks.values.contains(where: { $0.needsRefind }) {
            refind()
        }
    }

    private func register() {
        guard let source = pixel, let before = source.image else { return }
        registering = true
        let predicted = source.moveSinceImage
        let windowID = source.windowID, region = source.region
        Task { [weak self] in
            let after = await Self.capture(windowID: windowID, region: region)
            let shift: ImageRegistration.Shift? = await Task.detached(priority: .userInitiated) {
                guard let after else { return nil }
                return ImageRegistration.shift(from: before, to: after)
            }.value
            await MainActor.run {
                guard let self else { return }
                self.registering = false
                guard var src = self.pixel, src.windowID == windowID, let after else { return }
                // image pixels -> points (captures are made at one pixel per point)
                let measured = shift.map { CGVector(dx: $0.dx, dy: $0.dy) }
                if let shift { Log.info("track: registered \(Int(shift.dx)),\(Int(shift.dy)) conf \(String(format: "%.2f", shift.confidence)) vs predicted \(Int(predicted.dx)),\(Int(predicted.dy))") }
                let truth = MarkTrackMath.reconcile(predicted: predicted, measured: measured, confidence: shift?.confidence ?? 0)
                let correction = CGVector(dx: truth.dx - predicted.dx, dy: truth.dy - predicted.dy)
                // anything scrolled since this capture started stays as prediction on top of the new image
                let since = CGVector(dx: src.moveSinceImage.dx - predicted.dx, dy: src.moveSinceImage.dy - predicted.dy)
                src.image = after
                src.moveSinceImage = since
                self.pixel = src
                guard abs(correction.dx) > 0.5 || abs(correction.dy) > 0.5 else { return }
                for (kind, var m) in self.marks where m.windowID == windowID {
                    if case .pixels = m.anchor { m.rect = m.rect.offsetBy(dx: correction.dx, dy: correction.dy); self.marks[kind] = m; self.publish(kind) }
                }
            }
        }
    }

    private func publish(_ kind: Kind) {
        guard var m = marks[kind] else { return }
        let window = m.windowID.flatMap { Self.windowFrame($0) }
        // the visible part of the window, minus a title bar
        let visibleArea = window.map { CGRect(x: $0.minX, y: $0.minY + 28, width: $0.width, height: max(0, $0.height - 28)) }
        let vis = visibleArea.map { MarkTrackMath.visibility(of: m.rect, in: $0) } ?? (true, nil)
        m.visible = vis.0
        m.edge = vis.1
        marks[kind] = m
        onUpdate?(kind, Self.appKitRect(fromCG: m.rect), vis.0, vis.1)
    }

    private func appActivated(pid: pid_t?) {
        guard let pid, pid != ownPid else { return }
        // he switched to another app: marks on the old app's content go
        let foreign = marks.filter { $0.value.pid != nil && $0.value.pid != pid }.map { $0.key }
        for kind in foreign {
            if let m = marks[kind] { onUpdate?(kind, Self.appKitRect(fromCG: m.rect), false, nil) }
            marks[kind] = nil
        }
        if marks.isEmpty { stop() }
    }

    /// The edge the window's visible area lost a mark through, for the walkthrough chevron (AppKit point).
    func chevronPoint(for kind: Kind) -> (CGPoint, MarkEdge)? {
        guard let m = marks[kind], !m.visible, let edge = m.edge, let id = m.windowID, let frame = Self.windowFrame(id) else { return nil }
        let visibleArea = CGRect(x: frame.minX, y: frame.minY + 28, width: frame.width, height: max(0, frame.height - 28))
        let p = MarkTrackMath.chevron(for: m.rect, in: visibleArea, edge: edge)
        let a = Self.appKitRect(fromCG: CGRect(x: p.x, y: p.y, width: 0, height: 0))
        return (CGPoint(x: a.minX, y: a.minY), edge)
    }

    // MARK: Helpers

    private static func frame(of element: AXUIElement) -> CGRect? {
        var pos: CFTypeRef?, size: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXPositionAttribute as CFString, &pos) == .success,
              AXUIElementCopyAttributeValue(element, kAXSizeAttribute as CFString, &size) == .success,
              let pos, let size else { return nil }
        var p = CGPoint.zero, s = CGSize.zero
        AXValueGetValue(pos as! AXValue, .cgPoint, &p)
        AXValueGetValue(size as! AXValue, .cgSize, &s)
        return CGRect(origin: p, size: s)
    }

    private static func windowFrame(_ id: CGWindowID) -> CGRect? {
        guard let list = CGWindowListCopyWindowInfo([.optionIncludingWindow], id) as? [[String: Any]], let info = list.first,
              let b = info[kCGWindowBounds as String] as? [String: CGFloat],
              let x = b["X"], let y = b["Y"], let w = b["Width"], let h = b["Height"] else { return nil }
        return CGRect(x: x, y: y, width: w, height: h)
    }

    /// One window's region (window-relative points) at one pixel per point; Dot's overlay is never in it
    /// because the filter is the window alone.
    private static func capture(windowID: CGWindowID, region: CGRect) async -> CGImage? {
        let region = region.integral   // a fractional source rect comes back with a black column at its edge
        guard let content = try? await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true),
              let window = content.windows.first(where: { $0.windowID == windowID }) else { return nil }
        let filter = SCContentFilter(desktopIndependentWindow: window)
        let config = SCStreamConfiguration()
        config.sourceRect = region
        config.width = max(16, Int(region.width))
        config.height = max(16, Int(region.height))
        config.showsCursor = false
        let image = try? await SCScreenshotManager.captureImage(contentFilter: filter, configuration: config)
        if let dir = ProcessInfo.processInfo.environment["DOT_TRACK_DUMP"], let image {
            let url = URL(fileURLWithPath: dir).appendingPathComponent("capture-\(Int(Date().timeIntervalSince1970 * 1000)).png")
            if let dest = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) { CGImageDestinationAddImage(dest, image, nil); CGImageDestinationFinalize(dest) }
        }
        return image
    }

    private static func writePNG(_ image: CGImage, to url: URL) {
        if let dest = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) { CGImageDestinationAddImage(dest, image, nil); CGImageDestinationFinalize(dest) }
    }

    private static var primaryHeight: CGFloat { NSScreen.screens.first?.frame.height ?? 0 }
    static func cgRect(fromAppKit r: CGRect) -> CGRect { CGRect(x: r.minX, y: primaryHeight - r.maxY, width: r.width, height: r.height) }
    static func appKitRect(fromCG r: CGRect) -> CGRect { Coordinates.appKitRect(fromCG: r, primaryHeight: primaryHeight) }
}
