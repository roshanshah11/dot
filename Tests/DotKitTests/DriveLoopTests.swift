import XCTest
@testable import DotKit

final class DriveLoopTests: XCTestCase {
    let look = """
    page: "Settings" http://127.0.0.1:8766/settings.html
      heading "Settings"
    e1 link "Home"
    e2 tab "Notifications"
    e3 tab "Display" [checked]
    e4 switch "Email alerts"
    e5 button "Save changes" [his]
    e6 button "Reset" [disabled]
    e7 link "Help" (off screen)
    """

    func testCandidates() {
        let c = DriveLoop.candidates(look: look)
        XCTAssertEqual(c.map(\.ref), ["e1", "e2", "e3", "e4", "e5", "e6", "e7"])
        XCTAssertEqual(c[3], DriveLoop.Candidate(ref: "e4", role: "switch", name: "Email alerts"))
        XCTAssertTrue(c[4].his)
        XCTAssertTrue(c[5].disabled)
        XCTAssertTrue(c[6].offScreen)
    }

    func testShortlistNeverOffersHisOrDisabled() {
        let s = DriveLoop.shortlist(DriveLoop.candidates(look: look), step: "turn on email alerts")
        XCTAssertEqual(s.first?.ref, "e4", "the control sharing the step's words first")
        XCTAssertFalse(s.contains { $0.ref == "e5" || $0.ref == "e6" })
        XCTAssertEqual(s.last?.ref, "e7", "off screen last")
    }

    func testQuestionAndDecision() {
        let (instructions, criteria) = DriveLoop.question(goal: "turn on email alerts", step: "Notifications", choices: Array(DriveLoop.candidates(look: look).prefix(2)))
        XCTAssertTrue(instructions.contains("The step now: Notifications"))
        XCTAssertEqual(Set(criteria.keys), ["none", "e1", "e2"])
        XCTAssertEqual(criteria["e2"], "tab \"Notifications\"")
        XCTAssertEqual(DriveLoop.decide(choice: "e2", probability: 0.91), .click("e2"))
        XCTAssertEqual(DriveLoop.decide(choice: "e2", probability: 0.31), .unsure("jev wasn't sure (e2 at 0.31)"))
        XCTAssertEqual(DriveLoop.decide(choice: "none", probability: 0.8), .unsure("jev picked none (0.80)"))
        XCTAssertEqual(DriveLoop.decide(choice: nil, probability: 0), .unsure("jev picked none (0.00)"))
    }

    func testStopRules() {
        var s = DriveLoop.State(steps: ["Notifications", "Email alerts"])
        XCTAssertEqual(s.next, .ask("Notifications"))
        s.unsure()
        XCTAssertEqual(s.next, .ask("Notifications"), "one unsure answer asks again")
        s.clicked()
        XCTAssertEqual(s.next, .ask("Email alerts"))
        s.unsure(); s.unsure()
        XCTAssertEqual(s.next, .handBack("not sure which control does \"Email alerts\""))
        var t = DriveLoop.State(steps: ["a"])
        t.clicked()
        XCTAssertEqual(t.next, .finished)
        var long = DriveLoop.State(steps: Array(repeating: "next", count: 30))
        for _ in 0..<25 { long.clicked() }
        XCTAssertEqual(long.next, .handBack("25 clicks without finishing"))
        XCTAssertEqual(DriveLoop.steps("open Settings; Displays > Night Shift\nturn on"), ["open Settings", "Displays", "Night Shift", "turn on"])
        XCTAssertEqual(DriveLoop.steps(["a", "b"]), ["a", "b"])
    }
}
