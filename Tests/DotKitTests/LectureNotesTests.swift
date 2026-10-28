import XCTest
@testable import DotKit

final class LectureNotesTests: XCTestCase {
    func testSlideMarker() {
        let (ops, ignored) = NoteProtocol.parse("- said before the slide\n[slide]\n- **key term** from the slide\n`[Slide]`\n- [slide] is text here")
        XCTAssertEqual(ops, [.append(depth: 0, text: "said before the slide"), .slide, .append(depth: 0, text: "**key term** from the slide"), .slide,
                             .append(depth: 0, text: "[slide] is text here")])
        XCTAssertEqual(ignored, [])
    }

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

    func testLineTimesRoundTripAndStayOutOfTheText() {
        var notes = ClassNotes(number: 2, dateLabel: "Thu Oct 22")
        notes.append(depth: 0, text: "**term**: meaning", at: "11:42:10")
        notes.add(id: "h1", after: "d1", depth: 1, text: "mine", at: "11:43:00")
        notes.appendImage(path: "notes-images/slide-1.jpg", caption: "slide: Intro", at: "11:44:05")
        XCTAssertEqual(notes.blocks[0].markdown, "- **term**: meaning <!--@11:42:10-->")
        let back = ClassNotes.parse(section: notes.markdown)!
        XCTAssertEqual(back.blocks.map(\.at), ["11:42:10", "11:43:00", "11:44:05"])
        XCTAssertEqual(back.blocks.map(\.text), ["**term**: meaning", "mine", "slide: Intro"])
        XCTAssertEqual(back.blocks[2].image, "notes-images/slide-1.jpg")
        XCTAssertFalse(back.tail().joined().contains("<!--"), "the writer never sees the time comments")
    }

    func testCourseTermsForTheRecognizer() {
        let text = """
        # EXMP 10100 (Intro to Examples)
        Detection uses **real-time PCR** and LC-MS. The qPCR signal tracks mRNA.
        Then the Krebs cycle feeds the Electron Transport chain. The end.
        Monday: Exam 1. PCR again and PCR once more.
        """
        let terms = LectureTerms.extract(text)
        XCTAssertEqual(terms.first, "PCR", "the most frequent term leads")
        for t in ["real-time PCR", "LC-MS", "qPCR", "mRNA", "Krebs"] { XCTAssertTrue(terms.contains(t), t) }
        for t in ["Detection", "The", "Monday", "Exam", "Then", "Electron", "Transport"] { XCTAssertFalse(terms.contains(t), t) }
        XCTAssertEqual(LectureTerms.extract(text, limit: 2).count, 2)
    }

    func testOrdinaryWordsInCapitalsAreNotTerms() {
        let text = """
        The textbook is by Treil, Linear Algebra Done Wrong. Office hours with Wu.
        We reach the Jordan form, which Mark proves in section.
        LA CHAPTER III LINEAR MAPS AND QUOTIENT SPACES
        A linear map between quotient spaces; the SVD and the RREF of LP.
        LA CHAPTER III LINEAR MAPS AND QUOTIENT SPACES
        """
        let terms = LectureTerms.extract(text)
        for t in ["SVD", "RREF", "Treil", "Jordan", "Mark"] { XCTAssertTrue(terms.contains(t), t) }   // names that are also words
        for t in ["Done", "Wrong", "AND", "LA", "CHAPTER", "III", "LINEAR", "MAPS", "QUOTIENT", "SPACES", "Linear", "Algebra"] {
            XCTAssertFalse(terms.contains(t), t)
        }
    }

