import Foundation

// The top-right stack, the notch only while talking, and what a finished agent says (decided items 20, 21
// and 22 of the 2026-10-20 fast-lane plan). Pure rules over values the app already has; the app keeps the
// windows, the timers and the calls.

/// One chip in the stack at the top right: an agent at work, a job running behind his window, a consent
/// card, a notice that has an action, the morning card. HeyClicky's way: a new card shows for 5 s, then
/// folds to a 40 pt round avatar with a breathing ring; hover opens it; done is a check and one line for
/// 8 s; failed, stopped or interrupted is a red or amber mark and one line for 15 s; what needs him stays.
public enum AgentChip {
    public enum Kind: String, Codable, Sendable, CaseIterable { case agent, job, consent, notice }

    public enum State: String, Codable, Sendable, CaseIterable {
        /// At work.
        case running
        /// An agent whose question is on a card (the card is its own chip); the avatar wears "!".
        case waiting
        /// A job he paused by clicking in its tab: "paused · say go on" until he says it.
        case paused
        case done, failed, stopped, interrupted
        /// Its last line promised more ("still running", "as soon as"): "unfinished", with Continue.
        case unfinished
        /// A watch run that needs him, or an agent that asked him something: "!" until he looks.
        case attention
        /// A card that needs a choice: Allow or Not now.
        case consent
        /// A notice with an action; its owner removes it when its time is up.
        case notice
    }

    public enum Presentation: String, Equatable, Sendable { case card, avatar, gone }

    /// A new card folds to its avatar after this long.
    public static let cardSeconds: TimeInterval = 5
    /// Done: a check and one line, then gone.
    public static let doneSeconds: TimeInterval = 8
    /// Failed, stopped or interrupted: a red or amber mark and one line, then gone. Unfinished and
    /// attention cards show this long before they fold to a held avatar.
    public static let failedSeconds: TimeInterval = 15
    /// Newest on top, at most this many.
    public static let maxShown = 8
    /// The folded avatar's diameter, in points.
    public static let avatarSize: Double = 40

    /// How a chip shows now. `stateSince` is when its state last changed (never when its line or steps did,
    /// see `since`). Hover, or a card he opened, holds whatever it is. `holdUntil` keeps a card up for
    /// reading time (a muted Mac's text card). `folded` is Escape: every card that can fold becomes its
    /// avatar, a finished one goes, and a card that needs a choice stays.
    public static func presentation(state: State, stateSince: Date, hovering: Bool, expanded: Bool, now: Date,
                                    holdUntil: Date? = nil, folded: Bool = false) -> Presentation {
        if hovering || expanded { return .card }
        let age = now.timeIntervalSince(stateSince)
        let held = holdUntil.map { now < $0 } ?? false
        switch state {
        case .consent, .paused, .notice:
            return .card
        case .running:
            return !folded && (age < cardSeconds || held) ? .card : .avatar
        case .waiting:
            return held && !folded ? .card : .avatar
        case .unfinished, .attention:
            return !folded && (age < failedSeconds || held) ? .card : .avatar
        case .done:
            if folded { return .gone }
            return age < doneSeconds || held ? .card : .gone
        case .failed, .stopped, .interrupted:
            if folded { return .gone }
            return age < failedSeconds || held ? .card : .gone
        }
    }

    /// When a chip's clock starts: kept while the state stays the same (a new tool call, a streamed line,
    /// a step), and now when it changes. A chip seen for the first time starts now.
    public static func since(previous: (state: State, since: Date)?, newState: State, now: Date) -> Date {
        guard let previous, previous.state == newState else { return now }
        return previous.since
    }

    /// What `order` needs of a chip.
    public struct Entry: Equatable, Sendable {
        public let id: String
        public let state: State
        public let createdAt: Date
        public init(id: String, state: State, createdAt: Date) {
            self.id = id
            self.state = state
            self.createdAt = createdAt
        }
    }

    /// Top to bottom: a card that needs a choice first, then newest first by when each chip appeared (a
    /// state change never reshuffles the stack), at most `maxShown`.
    public static func order(_ entries: [Entry]) -> [Entry] {
        let sorted = entries.enumerated().sorted { a, b in
            let pa = a.element.state == .consent, pb = b.element.state == .consent
            if pa != pb { return pa }
            if a.element.createdAt != b.element.createdAt { return a.element.createdAt > b.element.createdAt }
            return a.offset > b.offset
        }.map(\.element)
        return Array(sorted.prefix(maxShown))
    }

    /// The words a chip's state wears on its card.
    public static func stateWord(_ state: State, kind: Kind) -> String {
        switch state {
        case .running: return "working"
        case .waiting: return "needs you"
        case .paused: return "paused · say go on"
        case .done: return "done"
        case .failed: return "failed"
        case .stopped: return "stopped"
        case .interrupted: return "interrupted"
        case .unfinished: return "unfinished"
        case .attention: return "needs you"
        case .consent: return "needs your yes"
        case .notice: return kind == .notice ? "" : "note"
        }
    }
}

/// The notch only while he talks (decided item 21, behind `notchTalkOnly`): from key down through the
/// answer, the typed field, and a typed or muted answer for its reading time. Idle shows nothing; the
/// resting tab stays on a notched screen only, where it is invisible and still opens the menu on a
/// right-click. A walkthrough, lesson or board row is a live exchange and keeps the panel up.
public enum NotchSurface {
    public enum Phase: String, Sendable { case hidden, listening, transcribing, thinking, speaking, done }

