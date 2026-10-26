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
        out += thread(in: folder)
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

    /// The real Home window on a sample agent in a temp root (its own home-state store, so nothing of his is read or
    /// written): a thread with a tapback, file cards, a kept draft and prompt cards; the same with the focus pane open;
    /// an empty thread's starters; and the tapback bar as hovering shows it.
    private static func thread(in folder: URL) -> [(String, NSImage)] {
        let realState = HomeState.shared
        HomeState.shared = HomeState(url: folder.appendingPathComponent("home-state.sqlite"))
        defer { HomeState.shared = realState }
        var config = DotConfig.peek()
        config.agentsRoot = folder.appendingPathComponent("agents").path
        config.agentRulesFile = folder.appendingPathComponent("rules.json").path
        let scout = folder.appendingPathComponent("agents/scout")
        try? FileManager.default.createDirectory(at: scout.appendingPathComponent(".dot"), withIntermediateDirectories: true)
        try? FileManager.default.createDirectory(at: scout.appendingPathComponent("output"), withIntermediateDirectories: true)
        try? FileManager.default.createDirectory(at: folder.appendingPathComponent("agents/option/.dot"), withIntermediateDirectories: true)
        try? "# Scout\n\n## Persona\nScout watches for hackathons, fellowships and their deadlines, and keeps the event list current.\n"
            .write(to: scout.appendingPathComponent("CLAUDE.md"), atomically: true, encoding: .utf8)
        try? "# Option\n\n## Persona\nOption finds the best product to buy and compares prices; he buys.\n"
            .write(to: folder.appendingPathComponent("agents/option/CLAUDE.md"), atomically: true, encoding: .utf8)
        try? XLSXSample.data.write(to: scout.appendingPathComponent("output/hackathons.xlsx"))
        try? samplePDF().write(to: scout.appendingPathComponent("output/northwind_brief.pdf"))
        let iso = ISO8601DateFormatter()
        func at(_ minutesAgo: Double) -> String { iso.string(from: Date().addingTimeInterval(-minutesAgo * 60)) }
        let answer = "Found 4 hackathons you can still enter: **HackMIT** (Nov 8), **TreeHacks** (Feb 14), **UChicago Hacks** (Jan 24) and **CalHacks** (Nov 15). The list with deadlines is in hackathons.xlsx."
        let rows: [[String: String]] = [
            ["ts": at(40), "role": "user", "text": "find hackathons I can still apply to this fall"],
            ["ts": at(39.5), "role": "tool", "text": "Searching the web for hackathons fall 2026"],
            ["ts": at(38), "role": "tool", "text": "Writing hackathons.xlsx"],
            ["ts": at(37), "role": "assistant", "text": answer],
            ["ts": at(37), "role": "artifact", "text": "hackathons.xlsx"],
            ["ts": at(37), "role": "artifact", "text": "northwind_brief.pdf"],
            ["ts": at(37), "role": "result", "text": "success in 41000 ms, $0.084"],
            ["ts": at(12), "role": "user", "text": "which one is closest?"],
            ["ts": at(11), "role": "assistant", "text": "UChicago Hacks, on campus. Want me to put its deadline in Atlas?"],
            ["ts": at(11), "role": "result", "text": "success in 6000 ms, $0.012"],
        ]
        let lines = rows.compactMap { (try? JSONSerialization.data(withJSONObject: $0)).map { String(decoding: $0, as: UTF8.self) } }.joined(separator: "\n") + "\n"
        try? lines.write(to: scout.appendingPathComponent(".dot/transcript.jsonl"), atomically: true, encoding: .utf8)
        let state = HomeState.shared
        state.react(turn: TranscriptRow.legacyID(ts: rows[3]["ts"]!, kind: "assistant", text: answer), thread: "agent:scout", emoji: "👍", text: answer)
        state.saveDraft(thread: "agent:scout", text: "Yes, add UChicago Hacks to Atlas, and draft a two-line note to the organizers asking about team size.", attachments: [])
        state.savePromptCard(.init(id: "a", title: "Weekly deadline sweep", text: "Check every deadline due in the next 7 days and list them by date.", color: "blue", ord: 1))
        state.savePromptCard(.init(id: "b", title: "New fellowships", text: "Any new fellowships for sophomores since last week?", color: "green", ord: 2))
        state.savePromptCard(.init(id: "c", title: "Chicago events", text: "Tech events in Chicago this week.", color: "purple", ord: 3))

        let ledger = Ledger(url: folder.appendingPathComponent("ledger.jsonl"))
        let agents = AgentManager(config: config, hud: NotchHUD(), speaker: MuteSpeaker(), ledger: ledger)
        let model = HomeModel(agents: agents, ledger: ledger, config: config, atlas: AtlasBridge(config: config))
        model.reload()
        var out: [(String, NSImage)] = []
        let size = CGSize(width: 1240, height: 760)
        func shot(_ name: String) {
            // the window paints its background in the real app; offscreen the view must, in one appearance
            for (suffix, look) in [("", NSAppearance.Name.darkAqua), ("-light", .aqua)] {
                let view = HomeView(model: model).frame(width: size.width, height: size.height).background(Color(nsColor: .windowBackgroundColor))
                let host = NSHostingView(rootView: view)
                host.appearance = NSAppearance(named: look)
                if let image = drawHosted(host, size: size, wait: 2.5) { out.append((name + suffix, image)) }
            }
        }
        if let agent = model.agents.first(where: { $0.slug == "scout" }) { model.select(agent) }
        shot("thread")
        model.focusOpen = true
        shot("focus")
        model.focusOpen = false
        if let agent = model.agents.first(where: { $0.slug == "option" }) { model.composer = ""; model.select(agent) }
        shot("starters")
        // HO-01: Home dropped down from the notch, the compact layout under its black band
        if let agent = model.agents.first(where: { $0.slug == "scout" }) { model.select(agent) }
        let drop = CGSize(width: 960, height: 600)
        let dropView = NotchHomeView(model: model, topInset: 32, openWindow: {}, close: {}).frame(width: drop.width, height: drop.height)
        let dropHost = NSHostingView(rootView: dropView)
        dropHost.appearance = NSAppearance(named: .darkAqua)
        if let image = drawHosted(dropHost, size: drop, wait: 2.5) { out.append(("notch-dropdown", image)) }
        let bar = VStack(alignment: .leading, spacing: 14) {
            TapbackBar(current: "👍") { _ in }
            HStack(alignment: .top) {
                Text("UChicago Hacks, on campus. Want me to put its deadline in Atlas?").font(.system(size: 13))
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
                    .overlay(alignment: .topTrailing) { TapbackBadge(emoji: "❓").offset(x: 10, y: -10) }
            }
        }
        .padding(24).frame(width: 520, height: 140, alignment: .topLeading).background(Color(nsColor: .windowBackgroundColor))
        if let image = drawHosted(NSHostingView(rootView: bar), size: CGSize(width: 520, height: 140), wait: 0.3) { out.append(("tapbacks", image)) }
        return out
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

/// A speaker that says nothing, for snapshots.
private final class MuteSpeaker: TTSProvider {
    var isSpeaking: Bool { false }
    var onFinishedAll: (() -> Void)?
    func speak(_ sentence: String, onStart: (() -> Void)?) { onStart?() }
    func stop() {}
}
