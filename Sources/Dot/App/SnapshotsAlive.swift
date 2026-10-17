import AppKit
import DotKit
import SwiftUI

/// `Dot --snapshot <folder> alive`: the alive pass's previews (docs/alive.md, phase 0). Stills of every
/// mood and phase at 20, 24 and 28 px (and three eye gaps), and GIF reels of the scripted scenarios,
/// stepped through the same OrbAnimator the app uses on a 30 fps clock and joined by ffmpeg.
extension Snapshots {
    /// The pose a model's phase and mood settle into, for the still snapshots.
    static func settledPose(_ m: CompanionModel, seconds: Double = 1.5) -> OrbPose {
        let animator = OrbAnimator(seed: 17)
        var pose = OrbPose.rest
        var t = 0.0
        while t <= seconds {
            var input = OrbInput()
            input.phase = OrbPhase(m.phase)
            input.mood = OrbMood(m.mood)
            input.motion = OrbMotionState(m.motion)
            input.parkedLook = m.motion == .parked ? m.look : nil
            input.micLevel = Double(m.level)
            input.speechLevel = m.phase == .speaking ? 0.6 : 0
            input.cursorRest = 0
            pose = animator.step(at: t, input: input)
            t += 1 / 30
        }
        return pose
    }

    static func alive(into folder: URL, accentHex: String) {
        let after = folder.appendingPathComponent("after", isDirectory: true)
        try? FileManager.default.createDirectory(at: after, withIntermediateDirectories: true)
        let color = Color(hex: accentHex) ?? Color(red: 1.0, green: 0.42, blue: 0.17)
        var sheet: [(String, NSImage)] = []
        for size in [CGFloat(20), 24, 28] {
            for (name, script) in stillScripts() {
                let model = CompanionModel(screenSize: CGSize(width: size * 5, height: size * 5))
                model.color = color
                model.orbSize = size
                model.visible = true
                model.pose = script(model)
                if let image = closeUp(model) {
                    let label = "\(name) \(Int(size))px"
                    write(image, to: after.appendingPathComponent("still-\(Int(size))-\(name).png"))
                    sheet.append((label, image))
                }
            }
        }
        for gap in [CGFloat(0.16), 0.20, 0.24] {
            for (name, script) in stillScripts() where name == "idle" || name == "happy" {
                let model = CompanionModel(screenSize: CGSize(width: 120, height: 120))
                model.color = color
                model.visible = true
                model.eyeGap = gap
                model.pose = script(model)
                if let image = closeUp(model) {
                    write(image, to: after.appendingPathComponent("gap-\(Int(gap * 100))-\(name).png"))
                    sheet.append(("\(name) gap \(gap)", image))
                }
            }
        }
        if let composite = contactSheet(sheet), let data = png(composite) {
            try? data.write(to: after.appendingPathComponent("sheet.png"))
            print("snapshot: \(after.appendingPathComponent("sheet.png").path)")
        }
        for reel in reels() {
            renderReel(reel, color: color, into: after)
        }
    }

    // MARK: Stills

