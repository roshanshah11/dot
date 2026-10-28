import AVFoundation
@testable import DotKit
import XCTest

final class LectureRecordingTests: XCTestCase {
    func testOverlapStartsAtTheLaterStartAndEndsAtTheEarlierEnd() {
        let t0 = Date(timeIntervalSince1970: 1_800_000_000)
        // Murmur started 5 min before the window and stopped 10 min after it ended
        let kept = LectureRecording.overlap(made: t0, changed: t0.addingTimeInterval(3900), from: t0.addingTimeInterval(300), to: t0.addingTimeInterval(3300))
        XCTAssertEqual(kept?.start, t0.addingTimeInterval(300))
        XCTAssertEqual(kept?.seconds, 3000)
        // started inside the window: its own start
        XCTAssertEqual(LectureRecording.overlap(made: t0, changed: t0.addingTimeInterval(600), from: t0.addingTimeInterval(-60), to: t0.addingTimeInterval(900))?.start, t0)
        XCTAssertNil(LectureRecording.overlap(made: t0, changed: t0.addingTimeInterval(50), from: t0, to: t0.addingTimeInterval(900)), "under a minute")
        XCTAssertNil(LectureRecording.overlap(made: t0, changed: t0.addingTimeInterval(600), from: t0.addingTimeInterval(700), to: t0.addingTimeInterval(900)), "before the window")
    }

    func testAResumedClassOnlyTakesAFileStillRecordingAfterTheRestart() {
        let t0 = Date(timeIntervalSince1970: 1_800_000_000), hour = 3600.0
        // class 10:00-11:00 (t0 = 10:00), Dot restarted at 10:50, so it reaches back to 7:50
        let from = t0.addingTimeInterval(-hour + -10 * 60 - hour), live = t0.addingTimeInterval(50 * 60), end = t0.addingTimeInterval(hour)
        // an hour recorded 8:30-9:30 and never transcribed: longer than Dot's ten minutes, but not this class
        XCTAssertNil(LectureRecording.classPart(made: t0.addingTimeInterval(-1.5 * hour), changed: t0.addingTimeInterval(-0.5 * hour), from: from, live: live, to: end))
        // his backup of this class, started at 9:58 and still going: all of it from 9:58
        let mine = LectureRecording.classPart(made: t0.addingTimeInterval(-120), changed: end.addingTimeInterval(30), from: from, live: live, to: end)
        XCTAssertEqual(mine?.start, t0.addingTimeInterval(-120))
        XCTAssertEqual(mine?.seconds, hour + 120)
        // stopped a minute after the restart: too little of Dot's part to say it's this room
        XCTAssertNil(LectureRecording.classPart(made: t0, changed: live.addingTimeInterval(50), from: from, live: live, to: end))
        // no restart: from is live and it is overlap
        XCTAssertEqual(LectureRecording.classPart(made: t0, changed: end, from: t0, live: t0, to: end)?.seconds, hour)
    }

    func testTrimKeepsTheRequestedSecondsFromTheSkip() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("lecture-recording-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let source = dir.appendingPathComponent("murmur.wav"), target = dir.appendingPathComponent("kept.wav")
        let rate = 16_000.0
        do {   // 4 s of 16 kHz Int16 mono, each sample its own second (0, 0.1, 0.2, 0.3) so the trim point shows
            let settings: [String: Any] = [AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: rate, AVNumberOfChannelsKey: 1,
                                           AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false]
            let file = try AVAudioFile(forWriting: source, settings: settings, commonFormat: .pcmFormatFloat32, interleaved: false)
            let buffer = try XCTUnwrap(AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(4 * rate)))
            buffer.frameLength = buffer.frameCapacity
            for i in 0..<Int(4 * rate) { buffer.floatChannelData![0][i] = Float(i / Int(rate)) / 10 }
            try file.write(from: buffer)
        }
        try LectureRecording.trim(source, to: target, skip: 1.5, seconds: 2)
        let kept = try AVAudioFile(forReading: target)
        XCTAssertEqual(kept.length, AVAudioFramePosition(2 * rate))
        XCTAssertEqual(kept.fileFormat.sampleRate, rate)
        let buffer = try XCTUnwrap(AVAudioPCMBuffer(pcmFormat: kept.processingFormat, frameCapacity: AVAudioFrameCount(kept.length)))
        try kept.read(into: buffer)
        XCTAssertEqual(buffer.floatChannelData![0][0], 0.1, accuracy: 0.001, "starts 1.5 s in, inside second 1")
        XCTAssertEqual(buffer.floatChannelData![0][Int(rate)], 0.2, accuracy: 0.001)
        // asking past the end keeps what is there; a skip past the end throws
        try LectureRecording.trim(source, to: dir.appendingPathComponent("tail.wav"), skip: 3, seconds: 10)
        XCTAssertEqual(try AVAudioFile(forReading: dir.appendingPathComponent("tail.wav")).length, AVAudioFramePosition(rate))
        XCTAssertThrowsError(try LectureRecording.trim(source, to: dir.appendingPathComponent("none.wav"), skip: 5, seconds: 1))
    }
}
