import CoreGraphics
import XCTest
@testable import DotKit

final class SystemSurfacesTests: XCTestCase {
    let screen = CGSize(width: 1512, height: 982)
    func w(_ owner: String, _ layer: Int, _ x: CGFloat, _ y: CGFloat, _ width: CGFloat, _ height: CGFloat, alpha: Double = 1, name: String = "") -> SystemWindow {
        SystemWindow(owner: owner, name: name, layer: layer, frame: CGRect(x: x, y: y, width: width, height: height), alpha: alpha)
    }

    /// The M3's list on 2026-10-26 with the lid shut and the screen locked (Dot's own windows are left out by the
    /// caller, by pid): nothing is up.
    var lockedBaseline: [SystemWindow] {
        [w("Window Server", 2147483630, 1481, 3, 28, 28, name: "StatusIndicator"), w("Window Server", -2147483626, 0, 0, 1512, 982, name: "Display 1 Backstop"),
         w("Dock", -2147483624, 0, 0, 1512, 982, name: "Wallpaper-E0B0F63D"), w("Dock", -2147483622, 0, 0, 1512, 982, name: "Fullscreen Backdrop"),
         w("Control Center", -2147483625, 0, -98, 1920, 1080, name: "Screen Mirroring shield")]
    }

    /// An ordinary desktop: the menu bar and its status items, the Dock, desktop widgets, app windows, a banner.
    var desktop: [SystemWindow] {
        [w("Window Server", 24, 0, 0, 1512, 33, name: "Menubar"), w("Control Center", 25, 1300, 0, 34, 33, name: "WiFi"),
         w("Control Center", 25, 1340, 0, 50, 33, name: "Clock"), w("Spotlight", 25, 1260, 0, 34, 33, name: "Item-0"),
         w("Dock", 20, 300, 910, 912, 72, name: "Dock"), w("Notification Center", -2147483603, 40, 80, 344, 164, name: "Widgets"),
         w("Comet", 0, 0, 33, 1512, 900, name: "Lecture 7"), w("Notification Center", 23, 1158, 40, 344, 76, name: "Banner"),
         w("screencaptureui", 0, 0, 0, 1512, 982, alpha: 0)]
    }

    func testNothingUpOnAnOrdinaryScreen() {
        XCTAssertNil(SystemSurfaces.up(lockedBaseline, screen: screen))
        XCTAssertNil(SystemSurfaces.up(desktop, screen: screen), "status items, the Dock, widgets, a banner and a see-through window don't count")
    }

    func testEachSurface() {
        XCTAssertEqual(SystemSurfaces.up(desktop + [w("Spotlight", 23, 456, 180, 600, 60)], screen: screen), .spotlight)
        XCTAssertEqual(SystemSurfaces.up(desktop + [w("Control Center", 25, 1180, 38, 320, 420)], screen: screen), .controlCenter)
        XCTAssertEqual(SystemSurfaces.up(desktop + [w("Notification Center", 23, 1150, 0, 362, 982)], screen: screen), .notificationCenter)
        XCTAssertEqual(SystemSurfaces.up(desktop + [w("screencaptureui", 25, 456, 860, 600, 56)], screen: screen), .screenshot, "the Cmd-Shift-5 bar")
        XCTAssertEqual(SystemSurfaces.up(desktop + [w("Dock", 20, 0, 0, 1512, 982, name: "Mission Control")], screen: screen), .missionControl)
    }

    func testFromAWindowListEntry() {
        let entry: [String: Any] = ["kCGWindowOwnerName": "Spotlight", "kCGWindowLayer": NSNumber(value: 23), "kCGWindowAlpha": NSNumber(value: 1.0),
                                    "kCGWindowBounds": ["X": NSNumber(value: 456), "Y": NSNumber(value: 180), "Width": NSNumber(value: 600), "Height": NSNumber(value: 60)]]
        let window = SystemWindow(entry)
        XCTAssertEqual(window, w("Spotlight", 23, 456, 180, 600, 60))
        XCTAssertNil(SystemWindow(["kCGWindowLayer": NSNumber(value: 0)]))
        XCTAssertEqual(SystemWindow(entry.merging(["kCGWindowNumber": NSNumber(value: 338156)]) { $1 })?.number, 338156)
    }
}

