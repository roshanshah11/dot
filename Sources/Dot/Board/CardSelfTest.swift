import AppKit
import DotKit
import Foundation

/// `Dot --card-selftest`: cards Dot designs (parity C1) through a real CardPanel off every display. Each card fixture
/// must load in the panel's card page, render its blocks, wear the look's accent (study, and desk for one), and fit
/// the window to all of it; an HTML card must still load in board.html. It touches no running Dot and shows nothing.
@MainActor
enum CardSelfTest {
    static func run() -> Bool {
        let activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiated, .latencyCritical], reason: "card selftest")
        defer { ProcessInfo.processInfo.endActivity(activity) }
        var failures: [String] = []
        func check(_ ok: Bool, _ what: String) { print("\(ok ? "pass" : "FAIL"): \(what)"); if !ok { failures.append(what) } }
        guard let resources = Snapshots.boardResources() else { print("card selftest: no board resources (DOT_BOARD_DIR?)"); return false }

        CardPanel.visibleInRecordings = false
        let tokens = StyleTokens.load()
        let offscreen = CGRect(x: -30_000, y: -30_000, width: 1440, height: 900)
        var cases = Snapshots.panelFixtures().filter { $0.0.hasPrefix("card-") }.map { (name: $0.0, markup: $0.1, mode: String?.none) }
        check(cases.count >= 4, "the four card fixtures are there (\(cases.count))")
        if let flight = cases.first(where: { $0.name == "card-flight" }) { cases.append((name: "card-flight-desk", markup: flight.markup, mode: "desk")) }
        cases.append((name: "html-card", markup: "<h2>a field</h2><div class=\"callout good\">closed under + and ×</div>", mode: nil))
        var written: [URL] = []

        for item in cases {
            let designed = CardMarkup.isUILanguage(item.markup)
            check(designed == item.name.hasPrefix("card-"), "\(item.name): \(designed ? "UI language" : "HTML")")
            let id = "selftest-\(item.name)"
            let card = CardPanel(id: id, accentHex: DotConfig.peek().pointerColorHex, screenFrame: offscreen)
            card.setFrame(CGRect(x: offscreen.minX + 20, y: offscreen.maxY - 180, width: 440, height: 160), display: false)
            card.orderFrontRegardless()
            card.load(title: item.name, html: item.markup, resources: resources, tokens: tokens, mode: item.mode)
            written.append(resources.appendingPathComponent(designed ? "panel/card-\(id).html" : "card-\(id).html"))
            spin(2.5)   // load, panel.load, typesetting, and the second fit 0.6 s later
            let probe = """
            JSON.stringify({path: location.pathname, blocks: document.querySelectorAll('#content .box, #content table').length,
              text: ((document.getElementById('content') || document.body).innerText || '').trim().length,
              accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase(),
              height: document.documentElement.scrollHeight, view: window.innerHeight})
            """
            guard let json = evaluate(card, probe) as? String, let data = json.data(using: .utf8),
                  let page = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                check(false, "\(item.name): the page answered")
                card.orderOut(nil); card.close()
                continue
            }
            let path = page["path"] as? String ?? ""
            let height = (page["height"] as? Double) ?? 0, view = (page["view"] as? Double) ?? 0
            if designed {
                let look = tokens.look(tokens.lookName(forHTML: item.markup, mode: item.mode))
                check(path.hasSuffix("/panel/card-\(id).html"), "\(item.name): loads in the panel's card page")
                check((page["blocks"] as? Int ?? 0) >= 1 && (page["text"] as? Int ?? 0) > 20, "\(item.name): its blocks rendered (\(page["blocks"] ?? 0) blocks, \(page["text"] ?? 0) characters)")
                check((page["accent"] as? String) == look.accentHex.lowercased(), "\(item.name): wears the \(look.name) accent (\(page["accent"] ?? "none"))")
            } else {
                check(path.hasSuffix("/card-\(id).html") && !path.contains("/panel/"), "\(item.name): still loads in board.html")
            }
            check(height > 60 && height <= view + 1, String(format: "\(item.name): the window fits it (content %.0f pt, view %.0f pt)", height, view))
            card.orderOut(nil)
            card.close()
        }
        for file in written { try? FileManager.default.removeItem(at: file) }
        print(failures.isEmpty ? "card selftest: all passed" : "card selftest: \(failures.count) failed")
        return failures.isEmpty
    }

    private static func evaluate(_ card: CardPanel, _ script: String) -> Any? {
        var value: Any?
        var done = false
        card.evaluate(script) { value = $0; done = true }
        let until = Date().addingTimeInterval(4)
        while !done, Date() < until { spin(0.05) }
        return value
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
