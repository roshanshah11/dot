import AVFoundation
import DotKit
import Foundation

/// Any local text-to-speech engine as a worker process. Dot starts the command once,
/// writes one JSON line per sentence (`{"text": "..."}`), reads one JSON line back
/// (`{"wav": "/path/to/file.wav"}` or `{"error": "..."}`), and plays the files in order
/// while the next sentence synthesizes. `scripts/dot-tts-kokoro.py` is the bundled
/// worker for Kokoro on MLX; Piper or anything else fits the same three lines.
final class CommandSpeaker: NSObject, TTSProvider, AVAudioPlayerDelegate {
    private let command: [String]
    private let environment: [String: String]
    private var process: Process?
    private var stdinHandle: FileHandle?
    private var lineBuffer = Data()
    private let synthQueue = DispatchQueue(label: "com.roshan.dot.tts.synth")
    private var pendingReplies: [(generation: Int, completion: (URL?) -> Void)] = []
    /// Everything queued, in speaking order: sentences waiting for their audio, sentences
    /// ready to play, and markers that fire when the queue reaches them.
    private final class Item {
        let text: String
        let onStart: (() -> Void)?
        var url: URL?
        var ready = false
        var isMarker: Bool { text.isEmpty }
        init(text: String, onStart: (() -> Void)?) { self.text = text; self.onStart = onStart }
    }
    private var items: [Item] = []
    /// Audio for short phrases ("mm-hm.", "one sec.") kept after the first synthesis.
    private var cache: [String: URL] = [:]
    private var player: AVAudioPlayer?
    /// Reads the playing sentence's level every 80 ms for the mouth (SALSA's sampling, craft-A6-06).
    private var meter: Timer?
    private var generation = 0
    private(set) var ready = false
    private let fallback: TTSProvider

    var onFinishedAll: (() -> Void)?
    var isSpeaking: Bool { player?.isPlaying == true || !items.isEmpty }

    init(command: [String], environment: [String: String] = [:], fallback: TTSProvider) {
        self.command = command
        self.environment = environment
        self.fallback = fallback
        super.init()
        self.fallback.onFinishedAll = { [weak self] in self?.onFinishedAll?() }
    }

