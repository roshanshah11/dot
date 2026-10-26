import XCTest
@testable import DotKit

final class FigureTests: XCTestCase {
    func testCellRecipeParses() throws {
        let tag = try XCTUnwrap(TagParser.parse("Here's a cell. [FIGURE:animal cell|membrane: sphere 3 glass #9ecbff; nucleus: sphere 1.1 @0.4,0.2,0 #7b5cff; mitochondrion: capsule 0.35x1.2 @-1.5,0.5,0.8 rot 0,0,40 #ff6b2c]").tags.first)
        guard case .figure(let recipe) = tag else { return XCTFail("not a figure: \(tag)") }
        XCTAssertEqual(recipe.title, "animal cell")
        XCTAssertNil(recipe.place)
        XCTAssertEqual(recipe.parts.map(\.name), ["membrane", "nucleus", "mitochondrion"])
        XCTAssertEqual(recipe.parts[0].shape, .sphere(radius: 3))
        XCTAssertEqual(recipe.parts[0].material, .glass)
        XCTAssertEqual(recipe.parts[1].position, FigurePoint(0.4, 0.2, 0))
        XCTAssertEqual(recipe.parts[2].shape, .capsule(radius: 0.35, height: 1.2))
        XCTAssertEqual(recipe.parts[2].rotation, FigurePoint(0, 0, 40))
        XCTAssertEqual(recipe.parts[2].colorHex, "#ff6b2c")
        XCTAssertTrue(tag.isVisual)
        XCTAssertEqual("\(recipe)", "animal cell (3 parts)")
        // round trip
        XCTAssertEqual(FigureRecipe.parse(String(recipe.tagText.dropFirst(8).dropLast())), recipe)
    }

    func testEveryShapeAndPlace() throws {
        let recipe = try XCTUnwrap(FigureRecipe.parse("e12:engine|block: box 2x1x1 metal; bore: cylinder 0.4x1.2; spark: cone 0x0.2x0.5; ring: torus 1x0.1; sleeve: tube 0.5x0.4x1; cam: extrude 0,0/1,0/0.5,1 depth 0.2; cube: box 1"))
        XCTAssertEqual(recipe.place, .element(12))
        XCTAssertEqual(recipe.parts.count, 7)
        XCTAssertEqual(recipe.parts[2].shape, .cone(top: 0, bottom: 0.2, height: 0.5))
        XCTAssertEqual(recipe.parts[5].shape, .extrude(points: [CGPoint(x: 0, y: 0), CGPoint(x: 1, y: 0), CGPoint(x: 0.5, y: 1)], depth: 0.2))
        XCTAssertEqual(recipe.parts[6].shape, .box(width: 1, height: 1, depth: 1))
        XCTAssertTrue(recipe.skipped.isEmpty)
        XCTAssertEqual(FigureRecipe.parse("120,80:cell|a: sphere 1")?.place, .point(CGPoint(x: 120, y: 80)))
    }

    func testBadPartsAreSkippedNotFatal() throws {
        let recipe = try XCTUnwrap(FigureRecipe.parse("thing|good: sphere 1; bad: blob 2; huge: sphere 500; nosize: box; torus: torus 1x2; tail: sphere 1 sparkly"))
        XCTAssertEqual(recipe.parts.map(\.name), ["good"])
        XCTAssertEqual(recipe.skipped.count, 5)
        XCTAssertTrue(recipe.skipped[0].hasPrefix("bad: unknown shape"))
        XCTAssertNil(FigureRecipe.parse("thing|bad: blob 2"), "no part left means no figure, never a blank stage")
        XCTAssertNil(FigureRecipe.parse("no bar here"))
        XCTAssertNil(FigureRecipe.parse("|a: sphere 1"), "a figure needs a title")
    }

    func testDuplicateNamesAndPartCap() throws {
        let recipe = try XCTUnwrap(FigureRecipe.parse("dots|dot: sphere 1; dot: sphere 1 @2,0,0; Dot: sphere 1 @4,0,0"))
        XCTAssertEqual(recipe.parts.map(\.name), ["dot", "dot 2", "Dot 3"])
        let many = (0..<50).map { "p\($0): sphere 0.1" }.joined(separator: "; ")
        let capped = try XCTUnwrap(FigureRecipe.parse("many|" + many))
        XCTAssertEqual(capped.parts.count, FigureRecipe.maxParts)
        XCTAssertEqual(capped.skipped.count, 10)
    }

    func testMoleculeGoesToACard() {
        let recipe = FigureRecipe.parse("B-DNA|molecule 1BNA")
        XCTAssertEqual(recipe?.molecule, "1bna")
        XCTAssertEqual(recipe?.parts, [])
        XCTAssertNil(FigureRecipe.parse("x|molecule notapdb")?.molecule)
    }

    func testVertexCapLowersDetail() {
        let sphere = FigureShape.sphere(radius: 1)
        XCTAssertEqual(sphere.segments(cap: 100_000), 48)
        let s = sphere.segments(cap: 300)
        XCTAssertLessThan(s, 48)
        XCTAssertLessThanOrEqual(sphere.vertices(segments: s), 300)
        let box = FigureShape.box(width: 1, height: 1, depth: 1)
        XCTAssertEqual(box.vertices(segments: 6), box.vertices(segments: 48), "a box has no detail to lower")
    }

    func testRadiusCoversParts() throws {
        let recipe = try XCTUnwrap(FigureRecipe.parse("pair|a: sphere 1; b: sphere 0.5 @3,4,0"))
        XCTAssertEqual(recipe.radius, 5.5, accuracy: 1e-9)
    }

    func testPartClickSummary() {
        let e = CardEvent(card: "c1", kind: "part", data: ["part": .text("mitochondrion"), "figure": .text("animal cell")])
        XCTAssertEqual(e.summary, "he clicked \"mitochondrion\" on the figure \"animal cell\"")
        XCTAssertEqual(CardEvent(card: "c1", kind: "part", data: ["figure": .text("helix")]).summary, "he clicked the figure \"helix\"")
    }
}
