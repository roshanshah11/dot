import XCTest
@testable import DotKit

final class InkTagTests: XCTestCase {
    private func tags(_ text: String) -> [DotTag] { TagParser.parse(text).tags }

    func testEveryKindParsesAndLeavesNoWordsBehind() {
        let text = """
        [WRITE:100,200:net income] [LABEL:e12:discount rate] [NUM:e3:2] [FRAME:10,20,300,120:the inputs] \
        [UNDERLINE:e4] [STRIKE:10,50;200,50] [CHECK:e5] [CROSS:40,40] [CONNECT:e3;e7:drives] \
        [TRACE:1,1;50,1;50,40;1,40:region] [STICKY:300,300:WACC is the hurdle] [PHOTO:500,100:mitochondria] \
        [TYPE_TEXT:e9:=B2*C2] here it is.
        """
        let parsed = TagParser.parse(text)
        XCTAssertEqual(parsed.spoken, "here it is.")
        let kinds = parsed.tags.compactMap { if case .ink(let s) = $0 { return s.kind }; return nil }
        XCTAssertEqual(kinds, [.write, .label, .num, .frame, .underline, .strike, .check, .cross, .connect, .trace, .sticky, .photo, .typeText])
    }

    func testPlacesAreElementsPointsOrBoxes() {
        XCTAssertEqual(InkPlace.parse("e12"), .element(12))
        XCTAssertEqual(InkPlace.parse(" E3 "), .element(3))
        XCTAssertEqual(InkPlace.parse("10,20"), .point(CGPoint(x: 10, y: 20)))
        XCTAssertEqual(InkPlace.parse("10,20,30,40"), .rect(CGRect(x: 10, y: 20, width: 30, height: 40)))
        XCTAssertNil(InkPlace.parse("e0"))
        XCTAssertNil(InkPlace.parse("10,20,0,40"))
        XCTAssertNil(InkPlace.parse("ten,20"))
        XCTAssertNil(InkPlace.parse("10,20,30"))
    }

    func testMalformedInkIsDropped() {
        XCTAssertEqual(tags("[LABEL:e12:]"), [])            // a label with no name
        XCTAssertEqual(tags("[NUM:e3:two]"), [])            // a badge needs a number
        XCTAssertEqual(tags("[FRAME:10,20:box]"), [])       // a frame needs a region
        XCTAssertEqual(tags("[CONNECT:e3:x]"), [])          // two ends
        XCTAssertEqual(tags("[TRACE:1,1;2,2:x]"), [])       // three points at least
        XCTAssertEqual(tags("[UNDERLINE:10,10]"), [])       // two points or the thing itself
        XCTAssertEqual(tags("[WRITE:e1;e2:x]"), [])         // one place
        XCTAssertEqual(tags("[EDIT:m2:recolor:plaid]"), []) // not a colour
        XCTAssertEqual(tags("[EDIT:x2:move:1,2]"), [])      // not a mark id
        XCTAssertEqual(tags("[EDIT:m2:scale:40]"), [])      // out of range
    }

    func testEditsAndTheirIds() {
        XCTAssertEqual(tags("[EDIT:m2:recolor:red]"), [.inkEdit(.recolor(id: "m2", color: "red"))])
        XCTAssertEqual(tags("[EDIT:M02:move:e5]"), [.inkEdit(.move(id: "m2", to: .element(5)))])
        XCTAssertEqual(tags("[EDIT:m4:scale:1.4]"), [.inkEdit(.scale(id: "m4", factor: 1.4))])
        XCTAssertEqual(tags("[ERASE:m3] [UNDO] [ADD]"), [.inkEdit(.erase(id: "m3")), .inkEdit(.undo), .inkEdit(.keep)])
        guard case .ink(let spec)? = tags("[ADD:LABEL:e3:the other one]").first else { return XCTFail("no add") }
        XCTAssertTrue(spec.add)
        XCTAssertEqual(spec.kind, .label)
        XCTAssertEqual(spec.places, [.element(3)])
    }

    func testScreenSuffixAndColonsInWords() {
        guard case .ink(let spec)? = tags("[STICKY:10,10:ratio 3:1 here:screen2]").first else { return XCTFail() }
        XCTAssertEqual(spec.screen, 2)
        XCTAssertEqual(spec.text, "ratio 3:1 here")
    }

    func testTypeTextIsNotTheTypeTag() {
        guard case .ink(let spec)? = tags("[TYPE_TEXT:10,10:hello]").first else { return XCTFail("TYPE_TEXT read as TYPE") }
        XCTAssertEqual(spec.kind, .typeText)
    }

