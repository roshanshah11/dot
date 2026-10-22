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

    /// 10-21 19:42, his words after "turn off my bluetooth".
    func testBackOnAndTurnItBackOn() {
        XCTAssertEqual(setting("Turn my Bluetooth back on."), .bluetooth(on: true))
        XCTAssertEqual(setting("turn the wifi off again"), .wifi(on: false))
        XCTAssertEqual(ActionPhrases.settingAgain("Turn it back on.", last: .bluetooth(on: false)), .bluetooth(on: true))
        XCTAssertEqual(ActionPhrases.settingAgain("switch that off again", last: .wifi(on: true)), .wifi(on: false))
        XCTAssertEqual(ActionPhrases.settingAgain("turn it up", last: .volume(.down)), .volume(.up))
        XCTAssertNil(ActionPhrases.settingAgain("turn it up", last: .bluetooth(on: false)))
        XCTAssertNil(ActionPhrases.settingAgain("turn it into a pdf", last: .bluetooth(on: false)))
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

/// The Spotify app's own controls (10-21, "also control my spotify app").
final class SpotifyControlTests: XCTestCase {
    private func control(_ text: String) -> SpotifyControl? {
        if case .spotify(let c)? = ActionPhrases.match(text) { return c }
        return nil
    }

    func testHisWaysOfAsking() {
        XCTAssertEqual(control("turn on shuffle"), .shuffle(true))
        XCTAssertEqual(control("shuffle off"), .shuffle(false))
        XCTAssertEqual(control("can you shuffle my music"), .shuffle(true))
        XCTAssertEqual(control("repeat this song"), .repeatSong(true))
        XCTAssertEqual(control("turn off repeat"), .repeatSong(false))
        XCTAssertEqual(control("stop repeating"), .repeatSong(false))
        XCTAssertEqual(control("restart the song"), .restart)
        XCTAssertEqual(control("skip ahead 30 seconds"), .seek(30))
        XCTAssertEqual(control("rewind 10 seconds"), .seek(-10))
        XCTAssertEqual(control("turn spotify down"), .volume(.down))
        XCTAssertEqual(control("set spotify volume to 40"), .volume(.set(40)))
        XCTAssertEqual(control("what song is this?"), .nowPlaying)
        XCTAssertEqual(control("who sings this"), .nowPlaying)
        XCTAssertEqual(control("what's playing"), .nowPlaying)
    }

    func testTheRestStaysAsItWas() {
        XCTAssertEqual(ActionPhrases.match("next song"), .media(.next))
        XCTAssertEqual(ActionPhrases.match("pause the music"), .media(.playPause))
        XCTAssertEqual(ActionPhrases.match("turn the volume up"), .setting(.volume(.up)))
        XCTAssertNil(control("what is this song about"))
        XCTAssertNil(control("repeat that"))
    }

    func testTheTagAndTheJobToolReadTheSameWords() {
        for c: SpotifyControl in [.play, .pause, .next, .previous, .restart, .nowPlaying, .seek(30), .seek(-10), .shuffle(true), .repeatSong(false), .volume(.set(40))] {
            XCTAssertEqual(SpotifyControl.parse(c.words), c, "\(c.words) reads back")
        }
        XCTAssertEqual(TagParser.parse("[SPOTIFY:shuffle on] shuffling.").tags, [.act(.spotify(.shuffle(true)))])
    }
}

/// Spotify on another device, liking, moving (10-21 19:43: "...put on my chill playlist but play it on phone").
final class SpotifyDeviceTests: XCTestCase {
    func testHisSentenceGoesToHisPhone() {
        XCTAssertEqual(ActionPhrases.match("Can you open my Spotify and put on my chill playlist but play it on phone."),
                       .play(SpotifyPlay(kind: .playlist, words: "chill", mine: true, device: "phone")))
        XCTAssertEqual(ActionPhrases.match("play my road trip playlist on my phone"),
                       .play(SpotifyPlay(kind: .playlist, words: "road trip", mine: true, device: "phone")))
        XCTAssertEqual(ActionPhrases.match("put on lofi on the tv"), .play(SpotifyPlay(kind: .playlist, words: "lofi", device: "tv")))
        // no device: where it plays now, as before
        XCTAssertEqual(ActionPhrases.match("play my road trip playlist"), .play(SpotifyPlay(kind: .playlist, words: "road trip", mine: true)))
    }

    func testLikeAndMove() {
        XCTAssertEqual(ActionPhrases.match("like this song"), .spotify(.like))
        XCTAssertEqual(ActionPhrases.match("add this song to my liked songs"), .spotify(.like))
        XCTAssertEqual(ActionPhrases.match("move it to my phone"), .spotify(.moveTo("phone")))
        XCTAssertEqual(ActionPhrases.match("switch the music to the tv"), .spotify(.moveTo("tv")))
        XCTAssertNil(ActionPhrases.match("i like this song"))
    }

    func testTagsAndToolWords() {
        XCTAssertEqual(ActionTags.make(kind: "PLAY", payload: "playlist:my chill@phone"), .play(SpotifyPlay(kind: .playlist, words: "chill", mine: true, device: "phone")))
        XCTAssertEqual(ActionTags.make(kind: "SPOTIFY", payload: "move phone"), .spotify(.moveTo("phone")))
        XCTAssertEqual(SpotifyControl.parse("like"), .like)
        XCTAssertEqual(SpotifyControl.parse(SpotifyControl.moveTo("tv").words), .moveTo("tv"))
    }
}

/// Questions about his things go to talk, not a job (10-21 top-sites pass: five of them became 10 to 30 s jobs).
final class LookupQuestionTests: XCTestCase {
    func testHisQuestionsAreAnswers() {
        for q in ["what did alexander white say in his last email", "what's due this week for my classes", "what are my bio readings for thursday",
                  "any new wyzant messages", "what did sam text me last", "where does my northwind application stand", "where is my resume",
                  "Can you tell me what's on my calendar tomorrow?", "did sam rivera reply to me", "how many emails do i have from northwind bank"] {
            XCTAssertTrue(JobWords.isLookupQuestion(q), q)
        }
    }

    func testDoingStaysAJob() {
        for d in ["can you open my outlook", "download my bio readings", "find investment banking jobs on handshake posted this week",
                  "can you text sam that i'm running late", "any chance you can download the readings", "what's up, open spotify",
                  "go to canvas and get my readings", "fill this out for me"] {
            XCTAssertFalse(JobWords.isLookupQuestion(d), d)
        }
    }
}

/// A job keeps his tab unless he said to use it (10-21: two front jobs replaced the page he was on).
final class ThisTabTests: XCTestCase {
    func testOnlyHisWordsGiveAwayHisTab() {
        XCTAssertTrue(JobWords.saysThisTab("open youtube in this tab"))
        XCTAssertTrue(JobWords.saysThisTab("open my outlook here"))
        XCTAssertTrue(JobWords.saysThisTab("go to canvas in the same tab"))
        XCTAssertFalse(JobWords.saysThisTab("find a youtube video explaining eigenvalues"))
        XCTAssertFalse(JobWords.saysThisTab("open my last chatgpt conversation"))
        XCTAssertFalse(JobWords.saysThisTab("where is the here and now chapter"))
    }
}
