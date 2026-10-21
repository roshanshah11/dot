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
    /// Several steps on what is in front ("go to my applied jobs and search northwind"): Dot drives a
    /// walkthrough itself, one step at a time, and stops at the result.
    case go(goal: String)
    /// Music by name: Dot finds the top Spotify result for the words and starts it (05, 2026-10-20).
    case play(SpotifyPlay)

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
        case .play: return "play"
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
        case .play(let p): return "\(p.kind.rawValue):\(p.mine ? "my " : "")\(p.words)"
        }
    }

    /// The one short line Dot says when it worked.
    public var doneLine: String {
        switch self {
        case .open(let name): return "opened \(name.lowercased())."
        case .openURL(let url, _):
            if let query = SpotifySearch.query(fromURI: url) { return "searching spotify for \(query)." }
            return "opened \(URL(string: url)?.host ?? "it")."
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
        case .play: return "playing it."
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
        case "PLAY":
            return SpotifyPlay.command(text)
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
        if lower.hasPrefix("spotify:search:") { return SpotifySearch.command(String(t.dropFirst("spotify:search:".count))) }
        if t.hasPrefix("/") || t.hasPrefix("~") { return .openPath(t) }
        // "the folder /tmp/x", "file ~/notes.txt": the path is the target
        if let path = t.split(separator: " ").first(where: { $0.hasPrefix("/") || $0.hasPrefix("~/") }) { return .openPath(String(path)) }
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
    static let pause = re(lead + #"(?:pause|resume|play|unpause)(?: the| my)? (?:music|song|spotify|video|podcast)"# + tail)
    static let nextSong = re(lead + #"(?:next|skip(?: this)?) (?:song|track)"# + tail)
    static let previousSong = re(lead + #"(?:previous|last) (?:song|track)"# + tail)
    static let open = re(lead + #"(?:open(?: up)?|launch|switch to|bring up) (?:the |my |up )?(.{2,40}?)(?: app| application| folder)?"# + tail)
    /// "play lofi on spotify", "find a piano playlist on spotify", "search spotify for taylor swift" (2026-10-19 09:57:
    /// he asked for a piano playlist, Dot pasted into Finder, then only opened Spotify).
    static let spotify = re(lead + #"(?:play|put on|find|search(?: for)?|look up|pull up|queue(?: up)?|get)(?: me)?(?: some| a| an| the| my)? (.{2,60}?) (?:on|in|from) spotify"# + tail)
    static let spotifyFor = re(lead + #"search spotify for (.{2,60}?)"# + tail)
    /// His own ways of asking for music by name, which play it (05): "play lofi on spotify", "put on a jazz playlist",
    /// "open spotify to a piano playlist for studying", "find piano playlist i would like need to study".
    static let purpose = #"( (?:for|to) (?:study(?:ing)?|work(?:ing)?|focus(?:ing)?|sleep(?:ing)?|reading|running|the gym|chill(?:ing)?))?"#
    /// "my" stays in the words (SpotifyPlay.make makes it `mine`): "play my road trip playlist" is his own playlist, and on
    /// 2026-10-21 dropping it here played a stranger's public one.
    static let playOnSpotify = re(lead + #"(?:play|put on|queue(?: up)?)(?: me)?(?: some| a| an| the)? (.{2,60}?) (?:on|in|from) spotify"# + tail)
    static let playPlaylist = re(lead + #"(?:play|put on|queue(?: up)?)(?: me)?(?: some| a| an| the)? (.{2,50}?) playlist(?:s)?"# + purpose + tail)
    static let openSpotifyTo = re(lead + #"(?:open|launch|start) spotify (?:to|and play|with|on|for) (?:some |a |an |the )?(.{2,60}?)"# + tail)
    /// "play my liked songs", "put on my saved songs on spotify": his Liked Songs.
    static let playLiked = re(lead + #"(?:play|put on|shuffle|queue(?: up)?)(?: me)?(?: my| the)? (?:liked|saved|favou?rite) (?:songs|tracks|music)(?: (?:on|in|from) spotify)?"# + tail)
    static let findPlaylist = re(lead + #"find (?:a |me a |me |some |me some )?(.{2,40}?) playlists?\b(.{0,50})$"#)

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
        if let m = spotifyFor.firstMatch(in: t, range: range) {
            return SpotifySearch.command((t as NSString).substring(with: m.range(at: 1)))
        }
        if playLiked.firstMatch(in: t, range: range) != nil {
            return .play(SpotifyPlay(kind: .playlist, words: "liked songs", mine: true))
        }
        // Music by name plays (05); "search", "look up" and "pull up" on spotify stay the search page.
        if let m = playOnSpotify.firstMatch(in: t, range: range) {
            return SpotifyPlay.command((t as NSString).substring(with: m.range(at: 1)), defaultKind: .playlist)
        }
        if let m = playPlaylist.firstMatch(in: t, range: range) {
            // the purpose stays in the words: "piano for studying" finds study playlists
            let purposeRange = m.range(at: 2)
            let words = (t as NSString).substring(with: m.range(at: 1)) + (purposeRange.location == NSNotFound ? "" : (t as NSString).substring(with: purposeRange))
            return SpotifyPlay.make(.playlist, words).map { .play($0) }
        }
        if let m = openSpotifyTo.firstMatch(in: t, range: range) {
            return SpotifyPlay.command((t as NSString).substring(with: m.range(at: 1)), defaultKind: .playlist)
        }
        if let m = findPlaylist.firstMatch(in: t, range: range) {
            let words = (t as NSString).substring(with: m.range(at: 1))
            return SpotifyPlay.make(.playlist, words).map { .play($0) }
        }
        if let m = spotify.firstMatch(in: t, range: range) {
            return SpotifySearch.command((t as NSString).substring(with: m.range(at: 1)))
        }
        if let m = open.firstMatch(in: t, range: range) {
            let target = (t as NSString).substring(with: m.range(at: 1)).trimmingCharacters(in: .whitespaces)
            let lower = target.lowercased()
            // pronouns and board asks ("open it", "open the page on pcr on the board") are the model's
            let pronouns: Set<String> = ["it", "this", "that", "them", "this one", "that one", "the page", "the link", "the email", "the file", "the pdf",
                                         "board", "the board", "panel", "the panel", "card", "the card", "home", "dot", "again", "up", "the", "a", "an", "my"]
            let letters = lower.filter { $0.isLetter }
            guard letters.count >= 3, !pronouns.contains(lower.trimmingCharacters(in: CharacterSet.punctuationCharacters)), !lower.contains(" on the board"), !lower.contains(" about "), !lower.contains(" from "),
                  !lower.contains(" page on "), lower.split(separator: " ").count <= 4 else { return nil }
            return ActionTags.openCommand(target)
        }
        return nil
    }
}

/// Music by name (05): the kind and the words; Dot finds the top Spotify result on open.spotify.com in a logged-out
/// headless browser and starts it through Spotify's own AppleScript. Spotify's AppleScript has no search, and its window
/// gives accessibility one element, which is why the 10-19 ask pasted into Finder. A playlist is looked for in his own
/// library first (SpotifyLibrary); "my" (`mine`) looks only there (2026-10-21).
public struct SpotifyPlay: Equatable, Sendable {
    public enum Kind: String, Equatable, Sendable, CaseIterable { case playlist, track, album, artist }
    public let kind: Kind
    public let words: String
    /// He said "my": one of his own playlists, never a stranger's public one.
    public let mine: Bool

    public init(kind: Kind, words: String, mine: Bool = false) {
        self.kind = kind
        self.words = words
        self.mine = mine
    }

    static let vague: Set<String> = ["music", "something", "anything", "a song", "songs", "my music", "it", "some music", "spotify"]

    /// A trimmed kind and words; nil when nothing is left to look for. A leading "my" is his library ("my road trip").
    public static func make(_ kind: Kind, _ raw: String) -> SpotifyPlay? {
        var words = raw.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: "\"'.,!?")))
        var mine = false
        if words.lowercased() == "my" || words.lowercased().hasPrefix("my ") {
            mine = true
            words = String(words.dropFirst(2)).trimmingCharacters(in: .whitespaces)
        }
        guard words.contains(where: { $0.isLetter || $0.isNumber }), words.count <= 80 else { return nil }
        return SpotifyPlay(kind: kind, words: words, mine: mine)
    }

    /// `[PLAY:kind:words]` or `[PLAY:words]`, or a phrase's words: "music" or "something" is play/pause, a song word
    /// makes it a track.
    public static func command(_ payload: String, defaultKind: Kind = .playlist) -> ActionCommand? {
        var text = payload.trimmingCharacters(in: .whitespacesAndNewlines)
        var kind = defaultKind
        if let colon = text.firstIndex(of: ":"), let k = Kind(rawValue: text[..<colon].lowercased().trimmingCharacters(in: .whitespaces)) {
            kind = k
            text = String(text[text.index(after: colon)...])
        } else {
            let lower = text.lowercased()
            if vague.contains(lower.trimmingCharacters(in: CharacterSet(charactersIn: " .!?"))) { return .media(.playPause) }
            for (word, k) in [(" song", Kind.track), (" track", .track), (" album", .album), (" playlist", .playlist)] where lower.hasSuffix(word) {
                kind = k
                text = String(text.dropLast(word.count))
            }
        }
        if vague.contains(text.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: " .!?"))) { return .media(.playPause) }
        return make(kind, text).map { .play($0) }
    }

    /// The hit lines `dot-spotify.sh find` prints: `spotify:<kind>:<22-char id><TAB><title>`; bad ids are dropped, and
    /// duplicates collapse.
    public static func hits(_ output: String) -> [(uri: String, title: String)] {
        var seen = Set<String>()
        var out: [(String, String)] = []
        for line in output.split(separator: "\n") {
            let parts = line.split(separator: "\t", maxSplits: 1).map(String.init)
            guard let uri = parts.first, uri.range(of: #"^spotify:(playlist|track|album|artist):[A-Za-z0-9]{22}$"#, options: .regularExpression) != nil,
                  !seen.contains(uri) else { continue }
            seen.insert(uri)
            out.append((uri, parts.count > 1 ? parts[1] : ""))
        }
        return out
    }
}

/// Spotify's own search page, opened by its URI: the app shows the results for the words with no clicking. Its
/// window gives accessibility one element, so typing into its search box never worked.
public enum SpotifySearch {
    public static let prefix = "spotify:search:"

    /// The open command for the words, or nil when nothing is left to search for.
    public static func command(_ words: String) -> ActionCommand? {
        let query = words.removingPercentEncoding ?? words
        let clean = query.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: "\"'.,!?")))
        guard clean.contains(where: { $0.isLetter || $0.isNumber }) else { return nil }
        // "play music on spotify" is play, not a search for the word music
        if ["music", "something", "anything", "a song", "songs", "my music", "it"].contains(clean.lowercased()) { return .media(.playPause) }
        guard let encoded = clean.addingPercentEncoding(withAllowedCharacters: .alphanumerics) else { return nil }
        return .openURL(prefix + encoded, newTab: false)
    }

    /// The words of a search URI, for the spoken line; nil for anything else.
    public static func query(fromURI uri: String) -> String? {
        guard uri.lowercased().hasPrefix(prefix) else { return nil }
        let rest = String(uri.dropFirst(prefix.count))
        return rest.removingPercentEncoding ?? rest
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
    /// Return with any modifier is still Return (cmd+return sends a mail draft).
    public var isReturn: Bool { keyCode == 36 }

    /// The only chords Dot presses itself: moving around and the browser's own keys. A letter or a symbol could
    /// archive or delete in a mail app, cmd+q quits, cmd+delete deletes (the basics review, 2026-10-18).
    /// True for the browser chords (cmd+f/l/t/[/]/r, cmd+shift+t): Dot presses those only in a browser.
    public var isBrowserChord: Bool { command && [3, 37, 17, 33, 30, 15].contains(keyCode) }

    public var isAllowedForDot: Bool {
        // arrows, page, home/end, tab, escape; never space (it presses a focused button) or a bare letter (mail shortcuts)
        let movement: Set<UInt16> = [123, 124, 125, 126, 116, 121, 115, 119, 48, 53]
        if isReturn { return true }   // judged by the field it lands in
        if !command, !option, !control, movement.contains(keyCode) { return true }
        if command, !option, !control {
            // cmd+f find, cmd+l address bar, cmd+t new tab, cmd+[ back, cmd+] forward, cmd+r reload; cmd+shift+t reopens a tab
            let browser: Set<UInt16> = [3, 37, 17, 33, 30, 15]
            if browser.contains(keyCode) { return !shift || keyCode == 17 }
        }
        return false
    }
}

/// His standing rule, in one place: what Dot never presses for him. The union of the agent gate's
/// words (ConsentPolicy) and the old drive list, plus the short forms both missed ("apply", "confirm").
public enum CommitGuard {
    static let words = try! NSRegularExpression(
        pattern: #"\b(send|submit|pay|buy|purchase|checkout|check out|place order|order now|delete|remove|erase|trash|empty trash|post|post it|publish|tweet|share|confirm|transfer|sign and|sign up|sign|apply|apply now|agree|accept|reply|forward|unsubscribe|cancel|shut ?down|restart|log ?out|sign ?out|format|overwrite|replace all|book|reserve|enroll|register|donate|place your order|decline|withdraw|connect|turn in|start quiz|take the quiz|begin quiz|rsvp|follow|invite|join|accept invitation|merge|deploy|publish)\b"#,
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
