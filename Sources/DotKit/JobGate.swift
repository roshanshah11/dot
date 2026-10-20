import Foundation

/// The Atlas tools a job may call on its read server (`atlas`). One source of truth: JobConfigFile passes this list as
/// ATLAS_MCP_TOOLS, and JobGate allows nothing else from that server. The send tools live only on `atlas-send`, whose
/// `ask-` session makes them queue for his yes. Everything that goes out, changes his records or stops browsers is left
/// off on purpose; `never` pins that.
public enum JobAtlasTools {
    public static let reads: [String] = [
        "search", "get", "now", "calendar", "calendars", "free", "travel", "mail", "thread", "unanswered", "attachments",
        "messages", "messages_thread", "people", "contacts", "facts", "history", "journal", "opps", "postings", "watch_list",
        "canvas_courses", "canvas_find", "canvas_read", "docs", "read_doc", "view_note", "recent_files", "deliverable",
        "commitments", "project", "state", "preferences", "lesson", "brief", "reviews", "proposals", "status", "vocabulary",
        "sec_lookup", "sec_facts", "sec_batch", "sec_filings", "sec_section", "quote", "fin_calc", "web_text", "apple_note_read",
    ]
    /// His own, safe writes. `xlsx_write` and `apple_note` carry extra input rules in JobGate.
    public static let ownWrites: [String] = [
        "remember", "draft_email", "calendar_create", "reminder", "commit", "todo", "deadline_add", "canvas_download",
        "xlsx_write", "apple_note",
    ]
    /// The site tools (06-10). Names the live server doesn't have are ignored by atlas.mcp's exposed_tools().
    public static let siteReads: [String] = [
        "mail_live", "mail_read", "mail_triage", "app_status", "rooms_free", "wyzant_threads", "amazon_search", "amazon_product",
        "gdoc_read",
    ]
    /// Saves files: in the bench its downloads go to /tmp/dot-bench (ATLAS_DOWNLOADS_DIR, no vault), so it is allowed there.
    public static let canvasReadings = "canvas_readings"
    public static let siteWrites: [String] = ["thread_draft", "gdoc_export"]
    /// Allowed, but only when his words named what to apply to (it fills and uploads, never submits).
    public static let handshakeApply = "handshake_apply"

    public static var ordered: [String] { reads + ownWrites + siteReads + [canvasReadings] + siteWrites + [handshakeApply] }
    public static let allowed: Set<String> = Set(reads + ownWrites + siteReads + [canvasReadings] + siteWrites + [handshakeApply])
    public static let benchAllowed: Set<String> = Set(reads + siteReads + [canvasReadings])

    /// The send tools, which exist only on `atlas-send`.
    public static let sendTools: [String] = ["imessage_send", "send_email", "reply"]

    /// Never on the read server's list: sends, his records, grants, browsers.
    public static let never: Set<String> = [
        "imessage_send", "send_email", "reply", "grant", "revoke", "forget", "task", "ask_him", "calendar_update",
        "calendar_delete", "contact_upsert", "handshake_submit", "instagram_post", "reel_transcribe", "reel_watch", "opp_mark",
        "opp_add", "watch_add", "watch_remove", "cycle_add", "review_accept", "review_reject", "correct", "dispute", "sync",
        "bug", "deliverable_update", "write_note", "commit_done", "commit_update", "deadline_confirm", "state_update",
        "state_rewrite", "state_rollback", "apple_notes_batch", "browse", "browse_screenshot", "logged_in", "open_tab",
        "browser_cleanup",
    ]
}

public enum JobGateDecision: Equatable, Sendable {
    case allow
    case deny(String)
}

/// What the gate knows about the job asking.
public struct JobGateContext {
    public var bench: Bool
    /// The job's own folder (~/Dot/jobs/<id>, or /tmp/dot-bench/jobs/<id> in the bench).
    public var jobFolder: String
    public var protectedRoots: [String]
    /// The atlas-send tools proven to only queue in an `ask-` session (scripts/test_dot_atlas_approve.py).
    public var queuedSends: Set<String>
    /// His words for this job, for the handshake_apply rule.
    public var hisWords: String
    public var home: String
    public var fileExists: (String) -> Bool
    public var isDirectory: (String) -> Bool
    public var readFile: (String) -> String?

