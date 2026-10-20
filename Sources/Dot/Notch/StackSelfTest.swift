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
            check(abs(first.maxX - (-30_000 + 1440 - 12)) < 0.5 && abs(first.maxY - (-30_000 + 875 - 8)) < 0.5,
                  "anchored 12 pt in from the right and 8 pt under the menu bar (maxX \(first.maxX), maxY \(first.maxY))")
        }
        if job {
            let paused = samples.filter { $0.t >= 4.6 && $0.t <= 6.9 }
            check(!paused.isEmpty && paused.allSatisfy { ($0.frame?.width ?? 0) > 48 }, "paused: the card holds through the 3 s pause")
            let folded = samples.filter { $0.t >= 12.6 && $0.t < doneAt - 0.2 }
            check(!folded.isEmpty && folded.allSatisfy { ($0.frame?.width ?? 999) <= 48 }, "picked up again: back to the avatar 5 s later")
            let gone = samples.first { $0.t > doneAt && $0.frame == nil }
            check(gone.map { $0.t - doneAt <= 9 } ?? false, "gone within 9 s of done (\(gone.map { String(format: "%.1f", $0.t - doneAt) } ?? "never") s)")
        } else {
            let narrow = samples.first { ($0.frame?.width ?? 999) <= 48 }
            check(narrow.map { $0.t <= 6 } ?? false, "48 pt wide or less within 6 s (\(narrow.map { String(format: "%.1f s, %.0f pt", $0.t, $0.frame!.width) } ?? "never"))")
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
