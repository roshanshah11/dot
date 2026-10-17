import AppKit
import DotKit

/// Talk's side of the explainer panel (round eight): pulls `[PANEL]` blocks out of the streamed answer and into the
/// panel, keeps what he does on the panel (a selection, a quiz answer, a dragged widget) for the next turn's context,
/// and answers "close it" and "show the kernel one again". Talk calls it at a handful of points; everything else
/// about panels lives here and in ExplainerPanel.
@MainActor
final class PanelCoach {
    let panel: ExplainerPanel
    private var stream = PanelStream()
    private(set) var openedThisTurn = false
    private var openedAt: Date?
    private var lastSelection: (text: String, step: Int, at: Date)?
    private var lastWidget: (line: String, at: Date)?
    private var stepCount = 0
    /// Where a new panel should go: the screen he is on and the content Dot is marking (AppKit).
    var placement: () -> (NSScreen?, CGRect?) = { (NSScreen.main, nil) }
    /// A chip or `ask` button: a new question, as if he typed it.
    var onAsk: ((String) -> Void)?
    /// A quiz answer: one line for the model to grade and go on.
    var onQuiz: ((String) -> Void)?
    /// What names the course right now: the window title, its URL and his question.
    var courseContext: () -> String = { "" }
    /// His course maps (~/Dot/talk/context), for filing panels by course.
    var courses: [CourseTag] = []

    init(accentHex: String) {
        panel = ExplainerPanel(accentHex: accentHex)
        panel.onMessage = { [weak self] message in self?.received(message) }
    }

    var available: Bool { panel.available }
    var isOpen: Bool { panel.isOpen }

    // MARK: The turn

    func beginTurn() {
        stream = PanelStream()
        openedThisTurn = false
    }

    /// One streamed delta in; the part that is not panel markup out (for the beat streamer).
    func filter(_ delta: String) -> String { apply(stream.feed(delta)) }

    /// The turn ended: anything held comes out, an unclosed panel closes.
    func endTurn() -> String { apply(stream.finish()) }

    private func apply(_ events: [PanelStream.Event]) -> String {
        var spoken = ""
        for event in events {
            switch event {
            case .text(let t): spoken += t
            case .open(let id, let title):
                guard panel.available else { continue }
                let (screen, avoid) = placement()
                panel.open(id: id, title: title, markup: "", screen: screen, avoid: avoid)
                openedThisTurn = true
                openedAt = Date()
                stepCount = 0
            case .chunk(let c):
                if panel.available { panel.append(c) }
                stepCount += c.components(separatedBy: "<step ").count - 1
            case .close:
                if panel.available { panel.finish(course: courseOf) }
            }
        }
        return spoken
    }

    func setStep(_ n: Int) { panel.setStep(n) }

    func close() { panel.close() }

    /// "show the kernel one again": reopen a saved explanation; false when nothing matches.
    func reopen(_ words: String) -> Bool { panel.reopen(matching: words, screen: placement().0) }

    /// Open a saved or hand-written UI-language file (`Dot --panel file.ui`).
    func showFile(_ path: String) {
        let url = URL(fileURLWithPath: DotConfig.expand(path))
        guard let text = try? String(contentsOf: url, encoding: .utf8) else { Log.warn("panel: cannot read \(path)"); return }
        let (screen, avoid) = placement()
        panel.open(id: url.deletingPathExtension().lastPathComponent, title: url.deletingPathExtension().lastPathComponent.replacingOccurrences(of: "-", with: " "),
                   markup: text, screen: screen, avoid: avoid)
        panel.finish(course: courseOf)
    }

    /// The course code an explanation belongs to: named on screen or in his question, else by its words.
    private func courseOf(_ content: String) -> String? {
        CourseTag.detect(context: courseContext(), content: content, among: courses)?.code
    }

    // MARK: What he does on the panel

    private func received(_ message: PanelMessage) {
        switch message {
        case .ask(_, let text):
            Log.info("panel: chip asks \"\(Log.short(text, 80))\"")
            onAsk?(text)
        case .quiz:
            if let line = message.contextLine { Log.info("panel: \(line)"); onQuiz?(line) }
        case .selection(_, let text, let step):
            lastSelection = (text, step, Date())
        case .widget:
            if let line = message.contextLine { lastWidget = (line, Date()) }
        case .close, .ready, .log:
            break
        }
    }

