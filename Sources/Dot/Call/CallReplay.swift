import AVFoundation
import AppKit
import DotKit
import Foundation

/// `Dot --call-replay <folder> [--speed 1] [--interview] [--no-helper]`: a recorded two-sided call through call mode's real
/// pipeline (both recognizers, the live helper on the talk model, the checklist, the close nudge, the window off every
/// display, the after-call transcript) into a scratch folder, never his vault, and no agent after. The folder holds
/// me.wav and them.wav, aligned (scripts/make-call-fixture.py writes them with Kokoro's voices and placeholder names),
/// prep.md and call.json ({"title": ..., "person": ..., "firm": ...}). Exit 0 when every check passes.
@MainActor
enum CallReplay {
    static func run(_ args: [String]) -> Bool {
        func value(_ flag: String) -> String? { args.firstIndex(of: flag).flatMap { $0 + 1 < args.count ? args[$0 + 1] : nil } }
        let flagged = Set(args.indices.filter { args[$0].hasPrefix("--") }.map { $0 + 1 })
        guard let path = args.indices.first(where: { !args[$0].hasPrefix("--") && !flagged.contains($0) }).map({ args[$0] }) else {
            print("usage: Dot --call-replay <folder with me.wav, them.wav, prep.md, call.json> [--speed 1] [--interview] [--no-helper]")
            return false
        }
        let fixture = URL(fileURLWithPath: DotConfig.expand(path), isDirectory: true)
        if args.contains("--tokens") {
            // the whole-file tokens of each side and the turns they make: for tuning CallTranscript.turns
            var finished = false
            Task { @MainActor in
                let t = Transcriber()
                for side in ["me", "them"] {
                    let tokens = (try? await t.transcribeTokens(url: fixture.appendingPathComponent("\(side).wav"))) ?? []
                    print("\(side): \(tokens.count) tokens; first: " + tokens.prefix(30).map { String(format: "%@@%.2f", $0.text, $0.start) }.joined(separator: " ") + " ... last: " + tokens.suffix(16).map { String(format: "%@@%.2f", $0.text, $0.start) }.joined(separator: " "))
                    for turn in CallTranscript.turns(tokens) { print(String(format: "  %6.1f %@", turn.start, String(turn.text.prefix(70)))) }
                }
                finished = true
            }
            while !finished { RunLoop.main.run(until: Date().addingTimeInterval(0.1)) }
            return true
        }
        let me = fixture.appendingPathComponent("me.wav"), them = fixture.appendingPathComponent("them.wav")
        guard FileManager.default.fileExists(atPath: me.path), FileManager.default.fileExists(atPath: them.path) else {
            print("FAIL: no me.wav and them.wav in \(fixture.path)"); return false
        }
        let speed = Double(value("--speed") ?? "") ?? 1
        let info = (try? JSONSerialization.jsonObject(with: Data(contentsOf: fixture.appendingPathComponent("call.json")))) as? [String: String] ?? [:]
        let prep = (try? String(contentsOf: fixture.appendingPathComponent("prep.md"), encoding: .utf8)) ?? ""
        let seconds = AudioFileLength.seconds(me) / speed
        let out = URL(fileURLWithPath: NSTemporaryDirectory() + "dot-call-replay-\(Int(Date().timeIntervalSince1970))", isDirectory: true)
        try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        // the recognizer's models load first, so the call's clock and the calendar's start together
        var warm = false
        let transcriber = Transcriber()
        Task { @MainActor in try? await transcriber.warmUp(); warm = true }
        while !warm { RunLoop.main.run(until: Date().addingTimeInterval(0.1)) }
        let now = Date()
        let interview = args.contains("--interview")
        // the calendar's end two and a half minutes past the audio: the close nudge is due for its last half minute
        let event = CallEvent(title: info["title"] ?? "Call: Alex Example (Northwind Bank)", start: now, end: now.addingTimeInterval(seconds + 150),
                              kind: interview ? .interview : .chat, person: info["person"] ?? "Alex Example", firm: info["firm"] ?? "Northwind Bank")
        var config = DotConfig.peek()
        if args.contains("--no-helper") { config.callHelper = false }
        let window = CallWindow()
        window.offscreen = true
        let session = CallSession(event: event, prepURL: fixture.appendingPathComponent("prep.md"), prep: prep, ear: CallEar(transcriber: transcriber),
                                  window: window, config: config, transcriber: transcriber, folder: out)
        session.dryRun = true
        var done = false
        var snapshot = ""
        session.onEnded = { _ in
            Task { @MainActor in
                snapshot = await window.snapshot()
                done = true
            }
        }
        print(String(format: "call replay: %@, %.0f s of audio at %.1fx, %@, into %@", event.who, seconds * speed, speed, interview ? "interview" : "coffee chat", out.path))
        var started = false
        Task { @MainActor in
            do { try await session.start(replay: (me, them), speed: speed); started = true }
            catch { print("FAIL: didn't start: \(error)"); done = true }
        }
        let deadline = Date().addingTimeInterval(seconds + 600)
        while !done, Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.1)) }
        guard started, let result = session.result else { print("FAIL: the call never finished"); return false }

        var failures: [String] = []
        func check(_ ok: Bool, _ what: String) { print("\(ok ? "ok  " : "FAIL") \(what)"); if !ok { failures.append(what) } }
        let sides = Set(result.lines.map(\.side))
        check(sides == [.me, .them], "both sides in the transcript (\(result.lines.filter { $0.side == .me }.count) of his turns, \(result.lines.filter { $0.side == .them }.count) of theirs)")
        check(result.transcript.map { FileManager.default.fileExists(atPath: $0.path) } ?? false, "transcript saved (\(result.transcript?.lastPathComponent ?? "none"))")
        check(result.brief?.contains(result.transcript?.path ?? "\u{0}") ?? false, "the after-call brief names the transcript")
        check(snapshot.contains(event.person), "the window shows who the call is with")
        if interview || !config.callHelper {
            check(session.helps.isEmpty, "listen-only: nothing shown during the call")
            check(!snapshot.contains("Checklist"), "listen-only: no checklist")
        } else {
            check(!session.helps.isEmpty, "the helper put \(session.helps.count) line(s) up")
            check(session.helps.contains { $0.fact != nil }, "at least one fact")
            check(session.helps.contains { $0.ask != nil }, "at least one follow-up")
            check(session.checklistState.contains { $0.done }, "prep ticked off (\(session.checklistState.filter { $0.done }.count) of \(session.checklistState.count))")
            check(session.nudged, "the close-ask nudge came up (he never asked)")
        }
        print("\n--- helper lines ---")
        for h in session.helps { print([h.fact.map { "FACT \($0)" }, h.ask.map { "ASK \($0)" }, h.nudge.map { "NUDGE \($0)" }].compactMap { $0 }.joined(separator: "\n  ")) }
        print("\n--- checklist ---")
        for item in session.checklistState { print("\(item.done ? "[x]" : "[ ]") \(item.text)") }
        if let url = result.transcript, let text = try? String(contentsOf: url, encoding: .utf8) { print("\n--- transcript ---\n\(text.prefix(2400))") }
        print("\n--- window ---\n\(snapshot.prefix(1600))")
        print(failures.isEmpty ? "\nPASS" : "\nFAIL: \(failures.count) check(s)")
        return failures.isEmpty
    }
}

enum AudioFileLength {
    static func seconds(_ url: URL) -> TimeInterval {
        guard let file = try? AVAudioFile(forReading: url) else { return 0 }
        return Double(file.length) / file.processingFormat.sampleRate
    }
}