    public init(bench: Bool, jobFolder: String, protectedRoots: [String], queuedSends: Set<String>, hisWords: String,
                home: String = NSHomeDirectory(),
                fileExists: @escaping (String) -> Bool = { FileManager.default.fileExists(atPath: $0) },
                isDirectory: @escaping (String) -> Bool = { path in
                    var dir: ObjCBool = false
                    return FileManager.default.fileExists(atPath: path, isDirectory: &dir) && dir.boolValue
                },
                readFile: @escaping (String) -> String? = { try? String(contentsOfFile: $0, encoding: .utf8) }) {
        self.bench = bench
        self.jobFolder = jobFolder
        self.protectedRoots = protectedRoots
        self.queuedSends = queuedSends
        self.hisWords = hisWords
        self.home = home
        self.fileExists = fileExists
        self.isDirectory = isDirectory
        self.readFile = readFile
    }
}

/// Every tool call a job makes passes here (the session's permission handler). Explicit allow lists: anything not
/// allowed below is denied with a reason the job can act on. His rule (nothing goes out without his yes) holds because
/// screen actions go through the dot tools, which check each button, sends only queue, and Bash is fenced twice: a
/// per-segment allow list here and Claude Code's sandbox around it.
public enum JobGate {
    public static let hisThing = "that one goes out or changes his things, so it's his: get everything ready, stop, and say what is ready for him."
    public static let benchOnly = "bench: reads only"
    public static let saveInOutput = "save it in your output folder; dot puts it where it goes"
    public static let notInJob = "not in a job: use the dot tools, atlas, or WebFetch"

    static let readTools: Set<String> = [
        "Read", "Glob", "Grep", "LS", "WebSearch", "WebFetch", "TodoWrite", "NotebookRead", "ToolSearch", "Skill",
        "ListMcpResourcesTool", "ReadMcpResourceTool", "BashOutput", "TaskOutput",
    ]

    public static func decide(tool: String, input: [String: AnyCodableValue], context c: JobGateContext) -> JobGateDecision {
        // 1. The hands check every press themselves.
        if tool.hasPrefix("mcp__dot__") { return .allow }
        // 2. Sends queue on atlas-send, and only the proven ones.
        if tool.hasPrefix("mcp__atlas-send__") {
            if c.bench { return .deny(benchOnly) }
            let name = String(tool.dropFirst("mcp__atlas-send__".count))
            return c.queuedSends.contains(name) ? .allow : .deny(hisThing)
        }
        if tool.hasPrefix("mcp__atlas__") {
            return atlas(String(tool.dropFirst("mcp__atlas__".count)), input: input, context: c)
        }
        // 5. Any other MCP server.
        if tool.hasPrefix("mcp__") { return .deny("that server isn't in a job; use the dot tools or atlas") }
        switch tool {
        case "Write": return write(path(input), context: c)
        case "Edit", "MultiEdit":
            guard let p = path(input).map(resolve(c)) else { return .deny("no file path") }
            let root = c.bench ? "/tmp/dot-bench" : c.jobFolder
            return inside(p, root) ? .allow : .deny("edit only files in your own folder; " + saveInOutput)
        case "Bash":
            if c.bench { return .deny(benchOnly) }
            if case .bool(true)? = input["dangerouslyDisableSandbox"] { return .deny("bash runs in the sandbox in a job") }
            guard case .string(let command)? = input["command"] else { return .deny("no command") }
            return bash(command, context: c)
        case "Task", "Agent": return .deny("no helpers in a job: do it yourself")
        case "AskUserQuestion", "EnterPlanMode", "ExitPlanMode": return .deny("a job can't ask him mid-way: decide, or end with blocked:")
        case "Read":
            if let p = path(input).map(resolve(c)), secretRoots(c).contains(where: { inside(p, $0) }) { return .deny("that file is private") }
            return .allow
        default:
            return readTools.contains(tool) ? .allow : .deny(notInJob)
        }
    }

    // MARK: Atlas

    static func atlas(_ name: String, input: [String: AnyCodableValue], context c: JobGateContext) -> JobGateDecision {
        if c.bench { return JobAtlasTools.benchAllowed.contains(name) ? .allow : .deny(benchOnly) }
        // 3. handshake_apply before the rest: "apply" is an outward word, but it fills and uploads and never submits.
        if name == JobAtlasTools.handshakeApply {
            return namedPosting(c.hisWords) ? .allow : .deny("apply only to a posting he named; " + hisThing)
        }
        // 4. Only the list.
        guard JobAtlasTools.allowed.contains(name), !JobAtlasTools.never.contains(name) else { return .deny(hisThing) }
        // An event made with guests sends invitations (review M2): talk's rule, so a future attendees field can't slip by.
        if ConsentPolicy.isOutwardMCP(tool: name, input: input) { return .deny("that tells other people something (guests on an event); " + hisThing) }
        switch name {
        case "xlsx_write":
            guard case .string(let p)? = input["path"] else { return .deny("xlsx_write needs a path") }
            return c.fileExists(resolve(c)(p)) ? .deny("that workbook exists; write a new file, never over his") : .allow
        case "apple_note":
            // By default it rewrites a same-titled note in place; a job only ever makes a new note.
            guard case .bool(false)? = input["update"] else { return .deny("apple_note needs update: false in a job (never rewrite his note)") }
            if case .bool(true)? = input["replace"] { return .deny("never replace his notes") }
            return .allow
        default:
            return .allow
        }
    }

