import CoreGraphics
import Foundation

// Dot's face and body as a pure function of time and what is happening (docs/alive.md). The animator
// holds no SwiftUI or AppKit: OverlayManager steps it from its 60 Hz tick and the view draws the pose;
// the snapshot reels step it on a scripted clock. Its numbers come from the research ledger in
// ~/roshan/Learning/Research/2026-10-17-dot-alive-persona (ids in the comments); values marked
// "design call" are not sourced.

public enum OrbPhase: Equatable { case idle, listening, thinking, speaking }
public enum OrbMood: Equatable { case neutral, happy, puzzled, focused, sleepy }
public enum OrbMotionState: Equatable { case following, flying, parked, perched }

/// One-shot moves over the base pose. Keep-alive blinks and darts pause while one plays (craft-A2-03).
public enum OrbReaction: Equatable {
    case agentDone, agentFailed, thanks, dismissed, pounce
    /// A glance toward the newly active window; `dx` is its horizontal side (-1 left, 1 right).
    case appSwitch(dx: Double)
    /// Puzzled or curious: a fast head tilt toward the orb's right (cute-C6, C7).
    case tilt
}

public enum OrbGlyph: Equatable { case sleeping, alert }

public struct OrbEyePose: Equatable {
    /// Blink openness: 1 open, 0 shut.
    public var openness: Double = 1
    /// Width while the blink flattens the eye (up to 1.2x, craft-A2-12).
    public var widen: Double = 1
    /// How far the upper lid has come down (0 none, 1 shut).
    public var upperLid: Double = 0
    /// How far the lower lid has come up into a happy slit (0 none, 1 shut).
    public var lowerLid: Double = 0
    public var scale: Double = 1
    public var tilt: Double = 0
    public init() {}
}

public struct OrbPose: Equatable {
    public var left = OrbEyePose()
    public var right = OrbEyePose()
    /// Where the eyes look, in orb diameters from their rest place.
    public var gaze = CGPoint.zero
    /// Squash and stretch along `stretchAngle`: the axis scales by `stretch`, its normal by 1/stretch,
    /// so the area never changes (craft-A1-05).
    public var stretch: Double = 1
    public var stretchAngle: Double = 0
    /// Uniform size: the breath (and nothing else).
    public var breath: Double = 1
    /// Rotation of the whole orb and face (tilt, wobble, purr), radians.
    public var rotation: Double = 0
    /// Offset in orb diameters (hops, the droop, the nod, the groom wiggle).
    public var offset = CGPoint.zero
    public var glow: Double = 1
    public var blush: Double = 0
    public var mouthVisible = false
    public var mouthOpen: Double = 0
    public var mouthCurve: Double = 0.15
    public var glyph: OrbGlyph?
    /// 0...1 through the glyph's float cycle.
    public var glyphProgress: Double = 0
    public init() {}

    public static let rest = OrbPose()

    /// The squash pair along the stretch axis (sx * sy is always 1).
    public var squash: (along: Double, across: Double) { (stretch, 1 / stretch) }
}

/// Everything the animator reads each frame.
public struct OrbInput: Equatable {
    public var phase: OrbPhase = .idle
    public var mood: OrbMood = .neutral
    public var motion: OrbMotionState = .following
    /// From Dot toward where it is heading, px: the follow lag, or the flight tangent times its speed.
    public var lead = CGVector.zero
    /// The orb's own speed, px/s.
    public var speed: Double = 0
    /// Where to look while parked beside a mark (-1...1 per axis), nil to look ahead.
    public var parkedLook: CGPoint?
    /// Seconds the cursor has been still.
    public var cursorRest: Double = 0
    /// Seconds since the last mouse, key or scroll input.
    public var sinceInput: Double = 0
    /// 0...1 mic level while he talks, and the speaking mouth level while Dot talks.
    public var micLevel: Double = 0
    public var speechLevel: Double = 0
    /// True while Apple's voice speaks (no level to read): the mouth falls back to two sines.
    public var speechUnmetered = false
    public var onCall = false
    public var recording = false
    public var agentWorking = false
    public var reduceMotion = false
    public var diameter: Double = 24
    public init() {}
}

public final class OrbAnimator {
    // MARK: Tunables (docs/alive.md, phase 1 and 2)