    func testStreamingHoldsAnUnfinishedInkTag() {
        XCTAssertEqual(TagParser.speakablePrefix("see this [UNDERL").hold, "[UNDERL")
        XCTAssertEqual(TagParser.speakablePrefix("see this [TYPE_TE").hold, "[TYPE_TE")
        var streamer = BeatStreamer()
        var beats = streamer.feed("[LABEL:e2:the rate] This is the rate. [UNDER")
        beats += streamer.feed("LINE:e4] And this. ")
        beats += streamer.flush()
        XCTAssertEqual(beats.count, 2)
        XCTAssertEqual(beats[0].text, "This is the rate.")
        XCTAssertTrue(beats[0].tags.contains { if case .ink(let s) = $0 { return s.kind == .label }; return false })
        XCTAssertTrue(beats[1].tags.contains { if case .ink(let s) = $0 { return s.kind == .underline }; return false })
    }
}

final class InkBoardTests: XCTestCase {
    private func spec(_ kind: InkKind, _ text: String = "x") -> InkSpec { InkSpec(kind: kind, places: [.point(.zero)], text: text) }

    func testIdsCountUpAndLinesDescribeTheDrawing() {
        var board = InkBoard()
        XCTAssertEqual(board.add(spec(.label, "Discount rate"), frame: CGRect(x: 400, y: 80, width: 24, height: 16)).id, "m1")
        XCTAssertEqual(board.add(spec(.underline, ""), frame: CGRect(x: 10, y: 10, width: 100, height: 4)).id, "m2")
        XCTAssertEqual(board.lines, ["m1 label \"Discount rate\" at 412,88", "m2 underline at 60,12"])
    }

    func testEditsByIdAndUndo() {
        var board = InkBoard()
        board.add(spec(.label, "a"), frame: CGRect(x: 0, y: 0, width: 10, height: 10))
        board.add(spec(.label, "b"), frame: CGRect(x: 100, y: 0, width: 10, height: 10))
        board.add(spec(.label, "c"), frame: CGRect(x: 200, y: 0, width: 10, height: 10))
        XCTAssertEqual(board.apply(.recolor(id: "m2", color: "red")), ["m2"])
        XCTAssertEqual(board.mark("m2")?.color, "red")
        XCTAssertEqual(board.apply(.scale(id: "m1", factor: 2)), ["m1"])
        XCTAssertEqual(board.mark("m1")?.frame, CGRect(x: -5, y: -5, width: 20, height: 20))
        XCTAssertEqual(board.apply(.move(id: "m3", to: .point(.zero)), moveTo: CGRect(x: 50, y: 50, width: 0, height: 0)), ["m3"])
        XCTAssertEqual(board.mark("m3")?.frame.midX, 50)
        XCTAssertEqual(board.apply(.erase(id: "m2")), ["m2"])
        XCTAssertNil(board.mark("m2"))
        XCTAssertEqual(board.apply(.undo), ["m3"])
        XCTAssertEqual(board.marks.map(\.id), ["m1"])
        XCTAssertEqual(board.apply(.erase(id: "m9")), [])
        // ids never repeat after an erase
        XCTAssertEqual(board.add(spec(.check), frame: .zero).id, "m4")
    }

    func testCapDropsTheOldest() {
        var board = InkBoard()
        for _ in 0..<InkBoard.cap { board.add(spec(.check), frame: .zero) }
        let next = board.add(spec(.check), frame: .zero)
        XCTAssertEqual(next.dropped, ["m1"])
        XCTAssertEqual(board.marks.count, InkBoard.cap)
    }

    func testOldInkFades() {
        var board = InkBoard()
        let t0 = Date(timeIntervalSince1970: 1000)
        board.add(spec(.check), frame: .zero, at: t0)
        board.add(spec(.check), frame: .zero, at: t0.addingTimeInterval(100))
        XCTAssertEqual(board.older(than: 120, now: t0.addingTimeInterval(130)), ["m1"])
    }
}

final class InkTimingTests: XCTestCase {
    func testMarksSpreadAcrossTheSentenceInOrder() {
        let plan = InkTiming.schedule(naturals: [0.5, 0.5, 1.0], sentence: 3, characters: 40)
        XCTAssertEqual(plan.count, 3)
        XCTAssertEqual(plan[0].start, 0)
        XCTAssertEqual(plan[1].start, plan[0].duration, accuracy: 1e-9)
        XCTAssertEqual(plan[2].start, plan[0].duration + plan[1].duration, accuracy: 1e-9)
        let end = plan[2].start + plan[2].duration
        XCTAssertEqual(end, 3 * 0.85, accuracy: 0.001)        // fills 85% of a 3 s sentence
    }

