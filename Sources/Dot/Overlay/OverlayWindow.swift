import AppKit
import DotKit
import SwiftUI

/// Per-screen transparent, click-through panel that hosts Dot. After Clicky's OverlayWindow
/// (MIT, Farza Majeed): screen-saver level, all Spaces, never key. A non-activating panel so
/// that, while the hotkey is held and the panel briefly takes mouse events for draw-to-ask,
/// a click never makes Dot the frontmost app.
final class OverlayWindow: NSPanel {
    let screenFrame: CGRect

    init(screen: NSScreen) {
        screenFrame = screen.frame
        super.init(contentRect: screen.frame, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        isOpaque = false
        backgroundColor = .clear
        ignoresMouseEvents = true
        collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        isFloatingPanel = true
        // After isFloatingPanel, which resets the level to .floating: Dot sits above menus and Spotlight.
        level = .screenSaver
        isReleasedWhenClosed = false
        hasShadow = false
        hidesOnDeactivate = false
        becomesKeyOnlyIfNeeded = true
        alphaValue = 0
        setFrame(screen.frame, display: true)
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

enum CompanionPhase: Equatable { case idle, listening, thinking, speaking }
enum CompanionMotion: Equatable { case following, flying, parked }

struct Ring: Equatable {
    var center: CGPoint
    var radius: CGFloat
    var label: String
    /// A hover ring completes when the cursor rests inside it; drawn dashed so it reads differently.
    var hover = false
}

/// A drawn mark: a line, an arrow, a circle (center then a point on its edge), a curve
/// through its points, or a closed polygon. Points are overlay coordinates.
struct ShapeMark: Identifiable, Equatable {
    let id = UUID()
    var kind: ShapeKind
    var points: [CGPoint]
    var label: String
    /// 0...1, the part of the stroke drawn so far (animated when the mark appears).
    var progress: CGFloat = 0
}

/// Everything one screen's view draws. Positions are overlay coordinates (top-left origin).
final class CompanionModel: ObservableObject {
    @Published var position = CGPoint(x: 200, y: 200)
    @Published var visible = false
    @Published var phase: CompanionPhase = .idle
    @Published var motion: CompanionMotion = .following
    @Published var level: Float = 0
    @Published var heading: CGFloat = 0
    @Published var lean: CGFloat = 0
    @Published var look = CGPoint.zero
    @Published var blink = false
    @Published var breath: CGFloat = 1
    @Published var scale: CGFloat = 1
    @Published var bubbleText = ""
    @Published var bubbleLabel: String?
    @Published var bubbleVisible = false
    @Published var chip: String?
    @Published var tailTo: CGPoint?
    @Published var ring: Ring?
    @Published var shapes: [ShapeMark] = []
    @Published var highlight: CGRect?
    @Published var highlightLabel: String?
    @Published var drawRect: CGRect?
    @Published var stroke: [CGPoint] = []
    @Published var color = Color(red: 1.0, green: 0.42, blue: 0.17)
    let screenSize: CGSize

    init(screenSize: CGSize) { self.screenSize = screenSize }
}

// MARK: - Views

/// The whole overlay for one screen: marks on the screen, the bubble, and the orb.
struct CompanionView: View {
    @ObservedObject var model: CompanionModel

    private let ink = Color(red: 0.05, green: 0.047, blue: 0.043)
    private let paper = Color(red: 0.925, green: 0.91, blue: 0.882)

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.black.opacity(0.001)
            if model.stroke.count >= 2 {
                Path { path in
                    path.move(to: model.stroke[0])
                    for p in model.stroke.dropFirst() { path.addLine(to: p) }
                }
                .stroke(model.color.opacity(0.9), style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                .shadow(color: model.color.opacity(0.6), radius: 4)
            } else if let rect = model.drawRect {
                Rectangle()
                    .stroke(model.color, style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
                    .background(model.color.opacity(0.07))
                    .frame(width: rect.width, height: rect.height)
                    .offset(x: rect.minX, y: rect.minY)
            }
            if let rect = model.highlight {
                RoundedRectangle(cornerRadius: 8)
                    .stroke(model.color, lineWidth: 2.5)
                    .shadow(color: model.color.opacity(0.7), radius: 8)
                    .frame(width: rect.width, height: rect.height)
                    .offset(x: rect.minX, y: rect.minY)
                if let text = model.highlightLabel, !text.isEmpty {
                    chip(text).offset(x: rect.minX, y: max(4, rect.minY - 30))
                }
            }
            ForEach(model.shapes) { mark in
                ShapeMarkView(mark: mark, color: model.color)
                if !mark.label.isEmpty, mark.progress > 0.95, let anchor = mark.points.last {
                    chip(mark.label).offset(x: anchor.x + 10, y: anchor.y - 30)
                }
            }
            if let ring = model.ring {
                RingView(ring: ring, color: model.color)
                if !ring.label.isEmpty, !(model.bubbleVisible && !model.bubbleText.isEmpty) {
                    chip(ring.label).offset(x: ring.center.x + ring.radius + 8, y: ring.center.y - 12)
                }
            }
            if let tail = model.tailTo, model.visible {
                Path { path in
                    path.move(to: model.position)
                    path.addLine(to: tail)
                }
                .stroke(model.color.opacity(0.75), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                Circle().fill(model.color).frame(width: 6, height: 6).shadow(color: model.color, radius: 4)
                    .position(tail)
            }
            if model.visible {
                OrbView(model: model)
                    .position(model.position)
                    .animation(.easeOut(duration: 0.12), value: model.level)
                if model.motion == .parked, let text = model.chip, !text.isEmpty, !(model.bubbleVisible && !model.bubbleText.isEmpty) {
                    chip(text).offset(x: model.position.x + 16, y: model.position.y + 10)
                }
                if model.bubbleVisible, !model.bubbleText.isEmpty {
                    bubble
                }
            }
        }
        .frame(width: model.screenSize.width, height: model.screenSize.height, alignment: .topLeading)
        .ignoresSafeArea()
    }

    /// Short answers get a snug bubble; long ones wrap at the max width. Measured, not guessed.
    private func bubbleWidth(for text: String, max maxWidth: CGFloat) -> CGFloat {
        let font = NSFont.systemFont(ofSize: 13.5)
        let line = (text as NSString).size(withAttributes: [.font: font]).width
        return min(maxWidth, ceil(line) + 2)
    }

    /// The bubble sits beside Dot, on the side with room, and away from the point it is showing:
    /// parked beside a target it opens to the right (or left near the edge) at Dot's height, so
    /// the thing being pointed at stays uncovered; following the cursor it hangs below.
    private var bubble: some View {
        let maxWidth: CGFloat = model.motion == .parked ? 280 : 320
        let width = bubbleWidth(for: model.bubbleText, max: maxWidth)
        let parked = model.motion == .parked
        let roomRight = model.position.x + 24 + width + 28 <= model.screenSize.width - 12
        let flip = !roomRight
        let below = model.position.y + 180 < model.screenSize.height
        return VStack(alignment: .leading, spacing: 3) {
            if let label = model.bubbleLabel, !label.isEmpty {
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(model.color)
                    .lineLimit(1)
            }
            Text(model.bubbleText)
                .font(.system(size: 13.5, weight: .regular))
                .foregroundStyle(paper)
                .lineSpacing(3)
                .lineLimit(parked ? 6 : 10)
        }
            .frame(width: width, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(ink.opacity(0.94), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.white.opacity(0.1), lineWidth: 1))
            .shadow(color: .black.opacity(0.35), radius: 14, x: 0, y: 6)
            .alignmentGuide(.leading) { d in flip ? d[.trailing] - (model.position.x - 20) : -(model.position.x + 22) }
            .alignmentGuide(.top) { d in
                if parked { return d[VerticalAlignment.center] - model.position.y }
                return below ? -(model.position.y + 18) : d[.bottom] - (model.position.y - 18)
            }
            .transition(.opacity.combined(with: .scale(scale: 0.96, anchor: .topLeading)))
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: model.bubbleVisible)
    }

    private func chip(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(paper)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(ink.opacity(0.92), in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.white.opacity(0.12)))
            .fixedSize()
    }
}

/// The ring around the control to click next, breathing so the eye finds it.
private struct RingView: View {
    let ring: Ring
    let color: Color

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let pulse = CGFloat((sin(t * 2.4) + 1) / 2)
            ZStack {
                Circle()
                    .stroke(color.opacity(0.25 + 0.2 * (1 - pulse)), lineWidth: 2)
                    .frame(width: ring.radius * 2 + 10 + pulse * 14, height: ring.radius * 2 + 10 + pulse * 14)
                Circle()
                    .stroke(color, style: StrokeStyle(lineWidth: 2.5, dash: ring.hover ? [7, 5] : []))
                    .shadow(color: color.opacity(0.8), radius: 6)
                    .frame(width: ring.radius * 2, height: ring.radius * 2)
            }
            .position(ring.center)
        }
    }
}