    /// Blink: close fast, open slower (science-C5, C6; craft-A2-13).
    public static let blinkClose = 0.10, blinkShut = 0.03, blinkOpen = 0.20
    /// Eye travel, in orb diameters, and the idle dart cap (Vector's 15 px of a 184 px face, craft-A2-06).
    public static let travelX = 0.12, travelY = 0.10, dartCap = 0.08
    /// Idle tiers by seconds without input: calm (he is probably reading), the pet routine, drowsy, asleep.
    public static let calmAfter = 60.0, petAfter = 180.0, drowsyAfter = 300.0, asleepAfter = 900.0
    /// Breath periods (design call; the rhythm itself is science-C47) and the amplitude (≤2%).
    public static let breathPeriod = 5.0, drowsyBreath = 7.0, asleepBreath = 9.0, breathAmplitude = 0.018

    // MARK: State

    private var rng: SeededRandom
    private let noiseSeed: UInt64
    private var now: Double = 0
    private var started = false
    private var input = OrbInput()

    private var lastPhase: OrbPhase = .idle
    private var phaseStart: Double = 0

    private var blinkStart: Double?
    private var blinkSlow = 1.0
    private var lastBlinkEnd = -Double.infinity
    private var nextBlinkAt: Double = 0
    private var pendingBlinks: [Double] = []

    private var gaze = CGPoint.zero
    private var saccadeFrom = CGPoint.zero
    private var saccadeTo = CGPoint.zero
    private var saccadeStart: Double?
    private var saccadeDuration = 0.04
    private var dartTarget = CGPoint.zero
    private var nextDartAt: Double = 0
    private var asideStart: Double?
    private var asideEnd: Double = 0
    private var asideTarget = CGPoint.zero
    private var nextAsideAt: Double = 0
    private var answerEndAt: Double?
    private var thinkingStart: Double?

    private var breathPhase: Double = 0
    private var micBelowSince: Double?
    private var micPauseFired = false

    private var lids = OrbEyePose(), rightLids = OrbEyePose()
    private var bodyTilt: Double = 0
    private var mouthOpen: Double = 0
    private var blush: Double = 0

    private var reaction: (kind: OrbReaction, start: Double)?
    private var lastAppGlance = -Double.infinity

    private var anticipation: (direction: CGVector, start: Double)?
    private var landing: (direction: CGVector, start: Double)?
    private var hop: (start: Double, height: Double)?

    private var perchedAt: Double?
    private var perchEdge: PerchPlanner.Edge = .windowTop
    private var nextBeatAt: Double = 0
    private var beat: (kind: Beat, start: Double)?
    private var wokeAt: Double?
    private var wakeHopped = false
    private var routineIndex = 0
    private var lastMood: OrbMood = .neutral

    private var rubbing = false
    private var rubDirection: Double = 0
    private var rubEndedAt = -Double.infinity
    private var rubFullAt = -Double.infinity
    private var rubFull = false

    private enum Beat: Equatable { case groom, scratch, scratchEdge, yawn, lookAround }

    public init(seed: UInt64 = 0xD07) {
        rng = SeededRandom(seed: seed)
        noiseSeed = seed &* 31 &+ 7
    }

    // MARK: Read-outs for OverlayManager

    /// The pet routine may start: idle long enough and nothing guarding against antics.
    public var wantsPerch: Bool { input.motion == .following && guardsAllowAntics && input.sinceInput >= Self.petAfter }
    /// Perched, but a guard came on (a call, an agent, a talk phase): go back beside the cursor.
    public var wantsReturn: Bool { input.motion == .perched && !guardsAllowAntics && wokeAt == nil }
    /// Something is moving fast enough to need 60 Hz; otherwise 15 Hz is plenty.
    public private(set) var isBusy = false
    /// Mid-wake (the alert look and the hop), so the manager waits before flying back.
    public var isWaking: Bool { wokeAt.map { now - $0 < 1.0 } ?? false }

    /// Antics (hops, chases, the pet routine, quips) only at breaks and never on a call, while
    /// recording, while an agent works, mid-conversation or with Reduce Motion (cute-C19, C21).
    public var guardsAllowAntics: Bool {
        !input.onCall && !input.recording && !input.agentWorking && !input.reduceMotion && input.phase == .idle
    }

    public var tier: Tier { Self.tier(sinceInput: input.sinceInput, perched: input.motion == .perched) }

    public enum Tier: Equatable { case active, calm, pet, drowsy, asleep }

    public static func tier(sinceInput: Double, perched: Bool) -> Tier {
        if sinceInput < calmAfter { return .active }
        if sinceInput < petAfter || !perched { return .calm }
        if sinceInput < drowsyAfter { return .pet }
        if sinceInput < asleepAfter { return .drowsy }
        return .asleep
    }

