import Foundation

/// An agent's final message, split into what to show and the one next step it suggested
/// (a trailing line "Next: ..."), which the notch turns into a button.
public struct AgentResult: Equatable {
    public let body: String
    public let nextAction: String?

    public static func parse(_ text: String) -> AgentResult {
        var lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        var next: String?
        while let last = lines.last {
            let trimmed = last.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { lines.removeLast(); continue }
            let lowered = trimmed.lowercased()
            if lowered.hasPrefix("next:") || lowered.hasPrefix("next step:") {
                let value = trimmed.drop(while: { $0 != ":" }).dropFirst().trimmingCharacters(in: .whitespaces)
                if !value.isEmpty, value.count <= 120 { next = value }
                lines.removeLast()
            }
            break
        }
        return AgentResult(body: lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines), nextAction: next)
    }
}
