import AppKit
import CoreText
import DotKit
import SwiftUI

/// Ink on the live screen (parity batch 1, docs/heyclicky-drawing.md): what Dot writes on the real screen while it
/// talks. DotKit says what each mark draws (InkGeometry) and when (InkTiming); this file paints it in each screen's
/// click-through overlay, keeps the drawing by id (InkBoard) so the next turn can edit it, and hands each mark to the
/// MarkTracker so it follows the content when he scrolls.

/// The pen across marks: held on a barge-in, where each mark is, and the timers that tidy up.
struct InkPenState {
    var held = false
    /// The pen's sounds (PenSounds); off for a muted answer.
    var sounds = true
    /// Marks that had not started when the pen was held, and how long after the hold they were due.
    var waiting: [String: TimeInterval] = [:]
    /// The screen each mark is on.
    var screens: [String: Int] = [:]
    var fadeTimer: Timer?
    var settleWork: DispatchWorkItem?
}

/// One mark as a screen draws it: the geometry, its colours, and its clock (when the pen starts and how long it
/// takes; an erase runs the pen backwards from `eraseStart`).
struct InkMarkModel: Identifiable, Equatable {
    let id: String
    var drawing: InkDrawing
    /// "" is Dot's accent.
    var hex: String
    /// White or near-black for free words, from what is under them.
    var toneHex: String
    var start: TimeInterval
    var duration: TimeInterval
    var eraseStart: TimeInterval?
    var eraseDuration: TimeInterval = 0.4
    var offset: CGVector = .zero
    var scale: CGFloat = 1
    var hidden = false
    var image: NSImage?
    var seed: UInt64

    static func == (a: InkMarkModel, b: InkMarkModel) -> Bool {
        a.id == b.id && a.drawing == b.drawing && a.hex == b.hex && a.toneHex == b.toneHex && a.start == b.start
            && a.duration == b.duration && a.eraseStart == b.eraseStart && a.offset == b.offset && a.scale == b.scale
            && a.hidden == b.hidden && a.image === b.image
    }

    /// 0...1 at `now`, eased like a hand: slow to land, quick through the middle, slow to lift.
    func progress(at now: TimeInterval) -> CGFloat {
        var p = duration <= 0 ? (now >= start ? 1 : 0) : min(max((now - start) / duration, 0), 1)
        if let e = eraseStart { p = min(p, 1 - min(max((now - e) / eraseDuration, 0), 1)) }
        return CGFloat(p * p * (3 - 2 * p))
    }

    /// When nothing about it changes any more.
    var settlesAt: TimeInterval {
        let drawn = start.isFinite ? start + duration : start
        return eraseStart.map { max(drawn, $0 + eraseDuration) } ?? drawn
    }
}

/// Every ink mark on one screen, painted in one Canvas. The timeline runs only while a mark is still moving.
struct InkLayerView: View {
    let marks: [InkMarkModel]
    let accent: Color

    var body: some View {
        let now = Date().timeIntervalSinceReferenceDate
        let moving = marks.contains { $0.settlesAt.isFinite && $0.settlesAt > now }
        TimelineView(.animation(minimumInterval: nil, paused: !moving)) { timeline in
            Canvas { ctx, _ in
                let t = timeline.date.timeIntervalSinceReferenceDate
                for mark in marks where !mark.hidden {
                    InkPainter.paint(mark, progress: mark.progress(at: t), accent: accent, in: ctx)
                }
            }
        }
        .allowsHitTesting(false)
    }
}

enum InkFonts {
    static let hand = "PatrickHand-Regular"
    private static var registered = false

