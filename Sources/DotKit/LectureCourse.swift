import Foundation

/// Which class is on, from his calendar, and which course folder its notes go in (lecture mode, 2026-10-22: "keep it
/// general + able to adapt"). His school schedule arrives as "Intro to Examples: Lecture" or
/// "Example Studies: Seminar"; any other course works the same way, and a title with a course code
/// ("ECON 20000 section") counts too.
public struct LectureClass: Equatable, Sendable {
    public var course: String
    public var kind: String
    public var start: Date
    public var end: Date
    public var location: String

    public init(course: String, kind: String, start: Date, end: Date, location: String = "") {
        self.course = course; self.kind = kind; self.start = start; self.end = end; self.location = location
    }

    /// Lab sessions are classes but not lectures: lecture mode is offered for the rest, and still starts in a lab when asked.
    public var offersNotes: Bool { !["laboratory", "lab"].contains(kind.lowercased()) }
}

public enum LectureCalendar {
    static let kinds = ["lecture", "seminar", "laboratory", "lab", "discussion", "section", "recitation", "tutorial", "class", "colloquium"]

    /// The class this calendar item is, or nil for anything else on his calendar.
    public static func asClass(_ item: CalendarItem) -> LectureClass? {
        guard !item.allDay else { return nil }
        let title = item.title.trimmingCharacters(in: .whitespaces)
        if let colon = title.lastIndex(of: ":") {
            let kind = title[title.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            let course = title[..<colon].trimmingCharacters(in: .whitespaces)
            if kinds.contains(kind.lowercased()), !course.isEmpty {
                return LectureClass(course: course, kind: kind, start: item.start, end: item.end, location: item.location)
            }
        }
        if let code = title.firstMatch(of: #/\b([A-Z]{3,5})\s?(\d{5})\b/#) {
            let lower = title.lowercased()
            let kind = kinds.first { lower.contains($0) }?.capitalized ?? "Class"
            return LectureClass(course: "\(code.1) \(code.2)", kind: kind, start: item.start, end: item.end, location: item.location)
        }
        let calendar = item.calendar.lowercased()
        if calendar.contains("course") || calendar.contains("class") {
            return LectureClass(course: title, kind: "Class", start: item.start, end: item.end, location: item.location)
        }
        return nil
    }

    /// The class going on now (from ten minutes before it starts to its end); the one that started last wins.
    public static func current(_ items: [CalendarItem], now: Date) -> LectureClass? {
        items.compactMap(asClass).filter { $0.start.addingTimeInterval(-600) <= now && now < $0.end }.max { $0.start < $1.start }
    }

    /// A class that offers notes and has just begun (from two minutes before to ten after its start): the moment to offer lecture mode.
    public static func starting(_ items: [CalendarItem], now: Date) -> LectureClass? {
        items.compactMap(asClass).first { $0.offersNotes && $0.start.addingTimeInterval(-120) <= now && now < $0.start.addingTimeInterval(600) }
    }
}

public enum LectureCourses {
    /// The School folder a course's notes go in: his saved answer first, then a course map naming it, then a folder whose
    /// name is the course or its code. Nil: Dot asks a small model once and saves the answer.
    public static func folder(for course: String, aliases: [String: String], maps: [CourseTag], folders: [String]) -> String? {
        let key = course.lowercased()
        if let saved = aliases.first(where: { $0.key.lowercased() == key })?.value { return saved }
        if let map = maps.first(where: { $0.isNamed(in: course) || $0.label.lowercased() == key }), let hit = folders.first(where: { $0.lowercased() == map.label.lowercased() }) {
            return hit
        }
        if let same = folders.first(where: { $0.lowercased() == key }) { return same }
        if let code = course.firstMatch(of: #/\b([A-Za-z]{3,5})\s?(\d{5})\b/#) {
            let label = "\(code.1.uppercased()) \(code.2)"
            if let hit = folders.first(where: { $0.uppercased() == label }) { return hit }
        }
        return nil
    }

    /// A folder name made from a course with no folder yet: path separators and dots out.
    public static func newFolderName(for course: String) -> String {
        let cleaned = course.replacingOccurrences(of: #"[/:\\.]"#, with: " ", options: .regularExpression)
            .split(separator: " ").joined(separator: " ")
        return cleaned.isEmpty ? "Other lectures" : String(cleaned.prefix(60))
    }
}

extension LectureCourses {
    /// The course folder a spoken name means ("my biotech notes", "math", "physics", "language and the human"): a folder
    /// named outright, then his saved calendar names, then a course map's name, then a department code the word starts with.
    public static func resolve(spoken: String, aliases: [String: String], maps: [CourseTag], folders: [String]) -> String? {
        let said = spoken.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !said.isEmpty else { return nil }
        if let hit = folders.first(where: { $0.lowercased() == said }) { return hit }
        let words = said.split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init).filter { $0.count >= 3 }
        func names(_ name: String) -> Bool {
            let parts = name.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init)
            return name.lowercased().contains(said) || words.contains { w in parts.contains { $0.hasPrefix(w) && w.count >= 4 } }
        }
        if let alias = aliases.first(where: { names($0.key) }), folders.contains(alias.value) { return alias.value }
        if let map = maps.first(where: { names($0.name) || $0.isNamed(in: said) }), let hit = folders.first(where: { $0.lowercased() == map.label.lowercased() }) {
            return hit
        }
        // "physics" -> "PHYS 13000", "math" -> "MATH 20000": the department code begins the word
        return folders.first { folder in
            guard let dept = folder.split(separator: " ").first.map({ $0.lowercased() }), dept.count >= 3, folder.contains(where: \.isNumber) else { return false }
            return words.contains { $0.hasPrefix(dept) || dept.hasPrefix($0) }
        }
    }
}

/// Is what's in front a slide (lecture mode puts a new slide's picture in the notes)? A deck app, a PDF viewer, Google
/// Slides, or a lecture deck or PDF open in the browser.
public enum LectureSlides {
    static let apps: Set<String> = ["com.microsoft.Powerpoint", "com.apple.iWork.Keynote", "com.apple.Preview", "net.sourceforge.skim-app.skim",
                                    "com.adobe.Reader", "com.adobe.Acrobat.Pro"]

    public static func looksLikeSlides(bundle: String?, title: String?, url: String?) -> Bool {
        if let bundle, apps.contains(bundle) { return true }
        let probe = ((title ?? "") + " " + (url ?? "")).lowercased()
        return probe.contains("docs.google.com/presentation") || probe.range(of: #"\.(pptx?|key|pdf)\b"#, options: .regularExpression) != nil
            || probe.range(of: #"\b(lec(ture)?|slides?)\b"#, options: .regularExpression) != nil
    }
}
