import XCTest
@testable import DotKit

final class ChimesTests: XCTestCase {
    func testDefaultMap() {
        XCTAssertEqual(ChimeEvent.resolve(.launch, overrides: [:]), "Pop")
        XCTAssertEqual(ChimeEvent.resolve(.needsYou, overrides: [:]), "Tink")
        XCTAssertEqual(ChimeEvent.resolve(.done, overrides: [:]), "Glass")
        XCTAssertEqual(ChimeEvent.resolve(.failed, overrides: [:]), "Basso")
    }

    func testDefaultsAreRealSystemSounds() {
        for event in ChimeEvent.allCases {
            let path = "/System/Library/Sounds/\(event.defaultName).aiff"
            XCTAssertTrue(FileManager.default.fileExists(atPath: path), path)
        }
    }

    func testOverridesFallBackPerKey() {
        let overrides = ["done": "Hero", "failed": "  ", "launch": "~/Dot/style/start.caf"]
        XCTAssertEqual(ChimeEvent.resolve(.done, overrides: overrides), "Hero")
        XCTAssertEqual(ChimeEvent.resolve(.failed, overrides: overrides), "Basso")
        XCTAssertEqual(ChimeEvent.resolve(.needsYou, overrides: overrides), "Tink")
        XCTAssertEqual(ChimeEvent.resolve(.launch, overrides: overrides), "~/Dot/style/start.caf")
    }

    func testKeySpellingsAndSilence() {
        XCTAssertEqual(ChimeEvent.resolve(.needsYou, overrides: ["needs_you": "Ping"]), "Ping")
        XCTAssertEqual(ChimeEvent.resolve(.needsYou, overrides: ["NeedsYou": "Purr"]), "Purr")
        XCTAssertNil(ChimeEvent.resolve(.done, overrides: ["done": "none"]))
        XCTAssertNil(ChimeEvent.resolve(.done, overrides: ["done": "None"]))
        let all = ChimeEvent.resolveAll(overrides: ["failed": "none"])
        XCTAssertEqual(all.count, ChimeEvent.allCases.count)
        XCTAssertEqual(all[.done] ?? nil, "Glass")
        XCTAssertNil(all[.failed] ?? nil)
    }
}
