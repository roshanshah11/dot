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

    /// A homework window on screen: his syllabus bars AI help there, so the prompt is told.
    public static func homeworkHint(title: String?, url: String?) -> String? {
        let hay = ((title ?? "") + " " + (url ?? "")).lowercased()
        let marks = ["homework", "gradescope", "problem set", "pset", "hw_", "hw ", " hw"]
        guard marks.contains(where: { hay.contains($0) }) else { return nil }
        let what = (title?.isEmpty == false ? title : url) ?? ""
        return "policy: this window looks like homework (\(what)). his syllabus bars ai help with homework at every stage: teach the idea on a different problem or point to the notes instead."
    }
}
