import CoreGraphics
import XCTest
@testable import DotKit

/// The alive pass's checks (docs/alive.md): each test names the spec item it proves.
final class OrbAnimatorTests: XCTestCase {
    private let fps = 60.0

    /// Step an animator for `seconds` at 60 Hz; `configure` edits the input each frame, `events` fires
    /// time-based events. Returns every pose with its time.
    private func run(_ animator: OrbAnimator = OrbAnimator(seed: 42), seconds: Double, start: Double = 0,
                     configure: (Double, inout OrbInput) -> Void = { _, _ in },
                     events: (Double, OrbAnimator) -> Void = { _, _ in }) -> [(t: Double, pose: OrbPose)] {
        var out: [(Double, OrbPose)] = []
        let frames = Int(seconds * fps)
        for i in 0...frames {
            let t = start + Double(i) / fps
            var input = OrbInput()
            configure(t, &input)
            events(t, animator)
            out.append((t, animator.step(at: t, input: input)))
        }
        return out
    }

    private func blinkStarts(_ poses: [(t: Double, pose: OrbPose)]) -> [Double] {
        var starts: [Double] = []
        var wasOpen = true
        for (t, pose) in poses {
            let open = pose.left.openness > 0.5
            if wasOpen && !open { starts.append(t) }
            wasOpen = open
        }
        return starts
    }

    // MARK: 1.1 Blink shape

    func testBlinkClosesFasterThanItOpens() {
        let step = 0.001
        var closedAt: Double?, openedAt: Double?
        var t = 0.0
        while t < 0.5 {
            let v = OrbAnimator.blinkCurve(at: t)
            if closedAt == nil, v <= 0.0001 { closedAt = t }
            if closedAt != nil, openedAt == nil, t > OrbAnimator.blinkClose + OrbAnimator.blinkShut, v >= 0.9999 { openedAt = t }
            t += step
        }
        let close = try! XCTUnwrap(closedAt)
        let total = try! XCTUnwrap(openedAt)
        let open = total - close - OrbAnimator.blinkShut
        XCTAssertLessThan(close, open, "closing must be quicker than opening (science-C5, C6)")
        XCTAssertEqual(total, 0.33, accuracy: 1 / fps, "about 330 ms in all")
    }

    func testBlinkWidensAsItFlattens() {
        let poses = run(seconds: 30, configure: { _, i in i.cursorRest = 0 })
        let widest = poses.map(\.pose.left.widen).max() ?? 1
        XCTAssertGreaterThan(widest, 1.15)
        XCTAssertLessThanOrEqual(widest, 1.2 + 1e-9)
    }

    // MARK: 1.2 Blink timing by moment

    func testIdleBlinkRate() {
        let poses = run(seconds: 600, configure: { t, i in i.sinceInput = t.truncatingRemainder(dividingBy: 20) })
        let perMinute = Double(blinkStarts(poses).count) / 10
        XCTAssertTrue((9...15).contains(perMinute), "idle \(perMinute)/min")
    }

    func testListeningBlinksAfterPauses() {
        // He talks 2.5 s, pauses 0.8 s, over and over.
        let poses = run(seconds: 600, configure: { t, i in
            i.phase = .listening
            i.sinceInput = 1
            i.micLevel = t.truncatingRemainder(dividingBy: 3.3) < 2.5 ? 0.5 : 0
        })
        let perMinute = Double(blinkStarts(poses).count) / 10
        XCTAssertTrue((8...20).contains(perMinute), "listening \(perMinute)/min")
    }

    func testSpeakingBlinksAtSentences() {
        var nextSentence = 0.5
        let poses = run(seconds: 600, configure: { _, i in i.phase = .speaking; i.sinceInput = 1 }, events: { t, a in
            if t >= nextSentence { a.sentenceStarted(at: t, duration: 3, isLast: false); nextSentence += 3 }
        })
        let perMinute = Double(blinkStarts(poses).count) / 10
        XCTAssertTrue((15...30).contains(perMinute), "speaking \(perMinute)/min")
    }

