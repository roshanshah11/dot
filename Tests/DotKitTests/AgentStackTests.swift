import XCTest
@testable import DotKit

/// 04: the top-right stack's chip clock, the notch only while talking, and the mute table.
final class AgentStackTests: XCTestCase {
    private let t0 = Date(timeIntervalSince1970: 1_800_000_000)

    private func shown(_ state: AgentChip.State, at seconds: TimeInterval, hovering: Bool = false, expanded: Bool = false,
                       holdUntil: TimeInterval? = nil, folded: Bool = false) -> AgentChip.Presentation {
        AgentChip.presentation(state: state, stateSince: t0, hovering: hovering, expanded: expanded, now: t0.addingTimeInterval(seconds),
                               holdUntil: holdUntil.map { t0.addingTimeInterval($0) }, folded: folded)
    }

    // MARK: The chip clock

    func testANewCardFoldsToItsAvatarAfterFiveSeconds() {
        XCTAssertEqual(shown(.running, at: 0), .card)
        XCTAssertEqual(shown(.running, at: 4.9), .card)
        XCTAssertEqual(shown(.running, at: 5), .avatar)
        XCTAssertEqual(shown(.running, at: 3600), .avatar, "a working agent stays as its avatar")
    }

    func testDoneIsGoneAfterEightSecondsAndFailedAfterFifteen() {
        XCTAssertEqual(shown(.done, at: 7.9), .card)
        XCTAssertEqual(shown(.done, at: 8), .gone)
        for state in [AgentChip.State.failed, .stopped, .interrupted] {
            XCTAssertEqual(shown(state, at: 14.9), .card, "\(state)")
            XCTAssertEqual(shown(state, at: 15), .gone, "\(state)")
        }
    }

    func testHoverHoldsWhateverStateAChipIsIn() {
        for state in AgentChip.State.allCases {
            XCTAssertEqual(shown(state, at: 10_000, hovering: true), .card, "\(state)")
            XCTAssertEqual(shown(state, at: 10_000, expanded: true), .card, "\(state) opened")
        }
    }

    func testAConsentCardAndAPausedJobNeverAutoClear() {
        for seconds in [0.0, 5, 8, 15, 3600, 86_400] {
            XCTAssertEqual(shown(.consent, at: seconds), .card)
            XCTAssertEqual(shown(.paused, at: seconds), .card)
            XCTAssertEqual(shown(.consent, at: seconds, folded: true), .card, "Escape leaves a choice up")
            XCTAssertEqual(shown(.paused, at: seconds, folded: true), .card)
        }
    }

    func testUnfinishedAndAttentionShowThenHoldAsAvatars() {
        for state in [AgentChip.State.unfinished, .attention] {
            XCTAssertEqual(shown(state, at: 1), .card)
            XCTAssertEqual(shown(state, at: 15), .avatar)
            XCTAssertEqual(shown(state, at: 86_400), .avatar, "held until he acts")
        }
        XCTAssertEqual(shown(.waiting, at: 0), .avatar, "its question is the card")
        XCTAssertEqual(shown(.waiting, at: 86_400), .avatar)
    }

    func testReadingTimeHoldsADoneCard() {
        XCTAssertEqual(shown(.done, at: 9, holdUntil: 12), .card, "a muted Mac's text card stays for reading time")
        XCTAssertEqual(shown(.done, at: 12, holdUntil: 12), .gone)
    }

    func testEscapeFoldsEveryCard() {
        XCTAssertEqual(shown(.running, at: 1, folded: true), .avatar)
        XCTAssertEqual(shown(.unfinished, at: 1, folded: true), .avatar)
        XCTAssertEqual(shown(.done, at: 1, folded: true), .gone)
        XCTAssertEqual(shown(.failed, at: 1, folded: true), .gone)
    }

    func testToolCallsAndTextDeltasDontMoveTheClock() {
        // A tool call, then a streamed line, then another tool call: the state never changed.
        var since = AgentChip.since(previous: nil, newState: .running, now: t0)
        XCTAssertEqual(since, t0, "a new chip starts now")
        for step in 1...40 {
            since = AgentChip.since(previous: (.running, since), newState: .running, now: t0.addingTimeInterval(Double(step) * 0.5))
        }
        XCTAssertEqual(since, t0, "forty updates later the clock still runs from the start")
        XCTAssertEqual(AgentChip.presentation(state: .running, stateSince: since, hovering: false, expanded: false, now: t0.addingTimeInterval(20)), .avatar,
                       "so a working agent folds (scheduleCollapse re-armed on every call and never did)")
        let done = AgentChip.since(previous: (.running, since), newState: .done, now: t0.addingTimeInterval(30))
        XCTAssertEqual(done, t0.addingTimeInterval(30), "a state change restarts it")
    }

