import XCTest
@testable import DotKit

final class StyleTokensTests: XCTestCase {
    static let repo = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()

    func merged(_ json: String) -> StyleTokens { StyleTokens.merged(userData: Data(json.utf8)) }

    func testDefaultsAreCompleteAndClean() {
        let tokens = StyleTokens.defaults
        XCTAssertEqual(tokens.problems, [])
        XCTAssertEqual(tokens.overrides, [])
        XCTAssertEqual(tokens.look, .auto)
        for name in StyleTokens.lookNames {
            XCTAssertEqual(Set(tokens.look(name).values.keys), Set(StyleTokens.lookKeys.map(\.key)), name)
        }
        XCTAssertEqual(Set(tokens.modes.keys), Set(StyleTokens.modeNames))
        XCTAssertEqual(Set(tokens.fileColors.keys), Set(StyleTokens.fileKinds))
        XCTAssertEqual(tokens.chimes, StyleTokens.Chimes(launch: "Pop", needsYou: "Tink", done: "Glass", failed: "Basso"))
        // Study is today's card: the dark glass ground, the orange accent, the same ink.
        let study = tokens.look("study")
        XCTAssertEqual(study.background.hex, "#0d0c0b")
        XCTAssertEqual(study.backgroundAlpha, 0.97)
        XCTAssertEqual(study.accentHex, "#ff6b2c")
        XCTAssertFalse(study.tabularNumerals)
        XCTAssertTrue(tokens.look("desk").tabularNumerals)
        XCTAssertEqual(tokens.look("desk").accentHex, "#f2a93b")
    }

    func testShippedFileEqualsTheEmbeddedDefaults() throws {
        let data = try Data(contentsOf: Self.repo.appendingPathComponent("Resources/board/tokens.default.json"))
        let fromFile = StyleTokens.merged(userData: data)
        XCTAssertEqual(fromFile.problems, [])
        XCTAssertEqual(fromFile.look, StyleTokens.defaults.look)
        XCTAssertEqual(fromFile.looks, StyleTokens.defaults.looks)
        XCTAssertEqual(fromFile.modes, StyleTokens.defaults.modes)
        XCTAssertEqual(fromFile.chimes, StyleTokens.defaults.chimes)
        XCTAssertEqual(fromFile.fileColors, StyleTokens.defaults.fileColors)
    }

    /// board.css carries the same defaults, so a page without {{TOKENS}} (the snapshot path) still looks right.
    func testBoardCSSDefaultsEqualTheTokens() throws {
        let css = try String(contentsOf: Self.repo.appendingPathComponent("Resources/board/board.css"), encoding: .utf8)
        func block(_ selector: String) -> [String: String] {
            guard let start = css.range(of: selector + " {"), let end = css.range(of: "}", range: start.upperBound..<css.endIndex) else { return [:] }
            var out: [String: String] = [:]
            for part in css[start.upperBound..<end.lowerBound].split(separator: ";") {
                let pair = part.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                if pair.count == 2 { out[pair[0]] = pair[1] }
            }
            return out
        }
        func expected(_ look: String) -> [String: String] {
            var out: [String: String] = [:]
            for part in StyleTokens.defaults.declarations(StyleTokens.defaults.look(look)).split(separator: ";") {
                let pair = part.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
                if pair.count == 2 { out[pair[0]] = pair[1] }
            }
            return out
        }
        XCTAssertEqual(block(":root"), expected("study"))
        XCTAssertEqual(block(":root[data-look=\"desk\"]"), expected("desk"))
        XCTAssertEqual(block(":root").count, StyleTokens.lookKeys.count)
    }

    func testHisValuesWinKeyByKey() {
        let tokens = merged("""
        {"looks": {"study": {"accent": "#4f8cff"}}, "chimes": {"done": "Hero"},
         "modes": {"desk": {"voiceRate": 1.3}}, "fileColors": {"csv": "#33aa66"}}
        """)
        XCTAssertEqual(tokens.problems, [])
        XCTAssertEqual(tokens.look("study").accentHex, "#4f8cff")
        XCTAssertEqual(tokens.look("study")["paper"], "#f0ebe3")
        XCTAssertEqual(tokens.look("desk"), StyleTokens.defaults.look("desk"))
        XCTAssertEqual(tokens.chimes.done, "Hero")
        XCTAssertEqual(tokens.chimes.failed, "Basso")
        XCTAssertEqual(tokens.mode("desk").voiceRate, 1.3)
        XCTAssertEqual(tokens.mode("desk").look, .desk)
        XCTAssertEqual(tokens.fileColors["csv"], "#33aa66")
        XCTAssertEqual(tokens.fileColors["pdf"], "#e5534b")
        XCTAssertEqual(tokens.overrides, ["looks.study.accent", "chimes.done", "modes.desk.voiceRate", "fileColors.csv"])
    }

