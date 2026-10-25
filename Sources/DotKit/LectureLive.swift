import Foundation

/// The classes lecture mode is writing now, by notes file, kept on disk so a Dot restart mid-class picks one up. Only
/// the class named here resumes: a finished class is cleared, so a second talk the same day in the same notes file (two
/// under "Other lectures") is a new class, not more of the first. A demo run's sandbox file never touches a real one.
public enum LectureLive {
    /// The class key ("CLASS 3 (Sun Oct 25)") going on in this notes file, if any.
    public static func key(for file: String, in url: URL) -> String? { load(url)[file] }

    public static func set(_ key: String, for file: String, in url: URL) {
        var live = load(url)
        live[file] = key
        save(live, to: url)
    }

    /// Clears the file's class only while it is still this one: a class started in the file since keeps its own.
    public static func clear(_ key: String, for file: String, in url: URL) {
        var live = load(url)
        guard live[file] == key else { return }
        live[file] = nil
        save(live, to: url)
    }

    static func load(_ url: URL) -> [String: String] {
        (try? Data(contentsOf: url)).flatMap { try? JSONDecoder().decode([String: String].self, from: $0) } ?? [:]
    }

    static func save(_ live: [String: String], to url: URL) {
        if live.isEmpty { try? FileManager.default.removeItem(at: url); return }
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? JSONEncoder().encode(live).write(to: url, options: .atomic)
    }
}
