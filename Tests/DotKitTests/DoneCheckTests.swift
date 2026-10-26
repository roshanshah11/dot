import XCTest
@testable import DotKit

final class DoneCheckTests: XCTestCase {
    func testParse() {
        XCTAssertEqual(DoneCheck.parse(#"check: text "Saved""#), DoneCheck(kind: .text, target: "Saved"))
        XCTAssertEqual(DoneCheck.parse("check: text Your changes were saved"), DoneCheck(kind: .text, target: "Your changes were saved"))
        XCTAssertEqual(DoneCheck.parse(#"CHECK: gone "Unsaved changes""#), DoneCheck(kind: .gone, target: "Unsaved changes"))
        XCTAssertEqual(DoneCheck.parse("check: url /confirmation"), DoneCheck(kind: .url, target: "/confirmation"))
        XCTAssertEqual(DoneCheck.parse(#"check: element "Email alerts" on"#), DoneCheck(kind: .element, target: "Email alerts", state: "on"))
        XCTAssertEqual(DoneCheck.parse("check: element Night Shift off"), DoneCheck(kind: .element, target: "Night Shift", state: "off"))
        XCTAssertEqual(DoneCheck.parse("check: element Submit"), DoneCheck(kind: .element, target: "Submit", state: "exists"))
        XCTAssertEqual(DoneCheck.parse("check: file ~/Desktop/Deck.pptx"), DoneCheck(kind: .file, target: "~/Desktop/Deck.pptx"))
        XCTAssertNil(DoneCheck.parse("check: vibes good"))
        XCTAssertNil(DoneCheck.parse(#"check: element "Wifi" sideways"#))
        XCTAssertNil(DoneCheck.parse("checked the page"))
        let (checks, rest) = DoneCheck.split("alerts are on.\ncheck: element \"Email alerts\" on\nsaved: /x -> desktop")
        XCTAssertEqual(checks.count, 1)
        XCTAssertEqual(rest, "alerts are on.\nsaved: /x -> desktop")
    }

    func testVerify() {
        let seen = DoneCheck.Seen(url: "http://127.0.0.1:8766/settings.html?saved=1", text: "Settings\nYour changes were  saved.",
                                  element: { ["Email alerts": .init(on: true), "Submit": .init(on: nil, enabled: false)][$0] },
                                  fileSize: { ["/tmp/a.pptx": 2048, "/tmp/empty.txt": 0][$0] })
        XCTAssertTrue(DoneCheck(kind: .text, target: "your changes were saved").verify(seen).passed, "case and spaces aside")
        XCTAssertFalse(DoneCheck(kind: .text, target: "Order placed").verify(seen).passed)
        XCTAssertEqual(DoneCheck(kind: .text, target: "Order placed").verify(seen).saw, "\"Order placed\" isn't on the page")
        XCTAssertTrue(DoneCheck(kind: .gone, target: "Unsaved changes").verify(seen).passed)
        XCTAssertTrue(DoneCheck(kind: .url, target: "saved=1").verify(seen).passed)
        XCTAssertTrue(DoneCheck(kind: .url, target: "*/settings.html*").verify(seen).passed)
        XCTAssertFalse(DoneCheck(kind: .url, target: "/confirmation").verify(seen).passed)
        XCTAssertTrue(DoneCheck(kind: .element, target: "Email alerts", state: "on").verify(seen).passed)
        XCTAssertFalse(DoneCheck(kind: .element, target: "Email alerts", state: "off").verify(seen).passed)
        XCTAssertTrue(DoneCheck(kind: .element, target: "Submit", state: "disabled").verify(seen).passed)
        XCTAssertTrue(DoneCheck(kind: .element, target: "Spinner", state: "gone").verify(seen).passed)
        XCTAssertFalse(DoneCheck(kind: .element, target: "Spinner", state: "on").verify(seen).passed)
        XCTAssertTrue(DoneCheck(kind: .file, target: "/tmp/a.pptx").verify(seen).passed)
        XCTAssertEqual(DoneCheck(kind: .file, target: "/tmp/empty.txt").verify(seen).saw, "/tmp/empty.txt is empty")
        XCTAssertEqual(DoneCheck(kind: .file, target: "/tmp/none").verify(seen).saw, "/tmp/none doesn't exist")
    }
}
