import Foundation

/// His own Spotify library: the playlists in his sidebar and Liked Songs, read from Spotify's own cache by
/// scripts/dot-spotify-library.py and matched here by name (2026-10-21: "play my ... playlist" played a stranger's public
/// playlist with the same words). "play my X" looks only here; a playlist ask without "my" plays his own on an exact or
/// every-word match and otherwise searches Spotify as before. The script's `match` runs these same rules for the shell;
/// Tests/Fixtures/spotify/match-cases.json holds both to the same answers.
public enum SpotifyLibrary {
    public struct Entry: Equatable, Sendable {
        public let uri: String
        public let name: String
        /// He made it (his own), rather than follows it.
        public let ownerIsHim: Bool
        /// Its place in his sidebar; Liked Songs is -1.
        public let order: Int

        public init(uri: String, name: String, ownerIsHim: Bool, order: Int) {
            self.uri = uri
            self.name = name
            self.ownerIsHim = ownerIsHim
            self.order = order
        }

        public var isLiked: Bool { uri.hasSuffix(":collection") }
    }

    /// How a name matched the words.
    public enum Match: Int, Comparable, Sendable {
        case close = 1, everyWord, exact
        public static func < (a: Match, b: Match) -> Bool { a.rawValue < b.rawValue }
    }

