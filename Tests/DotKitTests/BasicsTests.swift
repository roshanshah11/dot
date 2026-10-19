import XCTest
@testable import DotKit

final class ActionTagTests: XCTestCase {
    func testOpenTagKinds() {
        XCTAssertEqual(TagParser.parse("[OPEN:spotify] opening it.").tags, [.act(.open("spotify"))])
        XCTAssertEqual(TagParser.parse("[OPEN:https://example.com/a:same]").tags, [.act(.openURL("https://example.com/a", newTab: false))])
        XCTAssertEqual(TagParser.parse("[OPEN:example.com]").tags, [.act(.openURL("https://example.com", newTab: true))])
        XCTAssertEqual(TagParser.parse("[OPEN:~/Downloads]").tags, [.act(.openPath("~/Downloads"))])
    }

    func testScrollKeyClickGo() {
        XCTAssertEqual(TagParser.parse("[SCROLL:down]").tags, [.act(.scroll(.down))])
        XCTAssertEqual(TagParser.parse("[SCROLL:top]").tags, [.act(.scroll(.top))])
        XCTAssertEqual(TagParser.parse("[SCROLL:Tidal energy storage]").tags, [.act(.scroll(.toText("Tidal energy storage")))])
        XCTAssertEqual(TagParser.parse("[KEY:cmd+shift+t]").tags, [.act(.key("cmd+shift+t"))])
        XCTAssertTrue(TagParser.parse("[KEY:hyper+q]").tags.isEmpty)
        XCTAssertEqual(TagParser.parse("[CLICK:Export] clicking export.").tags, [.act(.click(label: "Export"))])
        XCTAssertEqual(TagParser.parse("[GO:settings, then email alerts on]").tags, [.act(.go(goal: "settings, then email alerts on"))])
    }

    func testInsertBlockAndStreaming() {
        XCTAssertEqual(TagParser.parse("[INSERT:name]\n<<<\nSam Rivera\n>>>\ntyped it.").tags, [.act(.insert(label: "name", text: "Sam Rivera"))])
        var streamer = BeatStreamer()
        _ = streamer.feed("[INSERT:name]\n<<<\nSam ")
        XCTAssertTrue(streamer.allTags.isEmpty, "the block is still open")
        _ = streamer.feed("Rivera\n>>>\ndone.")
        _ = streamer.flush()
        XCTAssertEqual(streamer.allTags, [.act(.insert(label: "name", text: "Sam Rivera"))])
        XCTAssertEqual(streamer.spokenSoFar, "done.")
    }

    func testActTagsAreNotSpokenOrVisual() {
        let parsed = TagParser.parse("[OPEN:spotify] opening spotify.")
        XCTAssertEqual(parsed.spoken, "opening spotify.")
        XCTAssertFalse(DotTag.act(.open("x")).isVisual)
    }
}

final class ActionPhraseTests: XCTestCase {
    func testFixedPhrases() {
        XCTAssertEqual(ActionPhrases.match("scroll down"), .scroll(.down))
        XCTAssertEqual(ActionPhrases.match("Can you scroll up a bit?"), .scroll(.up))
        XCTAssertEqual(ActionPhrases.match("go to the top of the page"), .scroll(.top))
        XCTAssertEqual(ActionPhrases.match("go back"), .browser(.back))
        XCTAssertEqual(ActionPhrases.match("refresh the page"), .browser(.reload))
        XCTAssertEqual(ActionPhrases.match("open a new tab"), .browser(.newTab))
        XCTAssertEqual(ActionPhrases.match("close this tab"), .browser(.closeTab))
        XCTAssertEqual(ActionPhrases.match("pause the music"), .media(.playPause))
        XCTAssertEqual(ActionPhrases.match("next song"), .media(.next))
        XCTAssertEqual(ActionPhrases.match("open spotify"), .open("spotify"))
        XCTAssertEqual(ActionPhrases.match("hey can you um open chain stream"), .open("chain stream"))
        XCTAssertEqual(ActionPhrases.match("open my downloads folder"), .open("downloads"))
        XCTAssertEqual(ActionPhrases.match("open espn.com"), .openURL("https://espn.com", newTab: true))
    }

