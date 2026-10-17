import DotKit
import Foundation

/// Context lines (docs/alive.md, round two; his idea: "good luck on math!!"): a small model writes the
/// quip for the moment instead of the written bank. One `claude -p` per quip on `quipModel` (Haiku by
/// default) with no tools, no setting sources and nothing saved to disk; QuipPrompt is the whole prompt
/// and QuipLine checks the answer. A failed check, an error or more than six seconds comes back with no
/// line, and Noticer falls back to the bank. A quip comes every 40 minutes at most, so a process kept
/// warm all day would cost more than the second or two a cold start takes.
@MainActor
final class QuipWriter {
    /// What one run produced: the model's text, the line when it passed the check, and what it took.
    struct Outcome {
        var raw: String?
        var line: String?
        var seconds: Double
        var costUSD: Double
        var timedOut: Bool
    }

    static let timeout: TimeInterval = 6

    var config: DotConfig
    /// The run in flight, held until it answers or times out.
    private var session: ClaudeSession?

    init(config: DotConfig) {
        self.config = config
    }

    var isBusy: Bool { session != nil }

    func write(_ context: QuipContext, completion: @escaping (Outcome) -> Void) {
        guard session == nil else { return completion(Outcome(raw: nil, line: nil, seconds: 0, costUSD: 0, timedOut: false)) }
        var options = ClaudeSession.Options(cwd: config.talkRootURL, model: config.quipModel)
        options.systemPrompt = QuipPrompt.system
        options.tools = []
        options.maxTurns = 1
        options.settingSources = ""
        options.permissionPromptOverStdio = false
        options.includePartialMessages = false
        options.extraArguments = ["--no-session-persistence"]
        // Thinking is on by default and ran Haiku past the six seconds on every line (11 s for one, 2 s
        // without it, 2026-10-17); one short line needs none.
        options.environment = ["MAX_THINKING_TOKENS": "0"]
        let session = ClaudeSession(label: "quip", claudePath: config.claudeExecutable, options: options)
        let started = Date()
        var finished = false
        let finish = { [weak self, weak session] (raw: String?, cost: Double, timedOut: Bool) in
            guard !finished else { return }
            finished = true
            if timedOut { session?.terminateNow() } else { session?.stop() }
            self?.session = nil
            completion(Outcome(raw: raw, line: raw.flatMap { QuipLine.check($0, for: context) },
                               seconds: Date().timeIntervalSince(started), costUSD: cost, timedOut: timedOut))
        }
        session.onEvent = { event in
            guard case .result(let info) = event else { return }
            finish(info.isError ? nil : info.resultText, info.costUSD, false)
        }
        session.onExit = { _ in finish(nil, 0, false) }
        do {
            try session.start()
        } catch {
            Log.warn("quip: the \(config.quipModel) session did not start: \(error)")
            return completion(Outcome(raw: nil, line: nil, seconds: 0, costUSD: 0, timedOut: false))
        }
        self.session = session
        session.send(text: QuipPrompt.message(for: context))
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.timeout) { finish(nil, 0, true) }
    }

    // MARK: `Dot --quip-test`

    /// Three made-up moments through the real writer, outside the app: each prompt, the model's answer
    /// and what the check made of it. True when every run came back in time with a line that passed.
    static func selfTest(config: DotConfig) -> Bool {
        let calendar = Calendar.current
        let now = Date()
        let elevenPM = calendar.date(bySettingHour: 23, minute: 0, second: 0, of: now) ?? now
        let tomorrowTen = calendar.date(bySettingHour: 10, minute: 0, second: 0, of: now.addingTimeInterval(24 * 3600)) ?? now
        let moments: [(String, QuipContext)] = [
            ("a math exam in an hour", QuipContext(situation: .upcoming, now: now, app: "Preview", windowTitle: "MATH 20250 practice midterm.pdf",
                                                   next: UpcomingEvent(title: "MATH 20250: midterm exam", start: now.addingTimeInterval(60 * 60), isDeadline: false))),
            ("back after 20 min idle at 11 pm", QuipContext(situation: .backLong, now: elevenPM, app: "Comet", windowTitle: "Canvas: PHYS 13100 problem set 4",
                                                            next: UpcomingEvent(title: "MATH 20250: timed mock exam (50 min, closed book)", start: tomorrowTen, isDeadline: false))),
            ("an agent finished a comps sheet", QuipContext(situation: .agentDone, now: now, app: "Microsoft Excel", windowTitle: "regional_bank_comps.xlsx",
                                                            agent: QuipContext.Agent(line: "Built the comps sheet for six regional banks (P/E, P/TBV, ROTCE), saved as regional_bank_comps.xlsx.", failed: false))),
        ]
        print("model: \(config.quipModel)\n\nsystem prompt:\n\(QuipPrompt.system)\n")
        let writer = QuipWriter(config: config)
        var passed = 0
        for (name, context) in moments {
            print("== \(name)\n\(QuipPrompt.message(for: context))")
            var outcome: Outcome?
            writer.write(context) { outcome = $0 }
            while outcome == nil { RunLoop.main.run(until: Date().addingTimeInterval(0.05)) }
            guard let outcome else { continue }
            print("-> model: \(outcome.raw.map { "\"\($0)\"" } ?? (outcome.timedOut ? "(timed out)" : "(no answer)"))")
            print("-> check: \(outcome.line.map { "passed: \($0)" } ?? "failed, so the written bank")")
            print(String(format: "-> %.1f s, $%.4f\n", outcome.seconds, outcome.costUSD))
            if outcome.line != nil { passed += 1 }
        }
        print("\(passed) of \(moments.count) passed")
        return passed == moments.count
    }
}
