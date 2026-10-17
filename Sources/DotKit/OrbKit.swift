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
    public enum Style: Equatable { case flight, trot }
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

/// A flung cursor, as opposed to an ordinary pointing move: a burst of at least `minSpeed` that lasts
/// `minDuration` and covers `minTravel`, then a stop. Pointing moves peak fast too, so the burst needs
/// all three, and the pounce it earns is gated on no click right after the stop (OverlayManager).
public struct FlingDetector {
    public enum Event: Equatable { case began, stopped(CGPoint) }

    // A fast pointing move peaks near 1.9x its mean speed: 1,500 px in 0.5 s tops out at 5,600 px/s and
    // covers about 700 px above 5,000. A fling (the same 1,500 px in 0.25 s) holds 6,000 px/s for over
    // 120 ms and covers about 1,200 px doing it, so distance at speed is what tells them apart
    // (docs/alive.md 2.4; the numbers are a design call, checked in OrbAnimatorTests).
    public var minSpeed: Double = 6000
    public var minDuration: Double = 0.1
    public var minTravel: Double = 900
    public var cooldown: Double = 30
    public var stopSpeed: Double = 60
    public var stopHold: Double = 0.15

    private var last: (point: CGPoint, time: Double)?
    private var burstStart: Double?
    private var burstTravel: Double = 0
    private var flinging = false
    private var slowSince: Double?
    private var lastFired = -Double.infinity

    public init() {}

    public var isFlinging: Bool { flinging }

    public mutating func add(_ point: CGPoint, at time: Double) -> Event? {
        defer { last = (point, time) }
        guard let last, time > last.time else { return nil }
        let step = Double(hypot(point.x - last.point.x, point.y - last.point.y))
        let speed = step / (time - last.time)
        if flinging {
            if speed < stopSpeed {
                if slowSince == nil { slowSince = time }
                if let slow = slowSince, time - slow >= stopHold {
                    flinging = false
                    slowSince = nil
                    return .stopped(point)
                }
            } else {
                slowSince = nil
            }
            return nil
        }
        if speed >= minSpeed {
            if burstStart == nil { burstStart = last.time; burstTravel = 0 }
            burstTravel += step
            if let start = burstStart, time - start >= minDuration, burstTravel >= minTravel, time - lastFired >= cooldown {
                flinging = true
                lastFired = time
                burstStart = nil
                return .began
            }
        } else {
            burstStart = nil
            burstTravel = 0
        }
        return nil
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

/// So he can reach Dot to pet it: while the cursor is coming toward the orb and is close, the orb holds
/// still instead of following, for up to `maxHold` seconds or until the cursor goes away.
public struct LazyZone {
    public var maxHold: Double = 1.5
    public var maxApproachSpeed: Double = 1500
    private var holdStart: Double?

    public init() {}

    public var isHolding: Bool { holdStart != nil }

    public mutating func shouldHold(cursor: CGPoint, velocity: CGVector, orb: CGPoint, approach: CGFloat, now: Double, rubbing: Bool) -> Bool {
        let toOrb = CGVector(dx: orb.x - cursor.x, dy: orb.y - cursor.y)
        let distance = hypot(toOrb.dx, toOrb.dy)
        if let start = holdStart {
            if distance > approach * 1.15 || (!rubbing && now - start > maxHold) {
                holdStart = nil
                return false
            }
            return true
        }
        let speed = hypot(velocity.dx, velocity.dy)
        let closing = (toOrb.dx * velocity.dx + toOrb.dy * velocity.dy) / max(distance, 1)
        if distance < approach, speed > 20, speed < maxApproachSpeed, closing > speed * 0.5 {
            holdStart = now
            return true
        }
        return false
    }

    public mutating func release() { holdStart = nil }
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
