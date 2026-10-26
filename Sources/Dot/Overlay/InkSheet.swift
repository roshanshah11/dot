import AppKit
import DotKit
import SwiftUI

/// The ink look on fixture pages, for `Dot --snapshot ink` and `Dot --ink-selftest`: every mark kind on a light page
/// and a dark one, half drawn and done. A page is lines of grey "text" with a few named controls, like a document.
@MainActor
enum InkSheet {
    static let size = CGSize(width: 760, height: 470)

    /// A fixture page's controls (overlay points): what element places resolve to.
    static let elements: [String: CGRect] = [
        "rate": CGRect(x: 70, y: 92, width: 132, height: 22),
        "wacc": CGRect(x: 70, y: 160, width: 96, height: 22),
        "growth": CGRect(x: 70, y: 228, width: 150, height: 22),
        "value": CGRect(x: 470, y: 330, width: 120, height: 26),
        "field": CGRect(x: 420, y: 92, width: 220, height: 28),
    ]

    /// Every kind with its places and words, the way a beat would place it on this page.
    static func specs() -> [(InkKind, [CGRect], String)] {
        let e = elements
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGRect { CGRect(x: x, y: y, width: 0, height: 0) }
        return [
            (.label, [e["rate"]!], "discount rate"),
            (.num, [e["wacc"]!], "2"),
            (.underline, [e["wacc"]!], ""),
            (.strike, [e["growth"]!], ""),
            (.check, [e["rate"]!], ""),
            (.cross, [e["growth"]!], ""),
            (.frame, [CGRect(x: 60, y: 300, width: 300, height: 120)], "the inputs"),
            (.connect, [e["rate"]!, e["value"]!], "drives"),
            (.trace, [pt(620, 180), pt(720, 200), pt(700, 280), pt(600, 270)], "this cluster"),
            (.write, [pt(260, 160)], "higher rate, lower value"),
            (.sticky, [pt(560, 10)], "value falls as the rate rises"),
            (.typeText, [e["field"]!], "=B2/(1+B3)^5"),
            (.photo, [pt(400, 170)], "mitochondrion"),
        ]
    }

    static func drawings() -> [(InkKind, InkDrawing)] {
        InkFonts.register()
        var placed: [CGRect] = []
        var out: [(InkKind, InkDrawing)] = []
        for (kind, anchors, text) in specs() {
            let context = InkGeometry.Context(anchors: anchors, bounds: CGRect(origin: .zero, size: size).insetBy(dx: 6, dy: 6), avoid: placed,
                                              measure: InkFonts.measure, seed: OverlayManager.inkSeed("\(kind)\(text)"))
            guard let d = InkGeometry.make(kind, text: text, in: context) else { continue }
            placed += d.labelBoxes
            out.append((kind, d))
        }
        return out
    }

    /// Marks at `progress` of their drawing right now (their clocks set so the canvas paints that moment).
    static func marks(progress: CGFloat, dark: Bool) -> [InkMarkModel] {
        let now = Date().timeIntervalSinceReferenceDate
        // the canvas eases progress; solve the ease so the picture shows the asked moment
        let t = progress >= 1 ? 1.0 : Double(easeInverse(progress))
        return drawings().enumerated().map { i, pair in
            let duration = 1.0
            return InkMarkModel(id: "m\(i + 1)", drawing: pair.1, hex: "", toneHex: dark ? "#ffffff" : "#1a1b1f",
                                start: now - t * duration - (progress >= 1 ? 5 : 0), duration: duration,
                                image: pair.0 == .photo ? placeholderPhoto : nil, seed: UInt64(i + 1))
        }
    }

    private static func easeInverse(_ y: CGFloat) -> CGFloat {
        var lo: CGFloat = 0, hi: CGFloat = 1
        for _ in 0..<30 { let mid = (lo + hi) / 2; if mid * mid * (3 - 2 * mid) < y { lo = mid } else { hi = mid } }
        return (lo + hi) / 2
    }

