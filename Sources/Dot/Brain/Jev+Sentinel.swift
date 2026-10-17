import DotKit
import Foundation

/// The sentinel's questions through Jev (AG-13). The pure parts (which calls, what Jev sees, the
/// threshold, the effect named on the card) are DotKit's `Sentinel`; this only asks.
extension Jev {
    /// Judges one tool call the rules would let run. `.unjudged` when Jev fails or is slow, which
    /// callers treat as no change. The completion runs on the main thread.
    func sentinel(toolName: String, input: [String: AnyCodableValue], timeout: TimeInterval = 1.6,
                  completion: @escaping (Sentinel.Verdict) -> Void) {
        var questions: [String: Question] = [:]
        for q in Sentinel.questions { questions[q.key] = .yesNo(instructions: q.instructions, yes: q.yes, no: q.no) }
        evaluate("sentinel", state: Sentinel.state(toolName: toolName, input: input), questions: questions, timeout: timeout) { answers in
            completion(Sentinel.verdict(answers.map { $0.compactMapValues { $0.probability } }))
        }
    }

    /// For PostToolUse: the context line to add when a web, browser or mail output carries
    /// instructions; nil when it does not, or when Jev gave no answer.
    func injectionCheck(toolName: String, output: String, timeout: TimeInterval = 1.6, completion: @escaping (String?) -> Void) {
        let q = Sentinel.injectionQuestion
        evaluate("sentinel-output", state: Sentinel.outputState(toolName: toolName, output: output),
                 questions: [q.key: .yesNo(instructions: q.instructions, yes: q.yes, no: q.no)], timeout: timeout) { answers in
            completion(Sentinel.carriesInstructions(answers?[q.key]?.probability) ? Sentinel.injectionContext(toolName: toolName) : nil)
        }
    }
}
