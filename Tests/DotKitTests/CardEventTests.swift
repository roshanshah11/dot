import XCTest
@testable import DotKit

final class CardEventTests: XCTestCase {
    func body(_ kind: String, _ data: [String: Any]) -> [String: Any] {
        ["type": "event", "kind": kind, "data": data, "card": "what the page claims"]
    }

    func testDragOfANamedPoint() throws {
        let event = try XCTUnwrap(CardEvent.parse(body("drag", ["figure": "eigen", "point": "eigenvector", "x": 2.0, "y": 1.0]), card: "c1"))
        XCTAssertEqual(event.card, "c1", "the relay's id, not the page's")
        XCTAssertEqual(event.kind, "drag")
        XCTAssertEqual(event.subject, "eigenvector")
        XCTAssertEqual(event.summary, "he dragged the eigenvector to (2, 1)")
        let short = try XCTUnwrap(CardEvent.parse(body("drag", ["point": "A", "x": -1.5, "y": 0.004]), card: "c1"))
        XCTAssertEqual(short.summary, "he dragged point A to (-1.5, 0)")
    }

    func testSliderWithAResult() throws {
        let event = try XCTUnwrap(CardEvent.parse(body("slider", [
            "figure": "Northwind DCF", "name": "WACC", "value": 9.3, "unit": "%",
            "result": ["label": "implied share price", "value": 41.07, "text": "$41.07"],
        ]), card: "c2"))
        XCTAssertEqual(event.summary, "he set WACC to 9.3%; implied share price $41.07")
        let plain = try XCTUnwrap(CardEvent.parse(body("slider", ["name": "k", "value": 3]), card: "c2"))
        XCTAssertEqual(plain.summary, "he set k to 3")
        let money = try XCTUnwrap(CardEvent.parse(body("slider", ["name": "price", "value": 12.5, "unit": "$"]), card: "c2"))
        XCTAssertEqual(money.summary, "he set price to $12.5")
    }

    func testTapAndOtherKinds() throws {
        let tap = try XCTUnwrap(CardEvent.parse(body("tap", ["part": "mito", "label": " mitochondria \n"]), card: "c3"))
        XCTAssertEqual(tap.summary, "he tapped the mitochondria")
        XCTAssertEqual(CardEvent.parse(body("tap", ["part": "nucleus"]), card: "c3")?.summary, "he tapped the nucleus")
        let other = try XCTUnwrap(CardEvent.parse(body("Flip", ["side": "back", "open": true]), card: "c3"))
        XCTAssertEqual(other.kind, "flip")
        XCTAssertEqual(other.summary, "he used the card (flip): open yes, side back")
        XCTAssertEqual(CardEvent.parse(["type": "event", "kind": "drag"], card: "c3")?.summary, "he dragged a point")
    }

    func testNotAnEvent() {
        XCTAssertNil(CardEvent.parse(["type": "nav", "action": "next"], card: "c"))
        XCTAssertNil(CardEvent.parse("error: boom", card: "c"))
        XCTAssertNil(CardEvent.parse(["type": "event"], card: "c"))
        XCTAssertNil(CardEvent.parse(["type": "event", "kind": "rm -rf"], card: "c"))
        XCTAssertNil(CardEvent.parse(["type": "event", "kind": String(repeating: "a", count: 30)], card: "c"))
        XCTAssertNil(CardEvent.parse(["type": "event", "kind": "drag", "data": [1, 2]], card: "c"))
    }

    func testValuesAreCutToSize() throws {
        let long = String(repeating: "x", count: 500)
        let deep: [String: Any] = ["a": ["b": ["c": ["d": 1]]]]
        var many: [String: Any] = [:]
        for i in 0..<40 { many["k\(i)"] = i }
        let event = try XCTUnwrap(CardEvent.parse(body("note", ["text": long, "deep": deep, "many": many, "flag": false, "nan": Double.nan]), card: "c"))
        XCTAssertEqual(event.data["text"]?.textValue?.count, 120)
        XCTAssertEqual(event.data["flag"], .bool(false))
        XCTAssertEqual(event.data["nan"], .null)
        XCTAssertEqual(event.data["many"]?.objectValue?.count, 16)
        // Three levels of groups: data, "deep", "a"; "b" would be a fourth and is dropped.
        XCTAssertEqual(event.data["deep"], .object(["a": .object([:])]))
    }

    func testNumbersReadTheWayHeWouldSayThem() {
        XCTAssertEqual(CardEvent.number(2), "2")
        XCTAssertEqual(CardEvent.number(1.5), "1.5")
        XCTAssertEqual(CardEvent.number(-0.001), "0")
        XCTAssertEqual(CardEvent.number(3.14159), "3.14")
        XCTAssertEqual(CardEvent.number(-12.30), "-12.3")
    }

    func testCoalesceKeepsTheLatestPerThing() {
        let a1 = CardEvent(card: "c", kind: "drag", data: ["point": .text("A"), "x": .number(1)])
        let b1 = CardEvent(card: "c", kind: "drag", data: ["point": .text("B"), "x": .number(1)])
        let a2 = CardEvent(card: "c", kind: "drag", data: ["point": .text("A"), "x": .number(2)])
        let other = CardEvent(card: "d", kind: "drag", data: ["point": .text("A"), "x": .number(5)])
        XCTAssertEqual(CardEvent.coalesce([a1, b1, a2, other]), [b1, a2, other])
        XCTAssertEqual(CardEvent.coalesce([]), [])
    }

    func testFilterDropsRepeatsAndARunawayCard() {
        var filter = CardEventFilter(minimumGap: 0.5)
        let t0 = Date(timeIntervalSince1970: 1000)
        let a1 = CardEvent(card: "c", kind: "slider", data: ["name": .text("k"), "value": .number(1)])
        let a2 = CardEvent(card: "c", kind: "slider", data: ["name": .text("k"), "value": .number(2)])
        XCTAssertTrue(filter.admit(a1, at: t0))
        XCTAssertFalse(filter.admit(a1, at: t0.addingTimeInterval(5)), "the same value again says nothing new")
        XCTAssertFalse(filter.admit(a2, at: t0.addingTimeInterval(0.2)), "too soon after the last")
        XCTAssertTrue(filter.admit(a2, at: t0.addingTimeInterval(1.6)))
        XCTAssertTrue(filter.admit(a1, at: t0.addingTimeInterval(3.2)), "back to the first value is a change")
        let elsewhere = CardEvent(card: "d", kind: "slider", data: ["name": .text("k"), "value": .number(1)])
        XCTAssertTrue(filter.admit(elsewhere, at: t0.addingTimeInterval(3.3)), "another card has its own clock")
    }
}