    /// A stand-in picture for the photo mark (no network in a snapshot).
    static let placeholderPhoto: NSImage = {
        let image = NSImage(size: NSSize(width: 320, height: 240))
        image.lockFocus()
        NSGradient(colors: [NSColor(calibratedRed: 0.36, green: 0.62, blue: 0.48, alpha: 1), NSColor(calibratedRed: 0.95, green: 0.83, blue: 0.45, alpha: 1)])?
            .draw(in: NSRect(x: 0, y: 0, width: 320, height: 240), angle: 35)
        NSColor(calibratedWhite: 1, alpha: 0.5).setFill()
        NSBezierPath(ovalIn: NSRect(x: 90, y: 60, width: 140, height: 110)).fill()
        image.unlockFocus()
        return image
    }()

    static func page(dark: Bool) -> some View {
        let ground = dark ? Color(red: 0.11, green: 0.115, blue: 0.13) : Color(white: 0.985)
        let line = dark ? Color(white: 0.42) : Color(white: 0.78)
        let control = dark ? Color(white: 0.24) : Color(white: 0.9)
        return Canvas { ctx, _ in
            ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(ground))
            for row in 0..<16 {
                let y = 40 + CGFloat(row) * 26
                let width = CGFloat([520, 610, 470, 580, 300, 640, 560][row % 7])
                ctx.fill(Path(roundedRect: CGRect(x: 60, y: y + 6, width: width, height: 7), cornerRadius: 3), with: .color(line.opacity(0.45)))
            }
            for (name, r) in elements {
                ctx.fill(Path(roundedRect: r, cornerRadius: 5), with: .color(control))
                ctx.draw(Text(name).font(.system(size: 12, weight: .medium)).foregroundColor(dark ? .white : .black), at: CGPoint(x: r.minX + 8, y: r.midY), anchor: .leading)
            }
        }
        .frame(width: size.width, height: size.height)
    }

    static func views(accentHex: String) -> [(String, AnyView)] {
        let accent = Color(hex: accentHex) ?? Color(red: 1, green: 0.42, blue: 0.17)
        var out: [(String, AnyView)] = []
        for dark in [false, true] {
            for progress: CGFloat in [0.5, 1] {
                let view = ZStack(alignment: .topLeading) {
                    page(dark: dark)
                    InkLayerView(marks: marks(progress: progress, dark: dark), accent: accent)
                }
                .frame(width: size.width, height: size.height)
                out.append(("\(dark ? "dark" : "light")-\(progress >= 1 ? "done" : "half")", AnyView(view)))
            }
        }
        return out
    }
}

