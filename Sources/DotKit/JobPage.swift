import Foundation

/// A job's live page (parity J1): `page.md` in the job's folder, written by the job in Dot's UI language while it works
/// and its answer when it ends. Dot reads it for the window, the chip's headline and the controls he can use: every
/// interactive object (`<todo>`, `<form>`, `<review>`, `<letter>`) has an id, and a page whose ids repeat is refused
/// (a tap must name exactly one thing).
public struct JobPage: Equatable {
    public struct Object: Equatable {
        public enum Kind: String, Equatable { case todo, form, review, letter }
        public let kind: Kind
        public let id: String
        /// The object's own attributes (title, submit, proposal).
        public let attributes: [String: String]
        /// Rows by id: a todo's or a review's items (their text), or a form's fields (their labels).
        public let rows: [(id: String, text: String)]

        public static func == (a: Object, b: Object) -> Bool {
            a.kind == b.kind && a.id == b.id && a.attributes == b.attributes && a.rows.map(\.id) == b.rows.map(\.id) && a.rows.map(\.text) == b.rows.map(\.text)
        }

        public func row(_ id: String) -> String? { rows.first { $0.id == id }?.text }
    }

    public let markup: String
    /// Changes whenever the text does (taps carry it; a repeat on the same version is dropped).
    public let version: String
    public let headline: String
    /// The `<status>` run line, if the page has one.
    public let status: String
    public let objects: [Object]

    public static let maxBytes = 256 * 1024

    public enum Problem: Error, Equatable, CustomStringConvertible {
        case tooBig(Int)
        case repeatedIDs([String])
        public var description: String {
            switch self {
            case .tooBig(let n): return "page.md is \(n / 1024) KB (the cap is \(JobPage.maxBytes / 1024) KB)"
            case .repeatedIDs(let ids): return "page ids repeat: \(ids.joined(separator: ", "))"
            }
        }
    }

    public func object(_ id: String) -> Object? { objects.first { $0.id == id } }

