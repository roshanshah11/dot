import CoreGraphics
import Foundation

// The pure pieces of Dot's motion (docs/alive.md): a seeded random source, the follow spring, the
// flight path, and the detectors for a flung cursor, a rub and an approach. OverlayManager feeds them
// the real cursor; the snapshot reels feed them a scripted one. Points are overlay coordinates (top-left
// origin, y down) unless a comment says otherwise.

/// SplitMix64: small, fast and seedable, so the orb's randomness replays exactly in tests and reels.
public struct SeededRandom: RandomNumberGenerator {
    private var state: UInt64

    public init(seed: UInt64) { state = seed }

    public mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }

    /// Uniform in [0, 1).
    public mutating func unit() -> Double { Double(next() >> 11) / Double(UInt64(1) << 53) }

    public mutating func range(_ low: Double, _ high: Double) -> Double { low + (high - low) * unit() }

    /// A standard normal draw (Box-Muller).
    public mutating func gaussian() -> Double {
        let u1 = max(unit(), 1e-12), u2 = unit()
        return sqrt(-2 * log(u1)) * cos(2 * .pi * u2)
    }

    /// An interval around `mean`, jittered rather than uniform: log-normal with the mean kept, clamped
    /// to 0.35x-3x so one draw can never stall or machine-gun.
    public mutating func jittered(mean: Double, spread: Double = 0.35) -> Double {
        let value = mean * exp(spread * gaussian() - spread * spread / 2)
        return min(max(value, mean * 0.35), mean * 3)
    }

    public mutating func exponential(mean: Double) -> Double { -mean * log(max(1 - unit(), 1e-12)) }
}

/// Smooth 1-D value noise in [-1, 1]: the glow's slow wander (Vector's eye noise, craft-A2-01).
public enum OrbNoise {
    public static func value(_ x: Double, seed: UInt64) -> Double {
        let i = floor(x), f = x - i
        let a = lattice(Int64(i), seed), b = lattice(Int64(i) + 1, seed)
        let s = f * f * (3 - 2 * f)
        return a + (b - a) * s
    }

    private static func lattice(_ n: Int64, _ seed: UInt64) -> Double {
        var r = SeededRandom(seed: seed &+ UInt64(bitPattern: n) &* 0x2545_F491_4F6C_DD1D)
        return r.unit() * 2 - 1
    }
}

/// A spring that keeps its velocity when the target moves, unlike a per-frame lerp (WWDC23 "Animate
/// with springs", craft-A5-02). Apple's parameters: `duration` (perceptual) and `bounce` (0 is
/// critically damped; 0.15 reads brisk, 0.3 bouncy, craft-A5-03).
public struct Spring2D: Equatable {
    public var position: CGPoint
    public var velocity: CGVector
    public var duration: Double
    public var bounce: Double

    public init(position: CGPoint, duration: Double = 0.25, bounce: Double = 0.12) {
        self.position = position
        self.velocity = .zero
        self.duration = duration
        self.bounce = bounce
    }

    public var speed: Double { hypot(velocity.dx, velocity.dy) }

    public mutating func snap(to point: CGPoint) {
        position = point
        velocity = .zero
    }

    /// Advance by `dt` toward `target`, in substeps short enough to stay stable at any frame rate.
    public mutating func step(toward target: CGPoint, dt: Double) {
        guard dt > 0 else { return }
        let omega = 2 * Double.pi / max(duration, 0.02)
        let stiffness = omega * omega
        let damping = 2 * max(0, 1 - bounce) * omega
        let count = max(1, Int(ceil(dt / (1.0 / 240.0))))
        let h = dt / Double(count)
        for _ in 0..<count {
            let ax = -stiffness * (Double(position.x) - Double(target.x)) - damping * Double(velocity.dx)
            let ay = -stiffness * (Double(position.y) - Double(target.y)) - damping * Double(velocity.dy)
            velocity.dx += CGFloat(ax * h)
            velocity.dy += CGFloat(ay * h)
            position.x += velocity.dx * CGFloat(h)
            position.y += velocity.dy * CGFloat(h)
        }
    }
}