    // MARK: Events

    /// A spoken sentence began; `duration` is its audio length when known, `isLast` when nothing is queued after it.
    public func sentenceStarted(at time: Double, duration: Double?, isLast: Bool) {
        // Blinks cluster at punctuation (science-C10) and run 26/min in conversation (science-C1): most
        // sentences get one (0.85 is a design call).
        if rng.unit() < 0.85 { pendingBlinks.append(time + rng.range(0, 0.2)) }
        // Look back about 2.4 s before the turn ends, then stay (science-C33).
        if isLast, let duration { answerEndAt = time + max(0, duration - 2.4) } else { answerEndAt = nil }
    }

    /// A flight is about to leave toward `direction`: eyes first, then a squash away (craft-A1-04).
    public func flightWillStart(toward direction: CGVector, at time: Double) {
        let length = max(hypot(direction.dx, direction.dy), 1e-6)
        let unit = CGVector(dx: direction.dx / length, dy: direction.dy / length)
        anticipation = (unit, time)
        jumpGaze(to: CGPoint(x: unit.dx * Self.travelX * 0.9, y: unit.dy * Self.travelY * 0.9), at: time)
        pendingBlinks.append(time)
    }

    /// Landed: a small overshoot squash along the way it came in, settling in about 200 ms.
    public func flightLanded(direction: CGVector, at time: Double) {
        let length = max(hypot(direction.dx, direction.dy), 1e-6)
        landing = (CGVector(dx: direction.dx / length, dy: direction.dy / length), time)
        anticipation = nil
    }

    /// Dot appeared on a screen (HeyClicky blinks on pointer entry, rea-C7).
    public func appeared(at time: Double) { pendingBlinks.append(time + 0.05) }

    public func react(_ kind: OrbReaction, at time: Double) {
        if case .appSwitch = kind {
            guard time - lastAppGlance >= 10 else { return }   // he switches often; a blink is the gentlest cue (science-C62)
            lastAppGlance = time
        }
        if reaction != nil, case .appSwitch = kind { return }
        reaction = (kind, time)
        switch kind {
        case .agentDone, .pounce:
            if !input.reduceMotion { hop = (time, kind == .pounce ? 0.22 : 0.3) }
        case .thanks:
            blush = max(blush, 0.01)
        case .appSwitch(let dx):
            jumpGaze(to: CGPoint(x: (dx >= 0 ? 1 : -1) * Self.travelX * 0.8, y: 0), at: time)
            pendingBlinks.append(time + 0.04)
        case .dismissed:
            // A small nod, and the eyes look away: it heard the no (persona-C6).
            jumpGaze(to: CGPoint(x: -0.6 * Self.travelX, y: 0.3 * Self.travelY), at: time + 0.3)
        default:
            break
        }
    }

    /// The manager settled Dot on its perch: the routine runs from here.
    public func perched(at time: Double, edge: PerchPlanner.Edge) {
        perchedAt = time
        perchEdge = edge
        beat = nil
        routineIndex = 0
        nextBeatAt = time + 1.5
    }

    /// Input after the pet routine started: the alert look, then a hop (cute-C43, C44; cute-C3).
    public func woke(at time: Double) {
        guard wokeAt == nil else { return }
        wokeAt = time
        wakeHopped = false
        perchedAt = nil
        beat = nil
        pendingBlinks.append(time)
        pendingBlinks.append(time + 0.22)
    }

    /// Fed every frame by the rub detector.
    public func setRubbing(_ on: Bool, direction: Double, at time: Double) {
        if on, !rubbing {
            rubFull = time - rubFullAt >= 10
            if rubFull { rubFullAt = time }
        }
        if !on, rubbing { rubEndedAt = time }
        rubbing = on
        if on, direction != 0 { rubDirection = direction }
    }

    public var isRubbed: Bool { rubbing || now - rubEndedAt < 0.8 }

    // MARK: Step

