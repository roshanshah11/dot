import XCTest
@testable import DotKit

final class PermissionGuideTests: XCTestCase {
    func testProbeResults() {
        XCTAssertEqual(PermissionGuide.av(3), .granted)
        XCTAssertEqual(PermissionGuide.av(0), .notAsked)
        XCTAssertEqual(PermissionGuide.av(2), .missing)
        XCTAssertEqual(PermissionGuide.calendar(4), .partial)
        XCTAssertEqual(PermissionGuide.automation(0), .granted)
        XCTAssertEqual(PermissionGuide.automation(-1743), .missing)
        XCTAssertEqual(PermissionGuide.automation(-1744), .notAsked)
        XCTAssertEqual(PermissionGuide.automation(-600), .unknown, "the app isn't running")
        XCTAssertEqual(PermissionGuide.fullDisk(errno: 0), .granted)
        XCTAssertEqual(PermissionGuide.fullDisk(errno: EPERM), .missing)
        XCTAssertEqual(PermissionGuide.fullDisk(errno: ENOENT), .unknown)
    }

    func testRows() {
        let rows = PermissionGuide.rows(["microphone": "granted", "screen": "missing", "accessibility": "granted", "calendar": "partial",
                                         "fullDisk": "missing", "automation:com.apple.systemevents": "notAsked"])
        XCTAssertEqual(rows.map(\.id).prefix(6), ["microphone", "screen", "accessibility", "calendar", "fullDisk", "files"])
        XCTAssertFalse(rows.contains { $0.title.contains("Speech") }, "no Speech Recognition row: Parakeet is local")
        XCTAssertEqual(rows.first { $0.id == "files" }?.state, .unknown, "no probe without FDA: check manually")
        XCTAssertEqual(rows.first { $0.id == "automation:com.spotify.client" }?.state, .unknown, "no report: unknown, not granted")
        XCTAssertTrue(rows.first { $0.id == "screen" }?.drag == true)
        let withDisk = PermissionGuide.rows(["fullDisk": "granted"])
        XCTAssertEqual(withDisk.first { $0.id == "files" }?.state, .granted)
        let holder = PermissionHolder(id: "dot", name: "Dot", runs: "talk", executable: "/x", rows: rows)
        XCTAssertEqual(holder.missing.map(\.id), ["screen", "fullDisk", "automation:com.apple.systemevents"])
    }

    func testCuaDriver() {
        let json: [String: Any] = ["accessibility": true, "screen_recording": false, "source": ["bundle_id": "com.trycua.driver"]]
        XCTAssertEqual(PermissionGuide.cuaRows(json).map(\.state), [.granted, .missing])
        XCTAssertEqual(PermissionGuide.cuaRows(nil).map(\.state), [.unknown, .unknown], "no daemon: unknown, never the terminal's grants")
    }

    func testCaptureHealth() {
        let busy = (0..<64).map { UInt8($0 * 3) }
        XCTAssertEqual(CaptureHealth.verdict(preflight: true, errorCode: nil, shareableWindows: 6, listedWindows: 6, luma: busy), .ok)
        XCTAssertEqual(CaptureHealth.verdict(preflight: false, errorCode: nil, shareableWindows: 0, listedWindows: 6, luma: []), .denied)
        XCTAssertEqual(CaptureHealth.verdict(preflight: true, errorCode: -3801, shareableWindows: 0, listedWindows: 6, luma: []), .denied)
        XCTAssertEqual(CaptureHealth.verdict(preflight: true, errorCode: nil, shareableWindows: 0, listedWindows: 5, luma: busy), .blank,
                       "the wallpaper alone: the grant is stale")
        XCTAssertEqual(CaptureHealth.verdict(preflight: true, errorCode: nil, shareableWindows: 4, listedWindows: 4, luma: Array(repeating: 0, count: 64)), .blank)
        XCTAssertEqual(CaptureHealth.verdict(preflight: true, errorCode: nil, shareableWindows: 1, listedWindows: 1, luma: Array(repeating: 30, count: 64)), .ok,
                       "a dark full-screen terminal is not a broken grant")
        XCTAssertEqual(CaptureHealth.verdict(preflight: true, errorCode: nil, shareableWindows: 0, listedWindows: 0, luma: busy), .ok, "an empty desktop is fine")
        XCTAssertEqual(CaptureHealth.verdict(preflight: true, errorCode: 2, shareableWindows: 0, listedWindows: 3, luma: []), .ok, "other errors are not the grant")
    }
}