final class SurfaceClockTests: XCTestCase {
    let screen = CGSize(width: 1512, height: 982)
    let t0 = Date(timeIntervalSince1970: 1_793_000_000)
    func at(_ seconds: TimeInterval) -> Date { t0.addingTimeInterval(seconds) }
    let cmux = "com.cmuxterm.app", comet = "ai.perplexity.comet"

    /// The M3's list on 2026-11-01 20:32 (`Dot --surfaces`): the screenshot tool's full-screen window, left on screen
    /// since 10/30 10:10 with nothing open, over the menu bar and his cmux window.
    var stuckScreenshot: SystemWindow {
        SystemWindow(owner: "Screenshot", layer: 24, frame: CGRect(x: 0, y: 0, width: 1512, height: 982), number: 338156)
    }
    var desk: [SystemWindow] {
        [SystemWindow(owner: "Window Server", name: "Menubar", layer: 24, frame: CGRect(x: 0, y: 0, width: 1512, height: 33)),
         SystemWindow(owner: "Control Center", name: "Clock", layer: 25, frame: CGRect(x: 1369, y: 0, width: 145, height: 33)),
         SystemWindow(owner: "cmux", layer: 0, frame: CGRect(x: 0, y: 33, width: 1512, height: 949), number: 120)]
    }
    /// Notification Center open on the same evening, after the stuck window was gone.
    var notificationCenter: SystemWindow {
        SystemWindow(owner: "Notification Center", name: "Notification Center", layer: 21, frame: CGRect(x: 0, y: 0, width: 1512, height: 982), number: 347300)
    }
    var controlCenter: SystemWindow {
        SystemWindow(owner: "Control Center", layer: 25, frame: CGRect(x: 1180, y: 38, width: 320, height: 420), number: 400)
    }

    func testASurfaceHeIsUsingKeepsDotAside() {
        var clock = SurfaceClock()
        let list = [notificationCenter] + desk
        XCTAssertEqual(clock.read(list, screens: [screen], front: cmux, now: at(0)).up, .notificationCenter)
        let reading = clock.read(list, screens: [screen], front: cmux, now: at(5 * 60))
        XCTAssertEqual(reading.up, .notificationCenter, "five minutes reading Notification Center, still in the same app")
        XCTAssertTrue(reading.nowStuck.isEmpty)
        XCTAssertEqual(clock.read(list, screens: [screen], front: nil, now: at(5 * 60 + 10)).up, .notificationCenter,
                       "an agent or Dot in front is not another app")
    }

    func testAWindowThatOutlivesAnAppSwitchIsStuck() {
        var clock = SurfaceClock()
        let list = [stuckScreenshot] + desk
        _ = clock.read(list, screens: [screen], front: cmux, now: at(0))
        XCTAssertEqual(clock.read(list, screens: [screen], front: comet, now: at(30)).up, .screenshot, "the switch itself")
        XCTAssertEqual(clock.read(list, screens: [screen], front: comet, now: at(32)).up, .screenshot,
                       "Mission Control and Spotlight fade out as the app they bring forward comes up")
        let stuck = clock.read(list, screens: [screen], front: comet, now: at(30 + SurfaceClock.afterSwitch))
        XCTAssertNil(stuck.up, "still there 3 s after he moved to Comet: Dot comes back")
        XCTAssertEqual(stuck.nowStuck.map(\.surface), [.screenshot])
        XCTAssertEqual(stuck.nowStuck.map(\.why), [.otherApp])
        let later = clock.read(list, screens: [screen], front: cmux, now: at(58 * 3600))
        XCTAssertNil(later.up, "and stays back while the window stays")
        XCTAssertTrue(later.nowStuck.isEmpty, "logged once")
    }

