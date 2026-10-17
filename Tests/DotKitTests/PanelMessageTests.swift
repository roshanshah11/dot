import XCTest
@testable import DotKit

final class PanelMessageTests: XCTestCase {
    func testParsesThePagesMessages() {
        XCTAssertEqual(PanelMessage(["type": "quiz", "panel": "kernel", "id": "k1", "choice": "B", "correct": true]),
                       .quiz(panel: "kernel", id: "k1", choice: "B", correct: true))
        XCTAssertEqual(PanelMessage(["type": "quiz", "panel": "p", "id": "q", "choice": "A"]), .quiz(panel: "p", id: "q", choice: "A", correct: nil))
        XCTAssertEqual(PanelMessage(["type": "ask", "panel": "p", "text": "  why a subspace?  "]), .ask(panel: "p", text: "why a subspace?"))
        XCTAssertNil(PanelMessage(["type": "ask", "text": "   "]))
        XCTAssertEqual(PanelMessage(["type": "selection", "panel": "p", "text": "x₂ = −x₁", "step": 2]), .selection(panel: "p", text: "x₂ = −x₁", step: 2))
        XCTAssertEqual(PanelMessage(["type": "event", "kind": "viz", "card": "kernel", "data": ["id": "kernel-image", "values": ["x": 1, "y": -1, "flag": true]]]),
                       .widget(panel: "kernel", id: "kernel-image", values: ["x": 1, "y": -1]))
        XCTAssertEqual(PanelMessage(["type": "close"]), .close)
        XCTAssertNil(PanelMessage(["type": "nonsense"]))
        XCTAssertNil(PanelMessage("not a dictionary"))
    }

    func testContextLines() {
        XCTAssertEqual(PanelMessage.quiz(panel: "p", id: "k1", choice: "B", correct: false).contextLine, "he answered quiz k1 on the panel with B (wrong)")
        XCTAssertEqual(PanelMessage(["type": "quiz", "panel": "p", "id": "q1", "choice": "B", "correct": true, "question": "Is (1, 1) in the kernel?", "text": "no"])?.contextLine,
                       "he answered \"Is (1, 1) in the kernel?\" (quiz q1) on the panel with B \"no\" (right)")
        XCTAssertEqual(PanelMessage.selection(panel: "p", text: "the kernel", step: 3).contextLine, "he selected on the panel (step 3): \"the kernel\"")
        XCTAssertEqual(PanelMessage.widget(panel: "p", id: "kernel-image", values: ["y": -1, "x": 1.25]).contextLine, "he set the kernel-image explainer to x=1.25, y=-1")
        XCTAssertNil(PanelMessage.ask(panel: "p", text: "q").contextLine)
    }

    func testDocksRightUnlessTheMarkIsThere() {
        let visible = CGRect(x: 0, y: 0, width: 1512, height: 944)
        let right = PanelDock.frame(in: visible)
        XCTAssertEqual(right, CGRect(x: 1512 - 440 - 10, y: 10, width: 440, height: 924))
        let markOnRight = CGRect(x: 1200, y: 400, width: 200, height: 30)
        XCTAssertEqual(PanelDock.frame(in: visible, avoid: markOnRight).minX, 10)
        XCTAssertEqual(PanelDock.frame(in: visible, avoid: CGRect(x: 300, y: 300, width: 100, height: 20)), right)
        // a second screen to the left (negative x): still inside it
        let left = CGRect(x: -1440, y: 0, width: 1440, height: 875)
        XCTAssertTrue(left.contains(PanelDock.frame(in: left)))
        XCTAssertEqual(PanelDock.frame(in: visible, width: 9000).width, 1512 * 0.6, accuracy: 0.01)
    }

    func testSavedFileName() {
        let date = ISO8601DateFormatter().date(from: "2026-10-17T05:36:00Z")!
        let name = PanelDock.fileName(title: "The kernel of T: what vanishes", date: date, id: "kernel")
        XCTAssertTrue(name.hasSuffix("-the-kernel-of-t-what-vanishes.html"), name)
        XCTAssertTrue(PanelDock.fileName(title: "∑", date: date, id: "sum").hasSuffix("-sum.html"))
    }
}
