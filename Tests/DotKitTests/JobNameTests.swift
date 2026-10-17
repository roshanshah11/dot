import XCTest
@testable import DotKit

final class JobNameTests: XCTestCase {
    func testNamesFromRealBriefs() {
        // the 2026-10-17 asks, as the held-shift path and the talk model wrote them
        XCTAssertEqual(JobName.make(from: "Hey Dot, can you work on the Nomura coffee chat application I need to do? Umblack."), "Nomura Application")
        XCTAssertEqual(JobName.make(from: "work on Roshan's Nomura coffee chat application. It is due tonight, Saturday 2026-10-17, at 11:59 PM"), "Nomura Application")
        XCTAssertEqual(JobName.make(from: "go on amazon.com in the browser he has open (Comet, currently a blank new tab) and find a USB C charging cable he can buy."), "Amazon Cable")
        XCTAssertEqual(JobName.make(from: "Record the Riverside Micro Cap video interview"), "Riverside Video")
        XCTAssertEqual(JobName.make(from: "do this research in the Comet browser he has open, using Perplexity and finance sites there. he wants a stock he could buy next week"), "Finance Research")
    }

    func testABusyNameGetsANumber() {
        XCTAssertEqual(JobName.make(from: "the Nomura application", taken: ["nomura application"]), "Nomura Application 2")
        XCTAssertEqual(JobName.make(from: "the Nomura application", taken: ["nomura application", "nomura application 2"]), "Nomura Application 3")
    }

    func testAlwaysTwoWordsOrAFallback() {
        XCTAssertEqual(JobName.make(from: "do it"), "New Job")
        XCTAssertEqual(JobName.make(from: "clean up my downloads folder"), "Clean Downloads")
        for brief in ["hey can you", "find me one", "plan my week"] {
            XCTAssertLessThanOrEqual(JobName.make(from: brief).split(separator: " ").count, 2, brief)
        }
    }
}

final class AgentSettingsTests: XCTestCase {
    func testBypassSettingsKeepTheGateAndDenyPrivatePaths() throws {
        let deny = ["Read(//Users/me/roshan/Atlas/private/**)", "Edit(//Users/me/roshan/Atlas/private/**)"]
        let text = HookDecision.settingsJSON(executable: "/Applications/Dot.app/Contents/MacOS/Dot", arguments: ["--gate", "--agent", "x"],
                                             deny: deny, defaultMode: "bypassPermissions")
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
        let permissions = try XCTUnwrap(json["permissions"] as? [String: Any])
        XCTAssertEqual(permissions["defaultMode"] as? String, "bypassPermissions")
        XCTAssertEqual(permissions["deny"] as? [String], deny)
        let hooks = try XCTUnwrap(json["hooks"] as? [String: Any])
        XCTAssertNotNil(hooks["PreToolUse"], "every call still goes through Dot's gate")
        // without them the settings are the hooks alone, as before
        let plain = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(HookDecision.settingsJSON(executable: "/x").utf8)) as? [String: Any])
        XCTAssertNil(plain["permissions"])
    }
}
