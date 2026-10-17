import XCTest
@testable import DotKit

final class AppSkillOffersTests: XCTestCase {
    func testPowerPoint() throws {
        let offer = try XCTUnwrap(AppSkillOffers.match(bundleID: "com.microsoft.Powerpoint", windowTitle: "MSK pitch.pptx", url: nil,
                                                       documentPath: "/Users/r/Desktop/MSK pitch.pptx"))
        XCTAssertEqual(offer.row, "powerpoint")
        XCTAssertEqual(offer.kind, "app.powerpoint")
        XCTAssertEqual(offer.skill, "powerpoint-design")
        XCTAssertEqual(offer.line, "want me to make this deck look designed?")
        XCTAssertTrue(offer.ask.contains("use the powerpoint-design skill"), offer.ask)
        XCTAssertTrue(offer.ask.contains("\"MSK pitch.pptx\", /Users/r/Desktop/MSK pitch.pptx"), offer.ask)
        XCTAssertFalse(offer.ask.contains("{"), offer.ask)
    }

    func testExcelPicksTheSkillByTitleWords() throws {
        let dcf = try XCTUnwrap(AppSkillOffers.match(bundleID: "com.microsoft.Excel", windowTitle: "AAPL DCF model.xlsx", url: nil))
        XCTAssertEqual(dcf.skill, "dcf-valuation", "dcf words are checked before model words")
        XCTAssertEqual(dcf.line, "want a check of this model?")
        XCTAssertTrue(dcf.ask.contains("use the dcf-valuation skill"))
        let wacc = try XCTUnwrap(AppSkillOffers.match(bundleID: "com.microsoft.Excel", windowTitle: "WACC build", url: nil))
        XCTAssertEqual(wacc.skill, "dcf-valuation")
        let model = try XCTUnwrap(AppSkillOffers.match(bundleID: "com.microsoft.Excel", windowTitle: "LBO Model v3.xlsx", url: nil))
        XCTAssertEqual(model.skill, "financial-modeling")
        let threeStatement = try XCTUnwrap(AppSkillOffers.match(bundleID: "com.microsoft.Excel", windowTitle: "3-statement build", url: nil))
        XCTAssertEqual(threeStatement.skill, "financial-modeling")
        XCTAssertEqual(threeStatement.row, "excel")
        // A workbook that is not a model gets no offer.
        XCTAssertNil(AppSkillOffers.match(bundleID: "com.microsoft.Excel", windowTitle: "Networking tracker.xlsx", url: nil))
        XCTAssertNil(AppSkillOffers.match(bundleID: "com.microsoft.Excel", windowTitle: "Book1", url: nil))
        XCTAssertNil(AppSkillOffers.match(bundleID: "com.microsoft.Excel", windowTitle: nil, url: nil))
    }

    func testFiling() throws {
        let pdf = try XCTUnwrap(AppSkillOffers.match(bundleID: "com.apple.Preview", windowTitle: "Tesla 10-K 2023.pdf", url: nil,
                                                     documentPath: "/Users/r/Downloads/Tesla 10-K 2023.pdf"))
        XCTAssertEqual(pdf.row, "filing")
        XCTAssertEqual(pdf.skill, "source-notes")
        XCTAssertEqual(pdf.line, "want notes on this filing?")
        XCTAssertTrue(pdf.ask.contains("use the source-notes skill"))
        XCTAssertTrue(pdf.ask.contains("/Users/r/Downloads/Tesla 10-K 2023.pdf"))
        let edgar = try XCTUnwrap(AppSkillOffers.match(bundleID: "ai.perplexity.comet", windowTitle: "aapl-20240928",
                                                       url: "https://www.sec.gov/Archives/edgar/data/320193/000032019324000123/aapl-20240928.htm"))
        XCTAssertEqual(edgar.row, "filing")
        XCTAssertTrue(edgar.ask.contains("https://www.sec.gov/Archives/"))
        let tenQ = try XCTUnwrap(AppSkillOffers.match(bundleID: "com.apple.Safari", windowTitle: "Form 10-Q | Nvidia", url: "https://investor.nvidia.com/q"))
        XCTAssertEqual(tenQ.skill, "source-notes")
        let s1 = try XCTUnwrap(AppSkillOffers.match(bundleID: "com.apple.Preview", windowTitle: "Klaviyo S-1.pdf", url: nil))
        XCTAssertEqual(s1.row, "filing")
        let eightK = try XCTUnwrap(AppSkillOffers.match(bundleID: "com.apple.Preview", windowTitle: "8-K exhibit 99.1.pdf", url: nil))
        XCTAssertEqual(eightK.row, "filing")
        // A filing named in mail is not a filing on screen.
        XCTAssertNil(AppSkillOffers.match(bundleID: "com.microsoft.Outlook", windowTitle: "Re: 10-K notes", url: nil))
    }

