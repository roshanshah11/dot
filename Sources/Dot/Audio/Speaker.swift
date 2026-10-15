import AVFoundation
import DotKit
import Foundation

/// Speech output. Default is Apple's on-device synthesizer; `TTSProvider` is the seam
/// for ElevenLabs, Kokoro, or anything else later.
protocol TTSProvider: AnyObject {
    var isSpeaking: Bool { get }
    var onFinishedAll: (() -> Void)? { get set }
    func speak(_ sentence: String)
    func stop()
}

final class AppleSpeaker: NSObject, TTSProvider, AVSpeechSynthesizerDelegate {
    private let synthesizer = AVSpeechSynthesizer()
    private let voice: AVSpeechSynthesisVoice?
    private let rate: Float
    private var queued = 0

    var onFinishedAll: (() -> Void)?
    var isSpeaking: Bool { synthesizer.isSpeaking || queued > 0 }

    init(voiceIdentifier: String?, rate: Float) {
        self.voice = AppleSpeaker.pickVoice(preferred: voiceIdentifier)
        self.rate = min(max(rate, 0.3), 0.7)
        super.init()
        synthesizer.delegate = self
        if let voice { Log.info("speaker: voice \(voice.name) (\(voice.identifier))") }
    }

    func speak(_ sentence: String) {
        let text = SpeechText.clean(sentence)
        guard !text.isEmpty else { return }
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = voice
        utterance.rate = rate
        utterance.prefersAssistiveTechnologySettings = false
        queued += 1
        synthesizer.speak(utterance)
    }

    func stop() {
        queued = 0
        synthesizer.stopSpeaking(at: .immediate)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        finishedOne()
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        finishedOne()
    }

    private func finishedOne() {
        queued = max(0, queued - 1)
        if queued == 0, !synthesizer.isSpeaking {
            onFinishedAll?()
        }
    }

    /// The configured voice, else the highest-quality installed English voice.
    static func pickVoice(preferred identifier: String?) -> AVSpeechSynthesisVoice? {
        if let identifier, let voice = AVSpeechSynthesisVoice(identifier: identifier) { return voice }
        let english = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("en") }
        let ranked = english.sorted { a, b in
            if a.quality != b.quality { return a.quality.rawValue > b.quality.rawValue }
            let aUS = a.language == "en-US", bUS = b.language == "en-US"
            if aUS != bUS { return aUS }
            return a.name < b.name
        }
        return ranked.first ?? AVSpeechSynthesisVoice(language: "en-US")
    }

    static func availableVoices() -> [(id: String, name: String, quality: String)] {
        AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("en") }.map {
            let quality: String
            switch $0.quality {
            case .premium: quality = "premium"
            case .enhanced: quality = "enhanced"
            default: quality = "default"
            }
            return ($0.identifier, "\($0.name) (\($0.language))", quality)
        }
    }
}
