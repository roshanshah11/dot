import AppKit
import CoreGraphics
import Foundation

/// Crops the region the user drew out of a screenshot and enlarges it so small text reads.
enum ImageCrop {
    static func crop(jpeg: Data, pixelRect: CGRect, minWidth: CGFloat = 720) -> (data: Data, width: Int, height: Int)? {
        guard let rep = NSBitmapImageRep(data: jpeg), let image = rep.cgImage else { return nil }
        let bounds = CGRect(x: 0, y: 0, width: image.width, height: image.height)
        let rect = pixelRect.integral.intersection(bounds)
        guard rect.width >= 4, rect.height >= 4, let cropped = image.cropping(to: rect) else { return nil }
        var out = cropped
        let scale = rect.width < minWidth ? min(3, minWidth / rect.width) : 1
        if scale > 1 {
            let width = Int(rect.width * scale), height = Int(rect.height * scale)
            if let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                       space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) {
                context.interpolationQuality = .high
                context.draw(cropped, in: CGRect(x: 0, y: 0, width: width, height: height))
                if let scaled = context.makeImage() { out = scaled }
            }
        }
        guard let data = NSBitmapImageRep(cgImage: out).representation(using: .jpeg, properties: [.compressionFactor: 0.85]) else { return nil }
        return (data, out.width, out.height)
    }
}
