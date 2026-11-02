import AppKit
import DotKit
import Foundation

/// `Dot --selftest`: the live notch's consent queue, checked in a throwaway notch with no agents,
/// no model and no chime (round seven, F1: a second agent's card used to replace the first one's).
/// Prints PASS or FAIL per check; the exit status is 0 when every check holds.
@MainActor
enum SelfTest {
    static func run() -> Bool {
        var ok = true
        func check(_ name: String, _ holds: Bool) {
            print("\(holds ? "PASS" : "FAIL") \(name)")
            if !holds { ok = false }
        }
        let hud = NotchHUD()
        var answered: [String] = []
        var announced: [String] = []
        hud.onConsentShown = { announced.append($0.agentId) }
        var chimes = 0
        hud.playConsentChime = { chimes += 1 }
        func card(_ agent: String, _ title: String, guarded: Bool = false) -> ConsentCard {
            let id = UUID()
            var made = ConsentCard(id: id, agentId: agent, agent: agent.capitalized, title: title, detail: "", guarded: guarded,
                                   onAllow: { answered.append("\(agent): allow"); hud.dismissConsent(id: id) },
                                   onDeny: { answered.append("\(agent): deny"); hud.dismissConsent(id: id) })
            made.onWithdraw = { answered.append("\(agent): withdrawn") }
            return made
        }
        let email = card("email", "use atlas: calendar delete", guarded: true)
        let physics = card("physics", "run a command")
        hud.present(email)
        hud.present(physics)
        check("the first question stays on show when a second agent asks", hud.model.consent?.id == email.id)
        check("one chime for two questions, not one each (FX-09)", chimes == 1)
        check("only the question on show is announced", announced == ["email"])
        check("the second waits behind it (+1 waiting)", hud.model.consentWaiting == 1)
        hud.model.consent?.onAllow()
        check("answering the one on show brings up the next", hud.model.consent?.id == physics.id && hud.model.consentWaiting == 0)
        check("and announces it then", announced == ["email", "physics"])
        let email2 = card("email", "use atlas: calendar delete", guarded: true)
        hud.present(email2)
        check("a question queued behind another does not chime", chimes == 1)
        hud.bringConsentForward(agent: "email")
        check("tapping an agent's waiting row brings its question forward", hud.model.consent?.id == email2.id && hud.model.consentWaiting == 1)
        check("stopping an agent withdraws its questions", hud.withdrawConsent(agent: "email") == 1 && hud.model.consent?.id == physics.id)
        check("a withdrawn question is answered, not dropped (FX-07)", answered == ["email: allow", "email: withdrawn"])
        hud.model.consent?.onDeny()
        check("nothing is left unanswered", hud.model.consent == nil && hud.openConsents.isEmpty && answered == ["email: allow", "email: withdrawn", "physics: deny"])
        let words = email.title + " " + email.detail
        check("a spoken bare yes does not pass a guarded card", ConsentVoice.interpret("yes", guarded: email.guarded, card: words) == .needsExplicit)
        check("a spoken yes that names the card's act does", ConsentVoice.interpret("yes, delete it", guarded: email.guarded, card: words) == .allow)
        check("a yes naming another act does not", ConsentVoice.interpret("yes, send it", guarded: email.guarded, card: words) == .needsExplicit)
        check("a request that starts with ok is not an answer (FX-01)", ConsentVoice.interpret("ok so explain this", guarded: physics.guarded, card: physics.title) == .none)
        editKeys(check)
        stepAside(check, hud: hud)
        quietInFocus(check)
        dictationWatch(check)
        chords(check)
        regionClip(check)
        markdownCode(check)
        return ok
    }

