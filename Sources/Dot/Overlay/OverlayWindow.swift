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
        // The window tells its orb what the system says (VI-07): covered or not, Reduce Motion or not.
        NotificationCenter.default.addObserver(self, selector: #selector(occlusionChanged), name: NSWindow.didChangeOcclusionStateNotification, object: self)
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(displayOptionsChanged),
                                                          name: NSWorkspace.accessibilityDisplayOptionsDidChangeNotification, object: nil)
    }

    private var companion: CompanionModel? { (contentView as? NSHostingView<CompanionView>)?.rootView.model }

    @objc private func occlusionChanged() {
        let covered = !occlusionState.contains(.visible)
        if companion?.occluded != covered { companion?.occluded = covered }
    }

    @objc private func displayOptionsChanged() {
        companion?.reduceMotion = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
    }

    deinit {
        NSWorkspace.shared.notificationCenter.removeObserver(self)
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

enum CompanionPhase: Equatable { case idle, listening, thinking, speaking }
/// The face: what Dot feels about the moment, on top of the phase.
enum CompanionMood: Equatable { case neutral, happy, puzzled, focused, sleepy }
enum CompanionMotion: Equatable { case following, flying, parked, perched }

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

/// Where a mark went when it scrolled out of the window: a chevron on that edge, in overlay coordinates.
struct EdgeHint: Equatable {
    var point: CGPoint
    var edge: MarkEdge
    var label: String
}

/// Everything one screen's view draws. Positions are overlay coordinates (top-left origin).
final class CompanionModel: ObservableObject {
    @Published var position = CGPoint(x: 200, y: 200)
    @Published var visible = false
    @Published var phase: CompanionPhase = .idle
    @Published var mood: CompanionMood = .neutral
    @Published var motion: CompanionMotion = .following
    @Published var level: Float = 0
    /// Where Dot looks while parked beside a mark (-1...1 per axis); the animator reads it.
    var look = CGPoint.zero
    /// Everything the face and body do this frame (DotKit's OrbAnimator, docs/alive.md).
    @Published var pose = OrbPose.rest
    /// The orb's diameter in points (`orbSize`, default 24).
    @Published var orbSize: CGFloat = 24
    /// The gap between the eyes, as a fraction of the orb (0.20; the previews compare 0.16 and 0.24).
    var eyeGap: CGFloat = 0.20
    @Published var bubbleText = ""
    @Published var bubbleLabel: String?
    @Published var bubbleVisible = false
    /// Force the bubble to open on one side (true = to the left), while Dot sits beside a card.
    @Published var bubbleFlip: Bool?
    @Published var chip: String?
    @Published var tailTo: CGPoint?
    @Published var ring: Ring?
    @Published var shapes: [ShapeMark] = []
    @Published var highlight: CGRect?
    @Published var highlightLabel: String?
    /// 0...1: the highlight's dashed outline draws itself on when it lands.
    @Published var highlightProgress: CGFloat = 1
    /// The ringed control was clicked: a filled pulse before the ring goes.
    @Published var ringDone = false
    @Published var drawRect: CGRect?
    @Published var stroke: [CGPoint] = []
    /// Strokes already finished while the key stays held (he can mark two things).
    @Published var strokes: [[CGPoint]] = []
    @Published var color = Color(red: 1.0, green: 0.42, blue: 0.17)
    /// A walkthrough ring scrolled out of view: a chevron at the window edge points to it (round eight).
    @Published var edgeHint: EdgeHint?

    /// What an agent is doing now (nil while none works): a small glyph circles the orb (VI-04).
    @Published var agentActivity: AgentActivity?
    /// Agents waiting on his yes: the orb pulses while any do.
    @Published var agentsWaiting = 0
    /// Reduce Motion is on (VI-07): no flights, no orbit, no pulse; the glyph and a ring hold still.
    /// Kept current by OverlayWindow.
    @Published var reduceMotion = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
    /// The overlay window is covered (the display asleep, a lock screen): the orb's timeline rests.
    @Published var occluded = false
    let screenSize: CGSize

    /// The last `.dotAgentActivity` report, so a screen added later starts from it.
    static var agentReport = AgentActivityReport(activity: nil)

    init(screenSize: CGSize) {
        self.screenSize = screenSize
        apply(Self.agentReport)
    }

    func apply(_ report: AgentActivityReport) {
        if agentActivity != report.activity { agentActivity = report.activity }
        if agentsWaiting != report.waiting { agentsWaiting = report.waiting }
    }
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
            ForEach(Array(model.strokes.enumerated()), id: \.offset) { _, points in
                if points.count >= 2 {
                    Path { path in
                        path.move(to: points[0])
                        for p in points.dropFirst() { path.addLine(to: p) }
                    }
                    .stroke(model.color.opacity(0.9), style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                    .shadow(color: model.color.opacity(0.6), radius: 4)
                }
            }
            if model.stroke.count >= 2 {
                Path { path in
                    path.move(to: model.stroke[0])
                    for p in model.stroke.dropFirst() { path.addLine(to: p) }
                }
                .stroke(model.color.opacity(0.9), style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                .shadow(color: model.color.opacity(0.6), radius: 4)
            } else if let rect = model.drawRect, model.strokes.isEmpty {
                Rectangle()
                    .stroke(model.color, style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
                    .background(model.color.opacity(0.07))
                    .frame(width: rect.width, height: rect.height)
                    .offset(x: rect.minX, y: rect.minY)
            }
            if let rect = model.highlight {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .trim(from: 0, to: model.highlightProgress)
                    .stroke(model.color, style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [7, 5]))
                    .background(model.color.opacity(0.06 * Double(model.highlightProgress)), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .shadow(color: model.color.opacity(0.35), radius: 3)
                    .frame(width: rect.width, height: rect.height)
                    .offset(x: rect.minX, y: rect.minY)
                if let text = model.highlightLabel, !text.isEmpty, !(model.bubbleVisible && !model.bubbleText.isEmpty) {
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
                RingView(ring: ring, color: model.color, done: model.ringDone)
                    .transition(.scale(scale: 0.55).combined(with: .opacity))
                if !ring.label.isEmpty, !(model.bubbleVisible && !model.bubbleText.isEmpty) {
                    chip(ring.label).offset(x: ring.center.x + ring.radius + 8, y: ring.center.y - 12)
                        .transition(.opacity)
                }
            }
            if let hint = model.edgeHint {
                EdgeChevron(hint: hint, color: model.color)
                    .position(hint.point)
                    .transition(.opacity)
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
                // With Reduce Motion there is no flight to watch: Dot leaves and turns up at the spot.
                OrbView(model: model)
                    .position(model.position)
                    .animation(.easeOut(duration: 0.12), value: model.level)
                    .opacity(model.reduceMotion && model.motion == .flying ? 0 : 1)
                    .animation(.easeInOut(duration: 0.15), value: model.reduceMotion && model.motion == .flying)
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
        let font = NSFont.systemFont(ofSize: 12.5)
        let line = (text as NSString).size(withAttributes: [.font: font]).width
        return min(maxWidth, ceil(line) + 2)
    }

    /// The bubble sits beside Dot, on the side with room, and away from the point it is showing:
    /// parked beside a target it opens to the right (or left near the edge) at Dot's height, so
    /// the thing being pointed at stays uncovered; following the cursor it hangs below.
    private var bubble: some View {
        let maxWidth: CGFloat = model.motion == .parked ? 240 : 260
        let width = bubbleWidth(for: model.bubbleText, max: maxWidth)
        let parked = model.motion == .parked
        let roomRight = model.position.x + 24 + width + 28 <= model.screenSize.width - 12
        let roomLeft = model.position.x - 20 - width - 28 >= 12
        let flip = model.bubbleFlip.map { $0 ? roomLeft : !roomRight } ?? !roomRight
        let below = model.position.y + 180 < model.screenSize.height
        // A quiet note beside Dot (a greeting, an offer, a short line): light paper, two lines at
        // most, nothing that reads as a panel over his page. Spoken answers do not come here; their
        // words are in the voice and the current line sits in the notch.
        return VStack(alignment: .leading, spacing: 2) {
            if let label = model.bubbleLabel, !label.isEmpty {
                Text(label)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(model.color)
                    .lineLimit(1)
            }
            Text(model.bubbleText)
                .font(.system(size: 12.5, weight: .regular))
                .foregroundStyle(ink)
                .lineSpacing(2)
                .lineLimit(2)
                .truncationMode(.tail)
        }
            .frame(width: width, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(paper.opacity(0.97), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous).stroke(ink.opacity(0.1), lineWidth: 1))
            .shadow(color: .black.opacity(0.18), radius: 8, x: 0, y: 3)
            .alignmentGuide(.leading) { d in flip ? d[.trailing] - (model.position.x - 20) : -(model.position.x + 22) }
            .alignmentGuide(.top) { d in
                if parked { return d[VerticalAlignment.center] - model.position.y }
                return below ? -(model.position.y + 18) : d[.bottom] - (model.position.y - 18)
            }
            .transition(.opacity.combined(with: .scale(scale: 0.96, anchor: .topLeading)))
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: model.bubbleVisible)
    }

    /// A solid label in the accent color with white text, the way HeyClicky's label chips read
    /// against any page (measured from the 2026-10-15 session frames: 13 px semibold, 6 px corners).
    private func chip(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12.5, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(model.color, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
            .shadow(color: .black.opacity(0.25), radius: 4, x: 0, y: 2)
            .fixedSize()
    }
}

/// A ring that scrolled out of view: a chevron pointing toward it with "scroll up/down" under it.
private struct EdgeChevron: View {
    let hint: EdgeHint
    let color: Color
    var body: some View {
        let angle: Double = { switch hint.edge { case .top: return 0; case .right: return 90; case .bottom: return 180; case .left: return 270 } }()
        let word: String = { switch hint.edge { case .top: return "scroll up"; case .bottom: return "scroll down"; case .left: return "scroll left"; case .right: return "scroll right" } }()
        VStack(spacing: 3) {
            Image(systemName: "chevron.up")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(.white)
                .rotationEffect(.degrees(angle))
                .frame(width: 30, height: 30)
                .background(color, in: Circle())
                .shadow(color: color.opacity(0.6), radius: 6)
            Text(hint.label.isEmpty ? word : "\(word): \(hint.label)")
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 7).padding(.vertical, 3)
                .background(Color.black.opacity(0.55), in: Capsule())
                .fixedSize()
        }
    }
}

/// The ring around the control to click next, breathing so the eye finds it.
private struct RingView: View {
    let ring: Ring
    let color: Color
    var done = false

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let pulse = CGFloat((sin(t * 2.4) + 1) / 2)
            ZStack {
                if done {
                    // The click landed: the ring fills and swells once, then goes.
                    Circle().fill(color.opacity(0.35)).frame(width: ring.radius * 2, height: ring.radius * 2)
                        .transition(.scale(scale: 1.6).combined(with: .opacity))
                }
                Circle()
                    .stroke(color.opacity(0.18 + 0.18 * (1 - pulse)), lineWidth: 1.5)
                    .frame(width: ring.radius * 2 + 10 + pulse * 14, height: ring.radius * 2 + 10 + pulse * 14)
                // Dashed for a click, dotted for a hover: the target ring HeyClicky draws, in Dot's color.
                Circle()
                    .stroke(color, style: StrokeStyle(lineWidth: 2.2, lineCap: .round, dash: ring.hover ? [1, 6] : [7, 5]))
                    .shadow(color: color.opacity(0.45), radius: 3)
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

/// Dot itself: a small ember orb with big, low-set eyes (docs/alive.md). Everything the face and body do
/// comes from `model.pose`, which DotKit's OrbAnimator computes each frame: blinks, eye jumps, eyelid
/// moods, squash and stretch, hops, the tilt, the blush and the speaking mouth. The view only draws it.
/// While an agent works a small glyph for what it is doing circles the orb, and while one waits on him
/// it pulses; those, the thinking arc and the listening bars keep their own clock.
struct OrbView: View {
    @ObservedObject var model: CompanionModel

    private let ink = Color(red: 0.12, green: 0.06, blue: 0.03)

    var body: some View {
        // Only the decorations need a clock; the pose arrives from OverlayManager's tick. With Reduce
        // Motion or nothing to decorate, the timeline rests.
        let agentMotion = !model.reduceMotion && (model.agentActivity != nil || model.agentsWaiting > 0)
        let decorating = agentMotion || model.phase == .thinking || model.phase == .listening
        TimelineView(.animation(minimumInterval: 1 / 30, paused: model.occluded || !decorating)) { context in
            orb(t: context.date.timeIntervalSinceReferenceDate)
        }
    }

    private func orb(t: Double) -> some View {
        let pose = model.pose
        let size = model.orbSize
        let listening = model.phase == .listening ? CGFloat(model.level) : 0
        let talking = model.phase == .speaking ? CGFloat(pose.mouthOpen) : 0
        let body = size * CGFloat(pose.breath) * (1 + listening * 0.35)
        let glow = min((0.35 + talking * 0.4 + listening * 0.6) * CGFloat(pose.glow), 1)
        return ZStack {
            Circle()
                .fill(model.color.opacity(glow))
                .frame(width: body * 2.6, height: body * 2.6)
                .blur(radius: 7 * size / 20)
            if model.agentsWaiting > 0 {
                waitingPulse(body: body, t: t)
            }
            // The orb and its face squash, stretch and turn together; the area never changes.
            ZStack {
                Circle()
                    .fill(RadialGradient(colors: [Color(red: 1.0, green: 0.78, blue: 0.5), model.color, Color(red: 0.72, green: 0.22, blue: 0.05)],
                                         center: UnitPoint(x: 0.38, y: 0.32), startRadius: 0, endRadius: body * 0.62))
                    .frame(width: body, height: body)
                    .shadow(color: model.color.opacity(0.9), radius: 5 * size / 20)
                if pose.blush > 0 {
                    cheeks(body: body, amount: pose.blush)
                }
                eyes(body: body, pose: pose)
                if pose.mouthVisible {
                    mouth(body: body, pose: pose)
                        .offset(y: body * 0.31)
                }
            }
            .rotationEffect(.radians(-pose.stretchAngle))
            .scaleEffect(x: CGFloat(pose.squash.along), y: CGFloat(pose.squash.across))
            .rotationEffect(.radians(pose.stretchAngle + pose.rotation))
            if let glyph = pose.glyph {
                glyphView(glyph, progress: pose.glyphProgress, body: body)
            }
            if model.phase == .thinking {
                Circle()
                    .trim(from: 0, to: 0.33)
                    .stroke(Color.white.opacity(0.9), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                    .frame(width: body + 12, height: body + 12)
                    .rotationEffect(.degrees(model.reduceMotion ? -90 : t.truncatingRemainder(dividingBy: 1.0) * 360))
            }
            if model.phase == .listening {
                waveform(level: CGFloat(model.level), t: t)
                    .offset(x: body / 2 + 14)
            }
            // While he talks the waveform has that side; the agent glyph steps away until he is done.
            if let activity = model.agentActivity, model.phase != .listening {
                orbiting(activity, body: body, t: t)
            }
        }
        .offset(x: pose.offset.x * size, y: pose.offset.y * size)
        .animation(.easeOut(duration: 0.25), value: model.agentActivity)
    }

    /// Two eyes, each 0.20 x 0.40 of the orb, centered a little below its middle (baby schema: big,
    /// low-set eyes, cute-C31, C32, C52), with a white highlight upper left in both (cute-C9, C10).
    private func eyes(body: CGFloat, pose: OrbPose) -> some View {
        HStack(spacing: body * model.eyeGap) {
            EyeView(eye: pose.left, width: body * 0.20, height: body * 0.40, body: body, ink: ink)
            EyeView(eye: pose.right, width: body * 0.20, height: body * 0.40, body: body, ink: ink)
        }
        .offset(x: pose.gaze.x * body, y: body * 0.05 + pose.gaze.y * body)
    }

    /// A tiny mouth, never wider than a fifth of the orb (cute-C32): a small round "o" that opens with
    /// the voice while speaking, a little smile when happy.
    @ViewBuilder
    private func mouth(body: CGFloat, pose: OrbPose) -> some View {
        let open = CGFloat(pose.mouthOpen)
        if open > 0.02 {
            Ellipse()
                .fill(ink)
                .frame(width: body * (0.09 + 0.07 * open), height: body * (0.035 + 0.12 * open))
        } else {
            MouthShape(curve: CGFloat(pose.mouthCurve), open: 0)
                .stroke(ink, style: StrokeStyle(lineWidth: max(body * 0.06, 1.1), lineCap: .round))
                .frame(width: body * 0.15, height: body * 0.08)
        }
    }

    /// Soft rose cheeks below and outside the eyes, for petting and praise.
    private func cheeks(body: CGFloat, amount: Double) -> some View {
        HStack(spacing: body * 0.42) {
            Ellipse().frame(width: body * 0.18, height: body * 0.10)
            Ellipse().frame(width: body * 0.18, height: body * 0.10)
        }
        .foregroundStyle(Color(red: 1.0, green: 0.52, blue: 0.62).opacity(0.55 * amount))
        .blur(radius: body * 0.02)
        .offset(y: body * 0.26)
    }

    /// The sleeping "z" floating up and away, or the "!" of waking.
    @ViewBuilder
    private func glyphView(_ glyph: OrbGlyph, progress: Double, body: CGFloat) -> some View {
        switch glyph {
        case .sleeping:
            Text("z")
                .font(.system(size: max(body * 0.5, 9), weight: .heavy, design: .rounded))
                .foregroundStyle(Color(red: 0.72, green: 0.22, blue: 0.05))
                .shadow(color: .white.opacity(0.9), radius: 1)
                .offset(x: body * (0.55 + 0.15 * progress), y: -body * (0.5 + 0.5 * progress))
                .opacity(progress < 0.15 ? progress / 0.15 : 1 - (progress - 0.15) / 0.85)
        case .alert:
            Text("!")
                .font(.system(size: max(body * 0.6, 10), weight: .black, design: .rounded))
                .foregroundStyle(Color(red: 0.72, green: 0.22, blue: 0.05))
                .shadow(color: .white.opacity(0.9), radius: 1)
                .scaleEffect(progress < 0.2 ? 0.6 + progress * 2.5 : 1.1 - min(progress, 1) * 0.1)
                .offset(y: -body * 0.95)
        }
    }

    /// The agent's glyph on a small dark disc, circling the orb on a tilted ellipse: in front of Dot
    /// on the near half, behind it (smaller, dimmer) on the far half, once every 3.6 s. With Reduce
    /// Motion it sits still at the upper right, like a badge.
    @ViewBuilder
    private func orbiting(_ activity: AgentActivity, body: CGFloat, t: Double) -> some View {
        let disc = max(body * 0.72, 13)
        let glyph = ZStack {
            Circle().fill(Color(red: 0.12, green: 0.06, blue: 0.03).opacity(0.92))
            Circle().stroke(model.color.opacity(0.95), lineWidth: 1)
            Image(systemName: activity.symbol)
                .font(.system(size: disc * 0.5, weight: .semibold))
                .foregroundStyle(Color.white)
        }
        .frame(width: disc, height: disc)
        .shadow(color: .black.opacity(0.35), radius: 2, x: 0, y: 1)
        .id(activity)
        .transition(model.reduceMotion ? .opacity : .scale(scale: 0.4).combined(with: .opacity))
        if model.reduceMotion {
            glyph.offset(x: body / 2 + 6, y: -body / 2 - 2).zIndex(2)
        } else {
            let angle = t * 2 * .pi / 3.6
            let rx = body / 2 + 13, ry = rx * 0.55
            let near = sin(angle) >= 0
            glyph
                .scaleEffect(0.8 + 0.2 * CGFloat((sin(angle) + 1) / 2))
                .opacity(near ? 1 : 0.6)
                .offset(x: CGFloat(cos(angle)) * rx, y: CGFloat(sin(angle)) * ry)
                .zIndex(near ? 2 : -1)
        }
    }

    /// An agent waits on his yes: two rings swell out of the orb and fade, over and over. With
    /// Reduce Motion, one steady ring instead.
    @ViewBuilder
    private func waitingPulse(body: CGFloat, t: Double) -> some View {
        if model.reduceMotion {
            Circle()
                .stroke(model.color.opacity(0.9), lineWidth: 1.8)
                .frame(width: body * 1.7, height: body * 1.7)
        } else {
            ForEach(0..<2, id: \.self) { i in
                let p = CGFloat((t / 1.6 + Double(i) * 0.5).truncatingRemainder(dividingBy: 1))
                Circle()
                    .stroke(model.color.opacity(0.95 * Double(1 - p)), lineWidth: 2.2 - p)
                    .frame(width: body * (1.15 + p * 1.45), height: body * (1.15 + p * 1.45))
            }
        }
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

/// One eye: a dark capsule that the blink flattens (and widens, craft-A2-12), the upper lid lowers and
/// the lower lid lifts into a happy arch (Cozmo's slits, craft-A2-18), with its highlight; shut, it is a
/// small curved line.
struct EyeView: View {
    let eye: OrbEyePose
    let width: CGFloat
    let height: CGFloat
    /// The orb's diameter, for line widths and the highlight.
    let orb: CGFloat
    let ink: Color

    init(eye: OrbEyePose, width: CGFloat, height: CGFloat, body: CGFloat, ink: Color) {
        self.eye = eye
        self.width = width
        self.height = height
        self.orb = body
        self.ink = ink
    }

    var body: some View {
        let w = width * CGFloat(eye.widen * eye.scale)
        let h = height * CGFloat(eye.scale)
        let open = CGFloat(eye.openness)
        let shut = open < 0.12 || eye.upperLid > 0.97
        // Happy: the lower lid's rise hands over to a stroked arch, the classic happy eye.
        let arch = min(max((CGFloat(eye.lowerLid) - 0.25) / 0.25, 0), 1)
        return ZStack {
            if shut {
                ClosedEye()
                    .stroke(ink, style: StrokeStyle(lineWidth: max(orb * 0.07, 1.1), lineCap: .round))
                    .frame(width: w * 1.15, height: max(h * 0.16, 2))
                    .offset(y: h * 0.12)
            } else {
                if arch < 1 {
                    Capsule()
                        .fill(ink)
                        .frame(width: w, height: h)
                        .mask(LidMask(upper: CGFloat(eye.upperLid), lower: CGFloat(eye.lowerLid)).fill(style: FillStyle(eoFill: true)))
                        .overlay(alignment: .topLeading) {
                            if eye.upperLid < 0.35, eye.lowerLid < 0.3 {
                                Circle()
                                    .fill(Color.white.opacity(0.95))
                                    .frame(width: max(orb * 0.07, 1.6), height: max(orb * 0.07, 1.6))
                                    .offset(x: w * 0.2, y: h * 0.16)
                            }
                        }
                        .scaleEffect(y: max(open, 0.05), anchor: UnitPoint(x: 0.5, y: 0.6))
                        .opacity(Double(1 - arch))
                }
                if arch > 0 {
                    HappyEye()
                        .stroke(ink, style: StrokeStyle(lineWidth: max(orb * 0.08, 1.3), lineCap: .round))
                        .frame(width: w * 1.2, height: h * 0.36)
                        .offset(y: -h * 0.06)
                        .opacity(Double(arch))
                }
            }
        }
        .frame(width: w, height: h)
        .rotationEffect(.radians(eye.tilt))
    }
}

/// A happy eye: an upward arch, like a smile turned over.
struct HappyEye: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.maxY), control: CGPoint(x: rect.midX, y: rect.minY - rect.height * 0.9))
        return path
    }
}

/// What the lids leave of the eye: everything below the upper lid's edge, minus an ellipse rising from
/// below for the lower lid, so a happy eye becomes an arch.
struct LidMask: Shape {
    var upper: CGFloat
    var lower: CGFloat
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let lid = min(max(upper, 0), 1)
        path.addRect(CGRect(x: rect.minX - 1, y: rect.minY - 1, width: rect.width + 2, height: rect.height + 2))
        if lid > 0.01 {
            // The upper lid's edge bows down a little in the middle, so a drowsy eye reads sleepy, not bored.
            let rx = rect.width * 1.1, ry = rect.height * 0.8
            let edge = rect.minY + rect.height * lid
            path.addEllipse(in: CGRect(x: rect.midX - rx, y: edge - ry * 2, width: rx * 2, height: ry * 2))
        }
        if lower > 0.01 {
            let rx = rect.width * 0.62, ry = rect.height * 0.55
            let crest = rect.maxY - rect.height * min(lower, 1)
            path.addEllipse(in: CGRect(x: rect.midX - rx, y: crest, width: rx * 2, height: ry * 2))
        }
        return path
    }
}

/// A shut eye: a soft downward curve, like a contented cat's.
struct ClosedEye: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY), control: CGPoint(x: rect.midX, y: rect.maxY * 1.6))
        return path
    }
}

