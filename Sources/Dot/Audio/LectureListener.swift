import AVFoundation
import DotKit
import FluidAudio
import Foundation

/// Listening to a lecture without a key held: the streaming recognizer runs on the microphone
/// for as long as he asks, the words land in a rolling transcript, and a question about "what
/// he just said" gets the last minute of it. The whole lecture is saved as Markdown when it
/// ends. Long dictation and meetings stay Murmur's job (double-tap fn); this is Dot's ear in
/// a lecture hall, feeding the companion the context the held key never caught.
@MainActor
final class LectureListener {
    private let transcriber: Transcriber
    private let recorder = AudioRecorder()
    private var stream: SlidingWindowAsrManager?
    private var reader: Task<Void, Never>?
    private var segmentTimer: Timer?
    private(set) var isListening = false
    private(set) var startedAt: Date?
    private(set) var title = ""
    /// Finished segments (about three minutes each) and the live tail of the current one.
    private var segments: [(at: Date, text: String)] = []
    private var liveText = ""
    private var liveSince = Date()
    /// What lecture mode's note writer reads: every confirmed chunk in order, never rewritten (the live tail can
    /// still change, and a finished segment's tidy text can differ from its chunks).
    private(set) var feed = ""
    private var confirmedInSegment = ""
    private var fileURL: URL?
    private static let segmentSeconds: TimeInterval = 180
    private var replaying = false
    private var pumpTask: Task<Void, Never>?
    /// A replay ran out of audio.
    var onReplayEnded: (() -> Void)?
    var onStatus: ((String) -> Void)?

    init(transcriber: Transcriber) { self.transcriber = transcriber }

