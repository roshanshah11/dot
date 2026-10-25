import Foundation

/// Lecture mode's notes (his ask 2026-10-22: "takes notes and fill out this doc of notes in my style during/throughout
/// the lecture"). One class's notes are blocks: Dot's lines, his own lines (never rewritten by Dot once he has touched
/// them) and lines added after class from the slides and readings. The record is one Markdown file per course, newest
/// class on top, the way his own course doc ran; old classes are kept verbatim, only the live one is rebuilt.
public struct NoteBlock: Equatable, Codable, Sendable {
    public enum Author: String, Codable, Sendable { case dot, him, added }

    public var id: String
    public var depth: Int
    public var text: String
    public var author: Author
    /// An image block's path, relative to the notes file (a board photo, a slide).
    public var image: String?
    /// When in class the line came from ("11:42:10"), so a tap shows what was said there. Kept in the file as a
    /// trailing comment no renderer shows.
    public var at: String?
    /// Dot's line corrected after class from the whole lecture (the after-class pass, 2026-10-25).
    public var fixed: Bool

    public init(id: String, depth: Int, text: String, author: Author, image: String? = nil, at: String? = nil, fixed: Bool = false) {
        self.id = id; self.depth = max(0, min(NoteBlock.maxDepth, depth)); self.text = text; self.author = author; self.image = image; self.at = at
        self.fixed = fixed
    }

    public static let maxDepth = 3
    /// Lines added after class start with this, in the file and on the page.
    public static let addedMark = "⁺ "

    /// The line in the file. Its trailing comment carries its time and whose it is ("<!--@11:42:10 his-->", "<!--@ his-->" with
    /// no time), so his lines stay his after a restart and the after-class pass never touches them; no renderer shows it.
    public var markdown: String {
        let indent = String(repeating: "  ", count: depth)
        let flags = (author == .him ? " his" : "") + (fixed ? " fixed" : "")
        let stamp = at != nil || !flags.isEmpty ? " <!--@\(at ?? "")\(flags)-->" : ""
        if let image { return indent + "![\(text)](\(image))" + stamp }
        return indent + "- " + (author == .added ? Self.addedMark : "") + text + stamp
    }

    /// A line's text, its time and its flags apart: "- x <!--@11:42:10 his-->" -> ("- x", "11:42:10", ["his"]).
    static func splitStamp(_ line: String) -> (String, String?, Set<String>) {
        guard let m = line.firstMatch(of: #/\s*<!--@([0-9:]*)((?: [a-z]+)*)-->\s*$/#) else { return (line, nil, []) }
        let at = String(m.1)
        return (String(line[..<m.range.lowerBound]), at.isEmpty ? nil : at, Set(m.2.split(separator: " ").map(String.init)))
    }
}

/// One class's notes: "CLASS 7 (Thu Oct 22): gene expression" and its blocks.
public struct ClassNotes: Equatable, Sendable {
    public var number: Int
    public var dateLabel: String
    public var title: String
    public private(set) var blocks: [NoteBlock]
    private var nextDot = 1

    public init(number: Int, date: Date, title: String = "", blocks: [NoteBlock] = []) {
        self.init(number: number, dateLabel: Self.dateLabel(date), title: title, blocks: blocks)
    }

    public init(number: Int, dateLabel: String, title: String = "", blocks: [NoteBlock] = []) {
        self.number = number; self.dateLabel = dateLabel; self.title = title; self.blocks = blocks
        nextDot = (blocks.compactMap { $0.id.hasPrefix("d") ? Int($0.id.dropFirst()) : nil }.max() ?? 0) + 1
    }

    public static func dateLabel(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "EEE MMM d"
        return f.string(from: date)
    }

    /// "CLASS 7 (Thu Oct 22)", the part that names the class whatever its title becomes.
    public var key: String { "CLASS \(number) (\(dateLabel))" }
    public var heading: String { title.isEmpty ? key : "\(key): \(title)" }

    public var markdown: String {
        (["## " + heading] + blocks.map(\.markdown)).joined(separator: "\n")
    }

    public func block(_ id: String) -> NoteBlock? { blocks.first { $0.id == id } }
    func index(_ id: String) -> Int? { blocks.firstIndex { $0.id == id } }

    /// The index just past `i` and every deeper line under it.
    func endOfSubtree(_ i: Int) -> Int {
        var j = i + 1
        while j < blocks.count, blocks[j].depth > blocks[i].depth { j += 1 }
        return j
    }

    // MARK: Dot's lines

