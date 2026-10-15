import Foundation

/// `~/.config/dot/config.json`. Every field has a default and a missing key decodes to it,
/// so an old file keeps working after an update; the file is rewritten with the full set.
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
    /// Same, for talk mode: a dozen Atlas tools (ATLAS_MCP_TOOLS) so voice turns stay fast.
    var talkMCPConfig: String? = "~/.config/dot/mcp-talk.json"
    /// Tool names talk mode may call without asking (`--allowedTools`).
    var talkAllowedTools: [String] = DotConfig.defaultTalkTools
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

    // Phase 2: the companion, Atlas, walkthroughs.
    /// Dot lives beside the cursor all the time (false: appears only while you talk to it).
    var showCompanion = true
    /// The answer streams into a bubble beside Dot while it speaks.
    var bubbleText = true
    /// Also keep the answer text in the notch panel.
    var hudShowsResponse = false
    /// Once a day, a quiet bubble with the day's shape (deadlines, calendar, mail waiting).
    var morningGreeting = true
    var atlasRoot = "~/roshan"
    var atlasHarness = "~/roshan/Atlas/harness"
    var atlasPython = "/opt/homebrew/bin/python3.13"
    var todayRefreshMinutes = 10
    /// The talk session restarts after this many questions, so context stays fast.
    var talkSessionMaxTurns = 30
    var walkthroughMaxSteps = 12

    static let defaultTalkTools = ["now", "search", "facts", "people", "calendar", "free", "commitments", "todo", "unanswered",
                                   "canvas_find", "docs", "proposals", "remember", "deadline_add", "commit"].map { "mcp__atlas__\($0)" }

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func get<T: Decodable>(_ key: CodingKeys, _ fallback: T) -> T { (try? c.decodeIfPresent(T.self, forKey: key)) ?? fallback }
        let d = DotConfig()
        claudePath = get(.claudePath, d.claudePath)
        talkModel = get(.talkModel, d.talkModel)
        thinkModel = get(.thinkModel, d.thinkModel)
        agentModel = get(.agentModel, d.agentModel)
        agentEffort = try? c.decodeIfPresent(String.self, forKey: .agentEffort)
        ttsProvider = get(.ttsProvider, d.ttsProvider)
        ttsCommand = get(.ttsCommand, d.ttsCommand)
        ttsVoice = get(.ttsVoice, d.ttsVoice)
        ttsSpeed = get(.ttsSpeed, d.ttsSpeed)
        voiceIdentifier = try? c.decodeIfPresent(String.self, forKey: .voiceIdentifier)
        speechRate = get(.speechRate, d.speechRate)
        agentsRoot = get(.agentsRoot, d.agentsRoot)
        talkRoot = get(.talkRoot, d.talkRoot)
        agentMCPConfig = c.contains(.agentMCPConfig) ? (try? c.decodeIfPresent(String.self, forKey: .agentMCPConfig)) : d.agentMCPConfig
        talkMCPConfig = c.contains(.talkMCPConfig) ? (try? c.decodeIfPresent(String.self, forKey: .talkMCPConfig)) : d.talkMCPConfig
        talkAllowedTools = get(.talkAllowedTools, d.talkAllowedTools)
        if talkAllowedTools.isEmpty { talkAllowedTools = d.talkAllowedTools }
        allowTools = get(.allowTools, d.allowTools)
        allowToolPrefixes = get(.allowToolPrefixes, d.allowToolPrefixes)
        denyTools = get(.denyTools, d.denyTools)
        speakAgentResults = get(.speakAgentResults, d.speakAgentResults)
        agentIdleMinutes = get(.agentIdleMinutes, d.agentIdleMinutes)
        screenshotMaxDimension = get(.screenshotMaxDimension, d.screenshotMaxDimension)
        includeOtherScreens = get(.includeOtherScreens, d.includeOtherScreens)
        maxAccessibilityElements = get(.maxAccessibilityElements, d.maxAccessibilityElements)
        pointerColorHex = get(.pointerColorHex, d.pointerColorHex)
        showCompanion = get(.showCompanion, d.showCompanion)
        bubbleText = get(.bubbleText, d.bubbleText)
        hudShowsResponse = get(.hudShowsResponse, d.hudShowsResponse)
        morningGreeting = get(.morningGreeting, d.morningGreeting)
        atlasRoot = get(.atlasRoot, d.atlasRoot)
        atlasHarness = get(.atlasHarness, d.atlasHarness)
        atlasPython = get(.atlasPython, d.atlasPython)
        todayRefreshMinutes = get(.todayRefreshMinutes, d.todayRefreshMinutes)
        talkSessionMaxTurns = get(.talkSessionMaxTurns, d.talkSessionMaxTurns)
        walkthroughMaxSteps = get(.walkthroughMaxSteps, d.walkthroughMaxSteps)
    }

    static var directory: URL {
        URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".config/dot", isDirectory: true)
    }

    static var fileURL: URL { directory.appendingPathComponent("config.json") }

    static func load() -> DotConfig {
        let fm = FileManager.default
        if let data = try? Data(contentsOf: fileURL) {
            do {
                let config = try JSONDecoder().decode(DotConfig.self, from: data)
                config.save()   // writes any keys this version added, with their defaults
                return config
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
            guard FileManager.default.isExecutableFile(atPath: python),
                  let script = Self.bundledScript("dot-tts-kokoro.py", fallback: "~/Dot/tts/dot-tts-kokoro.py") else { return nil }
            return [python, script, "--voice", ttsVoice, "--speed", String(ttsSpeed)]
        }
    }

    /// The command that prints Roshan's day from Atlas, or nil when Atlas is not on this Mac.
    func resolvedTodayCommand() -> [String]? {
        let python = Self.expand(atlasPython)
        let harness = Self.expand(atlasHarness)
        guard FileManager.default.isExecutableFile(atPath: python),
              FileManager.default.fileExists(atPath: harness + "/atlas/mcp.py"),
              let script = Self.bundledScript("dot-atlas-today.py", fallback: "~/Projects/dot/scripts/dot-atlas-today.py") else { return nil }
        return [python, script, "--root", Self.expand(atlasRoot), "--harness", harness]
    }

    static func bundledScript(_ name: String, fallback: String) -> String? {
        let candidates = [Bundle.main.resourceURL?.appendingPathComponent(name).path, Self.expand(fallback)].compactMap { $0 }
        return candidates.first { FileManager.default.fileExists(atPath: $0) }
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
