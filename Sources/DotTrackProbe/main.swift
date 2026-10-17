import AppKit
import DotKit

/// DotTrackProbe: does a box drawn around a line of text stay on that line while the page scrolls?
/// Opens a window with a page of text, marks line 24, scrolls the page in steps (programmatically, with a
/// deliberately wrong wheel prediction so the image registration has to correct it), and measures the gap
/// between the tracked box and the line's true position. Prints one JSON line. Run only when he is away:
/// the window shows on screen for about fifteen seconds.
enum Log {
    static func info(_ message: String) { FileHandle.standardError.write(("probe: " + message + "\n").data(using: .utf8)!) }
    static func warn(_ message: String) { info(message) }
    static func error(_ message: String) { info(message) }
}

/// The child process: a window with a page of text that scrolls on command. A separate process because
/// ScreenCaptureKit returns blank pixels for a window of the capturing process itself; Dot only ever
/// tracks other apps' windows, so the probe does too.
@MainActor
final class Page {
    let window: NSWindow
    let scroll: NSScrollView
    let text: NSTextView

    init() {
        let frame = CGRect(x: 120, y: 160, width: 620, height: 520)
        window = NSWindow(contentRect: frame, styleMask: [.titled], backing: .buffered, defer: false)
        window.title = "Dot track probe"
        scroll = NSScrollView(frame: CGRect(origin: .zero, size: frame.size))
        scroll.hasVerticalScroller = true
        text = NSTextView(frame: CGRect(origin: .zero, size: frame.size))
        text.isEditable = false
        text.font = NSFont.systemFont(ofSize: 15)
        text.textContainerInset = NSSize(width: 18, height: 14)
        var lines: [String] = []
        let words = ["kernel", "image", "span", "basis", "linear", "map", "vector", "field", "subspace", "rank", "nullity", "matrix", "row", "column", "scalar"]
        var seed: UInt64 = 7
        for i in 1...160 {
            var line = "\(i). "
            for _ in 0..<(5 + Int(seed % 7)) {
                seed = seed &* 6364136223846793005 &+ 1442695040888963407
                line += words[Int(seed >> 40) % words.count] + " "
            }
            lines.append(line)
        }
        text.string = lines.joined(separator: "\n")
        scroll.documentView = text
        window.contentView = scroll
        window.makeKeyAndOrderFront(nil)
    }

    /// The screen rect (AppKit) of line `n` (1-based) as laid out now.
    func lineRect(_ n: Int) -> CGRect {
        let lm = text.layoutManager!, tc = text.textContainer!
        let ns = text.string as NSString
        var idx = 0
        for _ in 1..<n { idx = NSMaxRange(ns.lineRange(for: NSRange(location: idx, length: 0))) }
        let glyphs = lm.glyphRange(forCharacterRange: ns.lineRange(for: NSRange(location: idx, length: 0)), actualCharacterRange: nil)
        var r = lm.boundingRect(forGlyphRange: glyphs, in: tc)
        r.origin.x += text.textContainerOrigin.x; r.origin.y += text.textContainerOrigin.y
        r.size.width = min(r.width, 300)
        let inWindow = text.convert(r, to: nil)
        return window.convertToScreen(inWindow)
    }

    func scrollBy(_ dy: CGFloat) {
        let clip = scroll.contentView
        var o = clip.bounds.origin
        o.y = max(0, o.y + dy)
        clip.scroll(to: o)
        scroll.reflectScrolledClipView(clip)
    }

    /// stdin commands: "scroll <dy>" then "line <n>"; replies one line "x y w h" (AppKit screen rect).
    func serve() {
        DispatchQueue.global().async {
            while let line = readLine() {
                let parts = line.split(separator: " ")
                DispatchQueue.main.async {
                    MainActor.assumeIsolated {
                        if parts.first == "scroll", parts.count == 2, let dy = Double(parts[1]) { self.scrollBy(CGFloat(dy)); print("ok"); fflush(stdout) }
                        if parts.first == "line", parts.count == 2, let n = Int(parts[1]) {
                            let r = self.lineRect(n); print("\(r.minX) \(r.minY) \(r.width) \(r.height)"); fflush(stdout)
                        }
                        if parts.first == "quit" { exit(0) }
                    }
                }
            }
            exit(0)
        }
    }
}

