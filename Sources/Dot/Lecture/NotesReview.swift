import AppKit
import DotKit
import Foundation

/// "open my biotech notes" (2026-10-22): a course's saved notes back in the notes window, the newest class or the one he
/// names. He can keep editing them (saved into the course file), and a line's time chip shows what was said there from
/// the class's kept transcript.
@MainActor
final class NotesReview {
    let course: String
    let folder: URL
    let fileURL: URL
    private var file: CourseNotesFile
    private var notes: ClassNotes
    private let window: NotesWindow
    private var saveWork: DispatchWorkItem?
    private var transcript: [(clock: String, text: String)] = []

    /// Nil when the course has no notes yet or has no such class.
    init?(course: String, folder: URL, classNumber: Int?, window: NotesWindow) {
        self.course = course
        self.folder = folder
        self.window = window
        fileURL = folder.appendingPathComponent("\(course) notes.md")
        guard let text = try? String(contentsOf: fileURL, encoding: .utf8) else { return nil }
        let parsedFile = CourseNotesFile.parse(text, fallbackTitle: "\(course) notes")
        file = parsedFile
        let section = classNumber.flatMap { n in parsedFile.sections.first { CourseNotesFile.classHeading($0.components(separatedBy: "\n")[0])?.number == n } }
            ?? parsedFile.sections.first
        guard let section, let parsed = ClassNotes.parse(section: section) else { return nil }
        notes = parsed
        transcript = Self.transcript(folder: folder, course: course, number: parsed.number)
    }

    var heading: String { notes.heading }

    func show() {
        window.onMessage = { [weak self] message in self?.received(message) }
        window.show(course: course, heading: notes.key, title: notes.title, status: "saved notes", blocks: notes.blocks.map(LectureSession.windowBlock),
                    baseURL: folder, mode: "review")
        Log.info("lecture: reopened \(course) \(notes.key) (\(notes.blocks.count) lines, transcript \(transcript.count) chunks)")
    }

    static func transcript(folder: URL, course: String, number: Int) -> [(clock: String, text: String)] {
        let dir = folder.appendingPathComponent("\(course) transcripts", isDirectory: true)
        guard let name = (try? FileManager.default.contentsOfDirectory(atPath: dir.path))?.first(where: { $0.hasSuffix(" CLASS \(number).md") }) else { return [] }
        return LectureSession.readTranscript(dir.appendingPathComponent(name))
    }

    private func received(_ message: NotesMessage) {
        switch message {
        case .edit(let id, let text): if notes.edit(id, text: text) { save() }
        case .add(let id, let after, let depth, let text): if notes.add(id: id, after: after, depth: depth, text: text), !text.isEmpty { save() }
        case .indent(let id, let depth): if notes.indent(id, depth: depth) { save() }
        case .remove(let id): if notes.remove(id) { save() }
        case .title(let text):
            let title = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if title != notes.title { notes.title = title; save() }
        case .source(let id):
            guard let at = notes.block(id)?.at, let i = transcript.firstIndex(where: { $0.clock == at }) ?? transcript.lastIndex(where: { $0.clock < at }) else {
                window.showSource(id: id, time: "", text: "no transcript for this line")
                return
            }
            window.showSource(id: id, time: at, text: transcript[i...].prefix(2).map(\.text).joined(separator: " "))
        default: break
        }
    }

    /// Held until it runs: opening another class or course within the 1.5 s releases this review, and the edit the page
    /// already took must still reach the file. The file is read again first, so the other classes in it keep whatever
    /// changed since these notes were opened (a later Canvas pass, another class).
    private func save() {
        saveWork?.cancel()
        let work = DispatchWorkItem {
            Task { @MainActor in
                self.saveWork = nil   // the work item holds this review: let both go once it has run
                if let text = try? String(contentsOf: self.fileURL, encoding: .utf8) {
                    self.file = CourseNotesFile.parse(text, fallbackTitle: "\(self.course) notes")
                }
                self.file.upsert(self.notes)
                try? self.file.markdown.write(to: self.fileURL, atomically: true, encoding: .utf8)
            }
        }
        saveWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5, execute: work)
    }
}
