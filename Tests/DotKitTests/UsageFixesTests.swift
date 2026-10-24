import XCTest
@testable import DotKit

/// Edge cases from his real use, 2026-10-15 to 10-19 (~/Dot/transcripts).
final class SharedTurnsTests: XCTestCase {
    let t0 = Date(timeIntervalSince1970: 1_800_000_000)

    func testThinkSeesTheTalkAnswerItIsAskedToShow() {
        // 10-19 08:58: talk answered 0.1(a); "show it to me" went to think, which had last done 0.3.
        var shared = SharedTurns()
        shared.record(.think, asked: "explain 0.3 visually", said: "putting the whole of 0.3 on the panel.", at: t0)
        shared.record(.talk, asked: "what's the answer to 0.1 a?", said: "part a on mock b is false.", at: t0.addingTimeInterval(300))
        shared.record(.talk, asked: "can you show it to me?", said: "putting the check on the panel.", at: t0.addingTimeInterval(320), handedOff: true)
        let unseen = shared.unseen(by: .think, now: t0.addingTimeInterval(321))
        XCTAssertEqual(unseen.map(\.asked), ["what's the answer to 0.1 a?"], "the handoff carries its own turn; the one before it rides along")
        let lines = SharedTurns.lines(unseen)
        XCTAssertEqual(lines.count, 2)
        XCTAssertTrue(lines[1].contains("part a on mock b is false."))
    }

    func testOnlyWhatTheOtherSideSaidSinceThisSideSpoke() {
        var shared = SharedTurns()
        shared.record(.talk, asked: "a", said: "one", at: t0)
        shared.record(.think, asked: "b", said: "two", at: t0.addingTimeInterval(10))
        shared.record(.talk, asked: "c", said: "three", at: t0.addingTimeInterval(20))
        XCTAssertEqual(shared.unseen(by: .think, now: t0.addingTimeInterval(30)).map(\.asked), ["c"])
        XCTAssertEqual(shared.unseen(by: .talk, now: t0.addingTimeInterval(30)).map(\.asked), [], "talk spoke after think's turn")
    }

    func testOldAndManyTurnsAreCapped() {
        var shared = SharedTurns(keep: 5)
        for i in 0..<8 { shared.record(.talk, asked: "q\(i)", said: "a\(i)", at: t0.addingTimeInterval(Double(i))) }
        XCTAssertEqual(shared.turns.count, 5)
        XCTAssertEqual(shared.unseen(by: .think, now: t0.addingTimeInterval(10)).map(\.asked), ["q5", "q6", "q7"])
        XCTAssertTrue(shared.unseen(by: .think, now: t0.addingTimeInterval(3600)).isEmpty, "an hour later it is not the referent")
        XCTAssertTrue(SharedTurns.lines([]).isEmpty)
    }

    func testEmptyTurnsAreNotRecorded() {
        var shared = SharedTurns()
        shared.record(.talk, asked: "  ", said: "\n", at: t0)
        XCTAssertTrue(shared.turns.isEmpty)
    }

    // 10-24 14:59: the panel's spoken answer ended with a check question; talk saw only its first 280 characters.
    let panelAnswer = "Membrane proteins do six jobs: they move things across, speed up reactions, relay signals inward, join cells together, act as ID tags, and anchor the cell. transport is moving things across. picture a is a channel, and picture b is a pump that burns energy. some membrane proteins are enzymes, lined up like an assembly line. a receptor grabs a signal outside and passes the message inward. so here's a check: when a hormone binds a muscle cell's receptor, which of the six jobs is that?"

    func testTheOtherSidesCheckQuestionSurvivesTheCut() {
        let clipped = SharedTurns.clip(panelAnswer, 280)
        XCTAssertLessThanOrEqual(clipped.count, 290)
        XCTAssertTrue(clipped.hasPrefix("Membrane proteins do six jobs"))
        XCTAssertTrue(clipped.hasSuffix("which of the six jobs is that?"), clipped)
        XCTAssertEqual(SharedTurns.clip("short answer.", 280), "short answer.")
    }

    func testDotsLastQuestionReachesEitherSide() {
        var shared = SharedTurns()
        shared.record(.think, asked: "put the six jobs on the panel", said: panelAnswer, at: t0)
        shared.record(.talk, asked: "can you say it again?", said: "your last question was about the panel. it's open now.", at: t0.addingTimeInterval(45))
        let asked = shared.lastQuestion(now: t0.addingTimeInterval(60))
        XCTAssertEqual(asked?.side, .think)
        XCTAssertEqual(asked?.question, "so here's a check: when a hormone binds a muscle cell's receptor, which of the six jobs is that?")
        XCTAssertNil(shared.lastQuestion(now: t0.addingTimeInterval(3600)), "an hour later it is not the question he means")
    }

    func testAQuestionBeforeAClosingLineStillCounts() {
        // 10-24 15:26: "here's a check: what does the car add to the t cell? and if you meant something else, just tell me."
        XCTAssertEqual(SharedTurns.lastQuestion(in: "t cells read tags. here's a check: what does the car add? and if you meant something else, just tell me."),
                       "here's a check: what does the car add?")
        XCTAssertNil(SharedTurns.lastQuestion(in: "no question here. none at all."))
    }
}