    /// `replay`: a recorded lecture played into the recognizer instead of the microphone, `speed` times real time
    /// (Dot --lecture-replay, to check lecture mode end to end without a class).
    func start(title: String, replay: URL? = nil, speed: Double = 1) async -> Bool {
        guard !isListening else { return true }
        do {
            let fresh = try await transcriber.makeStream()
            if let replay { pump(replay, speed: speed) } else { _ = try recorder.start(stream: fresh) }
            replaying = replay != nil
            stream = fresh
        } catch {
            Log.error("lecture: could not start listening: \(error)")
            return false
        }
        isListening = true
        startedAt = Date()
        self.title = title
        segments = []
        liveText = ""
        liveSince = Date()
        feed = ""
        confirmedInSegment = ""
        let day = DateFormatter(); day.dateFormat = "yyyy-MM-dd HH.mm"; day.locale = Locale(identifier: "en_US_POSIX")
        let folder = TranscriptLog.directory.appendingPathComponent("lectures", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let safe = title.replacingOccurrences(of: #"[^A-Za-z0-9 _-]"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespaces)
        fileURL = folder.appendingPathComponent("\(day.string(from: Date()))\(safe.isEmpty ? "" : " " + safe).md")
        let header = DateFormatter(); header.dateFormat = "EEEE, MMMM d, yyyy, h:mm a"; header.locale = Locale(identifier: "en_US_POSIX")
        try? "# \(title.isEmpty ? "Lecture" : title), \(header.string(from: Date()))\n\n".write(to: fileURL!, atomically: true, encoding: .utf8)
        readUpdates()
        segmentTimer = Timer.scheduledTimer(withTimeInterval: Self.segmentSeconds, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.rollSegment() }
        }
        Log.info("lecture: listening (\(title.isEmpty ? "untitled" : title)), transcript \(fileURL!.lastPathComponent)")
        return true
    }

    /// Stop; returns the whole transcript.
    func stop() async -> String {
        guard isListening else { return transcript }
        isListening = false
        segmentTimer?.invalidate()
        segmentTimer = nil
        reader?.cancel()
        reader = nil
        pumpTask?.cancel()
        pumpTask = nil
        if !replaying, let url = try? recorder.stop().url { try? FileManager.default.removeItem(at: url) }
        if let stream {
            let tail = liveText, done = confirmedInSegment
            if let text = try? await stream.finish(), !text.trimmingCharacters(in: .whitespaces).isEmpty { appendSegment(text); feedRest(of: text, confirmed: done) }
            else if !tail.isEmpty { appendSegment(tail); feedRest(of: tail, confirmed: done) }
        }
        stream = nil
        liveText = ""
        let minutes = Int((startedAt.map { Date().timeIntervalSince($0) } ?? 0) / 60)
        Log.info("lecture: stopped after \(minutes) min, \(transcript.count) chars")
        return transcript
    }

    var transcript: String { (segments.map(\.text) + [liveText]).filter { !$0.isEmpty }.joined(separator: "\n\n") }

    /// What was said in the last `seconds`: the live tail plus as much of the previous segment as fits.
    func recent(seconds: TimeInterval = 75) -> String {
        var pieces: [String] = []
        if !liveText.isEmpty { pieces.append(liveText) }
        let liveAge = Date().timeIntervalSince(liveSince)
        if liveAge < seconds, let last = segments.last {
            let words = last.text.split(separator: " ")
            let keep = min(words.count, Int((seconds - liveAge) * 2.4))   // about 2.4 words a second
            if keep > 0 { pieces.insert(words.suffix(keep).joined(separator: " "), at: 0) }
        }
        return pieces.joined(separator: " ")
    }

    var elapsedMinutes: Int { Int((startedAt.map { Date().timeIntervalSince($0) } ?? 0) / 60) }

    private func readUpdates() {
        guard let stream else { return }
        reader?.cancel()
        reader = Task { @MainActor in
            do { try await stream.startStreaming(source: .microphone) } catch { Log.warn("lecture: stream start: \(error)"); return }
            var confirmed = ""
            for await update in await stream.transcriptionUpdates {
                if Task.isCancelled { break }
                let text = update.text.trimmingCharacters(in: .whitespaces)
                guard !text.isEmpty else { continue }
                // Each update is the latest chunk; confirmed chunks accumulate, a volatile one shows after them.
                if update.isConfirmed {
                    confirmed += (confirmed.isEmpty ? "" : " ") + text
                    liveText = confirmed
                    self.confirmedInSegment = confirmed
                    self.feed += (self.feed.isEmpty ? "" : " ") + text
                }
                else { liveText = confirmed + (confirmed.isEmpty ? "" : " ") + text }
            }
        }
    }

    /// Every few minutes the stream is finished (its deduplicated text is the truth for that
    /// stretch) and a fresh one takes over, so memory and the decoder state stay small.
    private func rollSegment() async {
        guard isListening, let old = stream else { return }
        guard let fresh = try? await transcriber.makeStream() else { return }
        reader?.cancel()
        let tail = liveText, done = confirmedInSegment
        confirmedInSegment = ""
        if !replaying { recorder.swapStream(fresh) }
        stream = fresh
        readUpdates()
        if let text = try? await old.finish(), !text.trimmingCharacters(in: .whitespaces).isEmpty { appendSegment(text); feedRest(of: text, confirmed: done) }
        else if !tail.isEmpty { appendSegment(tail); feedRest(of: tail, confirmed: done) }
        liveText = ""
        liveSince = Date()
        onStatus?("listening, \(elapsedMinutes) min")
    }

    /// Half-second mono buffers from the file into whichever stream is current, paced to `speed` times real time.
    private func pump(_ url: URL, speed: Double) {
        pumpTask = Task { @MainActor [weak self] in
            guard let file = try? AVAudioFile(forReading: url) else { Log.warn("lecture: replay: can't read \(url.lastPathComponent)"); return }
            let format = file.processingFormat
            guard let mono = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: format.sampleRate, channels: 1, interleaved: false) else { return }
            let frames = AVAudioFrameCount(format.sampleRate / 2)
            Log.info(String(format: "lecture: replaying %@ (%.0f min) at %.1fx", url.lastPathComponent, Double(file.length) / format.sampleRate / 60, speed))
            while !Task.isCancelled, let self {
                guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames), (try? file.read(into: buffer, frameCount: frames)) != nil,
                      buffer.frameLength > 0, let out = AVAudioPCMBuffer(pcmFormat: mono, frameCapacity: buffer.frameLength) else { break }
                out.frameLength = buffer.frameLength
                if let src = buffer.floatChannelData?[0], let dst = out.floatChannelData?[0] { dst.update(from: src, count: Int(buffer.frameLength)) }
                await self.stream?.streamAudio(out)
                try? await Task.sleep(nanoseconds: UInt64(0.5 / max(speed, 0.1) * 1_000_000_000))
            }
            guard !Task.isCancelled else { return }
            Log.info("lecture: replay finished")
            self?.onReplayEnded?()
        }
    }

    /// A segment ended: the words its final text has past what was confirmed chunk by chunk go on the feed too.
    private func feedRest(of final: String, confirmed: String) {
        let done = confirmed.split(separator: " ").count
        let words = final.split(separator: " ")
        guard words.count > done else { return }
        feed += (feed.isEmpty ? "" : " ") + words[done...].joined(separator: " ")
    }

    /// Delete the saved transcript (lecture mode: once the class's notes are done, what's kept is notes).
    func discardTranscript() {
        if let fileURL { try? FileManager.default.removeItem(at: fileURL) }
        fileURL = nil
        segments = []
        feed = ""
    }

    private func appendSegment(_ text: String) {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        segments.append((Date(), clean))
        guard let fileURL else { return }
        let clock = DateFormatter(); clock.dateFormat = "HH:mm"; clock.locale = Locale(identifier: "en_US_POSIX")
        let block = "**\(clock.string(from: Date()))** \(clean)\n\n"
        if let handle = try? FileHandle(forWritingTo: fileURL) {
            defer { try? handle.close() }
            _ = try? handle.seekToEnd()
            try? handle.write(contentsOf: Data(block.utf8))
        }
    }

    var transcriptFile: URL? { fileURL }
}
