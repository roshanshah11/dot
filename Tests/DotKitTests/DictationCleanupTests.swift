import XCTest
@testable import DotKit

final class DictationCleanupTests: XCTestCase {
    let dictionary = DictationDictionary(text: "UChicago\nTypeSafe\njev one => Jev1\n")

    func testFillersAndFalseStarts() {
        XCTAssertEqual(DictationCleanup.dropFillers("um so I think we should, uh, meet at three"), "so I think we should, meet at three")
        XCTAssertEqual(DictationCleanup.dropFillers("Uh, the umbrella is here"), "the umbrella is here", "a word starting with um stays")
        XCTAssertEqual(DictationCleanup.dropRepeats("the answer is the answer is 42 percent"), "the answer is 42 percent")
        XCTAssertEqual(DictationCleanup.dropRepeats("I I think so"), "I think so")
        XCTAssertEqual(DictationCleanup.dropRepeats("I know that that is true"), "I know that that is true", "a meant repeat stays")
        XCTAssertEqual(DictationCleanup.dropRepeats("call 1 2 1 2 now"), "call 1 2 1 2 now")
    }

    func testCleanWithoutAField() {
        XCTAssertEqual(DictationCleanup.clean("um so i think we should uh meet at the u chicago library tomorrow at three", field: nil, dictionary: dictionary),
                       "So i think we should meet at the UChicago library tomorrow at three.")
        XCTAssertEqual(DictationCleanup.clean("can you send the type safe deck and the jev one numbers", field: nil, dictionary: dictionary),
                       "Can you send the TypeSafe deck and the Jev1 numbers.")
    }

    func testFittingTheField() {
        // A new message: a sentence.
        XCTAssertEqual(DictationCleanup.clean("Thanks for the chat yesterday", field: DictationField(role: "AXTextArea"), dictionary: dictionary),
                       "Thanks for the chat yesterday.")
        // After "Hi Sam," mid-line: a space, lower case, still a sentence of its own words.
        let afterGreeting = DictationField(role: "AXTextArea", before: "Hi Sam,")
        XCTAssertEqual(DictationCleanup.clean("Thanks for the chat yesterday", field: afterGreeting, dictionary: dictionary),
                       " thanks for the chat yesterday.")
        // A name keeps its capital mid-sentence.
        XCTAssertEqual(DictationCleanup.clean("Sam said it went well", field: afterGreeting, dictionary: dictionary), " Sam said it went well.")
        // After a full stop and a space: capital, no extra space.
        XCTAssertEqual(DictationCleanup.clean("the deck is attached", field: DictationField(role: "AXTextArea", before: "See below. "), dictionary: dictionary),
                       "The deck is attached.")
        // A search box: no period.
        XCTAssertEqual(DictationCleanup.clean("best restaurants in hyde park", field: DictationField(label: "Search Google or type a URL", role: "AXTextField"),
                                              dictionary: dictionary), "Best restaurants in hyde park")
        XCTAssertEqual(DictationCleanup.clean("coffee chat next week", field: DictationField(label: "Subject", role: "AXTextField"), dictionary: dictionary),
                       "Coffee chat next week")
        // A comment box whose label merely contains "to" is not a short field.
        XCTAssertEqual(DictationCleanup.clean("this is a great point", field: DictationField(label: "Add a comment to this post", role: "AXTextArea"),
                                              dictionary: dictionary), "This is a great point.")
        // A terminal: no period.
        XCTAssertEqual(DictationCleanup.clean("git status and then git log", field: DictationField(app: "Ghostty", bundleID: "com.mitchellh.ghostty"),
                                              dictionary: dictionary), "Git status and then git log")
        // Into the middle of a sentence: no period, spaces on both sides.
        XCTAssertEqual(DictationCleanup.clean("really", field: DictationField(role: "AXTextArea", before: "it was", after: "good"), dictionary: dictionary),
                       " really ")
        // After an open paren or a quote: no space.
        XCTAssertEqual(DictationCleanup.clean("see the appendix", field: DictationField(role: "AXTextArea", before: "the numbers ("), dictionary: dictionary),
                       "see the appendix")
    }
}

final class DictationEditTrackerTests: XCTestCase {
    let value = "Hi Sam, thanks for the jeff one numbers. Best, Roshan"
    var start: Int { ("Hi Sam, " as NSString).length }
    let inserted = "thanks for the jeff one numbers."

    func testACorrectionInsideTheRange() throws {
        var tracker = try XCTUnwrap(DictationEditTracker(value: value, start: start, inserted: inserted))
        // Typed letter by letter: the states in between don't matter, the last one does.
        tracker.observe("Hi Sam, thanks for the je one numbers. Best, Roshan")
        tracker.observe("Hi Sam, thanks for the Jev1 numbers. Best, Roshan")
        XCTAssertEqual(tracker.candidate(), nil, "jeff one to Jev1 looks too different to be a mishearing by letters")
        var second = try XCTUnwrap(DictationEditTracker(value: "Hi, meet at the you chicago library", start: 4, inserted: "meet at the you chicago library"))
        second.observe("Hi, meet at the UChicago library")
        XCTAssertEqual(second.candidate(), DictationCandidate(heard: "you chicago", correct: "UChicago"))
        var third = try XCTUnwrap(DictationEditTracker(value: "send the typesafe deck", start: 0, inserted: "send the typesafe deck"))
        third.observe("send the TypeSafe deck")
        XCTAssertEqual(third.candidate(), DictationCandidate(heard: "typesafe", correct: "TypeSafe"))
    }

    func testWhatIsDropped() throws {
        var elsewhere = try XCTUnwrap(DictationEditTracker(value: value, start: start, inserted: inserted))
        elsewhere.observe("Hello Sam, thanks for the jeff one numbers. Best, Roshan")
        elsewhere.observe("Hello Sam, thanks for the Jeff 1 numbers. Best, Roshan")
        XCTAssertNil(elsewhere.candidate(), "typing before the range taints the watch")
        XCTAssertTrue(elsewhere.tainted)
        var unreadable = try XCTUnwrap(DictationEditTracker(value: value, start: start, inserted: inserted))
        unreadable.observe(nil)
        XCTAssertNil(unreadable.candidate())
        var mind = try XCTUnwrap(DictationEditTracker(value: "see you Friday", start: 0, inserted: "see you Friday"))
        mind.observe("see you Monday")
        XCTAssertNil(mind.candidate(), "a change of mind is not a mishearing")
        var capital = try XCTUnwrap(DictationEditTracker(value: "the deck", start: 0, inserted: "the deck"))
        capital.observe("The deck")
        XCTAssertNil(capital.candidate(), "a sentence's capital is not a term")
        var more = try XCTUnwrap(DictationEditTracker(value: "meet at the library", start: 0, inserted: "meet at the library"))
        more.observe("meet at the library tomorrow at three")
        XCTAssertNil(more.candidate(), "adding words is not a correction")
        var known = try XCTUnwrap(DictationEditTracker(value: "the type safe deck", start: 0, inserted: "the type safe deck"))
        known.observe("the TypeSafe deck")
        XCTAssertNil(known.candidate(dictionary: DictationDictionary(text: "TypeSafe")), "a rule he already has")
        XCTAssertNil(DictationEditTracker(value: "something else", start: 0, inserted: "meet at"), "the insert didn't land where Dot meant")
    }
}