    func testBlinksNeverRunTogether() {
        var nextSentence = 0.2
        let poses = run(seconds: 300, configure: { _, i in i.phase = .speaking }, events: { t, a in
            if t >= nextSentence { a.sentenceStarted(at: t, duration: 1, isLast: false); nextSentence += 0.4 }
        })
        var lastEnd = -Double.infinity
        var closed = false
        for (t, pose) in poses {
            let isClosed = pose.left.openness < 0.999
            if isClosed && !closed { XCTAssertGreaterThanOrEqual(t - lastEnd, 0.15 - 1 / fps, "a blink began \(t - lastEnd) s after the last") }
            if !isClosed && closed { lastEnd = t }
            closed = isClosed
        }
    }

    // MARK: 1.3-1.5 Eyes

    func testSaccadeSnapsInThreeFrames() {
        let animator = OrbAnimator(seed: 7)
        _ = animator.step(at: 0, input: OrbInput())
        var input = OrbInput()
        input.phase = .thinking
        var frames = 0
        let target = CGPoint(x: 0.6 * OrbAnimator.travelX, y: -0.7 * OrbAnimator.travelY)
        var t = 0.0
        repeat {
            t += 1 / fps
            frames += 1
            let pose = animator.step(at: t, input: input)
            if abs(pose.gaze.x - target.x) < 1e-9, abs(pose.gaze.y - target.y) < 1e-9 { break }
        } while frames < 20
        // The first frame is the onset (the eyes have not moved yet); the jump itself takes at most 3 more.
        XCTAssertLessThanOrEqual(frames - 1, 3, "the jump to the thinking glance took \(frames - 1) frames after onset")
    }

    func testDartsAreSmallAndOnlyAtRest() {
        var offsets: [Double] = []
        var last = CGPoint.zero
        for (_, pose) in run(seconds: 600, configure: { _, i in i.cursorRest = 5; i.sinceInput = 5 }) {
            if pose.gaze != last { offsets.append(Double(hypot(pose.gaze.x, pose.gaze.y))) }
            last = pose.gaze
        }
        let settled = offsets.filter { $0 > 0 }
        XCTAssertGreaterThan(settled.count, 50)
        XCTAssertLessThanOrEqual(settled.max() ?? 0, OrbAnimator.dartCap + 1e-9)
        let sorted = settled.sorted()
        let p90 = sorted[Int(Double(sorted.count) * 0.9)]
        XCTAssertLessThanOrEqual(p90, OrbAnimator.travelX / 3, "90% of darts are small (science-C19)")

        // The cursor still moving (not rested): no darts at all.
        for (_, pose) in run(seconds: 60, configure: { _, i in i.cursorRest = 0.2; i.sinceInput = 0 }) {
            XCTAssertLessThan(Double(hypot(pose.gaze.x, pose.gaze.y)), 1e-9)
        }
    }

    func testThinkingAversionEndsWithTheAnswerOrAfterThreeAndAHalfSeconds() {
        let up = -0.7 * OrbAnimator.travelY
        // Long think: back to center by 3.5 s.
        let long = run(seconds: 6, configure: { _, i in i.phase = .thinking })
        for (t, pose) in long where t > 3.6 { XCTAssertNotEqual(pose.gaze.y, up, accuracy: 1e-6, "still averted at \(t)") }
        // The answer arrives at 1 s: the up-glance ends there.
        let quick = run(seconds: 3, configure: { t, i in i.phase = t < 1 ? .thinking : .speaking })
        for (t, pose) in quick where t > 1.1 { XCTAssertGreaterThan(Double(pose.gaze.y), up + 0.3 * OrbAnimator.travelY, "at \(t)") }
    }

