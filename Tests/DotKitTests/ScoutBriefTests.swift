import XCTest
@testable import DotKit

/// Fixtures in the shape scripts/dot-scout.py writes to ~/Dot/briefs/<date>.json.
enum ScoutFixtures {
    static let good = #"""
    {
      "date": "2026-10-17",
      "generated": "2026-10-17T06:31:12-05:00",
      "briefs": [
        {
          "id": "huma-class-prep",
          "title": "Walk into every HUMA seminar with three points to say",
          "short": "prepping Citizen",
          "description": "Today's seminar is Citizen II; I'll read it and prep your points, then do it before each class.",
          "brief": "Goal: Roshan walks into today's HUMA 17000 session ready.\n\nRUN 1 (do it fully now):\n1. Read the assigned pages.\n2. Deliver three points and two questions in the reply.\n\nEVERY LATER RUN (daily): read output/class-prep/schedule.md, prep the next session not yet done, and update the file. If nothing is coming up, say so in one line.\n\nOpen inputs:\n- the syllabus link",
          "baseline": "output/class-prep/schedule.md",
          "routine": {"when": "every day at 7am", "title": "Class reading prep"},
          "agent": {"name": "Seminar Scribe", "new": true, "role": "Class prepper"},
          "sources": [
            {"kind": "canvas", "id": "73773/assignment/912", "link": "https://canvas.uchicago.edu/courses/73773/assignments/912", "date": "2026-10-15",
             "quote": "October 17: Citizen II and language on trial", "situation": "The session is today.", "unclear": "Which pages count."},
            {"kind": "web", "id": "https://www.amacad.org/publication/language-on-trial", "quote": "This essay draws on the case study"}
          ],
          "inputs": ["the syllabus link"]
        },
        {
          "id": "citizen-coffee-chat",
          "title": "A one-page brief on Jane Doe before Friday's call",
          "description": "Your call with Jane Doe (Citizens) is Friday at 2; I'll read her and the firm.",
          "brief": "Goal: a brief before the call.\n\nRUN 1 (do it fully now):\n1. Research her and the firm.\n2. Reply with the brief.",
          "agent": {"name": "Dot"},
          "sources": [{"kind": "calendar", "id": "a1b2c3d4", "date": "2026-10-17", "quote": "Call: Jane Doe (Citizens)"}]
        }
      ]
    }
    """#

    /// Two good items and four bad ones: no RUN 1, a three-word new agent, web sources only, a string for an item.
    static let partial = #"""
    {
      "date": "2026-10-17",
      "briefs": [
        {"id": "week-plan", "title": "A Sunday plan for the week", "description": "I'll lay out the week.",
         "brief": "Goal: a plan.\nRUN 1 (do it fully now): read the calendar and commitments; reply with the plan.\nEVERY LATER RUN (weekly): read the baseline and report what changed.",
         "routine": {"when": "sometime soonish", "title": "Week plan"}, "baseline": "output/week/baseline.md",
         "agent": {"name": "Week Keeper", "new": true, "role": "Planner"},
         "sources": [{"kind": "commitment", "id": "c:1234abcd", "quote": "Send the deck to Saket by Monday"}, {"kind": "mail", "id": "", "quote": "no id"}]},
        {"id": "no-run", "title": "Something", "description": "x", "brief": "Do the thing.", "agent": {"name": "Dot"},
         "sources": [{"kind": "mail", "id": "deadbeef", "quote": "q"}]},
        {"id": "long-name", "title": "Something", "description": "x", "brief": "RUN 1: go", "agent": {"name": "The Intern Radar", "new": true, "role": "r"},
         "sources": [{"kind": "mail", "id": "deadbeef", "quote": "q"}]},
        {"id": "web-only", "title": "Something", "description": "x", "brief": "RUN 1: go", "agent": {"name": "Dot"},
         "sources": [{"kind": "web", "id": "https://example.com", "quote": "q"}]},
        "not a brief",
        {"id": "postings-scan", "title": "Rank this week's new postings", "description": "Twelve new postings came in.", "brief": "RUN 1 (do it fully now): rank them.",
         "agent": {"name": "Dot", "new": false}, "sources": [{"kind": "posting", "id": "p:99", "quote": "Summer Analyst 2027"}]}
      ]
    }
    """#

    static let broken = #"{"date": "2026-10-17", "briefs": [ {"id": "x", "#
}

final class ScoutBriefTests: XCTestCase {
    func testGoodFileDecodesEverything() throws {
        let file = try XCTUnwrap(ScoutBriefFile.decode(Data(ScoutFixtures.good.utf8)))
        XCTAssertEqual(file.date, "2026-10-17")
        XCTAssertEqual(file.briefs.map(\.id), ["huma-class-prep", "citizen-coffee-chat"])
        XCTAssertEqual(file.problems, [])
        let first = file.briefs[0]
        XCTAssertEqual(first.agent, ScoutBrief.Agent(name: "Seminar Scribe", isNew: true, role: "Class prepper"))
        XCTAssertEqual(first.routine, ScoutBrief.Routine(when: "every day at 7am", title: "Class reading prep"))
        XCTAssertEqual(first.sources.count, 2)
        XCTAssertEqual(first.short, "prepping Citizen")
        XCTAssertEqual(first.inputs, ["the syllabus link"])
        XCTAssertTrue(first.laterRuns?.hasPrefix("EVERY LATER RUN (daily)") == true)
        XCTAssertFalse(first.laterRuns?.contains("syllabus link") == true)
        XCTAssertEqual(first.goal, "Goal: Roshan walks into today's HUMA 17000 session ready.")
        XCTAssertNil(file.briefs[1].routine)
        XCTAssertFalse(file.briefs[1].agent.isNew)
    }

    func testPartialFileKeepsTheValidItems() throws {
        let file = try XCTUnwrap(ScoutBriefFile.decode(Data(ScoutFixtures.partial.utf8)))
        XCTAssertEqual(file.briefs.map(\.id), ["week-plan", "postings-scan"])
        // The routine that does not say when is dropped; the brief stays, minus its bad source.
        XCTAssertNil(file.briefs[0].routine)
        XCTAssertEqual(file.briefs[0].sources.map(\.id), ["c:1234abcd"])
        let problems = file.problems.joined(separator: "\n")
        for word in ["no-run: the brief has no RUN 1", "long-name: a new agent's name must be two words", "web-only: no source from Atlas",
                     "item 5: not a brief", "week-plan: routine dropped"] {
            XCTAssertTrue(problems.contains(word), word)
        }
    }

    func testBrokenFileIsNotABriefsFile() {
        XCTAssertNil(ScoutBriefFile.decode(Data(ScoutFixtures.broken.utf8)))
        XCTAssertNil(ScoutBriefFile.decode(Data(#"{"briefs": "none"}"#.utf8)))
        XCTAssertNil(ScoutBriefFile.decode(Data("[]".utf8)))
    }

    func testAtMostSevenAndFirstIdWins() throws {
        let one = #"{"id": "same", "title": "t", "description": "d", "brief": "RUN 1: go", "agent": {"name": "Dot"}, "sources": [{"kind": "mail", "id": "deadbeef", "quote": "q"}]}"#
        let many = (1...9).map { one.replacingOccurrences(of: "\"same\"", with: "\"idea-\($0)\"") }
        let json = #"{"date": "2026-10-17", "briefs": ["# + ([one, one] + many).joined(separator: ",") + "]}"
        let file = try XCTUnwrap(ScoutBriefFile.decode(Data(json.utf8)))
        XCTAssertEqual(file.briefs.count, 7)
        XCTAssertEqual(file.briefs.first?.id, "same")
        XCTAssertTrue(file.problems.contains("same: a second brief with this id was dropped"))
    }

    func testOnlyTodaysFileLoads() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("scout-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd HH:mm"; f.locale = Locale(identifier: "en_US_POSIX")
        let today = f.date(from: "2026-10-17 07:30")!
        let tomorrow = f.date(from: "2026-10-18 07:30")!
        try Data(ScoutFixtures.good.utf8).write(to: ScoutBriefFile.url(in: folder, for: today))
        XCTAssertEqual(ScoutBriefFile.load(from: folder, today: today)?.briefs.count, 2)
        // The next morning there is no file for that day, so yesterday's ideas are gone.
        XCTAssertNil(ScoutBriefFile.load(from: folder, today: tomorrow))
        // A file named for today whose contents say another day does not count either.
        try Data(ScoutFixtures.good.utf8).write(to: ScoutBriefFile.url(in: folder, for: tomorrow))
        XCTAssertNil(ScoutBriefFile.load(from: folder, today: tomorrow))
    }

    /// A real scout output: `DOT_SCOUT_FILE=/path/2026-10-17.json swift test --filter ScoutBriefTests`.
    func testRealScoutFileWhenGiven() throws {
        guard let path = ProcessInfo.processInfo.environment["DOT_SCOUT_FILE"] else { throw XCTSkip("set DOT_SCOUT_FILE to check a real briefs file") }
        let data = try Data(contentsOf: URL(fileURLWithPath: path))
        let file = try XCTUnwrap(ScoutBriefFile.decode(data), "not a briefs file")
        print("scout file \(file.date): \(file.briefs.count) valid: " + file.briefs.map { "\($0.id) [\($0.agent.name)\($0.routine.map { ", " + $0.when } ?? "")] \($0.title)" }.joined(separator: " | "))
        print("scout problems: \(file.problems)")
        XCTAssertGreaterThanOrEqual(file.briefs.count, 3)
    }

    func testWhereThisCameFromCarriesEachRecord() throws {
        let brief = try XCTUnwrap(ScoutBriefFile.decode(Data(ScoutFixtures.good.utf8))?.briefs.first)
        let block = ScoutBrief.whereThisCameFrom(brief.sources)
        XCTAssertTrue(block.hasPrefix("WHERE THIS CAME FROM\n"))
        XCTAssertTrue(block.contains("1. canvas · id 73773/assignment/912 · 2026-10-15 · https://canvas.uchicago.edu/courses/73773/assignments/912"))
        XCTAssertTrue(block.contains("   What was read: \"October 17: Citizen II and language on trial\""))
        XCTAssertTrue(block.contains("   Situation: The session is today."))
        XCTAssertTrue(block.contains("   Unclear: Which pages count."))
        XCTAssertTrue(block.contains("2. web · id https://www.amacad.org/publication/language-on-trial"))
        XCTAssertFalse(block.contains("\u{2014}"))
    }
}