    func testCanvas() throws {
        let offer = try XCTUnwrap(AppSkillOffers.match(bundleID: "ai.perplexity.comet", windowTitle: "Homework 4: MATH 20250 - Comet",
                                                       url: "https://canvas.uchicago.edu/courses/61234/assignments/700001"))
        XCTAssertEqual(offer.row, "canvas")
        XCTAssertEqual(offer.skill, "course-notes")
        XCTAssertEqual(offer.line, "want the plan for this assignment?")
        XCTAssertTrue(offer.ask.contains("use the course-notes skill"))
        XCTAssertTrue(offer.ask.contains("~/Dot/talk/context"))
        XCTAssertTrue(offer.ask.contains("canvas.uchicago.edu/courses/61234"))
    }

    func testMisses() {
        XCTAssertNil(AppSkillOffers.match(bundleID: "com.microsoft.Word", windowTitle: "essay.docx", url: nil))
        XCTAssertNil(AppSkillOffers.match(bundleID: "ai.perplexity.comet", windowTitle: "YouTube - Comet", url: "https://www.youtube.com/"))
        XCTAssertNil(AppSkillOffers.match(bundleID: "com.apple.Preview", windowTitle: "HW1 (Week 1 Homework).pdf", url: nil))
        XCTAssertNil(AppSkillOffers.match(bundleID: nil, windowTitle: nil, url: nil))
    }

    func testEveryRowNamesARealSkill() {
        // Checked against ~/.claude/skills on 2026-10-17; a rename there should fail here first.
        let skills = Set(AppSkillOffers.rows.flatMap(\.skillNames))
        XCTAssertEqual(skills, ["powerpoint-design", "dcf-valuation", "financial-modeling", "source-notes", "course-notes"])
        XCTAssertEqual(AppSkillOffers.rows.map(\.kind), ["app.powerpoint", "app.excel", "app.filing", "app.canvas"])
    }

    func testTitleIsQuotedOnOneLine() {
        XCTAssertEqual(AppSkillOffers.describe(title: "a \"big\"\nmodel", place: nil), "\"a 'big' model\"")
        XCTAssertEqual(AppSkillOffers.describe(title: "", place: nil), "the window in front")
        XCTAssertEqual(AppSkillOffers.describe(title: "", place: "/tmp/x.pdf"), "/tmp/x.pdf")
    }

    func testOncePerRowPerDay() throws {
        let chicago = try XCTUnwrap(TimeZone(identifier: "America/Chicago"))
        // 2026-10-17 23:30 in Chicago is 04:30 UTC on the 18th: the day is his, not UTC's.
        let lateNight = Date(timeIntervalSince1970: 1_792_297_800)
        XCTAssertEqual(AppSkillOffers.day(lateNight, timeZone: chicago), "2026-10-17")
        XCTAssertEqual(AppSkillOffers.day(lateNight, timeZone: TimeZone(identifier: "UTC")!), "2026-10-18")
        var offered: [String: String] = [:]
        XCTAssertTrue(AppSkillOffers.isDue("excel", lastOffered: offered, today: "2026-10-17"))
        offered["excel"] = "2026-10-17"
        XCTAssertFalse(AppSkillOffers.isDue("excel", lastOffered: offered, today: "2026-10-17"))
        XCTAssertTrue(AppSkillOffers.isDue("powerpoint", lastOffered: offered, today: "2026-10-17"), "each row has its own day")
        XCTAssertTrue(AppSkillOffers.isDue("excel", lastOffered: offered, today: "2026-10-18"))
    }
}
