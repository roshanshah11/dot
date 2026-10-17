// Replays AgentManager.permission's decision for one agent tool call: AgentRules first
// (class -> behavior from ~/Dot/rules.json, AgentRules.standard when absent), then the
// ConsentPolicy built the way AgentManager.consentPolicy(for:) builds it. Compiled together
// with Dot's own Sources/DotKit, so classify/decide are Dot's code, not a copy.
import Foundation

let home = NSHomeDirectory()
let agentFolder = "\(home)/Dot/agents/dot"
let rules = AgentRules.load(from: URL(fileURLWithPath: "\(home)/Dot/rules.json"))

var allow = Set<String>()
var prefixes: [String] = []
prefixes.append(contentsOf: ["mcp__cua-driver__", "mcp__cua-computer-use__", "mcp__computer-use__", "mcp__cmux-cua__"])
for name in ["search", "get", "calendar", "calendars", "mail", "messages", "messages_thread", "contacts", "people", "facts", "history",
             "journal", "harness_status", "now", "free", "thread", "unanswered", "attachments", "postings", "proposals", "status",
             "docs", "read_doc", "view_note", "apple_note_read", "recent_files", "commitments", "vocabulary", "sec_lookup", "sec_facts",
             "sec_batch", "sec_filings", "sec_section", "quote", "fin_calc", "web_text", "canvas_courses", "canvas_find", "canvas_read",
             "state", "preferences", "lesson", "deliverable", "project", "todo", "reminder", "remember", "deadline_add", "commit", "file"] {
    allow.insert("mcp__atlas__\(name)")
}
prefixes.append(contentsOf: ["mcp__claude_ai_Gmail__", "mcp__claude_ai_Google_Calendar__", "mcp__claude_ai_Google_Drive__"])
prefixes.removeAll { $0.hasSuffix("send") }
let writable = [agentFolder, "\(home)/Dot", NSTemporaryDirectory(), "/private/tmp", "/tmp", home]
// Round seven: deletes inside the agent's folder or a temp folder pass; MCP servers Dot doesn't hand agents ask.
let known: Set<String> = ["cua-driver", "atlas", "cua-computer-use", "computer-use", "cmux-cua"]
let protected = ["\(home)/roshan/Atlas/private", "\(home)/roshan/Atlas/objects", "\(home)/roshan/Atlas/qmd-state", "\(home)/.ssh",
                 "\(home)/.claude", "\(home)/.claude-1", "\(home)/.claude-2", "\(home)/.config", "\(home)/Library/Keychains",
                 "\(home)/Library/Application Support", "\(home)/Library/Preferences", "\(home)/Projects/browser-agent/.env"]
let policy = ConsentPolicy(allowTools: allow, allowToolPrefixes: prefixes, denyTools: [], writableRoots: writable, protectedRoots: protected,
                           workingDirectory: agentFolder, deletableRoots: [agentFolder, NSTemporaryDirectory(), "/private/tmp", "/tmp"],
                           undeletableRoots: ["\(agentFolder)/.dot", "\(agentFolder)/CLAUDE.md"], knownServers: known)

func outcome(_ tool: String, _ input: [String: Any], brief: String = "do the task") -> (String, String) {
    let request = ToolRequest(toolName: tool, input: AnyCodableValue.object(from: input), description: nil)
    var command = request.string("command")
    let deletesOutside = tool == "Bash" && command.map(policy.deletesOutsideScratch) == true
    if tool == "Bash", let full = command, let rest = policy.commandWithoutScratchDeletes(full) { command = rest }
    let cls: ActionClass = deletesOutside ? .outward : tool == "Bash" && command?.isEmpty == true ? .write
        : AgentRules.classify(toolName: tool, command: command, flattened: ConsentPolicy.flatten(request.input), input: request.input, knownServers: known)
    let behavior = rules.behavior(for: cls, agent: "dot")
    switch behavior {
    case .mine: return (cls.rawValue, "refused: his to do")
    case .ask, .ifAsked:
        if behavior == .ifAsked, AgentRules.briefAsks(for: cls, brief: brief) { return (cls.rawValue, "runs: his brief asked") }
        if case .deny = policy.decide(request) { return (cls.rawValue, "refused by policy") }
        return (cls.rawValue, "card: asks him first")
    case .act:
        switch policy.decide(request) {
        case .allow: return (cls.rawValue, "runs without asking")
        case .deny: return (cls.rawValue, "refused by policy")
        case .ask:
            if tool == "Bash", let c = request.string("command"), !policy.mustAsk(c) { return (cls.rawValue, "Jev judges: runs if risk <= 0.4, else card") }
            return (cls.rawValue, "card: asks him first")
        }
    }
}

