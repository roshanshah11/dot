import AppKit
import DotKit
import SwiftUI

/// Per-screen transparent, click-through window that hosts the dot. After Clicky's
/// OverlayWindow (MIT, Farza Majeed): screen-saver level, all Spaces, never key.
final class OverlayWindow: NSWindow {
    let screenFrame: CGRect

    init(screen: NSScreen) {
        screenFrame = screen.frame
        super.init(contentRect: screen.frame, styleMask: .borderless, backing: .buffered, defer: false)
        isOpaque = false
        backgroundColor = .clear
        level = .screenSaver
        ignoresMouseEvents = true
        collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        isReleasedWhenClosed = false
        hasShadow = false
        hidesOnDeactivate = false
        alphaValue = 0
        setFrame(screen.frame, display: true)
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

enum OverlayPhase: Equatable { case idle, listening, thinking, speaking }

final class OverlayModel: ObservableObject {
    @Published var dot = CGPoint(x: 200, y: 200)
    @Published var phase: OverlayPhase = .idle
    @Published var level: Float = 0
    @Published var label: String?
    @Published var pointing = false
    @Published var highlight: CGRect?
    @Published var highlightLabel: String?
    @Published var scale: CGFloat = 1
    @Published var color = Color(red: 1.0, green: 0.42, blue: 0.17)
}

struct DotView: View {
    @ObservedObject var model: OverlayModel

    var body: some View {
        ZStack(alignment: .topLeading) {
            if let rect = model.highlight {
                RoundedRectangle(cornerRadius: 8)
                    .stroke(model.color, lineWidth: 2.5)
                    .shadow(color: model.color.opacity(0.7), radius: 8)
                    .frame(width: rect.width, height: rect.height)
                    .offset(x: rect.minX, y: rect.minY)
                if let text = model.highlightLabel, !text.isEmpty {
                    chip(text)
                        .offset(x: rect.minX, y: max(4, rect.minY - 30))
                }
            }
            dot
                .position(model.dot)
            if model.pointing, let text = model.label, !text.isEmpty {
                chip(text)
                    .offset(x: model.dot.x + 16, y: model.dot.y - 8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .animation(.easeOut(duration: 0.12), value: model.level)
    }

    private var dot: some View {
        let base: CGFloat = 14
        let pulse: CGFloat = model.phase == .listening ? CGFloat(model.level) * 10 : 0
        let size = (base + pulse) * model.scale
        return ZStack {
            Circle()
                .fill(model.color.opacity(0.35))
                .frame(width: size * 2.4, height: size * 2.4)
                .blur(radius: 6)
            Circle()
                .fill(model.color)
                .frame(width: size, height: size)
                .shadow(color: model.color.opacity(0.9), radius: 6)
            if model.phase == .thinking {
                Circle()
                    .trim(from: 0, to: 0.35)
                    .stroke(Color.white.opacity(0.9), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                    .frame(width: size + 10, height: size + 10)
                    .rotationEffect(.degrees(spin))
            }
        }
    }

    @State private var spin: Double = 0

    private func chip(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(.white)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(Color(red: 0.05, green: 0.047, blue: 0.043).opacity(0.92), in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.white.opacity(0.12)))
            .fixedSize()
            .onAppear {
                withAnimation(.linear(duration: 0.9).repeatForever(autoreverses: false)) { spin = 360 }
            }
    }
}

/// Owns one overlay per display and the dot's motion: following the cursor while Dot
/// listens or speaks, flying along a bezier arc to a target, fading out when done.
@MainActor
final class OverlayManager {
    private var windows: [OverlayWindow] = []
    private var models: [OverlayModel] = []
    private var followTimer: Timer?
    private var flightTimer: Timer?
    private var fadeWork: DispatchWorkItem?
    private var visible = false
    private var pinned = false
    let color: Color

    init(colorHex: String) {
        color = Color(hex: colorHex) ?? Color(red: 1.0, green: 0.42, blue: 0.17)
        rebuild()
        NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.rebuild() }
        }
    }

    func rebuild() {
        for window in windows { window.orderOut(nil) }
        windows = []
        models = []
        for screen in NSScreen.screens {
            let model = OverlayModel()
            model.color = color
            let window = OverlayWindow(screen: screen)
            window.contentView = NSHostingView(rootView: DotView(model: model))
            windows.append(window)
            models.append(model)
        }
    }

    func show(phase: OverlayPhase) {
        fadeWork?.cancel()
        for model in models { model.phase = phase }
        if !visible {
            visible = true
            pinned = false
            for model in models { model.pointing = false; model.label = nil; model.highlight = nil; model.highlightLabel = nil }
            updateFollow(jump: true)
            for window in windows {
                window.orderFrontRegardless()
                NSAnimationContext.runAnimationGroup { ctx in
                    ctx.duration = 0.18
                    window.animator().alphaValue = 1
                }
            }
        }
        if !pinned { startFollowing() }
    }

    func setLevel(_ level: Float) {
        for model in models { model.level = level }
    }

    func point(at screenPoint: CGPoint, label: String) {
        guard let index = windows.firstIndex(where: { $0.screenFrame.contains(screenPoint) }) ?? windows.indices.first else { return }
        show(phase: models[index].phase == .idle ? .speaking : models[index].phase)
        pinned = true
        stopFollowing()
        for (i, model) in models.enumerated() where i != index { model.pointing = false; model.label = nil }
        let model = models[index]
        let target = Coordinates.overlayPoint(fromScreen: screenPoint, screenFrame: windows[index].screenFrame)
        let offsetTarget = CGPoint(x: target.x + 10, y: target.y + 12)
        fly(model: model, to: offsetTarget) {
            model.pointing = true
            model.label = label
        }
    }

    func highlight(_ rect: CGRect, label: String) {
        guard rect.width > 2, rect.height > 2 else { return }
        let center = CGPoint(x: rect.midX, y: rect.midY)
        guard let index = windows.firstIndex(where: { $0.screenFrame.contains(center) }) ?? windows.indices.first else { return }
        show(phase: models[index].phase == .idle ? .speaking : models[index].phase)
        pinned = true
        stopFollowing()
        let model = models[index]
        model.highlight = Coordinates.overlayRect(fromScreen: rect, screenFrame: windows[index].screenFrame)
        model.highlightLabel = label
        if !model.pointing {
            let corner = CGPoint(x: rect.maxX, y: rect.minY)
            fly(model: model, to: Coordinates.overlayPoint(fromScreen: corner, screenFrame: windows[index].screenFrame)) {}
        }
    }

    func fadeOut(after delay: TimeInterval) {
        fadeWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            self.visible = false
            self.pinned = false
            self.stopFollowing()
            self.flightTimer?.invalidate()
            for window in self.windows {
                NSAnimationContext.runAnimationGroup({ ctx in
                    ctx.duration = 0.35
                    window.animator().alphaValue = 0
                }, completionHandler: {
                    if !self.visible { window.orderOut(nil) }
                })
            }
            for model in self.models {
                model.phase = .idle
                model.pointing = false
                model.highlight = nil
            }
        }
        fadeWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }

    // MARK: Following the cursor

    private func startFollowing() {
        guard followTimer == nil else { return }
        followTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.updateFollow(jump: false) }
        }
    }

