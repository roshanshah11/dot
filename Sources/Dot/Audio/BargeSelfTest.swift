import AVFoundation
import DotKit
import Foundation

/// `Dot --barge-selftest [--talk] [--music]`: talk over Dot on this Mac's real route (04-voice.md). Plays two sentences
/// through the barge listener with voice processing on, and passes when its own voice never trips the detector, the
/// output device keeps its rate and channels during and after (with Bluetooth out, music plays the whole time, the
/// headset-mode check), and the probe result is saved for this device. `--talk` adds a third sentence and asks him to
/// say "wait, stop" over it: it must cut off. It plays sound: run it with him there and the lid open.
enum BargeSelfTest {
    nonisolated(unsafe) static var failures = 0

    static func check(_ ok: Bool, _ what: String) {
        print("\(ok ? "PASS" : "FAIL") \(what)")
        if !ok { failures += 1 }
    }

    static func run(_ arguments: [String]) -> Never {
        let talk = arguments.contains("--talk")
        setenv("DOT_LOG_FILE", "/tmp/dot-barge-selftest.log", 1)
        let config = DotConfig.load(save: false)
        guard let output = AudioDevices.defaultOutput else { print("FAIL no output device"); exit(1) }
        let kind = AudioDevices.outputKind(output)
        let music = arguments.contains("--music") || kind == .bluetooth
        let memoryURL = config.dotHome.appendingPathComponent(".barge-routes.json")
        let before = AudioDevices.snapshot(output)
        print("output: \(AudioDevices.name(of: output)) (\(kind.rawValue)) \(Int(before.nominalRate)) Hz \(before.channels)ch; lid \(AudioDevices.lidClosed ? "shut" : "open"); "
              + "default mic \(AudioDevices.defaultInput.map(AudioDevices.name) ?? "none")")
        let done = DispatchSemaphore(value: 0)
        Task { @MainActor in
            await body(config: config, output: output, kind: kind, before: before, memoryURL: memoryURL, talk: talk, music: music)
            done.signal()
        }
        while done.wait(timeout: .now() + 0.02) == .timedOut { RunLoop.main.run(until: Date().addingTimeInterval(0.02)) }
        print(failures == 0 ? "barge-selftest: all checks passed (log /tmp/dot-barge-selftest.log)" : "barge-selftest: \(failures) failed (log /tmp/dot-barge-selftest.log)")
        exit(failures == 0 ? 0 : 1)
    }

