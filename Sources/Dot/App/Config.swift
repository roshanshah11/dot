import Foundation

/// `~/.config/dot/config.json`. Every field has a default; a missing file is written
/// with the defaults on first launch so it can be edited by hand.
struct DotConfig: Codable {
    var claudePath = "~/.local/bin/claude"
    var talkModel = "sonnet"
    var thinkModel = "opus"
    var agentModel = "opus"
    var agentEffort: String? = nil
    /// "auto": Kokoro through the worker in ~/Dot/tts when it is installed, else Apple speech.
    /// "apple": Apple's synthesizer only. "command": always `ttsCommand`.
    var ttsProvider = "auto"
    /// A worker process speaking Dot's one-line JSON protocol (see scripts/dot-tts-kokoro.py).
    var ttsCommand: [String] = []
    /// Voice name handed to the worker (Kokoro: af_heart, af_bella, am_michael, bf_emma, ...).
    var ttsVoice = "af_heart"
    var ttsSpeed: Float = 1.0
    /// `AVSpeechSynthesisVoice` identifier for Apple speech; nil picks the best installed English voice.
    var voiceIdentifier: String? = nil
    var speechRate: Float = 0.5
    var agentsRoot = "~/Dot/agents"
    var talkRoot = "~/Dot/talk"
    /// A Claude Code mcp-config JSON file (`{"mcpServers": {...}}`) handed to agents.
    var agentMCPConfig: String? = "~/.config/dot/mcp.json"
    /// Same, for talk mode (read-only tools only; keep it small so answers stay fast).
    var talkMCPConfig: String? = "~/.config/dot/mcp-talk.json"
    /// Tool names (e.g. `mcp__atlas__facts`) talk mode may call without asking.
    var talkAllowedTools: [String] = []
    /// Consent policy for agents.
    var allowTools: [String] = []
    var allowToolPrefixes: [String] = []
    var denyTools: [String] = []
    var speakAgentResults = true
    var agentIdleMinutes = 15
    /// Max long edge of each screenshot sent to the model, in pixels.
    var screenshotMaxDimension = 1280
    var includeOtherScreens = true
    var maxAccessibilityElements = 70
    var pointerColorHex = "#ff6b2c"

    static var directory: URL {
        URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".config/dot", isDirectory: true)
    }

    static var fileURL: URL { directory.appendingPathComponent("config.json") }

    static func load() -> DotConfig {
        let fm = FileManager.default
        if let data = try? Data(contentsOf: fileURL) {
            do {
                return try JSONDecoder().decode(DotConfig.self, from: data)
            } catch {
                Log.error("config.json could not be read, using defaults: \(error)")
                return DotConfig()
            }
        }
        let config = DotConfig()
        try? fm.createDirectory(at: directory, withIntermediateDirectories: true)
        config.save()
        return config
    }

    func save() {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        if let data = try? encoder.encode(self) {
            try? data.write(to: Self.fileURL, options: .atomic)
        }
    }

    // MARK: Expanded paths

    static func expand(_ path: String) -> String {
        (path as NSString).expandingTildeInPath
    }

    var claudeExecutable: URL { URL(fileURLWithPath: Self.expand(claudePath)) }

    /// The worker command for the configured provider, or nil for Apple speech.
    func resolvedTTSCommand() -> [String]? {
        switch ttsProvider {
        case "apple":
            return nil
        case "command":
            return ttsCommand.isEmpty ? nil : ttsCommand.map(Self.expand)
        default:
            if !ttsCommand.isEmpty { return ttsCommand.map(Self.expand) }
            let python = Self.expand("~/Dot/tts/venv/bin/python")
            let candidates = [
                Bundle.main.resourceURL?.appendingPathComponent("dot-tts-kokoro.py").path,
                Self.expand("~/Dot/tts/dot-tts-kokoro.py"),
            ].compactMap { $0 }
            guard FileManager.default.isExecutableFile(atPath: python),
                  let script = candidates.first(where: { FileManager.default.fileExists(atPath: $0) }) else { return nil }
            return [python, script, "--voice", ttsVoice, "--speed", String(ttsSpeed)]
        }
    }
    var agentsRootURL: URL { URL(fileURLWithPath: Self.expand(agentsRoot), isDirectory: true) }
    var talkRootURL: URL { URL(fileURLWithPath: Self.expand(talkRoot), isDirectory: true) }
    var dotHome: URL { agentsRootURL.deletingLastPathComponent() }

    /// nil when the configured file does not exist, so the CLI gets no `--mcp-config`.
    func mcpConfigPath(_ path: String?) -> String? {
        guard let path else { return nil }
        let expanded = Self.expand(path)
        return FileManager.default.fileExists(atPath: expanded) ? expanded : nil
    }

    func mcpToolNames(_ path: String?) -> [String] {
        guard let file = mcpConfigPath(path), let data = try? Data(contentsOf: URL(fileURLWithPath: file)),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let servers = object["mcpServers"] as? [String: Any] else { return [] }
        return servers.keys.map { "mcp__\($0)__" }
    }
}
