import AVFoundation
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

    /// His Murmur recording of the class (he records long ones in Murmur as a backup, 2026-10-27), copied into the cache,
    /// when Dot's own recording is missing or covers at least two minutes less of the class than Murmur's. Murmur keeps
    /// the file in its temp folder only until it has transcribed it, so this finds it only while it is recording or just
    /// after. `from` is how far back the class goes: Dot's own start, or well before it when Dot resumed after a restart
    /// (its own recording then starts at the restart). `live` is where Dot's own part of the class began: a file that
    /// stopped before then is not this class's (LectureRecording.classPart). The copy is trimmed to `from...ended` and
    /// comes back with the time its first sample was recorded, which the transcript's clock counts from. Nil when there
    /// is none or Dot's own is as good.
    static func murmurBackup(from: Date, live: Date, ended: Date, own: URL?) -> (url: URL, start: Date)? {
        let temp = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("Murmur/temp", isDirectory: true)
        let keys: [URLResourceKey] = [.creationDateKey, .contentModificationDateKey]
        let candidates = ((try? FileManager.default.contentsOfDirectory(at: temp, includingPropertiesForKeys: keys)) ?? [])
            .filter { $0.pathExtension.lowercased() == "wav" }
            .compactMap { url -> (url: URL, made: Date, start: Date, seconds: TimeInterval)? in
                guard let v = try? url.resourceValues(forKeys: Set(keys)), let made = v.creationDate, let changed = v.contentModificationDate,
                      let kept = LectureRecording.classPart(made: made, changed: changed, from: from, live: live, to: ended) else { return nil }
                return (url, made, kept.start, kept.seconds)
            }
        guard let best = candidates.max(by: { $0.seconds < $1.seconds }) else { return nil }
        let ownSeconds = own.flatMap { try? AVAudioFile(forReading: $0) }.map { Double($0.length) / $0.processingFormat.sampleRate } ?? 0
        guard ownSeconds < best.seconds - 120 else { return nil }
        let target = folder.appendingPathComponent("murmur-\(Int(from.timeIntervalSince1970)).wav")
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try? FileManager.default.removeItem(at: target)
            var start = best.start
            do {
                try LectureRecording.trim(best.url, to: target, skip: best.start.timeIntervalSince(best.made), seconds: best.seconds)
            } catch {   // unreadable mid-recording: the whole file, its clock from when Murmur started it
                try? FileManager.default.removeItem(at: target)
                try FileManager.default.copyItem(at: best.url, to: target)
                start = best.made
            }
            Log.info(String(format: "lecture: after class: using his Murmur recording (%.0f min) over Dot's own (%.0f min)", best.seconds / 60, ownSeconds / 60))
            return (target, start)
        } catch {
            Log.warn("lecture: after class: couldn't copy the Murmur recording: \(error)")
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
    static func retranscribe(audio: URL, began: Date, transcriber: Transcriber, title: String, into transcriptFile: URL, talk: Bool = false) async -> String? {
        let started = Date()
        do {
            let turns = await Voices.turns(in: audio, talk: talk)
            let (paragraphs, seconds) = try await transcriber.transcribeLong(url: audio, turns: turns)
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
        return await run(ClaudeSession(label: "afterclass", claudePath: config.claudeExecutable, options: options), message: message, images: images,
                         timeout: 600, what: "reply", attempt: attempt)
    }

    /// The last pass (his ask 2026-10-27: "Save who they are to Atlas, research to fill in the gaps. get names right. make
    /// any fixes."): with the web, his research folders and Atlas (reads + `remember`), it corrects names and garbled
    /// facts, adds sourced context lines at a talk and saves the speakers to Atlas. Its reply is the after-class protocol
    /// plus one `atlas saved:` line. Nil when it can't run or doesn't come back.
    static func research(config: DotConfig, message: String) async -> String? {
        guard let talkMCP = config.talkMCPConfig.flatMap({ try? Data(contentsOf: URL(fileURLWithPath: DotConfig.expand($0))) }) else {
            Log.warn("lecture: research: no talk MCP config, so no Atlas; skipped")
            return nil
        }
        let stamp = ResearchConfigFile.stamp(Date())
        let mcp = FileManager.default.temporaryDirectory.appendingPathComponent("dot-research-\(stamp).json")
        guard let data = ResearchConfigFile.make(talkMCP: talkMCP, stamp: stamp), (try? data.write(to: mcp)) != nil else {
            Log.warn("lecture: research: the talk MCP config has no atlas server; skipped")
            return nil
        }
        defer { try? FileManager.default.removeItem(at: mcp) }
        var options = ClaudeSession.Options(cwd: config.talkRootURL, model: config.thinkModel)
        options.systemPrompt = NoteWriter.resource("notes-research.md").replacingOccurrences(of: "{{STYLE}}", with: NoteWriter.style)
        options.tools = ["WebSearch", "WebFetch", "Read", "Glob"]
        options.allowedTools = ResearchConfigFile.allowed
        options.permissionMode = "dontAsk"
        options.mcpConfigPath = mcp.path
        options.maxTurns = 60
        options.settingSources = ""
        options.permissionPromptOverStdio = false
        options.includePartialMessages = false
        options.extraArguments = ["--no-session-persistence", "--add-dir", DotConfig.expand("~/roshan")]
        return await run(ClaudeSession(label: "research", claudePath: config.claudeExecutable, options: options), message: message, images: [],
                         timeout: 900, what: "research", attempt: 1)
    }

    /// One message to a one-shot session; its final text (nil on an error, an exit or the timeout).
    private static func run(_ session: ClaudeSession, message: String, images: [Data], timeout: TimeInterval, what: String, attempt: Int) async -> String? {
        let started = Date()
        var steps = 0
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
                case .toolUse: steps += 1
                case .result(let info):
                    if info.isError { Log.warn("lecture: after class (\(what)): \(Log.short(info.resultText ?? info.subtype, 160))") }
                    finish(info.isError ? nil : (info.resultText ?? text))
                default: break
                }
            }
            session.onExit = { _ in finish(nil) }
            do { try session.start() } catch {
                Log.warn("lecture: after class (\(what)) didn't start: \(error)")
                finish(nil)
                return
            }
            session.send(text: message, images: images.map { (data: $0, mediaType: "image/jpeg") })
            DispatchQueue.main.asyncAfter(deadline: .now() + timeout) {
                if !finished { Log.warn("lecture: after class (\(what)): no reply in \(Int(timeout / 60)) min (try \(attempt))") }
                finish(nil)
            }
        }
        let clean = reply?.trimmingCharacters(in: .whitespacesAndNewlines)
        Log.info(String(format: "lecture: after class: %@ in %.0f s (try %d, %d tool call(s), %d chars)", what, Date().timeIntervalSince(started), attempt, steps, clean?.count ?? 0))
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

