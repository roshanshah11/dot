import Foundation

/// The fast click loop (parity CU-01): a job's model plans the clicks once (`drive` with its steps), and Dot runs them
/// itself: look, ask Jev which listed control does the current step, click it through the same hands and rules as any
/// job click, take the look that comes back, and go on. It hands back to the model when Jev isn't sure twice in a row,
/// when a step's control is his (a send, a submit, a buy), when a click fails, after 25 clicks, or when the steps run
/// out (then the done check, if it gave one).
public enum DriveLoop {
    public static let maxActs = 25
    public static let minProbability = 0.5
    public static let maxChoices = 40

    /// A control from a look's lines (`e12 button "Displays" [checked]`).
    public struct Candidate: Equatable {
        public let ref: String
        public let role: String
        public let name: String
        public let his: Bool
        public let disabled: Bool
        public let offScreen: Bool
        public init(ref: String, role: String, name: String, his: Bool = false, disabled: Bool = false, offScreen: Bool = false) {
            self.ref = ref; self.role = role; self.name = name; self.his = his; self.disabled = disabled; self.offScreen = offScreen
        }
    }

    private static let line = try! NSRegularExpression(pattern: #"^(e\d+) ([\w-]+) "((?:[^"\\]|\\.)*)""#)

    public static func candidates(look: String) -> [Candidate] {
        look.components(separatedBy: .newlines).compactMap { raw in
            let l = raw.trimmingCharacters(in: .whitespaces)
            guard let m = line.firstMatch(in: l, range: NSRange(l.startIndex..., in: l)),
                  let r = Range(m.range(at: 1), in: l), let ro = Range(m.range(at: 2), in: l), let n = Range(m.range(at: 3), in: l) else { return nil }
            return Candidate(ref: String(l[r]), role: String(l[ro]), name: String(l[n]).replacingOccurrences(of: "\\\"", with: "\""),
                             his: l.contains("[his]"), disabled: l.contains("[disabled]"), offScreen: l.contains("(off screen)"))
        }
    }

    /// The controls worth asking about for a step: never his own (a commit) or a disabled one; the ones sharing words
    /// with the step first, then the rest in page order, `maxChoices` at most.
    public static func shortlist(_ all: [Candidate], step: String) -> [Candidate] {
        let words = Set(tokens(step))
        let usable = all.filter { !$0.his && !$0.disabled && !$0.name.isEmpty }
        let scored = usable.enumerated().map { (i, c) -> (Int, Int, Candidate) in
            (Set(tokens(c.name)).intersection(words).count, i, c)
        }
        let sorted = scored.sorted { a, b in a.0 != b.0 ? a.0 > b.0 : (a.2.offScreen != b.2.offScreen ? !a.2.offScreen : a.1 < b.1) }
        return Array(sorted.prefix(maxChoices).map(\.2))
    }

    /// Jev's question for one step: which listed control does it, or none.
    public static func question(goal: String, step: String, choices: [Candidate]) -> (instructions: String, criteria: [String: String]) {
        var criteria: [String: String] = ["none": "none of these controls does this step (it is already done, or it needs typing, scrolling or a control that isn't listed)"]
        for c in choices { criteria[c.ref] = "\(c.role) \"\(c.name)\"" + (c.offScreen ? " (off screen)" : "") }
        let instructions = "Someone is doing this on a computer: \(goal). The step now: \(step). Pick the one control to click that does this step."
        return (instructions, criteria)
    }

    public enum Decision: Equatable {
        case click(String)
        case unsure(String)
    }

    public static func decide(choice: String?, probability: Double) -> Decision {
        guard let choice, choice != "none" else { return .unsure("jev picked none (\(String(format: "%.2f", probability)))") }
        guard probability >= minProbability else { return .unsure("jev wasn't sure (\(choice) at \(String(format: "%.2f", probability)))") }
        return .click(choice)
    }

    /// Where the loop is.
    public struct State: Equatable {
        public let steps: [String]
        public private(set) var index = 0
        public private(set) var acts = 0
        public private(set) var unsureInARow = 0
        public init(steps: [String]) { self.steps = steps.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty } }

        public enum Next: Equatable {
            case ask(String)
            case handBack(String)
            case finished
        }

        public var next: Next {
            if index >= steps.count { return .finished }
            if acts >= DriveLoop.maxActs { return .handBack("\(DriveLoop.maxActs) clicks without finishing") }
            if unsureInARow >= 2 { return .handBack("not sure which control does \"\(steps[index])\"") }
            return .ask(steps[index])
        }

        /// A click went through: the step is taken as done (each step is one click; the done check proves the end).
        public mutating func clicked() { acts += 1; unsureInARow = 0; index += 1 }
        public mutating func unsure() { unsureInARow += 1 }
    }

    /// "open Settings; Displays; Night Shift" or a list: the steps in order.
    public static func steps(_ raw: Any?) -> [String] {
        if let list = raw as? [String] { return list }
        guard let s = raw as? String else { return [] }
        return s.components(separatedBy: CharacterSet(charactersIn: ";\n")).flatMap { part -> [String] in
            part.contains(" > ") ? part.components(separatedBy: " > ") : [part]
        }.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    static func tokens(_ s: String) -> [String] {
        s.lowercased().split { !$0.isLetter && !$0.isNumber }.map(String.init).filter { $0.count >= 2 && !stop.contains($0) }
    }
    static let stop: Set<String> = ["the", "to", "on", "in", "of", "and", "a", "an", "it", "click", "open", "turn", "go", "then", "tap", "press", "select", "choose"]
}
