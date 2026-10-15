import Foundation

/// Two small rules talk mode applies before a tool runs or a screen is described.
public enum TalkGuard {
    /// The one tool talk mode may run besides Atlas: python for a number he will rely on.
    /// Only a single quoted `-c` program or a `- <<'PY'` heredoc, so nothing else rides along.
    public static func isComputationCommand(_ command: String) -> Bool {
        let cmd = command.trimmingCharacters(in: .whitespacesAndNewlines)
        let pythons = ["/opt/homebrew/bin/python3.13", "python3"]
        guard let python = pythons.first(where: { cmd.hasPrefix($0 + " ") }) else { return false }
        let rest = String(cmd.dropFirst(python.count + 1))
        if rest.hasPrefix("-c ") {
            let body = rest.dropFirst(3)
            guard body.count >= 2, let quote = body.first, quote == "'" || quote == "\"" else { return false }
            let inner = body.dropFirst().dropLast()
            return body.last == quote && !inner.contains(quote)
        }
        for opener in ["- <<'PY'\n", "- <<PY\n", "- <<\"PY\"\n"] where rest.hasPrefix(opener) {
            return cmd.hasSuffix("\nPY")
        }
        return false
    }
}
