import Foundation

/// How a place card says how far (parity WI-02): walking time where walking makes sense, straight-line miles where it
/// doesn't. The time is Apple Maps' walking ETA from his home point.
public enum WalkTime {
    /// Farther than this in a straight line, nobody walks it: the card keeps the miles and asks for no route.
    public static let maxStraightMeters: Double = 3_000

    public static func worthAsking(straightMeters: Double) -> Bool { straightMeters >= 0 && straightMeters <= maxStraightMeters }

    static func minutes(_ seconds: Double) -> Int { max(1, Int((seconds / 60).rounded())) }

    /// "6 min walk"; an hour or more is "1 h 5 min walk".
    public static func phrase(seconds: Double) -> String {
        let total = minutes(seconds)
        if total < 60 { return "\(total) min walk" }
        let rest = total % 60
        return "\(total / 60) h" + (rest > 0 ? " \(rest) min" : "") + " walk"
    }

    /// What Dot says after the name: "a 6 minute walk", "an 8 minute walk", "a minute's walk".
    public static func spoken(seconds: Double) -> String {
        let total = minutes(seconds)
        if total == 1 { return "a minute's walk" }
        // eight, eleven, eighteen and the eighties start with a vowel sound
        let article = String(total).hasPrefix("8") || total == 11 || total == 18 ? "an" : "a"
        return "\(article) \(total) minute walk"
    }
}