/// Clicky's quadratic-bezier flight with smoothstep easing (rea-C22, C23), plus a beat of anticipation
/// before it leaves (craft-A1-04) and a lower, slower "trot" for walking to a perch.
public struct FlightPath: Equatable {
    public enum Style: Equatable { case flight, trot, hop }
    public enum Stage: Equatable { case anticipating, moving, done }

    public let start: CGPoint
    public let end: CGPoint
    public let control: CGPoint
    public let duration: Double
    public let anticipation: Double
    public let style: Style

    public init(from start: CGPoint, to end: CGPoint, style: Style = .flight, anticipation: Double = 0.15) {
        self.start = start
        self.end = end
        self.style = style
        self.anticipation = anticipation
        let distance = Double(hypot(end.x - start.x, end.y - start.y))
        let mid = CGPoint(x: (start.x + end.x) / 2, y: (start.y + end.y) / 2)
        switch style {
        case .flight:
            duration = min(max(distance / 900, 0.45), 1.2)
            control = CGPoint(x: mid.x, y: mid.y - CGFloat(min(distance * 0.2, 80)))
        case .trot:
            duration = min(max(distance / 260, 0.6), 3.0)
            control = CGPoint(x: mid.x, y: mid.y - CGFloat(min(distance * 0.04, 14)))
        case .hop:
            // A quick hop aside or a scoot under the cursor: short, with a little lift.
            duration = min(max(distance / 500, 0.22), 0.5)
            control = CGPoint(x: mid.x, y: mid.y - CGFloat(min(distance * 0.3, 16)))
        }
    }

    public var distance: Double { Double(hypot(end.x - start.x, end.y - start.y)) }
    public var total: Double { anticipation + duration }

    /// Where the orb is `elapsed` seconds after the flight was asked for: the stage, the point, the unit
    /// tangent of the path there and the speed along it (px/s).
    public func sample(at elapsed: Double) -> (stage: Stage, point: CGPoint, tangent: CGVector, speed: Double) {
        let startTangent = tangent(at: 0)
        if elapsed < anticipation { return (.anticipating, start, startTangent, 0) }
        let linear = min(max((elapsed - anticipation) / duration, 0), 1)
        if linear >= 1 { return (.done, end, tangent(at: 1), 0) }
        let t = linear * linear * (3 - 2 * linear)
        let u = 1 - t
        let x = u * u * Double(start.x) + 2 * u * t * Double(control.x) + t * t * Double(end.x)
        let y = u * u * Double(start.y) + 2 * u * t * Double(control.y) + t * t * Double(end.y)
        let dx = 2 * u * Double(control.x - start.x) + 2 * t * Double(end.x - control.x)
        let dy = 2 * u * Double(control.y - start.y) + 2 * t * Double(end.y - control.y)
        let length = max(hypot(dx, dy), 1e-9)
        let easeRate = 6 * linear * (1 - linear) / duration      // d(smoothstep)/d(time)
        return (.moving, CGPoint(x: x, y: y), CGVector(dx: dx / length, dy: dy / length), length * easeRate)
    }

    private func tangent(at t: Double) -> CGVector {
        let u = 1 - t
        let dx = 2 * u * Double(control.x - start.x) + 2 * t * Double(end.x - control.x)
        let dy = 2 * u * Double(control.y - start.y) + 2 * t * Double(end.y - control.y)
        let length = hypot(dx, dy)
        guard length > 1e-9 else { return CGVector(dx: 1, dy: 0) }
        return CGVector(dx: dx / length, dy: dy / length)
    }
}

/// Petting: the cursor over Dot changes horizontal direction `reversals` times within `window`
/// seconds (cute-C15 for picking up pets; the thresholds are a design call, docs/alive.md 2.5).
public struct RubDetector {
    public var reversals = 3
    public var window: Double = 1.2
    public var minSegment: CGFloat = 1.5

