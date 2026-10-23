import AppKit
import DotKit
import Foundation

/// `Dot --lecture-demo` (his ask 2026-10-22: "build a test environment and show me how everything works a full example"):
/// lecture mode in his running Dot on a recorded class. Everything happens for real (the notes window, explainers in the
/// panel, slides into the notes, the 3 big ideas, the why, the gap-fill, the deadline boxes, the PDF), with three swaps: the
/// ear hears the recording (out loud, in step), the slide "on screen" comes from the recording's slide timeline, and the
/// notes, transcript and PDF go to a fresh sandbox run folder. Atlas gets nothing; his School folders and Desktop are
/// never written. The recording and its timeline are private: ~/Dot/talk/lecture-demo/demo.json.
enum LectureDemo {
    struct Slide: Decodable {
        /// Seconds into the recording when the slide came up.
        let at: Double
        /// A picture of the slide, relative to the demo folder.
        let image: String
        /// The slide's words, as the OCR of his screen would read them.
        let text: String
        var title: String { text.components(separatedBy: " / ").first ?? "" }
    }

    struct Fixture: Decodable {
        let audio: String
        let course: String
        let title: String
        let meets: String?
        /// The recording's day, yyyy-MM-dd.
        let date: String?
        /// Slides and readings copied into each run's course folder (for the writer's terms and the gap-fill).
        let materials: [String]
        let slides: [Slide]

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

    static func load(from folder: URL = root) -> Fixture? {
        guard let data = try? Data(contentsOf: folder.appendingPathComponent("demo.json")) else { return nil }
        do { return try JSONDecoder().decode(Fixture.self, from: data) }
        catch { Log.warn("lecture demo: demo.json: \(error)"); return nil }
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

    /// The newest run's course folder that has notes ("open my demo notes").
    static func lastRun(course: String) -> URL? {
        let names = ((try? FileManager.default.contentsOfDirectory(atPath: runs.path)) ?? []).sorted(by: >)
        return names.lazy.map { runs.appendingPathComponent($0).appendingPathComponent(course, isDirectory: true) }
            .first { FileManager.default.fileExists(atPath: $0.appendingPathComponent("\(course) notes.md").path) }
    }

    /// Which slide the recording has reached, by how far the replay has fed the recognizer (not the clock: the recognizer's
    /// model loads first, and the slides would run ahead of the words).
    @MainActor
    final class SlideClock {
        private let slides: [Slide]
        private let folder: URL
        private let position: () -> Double

        init(_ fixture: Fixture, folder: URL = LectureDemo.root, position: @escaping () -> Double) {
            slides = fixture.slides.sorted { $0.at < $1.at }
            self.folder = folder
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
    }
}
