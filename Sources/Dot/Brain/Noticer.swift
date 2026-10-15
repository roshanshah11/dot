import AppKit
import DotKit
import Foundation

/// The proactive beat: when he switches to something that touches a deadline or a commitment
/// Atlas knows about, Dot says one quiet line beside the cursor. Jev decides whether the
/// window relates to any item (a fraction of a cent, no Claude call); strict cooldowns keep it rare.
@MainActor
final class Noticer {
    private let config: DotConfig
    private let atlas: AtlasBridge
    private let overlay: OverlayManager
    private let jev: Jev?
    private var lastNoticeAt = Date.distantPast
    private var noticed: [String: Date] = [:]
    private var debounce: DispatchWorkItem?
    private var lastKey = ""

    init(config: DotConfig, atlas: AtlasBridge, overlay: OverlayManager, jev: Jev?) {
        self.config = config
        self.atlas = atlas
        self.overlay = overlay
        self.jev = jev
    }

    func start() {
        if config.suggestions, jev != nil {
            titleTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
                Task { @MainActor in self?.pollDocument() }
            }
            Log.info("noticer: suggestions on, watching for documents")
        }
        guard config.proactiveNotices, jev != nil else {
            Log.info("noticer: off (\(config.proactiveNotices ? "no jev key" : "disabled in config"))")
            return
        }
        NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] note in
            guard let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
                  app.processIdentifier != ProcessInfo.processInfo.processIdentifier else { return }
            Task { @MainActor in self?.appChanged(app) }
        }
        Log.info("noticer: watching app switches against Atlas deadlines")
    }

    private func appChanged(_ app: NSRunningApplication) {
        debounce?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.consider(app) }
        debounce = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5, execute: work)
    }

    private func consider(_ app: NSRunningApplication) {
        guard let jev, let brief = atlas.brief else { return }
        guard Date().timeIntervalSince(lastNoticeAt) > Double(config.noticeCooldownMinutes) * 60 else { return }
        let items = Array((brief.deadlines(withinDays: 2) + brief.commitments.prefix(4)).prefix(8))
        guard !items.isEmpty else { return }
        let context = AccessibilityContext.capture(maxElements: 0, timeBudget: 0.15)
        let title = context.windowTitle ?? ""
        let key = "\(app.bundleIdentifier ?? app.localizedName ?? "?")|\(title.prefix(60))"
        guard key != lastKey else { return }
        lastKey = key
        var criteria: [String: String] = ["none": "nothing on screen relates to these items"]
        for (index, item) in items.enumerated() { criteria["i\(index + 1)"] = String(item.prefix(220)) }
        let state: [String: Any] = [
            "frontmost_app": app.localizedName ?? "", "window_title": String(title.prefix(160)), "url": context.url ?? "",
            "now": ISO8601DateFormatter().string(from: Date()),
        ]
        jev.evaluate("notice", state: state, questions: [
            "item": .choice(instructions: "The user just switched to this app and window. Does it clearly relate to one of these deadlines or commitments (the same firm, form, course or person)? Pick that item, else none.", criteria: criteria),
        ]) { [weak self] answers in
            guard let self, let choice = answers?["item"]?.choice, choice.choice != "none",
                  choice.probability >= 0.7, choice.confidence >= 0.55,
                  let index = Int(choice.choice.dropFirst()), items.indices.contains(index - 1) else { return }
            let item = items[index - 1]
            let itemKey = String(item.prefix(60))
            if let last = self.noticed[itemKey], Date().timeIntervalSince(last) < 4 * 3600 { return }
            self.noticed[itemKey] = Date()
            self.lastNoticeAt = Date()
            let line = Self.line(for: item)
            Log.info("notice: \(app.localizedName ?? "?") -> \(Log.short(item, 80))")
            self.overlay.greet(line, for: 9)
        }
    }

    // MARK: Suggestions in context
    // His ask 2026-10-15: "suggestions actually aren't bad. not just for the morning, but like have it
    // be on where if i go to a new pdf it might suggest something". A new document in front (a pdf,
    // slides, a problem set, a paper) gets one quiet offer beside the cursor; "yes" runs it, "no" is
    // remembered, and a kind he has turned down three times stops being offered.

    struct Suggestion {
        let kind: String
        let line: String
        let ask: String
    }

    var onSuggest: ((Suggestion) -> Void)?
    private var titleTimer: Timer?
    private var lastDocKey = ""
    private var lastSuggestAt = Date.distantPast
    private static let documentWords = try! NSRegularExpression(pattern: #"(?i)\.pdf\b|\.pptx?\b|\.docx?\b|\blecture\b|\bslides?\b|\bproblem set\b|\bpset\b|\bhomework\b|\bchapter\b|\bsyllabus\b|arxiv|\bpaper\b|\breading\b|\bworksheet\b|\bexam\b|\bmidterm\b|canvas\.uchicago|\.edu/.*\.pdf"#)

    private func pollDocument() {
        guard config.suggestions, jev != nil else { return }
        let context = AccessibilityContext.capture(maxElements: 0, timeBudget: 0.12)
        let title = context.windowTitle ?? ""
        let url = context.url ?? ""
        let key = "\(context.appName ?? "")|\(title.prefix(80))|\(url.prefix(80))"
        guard key != lastDocKey else { return }
        lastDocKey = key
        let probe = title + " " + url
        guard Self.documentWords.firstMatch(in: probe, range: NSRange(location: 0, length: (probe as NSString).length)) != nil else { return }
        guard Date().timeIntervalSince(lastSuggestAt) > Double(config.suggestionCooldownMinutes) * 60 else { return }
        suggest(app: context.appName ?? "", title: title, url: url)
    }

    private func suggest(app: String, title: String, url: String) {
        guard let jev else { return }
        var criteria = ["none": "nothing; he is browsing, working, or this is not something he studies from"]
        if Self.allowed("gist") { criteria["gist"] = "a one-minute gist: what this document is and its three main points, on a card" }
        if Self.allowed("find") { criteria["find"] = "find the part of this document that today's lecture or an upcoming deadline is about" }
        if Self.allowed("quiz") { criteria["quiz"] = "a few quick questions on this document once he has read it" }
        guard criteria.count > 1 else { return }
        var state: [String: Any] = ["frontmost_app": app, "window_title": String(title.prefix(160)), "url": String(url.prefix(200)),
                                    "now": ISO8601DateFormatter().string(from: Date())]
        if let brief = atlas.brief { state["deadlines"] = Array(brief.deadlines(withinDays: 14).prefix(6)) }
        jev.evaluate("suggest", state: state, questions: [
            "offer": .choice(instructions: "The user just opened this document. Would one of these help right now? Pick the single most useful, else none.", criteria: criteria),
        ]) { [weak self] answers in
            guard let self, let choice = answers?["offer"]?.choice, choice.choice != "none",
                  choice.probability >= 0.6, choice.confidence >= 0.5 else { return }
            let kind = choice.choice
            let line: String, ask: String
            switch kind {
            case "gist":
                line = "want the gist of this? say yes."
                ask = "give me the gist of what's on my screen: what this document is and its three main points, on a card, then stop."
            case "find":
                line = "want me to find today's part in this? say yes."
                ask = "find the part of this document that today's lecture or my nearest deadline is about, point me to it, and say what it covers."
            default:
                line = "quiz me on this later? say yes."
                ask = "ask me three quick questions about what's on my screen, one at a time, and grade each answer."
            }
            self.lastSuggestAt = Date()
            Log.info("suggest: \(kind) for \(Log.short(title, 60)) (\(String(format: "%.2f", choice.probability)))")
            self.overlay.greet(line, for: 12)
            self.onSuggest?(Suggestion(kind: kind, line: line, ask: ask))
        }
    }

    /// Yes/no history per kind; three declines with no acceptance retire a kind.
    static func record(kind: String, accepted: Bool) {
        let key = "dot.suggest.\(kind).\(accepted ? "yes" : "no")"
        UserDefaults.standard.set(UserDefaults.standard.integer(forKey: key) + 1, forKey: key)
        Log.info("suggest: \(kind) \(accepted ? "accepted" : "declined")")
    }

    static func allowed(_ kind: String) -> Bool {
        let yes = UserDefaults.standard.integer(forKey: "dot.suggest.\(kind).yes")
        let no = UserDefaults.standard.integer(forKey: "dot.suggest.\(kind).no")
        return yes > 0 || no < 3
    }

    /// "heads up: centerview coffee chats, due 2026-10-15." from a deadline line that starts with its date.
    static func line(for item: String) -> String {
        var text = item
        var due = ""
        if text.count >= 10, text.prefix(4).allSatisfy(\.isNumber) {
            due = String(text.prefix(10))
            text = String(text.dropFirst(10)).trimmingCharacters(in: .whitespaces)
        }
        let head = text.split(separator: ":").first.map(String.init) ?? text
        let short = String(head.prefix(80)).lowercased()
        return due.isEmpty ? "heads up, this one is open: \(short)." : "heads up: \(short), due \(due)."
    }
}
