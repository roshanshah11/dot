import XCTest
@testable import DotKit

final class CardMarkupTests: XCTestCase {
    func testWhichCardsAreUILanguage() {
        XCTAssertTrue(CardMarkup.isUILanguage("<box tone=\"card\"><title size=\"sm\">UA 1542</title></box>"))
        XCTAssertTrue(CardMarkup.isUILanguage("\n<!-- a flight -->\n<lead>ORD to SFO, Friday</lead>"))
        XCTAssertTrue(CardMarkup.isUILanguage("<table><tr><td>a</td></tr></table>"), "a table renders in either")
        XCTAssertTrue(CardMarkup.isUILanguage("<box tone=\"card\"><text>ORD</text><divider><text>Gate C18</text></box>"), "<divider> is not <div>")
        XCTAssertFalse(CardMarkup.isUILanguage("<box><div>x</div></box>"))
        XCTAssertFalse(CardMarkup.isUILanguage("<box><p class=\"caption stage\">x</p></box>"))
        XCTAssertFalse(CardMarkup.isUILanguage("<div class=\"plot\" data-fn=\"x*x\"></div>"), "today's HTML cards stay HTML")
        XCTAssertFalse(CardMarkup.isUILanguage("<table><tr><td><div class=\"chart\"></div></td></tr></table>"))
        XCTAssertFalse(CardMarkup.isUILanguage("<h2>PCR</h2><div class=\"stage\"></div>"))
        XCTAssertFalse(CardMarkup.isUILanguage("plain words"))
        XCTAssertFalse(CardMarkup.isUILanguage("<svg viewBox=\"0 0 10 10\"></svg>"), "svg alone is an HTML card's figure")
    }

    func testEmbedding() {
        XCTAssertEqual(CardMarkup.jsString("a \"b\"\nc"), "\"a \\\"b\\\"\\nc\"")
        XCTAssertFalse(CardMarkup.jsString("<lead>x</lead></script><script>alert(1)</script>").contains("</script>"))
        XCTAssertTrue(CardMarkup.isLight(hex: "#f6f3ee"))
        XCTAssertFalse(CardMarkup.isLight(hex: "#0d0c0b"))
    }

    /// A designed card streams in pieces like any card block and reaches the board whole, as UI language.
    func testDesignedCardStreams() {
        var streamer = BeatStreamer()
        var beats: [Beat] = []
        for delta in ["putting your flight up.\n[CARD:flight:auto:UA 1542] <", "<<\n<box tone=\"card\">\n<title size=\"md\">ORD to SFO</ti",
                      "tle>\n<row><text>7:05 am</text><text>gate C18</text></row>\n<cite label=\"United email\">sample</cite>\n</box>\n>",
                      ">>\nit leaves at seven oh five from C18."] {
            beats += streamer.feed(delta)
        }
        beats += streamer.flush()
        XCTAssertEqual(beats.map(\.text), ["putting your flight up.", "it leaves at seven oh five from C18."])
        guard case .card(let id, let rect, let title, let body, _)? = beats[1].tags.first else { return XCTFail("card missing on beat 2") }
        XCTAssertEqual(id, "flight"); XCTAssertNil(rect); XCTAssertEqual(title, "UA 1542")
        XCTAssertTrue(body.hasPrefix("<box tone=\"card\">") && body.hasSuffix("</box>"))
        XCTAssertTrue(CardMarkup.isUILanguage(body))
        XCTAssertFalse(streamer.spokenSoFar.contains("<title"))
    }
}
