import AppKit
import DotKit
import Foundation

/// One class in lecture mode (his ask 2026-10-22: "takes notes and fill out this doc of notes in my style during/throughout
/// the lecture... use the panel to explain things... pull up anything useful"; round two the same day: complete notes,
/// explainers built in the background and shown at pauses, the transcript kept as text). The ear's words go to the note
/// writer about every 30 seconds; its lines land in the notes window and the course's notes file, each stamped with the
/// moment it came from; he types into the same notes and his lines stay his. At the end: his 3 big ideas, one "why",
/// feedback, lines added from the slides and readings, announced deadlines offered for Atlas, and the PDF on his Desktop.
@MainActor
final class LectureSession {
    enum Phase: Equatable { case live, closing, recall, why, finishing, done }

    let course: String
    let courseTitle: String
    let folder: URL
    let fileURL: URL
    private(set) var notes: ClassNotes
    private(set) var phase: Phase = .live
    private var file: CourseNotesFile
    private let window: NotesWindow
    private let writer: NoteWriter
    private let listener: LectureListener
    private let explainers: LectureExplainers
    private let startedAt = Date()
    /// The day the class is on: today, except in the lecture demo (the recording's day, so "next week" lands right).
    private let classDay: Date
    /// When the calendar says the class ends: the recall comes up a few minutes after if he hasn't ended it.
    let endsAt: Date?
    private var sentChars = 0
    private var lastCycleAt = Date()
    private var chunkStart = ""
    private var edits: [String] = []
    private var focused: String?
    private var lastSlide = ""
    private var tickTimer: Timer?
    private var secondTimer: Timer?
    private var recallTimer: DispatchWorkItem?
    private var saveWork: DispatchWorkItem?
    private var photos: BoardPhotos?
    private var setup: NoteWriter.Setup?
    private var restarts = 0
    private var pendingPhotos: [(jpeg: Data, block: String)] = []
    /// What was said, chunk by chunk ("11:42:10", words): saved as text next to the notes, never audio.
    private var transcript: [(clock: String, text: String)] = []
    private var deadlines: [(id: String, due: String, title: String, line: String?)] = []
    private var terms: [String] = []

    /// Where the course's PDF goes after class: his Desktop (his pick); the replay test points it at its scratch folder.
    var pdfFolder = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Desktop", isDirectory: true)
    /// The days the class meets ("Tue/Thu"), from his calendar: a "week 9" deadline lands on a class day.
    var meets = ""
    /// Board photos AirDropped to Downloads go into the notes (off in the replay test).
    var watchPhotos = true
    /// The slide or page on his screen, read by OCR (empty when nothing readable).
    var screenText: () async -> String = { "" }
    /// The slide window's picture when a slide is up in front (a deck, a PDF): a JPEG and the slide's first line.
    var slideShot: () async -> (jpeg: Data, title: String)? = { nil }
    /// Deadlines he checked, for Atlas; answers with the line to show.
    var onAddDeadlines: (([(due: String, title: String)]) async -> String)?
    /// The class is over: the notes file and the PDF (nil when it could not be made).
    var onFinished: ((URL, URL?) -> Void)?

    var cycleSeconds: TimeInterval = 30
    var cycleWords = 75
    static let gapFillCap = 6
    static let recallSeconds = 120
    static let whySeconds = 90
    /// A gap this long in the words means the speaker paused: a ready explainer can open.
    var pauseSeconds: TimeInterval = 1.2

    init(course: String, courseTitle: String, folder: URL, endsAt: Date?, listener: LectureListener, writer: NoteWriter, window: NotesWindow,
         explainers: LectureExplainers, now: Date = Date()) {
        self.course = course
        self.courseTitle = courseTitle
        self.folder = folder
        self.endsAt = endsAt
        self.listener = listener
        self.writer = writer
        self.window = window
        self.explainers = explainers
        classDay = now
        fileURL = folder.appendingPathComponent("\(course) notes.md")
        let existing = (try? String(contentsOf: fileURL, encoding: .utf8)).map { CourseNotesFile.parse($0, fallbackTitle: "\(course) notes") }
        file = existing ?? CourseNotesFile(title: "\(course) notes")
        // Dot restarted mid-class: today's section on top is this class, picked up where it was.
        let today = ClassNotes.dateLabel(now)
        if let top = file.sections.first, let head = CourseNotesFile.classHeading(top.components(separatedBy: "\n")[0]), head.date == today,
           let resumed = ClassNotes.parse(section: top) {
            notes = resumed
        } else {
            notes = ClassNotes(number: file.nextClassNumber, date: now)
        }
    }

