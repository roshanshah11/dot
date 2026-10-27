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

    func testOnlySessionsDotStarted() {
        let head = #"{"type":"summary"}\n{"parentUuid":null,"cwd":"/Users/r/Dot/agents/email","sessionId":"s1","message":{"content":"hi \"cwd\":\"/x\""}}"#
        XCTAssertEqual(SessionSweep.startCwd(head: head), "/Users/r/Dot/agents/email")
        XCTAssertEqual(SessionSweep.startCwd(head: #"{"cwd":"/Users/r/a \"b\"/c"}"#), #"/Users/r/a "b"/c"#)
        XCTAssertNil(SessionSweep.startCwd(head: #"{"type":"summary"}"#))
        func dots(_ cwd: String) -> Bool { SessionSweep.isDots(cwd: cwd, talk: "/Users/r/Dot/talk", agents: "/Users/r/Dot/agents", jobs: "/Users/r/Dot/jobs") }
        XCTAssertTrue(dots("/Users/r/Dot/talk"))
        XCTAssertTrue(dots("/Users/r/Dot/agents/email-project"))
        XCTAssertTrue(dots("/Users/r/Dot/jobs/27k8yt/"))
        // both name the folder -Users-r-Dot-agents-email-project (review, 10-27)
        XCTAssertFalse(dots("/Users/r/Dot/agents-email/project"))
        XCTAssertFalse(dots("/Users/r/Dot/agents/email/project"), "a folder inside an agent's is not its session")
        XCTAssertFalse(dots("/Users/r/Dot/talk/context"))
        XCTAssertFalse(dots("/Users/r/Dot/agents"))
    }

    func testCwdFarIntoTheFile() throws {
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("sweep-\(UUID().uuidString).jsonl")
        defer { try? FileManager.default.removeItem(at: file) }
        // a first record whose screenshot comes before its cwd, across the 1 MiB read boundary
        let shot = String(repeating: "iVBORw0KGgo", count: 110_000)
        try Data(#"{"type":"user","message":{"content":[{"type":"image","data":"\#(shot)"}]},"cwd":"/Users/r/Dot/talk","sessionId":"s"}"#.utf8).write(to: file)
        XCTAssertGreaterThan(try FileManager.default.attributesOfItem(atPath: file.path)[.size] as? Int ?? 0, 1 << 20)
        XCTAssertEqual(SessionSweep.startCwd(file: file), "/Users/r/Dot/talk")
        XCTAssertNil(SessionSweep.startCwd(file: file, limit: 1 << 20), "past the limit it gives up (and the sweep keeps the file)")
    }

    /// Every real Dot session on this Mac is recognised from its own record (none here: skipped).
    func testRealDotSessionsAreRecognised() throws {
        let home = NSHomeDirectory()
        let projects = URL(fileURLWithPath: home).appendingPathComponent(".claude/projects")
        let roots = (talk: home + "/Dot/talk", agents: home + "/Dot/agents", jobs: home + "/Dot/jobs")
        let folders = ((try? FileManager.default.contentsOfDirectory(at: projects, includingPropertiesForKeys: nil)) ?? [])
            .filter { SessionSweep.isDots($0.lastPathComponent, talk: roots.talk, agents: roots.agents, jobs: roots.jobs) }
        var checked = 0
        for folder in folders {
            for file in ((try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []) where file.pathExtension == "jsonl" {
                // a file with no record yet has nothing to find; any other must say where it started
                guard ((try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0) > 2048 else { continue }
                let cwd = SessionSweep.startCwd(file: file)
                XCTAssertNotNil(cwd, "\(folder.lastPathComponent)/\(file.lastPathComponent): no cwd found")
                if let cwd { XCTAssertTrue(SessionSweep.isDots(cwd: cwd, talk: roots.talk, agents: roots.agents, jobs: roots.jobs), "\(folder.lastPathComponent): \(cwd)") }
                checked += 1
            }
        }
        if checked == 0 { throw XCTSkip("no Dot sessions on this Mac") }
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
