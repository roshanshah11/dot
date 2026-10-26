import XCTest
@testable import DotKit

final class IdleReportTests: XCTestCase {
    func testEmptyIsIdle() {
        XCTAssertTrue(IdleReport().idle)
        XCTAssertEqual(IdleReport().reasons, [])
    }

    func testEachKindOfWorkBlocks() {
        XCTAssertFalse(IdleReport(jobs: [.init(id: "ab12cd", phase: "running", goal: "apply on wyzant")]).idle)
        XCTAssertFalse(IdleReport(jobs: [.init(id: "ab12cd", phase: "paused", goal: "x")]).idle)
        XCTAssertFalse(IdleReport(queued: 1).idle)
        XCTAssertFalse(IdleReport(workingAgents: ["email"]).idle)
        XCTAssertFalse(IdleReport(cardsWaiting: 2).idle)
        XCTAssertFalse(IdleReport(lecture: true).idle)
    }

    func testReasonsNameTheWork() {
        let report = IdleReport(jobs: [.init(id: "ab12cd", phase: "running", goal: "find a flight", waitingOnHim: true)],
                                queued: 2, workingAgents: ["email"], cardsWaiting: 1, lecture: true)
        XCTAssertEqual(report.reasons, [
            "job ab12cd running (waiting on him): find a flight", "2 jobs queued", "agent email working",
            "1 card waiting on him", "lecture mode is on",
        ])
    }

    func testWireRoundTrip() throws {
        let report = IdleReport(jobs: [.init(id: "ab12cd", phase: "starting", goal: "g")], queued: 1, workingAgents: ["a"],
                                cardsWaiting: 3, lecture: false)
        let data = try JSONSerialization.data(withJSONObject: report.wire)
        let back = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(IdleReport(wire: back), report)
        XCTAssertEqual(back["idle"] as? Bool, false)
    }

    func testOlderDotOrGarbageIsNotAReport() {
        XCTAssertNil(IdleReport(wire: ["error": "unknown verb jobs"]))
        XCTAssertNil(IdleReport(wire: ["v": 2, "jobs": []]))
        XCTAssertNil(IdleReport(wire: ["v": 1, "jobs": [["phase": "running"]]]))
    }
}
