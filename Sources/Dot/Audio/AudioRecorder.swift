import AVFoundation
import Foundation

/// Push-to-talk capture to a 16 kHz mono WAV, the format Parakeet wants.
/// After Murmur's AudioRecorder (MIT, Roshan Shah).
final class AudioRecorder: NSObject, AVAudioRecorderDelegate {
    enum Failure: Error, CustomStringConvertible {
        case microphoneDenied
        case couldNotStart(String)
        case notRecording

        var description: String {
            switch self {
            case .microphoneDenied: return "Microphone access is off for Dot."
            case .couldNotStart(let m): return "The recorder did not start: \(m)"
            case .notRecording: return "Nothing is recording."
            }
        }
    }

    private var recorder: AVAudioRecorder?
    private var fileURL: URL?

    var isRecording: Bool { recorder?.isRecording ?? false }

    /// 0...1 from the recorder's average power; cheap enough to poll at 30 Hz.
    func level() -> Float {
        guard let recorder else { return 0 }
        recorder.updateMeters()
        let dB = max(-50, min(0, recorder.averagePower(forChannel: 0)))
        return (dB + 50) / 50
    }

    func start() throws -> URL {
        guard AVCaptureDevice.authorizationStatus(for: .audio) == .authorized else { throw Failure.microphoneDenied }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("dot-audio", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appendingPathComponent("turn-\(UUID().uuidString).wav")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatLinearPCM),
            AVSampleRateKey: 16_000.0,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false,
        ]
        do {
            let recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder.delegate = self
            recorder.isMeteringEnabled = true
            recorder.prepareToRecord()
            guard recorder.record() else { throw Failure.couldNotStart("record() returned false") }
            self.recorder = recorder
            self.fileURL = url
            return url
        } catch let failure as Failure {
            throw failure
        } catch {
            throw Failure.couldNotStart(error.localizedDescription)
        }
    }

    /// Stops and returns the file plus its length in seconds.
    func stop() throws -> (url: URL, seconds: TimeInterval) {
        guard let recorder, let fileURL else { throw Failure.notRecording }
        let seconds = recorder.currentTime
        recorder.stop()
        self.recorder = nil
        self.fileURL = nil
        return (fileURL, seconds)
    }

    func cancel() {
        recorder?.stop()
        if let fileURL { try? FileManager.default.removeItem(at: fileURL) }
        recorder = nil
        fileURL = nil
    }
}
