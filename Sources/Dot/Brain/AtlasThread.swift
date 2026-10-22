import Foundation

/// One thread of record with Atlas (his call, 2026-10-22: "the whole point was dot/atlas integration"). What he says to
/// Dot, what Dot answers, and how its jobs and agents end go into Atlas's conversation history, which every Atlas chat
/// (Telegram, the app, his terminal) already reads; his newest Atlas turns come back here as context lines, so "it" can
/// mean what he just told Atlas. The work is scripts/dot-atlas-thread.py; this keeps it off the main thread and quiet.
@MainActor
final class AtlasThread {
    static let shared = AtlasThread()

    struct Turn: Equatable {
        let at: Date
        let surface: String
        let asked: String
        let said: String
    }

    var enabled = true
    private(set) var turns: [Turn] = []
    private var fetching = false
    private var pending: [[String: String]] = []
    private var flushing = false
    private var timer: Timer?

    private var script: String? {
        DotConfig.bundledScript("dot-atlas-thread.py", fallback: "~/Projects/dot-fast/scripts/dot-atlas-thread.py")
    }

    private static let stamp: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        f.timeZone = .current   // an offset, not Z: the system python (3.9) reads only offsets
        return f
    }()

    /// Reads his Atlas turns now and every minute after (about 0.8 s of ssh each, in the background).
    func start() {
        guard enabled, timer == nil else { return }
        refresh()
        timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { _ in
            Task { @MainActor in AtlasThread.shared.refresh() }
        }
    }

    /// kind: talk (his words and Dot's answer), job or agent (his words and how it ended).
    func record(kind: String, asked: String, said: String) {
        guard enabled, !(asked.isEmpty && said.isEmpty) else { return }
        pending.append(["at": Self.stamp.string(from: Date()), "kind": kind, "asked": asked, "said": said])
        flush()
    }

    private func flush() {
        guard !flushing, !pending.isEmpty, let script else { return }
        flushing = true
        let batch = pending
        pending = []
        let body = batch.compactMap { try? JSONSerialization.data(withJSONObject: $0) }
            .map { String(decoding: $0, as: UTF8.self) }.joined(separator: "\n") + "\n"
        Task {
            let (code, out) = await Self.run(script, ["record"], input: body, timeout: 20)
            if code != 0 { Log.warn("atlas thread: record failed (\(code)): \(Log.short(out, 160))") }
            else { Log.info("atlas thread: recorded \(batch.count) (\(Log.short(out.trimmingCharacters(in: .whitespacesAndNewlines), 60)))") }
            self.flushing = false
            if !self.pending.isEmpty { self.flush() }
        }
    }

    func refresh() {
        guard enabled, !fetching, let script else { return }
        fetching = true
        Task {
            let (code, out) = await Self.run(script, ["recent", "--minutes", "45", "--limit", "6"], input: nil, timeout: 15)
            self.fetching = false
            guard code == 0 else { Log.warn("atlas thread: recent failed (\(code))"); return }
            let parsed = Self.parse(out)
            if parsed != self.turns, let last = parsed.last {
                Log.info("atlas thread: \(parsed.count) atlas turns; newest \(last.surface): \(Log.short(last.asked, 60))")
            }
            self.turns = parsed
        }
    }

    nonisolated static func parse(_ out: String) -> [Turn] {
        let iso = ISO8601DateFormatter()
        return out.split(separator: "\n").compactMap { line -> Turn? in
            guard let data = line.data(using: .utf8), let obj = try? JSONSerialization.jsonObject(with: data) as? [String: String],
                  let at = obj["at"].flatMap({ iso.date(from: $0.replacingOccurrences(of: "+00:00", with: "Z")) }) else { return nil }
            return Turn(at: at, surface: obj["surface"] ?? "atlas", asked: obj["asked"] ?? "", said: obj["said"] ?? "")
        }
    }

    /// Context lines for talk and a new job: his Atlas turns from the last 30 minutes, at most three, newest last.
    func lines(now: Date = Date()) -> [String] {
        Self.lines(turns, now: now)
    }

    nonisolated static func lines(_ turns: [Turn], now: Date) -> [String] {
        let fresh = turns.filter { now.timeIntervalSince($0.at) < 1800 }.suffix(3)
        guard !fresh.isEmpty else { return [] }
        let clock = DateFormatter()
        clock.dateFormat = "h:mm"
        func short(_ t: String, _ n: Int) -> String {
            let flat = t.split(whereSeparator: \.isNewline).joined(separator: " ")
            return flat.count <= n ? flat : String(flat.prefix(n)) + "…"
        }
        var out = ["said lately in his atlas chats (the same assistant in another window; \"it\" and \"that\" may mean these; newest last):"]
        for t in fresh {
            out.append("- \(t.surface) at \(clock.string(from: t.at)): he said \"\(short(t.asked, 160))\"" + (t.said.isEmpty ? "" : "; atlas said \"\(short(t.said, 240))\""))
        }
        return out
    }

    /// The script with optional stdin, off the main thread; its exit code and stdout.
    nonisolated private static func run(_ script: String, _ args: [String], input: String?, timeout: TimeInterval) async -> (Int32, String) {
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .utility).async {
                let p = Process()
                p.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
                p.arguments = [script] + args
                let out = Pipe(), err = Pipe(), inp = Pipe()
                p.standardOutput = out
                p.standardError = err
                p.standardInput = inp
                do { try p.run() } catch { continuation.resume(returning: (-1, "\(error)")); return }
                if let input { inp.fileHandleForWriting.write(Data(input.utf8)) }
                try? inp.fileHandleForWriting.close()
                let deadline = Date().addingTimeInterval(timeout)
                while p.isRunning, Date() < deadline { Thread.sleep(forTimeInterval: 0.05) }
                if p.isRunning { p.terminate(); continuation.resume(returning: (-2, "timeout")); return }
                let text = String(decoding: out.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
                let errText = String(decoding: err.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
                continuation.resume(returning: (p.terminationStatus, p.terminationStatus == 0 ? text : text + errText))
            }
        }
    }
}
