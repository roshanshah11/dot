import XCTest
@testable import DotKit

/// Tonight's voice verbs over agents (docs/heyclicky-gaps.md, VO-01 to VO-13).
final class AgentVoiceVerbsTests: XCTestCase {
    private let roster = [
        AgentAddress.Agent(slug: "dot", name: "Dot"),
        AgentAddress.Agent(slug: "email", name: "Email"),
        AgentAddress.Agent(slug: "inbox-keeper", name: "Inbox Keeper"),
        AgentAddress.Agent(slug: "deck-shop", name: "Deck Shop"),
    ]

    func testOpenAnAgentOrWhatItMade() {
        XCTAssertEqual(AgentAddress.find(in: "open inbox keeper", roster: roster), .init(slug: "inbox-keeper", intent: .open))
        XCTAssertEqual(AgentAddress.find(in: "show me inbox keeper's thread", roster: roster), .init(slug: "inbox-keeper", intent: .open))
        XCTAssertEqual(AgentAddress.find(in: "open the deck email made", roster: roster), .init(slug: "email", intent: .openArtifact, detail: "deck"))
        XCTAssertEqual(AgentAddress.find(in: "pull up the sheet that deck shop built", roster: roster), .init(slug: "deck-shop", intent: .openArtifact, detail: "sheet"))
        XCTAssertNil(AgentAddress.find(in: "open the email from sebastian", roster: roster))
        XCTAssertNil(AgentAddress.find(in: "open safari", roster: roster))
    }

    func testWhatDidItFind() {
        XCTAssertEqual(AgentAddress.find(in: "what did email find", roster: roster), .init(slug: "email", intent: .status))
        XCTAssertEqual(AgentAddress.find(in: "what did inbox keeper come up with?", roster: roster), .init(slug: "inbox-keeper", intent: .status))
        let entries: [(role: String, text: String)] = [
            ("user", "find the three newest postings"), ("assistant", "looking"), ("tool", "atlas postings"),
            ("assistant", "Three new ones: Evercore, PJT and Moelis."), ("result", "success in 900 ms, $0.200"),
            ("user", "now the deadlines"), ("assistant", "on it"),
        ]
        XCTAssertEqual(AgentVoice.lastFinding(in: entries), "Three new ones: Evercore, PJT and Moelis.")
        XCTAssertNil(AgentVoice.lastFinding(in: [("user", "hi"), ("assistant", "working")]))
    }

    func testPauseAndResumeRoutine() {
        XCTAssertEqual(AgentAddress.find(in: "pause email", roster: roster), .init(slug: "email", intent: .pause))
        XCTAssertEqual(AgentAddress.find(in: "hold inbox keeper for now", roster: roster), .init(slug: "inbox-keeper", intent: .pause))
        XCTAssertEqual(AgentAddress.find(in: "resume email's routine", roster: roster), .init(slug: "email", intent: .resumeRoutine))
        XCTAssertEqual(AgentAddress.find(in: "turn inbox keeper's routines back on", roster: roster), nil)
        XCTAssertEqual(AgentAddress.find(in: "turn on inbox keeper's routine", roster: roster), .init(slug: "inbox-keeper", intent: .resumeRoutine))
        XCTAssertEqual(AgentAddress.find(in: "stop email", roster: roster), .init(slug: "email", intent: .stop))
    }

    func testRetryAndSteer() {
        for said in ["retry", "try again", "do that again", "ok, try it again", "Redo it."] { XCTAssertTrue(AgentVoice.isRetry(said), said) }
        for said in ["try again later with the other numbers", "i'll retry tomorrow", "what does retry mean"] { XCTAssertFalse(AgentVoice.isRetry(said), said) }
        XCTAssertEqual(AgentVoice.steer("stop, do the sensitivity table instead"), "do the sensitivity table")
        XCTAssertEqual(AgentVoice.steer("no, use the 10-K numbers instead"), "use the 10-K numbers")
        XCTAssertEqual(AgentVoice.steer("scratch that, instead make it two pages"), "make it two pages")
        XCTAssertNil(AgentVoice.steer("stop"))
        XCTAssertNil(AgentVoice.steer("actually, what is this"))
        XCTAssertNil(AgentVoice.steer("why did you pick that instead"))
    }

    func testWhichCard() {
        XCTAssertEqual(AgentVoice.whichCard([("Email", "send a message"), ("Physics", "run a command")]),
                       "two are waiting: email wants to send a message, physics wants to run a command. which one?")
        let open = [(slug: "email", name: "Email"), (slug: "inbox-keeper", name: "Inbox Keeper")]
        XCTAssertEqual(AgentVoice.cardAgent(in: "the inbox one", among: open), "inbox-keeper")
        XCTAssertEqual(AgentVoice.cardAgent(in: "email", among: open), "email")
        XCTAssertNil(AgentVoice.cardAgent(in: "the first one", among: open))
    }
}
