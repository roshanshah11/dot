import XCTest
@testable import DotKit

final class SessionFailureTests: XCTestCase {
    func testClaudeCodesOwnMessages() {
        let table: [(String, SessionFailure?)] = [
            ("Not logged in · Please run /login", .loggedOut),
            ("Invalid API key · Please run /login", .loggedOut),
            ("OAuth token has expired. Please run /login to sign in again.", .loggedOut),
            (#"API Error: 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}"#, .loggedOut),
            ("Unable to connect to API. Check your internet connection", .offline),
            ("Request timed out. Check your internet connection and proxy settings", .offline),
            ("API Error: Connection error.", .offline),
            ("getaddrinfo ENOTFOUND api.anthropic.com", .offline),
            ("Repeated 529 Overloaded errors", .overloaded),
            (#"API Error: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}"#, .overloaded),
            ("Claude AI usage limit reached|1761580800", .usageLimit),
            ("5-hour limit reached ∙ resets 3pm", .usageLimit),
            ("Credit balance is too low", .usageLimit),
            ("Usage limit reached · limit resets 3pm", .usageLimit),
            ("You're out of usage credits · resets 3pm", .usageLimit),
            ("Prompt is too long", .tooLong),
            ("Context limit reached · /compact or /clear to continue", .tooLong),
            ("spawn /Users/x/.local/bin/claude ENOENT", .cliMissing),
            ("MCP server \"atlas\" failed to connect", .toolServerDown),
            ("[ede_diagnostic] result_type=user last_content_type=n/a stop_reason=null", nil),
            ("error_during_execution", nil),
            ("turn took 1529 ms", nil),
        ]
        for (text, kind) in table { XCTAssertEqual(SessionFailure.classify(text), kind, text) }
    }

    func testResetTimes() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/Chicago")!
        let now = cal.date(from: DateComponents(year: 2026, month: 10, day: 26, hour: 13, minute: 5))!
        XCTAssertEqual(SessionFailure.resetTime(in: "usage limit reached|1761580800", now: now, calendar: cal), Date(timeIntervalSince1970: 1761580800))
        let three = SessionFailure.resetTime(in: "5-hour limit reached ∙ resets 3pm", now: now, calendar: cal)!
        XCTAssertEqual(cal.component(.hour, from: three), 15)
        XCTAssertEqual(cal.component(.day, from: three), 26)
        let morning = SessionFailure.resetTime(in: "Your limit will reset at 9:30 am", now: now, calendar: cal)!
        XCTAssertEqual(cal.component(.day, from: morning), 27, "a time already past today is tomorrow's")
        XCTAssertEqual(cal.component(.minute, from: morning), 30)
        XCTAssertNil(SessionFailure.resetTime(in: "limit reached", now: now, calendar: cal))
        XCTAssertEqual(SessionFailure.usageLimit.line(reset: three, calendar: cal), "I've hit the Claude usage limit. It resets at 3 pm.")
        XCTAssertEqual(SessionFailure.usageLimit.line(reset: morning, calendar: cal), "I've hit the Claude usage limit. It resets at 9:30 am.")
    }

    func testLinesArePlainAndHaveNoDashes() {
        for kind in SessionFailure.allCases {
            let line = kind.line(server: "atlas")
            XCTAssertFalse(line.contains("—") || line.contains("–"), line)
            XCTAssertLessThan(line.count, 90, line)
        }
        XCTAssertEqual(SessionFailure.toolServerDown.line(server: "atlas"), "Atlas didn't start, so I can't use it right now.")
        XCTAssertTrue(SessionFailure.loggedOut.line().contains("claude login"))
    }

    func testSameFailureSaidOnceIn10Minutes() {
        var voice = FailureVoice()
        let t = Date()
        XCTAssertTrue(voice.admit("offline", at: t))
        XCTAssertFalse(voice.admit("offline", at: t.addingTimeInterval(300)))
        XCTAssertTrue(voice.admit("loggedOut", at: t.addingTimeInterval(300)))
        XCTAssertTrue(voice.admit("offline", at: t.addingTimeInterval(601)))
    }

    func testDocumentLines() {
        XCTAssertEqual(DocumentProblem.scanned.line(isPDF: true), "I can't read this PDF's text, it's a scan, so I'm going by what's on screen.")
        XCTAssertTrue(DocumentProblem.locked.line(isPDF: true).hasPrefix("This PDF is password protected"))
    }

    func testPassagesBlockCapsItsSize() {
        let topics = ["cost of equity from capm", "terminal growth below gdp", "payout ratio and retention", "two stage growth",
                      "preferred dividends", "share buybacks as payout", "dividend yield screens", "h model decay", "sustainable growth roe",
                      "ex dividend dates", "special dividends", "dividend cuts as signals"]
        let pages = (1...12).map { n in
            DocumentPage(number: n, text: (0..<30).map { i in "section \(n).\(i): the dividend discount model and \(topics[(n + i) % topics.count]) number \(n * 100 + i)." }.joined(separator: " "))
        }
        let block = DocumentPassages.block(question: "how does the dividend discount model value a share", title: "Ch. 9", pages: pages, isPDF: true)!
        XCTAssertLessThanOrEqual(block.count, DocumentPassages.cap)
        let cited = block.split(separator: "\n").filter { $0.hasPrefix("p. ") }
        XCTAssertGreaterThanOrEqual(cited.count, 3)
        XCTAssertLessThanOrEqual(cited.count, 5)
        XCTAssertTrue(block.hasPrefix("[document]"))
        let tight = DocumentPassages.block(question: "dividend discount model", title: "Ch. 9", pages: pages, isPDF: true, cap: 1600)!
        XCTAssertLessThanOrEqual(tight.count, 1600)
        XCTAssertNil(DocumentPassages.block(question: "photosynthesis in chloroplasts", title: "Ch. 9", pages: pages, isPDF: true))
        // the same passage on every page counts once
        let repeated = DocumentPassages.block(question: "dividend discount model", title: "Ch. 9", pages: pages, isPDF: true)!
        let texts = repeated.split(separator: "\n").filter { $0.hasPrefix("p. ") }.map { $0.drop(while: { $0 != "\"" }) }
        XCTAssertEqual(Set(texts).count, texts.count)
    }

    func testInitNamesFailedServers() {
        let line = #"{"type":"system","subtype":"init","session_id":"s","mcp_servers":[{"name":"atlas","status":"failed"},{"name":"dot","status":"connected"}]}"#
        guard case .systemInit(_, _, _, let servers, let failed)? = StreamJSON.parse(line: line) else { return XCTFail("no init") }
        XCTAssertEqual(servers, ["atlas", "dot"])
        XCTAssertEqual(failed, ["atlas"])
    }
}
