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