    private static func stillScripts() -> [(String, (CompanionModel) -> OrbPose)] {
        func run(_ model: CompanionModel, seconds: Double, configure: (Double, inout OrbInput) -> Void = { _, _ in },
                 events: (Double, OrbAnimator) -> Void = { _, _ in }) -> OrbPose {
            let animator = OrbAnimator(seed: 23)
            var pose = OrbPose.rest
            var t = 0.0
            while t <= seconds + 1e-9 {
                var input = OrbInput()
                input.diameter = Double(model.orbSize)
                configure(t, &input)
                model.phase = CompanionPhase(input.phase)
                model.level = Float(input.micLevel)
                events(t, animator)
                pose = animator.step(at: t, input: input)
                t += 1 / 60
            }
            return pose
        }
        return [
            ("idle", { m in run(m, seconds: 1.0) }),
            ("mid-blink", { m in run(m, seconds: 0.17, events: { t, a in if t == 0 { a.appeared(at: 0) } }) }),
            ("listening", { m in run(m, seconds: 1.0, configure: { _, i in i.phase = .listening; i.micLevel = 0.5 }) }),
            ("thinking", { m in run(m, seconds: 1.0, configure: { _, i in i.phase = .thinking }) }),
            ("speaking", { m in run(m, seconds: 1.0, configure: { _, i in i.phase = .speaking; i.speechLevel = 0.75 }) }),
            ("happy", { m in run(m, seconds: 1.0, configure: { _, i in i.mood = .happy }) }),
            ("puzzled", { m in run(m, seconds: 0.6, configure: { _, i in i.mood = .puzzled }) }),
            ("focused", { m in run(m, seconds: 1.0, configure: { _, i in i.mood = .focused }) }),
            ("petted", { m in run(m, seconds: 0.8, events: { t, a in if t == 0 { a.setRubbing(true, direction: 1, at: 0) } }) }),
            ("drowsy", { m in run(m, seconds: 1.0, configure: { _, i in i.motion = .perched; i.sinceInput = 400 }) }),
            ("asleep", { m in run(m, seconds: 2.0, configure: { _, i in i.motion = .perched; i.sinceInput = 1000 },
                                  events: { t, a in if t == 0 { a.perched(at: 0, edge: .windowTop) } }) }),
            ("waking", { m in run(m, seconds: 0.35, configure: { _, i in i.motion = .perched; i.sinceInput = 0 },
                                  events: { t, a in if t == 0 { a.perched(at: 0, edge: .windowTop); a.woke(at: 0) } }) }),
            ("held", { m in run(m, seconds: 0.6, configure: { _, i in i.motion = .held }) }),
            ("dizzy", { m in run(m, seconds: 0.5, events: { t, a in if t == 0 { a.landed(at: 0) } }) }),
            ("boop", { m in run(m, seconds: 0.3, events: { t, a in if t == 0 { a.react(.boop, at: 0) } }) }),
        ]
    }

    /// The orb alone at 4x on a light ground, so a 1 px highlight can be judged.
    private static func closeUp(_ model: CompanionModel) -> NSImage? {
        let side = model.orbSize * 4
        let view = ZStack {
            Color(nsColor: NSColor(calibratedWhite: 0.96, alpha: 1))
            OrbView(model: model)
        }
        .frame(width: side, height: side)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 4
        return renderer.nsImage
    }

    private static func write(_ image: NSImage, to url: URL) {
        guard let data = png(image) else { return }
        try? data.write(to: url)
    }

    // MARK: Reels

    /// One scripted scenario: how long it runs, whether it is a close-up of the orb or the whole stage,
    /// and what happens each frame.
    private struct Reel {
        let name: String
        let seconds: Double
        let stage: Bool
        let fakeWindow: CGRect?
        let script: (_ t: Double, _ dt: Double, _ state: ReelState) -> Void
    }

    /// What a reel moves: the model, the animator, a follow spring, a flight, and a drawn cursor.
    private final class ReelState {
        let model: CompanionModel
        let animator = OrbAnimator(seed: 29)
        var input = OrbInput()
        var spring: Spring2D
        var flight: (path: FlightPath, start: Double)?
        var cursor: CGPoint?
        var landed = false
        /// Where a multi-step reel is (the pet routine's walk, nap, wake and return).
        var stage = 0
        var leash = Leash(radius: 90)
        var rub = RubDetector()
        var callOver = CallOverDetector()
        var toss: Toss?
        var samples: [(point: CGPoint, time: Double)] = []

        init(model: CompanionModel) {
            self.model = model
            self.spring = Spring2D(position: model.position)
        }

        /// Follow `cursor` on the spring, as OverlayManager does (24 px orb: offset 29, 31).
        func follow(_ cursor: CGPoint, dt: Double, loose: Bool = false) {
            self.cursor = cursor
            let desired = CGPoint(x: cursor.x + 29, y: cursor.y + 31)
            spring.duration = loose ? 0.5 : 0.25
            spring.bounce = loose ? 0.3 : 0.12
            spring.step(toward: desired, dt: dt)
            model.position = spring.position
            model.motion = .following
            input.motion = .following
            input.lead = CGVector(dx: desired.x - model.position.x, dy: desired.y - model.position.y)
            input.speed = spring.speed
        }

