import AppKit
import DotKit
import Foundation

/// The class audio lecture mode keeps for the after-class pass (his pick 2026-10-25: "keep until the pass"). It lives in
/// Dot's cache on this Mac only, never in School, and is deleted once the pass has transcribed it again; one a crash left
/// behind is deleted at the next launch.
enum LectureAudio {
    static var folder: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Dot/lecture-audio", isDirectory: true)
    }
    private static var marker: URL { folder.appendingPathComponent("recording.txt") }

    /// The recorder's file while class goes on (it writes it in the temporary folder): noted, so a crash can't strand it.
    static func noteRecording(_ url: URL) {
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try? url.path.write(to: marker, atomically: true, encoding: .utf8)
    }

    /// The finished recording moved into the cache; nil (and the file deleted) if it can't be kept.
    static func keep(_ url: URL) -> URL? {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd-HHmmss"; f.locale = Locale(identifier: "en_US_POSIX")
        let target = folder.appendingPathComponent("class-\(f.string(from: Date())).\(url.pathExtension.isEmpty ? "wav" : url.pathExtension)")
        try? FileManager.default.removeItem(at: marker)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try FileManager.default.moveItem(at: url, to: target)
            return target
        } catch {
            Log.warn("lecture: couldn't keep the class audio: \(error)")
            try? FileManager.default.removeItem(at: url)
            return nil
        }
    }

    static func discard(_ url: URL) {
        try? FileManager.default.removeItem(at: url)
        Log.info("lecture: class audio deleted")
    }

    /// At launch nothing is recording: whatever is left is a crash's.
    static func cleanUp() {
        let fm = FileManager.default
        var removed = 0
        if let path = try? String(contentsOf: marker, encoding: .utf8), fm.fileExists(atPath: path) {
            try? fm.removeItem(atPath: path); removed += 1
        }
        for name in (try? fm.contentsOfDirectory(atPath: folder.path)) ?? [] where name != "recording.txt" {
            try? fm.removeItem(at: folder.appendingPathComponent(name)); removed += 1
        }
        try? fm.removeItem(at: marker)
        if removed > 0 { Log.info("lecture: deleted \(removed) class audio file(s) left from before") }
    }
}

