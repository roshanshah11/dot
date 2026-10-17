import XCTest
@testable import DotKit

final class AgentActivityTests: XCTestCase {
    func testBuiltInToolFamilies() {
        XCTAssertEqual(AgentActivity.of(tool: "WebSearch"), .web)
        XCTAssertEqual(AgentActivity.of(tool: "WebFetch"), .web)
        for tool in ["Read", "Grep", "Glob", "LS", "NotebookRead"] { XCTAssertEqual(AgentActivity.of(tool: tool), .reading, tool) }
        for tool in ["Write", "Edit", "MultiEdit", "NotebookEdit"] { XCTAssertEqual(AgentActivity.of(tool: tool), .writing, tool) }
        for tool in ["Task", "Agent", "TodoWrite", "Skill", "ToolSearch"] { XCTAssertEqual(AgentActivity.of(tool: tool), .thinking, tool) }
        XCTAssertEqual(AgentActivity.of(tool: "Bash"), .command)
        XCTAssertEqual(AgentActivity.of(tool: "Bash", command: "swift build"), .command)
    }

    func testBashThatGoesOnlineIsWeb() {
        XCTAssertEqual(AgentActivity.of(tool: "Bash", command: "hb open https://example.com"), .web)
        XCTAssertEqual(AgentActivity.of(tool: "Bash", command: "cd ~/x && hb snapshot -i"), .web)
        XCTAssertEqual(AgentActivity.of(tool: "Bash", command: "gmail search 'from:priya'"), .web)
        XCTAssertEqual(AgentActivity.of(tool: "Bash", command: "FOO=1 /usr/bin/curl -s example.com | jq ."), .web)
        XCTAssertEqual(AgentActivity.of(tool: "Bash", command: "git clone https://github.com/a/b"), .web)
        XCTAssertEqual(AgentActivity.of(tool: "Bash", command: "cat notes.md | grep hb"), .command)
    }

    func testMCPTools() {
        // Atlas: reads read, writes write, including the two without a verb in the name.
        XCTAssertEqual(AgentActivity.of(tool: "mcp__atlas__search"), .reading)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__atlas__read_doc"), .reading)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__atlas__sec_filings"), .reading)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__atlas__draft_email"), .writing)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__atlas__calendar_create"), .writing)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__atlas__imessage_send"), .writing)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__atlas__apple_note"), .writing)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__atlas__apple_note_read"), .reading)
        // Mail through a connector.
        XCTAssertEqual(AgentActivity.of(tool: "mcp__claude_ai_Gmail__search_threads"), .reading)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__claude_ai_Gmail__create_draft"), .writing)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__gmail__sendMessage"), .writing)
        // Computer use drives the Mac, whatever the tool's verb.
        XCTAssertEqual(AgentActivity.of(tool: "mcp__cua-driver__click"), .command)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__cmux-cua__get_window_state"), .command)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__computer-use__type_text"), .command)
        // Browsers and web readers.
        XCTAssertEqual(AgentActivity.of(tool: "mcp__hb__open"), .web)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__playwright__browser_click"), .web)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__brave-search__brave_web_search"), .web)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__notion__getWebPage"), .web)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__sequential-thinking__sequentialthinking"), .thinking)
        // A bare or odd MCP name still reads as something.
        XCTAssertEqual(AgentActivity.of(tool: "mcp__atlas__"), .reading)
        XCTAssertEqual(AgentActivity.of(tool: "mcp__"), .reading)
    }

    func testUnknownToolIsThinking() {
        XCTAssertEqual(AgentActivity.of(tool: "SomethingNew"), .thinking)
        XCTAssertEqual(AgentActivity.of(tool: ""), .thinking)
    }

    func testSymbolsMatchHomeStepIcons() {
        XCTAssertEqual(AgentActivity.web.symbol, "globe")
        XCTAssertEqual(AgentActivity.reading.symbol, "doc.text.magnifyingglass")
        XCTAssertEqual(AgentActivity.writing.symbol, "pencil.line")
        XCTAssertEqual(AgentActivity.command.symbol, "terminal")
        XCTAssertEqual(Set(AgentActivity.allCases.map(\.symbol)).count, AgentActivity.allCases.count)
    }

    func testWords() {
        XCTAssertEqual(AgentActivity.words("get_window_state"), ["get", "window", "state"])
        XCTAssertEqual(AgentActivity.words("getWebPage"), ["get", "web", "page"])
        XCTAssertEqual(AgentActivity.words("brave-search"), ["brave", "search"])
    }

    func testReportRoundTrip() {
        let report = AgentActivityReport(activity: .reading, waiting: 2, agent: "research-buddy")
        XCTAssertEqual(AgentActivityReport(userInfo: report.userInfo), report)
        let idle = AgentActivityReport(activity: nil)
        XCTAssertNil(idle.userInfo[AgentActivityReport.activityKey])
        XCTAssertEqual(AgentActivityReport(userInfo: idle.userInfo), idle)
    }

    func testReportReadsLooseUserInfo() {
        XCTAssertEqual(AgentActivityReport(userInfo: nil), AgentActivityReport(activity: nil, waiting: 0))
        XCTAssertEqual(AgentActivityReport(userInfo: ["activity": "Web"]).activity, .web)
        XCTAssertNil(AgentActivityReport(userInfo: ["activity": "  "]).activity)
        XCTAssertNil(AgentActivityReport(userInfo: ["activity": "idle"]).activity)
        // A tool name instead of an activity is mapped, not dropped.
        XCTAssertEqual(AgentActivityReport(userInfo: ["activity": "Bash"]).activity, .command)
        XCTAssertEqual(AgentActivityReport(userInfo: ["activity": "mcp__atlas__search"]).activity, .reading)
        XCTAssertEqual(AgentActivityReport(userInfo: ["waiting": NSNumber(value: 3)]).waiting, 3)
        XCTAssertEqual(AgentActivityReport(userInfo: ["waiting": -2]).waiting, 0)
        XCTAssertEqual(AgentActivityReport(userInfo: ["waiting": "one"]).waiting, 0)
    }

    func testNotificationName() {
        XCTAssertEqual(Notification.Name.dotAgentActivity.rawValue, "com.roshan.dot.agentActivity")
    }
}

