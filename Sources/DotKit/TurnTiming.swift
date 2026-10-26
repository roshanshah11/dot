import Foundation

/// The wait from the end of his turn to Dot's first sound (parity TI-01). A spoken question starts the clock when the
/// key comes up, a typed one when it arrives; the first sentence that starts playing stops it, once. Stamps are
/// system uptime. No target is enforced: the log line is for the bench and `dot-bench.py --timings`.
public struct FirstAudioClock: Sendable {
    public enum From: String, Sendable { case release, ask }

    /// A start older than this belonged to a turn that never spoke; the next sound (a quip, a notice) isn't its answer.
    public static let stale: TimeInterval = 60

    public private(set) var started: (at: TimeInterval, from: From)?

    public init() {}

    /// The key came up on a spoken question that is going to be transcribed.
    public mutating func released(at: TimeInterval) { started = (at, .release) }

    /// A question reached `ask`. A spoken one keeps a fresh release stamp (its transcript is what arrived); a typed
    /// one, or a spoken one with no key behind it (the bench, `Dot --ask --spoken`), starts here.
    public mutating func asked(at: TimeInterval, typed: Bool) {
        if !typed, let started, started.from == .release, at >= started.at, at - started.at < Self.stale { return }
        started = (at, .ask)
    }

    /// The turn won't speak (a quiet turn, a failed transcription).
    public mutating func cancel() { started = nil }

    /// A sentence started playing: the wait in milliseconds the first time, nil after that or when the start is stale.
    public mutating func heard(at: TimeInterval) -> (ms: Int, from: From)? {
        guard let started else { return nil }
        self.started = nil
        let gap = at - started.at
        guard gap >= 0, gap <= Self.stale else { return nil }
        return (Int((gap * 1000).rounded()), started.from)
    }

    public static func line(ms: Int, from: From) -> String { "speech: first-audio \(ms) ms from \(from.rawValue)" }
}

/// The wait from finishing a ringed step to the next ring (parity TI-02): the settle, the look and the model's answer.
public struct RingClock: Sendable {
    /// A gap longer than this is a walkthrough that sat waiting on him, not Dot's time.
    public static let stale: TimeInterval = 600

    public private(set) var done: (at: TimeInterval, how: String)?

    public init() {}

    /// The ringed step was clicked, rested on, or clicked by Dot.
    public mutating func stepDone(at: TimeInterval, how: String) { done = (at, how) }

    /// The next ring went up on `step`: its log line, or nil when no finished step came before it.
    public mutating func ringShown(at: TimeInterval, step: Int) -> String? {
        guard let done else { return nil }
        self.done = nil
        let gap = at - done.at
        guard gap >= 0, gap <= Self.stale else { return nil }
        return "walkthrough: ring-to-ring \(Int((gap * 1000).rounded())) ms (step \(step), \(done.how))"
    }

    public mutating func reset() { done = nil }
}