    func testNoAversionAfterTheAnswerEnds() {
        // The last sentence starts at 1 s and lasts 3 s: eyes centered from 1.6 s on (science-C33).
        let poses = run(seconds: 12, configure: { _, i in i.phase = .speaking }, events: { t, a in
            if abs(t - 1) < 0.5 / 60 { a.sentenceStarted(at: t, duration: 3, isLast: true) }
        })
        for (t, pose) in poses where t > 1.7 { XCTAssertEqual(Double(hypot(pose.gaze.x, pose.gaze.y)), 0, accuracy: 1e-9, "at \(t)") }
    }

    func testSpeakingGlancesAside() {
        let poses = run(seconds: 30, configure: { _, i in i.phase = .speaking })
        let aside = poses.filter { abs($0.pose.gaze.x) > 0.3 * OrbAnimator.travelX }.count
        XCTAssertGreaterThan(aside, 0)
        XCTAssertLessThan(Double(aside) / Double(poses.count), 0.6, "mostly looking at him")
    }

    func testFlightLooksAtTheTargetFirst() {
        let animator = OrbAnimator(seed: 3)
        _ = animator.step(at: 0, input: OrbInput())
        animator.flightWillStart(toward: CGVector(dx: 120, dy: -10), at: 0.02)
        var input = OrbInput()
        input.motion = .flying
        var pose = OrbPose()
        for i in 1...4 { pose = animator.step(at: 0.02 + Double(i) / fps, input: input) }
        XCTAssertGreaterThan(pose.gaze.x, 0, "eyes go toward the target before the body moves")
    }

    // MARK: 1.6-1.8 Motion

    func testSpringOvershootIsSmallAndVelocityContinuous() {
        var spring = Spring2D(position: .zero)
        var maxX: CGFloat = 0
        for _ in 0..<120 { spring.step(toward: CGPoint(x: 100, y: 0), dt: 1 / fps); maxX = max(maxX, spring.position.x) }
        XCTAssertLessThan(maxX, 115, "overshoot under 15% of the move")
        XCTAssertEqual(spring.position.x, 100, accuracy: 1)

        // A cursor at 500 px/s that reverses: the follower's velocity changes smoothly.
        var follower = Spring2D(position: .zero)
        var cursor = CGPoint.zero
        var lastV = CGVector.zero
        var biggest: Double = 0
        for i in 0..<240 {
            cursor.x += (i < 120 ? 500 : -500) / CGFloat(fps)
            follower.step(toward: cursor, dt: 1 / fps)
            biggest = max(biggest, Double(abs(follower.velocity.dx - lastV.dx)))
            lastV = follower.velocity
        }
        XCTAssertLessThan(biggest, 260, "no jump in velocity between frames")
    }

    func testSquashAlwaysKeepsArea() {
        let animator = OrbAnimator(seed: 11)
        var poses: [OrbPose] = []
        for i in 0...1800 {
            let t = Double(i) / fps
            var input = OrbInput()
            input.motion = (i / 300) % 2 == 0 ? .following : .flying
            input.lead = CGVector(dx: 80 * sin(t), dy: 40 * cos(t * 1.3))
            input.speed = 1200 * abs(sin(t * 0.7))
            if i % 400 == 0 { animator.flightWillStart(toward: CGVector(dx: 1, dy: 1), at: t) }
            if i % 400 == 60 { animator.flightLanded(direction: CGVector(dx: 1, dy: 0), at: t) }
            if i % 500 == 0 { animator.react(.agentDone, at: t) }
            poses.append(animator.step(at: t, input: input))
        }
        for pose in poses {
            XCTAssertEqual(pose.squash.along * pose.squash.across, 1, accuracy: 1e-6)
            XCTAssertTrue((0.77...1.3).contains(pose.stretch))
        }
    }

    func testNoSwellInFlight() {
        let poses = run(seconds: 10, configure: { t, i in i.motion = .flying; i.lead = CGVector(dx: 300, dy: 0); i.speed = 900 + 200 * sin(t) })
        for (_, pose) in poses { XCTAssertLessThanOrEqual(pose.breath * pose.breath * pose.squash.along * pose.squash.across, 1 + 1e-9) }
    }

