import Foundation

/// VI-03: the situation he is in, so Dot can match it (the notch's idle word, the card look from
/// the token file, voice speed, a mode line in talk). Pure: the app passes in what it sees. The raw
/// values are the keys of the "modes" block in the board's token file, so they never change.
public enum ContextMode: String, CaseIterable, Codable, Sendable {
    case lecture, call, study, desk, normal

    /// In order: what he said ("pitch mode") wins, then a call, then the lecture ear, then a math or
    /// science lesson on the board (it sits over whatever app is in front), then the app in front.
    /// `url` is `ScreenContext.url`, the page a browser shows.
    public static func decide(onCall: Bool, lectureListening: Bool, bundleID: String?, windowTitle: String?,
                              url: String?, boardLesson: Bool, override: ContextMode?) -> ContextMode {
        if let override { return override }
        if onCall { return .call }
        if lectureListening { return .lecture }
        if boardLesson { return .study }
        return appMode(bundleID: bundleID, windowTitle: windowTitle, url: url)
    }

    /// The app alone: desk for Excel, PowerPoint and a filing in a PDF reader or browser; study for
    /// Canvas; normal otherwise.
    public static func appMode(bundleID: String?, windowTitle: String?, url: String?) -> ContextMode {
        if KnownApps.isExcel(bundleID) || KnownApps.isPowerPoint(bundleID) { return .desk }
        if isFiling(bundleID: bundleID, windowTitle: windowTitle, url: url) { return .desk }
        if isCanvas(url) { return .study }
        return .normal
    }

    // MARK: Filings and Canvas