final class SpotifySearchTests: XCTestCase {
    func testFixedPhrasesOpenSpotifysSearch() {
        // 05 (2026-10-20): music by name plays it; "search spotify for" and "look up ... on spotify" stay the search page.
        XCTAssertEqual(ActionPhrases.match("play lofi beats on spotify"), .play(SpotifyPlay(kind: .playlist, words: "lofi beats")))
        XCTAssertEqual(ActionPhrases.match("can you find me a piano playlist on spotify"), .play(SpotifyPlay(kind: .playlist, words: "piano")))
        XCTAssertEqual(ActionPhrases.match("search spotify for Northwind Quartet."), .openURL("spotify:search:Northwind%20Quartet", newTab: false))
        XCTAssertEqual(ActionPhrases.match("put on some jazz in spotify please"), .play(SpotifyPlay(kind: .playlist, words: "jazz")))
        XCTAssertEqual(ActionPhrases.match("play music on spotify"), .media(.playPause), "the bare word music is play")
        XCTAssertEqual(ActionPhrases.match("open spotify"), .open("spotify"), "opening it is still just open")
        XCTAssertEqual(ActionPhrases.match("pause spotify"), .media(.playPause))
        XCTAssertNil(ActionPhrases.match("find the song lyrics in this doc"), "no spotify, no search")
    }

    func testTheTagFormAndItsLine() {
        XCTAssertEqual(TagParser.parse("[OPEN:spotify:search:piano study] searching spotify.").tags, [.act(.openURL("spotify:search:piano%20study", newTab: false))])
        XCTAssertEqual(ActionCommand.openURL("spotify:search:piano%20study", newTab: false).doneLine, "searching spotify for piano study.")
        XCTAssertEqual(ActionCommand.openURL("https://example.com/a", newTab: true).doneLine, "opened example.com.")
        XCTAssertNil(SpotifySearch.command("  ?! "))
        XCTAssertNil(SpotifySearch.query(fromURI: "https://open.spotify.com"))
    }
}

final class PanelWordsTests: XCTestCase {
    func testHisOtherWordsForThePanel() {
        for text in ["close the view", "close gallry", "close the gallery", "hide the diagram", "close that popup", "Close the view."] {
            XCTAssertTrue(PanelWords.namesPanelLoosely(text), text)
        }
        for text in ["close this window", "close the tab", "reorganize the view its off rn", "close"] {
            XCTAssertFalse(PanelWords.namesPanelLoosely(text), text)
        }
    }
}

final class CostBaselineTests: XCTestCase {
    func testTurnCostFromTheRunningTotal() {
        XCTAssertEqual(CostBaseline.turnCost(reported: 0.40, baseline: 0).turn, 0.40, accuracy: 1e-9)
        XCTAssertEqual(CostBaseline.turnCost(reported: 0.55, baseline: 0.40).turn, 0.15, accuracy: 1e-9)
        XCTAssertEqual(CostBaseline.turnCost(reported: 10.34, baseline: nil).turn, 0, "a resumed session with no saved total isn't charged its history")
        XCTAssertEqual(CostBaseline.turnCost(reported: 10.34, baseline: nil).total, 10.34)
    }

    func testSavedTotalsRoundTripAndPrune() throws {
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("dot-cost-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: file) }
        XCTAssertNil(CostBaseline.load(file, sessionId: "a"))
        CostBaseline.save(file, sessionId: "a", total: 1.5, keep: 2)
        CostBaseline.save(file, sessionId: "b", total: 2.5, keep: 2)
        XCTAssertEqual(CostBaseline.load(file, sessionId: "a"), 1.5)
        CostBaseline.save(file, sessionId: "c", total: 3.5, keep: 2)
        XCTAssertNil(CostBaseline.load(file, sessionId: "a"), "the oldest goes")
        XCTAssertEqual(CostBaseline.load(file, sessionId: "c"), 3.5)
    }
}

/// 10-24 15:19: "go to my notes on that slide" in the lecture PDF open in Comet. The finder now gets these; the page it
/// lands on and the phrase it types into the find box come from here.
final class NotesFinderTests: XCTestCase {
    let pages = [
        DocumentPage(number: 1, text: "COURSE 101 CLASS 1\n- biotech: using living things to make products\n- penicillin from a mold, antibiotics from soil bacteria"),
        DocumentPage(number: 2, text: "- prokaryotes: no nucleus, cell wall (peptidoglycan) surrounds plasma membrane\n- gram positive: thick wall, holds the purple dye"),
        DocumentPage(number: 3, text: "- decorations on membrane: glycolipid = lipid w carbohydrate attached; glycoprotein = protein w carbohydrate attached\n- other parts on slide: peripheral membrane protein, integral membrane protein,\nchannel protein, cholesterol\n- transmembrane proteins do six jobs"),
    ]

    func testTheAskedSlideLineLandsOnItsPage() {
        let query = "other parts on slide: peripheral membrane protein, integral membrane protein, channel protein, cholesterol"
        let best = DocumentSearch.bestPassages(for: query, in: pages).first
        XCTAssertEqual(best?.page, 3)
        XCTAssertGreaterThanOrEqual(best?.score ?? 0, 1.0, "locate needs a score of 1 to move")
        let phrase = DocumentSearch.distinctivePhrase(in: best?.passage ?? "", preferring: query)
        XCTAssertFalse(phrase.isEmpty)
        XCTAssertTrue(pages[2].text.lowercased().replacingOccurrences(of: "\n", with: " ").contains(phrase.lowercased()), phrase)
    }
}