    func testSpokenCourseNamesFindTheirFolder() {
        let map = CourseTag(fileName: "exmp10100.md", text: "# EXMP 10100 (Biotechnology for Examples, Example U)\n\nwords")!
        let folders = ["EXMP 10100", "MATH 20000", "PHYS 13000", "HIST 17000", "Other lectures"]
        let aliases = ["Language and the Example I": "HIST 17000", "Mechanics": "PHYS 13000"]
        func r(_ s: String) -> String? { LectureCourses.resolve(spoken: s, aliases: aliases, maps: [map], folders: folders) }
        XCTAssertEqual(r("biotech"), "EXMP 10100", "a word that starts a course map's name")
        XCTAssertEqual(r("math"), "MATH 20000", "the department code")
        XCTAssertEqual(r("physics"), "PHYS 13000", "a word the code begins")
        XCTAssertEqual(r("mechanics"), "PHYS 13000", "his calendar name")
        XCTAssertEqual(r("language and the example"), "HIST 17000")
        XCTAssertEqual(r("other lectures"), "Other lectures")
        XCTAssertNil(r("chemistry"))
    }

    func testWhatCountsAsASlide() {
        XCTAssertTrue(LectureSlides.looksLikeSlides(bundle: "com.microsoft.Powerpoint", title: "anything", url: nil))
        XCTAssertTrue(LectureSlides.looksLikeSlides(bundle: "ai.perplexity.comet", title: "Lec 4 - Gene Expression", url: "https://canvas.example.edu/files/9"))
        XCTAssertTrue(LectureSlides.looksLikeSlides(bundle: "ai.perplexity.comet", title: "Deck", url: "https://docs.google.com/presentation/d/x"))
        XCTAssertFalse(LectureSlides.looksLikeSlides(bundle: "ai.perplexity.comet", title: "Instagram", url: "https://instagram.com"))
        XCTAssertFalse(LectureSlides.looksLikeSlides(bundle: "com.apple.MobileSMS", title: "Messages", url: nil))
    }

    func testWhyAndDeadlineLines() {
        let (ops, ignored) = NoteProtocol.parse("""
        FEEDBACK: u got the first two
        WHY: why does a lower Ct mean more starting RNA?
        DEADLINE: 2026-10-27 | Exam 1 | d4
        DEADLINE: 2026-11-19T11:00 | Exam II | none
        DEADLINE: 2026-10-29 | news article signup
        """)
        XCTAssertEqual(ops, [.feedback("u got the first two"), .why("why does a lower Ct mean more starting RNA?"),
                             .deadline(due: "2026-10-27", title: "Exam 1", block: "d4"),
                             .deadline(due: "2026-11-19T11:00", title: "Exam II", block: nil),
                             .deadline(due: "2026-10-29", title: "news article signup", block: nil)])
        XCTAssertEqual(ignored, [])
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

    func testARepeatedLineIsDropped() {
        var notes = ClassNotes(number: 1, dateLabel: "Thu Oct 22")
        notes.append(depth: 0, text: "same point")
        XCTAssertNil(notes.append(depth: 1, text: "same point"))
        XCTAssertEqual(notes.blocks.count, 1)
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

    func testLectureLiveNamesOnlyTheClassGoingOn() {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("lecture-live-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }
        let file = "/tmp/Other lectures/Other lectures notes.md", demo = "/tmp/demo/EXMP notes.md"
        XCTAssertNil(LectureLive.key(for: file, in: url))
        LectureLive.set("CLASS 1 (Sun Oct 25)", for: file, in: url)
        LectureLive.set("CLASS 4 (Sun Oct 25)", for: demo, in: url)
        XCTAssertEqual(LectureLive.key(for: file, in: url), "CLASS 1 (Sun Oct 25)", "a restart mid-class resumes it")
        LectureLive.clear("CLASS 9 (Sun Oct 25)", for: file, in: url)
        XCTAssertEqual(LectureLive.key(for: file, in: url), "CLASS 1 (Sun Oct 25)", "another class's finish leaves it")
        LectureLive.clear("CLASS 1 (Sun Oct 25)", for: file, in: url)
        XCTAssertNil(LectureLive.key(for: file, in: url), "finished: a second talk that day is a new class")
        XCTAssertEqual(LectureLive.key(for: demo, in: url), "CLASS 4 (Sun Oct 25)", "a demo's sandbox file is its own")
        LectureLive.clear("CLASS 4 (Sun Oct 25)", for: demo, in: url)
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path), "nothing going on: no file")
    }
}
