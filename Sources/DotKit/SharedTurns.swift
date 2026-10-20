import Foundation

/// Talk and think are two Claude conversations, so neither hears what the other said. On 2026-10-19 08:58
/// talk answered Mock B 0.1(a), he asked "can you show it to me?", and think, whose last topic was 0.3,
/// put 0.3 on the panel; on 10-18 14:28 "walk me through how to do it" after a talk answer on 0.2 came back
/// as 0.1(a). Each turn now carries the exchanges the other conversation had since this one last spoke.
public struct SharedTurns: Sendable {
    public enum Side: String, Sendable { case talk, think }

    public struct Turn: Equatable, Sendable {
        public var side: Side
        public var asked: String
        public var said: String
        public var at: Date
        /// A talk turn that handed the question to think: its words go in the handoff itself.
        public var handedOff: Bool
    }

    public private(set) var turns: [Turn] = []
    public let keep: Int

    public init(keep: Int = 12) { self.keep = keep }

    public mutating func record(_ side: Side, asked: String, said: String, at: Date, handedOff: Bool = false) {
        let a = asked.trimmingCharacters(in: .whitespacesAndNewlines)
        let s = said.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !a.isEmpty || !s.isEmpty else { return }
        turns.append(Turn(side: side, asked: a, said: s, at: at, handedOff: handedOff))
        if turns.count > keep { turns.removeFirst(turns.count - keep) }
    }

    /// The other side's turns since `side` last spoke, oldest first: at most `limit`, none older than `window`.
    public func unseen(by side: Side, now: Date, limit: Int = 3, window: TimeInterval = 1800) -> [Turn] {
        let lastOwn = turns.last(where: { $0.side == side })?.at ?? .distantPast
        let fresh = turns.filter { $0.side != side && !$0.handedOff && $0.at > lastOwn && now.timeIntervalSince($0.at) <= window }
        return Array(fresh.suffix(limit))
    }

    /// The context lines for those turns; empty when there are none.
    public static func lines(_ turns: [Turn], said limit: Int = 280) -> [String] {
        guard !turns.isEmpty else { return [] }
        func short(_ text: String, _ n: Int) -> String {
            let flat = text.replacingOccurrences(of: "\n", with: " ")
            return flat.count <= n ? flat : String(flat.prefix(n)) + "…"
        }
        var lines = ["said since your last turn, in dot's other conversation (\"it\", \"that\" and \"show me\" may mean these; newest last):"]
        for turn in turns {
            lines.append("- he asked \"\(short(turn.asked, 160))\"; dot said \"\(short(turn.said, limit))\"")
        }
        return lines
    }
}

/// A Claude Code session's running cost total, kept per session id in a small file, so a resumed session's first
/// turn is charged its own cost and not everything before it.
public enum CostBaseline {
    /// The turn's cost and the new total. With no known baseline (a resumed session never saved), the turn is not
    /// charged: the reported figure is the whole history's.
    public static func turnCost(reported: Double, baseline: Double?) -> (turn: Double, total: Double) {
        guard let baseline else { return (0, reported) }
        return (max(0, reported - baseline), max(baseline, reported))
    }

    public static func load(_ file: URL, sessionId: String) -> Double? {
        guard let data = try? Data(contentsOf: file),
              let map = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return (map[sessionId] as? NSNumber)?.doubleValue
    }

    /// Keeps the 60 most recent sessions.
    public static func save(_ file: URL, sessionId: String, total: Double, keep: Int = 60) {
        var map = ((try? Data(contentsOf: file)).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }) ?? [:]
        var order = (map["_order"] as? [String]) ?? []
        order.removeAll { $0 == sessionId }
        order.append(sessionId)
        while order.count > keep { map.removeValue(forKey: order.removeFirst()) }
        map[sessionId] = total
        map["_order"] = order
        if let data = try? JSONSerialization.data(withJSONObject: map, options: [.sortedKeys]) { try? data.write(to: file, options: .atomic) }
    }
}
