import AppKit
import DotKit
import SwiftUI

/// `Dot --snapshot <folder> home`: batch 6's Home pieces on made-up samples in a temp folder (parity HO-03 and on).
@MainActor
extension Snapshots {
    static func homeStates() -> [(String, NSImage)] {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("dot-home-snapshot-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var out: [(String, NSImage)] = []
        if let image = fileCards(in: folder) { out.append(("file-cards", image)) }
        if let image = faces() { out.append(("faces", image)) }
        return out
    }

    /// Every kind of card: a workbook large (the turn's first file), then a picture, a PDF, a job's page, a file
    /// that's gone and a link; the notch's dark cards beside them.
    private static func fileCards(in folder: URL) -> NSImage? {
        let workbook = folder.appendingPathComponent("northwind_model.xlsx")
        try? XLSXSample.data.write(to: workbook)
        let picture = folder.appendingPathComponent("enzyme_diagram.png")
        try? samplePicture().write(to: picture)
        let pdf = folder.appendingPathComponent("northwind_brief.pdf")
        try? samplePDF().write(to: pdf)
        let page = folder.appendingPathComponent("page.md")
        try? "# Three flights under $400 to Boston\n\n<lead>Three flights under $400 to Boston, cheapest on Friday morning</lead>\n".write(to: page, atomically: true, encoding: .utf8)
        let gone = folder.appendingPathComponent("draft_v1.docx")
        let link = URL(string: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193")!
        let accent = HomeStyle.accent
        let home = VStack(alignment: .leading, spacing: 8) {
            FileCard(url: workbook, large: true, accent: accent)
            FileCard(url: picture, accent: accent)
            FileCard(url: pdf, accent: accent)
            FileCard(url: page, accent: accent)
            FileCard(url: gone, accent: accent)
            FileCard(url: link, accent: accent)
        }
        .padding(18).frame(width: 420, alignment: .topLeading)
        let notch = VStack(alignment: .leading, spacing: 5) {
            PageCard(headline: "Three flights under $400 to Boston, cheapest on Friday morning", accent: accent) {}
            FileCard(url: pdf, style: .notch, accent: accent)
            FileCard(url: picture, style: .notch, accent: accent)
            FileCard(url: workbook, style: .notch, accent: accent)
            Text("and 2 more").font(.system(size: 10.5)).foregroundStyle(.white.opacity(0.45)).padding(.leading, 4)
        }
        .padding(12).frame(width: 340, alignment: .topLeading)
        .background(Color(red: 26 / 255, green: 26 / 255, blue: 26 / 255), in: RoundedRectangle(cornerRadius: 13))
        .environment(\.colorScheme, .dark)
        let sheet = HStack(alignment: .top, spacing: 24) { home; notch.padding(.top, 18) }
            .frame(width: 820, height: 640, alignment: .topLeading)
            .background(Color(nsColor: .windowBackgroundColor))
        return drawHosted(NSHostingView(rootView: sheet), size: CGSize(width: 820, height: 640), wait: 3)
    }

    /// Every mood (HO-16) with symbols from the rule table (HO-15), as rail rows, in light and dark.
    private static func faces() -> NSImage? {
        let rows: [(String, AgentMood, String?, String)] = [
            ("Dot", .rest, nil, "nothing yet"),
            ("Scout", .working, AgentLook.symbol(name: "Scout", brief: "watch for hackathons and deadlines"), "working…"),
            ("Option", .waiting, "cart", "waiting on you · the 2-pack or the 3-pack?"),
            ("Pitch Desk", .done, AgentLook.symbol(name: "Pitch Desk", brief: ""), "Done: COHR comps in output/."),
            ("Mailroom", .failed, AgentLook.symbol(name: "Mailroom", brief: "draft replies to my inbox"), "failed: usage limit"),
        ]
        func rail(_ scheme: ColorScheme) -> some View {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(rows, id: \.0) { row in
                    HStack(spacing: 10) {
                        AgentFace(name: row.0, mood: row.1, symbol: row.2, size: 32, still: true).padding(.trailing, 2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.0).font(.system(size: 13, weight: .semibold))
                            Text(row.3).font(.system(size: 11.5)).lineLimit(1)
                                .foregroundStyle(row.1 == .working || row.1 == .waiting ? HomeStyle.accent : row.1 == .failed ? .orange : .secondary)
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 8).padding(.vertical, 6)
                }
                HStack(spacing: 18) {
                    ForEach(AgentMood.allCases, id: \.self) { mood in
                        VStack(spacing: 6) {
                            AgentFace(name: "Scout", mood: mood, symbol: "calendar", size: 56, still: true)
                            Text(mood.word).font(.system(size: 10.5)).foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(.top, 14).padding(.leading, 10)
            }
            .padding(14).frame(width: 420, height: 440, alignment: .topLeading)
            .background(Color(nsColor: .windowBackgroundColor))
            .environment(\.colorScheme, scheme)
        }
        let sheet = HStack(spacing: 0) { rail(.light); rail(.dark) }
        return drawHosted(NSHostingView(rootView: sheet), size: CGSize(width: 840, height: 440), wait: 0.6)
    }

    private static func samplePicture() -> Data {
        let image = NSImage(size: CGSize(width: 640, height: 400), flipped: false) { rect in
            NSColor(calibratedRed: 0.96, green: 0.95, blue: 0.91, alpha: 1).setFill(); rect.fill()
            NSColor(calibratedRed: 0.20, green: 0.45, blue: 0.75, alpha: 1).setFill()
            NSBezierPath(ovalIn: CGRect(x: 90, y: 90, width: 220, height: 220)).fill()
            NSColor(calibratedRed: 0.95, green: 0.55, blue: 0.20, alpha: 1).setFill()
            NSBezierPath(roundedRect: CGRect(x: 340, y: 140, width: 200, height: 120), xRadius: 30, yRadius: 30).fill()
            return true
        }
        guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) else { return Data() }
        return rep.representation(using: .png, properties: [:]) ?? Data()
    }

    private static func samplePDF() -> Data {
        let data = NSMutableData()
        var box = CGRect(x: 0, y: 0, width: 612, height: 792)
        guard let consumer = CGDataConsumer(data: data as CFMutableData), let context = CGContext(consumer: consumer, mediaBox: &box, nil) else { return Data() }
        context.beginPDFPage(nil)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
        ("Northwind Traders" as NSString).draw(at: CGPoint(x: 72, y: 700), withAttributes: [.font: NSFont.boldSystemFont(ofSize: 28)])
        ("Q3 brief: revenue up 12%, margins steady, two new distribution deals." as NSString)
            .draw(in: CGRect(x: 72, y: 560, width: 468, height: 120), withAttributes: [.font: NSFont.systemFont(ofSize: 14)])
        NSColor(calibratedRed: 0.2, green: 0.45, blue: 0.75, alpha: 1).setFill()
        for (i, h) in [120.0, 160, 140, 210].enumerated() { CGRect(x: 90 + Double(i) * 110, y: 200, width: 70, height: h).fill() }
        NSGraphicsContext.restoreGraphicsState()
        context.endPDFPage()
        context.closePDF()
        return data as Data
    }
}