/// A drawn mark that strokes itself on over half a second, like a pen.
private struct ShapeMarkView: View {
    let mark: ShapeMark
    let color: Color

    var body: some View {
        ZStack(alignment: .topLeading) {
            MarkPath(kind: mark.kind, points: mark.points)
                .trim(from: 0, to: mark.progress)
                .stroke(color, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                .shadow(color: color.opacity(0.7), radius: 5)
            if mark.kind == .arrow, mark.progress > 0.92, mark.points.count >= 2 {
                ArrowHead(from: mark.points[mark.points.count - 2], to: mark.points[mark.points.count - 1])
                    .fill(color)
                    .shadow(color: color.opacity(0.7), radius: 5)
            }
        }
    }
}

/// Shapes as paths in overlay coordinates. The circle takes its center and a point on its edge.
private struct MarkPath: Shape {
    let kind: ShapeKind
    let points: [CGPoint]

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard points.count >= 2 else { return path }
        switch kind {
        case .line, .arrow:
            path.move(to: points[0])
            for p in points.dropFirst() { path.addLine(to: p) }
        case .polygon:
            path.move(to: points[0])
            for p in points.dropFirst() { path.addLine(to: p) }
            path.closeSubpath()
        case .circle:
            let c = points[0], e = points[1]
            let r = max(hypot(e.x - c.x, e.y - c.y), 8)
            path.addEllipse(in: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
        case .curve:
            path.move(to: points[0])
            if points.count == 2 {
                let a = points[0], b = points[1]
                let mid = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
                let dx = b.x - a.x, dy = b.y - a.y
                let len = max(hypot(dx, dy), 1)
                let bulge = min(len * 0.25, 60)
                let control = CGPoint(x: mid.x - dy / len * bulge, y: mid.y + dx / len * bulge)
                path.addQuadCurve(to: b, control: control)
            } else {
                // Catmull-Rom through every point, as cubic segments.
                let pts = [points[0]] + points + [points[points.count - 1]]
                for i in 1..<(pts.count - 2) {
                    let p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2]
                    let c1 = CGPoint(x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6)
                    let c2 = CGPoint(x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6)
                    path.addCurve(to: p2, control1: c1, control2: c2)
                }
            }
        }
        return path
    }
}

