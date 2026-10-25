import AVFoundation
import FluidAudio
import Foundation

/// The microphone through AVAudioEngine: a WAV for the offline transcriber and, when a
/// streaming recognizer is attached, the same audio fed live so his words show while he talks.
final class AudioRecorder {
    enum Failure: Error, CustomStringConvertible {
        case notRecording
        case noInput
        case couldNotStart(String)
        var description: String {
            switch self {
            case .notRecording: return "Nothing is being recorded."
            case .noInput: return "No microphone input is available."
            case .couldNotStart(let m): return "The recorder did not start: \(m)"
            }
        }
    }

    /// A fresh engine per recording, dropped when it stops. A kept engine holds its input + output aggregate on the
    /// default mic between turns, and when that mic is Bluetooth headphones it pins them in headset mode (16 kHz
    /// mono) even while nothing records (Beats Studio Pro, 2026-10-24).
    private var engine: AVAudioEngine?
    private var file: AVAudioFile?
    private var fileURL: URL?
    private var startedAt: Date?
    private var tapInstalled = false
    private let lock = NSLock()
    private var lastLevel: Float = 0
    private var peakLevel: Float = 0
    private var stream: SlidingWindowAsrManager?

    var isRecording: Bool { (engine?.isRunning ?? false) && file != nil }

    /// The microphone to record from, by name (Settings); nil follows the system default. Read at each start.
    var preferredInputName: String?
    private var appliedInput: AudioDeviceID?

    /// Point a new engine's input at the chosen device. With no choice in Settings it follows the system default,
    /// except Bluetooth headphones: recording from their mic drops them into headset mode (mono, 16 kHz) for as long
    /// as it runs, and they can stay stuck there after (his Beats, lecture mode, 2026-10-25). Their sound stays in the
    /// headphones; Dot listens through the MacBook's own mic instead, unless the lid is shut and it hears nothing.
    private func applyPreferredInput(_ engine: AVAudioEngine) {
        let wanted: AudioDeviceID?
        if let name = preferredInputName {
            wanted = AudioDevices.inputDevice(named: name)
        } else if let d = AudioDevices.defaultInput, AudioDevices.isBluetooth(d), !AudioDevices.lidClosed {
            wanted = AudioDevices.inputDevices().first { $0.builtIn }?.id
        } else {
            wanted = nil
        }
        usedInput = wanted ?? AudioDevices.defaultInput
        guard let wanted else { return }
        do {
            try engine.inputNode.auAudioUnit.setDeviceID(wanted)
            if wanted != appliedInput { Log.info("mic: recording from \(AudioDevices.name(of: wanted))") }
            appliedInput = wanted
        } catch {
            Log.warn("mic: could not select \(AudioDevices.name(of: wanted)): \(error)")
        }
    }
    private var usedInput: AudioDeviceID?

    /// The loudest moment since the recording started (0...1): zero after a few seconds means a dead mic.
    func peak() -> Float {
        lock.lock(); defer { lock.unlock() }
        return peakLevel
    }

    /// Point the live audio at another recognizer without stopping the engine (a lecture rolls
    /// its stream every few minutes).
    func swapStream(_ next: SlidingWindowAsrManager?) {
        lock.lock(); stream = next; lock.unlock()
    }

    /// 0...1 from the last buffer's RMS, shaped like the old meter.
    func level() -> Float {
        lock.lock(); defer { lock.unlock() }
        return lastLevel
    }

    @discardableResult
    func start(stream: SlidingWindowAsrManager? = nil) throws -> URL {
        if isRecording { cancel() }
        let engine = AVAudioEngine()
        applyPreferredInput(engine)
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { throw Failure.noInput }
        self.engine = engine
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("dot-audio", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appendingPathComponent("turn-\(UUID().uuidString).wav")
        let file: AVAudioFile
        do {
            file = try AVAudioFile(forWriting: url, settings: format.settings)
        } catch {
            throw Failure.couldNotStart("\(error)")
        }
        self.file = file
        fileURL = url
        lock.lock(); self.stream = stream; peakLevel = 0; lock.unlock()
        let sampleRate = format.sampleRate
        let channels = format.channelCount
        if tapInstalled { input.removeTap(onBus: 0) }
        input.installTap(onBus: 0, bufferSize: 2048, format: format) { [weak self] buffer, _ in
            guard let self else { return }
            try? file.write(from: buffer)
            if let data = buffer.floatChannelData?[0] {
                let n = Int(buffer.frameLength)
                var sum: Float = 0
                for i in 0..<n { sum += data[i] * data[i] }
                let rms = n > 0 ? sqrt(sum / Float(n)) : 0
                let dB = max(-50, min(0, 20 * log10(max(rms, 1e-6))))
                let shaped = Float((dB + 50) / 50)
                self.lock.lock(); self.lastLevel = shaped * shaped; self.peakLevel = max(self.peakLevel, self.lastLevel); self.lock.unlock()
            }
            self.lock.lock(); let stream = self.stream; self.lock.unlock()
            if let stream, let data = buffer.floatChannelData {
                // Copy the samples out: the engine reuses its buffer, and the actor wants its own.
                let n = Int(buffer.frameLength)
                let samples = Array(UnsafeBufferPointer(start: data[0], count: n))
                Task {
                    guard let fmt = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: sampleRate, channels: 1, interleaved: false),
                          let copy = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: AVAudioFrameCount(n)) else { return }
                    copy.frameLength = AVAudioFrameCount(n)
                    samples.withUnsafeBufferPointer { src in
                        copy.floatChannelData?[0].update(from: src.baseAddress!, count: n)
                    }
                    await stream.streamAudio(copy)
                }
            }
            _ = channels
        }
        tapInstalled = true
        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            tapInstalled = false
            self.file = nil
            self.engine = nil
            throw Failure.couldNotStart("\(error)")
        }
        startedAt = Date()
        return url
    }

    func stop() throws -> (url: URL, seconds: TimeInterval) {
        guard let fileURL, file != nil else { throw Failure.notRecording }
        let seconds = startedAt.map { Date().timeIntervalSince($0) } ?? 0
        teardown()
        return (fileURL, seconds)
    }

    func cancel() {
        let url = fileURL
        teardown()
        if let url { try? FileManager.default.removeItem(at: url) }
    }

    private func teardown() {
        if let engine {
            if tapInstalled { engine.inputNode.removeTap(onBus: 0) }
            if engine.isRunning { engine.stop() }
        }
        tapInstalled = false
        engine = nil
        file = nil
        startedAt = nil
        lock.lock(); lastLevel = 0; stream = nil; lock.unlock()
    }

    /// The microphone macOS is recording from, by name.
    var inputName: String { (usedInput ?? AudioDevices.defaultInput).map { AudioDevices.name(of: $0) } ?? "the microphone" }
}