    private func stopFollowing() {
        followTimer?.invalidate()
        followTimer = nil
    }

    private func updateFollow(jump: Bool) {
        let mouse = NSEvent.mouseLocation
        for (index, window) in windows.enumerated() {
            let model = models[index]
            guard window.screenFrame.contains(mouse) else {
                if model.phase != .idle, !pinned { model.pointing = false }
                continue
            }
            let target = Coordinates.overlayPoint(fromScreen: mouse, screenFrame: window.screenFrame)
            let desired = CGPoint(x: target.x + 20, y: target.y + 24)
            if jump {
                model.dot = desired
            } else {
                let dx = desired.x - model.dot.x, dy = desired.y - model.dot.y
                model.dot = CGPoint(x: model.dot.x + dx * 0.35, y: model.dot.y + dy * 0.35)
            }
        }
    }

    // MARK: Flight (Clicky's quadratic bezier with smoothstep easing)

    private func fly(model: OverlayModel, to destination: CGPoint, completion: @escaping () -> Void) {
        flightTimer?.invalidate()
        let start = model.dot
        let distance = hypot(destination.x - start.x, destination.y - start.y)
        if distance < 2 { model.dot = destination; completion(); return }
        let duration = min(max(Double(distance) / 900.0, 0.45), 1.2)
        let frames = max(Int(duration * 60), 1)
        var frame = 0
        let mid = CGPoint(x: (start.x + destination.x) / 2, y: (start.y + destination.y) / 2)
        let arc = min(distance * 0.2, 80)
        let control = CGPoint(x: mid.x, y: mid.y - arc)
        model.pointing = false
        flightTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] timer in
            frame += 1
            if frame > frames {
                timer.invalidate()
                self?.flightTimer = nil
                model.dot = destination
                model.scale = 1
                completion()
                return
            }
            let linear = Double(frame) / Double(frames)
            let t = linear * linear * (3 - 2 * linear)
            let u = 1 - t
            let x = u * u * start.x + 2 * u * t * control.x + t * t * destination.x
            let y = u * u * start.y + 2 * u * t * control.y + t * t * destination.y
            model.dot = CGPoint(x: x, y: y)
            model.scale = 1 + CGFloat(sin(linear * .pi)) * 0.35
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