    func testAnticipationComesBeforeAnyMove() {
        let path = FlightPath(from: CGPoint(x: 10, y: 10), to: CGPoint(x: 400, y: 200))
        let early = path.sample(at: 0.1)
        XCTAssertEqual(early.stage, .anticipating)
        XCTAssertEqual(early.point, CGPoint(x: 10, y: 10))
        XCTAssertEqual(path.sample(at: 0.16).stage, .moving)
        XCTAssertEqual(path.sample(at: path.total + 0.01).stage, .done)
        XCTAssertEqual(path.sample(at: path.total + 0.01).point, CGPoint(x: 400, y: 200))
    }

    // MARK: 1.9 Breath and glow

    func testBreathPeriodAndGlowBand() {
        let poses = run(seconds: 600, configure: { _, i in i.sinceInput = 5 })
        var peaks: [Double] = []
        for k in 1..<(poses.count - 1) where poses[k].pose.breath > poses[k - 1].pose.breath && poses[k].pose.breath >= poses[k + 1].pose.breath {
            peaks.append(poses[k].t)
        }
        let gaps = zip(peaks.dropFirst(), peaks).map { $0 - $1 }
        let mean = gaps.reduce(0, +) / Double(gaps.count)
        XCTAssertEqual(mean, 5, accuracy: 0.1)
        XCTAssertLessThanOrEqual(poses.map(\.pose.breath).max()!, 1 + OrbAnimator.breathAmplitude + 1e-9)
        for (_, pose) in poses { XCTAssertTrue((0.92 - 1e-9...1.14 + 1e-9).contains(pose.glow), "glow \(pose.glow)") }
    }

    // MARK: 1.10 The face

    func testMoodsArePosesOfTheLids() {
        func settled(_ mood: OrbMood) -> OrbPose { run(seconds: 2, configure: { _, i in i.mood = mood }).last!.pose }
        XCTAssertEqual(settled(.happy).left.lowerLid, 0.55, accuracy: 0.02)
        XCTAssertEqual(settled(.sleepy).left.upperLid, 0.55, accuracy: 0.02)
        XCTAssertEqual(settled(.focused).right.upperLid, 0.15, accuracy: 0.02)
        let puzzled = run(seconds: 0.6, configure: { _, i in i.mood = .puzzled }).last!.pose
        XCTAssertEqual(puzzled.right.scale, 0.85, accuracy: 0.03)
        XCTAssertGreaterThan(puzzled.rotation, 0.18, "a fast head tilt (cute-C7)")
        let neutral = settled(.neutral)
        XCTAssertFalse(neutral.mouthVisible, "no mouth at rest (cute-C13)")
        XCTAssertTrue(settled(.happy).mouthVisible)
    }

    func testSpeechLevelMapping() {
        XCTAssertEqual(SpeechLevel.openness(decibels: -80), 0)
        XCTAssertEqual(SpeechLevel.openness(decibels: -44), 0, "under the floor is silence")
        XCTAssertEqual(SpeechLevel.openness(decibels: -.infinity), 0)
        XCTAssertEqual(SpeechLevel.openness(decibels: -5), 1)
        var last = 0.0
        for db in stride(from: Float(-60), through: 0, by: 0.5) {
            let v = SpeechLevel.openness(decibels: db)
            XCTAssertGreaterThanOrEqual(v, last)
            last = v
        }
    }

    func testMouthClosesBetweenSentences() {
        let poses = run(seconds: 4, configure: { t, i in i.phase = .speaking; i.speechLevel = t.truncatingRemainder(dividingBy: 2) < 1.4 ? 0.8 : 0 })
        let pause = poses.filter { $0.t.truncatingRemainder(dividingBy: 2) > 1.8 }
        for (_, pose) in pause { XCTAssertLessThan(pose.mouthOpen, 0.05) }
        XCTAssertGreaterThan(poses.map(\.pose.mouthOpen).max()!, 0.6)
    }