    public func step(at time: Double, input next: OrbInput) -> OrbPose {
        if !started { started = true; now = time; nextBlinkAt = time + rng.jittered(mean: 4); nextDartAt = time + 1 }
        let dt = min(max(time - now, 0), 0.1)
        now = time
        input = next
        if input.mood != lastMood {
            if input.mood == .puzzled { react(.tilt, at: time) }
            lastMood = input.mood
        }
        updatePhase()
        updateWake()
        updatePetRoutine()
        updateBlink()
        updateGaze(dt: dt)
        var pose = OrbPose()
        updateLids(dt: dt)
        pose.left = lids
        pose.right = rightLids
        let blinkOpen = blinkOpenness()
        let asleep = tier == .asleep && wokeAt == nil
        for side in [0, 1] {
            var eye = side == 0 ? pose.left : pose.right
            eye.openness = asleep ? 0 : blinkOpen
            eye.widen = 1 + 0.2 * (1 - eye.openness)
            if side == 0 { pose.left = eye } else { pose.right = eye }
        }
        pose.gaze = gaze
        applyBody(&pose, dt: dt)
        applyMouth(&pose, dt: dt)
        applyGlyph(&pose)
        isBusy = blinkStart != nil || saccadeStart != nil || reaction != nil || hop != nil || anticipation != nil
            || landing != nil || input.motion == .flying || isRubbed || wokeAt != nil || beat != nil
            || input.speed > 1 || (input.phase == .speaking && !input.reduceMotion)
            || abs(lids.upperLid - lidTarget(right: false).upper) > 0.01 || abs(lids.lowerLid - lidTarget(right: false).lower) > 0.01
        if let reactionNow = reaction, now - reactionNow.start > reactionLength(reactionNow.kind) {
            reaction = nil
            nextBlinkAt = max(nextBlinkAt, now + 0.4)
        }
        return pose
    }

    // MARK: Phase and gaze

    private func updatePhase() {
        guard input.phase != lastPhase else { return }
        let from = lastPhase
        lastPhase = input.phase
        phaseStart = now
        asideStart = nil
        switch input.phase {
        case .thinking:
            // Look away, mostly up, while working it out (science-C29, C34), with a blink at the shift.
            thinkingStart = now
            pendingBlinks.append(now)
            jumpGaze(to: CGPoint(x: 0.6 * Self.travelX, y: -0.7 * Self.travelY), at: now)
        case .speaking:
            thinkingStart = nil
            answerEndAt = nil
            // Look away as the answer starts (science-C27, C28), then glance aside now and then.
            startAside(length: 1.96, at: now)
            if from == .thinking { pendingBlinks.append(now + 0.05) }
        case .listening:
            thinkingStart = nil
            nextAsideAt = now + rng.jittered(mean: 7.21, spread: 0.25)
            jumpGaze(to: .zero, at: now)
        case .idle:
            thinkingStart = nil
            answerEndAt = nil
        }
    }

    private func startAside(length: Double, at time: Double) {
        let side: Double = rng.unit() < 0.5 ? -1 : 1
        asideStart = time
        asideEnd = time + rng.jittered(mean: length, spread: 0.2)
        asideTarget = CGPoint(x: side * Self.travelX * 0.45, y: rng.range(-0.2, 0.2) * Self.travelY)
        jumpGaze(to: asideTarget, at: time)
    }

    private func jumpGaze(to target: CGPoint, at time: Double) {
        let distance = Double(hypot(target.x - gaze.x, target.y - gaze.y))
        guard distance > 0.004 else { return }
        saccadeFrom = gaze
        saccadeTo = target
        saccadeStart = time
        // 25 ms + 2.4 ms per degree, with the full travel taken as 10 degrees (science-C20): 2-3 frames.
        let degrees = distance / Self.travelX * 10
        saccadeDuration = 0.025 + 0.0024 * degrees
        // A large shift brings a blink with it (science-C14).
        if distance > Self.travelX * 0.5, now - lastBlinkEnd > 0.4, blinkStart == nil { pendingBlinks.append(time) }
    }

