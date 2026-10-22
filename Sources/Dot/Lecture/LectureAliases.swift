import Foundation

/// The School folder each calendar course name goes in ("Intro to Examples" -> "EXMP 10100"), in ~/Dot/talk/courses.json:
/// saved the first time a course is placed, and his to correct.
enum LectureAliases {
    static var url: URL { URL(fileURLWithPath: DotConfig.expand("~/Dot/talk/courses.json")) }

    static func load() -> [String: String] {
        guard let data = try? Data(contentsOf: url), let map = try? JSONSerialization.jsonObject(with: data) as? [String: String] else { return [:] }
        return map
    }

    static func save(_ map: [String: String]) {
        guard let data = try? JSONSerialization.data(withJSONObject: map, options: [.prettyPrinted, .sortedKeys]) else { return }
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: url, options: .atomic)
    }
}
