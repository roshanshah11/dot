import XCTest
@testable import DotKit

final class AgentLookTests: XCTestCase {
    let now = ISO8601DateFormatter().date(from: "2026-10-26T12:00:00Z")!
    func ago(_ hours: Double) -> Date { now.addingTimeInterval(-hours * 3600) }

    func testMoodFromTheThread() {
        typealias Row = (role: String, text: String, time: Date?)
        let asked: [Row] = [("user", "find me flights", ago(2)), ("assistant", "Two work. Do you want the cheaper one or the earlier one?", ago(1.9)), ("result", "success in 3000 ms, $0.010", ago(1.9))]
        XCTAssertEqual(AgentMood.of(running: false, rows: asked, now: now), .waiting)
        XCTAssertEqual(AgentMood.of(running: true, rows: asked, now: now), .working, "a turn in flight wins")
        let answered: [Row] = [("user", "make the deck", ago(3)), ("tool", "Writing deck.pptx", ago(2.9)), ("assistant", "Done: deck.pptx in output/.", ago(2.5)), ("result", "success in 9000 ms, $0.120", ago(2.5))]
        XCTAssertEqual(AgentMood.of(running: false, rows: answered, now: now), .done)
        XCTAssertEqual(AgentMood.of(running: false, rows: answered, now: now.addingTimeInterval(2 * 86400)), .rest, "done fades after a day")
        let broke: [Row] = [("user", "go", ago(1)), ("assistant", "Reading the page.", ago(0.9)), ("result", "error_max_turns in 60000 ms, $0.300", ago(0.8))]
        XCTAssertEqual(AgentMood.of(running: false, rows: broke, now: now), .failed)
        let stopped: [Row] = [("user", "go", ago(1)), ("result", "stopped from the task bar", ago(0.9))]
        XCTAssertEqual(AgentMood.of(running: false, rows: stopped, now: now), .rest)
        let fresh: [Row] = answered + [("user", "and a one-pager", ago(0.1))]
        XCTAssertEqual(AgentMood.of(running: false, rows: fresh, now: now), .rest, "his newer word clears the old mood")
        XCTAssertEqual(AgentMood.of(running: false, rows: [], now: now), .rest)
    }

    func testSymbolFromNameAndBrief() {
        let template = "# Scout\n\nA Dot agent. This folder is its workspace: deliverables in `output/`, scratch in `tmp/`.\n\n## Persona\nfirst run: describe what this agent is for, how it likes to work, and what a good result looks like.\n"
        let stockOnly = AgentLook.brief(claudeMD: template, template: template, founding: "")
        XCTAssertEqual(stockOnly, "", "the template alone says nothing about the agent")
        XCTAssertEqual(AgentLook.symbol(name: "Scout", brief: AgentLook.brief(claudeMD: template, template: template, founding: "watch for hackathons and their deadlines")), "calendar")
        XCTAssertEqual(AgentLook.symbol(name: "Pitch Desk", brief: ""), "chart.line.uptrend.xyaxis")
        XCTAssertEqual(AgentLook.symbol(name: "Helper", brief: ""), SkillAvatar.fallback)
    }

    /// His Option agent ("the best option", products he buys) gets the cart.
    func testHisAgents() throws {
        let file = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Dot/agents/option/CLAUDE.md")
        guard let text = try? String(contentsOf: file, encoding: .utf8) else { throw XCTSkip("no Option agent here") }
        let template = "# Option\n\nA Dot agent. This folder is its workspace: deliverables in `output/`, scratch in `tmp/`.\n\n## Persona\n"
        XCTAssertEqual(AgentLook.symbol(name: "Option", brief: AgentLook.brief(claudeMD: text, template: template, founding: "")), "cart")
    }
}

final class HomeKitTests: XCTestCase {
    func testTapbackBlock() {
        XCTAssertNil(Tapback.block([]))
        let long = String(repeating: "word ", count: 40)
        let block = Tapback.block([("👍", "Found 4 hackathons:\nHackMIT, ..."), ("❓", long)])!
        XCTAssertTrue(block.hasPrefix("[reactions] "), block)
        XCTAssertTrue(block.contains("- 👍 (good) to \"Found 4 hackathons: HackMIT, ...\""), block)
        XCTAssertTrue(block.contains("- ❓ (unclear to him) to \""), block)
        XCTAssertTrue(block.contains("…\""), "a long message is cut")
        XCTAssertEqual(Tapback.choices.count, 5)
    }

    func testStartersForEverySymbol() {
        for symbol in SkillAvatar.choices {
            let s = AgentLook.starters(symbol: symbol)
            XCTAssertEqual(s.count, 3, symbol)
            XCTAssertEqual(Set(s).count, 3, symbol)
            XCTAssertTrue(s.allSatisfy { !$0.contains("\u{2014}") && $0.count <= 48 }, "\(symbol): \(s)")
        }
        XCTAssertNotEqual(AgentLook.starters(symbol: "cart"), AgentLook.starters(symbol: SkillAvatar.fallback))
    }
}