    private func desiredGaze() -> (target: CGPoint, pursuit: Bool)? {
        if let wake = wokeAt, now - wake < 0.7 { return (CGPoint(x: 0, y: -0.25 * Self.travelY), false) }
        if let reaction, case .appSwitch = reaction.kind { return nil }   // the jump already set it
        switch input.motion {
        case .flying:
            if anticipation != nil { return nil }
            let length = max(hypot(input.lead.dx, input.lead.dy), 1e-6)
            return (CGPoint(x: input.lead.dx / length * Self.travelX * 0.9, y: input.lead.dy / length * Self.travelY * 0.9), true)
        case .parked:
            if let look = input.parkedLook { return (CGPoint(x: look.x * Self.travelX, y: look.y * Self.travelY), false) }
        case .perched, .following:
            break
        }
        switch input.phase {
        case .thinking:
            if let start = thinkingStart, now - start < 3.5 { return (CGPoint(x: 0.6 * Self.travelX, y: -0.7 * Self.travelY), false) }
            return (.zero, false)
        case .listening:
            if let start = asideStart {
                if now < asideEnd { return (asideTarget, false) }
                if start < asideEnd { asideStart = nil; nextAsideAt = now + rng.jittered(mean: 7.21, spread: 0.25) }
            } else if now >= nextAsideAt {
                startAside(length: 1.14, at: now)
                return (asideTarget, false)
            }
            return (.zero, false)
        case .speaking:
            if let end = answerEndAt, now >= end { asideStart = nil; return (.zero, false) }
            if asideStart != nil {
                if now < asideEnd { return (asideTarget, false) }
                asideStart = nil
                nextAsideAt = now + rng.jittered(mean: 4.75, spread: 0.29)
            } else if now >= nextAsideAt, answerEndAt == nil || now < answerEndAt! {
                startAside(length: 1.96, at: now)
                return (asideTarget, false)
            }
            return (.zero, false)
        case .idle:
            break
        }
        // Idle: the eyes lead a moving body; at rest, small darts (craft-A2-05, A2-06).
        let leadLength = Double(hypot(input.lead.dx, input.lead.dy))
        if input.motion == .following, leadLength > 2, input.cursorRest < 1.5 {
            let x = max(-1, min(1, Double(input.lead.dx) / 40)), y = max(-1, min(1, Double(input.lead.dy) / 40))
            return (CGPoint(x: x * Self.travelX, y: y * Self.travelY), true)
        }
        if let beat, beat.kind == .lookAround {
            let p = (now - beat.start) / 2.4
            let x: Double = p < 0.33 ? -0.8 : (p < 0.66 ? 0.8 : 0)
            return (CGPoint(x: x * Self.travelX, y: 0), false)
        }
        if beat?.kind == .groom || beat?.kind == .scratch || beat?.kind == .scratchEdge { return (CGPoint(x: 0, y: 0.5 * Self.travelY), false) }
        guard input.cursorRest >= 1.5 || input.motion == .perched else { return (.zero, false) }
        if tier == .asleep { return (.zero, false) }
        if now >= nextDartAt {
            let calm = tier != .active
            nextDartAt = now + (calm ? rng.range(4, 8) : rng.range(1.0, 2.25))
            if hypot(dartTarget.x, dartTarget.y) > 0.001, rng.unit() < 0.5 {
                dartTarget = .zero                       // darts come back to center about half the time
            } else {
                // Mostly small (science-C19): exponential magnitude, capped; random direction.
                let magnitude = min(Self.dartCap, 0.13 * Self.travelX * rng.exponential(mean: 1))
                let angle = rng.range(0, 2 * .pi)
                dartTarget = CGPoint(x: magnitude * cos(angle), y: magnitude * sin(angle) * Self.travelY / Self.travelX)
            }
        }
        return (dartTarget, false)
    }

    private func updateGaze(dt: Double) {
        if let start = saccadeStart {
            let p = min((now - start) / saccadeDuration, 1)
            let e = 1 - (1 - p) * (1 - p)
            gaze = CGPoint(x: saccadeFrom.x + (saccadeTo.x - saccadeFrom.x) * e, y: saccadeFrom.y + (saccadeTo.y - saccadeFrom.y) * e)
            if p >= 1 { saccadeStart = nil; gaze = saccadeTo }
            return
        }
        guard let desired = desiredGaze() else { return }
        if desired.pursuit {
            // Smooth pursuit while the body moves: a 40 ms follow, no jumps.
            let k = 1 - exp(-dt / 0.04)
            gaze = CGPoint(x: gaze.x + (desired.target.x - gaze.x) * k, y: gaze.y + (desired.target.y - gaze.y) * k)
        } else {
            jumpGaze(to: desired.target, at: now)
        }
    }

    // MARK: Blinks

    private func blinkMean() -> Double {
        switch tier {
        case .calm: return 10          // readers blink 4.5/min (science-C2); about six a minute
        case .pet: return 6
        case .drowsy: return 9
        case .asleep: return 60
        case .active: break
        }
        switch input.phase {
        case .idle: return 5           // about 12 a minute (science-C1 rest 17/min; Vector 3-10 s, craft-A2-04)
        case .listening: return 6
        case .thinking: return 8
        case .speaking: return 4.5     // the sentence blinks carry most of it
        }
    }