    func testNewestFirstWithEightAtMost() {
        let entries = (0..<9).map { AgentChip.Entry(id: "a\($0)", state: .running, createdAt: t0.addingTimeInterval(Double($0))) }
        let ordered = AgentChip.order(entries)
        XCTAssertEqual(ordered.count, 8)
        XCTAssertEqual(ordered.first?.id, "a8")
        XCTAssertEqual(ordered.last?.id, "a1", "the oldest drops off the bottom")
        let withCard = entries + [AgentChip.Entry(id: "card", state: .consent, createdAt: t0.addingTimeInterval(-100))]
        XCTAssertEqual(AgentChip.order(withCard).first?.id, "card", "a card that needs a choice sits on top")
        let changed = [AgentChip.Entry(id: "old", state: .done, createdAt: t0), AgentChip.Entry(id: "new", state: .running, createdAt: t0.addingTimeInterval(5))]
        XCTAssertEqual(AgentChip.order(changed).map(\.id), ["new", "old"], "a state change never reshuffles")
    }

    func testStateWords() {
        XCTAssertEqual(AgentChip.stateWord(.paused, kind: .job), "paused · say go on")
        XCTAssertEqual(AgentChip.stateWord(.unfinished, kind: .agent), "unfinished")
    }

    // MARK: The notch only while talking

    private func panel(_ phase: NotchSurface.Phase = .hidden, input: Bool = false, answerAt: TimeInterval? = nil, characters: Int = 0,
                       consent: Bool = false, consentInNotch: Bool = false, live: Bool = false, now: TimeInterval = 0) -> Bool {
        NotchSurface.showsPanel(phase: phase, showInput: input, answerShownAt: answerAt.map { t0.addingTimeInterval($0) }, answerCharacters: characters,
                                consentOpen: consent, consentInNotch: consentInNotch, liveExchange: live, now: t0.addingTimeInterval(now))
    }

    func testTheNotchShowsFromKeyDownThroughTheAnswer() {
        XCTAssertFalse(panel(), "idle shows nothing")
        for phase in [NotchSurface.Phase.listening, .transcribing, .thinking, .speaking, .done] { XCTAssertTrue(panel(phase), "\(phase)") }
        XCTAssertTrue(panel(input: true), "the typed field")
        XCTAssertTrue(panel(live: true), "a walkthrough, lesson or board row is a live exchange")
    }

    func testATypedOrMutedAnswerStaysForReadingTime() {
        XCTAssertTrue(panel(answerAt: 0, characters: 40, now: 7.9))
        XCTAssertFalse(panel(answerAt: 0, characters: 40, now: 8), "8 s for a short answer")
        XCTAssertTrue(panel(answerAt: 0, characters: 500, now: 29.9), "60 ms a character for a long one")
        XCTAssertFalse(panel(answerAt: 0, characters: 500, now: 30))
        XCTAssertEqual(NotchSurface.readingTime(characters: 0), 8)
        XCTAssertEqual(NotchSurface.readingTime(characters: 1000), 60, accuracy: 0.001)
    }

    func testAConsentCardOpensTheNotchOnlyWhenAskedTo() {
        XCTAssertFalse(panel(consent: true), "the stack has it by default")
        XCTAssertTrue(panel(consent: true, consentInNotch: true))
    }

    func testHoldsMenuOnANotchedScreen() {
        XCTAssertTrue(NotchSurface.holdsMenu(hasNotch: true))
        XCTAssertFalse(NotchSurface.holdsMenu(hasNotch: false))
        XCTAssertTrue(NotchSurface.presence(configured: true, hasNotch: true, talkOnly: true), "the resting tab keeps right-click to the menu")
        XCTAssertFalse(NotchSurface.presence(configured: true, hasNotch: false, talkOnly: true), "no sliver on a screen with no notch")
        XCTAssertTrue(NotchSurface.presence(configured: true, hasNotch: false, talkOnly: false), "the old behavior behind the flag")
        XCTAssertFalse(NotchSurface.presence(configured: false, hasNotch: true, talkOnly: true))
    }

