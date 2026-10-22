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
        return ok
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