    /// Registers the bundled handwriting once (the app's Resources, or the source tree for selftests).
    static func register() {
        guard !registered else { return }
        registered = true
        let candidates = [
            Bundle.main.resourceURL?.appendingPathComponent("fonts/PatrickHand-Regular.ttf"),
            URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../../Resources/fonts/PatrickHand-Regular.ttf").standardizedFileURL,
        ].compactMap { $0 }
        for url in candidates where FileManager.default.fileExists(atPath: url.path) {
            var error: Unmanaged<CFError>?
            if CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) { return }
        }
        Log.info("ink: handwriting font not found; using Bradley Hand")
    }

    static func handFont(_ size: CGFloat) -> NSFont {
        register()
        return NSFont(name: hand, size: size) ?? NSFont(name: "Bradley Hand", size: size) ?? .systemFont(ofSize: size)
    }

    static func pillFont(_ size: CGFloat) -> NSFont {
        let base = NSFont.systemFont(ofSize: size, weight: .semibold)
        return base.fontDescriptor.withDesign(.rounded).flatMap { NSFont(descriptor: $0, size: size) } ?? base
    }

    static func typedFont(_ size: CGFloat) -> NSFont { .monospacedSystemFont(ofSize: size, weight: .regular) }

    static func font(_ style: InkText.Style, _ size: CGFloat) -> NSFont {
        switch style {
        case .hand, .sticky: return handFont(size)
        case .pill, .badge: return pillFont(size)
        case .typed: return typedFont(size)
        }
    }

    /// Core Text's measure, for the layout check.
    static let measure: InkMeasure = { text, style, size in
        let font = InkFonts.font(style, size)
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false)
        var width: CGFloat = 0
        for line in lines { width = max(width, (String(line) as NSString).size(withAttributes: [.font: font]).width) }
        let lineHeight = ceil(font.ascender - font.descender + font.leading)
        return CGSize(width: ceil(width), height: lineHeight * CGFloat(max(lines.count, 1)))
    }
}

enum InkPainter {
    static func paint(_ mark: InkMarkModel, progress: CGFloat, accent: Color, in context: GraphicsContext) {
        guard progress > 0 else { return }
        var ctx = context
        let ink = mark.hex.isEmpty ? accent : (Color(hex: mark.hex) ?? accent)
        let tone = Color(hex: mark.toneHex) ?? .white
        if mark.offset != .zero { ctx.translateBy(x: mark.offset.dx, y: mark.offset.dy) }
        if mark.scale != 1 {
            let c = CGPoint(x: mark.drawing.bounds.midX, y: mark.drawing.bounds.midY)
            ctx.translateBy(x: c.x, y: c.y)
            ctx.scaleBy(x: mark.scale, y: mark.scale)
            ctx.translateBy(x: -c.x, y: -c.y)
        }
        let paper = mark.drawing.fills.first { $0.style == .paper }
        for (i, piece) in mark.drawing.pieces.enumerated() {
            let p = piece.local(progress)
            guard p > 0 else { continue }
            switch piece.body {
            case .fill(let fill): paintFill(fill, p, ink: ink, image: mark.image, in: ctx)
            case .stroke(let stroke): paintStroke(stroke, p, ink: ink, seed: mark.seed &+ UInt64(i), in: ctx)
            case .text(let text): paintText(text, p, ink: ink, tone: tone, paper: paper, in: ctx)
            }
        }
    }

    private static func polygon(_ pts: [CGPoint], closed: Bool = true) -> Path {
        var path = Path()
        guard let first = pts.first else { return path }
        path.move(to: first)
        for p in pts.dropFirst() { path.addLine(to: p) }
        if closed { path.closeSubpath() }
        return path
    }

