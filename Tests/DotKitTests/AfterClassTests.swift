import XCTest
@testable import DotKit

/// The after-class pass (2026-10-25): what the live notes missed goes in where it belongs and in order, Dot's own wrong
/// lines are fixed and marked, his lines and his title are never touched, and all of it survives the file.
final class AfterClassTests: XCTestCase {
    func notes() -> ClassNotes {
        var n = ClassNotes(number: 1, dateLabel: "Sun Oct 25")
        n.add(id: "h1", after: nil, depth: 0, text: "COURSE 101 guest talk", at: "11:17:23")
        n.append(depth: 0, text: "**IRR** target: fund projections aim at a set IRR", at: "11:17:22")   // d1
        n.append(depth: 1, text: "numbers game: one big winner pays for the rest", at: "11:17:22")      // d2
        n.append(depth: 0, text: "PE buys companies valued ~$300 mil(?)", at: "11:19:53")               // d3
        return n
    }

    func testMissedPointsGoWhereTheyBelongInOrder() {
        var n = notes()
        let reply = """
        +under d1: fund life ~10 yrs
        +under d1: target net IRR 20%+
        +after d3: PE improves operations, then sells
          - cut costs, add expertise
          - exit in 3-7 yrs
        +after d3: VC: earlier stage, smaller checks
        +after end: next session: term sheets
        """
        let out = AfterClass.apply(reply, to: &n, titleLocked: false)
        XCTAssertEqual(out.added.count, 7)
        XCTAssertEqual(n.blocks.map(\.text), [
            "COURSE 101 guest talk",
            "**IRR** target: fund projections aim at a set IRR",
            "numbers game: one big winner pays for the rest",
            "fund life ~10 yrs",
            "target net IRR 20%+",
            "PE buys companies valued ~$300 mil(?)",
            "PE improves operations, then sells",
            "cut costs, add expertise",
            "exit in 3-7 yrs",
            "VC: earlier stage, smaller checks",
            "next session: term sheets",
        ])
        XCTAssertEqual(n.blocks.map(\.depth), [0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0])
        XCTAssertTrue(n.blocks.filter { $0.text.contains("yrs") || $0.text.contains("VC:") }.allSatisfy { $0.author == .added })
        XCTAssertEqual(out.summary, "after class: 7 added, 0 fixed")
    }

    func testOnlyDotsOwnLinesAreFixed() {
        var n = notes()
        let hisID = n.blocks[0].id
        let reply = "~d3: PE buys companies valued ~$300-400 mil\n~\(hisID): not his to change\n~d2: numbers game: one big winner pays for the rest"
        let out = AfterClass.apply(reply, to: &n, titleLocked: false)
        XCTAssertEqual(out.fixed.map(\.text), ["PE buys companies valued ~$300-400 mil"], "his line refused; an unchanged line isn't a fix")
        XCTAssertEqual(n.block("d3")?.fixed, true)
        XCTAssertEqual(n.blocks[0].text, "COURSE 101 guest talk")
    }

    func testHisTitleWins() {
        var n = notes()
        XCTAssertNil(AfterClass.apply("## venture capital basics", to: &n, titleLocked: true).title)
        XCTAssertEqual(n.title, "")
        XCTAssertEqual(AfterClass.apply("## venture capital basics", to: &n, titleLocked: false).title, "venture capital basics")
        n.title = "his own"
        XCTAssertNil(AfterClass.apply("## another", to: &n, titleLocked: false).title, "a class with a title keeps it")
    }

    func testHisLinesAndFixesSurviveTheFile() {
        var n = notes()
        _ = AfterClass.apply("~d3: PE buys companies valued ~$300-400 mil\n+after d3: an added line", to: &n, titleLocked: false)
        n.add(id: "h2", after: nil, depth: 0, text: "typed after class")
        let md = n.markdown
        XCTAssertTrue(md.contains("- COURSE 101 guest talk <!--@11:17:23 his-->"), md)
        XCTAssertTrue(md.contains("~$300-400 mil <!--@11:19:53 fixed-->"), md)
        XCTAssertTrue(md.contains("- typed after class <!--@ his-->"), md)
        let back = ClassNotes.parse(section: md)!
        XCTAssertEqual(back.blocks.map(\.author), [.him, .dot, .dot, .dot, .added, .him])
        XCTAssertEqual(back.blocks.map(\.fixed), [false, false, false, true, false, false])
        XCTAssertEqual(back.blocks.map(\.at), ["11:17:23", "11:17:22", "11:17:22", "11:19:53", nil, nil])
        XCTAssertEqual(back.markdown, md)
    }

    func testUnderParses() {
        XCTAssertEqual(NoteProtocol.parse("+under d4: - a detail").ops, [.addUnder(id: "d4", text: "a detail")])
    }

    func testTranscriptParagraphsFromTokens() {
        var tokens: [TranscriptParagraphs.Token] = []
        var t = 0.0
        for sentence in ["\u{2581}first \u{2581}point \u{2581}here.", "\u{2581}still \u{2581}going.", "\u{2581}next \u{2581}one."] {
            for piece in sentence.split(separator: " ") { tokens.append(.init(text: String(piece), start: t)); t += 7 }
        }
        let paragraphs = TranscriptParagraphs.group(tokens, seconds: 30)
        XCTAssertEqual(paragraphs.map(\.text), ["first point here. still going.", "next one."])
        XCTAssertEqual(paragraphs.map(\.start), [0, 35])
        let md = TranscriptParagraphs.markdown(paragraphs, began: Date(timeIntervalSince1970: 0), title: "COURSE 101 CLASS 1")
        XCTAssertTrue(md.contains("** first point here. still going.") && md.contains("** next one."), md)
    }

    func testRechecksAt8pmAnd8am() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/Chicago")!
        let noon = cal.date(from: DateComponents(year: 2026, month: 10, day: 26, hour: 12, minute: 50))!
        let late = cal.date(from: DateComponents(year: 2026, month: 10, day: 26, hour: 19, minute: 45))!
        let fmt = { (d: Date) in cal.dateComponents([.day, .hour], from: d) }
        XCTAssertEqual(LectureRechecks.times(classEnded: noon, calendar: cal).map(fmt), [DateComponents(day: 26, hour: 20), DateComponents(day: 27, hour: 8)])
        XCTAssertEqual(LectureRechecks.times(classEnded: late, calendar: cal).map(fmt), [DateComponents(day: 27, hour: 8)], "too close to 8 pm: the morning only")
        XCTAssertEqual(LectureRechecks.newFiles(before: ["Lec 4.pptx", "COURSE 101 notes.md"], now: ["Lec 4.pptx", "Lec 5.pptx", ".DS_Store", "photo.jpg", "COURSE 101 notes.md"],
                                                readable: ["pptx", "pdf", "md"]), ["Lec 5.pptx"])
    }

    func testRecheckRoundTrip() throws {
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("rechecks-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: file) }
        var item = LectureRecheck(course: "COURSE 101", title: "Intro to Examples", key: "CLASS 3 (Mon Oct 26)", notesFile: "/tmp/n.md",
                                  transcriptFile: "/tmp/t.md", due: Date(timeIntervalSince1970: 1_800_000_000))
        item.started = Date(timeIntervalSince1970: 1_800_000_100)
        item.before = ["a.pptx"]
        LectureRechecks.save([item], to: file)
        XCTAssertEqual(LectureRechecks.load(file), [item])
    }
}
