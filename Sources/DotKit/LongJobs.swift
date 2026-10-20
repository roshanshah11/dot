import Foundation

// 07 of the 2026-10-20 fast-lane plan: standing jobs (watch words), long jobs (the idle close, promises of more).

/// Words that ask for something to be checked over time (decided item 23): "watch / monitor / keep an eye on X",
/// and "tell me if / tell me when / let me know when / ping me if" only with a time cue (I F16), so a one-off
/// check ("check my mail and tell me if sam wrote back") stays a one-off. 02's routing sends a hit to a talk turn,
/// whose prompt writes the [ROUTINE:...:watch: ...] tag.
public enum WatchWords {
    /// What makes "tell me if" standing: "ever", "whenever", "if anything", "as soon as", "changes", "comes in",
    /// "gets posted", "is posted", "every", "from now on".
    static let timeCues = [
        #"\bever\b"#, #"\bwhenever\b"#, #"\bif anything\b"#, #"\bas soon as\b"#, #"\bchange[sd]?\b"#,
        #"\b(?:comes?|came) in\b"#, #"\b(?:gets?|got|is|are) posted\b"#, #"\bevery\b"#, #"\bfrom now on\b"#,
    ]

    /// The ask that wants a ping later.
    static let tellMe = #"\b(?:tell me|let me know|ping me|alert me|notify me|text me|message me)\s+(?:if|when|whenever|as soon as|once)\b"#

    /// "watch" and "monitor" as a verb aimed at something: at the start of the ask or after "can you", "please",
    /// "and", "to"... ("show me the watch" is a noun).
    static let watchVerb = #"(?:^|[.!?,;:]\s*|\b(?:can you|could you|would you|will you|please|pls|i want you to|i need you to|go|and|to|dot|hey dot)\s+)(?:watch|monitor)\s+(?!out\b)(.{1,80})"#

    /// What "watch" or "monitor" aims at that is not a standing check: something to look at now, or a setting.
    static let notATarget = #"^(?:this|that|it|these|those|me|you|him|her|them)\b(?!\s+(?:inbox|mail|email|outlook|gmail|page|posting|portal|site|thread|channel|account|calendar|feed))|\b(?:video|videos|movie|movies|film|show|tv|clip|youtube|stream|game|match|brightness|volume|battery|cpu|memory|temperature|screen|display|me do)\b"#

    public static func isWatch(_ text: String) -> Bool {
        let s = text.lowercased().replacingOccurrences(of: "’", with: "'").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty else { return false }
        if s.range(of: #"\bkeep (?:an|a close|an extra) eye on\s+\S"#, options: .regularExpression) != nil { return true }
        if let regex = try? NSRegularExpression(pattern: watchVerb),
           let m = regex.firstMatch(in: s, range: NSRange(location: 0, length: (s as NSString).length)), m.range(at: 1).location != NSNotFound {
            let object = (s as NSString).substring(with: m.range(at: 1)).trimmingCharacters(in: .whitespaces)
            if !object.isEmpty, object.range(of: notATarget, options: .regularExpression) == nil { return true }
        }
        if s.range(of: tellMe, options: .regularExpression) != nil,
           timeCues.contains(where: { s.range(of: $0, options: .regularExpression) != nil }) {
            return true
        }
        return false
    }
}

/// When an agent's session counts as idle and closes (07). Before this, `scheduleIdleStop` gave up for good when its
/// timer found the agent working, and a message sent mid-turn that Claude Code folded into the running turn left
/// the session's owed-result count above zero forever: on 10-19 readings-fetch got two follow-ups mid-turn and one
/// result, stayed "working", never closed, and a message 15 hours later was taken as a mid-turn follow-up.
public enum AgentIdle {
    /// After a result, how long a session that still counts messages as owed may stay silent before those messages
    /// are taken as folded into the turn that just ended. A queued message starts its own turn within seconds.
    public static let foldSettle: TimeInterval = 90

    /// The owed messages were folded into the last turn: a result came, nothing has happened since, for `foldSettle`.
    public static func folded(pendingResults: Int, lastResultAt: Date?, lastEventAt: Date, now: Date) -> Bool {
        guard pendingResults > 0, let result = lastResultAt, lastEventAt <= result else { return false }
        return now.timeIntervalSince(result) >= foldSettle
    }

    public enum Verdict: Equatable { case close, wait(TimeInterval) }

    /// The idle timer fired: close the session, or look again later (never give up). `idleSince` is the session's
    /// last event or message. A session that is working or has a card open waits a whole idle period again.
    public static func verdict(working: Bool, waitingOnCard: Bool, idleSince: Date, now: Date, idleMinutes: Int) -> Verdict {
        let limit = Double(max(idleMinutes, 1)) * 60
        if working || waitingOnCard { return .wait(limit) }
        let idle = now.timeIntervalSince(idleSince)
        return idle >= limit - 1 ? .close : .wait(max(limit - idle, 1))
    }
}

extension AgentRecovery {
    /// The final message promises more work that no turn will do (07, decided item 24): "still running", "as soon as
    /// they come back", "will check back". On 10-14 the call-prep agent ended "Two research passes ... are still
    /// running. The question list goes into your output folder as soon as they come back." and nothing ever came.
    /// The chip then says "unfinished" with Continue. A job's last line takes the same check.
    public static func promisesLater(_ text: String) -> Bool {
        let s = text.lowercased().replacingOccurrences(of: "’", with: "'")
        let patterns = [
            #"\b(?:is|are|'s|'re|am|i'm) still (?:running|working|going|in progress|processing|loading|downloading)\b"#,
            #"\bstill (?:running|in progress|processing)\b"#,
            #"\b(?:i'll|i will|i'm going to|i am going to|i can) (?:check back|follow up|report back|get back to you|circle back)\b"#,
            #"\bwill check back\b"#,
            #"\b(?:i'll|i will) (?:let you know|update you|tell you|send (?:it|them) over|post it) (?:when|once|as soon as)\b"#,
            // Its own work coming back later; "when the form is done, click Submit" is an instruction, not a promise.
            #"\b(?:as soon as|once|when) (?:they|those|these|the (?:\w+ )?(?:passes|helpers|searches|downloads|results|runs|checks|lookups|reads)) (?:come back|comes back|come in|finish|land|(?:are|is) (?:done|back|ready|finished|in))\b"#,
        ]
        return patterns.contains { s.range(of: $0, options: .regularExpression) != nil }
    }
}