    static func paintStroke(_ s: InkStroke, _ p: CGFloat, ink: Color, seed: UInt64, in ctx: GraphicsContext) {
        switch s.style {
        case .pen:
            let outline = InkPen.outline(s.points, width: s.width, progress: p, seed: seed)
            guard !outline.isEmpty else { return }
            let path = polygon(outline)
            ctx.drawLayer { layer in
                layer.addFilter(.shadow(color: ink.opacity(0.55), radius: 4))
                layer.fill(path, with: .color(ink))
            }
        case .dashed:
            let path = polygon(InkPen.prefix(s.points, progress: p), closed: false)
            ctx.drawLayer { layer in
                layer.addFilter(.shadow(color: ink.opacity(0.45), radius: 3))
                layer.stroke(path, with: .color(ink), style: StrokeStyle(lineWidth: s.width, lineCap: .round, lineJoin: .round, dash: [7, 5]))
            }
        case .highlighter:
            var layer = ctx
            layer.blendMode = .multiply
            layer.stroke(polygon(InkPen.prefix(s.points, progress: p), closed: false), with: .color(ink.opacity(0.32)),
                         style: StrokeStyle(lineWidth: s.width, lineCap: .butt, lineJoin: .round))
        }
    }

    static func paintFill(_ f: InkFill, _ p: CGFloat, ink: Color, image: NSImage?, in context: GraphicsContext) {
        var ctx = context
        let shape = Path(roundedRect: f.rect, cornerRadius: f.cornerRadius, style: .continuous)
        switch f.style {
        case .tint:
            ctx.fill(shape, with: .color(ink.opacity(0.08 * Double(p))))
        case .paper, .photo:
            // paper lands: a touch small and see-through, then down flat and askew
            let c = CGPoint(x: f.rect.midX, y: f.rect.midY)
            let s = 0.92 + 0.08 * p
            ctx.opacity = Double(min(p * 1.6, 1))
            ctx.translateBy(x: c.x, y: c.y)
            ctx.rotate(by: .degrees(f.rotation))
            ctx.scaleBy(x: s, y: s)
            ctx.translateBy(x: -c.x, y: -c.y)
            ctx.drawLayer { layer in
                layer.addFilter(.shadow(color: .black.opacity(0.28), radius: 7, x: 0, y: 3))
                layer.fill(shape, with: .color(f.style == .paper ? Color(red: 1.0, green: 0.95, blue: 0.66) : .white))
            }
            if f.style == .photo {
                let inner = CGRect(x: f.rect.minX + 8, y: f.rect.minY + 8, width: f.rect.width - 16, height: f.rect.height - 34)
                if let image {
                    ctx.drawLayer { layer in
                        layer.clip(to: Path(inner))
                        // fill the window, cropping the long side
                        let ratio = max(inner.width / max(image.size.width, 1), inner.height / max(image.size.height, 1))
                        let size = CGSize(width: image.size.width * ratio, height: image.size.height * ratio)
                        layer.draw(Image(nsImage: image), in: CGRect(x: inner.midX - size.width / 2, y: inner.midY - size.height / 2, width: size.width, height: size.height))
                    }
                } else {
                    ctx.fill(Path(inner), with: .color(Color(white: 0.9)))
                }
            }
            // tape across the top, in the ink's light tone
            let tape = CGRect(x: f.rect.midX - 26, y: f.rect.minY - 8, width: 52, height: 16)
            ctx.fill(Path(tape), with: .color(ink.opacity(0.4)))
        }
    }

