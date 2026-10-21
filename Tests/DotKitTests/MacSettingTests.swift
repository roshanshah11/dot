import XCTest
@testable import DotKit

/// Mac settings by name (2026-10-21: "turn on my bluetooth" became a job that failed after 22 s).
final class MacSettingTests: XCTestCase {
    private func setting(_ text: String) -> MacSetting? {
        if case .setting(let s)? = ActionPhrases.match(text) { return s }
        return nil
    }

    func testHisWordsAreInstantSettings() {
        XCTAssertEqual(setting("Can you uh turn on my Bluetooth?"), .bluetooth(on: true))
        XCTAssertEqual(setting("turn bluetooth off"), .bluetooth(on: false))
        XCTAssertEqual(setting("disable bluetooth"), .bluetooth(on: false))
        XCTAssertEqual(setting("bluetooth on please"), .bluetooth(on: true))
        XCTAssertEqual(setting("turn off the wifi"), .wifi(on: false))
        XCTAssertEqual(setting("turn the wi-fi on"), .wifi(on: true))
        XCTAssertEqual(setting("switch to dark mode"), .darkMode(on: true))
        XCTAssertEqual(setting("turn off dark mode"), .darkMode(on: false))
        XCTAssertEqual(setting("switch to light mode"), .darkMode(on: false))
        XCTAssertEqual(setting("turn the volume up"), .volume(.up))
        XCTAssertEqual(setting("turn down the volume"), .volume(.down))
        XCTAssertEqual(setting("set the volume to 30 percent"), .volume(.set(30)))
        XCTAssertEqual(setting("mute"), .volume(.mute))
        XCTAssertEqual(setting("unmute the sound"), .volume(.unmute))
    }

    func testLookAlikesAreNotSettings() {
        XCTAssertNil(setting("what is bluetooth"))
        XCTAssertNil(setting("why is my wifi so slow"))
        XCTAssertNil(setting("turn on the lights"))
        XCTAssertEqual(ActionPhrases.match("pause the music"), .media(.playPause))
        XCTAssertNil(setting("mute sam rivera in the group chat"))
    }

    func testTheTagAndTheJobToolReadTheSameWords() {
        XCTAssertEqual(ActionTags.make(kind: "SETTING", payload: "bluetooth on"), .setting(.bluetooth(on: true)))
        XCTAssertEqual(ActionTags.make(kind: "SETTING", payload: "volume 150"), .setting(.volume(.set(100))))
        XCTAssertEqual(MacSetting.parse("wifi off"), .wifi(on: false))
        XCTAssertNil(MacSetting.parse("bluetooth"))
        for s: MacSetting in [.bluetooth(on: true), .wifi(on: false), .darkMode(on: true), .volume(.up), .volume(.set(30)), .volume(.mute), .volume(.unmute)] {
            XCTAssertEqual(MacSetting.parse(s.words), s, "\(s.words) reads back")
        }
        XCTAssertEqual(TagParser.parse("[SETTING:bluetooth on] switching bluetooth on.").tags, [.act(.setting(.bluetooth(on: true)))])
    }
}