    /// Lines for the [context] block of the next turn.
    func contextLines() -> [String] {
        var lines: [String] = []
        if panel.isOpen, let id = panel.currentID {
            lines.append("panel: \"\(panel.currentTitle)\" is open (id \(id)\(stepCount > 0 ? ", \(stepCount) steps" : "")); a follow-up about it continues it")
        }
        if let s = lastSelection, Date().timeIntervalSince(s.at) < 180 {
            lines.append("he selected on the panel" + (s.step > 0 ? " (step \(s.step))" : "") + ": \"\(Log.short(s.text, 300))\"; \"this\" means that")
            lastSelection = nil
        }
        if let w = lastWidget, Date().timeIntervalSince(w.at) < 180 {
            lines.append(w.line)
            lastWidget = nil
        }
        let saved = ExplainerPanel.savedIndex()
        let f = DateFormatter(); f.dateFormat = "EEE MMM d, h:mm a"; f.locale = Locale(identifier: "en_US")
        if let course = CourseTag.detect(context: courseContext(), among: courses) {
            // per course: where he left off, for the recap when he comes back on another day
            let mine = saved.filter { $0.course == course.code }.suffix(6)
            if let last = mine.last {
                let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: last.created), to: Calendar.current.startOfDay(for: Date())).day ?? 0
                lines.append("\(course.label) panels so far, newest first: " + mine.reversed().map { "\($0.title) (\(f.string(from: $0.created)))" }.joined(separator: "; ")
                             + (days >= 1 ? "; last time was \(days == 1 ? "yesterday" : "\(days) days ago"): open a new panel in this course with a one-line \"last time\" recap" : ""))
            }
        } else if !saved.isEmpty {
            lines.append("recent panels: " + saved.suffix(5).reversed().map { "\($0.title) (\(f.string(from: $0.created)))" }.joined(separator: "; "))
        }
        return lines
    }

    // MARK: Routing words

    /// Words that ask for an explanation on the panel. "how do i ..." and "show me how to ..." are not here: those are
    /// on-screen walkthroughs, and "why is my agent stuck" is a status question.
    static let explainWords = try! NSRegularExpression(pattern: #"\b(explain|walk me through|teach me|visuali[sz](e|ation)|on the board|show me why|draw (it|this|me|out)|break (it|this) down|step by step|go deeper|in depth|prove|derive|derivation|the intuition|what does .{1,40} mean)\b"#, options: [.caseInsensitive])
    /// "explain this email to sam", "how do i ...", "show me how to ...", "click": not panel work even with an explain word.
    static let notPanelWords = try! NSRegularExpression(pattern: #"\b(how do i|how can i|how to|where (is|do i)|click|email|e-mail|reply|draft|send|agent|tab|window|button|setting|settings)\b"#, options: [.caseInsensitive])
    /// He names the panel: "close the panel", "hide the explanation".
    static let panelNameWords = try! NSRegularExpression(pattern: #"\b(panel|explanation|explainer)\b"#, options: [.caseInsensitive])
    /// "show the kernel one again", "reopen the panel", "bring back the explanation".
    static let reopenWords = try! NSRegularExpression(pattern: #"\b(show|bring back|reopen|open)\b.{0,40}\b(one|panel|explanation)\b.{0,12}\b(again|back)\b|\breopen (the )?(panel|explanation)\b"#, options: [.caseInsensitive])

    static func wantsPanel(_ text: String) -> Bool {
        let range = NSRange(location: 0, length: (text as NSString).length)
        return explainWords.firstMatch(in: text, range: range) != nil && notPanelWords.firstMatch(in: text, range: range) == nil
    }
    static func namesPanel(_ text: String) -> Bool {
        panelNameWords.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) != nil
    }
    /// A panel opened in the last two minutes is what a bare "close it" means.
    var openedRecently: Bool { openedAt.map { Date().timeIntervalSince($0) < 120 } ?? false }
    static func wantsReopen(_ text: String) -> Bool {
        reopenWords.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) != nil
    }
}