/// A mouth: a quadratic curve bent by `curve` (positive smiles), opened into a lens by `open`.
struct MouthShape: Shape {
    var curve: CGFloat
    var open: CGFloat
    var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { AnimatablePair(curve, open) }
        set { curve = newValue.first; open = newValue.second }
    }
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let left = CGPoint(x: rect.minX, y: rect.midY), right = CGPoint(x: rect.maxX, y: rect.midY)
        let bend = rect.width * curve * 0.6
        path.move(to: left)
        path.addQuadCurve(to: right, control: CGPoint(x: rect.midX, y: rect.midY + bend + open * 0.5))
        if open > 0.6 {
            path.addQuadCurve(to: left, control: CGPoint(x: rect.midX, y: rect.midY + bend - open * 0.9))
        }
        return path
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
    private var presence: Bool
    private var ringDoneWork: DispatchWorkItem?
    private var transientVisible = false
    private var transientFade: DispatchWorkItem?
    private var parkedScreen: Int?
    private var mouseAtPark = CGPoint.zero
    private var lastMouse = CGPoint.zero
    /// The face and body of each screen's orb (DotKit's OrbAnimator, docs/alive.md), the spring it
    /// follows the cursor on, and what it reads to be a pet: an approaching cursor, a rub, a fling.
    private var animators: [OrbAnimator] = []
    private var followers: [Spring2D] = []
    private var lazyZones: [LazyZone] = []
    private var rubs: [RubDetector] = []
    private var leads: [CGVector] = []
    private var speeds: [Double] = []
    private var rubbing: [Bool] = []
    private var fling = FlingDetector()
    private var chasing = false
    private var chaseSettlesAt: Double = 0
    private var pounceCheckAt: Double?
    private var flingStoppedAt: Double = 0
    /// The pet routine: Dot walked off his text to a window edge and is grooming, drowsing or asleep.
    private var perched = false
    private var mouseAtPerch = CGPoint.zero
    private var perchStartedAt: Double = 0
    private var idleAtPerch: Double = 0
    private var wakeReturnAt: Double?
    private var lastTickTime: Double?
    private var lastMouseMoveAt: Double = 0
    /// Seconds since any mouse, key or scroll input, since a key, and since a click, read at 4 Hz.
    private var sinceInput: Double = 0
    private var sinceKey: Double = .infinity
    private var sinceClick: Double = .infinity
    private var inputReadAt: Double = 0
    private var quiet = false
    private var quietCheckedAt: Double = -10
    private var speechLevel: Double = 0
    private var speechMetered = true
    private(set) var orbSize: CGFloat
    /// Whether he wants quiet now (on a call with "quiet on calls" set); AppDelegate supplies it.
    var isQuiet: (() -> Bool)?
    /// Dot woke from its pet routine after `idle` seconds without input: the quip hook.
    var onWake: ((TimeInterval) -> Void)?
    /// He started rubbing Dot.
    var onPetted: (() -> Void)?
    private(set) var color: Color
    /// Keeps marks on the content while he scrolls (round eight).
    private let tracker = MarkTracker()
    /// The last placed geometry of each tracked mark (AppKit), to turn a tracker move into a delta.
    private var trackedRects: [MarkTracker.Kind: CGRect] = [:]
    /// Marks hidden because their content scrolled out of view, restored when it comes back.
    private var hiddenRing: (Ring, Int)?
    private var hiddenHighlight: (CGRect, Int)?

    /// A new accent from Settings, applied to every screen's marks and the orb.
    func setColor(hex: String) {
        guard let next = Color(hex: hex) else { return }
        color = next
        for model in models { model.color = next }
    }

    /// Dot stays beside the cursor all the time. Off: it appears for each exchange only.
    var isPresent: Bool { presence }

    init(colorHex: String, presence: Bool, orbSize: CGFloat = 24) {
        color = Color(hex: colorHex) ?? Color(red: 1.0, green: 0.42, blue: 0.17)
        self.presence = presence
        self.orbSize = min(max(orbSize, 16), 36)
        rebuild()
        NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.rebuild() }
        }
        // Agents on the orb (VI-04): each post is the whole state (AgentActivityReport); a screen
        // made later starts from the last one.
        NotificationCenter.default.addObserver(forName: .dotAgentActivity, object: nil, queue: .main) { [weak self] note in
            let report = AgentActivityReport(userInfo: note.userInfo)
            Task { @MainActor in
                CompanionModel.agentReport = report
                self?.models.forEach { $0.apply(report) }
            }
        }
        startTicking()
        if presence { bringUp() }
        tracker.onUpdate = { [weak self] kind, rect, visible, edge in self?.trackerMoved(kind, to: rect, visible: visible, edge: edge) }
    }

    func rebuild() {
        for window in windows { window.orderOut(nil) }
        windows = []
        models = []
        animators = []
        followers = []
        lazyZones = []
        rubs = []
        leads = []
        speeds = []
        rubbing = []
        for screen in NSScreen.screens {
            let model = CompanionModel(screenSize: screen.frame.size)
            model.color = color
            model.orbSize = orbSize
            let window = OverlayWindow(screen: screen)
            window.contentView = NSHostingView(rootView: CompanionView(model: model))
            windows.append(window)
            models.append(model)
            animators.append(OrbAnimator(seed: UInt64.random(in: 1...UInt64.max)))
            followers.append(Spring2D(position: model.position))
            lazyZones.append(LazyZone())
            rubs.append(RubDetector())
            leads.append(.zero)
            speeds.append(0)
            rubbing.append(false)
        }
        perched = false
        wakeReturnAt = nil
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

    private var moodWork: DispatchWorkItem?

    /// A feeling for a moment: happy when something worked, puzzled when it did not,
    /// focused while he talks. Falls back to neutral after `seconds` unless told otherwise.
    func setMood(_ mood: CompanionMood, for seconds: TimeInterval? = nil) {
        moodWork?.cancel()
        for model in models { model.mood = mood }
        if let seconds {
            let work = DispatchWorkItem { [weak self] in self?.models.forEach { $0.mood = .neutral } }
            moodWork = work
            DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
        }
    }

    /// The small chip beside Dot: what it is hearing while the key is held.
    func setChip(_ text: String?) {
        for model in models { model.chip = text }
    }

    func setLevel(_ level: Float) {
        for model in models { model.level = level }
    }

    // MARK: Alive (docs/alive.md)

    /// The orb's diameter (`orbSize`), 16-36 points.
    func setOrbSize(_ size: CGFloat) {
        orbSize = min(max(size, 16), 36)
        for model in models { model.orbSize = orbSize }
    }

    private var clock: Double { ProcessInfo.processInfo.systemUptime }

    /// A one-shot move on every visible orb: a hop when an agent finishes, a droop when one fails.
    func react(_ reaction: OrbReaction) {
        let now = clock
        for (index, model) in models.enumerated() where model.visible { animators[index].react(reaction, at: now) }
    }

    /// He switched apps: a glance toward the new front window and a blink.
    func appSwitched() {
        let now = clock
        for (index, model) in models.enumerated() where model.visible {
            let window = frontWindow(on: windows[index].screenFrame)
            let dx: Double = window.map { $0.midX >= model.position.x ? 1 : -1 } ?? 1
            animators[index].react(.appSwitch(dx: dx), at: now)
        }
    }

    /// He switched apps: a glance toward a known point (AppKit screen point) and a blink.
    func appSwitched(toward screenPoint: CGPoint?) {
        let now = clock
        for (index, model) in models.enumerated() where model.visible {
            var dx = 1.0
            if let screenPoint {
                let local = Coordinates.overlayPoint(fromScreen: screenPoint, screenFrame: windows[index].screenFrame)
                dx = local.x >= model.position.x ? 1 : -1
            }
            animators[index].react(.appSwitch(dx: dx), at: now)
        }
    }

    /// A spoken sentence began: blinks land at sentence starts, and the eyes come back to him before
    /// the last one ends.
    func sentenceStarted(duration: TimeInterval?, isLast: Bool) {
        let now = clock
        for animator in animators { animator.sentenceStarted(at: now, duration: duration, isLast: isLast) }
    }

    /// The voice's level for the mouth; `metered` is false for Apple's voice, which has no level to read.
    func setSpeechLevel(_ level: Double, metered: Bool) {
        speechLevel = level
        speechMetered = metered
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

    /// The overlay (orb, bubble, marks) above everything Dot owns, including board cards.
    func bringToFront() {
        for window in windows where window.alphaValue > 0 { window.orderFrontRegardless() }
    }

    /// Fly to a spot and sit beside it with a label and a tail to the exact point. `seat` puts
    /// Dot somewhere else than just below-right of the point (beside a card's edge, say).
    func point(at screenPoint: CGPoint, label: String, seat seatPoint: CGPoint? = nil) {
        guard let index = screenIndex(containing: screenPoint) else { return }
        showTransient()
        returnWork?.cancel()
        let model = models[index]
        let target = Coordinates.overlayPoint(fromScreen: screenPoint, screenFrame: windows[index].screenFrame)
        let seat = clampToScreen(seatPoint.map { Coordinates.overlayPoint(fromScreen: $0, screenFrame: windows[index].screenFrame) }
                                 ?? CGPoint(x: target.x + 14, y: target.y + 18), model: model)
        model.bubbleFlip = seatPoint.map { $0.x < screenPoint.x }
        park(on: index)
        model.chip = nil
        model.tailTo = nil
        fly(model: model, to: seat) {
            model.motion = .parked
            model.chip = label
            model.tailTo = target
            model.look = CGPoint(x: -0.6, y: -0.6)
        }
        startTracking(.point, CGRect(x: screenPoint.x - 12, y: screenPoint.y - 12, width: 24, height: 24))
    }

    /// Ring the control to click (or hover) next and perch beside it.
    func target(at screenPoint: CGPoint, radius: CGFloat, label: String, hover: Bool = false) {
        guard let index = screenIndex(containing: screenPoint) else { return }
        showTransient()
        returnWork?.cancel()
        let model = models[index]
        let center = Coordinates.overlayPoint(fromScreen: screenPoint, screenFrame: windows[index].screenFrame)
        ringDoneWork?.cancel()
        model.ringDone = false
        withAnimation(.spring(response: 0.38, dampingFraction: 0.68)) {
            model.ring = Ring(center: center, radius: max(radius, 10), label: label, hover: hover)
        }
        let seat = clampToScreen(CGPoint(x: center.x + radius + 20, y: center.y + radius + 14), model: model)
        park(on: index)
        model.chip = nil
        model.tailTo = nil
        fly(model: model, to: seat) {
            model.motion = .parked
            model.look = CGPoint(x: -0.7, y: -0.5)
        }
        startTracking(.ring, CGRect(x: screenPoint.x - radius, y: screenPoint.y - radius, width: radius * 2, height: radius * 2))
    }

    func highlight(_ rect: CGRect, label: String) {
        guard rect.width > 2, rect.height > 2 else { return }
        let center = CGPoint(x: rect.midX, y: rect.midY)
        guard let index = screenIndex(containing: center) else { return }
        showTransient()
        returnWork?.cancel()
        let model = models[index]
        model.highlightProgress = 0
        model.highlight = Coordinates.overlayRect(fromScreen: rect, screenFrame: windows[index].screenFrame)
        model.highlightLabel = label
        withAnimation(.easeOut(duration: 0.45)) { model.highlightProgress = 1 }
        startTracking(.highlight, rect)
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
        let xs = screenPoints.map(\.x), ys = screenPoints.map(\.y)
        if let minX = xs.min(), let maxX = xs.max(), let minY = ys.min(), let maxY = ys.max() {
            startTracking(.shape, CGRect(x: minX, y: minY, width: max(maxX - minX, 8), height: max(maxY - minY, 8)))
        }
    }

    // MARK: Tracking (round eight)

    /// Where the tracked marks are and what is on screen, for `Dot --track-selftest`.
    struct TrackingSnapshot { var highlight: CGRect?; var highlightShown: Bool; var ring: CGRect?; var ringShown: Bool; var chevron: Bool; var anchor: String? }
    var trackingSnapshot: TrackingSnapshot {
        TrackingSnapshot(highlight: trackedRects[.highlight], highlightShown: models.contains { $0.highlight != nil },
                         ring: trackedRects[.ring], ringShown: models.contains { $0.ring != nil },
                         chevron: models.contains { $0.edgeHint != nil }, anchor: tracker.anchorName(.highlight))
    }

    /// The content Dot is marking now (AppKit screen rect), so the explainer panel docks away from it.
    var markedRect: CGRect? { trackedRects[.highlight] ?? trackedRects[.ring] ?? trackedRects[.shape] ?? trackedRects[.point] }

    private func startTracking(_ kind: MarkTracker.Kind, _ rect: CGRect) {
        trackedRects[kind] = rect
        if kind == .ring { hiddenRing = nil; for m in models { m.edgeHint = nil } }
        if kind == .highlight { hiddenHighlight = nil }
        tracker.track(kind, appKitRect: rect)
    }

    private func stopTracking(_ kind: MarkTracker.Kind? = nil) {
        tracker.clear(kind)
        if let kind {
            trackedRects[kind] = nil
            if kind == .ring { hiddenRing = nil; for m in models { m.edgeHint = nil } }
            if kind == .highlight { hiddenHighlight = nil }
        } else {
            trackedRects.removeAll(); hiddenRing = nil; hiddenHighlight = nil
            for m in models { m.edgeHint = nil }
        }
    }

    /// The tracker moved a mark (scroll, window move) or it left or re-entered the window.
    private func trackerMoved(_ kind: MarkTracker.Kind, to rect: CGRect, visible: Bool, edge: MarkEdge?) {
        guard let old = trackedRects[kind], let index = screenIndex(containing: CGPoint(x: rect.midX, y: rect.midY)) ?? screenIndex(containing: CGPoint(x: old.midX, y: old.midY)) else { return }
        let model = models[index], frame = windows[index].screenFrame
        let delta = CGVector(dx: rect.midX - old.midX, dy: -(rect.midY - old.midY))   // overlay y runs down
        trackedRects[kind] = rect
        switch kind {
        case .highlight:
            if visible {
                model.highlight = Coordinates.overlayRect(fromScreen: rect, screenFrame: frame)
                hiddenHighlight = nil
            } else if model.highlight != nil {
                hiddenHighlight = (rect, index)
                model.highlight = nil
            }
        case .ring:
            if visible {
                if model.ring == nil, let (ring, _) = hiddenRing { model.ring = ring }
                model.ring?.center = Coordinates.overlayPoint(fromScreen: CGPoint(x: rect.midX, y: rect.midY), screenFrame: frame)
                hiddenRing = nil
                model.edgeHint = nil
            } else {
                if let ring = model.ring { hiddenRing = (ring, index) }
                model.ring = nil
                if let (p, e) = tracker.chevronPoint(for: .ring) {
                    model.edgeHint = EdgeHint(point: Coordinates.overlayPoint(fromScreen: p, screenFrame: frame), edge: e, label: hiddenRing?.0.label ?? "")
                }
            }
        case .point:
            if let tail = model.tailTo { model.tailTo = visible ? CGPoint(x: tail.x + delta.dx, y: tail.y + delta.dy) : nil }
        case .shape:
            if visible {
                for i in model.shapes.indices { model.shapes[i].points = model.shapes[i].points.map { CGPoint(x: $0.x + delta.dx, y: $0.y + delta.dy) } }
            } else {
                model.shapes = []
            }
        }
        // Dot perched beside the mark rides along with it
        if visible, model.motion == .parked, parkedScreen == index {
            model.position = clampToScreen(CGPoint(x: model.position.x + delta.dx, y: model.position.y + delta.dy), model: model)
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

    /// A stroke is finished: it stays on screen while he draws the next or speaks.
    func keepStroke(_ points: [CGPoint]) {
        guard let first = points.first, let index = screenIndex(containing: first) else { return }
        let frame = windows[index].screenFrame
        models[index].strokes.append(points.map { Coordinates.overlayPoint(fromScreen: $0, screenFrame: frame) })
        models[index].stroke = []
    }

    func clearStrokes() {
        for model in models { model.strokes = []; model.stroke = [] }
    }

    /// Whether screen recordings and shares capture Dot (HeyClicky's "Show in screen recordings").
    func setVisibleInRecordings(_ visible: Bool) {
        for window in windows { window.sharingType = visible ? .readOnly : .none }
    }

    func clearRing() {
        stopTracking(.ring)
        ringDoneWork?.cancel()
        for model in models { withAnimation(.easeOut(duration: 0.2)) { model.ring = nil; model.ringDone = false } }
    }

    /// The ringed control was clicked: a filled pulse on the ring, then it goes (HeyClicky's target-completed beat).
    func completeRing() {
        ringDoneWork?.cancel()
        for model in models where model.ring != nil { withAnimation(.easeOut(duration: 0.3)) { model.ringDone = true } }
        let work = DispatchWorkItem { [weak self] in self?.clearRing() }
        ringDoneWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.55, execute: work)
    }

    /// Marks fade, and Dot flies back to the cursor after `delay`.
    func release(after delay: TimeInterval = 2.0) {
        returnWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            self.stopTracking()
            for model in self.models {
                model.ring = nil
                model.highlight = nil
                model.highlightLabel = nil
                model.chip = nil
                model.tailTo = nil
                model.drawRect = nil
                model.stroke = []
                model.strokes = []
                model.shapes = []
                model.bubbleFlip = nil
            }
            self.returnToCursor()
        }
        returnWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }

    /// Clear everything now (interrupt, new question). A walkthrough's ring can stay.
    func clearMarks(keepRing: Bool = false) {
        returnWork?.cancel()
        if keepRing { stopTracking(.highlight); stopTracking(.point); stopTracking(.shape) } else { stopTracking() }
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
            model.strokes = []
            model.shapes = []
            model.bubbleFlip = nil
            model.motion = .following
        }
        parkedScreen = nil
        perched = false
        wakeReturnAt = nil
        for (index, model) in models.enumerated() { followers[index].snap(to: model.position) }
    }

    /// Older marks go when a new beat lands somewhere else, so a tour does not pile up boxes.
    func fadeOldMarks() {
        stopTracking(.highlight)
        for model in models {
            model.highlight = nil
            model.highlightLabel = nil
            if model.shapes.count > 1 { model.shapes.removeFirst(model.shapes.count - 1) }
        }
    }

    private func park(on index: Int) {
        // Pointing at something wins over the pet routine.
        perched = false
        wakeReturnAt = nil
        parkedScreen = index
        mouseAtPark = NSEvent.mouseLocation
        for (i, model) in models.enumerated() where i != index { model.visible = false; model.chip = nil; model.tailTo = nil }
        models[index].visible = true
    }

    private func returnToCursor() {
        guard let index = parkedScreen else { return }
        let model = models[index]
        let mouse = NSEvent.mouseLocation
        perched = false
        wakeReturnAt = nil
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

    /// Below and to the right of the pointer, a little farther for a bigger orb.
    private var followOffset: CGVector { CGVector(dx: 24 * orbSize / 20, dy: 26 * orbSize / 20) }

    private func followTarget(mouse: CGPoint, screenFrame: CGRect) -> CGPoint {
        let local = Coordinates.overlayPoint(fromScreen: mouse, screenFrame: screenFrame)
        return CGPoint(x: local.x + followOffset.dx, y: local.y + followOffset.dy)
    }

    private var tickCount = 0

    private func tick(jump: Bool) {
        guard presence || transientVisible else { return }
        tickCount += 1
        let now = clock
        let dt = min(max(now - (lastTickTime ?? now - 1.0 / 60.0), 1.0 / 240.0), 0.1)
        lastTickTime = now
        let mouse = NSEvent.mouseLocation
        let moved = hypot(mouse.x - lastMouse.x, mouse.y - lastMouse.y)
        let velocity = CGVector(dx: (mouse.x - lastMouse.x) / dt, dy: -(mouse.y - lastMouse.y) / dt)   // overlay y runs down
        lastMouse = mouse
        if moved > 0.5 { lastMouseMoveAt = now }
        if jump || tickCount % 15 == 0 { readInput(now) }
        if let event = fling.add(CGPoint(x: mouse.x, y: -mouse.y), at: now) { flung(event, now: now) }
        if let check = pounceCheckAt, now >= check {
            pounceCheckAt = nil
            // A fling that ended in a click was pointing, not play.
            if sinceClick > now - flingStoppedAt, sinceKey > 2, parkedScreen == nil { react(.pounce) }
        }

        if let parked = parkedScreen {
            let model = models[parked]
            if perched {
                perchTick(index: parked, mouse: mouse, now: now)
            } else if model.motion == .flying, hypot(mouse.x - mouseAtPark.x, mouse.y - mouseAtPark.y) > 100 {
                // Flying back and the cursor went far: snap to following from where it is.
                flightTimer?.invalidate()
                flightTimer = nil
                model.motion = .following
                followers[parked].snap(to: model.position)
                parkedScreen = nil
            }
        }

        if parkedScreen == nil {
            for (index, window) in windows.enumerated() {
                let model = models[index]
                guard window.screenFrame.contains(mouse) else {
                    if model.visible { model.visible = false }
                    continue
                }
                let desired = followTarget(mouse: mouse, screenFrame: window.screenFrame)
                if !model.visible {
                    model.visible = true
                    animators[index].appeared(at: now)
                    followers[index].snap(to: desired)
                    model.position = desired
                }
                if jump {
                    followers[index].snap(to: desired)
                    model.position = desired
                    leads[index] = .zero
                    continue
                }
                guard model.motion == .following else { continue }
                follow(index: index, desired: desired, mouse: mouse, velocity: velocity, now: now, dt: dt)
                if animators[index].wantsPerch { startPerch(index: index, mouse: mouse, now: now) }
            }
        }
        animate(now: now)
    }

    /// One frame of following: the spring (looser while it chases a flung cursor), held still while
    /// the cursor comes to pet it, and the rub read off the cursor's wiggle.
    private func follow(index: Int, desired: CGPoint, mouse: CGPoint, velocity: CGVector, now: Double, dt: Double) {
        let model = models[index]
        let cursor = Coordinates.overlayPoint(fromScreen: mouse, screenFrame: windows[index].screenFrame)
        let rubOn = rubs[index].add(cursor: cursor, at: now, orb: model.position, radius: orbSize / 2)
        let approach = hypot(followOffset.dx, followOffset.dy) * 1.6
        let hold = lazyZones[index].shouldHold(cursor: cursor, velocity: velocity, orb: model.position, approach: approach, now: now, rubbing: rubOn)
        if rubOn != rubbing[index] {
            rubbing[index] = rubOn
            if rubOn { onPetted?() }
        }
        animators[index].setRubbing(rubOn, direction: Double(rubs[index].lastDirection), at: now)
        var spring = followers[index]
        if hold {
            spring.position = model.position
            spring.velocity = .zero
        } else {
            let loose = chasing || now < chaseSettlesAt
            spring.duration = loose ? 0.5 : 0.25
            spring.bounce = loose ? 0.3 : 0.12
            spring.step(toward: desired, dt: dt)
            if hypot(spring.position.x - model.position.x, spring.position.y - model.position.y) > 0.01 { model.position = spring.position }
        }
        followers[index] = spring
        leads[index] = CGVector(dx: desired.x - model.position.x, dy: desired.y - model.position.y)
        speeds[index] = spring.speed
    }

    /// Step every visible orb's animator and publish its pose: 60 Hz while something moves, 15 Hz for
    /// the slow breath and glow, nothing while covered.
    private func animate(now: Double) {
        // CallPresence may read the front window's title through Accessibility; every 10 s is plenty
        // for the guards and keeps that read off the animation's frames.
        if now - quietCheckedAt > 10 {
            quietCheckedAt = now
            quiet = isQuiet?() ?? false
        }
        for (index, model) in models.enumerated() where model.visible {
            var input = OrbInput()
            input.phase = OrbPhase(model.phase)
            input.mood = OrbMood(model.mood)
            input.motion = OrbMotionState(model.motion)
            input.lead = leads[index]
            input.speed = speeds[index]
            input.parkedLook = model.motion == .parked ? model.look : nil
            input.cursorRest = now - lastMouseMoveAt
            input.sinceInput = sinceInput + (now - inputReadAt)
            input.micLevel = Double(model.level)
            input.speechLevel = speechLevel
            input.speechUnmetered = !speechMetered
            input.onCall = quiet
            input.agentWorking = model.agentActivity != nil || model.agentsWaiting > 0
            input.reduceMotion = model.reduceMotion
            input.diameter = Double(orbSize)
            let animator = animators[index]
            let pose = animator.step(at: now, input: input)
            guard !model.occluded, animator.isBusy || tickCount % 4 == 0, pose != model.pose else { continue }
            model.pose = pose
        }
    }

    /// Seconds since his last input of any kind, and since a key and a click (Dot's own driven clicks
    /// count too, which only keeps it awake).
    private func readInput(_ now: Double) {
        func since(_ type: CGEventType) -> Double { CGEventSource.secondsSinceLastEventType(.hidSystemState, eventType: type) }
        sinceKey = since(.keyDown)
        sinceClick = min(since(.leftMouseDown), since(.rightMouseDown))
        sinceInput = min(since(.mouseMoved), sinceKey, sinceClick, since(.scrollWheel), since(.leftMouseDragged))
        inputReadAt = now
    }

    private func flung(_ event: FlingDetector.Event, now: Double) {
        switch event {
        case .began:
            guard parkedScreen == nil, sinceKey > 2, !quiet, animators.allSatisfy({ $0.guardsAllowAntics || !$0.isBusy }),
                  models.contains(where: { $0.visible && !$0.reduceMotion && $0.phase == .idle }) else { return }
            chasing = true
        case .stopped:
            guard chasing else { return }
            chasing = false
            chaseSettlesAt = now + 0.4         // the skid past the stop
            flingStoppedAt = now
            pounceCheckAt = now + 0.5
        }
    }

    // MARK: The pet routine (docs/alive.md 2.2-2.3)

    /// Three minutes without input: walk off his text to the front window's top edge and settle there.
    private func startPerch(index: Int, mouse: CGPoint, now: Double) {
        let model = models[index]
        let frame = windows[index].screenFrame
        let cursor = Coordinates.overlayPoint(fromScreen: mouse, screenFrame: frame)
        let perch = PerchPlanner.perch(window: frontWindow(on: frame), cursor: cursor,
                                       screen: CGRect(origin: .zero, size: model.screenSize), radius: orbSize / 2)
        park(on: index)
        perched = true
        mouseAtPerch = mouse
        perchStartedAt = now
        idleAtPerch = sinceInput + (now - inputReadAt)
        model.chip = nil
        model.tailTo = nil
        fly(model: model, to: perch.point, style: .trot) { [weak self] in
            guard let self, self.perched else { return }
            model.motion = .perched
            self.animators[index].perched(at: self.clock, edge: perch.edge)
        }
    }

    private func perchTick(index: Int, mouse: CGPoint, now: Double) {
        let model = models[index]
        if let back = wakeReturnAt {
            if now >= back { returnToCursor() }
            return
        }
        let moved = hypot(mouse.x - mouseAtPerch.x, mouse.y - mouseAtPerch.y)
        let woken = PetWake.shouldWake(moved: moved, keyPressed: sinceKey < now - perchStartedAt)
        if model.motion == .flying {
            // Still walking there: any real movement and it turns around.
            if woken { flightTimer?.invalidate(); flightTimer = nil; returnToCursor() }
            return
        }
        if woken {
            animators[index].woke(at: now)
            wakeReturnAt = now + (model.reduceMotion ? 0.1 : 0.75)
            onWake?(idleAtPerch + (now - perchStartedAt))
        } else if animators[index].wantsReturn {
            returnToCursor()
        }
    }

    /// The frontmost app's main window on this screen, in overlay coordinates.
    private func frontWindow(on screenFrame: CGRect) -> CGRect? {
        guard let pid = NSWorkspace.shared.frontmostApplication?.processIdentifier, pid != ProcessInfo.processInfo.processIdentifier,
              let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]],
              let mainHeight = NSScreen.screens.first?.frame.height else { return nil }
        for info in list {
            guard (info[kCGWindowOwnerPID as String] as? Int32) == pid, (info[kCGWindowLayer as String] as? Int) == 0,
                  let bounds = info[kCGWindowBounds as String] as? NSDictionary,
                  let rect = CGRect(dictionaryRepresentation: bounds), rect.width > 80, rect.height > 60 else { continue }
            let appKit = CGRect(x: rect.minX, y: mainHeight - rect.maxY, width: rect.width, height: rect.height)
            guard appKit.intersects(screenFrame) else { continue }
            return Coordinates.overlayRect(fromScreen: appKit.intersection(screenFrame), screenFrame: screenFrame)
        }
        return nil
    }

    // MARK: Flight (Clicky's quadratic bezier with smoothstep easing, now with anticipation)

    private func fly(model: CompanionModel, to destination: CGPoint, style: FlightPath.Style = .flight, completion: @escaping () -> Void) {
        flightTimer?.invalidate()
        guard let index = models.firstIndex(where: { $0 === model }) else { return }
        let start = model.position
        if hypot(destination.x - start.x, destination.y - start.y) < 2 {
            model.position = destination
            followers[index].snap(to: destination)
            completion()
            return
        }
        model.motion = .flying
        let path = FlightPath(from: start, to: destination, style: style, anticipation: model.reduceMotion ? 0 : 0.15)
        let began = clock
        animators[index].flightWillStart(toward: CGVector(dx: destination.x - start.x, dy: destination.y - start.y), at: began)
        flightTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] timer in
            guard let self else { timer.invalidate(); return }
            let now = ProcessInfo.processInfo.systemUptime
            let sample = path.sample(at: now - began)
            switch sample.stage {
            case .anticipating:
                self.leads[index] = .zero
                self.speeds[index] = 0
            case .moving:
                model.position = sample.point
                self.leads[index] = CGVector(dx: sample.tangent.dx * 40, dy: sample.tangent.dy * 40)
                self.speeds[index] = sample.speed
            case .done:
                timer.invalidate()
                self.flightTimer = nil
                model.position = destination
                self.followers[index].snap(to: destination)
                self.leads[index] = .zero
                self.speeds[index] = 0
                self.animators[index].flightLanded(direction: sample.tangent, at: now)
                completion()
            }
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

extension OrbPhase {
    init(_ phase: CompanionPhase) {
        switch phase {
        case .idle: self = .idle
        case .listening: self = .listening
        case .thinking: self = .thinking
        case .speaking: self = .speaking
        }
    }
}

extension OrbMood {
    init(_ mood: CompanionMood) {
        switch mood {
        case .neutral: self = .neutral
        case .happy: self = .happy
        case .puzzled: self = .puzzled
        case .focused: self = .focused
        case .sleepy: self = .sleepy
        }
    }
}

extension OrbMotionState {
    init(_ motion: CompanionMotion) {
        switch motion {
        case .following: self = .following
        case .flying: self = .flying
        case .parked: self = .parked
        case .perched: self = .perched
        }
    }
}