        /// Follow on the leash, as OverlayManager does now: sit while the cursor is near, trot when it goes far.
        func leashed(_ cursor: CGPoint, at t: Double, dt: Double) {
            self.cursor = cursor
            let desired = CGPoint(x: cursor.x + 29, y: cursor.y + 31)
            let rubOn = rub.add(cursor: cursor, at: t, orb: model.position, radius: 12)
            animator.setRubbing(rubOn, direction: Double(rub.lastDirection), at: t)
            model.motion = .following
            input.motion = .following
            if !animator.isRecovering, leash.update(cursor: cursor, orb: model.position, target: desired) {
                spring.step(toward: desired, dt: dt)
                model.position = spring.position
                input.lead = CGVector(dx: desired.x - model.position.x, dy: desired.y - model.position.y)
                input.speed = spring.speed
            } else {
                spring.snap(to: model.position)
                input.lead = .zero
                input.speed = 0
            }
        }

        func fly(to point: CGPoint, at t: Double, style: FlightPath.Style = .flight) {
            let path = FlightPath(from: model.position, to: point, style: style)
            flight = (path, t)
            landed = false
            animator.flightWillStart(toward: CGVector(dx: point.x - model.position.x, dy: point.y - model.position.y), at: t)
        }

        /// Advance a flight; true once it has landed.
        @discardableResult
        func advanceFlight(_ t: Double, landedMotion: CompanionMotion = .parked) -> Bool {
            guard let flight else { return landed }
            let sample = flight.path.sample(at: t - flight.start)
            switch sample.stage {
            case .anticipating:
                model.motion = .flying; input.motion = .flying; input.lead = .zero; input.speed = 0
            case .moving:
                model.position = sample.point
                model.motion = .flying; input.motion = .flying
                input.lead = CGVector(dx: sample.tangent.dx * 40, dy: sample.tangent.dy * 40)
                input.speed = sample.speed
            case .done:
                model.position = flight.path.end
                spring.snap(to: flight.path.end)
                animator.flightLanded(direction: sample.tangent, at: t)
                model.motion = landedMotion
                input.motion = OrbMotionState(landedMotion)
                input.lead = .zero
                input.speed = 0
                self.flight = nil
                landed = true
            }
            return landed
        }
    }

