import Foundation

/// Backing off when he doesn't take something up. Lumière's ignored help timed out "after a brief
/// apology" and was not offered again until his topic changed (persona-C6, C7); Clippy offered the
/// same letter help "no matter how many times the user had rejected this offer" (persona-C15).
///
/// Offers (a document gist, an app's skill) keep yes and no counts per kind in UserDefaults
/// (`Noticer.record`). An offer left to time out with no reply is a soft decline, two soft declines
/// count as one no, and three no's with no yes retire the kind. A deadline notice is a statement, not
/// a question, so it has no reply to time out on: instead the same item is not noticed again until its
/// due date or the app in front changes.
public enum BackOff {
    /// How long an offer waits for "yes" or "no" (Talk.offerSuggestion); past it, it timed out.
    public static let replyWindow: TimeInterval = 45
    /// Declines that retire a kind he has never said yes to.
    public static let retireAfter = 3
    /// The least time between two notices of one item, even in another app (Noticer's four hours).
    public static let itemGap: TimeInterval = 4 * 3600

    /// One kind's counts, as UserDefaults keeps them (`dot.suggest.<kind>.yes`, `.no`, `.soft`).
    public struct Tally: Equatable, Sendable {
        public var yes: Int
        public var no: Int
        /// Offers that timed out with no reply.
        public var soft: Int

        public init(yes: Int = 0, no: Int = 0, soft: Int = 0) {
            self.yes = yes
            self.no = no
            self.soft = soft
        }

        /// Declines, two soft ones counting as one.
        public var declines: Int { no + soft / 2 }
        /// Three declines and no yes retire the kind; a single yes keeps it.
        public var retired: Bool { yes == 0 && declines >= BackOff.retireAfter }
    }

    /// An offer waiting on his word, so a timer can tell whether it was ever answered.
    public struct Pending: Equatable, Sendable {
        public let kind: String
        public let at: Date

        public init(kind: String, at: Date) {
            self.kind = kind
            self.at = at
        }

        public func expired(at now: Date) -> Bool { now.timeIntervalSince(at) >= BackOff.replyWindow }
    }

    /// Where an item was noticed: its due date ("" when it has none) and the app in front.
    public struct Context: Equatable, Sendable {
        public let due: String
        public let app: String

        public init(due: String, app: String) {
            self.due = due
            self.app = app
        }
    }

    public struct Seen: Equatable, Sendable {
        public let context: Context
        public let at: Date

        public init(context: Context, at: Date) {
            self.context = context
            self.at = at
        }
    }

    /// An Atlas line split into the item and its due date. "2026-10-17 centerview coffee chats: ..."
    /// is the item "centerview coffee chats: ..." due "2026-10-17", so a deadline that moves is the
    /// same item with a new date. A line with no leading date (a commitment) has due "".
    public static func item(_ line: String) -> (id: String, due: String) {
        let head = line.prefix(10)
        guard head.count == 10, head.prefix(4).allSatisfy(\.isNumber), head.dropFirst(4).first == "-" else {
            return (String(line.prefix(60)), "")
        }
        let rest = line.dropFirst(10).trimmingCharacters(in: .whitespaces)
        return (String(rest.prefix(60)), String(head))
    }

    /// Whether to notice an item now. The first time, or when its due date moved (that is news), yes.
    /// Otherwise not until the app in front has changed, and never within `gap` of the last notice.
    public static func mayNotice(_ id: String, in context: Context, now: Date, seen: [String: Seen], gap: TimeInterval = itemGap) -> Bool {
        guard let last = seen[id] else { return true }
        if last.context.due != context.due { return true }
        if last.context.app == context.app { return false }
        return now.timeIntervalSince(last.at) >= gap
    }
}
