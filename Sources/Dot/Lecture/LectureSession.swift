import AppKit
import DotKit
import Foundation

/// One class in lecture mode (his ask 2026-10-22: "takes notes and fill out this doc of notes in my style during/throughout
/// the lecture... use the panel to explain things... pull up anything useful"). The ear's words go to the note writer
/// about every 45 seconds; its lines land in the notes window and the course's notes file; he types into the same notes
/// and his lines stay his; the writer's "? topic" lines open an explainer in the panel on their own. At the end: his
/// 2-minute "3 big ideas", feedback, lines added from the slides and readings, the file and a PDF saved, and the
/// transcript deleted, so what's kept is notes.
@MainActor
final class LectureSession {
    enum Phase: Equatable { case live, closing, recall, finishing, done }

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
    private let startedAt = Date()
    /// When the calendar says the class ends: the recall comes up a few minutes after if he hasn't ended it.
    let endsAt: Date?
    private var sentChars = 0
    private var lastCycleAt = Date()
    private var edits: [String] = []
    private var focused: String?
    private var lastSlide = ""
    private var lastExplainAt = Date.distantPast
    private var tickTimer: Timer?
    private var recallTimer: DispatchWorkItem?
    private var saveWork: DispatchWorkItem?
    private var explains = 0
    private var explainQueue: [(topic: String, why: String, at: Date)] = []
    private var photos: BoardPhotos?
    private var setup: NoteWriter.Setup?
    private var restarts = 0
    private var pendingPhotos: [(jpeg: Data, block: String)] = []

    /// Board photos AirDropped to Downloads go into the notes (off in the replay test).
    var watchPhotos = true
    /// The slide or page on his screen, read by OCR (empty when nothing readable).
    var screenText: () async -> String = { "" }
    /// An explainer in the panel: topic, why, the last minute and a half of speech. False when talk is busy.
    var onExplain: ((String, String, String) -> Bool)?
    /// The class is over: the notes file and the PDF (nil when it could not be made).
    var onFinished: ((URL, URL?) -> Void)?

    static let cycleSeconds: TimeInterval = 45
    static let cycleWords = 110
    /// Explainers come one at a time, this far apart; a dense stretch queues the newest two and lets them out in turn,
    /// and one waiting longer than `explainStale` is dropped because the lecture has moved on.
    var explainGap: TimeInterval = 90
    var explainStale: TimeInterval = 240
    static let gapFillCap = 6
    static let recallSeconds = 120