    static func paintText(_ t: InkText, _ p: CGFloat, ink: Color, tone: Color, paper: InkFill?, in context: GraphicsContext) {
        var ctx = context
        switch t.style {
        case .pill, .badge:
            // pops in: small, then a touch past full size, then settles
            let pop = p < 0.7 ? 0.6 + 0.5 * (p / 0.7) : 1.1 - 0.1 * ((p - 0.7) / 0.3)
            let c = CGPoint(x: t.frame.midX, y: t.frame.midY)
            ctx.opacity = Double(min(p * 2, 1))
            ctx.translateBy(x: c.x, y: c.y)
            ctx.scaleBy(x: pop, y: pop)
            ctx.translateBy(x: -c.x, y: -c.y)
            let shape = t.style == .badge ? Path(ellipseIn: t.frame) : Path(roundedRect: t.frame, cornerRadius: t.frame.height / 2, style: .continuous)
            ctx.drawLayer { layer in
                layer.addFilter(.shadow(color: ink.opacity(0.5), radius: 5))
                layer.fill(shape, with: .color(ink))
            }
            let font = Font(InkFonts.pillFont(t.style == .badge ? t.fontSize + 1 : t.fontSize))
            ctx.draw(Text(t.text).font(font).foregroundColor(.white), at: c, anchor: .center)
        case .hand, .sticky:
            if t.style == .sticky, let paper {
                let c = CGPoint(x: paper.rect.midX, y: paper.rect.midY)
                ctx.translateBy(x: c.x, y: c.y)
                ctx.rotate(by: .degrees(paper.rotation))
                ctx.translateBy(x: -c.x, y: -c.y)
            }
            // written left to right: the words show as far as the pen has got
            ctx.clip(to: Path(CGRect(x: t.frame.minX - 4, y: t.frame.minY - 6, width: (t.frame.width + 8) * p, height: t.frame.height + 12)))
            let color = t.style == .sticky ? Color(red: 0.17, green: 0.15, blue: 0.12) : tone
            if t.style == .hand {
                // a soft halo the other way, so the words read on a busy page
                ctx.addFilter(.shadow(color: (t.style == .hand && tone == .white ? Color.black : Color.white).opacity(0.55), radius: 2))
            }
            ctx.draw(Text(t.text).font(Font(InkFonts.handFont(t.fontSize))).foregroundColor(color), in: t.frame.insetBy(dx: -2, dy: -2))
        case .typed:
            let count = Int((CGFloat(t.text.count) * p).rounded(.down))
            let shown = String(t.text.prefix(count)) + (p < 1 ? "▍" : "")
            ctx.addFilter(.shadow(color: (tone == .white ? Color.black : Color.white).opacity(0.5), radius: 2))
            ctx.draw(Text(shown).font(Font(InkFonts.typedFont(t.fontSize))).foregroundColor(tone), at: t.frame.origin, anchor: .topLeading)
        }
    }
}

// MARK: - The overlay's ink

extension OverlayManager {
    /// One ink mark of a beat, with its places already on the screen (AppKit points; a point is a zero-size rect).
    struct InkItem {
        var spec: InkSpec
        var anchors: [CGRect]
        /// What it marks, for the tracker (the element or box; a point gets a small box around it).
        var marks: CGRect
    }

    /// Ink lines for the next turn: what is drawn now, by id.
    var inkLines: [String] { inkBoard.lines }
    var hasInk: Bool { !inkBoard.isEmpty }