    /// A new line from Dot at the end (or just before `before`, his line in progress at the bottom). A line can sit at
    /// most one level under the one above it.
    @discardableResult
    public mutating func append(depth: Int, text: String, before: String? = nil, at time: String? = nil) -> NoteBlock? {
        let clean = text.trimmingCharacters(in: .whitespaces)
        // the same line again (a reply that restarted itself) is dropped
        guard !clean.isEmpty, !blocks.suffix(12).contains(where: { $0.text == clean }) else { return nil }
        let at = before.flatMap { index($0) } ?? blocks.count
        let above = at > 0 ? blocks[at - 1].depth : -1
        let block = NoteBlock(id: "d\(nextDot)", depth: min(depth, above + 1), text: clean, author: .dot, at: time)
        nextDot += 1
        blocks.insert(block, at: at)
        return block
    }

    /// Dot finishing its own thought; his lines and added lines are never rewritten.
    @discardableResult
    public mutating func rewrite(_ id: String, text: String) -> NoteBlock? {
        let clean = text.trimmingCharacters(in: .whitespaces)
        guard !clean.isEmpty, let i = index(id), blocks[i].author == .dot, blocks[i].image == nil, blocks[i].text != clean else { return nil }
        blocks[i].text = clean
        return blocks[i]
    }

    /// An added line right after `id` and anything under it, at `depth` (no deeper than one past `id`'s): the after-class
    /// pass places a run of lines by giving each the one before it. Returns the block it now follows, for the window.
    @discardableResult
    public mutating func place(_ text: String, afterSubtreeOf id: String, depth: Int) -> (after: String, block: NoteBlock)? {
        let clean = text.trimmingCharacters(in: .whitespaces)
        guard !clean.isEmpty, let i = index(id) else { return nil }
        let end = endOfSubtree(i)
        let block = NoteBlock(id: "d\(nextDot)", depth: max(0, min(depth, blocks[i].depth + 1, NoteBlock.maxDepth)), text: clean, author: .added)
        nextDot += 1
        blocks.insert(block, at: end)
        return (blocks[end - 1].id, block)
    }

    /// After class: Dot's own line corrected from the whole lecture, and marked so. His lines, added lines and pictures never.
    @discardableResult
    public mutating func fix(_ id: String, text: String) -> NoteBlock? {
        let clean = text.trimmingCharacters(in: .whitespaces)
        guard !clean.isEmpty, let i = index(id), blocks[i].author == .dot, blocks[i].image == nil, blocks[i].text != clean else { return nil }
        blocks[i].text = clean
        blocks[i].fixed = true
        return blocks[i]
    }

    /// A gap-fill line after `id` and anything under it, at its depth ("end": after the last line, at depth 0).
    @discardableResult
    public mutating func addAfter(_ id: String, text: String) -> (after: String, block: NoteBlock)? {
        let clean = text.trimmingCharacters(in: .whitespaces)
        guard !clean.isEmpty else { return nil }
        if id == "end", let last = blocks.last {
            let block = NoteBlock(id: "d\(nextDot)", depth: 0, text: clean, author: .added)
            nextDot += 1
            blocks.append(block)
            return (last.id, block)
        }
        guard let i = index(id) else { return nil }
        let end = endOfSubtree(i)
        let block = NoteBlock(id: "d\(nextDot)", depth: blocks[i].depth, text: clean, author: .added)
        nextDot += 1
        blocks.insert(block, at: end)
        return (blocks[end - 1].id, block)
    }

    // MARK: His lines (from the notes window)

    /// He typed into a line: it is his from now on.
    @discardableResult
    public mutating func edit(_ id: String, text: String) -> Bool {
        guard let i = index(id), blocks[i].text != text || blocks[i].author != .him else { return false }
        blocks[i].text = text
        blocks[i].author = .him
        return true
    }

    @discardableResult
    public mutating func add(id: String, after: String?, depth: Int, text: String, at time: String? = nil) -> Bool {
        guard index(id) == nil else { return edit(id, text: text) }
        let at = after.flatMap { index($0).map { $0 + 1 } } ?? blocks.count
        blocks.insert(NoteBlock(id: id, depth: depth, text: text, author: .him, at: time), at: at)
        return true
    }

    @discardableResult
    public mutating func indent(_ id: String, depth: Int) -> Bool {
        guard let i = index(id) else { return false }
        blocks[i].depth = max(0, min(NoteBlock.maxDepth, depth))
        return true
    }

    @discardableResult
    public mutating func remove(_ id: String) -> Bool {
        guard let i = index(id) else { return false }
        blocks.remove(at: i)
        return true
    }

    /// An image (a board photo) at the end.
    @discardableResult
    public mutating func appendImage(path: String, caption: String, at time: String? = nil) -> NoteBlock {
        let block = NoteBlock(id: "d\(nextDot)", depth: 0, text: caption, author: .dot, image: path, at: time)
        nextDot += 1
        blocks.append(block)
        return block
    }

