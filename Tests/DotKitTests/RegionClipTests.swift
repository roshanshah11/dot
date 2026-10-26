import XCTest
@testable import DotKit

final class RegionClipTests: XCTestCase {
    let png = Data([0x89, 0x50, 0x4E, 0x47, 1, 2, 3])

    func testPayloadCarriesImageHtmlAndNote() {
        let items = RegionClip.payload(png: png, note: "  why is this <b>negative</b> & not zero?\nsee row 3 ")
        XCTAssertEqual(items.map(\.type), [RegionClip.pngType, RegionClip.htmlType, RegionClip.textType])
        XCTAssertEqual(items[0].data, png)
        let html = String(decoding: items[1].data, as: UTF8.self)
        XCTAssertTrue(html.contains("<p>why is this &lt;b&gt;negative&lt;/b&gt; &amp; not zero?<br>see row 3</p>"), html)
        XCTAssertTrue(html.contains("data:image/png;base64,\(png.base64EncodedString())"))
        XCTAssertLessThan(html.range(of: "<p>")!.lowerBound, html.range(of: "<img")!.lowerBound, "the note reads above the image")
        XCTAssertEqual(String(decoding: items[2].data, as: UTF8.self), "why is this <b>negative</b> & not zero?\nsee row 3")
    }

    func testNoNoteMeansNoText() {
        let items = RegionClip.payload(png: png, note: " \n ")
        XCTAssertEqual(items.map(\.type), [RegionClip.pngType, RegionClip.htmlType], "a plain field gets nothing rather than a blank")
        XCTAssertFalse(String(decoding: items[1].data, as: UTF8.self).contains("<p>"))
    }

    let target = PasteTarget(appName: "Cursor", bundleID: "com.todesktop.230313mzl4w4u92", pid: 812, windowID: 4410, role: "AXTextArea")

    func testOffers() {
        XCTAssertTrue(PasteCheck.offers(target, ownBundleID: "com.roshan.dot"))
        XCTAssertFalse(PasteCheck.offers(nil, ownBundleID: "com.roshan.dot"))
        XCTAssertFalse(PasteCheck.offers(PasteTarget(appName: "Dot", bundleID: "com.roshan.dot", pid: 1, windowID: nil, role: "AXTextField"), ownBundleID: "com.roshan.dot"))
        XCTAssertFalse(PasteCheck.offers(PasteTarget(appName: "Safari", bundleID: "com.apple.Safari", pid: 2, windowID: 9, role: "AXSecureTextField"), ownBundleID: "x"),
                       "never a password field")
        XCTAssertFalse(PasteCheck.offers(PasteTarget(appName: "Finder", bundleID: "com.apple.finder", pid: 3, windowID: nil, role: ""), ownBundleID: "x"),
                       "nothing focused, nothing to paste into")
    }

    func testRevalidation() {
        let same = PasteState(bundleID: target.bundleID, windowIDs: [12, 4410], elementAlive: true, role: "AXTextArea")
        XCTAssertNil(PasteCheck.refusal(target, same))
        XCTAssertNotNil(PasteCheck.refusal(target, PasteState(bundleID: nil, windowIDs: [], elementAlive: false, role: nil)), "quit")
        XCTAssertNotNil(PasteCheck.refusal(target, PasteState(bundleID: "com.apple.Terminal", windowIDs: [4410], elementAlive: true, role: "AXTextArea")),
                        "the pid now belongs to another app")
        XCTAssertEqual(PasteCheck.refusal(target, PasteState(bundleID: target.bundleID, windowIDs: [12], elementAlive: true, role: "AXTextArea")),
                       "that Cursor window closed")
        XCTAssertEqual(PasteCheck.refusal(target, PasteState(bundleID: target.bundleID, windowIDs: [4410], elementAlive: false, role: nil)),
                       "the field you were in isn't there any more")
        XCTAssertEqual(PasteCheck.refusal(target, PasteState(bundleID: target.bundleID, windowIDs: [4410], elementAlive: true, role: PasteCheck.secureRole)),
                       "that's a password field", "a field that turned into a password field is refused too")
    }

    func testLastGate() {
        XCTAssertTrue(PasteCheck.focusLanded(frontPid: 812, targetPid: 812, capturedFocused: true, dotHasKeyWindow: false))
        XCTAssertFalse(PasteCheck.focusLanded(frontPid: 99, targetPid: 812, capturedFocused: true, dotHasKeyWindow: false), "another app in front")
        XCTAssertFalse(PasteCheck.focusLanded(frontPid: 812, targetPid: 812, capturedFocused: false, dotHasKeyWindow: false), "focus moved to another field")
        XCTAssertFalse(PasteCheck.focusLanded(frontPid: 812, targetPid: 812, capturedFocused: true, dotHasKeyWindow: true), "Dot's note field still has the keys")
        XCTAssertFalse(PasteCheck.focusLanded(frontPid: nil, targetPid: 812, capturedFocused: true, dotHasKeyWindow: false))
    }
}
