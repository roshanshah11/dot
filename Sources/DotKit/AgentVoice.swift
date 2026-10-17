import Foundation

/// Spoken moves on agents that name none (the agent is the one he last spoke to, or the one at
/// work): retry, a change of course, the last thing an agent found, and which card a yes is for.
/// Patterns are strict so ordinary sentences pass through to the talk model (VO-02, VO-03, VO-06, VO-09).
public enum AgentVoice {
    /// "retry", "try again", "do that again": the agent's last brief, again (VO-06).
    public static func isRetry(_ text: String) -> Bool {
        let said = clean(text)
        return AgentAddress.matches(#"^(?:ok(?:ay)?,? |please |dot,? )?(?:retry|try (?:that |it )?again|do (?:that|it) again|run (?:that|it) again|redo (?:that|it)|give it another (?:go|try))(?: please)?$"#, said)
    }

    /// "stop, do the sensitivity table instead", "no, use the 10-K instead", "scratch that, make it
    /// two pages instead": the new instruction for the agent at work (VO-09). nil without "instead",
    /// so "stop" alone stays a stop and "actually, what is this" stays a question.
    public static func steer(_ text: String) -> String? {
        let said = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let patterns = [
            #"^(?:no|nope|wait|stop|hold on|scratch that|actually|change of plan)[,.!]?\s+(?:and\s+|just\s+)?(?:instead\s+)?([\s\S]+?)\s+instead\W*$"#,
            #"^(?:no|stop|scratch that|actually)[,.!]?\s+(?:and\s+)?instead[,]?\s+([\s\S]+?)\W*$"#,
        ]
        for pattern in patterns {
            if let instruction = AgentAddress.firstGroup(pattern, said), instruction.split(separator: " ").count >= 2 { return instruction }
        }
        return nil
    }

    /// The last thing an agent reported, read from its transcript (the final assistant text before
    /// its latest result row), so "what did email find" survives a relaunch (VO-02).
    public static func lastFinding(in entries: [(role: String, text: String)]) -> String? {
        guard let resultIndex = entries.lastIndex(where: { $0.role == "result" }) else { return nil }
        return entries[..<resultIndex].last(where: { $0.role == "assistant" && !$0.text.isEmpty })?.text
    }

    /// Several cards wait and his yes named none: ask which (VO-03, HeyClicky's "which one?").
    public static func whichCard(_ asks: [(agent: String, act: String)]) -> String {
        let count = ["", "one", "two", "three", "four", "five"]
        let n = asks.count < count.count ? count[asks.count] : String(asks.count)
        let list = asks.prefix(3).map { "\($0.agent.lowercased()) wants to \($0.act)" }.joined(separator: ", ")
        return "\(n) are waiting: \(list). which one?"
    }

    /// The asking agent his words name, among those with a card open; nil when none or several.
    public static func cardAgent(in text: String, among agents: [(slug: String, name: String)]) -> String? {
        let said = " " + AgentAddress.normalize(text) + " "
        let hits = agents.filter { agent in
            let name = AgentAddress.normalize(agent.name)
            let first = name.split(separator: " ").first.map(String.init) ?? name
            return !name.isEmpty && (said.contains(" " + name + " ") || said.contains(" " + first + " "))
        }
        let slugs = Set(hits.map(\.slug))
        return slugs.count == 1 ? slugs.first : nil
    }

    private static func clean(_ text: String) -> String {
        text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: ".!?,; "))
    }
}

public extension AgentVoice {
    /// The file extensions a spoken kind means ("the deck", "the sheet"); empty is any file (VO-01).
    static func extensions(forKind kind: String) -> [String] {
        switch kind.lowercased() {
        case "deck", "slides": return ["pptx", "key", "pdf"]
        case "sheet", "spreadsheet", "model": return ["xlsx", "csv", "numbers"]
        case "doc", "document", "memo": return ["docx", "md", "pages", "pdf", "txt"]
        case "pdf": return ["pdf"]
        case "draft": return ["md", "docx", "txt", "eml"]
        case "page": return ["html", "htm"]
        case "chart": return ["png", "svg", "pdf", "html"]
        default: return []
        }
    }

    /// His answer to the morning card by voice (MB-07): yes with an optional change, or skip; nil
    /// when the words are something else.
    static func morningAnswer(_ text: String) -> (yes: Bool, adjust: String?)? {
        let said = text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        if let change = AgentAddress.firstGroup(#"^(?:yes,? |ok(?:ay)?,? |sure,? )?(?:do (?:it|that|that one)|go ahead|yes)[,.]?\s+(?:but|and|except)\s+([\s\S]{3,}?)\W*$"#, said) {
            return (true, change)
        }
        let plain = said.trimmingCharacters(in: CharacterSet(charactersIn: ".!?,; "))
        if AgentAddress.matches(#"^(?:yes,? |ok(?:ay)?,? |sure,? )?(?:do (?:it|that|that one|the first one)|go ahead|yes(?: please)?|sure|let'?s do (?:it|that))$"#, plain) { return (true, nil) }
        if AgentAddress.matches(#"^(?:skip(?: it| that(?: one)?)?|not (?:that one|today|this one)|no(?:pe)?|next(?: one)?|pass)$"#, plain) { return (false, nil) }
        return nil
    }
}
