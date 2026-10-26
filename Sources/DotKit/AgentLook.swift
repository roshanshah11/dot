import Foundation

/// An agent's look in Home (parity HO-15, HO-16): an SF Symbol for what it does and a face for how it is doing.
public enum AgentLook {
    /// The symbol for an agent, by SK-05's rule table over its name and what it was made for.
    public static func symbol(name: String, brief: String) -> String {
        SkillAvatar.symbol(name: name, description: brief)
    }

    /// What it was made for: its founding ask and the lines of its CLAUDE.md that aren't Dot's template (the template's
    /// own words, "email" and "draft" among them, would give every agent the same symbol).
    public static func brief(claudeMD: String, template: String, founding: String) -> String {
        let stock = Set(template.components(separatedBy: .newlines).map { $0.trimmingCharacters(in: .whitespaces) })
        let own = claudeMD.components(separatedBy: .newlines).filter { line in
            let t = line.trimmingCharacters(in: .whitespaces)
            return !t.isEmpty && !stock.contains(t) && !t.hasPrefix("#")
        }
        return ([founding] + own).filter { !$0.isEmpty }.joined(separator: "\n")
    }
}

/// How an agent is doing, read off its thread (HO-16): its face in Home's rail and thread header.
public enum AgentMood: String, CaseIterable {
    /// Nothing happening: eyes closed, as the notch draws it.
    case rest
    /// A turn in flight: focused.
    case working
    /// Its last word asks him something: puzzled until he answers.
    case waiting
    /// Finished well in the last day: happy.
    case done
    /// Its last turn ended in an error: sleepy.
    case failed

    public var word: String {
        switch self {
        case .rest: return "idle"
        case .working: return "working"
        case .waiting: return "waiting on you"
        case .done: return "done"
        case .failed: return "failed"
        }
    }

    /// - rows: the thread's last rows, oldest first (role, text, time), as the transcript holds them.
    public static func of(running: Bool, rows: [(role: String, text: String, time: Date?)], now: Date = Date()) -> AgentMood {
        if running { return .working }
        var finished: Date??
        for row in rows.reversed() {
            switch row.role {
            case "user":
                // his word after its last one, and nothing running: nothing to show
                return .rest
            case "result":
                if row.text.hasPrefix("success") { if finished == nil { finished = .some(row.time) }; continue }
                if row.text.hasPrefix("stopped") { return .rest }
                return .failed
            case "assistant":
                if AgentResult.parse(row.text).isQuestion { return .waiting }
                let at = finished.flatMap { $0 } ?? row.time
                return at.map { now.timeIntervalSince($0) < 24 * 3600 } == true ? .done : .rest
            default:
                continue
            }
        }
        return .rest
    }
}
