import Foundation

/// A small thing Dot does itself, in about a second, with no agent: open, scroll, go back, click,
/// type, press keys, play or pause. It comes from a fixed phrase ("scroll down") before any model,
/// or from a tag the talk model writes ([OPEN:spotify]). His rule stands over all of it: a control
/// that reads like a send, a submit, a payment or a delete is rung for his yes, never pressed.
public enum ActionCommand: Equatable, Sendable {
    public enum Scroll: Equatable, Sendable { case up, down, top, bottom, toText(String) }
    public enum Browser: String, Equatable, Sendable { case back, forward, reload, newTab, closeTab }
    public enum Media: String, Equatable, Sendable { case playPause, next, previous }

    /// An app, a folder, a file or a site named in words; resolved on the Mac ("spotify", "downloads").
    case open(String)
    case openURL(String, newTab: Bool)
    case openPath(String)
    case scroll(Scroll)
    case browser(Browser)
    case key(String)
    case click(label: String)
    case insert(label: String?, text: String)
    case media(Media)
    /// Several steps on what is in front ("go to my applied jobs and search riverside"): Dot drives a
    /// walkthrough itself, one step at a time, and stops at the result.
    case go(goal: String)

    /// The verb in the log's `act:` lines.
    public var verb: String {
        switch self {
        case .open, .openURL, .openPath: return "open"
        case .scroll: return "scroll"
        case .browser(let b): return b.rawValue
        case .key: return "key"
        case .click: return "click"
        case .insert: return "insert"
        case .media(let m): return m.rawValue
        case .go: return "go"
        }
    }

    /// What it acts on, for the log and the spoken confirmation.
    public var object: String {
        switch self {
        case .open(let name): return name
        case .openURL(let url, _): return url
        case .openPath(let path): return path
        case .scroll(let s):
            switch s {
            case .up: return "up"
            case .down: return "down"
            case .top: return "top"
            case .bottom: return "bottom"
            case .toText(let text): return text
            }
        case .browser: return ""
        case .key(let chord): return chord
        case .click(let label): return label
        case .insert(let label, _): return label ?? "the field"
        case .media: return ""
        case .go(let goal): return goal
        }
    }

    /// The one short line Dot says when it worked.
    public var doneLine: String {
        switch self {
        case .open(let name): return "opened \(name.lowercased())."
        case .openURL(let url, _): return "opened \(URL(string: url)?.host ?? "it")."
        case .openPath(let path): return "opened \((path as NSString).lastPathComponent.lowercased())."
        case .scroll(let s):
            switch s {
            case .up: return "scrolled up."
            case .down: return "scrolled down."
            case .top: return "at the top."
            case .bottom: return "at the bottom."
            case .toText: return "here it is."
            }
        case .browser(let b):
            switch b {
            case .back: return "went back."
            case .forward: return "went forward."
            case .reload: return "reloaded."
            case .newTab: return "new tab."
            case .closeTab: return "closed the tab."
            }
        case .key: return "done."
        case .click(let label): return "clicked \(label.lowercased())."
        case .insert: return "typed it in."
        case .media(let m): return m == .playPause ? "done." : (m == .next ? "next one." : "previous one.")
        case .go: return "on it."
        }
    }
}

public enum ActionTags {
    /// [OPEN:target(:new|same)]  [SCROLL:down|up|top|bottom|<text>]  [KEY:cmd+shift+t]  [CLICK:label]
    /// [INSERT:label] <<< text >>>  [GO:goal]
    public static func make(kind: String, payload: String) -> ActionCommand? {
        let text = payload.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
        switch kind {
        case "OPEN":
            guard !text.isEmpty else { return nil }
            var target = text
            var newTab = true
            for (suffix, isNew) in [(":same", false), (":new", true)] where target.lowercased().hasSuffix(suffix) {
                target = String(target.dropLast(suffix.count)).trimmingCharacters(in: .whitespaces)
                newTab = isNew
            }
            return openCommand(target, newTab: newTab)
        case "SCROLL":
            switch text.lowercased() {
            case "", "down", "down a bit", "more": return .scroll(.down)
            case "up", "up a bit": return .scroll(.up)
            case "top", "to the top": return .scroll(.top)
            case "bottom", "to the bottom", "end": return .scroll(.bottom)
            default: return text.count >= 2 ? .scroll(.toText(text)) : nil
            }
        case "KEY":
            return KeyChord.parse(text) == nil ? nil : .key(text.lowercased())
        case "CLICK":
            return text.count >= 1 && text.count <= 80 ? .click(label: text) : nil
        case "INSERT":
            return .insert(label: text.isEmpty ? nil : text, text: "")
        case "GO":
            return text.count >= 3 ? .go(goal: text) : nil
        default:
            return nil
        }
    }