    var isResumed: Bool { !notes.blocks.isEmpty }
    /// Lecture time per wall second (the replay test plays faster than real time).
    var clockScale = 1.0
    var minutes: Int { Int(Date().timeIntervalSince(startedAt) * clockScale / 60) }
    var explainersShown: Int { explainers.shown }

    /// The lecture's clock: "11:42:10" (in the replay, lecture time, not wall time).
    func lectureClock(_ date: Date = Date()) -> String {
        let f = DateFormatter(); f.dateFormat = "HH:mm:ss"; f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: startedAt.addingTimeInterval(date.timeIntervalSince(startedAt) * clockScale))
    }

    var transcriptURL: URL {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        return folder.appendingPathComponent("\(course) transcripts", isDirectory: true)
            .appendingPathComponent("\(f.string(from: classDay)) CLASS \(notes.number).md")
    }

    func start(courseText: String) throws {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let materials = LectureMaterials.gather(folder: folder, notesFile: fileURL)
        let setup = NoteWriter.Setup(course: courseTitle == course ? course : "\(course), \(courseTitle)", courseText: courseText,
                                     materials: materials.text, heading: notes.heading)
        self.setup = setup
        try writer.start(setup)
        window.onMessage = { [weak self] message in self?.received(message) }
        window.show(course: course, heading: notes.key, title: notes.title, status: "listening", blocks: notes.blocks.map(Self.windowBlock), baseURL: folder)
        explainers.onMark = { [weak self] line, state in self?.window.markExplain(id: line, state: state) }
        var first = "[start] \(notes.heading), \(course)" + (courseTitle == course ? "" : " (\(courseTitle))")
        if let endsAt { first += ", until \(Self.clock(endsAt))" }
        if isResumed { first += "\nresuming after a restart; the notes so far:\n" + notes.tail(400).joined(separator: "\n") }
        first += "\nreply nothing until the speech starts."
        writer.send(first) { _, _ in }
        chunkStart = lectureClock()
        save()
        tickTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        secondTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.everySecond() }
        }
        if watchPhotos {
            let photos = BoardPhotos(since: startedAt)
            photos.onPhoto = { [weak self] jpeg, at, _ in self?.boardPhoto(jpeg, at: at) }
            photos.start()
            self.photos = photos
        }
        boostTerms(courseText + "\n" + materials.text)
        Log.info("lecture: notes for \(course) \(notes.key) in \(fileURL.path)\(isResumed ? " (resumed)" : ""); materials: \(materials.files.joined(separator: ", "))")
    }

    /// The course map's and the slides' terms go to the recognizer (in the background; the first time downloads its model).
    private func boostTerms(_ text: String) {
        let fresh = LectureTerms.extract(text, limit: 150)
        let merged = Array(NSOrderedSet(array: terms + fresh).array.compactMap { $0 as? String }.prefix(200))
        guard merged != terms else { return }
        terms = merged
        Task { await listener.setTerms(merged) }
    }

    // MARK: The live loop

    private func everySecond() {
        guard phase == .live else { return }
        let words = listener.liveTail.split(separator: " ").suffix(12).joined(separator: " ")
        window.hearing(words)
        explainers.tick(paused: Date().timeIntervalSince(listener.lastHeardAt) >= pauseSeconds / max(clockScale, 1))
    }

    private func tick() {
        guard phase == .live else { return }
        if let endsAt, Date() > endsAt.addingTimeInterval(180) {
            Log.info("lecture: the class ended at \(Self.clock(endsAt)); wrapping up")
            Task { await end() }
            return
        }
        window.setStatus("listening · \(minutes) min · \(notes.blocks.count) lines")
        guard !writer.isBusy else { return }
        let words = newSpeech().split(separator: " ").count
        let waited = Date().timeIntervalSince(lastCycleAt) * clockScale
        if words >= cycleWords || (words >= 20 && waited >= cycleSeconds) || (!edits.isEmpty && waited >= cycleSeconds) || !pendingPhotos.isEmpty {
            Task { await cycle() }
        }
    }

    private func newSpeech() -> String {
        let feed = listener.feed
        guard feed.count > sentChars else { return "" }
        return String(feed.dropFirst(sentChars)).trimmingCharacters(in: .whitespaces)
    }

    /// One cycle: the new speech, the slide when it changed, his edits, and the end of the notes.
    func cycle(final: Bool = false) async {
        guard !writer.isBusy else { return }
        let speech = newSpeech()
        let feedEnd = listener.feed.count
        let clock = chunkStart
        let slide = final ? "" : String(await screenText().prefix(900))
        var lines = ["[minute \(minutes)] new speech (machine transcribed; names and terms may be misspelled):", "\"\(speech.isEmpty ? "(nothing new)" : speech)\""]
        var newSlide: (shot: (jpeg: Data, title: String), at: String)?
        if !slide.isEmpty, Self.changed(slide, from: lastSlide) {
            lines.append("slide on his screen (OCR): \"\(slide)\"")
            lastSlide = slide
            // the picture now; the writer marks where it goes ([slide]: after what was said before the change, before what
            // the slide brought), else it goes after this stretch's lines (the words run a few seconds behind the screen)
            if let shot = await slideShot() { newSlide = (shot, clock) }
            boostTerms(slide)
        }
        if !edits.isEmpty {
            lines.append("his edits since last time:")
            lines += edits.map { "- " + $0 }
        }
        let photosSent = pendingPhotos
        if !photosSent.isEmpty {
            lines.append("he AirDropped \(photosSent.count == 1 ? "a photo" : "\(photosSent.count) photos") of the board, attached, already in the notes as \(photosSent.map(\.block).joined(separator: ", ")): add notes from what it shows that the notes don't have yet (formulas, a diagram's labels, worked steps), and send a ? line if it's hard.")
        }
        if !notes.blocks.isEmpty {
            lines.append("the notes end like this now:")
            lines += notes.tail()
        }
        if final { lines.append("this is the end of the class: finish any thought left open.") }
        let sentEdits = edits.count
        sentChars = feedEnd
        lastCycleAt = Date()
        chunkStart = lectureClock()
        pendingPhotos.removeFirst(photosSent.count)
        if !speech.isEmpty { keepTranscript(clock: clock, text: speech) }
        let reply: (String?, Double) = await withCheckedContinuation { done in
            writer.send(lines.joined(separator: "\n"), images: photosSent.map(\.jpeg)) { text, seconds in done.resume(returning: (text, seconds)) }
        }
        if reply.0 == nil, let newSlide { placeSlide(newSlide.shot, at: newSlide.at) }   // the stretch goes again, after it
        guard let text = reply.0 else {
            // a stuck or failed reply: a fresh writer picks up from the notes, and this stretch is sent again
            sentChars = max(0, min(sentChars, feedEnd - speech.count))
            restartWriter(reason: "no reply in \(Int(reply.1)) s")
            return
        }
        edits.removeFirst(min(sentEdits, edits.count))
        let applied = apply(text, live: !final, at: clock, slide: newSlide)
        Log.info(String(format: "lecture: cycle %d (%.1f s, model %.1f s): %d words in, %@", writer.cycles, reply.1, Double(writer.lastApiMs) / 1000,
                        speech.split(separator: " ").count, applied))
        // a long class keeps one writer only so long: its context grows and its replies slow; a fresh one gets the notes
        cyclesSinceStart += 1
        if !final, cyclesSinceStart >= Self.refreshEvery { restartWriter(reason: "fresh writer after \(cyclesSinceStart) cycles") }
    }

    /// The writer's reply onto the notes and the window, with a new slide's picture where it marked `[slide]`; a short
    /// summary for the log.
    @discardableResult
    private func apply(_ reply: String, live: Bool, at clock: String? = nil, slide: (shot: (jpeg: Data, title: String), at: String)? = nil) -> String {
        var slide = slide
        let (ops, ignored) = NoteProtocol.parse(reply)
        var ops2: [NotesWindow.Op] = []
        var added = 0, rewritten = 0
        var lastLine: String?
        for op in ops {
            switch op {
            case .append(let depth, let text):
                // his line in progress at the bottom stays at the bottom
                let before = focused.flatMap { id in notes.blocks.last?.id == id ? id : nil }
                if let block = notes.append(depth: depth, text: text, before: before, at: clock) {
                    ops2.append(.append(Self.windowBlock(block)))
                    added += 1
                    lastLine = block.id
                }
            case .rewrite(let id, let text):
                guard id != focused, let block = notes.rewrite(id, text: text) else { continue }
                ops2.append(.replace(Self.windowBlock(block)))
                rewritten += 1
            case .title(let title):
                notes.title = title
                window.setTitle(title)
            case .explain(let topic, let why):
                guard live else { continue }
                // the explainer is built in the background while the lecture goes on; it opens at the next pause
                if !ops2.isEmpty { window.apply(ops2); ops2 = [] }
                explainers.request(topic: topic, why: why, line: lastLine ?? notes.blocks.last?.id, context: explainContext(), tapped: false)
            case .addAfter(let id, let text):
                guard added < Self.gapFillCap else { continue }
                if let placed = notes.addAfter(id, text: text) { ops2.append(.insertAfter(placed.after, Self.windowBlock(placed.block))); added += 1 }
            case .feedback(let line):
                window.recallFeedback(line)
            case .why(let question):
                pendingWhy = question
            case .deadline(let due, let title, let block):
                deadlines.append(("dl\(deadlines.count + 1)", due, title, block))
            case .slide:
                guard let pending = slide else { continue }
                if !ops2.isEmpty { window.apply(ops2); ops2 = [] }
                placeSlide(pending.shot, at: pending.at)
                slide = nil
            case .nothing:
                break
            }
        }
        if !ops2.isEmpty { window.apply(ops2) }
        if let pending = slide { placeSlide(pending.shot, at: pending.at) }
        if added + rewritten > 0 { save() }
        if !ignored.isEmpty { Log.info("lecture: ignored \(ignored.count) line(s): \(Log.short(ignored.joined(separator: " | "), 200))") }
        return "+\(added) ~\(rewritten)" + (notes.title.isEmpty ? "" : " [\(Log.short(notes.title, 40))]")
    }

    private var pendingWhy: String?

    private func explainContext() -> String {
        var context = "what was just said (machine transcribed; names and terms may be misspelled):\n\"\(Log.short(listener.recent(seconds: 90), 1400))\""
        if !lastSlide.isEmpty { context += "\nslide on his screen (OCR): \"\(Log.short(lastSlide, 700))\"" }
        return context
    }

    private var cyclesSinceStart = 0
    static let refreshEvery = 40
    static let maxRestarts = 12

    /// A fresh writer that picks up from the notes so far: after a stuck reply, a dead process, or every `refreshEvery` cycles.
    private func restartWriter(reason: String) {
        guard let setup, restarts < Self.maxRestarts else { return }
        restarts += 1
        cyclesSinceStart = 0
        writer.stop()
        do {
            var fresh = setup
            fresh.heading = notes.heading
            try writer.start(fresh)
            var first = "[start] \(notes.heading), resuming: a fresh note writer takes over mid-class at minute \(minutes); the notes so far:\n"
                + notes.tail(400).joined(separator: "\n")
            if !notes.title.isEmpty { first += "\nthe class title is already set: \(notes.title)" }
            writer.send(first + "\nreply nothing.") { _, _ in }
            Log.info("lecture: note writer restarted (\(reason); \(restarts) so far)")
        } catch {
            Log.error("lecture: note writer could not restart: \(error)")
        }
    }

    /// One end-of-class message: waits for the writer to be free, and if the reply doesn't come, a fresh writer gets it once more.
    private func ask(_ message: String) async -> String? {
        for attempt in 0..<2 {
            var waited = 0
            while writer.isBusy, waited < 600 { try? await Task.sleep(nanoseconds: 100_000_000); waited += 1 }
            let reply: String? = await withCheckedContinuation { done in writer.send(message) { reply, _ in done.resume(returning: reply) } }
            if let reply { return reply }
            if attempt == 0 { restartWriter(reason: "no reply to an end-of-class message") }
        }
        return nil
    }

    // MARK: Pictures: board photos and slides

    /// A board photo: saved next to the notes, shown in them, and read by the writer on the next cycle.
    private func boardPhoto(_ jpeg: Data, at: Date) {
        guard phase == .live, let name = saveImage(jpeg, prefix: "board", at: at) else { return }
        let block = notes.appendImage(path: "notes-images/\(name)", caption: "board \(Self.clock(at))", at: lectureClock(at))
        window.apply([.append(Self.windowBlock(block))])
        pendingPhotos.append((jpeg, block.id))
        save()
    }

    /// A new slide in front: its picture and title go into the notes where the lecture reached it.
    private func placeSlide(_ shot: (jpeg: Data, title: String), at clock: String) {
        guard let name = saveImage(shot.jpeg, prefix: "slide", at: Date()) else { return }
        let title = shot.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let block = notes.appendImage(path: "notes-images/\(name)", caption: "slide: \(title.isEmpty ? "untitled" : Log.short(title, 80))", at: clock)
        window.apply([.append(Self.windowBlock(block))])
        save()
        Log.info("lecture: slide \"\(Log.short(title, 60))\" into the notes")
    }

    private func saveImage(_ jpeg: Data, prefix: String, at: Date) -> String? {
        let images = folder.appendingPathComponent("notes-images", isDirectory: true)
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd-HHmmss"; f.locale = Locale(identifier: "en_US_POSIX")
        let name = "\(prefix)-\(f.string(from: at)).jpg"
        do {
            try FileManager.default.createDirectory(at: images, withIntermediateDirectories: true)
            try jpeg.write(to: images.appendingPathComponent(name))
            return name
        } catch {
            Log.warn("lecture: couldn't save the \(prefix) picture: \(error)")
            return nil
        }
    }

    // MARK: The transcript, kept as text

    private func keepTranscript(clock: String, text: String) {
        transcript.append((clock, text))
        let url = transcriptURL
        let block = "**\(clock)** \(text)\n\n"
        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            if !FileManager.default.fileExists(atPath: url.path) {
                try "# \(course) \(notes.key) transcript (machine transcribed, text only)\n\n".write(to: url, atomically: true, encoding: .utf8)
            }
            let handle = try FileHandle(forWritingTo: url)
            defer { try? handle.close() }
            _ = try handle.seekToEnd()
            try handle.write(contentsOf: Data(block.utf8))
        } catch {
            Log.warn("lecture: couldn't keep the transcript: \(error)")
        }
    }

    /// What was said where a line came from: its chunk and the one after (a point often lands across two).
    func source(for id: String) -> (time: String, text: String)? {
        guard let at = notes.block(id)?.at else { return nil }
        let chunks = transcript.isEmpty ? Self.readTranscript(transcriptURL) : transcript
        guard let i = chunks.firstIndex(where: { $0.clock == at }) ?? chunks.lastIndex(where: { $0.clock < at }) else { return nil }
        let text = chunks[i...].prefix(2).map(\.text).joined(separator: " ")
        return (at, text)
    }

    static func readTranscript(_ url: URL) -> [(clock: String, text: String)] {
        guard let text = try? String(contentsOf: url, encoding: .utf8) else { return [] }
        return text.components(separatedBy: "\n\n").compactMap { para in
            guard let m = para.firstMatch(of: #/^\*\*([0-9:]+)\*\* (.+)$/#.dotMatchesNewlines()) else { return nil }
            return (String(m.1), String(m.2))
        }
    }

    // MARK: His side of the notes

    private func received(_ message: NotesMessage) {
        switch message {
        case .ready: break
        case .edit(let id, let text):
            if notes.edit(id, text: text) { edits.append("he changed \(id) to: \"\(text)\""); save() }
        case .add(let id, let after, let depth, let text):
            if notes.add(id: id, after: after, depth: depth, text: text, at: phase == .live ? lectureClock() : nil), !text.isEmpty {
                edits.append("he wrote \(id)\(after.map { " after \($0)" } ?? ""): \"\(text)\"")
                save()
            }
        case .indent(let id, let depth):
            if notes.indent(id, depth: depth) { save() }
        case .remove(let id):
            if notes.remove(id) { edits.append("he deleted \(id)"); save() }
        case .focus(let id):
            focused = id
        case .explain(let id, let text):
            explainers.request(topic: text, why: "he tapped this line in his notes", line: id, context: explainContext(), tapped: true)
        case .showExplain(let id):
            if let ready = explainers.readyID(forLine: id) { explainers.show(ready) }
        case .source(let id):
            if let found = source(for: id) { window.showSource(id: id, time: found.time, text: found.text) }
            else { window.showSource(id: id, time: "", text: "no transcript for this line") }
        case .recall(let text):
            Task { phase == .why ? await whyAnswered(text) : await recall(text) }
        case .skipRecall:
            Task { phase == .why ? await whyAnswered(nil) : await recall(nil) }
        case .addDeadlines(let ids):
            Task { await addDeadlines(ids) }
        case .end:
            Task { await end() }
        }
    }

    // MARK: The end of class

    /// Stop the ear, write up the last stretch, then ask for his 3 big ideas.
    func end() async {
        guard phase == .live else { return }
        phase = .closing
        tickTimer?.invalidate()
        tickTimer = nil
        secondTimer?.invalidate()
        secondTimer = nil
        window.hearing("")
        photos?.poll()
        photos?.stop()
        window.setStatus("wrapping up")
        _ = await listener.stop()
        // the last stretch; once more if the reply didn't come (a fresh writer gets the same words)
        for attempt in 0..<2 where attempt == 0 || !newSpeech().isEmpty {
            var waited = 0
            while writer.isBusy, waited < 600 { try? await Task.sleep(nanoseconds: 100_000_000); waited += 1 }
            await cycle(final: true)
        }
        phase = .recall
        window.showRecall(seconds: Self.recallSeconds, prompt: "before u look: what were the 3 big ideas today?")
        armRecallTimer(Self.recallSeconds)
        Log.info("lecture: ended after \(minutes) min, \(notes.blocks.count) lines; asking for the 3 big ideas")
    }

    private func armRecallTimer(_ seconds: Int) {
        recallTimer?.cancel()
        let work = DispatchWorkItem { [weak self] in
            Task { @MainActor in
                guard let self else { return }
                if self.phase == .why { await self.whyAnswered(nil) } else { await self.recall(nil) }
            }
        }
        recallTimer = work
        DispatchQueue.main.asyncAfter(deadline: .now() + .seconds(seconds + 30), execute: work)
    }

    /// His 3 big ideas (nil: skipped or timed out): feedback and one "why", or straight on to the gap-fill.
    func recall(_ text: String?) async {
        guard phase == .recall else { return }
        recallTimer?.cancel()
        if let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            phase = .finishing
            let message = "[recall] his 3 big ideas: \"\(text)\"\n\n" + NoteWriter.resource("notes-recall.md")
            let reply = await ask(message)
            if let reply { apply(reply, live: false) }
            Log.info("lecture: recall answered (\(text.split(separator: " ").count) words)\(pendingWhy.map { "; why: \(Log.short($0, 80))" } ?? "")")
            if let why = pendingWhy {
                pendingWhy = nil
                phase = .why
                window.showRecall(seconds: Self.whySeconds, prompt: why)
                armRecallTimer(Self.whySeconds)
                return
            }
        }
        phase = .finishing
        await wrapUp()
    }

    /// His answer to the "why" (nil: skipped): feedback, then the rest.
    func whyAnswered(_ text: String?) async {
        guard phase == .why else { return }
        phase = .finishing
        recallTimer?.cancel()
        if let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let reply = await ask("[why] his answer: \"\(text)\"")
            if let reply { apply(reply, live: false) }
        }
        await wrapUp()
    }

    private func wrapUp() async {
        await gapFill()
        await findDeadlines()
        await finish()
    }

    private func gapFill() async {
        let materials = LectureMaterials.gather(folder: folder, notesFile: fileURL, cap: 30_000)
        guard !materials.text.isEmpty, !notes.blocks.isEmpty else {
            Log.info("lecture: no slides or readings in \(folder.lastPathComponent) to fill gaps from")
            return
        }
        window.setStatus("checking the notes against \(materials.files.count) file(s)")
        let message = "[gap-fill]\n" + NoteWriter.resource("notes-gapfill.md") + "\n\nslides and readings:\n" + materials.text
            + "\n\nthe whole class's notes, with ids:\n" + notes.tail(1000).joined(separator: "\n")
            + "\nlast block: \(notes.blocks.last?.id ?? "none") (use +after end: for a line after everything)"
        let reply = await ask(message)
        if let reply { Log.info("lecture: gap-fill \(apply(reply, live: false)) from \(materials.files.joined(separator: ", "))") }
    }

    /// Announced dates, offered for Atlas with a box he checks (Atlas alerts on a deadline at once, so he picks).
    private func findDeadlines() async {
        guard !notes.blocks.isEmpty else { return }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd (EEE)"; f.locale = Locale(identifier: "en_US_POSIX")
        var head = "[deadlines] class date: \(f.string(from: classDay))"
        if let endsAt { head += ", class time \(Self.clock(startedAt))-\(Self.clock(endsAt))" }
        if !meets.isEmpty { head += ", meets \(meets)" }
        let message = head + "\n\n" + NoteWriter.resource("notes-deadlines.md") + "\n\nthe whole class's notes, with ids:\n" + notes.tail(1000).joined(separator: "\n")
        let reply = await ask(message)
        if let reply { apply(reply, live: false) }
        guard !deadlines.isEmpty else { return }
        window.offerDeadlines(deadlines.map { NotesWindow.DeadlineItem(id: $0.id, title: $0.title, due: $0.due, line: $0.line) })
        Log.info("lecture: \(deadlines.count) deadline(s) offered: \(Log.short(deadlines.map { "\($0.title) \($0.due)" }.joined(separator: "; "), 160))")
    }

    private func addDeadlines(_ ids: [String]) async {
        let chosen = deadlines.filter { ids.contains($0.id) }
        guard !chosen.isEmpty else { window.deadlinesAdded("skipped"); return }
        let line = await onAddDeadlines?(chosen.map { ($0.due, $0.title) }) ?? "atlas isn't reachable from here"
        window.deadlinesAdded(line)
        Log.info("lecture: deadlines for atlas: \(chosen.count) (\(line))")
    }

    private func finish() async {
        saveNow()
        writer.stop()
        explainers.stopAll()
        let desktop = pdfFolder.appendingPathComponent("\(course) notes.pdf")
        var pdf: URL? = desktop
        do {
            try await window.exportPDF(markdown: file.markdown, baseURL: folder, to: desktop)
        } catch {
            Log.warn("lecture: pdf failed: \(error)")
            pdf = nil
        }
        listener.discardTranscript()   // the ear's own 3-minute file; the class's transcript is kept in the course folder
        phase = .done
        window.finished(pdf: pdf?.path ?? "", file: fileURL.path)
        window.setStatus("saved · \(notes.blocks.count) lines")
        Log.info("lecture: saved \(fileURL.lastPathComponent)\(pdf.map { " and \($0.path)" } ?? ""); \(explainers.shown) explainer(s); transcript \(transcriptURL.lastPathComponent)")
        onFinished?(fileURL, pdf)
    }

    // MARK: Saving

    /// Saves are batched: a burst of his typing writes once.
    private func save() {
        saveWork?.cancel()
        let work = DispatchWorkItem { [weak self] in Task { @MainActor in self?.saveNow() } }
        saveWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5, execute: work)
    }

    private func saveNow() {
        saveWork?.cancel()
        file.upsert(notes)
        do { try file.markdown.write(to: fileURL, atomically: true, encoding: .utf8) }
        catch { Log.warn("lecture: could not save \(fileURL.path): \(error)") }
    }

    // MARK: Helpers

    static func windowBlock(_ b: NoteBlock) -> NotesWindow.Block {
        let kind = b.image == nil ? "bullet" : (b.image!.contains("/slide-") ? "slide" : "image")
        let text = kind == "slide" && b.text.hasPrefix("slide: ") ? String(b.text.dropFirst(7)) : b.text
        return NotesWindow.Block(id: b.id, text: text, depth: b.depth, author: b.author.rawValue, kind: kind, src: b.image, at: b.at)
    }

    /// A new slide, not the same one read again: under 70 percent of its words shared.
    static func changed(_ slide: String, from old: String) -> Bool {
        let a = Set(slide.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber })), b = Set(old.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }))
        guard !a.isEmpty else { return false }
        return Double(a.intersection(b).count) / Double(max(a.count, b.count)) < 0.7
    }

    static func clock(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "h:mm"; return f.string(from: date)
    }
}
