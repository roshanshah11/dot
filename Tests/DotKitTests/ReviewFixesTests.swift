import XCTest
@testable import DotKit

/// Fixes from the 2026-10-17 review of the overnight run's agent code.
final class ReviewFixesTests: XCTestCase {
    /// The morning card takes only its own moves, never a bare yes, no or next.
    func testTheMorningCardTakesOnlyItsOwnWords() {
        XCTAssertEqual(AgentVoice.morningAnswer("do it")?.yes, true)
        XCTAssertEqual(AgentVoice.morningAnswer("yes, do that one")?.yes, true)
        XCTAssertEqual(AgentVoice.morningAnswer("skip it")?.yes, false)
        XCTAssertEqual(AgentVoice.morningAnswer("not that one")?.yes, false)
        let change = AgentVoice.morningAnswer("do it but keep it to one page")
        XCTAssertEqual(change?.yes, true)
        XCTAssertEqual(change?.adjust, "keep it to one page")
        for said in ["yes", "sure", "go ahead", "no", "next", "nope", "pass", "next one"] {
            XCTAssertNil(AgentVoice.morningAnswer(said), said)
        }
    }

    /// With Dot down, a command that runs another program per hit is not a plain read.
    func testTheOfflineRuleRefusesCommandsThatRunOthers() {
        for command in ["fd -x rm {}", "fd --exec-batch rm", "fd . --exec rm", "rg --pre ./x.sh foo", "git diff --output=out.txt", "git grep -O'sh -c id' foo", "git grep --open-files-in-pager=vim foo"] {
            XCTAssertFalse(HookDecision.isPlainReadCommand(command), command)
        }
        for command in ["fd notes ~/roshan", "rg -n deadline ~/roshan/Career", "git log --oneline -3", "git diff --stat"] {
            XCTAssertTrue(HookDecision.isPlainReadCommand(command), command)
        }
    }
}
