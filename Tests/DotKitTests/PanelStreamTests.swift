import XCTest
@testable import DotKit

final class PanelStreamTests: XCTestCase {
    private func run(_ deltas: [String]) -> [PanelStream.Event] {
        var s = PanelStream()
        var out: [PanelStream.Event] = []
        for d in deltas { out += s.feed(d) }
        out += s.finish()
        return PanelStream.merged(out)
    }

    private let answer = "putting the kernel on the panel.\n[PANEL:kernel:The kernel of T]\n<<<\n<lead>The kernel is what T crushes to zero.</lead>\n<steps><step n=\"1\" title=\"what vanishes\">...</step></steps>\n>>>\n[STEP:kernel:1] feed T a vector and look at the output."

    func testWholeAnswerInOneDelta() {
        XCTAssertEqual(run([answer]), [
            .text("putting the kernel on the panel.\n"),
            .open(id: "kernel", title: "The kernel of T"),
            .chunk("\n<lead>The kernel is what T crushes to zero.</lead>\n<steps><step n=\"1\" title=\"what vanishes\">...</step></steps>\n"),
            .close,
            .text("\n[STEP:kernel:1] feed T a vector and look at the output."),
        ])
    }

    func testSameResultWhateverTheDeltaSizes() {
        let whole = run([answer])
        for size in [1, 2, 3, 5, 7, 13, 40] {
            var deltas: [String] = []
            var rest = Substring(answer)
            while !rest.isEmpty { deltas.append(String(rest.prefix(size))); rest = rest.dropFirst(size) }
            XCTAssertEqual(run(deltas), whole, "delta size \(size)")
        }
    }

    func testMarkupNeverReachesTheVoice() {
        var s = PanelStream()
        var spoken = ""
        var chunks = ""
        for ch in answer { for e in s.feed(String(ch)) { if case .text(let t) = e { spoken += t }; if case .chunk(let c) = e { chunks += c } } }
        for e in s.finish() { if case .text(let t) = e { spoken += t } }
        XCTAssertFalse(spoken.contains("<lead>"))
        XCTAssertTrue(chunks.contains("<lead>"))
        XCTAssertTrue(spoken.contains("[STEP:kernel:1]"))
    }

    func testUnclosedPanelClosesAtTheEnd() {
        XCTAssertEqual(run(["[PANEL:x:T] <<< <lead>half"]), [.open(id: "x", title: "T"), .chunk(" <lead>half"), .close])
    }

    func testTagWithoutBlockAndOtherBrackets() {
        XCTAssertEqual(run(["[PANEL:x:T] then words"]), [.open(id: "x", title: "T"), .close, .text(" then words")])
        XCTAssertEqual(run(["the set [0, 1] and [POINT:3,4:here] stay text"]), [.text("the set [0, 1] and [POINT:3,4:here] stay text")])
        XCTAssertEqual(run(["a title with a colon [PANEL:k:Span: what it is]<<<x>>>"]), [.text("a title with a colon "), .open(id: "k", title: "Span: what it is"), .chunk("x"), .close])
    }

    func testStepTagParsesAndIsNeverSpoken() {
        let parsed = TagParser.parse("[STEP:kernel:2] in this example, x two is minus x one.")
        XCTAssertEqual(parsed.tags, [.step(id: "kernel", n: 2)])
        XCTAssertEqual(parsed.spoken, "in this example, x two is minus x one.")
        XCTAssertTrue(DotTag.step(id: "k", n: 1).isVisual)
        XCTAssertEqual(TagParser.parse("[STEP:kernel:zero] hi").tags, [])
        XCTAssertEqual(TagParser.parse("[STEP:kernel] hi").tags, [])
        XCTAssertEqual(TagParser.parse("[STEP:pcr:0] what goes in the tube").tags, [.step(id: "pcr", n: 0)])
    }
}