    // MARK: The mute table

    private func report(speak: Bool = true, mode: RoutineMode? = nil, notify: Bool? = nil, unprompted: Bool = false, onCall: Bool = false,
                        threadOpen: Bool = false, muted: Bool = false, question: Bool = false) -> AgentReport {
        AgentReport.decide(speakResults: speak, routineMode: mode, notify: notify, unprompted: unprompted, onCall: onCall,
                           threadOpen: threadOpen, outputSilent: muted, isQuestion: question)
    }

    func testTheWholeTruthTable() {
        typealias R = AgentReport
        // An ask that finished, sound on: chime, voice, the done row.
        XCTAssertEqual(report(), R(chime: true, voice: true, text: false, chip: .row))
        // A muted Mac: never a voice, the line as text on a card held for reading time, no chime into muted speakers.
        XCTAssertEqual(report(muted: true), R(chime: false, voice: false, text: true, chip: .text))
        // On a call: the same, the result waits.
        XCTAssertEqual(report(onCall: true), R(chime: false, voice: false, text: true, chip: .text))
        // He turned spoken results off: the chime, and the line as text.
        XCTAssertEqual(report(speak: false), R(chime: true, voice: false, text: true, chip: .text))
        // He is reading that agent's thread in Home: it is read there.
        XCTAssertEqual(report(threadOpen: true), R(chime: true, voice: false, text: false, chip: .row))
        XCTAssertEqual(report(threadOpen: true, muted: true), R(chime: false, voice: false, text: false, chip: .row))
        // A result nobody asked for: the row only.
        XCTAssertEqual(report(unprompted: true), AgentReport.quiet)
        XCTAssertEqual(report(mode: .watch, notify: true, unprompted: true), AgentReport.quiet)
        // A question: the "!" card.
        XCTAssertEqual(report(question: true), R(chime: true, voice: true, text: false, chip: .alert))
        XCTAssertEqual(report(muted: true, question: true), R(chime: false, voice: false, text: true, chip: .alert))
        // A report routine lands quietly; one that asks him something surfaces.
        XCTAssertEqual(report(mode: .report), AgentReport.quiet)
        XCTAssertEqual(report(mode: .report, notify: true), AgentReport.quiet)
        XCTAssertEqual(report(mode: .report, question: true), R(chime: true, voice: true, text: false, chip: .alert))
        // A watch run with nothing for him: no chip at all (transcript and Home's unread dot).
        XCTAssertEqual(report(mode: .watch), R(chime: false, voice: false, text: false, chip: .none))
        XCTAssertEqual(report(mode: .watch, notify: false), R(chime: false, voice: false, text: false, chip: .none))
        // A watch run that needs him: "!", a chime, and voice or text.
        XCTAssertEqual(report(mode: .watch, notify: true), R(chime: true, voice: true, text: false, chip: .alert))
        XCTAssertEqual(report(mode: .watch, notify: true, muted: true), R(chime: false, voice: false, text: true, chip: .alert))
        XCTAssertEqual(report(mode: .watch, notify: false, question: true), R(chime: true, voice: true, text: false, chip: .alert))
    }

    func testAMutedMacNeverGetsAVoice() {
        for speak in [true, false] {
            for mode in [nil, RoutineMode.report, .watch] {
                for notify in [nil, true, false] {
                    for question in [true, false] {
                        for threadOpen in [true, false] {
                            let r = report(speak: speak, mode: mode, notify: notify, threadOpen: threadOpen, muted: true, question: question)
                            XCTAssertFalse(r.voice)
                            XCTAssertFalse(r.chime)
                        }
                    }
                }
            }
        }
    }

    func testTheConsentCardCase() {
        XCTAssertEqual(AgentReport.consentCard(speakResults: true, onCall: false, outputSilent: false), AgentReport(chime: true, voice: true, text: false, chip: .alert))
        XCTAssertEqual(AgentReport.consentCard(speakResults: true, onCall: false, outputSilent: true), AgentReport(chime: false, voice: false, text: true, chip: .alert),
                       "a muted Mac gets the card as text, never the spoken line")
        XCTAssertEqual(AgentReport.consentCard(speakResults: true, onCall: true, outputSilent: false), AgentReport(chime: false, voice: false, text: true, chip: .alert))
        XCTAssertEqual(AgentReport.consentCard(speakResults: false, onCall: false, outputSilent: false), AgentReport(chime: true, voice: false, text: true, chip: .alert))
    }

