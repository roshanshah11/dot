import XCTest
@testable import DotKit

final class LectureNotesTests: XCTestCase {
    func testProtocolLines() {
        let reply = """
        ## CLASS 3 (Thu Oct 22): enzymes
        - **enzyme**: a protein that speeds up a reaction
          - lowers activation energy
            - deep
                  - too deep
        ~d4: rewritten
        ~h2: never his
        ? activation energy | new idea, a diagram helps
        ? lock and key
        +after d3: - ⁺ the slide's graph of energy vs time
        FEEDBACK: u got the first two; the third was feedback inhibition
        nothing.
        ```
        some stray prose
        """
        let (ops, ignored) = NoteProtocol.parse(reply)
        XCTAssertEqual(ops, [
            .title("enzymes"),
            .append(depth: 0, text: "**enzyme**: a protein that speeds up a reaction"),
            .append(depth: 1, text: "lowers activation energy"),
            .append(depth: 2, text: "deep"),
            .append(depth: 3, text: "too deep"),
            .rewrite(id: "d4", text: "rewritten"),
            .explain(topic: "activation energy", why: "new idea, a diagram helps"),
            .explain(topic: "lock and key", why: ""),
            .addAfter(id: "d3", text: "the slide's graph of energy vs time"),
            .feedback("u got the first two; the third was feedback inhibition"),
            .nothing,
        ])
        XCTAssertEqual(ignored, ["~h2: never his", "some stray prose"])
    }

    func testBacktickedLinesAndAfterEnd() {
        let (ops, ignored) = NoteProtocol.parse("`~d5: finished thought`\n  `- nested in ticks`\n+after end: ⁺ slides not reached yet")
        XCTAssertEqual(ops, [.rewrite(id: "d5", text: "finished thought"), .append(depth: 1, text: "nested in ticks"),
                             .addAfter(id: "end", text: "slides not reached yet")])
        XCTAssertEqual(ignored, [])
        var notes = ClassNotes(number: 1, dateLabel: "Thu Oct 22")
        notes.append(depth: 0, text: "a")
        notes.append(depth: 1, text: "b")
        let placed = notes.addAfter("end", text: "slides not reached yet")!
        XCTAssertEqual(placed.after, "d2")
        XCTAssertEqual(notes.blocks.last?.markdown, "- ⁺ slides not reached yet")
        XCTAssertNil(notes.rewrite("d1", text: "a"), "a rewrite that changes nothing is skipped")
    }

    func testDotNeverRewritesHisLines() {
        var notes = ClassNotes(number: 1, dateLabel: "Thu Oct 22")
        let a = notes.append(depth: 0, text: "first")!
        let b = notes.append(depth: 2, text: "child")!
        XCTAssertEqual(b.depth, 1, "a line sits at most one level under the line above")
        XCTAssertTrue(notes.edit(a.id, text: "first, his words"))
        XCTAssertNil(notes.rewrite(a.id, text: "dot's version"), "once he edits a line it is his")
        XCTAssertEqual(notes.rewrite(b.id, text: "child, finished")?.text, "child, finished")
        XCTAssertEqual(notes.block(a.id)?.author, .him)
    }

    func testDotWritesAboveHisLineInProgress() {
        var notes = ClassNotes(number: 1, dateLabel: "Thu Oct 22")
        notes.append(depth: 0, text: "one")
        notes.add(id: "h1", after: "d1", depth: 0, text: "he is typing")
        let d = notes.append(depth: 0, text: "two", before: "h1")!
        XCTAssertEqual(notes.blocks.map(\.id), ["d1", d.id, "h1"])
        notes.indent("h1", depth: 1)
        XCTAssertEqual(notes.block("h1")?.depth, 1)
        XCTAssertTrue(notes.remove("h1"))
        XCTAssertNil(notes.block("h1"))
    }

    func testGapFillGoesAfterTheWholeSubtree() {
        var notes = ClassNotes(number: 1, dateLabel: "Thu Oct 22")
        notes.append(depth: 0, text: "topic")         // d1
        notes.append(depth: 1, text: "detail")        // d2
        notes.append(depth: 0, text: "next topic")    // d3
        let added = notes.addAfter("d1", text: "what the slide adds")!
        XCTAssertEqual(added.after, "d2")
        XCTAssertEqual(notes.blocks.map(\.id), ["d1", "d2", added.block.id, "d3"])
        XCTAssertEqual(added.block.author, .added)
        XCTAssertEqual(added.block.markdown, "- ⁺ what the slide adds")
    }

