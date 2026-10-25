import XCTest
@testable import DotKit

/// A window on the iMac display is never hidden from capture (2026-10-24: an unseen explainer panel took his clicks).
final class CaptureSharingTests: XCTestCase {
    // the MacBook at the origin and the iMac to its left, in AppKit's coordinates, as on his desk
    let macBook = CGRect(x: 0, y: 0, width: 1512, height: 982)
    let iMac = CGRect(x: -1920, y: -42, width: 1920, height: 1080)
    var displays: [CGRect] { [macBook, iMac] }

    func shown(_ frame: CGRect, recordings: Bool, follows: Bool = true) -> Bool? {
        CaptureSharing.verdict(frame: frame, displays: displays, streamed: [iMac], visibleInRecordings: recordings, follows: follows)?.shown
    }

    func testOnTheIMacAlwaysShown() {
        let panel = CGRect(x: -1162, y: 10, width: 1152, height: 1030)   // the one that sat over Spotify
        XCTAssertEqual(shown(panel, recordings: false), true)
        XCTAssertEqual(CaptureSharing.verdict(frame: panel, displays: displays, streamed: [iMac], visibleInRecordings: false, follows: true), .streamed)
        XCTAssertEqual(shown(panel, recordings: false, follows: false), true, "even a window that never follows the setting")
        XCTAssertEqual(shown(CGRect(x: -40, y: 100, width: 400, height: 300), recordings: false), true, "a window across the seam is shown")
    }

    func testElsewhereFollowsTheSetting() {
        let card = CGRect(x: 900, y: 200, width: 440, height: 400)
        XCTAssertEqual(shown(card, recordings: false), false)
        XCTAssertEqual(shown(card, recordings: true), true)
        XCTAssertNil(shown(card, recordings: false, follows: false), "a window that does not follow it is its owner's call")
    }

    func testOffEveryDisplayIsLeftAlone() {
        let print = CGRect(x: -20_000, y: -20_000, width: 816, height: 1056)
        XCTAssertNil(shown(print, recordings: false))
        XCTAssertNil(shown(print, recordings: true))
    }

    func testTouchingTheIMacsEdgeIsNotOnIt() {
        XCTAssertEqual(shown(CGRect(x: 0, y: 100, width: 300, height: 300), recordings: false), false)
    }

    func testTheIMacIsKnownByItsNumbers() {
        XCTAssertTrue(CaptureSharing.isStreamed(vendor: 0x610, model: 0x2014, serial: 0x1404))
        XCTAssertFalse(CaptureSharing.isStreamed(vendor: 0x610, model: 0xa059, serial: 0xfd626d62), "the MacBook's own screen")
    }
}