    public static let likedName = "Liked Songs"
    /// Words that mean Liked Songs (normalized): "play my liked songs", "play my saved songs".
    static let likedAliases: Set<String> = ["liked songs", "liked song", "liked", "likes", "liked music", "liked tracks", "saved songs", "saved tracks",
                                            "saved music", "favorite songs", "favourite songs", "favorites", "favourites", "songs"]
    static let playable = try! NSRegularExpression(pattern: #"^(spotify:playlist:[A-Za-z0-9]{22}|spotify:user:[A-Za-z0-9._-]+:collection)$"#)

    static func isPlayable(_ uri: String) -> Bool {
        playable.firstMatch(in: uri, range: NSRange(location: 0, length: (uri as NSString).length)) != nil
    }

    // MARK: Reading

    /// The script's JSON lines, or a whole library.json (the bench's fixture and the tests'): Liked Songs first, then his
    /// playlists. Anything that isn't an entry with a playable uri and a name is dropped.
    public static func parse(_ text: String) -> [Entry] {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("{"), let data = trimmed.data(using: .utf8),
           let doc = try? JSONSerialization.jsonObject(with: data) as? [String: Any], doc["playlists"] != nil || doc["liked"] != nil {
            var out: [Entry] = []
            if let liked = doc["liked"] as? String, isPlayable(liked) { out.append(Entry(uri: liked, name: likedName, ownerIsHim: true, order: -1)) }
            for item in doc["playlists"] as? [[String: Any]] ?? [] {
                if let e = entry(item, fallbackOrder: out.count) { out.append(e) }
            }
            return out
        }
        return trimmed.split(separator: "\n").compactMap { line in
            guard let data = line.data(using: .utf8), let item = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
            return entry(item, fallbackOrder: 0)
        }
    }

    static func entry(_ item: [String: Any], fallbackOrder: Int) -> Entry? {
        guard let uri = item["uri"] as? String, isPlayable(uri), let name = item["name"] as? String, !name.isEmpty else { return nil }
        return Entry(uri: uri, name: name, ownerIsHim: item["owner_is_him"] as? Bool ?? false, order: (item["order"] as? NSNumber)?.intValue ?? fallbackOrder)
    }

    // MARK: Matching

    /// Lowercase letters and digits, one space between words: no emoji, accents, marks or punctuation ("&" is "and"), and
    /// no trailing "playlist(s)" or leading "my" when other words are left. "Road Trip 🚗 Playlist" is "road trip".
    public static func normalize(_ name: String) -> String {
        var out = String.UnicodeScalarView()
        for scalar in name.decomposedStringWithCompatibilityMapping.lowercased().unicodeScalars {
            switch scalar.properties.generalCategory {
            case .nonspacingMark, .spacingMark, .enclosingMark: continue
            case .uppercaseLetter, .lowercaseLetter, .titlecaseLetter, .modifierLetter, .otherLetter, .decimalNumber, .letterNumber, .otherNumber:
                out.append(scalar)
            default:
                if scalar == "'" || scalar == "\u{2018}" || scalar == "\u{2019}" || scalar == "`" { continue }
                out.append(contentsOf: (scalar == "&" ? " and " : " ").unicodeScalars)
            }
        }
        var words = String(out).split(separator: " ").map(String.init)
        if words.count > 1, let last = words.last, last == "playlist" || last == "playlists" { words.removeLast() }
        if words.count > 1, words.first == "my" { words.removeFirst() }
        return words.joined(separator: " ")
    }

    static func length(_ s: String) -> Int { s.unicodeScalars.count }

    static func stem(_ word: String) -> String {
        length(word) > 3 && word.hasSuffix("s") ? String(word.dropLast()) : word
    }

    /// Levenshtein distance, by unicode scalar.
    static func distance(_ a: String, _ b: String) -> Int {
        var x = Array(a.unicodeScalars), y = Array(b.unicodeScalars)
        if x.count < y.count { swap(&x, &y) }
        var prev = Array(0...y.count)
        for (i, cx) in x.enumerated() {
            var cur = [i + 1]
            for (j, cy) in y.enumerated() {
                cur.append(min(prev[j + 1] + 1, cur[j] + 1, prev[j] + (cx == cy ? 0 : 1)))
            }
            prev = cur
        }
        return prev[y.count]
    }

    static func closeWord(_ a: String, _ b: String) -> Bool {
        if a == b || stem(a) == stem(b) { return true }
        return min(length(a), length(b)) >= 4 && distance(a, b) <= 1
    }

    /// How a normalized ask matches a normalized name, and how close (lower is closer); nil when it doesn't.
    static func grade(_ ask: String, _ name: String, liked: Bool) -> (match: Match, closeness: Int)? {
        guard !ask.isEmpty, !name.isEmpty else { return nil }
        if liked, likedAliases.contains(ask) { return (.exact, 0) }
        let a = ask.split(separator: " ").map(String.init), n = name.split(separator: " ").map(String.init)
        let ac = a.joined(), nc = n.joined()
        if ask == name || ac == nc { return (.exact, 0) }
        let nameStems = Set(n.map(stem))
        if a.allSatisfy({ nameStems.contains(stem($0)) }) { return (.everyWord, n.count - a.count) }
        let d = distance(ac, nc)
        if length(nc) >= 4, d <= max(1, min(3, length(nc) / 4)) { return (.close, d) }
        if a.allSatisfy({ w in n.contains { closeWord(w, $0) } }) { return (.close, 1 + abs(n.count - a.count)) }
        let askStems = Set(a.map(stem))
        if length(nc) >= 4, a.count - n.count <= 2, n.allSatisfy({ askStems.contains(stem($0)) }) { return (.close, 2 + a.count - n.count) }
        return nil
    }

    /// The entries that match the words, best first: exact, then every word present, then close; his own before ones he
    /// follows; then the closer, then the higher in his sidebar.
    public static func rank(_ words: String, in entries: [Entry]) -> [(entry: Entry, match: Match)] {
        let ask = normalize(words)
        let scored = entries.compactMap { e -> (Entry, Match, Int)? in
            grade(ask, normalize(e.name), liked: e.isLiked).map { (e, $0.match, $0.closeness) }
        }
        return scored.sorted { l, r in
            if l.1 != r.1 { return l.1 > r.1 }
            if l.0.ownerIsHim != r.0.ownerIsHim { return l.0.ownerIsHim }
            if l.2 != r.2 { return l.2 < r.2 }
            if l.0.order != r.0.order { return l.0.order < r.0.order }
            return l.0.uri < r.0.uri
        }.map { (entry: $0.0, match: $0.1) }
    }

    /// What a playlist ask plays from his library, or nil: "my" takes his best match, close ones included, and never goes
    /// public; without "my" only an exact or every-word match is his, and anything less is Spotify's search as before.
    /// Albums, tracks and artists never come here.
    public static func pick(_ play: SpotifyPlay, in entries: [Entry]) -> Entry? {
        guard play.kind == .playlist, let best = rank(play.words, in: entries).first else { return nil }
        return play.mine || best.match >= .everyWord ? best.entry : nil
    }
}