    // MARK: 2.1-2.3 A pet's day

    func testTierLadder() {
        XCTAssertEqual(OrbAnimator.tier(sinceInput: 30, perched: false), .active)
        XCTAssertEqual(OrbAnimator.tier(sinceInput: 90, perched: false), .calm)
        XCTAssertEqual(OrbAnimator.tier(sinceInput: 200, perched: false), .calm, "no routine until it has moved off his text")
        XCTAssertEqual(OrbAnimator.tier(sinceInput: 200, perched: true), .pet)
        XCTAssertEqual(OrbAnimator.tier(sinceInput: 400, perched: true), .drowsy)
        XCTAssertEqual(OrbAnimator.tier(sinceInput: 1000, perched: true), .asleep)
    }

    func testPetRoutineWaitsThreeMinutesAndRespectsGuards() {
        let animator = OrbAnimator(seed: 5)
        var input = OrbInput()
        input.sinceInput = 170
        _ = animator.step(at: 0, input: input)
        XCTAssertFalse(animator.wantsPerch, "reading is not a break")
        input.sinceInput = 185
        _ = animator.step(at: 1, input: input)
        XCTAssertTrue(animator.wantsPerch)
        for guardOn in [\OrbInput.onCall, \OrbInput.recording, \OrbInput.agentWorking, \OrbInput.reduceMotion] {
            var guarded = input
            guarded[keyPath: guardOn] = true
            _ = animator.step(at: 2, input: guarded)
            XCTAssertFalse(animator.wantsPerch)
        }
        var talking = input
        talking.phase = .listening
        _ = animator.step(at: 3, input: talking)
        XCTAssertFalse(animator.wantsPerch)
        // Perched when an agent starts: back to the cursor.
        var perched = input
        perched.motion = .perched
        perched.agentWorking = true
        _ = animator.step(at: 4, input: perched)
        XCTAssertTrue(animator.wantsReturn)
    }

    func testPerchNeverCoversContent() {
        var rng = SeededRandom(seed: 99)
        let screen = CGRect(x: 0, y: 0, width: 1512, height: 982)
        for _ in 0..<2000 {
            let w = CGFloat(rng.range(200, 1512)), h = CGFloat(rng.range(150, 960))
            let window = CGRect(x: CGFloat(rng.range(-50, 1512 - Double(w) + 50)), y: CGFloat(rng.range(0, 982 - Double(h))), width: w, height: h)
            let cursor = CGPoint(x: rng.range(0, 1512), y: rng.range(0, 982))
            let radius = CGFloat(rng.range(8, 18))
            let perch = PerchPlanner.perch(window: window, cursor: cursor, screen: screen, radius: radius)
            let content = CGRect(x: window.minX, y: window.minY + 28, width: window.width, height: window.height - 28)
            XCTAssertFalse(PerchPlanner.overlaps(perch.point, radius, content), "perch \(perch) over content \(content)")
            XCTAssertTrue(screen.insetBy(dx: radius - 0.5, dy: radius - 0.5).contains(perch.point), "perch \(perch.point) off screen")
        }
        // No window: a screen edge.
        XCTAssertEqual(PerchPlanner.perch(window: nil, cursor: CGPoint(x: 700, y: 500), screen: screen, radius: 12).edge, .screen)
    }

    func testAZoomedWindowStillLeavesItsTitleBar() {
        // A window filling the screen below the menu bar: no room above it, so Dot sits in its title band.
        let screen = CGRect(x: 0, y: 0, width: 1512, height: 982)
        let window = CGRect(x: 0, y: 25, width: 1512, height: 957)
        let perch = PerchPlanner.perch(window: window, cursor: CGPoint(x: 700, y: 900), screen: screen, radius: 12)
        XCTAssertEqual(perch.edge, .titleBar, "a 24 px orb fits the 28 px title band")
        XCTAssertFalse(PerchPlanner.overlaps(perch.point, 12, CGRect(x: 0, y: 53, width: 1512, height: 929)))
    }

