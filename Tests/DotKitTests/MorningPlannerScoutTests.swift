import XCTest
@testable import DotKit

final class MorningPlannerScoutTests: XCTestCase {
    private func day(_ text: String) -> Date {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd HH:mm"; f.locale = Locale(identifier: "en_US_POSIX")
        return f.date(from: text)!
    }
    private let deadlines = ["2026-10-17 Raymond James Sophomore Showcase application due 11:59 PM ET: short essays"]
    private let calls = ["Sat 10-17 12:30–12:45 Call: Alex Morgan (BlackRock) (at Call (555) 010-0199)"]
    private var scout: ScoutBriefFile { ScoutBriefFile.decode(Data(ScoutFixtures.good.utf8))! }

    func testTodaysFileWinsOverTheTemplates() {
        let items = MorningPlanner.suggestions(scout: scout, deadlines: deadlines, today: calls, unanswered: [], commitments: [], date: day("2026-10-17 08:00"))
        XCTAssertEqual(items.map(\.key), ["huma-class-prep", "citizen-coffee-chat"])
        XCTAssertEqual(items[0].text, "Walk into every HUMA seminar with three points to say")
        XCTAssertEqual(items[0].agentName, "Seminar Scribe")
        XCTAssertEqual(items[0].agentRole, "Class prepper")
        XCTAssertEqual(items[0].routine?.when, "every day at 7am")
        XCTAssertEqual(items[0].sources.count, 2)
        XCTAssertNil(items[1].agentRole)
        XCTAssertFalse(items.contains { $0.text.contains("raymond james") })
    }

    func testYesterdaysFileIsIgnored() {
        let items = MorningPlanner.suggestions(scout: scout, deadlines: deadlines, today: calls, unanswered: [], commitments: [], date: day("2026-10-18 08:00"))
        XCTAssertFalse(items.contains { $0.key == "huma-class-prep" })
        XCTAssertTrue(items.contains { $0.key.hasPrefix("deadline:") || $0.key.hasPrefix("brief:") })
    }

    func testDecidedBriefIdsAreNotOfferedAgain() {
        let items = MorningPlanner.suggestions(scout: scout, deadlines: [], today: [], unanswered: [], commitments: [], date: day("2026-10-17 08:00"),
                                               declined: ["huma-class-prep"])
        XCTAssertEqual(items.map(\.key), ["citizen-coffee-chat"])
    }

    func testCallBriefNamesNoFileFormat() {
        let items = MorningPlanner.suggestions(deadlines: [], today: calls, unanswered: [], commitments: [], date: day("2026-10-17 08:00"))
        XCTAssertEqual(items.count, 1)
        XCTAssertFalse(items[0].brief.lowercased().contains("pdf"))
        XCTAssertTrue(items[0].brief.hasSuffix("three questions to ask."))
    }

    func testGreetingNamesTheTitles() {
        XCTAssertEqual(MorningPlanner.greeting(count: 5, hour: 8, titles: ["prepping Citizen", "the week plan"]),
                       "morning. i can do 5 things today, like prepping Citizen and the week plan.")
        XCTAssertEqual(MorningPlanner.greeting(count: 5, hour: 8, titles: ["prepping Citizen", "the week plan", "the postings"]),
                       "morning. i can do 5 things today, like prepping Citizen, the week plan and the postings.")
        // Three that run long become two.
        XCTAssertEqual(MorningPlanner.greeting(count: 4, hour: 14, titles: ["a brief on Alex Morgan at BlackRock", "the Raymond James essays", "the postings"]),
                       "afternoon. i can do 4 things today, like a brief on Alex Morgan at BlackRock and the Raymond James essays.")
        XCTAssertEqual(MorningPlanner.greeting(count: 2, hour: 8, titles: ["prepping Citizen", "the week plan"]),
                       "morning. i can do 2 things today: prepping Citizen and the week plan.")
        XCTAssertEqual(MorningPlanner.greeting(count: 1, hour: 19, titles: ["the week plan"]), "evening. i can do 1 thing today: the week plan.")
        // No titles: the template greeting, unchanged.
        XCTAssertEqual(MorningPlanner.greeting(count: 3, hour: 9), "morning. i can do 3 things for you today.")
        let items = MorningPlanner.suggestions(scout: scout, deadlines: [], today: [], unanswered: [], commitments: [], date: day("2026-10-17 08:00"))
        XCTAssertEqual(items.map(MorningPlanner.greetingWords), ["prepping Citizen", "a one-page brief on Jane Doe before Friday's call"])
        XCTAssertEqual(MorningPlanner.lowerFirst("SEC filings for Nvidia"), "SEC filings for Nvidia")
    }

    func testHandoffBriefCarriesTheTagRoleRoutineAndSources() {
        let items = MorningPlanner.suggestions(scout: scout, deadlines: [], today: [], unanswered: [], commitments: [], date: day("2026-10-17 08:00"))
        let text = items[0].handoffBrief
        XCTAssertTrue(text.hasPrefix("[suggestion] Walk into every HUMA seminar with three points to say\n\nGoal:"))
        XCTAssertTrue(text.contains("RUN 1 (do it fully now):"))
        XCTAssertTrue(text.contains("You are new: Seminar Scribe, Class prepper."))
        XCTAssertTrue(text.contains("This becomes a routine (Class reading prep, every day at 7am)"))
        XCTAssertTrue(text.contains("\n\nWHERE THIS CAME FROM\n"))
        XCTAssertLessThan(text.range(of: "RUN 1")!.lowerBound, text.range(of: "WHERE THIS CAME FROM")!.lowerBound)
        // The routine runs the later part over the baseline, not run one again.
        let routine = items[0].routineBrief ?? ""
        XCTAssertTrue(routine.contains("EVERY LATER RUN (daily)"))
        XCTAssertTrue(routine.contains("Baseline file: output/class-prep/schedule.md"))
        XCTAssertFalse(routine.contains("RUN 1"))
        XCTAssertNil(items[1].routineBrief)
        // A template item keeps its brief and only gains the tag.
        let template = MorningPlanner.suggestions(deadlines: [], today: calls, unanswered: [], commitments: [], date: day("2026-10-17 08:00"))[0]
        XCTAssertEqual(template.handoffBrief, "[suggestion] " + template.brief)
    }
}
