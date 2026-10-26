import XCTest
@testable import DotKit

final class TranscriptRowsTests: XCTestCase {
    func testLegacyRowsGetStableIDs() {
        let line = #"{"kind":"typed","ts":"2026-10-15T16:28:11Z","you":"what's rank","dot":"the dimension of the row space","app":"Safari"}"#
        let a = TranscriptRow.parse(Substring(line))
        let b = TranscriptRow.parse(Substring(line))
        XCTAssertNotNil(a)
        XCTAssertEqual(a?.id, b?.id, "computed on read, the same every time")
        XCTAssertEqual(a?.id.count, 16)
        XCTAssertEqual(a?.thread, "dot")
        XCTAssertEqual(a?.legacy, true)
        XCTAssertEqual(a?.id, TranscriptRow.legacyID(ts: "2026-10-15T16:28:11Z", kind: "typed", text: "what's rank"))
        let other = TranscriptRow.parse(Substring(line.replacingOccurrences(of: "what's rank", with: "what's span")))
        XCTAssertNotEqual(a?.id, other?.id)
    }

    func testNewRowsKeepTheirIDAndThread() {
        let id = ULID.make(at: Date(timeIntervalSince1970: 1_800_000_000))
        let line = #"{"id":"\#(id)","thread":"agent:scout","kind":"agent","ts":"2026-10-26T13:00:00Z","you":"x"}"#
        let row = TranscriptRow.parse(Substring(line))
        XCTAssertEqual(row?.id, id)
        XCTAssertEqual(row?.thread, "agent:scout")
        XCTAssertEqual(row?.legacy, false)
        XCTAssertNil(TranscriptRow.parse("not json"))
        XCTAssertNil(TranscriptRow.parse(#"{"you":"no time"}"#))
    }

    func testULIDShapeAndOrder() {
        let zero = [UInt8](repeating: 0, count: 10)
        let a = ULID.make(at: Date(timeIntervalSince1970: 1_800_000_000), random: zero)
        let b = ULID.make(at: Date(timeIntervalSince1970: 1_800_000_001), random: zero)
        XCTAssertTrue(ULID.isValid(a))
        XCTAssertEqual(a.count, 26)
        XCTAssertLessThan(a, b, "later ids sort later")
        XCTAssertEqual(ULID.make(at: Date(timeIntervalSince1970: 0), random: zero), String(repeating: "0", count: 26))
        // the spec's known value: 1469918176385 ms -> "01ARYZ6S41" for the time part
        XCTAssertEqual(String(ULID.make(at: Date(timeIntervalSince1970: 1_469_918_176.385), random: zero).prefix(10)), "01ARYZ6S41")
        XCTAssertNotEqual(ULID.make(), ULID.make())
    }

    func testScrollRestoreRule() {
        let turns = ["a", "b", "c", "d"]
        XCTAssertEqual(ScrollRestore.decide(savedAnchor: nil, savedNewest: nil, turns: turns), .end)
        XCTAssertEqual(ScrollRestore.decide(savedAnchor: "b", savedNewest: "d", turns: turns), .anchor("b"))
        XCTAssertEqual(ScrollRestore.decide(savedAnchor: "b", savedNewest: "c", turns: turns), .endWithNew(1))
        XCTAssertEqual(ScrollRestore.decide(savedAnchor: "gone", savedNewest: "d", turns: turns), .end)
        XCTAssertEqual(ScrollRestore.decide(savedAnchor: "b", savedNewest: nil, turns: turns), .anchor("b"))
    }

    /// The upgrade test: the real ~/Dot/transcripts tree, copied, read through the contract: no source file changes and
    /// every row gets an id. Skipped where the tree isn't there.
    func testRealTranscriptsUpgradeIsReadOnly() throws {
        let source = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Dot/transcripts")
        guard FileManager.default.fileExists(atPath: source.path) else { throw XCTSkip("no ~/Dot/transcripts here") }
        let copy = FileManager.default.temporaryDirectory.appendingPathComponent("transcripts-\(UUID().uuidString)")
        try FileManager.default.copyItem(at: source, to: copy)
        defer { try? FileManager.default.removeItem(at: copy) }
        func hashes() throws -> [String: String] {
            var out: [String: String] = [:]
            for name in try FileManager.default.contentsOfDirectory(atPath: copy.path) where !name.hasPrefix(".") {
                let url = copy.appendingPathComponent(name)
                var isDir: ObjCBool = false
                guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir), !isDir.boolValue else { continue }
                out[name] = TranscriptRow.legacyID(ts: "", kind: "", text: (try? String(contentsOf: url, encoding: .utf8)) ?? "")
            }
            return out
        }
        let before = try hashes()
        let text = try String(contentsOf: copy.appendingPathComponent("transcripts.jsonl"), encoding: .utf8)
        let lines = text.split(whereSeparator: \.isNewline).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        let rows = TranscriptRow.parseAll(text)
        XCTAssertEqual(rows.count, lines.count, "every line is a row with an id")
        XCTAssertTrue(rows.allSatisfy { !$0.id.isEmpty })
        XCTAssertEqual(Set(rows.map(\.id)).count, rows.count, "ids are unique")
        XCTAssertEqual(try hashes(), before, "reading never writes")
    }
}
