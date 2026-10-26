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
case "--history-mcp":
    // Talk's search_history tool (parity H1): reads the history index itself.
    HistoryMCPServer.run()
case "--agent-mcp":
    // An agent's own tools (`dot-agents`: note_to, list_agents, make_image), relayed to the running Dot.
    AgentMCPServer.run(Array(arguments.dropFirst()))
case "--agent-start", "--agent-status", "--agent-list", "--agent-tell", "--agent-note", "--agent-archive":
    // Agents from outside (parity AG-19): start one, tell it something, leave it a note, or read where they stand.
    // Exit 0 done, 2 usage, 3 no answer from Dot, 4 Dot refused (no such agent).
    let flag = arguments.first!
    let json = arguments.contains("--json")
    let command: AgentCommand
    switch AgentCommand.parse(flag: flag, Array(arguments.dropFirst())) {
    case .success(let c): command = c
    case .failure(let usage): print(usage.description); exit(2)
    }
    let path = ProcessInfo.processInfo.environment[ControlServer.pathVariable].flatMap { $0.isEmpty ? nil : $0 }
        ?? (NSHomeDirectory() as NSString).appendingPathComponent("Dot/control.sock")
    guard let reply = try? UnixSocketClient.send(command.request, to: path, timeout: 15) else {
        print(json ? "{\"error\":\"no answer from Dot at \(path)\"}" : "agents: no answer from Dot at \(path)")
        exit(3)
    }
    if let error = reply["error"] as? String {
        print(json ? (String(data: (try? JSONSerialization.data(withJSONObject: ["error": error])) ?? Data(), encoding: .utf8) ?? "{}") : "agents: \(error)")
        exit(4)
    }
    let rows = AgentStatus.decode(reply["agents"])
    if json {
        if reply["agents"] != nil { print(AgentStatus.json(rows)) } else {
            print(String(data: (try? JSONSerialization.data(withJSONObject: ["ok": true, "text": reply["text"] as? String ?? ""], options: [.sortedKeys])) ?? Data(), encoding: .utf8) ?? "{}")
        }
    } else if let text = reply["text"] as? String {
        print(text)
    } else {
        print(rows.isEmpty ? (command == .status(name: nil) ? "no agents are working right now" : "no agents") : rows.map(\.line).joined(separator: "\n"))
    }
    exit(0)