    private var lastX: CGFloat?
    private var direction: CGFloat = 0
    private var travelled: CGFloat = 0
    private var flips: [Double] = []
    public private(set) var lastDirection: CGFloat = 0

    public init() {}

    /// Feed one cursor sample; true while the rub is on (enough recent reversals over the orb).
    public mutating func add(cursor: CGPoint, at time: Double, orb: CGPoint, radius: CGFloat) -> Bool {
        flips.removeAll { time - $0 > window }
        let over = hypot(cursor.x - orb.x, cursor.y - orb.y) <= radius * 1.3
        guard over else { lastX = nil; direction = 0; travelled = 0; return flips.count >= reversals }
        defer { lastX = cursor.x }
        guard let lastX else { return flips.count >= reversals }
        let dx = cursor.x - lastX
        guard abs(dx) > 0.01 else { return flips.count >= reversals }
        let sign: CGFloat = dx > 0 ? 1 : -1
        if sign == direction || direction == 0 {
            direction = sign
            travelled += abs(dx)
        } else if travelled >= minSegment {
            flips.append(time)
            lastDirection = sign
            direction = sign
            travelled = abs(dx)
        } else {
            direction = sign
            travelled = abs(dx)
        }
        return flips.count >= reversals
    }
}

/// The leash (docs/alive.md, round two): pets people touch stay put until you go far (oneko.js idles
/// within 48 px of the cursor, cute-C45). Dot sits still while the cursor stays within `radius` of it,
/// then trots to its spot beside the cursor and sits again, so he can move onto it to pet or grab it.
public struct Leash: Equatable {
    public var radius: CGFloat
    public private(set) var following = false

    public init(radius: CGFloat = 90) { self.radius = radius }

    /// Whether Dot should be moving toward `target` (its spot beside the cursor) this frame.
    public mutating func update(cursor: CGPoint, orb: CGPoint, target: CGPoint) -> Bool {
        if !following, hypot(cursor.x - orb.x, cursor.y - orb.y) > radius { following = true }
        if following, hypot(target.x - orb.x, target.y - orb.y) < 3 { following = false }
        return following
    }

    /// Sit where it is now (after a call-over, a set-down or a landing) until the cursor goes far.
    public mutating func sit() { following = false }
    /// Head back beside the cursor now (after a toss lands far away).
    public mutating func heel() { following = true }
}

/// The call-over: a gentle wiggle anywhere, small and slow, that is not on Dot. macOS's shake-to-find
/// is big and fast, so it stays out (docs/alive.md, round two; thresholds are a design call).
public struct CallOverDetector {
    public var reversals = 3
    public var window: Double = 1.2
    public var maxSpan: CGFloat = 40
    public var maxSpeed: Double = 800
    public var cooldown: Double = 3
    /// Each run between reversals is at least this long, so aiming corrections of a few points don't count.
    public var minRun: CGFloat = 8

    private var samples: [(x: CGFloat, y: CGFloat, t: Double)] = []
    private var lastFired = -Double.infinity

    public init() {}

    /// Feed one cursor sample; true once when a call-over completes.
    public mutating func add(cursor: CGPoint, at time: Double, orb: CGPoint, radius: CGFloat, buttonDown: Bool = false) -> Bool {
        if buttonDown || hypot(cursor.x - orb.x, cursor.y - orb.y) <= radius * 1.6 { samples.removeAll(); return false }
        if let last = samples.last {
            let speed = Double(hypot(cursor.x - last.x, cursor.y - last.y)) / max(time - last.t, 1e-3)
            if speed > maxSpeed { samples.removeAll() }
        }
        samples.append((cursor.x, cursor.y, time))
        samples.removeAll { time - $0.t > window }
        guard time - lastFired >= cooldown, samples.count >= 4 else { return false }
        let xs = samples.map(\.x), ys = samples.map(\.y)
        guard let minX = xs.min(), let maxX = xs.max(), let minY = ys.min(), let maxY = ys.max(),
              maxX - minX <= maxSpan, maxY - minY <= maxSpan, maxX - minX >= 4 else { return false }
        var flips = 0
        var direction: CGFloat = 0
        var run: CGFloat = 0
        for i in 1..<samples.count {
            let dx = samples[i].x - samples[i - 1].x
            guard abs(dx) > 0.01 else { continue }
            let sign: CGFloat = dx > 0 ? 1 : -1
            if direction == 0 || sign == direction { run += abs(dx) } else {
                if run >= minRun { flips += 1 }
                run = abs(dx)
            }
            direction = sign
        }
        guard flips >= reversals else { return false }
        lastFired = time
        samples.removeAll()
        return true
    }
}

