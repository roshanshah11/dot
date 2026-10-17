import DotKit
import Foundation

/// `Dot --gate [--agent <slug>]`: Claude Code's PreToolUse and PostToolUse hook for Dot's agents
/// (AG-07). Reads the hook's JSON on stdin, asks the running Dot over the control socket, prints
/// Claude Code's decision and exits 0. With no Dot to ask (no socket, a refusal, a hang-up) the
/// offline rule decides: plain reads run, anything else is denied with "Dot is not running".
/// Nothing but the decision goes to stdout; notes go to stderr (Claude Code's debug log).
enum Gate {
    /// What startRun installs as the hook's command: this very executable.
    static var executablePath: String { Bundle.main.executablePath ?? CommandLine.arguments[0] }

    static func run(_ arguments: [String]) -> Never {
        let data = FileHandle.standardInput.readDataToEndOfFile()
        guard let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any], let input = HookInput(object: object) else {
            note("not a hook call; no decision")
            exit(0)
        }
        var agent: String?
        if let index = arguments.firstIndex(of: "--agent"), index + 1 < arguments.count { agent = arguments[index + 1] }
        let pre = input.event == "PreToolUse"
        var request: [String: Any] = ["verb": pre ? "gate" : "post", "input": object]
        if let agent { request["agent"] = agent }
        let path = ProcessInfo.processInfo.environment[ControlServer.pathVariable].flatMap { $0.isEmpty ? nil : $0 }
            ?? (NSHomeDirectory() as NSString).appendingPathComponent("Dot/control.sock")
        // Answer before Claude Code's own limit, so a decision is always printed.
        let timeout = TimeInterval(pre ? HookDecision.gateTimeout - HookDecision.gateMargin : HookDecision.postTimeout - 5)
        let decision: HookDecision
        do {
            let reply = try UnixSocketClient.send(request, to: path, timeout: timeout)
            // A Dot that does not know the verb leaves it to Claude Code's own flow (the stdio prompt).
            decision = HookDecision(wire: reply) ?? .pass
            if case .pass = decision, let error = reply["error"] as? String { note("dot: \(error)") }
        } catch UnixSocketError.timedOut {
            decision = pre ? .deny("No answer from Roshan in time. Skip this step, finish the rest and say what is waiting on him.") : .pass
            note("no answer in \(Int(timeout)) s")
        } catch {
            if pre, case .deny = HookDecision.offline(input), let answer = waitForDot(request, path: path, timeout: timeout) {
                decision = answer
            } else {
                decision = HookDecision.offline(input)
                note("dot unreachable at \(path) (\(error)); offline rule: \(decision.wire["decision"] ?? "")")
            }
        }
        let line = decision.output(for: input.event)
        if !line.isEmpty { FileHandle.standardOutput.write(Data((line + "\n").utf8)) }
        exit(0)
    }

    /// An agent in the agent host (AG-12) outlives Dot: a call that needs Dot asks again until a
    /// relaunched Dot answers (its card comes back there), and is denied by the host's 30-minute rule
    /// when none does. nil for an agent Dot runs itself: the offline rule decides at once.
    private static func waitForDot(_ request: [String: Any], path: String, timeout: TimeInterval) -> HookDecision? {
        let environment = ProcessInfo.processInfo.environment
        guard environment["DOT_AGENT_HOST"] == "1" else { return nil }
        let after = environment["DOT_HOST_DENY_AFTER"].flatMap(Double.init) ?? HostPending.denyAfter
        let deadline = Date().addingTimeInterval(after)
        note("dot unreachable; waiting up to \(Int(after)) s for it to come back")
        while Date() < deadline {
            Thread.sleep(forTimeInterval: min(2, max(0.1, deadline.timeIntervalSinceNow)))
            do {
                let reply = try UnixSocketClient.send(request, to: path, timeout: timeout)
                return HookDecision(wire: reply) ?? .pass
            } catch UnixSocketError.timedOut {
                return .deny("No answer from Roshan in time. Skip this step, finish the rest and say what is waiting on him.")
            } catch {
                continue
            }
        }
        return .deny(HostPending.denyMessage(after: after))
    }

    private static func note(_ text: String) {
        FileHandle.standardError.write(Data("dot gate: \(text)\n".utf8))
    }
}
