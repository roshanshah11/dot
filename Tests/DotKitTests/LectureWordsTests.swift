import XCTest
@testable import DotKit

final class LectureWordsTests: XCTestCase {
    func testTyposReadAsLecture() {
        XCTAssertEqual(LectureWords.correctingTypos("lecutre mode"), "lecture mode")
        XCTAssertEqual(LectureWords.correctingTypos("Lectrue mode"), "lecture mode")
        XCTAssertEqual(LectureWords.correctingTypos("lecure mdoe"), "lecture mode")
        XCTAssertEqual(LectureWords.correctingTypos("lecturee mod"), "lecture mode")
        XCTAssertEqual(LectureWords.correctingTypos("elcture mode on"), "lecture mode on")
        XCTAssertEqual(LectureWords.correctingTypos("start the lectre"), "start the lecture")
        XCTAssertEqual(LectureWords.correctingTypos("the lectrue is over"), "the lecture is over")
        XCTAssertEqual(LectureWords.correctingTypos("lecutre mode?"), "lecture mode?")
    }

    func testRealWordsStay() {
        XCTAssertEqual(LectureWords.correctingTypos("lecture mode"), "lecture mode")
        XCTAssertEqual(LectureWords.correctingTypos("listen to the lecturer"), "listen to the lecturer")
        XCTAssertEqual(LectureWords.correctingTypos("lectures are boring"), "lectures are boring")
        XCTAssertEqual(LectureWords.correctingTypos("lecture more slowly"), "lecture more slowly")
        XCTAssertEqual(LectureWords.correctingTypos("lecture notes"), "lecture notes")
        XCTAssertEqual(LectureWords.correctingTypos("what is a texture map"), "what is a texture map")
        XCTAssertEqual(LectureWords.correctingTypos("explain this picture"), "explain this picture")
        XCTAssertEqual(LectureWords.correctingTypos("mode"), "mode")
    }

    func testSlips() {
        XCTAssertEqual(LectureWords.slips("lecutre", "lecture"), 1)
        XCTAssertEqual(LectureWords.slips("lectre", "lecture"), 1)
        XCTAssertEqual(LectureWords.slips("texture", "lecture"), 2)
        XCTAssertEqual(LectureWords.slips("", "mode"), 4)
    }
}
