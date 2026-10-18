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

    func testRailsKeepAGestureToItsAxisThroughMomentum() {
        var rails = ScrollRails()
        // A trackpad stroke up a page drifts sideways a little; the page moves only vertically.
        XCTAssertEqual(rails.rail(CGVector(dx: 1, dy: 4), at: 0, began: true, isMomentum: false), CGVector(dx: 0, dy: 4))
        XCTAssertEqual(rails.axis, .vertical)
        XCTAssertEqual(rails.rail(CGVector(dx: 22, dy: 30), at: 0.016, began: false, isMomentum: false), CGVector(dx: 0, dy: 30))
        XCTAssertEqual(rails.rail(CGVector(dx: 30, dy: 10), at: 0.4, began: false, isMomentum: true), CGVector(dx: 0, dy: 10), "momentum keeps the axis")
        // A new sideways gesture.
        XCTAssertEqual(rails.rail(CGVector(dx: -8, dy: 1), at: 2, began: true, isMomentum: false), CGVector(dx: -8, dy: 0))
        XCTAssertEqual(rails.axis, .horizontal)
        // A pause also starts a new gesture (wheels have no phases).
        XCTAssertEqual(rails.rail(CGVector(dx: 0, dy: 48), at: 5, began: false, isMomentum: false), CGVector(dx: 0, dy: 48))
        XCTAssertEqual(rails.axis, .vertical)
    }

    func testAShyMeasurementCloseToThePredictionWins() {
        let p = CGVector(dx: 0, dy: -41)
        XCTAssertEqual(MarkTrackMath.reconcile(predicted: p, measured: CGVector(dx: 0, dy: -55), confidence: 0.19), CGVector(dx: 0, dy: -55))
        // A flick past the captured region measures nonsense with the same low confidence: far off, so the prediction stays.
        XCTAssertEqual(MarkTrackMath.reconcile(predicted: CGVector(dx: 0, dy: -302), measured: CGVector(dx: 106, dy: 198), confidence: 0.14),
                       CGVector(dx: 0, dy: -302))
        XCTAssertEqual(MarkTrackMath.reconcile(predicted: CGVector(dx: 0, dy: 124), measured: CGVector(dx: -124, dy: 124), confidence: 0.12),
                       CGVector(dx: 0, dy: 124))
        XCTAssertEqual(MarkTrackMath.reconcile(predicted: p, measured: CGVector(dx: 0, dy: -45), confidence: 0.01), p, "too shy")
    }

    /// The scroll that walked the box off the equation (Dot's log, 2026-10-17 20:04:41-53): each row is the
    /// registration (dx, dy, confidence) and the prediction (dx, dy) for the same interval. Before, the
    /// prediction won every time (confidence never reached 0.5), and its sideways part added up to 120 points.
    func testTheChatGPTScrollNoLongerDriftsSideways() {
        let rows: [(Double, Double, Double, Double, Double)] = [
            (0, -55, 0.19, -17, -41), (0, -27, 0.27, -28, -41), (0, -37, 0.29, -12, -33), (0, -66, 0.22, -17, -66), (0, -24, 0.21, -19, -28),
            (0, -14, 0.23, -9, -14), (0, -43, 0.19, -13, -39), (0, -29, 0.14, -21, -32), (0, 27, 0.09, -2, 19), (0, 55, 0.11, -4, 57),
            (0, 84, 0.17, 21, 84), (0, 58, 0.23, 22, 64), (0, 68, 0.20, 22, 65), (0, 49, 0.36, 19, 46), (0, -203, 0.34, -21, -186),
            (0, -117, 0.30, -18, -135), (106, 198, 0.14, -3, -302), (-4, -81, 0.18, 0, -497), (0, 187, 0.37, 25, 251), (-8, 143, 0.17, 0, 488),
            (0, 70, 0.15, 19, 64), (-124, 124, 0.12, 0, 124), (0, -39, 0.20, -16, -37), (0, -41, 0.33, -20, -43), (0, 69, 0.22, 22, 58),
        ]
        var before = CGVector.zero, after = CGVector.zero
        for (mx, my, conf, px, py) in rows {
            let old = MarkTrackMath.reconcile(predicted: CGVector(dx: px, dy: py), measured: CGVector(dx: mx, dy: my), confidence: conf,
                                              agreeing: 1)   // the old rule: nothing under 0.5
            before.dx += old.dx
            // Now: the prediction is railed to the vertical gesture, and a close measurement refines it.
            let now = MarkTrackMath.reconcile(predicted: CGVector(dx: 0, dy: py), measured: CGVector(dx: mx, dy: my), confidence: conf)
            after.dx += now.dx
            after.dy += now.dy
        }
        XCTAssertGreaterThan(abs(before.dx), 60, "the old drift")
        XCTAssertEqual(after.dx, 0, "no sideways drift")
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
