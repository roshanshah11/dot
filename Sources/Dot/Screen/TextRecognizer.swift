import AppKit
import Vision

/// Reads the words in a screenshot crop (the region he circled) with Vision's on-device OCR.
enum TextRecognizer {
    static func recognize(jpeg: Data) async -> String {
        guard let image = NSImage(data: jpeg), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return "" }
        return await withCheckedContinuation { continuation in
            let request = VNRecognizeTextRequest { request, _ in
                let lines = (request.results as? [VNRecognizedTextObservation] ?? [])
                    .sorted { a, b in a.boundingBox.minY > b.boundingBox.minY }
                    .compactMap { $0.topCandidates(1).first?.string }
                continuation.resume(returning: lines.joined(separator: "\n"))
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            let handler = VNImageRequestHandler(cgImage: cg, options: [:])
            DispatchQueue.global(qos: .userInitiated).async {
                do { try handler.perform([request]) } catch { continuation.resume(returning: "") }
            }
        }
    }
}
