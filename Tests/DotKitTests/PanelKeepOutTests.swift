import XCTest
@testable import DotKit

final class PanelKeepOutTests: XCTestCase {
    /// A 1512 pt wide screen with the panel docked on the right, 480 pt wide, full height.
    let panel = CGRect(x: 1032, y: 0, width: 480, height: 940)

    func testOnThePanelMovesToItsLeftEdge() {
        let spot = PanelKeepOut.spot(CGPoint(x: 1200, y: 400), panel: panel, screenWidth: 1512, orbSize: 24)
        XCTAssertEqual(spot.y, 400)
        XCTAssertLessThan(spot.x + 12, panel.minX, "the orb's right edge stays off the panel")
    }

    func testOffThePanelStays() {
        let p = CGPoint(x: 600, y: 300)
        XCTAssertEqual(PanelKeepOut.spot(p, panel: panel, screenWidth: 1512, orbSize: 24), p)
    }

    func testJustBesideThePanelMovesClear() {
        let spot = PanelKeepOut.spot(CGPoint(x: 1028, y: 300), panel: panel, screenWidth: 1512, orbSize: 24)
        XCTAssertLessThan(spot.x + 12, panel.minX)
    }

    func testAPanelOnTheLeftHalfSendsDotToItsRight() {
        let leftPanel = CGRect(x: 0, y: 0, width: 480, height: 940)
        let spot = PanelKeepOut.spot(CGPoint(x: 200, y: 500), panel: leftPanel, screenWidth: 1512, orbSize: 24)
        XCTAssertGreaterThan(spot.x - 12, leftPanel.maxX)
    }
}