    /// A target in words, a path or a URL: which kind of open it is.
    public static func openCommand(_ target: String, newTab: Bool = true) -> ActionCommand? {
        let t = target.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return nil }
        let lower = t.lowercased()
        if lower.hasPrefix("http://") || lower.hasPrefix("https://") { return .openURL(t, newTab: newTab) }
        if t.hasPrefix("/") || t.hasPrefix("~") { return .openPath(t) }
        // a bare domain ("espn.com", "news.ycombinator.com/item?id=1"): a site, not an app
        if !t.contains(" "), let dot = t.firstIndex(of: "."), t[t.index(after: dot)...].count >= 2,
           t.range(of: #"^[a-z0-9-]+(\.[a-z0-9-]+)+(/\S*)?$"#, options: [.regularExpression, .caseInsensitive]) != nil {
            return .openURL("https://" + t, newTab: newTab)
        }
        return .open(t)
    }
}

/// The fixed phrases Dot answers itself before any model call: under 300 ms from the transcript.
public enum ActionPhrases {
    private static func re(_ p: String) -> NSRegularExpression { try! NSRegularExpression(pattern: p, options: .caseInsensitive) }
    private static let lead = #"^(?:(?:hey|ok(?:ay)?|um+|uh+|so|dot|(?:can|could|would|will) you|please|just|go ahead and)[,.]?\s+)*"#
    private static let tail = #"(?: for me)?(?: please)?(?: now)?[\s.!?]*$"#