private struct ArrowHead: Shape {
    let from: CGPoint
    let to: CGPoint

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let angle = atan2(to.y - from.y, to.x - from.x)
        let size: CGFloat = 13
        let left = CGPoint(x: to.x - size * cos(angle - .pi / 6), y: to.y - size * sin(angle - .pi / 6))
        let right = CGPoint(x: to.x - size * cos(angle + .pi / 6), y: to.y - size * sin(angle + .pi / 6))
        path.move(to: to)
        path.addLine(to: left)
        path.addLine(to: right)
        path.closeSubpath()
        return path
    }
}

/// Dot itself: a small ember orb with two eyes. It breathes, blinks, leans into its motion,
/// squints while listening, glances up while thinking, and glows with its voice.
struct OrbView: View {
    @ObservedObject var model: CompanionModel

    private let size: CGFloat = 18

    var body: some View {
        let paused = model.phase == .idle && model.motion != .flying
        TimelineView(.animation(minimumInterval: 1 / 30, paused: paused)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let talking = model.phase == .speaking ? CGFloat((sin(t * 9) + 1) / 2) * 0.35 : 0
            let listening = model.phase == .listening ? CGFloat(model.level) : 0
            let glow = 0.35 + talking * 0.5 + listening * 0.6
            let body = size * model.breath * model.scale * (1 + listening * 0.35)
            ZStack {
                Circle()
                    .fill(model.color.opacity(glow))
                    .frame(width: body * 2.6, height: body * 2.6)
                    .blur(radius: 7)
                Circle()
                    .fill(RadialGradient(colors: [Color(red: 1.0, green: 0.78, blue: 0.5), model.color, Color(red: 0.72, green: 0.22, blue: 0.05)],
                                         center: UnitPoint(x: 0.38, y: 0.32), startRadius: 0, endRadius: body * 0.62))
                    .frame(width: body, height: body)
                    .shadow(color: model.color.opacity(0.9), radius: 5)
                    .scaleEffect(x: 1 + model.lean * 0.28, y: 1 - model.lean * 0.14)
                    .rotationEffect(.radians(Double(model.heading)))
                eyes(body: body)
                if model.phase == .thinking {
                    Circle()
                        .trim(from: 0, to: 0.33)
                        .stroke(Color.white.opacity(0.9), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                        .frame(width: body + 12, height: body + 12)
                        .rotationEffect(.degrees(t.truncatingRemainder(dividingBy: 1.0) * 360))
                }
                if model.phase == .listening {
                    waveform(level: CGFloat(model.level), t: t)
                        .offset(x: body / 2 + 14)
                }
            }
        }
    }

    private func eyes(body: CGFloat) -> some View {
        let eyeW = body * 0.17, eyeH = body * 0.34
        let squint: CGFloat = model.phase == .listening ? 0.55 : 1
        let blinkScale: CGFloat = model.blink ? 0.1 : 1
        let look = model.phase == .thinking ? CGPoint(x: 0.6, y: -0.7) : model.look
        return HStack(spacing: body * 0.2) {
            eye(width: eyeW, height: eyeH)
            eye(width: eyeW, height: eyeH)
        }
        .offset(x: look.x * body * 0.12, y: -body * 0.02 + look.y * body * 0.1)
        .scaleEffect(y: squint * blinkScale)
        .animation(.easeInOut(duration: 0.08), value: model.blink)
        .animation(.easeInOut(duration: 0.25), value: model.phase)
    }

    private func eye(width: CGFloat, height: CGFloat) -> some View {
        Capsule().fill(Color(red: 0.12, green: 0.06, blue: 0.03)).frame(width: width, height: height)
    }

    private func waveform(level: CGFloat, t: Double) -> some View {
        let profile: [CGFloat] = [0.4, 0.7, 1.0, 0.7, 0.4]
        return HStack(spacing: 2) {
            ForEach(0..<5, id: \.self) { i in
                let idle = CGFloat((sin(t * 3.6 + Double(i) * 0.35) + 1) / 2) * 1.5
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(model.color)
                    .frame(width: 2.5, height: 3 + idle + pow(min(level * 2.6, 1), 0.76) * 12 * profile[i])
            }
        }
        .shadow(color: model.color.opacity(0.6), radius: 5)
    }
}

// MARK: - Manager

/// One overlay per display and Dot's motion: it lives beside the cursor, flies along a bezier
/// arc to point at things, rings the next control in a walkthrough, and comes back.
@MainActor
final class OverlayManager {
    private var windows: [OverlayWindow] = []
    private var models: [CompanionModel] = []
    private var ticker: Timer?
    private var flightTimer: Timer?
    private var bubbleHide: DispatchWorkItem?
    private var returnWork: DispatchWorkItem?
    private var blinkWork: DispatchWorkItem?
    private var presence: Bool
    private var transientVisible = false
    private var transientFade: DispatchWorkItem?
    private var parkedScreen: Int?
    private var mouseAtPark = CGPoint.zero
    private var lastMouse = CGPoint.zero
    private var breathPhase: Double = 0
    let color: Color