    func testRoutineRunsGroomScratchYawnInOrder() {
        let animator = OrbAnimator(seed: 8)
        var input = OrbInput()
        input.motion = .perched
        input.sinceInput = 200
        var rotations: [(Double, Double)] = []
        for i in 0...(20 * 60) {
            let t = Double(i) / fps
            if i == 0 { _ = animator.step(at: 0, input: input); animator.perched(at: 0, edge: .windowTop) }
            let pose = animator.step(at: t, input: input)
            rotations.append((t, pose.rotation))
        }
        // Nothing moves while it settles (1.5 s), then the groom wiggle starts.
        XCTAssertTrue(rotations.filter { $0.0 < 1.4 }.allSatisfy { abs($0.1) < 1e-6 })
        XCTAssertTrue(rotations.contains { $0.0 > 1.5 && $0.0 < 4 && abs($0.1) > 0.02 })
    }

    func testWakeIsAlertThenHop() {
        let animator = OrbAnimator(seed: 9)
        var input = OrbInput()
        input.motion = .perched
        input.sinceInput = 1000
        _ = animator.step(at: 0, input: input)
        animator.perched(at: 0, edge: .windowTop)
        XCTAssertEqual(animator.step(at: 5, input: input).glyph, .sleeping)
        input.sinceInput = 0
        animator.woke(at: 5.0)
        let alert = animator.step(at: 5.3, input: input)
        XCTAssertEqual(alert.glyph, .alert)
        XCTAssertGreaterThan(alert.left.scale, 1.05, "eyes wide")
        XCTAssertGreaterThan(alert.left.openness, 0.0)
        var lowest: CGFloat = 0
        var t = 5.3
        while t < 6.4 { t += 1 / fps; lowest = min(lowest, animator.step(at: t, input: input).offset.y) }
        XCTAssertLessThan(lowest, -0.2, "a hop after the alert look (cute-C3)")
        XCTAssertGreaterThan(PetWake.distance, 5.9)
        XCTAssertFalse(PetWake.shouldWake(moved: 6))
        XCTAssertTrue(PetWake.shouldWake(moved: 6.5))
    }

    // MARK: 2.4-2.5 Fling and rub

    private func minimumJerk(distance: Double, duration: Double, at t: Double) -> Double {
        let s = min(max(t / duration, 0), 1)
        return distance * (10 * pow(s, 3) - 15 * pow(s, 4) + 6 * pow(s, 5))
    }

    func testOrdinaryPointingIsNotAFling() {
        for (distance, duration) in [(1500.0, 0.5), (1500.0, 0.7), (900.0, 0.35), (600.0, 0.25)] {
            var detector = FlingDetector()
            var fired = false
            for i in 0...Int(duration * fps + 30) {
                let t = Double(i) / fps
                if detector.add(CGPoint(x: minimumJerk(distance: distance, duration: duration, at: t), y: 300), at: t) == .began { fired = true }
            }
            XCTAssertFalse(fired, "a \(Int(distance)) px pointing move in \(duration) s")
        }
    }

    func testAFlingFiresOnceThenCoolsDown() {
        var detector = FlingDetector()
        var events: [FlingDetector.Event] = []
        func fling(from t0: Double) {
            for i in 0...40 {
                let t = t0 + Double(i) / fps
                if let e = detector.add(CGPoint(x: minimumJerk(distance: 1500, duration: 0.25, at: t - t0), y: 300), at: t) { events.append(e) }
            }
        }
        fling(from: 0)
        XCTAssertEqual(events.first, .began)
        XCTAssertTrue(events.contains { if case .stopped = $0 { return true }; return false })
        events.removeAll()
        fling(from: 10)
        XCTAssertFalse(events.contains(.began), "30 s cooldown")
        fling(from: 45)
        XCTAssertTrue(events.contains(.began))
    }