    public static func parse(_ text: String) -> Result<JobPage, Problem> {
        let bytes = text.utf8.count
        guard bytes <= maxBytes else { return .failure(.tooBig(bytes)) }
        var objects: [Object] = []
        var seen: [String: Int] = [:]
        for match in openTag.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
            guard let kindRange = Range(match.range(at: 1), in: text), let kind = Object.Kind(rawValue: String(text[kindRange]).lowercased()),
                  let attrRange = Range(match.range(at: 2), in: text) else { continue }
            let attributes = attrs(String(text[attrRange]))
            guard let id = attributes["id"], !id.isEmpty else { continue }   // no id: rendered inert, nothing to tap
            seen[id, default: 0] += 1
            // the object's body: up to its own closing tag (objects of one kind never nest)
            let after = text[Range(match.range, in: text)!.upperBound...]
            let body = after.range(of: "</\(kind.rawValue)>", options: .caseInsensitive).map { String(after[..<$0.lowerBound]) } ?? ""
            var rows: [(String, String)] = []
            switch kind {
            case .todo, .review:
                for item in itemTag.matches(in: body, range: NSRange(body.startIndex..., in: body)) {
                    guard let a = Range(item.range(at: 1), in: body), let t = Range(item.range(at: 2), in: body),
                          let rid = attrs(String(body[a]))["id"], !rid.isEmpty else { continue }
                    rows.append((rid, plain(String(body[t]))))
                }
            case .form:
                for field in fieldTag.matches(in: body, range: NSRange(body.startIndex..., in: body)) {
                    guard let a = Range(field.range(at: 1), in: body) else { continue }
                    let fa = attrs(String(body[a]))
                    guard let name = fa["name"], !name.isEmpty else { continue }
                    rows.append((name, fa["label"] ?? name))
                }
            case .letter:
                break   // its words come from the proposal store, never from the page
            }
            let rowIDs = rows.map(\.0)
            for rid in Set(rowIDs) where rowIDs.filter({ $0 == rid }).count > 1 { seen["\(id)/\(rid)", default: 0] += 2 }
            objects.append(Object(kind: kind, id: id, attributes: attributes, rows: Array(rows.prefix(PanelMessage.pageMaxRows)).map { (id: $0.0, text: $0.1) }))
        }
        let repeated = seen.filter { $0.value > 1 }.keys.sorted()
        guard repeated.isEmpty else { return .failure(.repeatedIDs(repeated)) }
        let headline = first(lead, in: text) ?? first(title, in: text) ?? text.split(separator: "\n").map { plain(String($0)) }.first { !$0.isEmpty } ?? ""
        return .success(JobPage(markup: text, version: Self.version(of: text), headline: String(headline.prefix(140)),
                                status: String((first(statusTag, in: text) ?? "").prefix(140)), objects: objects))
    }

    /// FNV-1a over the bytes, as hex: a version that changes whenever the page does.
    public static func version(of text: String) -> String {
        var h: UInt64 = 0xcbf29ce484222325
        for b in text.utf8 { h = (h ^ UInt64(b)) &* 0x100000001b3 }
        return String(h, radix: 16)
    }

    private static let openTag = try! NSRegularExpression(pattern: #"<(todo|form|review|letter)\b([^>]*)>"#, options: [.caseInsensitive])
    private static let itemTag = try! NSRegularExpression(pattern: #"<item\b([^>]*)>([\s\S]*?)</item>"#, options: [.caseInsensitive])
    private static let fieldTag = try! NSRegularExpression(pattern: #"<field\b([^>]*)/?>"#, options: [.caseInsensitive])
    private static let lead = try! NSRegularExpression(pattern: #"<lead\b[^>]*>([\s\S]*?)</lead>"#, options: [.caseInsensitive])
    private static let title = try! NSRegularExpression(pattern: #"<title\b[^>]*>([\s\S]*?)</title>"#, options: [.caseInsensitive])
    private static let statusTag = try! NSRegularExpression(pattern: #"<status\b[^>]*>([\s\S]*?)</status>"#, options: [.caseInsensitive])
    private static let attr = try! NSRegularExpression(pattern: #"([A-Za-z_][\w-]*)\s*=\s*"([^"]*)""#)

    static func attrs(_ text: String) -> [String: String] {
        var out: [String: String] = [:]
        for m in attr.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
            if let k = Range(m.range(at: 1), in: text), let v = Range(m.range(at: 2), in: text) { out[String(text[k]).lowercased()] = String(text[v]) }
        }
        return out
    }

    private static func first(_ re: NSRegularExpression, in text: String) -> String? {
        guard let m = re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)), let r = Range(m.range(at: 1), in: text) else { return nil }
        let s = plain(String(text[r]))
        return s.isEmpty ? nil : s
    }

    /// Text without tags, whitespace folded.
    static func plain(_ s: String) -> String {
        s.replacingOccurrences(of: #"<[^>]*>"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"^#+\s*"#, with: "", options: .regularExpression)
            .split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}

/// His tap on a page, checked against the page it was made on, as the line the job reads (J2). nil when the tap
/// names nothing on the page (a stale or forged tap), so nothing reaches the job.
public enum PageTurn {
    public static func message(_ tap: PanelMessage, page: JobPage) -> String? {
        switch tap {
        case .pageTick(_, let object, let item, let done, _, _):
            guard let o = page.object(object), o.kind == .todo, let text = o.row(item) else { return nil }
            return "[page] he \(done ? "ticked" : "unticked") \"\(Self.short(text))\" (\(object) \(item))"
        case .pageForm(_, let object, let fields, _, _):
            guard let o = page.object(object), o.kind == .form else { return nil }
            let known = o.rows.filter { fields[$0.id] != nil }
            guard !known.isEmpty else { return nil }
            let name = o.attributes["title"].map { " \"\(Self.short($0))\"" } ?? ""
            return "[page] he filled the form\(name) (\(object)): " + known.map { "\($0.id)=\"\(fields[$0.id]!)\"" }.joined(separator: ", ")
        case .pageReview(_, let object, let decisions, _, _):
            guard let o = page.object(object), o.kind == .review else { return nil }
            let lines = decisions.compactMap { d -> String? in
                guard let text = o.row(d.item) else { return nil }
                return "\(d.approve ? "approved" : "rejected") \"\(Self.short(text))\" (\(d.item))" + (d.reason.isEmpty ? "" : " because \"\(d.reason)\"")
            }
            guard !lines.isEmpty else { return nil }
            return "[page] he went through the review (\(object)): " + lines.joined(separator: "; ")
        case .pageLetter(_, let object, let proposal, let send, _, _):
            guard let o = page.object(object), o.kind == .letter, o.attributes["proposal"] == proposal else { return nil }
            // a send is never a message to the job: it goes through the proposal's own card (Jobs)
            return send ? nil : "[page] he wants to change the draft (\(object), proposal \(proposal)) before it goes. that proposal is withdrawn: put the draft on the page as a <form> with its words in the fields so he can edit them, and when he submits it, queue the new version (a new proposal) and show it as a new <letter>."
        default:
            return nil
        }
    }

    static func short(_ s: String) -> String { s.count <= 120 ? s : String(s.prefix(119)) + "…" }
}

/// A repeat of a tap he already made on the same page version (a double click, a reload) is dropped.
public struct PageDedupe {
    private var seen: [String: Set<String>] = [:]
    private var order: [String] = []
    public init() {}

    public mutating func admit(event: String, version: String) -> Bool {
        if seen[version] == nil {
            seen[version] = []
            order.append(version)
            while order.count > 4 { seen[order.removeFirst()] = nil }
        }
        return seen[version]!.insert(event).inserted
    }
}
