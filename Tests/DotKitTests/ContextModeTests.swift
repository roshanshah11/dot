import XCTest
@testable import DotKit

final class ContextModeTests: XCTestCase {
    private func decide(call: Bool = false, lecture: Bool = false, bundle: String? = nil, title: String? = nil,
                        url: String? = nil, lesson: Bool = false, override: ContextMode? = nil) -> ContextMode {
        ContextMode.decide(onCall: call, lectureListening: lecture, bundleID: bundle, windowTitle: title,
                           url: url, boardLesson: lesson, override: override)
    }

    func testRawValuesAreTheTokenKeys() {
        XCTAssertEqual(ContextMode.allCases.map(\.rawValue), ["lecture", "call", "study", "desk", "normal"])
    }

    func testEachInputAlone() {
        XCTAssertEqual(decide(), .normal)
        XCTAssertEqual(decide(call: true), .call)
        XCTAssertEqual(decide(lecture: true), .lecture)
        XCTAssertEqual(decide(lesson: true), .study)
        XCTAssertEqual(decide(override: .desk), .desk)
        XCTAssertEqual(decide(bundle: "com.microsoft.Excel", title: "Book1"), .desk)
        XCTAssertEqual(decide(bundle: "com.microsoft.Powerpoint", title: "Pitch.pptx"), .desk)
        XCTAssertEqual(decide(bundle: "com.microsoft.excel"), .desk, "bundle ids compare without case")
        XCTAssertEqual(decide(bundle: "com.microsoft.Word", title: "essay.docx"), .normal)
        XCTAssertEqual(decide(bundle: "ai.perplexity.comet", title: "Dashboard", url: "https://canvas.uchicago.edu/courses/123/assignments/9"), .study)
        XCTAssertEqual(decide(bundle: "ai.perplexity.comet", title: "Hacker News", url: "https://news.ycombinator.com/"), .normal)
    }

    func testFilings() {
        XCTAssertEqual(decide(bundle: "com.apple.Preview", title: "Apple 10-K 2024.pdf"), .desk)
        XCTAssertEqual(decide(bundle: "com.apple.Preview", title: "FY24 10K.pdf"), .desk, "a pdf reader takes the form without its hyphen")
        XCTAssertEqual(decide(bundle: "com.apple.Preview", title: "msk_s-1a.pdf"), .normal)
        XCTAssertEqual(decide(bundle: "com.apple.Preview", title: "MSK S-1/A.pdf"), .desk)
        XCTAssertEqual(decide(bundle: "com.apple.Preview", title: "proxy DEF 14A.pdf"), .desk)
        XCTAssertEqual(decide(bundle: "ai.perplexity.comet", title: "tsla-20231231 - Comet",
                              url: "https://www.sec.gov/Archives/edgar/data/1318605/000162828024002390/tsla-20231231.htm"), .desk)
        XCTAssertEqual(decide(bundle: "com.apple.Safari", title: "Inline XBRL Viewer",
                              url: "https://www.sec.gov/ix?doc=/Archives/edgar/data/320193/000032019324000123/aapl-20240928.htm"), .desk)
        XCTAssertEqual(decide(bundle: "com.apple.Safari", title: "Form 8-K/A | Nvidia"), .desk)
        XCTAssertEqual(decide(bundle: "ai.perplexity.comet", title: "Q3 20-F.pdf - Comet"), .desk)
        // A bare "10K" in a browser is a race or a follower count, not a filing.
        XCTAssertEqual(decide(bundle: "ai.perplexity.comet", title: "Chicago 10K results - Comet"), .normal)
        XCTAssertEqual(decide(bundle: "com.apple.Safari", title: "Best 8K TVs of 2026"), .normal)
        // A filing named in Word or Mail is not a filing on screen.
        XCTAssertEqual(decide(bundle: "com.microsoft.Outlook", title: "Re: the 10-K question"), .normal)
        XCTAssertEqual(decide(bundle: "com.apple.Preview", title: "$10K budget.pdf"), .normal)
    }