    /// Draws a beat's marks across its sentence (D3): each starts when the one before it is done, and together they
    /// fill the sentence. `busy` is where text and controls are (AppKit rects); `luminance` reads what is under a
    /// screen rect, 0...1. Returns each drawn mark's id with its tag.
    @discardableResult
    func inkBeat(_ items: [InkItem], sentence duration: TimeInterval?, characters: Int, busy: [CGRect] = [],
                 luminance: ((CGRect) -> Double?)? = nil) -> [(id: String, spec: InkSpec)] {
        InkFonts.register()
        var built: [(item: InkItem, index: Int, drawing: InkDrawing, tone: String, seed: UInt64)] = []
        var placedBoxes: [Int: [CGRect]] = [:]
        for item in items {
            guard let first = item.anchors.first, let index = screenIndex(containing: CGPoint(x: first.midX, y: first.midY)) else {
                Log.info("ink: \(item.spec.tagText) is on no screen; skipped")
                continue
            }
            let frame = windows[index].screenFrame
            let model = models[index]
            let anchors = item.anchors.map { Coordinates.overlayRect(fromScreen: $0, screenFrame: frame) }
            let busyHere = busy.filter { $0.intersects(frame) }.map { Coordinates.overlayRect(fromScreen: $0, screenFrame: frame) }
            let existing = model.ink.flatMap { m in m.drawing.labelBoxes.map { $0.offsetBy(dx: m.offset.dx, dy: m.offset.dy) } }
            let seed = Self.inkSeed(item.spec.tagText)
            let context = InkGeometry.Context(
                anchors: anchors, bounds: CGRect(origin: .zero, size: frame.size).insetBy(dx: 6, dy: 6),
                avoid: existing + placedBoxes[index, default: []],
                busy: { r in busyHere.reduce(0) { acc, b in let i = b.intersection(r); return i.isNull ? acc : acc + Double(i.width * i.height / max(r.width * r.height, 1)) } },
                measure: InkFonts.measure, seed: seed)
            guard let drawing = InkGeometry.make(item.spec.kind, text: item.spec.text, in: context) else {
                Log.info("ink: \(item.spec.tagText) does not fit its places; skipped")
                continue
            }
            placedBoxes[index, default: []] += drawing.labelBoxes
            var tone = "#ffffff"
            if let words = drawing.texts.first(where: { $0.style == .hand || $0.style == .typed }), let luminance {
                let screenRect = Self.screenRect(fromOverlay: words.frame, screenFrame: frame)
                if let l = luminance(screenRect) { tone = InkColors.freeWordHex(onLuminance: l) }
            }
            built.append((item, index, drawing, tone, seed))
        }
        guard !built.isEmpty else { return [] }
        let plan = InkTiming.schedule(naturals: built.map(\.drawing.natural), sentence: duration, characters: characters)
        let now = Date().timeIntervalSinceReferenceDate
        var ids: [(id: String, spec: InkSpec)] = []
        for ((item, index, drawing, tone, seed), slot) in zip(built, plan) {
            let frame = windows[index].screenFrame
            let (id, dropped) = inkBoard.add(item.spec, frame: Self.screenRect(fromOverlay: drawing.bounds, screenFrame: frame))
            for old in dropped { removeInk(old) }
            var start = now + slot.start
            if inkPen.held { inkPen.waiting[id] = slot.start; start = .infinity }
            models[index].ink.append(InkMarkModel(id: id, drawing: drawing, hex: "", toneHex: tone, start: start, duration: slot.duration, seed: seed))
            inkPen.screens[id] = index
            let tracked = item.marks.width < 4 || item.marks.height < 4 ? item.marks.insetBy(dx: -12, dy: -12) : item.marks
            trackedRects[.ink(id)] = tracked
            tracker.track(.ink(id), appKitRect: tracked)
            ids.append((id, item.spec))
            if inkPen.sounds, !inkPen.held { PenSounds.shared.mark(item.spec.kind, drawing: drawing, after: slot.start, duration: slot.duration) }
            Log.info("ink: \(id) \(item.spec.tagText) in \(String(format: "%.2f", slot.duration)) s at +\(String(format: "%.2f", slot.start)) s")
        }
        // the pointer is Dot's pen while it draws and his mouse is still (SH-02)
        if !inkPen.held, let end = plan.last.map({ $0.start + $0.duration }) { PenCursor.shared.draw(for: end, accentHex: colorHex) }
        showTransient()
        returnWork?.cancel()
        startInkFade()
        scheduleInkSettle()
        return ids
    }

    /// A photo arrived for a `[PHOTO]` mark.
    func setInkPhoto(_ id: String, image: NSImage) {
        guard let index = inkPen.screens[id], let i = models[index].ink.firstIndex(where: { $0.id == id }) else { return }
        models[index].ink[i].image = image
    }

