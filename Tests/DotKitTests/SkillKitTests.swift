import XCTest
@testable import DotKit

final class SkillKitTests: XCTestCase {
    func testAvatarRules() {
        XCTAssertEqual(SkillAvatar.symbol(name: "roshan-email", description: "Write any email under his name"), "envelope")
        XCTAssertEqual(SkillAvatar.symbol(name: "powerpoint-design", description: "Build PowerPoint decks"), "rectangle.on.rectangle.angled")
        XCTAssertEqual(SkillAvatar.symbol(name: "pitch-judge", description: "Judge a stock pitch deck"), "chart.line.uptrend.xyaxis",
                       "the name outweighs a deck in the description")
        XCTAssertEqual(SkillAvatar.symbol(name: "technicals", description: "IB technical interview coach"), "graduationcap")
        XCTAssertEqual(SkillAvatar.symbol(name: "web-taste", description: "Build websites that feel alive"), "globe")
        XCTAssertEqual(SkillAvatar.symbol(name: "zzz", description: ""), "sparkles")
        XCTAssertTrue(SkillAvatar.choices.contains("sparkles"))
        XCTAssertEqual(Set(SkillAvatar.choices).count, SkillAvatar.choices.count, "each symbol once")
    }

    func testLinksFromPaste() {
        let pasted = "see https://a.com/x, and (https://b.org/y). also https://a.com/x again <https://c.io> not-a-link ftp://d"
        XCTAssertEqual(SkillDraft.links(in: pasted).map(\.absoluteString), ["https://a.com/x", "https://b.org/y", "https://c.io"])
    }

    func testExtractFromReply() {
        let reply = "Here it is:\n```markdown\n---\nname: deal-notes\ndescription: Notes on a deal.\n---\n\n# Deal notes\n\nRead the 8-K first.\n```\nDone."
        let text = SkillDraft.extract(reply)
        XCTAssertEqual(text, "---\nname: deal-notes\ndescription: Notes on a deal.\n---\n\n# Deal notes\n\nRead the 8-K first.\n")
        XCTAssertEqual(SkillDraft.extract("---\nname: x\ndescription: y\n---\nbody")?.hasPrefix("---\nname: x"), true)
        XCTAssertNil(SkillDraft.extract("I couldn't read the links."))
    }

    func testProblems() {
        let good = "---\nname: deal-notes\ndescription: \"Notes on a deal; use for an 8-K.\"\n---\n\n# Deal notes\n\nRead the 8-K first, then the press release, then the call.\n"
        XCTAssertEqual(SkillDraft.problems(good, existing: []), [])
        XCTAssertEqual(SkillDraft.problems(good, existing: ["deal-notes"]), ["a skill called deal-notes already exists"])
        XCTAssertEqual(SkillDraft.problems(good.replacingOccurrences(of: "deal-notes", with: "Deal Notes"), existing: []),
                       ["the name must be lowercase words joined by hyphens, under 40 characters"])
        XCTAssertEqual(SkillDraft.problems(good.replacingOccurrences(of: "then the call", with: "then \u{2014} the call"), existing: []), ["it has em dashes"])
        XCTAssertEqual(SkillDraft.problems("---\nname: a\n---\n", existing: []), ["no description", "the body is empty"])
    }

    func testPromptCarriesTheRules() {
        let p = SkillDraft.prompt(links: [URL(string: "https://a.com")!], purpose: "deal notes", existing: ["roshan-email"])
        XCTAssertTrue(p.contains("- https://a.com"))
        XCTAssertTrue(p.contains("roshan-email"))
        XCTAssertTrue(p.contains("no em dashes"))
    }
}