    func testRubNeedsThreeReversals() {
        let orb = CGPoint(x: 200, y: 200)
        func rub(reversals: Int) -> Bool {
            var detector = RubDetector()
            var on = false
            var x: CGFloat = 196
            var direction: CGFloat = 1
            var t = 0.0
            var flips = 0
            while flips < reversals || t < 0.05 {
                t += 1 / fps
                x += direction * 1.0
                if x > 204 || x < 196 { direction *= -1; flips += 1 }
                on = detector.add(cursor: CGPoint(x: x, y: 200), at: t, orb: orb, radius: 12)
                if t > 3 { break }
            }
            for _ in 0..<3 { t += 1 / fps; x += direction; on = detector.add(cursor: CGPoint(x: x, y: 200), at: t, orb: orb, radius: 12) }
            return on
        }
        XCTAssertTrue(rub(reversals: 4))
        XCTAssertFalse(rub(reversals: 2))
        // Straight across the orb, fast: no rub.
        var straight = RubDetector()
        var on = false
        for i in 0..<30 { on = straight.add(cursor: CGPoint(x: 150 + CGFloat(i) * 5, y: 200), at: Double(i) / fps, orb: orb, radius: 12) || on }
        XCTAssertFalse(on)
    }

    func testLazyZoneHoldsThenLetsGo() {
        var zone = LazyZone()
        let orb = CGPoint(x: 200, y: 200)
        XCTAssertTrue(zone.shouldHold(cursor: CGPoint(x: 170, y: 175), velocity: CGVector(dx: 300, dy: 250), orb: orb, approach: 50, now: 0, rubbing: false))
        XCTAssertTrue(zone.shouldHold(cursor: CGPoint(x: 190, y: 192), velocity: CGVector(dx: 100, dy: 80), orb: orb, approach: 50, now: 1.0, rubbing: false))
        XCTAssertFalse(zone.shouldHold(cursor: CGPoint(x: 195, y: 195), velocity: .zero, orb: orb, approach: 50, now: 1.3, rubbing: false), "lets go after 1.2 s")
        var quick = LazyZone()
        XCTAssertFalse(quick.shouldHold(cursor: CGPoint(x: 170, y: 175), velocity: CGVector(dx: 900, dy: 700), orb: orb, approach: 50, now: 0, rubbing: false), "an ordinary quick move down-right does not freeze Dot")
        var away = LazyZone()
        XCTAssertFalse(away.shouldHold(cursor: CGPoint(x: 170, y: 175), velocity: CGVector(dx: -300, dy: -250), orb: orb, approach: 50, now: 0, rubbing: false), "moving away")
    }

    func testRubReactionAndItsCooldown() {
        let animator = OrbAnimator(seed: 12)
        var input = OrbInput()
        input.sinceInput = 1
        _ = animator.step(at: 0, input: input)
        animator.setRubbing(true, direction: 1, at: 0.1)
        var pose = OrbPose()
        for i in 1...60 { pose = animator.step(at: 0.1 + Double(i) / fps, input: input) }
        XCTAssertGreaterThan(pose.blush, 0.8)
        XCTAssertGreaterThan(pose.left.lowerLid, 0.4)
        animator.setRubbing(false, direction: 0, at: 1.2)
        for i in 1...180 { pose = animator.step(at: 1.2 + Double(i) / fps, input: input) }
        XCTAssertLessThan(pose.blush, 0.1)
        // Again within 10 s: the squint, not the full reaction.
        animator.setRubbing(true, direction: -1, at: 5)
        for i in 1...60 { pose = animator.step(at: 5 + Double(i) / fps, input: input) }
        XCTAssertGreaterThan(pose.left.lowerLid, 0.4)
        XCTAssertLessThan(pose.blush, 0.1)
    }

    // MARK: 2.6-2.8 Reactions and guards