    /// A change to the drawing already up (D4). `moveTo` is the resolved place for a move (AppKit). Returns what it touched.
    @discardableResult
    func inkEdit(_ edit: InkEdit, moveTo: CGRect? = nil) -> [String] {
        let before = inkBoard
        let touched = inkBoard.apply(edit, moveTo: moveTo)
        guard !touched.isEmpty else {
            if edit != .keep { Log.info("ink: edit \(edit) touched nothing (on screen: \(before.marks.map(\.id).joined(separator: " ")))") }
            return []
        }
        let now = Date().timeIntervalSinceReferenceDate
        if inkPen.sounds { PenSounds.shared.edit(edit) }
        for id in touched {
            guard let index = inkPen.screens[id], let i = models[index].ink.firstIndex(where: { $0.id == id }) else { continue }
            let model = models[index]
            switch edit {
            case .erase, .undo:
                model.ink[i].eraseStart = now
                DispatchQueue.main.asyncAfter(deadline: .now() + model.ink[i].eraseDuration + 0.05) { [weak self] in self?.removeInk(id, fromBoard: false) }
            case .recolor(_, let color):
                // repainted in the new colour, the way it was drawn, quickly
                model.ink[i].hex = InkColors.hex(color) ?? ""
                model.ink[i].start = now
                model.ink[i].duration = min(model.ink[i].drawing.natural, 0.6)
            case .scale(_, let factor):
                model.ink[i].scale *= CGFloat(factor)
            case .move:
                if let old = before.mark(id)?.frame, let new = inkBoard.mark(id)?.frame {
                    let d = CGVector(dx: new.midX - old.midX, dy: -(new.midY - old.midY))
                    model.ink[i].offset.dx += d.dx
                    model.ink[i].offset.dy += d.dy
                    if let tracked = trackedRects[.ink(id)] {
                        let moved = tracked.offsetBy(dx: new.midX - old.midX, dy: new.midY - old.midY)
                        trackedRects[.ink(id)] = moved
                        tracker.track(.ink(id), appKitRect: moved)
                    }
                }
            case .keep:
                break
            }
            Log.info("ink: \(edit) on \(id)")
        }
        scheduleInkSettle()
        return touched
    }