    private func updateBlink() {
        if let start = blinkStart, now - start >= blinkLength() {
            blinkStart = nil
            lastBlinkEnd = now
            nextBlinkAt = now + rng.jittered(mean: blinkMean())
        }
        // While he talks, blink just after his pauses (science-C12, C13).
        if input.phase == .listening {
            if input.micLevel < 0.05 {
                if micBelowSince == nil { micBelowSince = now; micPauseFired = false }
                if let since = micBelowSince, now - since >= 0.3, !micPauseFired {
                    micPauseFired = true
                    pendingBlinks.append(now + rng.range(0.0, 0.2))     // 0.25-0.5 s after the pause began
                }
            } else {
                micBelowSince = nil
            }
        }
        guard blinkStart == nil else { pendingBlinks.removeAll { $0 <= now }; return }
        let suppressed = reaction != nil && !isAppGlance
        if suppressed { pendingBlinks.removeAll { $0 <= now }; return }
        let due = pendingBlinks.contains { $0 <= now } || now >= nextBlinkAt
        pendingBlinks.removeAll { $0 <= now }
        guard due, now - lastBlinkEnd >= 0.15, tier != .asleep || wokeAt != nil else {
            if now >= nextBlinkAt, now - lastBlinkEnd < 0.15 { nextBlinkAt = lastBlinkEnd + 0.15 }
            return
        }
        blinkStart = now
        blinkSlow = tier == .drowsy ? 1.6 : 1
    }

    private var isAppGlance: Bool { if let reaction, case .appSwitch = reaction.kind { return true }; return false }

    private func blinkLength() -> Double { (Self.blinkClose + Self.blinkShut + Self.blinkOpen) * blinkSlow }

    /// Close with an ease-in, hold, open with an ease-out (science-C5: about 100 ms down, 220 ms up).
    private func blinkOpenness() -> Double {
        guard let start = blinkStart else { return 1 }
        let close = Self.blinkClose * blinkSlow, shut = Self.blinkShut * blinkSlow, open = Self.blinkOpen * blinkSlow
        let e = now - start
        if e < close { let p = e / close; return 1 - p * p }
        if e < close + shut { return 0 }
        let p = min((e - close - shut) / open, 1)
        return 1 - (1 - p) * (1 - p)
    }

    /// The openness curve, sampled: for tests (closing must be quicker than opening).
    public static func blinkCurve(at elapsed: Double) -> Double {
        if elapsed < blinkClose { let p = elapsed / blinkClose; return 1 - p * p }
        if elapsed < blinkClose + blinkShut { return 0 }
        let p = min((elapsed - blinkClose - blinkShut) / blinkOpen, 1)
        return 1 - (1 - p) * (1 - p)
    }

    // MARK: Lids (moods)

    private func lidTarget(right: Bool) -> (upper: Double, lower: Double, scale: Double) {
        var upper = 0.0, lower = 0.0, scale = 1.0
        switch input.mood {
        case .happy: lower = 0.55                       // Cozmo's happy eyes squeeze into slits (craft-A2-18)
        case .puzzled: if right { scale = 0.85 }
        case .focused: upper = 0.15
        case .sleepy: upper = 0.55
        case .neutral: break
        }
        if input.phase == .listening { upper = max(upper, 0.1) }
        switch tier {
        case .drowsy: upper = max(upper, 0.45)
        case .pet: if beat?.kind == .groom { upper = max(upper, 0.5) }
        default: break
        }
        if beat?.kind == .yawn { upper = 1 }
        if let wake = wokeAt, now - wake < 0.7 { upper = 0; lower = 0; scale = 1.15 }
        if isRubbed { lower = 0.55; upper = 0 }
        if let reaction {
            switch reaction.kind {
            case .agentDone, .thanks: lower = 0.55
            case .agentFailed: upper = max(upper, 0.4)
            default: break
            }
        }
        return (upper, lower, scale)
    }

    private func updateLids(dt: Double) {
        // A zero-bounce blend toward the mood's pose (rea-C11's few numbers), 120 ms time constant.
        let k = 1 - exp(-dt / 0.12)
        for right in [false, true] {
            let target = lidTarget(right: right)
            var eye = right ? rightLids : lids
            eye.upperLid += (target.upper - eye.upperLid) * k
            eye.lowerLid += (target.lower - eye.lowerLid) * k
            eye.scale += (target.scale - eye.scale) * k
            if right { rightLids = eye } else { lids = eye }
        }
    }