    private static func reels() -> [Reel] {
        /// A speech envelope: syllables at about 5 Hz inside each sentence, silence between.
        func speech(_ t: Double, sentences: [(Double, Double)]) -> Double {
            for (start, end) in sentences where t >= start && t < end {
                let syllable = (sin((t - start) * 2 * .pi * 4.6) + 1) / 2
                return 0.25 + 0.65 * syllable * (0.7 + 0.3 * sin(t * 13))
            }
            return 0
        }
        let window = CGRect(x: 40, y: 60, width: 400, height: 220)
        return [
            Reel(name: "idle-darts-blink", seconds: 8, stage: false, fakeWindow: nil) { _, _, s in
                s.input.cursorRest = 5; s.input.sinceInput = 5
            },
            Reel(name: "listening", seconds: 7, stage: false, fakeWindow: nil) { t, _, s in
                s.input.phase = .listening
                s.input.micLevel = t.truncatingRemainder(dividingBy: 3.3) < 2.5 ? 0.35 + 0.3 * abs(sin(t * 9)) : 0
                s.model.level = Float(s.input.micLevel)
            },
            Reel(name: "thinking-then-answer", seconds: 7, stage: false, fakeWindow: nil) { t, _, s in
                s.input.phase = t < 3 ? .thinking : .speaking
                s.input.speechLevel = speech(t, sentences: [(3.05, 5.2), (5.5, 6.9)])
            },
            Reel(name: "speaking", seconds: 9, stage: false, fakeWindow: nil) { t, _, s in
                s.input.phase = .speaking
                let sentences = [(0.2, 2.8), (3.1, 5.6), (5.9, 8.6)]
                s.input.speechLevel = speech(t, sentences: sentences)
                for (i, (start, end)) in sentences.enumerated() where abs(t - start) < 0.5 / 30 {
                    s.animator.sentenceStarted(at: t, duration: end - start, isLast: i == sentences.count - 1)
                }
            },
            Reel(name: "flight-to-a-target", seconds: 4, stage: true, fakeWindow: nil) { t, dt, s in
                if t < 0.8 { s.follow(CGPoint(x: 80, y: 220), dt: dt); return }
                if s.flight == nil, !s.landed {
                    s.model.ring = Ring(center: CGPoint(x: 360, y: 90), radius: 22, label: "")
                    s.fly(to: CGPoint(x: 400, y: 120), at: t)
                }
                s.advanceFlight(t)
                if s.landed { s.model.look = CGPoint(x: -0.7, y: -0.5); s.input.parkedLook = s.model.look }
            },
            Reel(name: "leash-then-pet-then-follow", seconds: 9, stage: true, fakeWindow: nil) { t, dt, s in
                // The cursor wanders near Dot (it stays), moves onto it and wiggles (a pet), then goes far (it trots after).
                let home = CGPoint(x: 211, y: 159)
                if t < 0.05 { s.model.position = CGPoint(x: 240, y: 190); s.spring.snap(to: s.model.position) }
                var c: CGPoint
                if t < 2.6 { c = CGPoint(x: home.x + 40 * cos(t * 2.4), y: home.y + 25 * sin(t * 2.4)) }
                else if t < 3.2 { let p = (t - 2.6) / 0.6; c = CGPoint(x: home.x + 40 + (240 - home.x - 40) * p, y: home.y + (190 - home.y) * p) }
                else if t < 5.4 { c = CGPoint(x: 240 + 5 * sin((t - 3.2) * 2 * .pi * 2.6), y: 190) }
                else { let p = min((t - 5.4) / 0.5, 1); c = CGPoint(x: 240 + (400 - 240) * p, y: 190 - 80 * p) }
                s.input.sinceInput = 0
                s.input.cursorRest = 0
                s.leashed(c, at: t, dt: dt)
            },
            Reel(name: "boop", seconds: 2, stage: false, fakeWindow: nil) { t, _, s in
                if abs(t - 0.4) < 0.5 / 30 { s.animator.react(.boop, at: t) }
            },
            Reel(name: "grab-and-toss", seconds: 6, stage: true, fakeWindow: nil) { t, dt, s in
                // Press on Dot, carry it up and to the left, flick it right: it flies, bounces, lands dizzy, comes back.
                let start = CGPoint(x: 220, y: 200)
                switch s.stage {
                case 0:
                    if t < 0.05 { s.model.position = CGPoint(x: 240, y: 214); s.spring.snap(to: s.model.position) }
                    s.leashed(start, at: t, dt: dt)
                    if t >= 0.6 { s.stage = 1 }
                case 1:
                    let p = min((t - 0.6) / 0.7, 1)
                    let flick = t > 1.15
                    let c = CGPoint(x: start.x - 90 * p + (flick ? (t - 1.15) * 1500 : 0), y: start.y - 60 * p)
                    s.cursor = c
                    s.samples.append((c, t))
                    s.model.position = CGPoint(x: c.x, y: c.y + 13)
                    s.model.motion = .held
                    s.input.motion = .held
                    if t >= 1.3 {
                        s.toss = Toss(position: s.model.position, velocity: Toss.releaseVelocity(s.samples))
                        s.stage = 2
                    }
                case 2:
                    guard var toss = s.toss else { return }
                    let result = toss.step(dt: dt, bounds: CGRect(x: 13, y: 13, width: 454, height: 274))
                    s.model.position = toss.position
                    s.model.motion = .tossed
                    s.input.motion = .tossed
                    s.input.lead = toss.velocity
                    s.input.speed = toss.speed
                    if let normal = result.bounce { s.animator.bounced(normal: normal, at: t) }
                    s.toss = toss
                    if result.done { s.animator.landed(at: t); s.spring.snap(to: toss.position); s.leash.sit(); s.stage = 3 }
                default:
                    s.leashed(s.cursor ?? start, at: t, dt: dt)
                }
            },
            Reel(name: "call-over", seconds: 4.5, stage: true, fakeWindow: nil) { t, dt, s in
                // Dot sits on the left; a gentle wiggle on the right calls it over, and the wiggle becomes a pet.
                if t < 0.05 { s.model.position = CGPoint(x: 90, y: 230); s.spring.snap(to: s.model.position) }
                let spot = CGPoint(x: 380, y: 140)
                let c = t < 0.8 ? spot : CGPoint(x: spot.x + 10 * sin((t - 0.8) * 2 * .pi * 2.8), y: spot.y)
                s.cursor = c
                switch s.stage {
                case 0:
                    s.model.motion = .following
                    s.input.motion = .following
                    if s.callOver.add(cursor: c, at: t, orb: s.model.position, radius: 12) {
                        s.fly(to: CGPoint(x: c.x, y: c.y + 6), at: t, style: .hop)
                        s.stage = 1
                    }
                case 1:
                    if s.advanceFlight(t, landedMotion: .following) { s.leash.sit(); s.stage = 2 }
                default:
                    let rubOn = s.rub.add(cursor: c, at: t, orb: s.model.position, radius: 12)
                    s.animator.setRubbing(rubOn, direction: Double(s.rub.lastDirection), at: t)
                }
            },
            Reel(name: "rub", seconds: 4, stage: false, fakeWindow: nil) { t, _, s in
                s.input.sinceInput = 0
                let rubbing = t > 0.6 && t < 2.8
                s.animator.setRubbing(rubbing, direction: sin(t * 2 * .pi * 2.5) >= 0 ? 1 : -1, at: t)
            },
            Reel(name: "pet-routine-sleep-wake", seconds: 26, stage: true, fakeWindow: window) { t, dt, s in
                // Compressed: following, the walk to the window's top edge, groom, scratch and yawn, then a
                // jump to drowsy (5 min) and asleep (15 min), and waking when the cursor moves.
                let rest = CGPoint(x: 260, y: 180)
                let perch = PerchPlanner.perch(window: window, cursor: rest, screen: CGRect(x: 0, y: 0, width: 480, height: 300), radius: 12, menuBar: 0)
                s.input.sinceInput = t < 1 ? 30 : (t < 16 ? 185 + (t - 1) : (t < 19 ? 400 : (t < 21.8 ? 1000 : 0)))
                s.cursor = t < 21.8 ? rest : CGPoint(x: rest.x + 40 * min((t - 21.8) / 0.2, 1), y: rest.y + 20 * min((t - 21.8) / 0.2, 1))
                switch s.stage {
                case 0:
                    s.follow(rest, dt: dt)
                    if t >= 1 { s.fly(to: perch.point, at: t, style: .trot); s.stage = 1 }
                case 1:
                    if s.advanceFlight(t, landedMotion: .perched) { s.animator.perched(at: t, edge: perch.edge); s.stage = 2 }
                case 2:
                    s.input.motion = .perched
                    if t >= 22 { s.animator.woke(at: t); s.stage = 3 }
                case 3:
                    s.input.motion = .perched
                    if t >= 22.75 { s.fly(to: CGPoint(x: (s.cursor?.x ?? 300) + 29, y: (s.cursor?.y ?? 200) + 31), at: t); s.stage = 4 }
                default:
                    if s.flight != nil { s.advanceFlight(t, landedMotion: .following) } else { s.follow(s.cursor ?? rest, dt: dt) }
                }
            },
            Reel(name: "agent-done-then-failed", seconds: 3.6, stage: false, fakeWindow: nil) { t, _, s in
                if abs(t - 0.5) < 0.5 / 30 { s.animator.react(.agentDone, at: t) }
                if abs(t - 2.0) < 0.5 / 30 { s.animator.react(.agentFailed, at: t) }
            },
        ]
    }

