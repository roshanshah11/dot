import CoreGraphics
import XCTest
@testable import DotKit

final class ImageRegistrationTests: XCTestCase {
    /// A page-like texture: rows of dark "words" of varying length on a light ground, deterministic.
    private func page(width: Int = 320, height: Int = 700) -> CGImage {
        let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.setFillColor(CGColor(gray: 0.96, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
        var seed: UInt64 = 42
        func next() -> Int { seed = seed &* 6364136223846793005 &+ 1442695040888963407; return Int(seed >> 33) }
        ctx.setFillColor(CGColor(gray: 0.15, alpha: 1))
        var y = 8
        while y < height - 12 {
            var x = 10
            while x < width - 30 {
                let w = 12 + next() % 46
                ctx.fill(CGRect(x: x, y: y, width: min(w, width - 10 - x), height: 9 + next() % 4))
                x += w + 6 + next() % 6
            }
            y += 18 + next() % 6
        }
        return ctx.makeImage()!
    }

    func testShiftMeasuresContentMovingDownAndUp() throws {
        let img = page()
        // the window shows rows 200..<500; content scrolls down by 30 px: the same window now shows rows 170..<470
        let before = try XCTUnwrap(img.cropping(to: CGRect(x: 0, y: 200, width: 320, height: 300)))
        let down = try XCTUnwrap(img.cropping(to: CGRect(x: 0, y: 170, width: 320, height: 300)))
        let s = try XCTUnwrap(ImageRegistration.shift(from: before, to: down))
        XCTAssertEqual(s.dy, 30, accuracy: 1.5)
        XCTAssertEqual(s.dx, 0, accuracy: 1.5)
        XCTAssertGreaterThan(s.confidence, 0.5)
        // content scrolls up by 45 px: the window shows rows 245..<545
        let up = try XCTUnwrap(img.cropping(to: CGRect(x: 0, y: 245, width: 320, height: 300)))
        let u = try XCTUnwrap(ImageRegistration.shift(from: before, to: up))
        XCTAssertEqual(u.dy, -45, accuracy: 1.5)
    }

    func testHorizontalShift() throws {
        let img = page(width: 500, height: 400)
        let before = try XCTUnwrap(img.cropping(to: CGRect(x: 100, y: 50, width: 300, height: 300)))
        let right = try XCTUnwrap(img.cropping(to: CGRect(x: 80, y: 50, width: 300, height: 300)))   // content moved right by 20
        let s = try XCTUnwrap(ImageRegistration.shift(from: before, to: right))
        XCTAssertEqual(s.dx, 20, accuracy: 1.5)
    }

    func testFlatRegionHasNoConfidence() throws {
        let ctx = CGContext(data: nil, width: 200, height: 200, bitsPerComponent: 8, bytesPerRow: 800,
                            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.setFillColor(CGColor(gray: 0.9, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: 200, height: 200))
        let flat = ctx.makeImage()!
        let s = ImageRegistration.shift(from: flat, to: flat)
        XCTAssertLessThan(s?.confidence ?? 0, 0.2)
    }
}
