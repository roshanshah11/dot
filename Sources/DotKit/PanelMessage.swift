import CoreGraphics
import Foundation

/// What the explainer panel's page sends Dot through the `dot` message handler (round eight; see docs/ui-language.md).
public enum PanelMessage: Equatable {
    /// He answered a quiz: the option's value, and whether it was right when the markup said what was right.
    case quiz(panel: String, id: String, choice: String, correct: Bool?, question: String = "", text: String = "")
    /// He tapped a follow-up chip or an `ask` button: a new question for Dot.
    case ask(panel: String, text: String)
    /// He selected text in the panel (to ask about it next), with the step it sits in (0 = none).
    case selection(panel: String, text: String, step: Int)
    /// He dragged or slid an explainer widget.
    case widget(panel: String, id: String, values: [String: Double])
    case close
    /// His minimize button (10-24: "give the panel a minimize option").
    case minimize
    case ready
    /// A page error, for dot.log.
    case log(String)
    /// His taps on a job's live page (parity J1/J2; the wire contract is in 02-jobs.md and docs/ui-language.md).
    /// `event` is the tap's own id (a repeat is dropped) and `version` the page version it was made on.
    case pageTick(panel: String, object: String, item: String, done: Bool, event: String, version: String)
    case pageForm(panel: String, object: String, fields: [String: String], event: String, version: String)
    case pageReview(panel: String, object: String, decisions: [PageDecision], event: String, version: String)
    case pageLetter(panel: String, object: String, proposal: String, send: Bool, event: String, version: String)

