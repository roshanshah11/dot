// What Dot's rules (round seven) do with recorded permission requests: AgentRules then ConsentPolicy,
// in AgentManager.permission's order, built the way AgentManager.consentPolicy(for:) builds it.
import Foundation
let home = NSHomeDirectory()
let lines = (try? String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8))?.split(separator: "\n") ?? []
let rules = AgentRules.load(from: URL(fileURLWithPath: "\(home)/Dot/rules.json"))
let known: Set<String> = ["cua-driver", "atlas", "cua-computer-use", "computer-use", "cmux-cua"]
var cards = 0
for line in lines {
    guard let obj = try? JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any],
          let tool = obj["tool"] as? String, let input = obj["input"] as? [String: Any], let folder = obj["workspace"] as? String else { continue }
    var allow = Set<String>()
    // AgentManager.consentPolicy(for:): the Atlas tools agents may call without asking.
    for name in ["search", "get", "calendar", "calendars", "mail", "messages", "messages_thread", "contacts", "people", "facts", "history",
                 "journal", "harness_status", "now", "free", "thread", "unanswered", "attachments", "postings", "proposals", "status",
                 "docs", "read_doc", "view_note", "apple_note_read", "recent_files", "commitments", "vocabulary", "sec_lookup", "sec_facts",
                 "sec_batch", "sec_filings", "sec_section", "quote", "fin_calc", "web_text", "canvas_courses", "canvas_find", "canvas_read",
                 "state", "preferences", "lesson", "deliverable", "project", "todo", "reminder", "remember", "deadline_add", "commit", "file"] {
        allow.insert("mcp__atlas__\(name)")
    }
    let prefixes = ["mcp__cua-driver__", "mcp__claude_ai_Gmail__", "mcp__claude_ai_Google_Calendar__", "mcp__claude_ai_Google_Drive__"]
    let writable = [folder, "\(home)/Dot", NSTemporaryDirectory(), "/private/tmp", "/tmp", home]
    let protected = ["\(home)/roshan/Atlas/private", "\(home)/roshan/Atlas/objects", "\(home)/roshan/Atlas/qmd-state", "\(home)/.ssh",
                     "\(home)/.claude", "\(home)/.claude-1", "\(home)/.claude-2", "\(home)/.config", "\(home)/Library/Keychains",
                     "\(home)/Library/Application Support", "\(home)/Library/Preferences", "\(home)/Projects/browser-agent/.env"]
    let policy = ConsentPolicy(allowTools: allow, allowToolPrefixes: prefixes, denyTools: [], writableRoots: writable, protectedRoots: protected,
                               workingDirectory: folder, deletableRoots: [folder, NSTemporaryDirectory(), "/private/tmp", "/tmp"],
                               undeletableRoots: ["\(folder)/.dot", "\(folder)/CLAUDE.md"], knownServers: known)
    let request = ToolRequest(toolName: tool, input: AnyCodableValue.object(from: input), description: input["description"] as? String)
    var command = request.string("command")
    let deletesOutside = tool == "Bash" && command.map(policy.deletesOutsideScratch) == true
    if tool == "Bash", let full = command, let rest = policy.commandWithoutScratchDeletes(full) { command = rest }
    let cls: ActionClass = deletesOutside ? .outward : tool == "Bash" && command?.isEmpty == true ? .write
        : AgentRules.classify(toolName: tool, command: command, flattened: ConsentPolicy.flatten(request.input), input: request.input, knownServers: known)
    let behavior = rules.behavior(for: cls, agent: "probe")
    var outcome: String
    switch behavior {
    case .mine: outcome = "refused: his to do"
    case .ask, .ifAsked: outcome = "CARD"
    case .act:
        switch policy.decide(request) {
        case .allow: outcome = "runs, no card"
        case .deny: outcome = "refused"
        case .ask:
            if tool == "Bash", let c = request.string("command"), !policy.mustAsk(c) { outcome = "Jev judges (card only if risky)" } else { outcome = "CARD" }
        }
    }
    if outcome == "CARD" { cards += 1 }
    let shown = (request.string("command") ?? request.string("file_path") ?? "").replacingOccurrences(of: folder, with: "<agent>")
    print("\(tool) \(shown.prefix(70)) -> \(cls.rawValue)\(deletesOutside ? " (a delete outside its folder)" : "") -> \(outcome)")
}
print("cards: \(cards) of \(lines.count)")