    init(course: String, courseTitle: String, folder: URL, endsAt: Date?, listener: LectureListener, writer: NoteWriter, window: NotesWindow, now: Date = Date()) {
        self.course = course
        self.courseTitle = courseTitle
        self.folder = folder
        self.endsAt = endsAt
        self.listener = listener
        self.writer = writer
        self.window = window
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

    func start(courseText: String) throws {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let materials = LectureMaterials.gather(folder: folder, notesFile: fileURL)
        let setup = NoteWriter.Setup(course: courseTitle == course ? course : "\(course), \(courseTitle)", courseText: courseText,
                                     materials: materials.text, heading: notes.heading)
        self.setup = setup
        try writer.start(setup)
        window.onMessage = { [weak self] message in self?.received(message) }
        window.show(course: course, heading: notes.key, title: notes.title, status: "listening", blocks: notes.blocks.map(Self.windowBlock), baseURL: folder)
        var first = "[start] \(notes.heading), \(course)" + (courseTitle == course ? "" : " (\(courseTitle))")
        if let endsAt { first += ", until \(Self.clock(endsAt))" }
        if isResumed { first += "\nresuming after a restart; the notes so far:\n" + notes.tail(400).joined(separator: "\n") }
        first += "\nreply nothing until the speech starts."
        writer.send(first) { _, _ in }
        save()
        tickTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        if watchPhotos {
            let photos = BoardPhotos(since: startedAt)
            photos.onPhoto = { [weak self] jpeg, at, _ in self?.boardPhoto(jpeg, at: at) }
            photos.start()
            self.photos = photos
        }
        Log.info("lecture: notes for \(course) \(notes.key) in \(fileURL.path)\(isResumed ? " (resumed)" : ""); materials: \(materials.files.joined(separator: ", "))")
    }

    // MARK: The live loop

    private func tick() {
        guard phase == .live else { return }
        if let endsAt, Date() > endsAt.addingTimeInterval(180) {
            Log.info("lecture: the class ended at \(Self.clock(endsAt)); wrapping up")
            Task { await end() }
            return
        }
        window.setStatus("listening · \(minutes) min · \(notes.blocks.count) lines")
        releaseExplain()
        guard !writer.isBusy else { return }
        let words = newSpeech().split(separator: " ").count
        let waited = Date().timeIntervalSince(lastCycleAt)
        if words >= Self.cycleWords || (words >= 25 && waited >= Self.cycleSeconds) || (!edits.isEmpty && waited >= Self.cycleSeconds) || !pendingPhotos.isEmpty {
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
        let slide = final ? "" : String(await screenText().prefix(900))
        var lines = ["[minute \(minutes)] new speech (machine transcribed; names and terms may be misspelled):", "\"\(speech.isEmpty ? "(nothing new)" : speech)\""]
        if !slide.isEmpty, Self.changed(slide, from: lastSlide) {
            lines.append("slide on his screen (OCR): \"\(slide)\"")
            lastSlide = slide
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
        pendingPhotos.removeFirst(photosSent.count)
        let reply: (String?, Double) = await withCheckedContinuation { done in
            writer.send(lines.joined(separator: "\n"), images: photosSent.map(\.jpeg)) { text, seconds in done.resume(returning: (text, seconds)) }
        }
        guard let text = reply.0 else {
            restartWriterIfDown()
            return
        }
        edits.removeFirst(min(sentEdits, edits.count))
        let applied = apply(text, live: !final)
        Log.info(String(format: "lecture: cycle %d (%.1f s): %d words in, %@", writer.cycles, reply.1, speech.split(separator: " ").count, applied))
    }

    /// The writer's reply onto the notes and the window; a short summary for the log.
    @discardableResult
    private func apply(_ reply: String, live: Bool) -> String {
        let (ops, ignored) = NoteProtocol.parse(reply)
        var ops2: [NotesWindow.Op] = []
        var added = 0, rewritten = 0
        for op in ops {
            switch op {
            case .append(let depth, let text):
                // his line in progress at the bottom stays at the bottom
                let before = focused.flatMap { id in notes.blocks.last?.id == id ? id : nil }
                if let block = notes.append(depth: depth, text: text, before: before) {
                    ops2.append(.append(Self.windowBlock(block)))
                    added += 1
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
                explain(topic: topic, why: why, tapped: false)
            case .addAfter(let id, let text):
                guard added < Self.gapFillCap else { continue }
                if let placed = notes.addAfter(id, text: text) { ops2.append(.insertAfter(placed.after, Self.windowBlock(placed.block))); added += 1 }
            case .feedback(let line):
                window.recallFeedback(line)
            case .nothing:
                break
            }
        }
        if !ops2.isEmpty { window.apply(ops2) }
        if added + rewritten > 0 { save() }
        if !ignored.isEmpty { Log.info("lecture: ignored \(ignored.count) line(s): \(Log.short(ignored.joined(separator: " | "), 200))") }
        return "+\(added) ~\(rewritten)" + (notes.title.isEmpty ? "" : " [\(Log.short(notes.title, 40))]")
    }

    /// The writer's process died (a crash, a sign-out): start a fresh one that picks up from the notes so far, twice at most.
    private func restartWriterIfDown() {
        guard !writer.isRunning, restarts < 2, let setup else { return }
        restarts += 1
        do {
            var fresh = setup
            fresh.heading = notes.heading
            try writer.start(fresh)
            writer.send("[start] \(notes.heading), resuming after the note writer restarted; the notes so far:\n" + notes.tail(400).joined(separator: "\n") + "\nreply nothing.") { _, _ in }
            Log.warn("lecture: note writer restarted (\(restarts))")
        } catch {
            Log.error("lecture: note writer could not restart: \(error)")
        }
    }

    private func explain(topic: String, why: String, tapped: Bool) {
        if tapped {
            if onExplain?(topic, why, listener.recent(seconds: 90)) == true { lastExplainAt = Date(); explains += 1 }
            Log.info("lecture: explaining \"\(Log.short(topic, 60))\" (he tapped it)")
            return
        }
        explainQueue.append((topic, why, Date()))
        Log.info("lecture: explainer queued: \"\(Log.short(topic, 60))\"")
        if explainQueue.count > 2 { explainQueue.removeFirst(explainQueue.count - 2) }
        releaseExplain()
    }

    /// The next queued explainer, when the last one has had its time and talk is free.
    private func releaseExplain() {
        explainQueue.removeAll { Date().timeIntervalSince($0.at) > explainStale }
        guard phase == .live, let next = explainQueue.first, Date().timeIntervalSince(lastExplainAt) >= explainGap else { return }
        if onExplain?(next.topic, next.why, listener.recent(seconds: 90)) == true {
            explainQueue.removeFirst()
            lastExplainAt = Date()
            explains += 1
            Log.info("lecture: explaining \"\(Log.short(next.topic, 60))\" (\(explainQueue.count) waiting)")
        }
    }

    /// A board photo: saved next to the notes, shown in them, and read by the writer on the next cycle.
    private func boardPhoto(_ jpeg: Data, at: Date) {
        guard phase == .live else { return }
        let images = folder.appendingPathComponent("notes-images", isDirectory: true)
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd-HHmmss"; f.locale = Locale(identifier: "en_US_POSIX")
        let name = "board-\(f.string(from: at)).jpg"
        do {
            try FileManager.default.createDirectory(at: images, withIntermediateDirectories: true)
            try jpeg.write(to: images.appendingPathComponent(name))
        } catch {
            Log.warn("lecture: couldn't save the board photo: \(error)")
            return
        }
        let block = notes.appendImage(path: "notes-images/\(name)", caption: "board \(Self.clock(at))")
        window.apply([.append(Self.windowBlock(block))])
        pendingPhotos.append((jpeg, block.id))
        save()
    }

    // MARK: His side of the notes

    private func received(_ message: NotesMessage) {
        switch message {
        case .ready: break
        case .edit(let id, let text):
            if notes.edit(id, text: text) { edits.append("he changed \(id) to: \"\(text)\""); save() }
        case .add(let id, let after, let depth, let text):
            if notes.add(id: id, after: after, depth: depth, text: text), !text.isEmpty {
                edits.append("he wrote \(id)\(after.map { " after \($0)" } ?? ""): \"\(text)\"")
                save()
            }
        case .indent(let id, let depth):
            if notes.indent(id, depth: depth) { save() }
        case .remove(let id):
            if notes.remove(id) { edits.append("he deleted \(id)"); save() }
        case .focus(let id):
            focused = id
        case .explain(_, let text):
            explain(topic: text, why: "he tapped this line in his notes", tapped: true)
        case .recall(let text):
            Task { await recall(text) }
        case .skipRecall:
            Task { await recall(nil) }
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
        photos?.poll()
        photos?.stop()
        window.setStatus("wrapping up")
        _ = await listener.stop()
        while writer.isBusy { try? await Task.sleep(nanoseconds: 200_000_000) }
        await cycle(final: true)
        phase = .recall
        window.showRecall(seconds: Self.recallSeconds, prompt: "before u look: what were the 3 big ideas today?")
        let work = DispatchWorkItem { [weak self] in Task { @MainActor in await self?.recall(nil) } }
        recallTimer = work
        DispatchQueue.main.asyncAfter(deadline: .now() + .seconds(Self.recallSeconds + 30), execute: work)
        Log.info("lecture: ended after \(minutes) min, \(notes.blocks.count) lines; asking for the 3 big ideas")
    }

    /// His 3 big ideas (nil: skipped or timed out): feedback, then the gap-fill and the save.
    func recall(_ text: String?) async {
        guard phase == .recall else { return }
        phase = .finishing
        recallTimer?.cancel()
        if let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let message = "[recall] his 3 big ideas: \"\(text)\"\n\n" + NoteWriter.resource("notes-recall.md")
            let reply: String? = await withCheckedContinuation { done in writer.send(message) { reply, _ in done.resume(returning: reply) } }
            if let reply { apply(reply, live: false) }
            Log.info("lecture: recall answered (\(text.split(separator: " ").count) words)")
        }
        await gapFill()
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
        let reply: String? = await withCheckedContinuation { done in writer.send(message) { reply, _ in done.resume(returning: reply) } }
        if let reply { Log.info("lecture: gap-fill \(apply(reply, live: false)) from \(materials.files.joined(separator: ", "))") }
    }

    private func finish() async {
        saveNow()
        writer.stop()
        var pdf: URL? = folder.appendingPathComponent("\(course) notes.pdf")
        do {
            try await window.exportPDF(markdown: file.markdown, baseURL: folder, to: pdf!)
        } catch {
            Log.warn("lecture: pdf failed: \(error)")
            pdf = nil
        }
        listener.discardTranscript()
        phase = .done
        window.finished(pdf: pdf?.path ?? "", file: fileURL.path)
        window.setStatus("saved · \(notes.blocks.count) lines")
        Log.info("lecture: saved \(fileURL.lastPathComponent)\(pdf.map { " and \($0.lastPathComponent)" } ?? ""); \(explains) explainer(s); transcript deleted")
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
        NotesWindow.Block(id: b.id, text: b.text, depth: b.depth, author: b.author.rawValue, kind: b.image == nil ? "bullet" : "image", src: b.image)
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
