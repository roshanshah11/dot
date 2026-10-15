import AppKit
import DotKit
import Foundation
import PDFKit

/// The text of the document in front of him, page by page, so Dot can find a passage by
/// its words instead of guessing from the pixels on screen (his ask 2026-10-15: "it struggles
/// with traversing through pdfs; it may actually need to flow through things to find it").
///
/// Sources, in order: a PDF the window names (Preview and Skim expose the file through
/// accessibility; a browser shows the url), a web page's text, a .docx, .md or .txt file.
/// Documents are cached by their path or url, so a lecture's forty questions read it once.
@MainActor
final class DocumentReader {
    struct Document {
        let key: String
        let title: String
        let pages: [DocumentPage]
        let isPDF: Bool
        let readAt: Date
        var text: String { pages.map(\.text).joined(separator: "\n\n") }
        var pageCount: Int { pages.count }
    }

    private var cache: [String: Document] = [:]
    private var inFlight: [String: Task<Document?, Never>] = [:]

    /// The document the context names, read or served from the cache. Nil when the window in
    /// front names nothing Dot can read.
    func document(for context: ScreenContext) async -> Document? {
        guard let key = Self.key(for: context) else { return nil }
        if let cached = cache[key], Date().timeIntervalSince(cached.readAt) < 6 * 3600 { return cached }
        if let running = inFlight[key] { return await running.value }
        let title = context.windowTitle ?? key
        let task = Task<Document?, Never> { await Self.read(key: key, title: title) }
        inFlight[key] = task
        let document = await task.value
        inFlight[key] = nil
        if let document { cache[key] = document }
        return document
    }

    /// A local file path or an http(s) url the window stands for.
    static func key(for context: ScreenContext) -> String? {
        if let path = context.documentPath, !path.isEmpty { return path }
        if let url = context.url, url.hasPrefix("http") {
            // Pages of the same document share a cache entry; a fragment or a page anchor does not make a new one.
            return url.split(separator: "#").first.map(String.init) ?? url
        }
        return nil
    }

    private static func read(key: String, title: String) async -> Document? {
        let started = Date()
        var document: Document?
        if key.hasPrefix("http") {
            document = await readRemote(url: key, title: title)
        } else {
            document = await readLocal(path: key, title: title)
        }
        if let document {
            Log.info("document: read \(document.isPDF ? "pdf" : "text") \"\(Log.short(document.title, 50))\", \(document.pageCount) page(s), \(document.text.count) chars in \(Int(Date().timeIntervalSince(started) * 1000)) ms")
        } else {
            Log.info("document: nothing readable at \(Log.short(key, 80))")
        }
        return document
    }

    private static func readLocal(path: String, title: String) async -> Document? {
        let url = URL(fileURLWithPath: path)
        let ext = url.pathExtension.lowercased()
        if ext == "pdf", let data = try? Data(contentsOf: url) { return pdfDocument(data: data, key: path, title: title) }
        if ["txt", "md", "markdown", "tex", "csv", "html", "htm"].contains(ext), let text = try? String(contentsOf: url, encoding: .utf8) {
            let plain = ext.hasPrefix("htm") ? htmlToText(text) : text
            return Document(key: path, title: title, pages: pagesByLength(plain), isPDF: false, readAt: Date())
        }
        if ["docx", "rtf", "rtfd", "doc", "odt"].contains(ext),
           let attributed = try? NSAttributedString(url: url, options: [:], documentAttributes: nil) {
            return Document(key: path, title: title, pages: pagesByLength(attributed.string), isPDF: false, readAt: Date())
        }
        return nil
    }

    private static func readRemote(url text: String, title: String) async -> Document? {
        guard let url = URL(string: text) else { return nil }
        var request = URLRequest(url: url)
        request.timeoutInterval = 12
        request.setValue("Mozilla/5.0 (Macintosh) Dot/1.0", forHTTPHeaderField: "User-Agent")
        guard let (data, response) = try? await URLSession.shared.data(for: request) else { return nil }
        let mime = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Type")?.lowercased() ?? ""
        if mime.contains("pdf") || url.pathExtension.lowercased() == "pdf" || data.prefix(5) == Data("%PDF-".utf8) {
            return pdfDocument(data: data, key: text, title: title)
        }
        guard let html = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) else { return nil }
        let plain = htmlToText(html)
        guard plain.count >= 200 else { return nil }
        // A login wall answered instead of the page (Canvas, a journal): not the document.
        let head = plain.prefix(600).lowercased()
        if plain.count < 2500, head.contains("sign in") || head.contains("log in") || head.contains("password") { return nil }
        return Document(key: text, title: title, pages: pagesByLength(plain), isPDF: false, readAt: Date())
    }

    private static func pdfDocument(data: Data, key: String, title: String) -> Document? {
        guard let pdf = PDFDocument(data: data), pdf.pageCount > 0 else { return nil }
        var pages: [DocumentPage] = []
        for index in 0..<min(pdf.pageCount, 400) {
            guard let page = pdf.page(at: index) else { continue }
            let text = (page.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            pages.append(DocumentPage(number: index + 1, text: text))
        }
        let readable = pages.reduce(0) { $0 + $1.text.count }
        guard readable >= 80 else { return nil }   // a scanned pdf with no text layer
        let name = pdf.documentAttributes?[PDFDocumentAttribute.titleAttribute] as? String
        return Document(key: key, title: (name?.isEmpty == false ? name! : title), pages: pages, isPDF: true, readAt: Date())
    }

    /// Plain text into pages of about 2,500 characters, cut at paragraph breaks.
    static func pagesByLength(_ text: String, size: Int = 2500) -> [DocumentPage] {
        let normalized = text.replacingOccurrences(of: "\r\n", with: "\n")
        var pages: [DocumentPage] = []
        var current = ""
        for paragraph in normalized.components(separatedBy: "\n\n") {
            if current.count + paragraph.count > size, !current.isEmpty {
                pages.append(DocumentPage(number: pages.count + 1, text: current))
                current = ""
            }
            current += (current.isEmpty ? "" : "\n\n") + paragraph
        }
        if !current.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { pages.append(DocumentPage(number: pages.count + 1, text: current)) }
        return pages
    }

    /// Tags out, entities in, block elements as paragraph breaks.
    static func htmlToText(_ html: String) -> String {
        var s = html
        s = s.replacingOccurrences(of: #"(?is)<(script|style|noscript|svg|nav|footer|header)[^>]*>.*?</\1>"#, with: " ", options: .regularExpression)
        s = s.replacingOccurrences(of: #"(?i)<br\s*/?>"#, with: "\n", options: .regularExpression)
        s = s.replacingOccurrences(of: #"(?i)</(p|div|h[1-6]|li|tr|section|article|blockquote|pre|table)>"#, with: "\n\n", options: .regularExpression)
        s = s.replacingOccurrences(of: #"<[^>]+>"#, with: " ", options: .regularExpression)
        if let decoded = try? NSAttributedString(data: Data(s.utf8), options: [.documentType: NSAttributedString.DocumentType.html, .characterEncoding: String.Encoding.utf8.rawValue], documentAttributes: nil) {
            s = decoded.string
        }
        s = s.replacingOccurrences(of: #"[ \t]+"#, with: " ", options: .regularExpression)
        s = s.replacingOccurrences(of: #"\n{3,}"#, with: "\n\n", options: .regularExpression)
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