    /// Dot stays beside the cursor all the time. Off: it appears for each exchange only.
    var isPresent: Bool { presence }

    init(colorHex: String, presence: Bool) {
        color = Color(hex: colorHex) ?? Color(red: 1.0, green: 0.42, blue: 0.17)
        self.presence = presence
        rebuild()
        NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.rebuild() }
        }
        startTicking()
        scheduleBlink()
        if presence { bringUp() }
    }

    func rebuild() {
        for window in windows { window.orderOut(nil) }
        windows = []
        models = []
        for screen in NSScreen.screens {
            let model = CompanionModel(screenSize: screen.frame.size)
            model.color = color
            let window = OverlayWindow(screen: screen)
            window.contentView = NSHostingView(rootView: CompanionView(model: model))
            windows.append(window)
            models.append(model)
        }
        if presence || transientVisible { bringUp() }
    }

    // MARK: Presence

    func setPresence(_ on: Bool) {
        presence = on
        if on { bringUp() } else if !transientVisible { fadeWindows() }
    }

    private func bringUp() {
        transientFade?.cancel()
        for window in windows {
            window.orderFrontRegardless()
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 0.25
                window.animator().alphaValue = 1
            }
        }
        tick(jump: true)
    }

    /// When Dot is not always present, show it for this exchange.
    func showTransient() {
        transientFade?.cancel()
        guard !presence else { return }
        transientVisible = true
        bringUp()
    }

    /// The exchange is over: when Dot is not always present, fade it out after a beat.
    func releaseTransient(after delay: TimeInterval = 1.2) {
        guard !presence, transientVisible else { return }
        transientFade?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self, !self.presence else { return }
            self.transientVisible = false
            self.fadeWindows()
        }
        transientFade = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }

    private func fadeWindows() {
        for window in windows {
            NSAnimationContext.runAnimationGroup({ ctx in
                ctx.duration = 0.35
                window.animator().alphaValue = 0
            }, completionHandler: { [weak self] in
                guard let self, !self.presence, !self.transientVisible else { return }
                window.orderOut(nil)
            })
        }
    }

    /// While the hotkey is held, the overlay takes the mouse so a drag draws a box instead of
    /// selecting text underneath. Released, it is click-through again.
    func setMouseCapture(_ on: Bool) {
        for window in windows { window.ignoresMouseEvents = !on }
    }

    // MARK: State

    func setPhase(_ phase: CompanionPhase) {
        for model in models { model.phase = phase }
    }

    func setLevel(_ level: Float) {
        for model in models { model.level = level }
    }

    /// Streamed answer text beside Dot, with an optional one-line label (what it is pointing at).
    func setBubble(_ text: String, label: String? = nil) {
        bubbleHide?.cancel()
        for model in models {
            model.bubbleText = text
            model.bubbleLabel = label
            if !text.isEmpty { model.bubbleVisible = true }
        }
    }

    func hideBubble(after delay: TimeInterval) {
        bubbleHide?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            for model in self.models { model.bubbleVisible = false }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
                guard let self, self.models.allSatisfy({ !$0.bubbleVisible }) else { return }
                for model in self.models { model.bubbleText = ""; model.bubbleLabel = nil }
            }
        }
        bubbleHide = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }

    /// A one-off line in the bubble with no speech (the morning greeting, a hello).
    func greet(_ text: String, for seconds: TimeInterval = 9) {
        if !presence { showTransient() }
        setBubble(text)
        hideBubble(after: seconds)
        if !presence { releaseTransient(after: seconds + 0.5) }
    }

    // MARK: Marks

    private func screenIndex(containing point: CGPoint) -> Int? {
        windows.firstIndex(where: { $0.screenFrame.contains(point) }) ?? windows.indices.first
    }

    /// Fly to a spot and sit beside it with a label and a tail to the exact point.
    func point(at screenPoint: CGPoint, label: String) {
        guard let index = screenIndex(containing: screenPoint) else { return }
        showTransient()
        returnWork?.cancel()
        let model = models[index]
        let target = Coordinates.overlayPoint(fromScreen: screenPoint, screenFrame: windows[index].screenFrame)
        let seat = clampToScreen(CGPoint(x: target.x + 14, y: target.y + 18), model: model)
        park(on: index)
        model.chip = nil
        model.tailTo = nil
        fly(model: model, to: seat) {
            model.motion = .parked
            model.chip = label
            model.tailTo = target
            model.look = CGPoint(x: -0.6, y: -0.6)
        }
    }

    /// Ring the control to click (or hover) next and perch beside it.
    func target(at screenPoint: CGPoint, radius: CGFloat, label: String, hover: Bool = false) {
        guard let index = screenIndex(containing: screenPoint) else { return }
        showTransient()
        returnWork?.cancel()
        let model = models[index]
        let center = Coordinates.overlayPoint(fromScreen: screenPoint, screenFrame: windows[index].screenFrame)
        model.ring = Ring(center: center, radius: max(radius, 10), label: label, hover: hover)
        let seat = clampToScreen(CGPoint(x: center.x + radius + 20, y: center.y + radius + 14), model: model)
        park(on: index)
        model.chip = nil
        model.tailTo = nil
        fly(model: model, to: seat) {
            model.motion = .parked
            model.look = CGPoint(x: -0.7, y: -0.5)
        }
    }

    func highlight(_ rect: CGRect, label: String) {
        guard rect.width > 2, rect.height > 2 else { return }
        let center = CGPoint(x: rect.midX, y: rect.midY)
        guard let index = screenIndex(containing: center) else { return }
        showTransient()
        returnWork?.cancel()
        let model = models[index]
        model.highlight = Coordinates.overlayRect(fromScreen: rect, screenFrame: windows[index].screenFrame)
        model.highlightLabel = label
        if model.motion != .parked {
            park(on: index)
            let corner = Coordinates.overlayPoint(fromScreen: CGPoint(x: rect.maxX, y: rect.minY), screenFrame: windows[index].screenFrame)
            fly(model: model, to: clampToScreen(CGPoint(x: corner.x + 12, y: corner.y + 12), model: model)) {
                model.motion = .parked
            }
        }
    }

    /// Draw a mark through screen points, stroking it on, and perch Dot at its end.
    func shape(kind: ShapeKind, points screenPoints: [CGPoint], label: String) {
        guard let first = screenPoints.first, let index = screenIndex(containing: first) else { return }
        showTransient()
        returnWork?.cancel()
        let model = models[index]
        let frame = windows[index].screenFrame
        let local = screenPoints.map { Coordinates.overlayPoint(fromScreen: $0, screenFrame: frame) }
        var mark = ShapeMark(kind: kind, points: local, label: label)
        mark.progress = 0
        model.shapes.append(mark)
        let id = mark.id
        withAnimation(.easeInOut(duration: 0.55)) {
            if let i = model.shapes.firstIndex(where: { $0.id == id }) { model.shapes[i].progress = 1 }
        }
        let anchor: CGPoint
        if kind == .circle, local.count >= 2 {
            let r = hypot(local[1].x - local[0].x, local[1].y - local[0].y)
            anchor = CGPoint(x: local[0].x + r + 18, y: local[0].y + r * 0.6)
        } else {
            anchor = CGPoint(x: (local.last ?? first).x + 18, y: (local.last ?? first).y + 18)
        }
        park(on: index)
        model.chip = nil
        model.tailTo = nil
        fly(model: model, to: clampToScreen(anchor, model: model)) {
            model.motion = .parked
            model.look = CGPoint(x: -0.6, y: -0.6)
        }
    }

    /// The box the user is drawing while holding the key, in screen coordinates; nil clears it.
    func setDrawRect(_ rect: CGRect?) {
        for (index, model) in models.enumerated() {
            guard let rect, windows[index].screenFrame.intersects(rect) else { model.drawRect = nil; if rect == nil { model.stroke = [] }; continue }
            model.drawRect = Coordinates.overlayRect(fromScreen: rect.intersection(windows[index].screenFrame), screenFrame: windows[index].screenFrame)
        }
    }

    /// The stroke he is drawing, as ink on the screen it is on.
    func setDrawPath(_ points: [CGPoint]) {
        guard let first = points.first, let index = screenIndex(containing: first) else { return }
        for (i, model) in models.enumerated() where i != index { model.stroke = [] }
        let frame = windows[index].screenFrame
        models[index].stroke = points.map { Coordinates.overlayPoint(fromScreen: $0, screenFrame: frame) }
    }

    func clearRing() {
        for model in models { model.ring = nil }
    }

    /// Marks fade, and Dot flies back to the cursor after `delay`.
    func release(after delay: TimeInterval = 2.0) {
        returnWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            for model in self.models {
                model.ring = nil
                model.highlight = nil
                model.highlightLabel = nil
                model.chip = nil
                model.tailTo = nil
                model.drawRect = nil
                model.stroke = []
                model.shapes = []
            }
            self.returnToCursor()
        }
        returnWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }

    /// Clear everything now (interrupt, new question). A walkthrough's ring can stay.
    func clearMarks(keepRing: Bool = false) {
        returnWork?.cancel()
        flightTimer?.invalidate()
        flightTimer = nil
        for model in models {
            if !keepRing { model.ring = nil }
            model.highlight = nil
            model.highlightLabel = nil
            model.chip = nil
            model.tailTo = nil
            model.drawRect = nil
            model.stroke = []
            model.shapes = []
            model.scale = 1
            model.motion = .following
        }
        parkedScreen = nil
    }

    /// Older marks go when a new beat lands somewhere else, so a tour does not pile up boxes.
    func fadeOldMarks() {
        for model in models {
            model.highlight = nil
            model.highlightLabel = nil
            if model.shapes.count > 1 { model.shapes.removeFirst(model.shapes.count - 1) }
        }
    }

    private func park(on index: Int) {
        parkedScreen = index
        mouseAtPark = NSEvent.mouseLocation
        for (i, model) in models.enumerated() where i != index { model.visible = false; model.chip = nil; model.tailTo = nil }
        models[index].visible = true
    }

    private func returnToCursor() {
        guard let index = parkedScreen else { return }
        let model = models[index]
        let mouse = NSEvent.mouseLocation
        guard let mouseIndex = screenIndex(containing: mouse) else { return }
        if mouseIndex != index {
            // The cursor is on another screen: just appear there.
            parkedScreen = nil
            model.motion = .following
            tick(jump: true)
            return
        }
        let desired = followTarget(mouse: mouse, screenFrame: windows[index].screenFrame)
        model.motion = .flying
        fly(model: model, to: desired) { [weak self] in
            model.motion = .following
            self?.parkedScreen = nil
        }
    }

    private func clampToScreen(_ p: CGPoint, model: CompanionModel) -> CGPoint {
        CGPoint(x: min(max(p.x, 24), model.screenSize.width - 24), y: min(max(p.y, 24), model.screenSize.height - 24))
    }

    // MARK: Following the cursor

    private func startTicking() {
        ticker?.invalidate()
        ticker = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick(jump: false) }
        }
    }

    private func followTarget(mouse: CGPoint, screenFrame: CGRect) -> CGPoint {
        let local = Coordinates.overlayPoint(fromScreen: mouse, screenFrame: screenFrame)
        return CGPoint(x: local.x + 24, y: local.y + 26)
    }

    private var tickCount = 0

    private func tick(jump: Bool) {
        guard presence || transientVisible else { return }
        tickCount += 1
        breathPhase += 1.0 / 60.0
        let breath = 1 + CGFloat(sin(breathPhase * 2.4)) * 0.035
        let breatheNow = tickCount % 5 == 0   // 12 Hz is enough for a slow swell and keeps idle CPU low
        let mouse = NSEvent.mouseLocation
        let moved = hypot(mouse.x - lastMouse.x, mouse.y - lastMouse.y)
        lastMouse = mouse

        // A parked Dot waits; if the cursor goes far while it is flying back, it snaps to following.
        if let parked = parkedScreen {
            let model = models[parked]
            if breatheNow { model.breath = breath }
            if model.motion == .flying, hypot(mouse.x - mouseAtPark.x, mouse.y - mouseAtPark.y) > 100 {
                flightTimer?.invalidate()
                flightTimer = nil
                model.motion = .following
                model.scale = 1
                parkedScreen = nil
            } else {
                return
            }
        }

        for (index, window) in windows.enumerated() {
            let model = models[index]
            guard window.screenFrame.contains(mouse) else {
                if model.visible { model.visible = false }
                continue
            }
            if !model.visible { model.visible = true }
            if breatheNow { model.breath = breath }
            let desired = followTarget(mouse: mouse, screenFrame: window.screenFrame)
            if jump || model.motion != .following {
                if jump { model.position = desired; model.lean = 0 }
                continue
            }
            let dx = desired.x - model.position.x, dy = desired.y - model.position.y
            let distance = hypot(dx, dy)
            if distance < 0.4, moved < 0.5 {
                if model.lean > 0.01 { model.lean = model.lean < 0.02 ? 0 : model.lean * 0.85 }
                if abs(model.look.x) > 0.02 || abs(model.look.y) > 0.02 {
                    model.look = CGPoint(x: model.look.x * 0.9, y: model.look.y * 0.9)
                } else if model.look != .zero {
                    model.look = .zero
                }
                continue
            }
            let alpha: CGFloat = 0.28
            model.position = CGPoint(x: model.position.x + dx * alpha, y: model.position.y + dy * alpha)
            let speed = min(distance / 60, 1)
            model.lean = model.lean + (speed * 0.9 - model.lean) * 0.3
            if distance > 2 {
                model.heading = atan2(dy, dx)
                model.look = CGPoint(x: max(-1, min(1, dx / 40)), y: max(-1, min(1, dy / 40)))
            }
        }
    }

    private func scheduleBlink() {
        blinkWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            for model in self.models where model.visible { model.blink = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.11) {
                for model in self.models { model.blink = false }
            }
            self.scheduleBlink()
        }
        blinkWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Double.random(in: 2.6...6.5), execute: work)
    }

    // MARK: Flight (Clicky's quadratic bezier with smoothstep easing)

    private func fly(model: CompanionModel, to destination: CGPoint, completion: @escaping () -> Void) {
        flightTimer?.invalidate()
        let start = model.position
        let distance = hypot(destination.x - start.x, destination.y - start.y)
        if distance < 2 { model.position = destination; model.lean = 0; completion(); return }
        model.motion = .flying
        let duration = min(max(Double(distance) / 900.0, 0.45), 1.2)
        let frames = max(Int(duration * 60), 1)
        var frame = 0
        let mid = CGPoint(x: (start.x + destination.x) / 2, y: (start.y + destination.y) / 2)
        let arc = min(distance * 0.2, 80)
        let control = CGPoint(x: mid.x, y: mid.y - arc)
        flightTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] timer in
            frame += 1
            if frame > frames {
                timer.invalidate()
                self?.flightTimer = nil
                model.position = destination
                model.scale = 1
                model.lean = 0
                completion()
                return
            }
            let linear = Double(frame) / Double(frames)
            let t = linear * linear * (3 - 2 * linear)
            let u = 1 - t
            let x = u * u * start.x + 2 * u * t * control.x + t * t * destination.x
            let y = u * u * start.y + 2 * u * t * control.y + t * t * destination.y
            let tx = 2 * u * (control.x - start.x) + 2 * t * (destination.x - control.x)
            let ty = 2 * u * (control.y - start.y) + 2 * t * (destination.y - control.y)
            model.position = CGPoint(x: x, y: y)
            model.heading = atan2(ty, tx)
            model.lean = CGFloat(sin(linear * .pi)) * 0.9
            model.scale = 1 + CGFloat(sin(linear * .pi)) * 0.3
            model.look = CGPoint(x: max(-1, min(1, tx / 30)), y: max(-1, min(1, ty / 30)))
        }
    }
}

extension Color {
    init?(hex: String) {
        var text = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.hasPrefix("#") { text.removeFirst() }
        guard text.count == 6, let value = UInt32(text, radix: 16) else { return nil }
        self.init(red: Double((value >> 16) & 0xFF) / 255, green: Double((value >> 8) & 0xFF) / 255, blue: Double(value & 0xFF) / 255)
    }
}