/// `Dot --after-class <notes.md> --class "CLASS 1 (Sun Oct 25)" [--transcript FILE] [--audio FILE] [--his N] [--out FOLDER]
/// [--ahead FILE] [--research] [--began "yyyy-MM-dd HH:mm:ss"]`: (`--research` runs the last pass too, and its Atlas saves
/// are real; `--began` is when the audio's first sample was recorded, so the transcript's clock matches the notes' times)
/// the after-class pass on a saved class, into a scratch copy, never his notes or his Desktop. `--his N` marks the class's
/// first N lines as his (classes saved before 10-25 kept no authorship). Prints what it added and fixed; exit 0 when the
/// pass came back.
@MainActor
enum AfterClassReplay {
    static func run(_ args: [String]) -> Bool {
        func value(_ flag: String) -> String? { args.firstIndex(of: flag).flatMap { $0 + 1 < args.count ? args[$0 + 1] : nil } }
        guard let notesPath = args.first(where: { !$0.hasPrefix("--") }), let key = value("--class") else {
            print("usage: Dot --after-class <notes.md> --class \"CLASS N (date)\" [--transcript FILE] [--audio FILE] [--his N] [--out FOLDER] [--ahead FILE] [--research] [--began \"yyyy-MM-dd HH:mm:ss\"]")
            return false
        }
        let config = DotConfig.peek()
        let source = URL(fileURLWithPath: DotConfig.expand(notesPath))
        let course = source.deletingLastPathComponent().lastPathComponent
        let out = URL(fileURLWithPath: DotConfig.expand(value("--out") ?? NSTemporaryDirectory() + "dot-after-class-\(Int(Date().timeIntervalSince1970))"))
            .appendingPathComponent(course, isDirectory: true)
        try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        guard let text = try? String(contentsOf: source, encoding: .utf8) else { print("FAIL: can't read \(source.path)"); return false }
        // a --began that doesn't parse is an error, not the replay's own start: that would shift every transcript time
        let clock = DateFormatter(); clock.dateFormat = "yyyy-MM-dd HH:mm:ss"; clock.locale = Locale(identifier: "en_US_POSIX")
        let explicitStart = value("--began").flatMap(clock.date(from:))
        if let given = value("--began"), explicitStart == nil { print("FAIL: --began \"\(given)\" is not yyyy-MM-dd HH:mm:ss"); return false }
        if args.contains("--began"), value("--began") == nil { print("FAIL: --began needs a time, yyyy-MM-dd HH:mm:ss"); return false }
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
                let began = explicitStart ?? started
                if let fresh = await AfterClassPass.retranscribe(audio: URL(fileURLWithPath: DotConfig.expand(audio)), began: began, transcriber: Transcriber(),
                                                                 title: "\(course) \(key)", into: transcriptOut, talk: course == LectureCourses.otherLectures) {
                    transcript = fresh
                    source = "transcribed again from the class audio"
                }
            } else {
                try? transcript.write(to: transcriptOut, atomically: true, encoding: .utf8)
            }
            guard !transcript.isEmpty else { print("FAIL: no transcript"); return }
            let materials = LectureMaterials.gather(folder: out, notesFile: notesOut, cap: 60_000)
            let pictures = AfterClassPass.slidePictures(notes, folder: out)
            let ahead = value("--ahead").flatMap { try? String(contentsOfFile: DotConfig.expand($0), encoding: .utf8) } ?? ""
            let message = AfterClass.message(heading: notes.heading, course: course, notes: notes, transcript: transcript, transcriptSource: source,
                                             materials: materials.text, slidePictures: pictures.count, ahead: ahead)
            print("message: \(message.count) chars, \(pictures.count) picture(s), materials: \(materials.files.joined(separator: ", "))")
            guard let reply = await AfterClassPass.ask(config: config, message: message, images: pictures) else { print("FAIL: the pass didn't come back"); return }
            let hisTitle = notes.blocks.contains { $0.author == .him } && !notes.title.isEmpty
            let outcome = AfterClass.apply(reply, to: &notes, titleLocked: hisTitle)
            if args.contains("--research") {
                let talk = course == LectureCourses.otherLectures
                let ask = (talk ? "[research] a talk, not a class\n\n" : "[research] a class\n\n")
                    + AfterClass.message(heading: notes.heading, course: course, notes: notes, transcript: transcript, transcriptSource: "the whole class",
                                         materials: "", slidePictures: 0, ahead: ahead)
                if let found = await AfterClassPass.research(config: config, message: ask) {
                    let more = AfterClass.apply(found, to: &notes, titleLocked: true, fixAdded: true)
                    print("\n==== research: \(more.fixed.count) fixed, \(more.added.count) added; atlas saved: \(ResearchConfigFile.saved(in: found) ?? "nothing")")
                    print(more.fixed.map { "~\($0.id): \($0.text)" }.joined(separator: "\n"))
                    print(more.added.map { "+ \($0.block.text)" }.joined(separator: "\n"))
                } else {
                    print("\n==== research didn't come back")
                }
            }
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