/// The throw (docs/alive.md, round two): every throw found is a grab and release (VS Code Pets launches
/// its ball on mouse-up with the last movement as its velocity; Shimeji is dragged and thrown). Dot
/// flies at the release speed, slows with friction, and bounces off the screen's edges at 60%.
public struct Toss: Equatable {
    public static let maxSpeed: Double = 4000
    public static let minSpeed: Double = 300
    public var position: CGPoint
    public var velocity: CGVector
    public var restitution: Double = 0.6
    /// Speed decays as exp(-t / friction).
    public var friction: Double = 0.45

    public init(position: CGPoint, velocity: CGVector) {
        self.position = position
        let speed = Double(hypot(velocity.dx, velocity.dy))
        let scale = speed > Self.maxSpeed ? Self.maxSpeed / speed : 1
        self.velocity = CGVector(dx: velocity.dx * CGFloat(scale), dy: velocity.dy * CGFloat(scale))
    }

    public var speed: Double { Double(hypot(velocity.dx, velocity.dy)) }

    /// Release speed this low just sets Dot down where it is.
    public static func isThrow(_ velocity: CGVector) -> Bool { Double(hypot(velocity.dx, velocity.dy)) >= minSpeed }

    /// One step inside `bounds` (the screen, inset by the orb's radius). Returns the wall normal when it
    /// bounced, and whether it has come to rest.
    public mutating func step(dt: Double, bounds: CGRect) -> (bounce: CGVector?, done: Bool) {
        let decay = CGFloat(exp(-dt / friction))
        velocity = CGVector(dx: velocity.dx * decay, dy: velocity.dy * decay)
        position.x += velocity.dx * CGFloat(dt)
        position.y += velocity.dy * CGFloat(dt)
        var normal: CGVector?
        let e = CGFloat(restitution)
        if position.x < bounds.minX { position.x = bounds.minX; velocity.dx = -velocity.dx * e; normal = CGVector(dx: 1, dy: 0) }
        if position.x > bounds.maxX { position.x = bounds.maxX; velocity.dx = -velocity.dx * e; normal = CGVector(dx: -1, dy: 0) }
        if position.y < bounds.minY { position.y = bounds.minY; velocity.dy = -velocity.dy * e; normal = CGVector(dx: 0, dy: 1) }
        if position.y > bounds.maxY { position.y = bounds.maxY; velocity.dy = -velocity.dy * e; normal = CGVector(dx: 0, dy: -1) }
        return (normal, speed < 40)
    }

    /// The release velocity from the drag's samples: the movement over its last 50 ms.
    public static func releaseVelocity(_ samples: [(point: CGPoint, time: Double)], window: Double = 0.05) -> CGVector {
        guard let last = samples.last else { return .zero }
        let early = samples.last { last.time - $0.time >= window } ?? samples.first!
        let dt = last.time - early.time
        guard dt > 1e-3 else { return .zero }
        return CGVector(dx: (last.point.x - early.point.x) / CGFloat(dt), dy: (last.point.y - early.point.y) / CGFloat(dt))
    }
}

/// A fast approach is a click on something under Dot, not a pet: Dot hops aside (docs/alive.md, round two).
public enum Dodge {
    public static let speed: Double = 900

