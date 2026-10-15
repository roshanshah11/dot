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
    private var playQueue: [URL] = []
    private var player: AVAudioPlayer?
    private var generation = 0
    private var inFlight = 0
    private(set) var ready = false
    private let fallback: TTSProvider

    var onFinishedAll: (() -> Void)?
    var isSpeaking: Bool { player?.isPlaying == true || !playQueue.isEmpty || inFlight > 0 }

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

    func speak(_ sentence: String) {
        let text = SpeechText.clean(sentence)
        guard !text.isEmpty else { return }
        guard process != nil, ready else {
            fallback.speak(text)
            return
        }
        let myGeneration = generation
        inFlight += 1
        request(text) { [weak self] url in
            DispatchQueue.main.async {
                guard let self else { return }
                self.inFlight = max(0, self.inFlight - 1)
                guard myGeneration == self.generation else { return }
                if let url {
                    self.playQueue.append(url)
                    self.playNextIfIdle()
                } else {
                    self.fallback.speak(text)
                }
            }
        }
    }

    func stop() {
        generation += 1
        playQueue = []
        player?.stop()
        player = nil
        fallback.stop()
        inFlight = 0
    }

    // MARK: Worker protocol

    private func request(_ text: String, completion: @escaping (URL?) -> Void) {
        guard let handle = stdinHandle,
              let data = try? JSONSerialization.data(withJSONObject: ["text": text]),
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
        guard player?.isPlaying != true, !playQueue.isEmpty else { return }
        let url = playQueue.removeFirst()
        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.delegate = self
            self.player = player
            player.play()
        } catch {
            Log.warn("tts playback failed: \(error)")
            try? FileManager.default.removeItem(at: url)
            playNextIfIdle()
        }
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        if let url = player.url { try? FileManager.default.removeItem(at: url) }
        self.player = nil
        if playQueue.isEmpty {
            if inFlight == 0 { onFinishedAll?() }
        } else {
            playNextIfIdle()
        }
    }
}
