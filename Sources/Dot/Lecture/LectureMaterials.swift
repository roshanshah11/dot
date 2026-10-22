import Foundation
import PDFKit

/// The words of a course's recent slides and readings, for the note writer (terms spelled right, the lecture's
/// structure) and for gap-fill after class. Read from the course's folder: whatever was added or changed in the last few
/// days, newest first, plus the newest lecture deck, capped so the prompt stays small.
enum LectureMaterials {
    struct Gathered {
        var text: String
        var files: [String]
    }

    static let readable: Set<String> = ["pptx", "pdf", "docx", "doc", "md", "txt", "rtf"]

    static func gather(folder: URL, notesFile: URL?, now: Date = Date(), days: Double = 3, cap: Int = 14_000) -> Gathered {
        let fm = FileManager.default
        guard let names = try? fm.contentsOfDirectory(atPath: folder.path) else { return Gathered(text: "", files: []) }
        let files: [(url: URL, date: Date)] = names.compactMap { name in
            let url = folder.appendingPathComponent(name)
            guard readable.contains(url.pathExtension.lowercased()), url.standardizedFileURL != notesFile?.standardizedFileURL,
                  !name.lowercased().contains("transcript"), !name.hasPrefix(".") else { return nil }
            let values = try? url.resourceValues(forKeys: [.contentModificationDateKey, .addedToDirectoryDateKey])
            let date = max(values?.contentModificationDate ?? .distantPast, values?.addedToDirectoryDate ?? .distantPast)
            return (url, date)
        }
        let recent = files.filter { now.timeIntervalSince($0.date) < days * 86_400 }.sorted { $0.date > $1.date }
        // The newest deck even when it is older: the class usually picks up where the last slides left off.
        let decks = files.filter { $0.url.pathExtension.lowercased() == "pptx" || $0.url.lastPathComponent.lowercased().contains("lec") }
            .sorted { $0.date > $1.date }
        var chosen = recent.map(\.url)
        if let deck = decks.first?.url, !chosen.contains(deck) { chosen.append(deck) }
        var out = ""
        var used: [String] = []
        for url in chosen {
            guard out.count < cap, let text = text(of: url)?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { continue }
            let room = cap - out.count
            out += "=== \(url.lastPathComponent)\n" + (text.count > room ? String(text.prefix(room)) + "…" : text) + "\n\n"
            used.append(url.lastPathComponent)
        }
        return Gathered(text: out, files: used)
    }

    static func text(of url: URL) -> String? {
        switch url.pathExtension.lowercased() {
        case "pdf":
            guard let doc = PDFDocument(url: url) else { return nil }
            return (0..<min(doc.pageCount, 80)).compactMap { i in doc.page(at: i)?.string.map { "[p. \(i + 1)] " + $0 } }.joined(separator: "\n")
        case "pptx": return slides(url)
        case "docx", "doc", "rtf": return run("/usr/bin/textutil", ["-convert", "txt", "-stdout", url.path])
        default: return try? String(contentsOf: url, encoding: .utf8)
        }
    }

    /// A deck's words, slide by slide ("[slide 3] ..."), from the slide XML inside the .pptx.
    static func slides(_ url: URL) -> String? {
        guard let list = run("/usr/bin/unzip", ["-Z1", url.path]) else { return nil }
        let slides = list.split(separator: "\n").map(String.init).compactMap { name -> (Int, String)? in
            guard let m = name.firstMatch(of: #/^ppt/slides/slide(\d+)\.xml$/#), let n = Int(m.1) else { return nil }
            return (n, name)
        }.sorted { $0.0 < $1.0 }
        let texts = slides.compactMap { (n, name) -> String? in
            guard let xml = run("/usr/bin/unzip", ["-p", url.path, name]) else { return nil }
            let paragraphs = xml.components(separatedBy: "</a:p>").map { para in
                para.matches(of: #/<a:t>([^<]*)</a:t>/#).map { String($0.1) }.joined()
            }.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            return paragraphs.isEmpty ? nil : "[slide \(n)] " + paragraphs.joined(separator: " / ")
        }
        return texts.isEmpty ? nil : unescape(texts.joined(separator: "\n"))
    }

    static func unescape(_ s: String) -> String {
        s.replacingOccurrences(of: "&amp;", with: "&").replacingOccurrences(of: "&lt;", with: "<").replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"").replacingOccurrences(of: "&apos;", with: "'")
    }

    private static func run(_ tool: String, _ args: [String]) -> String? {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: tool)
        p.arguments = args
        let out = Pipe()
        p.standardOutput = out
        p.standardError = Pipe()
        do { try p.run() } catch { return nil }
        let data = out.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        return p.terminationStatus == 0 ? String(decoding: data, as: UTF8.self) : nil
    }
}