    public init?(_ body: Any) {
        guard let d = body as? [String: Any], let type = d["type"] as? String else { return nil }
        let panel = d["panel"] as? String ?? ""
        switch type {
        case "quiz":
            guard let id = d["id"] as? String else { return nil }
            let choice = (d["choice"] as? String) ?? (d["choice"].map { "\($0)" } ?? "")
            self = .quiz(panel: panel, id: id, choice: choice, correct: d["correct"] as? Bool,
                         question: String(((d["question"] as? String) ?? "").prefix(300)), text: String(((d["text"] as? String) ?? "").prefix(200)))
        case "ask":
            guard let text = (d["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { return nil }
            self = .ask(panel: panel, text: String(text.prefix(500)))
        case "selection":
            guard let text = (d["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { return nil }
            self = .selection(panel: panel, text: String(text.prefix(600)), step: (d["step"] as? NSNumber)?.intValue ?? 0)
        case "event":
            guard (d["kind"] as? String) == "viz", let data = d["data"] as? [String: Any], let id = data["id"] as? String else { return nil }
            var values: [String: Double] = [:]
            for (k, v) in (data["values"] as? [String: Any]) ?? [:] {
                if let n = v as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() { values[k] = n.doubleValue }
            }
            self = .widget(panel: (d["card"] as? String) ?? panel, id: id, values: values)
        case "page_tick", "page_form", "page_review", "page_letter":
            guard let object = Self.pageID(d["object"]), let event = Self.pageID(d["event"], max: 40) else { return nil }
            let version = String(((d["version"] as? String) ?? "").prefix(40))
            switch type {
            case "page_tick":
                guard let item = Self.pageID(d["item"]), let done = d["done"] as? Bool else { return nil }
                self = .pageTick(panel: panel, object: object, item: item, done: done, event: event, version: version)
            case "page_form":
                guard let raw = d["fields"] as? [String: Any] else { return nil }
                var fields: [String: String] = [:]
                for key in raw.keys.sorted().prefix(Self.pageMaxRows) {
                    guard let name = Self.pageID(key), let value = raw[key] as? String else { continue }
                    fields[name] = String(value.prefix(Self.pageMaxText))
                }
                self = .pageForm(panel: panel, object: object, fields: fields, event: event, version: version)
            case "page_review":
                guard let raw = d["decisions"] as? [[String: Any]] else { return nil }
                let decisions = raw.prefix(Self.pageMaxRows).compactMap { r -> PageDecision? in
                    guard let item = Self.pageID(r["item"]), let approve = r["approve"] as? Bool else { return nil }
                    return PageDecision(item: item, approve: approve, reason: String(((r["reason"] as? String) ?? "").prefix(Self.pageMaxText)))
                }
                self = .pageReview(panel: panel, object: object, decisions: decisions, event: event, version: version)
            default:
                guard let proposal = Self.pageID(d["proposal"], max: 80), let choice = d["choice"] as? String, ["send", "edit"].contains(choice) else { return nil }
                self = .pageLetter(panel: panel, object: object, proposal: proposal, send: choice == "send", event: event, version: version)
            }
        case "close": self = .close
        case "minimize": self = .minimize
        case "ready": self = .ready
        case "log": self = .log(String(((d["text"] as? String) ?? "").prefix(300)))
        default: return nil
        }
    }

    /// One line for the talk model's [context] block, or nil for messages that are not his words.
    public var contextLine: String? {
        switch self {
        case .quiz(_, let id, let choice, let correct, let question, let text):
            let verdict = correct.map { $0 ? "right" : "wrong" } ?? "ungraded"
            let asked = question.isEmpty ? "quiz \(id)" : "\"\(question)\" (quiz \(id))"
            return "he answered \(asked) on the panel with \(choice)" + (text.isEmpty ? "" : " \"\(text)\"") + " (\(verdict))"
        case .selection(_, let text, let step):
            return "he selected on the panel" + (step > 0 ? " (step \(step))" : "") + ": \"\(text)\""
        case .widget(_, let id, let values):
            let shown = values.keys.sorted().prefix(6).map { "\($0)=\(Self.trim(values[$0]!))" }.joined(separator: ", ")
            return "he set the \(id) explainer to \(shown)"
        case .ask, .close, .minimize, .ready, .log, .pageTick, .pageForm, .pageReview, .pageLetter:
            return nil
        }
    }

    /// Strings a page message may carry, and rows or fields per object.
    public static let pageMaxText = 2_000
    public static let pageMaxRows = 30

    /// An id on the page (t1, i3, f1, a proposal id): letters, digits, dash and underscore, starting with a letter or digit.
    static func pageID(_ raw: Any?, max: Int = 24) -> String? {
        guard let s = raw as? String, !s.isEmpty, s.count <= max,
              s.range(of: #"^[A-Za-z0-9][A-Za-z0-9_-]*$"#, options: .regularExpression) != nil else { return nil }
        return s
    }

    private static func trim(_ x: Double) -> String {
        let r = (x * 1000).rounded() / 1000
        return r == r.rounded() ? String(Int(r)) : String(r)
    }
}

/// Where the panel goes: docked to one side of the screen he is looking at, away from the marked content.
public enum PanelDock {
    public static let defaultWidth: CGFloat = 440
    public static let margin: CGFloat = 10

    /// The panel frame (AppKit, bottom-left origin) inside `visible` (a screen's visibleFrame). It docks right unless
    /// the content Dot marked (`avoid`) would sit under it and there is room on the left.
    public static func frame(in visible: CGRect, width: CGFloat = defaultWidth, avoid: CGRect? = nil) -> CGRect {
        let w = min(max(width, 320), max(320, visible.width * 0.6))
        let h = visible.height - 2 * margin
        let right = CGRect(x: visible.maxX - w - margin, y: visible.minY + margin, width: w, height: h)
        guard let avoid, avoid.intersects(right) else { return right }
        let left = CGRect(x: visible.minX + margin, y: visible.minY + margin, width: w, height: h)
        return avoid.intersects(left) ? right : left
    }

    /// The file name a saved panel gets: the date and a slug of its title.
    public static func fileName(title: String, date: Date, id: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        let slug = title.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }.prefix(6).joined(separator: "-")
        return "\(f.string(from: date))-\(slug.isEmpty ? id : slug).html"
    }
}

/// One row of a `<review>` he decided.
public struct PageDecision: Equatable {
    public let item: String
    public let approve: Bool
    public let reason: String
    public init(item: String, approve: Bool, reason: String = "") { self.item = item; self.approve = approve; self.reason = reason }
}
