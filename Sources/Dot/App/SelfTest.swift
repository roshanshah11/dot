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
        func card(_ agent: String, _ title: String, guarded: Bool = false) -> ConsentCard {
            let id = UUID()
            return ConsentCard(id: id, agentId: agent, agent: agent.capitalized, title: title, detail: "", guarded: guarded,
                               onAllow: { answered.append("\(agent): allow"); hud.dismissConsent(id: id) },
                               onDeny: { answered.append("\(agent): deny"); hud.dismissConsent(id: id) })
        }
        let email = card("email", "use atlas: calendar delete", guarded: true)
        let physics = card("physics", "run a command")
        hud.present(email, chime: false)
        hud.present(physics, chime: false)
        check("the first question stays on show when a second agent asks", hud.model.consent?.id == email.id)
        check("only the question on show is announced", announced == ["email"])
        check("the second waits behind it (+1 waiting)", hud.model.consentWaiting == 1)
        hud.model.consent?.onAllow()
        check("answering the one on show brings up the next", hud.model.consent?.id == physics.id && hud.model.consentWaiting == 0)
        check("and announces it then", announced == ["email", "physics"])
        let email2 = card("email", "use atlas: calendar delete", guarded: true)
        hud.present(email2, chime: false)
        hud.bringConsentForward(agent: "email")
        check("tapping an agent's waiting row brings its question forward", hud.model.consent?.id == email2.id && hud.model.consentWaiting == 1)
        check("stopping an agent withdraws its questions", hud.withdrawConsent(agent: "email") == 1 && hud.model.consent?.id == physics.id)
        hud.model.consent?.onDeny()
        check("nothing is left unanswered", hud.model.consent == nil && hud.openConsents.isEmpty && answered == ["email: allow", "physics: deny"])
        let words = email.title + " " + email.detail
        check("a spoken bare yes does not pass a guarded card", ConsentVoice.interpret("yes", guarded: email.guarded, card: words) == .needsExplicit)
        check("a spoken yes that names the card's act does", ConsentVoice.interpret("yes, delete it", guarded: email.guarded, card: words) == .allow)
        check("a yes naming another act does not", ConsentVoice.interpret("yes, send it", guarded: email.guarded, card: words) == .needsExplicit)
        return ok
    }
}
