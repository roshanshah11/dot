import AVFoundation
import DotKit
import FluidAudio
import Foundation

/// Talk over Dot (parity AU-01, AU-02). For one speaking stretch Dot's sentences play through this listener's own
/// AVAudioEngine with Apple's voice processing on, so the canceller knows Dot's voice and takes it out of the mic; a
/// BargeDetector on what is left, with the recognizer's words, decides when he started talking. Its own short-lived
/// engine, never the recording engine (AudioRecorder's fresh engine per hold keeps Bluetooth headphones out of headset
/// mode), made when Dot starts talking and released when it stops.
///
/// Any doubt turns it off for the stretch and Dot plays as before: voice processing that won't start, a route that is
/// off (BargeRoute), or an output device that changes while it runs (then the device is remembered as "no barge-in").
@MainActor
final class BargeListener {
    /// He talked over Dot: the real words heard so far.
    var onBarge: ((String) -> Void)?
    /// Whether to listen at all for this stretch, and on which mic (Talk decides: the setting, a call, lecture mode).
    var plan: (() -> BargeRoute.Plan)?

    private let transcriber: Transcriber
    private let memoryURL: URL
    private var memory: BargeRouteMemory

    private var engine: AVAudioEngine?
    private var player: AVAudioPlayerNode?
    private var playerFormat: AVAudioFormat?
    private var stream: SlidingWindowAsrManager?
    private var partials: Task<Void, Never>?
    private var watch: Timer?
    private var outputUID = ""
    private var before: RouteSnapshot?
    private var probing = false
    private var fired = false
    private var dotSaying = ""
    private var lastOff = ""
    private var playing = 0
    private let lock = NSLock()
    private nonisolated(unsafe) var detector = BargeDetector()
    private nonisolated(unsafe) var farEnd: Float = 0
    private nonisolated(unsafe) var outLevel: Float = 0
    private nonisolated(unsafe) var startedAt = Date()

    var isRunning: Bool { engine?.isRunning == true }
    /// Dot's own level as it plays, 0...1, for the mouth.
    var level: Float { lock.lock(); defer { lock.unlock() }; return outLevel }

    init(transcriber: Transcriber, memoryURL: URL) {
        self.transcriber = transcriber
        self.memoryURL = memoryURL
        self.memory = BargeRouteMemory.load(memoryURL)
    }

    /// The probe result for the current output, nil when it was never probed.
    func probeResult(for device: AudioDeviceID) -> BargeRoute.Probe? { memory.results[AudioDevices.uid(of: device)] }

    // MARK: A speaking stretch

