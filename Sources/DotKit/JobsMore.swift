import CoreGraphics
import Foundation

/// Retry where it stopped (parity J3): a failed, stopped or cut-off job carries on in its own session and folder.
public enum JobRetry {
    public static let message = "[retry] the last turn failed or was stopped. check what is already done in this folder and on page.md, keep it, and continue from where it stopped; do not start over."

    /// A job Retry can pick up: one that failed, was stopped, or ended promising to finish later.
    public static func canRetry(_ phase: JobPhase, endLine: String) -> Bool {
        phase == .failed || phase == .stopped || (phase == .done && AgentRecovery.promisesLater(endLine))
    }
}

/// Jobs remember how (parity J4): `~/Dot/howtos/<host or app>.md`, one entry per task that worked after a detour.
///
///     # wyzant.com
///     ## apply to a tutoring job
///     steps: open wyzant.com/jobs, filter by subject, open the post, Apply, write the note, Submit
///     saved: 2026-10-26, job abc123, failures 0
public struct HowTo: Equatable {
    public var task: String
    public var steps: String
    public var saved: Date
    public var job: String
    public var failures: Int

    public init(task: String, steps: String, saved: Date, job: String, failures: Int = 0) {
        self.task = task; self.steps = steps; self.saved = saved; self.job = job; self.failures = failures
    }
}

public enum HowToBook {
    public static let maxAge: TimeInterval = 60 * 86_400
    public static let maxFailures = 2
    public static let maxPerKey = 20
    public static let maxText = 600