    static let applyWords = Rx.make(#"\b(?:apply|applying|application|applications|handshake)\b"#)

    /// His words asked to apply and named the firm or the posting: a capitalized name past the first word, or an id.
    static func namedPosting(_ words: String) -> Bool {
        guard Rx.has(applyWords, words) else { return false }
        let tokens = words.split(whereSeparator: { $0.isWhitespace || ",.?!:;\"".contains($0) }).map(String.init)
        let skip: Set<String> = ["I", "I'm", "I'll", "Handshake", "Dot", "Comet", "Can", "Please", "Hey"]
        for (i, t) in tokens.enumerated() where i > 0 {
            if t.first?.isUppercase == true, !skip.contains(t) { return true }
            if t.count >= 5, t.allSatisfy(\.isNumber) { return true }
        }
        return false
    }

    // MARK: Files

    static func path(_ input: [String: AnyCodableValue]) -> String? {
        for key in ["file_path", "path", "notebook_path"] { if case .string(let s)? = input[key], !s.isEmpty { return s } }
        return nil
    }

    static func resolve(_ c: JobGateContext) -> (String) -> String {
        { raw in
            var p = raw
            if p == "~" { p = c.home } else if p.hasPrefix("~/") { p = c.home + p.dropFirst(1) }
            if !p.hasPrefix("/") { p = (c.jobFolder as NSString).appendingPathComponent(p) }
            return ConsentPolicy.canonical(p)
        }
    }

    static func inside(_ path: String, _ root: String) -> Bool {
        let r = ConsentPolicy.canonical(root)
        let p = ConsentPolicy.canonical(path)
        return p == r || p.hasPrefix(r.hasSuffix("/") ? r : r + "/")
    }

    static func secretRoots(_ c: JobGateContext) -> [String] {
        ["\(c.home)/.ssh", "\(c.home)/Library/Keychains", "\(c.home)/roshan/Atlas/private", "\(c.home)/Projects/browser-agent/.env"]
    }

    /// 6. Write: a new file in the job's folder or /tmp; his folders get files only through Dot's copy (a new name,
    /// never over his). The job's own files it may write again.
    static func write(_ raw: String?, context c: JobGateContext) -> JobGateDecision {
        guard let raw else { return .deny("no file path") }
        let p = resolve(c)(raw)
        if c.bench { return inside(p, "/tmp/dot-bench") ? .allow : .deny(benchOnly) }
        if c.protectedRoots.contains(where: { inside(p, $0) }) || secretRoots(c).contains(where: { inside(p, $0) }) {
            return .deny("that folder is protected; " + saveInOutput)
        }
        if inside(p, c.jobFolder) { return .allow }
        if inside(p, "/tmp") {
            return c.fileExists(p) ? .deny("that file exists; write a new one") : .allow
        }
        return .deny(saveInOutput)
    }

    // MARK: Bash

    static let allowedCommands: Set<String> = [
        "python3", "python3.13", "ls", "cat", "head", "tail", "wc", "grep", "rg", "find", "mkdir", "cp", "mv", "touch", "file",
        "stat", "du", "date", "echo", "printf", "sed", "sort", "uniq", "cut", "tr", "jq", "pdftotext", "pdfinfo", "unzip", "zip",
        "base64", "shasum", "mdls", "soffice", "open", "rm", "cd", "true", "pwd", "basename", "dirname",
    ]
    static let deniedCommands: Set<String> = [
        "atlasctl", "osascript", "curl", "wget", "claude", "cliclick", "cua-driver", "imsg", "gmail", "outlook", "hb", "cb", "cbg",
        "rba", "agent-browser", "node", "npx", "security", "launchctl", "defaults", "sudo", "ssh", "scp", "git",
    ]
    static let deniedPathSuffixes = ["dot-atlas-approve.py", "dot-spotify.sh"]
    /// Code forms, matched as code (a word boundary in front), so "the list is empty." or "approved by cybersecurity"
    /// never trips them.
    static let deniedPythonForms: [(name: String, re: NSRegularExpression)] = [
        "import subprocess", "subprocess.", "os.system(", "os.popen(", "os.exec", "pty.", "import socket", "smtplib",
        "urllib.request", "http.client", "requests.", "import atlas", "from atlas", "approve_from_app", "state.sqlite",
        "__import__(", "importlib", "exec(", "eval(",
        // review L2: spawning and in-process event posting (CoreGraphics through ctypes) without subprocess
        "from subprocess", "ctypes", "posix_spawn", "os.spawn", "from os import system", "from os import popen",
        "from os import exec", "from os import spawn", "from os import posix_spawn", "marshal.", "FunctionType", "Quartz", "CoreGraphics",
    ].map { form in (form, Rx.make(#"(?<![A-Za-z0-9_])"# + NSRegularExpression.escapedPattern(for: form))) }

    static func deniedForm(in text: String) -> String? {
        deniedPythonForms.first(where: { Rx.has($0.re, text) })?.name
    }
    static let deckScripts: Set<String> = [
        "verify_deck", "measure", "tokens", "morph", "master", "sheet", "textfit", "effects", "embed_fonts", "fontcheck",
    ]
    static let openExtensions: Set<String> = [
        "pdf", "docx", "xlsx", "pptx", "csv", "txt", "md", "png", "jpg", "jpeg", "heic", "key", "pages", "numbers",
    ]
    static let openBannedApps = ["terminal", "iterm", "iterm2", "script editor", "automator", "shortcuts", "comet", "safari",
                                 "google chrome", "chrome", "arc", "firefox", "brave browser", "microsoft edge", "perplexity"]
    static let skillScript = Rx.make(#"\.claude(?:-\d)?/skills/([^/\s"']+)/scripts/([^/\s"']+)"#)

    public static func bash(_ command: String, context c: JobGateContext) -> JobGateDecision {
        // Code forms anywhere in the command text (a python -c or heredoc body included).
        if let form = deniedForm(in: command) { return .deny("not in a job (\(form)): " + notInJob) }
        if deniedPathSuffixes.contains(where: { command.contains($0) }) { return .deny(notInJob) }
        if let m = skillScript.firstMatch(in: command, range: NSRange(location: 0, length: (command as NSString).length)) {
            let ns = command as NSString
            let skill = ns.substring(with: m.range(at: 1))
            let script = (ns.substring(with: m.range(at: 2)) as NSString).deletingPathExtension
            if !(skill == "powerpoint-design" && deckScripts.contains(script)) {
                return .deny("that skill's script uses tools a job doesn't have; do that step with the dot tools")
            }
        }
        let (parts, subs) = split(command)
        for sub in subs {
            if case .deny(let why) = bash(sub, context: c) { return .deny(why) }
        }
        var changedFolder = false
        for segment in parts {
            switch checkSegment(segment, context: c, relativeAllowed: !changedFolder) {
            case .allow: break
            case .deny(let why): return .deny(why)
            }
            if ShellSegment.words(segment).first.map({ ($0 as NSString).lastPathComponent }) == "cd" { changedFolder = true }
        }
        return .allow
    }

    static func checkSegment(_ segment: String, context c: JobGateContext, relativeAllowed: Bool) -> JobGateDecision {
        var words = ShellSegment.words(segment)
        // Wrappers: env, nohup, time, command, exec, VAR=x, xargs, sh -c.
        while let first = words.first {
            let w = (first as NSString).lastPathComponent
            if ["env", "nohup", "time", "command", "builtin", "exec"].contains(w) || (first.contains("=") && !first.hasPrefix("-") && !first.hasPrefix("=")) {
                words.removeFirst(); continue
            }
            if w == "xargs" {
                words.removeFirst()
                while let f = words.first, f.hasPrefix("-") {
                    words.removeFirst()
                    if ["-n", "-I", "-L", "-P", "-s", "-E", "-d", "-J", "-R"].contains(f), !words.isEmpty { words.removeFirst() }
                }
                continue
            }
            if ["bash", "zsh", "sh"].contains(w) {
                if words.count >= 3, words[1] == "-c" { return bash(words[2], context: c) }
                return .deny(notInJob)
            }
            break
        }
        guard let first = words.first else { return .allow }
        if first.hasPrefix("\\") { words[0] = String(first.dropFirst()) }
        let word = (words[0] as NSString).lastPathComponent
        if deniedCommands.contains(word) { return .deny("\(word) isn't in a job: " + notInJob) }
        if word.hasPrefix("$") || word.contains("`") { return .deny(notInJob) }
        guard allowedCommands.contains(word) else { return .deny("\(word) isn't in a job: " + notInJob) }
        let args = Array(words.dropFirst())
        switch word {
        case "python3", "python3.13":
            return python(args, segment: segment, context: c)
        case "find":
            let banned: Set<String> = ["-exec", "-execdir", "-ok", "-okdir", "-delete", "-fls"]
            if args.contains(where: { banned.contains($0) || $0.hasPrefix("-fprint") }) { return .deny("find can't run or delete things in a job") }
        case "sort":
            if args.contains(where: { $0.hasPrefix("--compress-program") }) { return .deny(notInJob) }
        case "zip":
            if args.contains(where: { $0 == "-T" || $0 == "-TT" || $0.hasPrefix("--unzip-command") }) { return .deny(notInJob) }
        case "soffice":
            if segment.contains("macro:") || segment.contains("vnd.sun.star.script") { return .deny("soffice converts files only") }
        case "open":
            return open(args, context: c)
        case "rm":
            return remove(args, context: c, relativeAllowed: relativeAllowed)
        default: break
        }
        return .allow
    }

    static func python(_ args: [String], segment: String, context c: JobGateContext) -> JobGateDecision {
        var i = 0
        while i < args.count {
            let a = args[i]
            if a == "-c" || a == "-" { return .allow }   // the code is in the command text, already scanned
            if a == "-m" {
                let module = i + 1 < args.count ? args[i + 1] : ""
                return module == "json.tool" ? .allow : .deny("python -m \(module) isn't in a job")
            }
            if a.hasPrefix("-") { i += 1; continue }
            // A script file: read it and scan it like the command text. The deck skill's own scripts are the one
            // exception (they call soffice and fonts tools; the sandbox still fences them).
            let p = resolve(c)(a)
            if isDeckScript(p) { return .allow }
            guard let body = c.readFile(p) else { return .deny("can't read \(a) to check it") }
            if let form = deniedForm(in: body) { return .deny("\(a) uses \(form): " + notInJob) }
            if body.range(of: #"\b(?:hb|cbg|rba|osascript|atlasctl|curl|imsg|cliclick)\b"#, options: .regularExpression) != nil,
               body.contains("Popen") || body.contains("run(") {
                return .deny("\(a) runs tools a job doesn't have")
            }
            return .allow
        }
        // `python3 < file.py`
        if let r = segment.range(of: #"<\s*([^\s<>|;&]+)"#, options: .regularExpression) {
            let file = segment[r].dropFirst().trimmingCharacters(in: .whitespaces)
            guard let body = c.readFile(resolve(c)(file)) else { return .deny("can't read \(file) to check it") }
            if let form = deniedForm(in: body) { return .deny("\(file) uses \(form): " + notInJob) }
        }
        return .allow
    }

    static func isDeckScript(_ path: String) -> Bool {
        guard let m = skillScript.firstMatch(in: path, range: NSRange(location: 0, length: (path as NSString).length)) else { return false }
        let ns = path as NSString
        let script = (ns.substring(with: m.range(at: 2)) as NSString).deletingPathExtension
        return ns.substring(with: m.range(at: 1)) == "powerpoint-design" && deckScripts.contains(script) && path.hasSuffix(".py")
    }

    static func open(_ args: [String], context c: JobGateContext) -> JobGateDecision {
        var i = 0
        var targets: [String] = []
        while i < args.count {
            let a = args[i]
            switch a {
            case "-g", "-R", "-F", "-W", "-j": i += 1
            case "-a":
                let app = i + 1 < args.count ? args[i + 1].lowercased() : ""
                let name = ((app as NSString).lastPathComponent as NSString).deletingPathExtension
                if openBannedApps.contains(name) || app.isEmpty { return .deny("open can't use that app in a job") }
                i += 2
            default:
                if a.hasPrefix("-") { return .deny("open \(a) isn't in a job") }
                targets.append(a); i += 1
            }
        }
        guard !targets.isEmpty else { return .deny("open what?") }
        for t in targets {
            if t.range(of: #"^[a-zA-Z][a-zA-Z0-9+.-]*:"#, options: .regularExpression) != nil { return .deny("open a page with the dot tools, not open") }
            let p = resolve(c)(t)
            let ext = (p as NSString).pathExtension.lowercased()
            if ext.isEmpty ? !c.isDirectory(p) : !openExtensions.contains(ext) { return .deny("open only folders and documents in a job") }
        }
        return .allow
    }

    static func remove(_ args: [String], context c: JobGateContext, relativeAllowed: Bool) -> JobGateDecision {
        var targets: [String] = []
        var flagsDone = false
        for a in args {
            if !flagsDone, a == "--" { flagsDone = true; continue }
            if !flagsDone, a.hasPrefix("-") { continue }
            targets.append(a)
        }
        guard !targets.isEmpty else { return .deny("rm what?") }
        for t in targets {
            if t.contains("{") || t.contains("}") || t.contains("$") { return .deny("rm only plain paths in your folder") }
            if !relativeAllowed, !(t.hasPrefix("/") || t.hasPrefix("~/")) { return .deny("rm after cd needs a full path in your folder") }
            var raw = t
            if let g = raw.firstIndex(where: { "*?[".contains($0) }) {
                let head = raw[..<g]
                raw = head.contains("/") ? String(head[..<head.lastIndex(of: "/")!]) + "/x" : "x"
            }
            let p = resolve(c)(raw)
            let root = ConsentPolicy.canonical(c.jobFolder)
            guard p.hasPrefix(root + "/") else { return .deny("rm only inside your own folder") }
        }
        return .allow
    }

    /// Top-level segments of a command (split on unquoted | ; & and newlines) and the bodies of its command
    /// substitutions ($(...), backticks, <(...), >(...)), which run too and are checked the same way.
    static func split(_ command: String) -> (segments: [String], substitutions: [String]) {
        let cleaned = command.replacingOccurrences(of: #"[0-9]*>&[0-9-]+|&>>?"#, with: " >", options: .regularExpression)
        var segments: [String] = []
        var subs: [String] = []
        var current = ""
        var quote: Character?
        var escaped = false
        let chars = Array(cleaned)
        var i = 0
        func capture(from start: Int) -> (String, Int) {
            var depth = 1
            var j = start
            var body = ""
            while j < chars.count {
                let ch = chars[j]
                if ch == "(" { depth += 1 } else if ch == ")" { depth -= 1; if depth == 0 { return (body, j + 1) } }
                body.append(ch); j += 1
            }
            return (body, j)
        }
        while i < chars.count {
            let ch = chars[i]
            if escaped { current.append(ch); escaped = false; i += 1; continue }
            if ch == "\\", quote != "'" { current.append(ch); escaped = true; i += 1; continue }
            if quote == "'" { if ch == "'" { quote = nil }; current.append(ch); i += 1; continue }
            if ch == "$", i + 1 < chars.count, chars[i + 1] == "(" {
                let (body, next) = capture(from: i + 2); subs.append(body); current.append("X"); i = next; continue
            }
            if quote == nil, (ch == "<" || ch == ">"), i + 1 < chars.count, chars[i + 1] == "(" {
                let (body, next) = capture(from: i + 2); subs.append(body); current.append("X"); i = next; continue
            }
            if ch == "`" {
                var j = i + 1; var body = ""
                while j < chars.count, chars[j] != "`" { body.append(chars[j]); j += 1 }
                subs.append(body); current.append("X"); i = j + 1; continue
            }
            if quote == "\"" { if ch == "\"" { quote = nil }; current.append(ch); i += 1; continue }
            if ch == "'" || ch == "\"" { quote = ch; current.append(ch); i += 1; continue }
            if "|;&\n".contains(ch) {
                let t = current.trimmingCharacters(in: .whitespaces)
                if !t.isEmpty { segments.append(t) }
                current = ""; i += 1; continue
            }
            current.append(ch); i += 1
        }
        let t = current.trimmingCharacters(in: .whitespaces)
        if !t.isEmpty { segments.append(t) }
        return (segments, subs)
    }
}

/// One shell segment as words, quotes grouped and redirections dropped (`> out.txt`, `2>/dev/null`, `< in`).
enum ShellSegment {
    static func words(_ segment: String) -> [String] {
        var out: [String] = []
        var skipNext = false
        for w in ConsentPolicy.shellWords(segment) {
            if skipNext { skipNext = false; continue }
            if w.range(of: #"^[0-9]*(?:>>?|<)$"#, options: .regularExpression) != nil { skipNext = true; continue }
            if w.range(of: #"^[0-9]*(?:>>?|<)."#, options: .regularExpression) != nil { continue }
            out.append(w)
        }
        return out
    }
}
