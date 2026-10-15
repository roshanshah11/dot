import DotKit
import Foundation

/// Roshan's day as Atlas knows it, refreshed in the background by `scripts/dot-atlas-today.py`
/// (a direct read of Atlas's store, no model call, a few seconds). Talk turns carry the block;
/// the lists feed the morning line, the notch and the Home window.
@MainActor
final class AtlasBridge {
    private(set) var brief: TodayBrief?
    private(set) var lastError: String?
    var onUpdate: ((TodayBrief) -> Void)?

    private let config: DotConfig
    private var timer: Timer?
    private var refreshing = false
    private let queue = DispatchQueue(label: "com.roshan.dot.atlas", qos: .utility)

    init(config: DotConfig) {
        self.config = config
    }

    var available: Bool { config.resolvedTodayCommand() != nil }
    var block: String { brief?.block ?? "" }

    func start() {
        guard available else {
            Log.info("atlas: today helper not available (python, harness or script missing); talk turns carry no [today] block")
            return
        }
        refresh(reason: "launch")
        timer?.invalidate()
        let minutes = max(config.todayRefreshMinutes, 2)
        timer = Timer.scheduledTimer(withTimeInterval: Double(minutes) * 60, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.refresh(reason: "timer") }
        }
    }

    /// Re-read soon (after an agent run that may have written to Atlas).
    func refreshSoon() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in self?.refresh(reason: "agent") }
    }

    func refresh(reason: String) {
        guard !refreshing, let command = config.resolvedTodayCommand() else { return }
        refreshing = true
        let harness = DotConfig.expand(config.atlasHarness)
        queue.async { [weak self] in
            let started = Date()
            let process = Process()
            process.executableURL = URL(fileURLWithPath: command[0])
            process.arguments = Array(command.dropFirst())
            var env = ClaudeSession.environment()
            env["PYTHONPATH"] = harness
            env["ATLAS_CHAT_SESSION"] = "dot-today"
            process.environment = env
            let out = Pipe(), err = Pipe()
            process.standardOutput = out
            process.standardError = err
            var data = Data()
            var errText = ""
            do {
                try process.run()
                let deadline = DispatchTime.now() + 40
                let group = DispatchGroup()
                group.enter()
                DispatchQueue.global().async {
                    data = out.fileHandleForReading.readDataToEndOfFile()
                    errText = String(data: err.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
                    group.leave()
                }
                if group.wait(timeout: deadline) == .timedOut {
                    process.terminate()
                    errText = "timed out after 40 s"
                }
                process.waitUntilExit()
            } catch {
                errText = error.localizedDescription
            }
            let brief = TodayBrief.parse(data)
            DispatchQueue.main.async {
                guard let self else { return }
                self.refreshing = false
                if let brief {
                    self.brief = brief
                    self.lastError = nil
                    Log.info("atlas: today refreshed (\(reason)) in \(Int(Date().timeIntervalSince(started) * 1000)) ms: \(brief.deadlines.count) deadlines, \(brief.today.count) events today, \(brief.unansweredCount) mail waiting")
                    self.onUpdate?(brief)
                } else {
                    self.lastError = errText.isEmpty ? "no output" : errText
                    Log.warn("atlas: today refresh failed (\(reason)): \(Log.short(self.lastError ?? "", 300))")
                }
            }
        }
    }

    /// A few lines for an agent's context: enough to notice a collision, not the whole day.
    /// What an agent should know about him before writing in his name (from Atlas facts and preferences).
    func profileBlock() -> String { brief?.profileBlock ?? "" }

    func shortBlock() -> String {
        guard let brief else { return "" }
        var lines = ["[today] \(brief.weekday) \(brief.date)"]
        for line in brief.deadlines.prefix(3) { lines.append("deadline: \(line)") }
        for line in brief.today.prefix(3) { lines.append("calendar: \(line)") }
        if brief.unansweredCount > 0 { lines.append("mail waiting on him: \(brief.unansweredCount)") }
        lines.append("[/today]")
        return lines.joined(separator: "\n")
    }
}