    /// Start listening for this stretch. False: barge-in is off here, and Dot plays its sentences as before.
    func begin() -> Bool {
        if isRunning { return true }
        guard let plan = plan?() else { return false }
        let mic: BargeRoute.Mic
        switch plan {
        case .off(let why):
            // said once per reason, not per sentence (the setting being off says nothing)
            if why != lastOff, plan != .off("talk over dot is off") { Log.info("barge: off (\(why))") }
            lastOff = why
            return false
        case .probe(let m):
            mic = m
            probing = true
        case .listen(let m):
            mic = m
            probing = false
        }
        guard let output = AudioDevices.defaultOutput else { return false }
        outputUID = AudioDevices.uid(of: output)
        let snapshot = AudioDevices.snapshot(output)
        before = snapshot
        let engine = AVAudioEngine()
        let input = engine.inputNode
        _ = engine.outputNode
        do {
            if mic == .builtIn {
                guard let builtIn = AudioDevices.inputDevices().first(where: \.builtIn) else {
                    Log.info("barge: off (no built-in mic to listen on)")
                    return false
                }
                try input.auAudioUnit.setDeviceID(builtIn.id)
            }
            try input.setVoiceProcessingEnabled(true)
            if #available(macOS 14.0, *) {
                // his music keeps playing at its own level while Dot listens
                input.voiceProcessingOtherAudioDuckingConfiguration = AVAudioVoiceProcessingOtherAudioDuckingConfiguration(enableAdvancedDucking: false, duckingLevel: .min)
            }
            let player = AVAudioPlayerNode()
            engine.attach(player)
            let format = AVAudioFormat(standardFormatWithSampleRate: 24000, channels: 1)!
            engine.connect(player, to: engine.mainMixerNode, format: format)
            self.player = player
            playerFormat = format
            let micFormat = input.outputFormat(forBus: 0)
            guard micFormat.sampleRate > 0, micFormat.channelCount > 0 else { throw NSError(domain: "Dot", code: 2, userInfo: [NSLocalizedDescriptionKey: "no mic format"]) }
            installTaps(engine, micFormat: micFormat)
            engine.prepare()
            try engine.start()
        } catch {
            Log.warn("barge: voice processing didn't start (\(error)); Dot plays as before")
            teardown(engine)
            self.player = nil
            return false
        }
        self.engine = engine
        startedAt = Date()
        fired = false
        lock.lock(); detector = BargeDetector(); farEnd = 0; outLevel = 0; lock.unlock()
        startRecognizer()
        watchRoute(output, snapshot)
        Log.info("barge: listening on the \(mic == .builtIn ? "built-in" : "default") mic, output \(AudioDevices.name(of: output)) (\(snapshot.transport))\(probing ? ", probing it" : "")")
        return true
    }

    /// One sentence through the canceller's own output. False when the listener isn't running (play it as before).
    func play(_ url: URL, sentence: String, done: @escaping () -> Void) -> TimeInterval? {
        guard let engine, engine.isRunning, let player, let file = try? AVAudioFile(forReading: url),
              let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)),
              (try? file.read(into: buffer)) != nil else { return nil }
        if playerFormat != file.processingFormat {
            player.stop()
            engine.disconnectNodeOutput(player)
            engine.connect(player, to: engine.mainMixerNode, format: file.processingFormat)
            playerFormat = file.processingFormat
        }
        dotSaying = sentence
        playing += 1
        player.scheduleBuffer(buffer, completionCallbackType: .dataPlayedBack) { [weak self] _ in
            DispatchQueue.main.async {
                guard let self else { return }
                self.playing = max(0, self.playing - 1)
                done()
            }
        }
        if !player.isPlaying { player.play() }
        return Double(file.length) / file.processingFormat.sampleRate
    }

    var isPlaying: Bool { playing > 0 }

    /// Dot stopped mid-sentence (a cut, Esc, his key): drop what is scheduled; the engine stays for the stretch.
    func stopPlayback() {
        player?.stop()
        playing = 0
    }

    /// The stretch is over: release everything, so nothing holds the mic or the output between answers.
    func end() {
        guard let engine else { return }
        watch?.invalidate()
        watch = nil
        partials?.cancel()
        partials = nil
        if let stream { Task { await stream.cancel() } }
        stream = nil
        teardown(engine)
        self.engine = nil
        player = nil
        playing = 0
        if probing, let before, let output = AudioDevices.defaultOutput, output == before.deviceID,
           AudioDevices.snapshot(output).changes(to: before).isEmpty, Date().timeIntervalSince(startedAt) >= 2 {
            remember(.passed, note: "unchanged through a \(Int(Date().timeIntervalSince(startedAt))) s stretch")
        }
        probing = false
        lock.lock(); outLevel = 0; lock.unlock()
    }

    private func teardown(_ engine: AVAudioEngine) {
        engine.inputNode.removeTap(onBus: 0)
        engine.mainMixerNode.removeTap(onBus: 0)
        engine.stop()
        try? engine.inputNode.setVoiceProcessingEnabled(false)
    }

    // MARK: Inside

    private func installTaps(_ engine: AVAudioEngine, micFormat: AVAudioFormat) {
        let rate = micFormat.sampleRate
        engine.mainMixerNode.installTap(onBus: 0, bufferSize: 1024, format: nil) { [weak self] buffer, _ in
            guard let self, let data = buffer.floatChannelData?[0] else { return }
            let rms = Self.rms(data, Int(buffer.frameLength))
            let dB = max(-50, min(0, 20 * log10(max(rms, 1e-6))))
            self.lock.lock(); self.farEnd = rms; self.outLevel = Float((dB + 50) / 50); self.lock.unlock()
        }
        engine.inputNode.installTap(onBus: 0, bufferSize: 1024, format: micFormat) { [weak self] buffer, _ in
            guard let self, let data = buffer.floatChannelData?[0] else { return }
            let n = Int(buffer.frameLength)
            let rms = Self.rms(data, n)
            self.lock.lock()
            let t = Date().timeIntervalSince(self.startedAt)
            self.detector.frame(mic: rms, farEnd: self.farEnd, at: t)
            self.lock.unlock()
            let samples = Array(UnsafeBufferPointer(start: data, count: n))
            Task { @MainActor [weak self] in
                guard let stream = self?.stream,
                      let fmt = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: rate, channels: 1, interleaved: false),
                      let copy = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: AVAudioFrameCount(n)) else { return }
                copy.frameLength = AVAudioFrameCount(n)
                samples.withUnsafeBufferPointer { copy.floatChannelData?[0].update(from: $0.baseAddress!, count: n) }
                await stream.streamAudio(copy)
            }
        }
    }

    private nonisolated static func rms(_ data: UnsafePointer<Float>, _ n: Int) -> Float {
        guard n > 0 else { return 0 }
        var sum: Float = 0
        for i in 0..<n { sum += data[i] * data[i] }
        return sqrt(sum / Float(n))
    }

    private func startRecognizer() {
        let transcriber = self.transcriber
        partials = Task { @MainActor [weak self] in
            guard let stream = try? await transcriber.makeStream() else { return }
            guard let self, self.isRunning else { await stream.cancel(); return }
            self.stream = stream
            do { try await stream.startStreaming(source: .microphone) } catch { Log.warn("barge: recognizer: \(error)"); return }
            for await update in await stream.transcriptionUpdates {
                if Task.isCancelled { break }
                self.consider(update.text)
            }
        }
    }

    private func consider(_ partial: String) {
        guard !fired, isRunning else { return }
        lock.lock()
        let verdict = detector.verdict(heard: partial, dotSaying: dotSaying)
        lock.unlock()
        switch verdict {
        case .barge(let words):
            fired = true
            Log.info("barge: he talked over Dot: \"\(Log.short(words, 60))\" at \(String(format: "%.1f", Date().timeIntervalSince(startedAt))) s")
            onBarge?(words)
        case .echo:
            Log.info("barge: heard Dot's own words back (\(Log.short(partial, 40))); not a barge")
        case .quiet, .sound:
            break
        }
    }

    /// Every 100 ms: the output device must look as it did; on any change voice processing reached it (a Bluetooth
    /// headset in headset mode), so release at once and remember the device.
    private func watchRoute(_ device: AudioDeviceID, _ snapshot: RouteSnapshot) {
        watch?.invalidate()
        watch = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.isRunning else { return }
                let now = AudioDevices.defaultOutput.map(AudioDevices.snapshot)
                let changes = now.map { snapshot.changes(to: $0) } ?? ["the output went away"]
                guard !changes.isEmpty else { return }
                Log.warn("barge: the output changed under voice processing (\(changes.joined(separator: "; "))); released, and off for this device")
                self.remember(.failed, note: changes.joined(separator: "; "))
                self.probing = false
                self.end()
            }
        }
    }

    private func remember(_ result: BargeRoute.Probe, note: String) {
        guard !outputUID.isEmpty, memory.results[outputUID] != result else { return }
        memory.results[outputUID] = result
        memory.notes[outputUID] = note
        memory.save(memoryURL)
        Log.info("barge: \(outputUID) \(result.rawValue) (\(note))")
    }
}
