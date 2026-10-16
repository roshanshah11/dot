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
    /// Same, for talk mode: the reading, remembering and drafting Atlas tools (ATLAS_MCP_TOOLS), not the sends.
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
    /// A caption bubble beside the orb while Dot speaks. Off: the words are spoken and the notch
    /// shows the current line, the way HeyClicky does it (his verdict 2026-10-15: the bubble "looks bad").
    var cursorBubble = false
    /// Answers to typed questions are read aloud as well as shown in the notch.
    var speakTypedAnswers = false
    /// Dot's windows appear in screen recordings and screen shares.
    var showInRecordings = true
    /// Hold notices, suggestions and spoken heads-ups while he is on a call (mic in use by another app).
    var quietOnCalls = true
    /// Course terms and names the recognizer should write his way (one per line, "heard => correct").
    var dictionaryFile = "~/.config/dot/dictionary.txt"
    /// Where Murmur keeps its dictation history, read for "what did i say in the meeting".
    var murmurHistoryFile = "~/Library/Application Support/Murmur/history.jsonl"
    /// Murmur's log folder; Dot's notch mirrors its recording state from there (one notch for both apps).
    var murmurLogDirectory = "~/Library/Logs/Murmur"
    var mirrorMurmur = true
    /// Longest wait for the screen to stop changing after a walkthrough click, in seconds.
    var walkthroughSettleSeconds = 2.5
    /// Also keep the answer text in the notch panel.
    var hudShowsResponse = false
    /// Once a day, a quiet bubble with the day's shape (deadlines, calendar, mail waiting).
    var morningGreeting = true
    /// Minutes before the next calendar event to say so; 0 turns the notice off.
    var meetingNoticeMinutes = 10
    var speakMeetingNotice = true
    var atlasRoot = "~/roshan"
    var atlasHarness = "~/roshan/Atlas/harness"
    var atlasPython = "/opt/homebrew/bin/python3.13"
    var todayRefreshMinutes = 10
    /// The talk session restarts after this many questions, so context stays fast.
    var talkSessionMaxTurns = 30
    var walkthroughMaxSteps = 12
    /// Claude Code effort for the talk session ("low" keeps answers quick).
    var talkEffort: String? = "low"
    /// Jev (TypeSafe) for quick decisions: routing, element picks, command clearing, notices.
    var jevEnabled = true
    /// Where TYPESAFE_API_KEY lives when it is not in the environment (dotenv format).
    var jevKeyFile = "~/Projects/browser-agent/.env"
    /// Hand a request straight to an agent when Jev is at least this sure, skipping the talk model.
    var jevRouteThreshold = 0.8
    /// A quiet line when the app he switches to touches a deadline Atlas knows about.
    var proactiveNotices = true
    var noticeCooldownMinutes = 20
    /// A quiet offer beside the cursor when he opens a document Dot could help with ("want the gist of this?").
    var suggestions = true
    var suggestionCooldownMinutes = 10
    /// Keep a small black tab under the notch when idle, so Dot visibly lives there.
    var notchPresence = true
    /// When he says "do it" in a walkthrough, Dot moves the real cursor and clicks the steps itself
    /// (never a send, buy or delete; his first move or key stops it).
    var driveEnabled = true
    /// Start speaking at the first long clause instead of the first full sentence.
    var eagerSpeech = true
    /// Words appear while the key is held (FluidAudio sliding window); the WAV is the fallback.
    var streamingTranscription = true

    // Round five: cards, the morning card, the microphone, the notch.
    /// Where "near me" is when a place is asked for (Hyde Park, UChicago). Place cards search around here.
    var homeLatitude = 41.7943
    var homeLongitude = -87.5907
    /// The morning card: a few things Dot could take on today, from Atlas, with yes and no remembered.
    var morningSuggestions = true
    /// The microphone Dot records from, by name; nil follows the system default.
    var microphoneName: String? = nil
    /// The version that last showed its "what's new" line, so an update is announced once.
    var lastSeenVersion: String? = nil

    /// Atlas tools a talk turn may call without asking: everything that reads, remembers or drafts.
    /// Sends, submits, posts and harness administration stay with agents and his yes.
    static let talkAtlasTools = [
        "now", "search", "facts", "people", "contacts", "calendar", "calendars", "free", "commitments", "todo", "unanswered",
        "mail", "messages", "messages_thread", "thread", "canvas_find", "canvas_courses", "canvas_read", "docs", "read_doc",
        "recent_files", "proposals", "history", "state", "status", "preferences", "postings", "project", "task", "deliverable",
        "apple_note_read", "view_note", "get", "quote", "sec_lookup", "sec_facts", "sec_filings", "fin_calc", "vocabulary", "lesson",
        "remember", "deadline_add", "deadline_confirm", "commit", "commit_done", "commit_update", "contact_upsert", "reminder", "journal",
        "draft_email", "write_note", "apple_note", "calendar_create", "calendar_update", "watch_add", "xlsx_write",
    ]
    static let defaultTalkTools = talkAtlasTools.map { "mcp__atlas__\($0)" }

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
        // The file's list adds to the built-in set, so a widened default reaches an old config.
        let extra = get(.talkAllowedTools, [String]()).filter { !d.talkAllowedTools.contains($0) }
        talkAllowedTools = d.talkAllowedTools + extra
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
        cursorBubble = get(.cursorBubble, d.cursorBubble)
        speakTypedAnswers = get(.speakTypedAnswers, d.speakTypedAnswers)
        showInRecordings = get(.showInRecordings, d.showInRecordings)
        quietOnCalls = get(.quietOnCalls, d.quietOnCalls)
        dictionaryFile = get(.dictionaryFile, d.dictionaryFile)
        murmurHistoryFile = get(.murmurHistoryFile, d.murmurHistoryFile)
        murmurLogDirectory = get(.murmurLogDirectory, d.murmurLogDirectory)
        mirrorMurmur = get(.mirrorMurmur, d.mirrorMurmur)
        walkthroughSettleSeconds = get(.walkthroughSettleSeconds, d.walkthroughSettleSeconds)
        hudShowsResponse = get(.hudShowsResponse, d.hudShowsResponse)
        morningGreeting = get(.morningGreeting, d.morningGreeting)
        meetingNoticeMinutes = get(.meetingNoticeMinutes, d.meetingNoticeMinutes)
        speakMeetingNotice = get(.speakMeetingNotice, d.speakMeetingNotice)
        atlasRoot = get(.atlasRoot, d.atlasRoot)
        atlasHarness = get(.atlasHarness, d.atlasHarness)
        atlasPython = get(.atlasPython, d.atlasPython)
        todayRefreshMinutes = get(.todayRefreshMinutes, d.todayRefreshMinutes)
        talkSessionMaxTurns = get(.talkSessionMaxTurns, d.talkSessionMaxTurns)
        walkthroughMaxSteps = get(.walkthroughMaxSteps, d.walkthroughMaxSteps)
        talkEffort = c.contains(.talkEffort) ? (try? c.decodeIfPresent(String.self, forKey: .talkEffort)) : d.talkEffort
        jevEnabled = get(.jevEnabled, d.jevEnabled)
        jevKeyFile = get(.jevKeyFile, d.jevKeyFile)
        jevRouteThreshold = get(.jevRouteThreshold, d.jevRouteThreshold)
        proactiveNotices = get(.proactiveNotices, d.proactiveNotices)
        noticeCooldownMinutes = get(.noticeCooldownMinutes, d.noticeCooldownMinutes)
        suggestions = get(.suggestions, d.suggestions)
        suggestionCooldownMinutes = get(.suggestionCooldownMinutes, d.suggestionCooldownMinutes)
        notchPresence = get(.notchPresence, d.notchPresence)
        driveEnabled = get(.driveEnabled, d.driveEnabled)
        eagerSpeech = get(.eagerSpeech, d.eagerSpeech)
        streamingTranscription = get(.streamingTranscription, d.streamingTranscription)
        homeLatitude = get(.homeLatitude, d.homeLatitude)
        homeLongitude = get(.homeLongitude, d.homeLongitude)
        morningSuggestions = get(.morningSuggestions, d.morningSuggestions)
        microphoneName = try? c.decodeIfPresent(String.self, forKey: .microphoneName)
        lastSeenVersion = try? c.decodeIfPresent(String.self, forKey: .lastSeenVersion)
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
        return [python, script, "--root", Self.expand(atlasRoot), "--harness", harness, "--chat-prompt"]
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
