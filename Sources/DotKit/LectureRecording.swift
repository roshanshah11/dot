import AVFoundation
import Foundation

/// Another app's recording of a class (his Murmur backup, 2026-10-27), placed on the class's clock.
public enum LectureRecording {
    /// The part of a recording made from `made` to `changed` that falls in `from...to`: when its first kept sample was
    /// recorded and how long it runs. Nil under a minute.
    public static func overlap(made: Date, changed: Date, from: Date, to: Date) -> (start: Date, seconds: TimeInterval)? {
        let start = max(made, from), seconds = min(changed, to).timeIntervalSince(start)
        return seconds > 60 ? (start, seconds) : nil
    }

    /// The part of a Murmur file to use for a class reaching back to `from`, or nil when it isn't this class's. It has
    /// to have kept recording more than a minute into `live...to`, the part of the class Dot heard itself: Murmur on
    /// this Mac then was recording this room. One that stopped before is some other recording, however much of a
    /// resumed class's three-hour reach it covers (review, 10-28). Without a restart `from` is `live` and this is
    /// `overlap`.
    public static func classPart(made: Date, changed: Date, from: Date, live: Date, to: Date) -> (start: Date, seconds: TimeInterval)? {
        guard overlap(made: made, changed: changed, from: live, to: to) != nil else { return nil }
        return overlap(made: made, changed: changed, from: from, to: to)
    }

    /// `seconds` of `source` starting `skip` seconds in, written to `target` in the source's own format. Throws when the
    /// source reads as shorter than `skip` (a header another app hasn't finished writing).
    public static func trim(_ source: URL, to target: URL, skip: TimeInterval, seconds: TimeInterval) throws {
        let input = try AVAudioFile(forReading: source)
        let format = input.processingFormat
        let first = AVAudioFramePosition(max(0, skip) * format.sampleRate)
        var left = min(input.length - first, AVAudioFramePosition(seconds * format.sampleRate))
        guard left > 0, let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 1 << 16) else { throw CocoaError(.fileReadCorruptFile) }
        input.framePosition = first
        let output = try AVAudioFile(forWriting: target, settings: input.fileFormat.settings, commonFormat: format.commonFormat, interleaved: format.isInterleaved)
        while left > 0 {
            try input.read(into: buffer, frameCount: AVAudioFrameCount(min(AVAudioFramePosition(buffer.frameCapacity), left)))
            if buffer.frameLength == 0 { break }
            try output.write(from: buffer)
            left -= AVAudioFramePosition(buffer.frameLength)
        }
    }
}