/// One careful read of the whole class after it ends (AfterClass in DotKit holds the contract and applies the reply):
/// the transcript made again from the audio when there is audio, the course's materials, the slide pictures, against
/// the notes. One `claude -p` on think's model (Opus), no tools, nothing saved.
@MainActor
enum AfterClassPass {
    /// The class transcribed again from its audio, written over the live transcript (same "**clock** words" form, so time
    /// chips keep working); nil when there's no audio or it yields nothing.
    static func retranscribe(audio: URL, began: Date, transcriber: Transcriber, title: String, into transcriptFile: URL) async -> String? {
        let started = Date()
        do {
            let (paragraphs, seconds) = try await transcriber.transcribeLong(url: audio)
            guard !paragraphs.isEmpty else { Log.warn("lecture: after class: the audio gave no words"); return nil }
            let text = TranscriptParagraphs.markdown(paragraphs, began: began, title: title)
            try? FileManager.default.createDirectory(at: transcriptFile.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? text.write(to: transcriptFile, atomically: true, encoding: .utf8)
            Log.info(String(format: "lecture: after class: %.0f min of audio transcribed again in %.0f s (%d words)", seconds / 60,
                            Date().timeIntervalSince(started), text.split(separator: " ").count))
            return text
        } catch {
            Log.warn("lecture: after class: transcribing the audio failed: \(error)")
            return nil
        }
    }

    /// The pass's reply (nil on failure); one more try if the first doesn't come back.
    static func ask(config: DotConfig, message: String, images: [Data]) async -> String? {
        for attempt in 1...2 {
            if let reply = await once(config: config, message: message, images: images, attempt: attempt) { return reply }
        }
        return nil
    }

    private static func once(config: DotConfig, message: String, images: [Data], attempt: Int) async -> String? {
        var options = ClaudeSession.Options(cwd: config.talkRootURL, model: config.thinkModel)
        options.systemPrompt = NoteWriter.resource("notes-afterclass.md").replacingOccurrences(of: "{{STYLE}}", with: NoteWriter.style)
        options.tools = []
        options.maxTurns = 1
        options.settingSources = ""
        options.permissionPromptOverStdio = false
        options.includePartialMessages = false
        options.extraArguments = ["--no-session-persistence"]
        let session = ClaudeSession(label: "afterclass", claudePath: config.claudeExecutable, options: options)
        let started = Date()
        let reply: String? = await withCheckedContinuation { done in
            var text = ""
            var finished = false
            func finish(_ value: String?) {
                guard !finished else { return }
                finished = true
                session.stop()
                done.resume(returning: value)
            }
            session.onEvent = { event in
                switch event {
                case .assistantText(let piece): text += piece
                case .result(let info):
                    if info.isError { Log.warn("lecture: after class: \(Log.short(info.resultText ?? info.subtype, 160))") }
                    finish(info.isError ? nil : (info.resultText ?? text))
                default: break
                }
            }
            session.onExit = { _ in finish(nil) }
            do { try session.start() } catch {
                Log.warn("lecture: after class: the pass didn't start: \(error)")
                finish(nil)
                return
            }
            session.send(text: message, images: images.map { (data: $0, mediaType: "image/jpeg") })
            DispatchQueue.main.asyncAfter(deadline: .now() + 600) {
                if !finished { Log.warn("lecture: after class: no reply in 10 min (try \(attempt))") }
                finish(nil)
            }
        }
        let clean = reply?.trimmingCharacters(in: .whitespacesAndNewlines)
        Log.info(String(format: "lecture: after class: reply in %.0f s (try %d, %d chars)", Date().timeIntervalSince(started), attempt, clean?.count ?? 0))
        return clean?.isEmpty == false ? clean : nil
    }

    /// The slide pictures in the notes, in order, read back from the course folder (at most `cap`).
    static func slidePictures(_ notes: ClassNotes, folder: URL, cap: Int = 12) -> [Data] {
        notes.blocks.compactMap { $0.image }.filter { $0.contains("/slide-") }.prefix(cap)
            .compactMap { try? Data(contentsOf: folder.appendingPathComponent($0)) }
    }

    /// A PDF name from a talk's title, for lectures that aren't a course: "guest talk on ventures notes.pdf".
    static func pdfName(course: String, title: String, dateLabel: String) -> String {
        let base = title.isEmpty ? "\(course) \(dateLabel)" : title
        let safe = base.replacingOccurrences(of: #"[/:\\]"#, with: " ", options: .regularExpression)
            .split(separator: " ").joined(separator: " ")
        return String(safe.prefix(80)) + " notes.pdf"
    }
}

/// `Dot --after-class <notes.md> --class "CLASS 1 (Sun Oct 25)" [--transcript FILE] [--audio FILE] [--his N] [--out FOLDER]`:
/// the after-class pass on a saved class, into a scratch copy, never his notes or his Desktop. `--his N` marks the class's
/// first N lines as his (classes saved before 10-25 kept no authorship). Prints what it added and fixed; exit 0 when the
/// pass came back.
@MainActor
enum AfterClassReplay {
    static func run(_ args: [String]) -> Bool {
        func value(_ flag: String) -> String? { args.firstIndex(of: flag).flatMap { $0 + 1 < args.count ? args[$0 + 1] : nil } }
        guard let notesPath = args.first(where: { !$0.hasPrefix("--") }), let key = value("--class") else {
            print("usage: Dot --after-class <notes.md> --class \"CLASS N (date)\" [--transcript FILE] [--audio FILE] [--his N] [--out FOLDER]")
            return false
        }
        let config = DotConfig.peek()
        let source = URL(fileURLWithPath: DotConfig.expand(notesPath))
        let course = source.deletingLastPathComponent().lastPathComponent
        let out = URL(fileURLWithPath: DotConfig.expand(value("--out") ?? NSTemporaryDirectory() + "dot-after-class-\(Int(Date().timeIntervalSince1970))"))
            .appendingPathComponent(course, isDirectory: true)
        try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        guard let text = try? String(contentsOf: source, encoding: .utf8) else { print("FAIL: can't read \(source.path)"); return false }
        var file = CourseNotesFile.parse(text, fallbackTitle: "\(course) notes")
        guard let section = file.section(key: key), var notes = ClassNotes.parse(section: section) else { print("FAIL: no \(key) in \(source.lastPathComponent)"); return false }
        if let n = value("--his").flatMap(Int.init), n > 0 {
            var marked = ClassNotes(number: notes.number, dateLabel: notes.dateLabel, title: notes.title)
            for (i, b) in notes.blocks.enumerated() {
                if i < n { marked.add(id: "h\(i + 1)", after: marked.blocks.last?.id, depth: b.depth, text: b.text, at: b.at) }
                else { marked.append(depth: b.depth, text: b.text, at: b.at) }
            }
            notes = marked
        }
        // the course folder's materials and pictures come along into the copy
        let folder = source.deletingLastPathComponent()
        for name in (try? FileManager.default.contentsOfDirectory(atPath: folder.path)) ?? [] where LectureMaterials.readable.contains((name as NSString).pathExtension.lowercased()) && name != source.lastPathComponent {
            try? FileManager.default.copyItem(at: folder.appendingPathComponent(name), to: out.appendingPathComponent(name))
        }
        if FileManager.default.fileExists(atPath: folder.appendingPathComponent("notes-images").path) {
            try? FileManager.default.copyItem(at: folder.appendingPathComponent("notes-images"), to: out.appendingPathComponent("notes-images"))
        }
        let notesOut = out.appendingPathComponent(source.lastPathComponent)
        let transcriptOut = out.appendingPathComponent("transcript.md")
        var done = false, ok = false
        let started = Date()
        Task { @MainActor in
            defer { done = true }
            var transcript = value("--transcript").flatMap { try? String(contentsOfFile: DotConfig.expand($0), encoding: .utf8) } ?? ""
            var source = "the live machine transcript"
            if let audio = value("--audio") {
                if let fresh = await AfterClassPass.retranscribe(audio: URL(fileURLWithPath: DotConfig.expand(audio)), began: started, transcriber: Transcriber(),
                                                                 title: "\(course) \(key)", into: transcriptOut) {
                    transcript = fresh
                    source = "transcribed again from the class audio"
                }
            } else {
                try? transcript.write(to: transcriptOut, atomically: true, encoding: .utf8)
            }
            guard !transcript.isEmpty else { print("FAIL: no transcript"); return }
            let materials = LectureMaterials.gather(folder: out, notesFile: notesOut, cap: 60_000)
            let pictures = AfterClassPass.slidePictures(notes, folder: out)
            let message = AfterClass.message(heading: notes.heading, course: course, notes: notes, transcript: transcript, transcriptSource: source,
                                             materials: materials.text, slidePictures: pictures.count)
            print("message: \(message.count) chars, \(pictures.count) picture(s), materials: \(materials.files.joined(separator: ", "))")
            guard let reply = await AfterClassPass.ask(config: config, message: message, images: pictures) else { print("FAIL: the pass didn't come back"); return }
            let hisTitle = notes.blocks.contains { $0.author == .him } && !notes.title.isEmpty
            let outcome = AfterClass.apply(reply, to: &notes, titleLocked: hisTitle)
            file.upsert(notes)
            try? file.markdown.write(to: notesOut, atomically: true, encoding: .utf8)
            let pdf = out.appendingPathComponent(AfterClassPass.pdfName(course: course, title: notes.title, dateLabel: notes.dateLabel))
            try? await NotesWindow().exportPDF(markdown: CourseNotesFile(title: notes.title.isEmpty ? notes.key : notes.title, sections: [notes.markdown]).markdown,
                                               baseURL: out, to: pdf)
            print("\n==== \(outcome.summary)\(outcome.title.map { ", titled \"\($0)\"" } ?? "") in \(Int(Date().timeIntervalSince(started))) s")
            print("\n==== added\n" + outcome.added.map { "after \($0.after): \(String(repeating: "  ", count: $0.block.depth))- \($0.block.text)" }.joined(separator: "\n"))
            print("\n==== fixed\n" + outcome.fixed.map { "\($0.id): \($0.text)" }.joined(separator: "\n"))
            print("\n==== reply\n" + reply)
            print("\n==== saved \(notesOut.path)\npdf \(pdf.path)")
            ok = true
        }
        while !done { RunLoop.main.run(until: Date().addingTimeInterval(0.1)) }
        return ok
    }
}
