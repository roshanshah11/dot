import Foundation

/// His saved logins (gopass) and the exact sites each one may go to (his call, 10-22: "atlas can log in. why cant u?").
/// A login fills only an https page whose host is listed for it in ~/Dot/jobs/logins.json, the way Chrome fills only an
/// exact origin without asking. Nothing pattern-based ever fills: a look-alike host gets nothing.
public enum Logins {
    /// The store's folders that hold website logins. The rest of it (Apple API keys, a bot token, the store's own
    /// passphrase) are secrets, never logins, and no page ever gets them.
    public static let folders: Set<String> = ["jobs", "websites"]

    public struct Entry: Equatable, Sendable {
        /// "jobs/northwind/sam@example.com"
        public let name: String
        /// "northwind"
        public let site: String
        /// "sam@example.com"; nil when the entry's last part is "password" (the account isn't stored).
        public let account: String?
    }

    /// A store name as a login: <folder>/<site>/<account> in a login folder, else nil.
    public static func entry(_ name: String) -> Entry? {
        let parts = name.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        guard parts.count == 3, folders.contains(parts[0]), !parts[1].isEmpty, !parts[2].isEmpty else { return nil }
        return Entry(name: name, site: parts[1].lowercased(), account: parts[2].lowercased() == "password" ? nil : parts[2])
    }

    /// The host as the map keys it: lowercased, no trailing dot.
    public static func normalize(_ host: String) -> String {
        var h = host.trimmingCharacters(in: .whitespaces).lowercased()
        while h.hasSuffix(".") { h.removeLast() }
        return h
    }

    /// The page's host when a login may go to it at all: https on port 443 (http on 127.0.0.1 only on the bench).
    public static func host(ofOrigin origin: String, bench: Bool) -> String? {
        guard let u = URL(string: origin), let scheme = u.scheme?.lowercased(), let raw = u.host, !raw.isEmpty else { return nil }
        let host = normalize(raw)
        if scheme == "https", u.port == nil || u.port == 443 { return host }
        if bench, scheme == "http", host == "127.0.0.1" || host == "localhost" { return host }
        return nil
    }

    public enum Match: Equatable {
        case one(Entry)
        case several([Entry])
        case none(suggestion: String?)
    }

    /// The login listed for this exact host. entries: the store's names (`gopass ls --flat`); map: entry name -> hosts.
    public static func match(host: String, entries: [String], map: [String: [String]]) -> Match {
        let h = normalize(host)
        let logins = entries.compactMap(entry)
        let hits = logins.filter { e in (map[e.name] ?? []).contains { normalize($0) == h } }
        if hits.count == 1 { return .one(hits[0]) }
        if hits.count > 1 { return .several(hits) }
        return .none(suggestion: suggestion(host: h, logins: logins))
    }

    /// Hiring systems whose first label is the firm: only a hint for him to add the host, never a fill.
    static let shapes = [#"^([a-z0-9-]+)\.tal\.net$"#, #"^([a-z0-9-]+)\.wd[0-9]+\.myworkdayjobs\.com$"#, #"^([a-z0-9-]+)\.taleo\.net$"#]

    static func suggestion(host: String, logins: [Entry]) -> String? {
        for shape in shapes {
            guard let re = try? NSRegularExpression(pattern: shape),
                  let m = re.firstMatch(in: host, range: NSRange(location: 0, length: (host as NSString).length)) else { continue }
            let slug = (host as NSString).substring(with: m.range(at: 1))
            if let e = logins.first(where: { $0.site == slug }) {
                return "if \(e.name) is the login for \(host), add \"\(host)\" under it in ~/Dot/jobs/logins.json"
            }
        }
        return nil
    }

    /// ~/Dot/jobs/logins.json: { "<entry>": ["<exact host>", ...] }. A missing or broken file is an empty map.
    public static func loadMap(_ path: String) -> [String: [String]] {
        guard let data = FileManager.default.contents(atPath: path),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        var map: [String: [String]] = [:]
        for (k, v) in json { if let hosts = v as? [String] { map[k] = hosts } }
        return map
    }

    /// The control that sends a login form: its name says log in, never sign up.
    static let loginWords = Rx.make(#"^\W*(?:log ?in|login|sign ?in|signin|log on|continue|next|submit|go)\W*$"#)
    static let signUpWords = Rx.make(#"\b(?:sign ?up|register|create|join|forgot|reset)\b"#)
    public static func isLoginButton(_ name: String) -> Bool {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return Rx.has(loginWords, n) && !Rx.has(signUpWords, n)
    }

    /// Two urls on the same origin (scheme, host, port).
    public static func sameOrigin(_ a: String, _ b: String) -> Bool {
        guard let x = URL(string: a), let y = URL(string: b), let hx = x.host, let hy = y.host else { return false }
        func port(_ u: URL) -> Int { u.port ?? (u.scheme?.lowercased() == "https" ? 443 : 80) }
        return x.scheme?.lowercased() == y.scheme?.lowercased() && normalize(hx) == normalize(hy) && port(x) == port(y)
    }

    /// Text going back to the model or the log, with the password taken out wherever a page echoed it.
    public static func scrub(_ text: String, secret: String) -> String {
        guard secret.count >= 3 else { return text }
        return text.replacingOccurrences(of: secret, with: "(hidden)")
    }
}

/// Sites that keep one session per login: opening the same site in a second window signs out his tab (tal.net, 10-22).
public enum SingleSessionSites {
    public static let suffixes = ["tal.net"]
    public static func covers(_ host: String) -> Bool {
        let h = Logins.normalize(host)
        return suffixes.contains { h == $0 || h.hasSuffix("." + $0) }
    }
}