    func testTheFirstAppSeenCountsWhenNoneWasInFront() {
        var clock = SurfaceClock()
        let list = [stuckScreenshot] + desk
        _ = clock.read(list, screens: [screen], front: nil, now: at(0))
        _ = clock.read(list, screens: [screen], front: cmux, now: at(1))
        XCTAssertEqual(clock.read(list, screens: [screen], front: cmux, now: at(20)).up, .screenshot, "back to the app it opened over")
        _ = clock.read(list, screens: [screen], front: comet, now: at(21))
        XCTAssertNil(clock.read(list, screens: [screen], front: comet, now: at(25)).up)
    }

    func testTheBackstopWhileHeStaysInOneApp() {
        var clock = SurfaceClock()
        let list = [stuckScreenshot] + desk
        _ = clock.read(list, screens: [screen], front: cmux, now: at(0))
        XCTAssertEqual(clock.read(list, screens: [screen], front: cmux, now: at(SurfaceClock.stuckAfter - 1)).up, .screenshot)
        let stuck = clock.read(list, screens: [screen], front: cmux, now: at(SurfaceClock.stuckAfter))
        XCTAssertNil(stuck.up)
        XCTAssertEqual(stuck.nowStuck.map(\.why), [.tooLong])
    }

    func testARealSurfaceOverAStuckOneStillCounts() {
        var clock = SurfaceClock()
        _ = clock.read([stuckScreenshot] + desk, screens: [screen], front: cmux, now: at(0))
        _ = clock.read([stuckScreenshot] + desk, screens: [screen], front: comet, now: at(10))
        XCTAssertNil(clock.read([stuckScreenshot] + desk, screens: [screen], front: comet, now: at(20)).up)
        XCTAssertEqual(clock.read([controlCenter, stuckScreenshot] + desk, screens: [screen], front: comet, now: at(30)).up, .controlCenter)
        XCTAssertEqual(clock.read([stuckScreenshot, controlCenter] + desk, screens: [screen], front: comet, now: at(31)).up, .controlCenter,
                       "under the stuck window too")
        XCTAssertNil(clock.read([stuckScreenshot] + desk, screens: [screen], front: comet, now: at(32)).up, "Control Center closed")
        var fresh = stuckScreenshot
        fresh.number = 338900
        XCTAssertEqual(clock.read([fresh, stuckScreenshot] + desk, screens: [screen], front: comet, now: at(40)).up, .screenshot,
                       "a new screenshot window is a new screenshot")
    }

    func testAMovedOrReturningWindowStartsOver() {
        var clock = SurfaceClock()
        _ = clock.read([stuckScreenshot] + desk, screens: [screen], front: cmux, now: at(0))
        _ = clock.read([stuckScreenshot] + desk, screens: [screen], front: comet, now: at(10))
        var moved = stuckScreenshot
        moved.frame = CGRect(x: 456, y: 860, width: 600, height: 56)
        XCTAssertEqual(clock.read([moved] + desk, screens: [screen], front: comet, now: at(20)).up, .screenshot,
                       "the same window as the Cmd-Shift-5 bar is in use")
        _ = clock.read(desk, screens: [screen], front: comet, now: at(30))
        XCTAssertEqual(clock.read([moved] + desk, screens: [screen], front: comet, now: at(SurfaceClock.stuckAfter + 40)).up, .screenshot,
                       "gone and back: counted from its return")
    }

    func testEveryScreenIsRead() {
        var clock = SurfaceClock()
        let mission = SystemWindow(owner: "Dock", name: "Mission Control", layer: 20, frame: CGRect(x: 0, y: 0, width: 1920, height: 1080), number: 7)
        XCTAssertEqual(clock.read([mission], screens: [screen, CGSize(width: 1920, height: 1080)], front: cmux, now: at(0)).up, .missionControl)
        XCTAssertNil(clock.read([], screens: [screen], front: cmux, now: at(1)).up)
    }
}
