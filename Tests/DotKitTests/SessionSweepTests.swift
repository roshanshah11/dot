import XCTest
@testable import DotKit

final class SessionSweepTests: XCTestCase {
    func testFolderNamesMatchClaudeCode() {
        // the real folders on this Mac, 2026-10-27
        XCTAssertEqual(SessionSweep.folderName(for: "/Users/roshanshah/Dot/talk"), "-Users-roshanshah-Dot-talk")
        XCTAssertEqual(SessionSweep.folderName(for: "/Users/roshanshah/Dot/agents/chicago-flights"), "-Users-roshanshah-Dot-agents-chicago-flights")
        XCTAssertEqual(SessionSweep.folderName(for: "/private/tmp/claude-501/x.y"), "-private-tmp-claude-501-x-y")
    }

    func testOnlyDotsFolders() {
        let roots = (talk: "/Users/r/Dot/talk", agents: "/Users/r/Dot/agents", jobs: "/Users/r/Dot/jobs")
        func dots(_ f: String) -> Bool { SessionSweep.isDots(f, talk: roots.talk, agents: roots.agents, jobs: roots.jobs) }
        XCTAssertTrue(dots("-Users-r-Dot-talk"))
        XCTAssertTrue(dots("-Users-r-Dot-agents-email"))
        XCTAssertTrue(dots("-Users-r-Dot-jobs-27k8yt"))
        XCTAssertFalse(dots("-Users-r-roshan"), "his own chats")
        XCTAssertFalse(dots("-Users-r-Dot-talk-old"), "talk is one folder")
        XCTAssertFalse(dots("-Users-r-Dot-agents"), "the agents root itself")
        XCTAssertFalse(dots("-Users-r-Projects-dot"))
        XCTAssertFalse(dots("-private-tmp-dot-bench-jobs-2qacwv"))
    }

    func testExpiredKeepsRecentAndInUse() {
        let now = Date(timeIntervalSince1970: 1_000_000_000)
        let day = 86400.0
        let sessions = [(id: "old", modified: now.addingTimeInterval(-8 * day)), (id: "hosted", modified: now.addingTimeInterval(-9 * day)),
                        (id: "recent", modified: now.addingTimeInterval(-2 * day)), (id: "edge", modified: now.addingTimeInterval(-7 * day + 60))]
        XCTAssertEqual(SessionSweep.expired(sessions, days: 7, inUse: ["hosted"], now: now), ["old"])
        XCTAssertEqual(SessionSweep.expired(sessions, days: 1, inUse: [], now: now), ["edge", "hosted", "old", "recent"])
        XCTAssertEqual(SessionSweep.expired(sessions, days: 30, inUse: [], now: now), [], "Claude Code's own retention: Dot deletes nothing")
        XCTAssertEqual(SessionSweep.expired(sessions, days: 0, inUse: [], now: now), [])
        XCTAssertEqual(SessionSweep.expired(sessions, days: -3, inUse: [], now: now), [])
    }
}