    public static let readingMinimum: TimeInterval = 8
    public static let readingPerCharacter: TimeInterval = 0.06

    /// 8 s, or 60 ms a character when that is longer.
    public static func readingTime(characters: Int) -> TimeInterval {
        max(readingMinimum, Double(max(characters, 0)) * readingPerCharacter)
    }

    /// Whether the notch's panel is up. `answerShownAt` is when a typed or muted answer landed (nil for
    /// none). A consent card opens the notch only with `consentInNotch` (off by default: the stack has it).
    /// `liveExchange`: a walkthrough, lesson or board row is on.
    public static func showsPanel(phase: Phase, showInput: Bool, answerShownAt: Date?, answerCharacters: Int,
                                  consentOpen: Bool, consentInNotch: Bool, liveExchange: Bool, now: Date) -> Bool {
        if phase != .hidden || showInput || liveExchange { return true }
        if consentOpen, consentInNotch { return true }
        if let shown = answerShownAt, now.timeIntervalSince(shown) < readingTime(characters: answerCharacters) { return true }
        return false
    }

    /// A right-click on the notch reaches Dot's menu only where there is a notch to click.
    public static func holdsMenu(hasNotch: Bool) -> Bool { hasNotch }

    /// The resting tab under the notch. With `notchTalkOnly` it stays only on a notched screen (black on the
    /// camera housing, so invisible, and it holds the menu); with no notch it would be a sliver at the top
    /// edge, so it goes and the ● comes back to the menu bar.
    public static func presence(configured: Bool, hasNotch: Bool, talkOnly: Bool) -> Bool {
        talkOnly ? configured && holdsMenu(hasNotch: hasNotch) : configured
    }
}

/// How a finished agent (or job) reports (decided item 22): a chime, a voice, the line as text, and
/// what its chip does. A muted Mac never gets a voice; the line shows as text instead.
public struct AgentReport: Equatable, Sendable {
    public enum Chip: String, Equatable, Sendable {
        /// No chip at all: a watch run with nothing for him lands in the transcript and Home's unread dot.
        case none
        /// The done (or failed) chip with its one line, on the usual clock.
        case row
        /// The chip holds as a card for reading time, showing the line he did not hear.
        case text
        /// A "!" card: a watch run that needs him, or a question.
        case alert
    }

    public let chime: Bool
    public let voice: Bool
    /// The line shows as text he can read (the card holds for reading time).
    public let text: Bool
    public let chip: Chip

    public init(chime: Bool, voice: Bool, text: Bool, chip: Chip) {
        self.chime = chime
        self.voice = voice
        self.text = text
        self.chip = chip
    }

    public static let quiet = AgentReport(chime: false, voice: false, text: false, chip: .row)

    /// - speakResults: his setting for spoken agent results.
    /// - routineMode: nil for an ask, else the routine's mode (a report run lands quietly; a watch run
    ///   speaks up only when `notify` says yes or it asks him something).
    /// - unprompted: a result nobody asked for (a helper's notice, a message the last turn folded in).
    /// - onCall: he is on a call (the mic is in use elsewhere and quietOnCalls is on).
    /// - threadOpen: he is reading this agent's thread in Home.
    /// - outputSilent: the speakers are muted or at zero.
    /// - isQuestion: the result asks him something.
    public static func decide(speakResults: Bool, routineMode: RoutineMode?, notify: Bool?, unprompted: Bool, onCall: Bool,
                              threadOpen: Bool, outputSilent: Bool, isQuestion: Bool) -> AgentReport {
        if unprompted { return quiet }
        var alert = isQuestion
        switch routineMode {
        case .report?:
            // A scheduled report lands in the thread without a chime or a word, as HeyClicky's routines do.
            if !isQuestion { return quiet }
        case .watch?:
            guard notify == true || isQuestion else { return AgentReport(chime: false, voice: false, text: false, chip: .none) }
            alert = true
        case nil:
            break
        }
        let silent = onCall || outputSilent
        let voice = !silent && speakResults && !threadOpen
        let text = !voice && !threadOpen
        let chip: Chip = alert ? .alert : (text ? .text : .row)
        return AgentReport(chime: !silent, voice: voice, text: text, chip: chip)
    }

    /// A consent card coming on show: its one line is spoken unless the Mac is muted or he is on a call,
    /// and shown as text either way (the card itself).
    public static func consentCard(speakResults: Bool, onCall: Bool, outputSilent: Bool) -> AgentReport {
        let voice = speakResults && !onCall && !outputSilent
        return AgentReport(chime: !onCall && !outputSilent, voice: voice, text: !voice, chip: .alert)
    }
}

/// A routine's mode (07): a report run says what changed; a watch run checks and speaks up only when
/// something needs him.
public enum RoutineMode: String, Codable, Sendable, CaseIterable {
    case report, watch

    /// Talk's tag keeps its shape, [ROUTINE:agent:when:brief]; a brief that starts "watch:" makes a
    /// watch routine, and the word leaves the brief.
    public static func split(brief: String) -> (mode: RoutineMode, brief: String) {
        let trimmed = brief.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.lowercased().hasPrefix("watch:") else { return (.report, trimmed) }
        return (.watch, String(trimmed.dropFirst(6)).trimmingCharacters(in: .whitespacesAndNewlines))
    }
}
