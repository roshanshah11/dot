import AppKit
import DotKit
import Foundation

let arguments = CommandLine.arguments.dropFirst()

switch arguments.first {
case "--gate":
    // Claude Code's PreToolUse and PostToolUse hook for Dot's agents (AG-07): hook JSON in, decision out.
    Gate.run(Array(arguments.dropFirst()))
case "--hands-mcp":
    // A job's `dot` tools (the fast lane): stdio MCP in, relayed to the running Dot over the control socket.
    HandsMCPServer.run(Array(arguments.dropFirst()))
case "--job-run":
    // One real bench job, headless, without the running Dot (its own socket and log; never port 9222).
    JobHarness.run(Array(arguments.dropFirst()))
case "--job-test":
    // The bench: his click or key for the newest bench job, through the pause rule. Refused outside the bench.
    let kind = arguments.dropFirst().first ?? "click"
    guard kind == "click" || kind == "key" else { print("usage: Dot --job-test click|key"); exit(2) }
    DistributedNotificationCenter.default().postNotificationName(DotIPC.jobTest, object: nil, userInfo: ["kind": kind], deliverImmediately: true)
    print("sent to Dot")
    exit(0)
case "--occlusion":
    // The covered check, computed by the running Dot with its own Accessibility grant: logs both verdicts.
    let point = arguments.dropFirst().first ?? ""
    guard point.split(separator: ",").count == 2 else { print("usage: Dot --occlusion x,y   (screen points, top-left origin)"); exit(2) }
    DistributedNotificationCenter.default().postNotificationName(DotIPC.occlusion, object: nil, userInfo: ["text": point], deliverImmediately: true)
    print("sent to Dot; see dot.log for the occlusion line")
    exit(0)
case "--host":
    // The agent host (AG-12, LaunchAgent com.roshan.dot-host): it owns the agents' claude processes so
    // they outlive Dot. `--host list` prints what it runs (install-host.sh asks before a restart).
    let socket = HostProtocol.socketPath()
    if arguments.dropFirst().first == "list" {
        guard let found = AgentHostCore.describe(path: socket) else { print("host: not running at \(socket)"); exit(3) }
        found.lines.forEach { print($0) }
        exit(0)
    }
    FileHandle.standardError.write(Data("messages: live chat.db readable=\(MessagesProbe.liveReadable())\n".utf8))
    AgentHostCore.serve(path: socket)
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
      Dot --snapshot [folder] [notch|stack|overlay|cards|panel]  render every notch state, stack chip, mark and card to PNG
      Dot --stack-demo [--muted] [--job]   a fake agent (or job) through the running Dot's stack (no voice, no chime)
      Dot --stack-selftest [--muted] [--job] [frames.json]   the same demo in this process, its window off screen, G7 to G9 checked
      Dot --panel file.ui      show a UI-language explanation in the explainer panel (Dot --panel close hides it)
      Dot --prompt talk|think  print a session's system prompt
      Dot --quip-test          three sample moments through the quip model (quipModel), each line and its check
      Dot --track-selftest     the running Dot checks that marks stay on scrolled content (posts real scrolls; run while away)
      Dot --selftest           check the notch's permission-card queue (no agents, no model)
      Dot --gate               the agents' tool-call hook (Claude Code runs it; JSON on stdin)
      Dot --host [list]        the agent host that keeps agents running across a relaunch (launchd runs it)
      Dot --version

    Hold control+option and talk; drag while holding to draw a box to ask about.
    Hold control+option+shift to hand the request to an agent. Tap control+option to type.
    Escape stops Dot talking. Dot lives beside the cursor; toggle that from the menu bar.
    Config: ~/.config/dot/config.json   Agents: ~/Dot/agents   Log: ~/Library/Logs/Dot/dot.log
    """)
    exit(0)
case "--check":
    let status = Permissions.status()
    let config = DotConfig.peek()
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
    let config = DotConfig.peek()
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
    let group = arguments.dropFirst(2).first   // notch | overlay | cards | panel
    MainActor.assumeIsolated { Snapshots.run(into: folder, only: group) }
    exit(0)
case "--prompt":
    // The talk, think or job system prompt exactly as a session gets it (round eight's panel dry runs read it).
    // `--prompt talk --jobs off|on` prints it with the jobs flag set either way; the config file is never rewritten.
    let config = DotConfig.peek()
    let which = arguments.dropFirst().first ?? "think"
    let rest = Array(arguments.dropFirst(2))
    let jobsFlag = rest.firstIndex(of: "--jobs").flatMap { $0 + 1 < rest.count ? rest[$0 + 1] : nil }
    let jobsOn = jobsFlag.map { $0 == "on" } ?? config.jobsEnabled
    switch which {
    case "talk": print(Prompts.talk(jobs: jobsOn) + Prompts.courseIndex(in: config.talkRootURL))
    case "job": print(Prompts.job + Prompts.courseIndex(in: config.talkRootURL))
    default: print(Prompts.think + Prompts.courseIndex(in: config.talkRootURL))
    }
    exit(0)
case "--quip-test":
    // Context lines (docs/alive.md, round two): the real writer on three made-up moments, outside the app.
    let config = DotConfig.peek()
    let passed = MainActor.assumeIsolated { QuipWriter.selfTest(config: config) }
    exit(passed ? 0 : 1)
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
    var quiet = false, drive = false, dry = false, bench = false, spoken = false, shift = false
    var cometPort = 0
    while let flag = rest.first, flag.hasPrefix("--") {
        if flag == "--quiet" { quiet = true } else if flag == "--drive" { drive = true } else if flag == "--dry" { dry = true }
        // the basics bench: read-only tools, no agents, actions only on the fixture (Tests/Fixtures/bench)
        else if flag == "--bench" { bench = true } else if flag == "--spoken" { spoken = true } else if flag == "--shift" { shift = true }
        else if flag == "--comet-port", rest.count > 1, let port = Int(rest[1]) { cometPort = port; rest.removeFirst() }
        else { break }
        rest.removeFirst()
    }
    guard !(bench && cometPort == 9222) else { print("--comet-port 9222 is his own Comet; the bench uses a throwaway one (scripts/bench-comet.sh)"); exit(2) }
    let text = rest.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else { print("usage: Dot --ask [--quiet] [--drive] [--dry] [--bench [--spoken] [--shift] [--comet-port N]] <question> | Dot --agent <brief>"); exit(2) }
    // --dry is for --ask: a brief sent with --agent would still start the agent.
    guard !(dry && arguments.first == "--agent") else { print("--dry works with --ask only; Dot --agent always starts the agent"); exit(2) }
    let name = arguments.first == "--ask" ? DotIPC.ask : DotIPC.agent
    DistributedNotificationCenter.default().postNotificationName(name, object: nil, userInfo: ["text": text, "quiet": quiet, "drive": drive, "dry": dry,
                                                                                            "bench": bench, "spoken": spoken, "shift": shift, "cometPort": cometPort], deliverImmediately: true)
    print("sent to Dot")
    exit(0)
case "--stack-demo":
    // A fake agent (or with --job a fake behind job) through the running Dot's stack, for G7 to G9 (04): no real agent,
    // no chime, no voice, no volume change; --muted fakes a muted Mac.
    let flags = Set(arguments.dropFirst())
    DistributedNotificationCenter.default().postNotificationName(DotIPC.stackDemo, object: nil,
                                                                 userInfo: ["muted": flags.contains("--muted"), "job": flags.contains("--job")], deliverImmediately: true)
    print("asked the running Dot for the stack demo; stack-demo: lines land in dot.log")
    exit(0)
case "--stack-selftest":
    // The stack demo in this process, its window off every display, with G7 to G9's window rules checked (04).
    let flags = Array(arguments.dropFirst())
    let stackApp = NSApplication.shared
    stackApp.setActivationPolicy(.accessory)
    stackApp.finishLaunching()
    let file = flags.first { !$0.hasPrefix("--") }
    let passed = MainActor.assumeIsolated {
        flags.contains("--hover") ? StackSelfTest.runHover()
            : StackSelfTest.run(muted: flags.contains("--muted"), job: flags.contains("--job"), framesFile: file)
    }
    exit(passed ? 0 : 1)
case "--notch-selftest":
    // A typed answer through a real notch window off every display: every line must show (10-21).
    let notchApp = NSApplication.shared
    notchApp.setActivationPolicy(.accessory)
    notchApp.finishLaunching()
    let notchPassed = MainActor.assumeIsolated { NotchSelfTest.run() }
    exit(notchPassed ? 0 : 1)
case "--track-selftest":
    // Ask the running Dot to run the box-tracking check on the real screen (its grants, not the terminal's).
    DistributedNotificationCenter.default().postNotificationName(DotIPC.trackSelftest, object: nil, userInfo: nil, deliverImmediately: true)
    print("asked the running Dot to run the tracking selftest; results land in ~/Dot/selftests and dot.log")
    exit(0)
case "--type", "--stt", "--card", "--panel", "--find", "--dictionary", "--listen":
    let text = arguments.dropFirst().joined(separator: " ")
    guard !text.isEmpty || arguments.first == "--listen" else { print("usage: Dot --type \"text\" | Dot --stt file.wav | Dot --card file.html | Dot --panel file.ui | Dot --find \"phrase\" | Dot --dictionary \"heard => correct\""); exit(2) }
    let names: [String: Notification.Name] = ["--type": DotIPC.type, "--stt": DotIPC.stt, "--card": DotIPC.card, "--panel": DotIPC.panel, "--find": DotIPC.find, "--dictionary": DotIPC.dictionary, "--listen": DotIPC.listen]
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