    @MainActor static func body(config: DotConfig, output: AudioDeviceID, kind: BargeRoute.Output, before: RouteSnapshot,
                                memoryURL: URL, talk: Bool, music: Bool) async {
        let transcriber = Transcriber()
        do { try await transcriber.warmUp() } catch { check(false, "speech models load: \(error)"); return }
        let listener = BargeListener(transcriber: transcriber, memoryURL: memoryURL)
        let plan = BargeRoute.plan(enabled: true, output: kind, lidClosed: AudioDevices.lidClosed, onCall: CallPresence.isOnCall(), lecture: false,
                                   probe: nil, inputIsBluetooth: AudioDevices.defaultInput.map(AudioDevices.isBluetooth) ?? false, selfTest: true)
        print("route plan: \(plan)")
        if case .off(let why) = plan { check(false, "this route can't use barge-in: \(why)"); return }
        listener.plan = { plan }
        var barged: String?
        listener.onBarge = { barged = $0 }

        // his music, through its own player (not the canceller's engine): the headset-mode check
        var tone: AVAudioPlayer?
        if music, let url = makeTone() {
            tone = try? AVAudioPlayer(contentsOf: url)
            tone?.numberOfLoops = -1
            tone?.volume = 0.25
            tone?.play()
            print("music: a quiet chord loops through its own player while the probe runs")
        }
        var sentences = ["This is Dot checking that it can hear you over its own voice.",
                         "If this test works, my own words never cut me off."]
        if talk { sentences.append("Now say wait, stop, out loud, while I keep talking for a few more seconds so the listener can hear you over me.") }
        var files: [URL] = []
        for (i, s) in sentences.enumerated() {
            let url = URL(fileURLWithPath: "/tmp/dot-barge-\(i).aiff")
            let p = Process()
            p.executableURL = URL(fileURLWithPath: "/usr/bin/say")
            p.arguments = ["-o", url.path, s]
            try? p.run()
            p.waitUntilExit()
            files.append(url)
        }
        guard listener.begin() else { check(false, "voice processing starts on this route (see the log)"); tone?.stop(); return }
        check(true, "voice processing started on this route")
        var worst: [String] = []
        var playedSeconds = 0.0
        for (i, url) in files.enumerated() {
            if i == 2 { print(">>> say \"wait, stop\" now") }
            var finished = false
            guard let seconds = listener.play(url, sentence: sentences[i], done: { finished = true }) else {
                check(false, "sentence \(i + 1) plays through the listener (it stopped: the output changed?)")
                break
            }
            playedSeconds += seconds
            let deadline = Date().addingTimeInterval(seconds + 2)
            while !finished, Date() < deadline {
                try? await Task.sleep(nanoseconds: 50_000_000)
                if let now = AudioDevices.defaultOutput.map(AudioDevices.snapshot) { worst += before.changes(to: now) }
                if i < 2, barged != nil { break }
                if i == 2, barged != nil { listener.stopPlayback(); break }
            }
            if i == 2, barged == nil {
                let grace = Date().addingTimeInterval(2.5)   // his words over the last sentence are still being read
                while barged == nil, Date() < grace { try? await Task.sleep(nanoseconds: 50_000_000) }
            }
            if i == 1 {
                check(barged == nil, "Dot's own voice never tripped the detector (\(String(format: "%.1f", playedSeconds)) s of Dot talking)\(barged.map { ": heard \"\($0)\"" } ?? "")")
                if barged != nil { break }
            }
        }
        if talk { check(barged != nil, "talking over Dot cut it off\(barged.map { ": heard \"\($0)\"" } ?? "")") }
        let stillRunning = listener.isRunning
        listener.end()
        tone?.stop()
        try? await Task.sleep(nanoseconds: 600_000_000)
        let after = AudioDevices.defaultOutput.map(AudioDevices.snapshot)
        check(stillRunning && Set(worst).isEmpty, "the output kept its device, rate and channels while voice processing ran\(worst.isEmpty ? "" : ": " + Set(worst).joined(separator: "; "))")
        check(after.map { before.changes(to: $0).isEmpty } ?? false, "the output is unchanged after (\(after.map { "\(Int($0.nominalRate)) Hz \($0.channels)ch" } ?? "gone"))")
        let saved = BargeRouteMemory.load(memoryURL).results[AudioDevices.uid(of: output)]
        check(saved == .passed, "this device is remembered as \(saved?.rawValue ?? "not probed")")
        for f in files { try? FileManager.default.removeItem(at: f) }
    }

    /// Four seconds of a soft chord, looped as stand-in music.
    static func makeTone() -> URL? {
        let rate = 44100.0
        guard let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 2),
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(rate * 4)) else { return nil }
        buffer.frameLength = buffer.frameCapacity
        for i in 0..<Int(buffer.frameLength) {
            let t = Double(i) / rate
            let v = Float(0.2 * (sin(2 * .pi * 220 * t) + sin(2 * .pi * 277.2 * t) + sin(2 * .pi * 329.6 * t)) / 3)
            buffer.floatChannelData?[0][i] = v
            buffer.floatChannelData?[1][i] = v
        }
        let url = URL(fileURLWithPath: "/tmp/dot-barge-music.caf")
        guard let file = try? AVAudioFile(forWriting: url, settings: format.settings), (try? file.write(from: buffer)) != nil else { return nil }
        return url
    }
}
