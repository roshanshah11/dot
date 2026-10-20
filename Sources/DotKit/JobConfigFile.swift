import Foundation

/// A job's MCP config: Dot's hands (`dot`), Atlas for reads and his own safe writes (`atlas`, a chat-actor session so his
/// texts and mail read), and Atlas for sends (`atlas-send`, an `ask-` session, where a send only queues a proposal for
/// his yes on Dot's card). No cua-driver: Dot can't read the label under a pixel, so his rule couldn't hold.
public enum JobConfigFile {
    public static let dotTimeoutMs = 130_000
    public static let atlasTimeoutMs = 300_000
    public static let sendTimeoutMs = 60_000

    /// `agentMCP` is the agents' mcp.json; its `atlas` entry is copied twice. `stamp` is yyyyMMddHHmm. Nil when the
    /// agents' config has no atlas server (the job then runs with the dot tools only).
    public static func make(agentMCP: Data, dotExecutable: String, jobId: String, socket: String, bench: Bool, stamp: String) -> Data? {
        var servers: [String: Any] = [
            "dot": [
                "command": dotExecutable,
                "args": ["--hands-mcp", "--job", jobId],
                "alwaysLoad": true,
                "timeout": dotTimeoutMs,
                "env": ["DOT_CONTROL_SOCKET": socket],
            ] as [String: Any],
        ]
        if let root = try? JSONSerialization.jsonObject(with: agentMCP) as? [String: Any],
           let all = root["mcpServers"] as? [String: Any],
           let atlas = all["atlas"] as? [String: Any] {
            var read = atlas
            var env = (atlas["env"] as? [String: Any]) ?? [:]
            env["ATLAS_CHAT_SESSION"] = "dot-job-\(jobId)-\(stamp)"
            env["ATLAS_CANVAS_DEFAULT_DEST"] = "downloads"
            if bench {
                env["ATLAS_MCP_TOOLS"] = (JobAtlasTools.reads + JobAtlasTools.siteReads).joined(separator: ",")
                env["ATLAS_DOWNLOADS_DIR"] = "/tmp/dot-bench/downloads"
                env["ATLAS_CANVAS_NO_VAULT"] = "1"
            } else {
                env["ATLAS_MCP_TOOLS"] = JobAtlasTools.ordered.joined(separator: ",")
            }
            read["env"] = env
            read["timeout"] = atlasTimeoutMs
            servers["atlas"] = read
            if !bench {
                var send = atlas
                var sendEnv = (atlas["env"] as? [String: Any]) ?? [:]
                sendEnv["ATLAS_CHAT_SESSION"] = sendSession(jobId: jobId, stamp: stamp)
                sendEnv["ATLAS_MCP_TOOLS"] = JobAtlasTools.sendTools.joined(separator: ",")
                send["env"] = sendEnv
                send["timeout"] = sendTimeoutMs
                servers["atlas-send"] = send
            }
        }
        return try? JSONSerialization.data(withJSONObject: ["mcpServers": servers], options: [.prettyPrinted, .sortedKeys])
    }

    /// The `ask-` session a job's sends queue under; Dot lists its proposals for the cards.
    public static func sendSession(jobId: String, stamp: String) -> String { "ask-dot-job-\(jobId)-\(stamp)" }
}