    /// The file key for a site (its host without www) or an app (its name, lowercased, words joined by dashes).
    public static func key(site: String) -> String? {
        let raw = site.trimmingCharacters(in: .whitespaces).lowercased()
        guard !raw.isEmpty else { return nil }
        let host = URL(string: raw.contains("://") ? raw : "https://\(raw)")?.host ?? raw
        let trimmed = host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
        let slug = trimmed.replacingOccurrences(of: #"[^a-z0-9.\-]+"#, with: "-", options: .regularExpression).trimmingCharacters(in: CharacterSet(charactersIn: "-."))
        return slug.isEmpty || slug.count > 80 ? nil : slug
    }

    private static let day: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "UTC"); return f
    }()

    public static func parse(_ text: String) -> [HowTo] {
        var out: [HowTo] = []
        var task: String?, steps = "", saved = Date.distantPast, job = "", failures = 0
        func flush() {
            if let t = task, !steps.isEmpty { out.append(HowTo(task: t, steps: steps, saved: saved, job: job, failures: failures)) }
            task = nil; steps = ""; saved = .distantPast; job = ""; failures = 0
        }
        for line in text.split(separator: "\n", omittingEmptySubsequences: false).map({ $0.trimmingCharacters(in: .whitespaces) }) {
            if line.hasPrefix("## ") { flush(); task = String(line.dropFirst(3)) }
            else if line.hasPrefix("steps: ") { steps = String(line.dropFirst(7)) }
            else if line.hasPrefix("saved: ") {
                let parts = line.dropFirst(7).split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
                if let d = parts.first.flatMap({ day.date(from: $0) }) { saved = d }
                for p in parts.dropFirst() {
                    if p.hasPrefix("job ") { job = String(p.dropFirst(4)) }
                    if p.hasPrefix("failures "), let n = Int(p.dropFirst(9)) { failures = n }
                }
            }
        }
        flush()
        return out
    }

    public static func render(key: String, _ entries: [HowTo]) -> String {
        "# \(key)\n" + entries.map { "\n## \($0.task)\nsteps: \($0.steps)\nsaved: \(day.string(from: $0.saved)), job \($0.job), failures \($0.failures)\n" }.joined()
    }

    /// A new entry: the same task (case aside) is replaced and starts with no failures; newest first, at most 20.
    public static func saving(_ new: HowTo, into entries: [HowTo]) -> [HowTo] {
        var entry = new
        entry.task = String(clean(new.task).prefix(120))
        entry.steps = String(clean(new.steps).prefix(maxText))
        guard !entry.task.isEmpty, !entry.steps.isEmpty else { return entries }
        return Array(([entry] + entries.filter { $0.task.lowercased() != entry.task.lowercased() }).prefix(maxPerKey))
    }

    /// What is still worth reading: younger than 60 days and failed fewer than twice.
    public static func live(_ entries: [HowTo], now: Date = Date()) -> [HowTo] {
        entries.filter { now.timeIntervalSince($0.saved) <= maxAge && $0.failures < maxFailures }
    }

    /// A job that was given these entries failed: each counts a failure.
    public static func failed(_ tasks: Set<String>, in entries: [HowTo]) -> [HowTo] {
        entries.map { var e = $0; if tasks.contains(e.task) { e.failures += 1 }; return e }
    }

    /// The keys a job's words or front page point at, among the keys on file ("apply on wyzant" finds wyzant.com).
    public static func keys(for words: String, url: String?, app: String?, among known: [String]) -> [String] {
        let text = (words + " " + (url ?? "") + " " + (app ?? "")).lowercased()
        let host = url.flatMap { key(site: $0) }
        let appKey = app.flatMap { key(site: $0) }
        return known.filter { k in
            if k == host || k == appKey { return true }
            // "wyzant.com" is found by "wyzant", an app's "google-sheets" by "google sheets"
            let name = (k.split(separator: ".").first.map(String.init) ?? k).replacingOccurrences(of: "-", with: " ")
            return name.count >= 3 && text.range(of: #"\b\#(NSRegularExpression.escapedPattern(for: name))\b"#, options: .regularExpression) != nil
        }
    }

    /// The lines a job's first message gets: newest five per key.
    public static func brief(_ book: [(key: String, entries: [HowTo])]) -> String? {
        let lines = book.flatMap { k, entries in entries.prefix(5).map { "last time on \(k), \($0.task): \($0.steps) (\(day.string(from: $0.saved)))" } }
        return lines.isEmpty ? nil : "[how-to] what worked before (follow it unless the page changed):\n" + lines.joined(separator: "\n")
    }

    private static func clean(_ s: String) -> String {
        s.replacingOccurrences(of: "\n", with: " ").replacingOccurrences(of: "#", with: "").split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}

/// Offer to take over (parity J5): in a walkthrough, once, after the second step, when he says he is lost or it is
/// taking forever, or when he has sat on a ring for 20 seconds.
public enum TakeoverOffer {
    public enum Reason: String, Equatable { case secondStep = "second step", lost = "he sounds lost", stalled = "stalled on a ring" }
    public static let stall: TimeInterval = 20
    public static let line = "Want me to just do it? I'll drive, you watch."

    public static func shouldOffer(stepsDone: Int, said: String? = nil, stalledFor: TimeInterval = 0, alreadyOffered: Bool, driving: Bool) -> Reason? {
        guard !alreadyOffered, !driving else { return nil }
        if let said, isLost(said) { return .lost }
        if stalledFor >= stall { return .stalled }
        if stepsDone == 2 { return .secondStep }
        return nil
    }

    public static func isLost(_ text: String) -> Bool {
        let t = text.lowercased()
        return ["i'm lost", "im lost", "i am lost", "taking forever", "taking so long", "this is taking", "i can't find", "i cant find",
                "i don't see it", "i dont see it", "where is it", "too many steps", "this is confusing"].contains { t.contains($0) }
    }
}

/// Where agents and jobs sit (parity J6): the bottom-right stack (today), or a slim column of windows on the left or
/// right edge of the screen he is on.
public enum EdgeSide: String, CaseIterable, Equatable {
    case corner, left, right
}

public enum EdgeDeck {
    public static let width: CGFloat = 230
    public static let wideWidth: CGFloat = 380
    public static let height: CGFloat = 132
    public static let gap: CGFloat = 8
    public static let inset: CGFloat = 10

    /// How many slim windows fit down one edge of `visible`.
    public static func fit(visible: CGRect) -> Int {
        max(0, Int((visible.height - inset * 2 + gap) / (height + gap)))
    }

    /// Frames (AppKit, bottom-left origin) for `count` windows down one edge of `visible`, from the top; the hovered
    /// one is wider. Windows that do not fit are not placed (they collapse to chips).
    public static func frames(count: Int, visible: CGRect, side: EdgeSide, hovered: Int? = nil) -> [CGRect] {
        guard side != .corner, count > 0 else { return [] }
        return (0..<min(count, fit(visible: visible))).map { i in
            let w = i == hovered ? wideWidth : width
            let x = side == .left ? visible.minX + inset : visible.maxX - inset - w
            let y = visible.maxY - inset - CGFloat(i + 1) * height - CGFloat(i) * gap
            return CGRect(x: x, y: y, width: w, height: height)
        }
    }

    /// The stack's window in edge mode: the column hangs from the top of `visible`, `inset` in from the side, and the
    /// window carries `pad` of glow room around the drawing (so it pokes `pad - inset` past the edge, all transparent).
    public static func window(fitting size: CGSize, visible: CGRect, side: EdgeSide, pad: CGFloat) -> CGRect {
        let inX = inset - pad
        let x = side == .left ? visible.minX + inX : visible.maxX - inX - size.width
        return CGRect(x: x, y: visible.maxY - inX - size.height, width: size.width, height: size.height)
    }

    /// In the edge column a live chip that would fold to its avatar stays a slim window, the first `fit` of them;
    /// the rest, and anything finished, keep the corner's rule.
    public static func presentation(_ p: AgentChip.Presentation, state: AgentChip.State, side: EdgeSide, slimSoFar: Int, fit: Int) -> AgentChip.Presentation {
        guard side != .corner, p == .avatar, slimSoFar < fit else { return p }
        switch state {
        case .running, .waiting, .unfinished, .attention: return .slim
        default: return p
        }
    }
}
