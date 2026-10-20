import Foundation

/// What a job may press on a page. The gate only ever sees "click e12", so his rule is checked here, on the resolved
/// element: its name, its kind, its form and its ancestors.
public enum PageVerdict: Equatable, Sendable {
    case ok
    /// His to press (send, submit, buy, book, print...): Dot rings it for him and the job stops there.
    case his(String)
    /// An unnamed or icon-only button: nothing to check it against, so it's his too ("name it or it's his").
    case unnamed
}

public enum PageCommitRule {
    /// Words only jobs treat as his, on top of CommitGuard's (H §S0): printing, an upload that completes a
    /// booking or a print job, scheduling, and signing in.
    static let jobWords = Rx.make(#"\b(?:print|upload\s*(?:&|and)\s*complete|schedule|log ?in|sign ?in)\b"#)
    /// Look-alikes a job may press although CommitGuard's words match them.
    static let lookalikes = Rx.make(#"^\W*(?:apply(?: the)? filters?|accept(?: all)? cookies)\W*$"#)
    /// A human check (a CAPTCHA, tal.net's "Quick Check"): never a job's.
    static let humanCheck = Rx.make(#"\b(?:captcha|recaptcha|hcaptcha|i'?m not a robot|quick check|verify (?:you are|you're) (?:a )?human)\b"#)

    public static let humanLine = "that's a human check; it's yours"

    static func clean(_ s: String) -> String {
        s.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func hasWords(_ s: String) -> Bool { s.unicodeScalars.contains { CharacterSet.alphanumerics.contains($0) } }

    /// - name: the accessible name (aria-label, label, innerText, value or title, whichever the page gives).
    /// - ancestors: aria-label or title of up to four ancestors (never their text, which holds the whole form).
    public static func verdict(name rawName: String, role: String, tag: String, type: String, inForm: Bool, formIsSearch: Bool,
                               ancestors: [String] = []) -> PageVerdict {
        let name = clean(rawName)
        let lowerTag = tag.lowercased(), lowerType = type.lowercased()
        if Rx.has(humanCheck, name) || ancestors.contains(where: { Rx.has(humanCheck, $0) }) { return .his(name.isEmpty ? "human check" : name) }
        let clickable = ["button", "a", "summary", "input"].contains(lowerTag) || ["button", "link", "menuitem", "tab", "switch", "checkbox", "option"].contains(role.lowercased())
        if clickable, !hasWords(name) { return .unnamed }
        if Rx.has(lookalikes, name) { return .ok }
        if CommitGuard.isCommit(name) || Rx.has(jobWords, name) { return .his(name) }
        for a in ancestors.prefix(4) where !a.isEmpty {
            if Rx.has(lookalikes, a) { continue }
            if CommitGuard.isCommit(a) || Rx.has(jobWords, a) { return .his(name.isEmpty ? clean(a) : name) }
        }
        // A form's submit button, whatever its name, in a form that isn't a search.
        let submits = (lowerTag == "button" && (lowerType == "submit" || lowerType.isEmpty)) || (lowerTag == "input" && (lowerType == "submit" || lowerType == "image"))
        if submits, inForm, !formIsSearch { return .his(name) }
        return .ok
    }

    /// Typing: passwords are his to type; a job never signs in for him.
    public static func typeVerdict(inputType: String, autocomplete: String = "", name: String = "") -> PageVerdict {
        let t = inputType.lowercased(), a = autocomplete.lowercased()
        if t == "password" || a.contains("password") || a == "one-time-code" { return .his("passwords are yours to type") }
        if Rx.has(humanCheck, name) { return .his(humanLine) }
        return .ok
    }

    /// A key in the page. Enter only in a search field; Enter in a message box or a textarea, Cmd or Ctrl+Enter,
    /// Enter anywhere on a Greenhouse form and Escape on Workday are his. Tab, Escape, arrows, page keys, Home, End,
    /// Space and Backspace pass.
    public static func keyVerdict(key rawKey: String, command: Bool = false, control: Bool = false, option: Bool = false,
                                  focusedTag: String = "", focusedRole: String = "", focusedType: String = "", placeholder: String = "",
                                  host: String = "") -> PageVerdict {
        let key = rawKey.lowercased()
        let h = host.lowercased()
        if key == "enter" || key == "return" {
            if command || control || option { return .his("that key sends it") }
            if h.contains("greenhouse") { return .his("enter on this form could submit it") }
            if focusedTag.lowercased() == "textarea" { return .his("enter in a message box sends it") }
            let role = focusedType.lowercased() == "search" ? "searchbox" : focusedRole
            return CommitGuard.returnAllowed(role: role, subrole: nil, placeholder: placeholder) ? .ok : .his("return there could send something")
        }
        if key == "escape" || key == "esc" {
            return h.contains("workday") ? .his("escape on workday can lose the form") : .ok
        }
        let plain: Set<String> = ["tab", "arrowup", "arrowdown", "arrowleft", "arrowright", "up", "down", "left", "right", "pageup",
                                  "pagedown", "home", "end", "space", " ", "backspace"]
        if plain.contains(key), !command, !control, !option { return .ok }
        return .his("that key could change or send something")
    }
}
