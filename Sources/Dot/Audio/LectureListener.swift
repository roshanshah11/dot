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
    private var fileURL: URL?
    private static let segmentSeconds: TimeInterval = 180
    var onStatus: ((String) -> Void)?

    init(transcriber: Transcriber) { self.transcriber = transcriber }

    func start(title: String) async -> Bool {
        guard !isListening else { return true }
        do {
            let fresh = try await transcriber.makeStream()
            _ = try recorder.start(stream: fresh)
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
        if let url = try? recorder.stop().url { try? FileManager.default.removeItem(at: url) }
        if let stream {
            if let text = try? await stream.finish(), !text.trimmingCharacters(in: .whitespaces).isEmpty { appendSegment(text) }
            else if !liveText.isEmpty { appendSegment(liveText) }
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
                if update.isConfirmed { confirmed += (confirmed.isEmpty ? "" : " ") + text; liveText = confirmed }
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
        recorder.swapStream(fresh)
        stream = fresh
        readUpdates()
        if let text = try? await old.finish(), !text.trimmingCharacters(in: .whitespaces).isEmpty { appendSegment(text) }
        else if !liveText.isEmpty { appendSegment(liveText) }
        liveText = ""
        liveSince = Date()
        onStatus?("listening, \(elapsedMinutes) min")
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
