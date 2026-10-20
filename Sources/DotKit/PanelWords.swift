import Foundation

/// His words for the explainer panel that mean it only while it is open.
public enum PanelWords {
    /// "close the view", "close gallry", "hide the diagram" (2026-10-19 09:55: both went to the model, which said
    /// "closing the panel." and cleared an empty board).
    static let loose = try! NSRegularExpression(
        pattern: #"^\w+ (the |that |this )?(view|gall\w*|pop-? ?up|overlay|lesson|diagram|figure|thing)\W*$"#, options: [.caseInsensitive])

    public static func namesPanelLoosely(_ text: String) -> Bool {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return loose.firstMatch(in: t, range: NSRange(location: 0, length: (t as NSString).length)) != nil
    }
}