    func testCourseFileNewestClassOnTopOldOnesVerbatim() {
        let old = """
        # COURSE 101 notes

        his own line at the top

        ## CLASS 1 (Tue Oct 20): intro
        - kept   exactly
          - as he left it
        """
        var file = CourseNotesFile.parse(old, fallbackTitle: "unused")
        XCTAssertEqual(file.title, "COURSE 101 notes")
        XCTAssertEqual(file.preamble, "his own line at the top")
        XCTAssertEqual(file.nextClassNumber, 2)
        var today = ClassNotes(number: file.nextClassNumber, dateLabel: "Thu Oct 22")
        today.append(depth: 0, text: "**term**: meaning")
        file.upsert(today)
        today.title = "the second class"
        today.append(depth: 1, text: "more")
        file.upsert(today)
        XCTAssertEqual(file.sections.count, 2, "the live class replaces its own section, matched by number and date")
        XCTAssertEqual(file.markdown, """
        # COURSE 101 notes

        his own line at the top

        ## CLASS 2 (Thu Oct 22): the second class
        - **term**: meaning
          - more

        ## CLASS 1 (Tue Oct 20): intro
        - kept   exactly
          - as he left it

        """)
        let back = ClassNotes.parse(section: file.section(key: "CLASS 2 (Thu Oct 22)")!)!
        XCTAssertEqual(back.title, "the second class")
        XCTAssertEqual(back.blocks.map(\.text), ["**term**: meaning", "more"])
        XCTAssertEqual(back.blocks.map(\.depth), [0, 1])
    }

    func testImagesAndAddedLinesRoundTrip() {
        var notes = ClassNotes(number: 4, dateLabel: "Mon Oct 26", title: "proofs")
        notes.append(depth: 0, text: "claim")
        notes.appendImage(path: "notes-images/board-1142.jpg", caption: "board 11:42")
        notes.addAfter("d1", text: "the reading's lemma")
        let back = ClassNotes.parse(section: notes.markdown)!
        XCTAssertEqual(back.blocks.map(\.author), [.dot, .added, .dot])
        XCTAssertEqual(back.blocks.last?.image, "notes-images/board-1142.jpg")
        XCTAssertEqual(back.markdown, notes.markdown)
    }

    func testTailShowsIdsAndWhose() {
        var notes = ClassNotes(number: 1, dateLabel: "Thu Oct 22")
        notes.append(depth: 0, text: "a")
        notes.add(id: "h1", after: "d1", depth: 1, text: "mine")
        XCTAssertEqual(notes.tail(), ["d1 (dot, depth 0): a", "h1 (his, depth 1): mine"])
    }

    func testClassesFromTheCalendar() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        func item(_ title: String, _ startMin: Double, _ minutes: Double, calendar: String = "Home") -> CalendarItem {
            CalendarItem(title: title, start: now.addingTimeInterval(startMin * 60), end: now.addingTimeInterval((startMin + minutes) * 60), location: "Room 1", calendar: calendar)
        }
        let items = [item("Dinner: Sam Rivera", -5, 60), item("Intro to Examples: Lecture", -3, 80), item("Example Studies: Laboratory", -1, 180),
                     item("EXMP 10100 discussion", 30, 50), item("Office hours", -10, 60, calendar: "My Courses Autumn")]
        XCTAssertNil(LectureCalendar.asClass(items[0]), "a colon is not enough: the part after it must be a kind of class")
        XCTAssertEqual(LectureCalendar.asClass(items[1])?.course, "Intro to Examples")
        XCTAssertEqual(LectureCalendar.asClass(items[3])?.course, "EXMP 10100")
        XCTAssertEqual(LectureCalendar.asClass(items[3])?.kind, "Discussion")
        XCTAssertEqual(LectureCalendar.asClass(items[4])?.course, "Office hours", "anything on a course calendar")
        XCTAssertEqual(LectureCalendar.current(items, now: now)?.course, "Example Studies", "the class that started last")
        XCTAssertEqual(LectureCalendar.starting(items, now: now)?.course, "Intro to Examples", "labs are not offered lecture mode")
        XCTAssertNil(LectureCalendar.starting(items, now: now.addingTimeInterval(15 * 60)))
    }

    func testCourseFolders() {
        let map = CourseTag(fileName: "course101.md", text: "# EXMP 10100 (Intro to Examples, Example U)\n\nwords")!
        let folders = ["EXMP 10100", "Other Course", "HIST 20000"]
        XCTAssertEqual(LectureCourses.folder(for: "Intro to Examples", aliases: [:], maps: [map], folders: folders), "EXMP 10100")
        XCTAssertEqual(LectureCourses.folder(for: "other course", aliases: [:], maps: [], folders: folders), "Other Course")
        XCTAssertEqual(LectureCourses.folder(for: "HIST 20000", aliases: [:], maps: [], folders: folders), "HIST 20000")
        XCTAssertEqual(LectureCourses.folder(for: "Readings in Things", aliases: ["readings in things": "HIST 20000"], maps: [], folders: folders), "HIST 20000")
        XCTAssertNil(LectureCourses.folder(for: "Unknown Course", aliases: [:], maps: [map], folders: folders))
        XCTAssertEqual(LectureCourses.newFolderName(for: "Intro: Part I/II"), "Intro Part I II")
    }
}
