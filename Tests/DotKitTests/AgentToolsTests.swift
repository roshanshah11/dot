import XCTest
@testable import DotKit

final class AgentToolsTests: XCTestCase {
    let known = ["atlas", "cua-driver", "claude_ai_Gmail", "claude_ai_Google_Calendar", "claude_ai_Google_Drive", "claude_ai_Claude_Docs", "blender"]

    func testToolPrefix() {
        XCTAssertEqual(AgentTools.toolPrefix("claude.ai Gmail"), "claude_ai_Gmail")
        XCTAssertEqual(AgentTools.toolPrefix("claude.ai Google Calendar"), "claude_ai_Google_Calendar")
        XCTAssertEqual(AgentTools.toolPrefix("cua-driver"), "cua-driver")
    }

    func testInitLineCarriesServers() {
        let line = #"{"type":"system","subtype":"init","session_id":"s","mcp_servers":[{"name":"atlas","status":"connected"},{"name":"claude.ai Gmail","status":"connected"}]}"#
        guard case .systemInit(_, _, _, let servers, _)? = StreamJSON.parse(line: line) else { return XCTFail("no init") }
        XCTAssertEqual(servers, ["atlas", "claude_ai_Gmail"])
    }

    func testChoiceFromTheBrief() {
        let mail = AgentTools.chosen(brief: "# Inbox Desk\nTriage my email every morning and draft replies.", known: known)
        XCTAssertEqual(mail, ["atlas", "cua-driver", "claude_ai_Gmail"])
        XCTAssertEqual(AgentTools.denied(known: known, chosen: mail),
                       ["mcp__blender", "mcp__claude_ai_Claude_Docs", "mcp__claude_ai_Google_Calendar", "mcp__claude_ai_Google_Drive"])
        let research = AgentTools.chosen(brief: "Research Northwind's 10-Q and write a memo.", known: known)
        XCTAssertEqual(research, ["atlas", "cua-driver"], "Atlas and computer use are always kept; nothing else is asked for")
        XCTAssertTrue(AgentTools.chosen(brief: "Model a chair in Blender", known: known).contains("blender"), "a server he names")
        XCTAssertTrue(AgentTools.chosen(brief: "find a time for office hours", known: known).contains("claude_ai_Google_Calendar"))
        XCTAssertFalse(AgentTools.chosen(brief: "the mailroom hours", known: known).contains("claude_ai_Gmail"), "whole words only")
    }

    func testHisOverrides() {
        let o = AgentTools.Overrides(add: ["claude_ai_Google_Drive", "not-a-server"], remove: ["claude_ai_Gmail", "atlas"])
        let got = AgentTools.chosen(brief: "email triage", known: known, overrides: o)
        XCTAssertTrue(got.contains("claude_ai_Google_Drive"))
        XCTAssertFalse(got.contains("claude_ai_Gmail"))
        XCTAssertTrue(got.contains("atlas"), "Atlas can't be taken away")
        XCTAssertFalse(got.contains("not-a-server"))
        XCTAssertEqual(AgentTools.label("claude_ai_Google_Calendar"), "Google Calendar")
    }
}
