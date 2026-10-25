import AppKit
import DotKit
import PDFKit
import WebKit

/// `Dot --notes-selftest`: the notes window off every display, driven through the page's own handlers the way his
/// clicks and keys reach them. Dot's lines must land around the line he is typing without moving it, his typing must
/// reach Dot as add / edit / indent / remove, math must typeset, and a three-class course file must print as a
/// multi-page Letter PDF. It touches no running Dot and none of his files (fixtures live in a temp folder).
@MainActor
enum NotesSelfTest {
    final class Box<T> { var value: T; init(_ value: T) { self.value = value } }

    static func run() -> Bool {
        let activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiated, .latencyCritical], reason: "notes selftest")
        defer { ProcessInfo.processInfo.endActivity(activity) }
        var failures: [String] = []
        func check(_ ok: Bool, _ what: String) { print("\(ok ? "PASS" : "FAIL"): \(what)"); if !ok { failures.append(what) } }

        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("dot-notes-selftest-\(UUID().uuidString.prefix(8))", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder.appendingPathComponent("notes-images"), withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        writeImage(to: folder.appendingPathComponent("notes-images/board 1.png"))
        writeImage(to: folder.appendingPathComponent("notes-images/slide-1.png"), size: NSSize(width: 640, height: 360), label: "Supply shifters")

        let notes = NotesWindow(accentHex: "#ff6b2c")
        notes.offscreen = true
        let messages = Box<[NotesMessage]>([])
        notes.onMessage = { messages.value.append($0) }
        func B(_ id: String, _ text: String, _ depth: Int = 0, _ author: String = "dot", kind: String = "bullet", src: String? = nil,
               at: String? = nil, fixed: Bool = false) -> NotesWindow.Block {
            NotesWindow.Block(id: id, text: text, depth: depth, author: author, kind: kind, src: src, at: at, fixed: fixed)
        }
        let fixture = [B("d1", "**supply curve**: price up -> quantity supplied up", at: "11:42:10"), B("d2", "firms enter when profit > 0", 1),
                       B("d3", "energy: $E = mc^2$, plain-text too: E = mc^2"), B("h1", "(DO later for practice)", 1, "him"),
                       B("img1", "board 11:42", 0, "dot", kind: "image", src: "notes-images/board 1.png"),
                       B("s1", "Supply shifters", 0, "dot", kind: "slide", src: "notes-images/slide-1.png"),
                       B("d4", "\"u can't skip the margin\" - Prof. Example"), B("c1", "a stray timestamp left in the text <!--@11:42:30-->", 1),
                       B("a1", "the slide's elasticity table", 1, "added")]
        notes.show(course: "COURSE 101", heading: "CLASS 3 (Thu Oct 22)", title: "markets", status: "listening · 23 min", blocks: fixture, baseURL: folder)
        guard !notes.isOnAnyDisplay else {
            notes.close()
            print("FAIL: the test window landed on a display (\(notes.frameForTests), screens \(NSScreen.screens.map(\.frame))); stopping before anything else shows")
            return false
        }
        check(spin(until: 15) { messages.value.contains(.ready) }, "the page loads and sends ready")
        guard messages.value.contains(.ready) else { return finish(failures) }
        spin(0.3)

        func js(_ code: String) -> Any? {
            let result = Box<Any?>(nil), done = Box(false)
            notes.evaluate(code) { value, error in
                if let error { print("  js error: \(error.localizedDescription) in \(code)") }
                result.value = value; done.value = true
            }
            _ = spin(until: 8) { done.value }
            return result.value
        }
        func order() -> [String] { (js("notes.snapshot().map(function (b) { return b.id; })") as? [String]) ?? [] }
        func block(_ id: String) -> [String: Any] {
            ((js("notes.snapshot()") as? [[String: Any]]) ?? []).first { $0["id"] as? String == id } ?? [:]
        }
        // generous: a freshly built binary's first run can stall the web process for seconds
        func sent(_ m: NotesMessage, within seconds: Double = 6) -> Bool { spin(until: seconds) { messages.value.contains(m) } }
        // DOT_NOTES_SELFTEST_SHOTS=<folder> keeps pictures of the window in light and dark for a person to look at
        let shots = ProcessInfo.processInfo.environment["DOT_NOTES_SELFTEST_SHOTS"]
        func picture(_ name: String, dark: Bool) {
            guard let shots else { return }
            let image = Box<NSImage?>(nil), done = Box(false)
            Task { @MainActor in image.value = await notes.picture(dark: dark); done.value = true }
            _ = spin(until: 6) { done.value }
            guard let tiff = image.value?.tiffRepresentation, let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) else {
                print("  no picture for \(name)"); return
            }
            let url = URL(fileURLWithPath: shots).appendingPathComponent("\(name).png")
            try? png.write(to: url)
            print("  picture: \(url.path)")
        }

        // what the page draws
        check(js("document.querySelectorAll('.line[data-id=\"d3\"] .katex').length > 0") as? Bool == true, "KaTeX renders $E = mc^2$ (.katex in the line)")
        check(js("!!document.querySelector('.line[data-id=\"d1\"] strong')") as? Bool == true, "**bold** renders as <strong>")
        check(js("document.querySelector('#heading').textContent") as? String == "CLASS 3 (Thu Oct 22): markets", "the header reads CLASS 3 (Thu Oct 22): markets")
        check(spin(until: 4) { js("(document.querySelector('.line[data-id=\"img1\"] img') || {}).naturalWidth > 0") as? Bool == true },
              "an image block's relative path (notes-images/board 1.png) loads from the course folder")
        check(js("document.querySelector('.line[data-id=\"a1\"]').classList.contains('added')") as? Bool == true, "an added line is marked added (grey, leading ⁺)")
        check(js("document.querySelector('.line[data-id=\"h1\"]').classList.contains('him')") as? Bool == true, "his line carries the margin marker class")

        // 8: an HTML comment never shows; a timestamp comment becomes the line's time
        let c1 = js("document.querySelector('.line[data-id=\"c1\"] .text').textContent") as? String ?? "?"
        check(!c1.contains("<!--") && !c1.contains("11:42:30") && c1.contains("stray timestamp"), "an HTML comment in a line is not shown (\"\(c1)\")")
        check(block("c1")["at"] as? String == "11:42:30" && js("document.querySelector('.line[data-id=\"c1\"] .at').textContent") as? String == "11:42",
              "a trailing <!--@11:42:30--> becomes the line's time chip (11:42)")

        // a stamp can carry flags after the time: his, fixed; the time chip is only ever the time
        notes.apply([.append(B("f1", "COURSE 101 guest talk <!--@11:17:23 his-->")), .append(B("f2", "a line of his typed after class <!--@ his-->")),
                     .append(B("f3", "15% is a decent chunk of the business <!--@11:50:48 fixed-->"))])
        spin(0.3)
        check(block("f1")["at"] as? String == "11:17:23" && block("f1")["author"] as? String == "dot",
              "<!--@11:17:23 his--> gives the time 11:17:23 (an author sent with the block still decides whose it is)")
        check(js("document.querySelector('.line[data-id=\"f1\"] .at').textContent") as? String == "11:17"
              && (js("document.querySelector('.line[data-id=\"f1\"] .text').textContent") as? String) == "COURSE 101 guest talk",
              "its chip reads 11:17 and the flag never shows in the text")
        check((block("f2")["at"] as? String ?? "") == "" && js("!document.querySelector('.line[data-id=\"f2\"] .at')") as? Bool == true,
              "<!--@ his--> is a line with no time (no chip)")
        check(block("f3")["at"] as? String == "11:50:48" && block("f3")["fixed"] as? Bool == true
              && js("!!document.querySelector('.line[data-id=\"f3\"] .fixmark')") as? Bool == true, "<!--@11:50:48 fixed--> is a fixed line with its time")
        notes.apply([.remove("f1"), .remove("f2"), .remove("f3")])
        spin(0.2)

        // a line the after-class pass corrected: a quiet pencil, "edited after class"; a replace carries the flag
        notes.apply([.replace(B("d2", "firms enter when profit > 0", 1, fixed: true))])
        spin(0.2)
        check(js("var l = document.querySelector('.line[data-id=\"d2\"]'), m = l.querySelector('.fixmark'); l.classList.contains('fixed') && !!m && m.title") as? String
              == "edited after class", "a fixed block shows its mark, titled \"edited after class\"")
        check((js("document.querySelector('.line[data-id=\"d2\"] .text').textContent") as? String) == "firms enter when profit > 0",
              "the mark is not part of the line's text")
        notes.apply([.replace(B("d2", "firms enter when profit > 0", 1))])
        spin(0.2)
        check(js("!document.querySelector('.line[data-id=\"d2\"] .fixmark')") as? Bool == true, "a replace without the flag takes the mark off")

        // the title is his to type: Enter keeps it, Escape puts the old one back, Dot's title waits while he types
        messages.value.removeAll()
        check(js("document.querySelector('#title').isContentEditable && document.querySelector('#heading-key').textContent") as? String == "CLASS 3 (Thu Oct 22)",
              "the title after the fixed CLASS 3 (Thu Oct 22) is editable")
        _ = js("notes._test.title('COURSE 101')")
        notes.setTitle("dot's own title")
        spin(0.2)
        check(js("notes._test.titleShown()") as? String == "COURSE 101", "Dot's setTitle leaves a title he is typing alone")
        _ = js("notes._test.title('COURSE 101 guest talk', 'Enter')")
        check(sent(.title("COURSE 101 guest talk")), "Enter sends title with what he typed")
        check(js("document.querySelector('#heading').textContent") as? String == "CLASS 3 (Thu Oct 22): COURSE 101 guest talk", "and the heading reads it")
        messages.value.removeAll()
        _ = js("notes._test.title('oops', 'Escape')")
        spin(0.3)
        check(js("notes._test.titleShown()") as? String == "COURSE 101 guest talk" && !messages.value.contains { if case .title = $0 { return true }; return false },
              "Escape puts the old title back and sends nothing")
        check(NotesMessage(["type": "title", "text": "a title"]) == .title("a title"), "the title message parses")
        notes.setTitle("markets")
        spin(0.2)
        check(js("document.querySelector('#heading').textContent") as? String == "CLASS 3 (Thu Oct 22): markets", "out of editing, Dot's setTitle shows")

        // the first click on a window that isn't key reaches the notes (stock WebKit only makes the window key)
        let point = CGPoint(x: 120, y: 450)
        check(notes.acceptsFirstMouseForTests(at: point), "the notes page takes the first click on a window that isn't key")
        let stock = stockFirstMouse(at: point)
        check(stock == false, "a plain WKWebView there does not (\(stock.map { "\($0)" } ?? "no answer")): the cause of no cursor on click")
        check(notes.becomeKeyRepairsFocusForTests(), "becoming key hands the keys to the notes page")

        // 4: a slide is a small thumbnail with its title; a click opens it large, Esc closes
        check(spin(until: 4) { js("(document.querySelector('.line[data-id=\"s1\"] img') || {}).naturalWidth > 0") as? Bool == true },
              "a slide block's image loads")
        let slideHeight = js("document.querySelector('.line[data-id=\"s1\"] img').getBoundingClientRect().height") as? Double ?? 999
        check(slideHeight > 20 && slideHeight <= 110.5, String(format: "the slide thumbnail is compact (%.0f px tall, at most 110)", slideHeight))
        check(js("document.querySelector('.line[data-id=\"s1\"] figcaption').textContent") as? String == "Supply shifters", "the slide's title is its caption")
        _ = js("document.querySelector('.line[data-id=\"s1\"] img').click()")
        check(js("!document.getElementById('lightbox').hidden && /slide-1\\.png$/.test(document.querySelector('#lightbox img').src)") as? Bool == true,
              "a click on the slide opens it in the lightbox")
        _ = js("document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))")
        check(js("document.getElementById('lightbox').hidden") as? Bool == true, "Esc closes the lightbox")

        // 1: the hearing line shows the last words heard, cut from the left
        notes.hearing((1...25).map { "w\($0)" }.joined(separator: " "))
        spin(0.2)
        check(js("!document.getElementById('hearing').hidden && document.getElementById('hearing-text').textContent") as? String
              == "\u{2026} " + (16...25).map { "w\($0)" }.joined(separator: " "), "the hearing line shows the last ten words heard, with a leading ellipsis")
        notes.hearing("")
        spin(0.2)
        check(js("document.getElementById('hearing').hidden") as? Bool == true, "an empty hearing line is hidden")

        // 2: a line's time chip asks for what was said; Dot's answer shows under the line
        messages.value.removeAll()
        check(js("document.querySelector('.line[data-id=\"d1\"] .at').textContent") as? String == "11:42", "a line with a time has a time chip (11:42)")
        _ = js("document.querySelector('.line[data-id=\"d1\"] .at').click()")
        check(sent(.source(id: "d1")), "a click on the time chip sends source d1")
        notes.showSource(id: "d1", time: "11:42:10", text: "so the curve slopes up because each extra unit costs more to make")
        spin(0.2)
        check(js("!document.getElementById('source').hidden && document.getElementById('source').textContent") as? String
              == "11:42:10\u{201C}so the curve slopes up because each extra unit costs more to make\u{201D}", "showSource puts the transcript in a popover under the line")
        check(js("var p = document.getElementById('source'), l = document.querySelector('.line[data-id=\"d1\"]'); Math.abs(p.offsetTop - (l.offsetTop + l.offsetHeight)) < 6") as? Bool == true,
              "the popover sits right under that line")
        _ = js("document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))")
        check(js("document.getElementById('source').hidden") as? Bool == true, "Esc closes the popover")

        // 3: explainer markers
        notes.markExplain(id: "d2", state: "queued")
        spin(0.2)
        check(js("!!document.querySelector('.line[data-id=\"d2\"] .xdot.queued')") as? Bool == true, "markExplain queued draws a hollow marker")
        _ = js("document.querySelector('.line[data-id=\"d2\"] .xdot').click()")
        spin(0.3)
        check(!messages.value.contains(.showExplain(id: "d2")), "a queued marker does nothing on click")
        notes.markExplain(id: "d2", state: "ready")
        spin(0.2)
        _ = js("document.querySelector('.line[data-id=\"d2\"] .xdot.ready').click()")
        check(sent(.showExplain(id: "d2")), "a ready marker's click sends showExplain d2")
        notes.markExplain(id: "d2", state: "shown")
        spin(0.2)
        check(js("!!document.querySelector('.line[data-id=\"d2\"] .xdot.shown')") as? Bool == true, "markExplain shown makes it faint")
        if shots != nil {
            // the hover tools, a ready marker, the popover and the hearing line, all at once, for a person to look at
            notes.markExplain(id: "d4", state: "ready")
            notes.markExplain(id: "c1", state: "queued")
            notes.hearing("and that's why the supply curve slopes up, every extra unit costs a bit more to make")
            notes.showSource(id: "d1", time: "11:42:10", text: "so the curve slopes up because each extra unit costs more to make")
            // transitions do not run in a window off every display, so the hover state is set outright
            _ = js("var t = document.querySelector('.line[data-id=\"d1\"] .tools'); t.style.transition = 'none'; t.style.opacity = 1")
            spin(0.3)
            picture("notes-r2-light", dark: false)
            picture("notes-r2-dark", dark: true)
            _ = js("var t = document.querySelector('.line[data-id=\"d1\"] .tools'); t.style.transition = ''; t.style.opacity = ''")
            notes.markExplain(id: "d4", state: nil)
            notes.markExplain(id: "c1", state: nil)
            notes.hearing("")
            _ = js("document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))")
        }
        notes.markExplain(id: "d2", state: nil)
        spin(0.2)
        check(js("!document.querySelector('.line[data-id=\"d2\"] .xdot')") as? Bool == true, "markExplain nil clears it")

        // he types in the line at the bottom
        messages.value.removeAll()
        let tail = js("notes._test.focus('tail')") as? String
        check(tail == "h2", "the empty bottom line is his next id (h2), got \(tail ?? "nil")")
        check(sent(.focus(id: "h2")), "focusing it sends focus h2")
        _ = js("notes._test.type('h2', 'my own line')")
        check(!messages.value.contains { if case .add = $0 { return true }; return false }, "nothing is sent while he is still typing (debounced)")
        let added = sent(.add(id: "h2", after: "a1", depth: 0, text: "my own line"))
        check(added, "typing there sends add h2 after a1, depth 0, with the text" + (added ? "" : " (got \(messages.value))"))

        // Dot appends while he is in the last line
        notes.apply([.append(B("d5", "dot's next line"))])
        spin(0.3)
        var ids = order()
        check(ids.suffix(2) == ["d5", "h2"], "an append lands before his focused last line (order ends \(ids.suffix(3).joined(separator: ",")))")
        check(js("notes._test.focused()") as? String == "h2", "his caret stays in h2")
        notes.apply([.replace(B("h2", "REPLACED"))])
        spin(0.2)
        let h2 = block("h2")
        check(h2["text"] as? String == "my own line", "a replace of the line he is in is ignored" + (h2["text"] as? String == "my own line" ? "" : " (h2 is \(h2))"))

        // he moves into one of Dot's lines and edits it
        _ = js("notes._test.focus('d4')")
        notes.apply([.replace(B("d4", "REPLACED"))])
        spin(0.2)
        check((block("d4")["text"] as? String)?.contains("Prof. Example") == true, "a replace of Dot's line he is in is ignored too")
        notes.apply([.replace(B("d2", "firms enter when economic profit > 0", 1))])
        spin(0.2)
        check(block("d2")["text"] as? String == "firms enter when economic profit > 0", "a replace of a line he is not in lands")
        messages.value.removeAll()
        _ = js("notes._test.type('d4', 'edited by him')")
        check(sent(.edit(id: "d4", text: "edited by him")), "editing d4 sends edit d4 with the new text")
        check(block("d4")["author"] as? String == "him", "the edited line becomes his")
        picture("notes-light", dark: false)
        picture("notes-dark", dark: true)

        // Enter, Tab, Shift-Tab, Backspace
        messages.value.removeAll()
        _ = js("notes._test.key('d4', 'Enter')")
        let fresh = js("notes._test.focused()") as? String ?? ""
        check(fresh.hasPrefix("h") && fresh != "h2", "Enter at the end of d4 makes a new line of his (\(fresh)) and moves there")
        _ = js("notes._test.type(null, 'under d4')")
        check(sent(.add(id: fresh, after: "d4", depth: 0, text: "under d4")), "the new line sends add after d4 at d4's depth")
        ids = order()
        check(ids.firstIndex(of: fresh) == ids.firstIndex(of: "d4").map { $0 + 1 }, "the new line sits right after d4")
        _ = js("notes._test.key(null, 'Tab')")
        check(sent(.indent(id: fresh, depth: 1)), "Tab sends indent depth 1")
        _ = js("notes._test.key(null, 'Tab', true)")
        check(sent(.indent(id: fresh, depth: 0)), "Shift-Tab sends indent depth 0")
        _ = js("notes._test.type(null, '')")
        _ = js("notes._test.key(null, 'Backspace')")
        check(sent(.remove(id: fresh)), "Backspace in the emptied line sends remove")
        check(!order().contains(fresh), "and the line is gone")

        // a paste of several lines: the first joins the line, the rest become his lines at their depth
        messages.value.removeAll()
        _ = js("notes._test.focus('d4')")
        _ = js("""
            (function () { var t = document.querySelector('.line[data-id="d4"] .text'), dt = new DataTransfer();
              dt.setData('text/plain', ' too\\n- pasted one\\n  - pasted two');
              t.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); })()
            """)
        check(sent(.edit(id: "d4", text: "edited by him too")), "a pasted first row joins the line (edit d4)")
        let pasted = messages.value.compactMap { m -> String? in if case let .add(id, after, depth, text) = m { return "\(id)>\(after ?? "nil")@\(depth):\(text)" }; return nil }
        check(pasted.count == 2 && pasted[0].hasSuffix(">d4@0:pasted one") && pasted[1].hasSuffix("@1:pasted two"),
              "the other rows arrive as adds in order with their depth (\(pasted.joined(separator: ", ")))")

        // Dot's other ops
        notes.apply([.insertAfter("d1", B("a2", "from the reading: the supply shifters", 1, "added")), .remove("d5")])
        spin(0.2)
        ids = order()
        check(ids.firstIndex(of: "a2") == 1 && !ids.contains("d5"), "insertAfter puts a2 right after d1; remove takes d5 out")

        // the explain button and End class
        messages.value.removeAll()
        _ = js("document.querySelector('.line[data-id=\"d1\"] .explain').click()")
        check(sent(.explain(id: "d1", text: "**supply curve**: price up -> quantity supplied up")), "a line's explain button sends explain with its id and text")
        _ = js("notes._test.blur()")
        check(sent(.focus(id: nil)), "leaving the notes sends focus null")
        _ = js("document.getElementById('end').click()")
        spin(0.2)
        check(!messages.value.contains(.end), "one click on End class only arms it")
        _ = js("document.getElementById('end').click()")
        check(sent(.end), "a second click sends end")

        // following the newest line
        notes.apply((6...40).map { .append(B("d\($0)", "line \($0) of a long class")) })
        spin(0.3)
        check(js("var s = document.getElementById('scroller'); s.scrollHeight - s.scrollTop - s.clientHeight < 4") as? Bool == true,
              "with no one scrolled up, the newest line is in view")
        _ = js("document.getElementById('scroller').scrollTop = 0")
        spin(0.3)
        notes.apply([.append(B("d41", "one more"))])
        spin(0.3)
        check(js("document.getElementById('scroller').scrollTop") as? Int == 0, "after he scrolls up, a new line does not move his view")

        // recall, feedback, saved
        messages.value.removeAll()
        notes.showRecall(seconds: 120, prompt: "what were the 3 big ideas?")
        spin(0.3)
        check(js("!document.getElementById('recall').hidden && document.getElementById('recall-prompt').textContent") as? String == "what were the 3 big ideas?",
              "the recall box shows the prompt")
        check((js("document.getElementById('countdown').textContent") as? String).map { ["2:00", "1:59"].contains($0) } == true, "with a 2:00 countdown")
        _ = js("document.getElementById('recall-text').value = 'supply, entry, elasticity'; document.getElementById('submit').click()")
        check(sent(.recall("supply, entry, elasticity")), "Submit sends recall with his text")
        notes.recallFeedback("u got supply and entry")
        notes.recallFeedback("elasticity was the third: *how much* quantity moves")
        spin(0.3)
        check((js("document.getElementById('feedback').textContent") as? String)?.contains("u got supply and entry\nelasticity was the third") == true,
              "feedback lines show in the box, stacked")

        // 7: a second round (one "why"), then rounds that time out with and without an answer
        messages.value.removeAll()
        notes.showRecall(seconds: 120, prompt: "why does supply slope up?")
        spin(0.3)
        check((js("document.getElementById('recall-history').textContent") as? String)?.contains("u got supply and entry") == true,
              "a second recall keeps the first round's feedback above")
        check(js("var t = document.getElementById('recall-text'); t.value === '' && !t.disabled && document.getElementById('recall-prompt').textContent") as? String
              == "why does supply slope up?", "and resets the prompt and the box")
        check((js("document.getElementById('countdown').textContent") as? String).map { ["2:00", "1:59"].contains($0) } == true, "and the countdown")
        _ = js("document.getElementById('recall-text').value = 'each extra unit costs more'; document.getElementById('submit').click()")
        check(sent(.recall("each extra unit costs more")), "Submit works the second time")
        notes.recallFeedback("right: rising marginal cost")
        notes.showRecall(seconds: 1, prompt: "one more?")
        _ = js("document.getElementById('recall-text').value = 'written before time ran out'")
        check(sent(.recall("written before time ran out"), within: 8), "when time runs out, what he wrote is submitted")
        notes.recallFeedback("good")
        notes.showRecall(seconds: 1, prompt: "last one?")
        check(sent(.skipRecall, within: 8), "when time runs out with nothing written, it is a skip")
        check(js("!document.getElementById('recall').hidden && document.getElementById('recall-now').hidden && document.getElementById('recall-history').children.length") as? Int == 3,
              "after the skip, the earlier rounds stay in view")
        messages.value.removeAll()
        notes.showRecall(seconds: 120, prompt: "really the last one?")
        spin(0.2)
        _ = js("document.getElementById('skip').click()")
        check(sent(.skipRecall), "Skip sends skipRecall on a later round")

        notes.finished(pdf: "/Users/sam/School/COURSE 101/COURSE 101 notes.pdf", file: "/Users/sam/School/COURSE 101/COURSE 101 notes.md")
        spin(0.3)
        check((js("document.getElementById('saved').textContent") as? String).map { $0.contains("saved") && $0.contains("~/School/COURSE 101/COURSE 101 notes.pdf") } == true,
              "finished shows saved with both paths")

        // the after-class pass: its line in the saved box, and its lines still land after the class is saved
        notes.afterClass("after class: re-reading the lecture")
        spin(0.2)
        check(js("(document.querySelector('#saved .after-class') || {}).textContent") as? String == "after class: re-reading the lecture",
              "afterClass shows its line in the saved box")
        notes.apply([.insertAfter("d1", B("p1", "the pass's line under d1", 1, "added")), .append(B("p2", "and one at the end", 0, "added")),
                     .replace(B("d2", "firms enter when economic profit > 0 (fixed)", 1, fixed: true))])
        spin(0.3)
        let afterIds = order()
        check(afterIds.firstIndex(of: "p1") == afterIds.firstIndex(of: "d1").map { $0 + 1 } && afterIds.contains("p2")
              && block("d2")["fixed"] as? Bool == true && js("!!document.querySelector('.line[data-id=\"p2\"]')") as? Bool == true,
              "insertAfter, append and replace still apply and draw after the class is saved")
        notes.afterClass("after class: 9 added, 3 fixed")
        spin(0.2)
        check(js("document.querySelectorAll('#saved .after-class').length === 1 && document.querySelector('#saved .after-class').textContent") as? String
              == "after class: 9 added, 3 fixed", "the finished line replaces the running one")
        _ = js("document.getElementById('dock').hidden = true")
        notes.afterClass("after class: 9 added, 3 fixed")
        spin(0.2)
        check(js("document.getElementById('status').textContent") as? String == "after class: 9 added, 3 fixed", "with the saved box gone, the line is the status")
        _ = js("document.getElementById('dock').hidden = false")
        notes.afterClass("after class: 9 added, 3 fixed")

        // 6: deadlines heard in class, offered for Atlas
        messages.value.removeAll()
        notes.offerDeadlines([NotesWindow.DeadlineItem(id: "dl1", title: "problem set 4", due: "Fri Oct 30", line: "pset 4 due next fri"),
                              NotesWindow.DeadlineItem(id: "dl2", title: "reading: chapter 6", due: "Tue Oct 27", line: nil),
                              NotesWindow.DeadlineItem(id: "dl3", title: "midterm", due: "Thu Nov 5", line: "midterm is nov 5 - Prof. Example")])
        spin(0.3)
        check(js("document.querySelectorAll('#deadline-list input:checked').length") as? Int == 3, "offerDeadlines lists each, checked")
        picture("notes-r2-dock", dark: false)
        _ = js("document.querySelectorAll('#deadline-list input')[1].checked = false; document.getElementById('deadline-add').click()")
        check(sent(.addDeadlines(["dl1", "dl3"])), "Add to Atlas sends only the checked ids (dl1, dl3)")
        notes.deadlinesAdded("added 2 to Atlas")
        spin(0.2)
        check(js("!document.getElementById('deadline-result').hidden && document.getElementById('deadline-result').textContent") as? String == "added 2 to Atlas",
              "deadlinesAdded shows the result")
        notes.offerDeadlines([NotesWindow.DeadlineItem(id: "dl4", title: "lab report", due: "Mon Nov 2", line: nil)])
        spin(0.2)
        _ = js("document.getElementById('deadline-skip').click()")
        check(sent(.addDeadlines([])), "Skip sends addDeadlines with no ids")

        // 5: review mode, his saved notes opened again
        messages.value.removeAll()
        notes.show(course: "COURSE 101", heading: "CLASS 3 (Thu Oct 22)", title: "markets", status: "saved notes · CLASS 3", blocks: fixture,
                   baseURL: folder, mode: "review")
        spin(0.4)
        check(!notes.isOnAnyDisplay, "the window is still off every display")
        check(js("getComputedStyle(document.getElementById('end')).display") as? String == "none", "review mode has no End class button")
        notes.hearing("words the ear should not show in review")
        spin(0.2)
        check(js("getComputedStyle(document.getElementById('hearing')).display") as? String == "none", "review mode has no hearing line")
        check(js("document.getElementById('status').textContent") as? String == "saved notes · CLASS 3", "review mode shows the status as given")
        _ = js("notes._test.type('d2', 'fixed after class')")
        check(sent(.edit(id: "d2", text: "fixed after class")), "editing in review mode sends edit as live does")
        _ = js("notes._test.blur()")

        // 6: one window: the board beside the notes, with the explainer panel living in it
        let panes = notes.paneWidthsForTests
        check(notes.boardHost != nil && abs(panes.notes - NotesWindow.defaultWidth) < 2 && panes.board > 300,
              "the board sits beside the notes in the same window (notes \(Int(panes.notes)) pt, board \(Int(panes.board)) pt)")
        let explainer = ExplainerPanel(accentHex: "#ff6b2c")
        if explainer.available, let host = notes.boardHost {
            explainer.dock(into: host)
            explainer.open(id: "selftest", title: "kernel of a map", markup: "<lead>the kernel is what the map sends to 0</lead>", screen: nil)
            spin(0.6)
            check(explainer.dockedForTests && !explainer.floatingForTests && explainer.isOpen, "an explanation opens on the board, not in a floating panel")
            explainer.close()
            check(explainer.dockedForTests && !explainer.isOpen, "closing it leaves the board in the window")
            explainer.dock(into: nil)
            check(!explainer.dockedForTests && !explainer.floatingForTests, "with the window gone the panel goes back to its own window, hidden")
        } else {
            check(false, "the explainer panel's page is available to put on the board")
        }
        check(NotesMessage(["type": "close"]) == .close, "the saved class's close button closes the whole window")
        check(!notes.isOnAnyDisplay, "the window is still off every display")

        // the course file as a PDF
        let pdf = folder.appendingPathComponent("COURSE 101 notes.pdf")
        let exported = Box<String?>(nil)
        let markdown = courseFile()
        Task { @MainActor in
            do { try await notes.exportPDF(markdown: markdown, baseURL: folder, to: pdf); exported.value = "ok" } catch { exported.value = "\(error)" }
        }
        _ = spin(until: 45) { exported.value != nil }
        check(exported.value == "ok", "exportPDF finishes (\(exported.value ?? "timed out"))")
        let document = PDFDocument(url: pdf)
        let pages = document?.pageCount ?? 0
        check(pages >= 2, "the three-class PDF has \(pages) pages (at least 2)")
        let size = document?.page(at: 0)?.bounds(for: .mediaBox).size ?? .zero
        check(abs(size.width - 612) < 1 && abs(size.height - 792) < 1, String(format: "its pages are Letter (%.0f x %.0f pt)", size.width, size.height))
        let text = (document?.string ?? "").replacingOccurrences(of: "\n", with: " ")
        for heading in ["CLASS 3 (Thu Oct 22): markets", "CLASS 2 (Tue Oct 20): costs", "CLASS 1 (Thu Oct 15): intro"] {
            check(text.contains(heading), "the PDF's text has \"\(heading)\"")
        }
        check(!text.contains("<!--") && !text.contains("11:42:10"), "no HTML comment (a line's <!--@11:42:10-->) reaches the PDF")
        check(text.contains("Slide: Supply shifters"), "a ![slide: ...] image prints with its title")
        if let keep = ProcessInfo.processInfo.environment["DOT_NOTES_SELFTEST_PDF"], FileManager.default.fileExists(atPath: pdf.path) {
            try? FileManager.default.removeItem(atPath: keep)
            try? FileManager.default.copyItem(atPath: pdf.path, toPath: keep)
            print("  pdf kept at \(keep)")
        }

        // nine short classes: each card starts and ends on the same page
        let shortPDF = folder.appendingPathComponent("short.pdf")
        let shortDone = Box<String?>(nil)
        let shortMarkdown = courseFile(classes: 9, ideas: 6)
        Task { @MainActor in
            do { try await notes.exportPDF(markdown: shortMarkdown, baseURL: folder, to: shortPDF); shortDone.value = "ok" } catch { shortDone.value = "\(error)" }
        }
        _ = spin(until: 45) { shortDone.value != nil }
        let short = PDFDocument(url: shortPDF)
        let split = (1...9).filter { n in
            let first = short?.findString("CLASS \(n) (", withOptions: []).first?.pages.first
            let last = short?.findString("end of class \(n).", withOptions: []).first?.pages.first
            return first == nil || first != last
        }
        check(shortDone.value == "ok" && (short?.pageCount ?? 0) >= 2 && split.isEmpty,
              "nine short classes over \(short?.pageCount ?? 0) pages: no card split across a page (split: \(split))")

        notes.close()
        spin(0.3)
        return finish(failures)
    }

    private static func finish(_ failures: [String]) -> Bool {
        print(failures.isEmpty ? "notes selftest: all passed" : "notes selftest: \(failures.count) failed")
        return failures.isEmpty
    }

    /// Placeholder classes, newest first, in the course file format (protocol.md 1); 14 ideas make about a page each.
    static func courseFile(classes: Int = 3, ideas: Int = 14) -> String {
        let named = [3: ("Thu Oct 22", "markets"), 2: ("Tue Oct 20", "costs"), 1: ("Thu Oct 15", "intro")]
        var out = ["# COURSE 101 notes", ""]
        for n in stride(from: classes, through: 1, by: -1) {
            let (date, title) = named[n] ?? ("Tue Nov \(n)", "topic \(n)")
            out.append("## CLASS \(n) (\(date)): \(title)")
            for i in 1...ideas {
                out.append("- **idea \(i)** of class \(n): price up -> quantity supplied up, b/c firms want profit <!--@11:42:10-->")
                out.append("  - why: marginal cost $MC = \\frac{dTC}{dq}$ rises w output")
                if i % 3 == 0 { out.append("    - \"u can't skip the margin\" - Prof. Example") }
                if i % 4 == 0 { out.append("  - ⁺ added after class: the slide's worked example \(i)") }
            }
            if n == 3 {
                out.append("![board 11:42](notes-images/board 1.png)")
                out.append("![slide: Supply shifters](notes-images/slide-1.png)")
            }
            out.append("- (DO later for practice) - Sam Rivera's study group, end of class \(n).")
            out.append("")
        }
        return out.joined(separator: "\n")
    }

    /// What a plain WKWebView (a line he can type in, off every display, its window not key) answers for the first click
    /// at `point`; nil when its page never loaded.
    private static func stockFirstMouse(at point: CGPoint) -> Bool? {
        let frame = CGRect(x: -20_000, y: -20_000, width: 800, height: 900)
        let window = NSWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.sharingType = .none
        let web = WKWebView(frame: CGRect(origin: .zero, size: frame.size))
        window.contentView = web
        window.orderFrontRegardless()
        defer { window.orderOut(nil) }
        guard NSScreen.screens.allSatisfy({ !$0.frame.intersects(window.frame) }) else { return nil }
        web.loadHTMLString("<body style='margin:0'>" + (1...40).map { "<div contenteditable='plaintext-only'>line \($0)</div>" }.joined() + "</body>", baseURL: nil)
        guard spin(until: 8, { !web.isLoading }) else { return nil }
        spin(0.3)
        guard let event = NotesWindow.mouseDown(at: point, in: window) else { return nil }
        return web.acceptsFirstMouse(for: event)
    }

    /// A board photo or slide stand-in.
    private static func writeImage(to url: URL, size: NSSize = NSSize(width: 240, height: 120), label: String = "x = 2y") {
        let image = NSImage(size: size, flipped: false) { rect in
            NSColor(calibratedRed: 0.2, green: 0.35, blue: 0.3, alpha: 1).setFill()
            rect.fill()
            (label as NSString).draw(at: NSPoint(x: 20, y: rect.midY - 15), withAttributes: [.font: NSFont.systemFont(ofSize: 28), .foregroundColor: NSColor.white])
            return true
        }
        guard let tiff = image.tiffRepresentation, let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) else { return }
        try? png.write(to: url)
    }

    @discardableResult
    private static func spin(until seconds: Double, _ done: () -> Bool) -> Bool {
        let until = Date().addingTimeInterval(seconds)
        while Date() < until {
            if done() { return true }
            spin(0.02)
        }
        return done()
    }

    private static func spin(_ seconds: Double) {
        let until = Date().addingTimeInterval(seconds)
        while Date() < until {
            while let event = NSApp.nextEvent(matching: .any, until: Date(timeIntervalSinceNow: 0.005), inMode: .default, dequeue: true) {
                NSApp.sendEvent(event)
            }
            RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.01))
        }
    }
}