    func testPhrasesThatNeedTheModel() {
        XCTAssertNil(ActionPhrases.match("open it"))
        XCTAssertNil(ActionPhrases.match("open the wikipedia page on pcr on the board"))
        XCTAssertNil(ActionPhrases.match("open the email from the recruiter"))
        XCTAssertNil(ActionPhrases.match("stop"))
        XCTAssertNil(ActionPhrases.match("play"))
        XCTAssertNil(ActionPhrases.match("how do i scroll down in excel without the mouse"))
        XCTAssertNil(ActionPhrases.match("explain how pcr works step by step"))
    }

    func testKeyChord() {
        let chord = KeyChord.parse("cmd+shift+t")
        XCTAssertEqual(chord?.keyCode, 17)
        XCTAssertEqual(chord?.command, true)
        XCTAssertEqual(chord?.shift, true)
        XCTAssertEqual(KeyChord.parse("return")?.isPlainReturn, true)
        XCTAssertEqual(KeyChord.parse("cmd+return")?.isPlainReturn, false)
        XCTAssertNil(KeyChord.parse("cmd+banana"))
    }
}

final class CommitGuardTests: XCTestCase {
    func testCommitWordsRefused() {
        for label in ["Submit application", "Apply", "Send", "Confirm order", "Delete", "Pay now", "Reply all", "Share", "Accept"] {
            XCTAssertTrue(CommitGuard.isCommit(label), label)
        }
        for label in ["Export", "Settings", "Email alerts", "My Jobs", "Search", "Next page", "Notifications"] {
            XCTAssertFalse(CommitGuard.isCommit(label), label)
        }
    }

    func testReturnOnlyInSearchFields() {
        XCTAssertTrue(CommitGuard.returnAllowed(role: "AXTextField", subrole: "AXSearchField", placeholder: nil))
        XCTAssertTrue(CommitGuard.returnAllowed(role: "searchbox", subrole: nil, placeholder: nil))
        XCTAssertTrue(CommitGuard.returnAllowed(role: "AXTextField", subrole: nil, placeholder: "Search jobs"))
        XCTAssertFalse(CommitGuard.returnAllowed(role: "AXTextArea", subrole: nil, placeholder: "Write a message"))
        XCTAssertFalse(CommitGuard.returnAllowed(role: "AXTextField", subrole: nil, placeholder: "Search or reply"))
        XCTAssertFalse(CommitGuard.returnAllowed(role: "AXTextField", subrole: nil, placeholder: nil))
    }
}

final class CalendarLinesTests: XCTestCase {
    var cal: Calendar = { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "America/Chicago")!; return c }()

    func at(_ day: Int, _ hour: Int, _ minute: Int = 0) -> Date {
        cal.date(from: DateComponents(year: 2026, month: 10, day: day, hour: hour, minute: minute))!
    }

    func testMatchTitlePlaceNotes() {
        let practice = CalendarItem(title: "Practice (Sun)", start: at(18, 17), end: at(18, 19), location: "Student Center Dance Room")
        XCTAssertTrue(practice.matches("when is my dance practice today"))
        XCTAssertTrue(practice.matches("practice"))
        XCTAssertFalse(practice.matches("when is the dentist"))
        let dinner = CalendarItem(title: "Dinner with friends", start: at(17, 20, 30), end: at(17, 22, 30), notes: "reservation at 8:30")
        XCTAssertTrue(dinner.matches("where is my reservation"))
    }

    func testBlockTodayVersusWide() {
        let items = [
            CalendarItem(title: "Morning thing", start: at(18, 9), end: at(18, 10)),
            CalendarItem(title: "Practice", start: at(18, 17), end: at(18, 19), location: "Dance Room"),
            CalendarItem(title: "Seminar", start: at(20, 12, 30), end: at(20, 13, 50)),
            CalendarItem(title: "Far away", start: cal.date(byAdding: .day, value: 20, to: at(18, 9))!, end: cal.date(byAdding: .day, value: 20, to: at(18, 10))!),
        ]
        let now = at(18, 13, 40)
        let narrow = CalendarLines.block(items, now: now, wide: false, source: "this mac", calendar: cal)
        XCTAssertEqual(narrow.count, 3)
        XCTAssertTrue(narrow[1].contains("Sun 10-18 17:00–19:00 Practice (at Dance Room)"), narrow[1])
        let wide = CalendarLines.block(items, now: now, wide: true, source: "this mac", calendar: cal)
        XCTAssertTrue(wide.contains { $0.contains("Seminar") })
        XCTAssertFalse(wide.contains { $0.contains("Far away") })
        XCTAssertFalse(wide.contains { $0.contains("Morning thing") }, "over already")
        XCTAssertTrue(CalendarLines.block([], now: now, wide: false, source: "x", calendar: cal)[0].hasSuffix("nothing"))
    }

    func testCalendarAsks() {
        for ask in ["when is bhangra practice", "where is my dinner tn", "what's on today", "do i have class tomorrow", "what time is the interview"] {
            XCTAssertTrue(CalendarLines.isCalendarAsk(ask), ask)
        }
        XCTAssertFalse(CalendarLines.isCalendarAsk("explain what a kernel is"))
    }
}

