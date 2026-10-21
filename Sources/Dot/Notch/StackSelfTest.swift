import AppKit
import DotKit
import Foundation

/// `Dot --stack-selftest [--muted] [--job] [frames.json]` (04): the stack demo through a real AgentStack window in this
/// process, placed far off every display and out of recordings, its frame sampled every 250 ms, with G7, G8 and G9's
/// window rules checked. It touches no running Dot, no agent, no volume, and logs nowhere but DOT_LOG_FILE. The
/// installed-app rows (G7 to G9 with `Dot --stack-demo` and scripts/winframes.swift) still run after install.
@MainActor
enum StackSelfTest {
    struct Sample { let t: Double; let frame: CGRect? }

    static func run(muted: Bool, job: Bool, framesFile: String?) -> Bool {
        // An offscreen accessory process is App Nap's first pick: its timers stalled for minutes without this.
        let activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiated, .latencyCritical], reason: "stack selftest")
        defer { ProcessInfo.processInfo.endActivity(activity) }
        let stack = AgentStack(accentHex: DotConfig.peek().pointerColorHex)
        stack.setVisibleInRecordings(false)
        // Top right of a pretend 1440 x 875 screen 30,000 points off the main display: drawn, never seen.
        stack.anchorFrame = { CGRect(x: -30_000, y: -30_000, width: 1440, height: 875) }
        let start = Date()
        var config = DotConfig.peek()
        config.speakAgentResults = true
        StackDemo.run(stack: stack, config: config, muted: muted, job: job)
        var samples: [Sample] = []
        // Times count from the demo's own clock (the first window can take a moment to build in a debug build).
        let zero = StackDemo.zero ?? start
        while Date().timeIntervalSince(zero) < 28 {
            samples.append(Sample(t: Date().timeIntervalSince(zero), frame: stack.windowFrame))
            spin(0.25)
        }
        if let framesFile { write(samples, to: framesFile) }

        var failures: [String] = []
        func check(_ ok: Bool, _ what: String) { print("\(ok ? "pass" : "FAIL"): \(what)"); if !ok { failures.append(what) } }
        let doneAt = StackDemo.doneAt.map { $0.timeIntervalSince(zero) } ?? 14
        let up = samples.filter { $0.frame != nil }
        check(!up.isEmpty, "the stack window came up")
        if let first = up.first?.frame {
            let inX = StackModel.corner.width - StackModel.pad, inY = StackModel.corner.height - StackModel.pad
            check(abs(first.maxX - (-30_000 + 1440 - inX)) < 0.5 && abs(first.maxY - (-30_000 + 875 - inY)) < 0.5,
                  "the chip's corner 27 pt in from the right and 34 pt under the menu bar (window maxX \(first.maxX), maxY \(first.maxY))")
        }
        if job {
            let paused = samples.filter { $0.t >= 4.6 && $0.t <= 6.9 }
            check(!paused.isEmpty && paused.allSatisfy { ($0.frame?.width ?? 0) > 72 }, "paused: the card holds through the 3 s pause")
            let folded = samples.filter { $0.t >= 12.6 && $0.t < doneAt - 0.2 }
            check(!folded.isEmpty && folded.allSatisfy { ($0.frame?.width ?? 999) <= 72 }, "picked up again: back to the avatar 5 s later")
            let gone = samples.first { $0.t > doneAt && $0.frame == nil }
            check(gone.map { $0.t - doneAt <= 9 } ?? false, "gone within 9 s of done (\(gone.map { String(format: "%.1f", $0.t - doneAt) } ?? "never") s)")
        } else {
            let narrow = samples.first { ($0.frame?.width ?? 999) <= 72 }
            check(narrow.map { $0.t <= 6 } ?? false, "72 pt wide or less (a 40 pt avatar in its glow) within 6 s (\(narrow.map { String(format: "%.1f s, %.0f pt", $0.t, $0.frame!.width) } ?? "never"))")
            let gone = samples.first { $0.t > doneAt && $0.frame == nil }
            let after = gone.map { $0.t - doneAt }
            if muted {
                let reading = NotchSurface.readingTime(characters: StackDemo.doneLine.count)
                check(after.map { $0 >= reading - 0.5 && $0 <= reading + 1.5 } ?? false,
                      String(format: "the muted text card stays for reading time (%.1f s; gone after %@ s)", reading, after.map { String(format: "%.1f", $0) } ?? "never"))
            } else {
                check(after.map { $0 <= 9 } ?? false, "gone within 9 s after done (\(after.map { String(format: "%.1f", $0) } ?? "never") s)")
            }
        }
        print(failures.isEmpty ? "stack selftest: all passed" : "stack selftest: \(failures.count) failed")
        return failures.isEmpty
    }

    /// `Dot --stack-selftest --hover`: a pretend pointer over a folded avatar in a real stack window (off every display).
    /// The card must open once and hold for 3 s while the pointer rests, even as the avatar grows into the card under it (the
    /// 2026-10-21 10:22 flicker: four flips in 1.5 s), close after the pointer leaves, and stay shut on a quick pass.
    static func runHover() -> Bool {
        let activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiated, .latencyCritical], reason: "stack hover selftest")
        defer { ProcessInfo.processInfo.endActivity(activity) }
        let stack = AgentStack(accentHex: DotConfig.peek().pointerColorHex)
        stack.setVisibleInRecordings(false)
        stack.anchorFrame = { CGRect(x: -30_000, y: -30_000, width: 1440, height: 875) }
        var pointer = CGPoint(x: -40_000, y: -40_000)
        stack.mouseLocation = { pointer }
        stack.upsert(StackChip(id: "hover-test", kind: .agent, title: "Northwind Desk", line: "reading example.com/northwind-bank/10-q",
                               steps: ["opened the filing", "read the cash flow statement"], state: .running,
                               stateSince: Date().addingTimeInterval(-60), startedAt: Date().addingTimeInterval(-60)))
        var failures: [String] = []
        func check(_ ok: Bool, _ what: String) { print("\(ok ? "pass" : "FAIL"): \(what)"); if !ok { failures.append(what) } }
        spin(1.0)
        guard let folded = stack.windowFrame else {
            check(false, "the stack window came up")
            return false
        }
        check(folded.width <= 72, "starts as the 40 pt avatar (window \(Int(folded.width)) pt wide)")
        // The avatar's centre: the drawing's top right corner, in by the padding and half the avatar.
        let inset = StackModel.pad + AgentChip.avatarSize / 2
        let avatar = CGPoint(x: folded.maxX - inset, y: folded.maxY - inset)

        // A quick pass over it opens nothing.
        pointer = avatar
        spin(0.03)
        pointer = CGPoint(x: -40_000, y: -40_000)
        spin(0.4)
        check(stack.model.hovering == nil && (stack.windowFrame?.width ?? 999) <= 72, "a quick pass opens nothing")

        // Rest on it: one open, then it holds for 2 s while the avatar grows into the card under the pointer.
        pointer = avatar
        var states: [Bool] = []
        let start = Date()
        while Date().timeIntervalSince(start) < 3.0 {
            spin(0.05)
            states.append(stack.model.hovering == "hover-test")
            if ProcessInfo.processInfo.environment["DOT_HOVER_TRACE"] != nil {
                print(String(format: "  %.2f hovering=%@ shown=%@ content=%.0f window=%.0f", Date().timeIntervalSince(start), stack.model.hovering ?? "-",
                             stack.model.shown.map { $0.presentation.rawValue }.joined(separator: ","), stack.model.contentSize.width, stack.windowFrame?.width ?? -1))
            }
        }
        let opened = states.firstIndex(of: true).map { Double($0 + 1) * 0.05 }
        check(opened.map { $0 <= 0.5 } ?? false, "resting opens the card (\(opened.map { String(format: "%.2f s", $0) } ?? "never"))")
        let flips = zip(states, states.dropFirst()).filter { $0 != $1 }.count
        check(flips == 1 && states.last == true, "it holds open for 3 s while the pointer rests (\(flips) change(s); 1 expected)")
        check((stack.windowFrame?.width ?? 0) > 200, "the card is drawn (window \(Int(stack.windowFrame?.width ?? 0)) pt wide)")

        // Off it: closed after the grace, and back to the avatar.
        pointer = CGPoint(x: -40_000, y: -40_000)
        spin(0.15)
        check(stack.model.hovering == "hover-test", "a moment off it keeps it open (the grace)")
        spin(0.8)
        check(stack.model.hovering == nil, "leaving closes it")
        spin(0.6)
        check((stack.windowFrame?.width ?? 999) <= 72, "and it folds back to the avatar")
        print(failures.isEmpty ? "stack hover selftest: all passed" : "stack hover selftest: \(failures.count) failed")
        return failures.isEmpty
    }

    private static func write(_ samples: [Sample], to path: String) {
        let rows: [[String: Any]] = samples.map { s in
            var row: [String: Any] = ["t": (s.t * 1000).rounded() / 1000]
            if let f = s.frame { row["x"] = f.minX; row["y"] = f.minY; row["w"] = f.width; row["h"] = f.height }
            return row
        }
        if let data = try? JSONSerialization.data(withJSONObject: ["samples": rows], options: [.prettyPrinted]) {
            try? data.write(to: URL(fileURLWithPath: DotConfig.expand(path)))
        }
    }

    /// The run loop and AppKit's event queue, so SwiftUI lays out and the demo's timers fire.
    private static func spin(_ seconds: Double) {
        let until = Date().addingTimeInterval(seconds)
        while Date() < until {
            while let event = NSApp.nextEvent(matching: .any, until: Date(timeIntervalSinceNow: 0.01), inMode: .default, dequeue: true) {
                NSApp.sendEvent(event)
            }
            RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.02))
        }
    }
}