    private static func renderReel(_ reel: Reel, color: Color, into folder: URL) {
        let frames = FileManager.default.temporaryDirectory.appendingPathComponent("dot-reel-\(reel.name)-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: frames, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: frames) }
        let stage = CGSize(width: 480, height: 300)
        let model = CompanionModel(screenSize: reel.stage ? stage : CGSize(width: 96, height: 96))
        model.color = color
        model.orbSize = 24
        model.visible = true
        model.position = reel.stage ? CGPoint(x: 109, y: 251) : CGPoint(x: 48, y: 48)
        let state = ReelState(model: model)
        let fps = 30.0
        let count = Int(reel.seconds * fps)
        for frame in 0..<count {
            let t = Double(frame) / fps
            state.input = OrbInput()
            state.input.diameter = 24
            state.input.cursorRest = 2
            state.input.motion = OrbMotionState(model.motion)
            reel.script(t, 1 / fps, state)
            model.phase = CompanionPhase(state.input.phase)
            model.pose = state.animator.step(at: t, input: state.input)
            let image: NSImage?
            if reel.stage {
                let cursor = state.cursor
                let view = ZStack(alignment: .topLeading) {
                    Color(nsColor: NSColor(calibratedWhite: 0.96, alpha: 1))
                    if let window = reel.fakeWindow { FakeWindow().frame(width: window.width, height: window.height).offset(x: window.minX, y: window.minY) }
                    CompanionView(model: model)
                    if let cursor { CursorArrow().frame(width: 12, height: 18).offset(x: cursor.x, y: cursor.y) }
                }
                .frame(width: stage.width, height: stage.height, alignment: .topLeading)
                let renderer = ImageRenderer(content: view)
                renderer.scale = 2
                image = renderer.nsImage
            } else {
                image = closeUp(model)
            }
            if let image { write(image, to: frames.appendingPathComponent(String(format: "f%04d.png", frame))) }
        }
        let out = folder.appendingPathComponent("reel-\(reel.name).gif")
        let ffmpeg = ["/Users/\(NSUserName())/.local/bin/ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"].first { FileManager.default.isExecutableFile(atPath: $0) }
        guard let ffmpeg else { print("snapshot: ffmpeg not found; frames for \(reel.name) not joined"); return }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: ffmpeg)
        process.arguments = ["-y", "-loglevel", "error", "-framerate", "30", "-i", frames.appendingPathComponent("f%04d.png").path,
                             "-vf", "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", out.path]
        try? process.run()
        process.waitUntilExit()
        print(process.terminationStatus == 0 ? "snapshot: \(out.path)" : "snapshot: ffmpeg failed for \(reel.name)")
    }
}

