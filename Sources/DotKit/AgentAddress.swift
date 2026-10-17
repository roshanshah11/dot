import Foundation

/// Which agent he means, from his own words, so "tell inbox keeper to also check spam", "stop the
/// physics agent" or "is email done?" reaches that agent. Round seven (G2): talk used to hand every
/// job to the agent named Dot, and a spoken follow-up only ever reached the newest running agent.
/// Names come from the roster (the CLAUDE.md title and the folder slug); the default agent "dot" is
/// never matched, since "dot, ..." is him talking to the companion itself.
public enum AgentAddress {
    public struct Agent: Equatable, Sendable {
        public let slug: String
        public let name: String
        public init(slug: String, name: String) { self.slug = slug; self.name = name }
    }

    public enum Intent: Equatable, Sendable {
        /// A message for that agent: a follow-up, a change to the task, a question for it.
        case tell
        /// Stop it now.
        case stop
        /// How it is doing: Dot answers from what the agent is doing, without bothering it.
        case status
    }

    public struct Match: Equatable, Sendable {
        public let slug: String
        public let intent: Intent
        public init(slug: String, intent: Intent) { self.slug = slug; self.intent = intent }
    }

    /// The agent his words address, and what he wants from it; nil when he names none.
    public static func find(in text: String, roster: [Agent]) -> Match? {
        let said = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !said.isEmpty else { return nil }
        for agent in roster where agent.slug != "dot" {
            for (name, isAlias) in namePatterns(agent, roster: roster) {
                // A first-word alias ("deck" for Deck Shop) is a common word: it addresses the agent only
                // after tell, ask, remind or message, or with "agent" after it ("stop the deck agent").
                let suffix = isAlias ? " agent" : "(?: agent| helper)?"
                if matches(#"^(?:please |dot,? )?(?:stop|cancel|kill|halt|abort)(?: the| my)? \#(name)(?:'s \w+)?\#(suffix)(?: now| please| for now)?\W*$"#, said) {
                    return Match(slug: agent.slug, intent: .stop)
                }
                let tag = isAlias ? " agent" : "(?: agent)?"
                let status = [
                    #"^(?:is|has) (?:the |my )?\#(name)\#(tag) (?:done|finished|ready|still (?:working|going|running|at it))(?: yet)?\W*$"#,
                    #"^did (?:the |my )?\#(name)\#(tag) finish(?: yet)?\W*$"#,
                    #"^how(?:'s| is) (?:the |my )?\#(name)\#(tag) (?:doing|going|coming along|getting on)\W*$"#,
                    #"^what(?:'s| is) (?:the |my )?\#(name)\#(tag) (?:doing|up to|working on)(?: (?:right )?now)?\W*$"#,
                    #"^(?:any )?(?:progress|status|updates?) (?:on|of|from|for) (?:the |my )?\#(name)\#(tag)\W*$"#,
                    #"^where(?:'s| is) (?:the |my )?\#(name)\#(tag) (?:at|with it)\W*$"#,
                ]
                if status.contains(where: { matches($0, said) }) { return Match(slug: agent.slug, intent: .status) }
                // tell, ask, remind and message name the agent outright; have, get and let need its full name.
                let verbs = isAlias ? "tell|ask|remind|message" : "tell|ask|have|get|let|remind|message"
                var tell = [#"^(?:please |dot,? |can you |could you )?(?:\#(verbs)) (?:the |my )?\#(name)(?: agent| helper)?\b[\s\S]+$"#]
                if !isAlias {
                    tell.append(#"^for (?:the |my )?\#(name)(?: agent)?\s*[:,]\s*[\s\S]+$"#)
                    tell.append(#"^(?:hey |ok(?:ay)? )?\#(name)(?: agent)?,\s*[\s\S]+$"#)
                }
                if tell.contains(where: { matches($0, said) }) { return Match(slug: agent.slug, intent: .tell) }
            }
        }
        return nil
    }

    /// "for <name>: the brief" at the start of an [AGENT] brief, the talk prompt's convention before
    /// [TELL] existed: the agent it names and the brief without the address.
    public static func leadingFor(_ brief: String, roster: [Agent]) -> (slug: String, brief: String)? {
        for agent in roster where agent.slug != "dot" {
            for (name, isAlias) in namePatterns(agent, roster: roster) where !isAlias {
                let regex = try! NSRegularExpression(pattern: #"^\s*for (?:the |my )?\#(name)(?: agent)?\s*[:,]\s*([\s\S]+)$"#, options: [.caseInsensitive])
                let ns = brief as NSString
                if let match = regex.firstMatch(in: brief, range: NSRange(location: 0, length: ns.length)) {
                    let rest = ns.substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespacesAndNewlines)
                    if !rest.isEmpty { return (agent.slug, rest) }
                }
            }
        }
        return nil
    }

    /// The one agent whose full name his words contain ("pass a note to the lab desk agent that ..."),
    /// for work Jev already judged to be an agent's: it goes to that agent, not the default one.
    /// nil when none or more than one is named.
    public static func mentioned(in text: String, roster: [Agent]) -> Agent? {
        let words = " " + normalize(text) + " "
        let named = roster.filter { agent in
            guard agent.slug != "dot" else { return false }
            let name = normalize(agent.name)
            return !name.isEmpty && words.contains(" " + name + " ")
        }
        return named.count == 1 ? named[0] : nil
    }

    /// The roster agent a spoken or written name means: the name or slug outright, else the one
    /// agent whose name holds those words ("inbox" for Inbox Keeper). nil when none or several fit.
    public static func agent(named phrase: String, in roster: [Agent]) -> Agent? {
        let fits = candidates(named: phrase, in: roster)
        return fits.count == 1 ? fits[0] : nil
    }

    /// Every roster agent a name could mean: the exact one alone when the name or slug matches
    /// outright, else each agent whose name holds those words (two for "lab" with Lab Desk and Lab Notes).
    public static func candidates(named phrase: String, in roster: [Agent]) -> [Agent] {
        let wanted = normalize(phrase)
        guard !wanted.isEmpty, wanted.count <= 48 else { return [] }
        if let hit = roster.first(where: { normalize($0.name) == wanted || normalize($0.slug) == wanted }) { return [hit] }
        return roster.filter { agent in
            [normalize(agent.name), normalize(agent.slug)].contains { (" " + $0 + " ").contains(" " + wanted + " ") }
        }
    }

    /// A progress question with no name in it ("progress?", "is it done", "what do i need to do rn").
    /// Dot answers it from the agents' live state when one is working or waiting on him.
    public static func isProgressAsk(_ text: String) -> Bool {
        matches(#"^(?:so,? |and |ok(?:ay)?,? |hey,? )?(?:progress|status|any (?:progress|update|news)|how(?:'s| is) it (?:going|coming(?: along)?)|(?:is|are) (?:it|they|that|the agents?) (?:done|finished|ready)(?: yet)?|what(?:'s| is) (?:it|the agent) (?:doing|up to)|what(?:'s| is) happening|what do i (?:need|have) to do(?: (?:right )?now| rn)?|do (?:you|they|it|the agents?) need (?:me|anything)(?: from me)?|where (?:are|is) (?:we|it|they) at)\W*$"#,
                text.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    /// "ok", "thanks", "cool", "got it": a nod, not an instruction. An agent that just reported must not
    /// get one as a message: its offered next step would read it as a yes.
    public static func isAcknowledgment(_ text: String) -> Bool {
        matches(#"^(?:ok(?:ay)?|k|thanks?|thank you|thx|cool|nice|great|got it|alright|all right|sounds good|perfect|awesome|sweet|good)(?:,? (?:thanks?|thank you|dot))?\W*$"#,
                text.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    // MARK: Pieces

    /// The ways his words may spell an agent's name, as regex fragments: the name, the slug's words,
    /// and the first word of the name when no other agent's name starts with it (an alias, which
    /// `find` accepts only in plain address).
    static func namePatterns(_ agent: Agent, roster: [Agent]) -> [(pattern: String, isAlias: Bool)] {
        var names: [(String, Bool)] = []
        let full = normalize(agent.name)
        if !full.isEmpty { names.append((full, false)) }
        let slug = normalize(agent.slug)
        if !slug.isEmpty, !names.contains(where: { $0.0 == slug }) { names.append((slug, false)) }
        if let first = full.split(separator: " ").first.map(String.init), first.count >= 3, first != full,
           !names.contains(where: { $0.0 == first }),
           !roster.contains(where: { $0.slug != agent.slug && normalize($0.name).split(separator: " ").first.map(String.init) == first }) {
            names.append((first, true))
        }
        return names.map { name, isAlias in
            (name.split(separator: " ").map { NSRegularExpression.escapedPattern(for: String($0)) }.joined(separator: #"[\s-]+"#), isAlias)
        }
    }

    static func normalize(_ text: String) -> String {
        var t = text.lowercased()
        t = t.replacingOccurrences(of: #"[-_]"#, with: " ", options: .regularExpression)
        t = t.replacingOccurrences(of: #"[^a-z0-9 ]"#, with: "", options: .regularExpression)
        t = t.replacingOccurrences(of: #"\b(the|my|agent|helper)\b"#, with: " ", options: .regularExpression)
        return t.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces)
    }

    static func matches(_ pattern: String, _ text: String) -> Bool {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return false }
        return regex.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) != nil
    }
}

/// His spoken answer to the permission card on show (round seven, G2): "allow" or "not now" by voice,
/// the way HeyClicky takes it ("by voice too"). A guarded card (a send, a payment, a delete, a push, a
/// change to the Mac) is allowed only by words that name the act the card itself names ("yes, send
/// it" for a send, "go ahead and delete them" for a delete), so a stray "yes", or the act of another
/// card, never sends anything. "Run" never counts: every command card says "run a command".
public enum ConsentVoice {
    public enum Answer: Equatable, Sendable {
        case allow, allowForTask, decline
        /// He said yes to a guarded card without naming its act.
        case needsExplicit
        /// Not an answer to the card.
        case none
    }

    /// The acts a guarded card can name, each with the forms a card or his words may use.
    static let acts: [(act: String, pattern: String)] = [
        ("send", #"send(?:s|ing)?|sent"#), ("reply", #"repl(?:y|ies|ied|ying)"#), ("forward", #"forward(?:s|ed|ing)?"#),
        ("post", #"post(?:s|ed|ing)?"#), ("submit", #"submit(?:s|ted|ting)?"#), ("share", #"shar(?:e|es|ed|ing)"#),
        ("invite", #"invit(?:e|es|ed|ing)"#), ("publish", #"publish(?:es|ed|ing)?"#), ("respond", #"respond(?:s|ed|ing)?|rsvp"#),
        ("pay", #"pa(?:y|ys|id|ying|yment)"#), ("buy", #"buy(?:s|ing)?|bought"#), ("purchase", #"purchas(?:e|es|ed|ing)"#),
        ("order", #"order(?:s|ed|ing)?"#), ("book", #"book(?:s|ed|ing)?"#),
        ("delete", #"delet(?:e|es|ed|ing|ion)|rm|unlink"#), ("trash", #"trash(?:es|ed|ing)?"#), ("remove", #"remov(?:e|es|ed|ing)"#),
        ("erase", #"eras(?:e|es|ed|ing)"#), ("push", #"push(?:es|ed|ing)?"#), ("install", #"(?:un)?install(?:s|ed|ing)?"#),
        ("quit", #"quit(?:s|ting)?"#), ("kill", #"kill(?:s|ed|ing)?"#),
    ]

    /// The acts named in a piece of text (a card's title and detail, or what he said).
    public static func acts(in text: String) -> Set<String> {
        // Tool names spell words with underscores ("send_message"), which a word boundary would miss.
        let lower = text.lowercased().replacingOccurrences(of: "_", with: " ")
        return Set(acts.filter { AgentAddress.matches(#"\b(?:\#($0.pattern))\b"#, lower) }.map(\.act))
    }

    /// Words aimed at a card in particular ("allow", "not now", "yes, send it"), as against an "ok" or
    /// a "yes" that may belong to a walkthrough, a lesson, a suggestion or a question Dot just asked.
    public static func isAimedAtCard(_ text: String) -> Bool {
        let said = text.lowercased().replacingOccurrences(of: "\u{2019}", with: "'")
        return AgentAddress.matches(#"^(?:allow|approve|deny|decline|not now)\b"#, said) || !acts(in: said).isEmpty
    }

    /// `card`: the card's own words (its title and detail); a guarded card's act must be named from them.
    public static func interpret(_ text: String, guarded: Bool, card: String = "") -> Answer {
        var said = text.lowercased()
            .replacingOccurrences(of: "\u{2019}", with: "'")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".!?,; "))
        // "no problem" and "no worries" are yeses.
        said = said.replacingOccurrences(of: #"\b(?:no problem|not a problem|no worries)\b"#, with: "fine", options: .regularExpression)
        let words = said.split(whereSeparator: { $0 == " " || $0 == "," }).count
        guard !said.isEmpty, words <= 10 else { return .none }
        // A question riding on a yes ("yes, what is this") is a question, not an answer.
        if AgentAddress.matches(#"\b(what|why|how|where|who|which|when|can you|could you)\b"#, said) { return .none }
        if AgentAddress.matches(#"^(?:no|nope|nah|not now|not yet|don'?t|do not|deny|decline|skip(?: it)?|cancel(?: it| that)?|never ?mind|leave it|hold off)\b"#, said) {
            return .decline
        }
        // A pause anywhere leaves the card up: "ok wait", "yes, hold on", "ok stop".
        if AgentAddress.matches(#"\b(?:wait|hold on|hang on|one sec(?:ond)?|stop|later|tomorrow|not yet)\b"#, said) { return .none }
        // A no anywhere takes the yes back: "yes, don't send it", "yeah, hold off".
        if AgentAddress.matches(#"\b(?:no|not|don'?t|do not|never|nope|nah|cancel|hold off|deny|decline)\b"#, said) { return .decline }
        let affirm = AgentAddress.matches(#"^(?:yes|yeah|yep|yup|sure|ok(?:ay)?|allow|approve|go ahead|go for it|do it|fine|that'?s fine|sounds good|please do|let (?:it|him|her|them)(?: do it)?)\b"#, said)
        let named = acts(in: said)
        let actCommand = !named.isEmpty && AgentAddress.matches(#"^\w+\b(?: (?:it|them|that|those|this|the \w+))?(?: now| please)?$"#, said)
            && acts(in: String(said.split(separator: " ").first ?? "")) == named
        guard affirm || actCommand else { return .none }
        let forTask = AgentAddress.matches(#"\b(?:for (?:the rest of )?(?:this|the) (?:task|job|run)|for (?:all|everything)|all of (?:them|those|these)|every time|always)\b"#, said)
        if guarded, named.isDisjoint(with: acts(in: card)) { return .needsExplicit }
        return forTask ? .allowForTask : .allow
    }
}
