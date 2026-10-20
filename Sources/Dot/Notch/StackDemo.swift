import DotKit
import Foundation

/// `Dot --stack-demo [--muted] [--job]` (04; G7, G8 and G9 of the review): one fake agent named "demo" (or, with
/// `--job`, a fake behind job with a 3 s pause) goes from running to done in about 15 s in the real stack, so the
/// folds, the timings and the window's size can be measured with scripts/winframes.swift. It never touches a real
/// agent, job or his volume: `--muted` fakes outputIsSilent. It never plays a chime and never speaks; where it would
/// have spoken it logs `speak: agent (demo, silent) <line>`, so a muted run logs no `speak:` line at all.
@MainActor
enum StackDemo {
    static let agentID = "stack-demo"
    static let jobID = "job-stack-demo"

    /// Placeholder words only (the repo is public).
    static let agentSteps = ["searching: COURSE 101 week 3 readings", "reading: example.com/course-101/syllabus", "writing the summary for Sam Rivera"]
    /// Long enough (about 175 characters) that a muted run's reading time, 60 ms a character, outlasts the 8 s done card.
    static let doneLine = "demo here. three placeholder readings for COURSE 101 are summarized in the output folder, the two due tomorrow are listed first, and Sam Rivera's notes are linked under each one."
    static let jobSteps = ["opening example.com/jobs", "searching: Northwind Bank analyst", "reading the third listing"]
    static let jobDoneLine = "the Northwind Bank listing at example.com is still open; it closes friday."

    static func run(stack: AgentStack, config: DotConfig, muted: Bool, job: Bool) {
        Log.info("stack-demo: start\(job ? " job" : " agent")\(muted ? ", muted (outputIsSilent faked)" : "")")
        if job { runJob(stack: stack, config: config, muted: muted) } else { runAgent(stack: stack, config: config, muted: muted) }
    }

    private static func at(_ seconds: Double, _ body: @escaping @MainActor () -> Void) {
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds) { MainActor.assumeIsolated { body() } }
    }

    private static func runAgent(stack: AgentStack, config: DotConfig, muted: Bool) {
        let started = Date()
        func chip(_ line: String, _ steps: [String], _ state: AgentChip.State = .running) -> StackChip {
            StackChip(id: agentID, kind: .agent, title: "demo", line: line, steps: steps, state: state, startedAt: started)
        }
        stack.upsert(chip("starting", []))
        Log.info("stack-demo: demo running")
        for (index, step) in agentSteps.enumerated() {
            at(Double(index + 1) * 3) {
                stack.upsert(chip(step, Array(agentSteps.prefix(index + 1))))
                Log.info("stack-demo: demo step \(index + 1): \(step)")
            }
        }
        at(14) { finish(stack: stack, config: config, muted: muted, id: agentID, title: "demo", kind: .agent, line: doneLine, started: started) }
    }

    private static func runJob(stack: AgentStack, config: DotConfig, muted: Bool) {
        let started = Date()
        func chip(_ line: String, _ steps: [String], _ state: AgentChip.State) -> StackChip {
            StackChip(id: jobID, kind: .job, title: "demo job", line: line, steps: steps, state: state, startedAt: started)
        }
        stack.upsert(chip("on it, behind your window.", [], .running))
        Log.info("stack-demo: job running")
        at(2) { stack.upsert(chip(jobSteps[0], Array(jobSteps.prefix(1)), .running)) }
        at(4) {
            stack.upsert(chip("you clicked in its tab", Array(jobSteps.prefix(1)), .paused))
            Log.info("stack-demo: job paused (paused · say go on), held 3 s")
        }
        at(7) {
            stack.upsert(chip(jobSteps[1], Array(jobSteps.prefix(2)), .running))
            Log.info("stack-demo: job picked up")
        }
        at(10) { stack.upsert(chip(jobSteps[2], jobSteps, .running)) }
        at(14) { finish(stack: stack, config: config, muted: muted, id: jobID, title: "demo job", kind: .job, line: jobDoneLine, started: started) }
    }

    /// The end, decided the way a real result is (AgentReport): what would have been said is logged, never said.
    private static func finish(stack: AgentStack, config: DotConfig, muted: Bool, id: String, title: String, kind: AgentChip.Kind, line: String, started: Date) {
        let report = AgentReport.decide(speakResults: config.speakAgentResults, routineMode: nil, notify: nil, unprompted: false, onCall: false,
                                        threadOpen: false, outputSilent: muted, isQuestion: false)
        if report.voice { Log.info("speak: \(kind == .job ? "job" : "agent") (demo, silent) \(String(line.prefix(60)))") }
        if report.chime { Log.info("stack-demo: a chime would play here (not played)") }
        var done = StackChip(id: id, kind: kind, title: title, line: line, state: .done, startedAt: started)
        if report.text { done.holdUntil = Date().addingTimeInterval(NotchSurface.readingTime(characters: line.count)) }
        stack.upsert(done)
        Log.info("stack-demo: \(title) done (voice \(report.voice), text \(report.text), chip \(report.chip.rawValue)); "
                 + "gone in \(Int(report.text ? NotchSurface.readingTime(characters: line.count) : AgentChip.doneSeconds)) s")
        at(25) { Log.info("stack-demo: end (\(stack.chip(id: id) == nil ? "chip gone" : "chip still up"))") }
    }
}