    func testLimits() {
        // a tiny drawing in a long sentence stretches 2.5x at most
        XCTAssertEqual(InkTiming.schedule(naturals: [0.3], sentence: 20, characters: 10)[0].duration, 0.75, accuracy: 1e-9)
        // a big drawing in a short sentence squeezes to a third of natural at most
        XCTAssertEqual(InkTiming.schedule(naturals: [3], sentence: 0.5, characters: 10)[0].duration, 1.05, accuracy: 1e-9)
        // no duration: 65 ms a character
        XCTAssertEqual(InkTiming.schedule(naturals: [1], sentence: nil, characters: 20)[0].duration, 20 * 0.065 * 0.85, accuracy: 1e-9)
        XCTAssertEqual(InkTiming.natural(strokeLength: 0, characters: 0), 0.25)
        XCTAssertEqual(InkTiming.natural(strokeLength: 6000, characters: 0), 1.6)
    }
}

final class InkGeometryTests: XCTestCase {
    private let screen = CGRect(x: 0, y: 0, width: 1440, height: 900)

    func testOutlineTapersAndGrowsWithProgress() {
        let line = InkPen.resample([CGPoint(x: 0, y: 0), CGPoint(x: 200, y: 0)])
        let full = InkPen.outline(line, width: 4, progress: 1)
        let half = InkPen.outline(line, width: 4, progress: 0.5)
        XCTAssertGreaterThan(full.count, half.count)
        XCTAssertEqual(InkGeometry.bounds(of: half).maxX, 100, accuracy: 2.5)
        // thin where the pen lands and lifts, about full width in the middle
        let widthAt: ([CGPoint], Int) -> CGFloat = { pts, i in abs(pts[i].y - pts[pts.count - 1 - i].y) }
        XCTAssertLessThan(widthAt(full, 0), 2)
        XCTAssertGreaterThan(widthAt(full, full.count / 4), 3.2)
        XCTAssertLessThan(widthAt(full, full.count / 2 - 1), 2)
        XCTAssertEqual(InkPen.outline([CGPoint(x: 1, y: 1)], width: 4), [])
    }

    func testWobbleRepeatsForTheSameSeedAndStaysClose() {
        let line = InkPen.resample([CGPoint(x: 0, y: 0), CGPoint(x: 300, y: 0)])
        let a = InkPen.wobble(line, amplitude: 1, seed: 7), b = InkPen.wobble(line, amplitude: 1, seed: 7), c = InkPen.wobble(line, amplitude: 1, seed: 8)
        XCTAssertEqual(a, b)
        XCTAssertNotEqual(a, c)
        XCTAssertTrue(a.allSatisfy { abs($0.y) <= 1.0001 })
    }

    func testEachKindDraws() {
        let element = CGRect(x: 400, y: 300, width: 120, height: 24)
        let point = CGRect(x: 400, y: 300, width: 0, height: 0)
        for kind in InkKind.allCases {
            let anchors: [CGRect]
            switch kind {
            case .connect: anchors = [element, CGRect(x: 800, y: 500, width: 60, height: 20)]
            case .trace: anchors = [point, CGRect(x: 500, y: 300, width: 0, height: 0), CGRect(x: 450, y: 380, width: 0, height: 0)]
            case .frame, .underline, .strike: anchors = [element]
            default: anchors = [kind == .write || kind == .sticky ? point : element]
            }
            let text = kind == .num ? "2" : "the rate"
            guard let drawing = InkGeometry.make(kind, text: text, in: .init(anchors: anchors, bounds: screen)) else { return XCTFail("\(kind) drew nothing") }
            XCTAssertFalse(drawing.pieces.isEmpty, "\(kind)")
            XCTAssertTrue(screen.insetBy(dx: -20, dy: -20).contains(drawing.bounds), "\(kind) left the screen: \(drawing.bounds)")
            XCTAssertEqual(drawing.pieces.first?.from, 0, "\(kind)")
            XCTAssertEqual(drawing.pieces.last?.to ?? 0, 1, accuracy: 1e-6, "\(kind)")
            for (a, b) in zip(drawing.pieces, drawing.pieces.dropFirst()) { XCTAssertEqual(a.to, b.from, accuracy: 1e-6) }
        }
    }

