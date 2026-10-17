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
      Dot --ask --dry <q>     log the route and the tags only: no agent is started, told, stopped or answered
      Dot --home        open the Dot window              Dot --stop            stop talking
      Dot --refresh     re-read today from Atlas         Dot --input           open the typed-question field
      Dot --find <phrase>      search the app in front and highlight the match
      Dot --listen [title]     start the lecture ear       Dot --stop-listening  stop it and save the transcript
      Dot --dictionary "heard => correct"   add a term the recognizer should write your way
      Dot --snapshot [folder]  render every notch state, mark and card to PNG (no screen turn)
      Dot --selftest           check the notch's permission-card queue (no agents, no model)
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
case "--snapshot":
    // Every surface to PNG, no screen turn: ~/Dot/snapshots/<stamp>/ unless a folder is given.
    let stamp: String = { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd HHmm"; return f.string(from: Date()) }()
    let folder = arguments.dropFirst().first.map { URL(fileURLWithPath: DotConfig.expand($0), isDirectory: true) }
        ?? URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Dot/snapshots/\(stamp)", isDirectory: true)
    let snapshotApp = NSApplication.shared
    snapshotApp.setActivationPolicy(.accessory)   // prohibited apps may not draw windows, and WebKit paints only into one
    snapshotApp.finishLaunching()                  // registers with the window server; without it no window ever appears
    let group = arguments.dropFirst(2).first   // notch | overlay | cards
    MainActor.assumeIsolated { Snapshots.run(into: folder, only: group) }
    exit(0)
case "--selftest":
    let selfTestApp = NSApplication.shared
    selfTestApp.setActivationPolicy(.accessory)
    selfTestApp.finishLaunching()
    let passed = MainActor.assumeIsolated { SelfTest.run() }
    exit(passed ? 0 : 1)
case "--voices":
    for voice in AppleSpeaker.availableVoices() {
        print("\(voice.quality.padding(toLength: 9, withPad: " ", startingAt: 0)) \(voice.name)\n          \(voice.id)")
    }
    exit(0)
case "--ask", "--agent":
    // Talk to the running app: `Dot --ask "what's in front?"`, `Dot --agent "sort my downloads"`.
    // `--ask --quiet` runs the turn with the bubble and marks but no voice (tests at night).
    var rest = Array(arguments.dropFirst())
    var quiet = false, drive = false, dry = false
    while let flag = rest.first, flag.hasPrefix("--") {
        if flag == "--quiet" { quiet = true } else if flag == "--drive" { drive = true } else if flag == "--dry" { dry = true } else { break }
        rest.removeFirst()
    }
    let text = rest.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else { print("usage: Dot --ask [--quiet] [--drive] [--dry] <question> | Dot --agent <brief>"); exit(2) }
    // --dry is for --ask: a brief sent with --agent would still start the agent.
    guard !(dry && arguments.first == "--agent") else { print("--dry works with --ask only; Dot --agent always starts the agent"); exit(2) }
    let name = arguments.first == "--ask" ? DotIPC.ask : DotIPC.agent
    DistributedNotificationCenter.default().postNotificationName(name, object: nil, userInfo: ["text": text, "quiet": quiet, "drive": drive, "dry": dry], deliverImmediately: true)
    print("sent to Dot")
    exit(0)
case "--type", "--stt", "--card", "--find", "--dictionary", "--listen":
    let text = arguments.dropFirst().joined(separator: " ")
    guard !text.isEmpty || arguments.first == "--listen" else { print("usage: Dot --type \"text\" | Dot --stt file.wav | Dot --card file.html | Dot --find \"phrase\" | Dot --dictionary \"heard => correct\""); exit(2) }
    let names: [String: Notification.Name] = ["--type": DotIPC.type, "--stt": DotIPC.stt, "--card": DotIPC.card, "--find": DotIPC.find, "--dictionary": DotIPC.dictionary, "--listen": DotIPC.listen]
    DistributedNotificationCenter.default().postNotificationName(names[arguments.first!]!, object: nil, userInfo: ["text": text], deliverImmediately: true)
    print("sent to Dot")
    exit(0)
case "--home", "--stop", "--refresh", "--input", "--stop-listening":
    let names: [String: Notification.Name] = ["--home": DotIPC.home, "--stop": DotIPC.stop, "--input": DotIPC.input, "--refresh": DotIPC.refresh, "--stop-listening": DotIPC.stopListening]
    let name = names[arguments.first!]!
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