    func testMissingFileIsTheDefaults() {
        let nowhere = FileManager.default.temporaryDirectory.appendingPathComponent("dot-no-such-\(UUID().uuidString)/tokens.json")
        XCTAssertEqual(StyleTokens.load(from: nowhere), StyleTokens.defaults)
    }

    func testLoadReadsHisFile() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("dot-style-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let file = dir.appendingPathComponent("tokens.json")
        try Data(#"{"look": "desk"}"#.utf8).write(to: file)
        let tokens = StyleTokens.load(from: file)
        XCTAssertEqual(tokens.look, .desk)
        XCTAssertEqual(tokens.lookName(forHTML: "<p>hi</p>"), "desk")
    }

    func testBadValuesFallBackPerKey() {
        let tokens = merged("""
        {"look": "neon",
         "looks": {"desk": {"accent": "orangeish", "paper": "#e0e0e0", "font": "x; } body { display: none",
                            "backgroundAlpha": 2, "titleWeight": true, "line": "rgba(255,255,255)"}},
         "modes": {"call": {"speak": "no", "voiceRate": 9, "density": "compact"}},
         "chimes": {"failed": "../../x"},
         "fileColors": {"pdf": "red", "Bad Kind": "#ffffff"}}
        """)
        let desk = tokens.look("desk"), base = StyleTokens.defaults.look("desk")
        XCTAssertEqual(tokens.look, .auto)
        XCTAssertEqual(desk.accentHex, base.accentHex)
        XCTAssertEqual(desk["paper"], "#e0e0e0", "a good value beside bad ones is still his")
        XCTAssertEqual(desk["font"], base["font"])
        XCTAssertEqual(desk["backgroundAlpha"], base["backgroundAlpha"])
        XCTAssertEqual(desk["titleWeight"], base["titleWeight"])
        XCTAssertEqual(desk["line"], base["line"])
        XCTAssertEqual(tokens.mode("call"), StyleTokens.defaults.mode("call"))
        XCTAssertEqual(tokens.chimes.failed, "Basso")
        XCTAssertEqual(tokens.fileColors["pdf"], "#e5534b")
        XCTAssertNil(tokens.fileColors["Bad Kind"])
        XCTAssertEqual(tokens.problems.count, 11)
        XCTAssertTrue(tokens.problems.contains { $0.hasPrefix("looks.desk.accent: \"orangeish\"") })
        XCTAssertEqual(tokens.overrides, ["looks.desk.paper", "modes.call.density"])
        XCTAssertFalse(tokens.cssVariables(look: "desk").contains("display: none"))
    }

    func testNotJSONKeepsEveryDefault() {
        let tokens = merged("look: desk")
        XCTAssertEqual(tokens.looks, StyleTokens.defaults.looks)
        XCTAssertEqual(tokens.look, .auto)
        XCTAssertEqual(tokens.problems.count, 1)
    }

    func testCSSVariables() {
        let css = StyleTokens.defaults.cssVariables(look: "study")
        XCTAssertTrue(css.hasPrefix(":root { --card-bg: #0d0c0b; --card-alpha: 0.97; --stage-alpha: 1;"))
        XCTAssertTrue(css.contains("--accent: #ff6b2c;"))
        XCTAssertTrue(css.contains("--glass-rgb: 255, 255, 255;"))
        XCTAssertTrue(css.contains("--font: -apple-system, \"SF Pro Text\", \"Helvetica Neue\", sans-serif;"))
        XCTAssertTrue(css.contains(":root[data-look=\"desk\"] { --card-bg: #0c1828;"))
        XCTAssertTrue(css.contains("--numerals: tabular-nums;"))
        XCTAssertEqual(css.components(separatedBy: "\n").count, 3)
        XCTAssertTrue(StyleTokens.defaults.cssVariables(look: "desk").hasPrefix(":root { --card-bg: #0c1828;"))
    }

    func testWhichLookACardWears() {
        let tokens = StyleTokens.defaults
        XCTAssertEqual(tokens.lookName(forHTML: "<div class=\"step\">x</div>"), "study")
        XCTAssertEqual(tokens.lookName(forHTML: "<div class=\"comps\" data-source=\"x\"></div>"), "desk")
        XCTAssertEqual(tokens.lookName(forHTML: "<div class='fin football'></div>"), "desk")
        XCTAssertEqual(tokens.lookName(forHTML: "<div class=\"sensitive\">no</div>"), "study")
        XCTAssertEqual(tokens.lookName(forHTML: "<p>x</p>", mode: "desk"), "desk")
        XCTAssertEqual(tokens.lookName(forHTML: "<p>x</p>", mode: "lecture"), "study")
        XCTAssertEqual(tokens.lookName(forHTML: "<p>x</p>", mode: "call"), "study")
        let chosen = merged(#"{"look": "study"}"#)
        XCTAssertEqual(chosen.lookName(forHTML: "<p>x</p>", mode: "desk"), "study")
        XCTAssertEqual(chosen.lookName(forHTML: "<div class=\"sens\"></div>"), "desk", "a finance piece always wears desk")
    }

    func testPointerAccentIsTheStudyAccentUnlessHisFileNamesOne() {
        let pointed = StyleTokens.defaults.applyingPointerAccent("#4f8cff")
        XCTAssertEqual(pointed.look("study").accentHex, "#4f8cff")
        XCTAssertEqual(pointed.look("desk").accentHex, "#f2a93b")
        XCTAssertEqual(StyleTokens.defaults.applyingPointerAccent("blue"), StyleTokens.defaults)
        let his = merged(##"{"looks": {"study": {"accent": "#22d3ee"}}}"##).applyingPointerAccent("#4f8cff")
        XCTAssertEqual(his.look("study").accentHex, "#22d3ee")
    }

    func testCardPage() {
        let template = "<!doctype html>\n<html><head><style>{{TOKENS}}</style><style>:root { --accent: {{ACCENT}}; }</style></head><body>\n{{CONTENT}}\n</body></html>"
        let tokens = StyleTokens.defaults.applyingPointerAccent("#4f8cff")
        let study = tokens.cardPage(template: template, content: "<p>keep {{ACCENT}} as written</p>")
        XCTAssertEqual(study.look, "study")
        XCTAssertTrue(study.html.contains("<html data-look=\"study\">"))
        XCTAssertTrue(study.html.contains(":root { --accent: #4f8cff; }"))
        XCTAssertTrue(study.html.contains("<p>keep {{ACCENT}} as written</p>"))
        XCTAssertFalse(study.html.contains("{{TOKENS}}"))
        let desk = tokens.cardPage(template: template, content: "<div class=\"football\" data-source=\"x\"></div>")
        XCTAssertEqual(desk.look, "desk")
        XCTAssertTrue(desk.html.contains("<html data-look=\"desk\">"))
        XCTAssertTrue(desk.html.contains(":root { --accent: #f2a93b; }"))
    }

    func testColors() {
        XCTAssertEqual(StyleTokens.parseColor("#fff"), StyleTokens.RGBA(red: 1, green: 1, blue: 1))
        XCTAssertEqual(StyleTokens.parseColor("#FF6B2C")?.hex, "#ff6b2c")
        XCTAssertEqual(StyleTokens.parseColor("rgba(255,255,255,0.09)")?.alpha, 0.09)
        XCTAssertEqual(StyleTokens.parseColor("rgb(1, 2, 3)")?.hex, "#010203")
        XCTAssertEqual(StyleTokens.parseColor("#ff6b2c80")?.alpha ?? 0, 128.0 / 255, accuracy: 1e-9)
        for bad in ["red", "#ggg", "#12345", "rgb(300,0,0)", "rgba(1,2,3)", "rgb(1,2,3,0.5)", "rgba(1,2,3,2)", "url(x)"] {
            XCTAssertNil(StyleTokens.parseColor(bad), bad)
        }
    }

    func testChimesAndFileColors() {
        let tokens = merged(#"{"chimes": {"launch": "none"}}"#)
        XCTAssertNil(tokens.chimes.sound(for: "launch"))
        XCTAssertEqual(tokens.chimes.sound(for: "needsYou"), "Tink")
        XCTAssertNil(tokens.chimes.sound(for: "bogus"))
        XCTAssertEqual(StyleTokens.defaults.fileColor("PDF")?.hex, "#e5534b")
        XCTAssertNil(StyleTokens.defaults.fileColor("exe"))
    }
}