    // MARK: Body

    private func applyBody(_ pose: inout OrbPose, dt: Double) {
        let still = input.reduceMotion
        // Breath: a steady sine, slower as Dot gets sleepy, paused in flight (science-C47, C48).
        let period: Double = tier == .asleep ? Self.asleepBreath : (tier == .drowsy ? Self.drowsyBreath : Self.breathPeriod)
        breathPhase += dt * 2 * .pi / period
        let moving = input.motion == .flying || input.speed > 200
        pose.breath = still || moving ? 1 : 1 + Self.breathAmplitude * sin(breathPhase)

        // Glow: the phase's level times a slow wander within 0.92-1.14 (craft-A2-14).
        let wander = 0.92 + (OrbNoise.value(now / 4, seed: noiseSeed) + 1) / 2 * 0.22
        var glow = wander
        if tier == .drowsy { glow *= 0.85 }
        if tier == .asleep && wokeAt == nil { glow *= 0.7 }
        if isRubbed && rubFull { glow *= 1.15 }
        pose.glow = glow

        // Squash and stretch, always area-preserving (craft-A1-05, A1-07): the strongest one wins.
        var stretch = 1.0, angle = 0.0
        func offer(_ s: Double, _ a: Double) { if abs(log(s)) > abs(log(stretch)) { stretch = s; angle = a } }
        let leadLength = Double(hypot(input.lead.dx, input.lead.dy))
        if input.motion == .flying {
            offer(1 + min(input.speed / 1500, 1) * 0.3, atan2(Double(input.lead.dy), Double(input.lead.dx)))
        } else if leadLength > 0.5 {
            offer(1 + min(leadLength / 60, 1) * 0.15, atan2(Double(input.lead.dy), Double(input.lead.dx)))
        }
        if let a = anticipation {
            let e = now - a.start
            if e < 0.15 { offer(1 - 0.13 * sin(e / 0.15 * .pi / 2), atan2(Double(a.direction.dy), Double(a.direction.dx))) } else { anticipation = nil }
        }
        if let l = landing {
            let e = now - l.start
            if e < 0.2 {
                let s = 1 - 0.12 * exp(-e / 0.06) * cos(2 * .pi * e / 0.2)
                offer(s, atan2(Double(l.direction.dy), Double(l.direction.dx)))
            } else { landing = nil }
        }
        var offset = CGPoint.zero
        if let h = hop {
            let e = now - h.start
            if e < 0.3 {
                offset.y -= CGFloat(h.height * sin(e / 0.3 * .pi))
                offer(1 + 0.08 * sin(e / 0.3 * .pi), -.pi / 2)            // a little taller in the air
            } else if e < 0.38 {
                offer(1.15, 0)                                           // 1.15 x 0.87 on landing for 80 ms
            } else { hop = nil }
        }
        // Rotation: the tilt, the purr, the groom and scratch, the lean into a rub.
        var rotation = 0.0
        var tiltTarget = 0.0
        if let reaction {
            let e = now - reaction.start
            switch reaction.kind {
            case .agentFailed: offset.y += CGFloat(0.1 * sin(min(e / 0.25, 1) * .pi / 2) * (e > 0.45 ? max(0, 1 - (e - 0.45) / 0.15) : 1))
            case .dismissed: offset.y += CGFloat(0.1 * sin(min(e / 0.4, 1) * .pi))
            case .tilt: tiltTarget = 0.24
            default: break
            }
        }
        // A fast tilt reads cutest (cute-C7): about 0.5 s to get there.
        bodyTilt += (tiltTarget - bodyTilt) * (1 - exp(-dt / 0.15))
        rotation += bodyTilt
        if isRubbed {
            if rubFull { rotation += 0.07 * sin(now * 2 * .pi * 2) }          // a 2 Hz purr
            rotation += 0.12 * rubDirection * (rubbing ? 1 : max(0, 1 - (now - rubEndedAt) / 0.8))
        }
        if let beat {
            let e = now - beat.start
            switch beat.kind {
            case .groom: offset.x += CGFloat(0.04 * sin(e * 2 * .pi * 3)); rotation += 0.06 * sin(e * 2 * .pi * 3)
            case .scratch: rotation += 0.2 + 0.06 * sin(e * 2 * .pi * 8)
            case .scratchEdge: offset.x += CGFloat(0.05 * sin(e * 2 * .pi * 6)); rotation -= 0.1
            case .yawn: offer(1 + 0.12 * sin(min(e / 2.5, 1) * .pi), -.pi / 2)
            case .lookAround: break
            }
        }
        // Waking: wide eyes, then a hop once the alert look is over (cute-C44, C3).
        if let wake = wokeAt {
            let e = now - wake
            if e >= 0.7, !wakeHopped, !still { wakeHopped = true; hop = (now, 0.3) }
        }
        if still {
            pose.stretch = 1
            pose.rotation = 0
            pose.offset = .zero
        } else {
            pose.stretch = min(max(stretch, 0.77), 1.3)
            pose.stretchAngle = angle
            pose.rotation = rotation
            pose.offset = offset
        }

        // Blush: petting and praise only (a design call; cute-C35 found no study of it).
        let blushTarget: Double = (isRubbed && rubFull) || (reaction?.kind == .thanks) ? 1 : 0
        blush += (blushTarget - blush) * (1 - exp(-dt / (blushTarget > blush ? 0.15 : 0.5)))
        pose.blush = blush < 0.01 ? 0 : blush
    }