    /// The end of the notes as the writer sees it each cycle: the last `count` lines with ids and whose they are.
    public func tail(_ count: Int = 12) -> [String] {
        blocks.suffix(count).map { b in
            let who = b.author == .him ? "his" : (b.author == .added ? "added" : "dot")
            return "\(b.id) (\(who), depth \(b.depth)): \(b.image != nil ? "[image] " : "")\(b.text)"
        }
    }

    /// Back from the file (Dot restarted mid-class, the after-class pass, reopened notes): his lines by their flag, added
    /// lines by their mark, the rest Dot's.
    public static func parse(section: String) -> ClassNotes? {
        var lines = section.components(separatedBy: "\n")
        guard let first = lines.first, let head = CourseNotesFile.classHeading(first) else { return nil }
        lines.removeFirst()
        var blocks: [NoteBlock] = []
        for raw in lines where !raw.trimmingCharacters(in: .whitespaces).isEmpty {
            let (line, stamp, flags) = NoteBlock.splitStamp(raw)
            let spaces = line.prefix { $0 == " " }.count
            let body = line.dropFirst(spaces)
            let depth = spaces / 2
            let n = blocks.count + 1
            let fixed = flags.contains("fixed")
            if let m = body.firstMatch(of: #/^!\[(.*)\]\((.+)\)$/#) {
                blocks.append(NoteBlock(id: "d\(n)", depth: depth, text: String(m.1), author: .dot, image: String(m.2), at: stamp))
            } else if body.hasPrefix("- ") || body.hasPrefix("* ") {
                var text = String(body.dropFirst(2))
                let added = text.hasPrefix(NoteBlock.addedMark)
                if added { text = String(text.dropFirst(NoteBlock.addedMark.count)) }
                let author: NoteBlock.Author = flags.contains("his") ? .him : (added ? .added : .dot)
                blocks.append(NoteBlock(id: "d\(n)", depth: depth, text: text, author: author, at: stamp, fixed: fixed))
            } else {
                blocks.append(NoteBlock(id: "d\(n)", depth: depth, text: String(body), author: flags.contains("his") ? .him : .dot, at: stamp, fixed: fixed))
            }
        }
        return ClassNotes(number: head.number, dateLabel: head.date, title: head.title, blocks: blocks)
    }
}

/// A course's notes file: "# EXMP 10100 notes", anything he put under it, then the classes, newest first.
public struct CourseNotesFile: Equatable, Sendable {
    public var title: String
    public var preamble: String
    /// Each class's section verbatim, its "## CLASS ..." line first.
    public var sections: [String]

    public init(title: String, preamble: String = "", sections: [String] = []) {
        self.title = title; self.preamble = preamble; self.sections = sections
    }

