import Foundation

/// A card Dot designs itself (parity C1): the same `[CARD:id:...] <<< ... >>>` block, with Dot's UI language inside
/// (docs/ui-language.md) instead of HTML. The card renders it with the explainer panel's renderer at card size.
public enum CardMarkup {
    /// Tags that open a UI-language answer and no HTML card would start with ("table" and "svg" are shared, so a body
    /// starting with one of those is UI language only when nothing HTML-only is in it, which `isUILanguage` checks).
    public static let openers: Set<String> = [
        "lead", "title", "text", "box", "row", "grid", "list", "callout", "quote", "badge", "table", "chart", "plot", "steps",
        "math", "image", "divider", "caption", "status", "followups", "quiz", "viz", "state", "spacer",
    ]

    /// HTML-only marks: a body with any of these whole tags (not `<divider>`), or a stage, is an HTML card, as before.
    static let htmlOnly = #"<(div|style|script|section|h[1-4]|span)(?![a-z0-9-])|class\s*=\s*["'][^"']*\bstage\b"#

    public static func isUILanguage(_ body: String) -> Bool {
        let lower = body.lowercased()
        guard lower.range(of: htmlOnly, options: .regularExpression) == nil else { return false }
        var rest = Substring(lower)
        while true {
            rest = rest.drop(while: { $0.isWhitespace })
            if rest.hasPrefix("<!--"), let end = rest.range(of: "-->") { rest = rest[end.upperBound...]; continue }
            break
        }
        guard rest.first == "<" else { return false }
        let name = rest.dropFirst().prefix(while: { $0.isLetter || $0.isNumber || $0 == "-" })
        return openers.contains(String(name))
    }

    /// A JavaScript string literal for `text` (JSON, with `</` broken so it can't close a script element).
    public static func jsString(_ text: String) -> String {
        let data = (try? JSONSerialization.data(withJSONObject: [text], options: [.fragmentsAllowed])) ?? Data("[\"\"]".utf8)
        let array = String(decoding: data, as: UTF8.self)
        return String(array.dropFirst().dropLast()).replacingOccurrences(of: "</", with: "<\\/")
    }

    /// Light when the look's background is light (the panel's light tokens), from its hex.
    public static func isLight(hex: String) -> Bool {
        let digits = hex.trimmingCharacters(in: CharacterSet(charactersIn: "# ")).prefix(6)
        guard digits.count == 6, let value = Int(digits, radix: 16) else { return false }
        let r = Double((value >> 16) & 0xff), g = Double((value >> 8) & 0xff), b = Double(value & 0xff)
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
    }
}
