import XCTest
@testable import DotKit

/// The fixes the 2026-10-17 overnight run made in round seven's code (docs/heyclicky-gaps.md, FX).
final class OvernightFixesTests: XCTestCase {
    /// FX-01: a yes that goes on into a new request is that request, not an answer to the card.
    func testAYesThatStartsARequestIsNotAnAnswer() {
        let send = "use claude_ai_Gmail: send message to lee@example.com"
        let command = "run a command: python3 model.py"
        XCTAssertEqual(ConsentVoice.interpret("ok so explain this", guarded: false, card: command), .none)
        XCTAssertEqual(ConsentVoice.interpret("sure, run the numbers", guarded: false, card: command), .none)
        XCTAssertNotEqual(ConsentVoice.interpret("sure, run the numbers", guarded: true, card: send), .allow)
        XCTAssertEqual(ConsentVoice.interpret("yes, send it", guarded: true, card: send), .allow)
        XCTAssertEqual(ConsentVoice.interpret("yeah send the email to lee", guarded: true, card: send), .allow)
        XCTAssertEqual(ConsentVoice.interpret("ok", guarded: false, card: command), .allow)
        XCTAssertEqual(ConsentVoice.interpret("yes please, thanks", guarded: false, card: command), .allow)
        XCTAssertEqual(ConsentVoice.interpret("go ahead and run it", guarded: false, card: command), .allow)
        XCTAssertEqual(ConsentVoice.interpret("ok and then make a chart of it", guarded: false, card: command), .none)
    }

    /// FX-03: a one-word agent name said in passing does not reroute the work; address form still does.
    func testAOneWordNameInPassingIsNotAnAddress() {
        let roster = [AgentAddress.Agent(slug: "dot", name: "Dot"), AgentAddress.Agent(slug: "email", name: "Email"),
                      AgentAddress.Agent(slug: "lab-desk", name: "Lab Desk")]
        XCTAssertNil(AgentAddress.mentioned(in: "draft an email to Prof Lee about the lab", roster: roster))
        XCTAssertEqual(AgentAddress.find(in: "tell email to draft it", roster: roster)?.slug, "email")
        XCTAssertEqual(AgentAddress.find(in: "tell email to draft it", roster: roster)?.intent, .tell)
        XCTAssertEqual(AgentAddress.mentioned(in: "pass a note to the lab desk agent that the PI wrote back", roster: roster)?.slug, "lab-desk")
    }

    /// FX-02's input: "stop the email agent" is a stop, which the hold-shift path now honors before `mentioned`.
    func testStopWhileHoldingShiftIsAStop() {
        let roster = [AgentAddress.Agent(slug: "email", name: "Email")]
        XCTAssertEqual(AgentAddress.find(in: "stop the email agent", roster: roster)?.intent, .stop)
    }
}