    func start() {
        guard process == nil, let executable = command.first else { return }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = Array(command.dropFirst())
        var env = ClaudeSession.environment()
        for (key, value) in environment { env[key] = value }
        process.environment = env
        let stdin = Pipe(), stdout = Pipe(), stderr = Pipe()
        process.standardInput = stdin
        process.standardOutput = stdout
        process.standardError = stderr
        stdout.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            self?.consume(data)
        }
        stderr.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if let text = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty {
                Log.info("tts worker: \(Log.short(text, 200))")
            }
        }
        process.terminationHandler = { [weak self] proc in
            stdout.fileHandleForReading.readabilityHandler = nil
            stderr.fileHandleForReading.readabilityHandler = nil
            DispatchQueue.main.async {
                guard let self else { return }
                Log.warn("tts worker exited \(proc.terminationStatus); falling back to Apple speech")
                self.process = nil
                self.ready = false
                let waiting = self.pendingReplies
                self.pendingReplies = []
                for item in waiting { item.completion(nil) }
            }
        }
        do {
            try process.run()
            self.process = process
            self.stdinHandle = stdin.fileHandleForWriting
            Log.info("tts worker started pid \(process.processIdentifier): \(command.joined(separator: " "))")
        } catch {
            Log.error("tts worker failed to start: \(error)")
        }
    }

    func speak(_ sentence: String, onStart: (() -> Void)?) {
        let text = SpeechText.clean(sentence)
        if text.isEmpty {
            guard let onStart else { return }
            let marker = Item(text: "", onStart: onStart)
            marker.ready = true
            items.append(marker)
            playNextIfIdle()
            return
        }
        guard process != nil, ready else {
            fallback.speak(text, onStart: onStart)
            return
        }
        let item = Item(text: text, onStart: onStart)
        items.append(item)
        if let cached = cache[text], FileManager.default.fileExists(atPath: cached.path) {
            item.url = cached
            item.ready = true
            playNextIfIdle()
            return
        }
        let myGeneration = generation
        request(text) { [weak self] url in
            DispatchQueue.main.async {
                guard let self, myGeneration == self.generation else { return }
                if let url, text.count <= 28 {
                    let kept = url.deletingLastPathComponent().appendingPathComponent("dot-keep-\(abs(text.hashValue)).wav")
                    try? FileManager.default.removeItem(at: kept)
                    if (try? FileManager.default.copyItem(at: url, to: kept)) != nil { self.cache[text] = kept }
                }
                item.url = url
                item.ready = true
                self.playNextIfIdle()
            }
        }
    }

    /// Synthesize short phrases ahead of time so they play the instant they are needed.
    func warm(_ phrases: [String]) {
        for phrase in phrases where cache[phrase] == nil {
            let text = SpeechText.clean(phrase)
            request(text) { [weak self] url in
                DispatchQueue.main.async {
                    guard let self, let url else { return }
                    let kept = url.deletingLastPathComponent().appendingPathComponent("dot-keep-\(abs(text.hashValue)).wav")
                    try? FileManager.default.removeItem(at: kept)
                    if (try? FileManager.default.moveItem(at: url, to: kept)) != nil { self.cache[text] = kept }
                }
            }
        }
    }

    func stop() {
        generation += 1
        items = []
        player?.stop()
        player = nil
        stopMeter()
        fallback.stop()
    }

    private func startMeter(_ player: AVAudioPlayer) {
        meter?.invalidate()
        player.isMeteringEnabled = true
        meter = Timer.scheduledTimer(withTimeInterval: 0.08, repeats: true) { [weak player] _ in
            guard let player, player.isPlaying else { return }
            player.updateMeters()
            SpeechActivity.level(SpeechLevel.openness(decibels: player.averagePower(forChannel: 0)), metered: true)
        }
    }

    private func stopMeter() {
        meter?.invalidate()
        meter = nil
        SpeechActivity.level(0, metered: true)
    }

    // MARK: Worker protocol

    /// The mode's speed multiplier, sent with each sentence (dot-tts-kokoro.py multiplies --speed by it).
    private var rate: Double = 1
    func setRate(_ multiplier: Double) { rate = min(max(multiplier, 0.5), 2) }

    private func request(_ text: String, completion: @escaping (URL?) -> Void) {
        let body: [String: Any] = rate == 1 ? ["text": text] : ["text": text, "rate": rate]
        guard let handle = stdinHandle,
              let data = try? JSONSerialization.data(withJSONObject: body),
              var line = String(data: data, encoding: .utf8) else { completion(nil); return }
        line += "\n"
        synthQueue.async { [weak self] in
            DispatchQueue.main.async { self?.pendingReplies.append((self?.generation ?? 0, completion)) }
            try? handle.write(contentsOf: line.data(using: .utf8)!)
        }
    }

    private func consume(_ data: Data) {
        lineBuffer.append(data)
        while let newline = lineBuffer.firstIndex(of: 0x0A) {
            let lineData = lineBuffer.subdata(in: lineBuffer.startIndex..<newline)
            lineBuffer.removeSubrange(lineBuffer.startIndex...newline)
            guard let object = try? JSONSerialization.jsonObject(with: lineData) as? [String: Any] else { continue }
            DispatchQueue.main.async { [weak self] in self?.handle(object) }
        }
    }

    private func handle(_ object: [String: Any]) {
        if object["ready"] as? Bool == true {
            ready = true
            Log.info("tts worker ready (\(object["engine"] as? String ?? "engine")), voice \(object["voice"] as? String ?? "?")")
            return
        }
        guard !pendingReplies.isEmpty else { return }
        let item = pendingReplies.removeFirst()
        if let path = object["wav"] as? String {
            item.completion(URL(fileURLWithPath: path))
        } else {
            if let error = object["error"] as? String { Log.warn("tts worker error: \(Log.short(error, 200))") }
            item.completion(nil)
        }
    }

    // MARK: Playback

    private func playNextIfIdle() {
        guard player?.isPlaying != true else { return }
        while let item = items.first, item.ready {
            items.removeFirst()
            if item.isMarker {
                item.onStart?()
                continue
            }
            guard let url = item.url else {
                // The worker could not say this one; Apple speech says it, out of band.
                fallback.speak(item.text, onStart: item.onStart)
                continue
            }
            do {
                let player = try AVAudioPlayer(contentsOf: url)
                player.delegate = self
                self.player = player
                startMeter(player)
                player.play()
                SpeechActivity.sentence(duration: player.duration, isLast: !items.contains { !$0.isMarker })
                item.onStart?()
                return
            } catch {
                Log.warn("tts playback failed: \(error)")
                try? FileManager.default.removeItem(at: url)
            }
        }
        if items.isEmpty, player == nil { stopMeter(); onFinishedAll?() }
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        SpeechActivity.level(0, metered: true)   // the next sentence may not be ready yet: close the mouth
        if let url = player.url, !cache.values.contains(url) { try? FileManager.default.removeItem(at: url) }
        self.player = nil
        playNextIfIdle()
    }
}