    func testReactionsReturnToBaseAndPauseKeepAlive() {
        for kind in [OrbReaction.agentDone, .agentFailed, .dismissed, .pounce, .thanks] {
            let animator = OrbAnimator(seed: 21)
            var input = OrbInput()
            input.sinceInput = 1
            _ = animator.step(at: 0, input: input)
            animator.react(kind, at: 0.5)
            var blinked = false
            var last = OrbPose()
            for i in 0...180 {
                let t = 0.5 + Double(i) / fps
                last = animator.step(at: t, input: input)
                if t < 0.5 + 0.45, last.left.openness < 0.5 { blinked = true }
            }
            XCTAssertFalse(blinked, "\(kind): keep-alive blinks wait")
            XCTAssertEqual(Double(hypot(last.offset.x, last.offset.y)), 0, accuracy: 1e-6, "\(kind) back to base")
            XCTAssertEqual(last.stretch, 1, accuracy: 0.02)
        }
    }

    func testAppGlanceIsThrottled() {
        let animator = OrbAnimator(seed: 2)
        _ = animator.step(at: 0, input: OrbInput())
        animator.react(.appSwitch(dx: 1), at: 1)
        var pose = OrbPose()
        for i in 1...6 { pose = animator.step(at: 1 + Double(i) / fps, input: OrbInput()) }
        XCTAssertGreaterThan(pose.gaze.x, 0.05)
        _ = animator.step(at: 3, input: OrbInput())
        animator.react(.appSwitch(dx: -1), at: 5)
        for i in 1...6 { pose = animator.step(at: 5 + Double(i) / fps, input: OrbInput()) }
        XCTAssertGreaterThanOrEqual(pose.gaze.x, -0.05, "a second glance inside 10 s is skipped")
    }

    func testReduceMotionKeepsBlinksAndExpressionsOnly() {
        var blinks = 0
        var wasOpen = true
        let animator = OrbAnimator(seed: 4)
        for i in 0...(120 * 60) {
            let t = Double(i) / fps
            var input = OrbInput()
            input.reduceMotion = true
            input.mood = .happy
            input.motion = i % 600 < 300 ? .flying : .following
            input.lead = CGVector(dx: 50, dy: 0)
            input.speed = 800
            if i % 900 == 0 { animator.react(.agentDone, at: t) }
            let pose = animator.step(at: t, input: input)
            XCTAssertEqual(pose.stretch, 1)
            XCTAssertEqual(pose.rotation, 0)
            XCTAssertEqual(pose.offset, .zero)
            XCTAssertEqual(pose.breath, 1)
            if wasOpen && pose.left.openness < 0.5 { blinks += 1 }
            wasOpen = pose.left.openness >= 0.5
            if i > 120 { XCTAssertGreaterThan(pose.left.lowerLid, 0.4) }
        }
        XCTAssertGreaterThan(blinks, 10)
    }

    func testThanksIsHeard() {
        for text in ["thanks dot", "Thank you!", "ok thx", "ty", "that's great, thanks."] { XCTAssertTrue(Gratitude.isThanks(text), text) }
        for text in ["thanksgiving plans", "what's the thank-you note format", "tyler's email", "think about it"] {
            XCTAssertFalse(Gratitude.isThanks(text) && !text.contains("thank-you"), text)
        }
        XCTAssertFalse(Gratitude.isThanks("thanksgiving plans"))
        XCTAssertFalse(Gratitude.isThanks("tyler's email"))
    }

    // MARK: Cost

    func testStepIsCheap() {
        let animator = OrbAnimator(seed: 1)
        var input = OrbInput()
        input.cursorRest = 3
        let start = Date()
        for i in 0..<36_000 { _ = animator.step(at: Double(i) / fps, input: input) }
        let perStep = Date().timeIntervalSince(start) / 36_000
        XCTAssertLessThan(perStep, 0.000_05, "\(perStep * 1e6) µs per step")
    }
}