    /// A form name with its hyphen ("10-K", "8-K/A", "DEF 14A"): safe in a browser title, where a bare
    /// "10K" is as likely a race or a follower count.
    static let strictForms = try! NSRegularExpression(pattern: #"(?i)(?<![a-z0-9])(?:10-K|10-Q|8-K|S-1|20-F|DEF ?14A)(?:/A)?(?![a-z0-9])"#)
    /// In a PDF reader, or a browser showing a .pdf, the hyphen is optional ("FY24 10K.pdf"): a pdf
    /// named that way is a filing.
    static let looseForms = try! NSRegularExpression(pattern: #"(?i)(?<![a-z0-9$])(?:10-?K|10-?Q|8-?K|S-1|20-?F|DEF ?14A)(?:/A)?(?![a-z0-9])"#)

    /// A 10-K, 10-Q, 8-K, S-1, 20-F or DEF 14A: an EDGAR page by its url (sec.gov/Archives, or the
    /// inline viewer at sec.gov/ix?doc=/Archives), or the form named in the title of a PDF reader
    /// or browser window. A title in Word or Mail ("re: the 10-K") is not a filing on screen.
    public static func isFiling(bundleID: String?, windowTitle: String?, url: String?) -> Bool {
        if let url = url?.lowercased(), url.contains("sec.gov/archives/") || url.contains("sec.gov/ix?doc=/archives/") { return true }
        guard let title = windowTitle, !title.isEmpty else { return false }
        let range = NSRange(location: 0, length: (title as NSString).length)
        let pdf = KnownApps.isPDFReader(bundleID) || KnownApps.isBrowser(bundleID) && title.lowercased().contains(".pdf")
        if pdf { return looseForms.firstMatch(in: title, range: range) != nil }
        if KnownApps.isBrowser(bundleID) { return strictForms.firstMatch(in: title, range: range) != nil }
        return false
    }

    /// His Canvas, canvas.uchicago.edu.
    public static func isCanvas(_ url: String?) -> Bool {
        host(of: url).map { $0 == "canvas.uchicago.edu" || $0.hasSuffix(".canvas.uchicago.edu") } ?? false
    }

    /// The lowercased host of a url, with or without its scheme.
    public static func host(of url: String?) -> String? {
        guard let url = url?.trimmingCharacters(in: .whitespacesAndNewlines), !url.isEmpty else { return nil }
        let full = url.contains("://") ? url : "https://" + url
        return URLComponents(string: full)?.host?.lowercased()
    }

    // MARK: The board

    /// Markers of math or science on a card: KaTeX display or inline delimiters other than a bare $
    /// (a dollar figure is not math), and the board's math and science pieces (JSXGraph, function
    /// plots, molecules, helices, sequences, SMILES, derivations). Gives `decide` its `boardLesson`.
    static let lessonMarkers = try! NSRegularExpression(pattern: #"\$\$|\\\(|\\\[|class=["'][^"']*\b(?:jsx|plot|molecule|helix|sequence|smiles|derivation)\b"#)

    public static func isMathOrScienceLesson(html: String) -> Bool {
        lessonMarkers.firstMatch(in: html, range: NSRange(location: 0, length: (html as NSString).length)) != nil
    }

    // MARK: Spoken overrides

    /// What a spoken mode phrase asks for: one mode until he says otherwise, or back to automatic.
    public enum Override: Equatable, Sendable {
        case force(ContextMode)
        /// "back to normal", "normal mode", "study mode off": drop the override and let `decide` choose.
        case automatic
    }

    /// The words he may say for each mode. "pitch" is desk: a pitch is built in Excel and PowerPoint.
    static let modeWords: [String: ContextMode] = [
        "pitch": .desk, "desk": .desk, "study": .study, "lecture": .lecture, "call": .call, "normal": .normal,
    ]

    /// The whole utterance is the mode phrase, with at most a short lead-in ("dot,", "switch to",
    /// "go into", "turn on") and a short tail ("on", "now", "please"). Anything more ("what mode is
    /// this", "is my phone in study mode", "switch the calculator to radian mode") is not a match.
    static let lead = #"^(?:(?:hey |ok(?:ay)?,? |alright,? )?dot[,.!]?\s+|ok(?:ay)?[,.]?\s+|alright[,.]?\s+)?(?:please\s+)?"#
    static let tail = #"(?:\s+(?:on|now|please))*[\s.!?]*$"#
    static let onWords = try! NSRegularExpression(pattern: lead + #"(?:(?:can you |could you )?(?:switch|change|go|get|move|flip)(?: back)? (?:in)?to |put me in(?:to)? |enter |turn on |start |use )?(?:the )?(pitch|desk|study|lecture|call|normal) mode"# + tail, options: .caseInsensitive)
    static let offWords = try! NSRegularExpression(pattern: lead + #"(?:(?:(?:go|switch|get|come) )?back to normal(?: mode)?|(?:turn off|exit|leave|stop|end|drop|cancel) (?:the )?(?:pitch|desk|study|lecture|call) mode|(?:pitch|desk|study|lecture|call) mode off)"# + tail, options: .caseInsensitive)

    public static func parseOverride(_ text: String) -> Override? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let ns = trimmed as NSString
        let range = NSRange(location: 0, length: ns.length)
        if offWords.firstMatch(in: trimmed, range: range) != nil { return .automatic }
        guard let match = onWords.firstMatch(in: trimmed, range: range),
              let mode = modeWords[ns.substring(with: match.range(at: 1)).lowercased()] else { return nil }
        return mode == .normal ? .automatic : .force(mode)
    }
}

/// Bundle ids Dot keys behaviour on. Excel, PowerPoint, Preview, Comet and Safari were read from
/// their Info.plists (CFBundleIdentifier) on 2026-10-17; ids compare without case.
public enum KnownApps {
    public static let excel = "com.microsoft.Excel"
    public static let powerPoint = "com.microsoft.Powerpoint"
    public static let preview = "com.apple.Preview"
    public static let comet = "ai.perplexity.comet"
    public static let safari = "com.apple.Safari"

    /// Preview, plus the readers Navigator.pdfApps knows (none of them installed on this Mac).
    public static let pdfReaders: Set<String> = [preview, "net.sourceforge.skim-app.skim", "com.adobe.Reader", "com.adobe.Acrobat.Pro"]
    /// Comet and Safari are installed; Chrome, Arc, Firefox, Brave and Edge are their makers' ids,
    /// not installed here, so a browser he adds later is still a browser.
    public static let browsers: Set<String> = [comet, safari, "com.google.Chrome", "company.thebrowser.Browser",
                                               "org.mozilla.firefox", "com.brave.Browser", "com.microsoft.edgemac"]

    static let lowerPDFReaders = Set(pdfReaders.map { $0.lowercased() })
    static let lowerBrowsers = Set(browsers.map { $0.lowercased() })

    public static func isExcel(_ id: String?) -> Bool { id?.lowercased() == excel.lowercased() }
    public static func isPowerPoint(_ id: String?) -> Bool { id?.lowercased() == powerPoint.lowercased() }
    public static func isPDFReader(_ id: String?) -> Bool { id.map { lowerPDFReaders.contains($0.lowercased()) } ?? false }
    public static func isBrowser(_ id: String?) -> Bool { id.map { lowerBrowsers.contains($0.lowercased()) } ?? false }
}