/// `Dot --ink-selftest`: the offscreen half of batch 1's ink check (the live half, ink following a real page while it
/// scrolls, runs inside the running Dot with `--track-selftest`). Every kind draws on the fixture page and stays on it,
/// no two names sit on each other, three marks fit a 3 s sentence in order, a 3x drawing in a short sentence still
/// ends with it, edits and undo work by id; the sheet goes to ~/Dot/selftests/ink-<stamp>/ for a look.
@MainActor
enum InkSelfTest {
    static func run() -> Bool {
        var failures: [String] = []
        func check(_ ok: Bool, _ what: String) { print("\(ok ? "ok  " : "FAIL") \(what)"); if !ok { failures.append(what) } }

        let drawings = InkSheet.drawings()
        check(drawings.count == InkKind.allCases.count, "every kind draws on the fixture page (\(drawings.count) of \(InkKind.allCases.count))")
        let page = CGRect(origin: .zero, size: InkSheet.size)
        for (kind, d) in drawings { check(page.insetBy(dx: -4, dy: -4).contains(d.bounds), "\(kind) stays on the page") }
        let boxes = drawings.flatMap { kind, d in d.labelBoxes.map { (kind, $0) } }
        var overlaps: [String] = []
        for i in boxes.indices { for j in boxes.indices where j > i && boxes[i].1.intersects(boxes[j].1) { overlaps.append("\(boxes[i].0)/\(boxes[j].0)") } }
        check(overlaps.isEmpty, "no two names or papers overlap\(overlaps.isEmpty ? "" : ": " + overlaps.joined(separator: ", "))")

        let three = Array(drawings.prefix(3)).map(\.1.natural)
        let plan = InkTiming.schedule(naturals: three, sentence: 3, characters: 48)
        let end = plan.last.map { $0.start + $0.duration } ?? 0
        check(abs(end - 2.55) < 0.01, String(format: "three marks fill a 3 s sentence to 85%% (end %.2f s)", end))
        check(zip(plan, plan.dropFirst()).allSatisfy { abs($0.start + $0.duration - $1.start) < 1e-9 }, "they draw one after another")
        let big = InkTiming.schedule(naturals: [1.6, 1.6, 1.6], sentence: 1.5, characters: 20)
        check(big.last.map { $0.start + $0.duration } ?? 9 <= 1.6 * 3 * 0.35 + 1e-9, "a big drawing in a short sentence squeezes to a third, not past it")

        var board = InkBoard()
        for _ in 0..<3 { board.add(InkSpec(kind: .underline, places: [.element(1)]), frame: CGRect(x: 0, y: 0, width: 80, height: 4)) }
        check(board.apply(.recolor(id: "m2", color: "red")) == ["m2"] && board.mark("m2")?.color == "red", "recolor m2 by id")
        check(board.apply(.erase(id: "m3")) == ["m3"] && board.apply(.undo) == ["m2"] && board.marks.map(\.id) == ["m1"], "erase m3, then undo takes m2")

        let sounds = PenSounds.shared.loaded
        check(sounds.accents == ["pop", "stamp", "tick", "nope", "paper", "clear", "eraser", "slide"]
              && sounds.beds == ["felt", "pencil", "writing", "highlighter", "keys"], "the pen sounds load (\(sounds.accents.count) accents, \(sounds.beds.count) beds)")
        let byKind = Dictionary(uniqueKeysWithValues: drawings.map { kind, d in (kind, PenSounds.cues(kind, drawing: d, after: 0, duration: 1).map(\.name)) })
        let wanted: [InkKind: [String]] = [.label: ["pop"], .num: ["stamp"], .check: ["felt", "tick"], .cross: ["nope", "felt"],
                                           .write: ["writing"], .sticky: ["paper", "pencil"], .typeText: ["keys"]]
        for (kind, names) in wanted.sorted(by: { $0.key.rawValue < $1.key.rawValue }) {
            let got = byKind[kind] ?? []
            check(names.allSatisfy(got.contains), "\(kind.rawValue) sounds like \(names.joined(separator: " + ")) (got \(got.joined(separator: ", ")))")
        }
        let cues = drawings.flatMap { kind, d in PenSounds.cues(kind, drawing: d, after: 0.5, duration: 1) }
        check(cues.allSatisfy { $0.at >= 0.5 && $0.at <= 1.5 && $0.at + $0.length <= 1.5 + 1e-9 }, "every sound sits inside its mark's time")

        let stamp: String = { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd-HHmm"; return f.string(from: Date()) }()
        let folder = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Dot/selftests/ink-\(stamp)", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var written = 0
        for (name, view) in InkSheet.views(accentHex: DotConfig.peek().pointerColorHex) {
            if let image = Snapshots.render(view, width: InkSheet.size.width, height: InkSheet.size.height, trim: false), let data = Snapshots.png(image),
               (try? data.write(to: folder.appendingPathComponent("\(name).png"))) != nil { written += 1 }
        }
        check(written == 4, "the sheet rendered (\(written) of 4) in \(folder.path)")
        print(failures.isEmpty ? "ink-selftest: passed" : "ink-selftest: \(failures.count) failed")
        return failures.isEmpty
    }
}