    func testTheWatchPrefixMakesAWatchRoutine() {
        XCTAssertEqual(RoutineMode.split(brief: "watch: check outlook for anything from Sam Rivera").mode, .watch)
        XCTAssertEqual(RoutineMode.split(brief: "Watch:check outlook for anything from Sam Rivera").brief, "check outlook for anything from Sam Rivera")
        XCTAssertEqual(RoutineMode.split(brief: "draft the replies").mode, .report)
        XCTAssertEqual(RoutineMode.split(brief: "watch the COURSE 101 page and summarize").mode, .report, "only the prefix counts")
    }
}

/// Hover over the stack (2026-10-21): one rule, an open delay and a close grace, never a close mid-resize.
final class StackHoverTests: XCTestCase {
    private let t0 = Date(timeIntervalSince1970: 1_000_000)

    func testAQuickPassOpensNothing() {
        var hover = StackHover()
        XCTAssertNotNil(hover.update(under: "a", now: t0, layoutSettling: false))
        hover.update(under: nil, now: t0.addingTimeInterval(0.04), layoutSettling: false)
        XCTAssertNil(hover.hovering)
        hover.update(under: nil, now: t0.addingTimeInterval(1), layoutSettling: false)
        XCTAssertNil(hover.hovering)
    }

    func testRestingOpensAfterTheDelay() {
        var hover = StackHover()
        let due = hover.update(under: "a", now: t0, layoutSettling: false)
        XCTAssertEqual(due ?? 0, StackHover.openDelay, accuracy: 0.001)
        XCTAssertNil(hover.hovering)
        XCTAssertNil(hover.update(under: "a", now: t0.addingTimeInterval(StackHover.openDelay), layoutSettling: false))
        XCTAssertEqual(hover.hovering, "a")
    }

    /// The 10:22 flicker: the avatar grew into its card, and for a moment the pointer seemed to be on nothing.
    func testAMomentOffWhileTheCardGrowsKeepsItOpen() {
        var hover = StackHover(hovering: "a")
        hover.update(under: nil, now: t0, layoutSettling: true)
        hover.update(under: nil, now: t0.addingTimeInterval(0.5), layoutSettling: true)
        XCTAssertEqual(hover.hovering, "a", "never closes while the stack is still laying out")
        hover.update(under: nil, now: t0.addingTimeInterval(0.6), layoutSettling: false)
        hover.update(under: nil, now: t0.addingTimeInterval(0.7), layoutSettling: false)
        hover.update(under: "a", now: t0.addingTimeInterval(0.75), layoutSettling: false)
        XCTAssertEqual(hover.hovering, "a", "back on it within the grace: still open, no flip")
    }

    func testLeavingClosesAfterTheGrace() {
        var hover = StackHover(hovering: "a")
        let due = hover.update(under: nil, now: t0, layoutSettling: false)
        XCTAssertEqual(due ?? 0, StackHover.closeDelay, accuracy: 0.001)
        hover.update(under: nil, now: t0.addingTimeInterval(StackHover.closeDelay - 0.05), layoutSettling: false)
        XCTAssertEqual(hover.hovering, "a")
        hover.update(under: nil, now: t0.addingTimeInterval(StackHover.closeDelay), layoutSettling: false)
        XCTAssertNil(hover.hovering)
    }

    func testMovingToAnotherChipSwitchesAfterTheDelay() {
        var hover = StackHover(hovering: "a")
        hover.update(under: "b", now: t0, layoutSettling: false)
        XCTAssertEqual(hover.hovering, "a")
        hover.update(under: "b", now: t0.addingTimeInterval(StackHover.openDelay), layoutSettling: false)
        XCTAssertEqual(hover.hovering, "b")
    }

    func testAChipThatLeavesIsForgotten() {
        var hover = StackHover(hovering: "a")
        hover.forget("b")
        XCTAssertEqual(hover.hovering, "a")
        hover.forget("a")
        XCTAssertNil(hover.hovering)
    }
}
