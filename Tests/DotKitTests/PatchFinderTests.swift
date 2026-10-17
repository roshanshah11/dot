import XCTest
@testable import DotKit

final class PatchFinderTests: XCTestCase {
    /// Lines of "text": every line has the same stripes, and each has its own short mark (its "number").
    private func page(width: Int, height: Int, lineHeight: Int, offset: Int) -> PatchFinder.Gray {
        var px = [Float](repeating: 1, count: width * height)
        for y in 0..<height {
            let docY = y + offset, line = docY / lineHeight, inLine = docY % lineHeight
            guard inLine >= 4, inLine < 14 else { continue }
            for x in 0..<width {
                let stripe = (x / 3) % 2 == 0 && x > 10 && x < width - 10
                let number = x >= 12 + (line % 7) * 9 && x < 18 + (line % 7) * 9   // differs line to line
                if stripe || number { px[y * width + x] = 0.1 }
            }
        }
        return PatchFinder.Gray(width: width, height: height, pixels: px)
    }

    private func crop(_ g: PatchFinder.Gray, x: Int, y: Int, w: Int, h: Int) -> PatchFinder.Gray {
        var px: [Float] = []
        for yy in y..<(y + h) { for xx in x..<(x + w) { px.append(g[xx, yy]) } }
        return PatchFinder.Gray(width: w, height: h, pixels: px)
    }

    func testFindsTheMarkedLineNotItsLookalikeNeighbours() {
        let before = page(width: 120, height: 200, lineHeight: 21, offset: 0)
        // the marked line: line 4 (y 84...104)
        let patch = crop(before, x: 0, y: 84, w: 120, h: 21)
        // scrolled by 37 px: line 4 is now at y 47; search a band of y 20...100
        let after = page(width: 120, height: 200, lineHeight: 21, offset: 37)
        let band = crop(after, x: 0, y: 20, w: 120, h: 80)
        let m = PatchFinder.find(patch, in: band)!
        XCTAssertEqual(m.x, 0)
        XCTAssertEqual(m.y + 20, 84 - 37)
        XCTAssertGreaterThan(m.score, 0.99)
        XCTAssertLessThan(m.runnerUp, m.score - 0.03, "the neighbouring lines must score clearly lower")
    }

    func testFlatPatchFindsNothing() {
        let flat = PatchFinder.Gray(width: 10, height: 10, pixels: [Float](repeating: 0.5, count: 100))
        XCTAssertNil(PatchFinder.find(flat, in: page(width: 40, height: 40, lineHeight: 21, offset: 0)))
        XCTAssertNil(PatchFinder.find(page(width: 50, height: 50, lineHeight: 21, offset: 0), in: flat))
    }
}