    /// Where to hop when the cursor comes at the orb fast, or nil when it needn't move.
    public static func spot(cursor: CGPoint, velocity: CGVector, orb: CGPoint, radius: CGFloat, bounds: CGRect) -> CGPoint? {
        let speed = Double(hypot(velocity.dx, velocity.dy))
        guard speed > Self.speed, hypot(cursor.x - orb.x, cursor.y - orb.y) < radius * 2.2 else { return nil }
        // Sideways to the cursor's path, on the side Dot is already on.
        var side = CGVector(dx: -velocity.dy / CGFloat(speed), dy: velocity.dx / CGFloat(speed))
        let toOrb = CGVector(dx: orb.x - cursor.x, dy: orb.y - cursor.y)
        if side.dx * toOrb.dx + side.dy * toOrb.dy < 0 { side = CGVector(dx: -side.dx, dy: -side.dy) }
        let hop = radius * 3.2
        let spot = CGPoint(x: orb.x + side.dx * hop, y: orb.y + side.dy * hop)
        return CGPoint(x: min(max(spot.x, bounds.minX), bounds.maxX), y: min(max(spot.y, bounds.minY), bounds.maxY))
    }

    /// Where to scoot when the cursor sits on Dot: away from the cursor (down and right when it is dead
    /// centre), and the other way when a screen edge would leave it under the cursor.
    public static func aside(cursor: CGPoint, orb: CGPoint, radius: CGFloat, bounds: CGRect) -> CGPoint {
        var away = CGVector(dx: orb.x - cursor.x, dy: orb.y - cursor.y)
        let length = hypot(away.dx, away.dy)
        away = length < 1 ? CGVector(dx: 0.8, dy: 0.6) : CGVector(dx: away.dx / length, dy: away.dy / length)
        let hop = radius * 3.2
        func clamp(_ p: CGPoint) -> CGPoint { CGPoint(x: min(max(p.x, bounds.minX), bounds.maxX), y: min(max(p.y, bounds.minY), bounds.maxY)) }
        let spot = clamp(CGPoint(x: orb.x + away.dx * hop, y: orb.y + away.dy * hop))
        if hypot(spot.x - cursor.x, spot.y - cursor.y) >= radius * 2.2 { return spot }
        return clamp(CGPoint(x: cursor.x - away.dx * hop, y: cursor.y - away.dy * hop))
    }
}

/// When the cursor on Dot can pick it up. Following, only around a rub (while rubbing and for 1.5 s after), so a
/// careful click on whatever is under Dot still lands there. Sitting where he put it, any time: moving a sitting Dot
/// is a plain drag (his ask, 2026-10-18: "allow me to change where i move it after i put it put").
public enum Grip {
    public static let afterRub: Double = 1.5

    public static func reachable(cursor: CGPoint, orb: CGPoint, radius: CGFloat, sinceRub: Double, sitting: Bool) -> Bool {
        guard hypot(cursor.x - orb.x, cursor.y - orb.y) <= radius * 1.3 else { return false }
        return sitting || sinceRub < afterRub
    }
}

/// Waking from the pet routine: a cursor move of more than 6 px (oneko's IdleSpace, cute-C43) or a key.
public enum PetWake {
    public static let distance: CGFloat = 6
    public static func shouldWake(moved: CGFloat, keyPressed: Bool = false) -> Bool { keyPressed || moved > distance }
}

/// Where Dot naps (docs/alive.md 2.2): on the front window's top edge near the cursor, never over its
/// content (cute-C21), or on a screen edge when there is no window.
public enum PerchPlanner {
    public enum Edge: Equatable { case windowTop, titleBar, windowSide, screen }

    public struct Perch: Equatable {
        public let point: CGPoint
        public let edge: Edge
    }

