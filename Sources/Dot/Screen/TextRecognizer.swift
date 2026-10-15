import AppKit
import Vision

/// One recognized line and where it sits in the image (pixels, top-left origin).
struct RecognizedLine: Equatable {
    let text: String
    let rect: CGRect
}

/// Reads the words in a screenshot (or the region he circled) with Vision's on-device OCR.
enum TextRecognizer {
    static func recognize(jpeg: Data) async -> String {
        await lines(jpeg: jpeg).map(\.text).joined(separator: "\n")
    }

    /// Lines top to bottom with their pixel boxes, so a passage can be highlighted exactly where it sits.
    static func lines(jpeg: Data) async -> [RecognizedLine] {
        guard let image = NSImage(data: jpeg), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return [] }
        let width = CGFloat(cg.width), height = CGFloat(cg.height)
        return await withCheckedContinuation { continuation in
            let request = VNRecognizeTextRequest { request, _ in
                let observations = (request.results as? [VNRecognizedTextObservation] ?? [])
                    .sorted { a, b in a.boundingBox.minY > b.boundingBox.minY }
                let lines = observations.compactMap { observation -> RecognizedLine? in
                    guard let text = observation.topCandidates(1).first?.string else { return nil }
                    let box = observation.boundingBox   // normalized, origin bottom-left
                    let rect = CGRect(x: box.minX * width, y: (1 - box.maxY) * height, width: box.width * width, height: box.height * height)
                    return RecognizedLine(text: text, rect: rect)
                }
                continuation.resume(returning: lines)
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            let handler = VNImageRequestHandler(cgImage: cg, options: [:])
            DispatchQueue.global(qos: .userInitiated).async {
                do { try handler.perform([request]) } catch { continuation.resume(returning: []) }
            }
        }
    }

    /// The pixel box around the lines that hold the phrase (consecutive lines when it wraps), or nil.
    static func box(for phrase: String, in lines: [RecognizedLine]) -> CGRect? {
        let want = normalize(phrase)
        guard want.count >= 3 else { return nil }
        // A single line holding the whole phrase.
        if let line = lines.first(where: { normalize($0.text).contains(want) }) { return line.rect }
        // The phrase wraps: a window of two or three lines whose joined text holds it.
        for span in 2...3 where lines.count >= span {
            for start in 0...(lines.count - span) {
                let joined = normalize(lines[start..<(start + span)].map(\.text).joined(separator: " "))
                if joined.contains(want) { return lines[start..<(start + span)].map(\.rect).reduce(CGRect.null) { $0.union($1) } }
            }
        }
        // Most of the phrase's words on one line.
        let words = want.split(separator: " ").map(String.init).filter { $0.count >= 4 }
        guard words.count >= 3 else { return nil }
        var best: (RecognizedLine, Int)?
        for line in lines {
            let text = normalize(line.text)
            let hits = words.filter { text.contains($0) }.count
            if hits * 3 >= words.count * 2, best == nil || hits > best!.1 { best = (line, hits) }
        }
        return best?.0.rect
    }

    static func normalize(_ text: String) -> String {
        text.lowercased()
            .replacingOccurrences(of: #"[“”"‘’'`]"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"[–—\-]"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"[^a-z0-9 ]"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
    }
}