case "--agent-suggest":
    // AG-17's weekly sweep, printed now over the real talk log (no card, nothing remembered).
    let config = DotConfig.load(save: false)
    let root = config.agentsRootURL
    let roster = ((try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? [])
        .filter { $0.hasDirectoryPath && !$0.lastPathComponent.hasPrefix(".") }
        .map { AgentManager.Agent(slug: $0.lastPathComponent, name: AgentManager.displayName(for: $0) ?? $0.lastPathComponent, folder: $0) }
    let found = AgentSuggester.suggestions(config: config, agents: roster, dismissed: [:], now: Date())
    print(found.isEmpty ? "no repeated asks without an agent in the last 14 days" : found.map { "\($0.name) (\($0.count)x, key \"\($0.key)\"): \($0.line)" }.joined(separator: "\n"))
    exit(0)
case "--home-selftest":
    // Batch 6: Home's state store and the talk log's ids, on a temp database.
    MainActor.assumeIsolated { HomeSelfTest.run() }
case "--skill-avatars":
    // SK-05: each installed skill's picture by the rule table (his picks in ~/Dot/skill-avatars.json win in Home).
    for skill in SkillEntry.load(from: SkillsPage.root) {
        print("\(SkillAvatar.symbol(name: skill.name, description: skill.description).padding(toLength: 40, withPad: " ", startingAt: 0)) \(skill.name)")
    }
    exit(0)
case "--view":
    // H2: show a file in the running Dot's notch viewer (Markdown in the reader; anything else in its own app).
    guard let path = arguments.dropFirst().first else { print("usage: Dot --view <file>"); exit(2) }
    let socket = ProcessInfo.processInfo.environment[ControlServer.pathVariable].flatMap { $0.isEmpty ? nil : $0 }
        ?? (NSHomeDirectory() as NSString).appendingPathComponent("Dot/control.sock")
    let absolute = URL(fileURLWithPath: (path as NSString).expandingTildeInPath).standardizedFileURL.path
    guard let reply = try? UnixSocketClient.send(["verb": "view", "path": absolute], to: socket, timeout: 10) else {
        print("view: no answer from Dot at \(socket)"); exit(3)
    }
    if let error = reply["error"] as? String { print("view: \(error)"); exit(4) }
    print(reply["text"] as? String ?? "ok")
    exit(0)
case "--surfaces":
    // NO-04: the other apps' windows above the desktop and which system surface Dot would step aside for. Run it with
    // Spotlight, Control Center, Notification Center, Cmd-Shift-5 or Mission Control open to check the rule table.
    let others = MainActor.assumeIsolated { StepAside.liveWindows() }.filter { $0.layer >= 0 && $0.alpha > 0.05 }
    for w in others {
        print("\(w.owner) layer \(w.layer) \(Int(w.frame.width))x\(Int(w.frame.height)) at \(Int(w.frame.minX)),\(Int(w.frame.minY))\(w.name.isEmpty ? "" : " \"\(w.name)\"")")
    }
    let sizes = NSScreen.screens.map(\.frame.size)
    let up = sizes.lazy.compactMap { SystemSurfaces.up(others, screen: $0) }.first
    print(up.map { "up: \($0.word) (Dot steps aside)" } ?? "up: nothing (Dot stays)")
    exit(0)
case "--xlsx-dump":
    // H3: what the notch viewer reads from a workbook, read only. --json prints every cell (for comparing with openpyxl).
    let rest = Array(arguments.dropFirst())
    guard let path = rest.first(where: { !$0.hasPrefix("--") }) else { print("usage: Dot --xlsx-dump <file.xlsx> [--json]"); exit(2) }
    let started = Date()
    let book: XLSXWorkbook
    do { book = try XLSXWorkbook(url: URL(fileURLWithPath: (path as NSString).expandingTildeInPath)) } catch {
        print("can't read \(path): \(error)"); exit(1)
    }
    let ms = Int(Date().timeIntervalSince(started) * 1000)
    if rest.contains("--json") {
        func value(_ v: XLSXCell.Value) -> Any {
            switch v {
            case .number(let n): return n
            case .text(let t): return t
            case .bool(let b): return b
            case .error(let e): return ["error": e]
            case .empty: return NSNull()
            }
        }
        let sheets: [[String: Any]] = book.sheets.map { sheet in
            ["name": sheet.name, "hidden": sheet.hidden, "rows": sheet.rowCount, "columns": sheet.columnCount,
             "frozen": [sheet.frozenRows, sheet.frozenColumns], "truncated": sheet.truncated,
             "merges": sheet.merges.map { "\(XLSXRef.column($0.firstColumn))\($0.firstRow + 1):\(XLSXRef.column($0.lastColumn))\($0.lastRow + 1)" },
             "cells": sheet.cells.map { c -> [String: Any] in
                 var row: [String: Any] = ["ref": "\(XLSXRef.column(c.column))\(c.row + 1)", "value": value(c.value), "shown": c.shown,
                                           "format": c.style.format]
                 if let f = c.formula { row["formula"] = f }
                 return row
             }]
        }
        let data = try! JSONSerialization.data(withJSONObject: ["ms": ms, "date1904": book.date1904, "sheets": sheets], options: [.sortedKeys])
        print(String(decoding: data, as: UTF8.self))
        exit(0)
    }
    print("\(book.sheets.count) sheets in \(ms) ms")
    for sheet in book.sheets {
        print("\n== \(sheet.name)\(sheet.hidden ? " (hidden)" : ""): \(sheet.rowCount) x \(sheet.columnCount), \(sheet.cells.count) cells, frozen \(sheet.frozenRows) rows \(sheet.frozenColumns) cols, \(sheet.merges.count) merges\(sheet.truncated ? ", TRUNCATED" : "")")
        for r in 0..<min(sheet.rowCount, 25) {
            let line = (0..<min(sheet.columnCount, 8)).map { c -> String in
                let text = sheet.cell(row: r, column: c)?.shown ?? ""
                return String(text.prefix(14)).padding(toLength: 15, withPad: " ", startingAt: 0)
            }.joined()
            if !line.trimmingCharacters(in: .whitespaces).isEmpty { print(String(format: "%3d ", r + 1) + line) }
        }
    }
    exit(0)
case "--skill-draft":
    // SK-02 without Home: Dot --skill-draft "<links>" "<purpose>" prints the drafted SKILL.md and its problems; saves nothing.
    let rest = Array(arguments.dropFirst())
    guard rest.count >= 2 else { print("usage: Dot --skill-draft \"<links>\" \"<what it's for>\""); exit(2) }
    let links = SkillDraft.links(in: rest[0])
    guard !links.isEmpty, links.count <= SkillDraft.maxLinks else { print("one to five http(s) links"); exit(2) }
    let config = DotConfig.load(save: false)
    let names = SkillEntry.load(from: SkillsPage.root).map { $0.folder.lastPathComponent }
    let done = DispatchSemaphore(value: 0)
    var code: Int32 = 0
    Task { @MainActor in
        switch await SkillDrafter.draft(links: links, purpose: rest[1...].joined(separator: " "), existing: names, config: config) {
        case .success(let text):
            print(text)
            let problems = SkillDraft.problems(text, existing: Set(names))
            print(problems.isEmpty ? "--- ready to save" : "--- problems: " + problems.joined(separator: "; "))
            code = problems.isEmpty ? 0 : 1
        case .failure(let failure):
            print("no draft: \(failure.why)")
            code = 1
        }
        done.signal()
    }
    while done.wait(timeout: .now() + 0.05) == .timedOut { RunLoop.main.run(until: Date().addingTimeInterval(0.05)) }
    exit(code)
case "--router-mcp":
    // The tool router (IN-03): one MCP server under its own name, started on first use, restarted when it dies, and
    // a call past its time handed back as a handle (router_check).
    RouterMCPServer.run(Array(arguments.dropFirst()))
case "--router-fake":
    // The router self-test's stand-in MCP server.
    RouterFake.run(Array(arguments.dropFirst()))
case "--router-selftest":
    // IN-03's checks: the router over stdio against the fake, then real Claude Code with the job gate, direct and routed.
    RouterSelfTest.run(Array(arguments.dropFirst()))
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
case "--login-check":
    // Which saved login a host gets, and whether the store gives it from here: the entry's name and the password's
    // length, never the password (10-22).
    let host = arguments.dropFirst().first.map(Logins.normalize) ?? ""
    guard !host.isEmpty else { print("usage: Dot --login-check <host>"); exit(2) }
    let done = DispatchSemaphore(value: 0)
    Task {
        let names = await LoginStore.names(bench: false)
        print("store: \(names.count) names, \(names.compactMap(Logins.entry).count) logins; map: \(LoginStore.mapPath)")
        switch Logins.match(host: host, entries: names, map: Logins.loadMap(LoginStore.mapPath)) {
        case .one(let e):
            let read: String
            switch await LoginStore.password(e.name, bench: false) {
            case .password(let p): read = "read \(p.count) chars"
            case .empty: read = "the entry is empty (gopass insert -f \(e.name))"
            case .unreadable: read = "couldn't read it"
            }
            print("\(host): \(e.name) (\(e.account ?? "account not stored")); \(read)")
        case .several(let all): print("\(host): several (\(all.map(\.name).joined(separator: ", ")))")
        case .none(let hint): print("\(host): no saved login\(hint.map { "; \($0)" } ?? "")")
        }
        done.signal()
    }
    while done.wait(timeout: .now() + 0.05) == .timedOut { RunLoop.main.run(until: Date().addingTimeInterval(0.05)) }
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
    AgentHostCore.serve(path: socket, permissions: { PermissionProbe.report() })
case "--jobs":
    // The install gate (parity run): what an install would interrupt in the running Dot. Exit 0 idle, 1 busy, 3 no answer.
    let path = ProcessInfo.processInfo.environment[ControlServer.pathVariable].flatMap { $0.isEmpty ? nil : $0 }
        ?? (NSHomeDirectory() as NSString).appendingPathComponent("Dot/control.sock")
    guard let reply = try? UnixSocketClient.send(["verb": "jobs"], to: path, timeout: 5), let report = IdleReport(wire: reply) else {
        print(arguments.contains("--json") ? "{\"v\":1,\"error\":\"no answer from Dot at \(path)\"}" : "jobs: no answer from Dot at \(path)")
        exit(3)
    }
    if arguments.contains("--json"), let data = try? JSONSerialization.data(withJSONObject: report.wire, options: [.sortedKeys]) {
        print(String(decoding: data, as: UTF8.self))
    } else {
        print(report.idle ? "idle" : report.reasons.map { "busy: \($0)" }.joined(separator: "\n"))
    }
    exit(report.idle ? 0 : 1)
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
      Dot --ink-selftest       draw every ink mark offscreen and check layout, timing and edits
      Dot --figure-selftest    build a 3D figure offscreen, click its parts, and check a card's three.js clicks
      Dot --listen [title]     start the lecture ear       Dot --stop-listening  stop it and save the transcript
      Dot --dictionary "heard => correct"   add a term the recognizer should write your way
      Dot --snapshot [folder] [notch|stack|overlay|cards|panel]  render every notch state, stack chip, mark and card to PNG
      Dot --stack-demo [--muted] [--job]   a fake agent (or job) through the running Dot's stack (no voice, no chime)
      Dot --stack-selftest [--muted] [--job] [frames.json]   the same demo in this process, its window off screen, G7 to G9 checked
      Dot --page-selftest                                    a job page in its window: a tick and a letter Send through WebKit
      Dot --stack-selftest --hover | --edges                 a pretend pointer on an avatar; the left and right edge columns (J6)
      Dot --panel file.ui      show a UI-language explanation in the explainer panel (Dot --panel close hides it)
      Dot --prompt talk|think  print a session's system prompt
      Dot --quip-test          three sample moments through the quip model (quipModel), each line and its check
      Dot --track-selftest     the running Dot checks that marks stay on scrolled content (posts real scrolls; run while away)
      Dot --selftest           check the notch's permission-card queue (no agents, no model)
      Dot --gate               the agents' tool-call hook (Claude Code runs it; JSON on stdin)
      Dot --doc-check <file or url> [question]         how Dot reads a document: pages and passages, or why it can't
      Dot --permissions                                what macOS gave Dot, the agent host and cua-driver (asks nothing)
      Dot --capture-check                              one capture in memory: is the Screen Recording grant working
      Dot --barge-selftest [--talk] [--music]          talk over Dot on this route: no self-trigger, the output unchanged (plays sound)
      Dot --router-mcp --server <name> --spec <file>   one MCP server through the tool router (Claude Code runs it)
      Dot --router-selftest [--quick] [--no-claude]    the router against a fake server, then Claude Code and the job gate
      Dot --host [list]        the agent host that keeps agents running across a relaunch (launchd runs it)
      Dot --jobs [--json]      what an install would interrupt now (exit 0 idle, 1 busy, 3 no answer)
      Dot --agent-start <name> "<brief>" [--quiet]   start (or follow up with) an agent in the running Dot; --quiet: no chime or voice [--json]
      Dot --agent-status [name]            where an agent stands: state, last step, next, files, spend today [--json]
      Dot --agent-list                     every agent's status [--json]
      Dot --agent-archive <name>           stop an agent and move its folder to agents/.archive [--json]
      Dot --agent-suggest                  the weekly agent-suggestion sweep, printed now (no card)
      Dot --skill-avatars                  each skill's picture by Dot's rule table
      Dot --xlsx-dump <file.xlsx> [--json] what the file viewer reads from a workbook (read only)
      Dot --view <file>                    show a file in the running Dot's notch viewer
      Dot --surfaces                       the system surface Dot would step aside for right now, and the windows it read
      Dot --skill-draft "<links>" "<purpose>"   draft a SKILL.md from links and print it (saves nothing)
      Dot --agent-tell <name> "<message>" [--quiet]  pass an agent a message, like a typed follow-up [--json]
      Dot --agent-note <to> "<text>" [--from <name>]   leave an agent a note for its next step or turn [--json]
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
case "--permissions":
    // ON-01/ON-03: what macOS gave Dot, the agent host and cua-driver; asks for nothing.
    PermissionGuide.lines(PermissionProbe.holders()).forEach { print($0) }
    exit(0)
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
case "--lecture-replay":
    // A recorded lecture through lecture mode's real pipeline, into a scratch folder (LectureReplay).
    let replayApp = NSApplication.shared
    replayApp.setActivationPolicy(.accessory)
    replayApp.finishLaunching()
    let passed = MainActor.assumeIsolated { LectureReplay.run(Array(arguments.dropFirst())) }
    exit(passed ? 0 : 1)
case "--after-class":
    // The after-class pass on a saved class, into a scratch copy (AfterClassReplay): never his notes or his Desktop.
    let afterApp = NSApplication.shared
    afterApp.setActivationPolicy(.accessory)
    afterApp.finishLaunching()
    let afterPassed = MainActor.assumeIsolated { AfterClassReplay.run(Array(arguments.dropFirst())) }
    exit(afterPassed ? 0 : 1)
case "--lecture-demo":
    // Lecture mode in the running Dot on the recorded class in ~/Dot/talk/lecture-demo, into a sandbox (LectureDemo).
    let demoArgs = Array(arguments)   // `arguments` is a slice: its indices start at 1
    func demoValue(_ flag: String) -> String? { demoArgs.firstIndex(of: flag).flatMap { $0 + 1 < demoArgs.count ? demoArgs[$0 + 1] : nil } }
    var demoInfo: [String: String] = ["speed": demoValue("--speed") ?? "2", "from": demoValue("--from") ?? "0"]
    if demoArgs.count > 1, !demoArgs[1].hasPrefix("--") { demoInfo["name"] = demoArgs[1] }
    if arguments.contains("--mute") { demoInfo["mute"] = "1" }
    DistributedNotificationCenter.default().postNotificationName(DotIPC.lectureDemo, object: nil, userInfo: demoInfo, deliverImmediately: true)
    print("sent to Dot: \(demoInfo["name"] ?? "the default") lecture demo at \(demoInfo["speed"]!)x from minute \(demoInfo["from"]!)\(demoInfo["mute"] == nil ? ", out loud" : ", muted")")
    exit(0)
case "--selftest":
    let selfTestApp = NSApplication.shared
    selfTestApp.setActivationPolicy(.accessory)
    selfTestApp.finishLaunching()
    let passed = MainActor.assumeIsolated { SelfTest.run() }
    exit(passed ? 0 : 1)
case "--notes-selftest":
    // The lecture notes window off every display: Dot's lines around his, his keys as messages, a paginated PDF.
    let notesApp = NSApplication.shared
    notesApp.setActivationPolicy(.accessory)
    notesApp.finishLaunching()
    let notesPassed = MainActor.assumeIsolated { NotesSelfTest.run() }
    exit(notesPassed ? 0 : 1)
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
case "--barge-selftest":
    // Talk over Dot on this Mac's real route (AU-01, AU-02). Plays sound: run it with him there, lid open.
    BargeSelfTest.run(Array(arguments.dropFirst()))
case "--capture-check":
    // ON-02: one capture of the cursor's screen, kept in memory only, and the health verdict on it.
    let done = DispatchSemaphore(value: 0)
    var verdict = "?"
    Task { @MainActor in
        let shots = (try? await ScreenCapture.captureAll(maxDimension: 640, includeOtherScreens: false)) ?? []
        verdict = "capture: \(ScreenCapture.health.rawValue) (\(shots.count) shot(s), \(ScreenCapture.otherAppWindows()) other windows listed, grant \(CGPreflightScreenCaptureAccess() ? "on" : "off"))"
        done.signal()
    }
    while done.wait(timeout: .now() + 0.05) == .timedOut { RunLoop.main.run(until: Date().addingTimeInterval(0.05)) }
    print(verdict)
    exit(verdict.hasPrefix("capture: ok") ? 0 : 1)
case "--doc-check":
    // How Dot reads a document (AU-03, VO-11): its pages and the passages a deep answer would carry, or the line it says
    // when it can't read it.
    let rest = Array(arguments.dropFirst())
    guard let target = rest.first else { print("usage: Dot --doc-check <file or url> [question]"); exit(2) }
    let question = rest.dropFirst().joined(separator: " ")
    var context = ScreenContext()
    if target.hasPrefix("http") { context.url = target } else { context.documentPath = (target as NSString).expandingTildeInPath }
    context.windowTitle = (target as NSString).lastPathComponent
    let done = DispatchSemaphore(value: 0)
    Task { @MainActor in
        let reader = DocumentReader()
        if let document = await reader.document(for: context) {
            print("read: \(document.isPDF ? "pdf" : "text") \"\(document.title)\", \(document.pageCount) page(s), \(document.text.count) chars")
            if !question.isEmpty {
                print(DocumentPassages.block(question: question, title: document.title, pages: document.pages, isPDF: document.isPDF) ?? "no passage matches")
            }
        } else if let read = reader.problem(for: context) {
            print("problem: \(read.problem.rawValue): \(read.problem.line(isPDF: read.isPDF))")
        } else {
            print("not a document Dot reads")
        }
        done.signal()
    }
    while done.wait(timeout: .now() + 0.05) == .timedOut { RunLoop.main.run(until: Date().addingTimeInterval(0.05)) }
    exit(0)
case "--agent-tools":
    // Which servers an agent gets and which it is denied (parity AG-08), from its folder, without starting it.
    let config = DotConfig.peek()
    let slugs = arguments.dropFirst().isEmpty
        ? ((try? FileManager.default.contentsOfDirectory(atPath: config.agentsRootURL.path)) ?? []).filter { !$0.hasPrefix(".") }.sorted()
        : Array(arguments.dropFirst())
    print("known servers: \(AgentManager.seenServers(config).joined(separator: ", "))")
    for slug in slugs {
        let (known, chosen) = AgentManager.tools(folder: config.agentsRootURL.appendingPathComponent(slug), config: config)
        let denied = AgentTools.denied(known: known, chosen: chosen)
        print("\(slug): \(chosen.sorted().map(AgentTools.label).joined(separator: ", "))" + (denied.isEmpty ? "" : "  (denied: \(denied.joined(separator: " ")))"))
    }
    exit(0)
case "--page-selftest":
    // A job page in the real page window off every display: a tick and a letter Send clicked in WebKit (parity J1, J2).
    let pageApp = NSApplication.shared
    pageApp.setActivationPolicy(.accessory)
    pageApp.finishLaunching()
    exit(MainActor.assumeIsolated { PageSelfTest.run() } ? 0 : 1)
case "--stack-selftest":
    // The stack demo in this process, its window off every display, with G7 to G9's window rules checked (04).
    let flags = Array(arguments.dropFirst())
    let stackApp = NSApplication.shared
    stackApp.setActivationPolicy(.accessory)
    stackApp.finishLaunching()
    let file = flags.first { !$0.hasPrefix("--") }
    let passed = MainActor.assumeIsolated {
        flags.contains("--hover") ? StackSelfTest.runHover()
            : flags.contains("--edges") ? StackSelfTest.runEdges()
            : StackSelfTest.run(muted: flags.contains("--muted"), job: flags.contains("--job"), framesFile: file)
    }
    exit(passed ? 0 : 1)
case "--bluetooth":
    // Bluetooth power in a process of its own (MacSettings): `Dot --bluetooth on|off|state` prints on or off.
    exit(BluetoothPower.run(arguments.dropFirst().first ?? "state"))
case "--notch-selftest":
    // A typed answer through a real notch window off every display: every line must show (10-21).
    let notchApp = NSApplication.shared
    notchApp.setActivationPolicy(.accessory)
    notchApp.finishLaunching()
    let notchPassed = MainActor.assumeIsolated { NotchSelfTest.run() }
    exit(notchPassed ? 0 : 1)
case "--ink-selftest":
    // Ink's offscreen check (parity batch 1): every mark kind, the layout check, timing, edits; the sheet to ~/Dot/selftests.
    let inkApp = NSApplication.shared
    inkApp.setActivationPolicy(.accessory)
    inkApp.finishLaunching()
    let inkPassed = MainActor.assumeIsolated { InkSelfTest.run() }
    exit(inkPassed ? 0 : 1)
case "--figure-selftest":
    // The 3D figure's offscreen check (parity D5): parts build, clicks name parts, cards' three.js clicks reach Swift.
    let figureApp = NSApplication.shared
    figureApp.setActivationPolicy(.accessory)
    figureApp.finishLaunching()
    let figurePassed = MainActor.assumeIsolated { FigureSelfTest.run() }
    exit(figurePassed ? 0 : 1)
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
    // An unknown flag never starts the app: a build that lacked a new flag read it as "launch" and ran a second Dot
    // beside his, with its own hotkey tap and talk session (2026-10-26 05:08). The app itself takes no arguments.
    if let flag = arguments.first, flag.hasPrefix("--") {
        FileHandle.standardError.write(Data("Dot: unknown flag \(flag) (Dot --help lists them); the app was not started\n".utf8))
        exit(2)
    }
}

let app = NSApplication.shared
let delegate = MainActor.assumeIsolated { AppDelegate() }
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
