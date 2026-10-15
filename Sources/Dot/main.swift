import AppKit
import Foundation

let arguments = CommandLine.arguments.dropFirst()

switch arguments.first {
case "--version", "-v":
    print("Dot \(Version.string)")
    exit(0)
case "--help", "-h":
    print("""
    Dot: a voice assistant that lives beside your cursor and runs on Claude Code.

      Dot               launch the menu bar app
      Dot --check       print permission status and paths
      Dot --voices      list installed English voices (set voiceIdentifier in config)
      Dot --version

    Hold control+option and talk. Hold control+option+shift to hand the request to an agent.
    Tap control+option to type a question. Escape stops Dot talking.
    Config: ~/.config/dot/config.json   Agents: ~/Dot/agents   Log: ~/Library/Logs/Dot/dot.log
    """)
    exit(0)
case "--check":
    let status = Permissions.status()
    let config = DotConfig.load()
    print("microphone:        \(status.microphone ? "granted" : "missing")")
    print("screen recording:  \(status.screenRecording ? "granted" : "missing")")
    print("accessibility:     \(status.accessibility ? "granted" : "missing")")
    print("claude:            \(config.claudeExecutable.path) \(FileManager.default.isExecutableFile(atPath: config.claudeExecutable.path) ? "ok" : "MISSING")")
    print("config:            \(DotConfig.fileURL.path)")
    print("agents:            \(config.agentsRootURL.path)")
    print("agent mcp config:  \(config.mcpConfigPath(config.agentMCPConfig) ?? "none")")
    print("talk mcp config:   \(config.mcpConfigPath(config.talkMCPConfig) ?? "none")")
    exit(status.allGranted ? 0 : 1)
case "--voices":
    for voice in AppleSpeaker.availableVoices() {
        print("\(voice.quality.padding(toLength: 9, withPad: " ", startingAt: 0)) \(voice.name)\n          \(voice.id)")
    }
    exit(0)
case "--ask", "--agent":
    // Talk to the running app: `Dot --ask "what's in front?"`, `Dot --agent "sort my downloads"`.
    let text = arguments.dropFirst().joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else { print("usage: Dot --ask <question> | Dot --agent <brief>"); exit(2) }
    let name = arguments.first == "--ask" ? DotIPC.ask : DotIPC.agent
    DistributedNotificationCenter.default().postNotificationName(name, object: nil, userInfo: ["text": text], deliverImmediately: true)
    print("sent to Dot")
    exit(0)
default:
    break
}

let app = NSApplication.shared
let delegate = MainActor.assumeIsolated { AppDelegate() }
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
