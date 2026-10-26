import Foundation

/// An MCP config with its stdio servers fronted by the router (IN-03). Each routed entry keeps its name and its own
/// settings (timeout, alwaysLoad) and runs `<dot> --router-mcp --server <name> --spec <spec file>`; the real entry moves
/// to the spec file, which only the router reads. Dot's own servers (`--hands-mcp`, `--agent-mcp`) stay direct: they
/// answer through the running Dot, and a job's page and clicks wait on them. Servers that are not stdio (http, sse) pass through.
public enum RouterConfig {
    public static let flag = "--router-mcp"

    public struct Wrapped {
        public let config: Data
        public let spec: Data
        public let routed: [String]
    }

    /// `deny` is the session's disallowed tool list: `mcp__<server>__<tool>` entries become the router's `--deny`, and a
    /// whole server (`mcp__<server>`) is left out of the config.
    public static func wrap(_ data: Data, executable: String, specPath: String, deny: [String] = []) -> Wrapped? {
        guard var root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let servers = root["mcpServers"] as? [String: Any] else { return nil }
        var out: [String: Any] = [:]
        var spec: [String: Any] = [:]
        for (name, value) in servers {
            guard let entry = value as? [String: Any] else { continue }
            if deny.contains("mcp__\(name)") { continue }
            guard routable(entry) else { out[name] = entry; continue }
            spec[name] = entry
            var front = entry.filter { !["command", "args", "env", "type", "cwd"].contains($0.key) }
            var args = [flag, "--server", name, "--spec", specPath]
            let tools = deny.compactMap { d -> String? in
                let prefix = "mcp__\(name)__"
                return d.hasPrefix(prefix) ? String(d.dropFirst(prefix.count)) : nil
            }
            if !tools.isEmpty { args += ["--deny", tools.sorted().joined(separator: ",")] }
            if let ms = (entry["timeout"] as? NSNumber)?.doubleValue { args += ["--after", String(Int(handleAfter(timeoutMs: ms)))] }
            front["command"] = executable
            front["args"] = args
            out[name] = front
        }
        root["mcpServers"] = out
        guard let config = try? JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys]),
              let specData = try? JSONSerialization.data(withJSONObject: ["mcpServers": spec], options: [.prettyPrinted, .sortedKeys]) else { return nil }
        return Wrapped(config: config, spec: specData, routed: spec.keys.sorted())
    }

    /// A stdio server that isn't one of Dot's own.
    static func routable(_ entry: [String: Any]) -> Bool {
        guard entry["command"] is String else { return false }
        if let type = entry["type"] as? String, type != "stdio" { return false }
        let args = entry["args"] as? [String] ?? []
        return !args.contains("--hands-mcp") && !args.contains("--agent-mcp") && !args.contains(flag)
    }

    /// Seconds before a call becomes a handle: 20, or less when the server's own timeout is shorter, so Claude Code
    /// never times out a call the router still holds.
    public static func handleAfter(timeoutMs: Double) -> Double {
        max(5, min(20, timeoutMs / 1000 - 5))
    }

    /// One server's real entry from a spec file.
    public static func entry(_ spec: Data, server: String) -> [String: Any]? {
        ((try? JSONSerialization.jsonObject(with: spec) as? [String: Any])?["mcpServers"] as? [String: Any])?[server] as? [String: Any]
    }

    /// The key a server's cached tool list is stored under: its command, args and env, leaving out env values that name
    /// a session (a job's Atlas session changes every job, its tools don't).
    public static func cacheKey(server: String, entry: [String: Any]) -> String {
        let env = (entry["env"] as? [String: Any] ?? [:]).filter { !$0.key.uppercased().contains("SESSION") }
        let basis = RouterCore.json(["command": entry["command"] ?? "", "args": entry["args"] ?? [], "env": env])
        let safe = server.map { $0.isLetter || $0.isNumber || $0 == "-" ? $0 : "_" }
        return String(safe) + "-" + JobPage.version(of: basis)
    }
}