    static let scroll = re(lead + #"(scroll|page) (up|down)(?: a bit| some| more| a little)?"# + tail)
    static let scrollEnd = re(lead + #"(?:scroll|go|jump|take me) (?:all the way )?(?:to|back to) the (top|bottom|end|beginning|start)(?: of (?:the|this) page)?"# + tail)
    static let back = re(lead + #"go back(?: a page| one page)?"# + tail)
    static let forward = re(lead + #"go forward(?: a page)?"# + tail)
    static let reload = re(lead + #"(?:reload|refresh)(?: (?:the|this) page| it)?"# + tail)
    static let newTab = re(lead + #"(?:open )?(?:a )?new tab"# + tail)
    static let closeTab = re(lead + #"close (?:this|the|that) tab"# + tail)
    static let pause = re(lead + #"(?:pause(?: the)?(?: music| song| spotify| video| it)?|(?:resume|play|unpause)(?: the)? (?:music|song|spotify))"# + tail)
    static let nextSong = re(lead + #"(?:next|skip(?: this)?) (?:song|track)"# + tail)
    static let previousSong = re(lead + #"(?:previous|last) (?:song|track)"# + tail)
    static let open = re(lead + #"(?:open(?: up)?|launch|start|switch to|bring up) (?:the |my |up )?(.{2,40}?)(?: app| application| folder)?"# + tail)

    /// The command for a fixed phrase, or nil when the words need the model. `open X` is returned
    /// unresolved: the caller acts on it only when X is an app, a folder or a site it can name.
    public static func match(_ text: String) -> ActionCommand? {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, t.count <= 80 else { return nil }
        let range = NSRange(location: 0, length: (t as NSString).length)
        func group(_ m: NSTextCheckingResult, _ i: Int) -> String { (t as NSString).substring(with: m.range(at: i)).lowercased() }
        if let m = scroll.firstMatch(in: t, range: range) { return .scroll(group(m, 2) == "up" ? .up : .down) }
        if let m = scrollEnd.firstMatch(in: t, range: range) {
            let end = group(m, 1)
            return .scroll(end == "top" || end == "beginning" || end == "start" ? .top : .bottom)
        }
        if back.firstMatch(in: t, range: range) != nil { return .browser(.back) }
        if forward.firstMatch(in: t, range: range) != nil { return .browser(.forward) }
        if reload.firstMatch(in: t, range: range) != nil { return .browser(.reload) }
        if newTab.firstMatch(in: t, range: range) != nil { return .browser(.newTab) }
        if closeTab.firstMatch(in: t, range: range) != nil { return .browser(.closeTab) }
        if nextSong.firstMatch(in: t, range: range) != nil { return .media(.next) }
        if previousSong.firstMatch(in: t, range: range) != nil { return .media(.previous) }
        if pause.firstMatch(in: t, range: range) != nil { return .media(.playPause) }
        if let m = open.firstMatch(in: t, range: range) {
            let target = (t as NSString).substring(with: m.range(at: 1)).trimmingCharacters(in: .whitespaces)
            let lower = target.lowercased()
            // pronouns and board asks ("open it", "open the page on pcr on the board") are the model's
            let pronouns: Set<String> = ["it", "this", "that", "them", "this one", "that one", "the page", "the link", "the email", "the file", "the pdf"]
            guard !pronouns.contains(lower), !lower.contains(" on the board"), !lower.contains(" about "), !lower.contains(" from "),
                  !lower.contains(" page on "), lower.split(separator: " ").count <= 4 else { return nil }
            return ActionTags.openCommand(target)
        }
        return nil
    }
}

/// "cmd+shift+t" as a key code and modifier flags (the US layout's codes).
public struct KeyChord: Equatable, Sendable {
    public let keyCode: UInt16
    public let command: Bool
    public let shift: Bool
    public let option: Bool
    public let control: Bool

    public static let codes: [String: UInt16] = [
        "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11, "q": 12, "w": 13, "e": 14, "r": 15,
        "y": 16, "t": 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22, "5": 23, "=": 24, "9": 25, "7": 26, "-": 27, "8": 28, "0": 29,
        "]": 30, "o": 31, "u": 32, "[": 33, "i": 34, "p": 35, "l": 37, "j": 38, "'": 39, "k": 40, ";": 41, "\\": 42, ",": 43, "/": 44,
        "n": 45, "m": 46, ".": 47, "`": 50,
        "return": 36, "enter": 36, "tab": 48, "space": 49, "delete": 51, "escape": 53, "esc": 53,
        "left": 123, "right": 124, "down": 125, "up": 126, "pageup": 116, "pagedown": 121, "home": 115, "end": 119,
    ]

    public static func parse(_ text: String) -> KeyChord? {
        let parts = text.lowercased().replacingOccurrences(of: " ", with: "").split(separator: "+").map(String.init)
        guard let keyName = parts.last, let code = codes[keyName] else { return nil }
        var command = false, shift = false, option = false, control = false
        for mod in parts.dropLast() {
            switch mod {
            case "cmd", "command", "⌘": command = true
            case "shift", "⇧": shift = true
            case "opt", "option", "alt", "⌥": option = true
            case "ctrl", "control", "⌃": control = true
            default: return nil
            }
        }
        return KeyChord(keyCode: code, command: command, shift: shift, option: option, control: control)
    }

    /// Return or Enter with no modifier: it submits whatever field has the keyboard.
    public var isPlainReturn: Bool { keyCode == 36 && !command && !shift && !option && !control }
}

/// His standing rule, in one place: what Dot never presses for him. The union of the agent gate's
/// words (ConsentPolicy) and the old drive list, plus the short forms both missed ("apply", "confirm").
public enum CommitGuard {
    static let words = try! NSRegularExpression(
        pattern: #"\b(send|submit|pay|buy|purchase|checkout|check out|place order|order now|delete|remove|erase|trash|empty trash|post|post it|publish|tweet|share|confirm|transfer|sign and|sign up|sign|apply|apply now|agree|accept|reply|forward|unsubscribe|cancel|shut ?down|restart|log ?out|sign ?out|format|overwrite|replace all|book|reserve|enroll|register|donate)\b"#,
        options: .caseInsensitive)

    public static func isCommit(_ label: String) -> Bool {
        words.firstMatch(in: label, range: NSRange(location: 0, length: (label as NSString).length)) != nil
    }

    /// Return in a field: allowed in a search field, never in one that could send (a message, a comment, a form).
    public static func returnAllowed(role: String?, subrole: String?, placeholder: String?) -> Bool {
        let r = (role ?? "").lowercased(), s = (subrole ?? "").lowercased(), p = (placeholder ?? "").lowercased()
        if r == "axsearchfield" || s == "axsearchfield" || r == "searchbox" || s.contains("search") { return true }
        return p.contains("search") && !p.contains("message") && !p.contains("reply")
    }
}
