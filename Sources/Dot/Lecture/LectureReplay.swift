import AppKit
import DotKit
import Foundation

/// `Dot --lecture-replay <audio> [--speed 4] [--course "EXMP 10100"] [--materials <folder>] [--out <folder>]
/// [--recall "..."] [--minutes N] [--from MIN]`, or `Dot --lecture-replay --demo [...]` for the lecture demo's recording,
/// slide timeline and materials (LectureDemo): a recorded lecture through lecture mode's real pipeline (the ear's recognizer, the
/// note writer, the notes window off every display, the end-of-class recall, gap-fill, save and PDF), in this process
/// and into a scratch folder, never his notes. Explainers are only logged (they need talk). Prints the notes, the
/// explain triggers and the timings; exit 0 when it produced notes and a PDF.
@MainActor
enum LectureReplay {
    static func run(_ args: [String]) -> Bool {
        func value(_ flag: String) -> String? { args.firstIndex(of: flag).flatMap { $0 + 1 < args.count ? args[$0 + 1] : nil } }
        let flagged = Set(args.indices.filter { args[$0].hasPrefix("--") }.map { $0 + 1 })
        let demo = args.contains("--demo") ? LectureDemo.load() : nil
        if args.contains("--demo"), demo == nil { print("FAIL: no demo.json in \(LectureDemo.root.path)"); return false }
        guard let audioPath = demo?.audio ?? args.indices.first(where: { !args[$0].hasPrefix("--") && !flagged.contains($0) }).map({ args[$0] }) else {
            print("usage: Dot --lecture-replay <audio>|--demo [--speed 4] [--course NAME] [--materials FOLDER] [--out FOLDER] [--recall TEXT] [--minutes N] [--from MIN]")
            return false
        }
        let audio = URL(fileURLWithPath: DotConfig.expand(audioPath))
        let speed = Double(value("--speed") ?? "") ?? 4
        let from = (Double(value("--from") ?? "") ?? 0) * 60
        let course = demo?.course ?? value("--course") ?? "EXMP 10100"
        let limit = Double(value("--minutes") ?? "").map { $0 * 60 / speed }
        let out = URL(fileURLWithPath: DotConfig.expand(value("--out") ?? NSTemporaryDirectory() + "dot-lecture-replay-\(Int(Date().timeIntervalSince1970))"))
        let folder = out.appendingPathComponent(course, isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        if let materials = value("--materials") {
            let source = URL(fileURLWithPath: DotConfig.expand(materials))
            for name in (try? FileManager.default.contentsOfDirectory(atPath: source.path)) ?? [] where LectureMaterials.readable.contains((name as NSString).pathExtension.lowercased()) {
                try? FileManager.default.copyItem(at: source.appendingPathComponent(name), to: folder.appendingPathComponent(name))
            }
        }
        for path in demo?.materials ?? [] {
            let source = URL(fileURLWithPath: DotConfig.expand(path))
            try? FileManager.default.copyItem(at: source, to: folder.appendingPathComponent(source.lastPathComponent))
        }
        let config = DotConfig.peek()
        let listener = LectureListener(transcriber: Transcriber())
        let window = NotesWindow()
        window.offscreen = true
        let explainers = LectureExplainers(config: config, course: course)
        var explains: [String] = []
        explainers.onShow = { title, markup in
            explains.append("[\(explains.count + 1)] \(title) (\(markup.count) chars)")
            try? markup.write(to: out.appendingPathComponent("explainer-\(explains.count).html"), atomically: true, encoding: .utf8)
            return true
        }
        explainers.readGap /= speed
        explainers.stale /= speed
        let session = LectureSession(course: course, courseTitle: demo?.title ?? course, folder: folder, endsAt: nil, listener: listener,
                                     writer: NoteWriter(config: config), window: window, explainers: explainers, now: demo?.day ?? Date())
        session.watchPhotos = false
        if let demo {
            let slides = LectureDemo.SlideClock(demo) { [weak listener] in listener?.replayPosition ?? 0 }
            session.screenText = { slides.screenText }
            session.slideShot = { slides.shot }
            session.meets = demo.meets ?? ""
            session.onAddDeadlines = { items in "demo: \(items.count) would go to Atlas; nothing was added" }
        }
        // the clock runs `speed` times faster here: cycles, pauses and explainers go by lecture time, not wall time
        session.clockScale = speed
        session.pdfFolder = out   // never his Desktop
        var finished: (URL, URL?)?
        session.onFinished = { file, pdf in finished = (file, pdf) }
        let started = Date()
        var ok = false
        let runLoop = { (until: () -> Bool, seconds: Double) in
            let deadline = Date().addingTimeInterval(seconds)
            while !until(), Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.1)) }
        }
        var replayEnded = false
        listener.onReplayEnded = { replayEnded = true }
        var startDone = false
        Task { @MainActor in
            defer { startDone = true }
            ok = await listener.start(title: course, replay: audio, speed: speed, from: from)
            guard ok else { print("FAIL: the recognizer didn't start"); return }
            let courseText = value("--course-map").flatMap { try? String(contentsOfFile: DotConfig.expand($0), encoding: .utf8) }
                ?? (demo != nil ? Talk.courseMapText(label: course, root: config.talkRootURL) : "")
            do { try session.start(courseText: courseText) }
            catch { print("FAIL note writer: \(error)"); ok = false }
        }
        runLoop({ startDone }, 180)
        guard ok else { return false }
        guard !window.isOnAnyDisplay else {
            window.close()
            print("FAIL: the notes window landed on a display; stopping")
            return false
        }
        // how far the words lag the sound: the recording's position next to the newest confirmed words, every 10 s
        let lagTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { _ in
            MainActor.assumeIsolated {
                print(String(format: "lag: at %.0f s, heard: …%@", listener.replayPosition, String(listener.feed.suffix(70))))
            }
        }
        runLoop({ replayEnded || limit.map { Date().timeIntervalSince(started) > $0 } == true }, 4 * 3600)
        lagTimer.invalidate()
        print("replay over after \(Int(Date().timeIntervalSince(started))) s; ending the class")
        Task { @MainActor in
            await session.end()
            await session.recall(value("--recall") ?? "")
            if session.phase == .why { await session.whyAnswered(value("--why") ?? "") }
        }
        runLoop({ finished != nil }, 600)
        print("\n==== notes (\(session.notes.blocks.count) lines)\n" + session.notes.markdown)
        print("\n==== explain triggers (\(explains.count))\n" + explains.joined(separator: "\n"))
        if let (file, pdf) = finished {
            print("\n==== saved \(file.path)\(pdf.map { "\npdf \($0.path)" } ?? "\nno pdf")")
            return pdf != nil && !session.notes.blocks.isEmpty
        }
        print("FAIL: the class never finished")
        return false
    }
}
