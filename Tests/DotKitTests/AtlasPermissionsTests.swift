import XCTest
@testable import DotKit

/// Atlas's permissions for agents (his call 2026-10-21, "fully Atlas, no Dot guards"): Atlas's deny list is the only
/// refusal, and the agent's settings carry no PreToolUse gate, so nothing can raise a card.
final class AtlasPermissionsTests: XCTestCase {
    let home = "/Users/example"
    let vault = "/Users/example/roshan"
    let agentFolder = "/Users/example/Dot/agents/research"

    func refusal(_ tool: String, _ input: [String: Any]) -> String? {
        AtlasDeny.refusal(tool: tool, input: AnyCodableValue.object(from: input), home: home, vault: vault, cwd: agentFolder)
    }

    func testTheSetting() {
        for setting in ["atlas", "", "Atlas", "anything else"] { XCTAssertEqual(PermissionsMode(setting: setting), .atlas, setting) }
        for setting in ["guarded", " Guarded "] { XCTAssertEqual(PermissionsMode(setting: setting), .guarded, setting) }
    }

    func testRulesAreAtlasAskDenyWithPathsResolved() {
        let rules = AtlasDeny.rules(home: home, vault: vault)
        XCTAssertEqual(rules.count, AtlasDeny.askDeny.count)
        XCTAssertEqual(Array(rules.prefix(4)), ["Read(//Users/example/roshan/Atlas/private/**)", "Edit(//Users/example/roshan/Atlas/private/**)",
                                                "Read(//Users/example/.atlas-browser/**)", "Edit(//Users/example/.atlas-browser/**)"])
        XCTAssertEqual(Array(rules.dropFirst(4)), Array(AtlasDeny.askDeny.dropFirst(4)), "the Bash rules as Atlas writes them")
        XCTAssertFalse(rules.contains { $0.contains("~") || $0.contains("./") })
        XCTAssertEqual(AtlasDeny.folders(home: home, vault: vault), ["/Users/example/roshan/Atlas/private", "/Users/example/.atlas-browser"])
        XCTAssertTrue(AtlasDeny.commands.contains(["gmail", "send"]))
        XCTAssertTrue(AtlasDeny.commands.contains(["osascript"]))
    }

    func testAgentCallsRunWithNoCard() {
        // the 2026-10-21 kind (a routine research command Jev timed out on), an unrecognised command, a python subprocess call
        for cmd in ["rg -n Northwind ~/roshan/Career | head -20", "some-new-cli fetch --course COURSE-101",
                    "python3 -c 'import subprocess; subprocess.run([\"ls\"])'", "curl -s https://example.com", "hb open https://example.com",
                    "rm -rf ~/Dot/agents/research/output/tmp", "git status", "gmail search Northwind", "echo 'gmail send is closed'"] {
            XCTAssertNil(refusal("Bash", ["command": cmd]), cmd)
        }
        XCTAssertNil(refusal("Write", ["file_path": "~/Documents/notes.md", "content": "x"]))
        XCTAssertNil(refusal("Read", ["file_path": "~/.ssh/config"]))
        XCTAssertNil(refusal("mcp__atlas__send_email", ["to": ["sam@example.com"], "subject": "x", "body": "y"]), "Atlas's own grants decide its sends")
        XCTAssertNil(refusal("mcp__cua-driver__click", ["element": "Submit"]))
    }

    func testAtlasDenyListRefuses() {
        XCTAssertNotNil(refusal("Read", ["file_path": "~/roshan/Atlas/private/keys.json"]))
        XCTAssertNotNil(refusal("Read", ["file_path": "/Users/example/roshan/Atlas/private"]))
        XCTAssertNotNil(refusal("Write", ["file_path": "../../../roshan/Atlas/private/x"]), "relative to the agent's folder")
        XCTAssertNotNil(refusal("Edit", ["file_path": "~/.atlas-browser/Default/Cookies"]))
        XCTAssertNotNil(refusal("Grep", ["pattern": "token", "path": "/Users/example/roshan/Atlas/private"]))
        XCTAssertNotNil(refusal("Glob", ["pattern": "/Users/example/.atlas-browser/**/*"]))
        XCTAssertNil(refusal("Read", ["file_path": "~/roshan/Atlas/privateer.md"]), "a folder, not a prefix")
        for cmd in ["gmail send --to sam@example.com", "cd /tmp && outlook reply AAMk1", "imsg send --to +15555550100 --text hi",
                    "env A=1 /usr/bin/osascript -e x", "sh -c 'git push'", "echo $(linkedin message alex-example hi)", "git commit -m x"] {
            XCTAssertNotNil(refusal("Bash", ["command": cmd]), cmd)
        }
        XCTAssertEqual(AtlasDeny.closedCommand(in: "nohup gmail reply T1 ok"), "gmail reply")
    }

    func testAgentSettingsHaveNoGateUnderAtlasPermissions() throws {
        let deny = AtlasDeny.rules(home: home, vault: vault)
        let text = HookDecision.settingsJSON(executable: "/Applications/Dot.app/Contents/MacOS/Dot", arguments: ["--gate", "--agent", "x"],
                                             gate: false, deny: deny, defaultMode: "bypassPermissions")
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
        let permissions = try XCTUnwrap(json["permissions"] as? [String: Any])
        XCTAssertEqual(permissions["defaultMode"] as? String, "bypassPermissions")
        XCTAssertEqual(permissions["deny"] as? [String], deny)
        let hooks = try XCTUnwrap(json["hooks"] as? [String: Any])
        XCTAssertNil(hooks["PreToolUse"], "no gate, so no card")
        XCTAssertNotNil(hooks["PostToolUse"], "outputs still go past the injection check")
        // no socket (and a job's settings): the deny list alone
        let bare = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(HookDecision.settingsJSON(executable: nil, deny: deny).utf8)) as? [String: Any])
        XCTAssertNil(bare["hooks"])
        XCTAssertEqual((bare["permissions"] as? [String: Any])?["deny"] as? [String], deny)
    }
}
