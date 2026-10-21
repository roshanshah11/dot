import XCTest
@testable import DotKit

/// His own Spotify library (2026-10-21): the matcher on the placeholder library in Tests/Fixtures/spotify, held to the same
/// answers as scripts/dot-spotify-library.py (scripts/test_dot_spotify_library.py reads the same cases).
final class SpotifyLibraryTests: XCTestCase {
    static let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Fixtures/spotify")

    func fixture(_ name: String) throws -> Data { try Data(contentsOf: Self.fixtures.appendingPathComponent(name)) }

    func library() throws -> [SpotifyLibrary.Entry] {
        SpotifyLibrary.parse(String(decoding: try fixture("library.json"), as: UTF8.self))
    }

    func cases() throws -> [String: Any] {
        try XCTUnwrap(JSONSerialization.jsonObject(with: try fixture("match-cases.json")) as? [String: Any])
    }

    func testParseTheIndexFile() throws {
        let entries = try library()
        // Liked Songs first; the bad uri and the empty name are dropped
        XCTAssertEqual(entries.count, 14)
        XCTAssertEqual(entries.first, SpotifyLibrary.Entry(uri: "spotify:user:example:collection", name: "Liked Songs", ownerIsHim: true, order: -1))
        XCTAssertTrue(entries.first?.isLiked == true)
        XCTAssertEqual(entries[2].name, "Road Trip \u{1F697}")
        XCTAssertFalse(entries.contains { $0.uri.contains("not-a-real-id") || $0.name.isEmpty })
    }

    func testParseTheScriptLines() {
        let out = """
        {"uri": "spotify:user:example:collection", "name": "Liked Songs", "owner_is_him": true, "order": -1}
        {"uri": "spotify:playlist:Fixture000000000000001", "name": "Study Mix", "owner_is_him": true, "order": 0}
        {"uri": "spotify:track:Fixture000000000000001", "name": "Not a playlist", "owner_is_him": true, "order": 1}
        not json
        {"uri": "spotify:playlist:Fixture000000000000002", "name": "Road Trip", "owner_is_him": false, "order": 2}
        """
        let entries = SpotifyLibrary.parse(out)
        XCTAssertEqual(entries.map(\.name), ["Liked Songs", "Study Mix", "Road Trip"])
        XCTAssertEqual(entries.map(\.ownerIsHim), [true, true, false])
        XCTAssertEqual(SpotifyLibrary.parse(""), [])
    }

    func testNormalize() throws {
        let rows = try XCTUnwrap(try cases()["normalize"] as? [[String]])
        XCTAssertFalse(rows.isEmpty)
        for row in rows { XCTAssertEqual(SpotifyLibrary.normalize(row[0]), row[1], row[0]) }
    }

    func testPicksMatchTheSharedCases() throws {
        let entries = try library()
        let rows = try XCTUnwrap(try cases()["picks"] as? [[String: Any]])
        XCTAssertGreaterThan(rows.count, 20)
        for row in rows {
            let words = try XCTUnwrap(row["words"] as? String)
            let mine = try XCTUnwrap(row["mine"] as? Bool)
            let label = "\(mine ? "my " : "")\(words)"
            let pick = SpotifyLibrary.pick(SpotifyPlay(kind: .playlist, words: words, mine: mine), in: entries)
            XCTAssertEqual(pick?.uri, row["pick"] as? String, label)
            let best = SpotifyLibrary.rank(words, in: entries).first?.match
            let want: SpotifyLibrary.Match? = (row["match"] as? String).map { ["exact": .exact, "everyWord": .everyWord, "close": .close][$0]! }
            XCTAssertEqual(best, want, label)
        }
    }

    func testOnlyPlaylistsComeFromTheLibrary() throws {
        let entries = try library()
        for kind in [SpotifyPlay.Kind.track, .album, .artist] {
            XCTAssertNil(SpotifyLibrary.pick(SpotifyPlay(kind: kind, words: "study mix", mine: true), in: entries), kind.rawValue)
        }
        XCTAssertNil(SpotifyLibrary.pick(SpotifyPlay(kind: .playlist, words: "study mix", mine: true), in: []))
    }

    func testRankOrder() {
        let entries = [
            SpotifyLibrary.Entry(uri: "spotify:playlist:Fixture000000000000101", name: "Study Mix Two", ownerIsHim: false, order: 0),
            SpotifyLibrary.Entry(uri: "spotify:playlist:Fixture000000000000102", name: "Late Study Mix", ownerIsHim: true, order: 1),
            SpotifyLibrary.Entry(uri: "spotify:playlist:Fixture000000000000103", name: "Study Mix", ownerIsHim: false, order: 2),
            SpotifyLibrary.Entry(uri: "spotify:playlist:Fixture000000000000104", name: "Study Mi", ownerIsHim: true, order: 3),
        ]
        let ranked = SpotifyLibrary.rank("study mix", in: entries)
        XCTAssertEqual(ranked.map(\.entry.order), [2, 1, 0, 3])
        XCTAssertEqual(ranked.map(\.match), [.exact, .everyWord, .everyWord, .close])
    }
}
