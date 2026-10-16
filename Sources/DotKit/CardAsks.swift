import Foundation

/// Asks Dot answers with a card of its own and no model turn: a place ("coffee near me") and
/// pictures ("show me pictures of the artemis launch"). Pure parsing, so it is tested.
public enum CardAsks {
    public struct PlaceAsk: Equatable {
        public let what: String
        /// Nil means near home (campus); else the place he named.
        public let whereWord: String?
        public init(what: String, whereWord: String?) { self.what = what; self.whereWord = whereWord }
    }

    static let placeWords = try! NSRegularExpression(pattern: #"(?i)^(?:(?:hey )?(?:dot[,.]? )?)?(?:(?:can you |could you |please )?(?:find|show|get)(?: me)?|where(?:'s| is| can i (?:get|find))|is there|any|i need|i want)\s+(?:the nearest |the closest |a good |some good |a |an |some |the |good |nearby )?(.+?)\s+(?:near|around|close to|nearby|by)\s+(me|here|campus|school|us|my (?:place|dorm|apartment)|hyde park|[\w .'-]+?)[?.!]*$"#)
    static let homeWords: Set<String> = ["me", "here", "campus", "school", "us", "my place", "my dorm", "my apartment", "hyde park"]

    public static func place(_ text: String) -> PlaceAsk? {
        let ns = text as NSString
        guard let match = placeWords.firstMatch(in: text, range: NSRange(location: 0, length: ns.length)) else { return nil }
        let what = ns.substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespaces)
        let whereWord = ns.substring(with: match.range(at: 2)).lowercased().trimmingCharacters(in: .whitespaces)
        guard what.count >= 3, what.count <= 60, !what.lowercased().contains(" my "), !what.lowercased().hasPrefix("my ") else { return nil }
        return PlaceAsk(what: what, whereWord: homeWords.contains(whereWord) ? nil : whereWord)
    }

    static let imageWords = try! NSRegularExpression(pattern: #"(?i)^(?:(?:hey )?(?:dot[,.]? )?)?(?:(?:can you |could you |please )?(?:show|find|get|pull up|bring up)(?: me)?\s+(?:some |a few |the )?(?:pictures?|photos?|images?|pics?)\s+of\s+|what does\s+)(.+?)\s*(?:look like)?[?.!]*$"#)

    public static func images(_ text: String) -> String? {
        let ns = text as NSString
        guard let match = imageWords.firstMatch(in: text, range: NSRange(location: 0, length: ns.length)) else { return nil }
        let subject = ns.substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespaces)
        guard subject.count >= 2, subject.count <= 70 else { return nil }
        let lower = text.lowercased()
        if lower.contains("what does"), !lower.contains("look like") { return nil }
        return subject
    }
}
