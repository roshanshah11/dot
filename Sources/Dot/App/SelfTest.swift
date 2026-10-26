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
        return ok
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