    /// `window` and `screen` are overlay rects; `content` is the window minus its `titleBar` band;
    /// `menuBar` is kept clear at the top of the screen.
    public static func perch(window: CGRect?, cursor: CGPoint, screen: CGRect, radius: CGFloat,
                             titleBar: CGFloat = 28, menuBar: CGFloat = 26) -> Perch {
        let r = radius + 1
        let usable = CGRect(x: screen.minX + r, y: screen.minY + menuBar + r,
                            width: max(screen.width - 2 * r, 1), height: max(screen.height - menuBar - 2 * r, 1))
        func clampX(_ x: CGFloat, _ low: CGFloat, _ high: CGFloat) -> CGFloat { high < low ? (low + high) / 2 : min(max(x, low), high) }
        if let window, window.width > 4 * r, window.height > titleBar {
            let content = CGRect(x: window.minX, y: window.minY + titleBar, width: window.width, height: window.height - titleBar)
            let x = clampX(cursor.x, window.minX + 90 + r, window.maxX - 8 - r)
            var candidates: [Perch] = [
                Perch(point: CGPoint(x: x, y: window.minY - r), edge: .windowTop),
            ]
            if 2 * r <= titleBar - 2 {
                candidates.append(Perch(point: CGPoint(x: x, y: window.minY + titleBar / 2), edge: .titleBar))
            }
            let y = clampX(cursor.y, window.minY + r, window.maxY - r)
            candidates.append(Perch(point: CGPoint(x: window.maxX + r, y: y), edge: .windowSide))
            candidates.append(Perch(point: CGPoint(x: window.minX - r, y: y), edge: .windowSide))
            for candidate in candidates where usable.contains(candidate.point) && !overlaps(candidate.point, r, content) {
                return candidate
            }
            // No room around the window: the screen edge farthest from its content.
            return screenEdge(cursor: cursor, usable: usable, avoiding: content, r: r)
        }
        return screenEdge(cursor: cursor, usable: usable, avoiding: nil, r: r)
    }

    public static func overlaps(_ center: CGPoint, _ radius: CGFloat, _ rect: CGRect) -> Bool {
        let nearestX = min(max(center.x, rect.minX), rect.maxX)
        let nearestY = min(max(center.y, rect.minY), rect.maxY)
        return hypot(center.x - nearestX, center.y - nearestY) < radius
    }

    private static func screenEdge(cursor: CGPoint, usable: CGRect, avoiding content: CGRect?, r: CGFloat) -> Perch {
        let x = min(max(cursor.x, usable.minX), usable.maxX)
        let y = min(max(cursor.y, usable.minY), usable.maxY)
        let options = [
            CGPoint(x: x, y: usable.maxY), CGPoint(x: x, y: usable.minY),
            CGPoint(x: usable.minX, y: y), CGPoint(x: usable.maxX, y: y),
            CGPoint(x: usable.minX, y: usable.maxY), CGPoint(x: usable.maxX, y: usable.maxY),
        ]
        let clear = options.filter { point in content.map { !overlaps(point, r, $0) } ?? true }
        let pick = (clear.isEmpty ? options : clear).min { hypot($0.x - cursor.x, $0.y - cursor.y) < hypot($1.x - cursor.x, $1.y - cursor.y) }!
        return Perch(point: pick, edge: .screen)
    }
}

/// The speaking mouth's openness from AVAudioPlayer's average power: -45 dB is closed, -12 dB wide,
/// and anything under 0.05 counts as silence (SALSA's noise floor, craft-A6-07).
public enum SpeechLevel {
    public static func openness(decibels: Float) -> Double {
        guard decibels.isFinite else { return 0 }
        let level = min(max((Double(decibels) + 45) / 33, 0), 1)
        return level < 0.05 ? 0 : level
    }
}

/// He thanked Dot: a happy squint and a blush (docs/alive.md 2.6).
public enum Gratitude {
    public static func isThanks(_ text: String) -> Bool {
        let lower = text.lowercased()
        return lower.range(of: #"\b(thanks|thank you|thank u|thankyou|thx|ty)\b"#, options: .regularExpression) != nil
    }
}
