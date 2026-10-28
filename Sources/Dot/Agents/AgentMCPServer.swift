import DotKit
import Foundation

/// `Dot --agent-mcp --agent <slug>`: the stdio MCP server an agent sees as `dot-agents` (AG-18 note_to and
/// list_agents). It answers initialize, tools/list and ping itself (AgentMCPWire) and relays each
/// tools/call to the running Dot over the control socket. Nothing but JSON-RPC goes to stdout; it exits when stdin closes.
enum AgentMCPServer {
    static func run(_ arguments: [String]) -> Never {
        var agent = ""
        if let i = arguments.firstIndex(of: "--agent"), i + 1 < arguments.count { agent = arguments[i + 1] }
        let path = ProcessInfo.processInfo.environment[ControlServer.pathVariable].flatMap { $0.isEmpty ? nil : $0 }
            ?? (NSHomeDirectory() as NSString).appendingPathComponent("Dot/control.sock")
        note("agent \(agent), socket \(path)")
        while let line = readLine(strippingNewline: true) {
            guard !line.trimmingCharacters(in: .whitespaces).isEmpty else { continue }
            guard let request = HandsMCPWire.parse(line) else { note("not json-rpc: \(line.prefix(80))"); continue }
            if let reply = AgentMCPWire.localReply(request) { write(reply); continue }
            guard request.method == "tools/call", let id = request.id else { continue }
            let name = request.params["name"] as? String ?? ""
            let args = request.params["arguments"] as? [String: Any] ?? [:]
            guard AgentMCPWire.toolNames.contains(name) else {
                write(HandsMCPWire.response(id: id, result: HandsMCPWire.callResult(text: "error: no tool \(name)", isError: true)))
                continue
            }
            let timeout = AgentMCPWire.timeout(name)
            let result: [String: Any]
            do {
                let reply = try UnixSocketClient.send(["verb": "agent-tool", "agent": agent, "tool": name, "args": args], to: path, timeout: timeout)
                if let error = reply["error"] as? String {
                    result = HandsMCPWire.callResult(text: "error: \(error)", isError: true)
                } else {
                    result = HandsMCPWire.callResult(text: reply["text"] as? String ?? "", isError: reply["isError"] as? Bool ?? false)
                }
            } catch UnixSocketError.timedOut {
                result = HandsMCPWire.callResult(text: "error: dot didn't answer in \(Int(timeout)) s", isError: true)
            } catch {
                result = HandsMCPWire.callResult(text: "Dot is not running", isError: true)
                note("dot unreachable at \(path): \(error)")
            }
            write(HandsMCPWire.response(id: id, result: result))
        }
        exit(0)
    }

    private static func write(_ line: String) {
        FileHandle.standardOutput.write(Data((line + "\n").utf8))
    }

    private static func note(_ text: String) {
        FileHandle.standardError.write(Data("dot agents: \(text)\n".utf8))
    }
}
