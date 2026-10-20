import Foundation

/// A page as a job reads it: the url and title, then its headings and controls one per line with a ref, from Comet's
/// accessibility tree (`Accessibility.getFullAXTree`, refs mapped by backendDOMNodeId, so nothing is written into the
/// page). `e6 button "Submit application" [his]`, `e8 textbox "Name" = "Sam Rivera"`, `e3 link "Week 3 reading (PDF)"`.
public enum PageSnapshot {
    public struct Item: Equatable, Sendable {
        public var backendId: Int
        public var role: String
        public var name: String
        public var value: String?
        public var checked: Bool = false
        public var disabled: Bool = false
        /// Top-left in page CSS pixels relative to the viewport, when known.
        public var top: Double?
        public var bottom: Double?

        public init(backendId: Int, role: String, name: String, value: String? = nil, checked: Bool = false, disabled: Bool = false,
                    top: Double? = nil, bottom: Double? = nil) {
            self.backendId = backendId; self.role = role; self.name = name; self.value = value
            self.checked = checked; self.disabled = disabled; self.top = top; self.bottom = bottom
        }

        public var isHeading: Bool { role == "heading" }
    }

    public static let controlRoles: Set<String> = [
        "button", "link", "textbox", "searchbox", "combobox", "checkbox", "radio", "switch", "tab", "menuitem", "menuitemcheckbox",
        "menuitemradio", "option", "listbox", "slider", "spinbutton", "textarea", "popupbutton",
    ]
    public static let defaultLimit = 60
    public static let allLimit = 120
    public static let charLimit = 6000

    static func string(_ any: Any?) -> String? {
        guard let dict = any as? [String: Any] else { return nil }
        if let s = dict["value"] as? String { return s }
        if let n = dict["value"] as? NSNumber { return n.stringValue }
        return nil
    }

    /// The headings and controls in document order, from getFullAXTree's `nodes`.
    public static func candidates(axNodes: [[String: Any]]) -> [Item] {
        var out: [Item] = []
        var seen = Set<Int>()
        for node in axNodes {
            if (node["ignored"] as? Bool) == true { continue }
            guard let role = string(node["role"])?.lowercased(), controlRoles.contains(role) || role == "heading",
                  let backend = (node["backendDOMNodeId"] as? NSNumber)?.intValue, !seen.contains(backend) else { continue }
            let name = (string(node["name"]) ?? "").replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespaces)
            if role == "heading", name.isEmpty { continue }
            var item = Item(backendId: backend, role: role, name: name)
            if let v = string(node["value"]), !v.isEmpty, ["textbox", "searchbox", "combobox", "textarea", "slider", "spinbutton", "listbox"].contains(role) {
                item.value = v
            }
            for p in (node["properties"] as? [[String: Any]]) ?? [] {
                let pname = p["name"] as? String ?? ""
                let pv = (p["value"] as? [String: Any])?["value"]
                if pname == "checked" || pname == "pressed" { item.checked = "\(pv ?? "")" == "true" || (pv as? Bool) == true }
                if pname == "disabled" { item.disabled = (pv as? Bool) == true || "\(pv ?? "")" == "true" }
            }
            seen.insert(backend)
            out.append(item)
        }
        return out
    }

    static func quoted(_ s: String, max: Int = 80) -> String {
        let cut = s.count > max ? String(s.prefix(max - 3)) + "..." : s
        return "\"" + cut.replacingOccurrences(of: "\"", with: "'") + "\""
    }

    /// The text a job reads and the refs it may use (ref -> backendDOMNodeId). On-screen items come first; with `all`,
    /// off-screen ones follow, marked, up to 120. `viewportHeight` nil: every item counts as on screen.
    public static func format(url: String, title: String, items: [Item], viewportHeight: Double?, all: Bool = false,
                              note: String? = nil) -> (text: String, refs: [String: Int]) {
        func onScreen(_ i: Item) -> Bool {
            guard let h = viewportHeight, let top = i.top, let bottom = i.bottom else { return true }
            return bottom > 0 && top < h
        }
        let visible = items.filter(onScreen)
        let off = items.filter { !onScreen($0) }
        let limit = all ? allLimit : defaultLimit
        var chosen = Array(visible.prefix(limit))
        if all, chosen.count < limit { chosen += off.prefix(limit - chosen.count) }
        var lines = ["page: \(quoted(title, max: 100)) \(url)"]
        if let note { lines.append(note) }
        var refs: [String: Int] = [:]
        var n = 0
        var used = lines.joined(separator: "\n").count
        var shown = 0
        for item in chosen {
            var line: String
            if item.isHeading {
                line = "  heading \(quoted(item.name))"
            } else {
                n += 1
                let ref = "e\(n)"
                refs[ref] = item.backendId
                line = "\(ref) \(item.role) \(quoted(item.name))"
                if let v = item.value { line += " = \(quoted(v, max: 60))" }
                if item.checked { line += " [checked]" }
                if item.disabled { line += " [disabled]" }
                if CommitGuard.isCommit(item.name) || Rx.has(PageCommitRule.jobWords, item.name) { line += " [his]" }
            }
            if !onScreen(item) { line += " (off screen)" }
            if used + line.count + 1 > charLimit - 60 { break }
            lines.append(line)
            used += line.count + 1
            shown += 1
        }
        let more = items.count - shown
        if more > 0 { lines.append("...\(more) more\(all ? "" : " (look with all: true, or scroll)")") }
        if items.isEmpty { lines.append("(no controls found; look with text: true to read it)") }
        return (lines.joined(separator: "\n"), refs)
    }
}