    /// VI-08: a fenced block in the Markdown reader comes out coloured by its language; a block naming none that reads
    /// like prose stays plain.
    static func markdownCode(_ check: (String, Bool) -> Void) {
        let text = "# Code\n\n```python\ndef pv(cash, rate, years):\n    # discounted back\n    return cash / (1 + rate) ** years\n```\n\n```\nthe result was 68.06 and nothing else\n```\n"
        let script = "JSON.stringify({hljs: !!window.hljs, coloured: document.querySelectorAll('pre code.hljs').length, keyword: document.querySelectorAll('.hljs-keyword').length, "
            + "comment: document.querySelectorAll('.hljs-comment').length, number: document.querySelectorAll('.hljs-number').length, "
            + "colour: (document.querySelector('.hljs-keyword') ? getComputedStyle(document.querySelector('.hljs-keyword')).color : '')})"
        guard let json = MarkdownViewer.probe(text, script: script) as? String, let data = json.data(using: .utf8),
              let page = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return check("the Markdown reader loaded", false) }
        check("highlight.js loads in the Markdown reader", page["hljs"] as? Bool == true)
        check("the python block is coloured and the prose block is not (\(page["coloured"] ?? 0) coloured)", page["coloured"] as? Int == 1)
        check("keywords, comments and numbers get their colour (\(page["colour"] ?? "none"))",
              (page["keyword"] as? Int ?? 0) >= 2 && (page["comment"] as? Int ?? 0) == 1 && (page["number"] as? Int ?? 0) >= 1
              && !((page["colour"] as? String) ?? "").isEmpty && (page["colour"] as? String) != "rgb(31, 35, 40)" && (page["colour"] as? String) != "rgb(227, 227, 227)")
    }

    /// HA-01: the clip a circled region becomes, pasted the way apps read it (on a private pasteboard: his clipboard is
    /// untouched). A rich text view gets the note and the picture, a plain one the note alone, an image reader the image.
    static func regionClip(_ check: (String, Bool) -> Void) {
        let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 40, pixelsHigh: 24, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                                   isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        NSColor.orange.setFill()
        CGRect(x: 0, y: 0, width: 40, height: 24).fill()
        NSGraphicsContext.restoreGraphicsState()
        guard let jpeg = rep.representation(using: .jpeg, properties: [:]) else { return check("a test picture", false) }
        let board = NSPasteboard(name: NSPasteboard.Name("com.roshan.dot.selftest.clip"))
        defer { board.releaseGlobally() }
        check("the region and a note go on the clipboard as one item", RegionPaste.copy(jpeg: jpeg, note: "why is this row negative?", to: board)
              && board.pasteboardItems?.count == 1)
        let rich = NSTextView()
        rich.importsGraphics = true
        let read = rich.readSelection(from: board)
        let storage = rich.textStorage ?? NSTextStorage()
        var attachments = 0
        storage.enumerateAttribute(.attachment, in: NSRange(location: 0, length: storage.length)) { value, _, _ in if value != nil { attachments += 1 } }
        check("a rich text view pastes the note and the picture (\(attachments) attachment)",
              read && storage.string.hasPrefix("why is this row negative?") && attachments == 1)
        let plain = NSTextView()
        plain.isRichText = false
        check("a plain field pastes the note alone", plain.readSelection(from: board) && plain.string == "why is this row negative?")
        check("an image reader gets the picture", NSImage(pasteboard: board).map { $0.size.width > 0 } ?? false)
        RegionPaste.copy(jpeg: jpeg, note: "", to: board)
        check("no note: the picture alone, no text", board.string(forType: .string) == nil && NSImage(pasteboard: board) != nil)
    }

    /// SE-01/02: the event tap's handler fed events made here (none is posted): today's chords, Shift for an agent,
    /// exact matching, a recorded keyed chord whose key is kept from the app, and nothing while recording.
    static func chords(_ check: (String, Bool) -> Void) {
        let monitor = HotkeyMonitor()
        var events: [HotkeyMonitor.Event] = []
        monitor.onEvent = { events.append($0) }
        func flags(_ f: CGEventFlags) {
            guard let e = CGEvent(keyboardEventSource: nil, virtualKey: 0x3B, keyDown: true) else { return }
            e.type = .flagsChanged
            e.flags = f
            _ = monitor.handle(type: .flagsChanged, event: e)
        }
        func key(_ code: CGKeyCode, down: Bool, _ f: CGEventFlags, repeating: Bool = false) -> Bool {
            guard let e = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: down) else { return false }
            e.flags = f
            if repeating { e.setIntegerValueField(.keyboardEventAutorepeat, value: 1) }
            return monitor.handle(type: down ? .keyDown : .keyUp, event: e)
        }
        func drain() -> [HotkeyMonitor.Event] {
            RunLoop.main.run(until: Date().addingTimeInterval(0.05))
            defer { events = [] }
            return events
        }
        monitor.configure(conversation: .conversationDefault, dictation: .dictationDefault, testing: true)
        flags([.maskControl]); flags([.maskControl, .maskAlternate]); flags([.maskControl, .maskAlternate, .maskShift]); flags([])
        let talk = drain()
        check("control+option talks, Shift turns it to an agent, letting go ends it",
              talk.first == .pressed(.talk) && talk.contains(.modeChanged(.agent)) && talk.contains { if case .released(.agent, _) = $0 { return true }; return false })
        flags([.maskControl, .maskAlternate, .maskCommand]); flags([])
        check("command on top is not the chord (exact match)", drain().isEmpty)
        flags([.maskControl, .maskSecondaryFn]); flags([])
        let dictate = drain()
        check("control+fn dictates", dictate.first == .pressed(.dictate))
        let space = Chord([.option], keyCode: 49, keyLabel: "Space")
        monitor.configure(conversation: space, dictation: .dictationDefault, testing: true)
        flags([.maskAlternate])
        check("a keyed chord doesn't fire on its modifier alone", drain().isEmpty)
        let kept = key(49, down: true, [.maskAlternate])
        let repeatKept = key(49, down: true, [.maskAlternate])
        let pressed = drain()
        let upKept = key(49, down: false, [.maskAlternate])
        flags([])
        let released = drain()
        check("option+Space talks and its key never reaches the app", kept && repeatKept && upKept && pressed == [.pressed(.talk)]
              && released.contains { if case .released(.talk, _) = $0 { return true }; return false })
        flags([.maskAlternate])
        let early = key(49, down: true, [.maskAlternate])
        flags([])   // option comes up while Space is still down: the hold ends here
        let endedEarly = drain()
        let lateRepeat = key(49, down: true, [], repeating: true)
        let lateUp = key(49, down: false, [])
        check("letting go of option first still keeps Space's repeats and key-up from the app",
              early && lateRepeat && lateUp && endedEarly.contains { if case .released(.talk, _) = $0 { return true }; return false })
        check("and Space on its own reaches the app after", !key(49, down: true, []) && !key(49, down: false, []))
        _ = drain()
        flags([.maskControl, .maskAlternate]); flags([])
        check("the old chord no longer fires once another is recorded", drain().isEmpty)
        check("other keys pass through", !key(2, down: true, []) && !key(2, down: false, []))
        _ = drain()
        monitor.paused = true
        _ = key(49, down: true, [.maskAlternate]); _ = key(49, down: false, [.maskAlternate])
        check("nothing fires while he records a chord", drain().isEmpty)

        // Settings' recorder: a bare key ends the recording on its key-up (no flags change follows) and is refused
        let recorder = ChordRecorder()
        var recorded: Chord?
        recorder.start(.dictation) { recorded = $0 }
        func nsKey(_ type: NSEvent.EventType) -> NSEvent? {
            NSEvent.keyEvent(with: type, location: .zero, modifierFlags: [], timestamp: 0, windowNumber: 0, context: nil,
                             characters: "d", charactersIgnoringModifiers: "d", isARepeat: false, keyCode: 2)
        }
        if let down = nsKey(.keyDown), let up = nsKey(.keyUp) { _ = recorder.handle(down); _ = recorder.handle(up) }
        check("recording a bare key ends on its key-up, and the check refuses it",
              recorder.recording == nil && recorded?.keyCode == 2 && recorded.flatMap { ChordRules.problem($0, conversation: false) } != nil)
        recorder.cancel()
    }

    /// DI-05: the correction watch over a scripted field. His fix inside the range, then five quiet seconds, gives a
    /// candidate; typing elsewhere, a fix of a word into a different word, or nothing at all give none.
    static func dictationWatch(_ check: (String, Bool) -> Void) {
        func run(_ reads: [DictationWatch.Read], seconds: [TimeInterval]) -> (DictationCandidate?, Bool) {
            let value = "Hi, meet at the you chicago library"
            guard let tracker = DictationEditTracker(value: value, start: 4, inserted: "meet at the you chicago library") else { return (nil, false) }
            var queue = reads
            let start = Date()
            let watch = DictationWatch(tracker: tracker, app: "Mail", dictionary: DictationDictionary(), now: start) {
                queue.isEmpty ? DictationWatch.Read(focused: true, value: nil) : queue.removeFirst()
            }
            var found: DictationCandidate?
            watch.onCandidate = { found = $0 }
            for t in seconds where watch.tick(now: start.addingTimeInterval(t)) {}
            return (found, watch.finished)
        }
        let typing = ["Hi, meet at the  chicago library", "Hi, meet at the U chicago library", "Hi, meet at the UChicago library"]
        let fix = typing.map { DictationWatch.Read(focused: true, value: $0) }
        let settle = Array(repeating: DictationWatch.Read(focused: true, value: "Hi, meet at the UChicago library"), count: 30)
        let (found, done) = run(fix + settle, seconds: (0..<33).map { Double($0) * 0.25 })
        check("his fix inside the range becomes a candidate after five quiet seconds", found == DictationCandidate(heard: "you chicago", correct: "UChicago") && done)
        let (early, open) = run(fix + settle, seconds: (0..<10).map { Double($0) * 0.25 })
        check("not before the five seconds", early == nil && !open)
        let away = fix + [DictationWatch.Read(focused: false, value: nil)]
        check("a fix then a click elsewhere still counts (it was seen while focused)", run(away, seconds: (0..<6).map { Double($0) * 0.25 }).0 != nil)
        let elsewhere = [DictationWatch.Read(focused: true, value: "Hey, meet at the you chicago library"),
                         DictationWatch.Read(focused: true, value: "Hey, meet at the UChicago library")] + settle
        let (none, ended) = run(elsewhere, seconds: (0..<30).map { Double($0) * 0.25 })
        check("typing before the range ends the watch with no candidate", none == nil && ended)
        let untouched = Array(repeating: DictationWatch.Read(focused: true, value: "Hi, meet at the you chicago library"), count: 400)
        let (nothing, timedOut) = run(untouched, seconds: (0...364).map { Double($0) * 0.25 })
        check("no edit: nothing, and the watch stops at ninety seconds", nothing == nil && timedOut)
    }

    /// S1: a Focus keeps Dot quiet like a call does, and the setting turns that off. The live read runs too (it must
    /// answer, and agree with the window list it reads).
    static func quietInFocus(_ check: (String, Bool) -> Void) {
        var config = DotConfig()
        let onCall = config.quietOnCalls && CallPresence.isOnCall()
        FocusPresence.override = true
        check("a Focus on: quiet", Quiet.now(config))
        config.quietInFocus = false
        check("Quiet in Focus off: a Focus alone is not quiet", Quiet.now(config) == onCall)
        FocusPresence.override = nil
        let live = FocusPresence.isOn()
        check("the live Focus read agrees with Control Center (\(live ? "on" : "off"))",
              live == FocusSignal.isOn(StepAside.liveWindows(), preferences: FocusPresence.preferences()))
    }

    /// NO-04: a fake Spotlight in the window list fades the notch and the orb's overlay (marks and ink are drawn there)
    /// and makes the notch click-through; closing it brings them back.
    static func stepAside(_ check: (String, Bool) -> Void, hud: NotchHUD) {
        let overlay = OverlayManager(colorHex: "#FF6B2B", presence: false)
        let watch = StepAside()
        var list: [SystemWindow] = []
        watch.windows = { list }
        watch.anythingShown = { true }
        watch.apply = { on in hud.stepAside(on); overlay.stepAside(on) }
        func settle() {
            let until = Date().addingTimeInterval(0.4)
            while Date() < until { RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.02)) }
        }
        let shown = ConsentCard(id: UUID(), agentId: "scout", agent: "Scout", title: "run a command", detail: "", guarded: false,
                                onAllow: {}, onDeny: {})
        hud.present(shown)
        settle()
        let panel = hud.stepAsideWindow
        check("the notch is up with a card (the case to step aside from)", panel != nil)
        watch.read()
        settle()
        check("nothing up: Dot stays", watch.surface == nil && !hud.steppedAside && overlay.windows.allSatisfy { $0.contentView?.alphaValue == 1 })
        list = [SystemWindow(owner: "Control Center", layer: 25, frame: CGRect(x: 1300, y: 0, width: 34, height: 33)),
                SystemWindow(owner: "Spotlight", layer: 23, frame: CGRect(x: 456, y: 180, width: 600, height: 60))]
        watch.read()
        settle()
        check("Spotlight up: the notch and the overlay fade out", watch.surface == .spotlight && hud.steppedAside
              && (panel?.contentView?.alphaValue ?? 0) == 0 && !overlay.windows.isEmpty && overlay.windows.allSatisfy { $0.contentView?.alphaValue == 0 })
        check("and the notch lets clicks through", panel.map(\.ignoresMouseEvents) ?? true)
        list = [SystemWindow(owner: "Control Center", layer: 25, frame: CGRect(x: 1300, y: 0, width: 34, height: 33))]
        watch.read()
        settle()
        check("Spotlight closed: they come back", watch.surface == nil && !hud.steppedAside
              && (panel?.contentView?.alphaValue ?? 1) == 1 && overlay.windows.allSatisfy { $0.contentView?.alphaValue == 1 })
        var clock = Date()
        watch.now = { clock }
        list = [SystemWindow(owner: "Screenshot", layer: 24, frame: CGRect(x: 0, y: 0, width: 1512, height: 982), number: 338156)]
        watch.read()
        settle()
        check("the screenshot tool up: they fade out", watch.surface == .screenshot && hud.steppedAside)
        clock += SurfaceClock.stuckAfter
        watch.read()
        settle()
        check("its window still there, unmoved, two minutes on: stuck, and they come back (2026-11-01)", watch.surface == nil && !hud.steppedAside
              && (panel?.contentView?.alphaValue ?? 1) == 1 && overlay.windows.allSatisfy { $0.contentView?.alphaValue == 1 })
        for window in overlay.windows { window.orderOut(nil) }
        hud.dismissConsent(id: shown.id)
    }

    /// ⌘X ⌘C ⌘V ⌘A ⌘Z in Dot's own panels (2026-10-22): the keys go through the app's real event dispatch to a panel
    /// off every display, and a real paste lands in a text field; his clipboard is put back as it was.
    private static func editKeys(_ check: (String, Bool) -> Void) {
        let panel = KeyablePanel(contentRect: NSRect(x: -20000, y: -20000, width: 320, height: 60), styleMask: [.borderless, .nonactivatingPanel],
                                 backing: .buffered, defer: false)
        let recorder = EditRecorder(frame: NSRect(x: 0, y: 0, width: 320, height: 30))
        let field = NSTextField(frame: NSRect(x: 0, y: 30, width: 320, height: 24))
        panel.contentView?.addSubview(recorder)
        panel.contentView?.addSubview(field)
        panel.orderFrontRegardless()
        panel.makeKey()
        func press(_ key: String, shift: Bool = false) {
            let codes: [String: UInt16] = ["x": 7, "c": 8, "v": 9, "a": 0, "z": 6]
            guard let event = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: shift ? [.command, .shift] : .command, timestamp: 0,
                                               windowNumber: panel.windowNumber, context: nil, characters: shift ? key.uppercased() : key,
                                               charactersIgnoringModifiers: shift ? key.uppercased() : key, isARepeat: false, keyCode: codes[key] ?? 0)
            else { return }
            NSApp.sendEvent(event)
        }
        panel.makeFirstResponder(recorder)
        check("the panel takes the keys (it is key)", panel.isKeyWindow)
        for key in ["x", "c", "v", "a", "z"] { press(key) }
        press("z", shift: true)
        check("⌘X ⌘C ⌘V ⌘A ⌘Z ⇧⌘Z reach the focused field: \(recorder.seen)", recorder.seen == ["cut", "copy", "paste", "selectAll", "undo", "redo"])
        let board = NSPasteboard.general
        let saved = (board.pasteboardItems ?? []).map { item in item.types.compactMap { type in item.data(forType: type).map { (type, $0) } } }
        board.clearContents()
        board.setString("pasted into dot", forType: .string)
        panel.makeFirstResponder(field)
        press("v")
        check("a real ⌘V puts the clipboard's text in the field", field.stringValue == "pasted into dot")
        board.clearContents()
        board.writeObjects(saved.map { pairs in
            let item = NSPasteboardItem()
            for (type, data) in pairs { item.setData(data, forType: type) }
            return item
        })
        panel.close()
    }
}

private final class EditRecorder: NSTextView {
    var seen: [String] = []
    override func cut(_ sender: Any?) { seen.append("cut") }
    override func copy(_ sender: Any?) { seen.append("copy") }
    override func paste(_ sender: Any?) { seen.append("paste") }
    override func selectAll(_ sender: Any?) { seen.append("selectAll") }
    @objc func undo(_ sender: Any?) { seen.append("undo") }
    @objc func redo(_ sender: Any?) { seen.append("redo") }
}