    public static func parse(_ text: String, fallbackTitle: String) -> CourseNotesFile {
        var title = fallbackTitle
        var preamble: [String] = []
        var sections: [[String]] = []
        for line in text.components(separatedBy: "\n") {
            if sections.isEmpty, preamble.isEmpty, line.hasPrefix("# ") { title = String(line.dropFirst(2)).trimmingCharacters(in: .whitespaces); continue }
            if classHeading(line) != nil { sections.append([line]); continue }
            if sections.isEmpty { preamble.append(line) } else { sections[sections.count - 1].append(line) }
        }
        func trimmed(_ lines: [String]) -> String {
            lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return CourseNotesFile(title: title, preamble: trimmed(preamble), sections: sections.map(trimmed))
    }

    public var markdown: String {
        var parts = ["# " + title]
        if !preamble.isEmpty { parts.append(preamble) }
        parts += sections
        return parts.joined(separator: "\n\n") + "\n"
    }

    /// The live class replaces its own section (matched by "CLASS N (date)"), or goes on top.
    public mutating func upsert(_ notes: ClassNotes) {
        if let i = sections.firstIndex(where: { Self.classHeading($0.components(separatedBy: "\n")[0]).map { "CLASS \($0.number) (\($0.date))" } == notes.key }) {
            sections[i] = notes.markdown
        } else {
            sections.insert(notes.markdown, at: 0)
        }
    }

    public func section(key: String) -> String? {
        sections.first { Self.classHeading($0.components(separatedBy: "\n")[0]).map { "CLASS \($0.number) (\($0.date))" } == key }
    }

    /// The number the next class gets: one past the highest CLASS so far.
    public var nextClassNumber: Int {
        (sections.compactMap { Self.classHeading($0.components(separatedBy: "\n")[0])?.number }.max() ?? 0) + 1
    }

    /// "## CLASS 7 (Thu Oct 22): title" -> (7, "Thu Oct 22", "title").
    public static func classHeading(_ line: String) -> (number: Int, date: String, title: String)? {
        guard let m = line.firstMatch(of: #/^##\s+CLASS\s+(\d+)\s*\(([^)]*)\)\s*:?\s*(.*)$/#), let n = Int(m.1) else { return nil }
        return (n, String(m.2), String(m.3).trimmingCharacters(in: .whitespaces))
    }
}

/// What the note writer sends back each cycle, one line each (the contract in Resources/lecture/notes-system.md).
public enum NoteOp: Equatable, Sendable {
    case append(depth: Int, text: String)
    case rewrite(id: String, text: String)
    case title(String)
    case explain(topic: String, why: String)
    case addAfter(id: String, text: String)
    /// The after-class pass: a line under `id`, one level deeper, after anything already under it.
    case addUnder(id: String, text: String)
    case feedback(String)
    /// The recall's one "why" question.
    case why(String)
    /// An announced date: when (ISO), what, and the line it was said in.
    case deadline(due: String, title: String, block: String?)
    /// Where the new slide's picture goes among this reply's lines.
    case slide
    case nothing
}

public enum NoteProtocol {
    /// The ops in a reply, and the lines that were none of them.
    public static func parse(_ reply: String) -> (ops: [NoteOp], ignored: [String]) {
        var ops: [NoteOp] = []
        var ignored: [String] = []
        for raw in reply.components(separatedBy: "\n") {
            var line = raw.replacingOccurrences(of: "\t", with: "  ").replacingOccurrences(of: "\u{2014}", with: ", ")
            // a line wrapped in backticks (`~d5: ...`) is still a line
            if let m = line.firstMatch(of: #/^( *)`([^`]+)`\s*$/#) { line = String(m.1) + String(m.2) }
            let body = line.trimmingCharacters(in: .whitespaces)
            if body.isEmpty || body.hasPrefix("```") { continue }
            if body.lowercased().trimmingCharacters(in: .punctuationCharacters) == "nothing" { ops.append(.nothing); continue }
            if body.lowercased() == "[slide]" { ops.append(.slide); continue }
            if let m = line.firstMatch(of: #/^( *)[-*•]\s+(.+)$/#) {
                var text = String(m.2).trimmingCharacters(in: .whitespaces)
                if text.hasPrefix(NoteBlock.addedMark) { text = String(text.dropFirst(NoteBlock.addedMark.count)) }
                ops.append(.append(depth: min(NoteBlock.maxDepth, m.1.count / 2), text: text))
            } else if let m = body.firstMatch(of: #/^~\s*(d\d+)\s*:\s*(.+)$/#) {
                ops.append(.rewrite(id: String(m.1), text: String(m.2)))
            } else if let m = body.firstMatch(of: #/^##\s+(.+)$/#) {
                var title = String(m.1)
                if let head = CourseNotesFile.classHeading("## " + title) { title = head.title }
                if !title.isEmpty { ops.append(.title(title)) } else { ignored.append(raw) }
            } else if let m = body.firstMatch(of: #/^\?\s*([^|]+?)\s*(?:\|\s*(.*))?$/#) {
                ops.append(.explain(topic: String(m.1), why: m.2.map { String($0).trimmingCharacters(in: .whitespaces) } ?? ""))
            } else if let m = body.firstMatch(of: #/^\+\s*under\s+([dh]\d+)\s*:\s*(?:[-*]\s+)?(.+)$/#) {
                var text = String(m.2)
                if text.hasPrefix(NoteBlock.addedMark) { text = String(text.dropFirst(NoteBlock.addedMark.count)) }
                ops.append(.addUnder(id: String(m.1), text: text))
            } else if let m = body.firstMatch(of: #/^\+\s*after\s+([dh]\d+|end)\s*:\s*(?:[-*]\s+)?(.+)$/#) {
                var text = String(m.2)
                if text.hasPrefix(NoteBlock.addedMark) { text = String(text.dropFirst(NoteBlock.addedMark.count)) }
                ops.append(.addAfter(id: String(m.1), text: text))
            } else if let m = body.firstMatch(of: #/^FEEDBACK\s*:\s*(.+)$/#) {
                ops.append(.feedback(String(m.1)))
            } else if let m = body.firstMatch(of: #/^WHY\s*:\s*(.+)$/#) {
                ops.append(.why(String(m.1)))
            } else if let m = body.firstMatch(of: #/^DEADLINE\s*:\s*([^|]+?)\s*\|\s*([^|]+?)\s*(?:\|\s*(\S+))?\s*$/#) {
                let block = m.3.map(String.init).flatMap { $0.lowercased() == "none" ? nil : $0 }
                ops.append(.deadline(due: String(m.1), title: String(m.2), block: block))
            } else {
                ignored.append(raw)
            }
        }
        return (ops, ignored)
    }
}