/// The parent: tracks a mark on the child's window and measures drift.
@MainActor
final class Probe {
    let tracker = MarkTracker()
    var published: [CGRect] = []
    var results: [[String: Any]] = []
    let child = Process()
    let toChild = Pipe(), fromChild = Pipe()

    init() {
        child.executableURL = URL(fileURLWithPath: CommandLine.arguments[0])
        child.arguments = ["page"]
        child.standardInput = toChild
        child.standardOutput = fromChild
        try! child.run()
        tracker.onUpdate = { [weak self] _, rect, _, _ in self?.published.append(rect) }
    }

    func ask(_ command: String) -> String {
        toChild.fileHandleForWriting.write((command + "\n").data(using: .utf8)!)
        var line = Data()
        while true {
            let b = fromChild.fileHandleForReading.readData(ofLength: 1)
            if b.isEmpty || b == Data([10]) { break }
            line.append(b)
        }
        return String(data: line, encoding: .utf8) ?? ""
    }
    func lineRect(_ n: Int) -> CGRect {
        let v = ask("line \(n)").split(separator: " ").compactMap { Double($0) }
        return v.count == 4 ? CGRect(x: v[0], y: v[1], width: v[2], height: v[3]) : .zero
    }
    func scrollBy(_ dy: CGFloat) { _ = ask("scroll \(Double(dy))") }

    func gap(_ a: CGRect, _ b: CGRect) -> CGFloat { max(abs(a.midX - b.midX), abs(a.midY - b.midY)) }

    func run() async {
        try? await Task.sleep(nanoseconds: 900_000_000)
        let target = 24
        tracker.track(.highlight, appKitRect: lineRect(target))
        try? await Task.sleep(nanoseconds: 900_000_000)   // initial capture
        let r0 = lineRect(target)
        let center = CGPoint(x: r0.midX, y: NSScreen.screens[0].frame.height - r0.midY)  // CG point for the event, inside the child window
        // (scroll in points, prediction factor): 1.0 = the wheel delta matches, 0.6 / 1.5 = the app scaled it
        let steps: [(CGFloat, Double)] = [(40, 1.0), (60, 0.6), (-30, 1.0), (90, 1.5), (-75, 0.7), (25, 1.0), (120, 1.0), (-140, 0.8)]
        for (dy, factor) in steps {
            scrollBy(dy)
            // content moves up when the view scrolls down: a top-left screen delta of -dy
            tracker.simulateScroll(dy: Double(-dy) * factor, at: center)
            try? await Task.sleep(nanoseconds: 60_000_000)
            let during = tracker.currentRect(.highlight).map { gap($0, lineRect(target)) } ?? -1
            try? await Task.sleep(nanoseconds: 900_000_000)
            let truth = lineRect(target)
            let rest = tracker.currentRect(.highlight).map { gap($0, truth) } ?? -1
            results.append(["scroll": Double(dy), "factor": factor, "during": Double(during), "rest": Double(rest)])
        }
        let rests = results.compactMap { $0["rest"] as? Double }, durings = results.compactMap { $0["during"] as? Double }
        let exact = results.filter { ($0["factor"] as? Double) == 1.0 }.compactMap { $0["during"] as? Double }
        let summary: [String: Any] = ["steps": results, "max_rest": rests.max() ?? -1, "max_during": durings.max() ?? -1,
                                      "max_during_exact_wheel": exact.max() ?? -1, "updates": published.count]
        let data = try! JSONSerialization.data(withJSONObject: summary, options: [.sortedKeys])
        print(String(data: data, encoding: .utf8)!)
        _ = toChild.fileHandleForWriting.write("quit\n".data(using: .utf8)!)
        child.terminate()
        exit(0)
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
app.finishLaunching()
MainActor.assumeIsolated {
    if CommandLine.arguments.dropFirst().first == "page" {
        let page = Page()
        page.serve()
    } else {
        let probe = Probe()
        Task { @MainActor in await probe.run() }
    }
}
DispatchQueue.main.asyncAfter(deadline: .now() + 40) { print("{\"error\":\"timeout\"}"); exit(2) }
app.run()
