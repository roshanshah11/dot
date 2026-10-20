import Foundation

/// Where a job runs. Front: his own tab or app, in front of him, and he watches it happen ("open my canvas and go to
/// the week 3 readings"). Behind: a Comet window of its own behind his app, while he keeps working ("download my week 3
/// readings", "in a separate tab, find the job I applied to"). His rule of 2026-10-20.
public enum JobPlacement: String, Equatable, Sendable { case front, behind }

public enum JobPlacementRule {
    /// Polite or filler openings before the verb: "hey can you open...", "ok dot, go to...".
    static let lead = #"^(?:(?:hey|ok(?:ay)?|so|dot|um+|uh+|(?:can|could|would|will) you|please|just|go ahead and|i need you to|i want you to)[,.]?\s+)*"#
    /// 1. Always behind: his words put it out of sight ("in a separate tab" always runs behind).
    static let behind = #"\b(?:in|on|into|using|with) (?:a |an )?(?:separate|another|other|new|different|background|second) (?:tab|window)\b|\bin the background\b|\bbehind (?:me|my (?:back|work)|the scenes)\b|\b(?:while|as) i (?:work|keep working|study|do (?:this|that|my|other))\b|\bwithout (?:showing|opening it on|taking over) (?:me|my screen|the screen)\b|\bquietly\b|\bdon'?t (?:show|open) (?:it|me|that)\b|\bout of (?:my )?(?:sight|way)\b"#
    /// 2. Front: an opening verb about seeing it.
    static let frontLead = lead + #"(?:open(?: up)?|go (?:to|on|onto|into|back to)|show me|take me|pull up|bring up|navigate|head (?:to|over to)|play|put on|click|press|tap|scroll|type|search(?: for)?|jump to|switch to|log ?in(?:to)?|sign in(?:to)?)\b"#
    /// 3. Result only: he wants the outcome, not to watch.
    static let result = #"\b(?:download|save|export|print|check(?: on| whether| if)?|find out|look up|where (?:does|do|is|are) [^.?!]{1,60} stand|what(?:'s| is) the status|status of|track|tell me|let me know|text me|research|summari[sz]e|write|draft|make (?:me )?(?:a|an|the)|create|build|put together|prepare|fill (?:out|in)|compare|collect|gather|go through|clean up|organi[sz]e|book|order)\b"#
    /// 4. The thing on screen.
    static let here = #"\b(?:on|in) (?:this|the) (?:page|tab|window|site|screen)\b|\bhere\b|\bon my screen\b|\bthis (?:page|form|tab|site)\b"#
    public static let browsers: Set<String> = ["comet", "safari", "google chrome", "chrome", "arc", "firefox", "brave browser", "microsoft edge"]

    static let behindRe = Rx.make(behind)
    static let frontRe = Rx.make(frontLead)
    static let resultRe = Rx.make(result)
    static let hereRe = Rx.make(here)

    /// 1 behind words, 2 a leading front verb, 3 result words, 4 here words, 5 a browser in front -> front, else behind.
    public static func decide(text: String, frontApp: String?) -> (placement: JobPlacement, why: String) {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if Rx.has(behindRe, t) { return (.behind, "behind words") }
        if Rx.has(frontRe, t) { return (.front, "front verb") }
        if Rx.has(resultRe, t) { return (.behind, "result only") }
        if Rx.has(hereRe, t) { return (.front, "on this page") }
        if let app = frontApp?.lowercased(), browsers.contains(app) { return (.front, "browser in front") }
        return (.behind, "no browser in front")
    }
}

/// What he says to a job that's running: stop it, stop them all, go on after a pause, show it to him.
public enum JobWords {
    static let lead = #"^(?:(?:ok(?:ay)?|dot|please|no|wait|alright|hey)[,.!]?\s+)*"#
    static let stop = lead + #"(?:stop|cancel|abort|halt|quit|never ?mind|forget (?:it|that)|scratch that|that'?s enough|enough)(?:\s+(?:it|that|this|the job|now|please|there|what you(?:'re| are) doing|doing (?:that|this)))*\W*$"#
    static let stopAll = lead + #"(?:stop|cancel) (?:everything|all(?: of (?:it|them))?|all (?:the )?jobs|both)\W*$"#
    static let resume = lead + #"(?:go on|keep going|continue|carry on|resume|go ahead|you can (?:go on|continue|keep going)|finish (?:it|up)|i'?m done(?:,? (?:go on|continue))?)(?:\s+(?:please|now))?\W*$"#
    static let show = lead + #"(?:show me(?: (?:it|that|the (?:tab|window|page|result)))?|show it(?: to me)?|bring it (?:up|forward|here|over)|let me see(?: it)?|where is it|open it(?: up)?)\W*$"#

    /// One action on what is in front: one of these verbs and nothing after a second clause.
    static let singleLead = JobPlacementRule.lead + #"(?:click(?: on)?|press|tap|scroll|open|type|go back|close)\b"#
    static let secondClause = #"\b(?:and|then|after that|also|before|until)\b|[,;:]"#
    static let neverSingle = #"\b(?:find|search|download|check|submit|send|fill|look up|research)\b"#

    static let stopRe = Rx.make(stop)
    static let stopAllRe = Rx.make(stopAll)
    static let resumeRe = Rx.make(resume)
    static let showRe = Rx.make(show)
    static let singleLeadRe = Rx.make(singleLead)
    static let secondClauseRe = Rx.make(secondClause)
    static let neverSingleRe = Rx.make(neverSingle)

    static func clean(_ text: String) -> String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    public static func isStop(_ text: String) -> Bool { Rx.has(stopRe, clean(text)) }
    public static func isStopAll(_ text: String) -> Bool { Rx.has(stopAllRe, clean(text)) }
    public static func isResume(_ text: String) -> Bool { Rx.has(resumeRe, clean(text)) }
    public static func isShowMe(_ text: String) -> Bool { Rx.has(showRe, clean(text)) }

    /// "click export", "scroll down", "open page two": one small act on what is in front, which stays a talk tag (as
    /// fast as today). Anything with a second step, or a find, search, download or submit, is a job.
    public static func isSingleAct(_ text: String) -> Bool {
        let t = clean(text).trimmingCharacters(in: CharacterSet(charactersIn: ".!?"))
        guard Rx.has(singleLeadRe, t) else { return false }
        return !Rx.has(secondClauseRe, t) && !Rx.has(neverSingleRe, t)
    }
}

/// Case-insensitive regex helpers shared by the job rules.
enum Rx {
    static func make(_ pattern: String) -> NSRegularExpression {
        try! NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
    }
    static func has(_ re: NSRegularExpression, _ text: String) -> Bool {
        re.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) != nil
    }
}
