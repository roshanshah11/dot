import AVFoundation
import DotKit
import FluidAudio
import Foundation

/// Both sides of a call (call mode, 2026-10-28), each on its own recognizer: his microphone is "me", the system audio
/// tap is "them", so who said what comes for free. Confirmed chunks become CallLines stamped with seconds since the call
/// began; a chunk of "his" that is mostly their last words is their voice in his mic (speakers) and is dropped. Each
/// side's stream is finished and replaced every three minutes, as the lecture ear does, so the decoder stays small.
/// Both recordings are kept in Dot's cache for the after-call pass, which deletes them. A replay feeds two files.
@MainActor
final class CallEar {
    private final class Side {
        let side: CallLine.Side
        var stream: SlidingWindowAsrManager?
        var reader: Task<Void, Never>?
        var confirmed = ""
        var live = ""
        var heardAt = Date.distantPast
        /// Lines this side has added, so a finish can tell whether its last chunk came through the reader.
        var count = 0
        /// In a replay, how far into its file this side has been fed: its lines are stamped with that, so a starved
        /// replay's times still match the recording's.
        var position: TimeInterval = 0
        init(_ side: CallLine.Side) { self.side = side }
    }

    private let transcriber: Transcriber
    private let recorder = AudioRecorder()
    private var tap: AnyObject?
    private let me = Side(.me)
    private let them = Side(.them)
    private var themFeed: AsyncStream<AVAudioPCMBuffer>.Continuation?
    private var tasks: [Task<Void, Never>] = []
    private var rollTimer: Timer?
    private var replaying = false
    private(set) var isListening = false
    private(set) var began = Date()
    private(set) var lines: [CallLine] = []
    /// Each side's recording, its first sample's offset from `began`, kept until the after-call pass.
    private(set) var meAudio: (url: URL, offset: TimeInterval)?
    private(set) var themAudio: (url: URL, offset: TimeInterval)?
    /// The tap is on (false on a Mac without macOS 14.2, or when the tap failed). On is not heard: without System Audio
    /// Recording, or with the call on another device, the tap records silence; theirPeak() tells.
    private(set) var hearsThem = false
    var onLine: ((CallLine) -> Void)?
    /// A replay ran out of audio on both sides.
    var onReplayEnded: (() -> Void)?
    static let segmentSeconds: TimeInterval = 180

    init(transcriber: Transcriber) { self.transcriber = transcriber }

