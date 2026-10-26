import DotKit
import SwiftUI

/// An agent's face in Home (parity HO-15, HO-16): Dot's orb in the agent's hue (the same hue the notch gives it), eyes
/// for its mood, and its symbol on a small badge. Dot's own thread has no badge.
struct AgentFace: View {
    let name: String
    let mood: AgentMood
    var symbol: String?
    var size: CGFloat = 32
    /// Still eyes for snapshots (no breathing glow).
    var still = false

    var body: some View {
        ZStack {
            if mood == .working, !still {
                Circle().fill(RadialGradient(colors: [hue.opacity(0.55), hue.opacity(0)], center: .center, startRadius: size * 0.42, endRadius: size * 0.5 + 8))
                    .frame(width: size + 16, height: size + 16).allowsHitTesting(false).modifier(FaceBreathe())
            }
            Circle().fill(hue).frame(width: size, height: size)
                .overlay(Circle().strokeBorder(Color.white.opacity(0.45), lineWidth: max(1.5, size * 0.07)))
            eyes.rotationEffect(.degrees(mood == .waiting ? -9 : 0))
            if mood == .failed {
                Text("z").font(.system(size: size * 0.26, weight: .heavy, design: .rounded)).foregroundStyle(.white.opacity(0.9))
                    .offset(x: size * 0.25, y: -size * 0.27)
            }
            if let symbol {
                // the notch's way: a dark symbol on the agent's hue, cut out of the face by a ring of the window's colour
                Image(systemName: symbol).font(.system(size: size * 0.22, weight: .bold)).foregroundStyle(.black.opacity(0.78))
                    .frame(width: size * 0.44, height: size * 0.44)
                    .background(Circle().fill(hue).overlay(Circle().fill(.black.opacity(0.1))))
                    .overlay(Circle().stroke(Color(nsColor: .windowBackgroundColor), lineWidth: max(1.5, size * 0.05)))
                    .offset(x: size * 0.36, y: size * 0.36)
            }
        }
        .frame(width: size, height: size)
        .help("\(name): \(mood.word)")
    }

    @ViewBuilder private var eyes: some View {
        let w = size * 0.17
        HStack(spacing: size * 0.15) {
            switch mood {
            case .rest:
                ForEach(0..<2, id: \.self) { _ in Capsule().fill(.white.opacity(0.95)).frame(width: w, height: size * 0.06) }
            case .working:
                // open and looking down at the work
                ForEach(0..<2, id: \.self) { _ in Capsule().fill(.white).frame(width: size * 0.1, height: size * 0.17) }
            case .waiting:
                // one eye wider than the other
                Circle().fill(.white).frame(width: size * 0.15, height: size * 0.15)
                Capsule().fill(.white).frame(width: size * 0.09, height: size * 0.13)
            case .done:
                ForEach(0..<2, id: \.self) { _ in Arc(up: true).stroke(.white, style: StrokeStyle(lineWidth: size * 0.065, lineCap: .round)).frame(width: w, height: w * 0.6) }
            case .failed:
                ForEach(0..<2, id: \.self) { _ in Arc(up: false).stroke(.white.opacity(0.9), style: StrokeStyle(lineWidth: size * 0.06, lineCap: .round)).frame(width: w, height: w * 0.45) }
            }
        }
        .offset(y: mood == .working ? size * 0.03 : (mood == .failed ? size * 0.04 : -size * 0.02))
    }

    private var hue: Color { Self.hue(name) }

    /// The notch's hue for a name (StackAvatar's fill), so an agent looks the same in both places.
    static func hue(_ name: String) -> Color {
        var hash: UInt32 = 2166136261
        for byte in name.utf8 { hash = (hash ^ UInt32(byte)) &* 16777619 }
        return Color(hue: Double(hash % 360) / 360, saturation: 0.45, brightness: 0.92)
    }

    /// Half an ellipse: up for a smile's eyes (∩), down for sleepy lids (∪).
    private struct Arc: Shape {
        let up: Bool
        func path(in rect: CGRect) -> Path {
            var p = Path()
            if up {
                p.move(to: CGPoint(x: rect.minX, y: rect.maxY))
                p.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.maxY), control: CGPoint(x: rect.midX, y: rect.minY - rect.height * 0.9))
            } else {
                p.move(to: CGPoint(x: rect.minX, y: rect.minY))
                p.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY), control: CGPoint(x: rect.midX, y: rect.maxY + rect.height * 0.9))
            }
            return p
        }
    }
}

private struct FaceBreathe: ViewModifier {
    @State private var on = false
    func body(content: Content) -> some View {
        content.opacity(on ? 1.0 : 0.5)
            .onAppear { withAnimation(.easeInOut(duration: 1.3).repeatForever(autoreverses: true)) { on = true } }
    }
}
