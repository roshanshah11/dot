import DotKit
import Foundation

/// `Dot --hands-mcp --job <id>`: the stdio MCP server a job sees as `dot`. It answers initialize, tools/list and ping
/// itself (HandsMCPWire) and relays each tools/call to the running Dot over the control socket, the same way `Dot --gate`
/// asks it. Nothing but JSON-RPC goes to stdout; notes go to stderr. It exits when stdin closes.
enum HandsMCPServer {
    static func run(_ arguments: [String]) -> Never {
        var job = ""
        if let i = arguments.firstIndex(of: "--job"), i + 1 < arguments.count { job = arguments[i + 1] }
        let path = ProcessInfo.processInfo.environment["DOT_CONTROL_SOCKET"].flatMap { $0.isEmpty ? nil : $0 }
            ?? (NSHomeDirectory() as NSString).appendingPathComponent("Dot/control.sock")
        note("job \(job), socket \(path)")
        while let line = readLine(strippingNewline: true) {
            guard !line.trimmingCharacters(in: .whitespaces).isEmpty else { continue }
            guard let request = HandsMCPWire.parse(line) else { note("not json-rpc: \(line.prefix(80))"); continue }
            if let reply = HandsMCPWire.localReply(request) { write(reply); continue }
            guard request.method == "tools/call", let id = request.id else { continue }
            let name = request.params["name"] as? String ?? ""
            let args = request.params["arguments"] as? [String: Any] ?? [:]
            guard HandsMCPWire.toolNames.contains(name) else {
                write(HandsMCPWire.response(id: id, result: HandsMCPWire.callResult(text: "error: no tool \(name)", isError: true)))
                continue
            }
            // A download waits up to 120 s for the file; everything else answers well inside 60.
            let timeout: TimeInterval = name == "download" ? 130 : 60
            let result: [String: Any]
            do {
                let reply = try UnixSocketClient.send(["verb": "hands", "job": job, "tool": name, "args": args], to: path, timeout: timeout)
                if let error = reply["error"] as? String {
                    result = HandsMCPWire.callResult(text: "error: \(error)", isError: true)
                } else {
                    result = HandsMCPWire.callResult(text: reply["text"] as? String ?? "", isError: reply["isError"] as? Bool ?? false,
                                                     imageBase64: reply["image"] as? String)
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
        FileHandle.standardError.write(Data("dot hands: \(text)\n".utf8))
    }
}