    static var audioFolder: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("Dot/call-audio", isDirectory: true)
    }

    /// The loudest sample through the Mac's audio since the last read; nil without a live tap (a replay, a failed tap).
    func theirPeak() -> Float? {
        guard #available(macOS 14.2, *), let tap = tap as? SystemAudioTap else { return nil }
        return tap.peak()
    }

    /// The words heard last on a side, live.
    func live(_ side: CallLine.Side) -> String { side == .me ? me.live : them.live }
    func lastHeard(_ side: CallLine.Side) -> Date { side == .me ? me.heardAt : them.heardAt }
    var minutes: Int { Int(Date().timeIntervalSince(began) / 60) }

    func start(replay: (me: URL, them: URL)? = nil, speed: Double = 1) async throws {
        guard !isListening else { return }
        began = Date()
        lines = []
        replaying = replay != nil
        me.stream = try await transcriber.makeStream()
        them.stream = try await transcriber.makeStream()
        read(me)
        read(them)
        let stamp = Self.stamp(began)
        try? FileManager.default.createDirectory(at: Self.audioFolder, withIntermediateDirectories: true)
        if let replay {
            tasks.append(pump(replay.me, into: me, speed: speed))
            tasks.append(pump(replay.them, into: them, speed: speed))
            meAudio = (replay.me, 0)
            themAudio = (replay.them, 0)
            hearsThem = true
            Task { @MainActor [weak self] in
                for task in self?.tasks ?? [] { await task.value }
                guard let self, self.isListening else { return }
                Log.info("call: replay finished")
                self.onReplayEnded?()
            }
        } else {
            let recording = try recorder.start(stream: me.stream)
            meAudio = (recording, (recorder.startedAt ?? began).timeIntervalSince(began))
            startTap(into: Self.audioFolder.appendingPathComponent("them-\(stamp).wav"))
        }
        isListening = true
        rollTimer = Timer.scheduledTimer(withTimeInterval: Self.segmentSeconds, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.roll() }
        }
        Log.info("call: listening (\(replaying ? "replay" : hearsThem ? "mic + system audio" : "mic only, the other side can't be heard"))")
    }

    private func startTap(into url: URL) {
        guard #available(macOS 14.2, *) else { Log.warn("call: macOS before 14.2 has no audio tap; only his side is heard"); return }
        let tap = SystemAudioTap()
        let (feed, continuation) = AsyncStream<AVAudioPCMBuffer>.makeStream(bufferingPolicy: .bufferingNewest(400))
        tap.onBuffer = { continuation.yield($0) }
        do {
            try tap.start(writingTo: url)
        } catch {
            Log.warn("call: the system audio tap didn't start (\(error)); only his side is heard")
            continuation.finish()
            return
        }
        self.tap = tap
        themFeed = continuation
        themAudio = (url, (tap.startedAt ?? began).timeIntervalSince(began))
        hearsThem = true
        tasks.append(Task { @MainActor [weak self] in
            for await buffer in feed {
                guard let self else { return }
                await self.them.stream?.streamAudio(buffer)
            }
        })
    }

    /// Stop both sides; what each stream still held lands as lines first.
    func stop() async {
        guard isListening else { return }
        isListening = false
        rollTimer?.invalidate()
        rollTimer = nil
        for task in tasks { task.cancel() }
        tasks = []
        themFeed?.finish()
        themFeed = nil
        if #available(macOS 14.2, *), let tap = tap as? SystemAudioTap { tap.stop() }
        tap = nil
        if !replaying, let url = try? recorder.stop().url {
            let target = Self.audioFolder.appendingPathComponent("me-\(Self.stamp(began)).\(url.pathExtension.isEmpty ? "wav" : url.pathExtension)")
            if (try? FileManager.default.moveItem(at: url, to: target)) != nil { meAudio = (target, meAudio?.offset ?? 0) }
            else { meAudio = (url, meAudio?.offset ?? 0) }
        }
        for side in [me, them] {
            if let stream = side.stream { await finish(stream, of: side, reader: side.reader) }
            side.reader?.cancel()
            side.reader = nil
            side.stream = nil
            side.live = ""
        }
        Log.info("call: stopped after \(minutes) min, \(lines.count) lines")
    }

    // MARK: Streams

    private func read(_ side: Side) {
        guard let stream = side.stream else { return }
        side.reader?.cancel()
        side.reader = Task { @MainActor [weak self] in
            do { try await stream.startStreaming(source: side.side == .me ? .microphone : .system) } catch { Log.warn("call: stream start: \(error)"); return }
            var confirmed = ""
            for await update in await stream.transcriptionUpdates {
                if Task.isCancelled { break }
                let text = update.text.trimmingCharacters(in: .whitespaces)
                guard !text.isEmpty, let self else { continue }
                side.heardAt = Date()
                if update.isConfirmed {
                    confirmed += (confirmed.isEmpty ? "" : " ") + text
                    side.confirmed = confirmed
                    side.live = ""
                    self.add(side.side, text)
                } else {
                    side.live = text
                }
            }
        }
    }

    /// Every three minutes each side's stream is finished (its final text tops up what was confirmed) and a fresh one
    /// takes over.
    private func roll() async {
        guard isListening else { return }
        for side in [me, them] {
            guard let old = side.stream, let fresh = try? await transcriber.makeStream() else { continue }
            let oldReader = side.reader
            let confirmed = side.confirmed
            if side.side == .me, !replaying { recorder.swapStream(fresh) }
            side.stream = fresh
            side.confirmed = ""
            read(side)
            await finish(old, of: side, reader: oldReader, confirmed: confirmed)
            oldReader?.cancel()
        }
    }

    /// A stream's last words: finishing it confirms its tail through its reader (kept running for this), so wait a
    /// beat for that; when nothing came through, the words its final text has past what its chunks confirmed.
    private func finish(_ stream: SlidingWindowAsrManager, of side: Side, reader: Task<Void, Never>?, confirmed: String? = nil) async {
        let before = side.count
        let done = (confirmed ?? side.confirmed).split(separator: " ").count
        let text = try? await stream.finish()
        if reader != nil { try? await Task.sleep(nanoseconds: 200_000_000) }
        guard side.count == before else { return }
        let words = (text ?? side.live).split(separator: " ")
        if words.count > done { add(side.side, words[done...].joined(separator: " ")) }
    }

    private func add(_ side: CallLine.Side, _ text: String) {
        let text = text.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        let at = replaying ? max(0, (side == .me ? me : them).position - 1) : Date().timeIntervalSince(began)
        if side == .me, CallEcho.isEcho(text, theirRecent: recent(.them, seconds: 20, before: at)) {
            Log.info("call: dropped an echo of their words in his mic (\(Log.short(text, 60)))")
            return
        }
        let line = CallLine(at: at, side: side, text: text)
        (side == .me ? me : them).count += 1
        lines.append(line)
        onLine?(line)
    }

    /// What a side said in the `seconds` before `before`.
    func recent(_ side: CallLine.Side, seconds: TimeInterval, before: TimeInterval? = nil) -> String {
        let end = before ?? Date().timeIntervalSince(began)
        return lines.filter { $0.side == side && $0.at >= end - seconds && $0.at <= end + 1 }.map(\.text).joined(separator: " ")
    }

    /// The whole call so far, his side or theirs.
    func said(_ side: CallLine.Side) -> String { lines.filter { $0.side == side }.map(\.text).joined(separator: " ") }

    // MARK: Replay

    /// Half-second buffers from a file into the side's current stream, paced to `speed` times real time.
    private func pump(_ url: URL, into side: Side, speed: Double) -> Task<Void, Never> {
        Task { @MainActor [weak self] in
            guard let file = try? AVAudioFile(forReading: url) else { Log.warn("call: replay: can't read \(url.lastPathComponent)"); return }
            let format = file.processingFormat
            guard let mono = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: format.sampleRate, channels: 1, interleaved: false) else { return }
            let frames = AVAudioFrameCount(format.sampleRate / 2)
            let began = Date()
            var fed = 0.0
            while !Task.isCancelled, self != nil {
                guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames), (try? file.read(into: buffer, frameCount: frames)) != nil,
                      buffer.frameLength > 0, let out = AVAudioPCMBuffer(pcmFormat: mono, frameCapacity: buffer.frameLength) else { break }
                out.frameLength = buffer.frameLength
                if let src = buffer.floatChannelData?[0], let dst = out.floatChannelData?[0] { dst.update(from: src, count: Int(buffer.frameLength)) }
                await side.stream?.streamAudio(out)
                fed += Double(buffer.frameLength) / format.sampleRate
                side.position = fed
                let due = began.addingTimeInterval(fed / max(speed, 0.1)).timeIntervalSinceNow
                if due > 0 { try? await Task.sleep(nanoseconds: UInt64(due * 1_000_000_000)) }
            }
        }
    }

    static func stamp(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd-HHmmss"; f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: date)
    }

    /// Recordings a crash or a skipped pass left behind, older than three days: deleted at launch.
    static func sweepLeftovers(now: Date = Date()) {
        let files = (try? FileManager.default.contentsOfDirectory(at: audioFolder, includingPropertiesForKeys: [.contentModificationDateKey])) ?? []
        for file in files {
            let modified = (try? file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? now
            if now.timeIntervalSince(modified) > 3 * 86_400 { try? FileManager.default.removeItem(at: file) }
        }
    }
}
