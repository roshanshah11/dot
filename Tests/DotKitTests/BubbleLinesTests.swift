import XCTest
@testable import DotKit

/// The speech bubble's pieces (2026-10-21): whole sentences, split at a clause, never "…", read at a human pace.
final class BubbleLinesTests: XCTestCase {
    func testAShortSentenceIsOnePiece() {
        XCTAssertEqual(BubbleLines.chunks("the problem set is at eleven thirty."), ["the problem set is at eleven thirty."])
        XCTAssertEqual(BubbleLines.chunks("   "), [])
    }

    func testALongSentenceSplitsAtAClauseAndLosesNothing() {
        let sentence = "this morning is light: the COURSE 101 email to Sam Rivera by five, the Alex Example text, the Northwind Bank sign-up by five, and the resume book upload by four."
        let pieces = BubbleLines.chunks(sentence)
        XCTAssertGreaterThan(pieces.count, 1)
        XCTAssertTrue(pieces.allSatisfy { $0.count <= BubbleLines.maxCharacters }, "\(pieces)")
        XCTAssertFalse(pieces.contains { $0.contains("…") })
        XCTAssertEqual(pieces.joined(separator: " "), sentence, "every word is still there, in order")
        XCTAssertTrue(pieces.dropLast().allSatisfy { [",", ":", ";"].contains($0.last!) }, "splits after a clause mark: \(pieces)")
    }

    func testNoClauseMarkSplitsBeforeAConjunctionOrAtASpace() {
        let sentence = "you have the Northwind Bank zoom at one thirty and the coffee chat with Alex Example at three thirty right after the problem set review"
        let pieces = BubbleLines.chunks(sentence)
        XCTAssertTrue(pieces.allSatisfy { $0.count <= BubbleLines.maxCharacters }, "\(pieces)")
        XCTAssertEqual(pieces.joined(separator: " "), sentence)
        let words = String(repeating: "word ", count: 60).trimmingCharacters(in: .whitespaces)
        XCTAssertEqual(BubbleLines.chunks(words).joined(separator: " "), words)
    }

    func testReadingTimeIsAHumanPace() {
        XCTAssertEqual(BubbleLines.readingTime("ok."), BubbleLines.minimumSeconds)
        let hundred = String(repeating: "a", count: 100)
        XCTAssertEqual(BubbleLines.readingTime(hundred), 6.0, accuracy: 0.001)
        let long = "this morning is light: the COURSE 101 email to Sam Rivera by five, the Alex Example text, the Northwind Bank sign-up by five, and the resume book upload by four."
        XCTAssertGreaterThanOrEqual(BubbleLines.readingTime(of: long), Double(long.count) * 0.06 - 0.5)
    }
}