    func testPrecedenceOverrideCallLectureLessonApp() {
        // Every signal on: the override wins.
        XCTAssertEqual(decide(call: true, lecture: true, bundle: "com.microsoft.Excel", lesson: true, override: .study), .study)
        // No override: the call beats the lecture ear, the lesson and the app.
        XCTAssertEqual(decide(call: true, lecture: true, bundle: "com.microsoft.Excel", lesson: true), .call)
        // No call: the lecture ear beats the lesson and the app.
        XCTAssertEqual(decide(lecture: true, bundle: "com.microsoft.Excel", lesson: true), .lecture)
        // No ear: a lesson on the board beats Excel behind it.
        XCTAssertEqual(decide(bundle: "com.microsoft.Excel", lesson: true), .study)
        // Only the app.
        XCTAssertEqual(decide(bundle: "com.microsoft.Excel"), .desk)
        // An override beats a call too: what he said is what he gets.
        XCTAssertEqual(decide(call: true, override: .desk), .desk)
    }

    func testCanvasHost() {
        XCTAssertTrue(ContextMode.isCanvas("https://canvas.uchicago.edu/courses/1/assignments/2"))
        XCTAssertTrue(ContextMode.isCanvas("canvas.uchicago.edu/courses/1"))
        XCTAssertFalse(ContextMode.isCanvas("https://canvas.instructure.com/"))
        XCTAssertFalse(ContextMode.isCanvas("https://evil.com/canvas.uchicago.edu"))
        XCTAssertFalse(ContextMode.isCanvas(nil))
    }

    func testBoardLessonMarkers() {
        XCTAssertTrue(ContextMode.isMathOrScienceLesson(html: #"<div class="stage"><p>\(T(v)=Av\)</p></div>"#))
        XCTAssertTrue(ContextMode.isMathOrScienceLesson(html: #"<p>$$\det A = 0$$</p>"#))
        XCTAssertTrue(ContextMode.isMathOrScienceLesson(html: #"<div class="figure jsx" id="b"></div>"#))
        XCTAssertTrue(ContextMode.isMathOrScienceLesson(html: #"<div class='molecule' data-pdb='1HHO'></div>"#))
        XCTAssertFalse(ContextMode.isMathOrScienceLesson(html: #"<p>revenue of $12.3bn and $4bn of capex</p><div class="chart"></div>"#))
        XCTAssertFalse(ContextMode.isMathOrScienceLesson(html: #"<div class="plotly-free timeline"></div>"#))
    }

    func testOverridePhrasesThatMatch() {
        let cases: [(String, ContextMode.Override)] = [
            ("pitch mode", .force(.desk)),
            ("Pitch mode.", .force(.desk)),
            ("desk mode", .force(.desk)),
            ("study mode", .force(.study)),
            ("lecture mode", .force(.lecture)),
            ("call mode", .force(.call)),
            ("normal mode", .automatic),
            ("back to normal", .automatic),
            ("go back to normal", .automatic),
            ("ok, back to normal.", .automatic),
            ("hey dot, study mode", .force(.study)),
            ("dot pitch mode please", .force(.desk)),
            ("okay dot, desk mode", .force(.desk)),
            ("switch to desk mode", .force(.desk)),
            ("can you switch to pitch mode", .force(.desk)),
            ("go into study mode", .force(.study)),
            ("put me in study mode", .force(.study)),
            ("turn on pitch mode", .force(.desk)),
            ("study mode on", .force(.study)),
            ("switch to normal mode", .automatic),
            ("study mode off", .automatic),
            ("turn off pitch mode", .automatic),
            ("exit desk mode", .automatic),
        ]
        for (text, expected) in cases {
            XCTAssertEqual(ContextMode.parseOverride(text), expected, text)
        }
    }

    func testOrdinarySentencesWithModeDoNotMatch() {
        let sentences = [
            "what mode is this",
            "what mode are you in?",
            "is my phone in study mode",
            "switch the calculator to radian mode",
            "turn on dark mode",
            "airplane mode on",
            "the study mode in chatgpt is good",
            "i'm in pitch mode for this interview",
            "explain desk mode to me",
            "study mode is broken",
            "go back to normal and explain it",
            "things are back to normal",
            "normal",
            "mode",
            "pitch me on this stock",
            "",
        ]
        for text in sentences {
            XCTAssertNil(ContextMode.parseOverride(text), text)
        }
    }

    func testKnownApps() {
        XCTAssertTrue(KnownApps.isBrowser("ai.perplexity.comet"))
        XCTAssertTrue(KnownApps.isBrowser("com.apple.safari"))
        XCTAssertFalse(KnownApps.isBrowser("com.apple.Preview"))
        XCTAssertTrue(KnownApps.isPDFReader("com.apple.Preview"))
        XCTAssertFalse(KnownApps.isPDFReader(nil))
    }
}
