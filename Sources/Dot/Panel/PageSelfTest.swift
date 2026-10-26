import AppKit
import DotKit
import Foundation

/// `Dot --page-selftest` (parity J1, J2): a job page in the real JobPageWindow, placed off every display. A tick and a
/// letter's Send are clicked in WebKit, and each must come back through PanelMessage as the tap on that page version;
/// the tick must name its item through PageTurn, a second click must post nothing, and the letter must show the words
/// Dot filled in, never the ones written on the page. Touches no running Dot and no job.
@MainActor
enum PageSelfTest {
    static let markup = """
    <status tone="info">Following up on two applications</status>
    <title>Follow-ups</title>
    <todo id="t1">
    <item id="i1" done="true">Pull the posting</item>
    <item id="i2" done="false">Email Prof. Lee about office hours</item>
    </todo>
    <letter id="l1" proposal="1a2b3c4d">To: CANARY-to@example.com
    CANARY-body: a page must never put words in the letter.</letter>
    """

    static func run() -> Bool {
        var failures: [String] = []
        func check(_ ok: Bool, _ what: String) { print("\(ok ? "pass" : "FAIL"): \(what)"); if !ok { failures.append(what) } }
        guard case .success(let page) = JobPage.parse(markup) else { check(false, "the fixture page parses"); return false }
        guard let window = JobPageWindow(jobID: "selftest", accentHex: DotConfig.peek().pointerColorHex) else {
            check(false, "the panel renderer is found (DOT_BOARD_DIR, the bundle or ~/Projects/dot)")
            return false
        }
        var got: [PanelMessage] = []
        window.onMessage = { got.append($0) }
        window.show(markup: page.markup, title: "Follow-ups", version: page.version, frame: CGRect(x: -30_000, y: -30_000, width: 440, height: 900))
        func js(_ script: String) -> Any? {
            var out: Any?, done = false
            window.evaluate(script) { out = $0; done = true }
            let until = Date().addingTimeInterval(5)
            while !done, Date() < until { spin(0.05) }
            return out
        }
        // wait for the page to render its todo
        let until = Date().addingTimeInterval(10)
        while Date() < until, (js("document.querySelectorAll('.todo-item').length") as? Int ?? 0) < 2 { spin(0.2) }
        check((js("document.querySelectorAll('.todo-item').length") as? Int) == 2, "the page renders its two todo items")

        window.letter("l1", to: "Prof. Lee (lee@uchicago.edu)", subject: "Office hours", body: "Could I come by Thursday at 3?", state: "pending")
        spin(0.5)
        let letterText = js("Array.from(document.querySelectorAll('.letter')).map(function(x){return x.innerText}).join('\\n')") as? String ?? ""
        check(letterText.contains("Prof. Lee") && letterText.contains("Thursday at 3"), "the letter shows the words Dot filled in")
        check(!letterText.contains("CANARY"), "and none of the words written on the page")

        _ = js("document.querySelectorAll('.todo-item input.todo-box')[1].click()")
        spin(0.6)
        let ticks = got.compactMap { m -> (String, String, Bool, String, String)? in
            if case .pageTick(_, let o, let i, let d, let e, let v) = m { return (o, i, d, e, v) }
            return nil
        }
        check(ticks.count == 1 && ticks.first.map { $0.0 == "t1" && $0.1 == "i2" && $0.2 } == true, "the click posts one tick for t1 i2 (\(ticks.count))")
        check(ticks.first.map { $0.4 == page.version && !$0.3.isEmpty } == true, "the tick carries an event id and the page's version")
        if let tick = got.first(where: { if case .pageTick = $0 { return true }; return false }) {
            let line = PageTurn.message(tick, page: page)
            check(line == "[page] he ticked \"Email Prof. Lee about office hours\" (t1 i2)", "it reaches the job as: \(line ?? "nothing")")
        }
        _ = js("document.querySelectorAll('.todo-item input.todo-box')[1].click()")
        spin(0.6)
        check(got.filter { if case .pageTick = $0 { return true }; return false }.count == 1, "a second click posts nothing")

        _ = js("document.querySelector('.letter button[data-choice=send]').click()")
        spin(0.6)
        let sends = got.compactMap { m -> (String, String, Bool)? in
            if case .pageLetter(_, let o, let p, let s, _, _) = m { return (o, p, s) }
            return nil
        }
        check(sends.count == 1 && sends.first.map { $0.0 == "l1" && $0.1 == "1a2b3c4d" && $0.2 } == true, "Send posts one letter tap for l1, proposal 1a2b3c4d")
        if let send = got.first(where: { if case .pageLetter = $0 { return true }; return false }) {
            check(PageTurn.message(send, page: page) == nil, "a Send is never a line to the job (it goes to the proposal's card)")
        }
        window.close()
        print(failures.isEmpty ? "page selftest: all passed" : "page selftest: \(failures.count) failed")
        return failures.isEmpty
    }

    private static func spin(_ seconds: Double) {
        let until = Date().addingTimeInterval(seconds)
        while Date() < until {
            while let event = NSApp.nextEvent(matching: .any, until: Date(timeIntervalSinceNow: 0.01), inMode: .default, dequeue: true) {
                NSApp.sendEvent(event)
            }
            RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.02))
        }
    }
}