/// A plain window outline for the pet-routine reel: a title bar and content.
private struct FakeWindow: View {
    var body: some View {
        ZStack(alignment: .top) {
            RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.white)
                .shadow(color: .black.opacity(0.18), radius: 10, y: 4)
            Rectangle().fill(Color(white: 0.93)).frame(height: 28)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(0..<6, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 2).fill(Color(white: 0.85)).frame(width: CGFloat(300 - (i % 3) * 60), height: 6)
                }
            }
            .padding(.top, 44)
            .padding(.leading, 20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

/// A small pointer, so the reels show where the cursor is.
private struct CursorArrow: View {
    var body: some View {
        Path { p in
            p.move(to: CGPoint(x: 0, y: 0)); p.addLine(to: CGPoint(x: 0, y: 16)); p.addLine(to: CGPoint(x: 4.5, y: 12))
            p.addLine(to: CGPoint(x: 7.5, y: 18)); p.addLine(to: CGPoint(x: 10, y: 17)); p.addLine(to: CGPoint(x: 7, y: 11.5))
            p.addLine(to: CGPoint(x: 12, y: 11.5)); p.closeSubpath()
        }
        .fill(Color.black)
        .overlay(Path { p in
            p.move(to: CGPoint(x: 0, y: 0)); p.addLine(to: CGPoint(x: 0, y: 16)); p.addLine(to: CGPoint(x: 4.5, y: 12))
            p.addLine(to: CGPoint(x: 7.5, y: 18)); p.addLine(to: CGPoint(x: 10, y: 17)); p.addLine(to: CGPoint(x: 7, y: 11.5))
            p.addLine(to: CGPoint(x: 12, y: 11.5)); p.closeSubpath()
        }.stroke(Color.white, lineWidth: 1))
    }
}

extension CompanionPhase {
    init(_ phase: OrbPhase) {
        switch phase {
        case .idle: self = .idle
        case .listening: self = .listening
        case .thinking: self = .thinking
        case .speaking: self = .speaking
        }
    }
}
