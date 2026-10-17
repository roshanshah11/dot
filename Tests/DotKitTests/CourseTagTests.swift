import XCTest
@testable import DotKit

final class CourseTagTests: XCTestCase {
    private let math = CourseTag(fileName: "math20250.md", text: """
    # MATH 20250 (Abstract Linear Algebra, UChicago, Autumn 2026): the course map Dot teaches from
    Section 41 (Wu). Fields, vector spaces, subspaces, linear independence, basis, dimension, kernel and image of a linear
    transformation, matrices, characteristic of a field, spanning sets.
    """)!
    private let bio = CourseTag(fileName: "bios11140.md", text: """
    # BIOS 11140, Biotechnology for the 21st Century (UChicago, Autumn 2026): the course map Dot teaches from
    Techniques: polymerase chain reaction, primers, denaturation, annealing, extension, replication, sequencing, cloning,
    plasmids, restriction enzymes, electrophoresis.
    """)!

    func testParsesTheHeading() {
        XCTAssertEqual(math.code, "math20250")
        XCTAssertEqual(math.label, "MATH 20250")
        XCTAssertEqual(math.name, "Abstract Linear Algebra")
        XCTAssertEqual(bio.code, "bios11140")
        XCTAssertEqual(bio.name, "Biotechnology for the 21st Century")
        XCTAssertNil(CourseTag(fileName: "notes.md", text: "# Project brief\nnothing here"))
    }

    func testANamedCourseWins() {
        XCTAssertEqual(CourseTag.detect(context: "Canvas: MATH 20250 Homework 3", among: [math, bio]), math)
        XCTAssertEqual(CourseTag.detect(context: "bios11140 lecture 5 slides.pdf", among: [math, bio]), bio)
        XCTAssertEqual(CourseTag.detect(context: "notes on abstract linear algebra", among: [math, bio]), math)
        XCTAssertNil(CourseTag.detect(context: "Room 202500", among: [math, bio]))
    }

    func testWordsDecideWhenNothingIsNamed() {
        XCTAssertEqual(CourseTag.detect(context: "wu_ch1.pdf", content: "the kernel of a linear transformation is a subspace; its basis has dimension one", among: [math, bio]), math)
        XCTAssertEqual(CourseTag.detect(context: "Preview", content: "PCR: denaturation, primers bind in annealing, then extension by polymerase", among: [math, bio]), bio)
        XCTAssertNil(CourseTag.detect(context: "Safari", content: "what time is it in tokyo", among: [math, bio]))
    }
}
