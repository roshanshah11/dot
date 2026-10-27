import XCTest
@testable import DotKit

final class ChordsTests: XCTestCase {
    let talk = Chord.conversationDefault, dictate = Chord.dictationDefault

    func testTodaysChordsMatchExactly() {
        XCTAssertEqual(ChordMatch.pressed([.control, .option], conversation: talk, dictation: dictate), .talk)
        XCTAssertEqual(ChordMatch.pressed([.control, .option, .shift], conversation: talk, dictation: dictate), .agent)
        XCTAssertEqual(ChordMatch.pressed([.control, .fn], conversation: talk, dictation: dictate), .dictate)
        XCTAssertNil(ChordMatch.pressed([.control, .option, .command], conversation: talk, dictation: dictate), "command on top is not the chord")
        XCTAssertNil(ChordMatch.pressed([.control], conversation: talk, dictation: dictate))
        XCTAssertTrue(ChordMatch.held(.talk, [.control, .option, .shift], conversation: talk, dictation: dictate), "shift mid-hold keeps it held")
        XCTAssertFalse(ChordMatch.held(.talk, [.control], conversation: talk, dictation: dictate), "letting go of option ends it")
    }

    func testAKeyedChord() {
        let space = Chord([.option], keyCode: 49, keyLabel: "Space")
        XCTAssertNil(ChordRules.problem(space, conversation: true))
        XCTAssertEqual(ChordMatch.pressed(key: 49, [.option], conversation: space, dictation: dictate), .talk)
        XCTAssertEqual(ChordMatch.pressed(key: 49, [.option, .shift], conversation: space, dictation: dictate), .agent)
        XCTAssertNil(ChordMatch.pressed(key: 49, [.option, .command], conversation: space, dictation: dictate))
        XCTAssertNil(ChordMatch.pressed([.option], conversation: space, dictation: dictate), "a keyed chord doesn't fire on modifiers alone")
        let arrow = Chord([.control, .option], keyCode: 126, keyLabel: "↑")
        XCTAssertEqual(ChordMatch.pressed(key: 126, [.control, .option, .fn], conversation: talk, dictation: arrow), .dictate, "macOS's fn flag on arrows is ignored")
    }

    func testRefusals() {
        XCTAssertNotNil(ChordRules.problem(Chord([.option]), conversation: true), "one modifier")
        XCTAssertNotNil(ChordRules.problem(Chord([.control, .shift]), conversation: true), "shift is the agent switch")
        XCTAssertNil(ChordRules.problem(Chord([.control, .shift]), conversation: false), "fine for dictation")
        XCTAssertNotNil(ChordRules.problem(Chord([], keyCode: 2, keyLabel: "D"), conversation: false), "a bare key")
        XCTAssertNotNil(ChordRules.problem(Chord([.shift], keyCode: 2, keyLabel: "D"), conversation: false), "shift+D types a capital")
        XCTAssertNotNil(ChordRules.problem(Chord([.command], keyCode: 49, keyLabel: "Space"), conversation: true), "Spotlight")
        XCTAssertNotNil(ChordRules.problem(Chord([.command, .shift], keyCode: 21, keyLabel: "4"), conversation: false), "screenshot")
        XCTAssertNotNil(ChordRules.problem(Chord([.control], keyCode: 124, keyLabel: "→"), conversation: false), "Spaces")
        XCTAssertNotNil(ChordRules.clash(conversation: talk, dictation: talk))
        XCTAssertNotNil(ChordRules.clash(conversation: talk, dictation: Chord([.control, .option, .shift])), "agent mode")
        XCTAssertNil(ChordRules.clash(conversation: talk, dictation: dictate))
        // one modifier-only chord inside the other: the smaller one fires first and blocks the bigger one
        let dKey = Chord([.control, .option], keyCode: 2, keyLabel: "D")
        XCTAssertNotNil(ChordRules.clash(conversation: talk, dictation: dKey), "control+option starts talk before D")
        XCTAssertNotNil(ChordRules.clash(conversation: talk, dictation: Chord([.control, .option, .command])))
        XCTAssertNotNil(ChordRules.clash(conversation: Chord([.control, .option, .command]), dictation: talk), "either way round")
        XCTAssertNotNil(ChordRules.clash(conversation: Chord([.control, .fn], keyCode: 49, keyLabel: "Space"), dictation: dictate))
        XCTAssertNil(ChordRules.clash(conversation: Chord([.option], keyCode: 49, keyLabel: "Space"), dictation: dKey), "two keyed chords match exactly")
        XCTAssertNil(ChordRules.clash(conversation: Chord([.option, .command]), dictation: dKey), "option+command isn't inside control+option")
    }

    func testFallbackAndMigration() throws {
        let bad = ChordRules.effective(conversation: Chord([.option]), dictation: dictate)
        XCTAssertEqual(bad.conversation, talk)
        XCTAssertNotNil(bad.fallback)
        XCTAssertNil(ChordRules.effective(conversation: talk, dictation: dictate).fallback)
        // a saved chord round-trips through the config's JSON
        let saved = Chord([.option, .command], keyCode: 49, keyLabel: "Space")
        let data = try JSONEncoder().encode(saved)
        XCTAssertEqual(try JSONDecoder().decode(Chord.self, from: data), saved)
        XCTAssertEqual(saved.caps, ["⌥ option", "⌘ command", "Space"])
        XCTAssertEqual(saved.words, "option+command+space")
        XCTAssertEqual(Chord.conversationDefault.words, "control+option")
    }
}