final class FileKindColorTests: XCTestCase {
    func testExtensions() {
        XCTAssertEqual(FileKind(extension: "pdf"), .pdf)
        XCTAssertEqual(FileKind(extension: "xlsx"), .xlsx)
        XCTAssertEqual(FileKind(extension: "csv"), .xlsx)
        XCTAssertEqual(FileKind(extension: "pptx"), .pptx)
        XCTAssertEqual(FileKind(extension: "key"), .pptx)
        XCTAssertEqual(FileKind(extension: "docx"), .docx)
        XCTAssertEqual(FileKind(extension: "md"), .md)
        XCTAssertEqual(FileKind(extension: "html"), .html)
        XCTAssertEqual(FileKind(extension: "heic"), .image)
        XCTAssertEqual(FileKind(extension: "swift"), .code)
        XCTAssertEqual(FileKind(extension: "zip"), .other)
        XCTAssertEqual(FileKind(extension: ""), .other)
    }

    func testCaseAndDots() {
        XCTAssertEqual(FileKind(extension: "PDF"), .pdf)
        XCTAssertEqual(FileKind(extension: ".Xlsx"), .xlsx)
        XCTAssertEqual(FileKind(path: "/Users/r/Desktop/COMPS.XLSX"), .xlsx)
        XCTAssertEqual(FileKind(path: "~/Dot/agents/research-buddy/output/Bridgewater Brief.PDF"), .pdf)
    }

    func testFolders() {
        XCTAssertEqual(FileKind(path: "/Users/r/Dot/agents/research-buddy/output/"), .folder)
        XCTAssertEqual(FileKind(path: "/Users/r/Dot/agents/research-buddy/output", isDirectory: true), .folder)
        XCTAssertEqual(FileKind(path: "/Users/r/Dot/agents/research-buddy/output"), .other)
        XCTAssertEqual(FileKind(url: URL(fileURLWithPath: "/tmp/out", isDirectory: true)), .folder)
        XCTAssertEqual(FileKind(url: URL(fileURLWithPath: "/tmp/out/model.xlsx")), .xlsx)
        XCTAssertEqual(FileKind(path: "/tmp/notes.md", isDirectory: false), .md)
    }

    func testDefaultsCoverEveryKindAndAreDistinct() {
        for kind in FileKind.allCases {
            let hex = FileKindColor.color(for: kind)
            XCTAssertEqual(FileKindColor.normalizedHex(hex), hex, kind.rawValue)
        }
        XCTAssertEqual(Set(FileKind.allCases.map { FileKindColor.color(for: $0) }).count, FileKind.allCases.count)
        XCTAssertEqual(FileKindColor.color(forPath: "/tmp/model.xlsx"), FileKindColor.defaults[.xlsx])
    }

    func testOverride() {
        let overrides = ["pdf": "#00ff00", "XLSX": "112233", "md": " #aBcDeF "]
        XCTAssertEqual(FileKindColor.color(for: .pdf, overrides: overrides), "#00FF00")
        XCTAssertEqual(FileKindColor.color(for: .xlsx, overrides: overrides), "#112233")
        XCTAssertEqual(FileKindColor.color(for: .md, overrides: overrides), "#ABCDEF")
        XCTAssertEqual(FileKindColor.color(for: .docx, overrides: overrides), FileKindColor.defaults[.docx])
        XCTAssertEqual(FileKindColor.color(forPath: "/tmp/a.pdf", overrides: overrides), "#00FF00")
    }

    func testBadOverrideFallsBackPerKind() {
        for bad in ["green", "#12345", "#1234567", "#GGGGGG", "", "#", "１２３４５６"] {
            XCTAssertEqual(FileKindColor.color(for: .pptx, overrides: ["pptx": bad]), FileKindColor.defaults[.pptx], bad)
        }
        XCTAssertNil(FileKindColor.normalizedHex("rgb(1,2,3)"))
    }
}
