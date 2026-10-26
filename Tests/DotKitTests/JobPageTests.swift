import XCTest
@testable import DotKit

final class JobPageTests: XCTestCase {
    let page = """
    <status tone="info">Applying to Lazard</status>
    <lead>Two applications are ready for you</lead>
    <todo id="t1">
      <item id="i1" done="false" mark="needs">Email Prof. Lee</item>
      <item id="i2" done="true">Upload the <b>resume</b></item>
    </todo>
    <form id="f1" title="Trip" submit="Save">
      <field name="dates" label="Dates" type="date">
      <field name="who" label="Who's going" type="text"/>
    </form>
    <review id="r1"><item id="a" reason="fits">Lazard SA</item><item id="b">Evercore</item></review>
    <letter id="l1" proposal="p_7f3a">CANARY body the page must not supply</letter>
    """

    func parsed() throws -> JobPage { try JobPage.parse(page).get() }

    func testObjectsHeadlineStatus() throws {
        let p = try parsed()
        XCTAssertEqual(p.headline, "Two applications are ready for you")
        XCTAssertEqual(p.status, "Applying to Lazard")
        XCTAssertEqual(p.objects.map(\.id), ["t1", "f1", "r1", "l1"])
        XCTAssertEqual(p.object("t1")?.row("i2"), "Upload the resume")
        XCTAssertEqual(p.object("f1")?.rows.map(\.id), ["dates", "who"])
        XCTAssertEqual(p.object("l1")?.attributes["proposal"], "p_7f3a")
        XCTAssertTrue(p.object("l1")?.rows.isEmpty ?? false, "a letter's words never come from the page")
        XCTAssertEqual(p.version, JobPage.version(of: page))
        XCTAssertNotEqual(p.version, JobPage.version(of: page + " "))
    }

    func testRepeatedIDsAreRefused() {
        let twice = "<todo id=\"t1\"><item id=\"i1\">a</item></todo><review id=\"t1\"><item id=\"x\">b</item></review>"
        XCTAssertEqual(JobPage.parse(twice), .failure(.repeatedIDs(["t1"])))
        let rows = "<todo id=\"t1\"><item id=\"i1\">a</item><item id=\"i1\">b</item></todo>"
        XCTAssertEqual(JobPage.parse(rows), .failure(.repeatedIDs(["t1/i1"])))
        XCTAssertEqual(JobPage.parse(String(repeating: "x", count: JobPage.maxBytes + 1)), .failure(.tooBig(JobPage.maxBytes + 1)))
    }

    func testHeadlineFallsBackToTheFirstLine() throws {
        XCTAssertEqual(try JobPage.parse("# Booking the room\nsome text").get().headline, "Booking the room")
        XCTAssertEqual(try JobPage.parse("<title>Trip plan</title>").get().headline, "Trip plan")
    }

    func testTicksAndFormsBecomeTurnLines() throws {
        let p = try parsed()
        XCTAssertEqual(PageTurn.message(.pageTick(panel: "j", object: "t1", item: "i1", done: true, event: "e1", version: p.version), page: p),
                       "[page] he ticked \"Email Prof. Lee\" (t1 i1)")
        XCTAssertEqual(PageTurn.message(.pageForm(panel: "j", object: "f1", fields: ["dates": "Nov 3-5", "who": "me", "evil": "x"], event: "e2", version: p.version), page: p),
                       "[page] he filled the form \"Trip\" (f1): dates=\"Nov 3-5\", who=\"me\"")
        let review = PanelMessage.pageReview(panel: "j", object: "r1", decisions: [PageDecision(item: "a", approve: true), PageDecision(item: "b", approve: false, reason: "too late"), PageDecision(item: "zz", approve: true)],
                                             event: "e3", version: p.version)
        XCTAssertEqual(PageTurn.message(review, page: p),
                       "[page] he went through the review (r1): approved \"Lazard SA\" (a); rejected \"Evercore\" (b) because \"too late\"")
    }

    func testStaleOrForgedTapsReachNothing() throws {
        let p = try parsed()
        XCTAssertNil(PageTurn.message(.pageTick(panel: "j", object: "t9", item: "i1", done: true, event: "e", version: ""), page: p), "no such object")
        XCTAssertNil(PageTurn.message(.pageTick(panel: "j", object: "f1", item: "dates", done: true, event: "e", version: ""), page: p), "a form is not a todo")
        XCTAssertNil(PageTurn.message(.pageForm(panel: "j", object: "f1", fields: ["evil": "x"], event: "e", version: ""), page: p), "no known field")
        XCTAssertNil(PageTurn.message(.pageLetter(panel: "j", object: "l1", proposal: "p_other", send: false, event: "e", version: ""), page: p), "wrong proposal")
        XCTAssertNil(PageTurn.message(.pageLetter(panel: "j", object: "l1", proposal: "p_7f3a", send: true, event: "e", version: ""), page: p), "a send is never a job message")
        XCTAssertNotNil(PageTurn.message(.pageLetter(panel: "j", object: "l1", proposal: "p_7f3a", send: false, event: "e", version: ""), page: p))
    }

    func testWireParsing() {
        XCTAssertEqual(PanelMessage(["type": "page_tick", "panel": "job-x", "object": "t1", "item": "i1", "done": true, "event": "abc123", "version": "9f"]),
                       .pageTick(panel: "job-x", object: "t1", item: "i1", done: true, event: "abc123", version: "9f"))
        XCTAssertNil(PanelMessage(["type": "page_tick", "object": "t1", "item": "i1", "done": true]), "a tap needs its event id")
        XCTAssertNil(PanelMessage(["type": "page_tick", "object": "t 1", "item": "i1", "done": true, "event": "e"]), "ids are plain")
        let long = String(repeating: "x", count: 5000)
        if case .pageForm(_, _, let fields, _, _)? = PanelMessage(["type": "page_form", "object": "f1", "fields": ["dates": long, "n": 3], "event": "e"]) {
            XCTAssertEqual(fields["dates"]?.count, PanelMessage.pageMaxText)
            XCTAssertNil(fields["n"], "values are strings")
        } else { XCTFail("form did not parse") }
        XCTAssertEqual(PanelMessage(["type": "page_letter", "object": "l1", "proposal": "p_7f3a", "choice": "send", "event": "e"]),
                       .pageLetter(panel: "", object: "l1", proposal: "p_7f3a", send: true, event: "e", version: ""))
        XCTAssertNil(PanelMessage(["type": "page_letter", "object": "l1", "proposal": "p_7f3a", "choice": "post", "event": "e"]))
    }

    func testDedupeDropsRepeatsOnOneVersion() {
        var d = PageDedupe()
        XCTAssertTrue(d.admit(event: "e1", version: "v1"))
        XCTAssertFalse(d.admit(event: "e1", version: "v1"))
        XCTAssertTrue(d.admit(event: "e1", version: "v2"))
        XCTAssertTrue(d.admit(event: "e2", version: "v1"))
    }
}
