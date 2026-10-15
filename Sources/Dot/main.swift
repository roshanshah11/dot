import AppKit
import DotKit
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
      Dot --today       print the [today] block Dot reads from Atlas
      Dot --ask <q>     ask the running Dot by text      Dot --agent <brief>   hand a job to an agent
      Dot --ask --quiet <q>   same, with no voice (beats pace themselves)
      Dot --ask --drive <q>   a walkthrough Dot clicks through itself (tests; by voice say "do it")
      Dot --home        open the Dot window              Dot --stop            stop talking
      Dot --refresh     re-read today from Atlas         Dot --input           open the typed-question field
      Dot --version

    Hold control+option and talk; drag while holding to draw a box to ask about.
    Hold control+option+shift to hand the request to an agent. Tap control+option to type.
    Escape stops Dot talking. Dot lives beside the cursor; toggle that from the menu bar.
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
    print("atlas today:       \(config.resolvedTodayCommand()?.joined(separator: " ") ?? "not available")")
    print("tts:               \(config.resolvedTTSCommand()?.joined(separator: " ") ?? "apple speech")")
    exit(status.allGranted ? 0 : 1)
case "--today":
    let config = DotConfig.load()
    guard let command = config.resolvedTodayCommand() else { print("atlas today helper not available"); exit(1) }
    let process = Process()
    process.executableURL = URL(fileURLWithPath: command[0])
    process.arguments = Array(command.dropFirst())
    var env = ProcessInfo.processInfo.environment
    env["PYTHONPATH"] = DotConfig.expand(config.atlasHarness)
    process.environment = env
    let pipe = Pipe()
    process.standardOutput = pipe
    try? process.run()
    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    process.waitUntilExit()
    if let brief = TodayBrief.parse(data) {
        print(brief.block)
        print("\nmorning line: \(brief.morningLine())")
    } else {
        print("could not parse the helper's output")
        exit(1)
    }
    exit(0)
case "--voices":
    for voice in AppleSpeaker.availableVoices() {
        print("\(voice.quality.padding(toLength: 9, withPad: " ", startingAt: 0)) \(voice.name)\n          \(voice.id)")
    }
    exit(0)
case "--ask", "--agent":
    // Talk to the running app: `Dot --ask "what's in front?"`, `Dot --agent "sort my downloads"`.
    // `--ask --quiet` runs the turn with the bubble and marks but no voice (tests at night).
    var rest = Array(arguments.dropFirst())
    var quiet = false, drive = false
    while let flag = rest.first, flag.hasPrefix("--") {
        if flag == "--quiet" { quiet = true } else if flag == "--drive" { drive = true } else { break }
        rest.removeFirst()
    }
    let text = rest.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else { print("usage: Dot --ask [--quiet] [--drive] <question> | Dot --agent <brief>"); exit(2) }
    let name = arguments.first == "--ask" ? DotIPC.ask : DotIPC.agent
    DistributedNotificationCenter.default().postNotificationName(name, object: nil, userInfo: ["text": text, "quiet": quiet, "drive": drive], deliverImmediately: true)
    print("sent to Dot")
    exit(0)
case "--type", "--stt", "--card":
    let text = arguments.dropFirst().joined(separator: " ")
    guard !text.isEmpty else { print("usage: Dot --type \"text\" | Dot --stt file.wav"); exit(2) }
    let name = arguments.first == "--type" ? DotIPC.type : (arguments.first == "--stt" ? DotIPC.stt : DotIPC.card)
    DistributedNotificationCenter.default().postNotificationName(name, object: nil, userInfo: ["text": text], deliverImmediately: true)
    print("sent to Dot")
    exit(0)
case "--home", "--stop", "--refresh", "--input":
    let name = arguments.first == "--home" ? DotIPC.home : (arguments.first == "--stop" ? DotIPC.stop : (arguments.first == "--input" ? DotIPC.input : DotIPC.refresh))
    DistributedNotificationCenter.default().postNotificationName(name, object: nil, userInfo: nil, deliverImmediately: true)
    exit(0)
default:
    break
}

let app = NSApplication.shared
let delegate = MainActor.assumeIsolated { AppDelegate() }
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
