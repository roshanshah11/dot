import CoreGraphics
import Foundation
import Vision

/// How far the content moved between two captures of the same screen region: the pixel path of mark tracking
/// (round eight). Vision's translational registration does the matching; this wraps its conventions so callers
/// get a translation in top-left image pixels: positive dy = the content moved down.
public enum ImageRegistration {
    public struct Shift: Equatable, Sendable {
        public let dx: CGFloat
        public let dy: CGFloat
        /// 0...1: how much texture there was to match and whether the result is plausible.
        public let confidence: Double
        public init(dx: CGFloat, dy: CGFloat, confidence: Double) { self.dx = dx; self.dy = dy; self.confidence = confidence }
    }

    /// The translation that carries `before` onto `after` (same size, same region). Nil when Vision cannot
    /// register them (a blank region, a size mismatch).
    public static func shift(from before: CGImage, to after: CGImage) -> Shift? {
        guard before.width == after.width, before.height == after.height, before.width >= 16, before.height >= 16 else { return nil }
        let request = VNTranslationalImageRegistrationRequest(targetedCGImage: after, options: [:])
        let handler = VNImageRequestHandler(cgImage: before, options: [:])
        do { try handler.perform([request]) } catch { return nil }
        guard let obs = request.results?.first as? VNImageTranslationAlignmentObservation else { return nil }
        let t = obs.alignmentTransform
        // Vision reports the transform that aligns the targeted image (after) onto the reference (before):
        // content that moved down by d comes back as ty = +d and content that moved right by d as tx = -d.
        // ImageRegistrationTests pins both signs with synthetic shifted page images.
        let dx = -t.tx, dy = t.ty
        let texture = Self.texture(before)
        let plausible = abs(dx) < CGFloat(before.width) * 0.9 && abs(dy) < CGFloat(before.height) * 0.9
        let confidence = plausible ? min(1, texture * 10) * Double(obs.confidence > 0 ? obs.confidence : 1) : 0
        return Shift(dx: dx, dy: dy, confidence: confidence)
    }

    /// A rough 0...1 measure of how much detail the image has (mean absolute neighbour difference of a coarse
    /// grayscale sample). A flat region (empty margin, a solid color) cannot be registered reliably.
    public static func texture(_ image: CGImage) -> Double {
        let w = 64, h = 64
        var pixels = [UInt8](repeating: 0, count: w * h)
        guard let ctx = CGContext(data: &pixels, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                                  space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return 0 }
        ctx.interpolationQuality = .low
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        var sum = 0
        for y in 0..<h { for x in 1..<w { sum += abs(Int(pixels[y * w + x]) - Int(pixels[y * w + x - 1])) } }
        return Double(sum) / Double(h * (w - 1)) / 255.0
    }
}
