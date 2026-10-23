import AppKit
import DotKit
import Foundation

/// `Dot --lecture-demo [name]` (his ask 2026-10-22: "build a test environment and show me how everything works a full
/// example"; then "can you find a better trasncript to test this on? a math one?"): lecture mode in his running Dot on a
/// recorded class. Everything happens for real (the lecture window, explainers on its board, slides and board photos into
/// the notes, the 3 big ideas, the why, the gap-fill, the deadline boxes, the PDF), with three swaps: the ear hears the
/// recording (out loud, in step), the slide "on screen" and the board photos come from the recording's timeline, and the
/// notes, transcript and PDF go to a fresh sandbox run folder. Atlas gets nothing; his School folders and Desktop are
/// never written. Each recording and its timeline are private: ~/Dot/talk/lecture-demo/<name>/demo.json.
enum LectureDemo {
    struct Slide: Decodable {
        /// Seconds into the recording when the slide came up.
        let at: Double
        /// A picture of the slide, relative to the demo's folder.
        let image: String
        /// The slide's words, as the OCR of his screen would read them.
        let text: String
        var title: String { text.components(separatedBy: " / ").first ?? "" }
    }

    /// A photo of the board, as he would AirDrop it in a chalkboard class.
    struct Board: Decodable {
        let at: Double
        let image: String
    }

    struct Fixture: Decodable {
        let name: String?
        let audio: String
        let course: String
        let title: String
        let meets: String?
        /// The recording's day, yyyy-MM-dd.
        let date: String?
        /// Slides and readings copied into each run's course folder (for the writer's terms and the gap-fill).
        let materials: [String]
        let slides: [Slide]
        let boards: [Board]?
        /// Where demo.json is; images are relative to it.
        var folder = LectureDemo.root

        enum CodingKeys: String, CodingKey { case name, audio, course, title, meets, date, materials, slides, boards }

        var audioURL: URL { URL(fileURLWithPath: DotConfig.expand(audio)) }

        /// The recording's day at today's time (the class clock still runs from now).
        var day: Date {
            let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
            guard let date, let d = f.date(from: date) else { return Date() }
            let now = Calendar.current.dateComponents([.hour, .minute, .second], from: Date())
            return Calendar.current.date(bySettingHour: now.hour ?? 12, minute: now.minute ?? 0, second: now.second ?? 0, of: d) ?? d
        }
    }

    static var root: URL { URL(fileURLWithPath: DotConfig.expand("~/Dot/talk/lecture-demo"), isDirectory: true) }
    static var runs: URL { root.appendingPathComponent("runs", isDirectory: true) }

    /// The demos there are (folders with a demo.json), the math one first: it is the default.
    static func names() -> [String] {
        let all = ((try? FileManager.default.contentsOfDirectory(atPath: root.path)) ?? [])
            .filter { FileManager.default.fileExists(atPath: root.appendingPathComponent($0).appendingPathComponent("demo.json").path) }.sorted()
        return all.filter { $0 == "math" } + all.filter { $0 != "math" }
    }

    /// The named demo, or the default one.
    static func load(_ name: String? = nil) -> Fixture? {
        let wanted = name?.lowercased().trimmingCharacters(in: .whitespaces)
        guard let pick = names().first(where: { wanted == nil || wanted == "" || $0.lowercased() == wanted }) else { return nil }
        let folder = root.appendingPathComponent(pick, isDirectory: true)
        guard let data = try? Data(contentsOf: folder.appendingPathComponent("demo.json")) else { return nil }
        do {
            var fixture = try JSONDecoder().decode(Fixture.self, from: data)
            fixture.folder = folder
            return fixture
        } catch {
            Log.warn("lecture demo: \(pick)/demo.json: \(error)")
            return nil
        }
    }

    /// A fresh run: runs/<time>/<course>/ with the fixture's materials copied in. The run folder gets the PDF.
    static func newRun(_ fixture: Fixture, under parent: URL = runs) -> (run: URL, course: URL)? {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd HH.mm.ss"; f.locale = Locale(identifier: "en_US_POSIX")
        let run = parent.appendingPathComponent(f.string(from: Date()), isDirectory: true)
        let course = run.appendingPathComponent(fixture.course, isDirectory: true)
        do { try FileManager.default.createDirectory(at: course, withIntermediateDirectories: true) }
        catch { Log.warn("lecture demo: no run folder: \(error)"); return nil }
        for path in fixture.materials {
            let source = URL(fileURLWithPath: DotConfig.expand(path))
            try? FileManager.default.copyItem(at: source, to: course.appendingPathComponent(source.lastPathComponent))
        }
        return (run, course)
    }

    /// The newest run that has notes, any demo ("open my demo notes"): its course and course folder.
    static func lastRun() -> (course: String, folder: URL)? {
        let fm = FileManager.default
        for name in ((try? fm.contentsOfDirectory(atPath: runs.path)) ?? []).sorted(by: >) {
            let run = runs.appendingPathComponent(name, isDirectory: true)
            for course in (try? fm.contentsOfDirectory(atPath: run.path)) ?? [] {
                let folder = run.appendingPathComponent(course, isDirectory: true)
                if fm.fileExists(atPath: folder.appendingPathComponent("\(course) notes.md").path) { return (course, folder) }
            }
        }
        return nil
    }

    /// What the recording has reached, by how far the replay has fed the recognizer (not the clock: the recognizer's model
    /// loads first, and the slides would run ahead of the words): the slide on screen, and board photos as they come due.
    @MainActor
    final class Timeline {
        private let slides: [Slide]
        private let boards: [Board]
        private let folder: URL
        private let position: () -> Double
        private var sentBoards = 0
        private var timer: Timer?

        init(_ fixture: Fixture, position: @escaping () -> Double) {
            slides = fixture.slides.sorted { $0.at < $1.at }
            boards = (fixture.boards ?? []).sorted { $0.at < $1.at }
            folder = fixture.folder
            self.position = position
        }

        var current: Slide? {
            let at = position()
            return slides.last { $0.at <= at }
        }

        var screenText: String { current?.text ?? "" }

        var shot: (jpeg: Data, title: String)? {
            guard let slide = current, let jpeg = try? Data(contentsOf: folder.appendingPathComponent(slide.image)) else { return nil }
            return (jpeg, slide.title)
        }

        /// Each board photo once the recording passes it (in a real class he AirDrops them).
        func startBoards(_ onPhoto: @escaping (Data) -> Void) {
            guard !boards.isEmpty else { return }
            timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
                MainActor.assumeIsolated {
                    guard let self else { return }
                    let at = self.position()
                    while self.sentBoards < self.boards.count, self.boards[self.sentBoards].at <= at {
                        let board = self.boards[self.sentBoards]
                        self.sentBoards += 1
                        if let jpeg = try? Data(contentsOf: self.folder.appendingPathComponent(board.image)) { onPhoto(jpeg) }
                    }
                    if self.sentBoards >= self.boards.count { self.stop() }
                }
            }
        }

        func stop() {
            timer?.invalidate()
            timer = nil
        }
    }
}
