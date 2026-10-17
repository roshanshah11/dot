import CoreGraphics
import Foundation

/// Finds where a marked patch of a window is now (round eight). Frame-to-frame registration drifts on repetitive
/// content (lines of text one line-height apart look alike, and a fast scroll can lock onto the wrong one); the
/// patch Dot marked, compared directly against a band around where the mark is predicted to be, settles it: the
/// marked line's own words match best. Normalized cross-correlation on grayscale, brute force over the band.
public enum PatchFinder {
    public struct Gray {
        public let width: Int, height: Int
        public var pixels: [Float]
        public init(width: Int, height: Int, pixels: [Float]) { self.width = width; self.height = height; self.pixels = pixels }

        /// A grayscale copy of an image at its pixel size.
        public init?(_ image: CGImage) {
            let w = image.width, h = image.height
            guard w > 0, h > 0 else { return nil }
            var bytes = [UInt8](repeating: 0, count: w * h)
            guard let ctx = CGContext(data: &bytes, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(),
                                      bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return nil }
            ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
            self.init(width: w, height: h, pixels: bytes.map { Float($0) / 255 })
        }

        public subscript(x: Int, y: Int) -> Float { pixels[y * width + x] }
    }

    public struct Match: Equatable {
        public let x: Int, y: Int          // top-left of the best placement of the patch in the band (pixels)
        public let score: Float            // its correlation, -1...1
        public let runnerUp: Float         // the best score at least `separation` pixels away from it
    }

    /// The best placement of `patch` inside `band`, and the best score of any placement clearly apart from it.
    /// Nil when the patch is flat (nothing to match) or larger than the band.
    public static func find(_ patch: Gray, in band: Gray, separation: Int = 6) -> Match? {
        let pw = patch.width, ph = patch.height
        guard pw >= 4, ph >= 4, band.width >= pw, band.height >= ph else { return nil }
        let n = Float(pw * ph)
        let pMean = patch.pixels.reduce(0, +) / n
        let pc = patch.pixels.map { $0 - pMean }
        let pNorm = sqrt(pc.reduce(0) { $0 + $1 * $1 })
        guard pNorm > 1e-3 else { return nil }
        let nx = band.width - pw + 1, ny = band.height - ph + 1
        var scores = [Float](repeating: -1, count: nx * ny)
        for oy in 0..<ny {
            for ox in 0..<nx {
                var sum: Float = 0, sumSq: Float = 0, dot: Float = 0
                for y in 0..<ph {
                    let row = (oy + y) * band.width + ox, prow = y * pw
                    for x in 0..<pw {
                        let v = band.pixels[row + x]
                        sum += v; sumSq += v * v; dot += v * pc[prow + x]
                    }
                }
                let variance = sumSq - sum * sum / n
                scores[oy * nx + ox] = variance > 1e-6 ? dot / (pNorm * sqrt(variance)) : -1
            }
        }
        guard let bestIndex = scores.indices.max(by: { scores[$0] < scores[$1] }) else { return nil }
        let bx = bestIndex % nx, by = bestIndex / nx
        var runner: Float = -1
        for oy in 0..<ny {
            for ox in 0..<nx where abs(ox - bx) >= separation || abs(oy - by) >= separation {
                runner = max(runner, scores[oy * nx + ox])
            }
        }
        return Match(x: bx, y: by, score: scores[bestIndex], runnerUp: runner)
    }
}
