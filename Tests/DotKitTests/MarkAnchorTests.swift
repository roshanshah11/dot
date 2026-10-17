import XCTest
@testable import DotKit

final class MarkAnchorTests: XCTestCase {
    func testElementMatchesTheMarkedThing() {
        let mark = CGRect(x: 100, y: 200, width: 260, height: 32)
        XCTAssertTrue(MarkTrackMath.elementMatches(mark: mark, element: CGRect(x: 96, y: 198, width: 270, height: 36)))
        // a whole scroll area under the box is not the box's anchor
        XCTAssertFalse(MarkTrackMath.elementMatches(mark: mark, element: CGRect(x: 0, y: 0, width: 1400, height: 900)))
        // a ring inside a small button does anchor to it
        XCTAssertTrue(MarkTrackMath.elementMatches(mark: CGRect(x: 50, y: 50, width: 20, height: 20), element: CGRect(x: 44, y: 46, width: 40, height: 28)))
        XCTAssertFalse(MarkTrackMath.elementMatches(mark: mark, element: CGRect(x: 600, y: 600, width: 50, height: 20)))
    }

    func testFollowKeepsTheOffsetFromTheElement() {
        let mark = CGRect(x: 110, y: 205, width: 100, height: 20)
        let moved = MarkTrackMath.follow(mark: mark, from: CGRect(x: 100, y: 200, width: 300, height: 40), to: CGRect(x: 100, y: 80, width: 300, height: 40))
        XCTAssertEqual(moved, CGRect(x: 110, y: 85, width: 100, height: 20))
        // a big reflow is not scaled into a tiny box
        let reflow = MarkTrackMath.follow(mark: mark, from: CGRect(x: 100, y: 200, width: 300, height: 40), to: CGRect(x: 100, y: 200, width: 150, height: 40))
        XCTAssertEqual(reflow.width, 100)
    }

    func testScrollPrediction() {
        let trackpad = MarkTrackMath.predictedTranslation(pointDeltaX: 0, pointDeltaY: -42, lineDeltaX: 0, lineDeltaY: -4, isContinuous: true)
        XCTAssertEqual(trackpad, CGVector(dx: 0, dy: -42))
        let wheel = MarkTrackMath.predictedTranslation(pointDeltaX: 0, pointDeltaY: 0, lineDeltaX: 0, lineDeltaY: 3, isContinuous: false)
        XCTAssertEqual(wheel, CGVector(dx: 0, dy: 48))
    }

    func testReconcilePrefersAConfidentPlausibleMeasurement() {
        let p = CGVector(dx: 0, dy: -40)
        XCTAssertEqual(MarkTrackMath.reconcile(predicted: p, measured: CGVector(dx: 0, dy: -61), confidence: 0.9), CGVector(dx: 0, dy: -61))
        XCTAssertEqual(MarkTrackMath.reconcile(predicted: p, measured: CGVector(dx: 0, dy: -61), confidence: 0.2), p)
        XCTAssertEqual(MarkTrackMath.reconcile(predicted: p, measured: CGVector(dx: 0, dy: 900), confidence: 0.95), p)
        XCTAssertEqual(MarkTrackMath.reconcile(predicted: p, measured: nil, confidence: 1), p)
    }

    func testVisibilityAndChevron() {
        let visible = CGRect(x: 0, y: 100, width: 800, height: 600)
        XCTAssertTrue(MarkTrackMath.visibility(of: CGRect(x: 100, y: 300, width: 200, height: 30), in: visible).visible)
        let gone = MarkTrackMath.visibility(of: CGRect(x: 100, y: 20, width: 200, height: 30), in: visible)
        XCTAssertFalse(gone.visible)
        XCTAssertEqual(gone.edge, .top)
        XCTAssertEqual(MarkTrackMath.visibility(of: CGRect(x: 100, y: 900, width: 200, height: 30), in: visible).edge, .bottom)
        // mostly cut off counts as gone
        XCTAssertFalse(MarkTrackMath.visibility(of: CGRect(x: 100, y: 70, width: 200, height: 40), in: visible, minFraction: 0.5).visible)
        let c = MarkTrackMath.chevron(for: CGRect(x: 100, y: 900, width: 200, height: 30), in: visible, edge: .bottom)
        XCTAssertEqual(c, CGPoint(x: 200, y: 674))
    }

    func testRegistrationRegionStaysInTheWindow() {
        let window = CGRect(x: 0, y: 0, width: 1000, height: 700)
        let r = MarkTrackMath.registrationRegion(for: CGRect(x: 10, y: 20, width: 60, height: 20), in: window)
        XCTAssertTrue(window.contains(r))
        XCTAssertGreaterThanOrEqual(r.width, 240)
        XCTAssertTrue(MarkTrackMath.registrationRegion(for: CGRect(x: 2000, y: 2000, width: 10, height: 10), in: window).isNull)
    }
}
