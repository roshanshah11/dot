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
    /// What lecture mode's note writer reads: every chunk in order, never rewritten (a finished segment's tidy text
    /// can differ from its chunks).
    private(set) var feed = ""
    private var fedInSegment = ""
    /// Words heard, and how many came in chunks the recognizer confirmed (a low share is a hard room: accent, distance).
    private(set) var heardWords = 0
    private(set) var confirmedWords = 0
    /// When the recognizer last produced words: a gap means the speaker paused (explainers wait for one).
    private(set) var lastHeardAt = Date.distantPast
    /// The words heard most recently, live (the notes window's "hearing" line).
    var liveTail: String { liveText.isEmpty ? String(feed.suffix(160)) : liveText }
    /// The course's terms, boosted in every stream (lecture mode; FluidAudio's CTC rescoring, a one-time 97.5 MB model).
    private var boost: (vocab: CustomVocabularyContext, models: CtcModels)?
    private var fileURL: URL?
    private static let segmentSeconds: TimeInterval = 180
    private var replaying = false
    private var pumpTask: Task<Void, Never>?
    /// The recording played out loud while it's replayed (the lecture demo), in step with what the recognizer is fed.
    private var player: AVAudioPlayer?
    /// How far into the recording the replay has fed the recognizer, in seconds (the demo's slides follow it).
    private(set) var replayPosition = 0.0
    /// A replay ran out of audio.
    var onReplayEnded: (() -> Void)?
    /// Lecture mode keeps the class audio, on this Mac only, until the after-class pass has transcribed it again (his
    /// pick 2026-10-25); `owned` is false for a replay's own recording, which is never deleted.
    private(set) var keptAudio: (url: URL, owned: Bool)?
    private var keepAudio = false
    private var replayURL: URL?
    var onStatus: ((String) -> Void)?

    init(transcriber: Transcriber) { self.transcriber = transcriber }

    /// `replay`: a recorded lecture played into the recognizer instead of the microphone, `speed` times real time, from
    /// `from` seconds in, and out loud when `audible` (Dot --lecture-replay and --lecture-demo: lecture mode without a class).
    func start(title: String, replay: URL? = nil, speed: Double = 1, from: Double = 0, audible: Bool = false, keepAudio: Bool = false) async -> Bool {
        guard !isListening else { return true }
        self.keepAudio = keepAudio
        replayURL = replay
        keptAudio = nil
        do {
            let fresh = try await makeStream()
            if let replay { pump(replay, speed: speed, from: from, audible: audible) }
            else {
                let recording = try recorder.start(stream: fresh)
                if keepAudio { LectureAudio.noteRecording(recording) }
            }
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
        fedInSegment = ""
        heardWords = 0
        confirmedWords = 0
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
        player?.stop()
        player = nil
        if !replaying, let url = try? recorder.stop().url {
            if keepAudio, let kept = LectureAudio.keep(url) { keptAudio = (kept, true) } else { try? FileManager.default.removeItem(at: url) }
        }
        if replaying, keepAudio, let replayURL { keptAudio = (replayURL, false) }
        if let stream {
            let fed = fedInSegment
            closeSegment(final: try? await stream.finish(), fed: fed)
        }
        stream = nil
        liveText = ""
        let minutes = Int((startedAt.map { Date().timeIntervalSince($0) } ?? 0) / 60)
        Log.info("lecture: stopped after \(minutes) min, \(transcript.count) chars; \(heardWords) words heard, \(confirmedWords) in confirmed chunks")
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
            var heard = ""
            for await update in await stream.transcriptionUpdates {
                if Task.isCancelled { break }
                let text = update.text.trimmingCharacters(in: .whitespaces)
                guard !text.isEmpty else { continue }
                self.lastHeardAt = Date()
                // Each update is the next 4 s of audio (the window moves a chunk at a time and never redoes one), so every
                // chunk goes on the feed. Only confirmed ones (confidence 0.85) used to: the MATH 20250 lecturer rarely got
                // there, and about 25 words a minute reached the writer (10-26, 10-28).
                let count = text.split(separator: " ").count
                self.heardWords += count
                if update.isConfirmed { self.confirmedWords += count }
                heard += (heard.isEmpty ? "" : " ") + text
                liveText = heard
                self.fedInSegment = heard
                self.feed += (self.feed.isEmpty ? "" : " ") + text
            }
        }
    }

    /// Every few minutes the stream is finished (its deduplicated text is the truth for that
    /// stretch) and a fresh one takes over, so memory and the decoder state stay small.
    private func rollSegment() async {
        guard isListening, let old = stream else { return }
        guard let fresh = try? await makeStream() else { return }
        reader?.cancel()
        let fed = fedInSegment
        fedInSegment = ""
        if !replaying { recorder.swapStream(fresh) }
        stream = fresh
        readUpdates()
        closeSegment(final: try? await old.finish(), fed: fed)
        liveText = ""
        liveSince = Date()
        onStatus?("listening, \(elapsedMinutes) min")
    }

    private func makeStream() async throws -> SlidingWindowAsrManager {
        let stream = try await transcriber.makeStream()
        if let boost {
            do { try await stream.configureVocabularyBoosting(vocabulary: boost.vocab, ctcModels: boost.models) }
            catch { Log.warn("lecture: term boosting not applied: \(error)") }
        }
        return stream
    }

    /// Boost these terms from the next stream on (the current one too). The CTC model downloads once, in the background.
    func setTerms(_ terms: [String]) async {
        guard !terms.isEmpty else { return }
        do {
            let models: CtcModels
            if let loaded = boost?.models { models = loaded } else { models = try await CtcModels.downloadAndLoad(variant: .ctc110m) }
            let tokenizer = try await CtcTokenizer.load(from: CtcModels.defaultCacheDirectory(for: .ctc110m))
            let vocab = CustomVocabularyContext(terms: terms.compactMap { term in
                let ids = tokenizer.encode(term)
                return ids.isEmpty ? nil : CustomVocabularyTerm(text: term, ctcTokenIds: ids)
            })
            boost = (vocab, models)
            if let stream { try await stream.configureVocabularyBoosting(vocabulary: vocab, ctcModels: models) }
            Log.info("lecture: boosting \(vocab.terms.count) course terms (\(Log.short(terms.prefix(8).joined(separator: ", "), 120)))")
        } catch {
            Log.warn("lecture: course terms not boosted: \(error)")
        }
    }

    /// Half-second mono buffers from the file into whichever stream is current, paced to `speed` times real time by the
    /// clock (so the sound played alongside stays in step).
    private func pump(_ url: URL, speed: Double, from: Double, audible: Bool) {
        pumpTask = Task { @MainActor [weak self] in
            guard let file = try? AVAudioFile(forReading: url) else { Log.warn("lecture: replay: can't read \(url.lastPathComponent)"); return }
            let format = file.processingFormat
            guard let mono = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: format.sampleRate, channels: 1, interleaved: false) else { return }
            let frames = AVAudioFrameCount(format.sampleRate / 2)
            let skip = AVAudioFramePosition(max(0, from) * format.sampleRate)
            guard skip < file.length else { Log.warn("lecture: replay: \(Int(from)) s is past the end"); return }
            file.framePosition = skip
            Log.info(String(format: "lecture: replaying %@ (%.0f min) from %.0f s at %.1fx%@", url.lastPathComponent, Double(file.length) / format.sampleRate / 60,
                            from, speed, audible ? ", out loud" : ""))
            if audible, let player = try? AVAudioPlayer(contentsOf: url) {
                player.enableRate = true
                player.rate = Float(min(speed, 2))
                player.currentTime = max(0, from)
                player.play()
                self?.player = player
            }
            let began = Date()
            var fed = 0.0
            self?.replayPosition = max(0, from)
            while !Task.isCancelled, let self {
                guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames), (try? file.read(into: buffer, frameCount: frames)) != nil,
                      buffer.frameLength > 0, let out = AVAudioPCMBuffer(pcmFormat: mono, frameCapacity: buffer.frameLength) else { break }
                out.frameLength = buffer.frameLength
                if let src = buffer.floatChannelData?[0], let dst = out.floatChannelData?[0] { dst.update(from: src, count: Int(buffer.frameLength)) }
                await self.stream?.streamAudio(out)
                fed += Double(buffer.frameLength) / format.sampleRate
                self.replayPosition = max(0, from) + fed
                let due = began.addingTimeInterval(fed / max(speed, 0.1)).timeIntervalSinceNow
                if due > 0 { try? await Task.sleep(nanoseconds: UInt64(due * 1_000_000_000)) }
            }
            guard !Task.isCancelled else { return }
            Log.info("lecture: replay finished")
            self?.onReplayEnded?()
        }
    }

    /// A segment ended: its text is the stream's final text, and the words that has past what went on the feed chunk by
    /// chunk (the last chunk, flushed by finish) go on the feed too. With boosting on, the final text keeps only the
    /// chunks FluidAudio confirmed, so when it is shorter than the feed the fed chunks stand for the segment.
    private func closeSegment(final: String?, fed: String) {
        let done = fed.split(separator: " ").count
        let words = (final ?? "").split(separator: " ")
        guard words.count > done else { appendSegment(fed); return }
        appendSegment(words.joined(separator: " "))
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

    /// The kept class audio, handed over once (the after-class pass deletes it when it's done).
    func takeKeptAudio() -> (url: URL, owned: Bool)? {
        defer { keptAudio = nil }
        return keptAudio
    }
}
