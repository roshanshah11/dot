import Foundation

/// Silent in class (lecture mode, 2026-10-22): while a lecture's notes are being written nothing Dot runs speaks out loud,
/// jobs and agents included. Every voice goes through this; when quiet, a sentence is dropped (its words already show as
/// text where it came from) and its start mark still fires, so whatever waits on the speech moves on.
final class QuietSpeaker: TTSProvider {
    /// Set by lecture mode for as long as a class is on.
    static var quiet = false

    let inner: TTSProvider
    var onFinishedAll: (() -> Void)?

    init(_ inner: TTSProvider) {
        self.inner = inner
        inner.onFinishedAll = { [weak self] in self?.onFinishedAll?() }
    }

    var isSpeaking: Bool { inner.isSpeaking }

    func speak(_ sentence: String, onStart: (() -> Void)?) {
        guard Self.quiet else { return inner.speak(sentence, onStart: onStart) }
        if !sentence.trimmingCharacters(in: .whitespaces).isEmpty { Log.info("speak: quiet in class: \(Log.short(sentence, 80))") }
        DispatchQueue.main.async { [weak self] in
            onStart?()
            if self?.inner.isSpeaking == false { self?.onFinishedAll?() }
        }
    }

    func stop() { inner.stop() }
    func setRate(_ multiplier: Double) { inner.setRate(multiplier) }
}
