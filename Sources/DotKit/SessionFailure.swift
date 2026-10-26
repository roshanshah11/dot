import Foundation

/// Why a Claude turn failed, as one plain line Dot can say (parity AU-03, NO-07), instead of a flash of the CLI's own
/// text. The patterns are Claude Code's own messages (its 2.1.309 binary: "Not logged in · Please run /login", "OAuth
/// token has expired. Please run /login to sign in again.", "Unable to connect to API. Check your internet
/// connection", "Request timed out. Check your internet connection and proxy settings", "Repeated 529 Overloaded
/// errors", "Credit balance is too low", "Usage limit reached ...") and the errors under them.
public enum SessionFailure: String, Equatable, CaseIterable {
    case loggedOut
    case offline
    case usageLimit
    case overloaded
    case cliMissing
    case toolServerDown
    case tooLong

    /// The first kind whose words the text carries; nil for anything else (the caller keeps its own message).
    public static func classify(_ text: String) -> SessionFailure? {
        let t = text.lowercased()
        func has(_ words: [String]) -> Bool { words.contains { t.contains($0) } }
        if has(["not logged in", "please run /login", "run /login", "invalid api key", "oauth token has expired", "authentication_error",
                "claude auth login", "token has been revoked"]) { return .loggedOut }
        if has(["prompt is too long", "context limit reached", "context window"]) { return .tooLong }
        if has(["usage limit reached", "limit reached", "credit balance is too low", "out of usage credits", "rate_limit_error", "rate limited",
                "spend limit", "quota"]) { return .usageLimit }
        if has(["overloaded"]) || t.range(of: #"\b529\b"#, options: .regularExpression) != nil { return .overloaded }
        if has(["unable to connect to api", "request timed out", "connection error", "enotfound", "econnrefused", "etimedout",
                "econnreset", "getaddrinfo", "network is unreachable", "internet connection"]) { return .offline }
        if has(["no such file or directory", "enoent", "command not found", "not executable", "approve-version", "re-pinned"]) { return .cliMissing }
        if has(["mcp server", "mcp error", "failed to connect to mcp", "mcp tool"]) { return .toolServerDown }
        return nil
    }

    /// The reset time the CLI gave, if any: a unix time after a pipe ("...limit reached|1761580800"), or a clock time
    /// after "resets" / "reset at" ("resets 3pm", "will reset at 3:30 pm").
    public static func resetTime(in text: String, now: Date = Date(), calendar: Calendar = .current) -> Date? {
        if let r = text.range(of: #"\|(\d{10})\b"#, options: .regularExpression),
           let seconds = TimeInterval(text[r].dropFirst()) {
            return Date(timeIntervalSince1970: seconds)
        }
        guard let r = text.range(of: #"(?i)resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m"#, options: .regularExpression) else { return nil }
        let words = String(text[r])
        let numbers = words.components(separatedBy: CharacterSet.decimalDigits.inverted).filter { !$0.isEmpty }.compactMap(Int.init)
        guard var hour = numbers.first, hour >= 1, hour <= 12 else { return nil }
        let minute = numbers.count > 1 ? numbers[1] : 0
        let pm = words.lowercased().range(of: #"\d\s*p"#, options: .regularExpression) != nil
        if hour == 12 { hour = pm ? 12 : 0 } else if pm { hour += 12 }
        var parts = calendar.dateComponents([.year, .month, .day], from: now)
        parts.hour = hour
        parts.minute = minute
        guard let today = calendar.date(from: parts) else { return nil }
        return today > now ? today : calendar.date(byAdding: .day, value: 1, to: today)
    }

    /// One line in Dot's voice. `reset` is when a usage limit lifts, `server` the tool server that failed.
    public func line(reset: Date? = nil, server: String? = nil, calendar: Calendar = .current) -> String {
        switch self {
        case .loggedOut:
            return "I'm logged out of Claude. Run claude login in Terminal, then ask me again."
        case .offline:
            return "I can't reach Claude right now. The internet looks down."
        case .usageLimit:
            if let reset { return "I've hit the Claude usage limit. It resets at \(Self.clock(reset, calendar: calendar))." }
            return "I've hit the Claude usage limit for now."
        case .overloaded:
            return "Claude is overloaded right now. Try me again in a minute."
        case .cliMissing:
            return "I can't start Claude. The claude command is missing or needs an update."
        case .toolServerDown:
            let name = server.map { $0 == "atlas" ? "Atlas" : $0 } ?? "a tool server"
            return "\(name) didn't start, so I can't use it right now."
        case .tooLong:
            return "This conversation got too long for me. Ask again and I'll start fresh."
        }
    }

    static func clock(_ date: Date, calendar: Calendar) -> String {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        let h = (c.hour ?? 0) % 12 == 0 ? 12 : (c.hour ?? 0) % 12
        let m = c.minute ?? 0
        return "\(h)\(m == 0 ? "" : String(format: ":%02d", m)) \((c.hour ?? 0) < 12 ? "am" : "pm")"
    }
}

/// The same failure twice in 10 minutes is said once (AU-03).
public struct FailureVoice {
    public static let window: TimeInterval = 600
    private var said: [String: Date] = [:]
    public init() {}

    public mutating func admit(_ key: String, at now: Date = Date()) -> Bool {
        if let last = said[key], now.timeIntervalSince(last) < Self.window { return false }
        said[key] = now
        return true
    }
}

/// Why the document in front couldn't be read (AU-03): said once per document instead of a silent fallback.
public enum DocumentProblem: String, Equatable {
    case scanned, locked, unreadable, signIn, unreachable

    public func line(isPDF: Bool) -> String {
        let what = isPDF ? "this PDF" : "this page"
        switch self {
        case .scanned: return "I can't read \(what)'s text, it's a scan, so I'm going by what's on screen."
        case .locked: return "\(isPDF ? "This PDF" : "This page") is password protected, so I'm going by what's on screen."
        case .unreadable: return "I couldn't open \(what)'s text, so I'm going by what's on screen."
        case .signIn: return "\(isPDF ? "This PDF" : "This page") wants a sign-in before I can read it, so I'm going by what's on screen."
        case .unreachable: return "I couldn't load \(what) to read it, so I'm going by what's on screen."
        }
    }
}

/// The best passages of the document in front, for a deep (think) answer (VO-11): 3 to 5 with page numbers, under a
/// size cap, so the stronger model answers from the document's own words and the panel can cite them.
public enum DocumentPassages {
    public static let cap = 6000
    public static let perPassage = 1400

    public static func block(question: String, title: String, pages: [DocumentPage], isPDF: Bool, count: Int = 5, cap: Int = cap) -> String? {
        let wanted = max(3, min(count, 5))
        // more candidates than needed, then drop any that mostly repeat one already taken (windows on a page overlap)
        var hits: [DocumentHit] = []
        var taken: [Set<String>] = []
        for hit in DocumentSearch.bestPassages(for: question, in: pages, count: wanted * 4) where hit.score >= 1.0 {
            let words = Set(hit.passage.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init))
            if taken.contains(where: { Double($0.intersection(words).count) / Double(max(1, min($0.count, words.count))) > 0.6 }) { continue }
            hits.append(hit)
            taken.append(words)
            if hits.count == wanted { break }
        }
        guard !hits.isEmpty else { return nil }
        var lines = ["[document] the best passages of \"\(title)\" for his question (\(isPDF ? "pdf page numbers" : "sections")); answer from them and cite the page when you use one:"]
        var used = lines[0].count
        for hit in hits {
            var passage = hit.passage.split(whereSeparator: \.isWhitespace).joined(separator: " ")
            if passage.count > perPassage { passage = String(passage.prefix(perPassage - 1)) + "…" }
            let line = "p. \(hit.page): \"\(passage)\""
            if used + line.count + 1 > cap { break }
            lines.append(line)
            used += line.count + 1
        }
        return lines.count > 1 ? lines.joined(separator: "\n") : nil
    }
}