let cases: [(String, [String: Any])] = [
    ("Bash", ["command": "git push origin main"]),
    ("Bash", ["command": "gmail send --to a@b.com --subject hi --body hello"]),
    ("Bash", ["command": "rm -rf ~/Documents/old-drafts"]),
    ("mcp__claude_ai_Gmail__send_message", ["to": "a@b.com", "subject": "hi", "body": "hello"]),
    ("mcp__claude_ai_Gmail__trash_thread", ["threadId": "1a13fa8a2deb4b4d"]),
    ("mcp__atlas__calendar_delete", ["event_id": "474EB3A1"]),
    ("mcp__atlas__imessage_send", ["to": "+13125550100", "text": "on my way"]),
    ("mcp__atlas__send_email", ["to": "a@b.com", "subject": "hi", "body": "hello"]),
    ("mcp__claude_ai_Google_Calendar__respond_to_event", ["eventId": "abc", "response": "declined"]),
    ("mcp__claude_ai_Google_Calendar__create_event", ["summary": "Coffee", "attendees": ["banker@firm.com"]]),
    ("mcp__claude_ai_Google_Drive__share_file", ["fileId": "1xyz", "emailAddress": "someone@else.com", "role": "writer"]),
    ("mcp__cua-driver__click", ["element": "Send"]),
    ("mcp__cua-driver__click", ["x": 400, "y": 300, "scope": "desktop"]),
    ("mcp__cua-driver__hotkey", ["keys": ["cmd", "l"]]),
    ("mcp__cua-driver__kill_app", ["bundle_id": "com.apple.Notes"]),
    ("mcp__cua-driver__clipboard_read", [:]),
    ("mcp__cua-driver__run_script", ["script": "tell application \"Finder\" to get name of front window"]),
    ("Write", ["file_path": "\(home)/.ssh/config", "content": "Host x"]),
    ("Bash", ["command": "security find-generic-password -s example -w"]),
    // The same outward or irreversible steps through MCP tools that run commands (all loaded in Dot's agents).
    ("mcp__rea__capture_process_scenario", ["executable": "git", "arguments": ["push", "origin", "main"]]),
    ("mcp__rea__capture_process_scenario", ["executable": "/bin/rm", "arguments": ["-rf", "\(home)/Documents/old-drafts"]]),
    ("mcp__blender__execute_blender_code", ["code": "import shutil; shutil.rmtree('\(home)/Documents/old-drafts')"]),
    ("mcp__cua-driver__run_script", ["script": "do shell script \"git push origin main\""]),
    // Round seven: deletes inside the agent's own folder, and anywhere else.
    ("Bash", ["command": "rm -rf ./tmp/probe-nothing"]),
    ("Bash", ["command": "rm -rf \(agentFolder)/tmp/renders && ls output"]),
    ("Bash", ["command": "rm -rf \(home)/roshan/Career/old"]),
    ("Write", ["file_path": "\(home)/roshan/Atlas/private/probe.txt", "content": "x"]),
]
for (tool, input) in cases {
    let (cls, result) = outcome(tool, input)
    let args = (try? JSONSerialization.data(withJSONObject: input, options: [.sortedKeys])).flatMap { String(data: $0, encoding: .utf8) } ?? ""
    print("\(tool) \(args.prefix(70)) -> class \(cls) -> \(result)")
}
