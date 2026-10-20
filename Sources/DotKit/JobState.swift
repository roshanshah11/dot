import Foundation

/// A job's life: starting (the session is getting his words), running, paused (he clicked or typed in its tab), then one
/// of done, failed or stopped. Terminal phases accept nothing.
public enum JobPhase: String, Equatable, Sendable {
    case starting, running, paused, done, failed, stopped

    public var isTerminal: Bool { self == .done || self == .failed || self == .stopped }
    public var isLive: Bool { !isTerminal }

    public func next(_ event: JobEvent) -> JobPhase? {
        if isTerminal { return nil }
        switch (self, event) {
        case (.starting, .started): return .running
        case (.running, .paused): return .paused
        case (.paused, .resumed): return .running
        case (_, .finished): return self == .paused ? nil : .done
        case (_, .failed): return .failed
        case (_, .stopped): return .stopped
        default: return nil
        }
    }
}

public enum JobEvent: Equatable, Sendable { case started, paused, resumed, finished, failed, stopped }

/// His input that a job hears about. Only clicks and keys can pause a job; moves and scrolls never do.
public enum JobInput: String, Equatable, Sendable { case click, key, move, scroll }

public enum JobPauseRule {
    /// Whether his input pauses the job ("pause, then pick up", 2026-10-20).
    /// - A click pauses only when it isn't Dot's own, the job's app is frontmost, the point is inside the job's window
    ///   (nil: unknown, counts as inside) and, for a browser job, the job's tab has focus or the check failed (nil).
    /// - A key pauses on the same terms without the point.
    /// - Moves and scrolls never pause, and only a running job pauses.
    public static func shouldPause(input: JobInput, own: Bool, phase: JobPhase, frontBundle: String?, jobBundle: String?,
                                   isBrowserJob: Bool, jobTabFocused: Bool?, pointInJobWindow: Bool? = nil) -> Bool {
        if own || phase != .running { return false }
        guard input == .click || input == .key else { return false }
        guard let front = frontBundle, let job = jobBundle, front == job else { return false }
        if input == .click, pointInJobWindow == false { return false }
        if isBrowserJob { return jobTabFocused != false }
        return true
    }

    public enum AfterPause: Equatable, Sendable { case resume, drop }

    /// While paused: "go on" picks it up; anything else drops it and is answered as a new ask.
    public static func afterPause(_ text: String) -> AfterPause { JobWords.isResume(text) ? .resume : .drop }
}

/// The same step on the same page four times running: the job gets a nudge to try another way. Never a stop.
public enum JobRepeat {
    public static let limit = 4

    public static func isStuck(lastSteps: [String]) -> Bool {
        guard lastSteps.count >= limit, let last = lastSteps.last else { return false }
        return lastSteps.suffix(limit).allSatisfy { $0 == last }
    }
}

/// Which model a job runs on. Sonnet by default; Opus for anything written or designed under his name that he didn't
/// dictate (decks, composed texts, emails and documents), per his rule that prose under his name runs on Opus. Words he
/// dictated ("text alex running late") stay on the floor model.
public enum JobModel {
    static let prose = Rx.make(#"\b(?:deck|decks|presentation|slides?|slideshow|pitch deck|essay|cover letter|personal statement|memo|newsletter|blog post|substack)\b|\bwrite (?:me |him |her |them |up )?(?:a|an|the|my)\b|\bwrite (?:a |an )?(?:text|email|message|note|reply|letter) to\b|\bdraft (?:a|an|the|my|some)\b|\bcompose\b|\bsummary (?:for|to) (?!me\b)\w+|\breply to\b[^"“]{0,60}\b(?:saying|that|about)\b"#)

    public static func decide(text: String, floor: String = "sonnet", proseModel: String = "opus") -> String {
        Rx.has(prose, text) ? proseModel : floor
    }

    public static func isProse(_ text: String) -> Bool { Rx.has(prose, text) }
}

/// Which keys the session tap reports. Escape interrupts Dot, but never Dot's own Escape (a job's key); every other key
/// is only "he typed", for a job's pause rule.
public enum KeyTapRule {
    public static let escape: UInt16 = 53

    public static func emitsEscape(keyCode: UInt16, held: Bool, own: Bool) -> Bool { keyCode == escape && !held && !own }

    public static func emitsInput(keyCode: UInt16, held: Bool) -> Bool { keyCode != escape && !held }
}

/// Is a point covered? The accessibility element at the point decides when there is one: covered only when it belongs
/// to neither the front app nor Dot. With no element, the topmost ordinary window decides, as before.
public enum OcclusionRule {
    public static func decide(axPid: Int32?, cgTopPid: Int32?, frontPid: Int32?, ownPid: Int32) -> Bool {
        if let ax = axPid { return ax != frontPid && ax != ownPid }
        guard let top = cgTopPid, let front = frontPid else { return false }
        return top != front
    }
}
