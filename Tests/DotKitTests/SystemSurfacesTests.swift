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
    }
}

final class FocusSignalTests: XCTestCase {
    func item(_ name: String, y: CGFloat = 0, h: CGFloat = 33, owner: String = "Control Center", alpha: Double = 1) -> SystemWindow {
        SystemWindow(owner: owner, name: name, layer: 25, frame: CGRect(x: 1220, y: y, width: 34, height: h), alpha: alpha)
    }

    func testTheMenuBarFocusItem() {
        let bar = [item("Clock"), item("WiFi"), item("BentoBox-0"), item("Battery")]
        XCTAssertFalse(FocusSignal.isOn(bar), "his usual menu bar (the always-shown items, 2026-10-26)")
        XCTAssertTrue(FocusSignal.isOn(bar + [item("FocusModes")]))
        XCTAssertFalse(FocusSignal.isOn(bar + [item("FocusModes", alpha: 0)]), "a see-through item is not up")
        XCTAssertFalse(FocusSignal.isOn(bar + [item("FocusModes", y: 300, h: 400)]), "Control Center's Focus panel is not the menu bar item")
        XCTAssertFalse(FocusSignal.isOn(bar + [item("FocusModes", owner: "Comet")]))
    }
}
