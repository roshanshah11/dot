import AppKit
import DotKit
import SwiftUI

/// One caption on the strip: a sentence, when it started and how long it lasts.
struct CaptionModel: Equatable {
    let id: Int
    let words: [String]
    let starts: [Double]
    /// Reference-date seconds the sentence began.
    let begin: TimeInterval
    let duration: TimeInterval
    /// Set when the strip is leaving: it fades from here.
    var fadeAt: TimeInterval?

    static let fade: TimeInterval = 0.5
}

/// The caption strip at the bottom of the screen (parity D7): the sentence Dot is saying, each word lighting in turn.
struct CaptionStripView: View {
    let caption: CaptionModel
    let accent: Color

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30)) { context in
            let now = context.date.timeIntervalSinceReferenceDate
            let lit = CaptionTiming.lit(caption.starts, elapsed: now - caption.begin, duration: caption.duration)
            Text(Self.text(caption.words, lit: lit))
                .font(.system(size: 20, weight: .medium, design: .rounded))
                .multilineTextAlignment(.center)
                .lineLimit(3)
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.black.opacity(0.74)))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(accent.opacity(0.35), lineWidth: 1))
                .frame(maxWidth: 820)
                .opacity(opacity(now))
        }
        .allowsHitTesting(false)
    }

    private func opacity(_ now: TimeInterval) -> Double {
        let appear = min(max((now - caption.begin) / 0.15, 0), 1)
        guard let fadeAt = caption.fadeAt else { return appear }
        return appear * min(max(1 - (now - fadeAt) / CaptionModel.fade, 0), 1)
    }

    static func text(_ words: [String], lit: Int) -> AttributedString {
        var out = AttributedString()
        for (i, word) in words.enumerated() {
            var piece = AttributedString(i == 0 ? word : " " + word)
            piece.foregroundColor = i < lit ? .white : .white.opacity(0.42)
            out += piece
        }
        return out
    }
}

extension OverlayManager {
    /// Show the sentence Dot starts saying on the screen he is on.
    func caption(_ text: String, duration: TimeInterval) {
        let words = CaptionTiming.words(text)
        guard !words.isEmpty, let index = screenIndex(containing: NSEvent.mouseLocation), models.indices.contains(index) else { return }
        captionSerial += 1
        let id = captionSerial
        for (i, model) in models.enumerated() where i != index { model.caption = nil }
        let window = windows[index]
        let visible = window.screen?.visibleFrame ?? window.screenFrame
        models[index].captionInset = max(visible.minY - window.screenFrame.minY, 0) + 28
        models[index].caption = CaptionModel(id: id, words: words.map(\.word), starts: words.map(\.start),
                                             begin: Date().timeIntervalSinceReferenceDate, duration: duration)
        // a sentence nothing follows goes by itself
        endCaption(after: duration + CaptionTiming.linger, id: id)
    }

    /// Fade the strip out `after` seconds (the voice finished), unless a newer sentence took it.
    func endCaption(after delay: TimeInterval = 0.8, id: Int? = nil) {
        let id = id ?? captionSerial
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self, self.captionSerial == id else { return }
            for model in self.models where model.caption?.id == id && model.caption?.fadeAt == nil {
                model.caption?.fadeAt = Date().timeIntervalSinceReferenceDate
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + CaptionModel.fade + 0.05) { [weak self] in
                guard let self, self.captionSerial == id else { return }
                for model in self.models where model.caption?.id == id { model.caption = nil }
            }
        }
    }

    /// Gone now (he cut Dot off, or Escape).
    func clearCaption() {
        captionSerial += 1
        for model in models where model.caption != nil { model.caption = nil }
    }
}