    private func applyMouth(_ pose: inout OrbPose, dt: Double) {
        // No mouth at rest (cute-C13). It shows while speaking, from the voice's level (craft-A6-05), and for happy.
        let speaking = input.phase == .speaking
        var level = input.speechLevel
        if speaking, input.speechUnmetered {
            let slow = (sin(now * 9.0) + 1) / 2, fast = (sin(now * 23.0) + 1) / 2
            level = (slow * 0.6 + fast * 0.4) * 0.7
        }
        let target = speaking ? level : 0
        let k = 1 - exp(-dt / (target > mouthOpen ? 0.03 : 0.09))
        mouthOpen += (target - mouthOpen) * k
        let happy = input.mood == .happy || reaction?.kind == .agentDone || reaction?.kind == .thanks || (isRubbed && rubFull)
        pose.mouthVisible = (speaking && mouthOpen > 0.02) || happy
        pose.mouthOpen = speaking ? mouthOpen : 0
        pose.mouthCurve = happy ? 0.5 : 0.15
    }

    private func applyGlyph(_ pose: inout OrbPose) {
        if let wake = wokeAt, now - wake < 0.7 {
            pose.glyph = .alert
            pose.glyphProgress = (now - wake) / 0.7
        } else if tier == .asleep, wokeAt == nil, input.motion == .perched {
            pose.glyph = .sleeping
            pose.glyphProgress = (now.truncatingRemainder(dividingBy: 6)) / 6
        }
    }

    // MARK: The pet's day

    private func updateWake() {
        guard let wake = wokeAt else { return }
        if now - wake > 1.2 { wokeAt = nil }
    }

    private func updatePetRoutine() {
        guard input.motion == .perched, let arrived = perchedAt, wokeAt == nil else { beat = nil; return }
        if tier == .asleep || tier == .drowsy { beat = nil; return }
        if let current = beat, now - current.start > beatLength(current.kind) { beat = nil }
        guard beat == nil, now >= nextBeatAt else { return }
        // oneko's order after settling: groom, scratch, yawn (cute-C38 to C46); then a random idle about
        // every 20 s (cute-C47). On a screen edge it scratches the edge instead (oneko's togi).
        _ = arrived
        let groom: Beat = perchEdge == .screen ? .scratchEdge : .groom
        let kind: Beat
        if routineIndex < 3 {
            kind = [groom, .scratch, .yawn][routineIndex]
        } else {
            let r = rng.unit()
            kind = r < 0.35 ? groom : (r < 0.6 ? .scratch : (r < 0.8 ? .lookAround : .yawn))
        }
        let scripted = routineIndex < 3
        routineIndex += 1
        beat = (kind, now)
        nextBeatAt = now + beatLength(kind) + (scripted ? 0.6 : rng.exponential(mean: 20))
    }

    private func beatLength(_ kind: Beat) -> Double {
        switch kind {
        case .groom: return 2.5
        case .scratch: return 1.0
        case .scratchEdge: return 1.5
        case .yawn: return 2.5
        case .lookAround: return 2.4
        }
    }

    private func reactionLength(_ kind: OrbReaction) -> Double {
        switch kind {
        case .agentDone: return 0.6
        case .agentFailed: return 0.6
        case .thanks: return 1.2
        case .dismissed: return 0.5
        case .pounce: return 0.45
        case .appSwitch: return 0.5
        case .tilt: return 1.2
        }
    }
}
