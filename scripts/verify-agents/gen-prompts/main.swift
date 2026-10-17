// Prints the exact agent system-prompt addition and CLAUDE.md Dot's AgentManager builds,
// from Dot's own Prompts.swift and DotKit's AgentRules (standard rules, helpers on).
import Foundation
let mode = CommandLine.arguments.dropFirst().first ?? "append"
let name = CommandLine.arguments.dropFirst(2).first ?? "Probe"
let rules = AgentRules.load(from: URL(fileURLWithPath: NSHomeDirectory() + "/Dot/rules.json"))
switch mode {
case "append": print(Prompts.agent(name: name) + Prompts.agentExtras(helpers: true, rulesLine: rules.briefLine(for: name.lowercased())), terminator: "")
case "claudemd": print(Prompts.agentClaudeMD(name: name), terminator: "")
default: break
}