    func testUnderlineSitsBelowTheWordsAndStrikeThroughThem() {
        let word = CGRect(x: 100, y: 100, width: 80, height: 20)
        let under = InkGeometry.make(.underline, text: "", in: .init(anchors: [word], bounds: screen))!.strokes[0]
        XCTAssertTrue(under.points.allSatisfy { $0.y > word.maxY })
        let strike = InkGeometry.make(.strike, text: "", in: .init(anchors: [word], bounds: screen))!.strokes[0]
        XCTAssertTrue(strike.points.allSatisfy { abs($0.y - word.midY) < 3 })
    }

    func testFrameHasTintOutlineAndPillInOrder() {
        let d = InkGeometry.make(.frame, text: "inputs", in: .init(anchors: [CGRect(x: 100, y: 200, width: 300, height: 100)], bounds: screen))!
        guard d.pieces.count == 3, case .fill(let f) = d.pieces[0].body, case .stroke(let s) = d.pieces[1].body, case .text(let t) = d.pieces[2].body else {
            return XCTFail("frame pieces: \(d.pieces)")
        }
        XCTAssertEqual(f.style, .tint)
        XCTAssertEqual(s.style, .dashed)
        XCTAssertTrue(s.closed)
        XCTAssertEqual(t.style, .pill)
        XCTAssertLessThan(t.frame.maxY, 200)   // the name sits above the region
    }

    func testConnectEndsOutsideBothThingsWithAnArrowhead() {
        let a = CGRect(x: 100, y: 100, width: 100, height: 40), b = CGRect(x: 500, y: 400, width: 100, height: 40)
        let d = InkGeometry.make(.connect, text: "", in: .init(anchors: [a, b], bounds: screen))!
        XCTAssertEqual(d.strokes.count, 3)   // the curve and two barbs
        let curve = d.strokes[0].points
        XCTAssertFalse(a.contains(curve[0]))
        XCTAssertFalse(b.contains(curve[curve.count - 1]))
    }

    func testLayoutPicksTheCalmSpotAndNudgesOffOtherLabels() {
        let target = CGRect(x: 500, y: 400, width: 100, height: 20)
        let size = CGSize(width: 80, height: 25)
        // above is free and calm: it wins
        let above = InkLayout.beside(target, size: size, bounds: screen, avoid: [])
        XCTAssertLessThan(above.maxY, target.minY)
        // above is busy with text: below wins
        let below = InkLayout.beside(target, size: size, bounds: screen, avoid: [], busy: { $0.maxY < 400 ? 5 : 0 })
        XCTAssertGreaterThan(below.minY, target.maxY)
        // above holds another label: not there
        let other = CGRect(x: 480, y: 360, width: 140, height: 40)
        XCTAssertFalse(InkLayout.beside(target, size: size, bounds: screen, avoid: [other]).intersects(other))
        // at the top edge, above does not fit inside the screen and gets clamped onto the target: below instead
        let top = InkLayout.beside(CGRect(x: 10, y: 2, width: 60, height: 20), size: size, bounds: screen, avoid: [])
        XCTAssertGreaterThanOrEqual(top.minY, 0)
        XCTAssertFalse(top.intersects(CGRect(x: 12, y: 4, width: 56, height: 16)))
        let nudged = InkLayout.nudge(CGRect(x: 100, y: 100, width: 50, height: 20), avoiding: [CGRect(x: 90, y: 90, width: 80, height: 40)], bounds: screen)
        XCTAssertFalse(nudged.intersects(CGRect(x: 90, y: 90, width: 80, height: 40)))
    }

    func testStickyWrapsAndTilts() {
        let d = InkGeometry.make(.sticky, text: "the discount rate is the return investors demand for the risk", in: .init(anchors: [CGRect(x: 200, y: 200, width: 0, height: 0)], bounds: screen))!
        XCTAssertEqual(d.fills.first?.style, .paper)
        XCTAssertNotEqual(d.fills.first?.rotation, 0)
        XCTAssertTrue(d.texts[0].text.contains("\n"))
        XCTAssertEqual(InkGeometry.wrap("a bb ccc dddd", width: 6), "a bb\nccc\ndddd")
    }

    func testFreeWordTone() {
        XCTAssertEqual(InkColors.freeWordHex(onLuminance: 0.1), "#ffffff")
        XCTAssertEqual(InkColors.freeWordHex(onLuminance: 0.9), "#1a1b1f")
        XCTAssertEqual(InkColors.hex("ink"), "")
        XCTAssertEqual(InkColors.hex("#A1B2C3"), "#a1b2c3")
        XCTAssertNil(InkColors.hex("#12"))
    }
}
