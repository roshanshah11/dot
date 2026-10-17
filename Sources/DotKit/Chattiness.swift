import Foundation

/// How much Dot says before he asks, as one number he sets (0 to 3, default 2). Lumière's "volume
/// control" for unprompted help (persona-C5). It maps onto the knobs that already exist rather than
/// replacing them: each gate is and-ed with its own setting (`proactiveNotices`, `suggestions`) and
/// each cooldown (`noticeCooldownMinutes`, `suggestionCooldownMinutes`) is scaled.
///
/// - 0: nothing unprompted (no deadline notices, no document or app-skill offers, no quips).
/// - 1: deadline notices only, their cooldown at 3x, a quip every 2 hours at most.
/// - 2: today's notices and offers, a quip every 40 minutes at most (his call 2026-10-17).
/// - 3: cooldowns at 0.5x, a quip every 20 minutes at most.
public struct Chattiness: Equatable, Sendable {
    public static let defaultLevel = 2

    /// The level after clamping to 0...3.
    public let level: Int
    /// Deadline notices on an app switch.
    public let notices: Bool
    /// Document suggestions ("want the gist of this?") and app-skill offers.
    public let offers: Bool
    /// The factor on every notice and offer cooldown.
    public let cooldownScale: Double
    /// The least time between two quips; nil means no quips at all.
    public let quipCooldown: TimeInterval?

    public init(_ level: Int) {
        self.level = min(max(level, 0), 3)
        switch self.level {
        case 0:
            notices = false; offers = false; cooldownScale = 1; quipCooldown = nil
        case 1:
            notices = true; offers = false; cooldownScale = 3; quipCooldown = 2 * 3600
        case 2:
            notices = true; offers = true; cooldownScale = 1; quipCooldown = 40 * 60
        default:
            notices = true; offers = true; cooldownScale = 0.5; quipCooldown = 20 * 60
        }
    }

    /// Any unprompted line at all, so Noticer knows whether to watch app switches.
    public var speaksUnprompted: Bool { notices || offers || quipCooldown != nil }

    /// A configured cooldown in minutes, scaled for this level, in seconds.
    public func cooldown(minutes: Int) -> TimeInterval {
        Double(minutes) * 60 * cooldownScale
    }
}