final class FreshnessTests: XCTestCase {
    func testStaleLine() {
        let state = #"{"synced": "2026-10-14T08:02:00.000000-05:00", "snapshot_ok": true}"#.data(using: .utf8)
        let box = #"{"down_since": "2026-10-14T09:00:00-05:00", "noticed_down": null}"#.data(using: .utf8)
        let fresh = AtlasFreshness.parse(replicaState: state, boxWatch: box)
        XCTAssertNotNil(fresh.synced)
        let now = AtlasFreshness.parseISO("2026-10-18T12:49:00-05:00")!
        let line = fresh.staleLine(now: now)
        XCTAssertNotNil(line)
        XCTAssertTrue(line!.contains("4 days old"), line!)
        XCTAssertTrue(line!.contains("offline since"), line!)
        let recent = AtlasFreshness.parse(replicaState: #"{"synced": "2026-10-18T12:40:00-05:00"}"#.data(using: .utf8), boxWatch: nil)
        XCTAssertNil(recent.staleLine(now: now))
        XCTAssertNil(AtlasFreshness.parse(replicaState: nil, boxWatch: nil).staleLine(now: now))
    }
}

final class AgentModeFilterTests: XCTestCase {
    func testStrayWords() {
        XCTAssertTrue(AgentModeFilter.isStray("Yeah."))
        XCTAssertTrue(AgentModeFilter.isStray("Lori like."))
        XCTAssertTrue(AgentModeFilter.isStray("um okay so yeah"))
        XCTAssertFalse(AgentModeFilter.isStray("find me a usb c cable on amazon"))
        XCTAssertFalse(AgentModeFilter.isStray("draft a reply to the recruiter"))
    }

    func testFreshAgent() {
        XCTAssertTrue(AgentModeFilter.wantsFreshAgent("can you start another agent on that? like not you"))
        XCTAssertFalse(AgentModeFilter.wantsFreshAgent("how is the agent doing"))
    }

    func testRetryOnlyWhenTheCLIDroppedIt() {
        XCTAssertTrue(TurnRetry.shouldRetry(subtype: "error_during_execution", durationMs: 400, cutOffByDot: false, alreadyRetried: false, hasMessage: true))
        XCTAssertFalse(TurnRetry.shouldRetry(subtype: "error_during_execution", durationMs: 400, cutOffByDot: true, alreadyRetried: false, hasMessage: true))
        XCTAssertFalse(TurnRetry.shouldRetry(subtype: "error_during_execution", durationMs: 400, cutOffByDot: false, alreadyRetried: true, hasMessage: true))
        XCTAssertFalse(TurnRetry.shouldRetry(subtype: "error_max_turns", durationMs: 400, cutOffByDot: false, alreadyRetried: false, hasMessage: true))
    }
}
