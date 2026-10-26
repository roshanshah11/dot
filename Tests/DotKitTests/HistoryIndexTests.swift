import XCTest
@testable import DotKit

final class HistoryIndexTests: XCTestCase {
    var dir: URL!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory.appendingPathComponent("history-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir.appendingPathComponent("transcripts"), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: dir.appendingPathComponent("agents/lab-desk/.dot"), withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws { try? FileManager.default.removeItem(at: dir) }

    func write(_ path: String, _ lines: [String], append: Bool = false, newline: Bool = true) throws {
        let url = dir.appendingPathComponent(path)
        let text = lines.joined(separator: "\n") + (newline ? "\n" : "")
        if append, let handle = try? FileHandle(forWritingTo: url) {
            handle.seekToEndOfFile()
            handle.write(Data(text.utf8))
            try handle.close()
        } else {
            try text.write(to: url, atomically: true, encoding: .utf8)
        }
    }

    var sources: [HistoryIndex.Source] {
        HistoryIndex.sources(transcripts: dir.appendingPathComponent("transcripts"), agentsRoot: dir.appendingPathComponent("agents"),
                             murmur: dir.appendingPathComponent("murmur.jsonl"))
    }

    func seed() throws {
        try write("transcripts/transcripts.jsonl", [
            #"{"kind":"typed","ts":"2026-10-15T16:28:11Z","you":"what's rank","dot":"the dimension of the column space","app":"Safari"}"#,
            #"{"kind":"talk","ts":"2026-10-16T14:00:00Z","you":"draw dna replication for me","dot":"here's the fork"}"#,
            #"{"id":"01JB0000000000000000000000","thread":"dot","kind":"job","ts":"2026-10-21T16:57:13Z","you":"fill this out for me?","dot":""}"#,
            "not json",
        ])
        try write("agents/lab-desk/.dot/transcript.jsonl", [
            #"{"ts":"2026-10-20T10:00:00Z","role":"user","text":"find the rank-nullity proof from lecture"}"#,
            #"{"ts":"2026-10-20T10:00:05Z","role":"tool","text":"Read lecture7.pdf"}"#,
            #"{"ts":"2026-10-20T10:01:00Z","role":"assistant","text":"It is on page 4 of lecture 7."}"#,
        ])
        try write("murmur.jsonl", [
            #"{"cleaned":"","raw":"Uh","id":"A","ts":"2026-10-15T21:19:44.209Z","target_app":"Comet"}"#,
            #"{"cleaned":"Remind the group about the eigenvalue worksheet.","raw":"remind the group","id":"B","ts":"2026-10-17T09:00:00.000Z","target_app":"Messages"}"#,
        ])
    }

    func testQueryBuilding() {
        XCTAssertEqual(HistoryQuery.match("what did I ask about rank-nullity?"), #""rank"* "nullity"*"#)
        XCTAssertEqual(HistoryQuery.match("rank nullity", any: true), #""rank"* OR "nullity"*"#)
        XCTAssertEqual(HistoryQuery.match(#"he said "hi" OR x NEAR(y)"#), #""he" "hi" "or" "x" "near"* "y""#, "nothing in it is FTS syntax")
        XCTAssertEqual(HistoryQuery.match("what did i say"), #""what"* "did"* "i" "say"*"#, "all filler: keep it rather than nothing")
        XCTAssertEqual(HistoryQuery.match("rank rank RANK"), #""rank"*"#)
        XCTAssertNil(HistoryQuery.match("?? --"))
    }

    func testIndexesEverySourceAndSkipsNoise() throws {
        try seed()
        let index = try XCTUnwrap(HistoryIndex(url: dir.appendingPathComponent("index/transcripts.sqlite")))
        XCTAssertEqual(index.refresh(sources), 3 + 2 + 1, "three talk rows, the agent's ask and answer (not its tool call), one dictation (not 'Uh')")
        XCTAssertEqual(index.refresh(sources), 0, "nothing new")
        let rank = index.search("what did I ask about rank")
        XCTAssertEqual(rank.count, 2)
        XCTAssertTrue(rank.contains { $0.kind == "typed" && $0.snippet.contains("\u{2}rank\u{3}") })
        let agent = try XCTUnwrap(rank.first { $0.kind == "agent" })
        XCTAssertEqual(agent.thread, "agent:lab-desk")
        XCTAssertEqual(agent.id, TranscriptRow.legacyID(ts: "2026-10-20T10:00:00Z", kind: "user", text: "find the rank-nullity proof from lecture"),
                       "the same key Home gives the turn, so a hit opens it in its thread")
        XCTAssertEqual(index.search("rank", kinds: ["typed"]).count, 1)
        XCTAssertEqual(index.search("eigenvalue").first?.kind, "dictation")
        XCTAssertEqual(index.search("fork").first?.you, "draw dna replication for me", "Dot's words are searched too")
        XCTAssertEqual(index.search("lecture page").first?.dot, "It is on page 4 of lecture 7.")
        XCTAssertEqual(index.search("rank", days: 3, now: ISO8601DateFormatter().date(from: "2026-10-21T00:00:00Z")!).map(\.kind), ["agent"])
        XCTAssertTrue(index.search("zebra").isEmpty)
        XCTAssertEqual(index.search("rank zebra").count, 2, "no turn has both words, so any word will do")
        XCTAssertEqual(index.days().map(\.count).reduce(0, +), 6)
        XCTAssertEqual(index.days(kinds: ["dictation"]).count, 1)
        let first = try XCTUnwrap(index.days().last?.day)
        XCTAssertFalse(index.turns(day: first).isEmpty)
    }

    func testRefreshIsIncrementalAndSurvivesRewrites() throws {
        try seed()
        let url = dir.appendingPathComponent("index/transcripts.sqlite")
        let index = try XCTUnwrap(HistoryIndex(url: url))
        index.refresh(sources)
        try write("transcripts/transcripts.jsonl", [#"{"kind":"talk","ts":"2026-10-22T12:00:00Z","you":"what's a basis","dot":"a spanning set with no extras"}"#], append: true)
        XCTAssertEqual(index.refresh(sources), 1)
        // a line still being written waits
        try write("transcripts/transcripts.jsonl", [#"{"kind":"talk","ts":"2026-10-22T12:05:00Z","you":"and a dimen"#], append: true, newline: false)
        XCTAssertEqual(index.refresh(sources), 0)
        try write("transcripts/transcripts.jsonl", [#"sion","dot":"how many vectors a basis has"}"#], append: true)
        XCTAssertEqual(index.refresh(sources), 1)
        XCTAssertEqual(index.search("dimension").first?.dot, "how many vectors a basis has")
        // rewritten shorter: read again from the top, nothing doubled
        try write("transcripts/transcripts.jsonl", [#"{"kind":"talk","ts":"2026-10-23T08:00:00Z","you":"only line","dot":"ok"}"#])
        index.refresh(sources)
        XCTAssertEqual(index.search("basis").count, 0)
        XCTAssertEqual(index.count, 1 + 2 + 1)
        // an agent archived away takes its rows along
        try FileManager.default.removeItem(at: dir.appendingPathComponent("agents/lab-desk"))
        index.refresh(sources)
        XCTAssertEqual(index.count, 1 + 1)
        // reopening keeps it; the index is only a copy
        let again = try XCTUnwrap(HistoryIndex(url: url))
        XCTAssertEqual(again.count, 2)
    }

    func testLinesForTheModel() throws {
        try seed()
        let index = try XCTUnwrap(HistoryIndex(url: dir.appendingPathComponent("i.sqlite")))
        index.refresh(sources)
        let text = HistoryIndex.lines(index.search("rank"), query: "rank", timeZone: TimeZone(identifier: "America/Chicago")!)
        XCTAssertTrue(text.hasPrefix("2 from his history for \"rank\""), text)
        XCTAssertTrue(text.contains("Thu Oct 15 2026, 11:28 AM · typed in Safari · he: \"what's rank\" · dot: \"the dimension of the column space\""), text)
        XCTAssertTrue(text.contains("agent lab-desk · he: \"find the rank-nullity proof from lecture\""), text)
        XCTAssertEqual(HistoryIndex.lines([], query: "zebra"), "nothing in his history matches \"zebra\".")
    }

    /// His real history, read only, into a throwaway index: every row lands and a word from it is found.
    func testHisHistoryIndexes() throws {
        let home = URL(fileURLWithPath: NSHomeDirectory())
        let transcripts = home.appendingPathComponent("Dot/transcripts")
        guard FileManager.default.fileExists(atPath: transcripts.appendingPathComponent("transcripts.jsonl").path) else { throw XCTSkip("no talk log here") }
        let index = try XCTUnwrap(HistoryIndex(url: dir.appendingPathComponent("real.sqlite")))
        let sources = HistoryIndex.sources(transcripts: transcripts, agentsRoot: home.appendingPathComponent("Dot/agents"),
                                           murmur: home.appendingPathComponent("Library/Application Support/Murmur/history.jsonl"))
        let added = index.refresh(sources)
        XCTAssertGreaterThan(added, 100)
        let rows = try String(contentsOf: transcripts.appendingPathComponent("transcripts.jsonl"), encoding: .utf8)
        let first = try XCTUnwrap(TranscriptRow.parseAll(rows).first { $0.you.split(separator: " ").count >= 3 })
        let word = try XCTUnwrap(first.you.lowercased().split { !$0.isLetter }.map(String.init).first { $0.count >= 5 && !HistoryQuery.filler.contains($0) })
        XCTAssertFalse(index.search(word).isEmpty, "searching \(word)")
    }
}

final class NotchHomeTests: XCTestCase {
    func testClickOnTheNotchOpensHome() {
        // a 1512 pt screen whose notch spans 663-848 and is 32 pt tall
        let g = NotchGeometry(centerX: 756, topY: 982, notchWidth: 186, notchHeight: 32, hasNotch: true)
        XCTAssertTrue(NotchGeometry.opensHome(CGPoint(x: 756, y: 970), geometry: g, showing: false, control: false))
        XCTAssertTrue(NotchGeometry.opensHome(CGPoint(x: 670, y: 955), geometry: g, showing: false, control: false), "anywhere on the notch")
        XCTAssertFalse(NotchGeometry.opensHome(CGPoint(x: 600, y: 970), geometry: g, showing: false, control: false), "a status item beside it")
        XCTAssertFalse(NotchGeometry.opensHome(CGPoint(x: 756, y: 900), geometry: g, showing: false, control: false), "below the menu bar")
        XCTAssertFalse(NotchGeometry.opensHome(CGPoint(x: 756, y: 970), geometry: g, showing: true, control: false), "the notch shows something")
        XCTAssertFalse(NotchGeometry.opensHome(CGPoint(x: 756, y: 970), geometry: g, showing: false, control: true), "control-click is the menu")
        var flat = g
        flat.hasNotch = false
        XCTAssertFalse(NotchGeometry.opensHome(CGPoint(x: 756, y: 980), geometry: flat, showing: false, control: false), "no notch, nothing to click")
    }
}
