import Foundation

/// Tapbacks on an agent's message in Home (parity HO-06): five, as in Messages. The agent reads them at the top of its
/// next turn, as feedback rather than an ask.
public enum Tapback {
    public static let choices: [(emoji: String, meaning: String)] = [
        ("👍", "good"), ("👎", "not what he wanted"), ("❤️", "loved it"), ("😂", "funny"), ("❓", "unclear to him"),
    ]

    public static func block(_ reactions: [(emoji: String, text: String)]) -> String? {
        guard !reactions.isEmpty else { return nil }
        let lines = reactions.map { r -> String in
            let meaning = choices.first { $0.emoji == r.emoji }?.meaning
            let flat = r.text.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespaces)
            let quote = flat.count > 120 ? String(flat.prefix(119)) + "…" : flat
            return "- \(r.emoji)\(meaning.map { " (\($0))" } ?? "") to \"\(quote)\""
        }
        return "[reactions] he reacted to your messages in Home since your last turn (feedback, not an ask):\n" + lines.joined(separator: "\n")
    }
}

extension AgentLook {
    /// Three first messages for an empty thread (parity HO-09), by the agent's symbol (what it does). Tapping one puts it
    /// in the composer; he sends it.
    public static func starters(symbol: String) -> [String] {
        switch symbol {
        case "envelope": return ["Draft replies to what came in today", "Who haven't I answered this week?", "Write a follow-up to my last email"]
        case "rectangle.on.rectangle.angled": return ["Turn my notes into a five-slide deck", "Tighten the last deck you made", "Make a title slide and an agenda"]
        case "chart.line.uptrend.xyaxis": return ["Pull comps for a ticker I name", "What moved in my sectors today?", "Check my model for broken links"]
        case "graduationcap": return ["Quiz me on this week's material", "Make a practice set on my weakest topic", "Run a ten-minute mock interview"]
        case "briefcase": return ["What applications are due this week?", "Find new postings I'm eligible for", "Prep the next application up to Submit"]
        case "pencil.line": return ["Draft something from my notes", "Tighten my last draft", "Give me three titles for it"]
        case "magnifyingglass": return ["Research a question with sources", "What's new on this since last week?", "Fact-check a draft I paste"]
        case "globe": return ["Check a site for me", "Summarize a page I send", "Watch a page for changes"]
        case "chart.bar.xaxis": return ["Chart a table I give you", "Make a dashboard of this week", "Build an explainer for a topic"]
        case "tablecells": return ["Clean up a spreadsheet", "Find the errors in a workbook", "Build a table from a PDF"]
        case "doc.text": return ["Summarize a PDF", "Pull the key numbers from a document", "Turn my notes into a one-pager"]
        case "chevron.left.forwardslash.chevron.right": return ["Review my latest changes", "Find the bug I describe", "Write tests for a file"]
        case "clock": return ["What's scheduled?", "Do this every morning", "Pause my routines for today"]
        case "message": return ["Who texted me today?", "Draft a reply to my last text", "Remind me to answer someone"]
        case "person.2": return ["Who should I reach out to this week?", "Prep me for my next coffee chat", "Who replied to me?"]
        case "book": return ["Explain today's lecture", "Make notes on a reading", "Quiz me on it"]
        case "paintpalette": return ["Make an image for me", "Design a cover", "Pick colors for a deck"]
        case "wrench.and.screwdriver": return ["Take apart an app I name", "How does this feature work?", "Compare two versions"]
        case "calendar": return ["What's coming up this week?", "Any new events I should know about?", "Watch a deadline for me"]
        case "cart": return ["Find the best option for something I need", "Compare two products", "Is this a good price?"]
        case "gearshape": return ["What can you set up for me?", "Check my settings", "Fix something that broke"]
        default: return ["What can you do for me?", "Start on what you're for", "Show me what you've made"]
        }
    }
}