    /// Every mark goes (Escape, a new answer that draws afresh): the pens run backwards together.
    func clearInk(animated: Bool = true) {
        closeFigures()
        PenCursor.shared.handBack()
        guard !inkBoard.isEmpty || models.contains(where: { !$0.ink.isEmpty }) else { return }
        let ids = inkBoard.marks.map(\.id)
        if animated, !ids.isEmpty, inkPen.sounds { PenSounds.shared.cleared() }
        inkBoard.removeAll()
        inkPen.waiting = [:]
        inkPen.held = false
        tracker.clearAll(ink: true)
        for key in trackedRects.keys where key.isInk { trackedRects[key] = nil }
        let now = Date().timeIntervalSinceReferenceDate
        for model in models {
            if animated { for i in model.ink.indices { model.ink[i].eraseStart = now; model.ink[i].eraseDuration = 0.3 } } else { model.ink = [] }
        }
        if animated {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
                guard let self else { return }
                for model in self.models { model.ink.removeAll { ids.contains($0.id) || $0.eraseStart != nil } }
                self.inkIdle()
            }
        } else {
            inkIdle()
        }
        inkPen.screens = [:]
        Log.info("ink: cleared \(ids.count) mark(s)")
    }

    /// Barge-in (D4): the pen stops after the stroke it is on; nothing is wiped. Marks not yet started wait.
    func holdInk() {
        guard !inkPen.held else { return }
        inkPen.held = true
        PenSounds.shared.hush()
        PenCursor.shared.handBack()
        let now = Date().timeIntervalSinceReferenceDate
        for model in models {
            for i in model.ink.indices where model.ink[i].start > now && model.ink[i].start.isFinite {
                inkPen.waiting[model.ink[i].id] = model.ink[i].start - now
                model.ink[i].start = .infinity
            }
        }
        if !inkPen.waiting.isEmpty { Log.info("ink: pen held, \(inkPen.waiting.count) mark(s) waiting") }
    }

    /// The pen carries on from where it held.
    func resumeInk() {
        guard inkPen.held else { return }
        inkPen.held = false
        let now = Date().timeIntervalSinceReferenceDate
        for model in models {
            for i in model.ink.indices { if let due = inkPen.waiting[model.ink[i].id] { model.ink[i].start = now + due } }
        }
        inkPen.waiting = [:]
        scheduleInkSettle()
    }

    /// Everything still waiting draws at once (D3 finishNow: he stopped listening, or the answer was cut).
    func finishInk() {
        let now = Date().timeIntervalSinceReferenceDate
        var finished = 0
        for model in models {
            for i in model.ink.indices where model.ink[i].eraseStart == nil && (model.ink[i].start + model.ink[i].duration > now || !model.ink[i].start.isFinite) {
                model.ink[i].start = now - model.ink[i].duration
                finished += 1
            }
        }
        inkPen.held = false
        inkPen.waiting = [:]
        if finished > 0 { Log.info("ink: finished \(finished) mark(s) at once") }
        scheduleInkSettle()
    }

    /// The tracker moved a mark with its content, or it left the window or came back.
    func inkMoved(_ id: String, by delta: CGVector, visible: Bool, screen: Int, to rect: CGRect) {
        guard let index = inkPen.screens[id], let i = models[index].ink.firstIndex(where: { $0.id == id }) else { return }
        let model = models[index]
        model.ink[i].offset.dx += delta.dx
        model.ink[i].offset.dy += delta.dy
        model.ink[i].hidden = !visible
        if let f = inkBoard.mark(id)?.frame { inkBoard.moved(id, to: f.offsetBy(dx: delta.dx, dy: -delta.dy)) }
    }

    /// The tracker dropped a mark (he switched apps, or what it marked is gone).
    func inkLost(_ id: String) {
        removeInk(id)
        Log.info("ink: \(id) went with its content")
    }

    func removeInk(_ id: String, fromBoard: Bool = true) {
        if fromBoard { inkBoard.remove([id]) }
        tracker.clear(.ink(id))
        trackedRects[.ink(id)] = nil
        if let index = inkPen.screens.removeValue(forKey: id), index < models.count { models[index].ink.removeAll { $0.id == id } }
        inkPen.waiting[id] = nil
        if inkBoard.isEmpty { inkIdle() }
    }

    /// Ink older than two minutes fades (D1).
    private func startInkFade() {
        guard inkPen.fadeTimer == nil else { return }
        inkPen.fadeTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                let old = self.inkBoard.older(than: 120)
                for id in old { self.inkEdit(.erase(id: id)) }
                if !old.isEmpty { Log.info("ink: \(old.count) mark(s) older than two minutes faded") }
            }
        }
    }

    private func inkIdle() {
        guard inkBoard.isEmpty else { return }
        inkPen.fadeTimer?.invalidate()
        inkPen.fadeTimer = nil
        inkPen.settleWork?.cancel()
    }

    /// A mark's clock runs inside the Canvas; once the last one is still, the layer redraws once more and its
    /// timeline pauses, so nothing ticks at 60 Hz with a finished drawing up.
    private func scheduleInkSettle() {
        inkPen.settleWork?.cancel()
        let now = Date().timeIntervalSinceReferenceDate
        let end = models.flatMap(\.ink).map(\.settlesAt).filter(\.isFinite).max() ?? now
        let work = DispatchWorkItem { [weak self] in self?.models.forEach { $0.objectWillChange.send() } }
        inkPen.settleWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + max(end - now, 0) + 0.05, execute: work)
    }

    nonisolated static func screenRect(fromOverlay r: CGRect, screenFrame: CGRect) -> CGRect {
        CGRect(x: screenFrame.minX + r.minX, y: screenFrame.maxY - r.maxY, width: r.width, height: r.height)
    }

    /// FNV-1a of the tag, so the same mark wobbles the same way when it is drawn again.
    nonisolated static func inkSeed(_ text: String) -> UInt64 {
        var h: UInt64 = 0xcbf29ce484222325
        for b in text.utf8 { h = (h ^ UInt64(b)) &* 0x100000001b3 }
        return h
    }
}
