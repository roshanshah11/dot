import Foundation

/// The moments Dot marks with a sound (AU-04, after HeyClicky's ClickyChimeWarmer): an agent
/// starts fresh work, one needs his yes, one finishes, one fails. The defaults are the system
/// sounds Dot already used (Tink on a card, Glass on finish, Basso on failure) plus Pop for a
/// start; all four are in /System/Library/Sounds.
public enum ChimeEvent: String, CaseIterable, Sendable {
    case launch, needsYou, done, failed

    public var defaultName: String {
        switch self {
        case .launch: return "Pop"
        case .needsYou: return "Tink"
        case .done: return "Glass"
        case .failed: return "Basso"
        }
    }

    /// The word that turns one chime off in the token file.
    public static let silentName = "none"

    /// The sound for an event: his override (the token file's "chimes", keyed by event name:
    /// "launch", "needsYou", "done", "failed"; "needs_you" reads the same) when it is set, the default
    /// otherwise, per key. "none" silences that one event (nil). A name may be a system sound
    /// ("Hero") or a path to a sound file; whether it loads is the player's check.
    public static func resolve(_ event: ChimeEvent, overrides: [String: String]) -> String? {
        let wanted = key(event.rawValue)
        let value = overrides[event.rawValue] ?? overrides.first(where: { key($0.key) == wanted })?.value
        let name = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if name.isEmpty { return event.defaultName }
        if name.lowercased() == silentName { return nil }
        return name
    }

    /// Every event's sound at once (nil where silenced).
    public static func resolveAll(overrides: [String: String]) -> [ChimeEvent: String?] {
        var out: [ChimeEvent: String?] = [:]
        for event in allCases { out[event] = resolve(event, overrides: overrides) }
        return out
    }

    private static func key(_ text: String) -> String {
        text.lowercased().filter { $0.isLetter || $0.isNumber }
    }
}
