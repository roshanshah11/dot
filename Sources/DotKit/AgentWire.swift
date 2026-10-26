import Foundation

/// Agents from outside Dot (parity AG-19): `Dot --agent-start | --agent-status | --agent-list | --agent-tell | --agent-note`
/// talk to the running Dot over its control socket, so Atlas, a script or another agent can start one and read where it
/// stands without the notch.
public enum AgentCommand: Equatable {
    /// `quiet`: the result lands in its thread with no chime and no voice, like a routine's (a start from Atlas in the
    /// background, or a test).
    case start(name: String, brief: String, quiet: Bool = false)
    case status(name: String?)
    case list
    case tell(name: String, message: String, quiet: Bool = false)
    case note(from: String, to: String, text: String)

    public static let flags = ["--agent-start", "--agent-status", "--agent-list", "--agent-tell", "--agent-note"]

    /// The words after the flag (with `--json` already taken out).
    public static func parse(flag: String, _ args: [String]) -> Result<AgentCommand, Usage> {
        let quiet = args.contains("--quiet")
        let words = args.filter { $0 != "--json" && $0 != "--quiet" }
        func rest(_ from: Int) -> String { words.dropFirst(from).joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines) }
        switch flag {
        case "--agent-start":
            guard words.count >= 2, !words[0].isEmpty, !rest(1).isEmpty else { return .failure(.init(flag)) }
            return .success(.start(name: words[0], brief: rest(1), quiet: quiet))
        case "--agent-status":
            return .success(.status(name: words.first.flatMap { $0.isEmpty ? nil : $0 }))
        case "--agent-list":
            return .success(.list)
        case "--agent-tell":
            guard words.count >= 2, !rest(1).isEmpty else { return .failure(.init(flag)) }
            return .success(.tell(name: words[0], message: rest(1), quiet: quiet))
        case "--agent-note":
            // --agent-note <to> "<text>" [--from <name>]
            var w = words
            var from = "him"
            if let i = w.firstIndex(of: "--from"), i + 1 < w.count { from = w[i + 1]; w.removeSubrange(i...(i + 1)) }
            guard w.count >= 2 else { return .failure(.init(flag)) }
            let text = w.dropFirst().joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return .failure(.init(flag)) }
            return .success(.note(from: from, to: w[0], text: text))
        default:
            return .failure(.init(flag))
        }
    }

    public struct Usage: Error, Equatable, CustomStringConvertible {
        public let flag: String
        init(_ flag: String) { self.flag = flag }
        public var description: String {
            switch flag {
            case "--agent-start": return "usage: Dot --agent-start <name> \"<brief>\" [--quiet] [--json]"
            case "--agent-status": return "usage: Dot --agent-status [name] [--json]"
            case "--agent-list": return "usage: Dot --agent-list [--json]"
            case "--agent-tell": return "usage: Dot --agent-tell <name> \"<message>\" [--quiet] [--json]"
            default: return "usage: Dot --agent-note <to> \"<text>\" [--from <name>] [--json]"
            }
        }
    }

    /// The control socket request.
    public var request: [String: Any] {
        switch self {
        case .start(let name, let brief, let quiet): return ["verb": "agent", "do": "start", "name": name, "text": brief, "quiet": quiet]
        case .status(let name): return ["verb": "agent", "do": "status", "name": name ?? ""]
        case .list: return ["verb": "agent", "do": "list"]
        case .tell(let name, let message, let quiet): return ["verb": "agent", "do": "tell", "name": name, "text": message, "quiet": quiet]
        case .note(let from, let to, let text): return ["verb": "agent", "do": "note", "from": from, "name": to, "text": text]
        }
    }

    /// A request back into a command (the running Dot's side).
    public static func from(request r: [String: Any]) -> AgentCommand? {
        let name = (r["name"] as? String ?? "").trimmingCharacters(in: .whitespaces)
        let text = (r["text"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let quiet = r["quiet"] as? Bool ?? false
        switch r["do"] as? String {
        case "start": return name.isEmpty || text.isEmpty ? nil : .start(name: name, brief: text, quiet: quiet)
        case "status": return .status(name: name.isEmpty ? nil : name)
        case "list": return .list
        case "tell": return name.isEmpty || text.isEmpty ? nil : .tell(name: name, message: text, quiet: quiet)
        case "note": return name.isEmpty || text.isEmpty ? nil : .note(from: (r["from"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "him", to: name, text: text)
        default: return nil
        }
    }
}

/// Where an agent stands, for `--agent-status` and `--agent-list` (and Atlas through them).
public struct AgentStatus: Codable, Equatable {
    public enum State: String, Codable { case working, waiting, idle, finished }
    public var name: String
    public var slug: String
    public var state: State
    /// What it is doing or last did.
    public var lastStep: String
    /// What comes next: the card it waits on, or its next routine run.
    public var next: String?
    /// Its newest output files, newest first.
    public var files: [String]
    public var spendTodayUSD: Double
    public var startedAt: Date?
    public var finishedAt: Date?
    /// The first sentence of its last report.
    public var result: String?
    public var notesWaiting: Int

    public init(name: String, slug: String, state: State, lastStep: String, next: String? = nil, files: [String] = [], spendTodayUSD: Double = 0,
                startedAt: Date? = nil, finishedAt: Date? = nil, result: String? = nil, notesWaiting: Int = 0) {
        self.name = name; self.slug = slug; self.state = state; self.lastStep = lastStep; self.next = next; self.files = files
        self.spendTodayUSD = spendTodayUSD; self.startedAt = startedAt; self.finishedAt = finishedAt; self.result = result; self.notesWaiting = notesWaiting
    }

    /// One plain line per agent.
    public var line: String {
        var s = "\(name) (\(slug)): \(state.rawValue)"
        if !lastStep.isEmpty { s += ", \(lastStep)" }
        if let next { s += "; next: \(next)" }
        if let result, state != .working { s += "; last report: \(result)" }
        if !files.isEmpty { s += "; files: \(files.prefix(3).joined(separator: ", "))" }
        if spendTodayUSD > 0 { s += String(format: "; $%.2f today", spendTodayUSD) }
        if notesWaiting > 0 { s += "; \(notesWaiting) note\(notesWaiting == 1 ? "" : "s") waiting" }
        return s
    }

    public static func json(_ rows: [AgentStatus]) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return (try? encoder.encode(rows)).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
    }

    public static func decode(_ any: Any?) -> [AgentStatus] {
        guard let any, JSONSerialization.isValidJSONObject(any), let data = try? JSONSerialization.data(withJSONObject: any) else { return [] }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([AgentStatus].self, from: data)) ?? []
    }

    /// The rows as plain JSON objects for the control socket.
    public static func wire(_ rows: [AgentStatus]) -> Any {
        (try? JSONSerialization.jsonObject(with: Data(json(rows).utf8))) ?? []
    }
}

/// Notes between agents (parity AG-18): one agent leaves another a note. A working agent gets it at its next step as a
/// message; an idle one finds it at the top of its next turn. Every note is kept in the receiver's notes.md, dated and
/// signed, and both threads show it.
public struct AgentNote: Codable, Equatable {
    public var from: String
    public var to: String
    public var text: String
    public var at: Date

    public init(from: String, to: String, text: String, at: Date = Date()) {
        self.from = from; self.to = to; self.text = text; self.at = at
    }

    public static let maxText = 4000

    /// The entry appended to the receiver's notes.md.
    public func markdown(calendar: Calendar = .current) -> String {
        let f = DateFormatter()
        f.calendar = calendar
        f.timeZone = calendar.timeZone
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd HH:mm"
        return "## \(f.string(from: at)) from \(from)\n\n\(text)\n\n"
    }

    /// The message a working agent gets at its next step.
    public var message: String { "[note from \(from)] \(text)\n(a note, not an ask from him: use it in the work you're doing; answer with note_to if it asks you something)" }

    /// What an idle agent's next turn opens with.
    public static func block(_ notes: [AgentNote]) -> String? {
        guard !notes.isEmpty else { return nil }
        return "[notes] left for you since your last turn:\n" + notes.map { "- from \($0.from): \($0.text)" }.joined(separator: "\n")
    }

    public enum Delivery: Equatable { case now, nextTurn, refused(String) }

    /// Now when the receiver is working, else at its next turn; never to itself or to nobody.
    public static func delivery(from: String, to: String, exists: Bool, working: Bool, text: String) -> Delivery {
        if !exists { return .refused("no agent named \(to)") }
        if from.lowercased() == to.lowercased() { return .refused("a note to itself") }
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return .refused("an empty note") }
        if text.count > maxText { return .refused("over \(maxText) characters: put it in a file in your output/ and send its path") }
        return working ? .now : .nextTurn
    }
}

/// Routines while the Mac sleeps (parity AG-22): a wake two minutes before each routine's next run, through
/// `sudo -n /usr/bin/pmset schedule wake` (his sudoers rule for pmset only). Dot keeps the wakes it asked for, so it
/// adds only new ones and cancels the ones whose routine moved or went away.
public enum WakePlan {
    public static let lead: TimeInterval = 120
    public static let horizon: TimeInterval = 7 * 86400

    /// pmset's date format ("10/27/26 06:58:00"), in local time.
    public static func pmsetDate(_ date: Date, timeZone: TimeZone = .current) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = timeZone
        f.dateFormat = "MM/dd/yy HH:mm:ss"
        return f.string(from: date)
    }

    /// The wakes the routines need: two minutes before each next run, later than a minute from now, inside a week,
    /// two within five minutes kept as one, whole seconds.
    public static func wakes(nextRuns: [Date], now: Date) -> [Date] {
        let raw = nextRuns.map { $0.addingTimeInterval(-lead) }
            .filter { $0.timeIntervalSince(now) > 60 && $0.timeIntervalSince(now) < horizon }
            .map { Date(timeIntervalSince1970: floor($0.timeIntervalSince1970)) }
            .sorted()
        var out: [Date] = []
        for d in raw where out.last.map({ d.timeIntervalSince($0) >= 300 }) ?? true { out.append(d) }
        return out
    }

    /// What to ask pmset for: wakes to add, and Dot's own earlier wakes to cancel (past ones are gone already).
    public static func changes(wanted: [Date], scheduled: [Date], now: Date) -> (add: [Date], cancel: [Date]) {
        let live = scheduled.filter { $0 > now }
        let add = wanted.filter { w in !live.contains { abs($0.timeIntervalSince(w)) < 1 } }
        let cancel = live.filter { s in !wanted.contains { abs($0.timeIntervalSince(s)) < 1 } }
        return (add, cancel)
    }

    /// A routine run that should have happened while the Mac was asleep: due before now, by more than the scheduler's
    /// minute tick. It runs once at wake and says it is late.
    public static func isLate(due: Date, now: Date) -> Bool { now.timeIntervalSince(due) > 150 }

    /// The events `pmset -g sched` lists (" [0]  wake at 10/26/2026 06:52:20 by 'Dot'"): type, time, owner.
    public static func scheduled(pmsetOutput: String, timeZone: TimeZone = .current) -> [(type: String, at: Date, owner: String)] {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = timeZone
        f.dateFormat = "MM/dd/yyyy HH:mm:ss"
        let re = try! NSRegularExpression(pattern: #"^\s*\[\d+\]\s+(\w+) at (\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2})(?: by '([^']*)')?"#)
        return pmsetOutput.split(whereSeparator: \.isNewline).compactMap { raw in
            let line = String(raw)
            guard let m = re.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)),
                  let type = Range(m.range(at: 1), in: line), let when = Range(m.range(at: 2), in: line),
                  let at = f.date(from: String(line[when])) else { return nil }
            let owner = Range(m.range(at: 3), in: line).map { String(line[$0]) } ?? ""
            return (String(line[type]), at, owner)
        }
    }

    /// What Home says under the routines: nil with no active routines.
    public static func homeLine(ruleInstalled: Bool, activeRoutines: Int, overnight: Bool) -> String? {
        guard activeRoutines > 0 else { return nil }
        guard ruleInstalled else {
            return "Routines wait while the Mac sleeps: one due then runs once when it wakes, marked late. To wake the Mac for them, install the wake rule (one sudo rule, pmset only)."
        }
        // A shut lid sleeps the Mac whatever an app asks (IOPMLib: idle-sleep assertions don't hold against a lid close or
        // in dark wake); seen 2026-10-26, a lid-shut Mac on power froze an agent's turn for 16 minutes of maintenance sleep.
        return "Dot wakes the Mac two minutes before each routine." + (overnight ? " For overnight ones keep the lid open and the Mac plugged in: with the lid shut it falls back asleep before a routine can finish." : "")
    }

    /// An overnight run: between 11 pm and 7 am.
    public static func isOvernight(_ date: Date, calendar: Calendar = .current) -> Bool {
        let hour = calendar.component(.hour, from: date)
        return hour >= 23 || hour < 7
    }

    /// The command he runs once: check the rule's syntax, then install it root-owned and read-only.
    public static func installCommand(ruleFile: String) -> String {
        "sudo visudo -cf \(ruleFile) && sudo install -m 0440 -o root -g wheel \(ruleFile) /etc/sudoers.d/dot-pmset"
    }

    /// The sudoers rule he installs once (the only command it allows is /usr/bin/pmset).
    public static func sudoersRule(user: String) -> String {
        "# Dot's routines wake the Mac before they run (parity AG-22). Only /usr/bin/pmset, nothing else.\n\(user) ALL=(root) NOPASSWD: /usr/bin/pmset schedule wake *, /usr/bin/pmset schedule cancel wake *\n"
    }
}

/// `Dot --agent-mcp --agent <slug>`: the stdio MCP server every agent sees as `dot-agents` (AG-18, AG-14). Kept apart
/// from a job's `dot` server (its page tools), which agents never get. It answers initialize, tools/list and ping
/// itself and relays each call to the running Dot (control verb `agent-tool`).
public enum AgentMCPWire {
    public static let server = "dot-agents"

    public static let tools: [(String, String, [String: Any])] = [
        ("note_to", "Leave another of Dot's agents a note: a fact it needs, a file you made for it (send the path), or a question. "
            + "It gets the note at its next step if it is working, else at the top of its next turn; the note is kept in its notes.md. "
            + "Not for him: your report is how you talk to him.",
         HandsMCPWire.schema(["agent": HandsMCPWire.str, "text": HandsMCPWire.str], required: ["agent", "text"])),
        ("list_agents", "Dot's agents: each one's name, what it is doing now and its last report, so you know who to note.",
         HandsMCPWire.schema([:])),
        ("make_image", "Make a picture with an image model and save it as a PNG in your output/ folder: a thumbnail, a diagram or "
            + "an illustration for a deck, a slide picture. Never a real person's face. aspect: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2 or 2:3. "
            + "file: a name for the PNG (optional). Takes up to two minutes.",
         HandsMCPWire.schema(["prompt": HandsMCPWire.str, "aspect": HandsMCPWire.str, "file": HandsMCPWire.str], required: ["prompt"])),
    ]

    public static var toolNames: [String] { tools.map(\.0) }

    public static func toolsList() -> [String: Any] {
        ["tools": tools.map { name, description, schema -> [String: Any] in
            ["name": name, "description": description, "inputSchema": schema, "_meta": ["anthropic/alwaysLoad": true]]
        }]
    }

    public static func localReply(_ request: HandsMCPWire.Request) -> String? {
        guard let id = request.id else { return nil }
        switch request.method {
        case "initialize":
            return HandsMCPWire.response(id: id, result: ["protocolVersion": request.params["protocolVersion"] as? String ?? HandsMCPWire.protocolVersion,
                                                          "capabilities": ["tools": [String: Any]()],
                                                          "serverInfo": ["name": server, "version": "1"]])
        case "tools/list": return HandsMCPWire.response(id: id, result: toolsList())
        case "ping": return HandsMCPWire.response(id: id, result: [:])
        case "tools/call": return nil
        default: return HandsMCPWire.error(id: id, code: -32601, message: "method not found: \(request.method)")
        }
    }

    /// How long the server waits on Dot for each tool.
    public static func timeout(_ tool: String) -> TimeInterval { tool == "make_image" ? 200 : 20 }

    /// The entry added to an agent's MCP config.
    public static func configEntry(executable: String, agent slug: String, socket: String?) -> [String: Any] {
        var entry: [String: Any] = ["type": "stdio", "command": executable, "args": ["--agent-mcp", "--agent", slug]]
        if let socket { entry["env"] = ["DOT_CONTROL_SOCKET": socket] }
        return entry
    }

    /// The agent's MCP config with `dot-agents` added (replacing an older one); nil when the data isn't an MCP config.
    public static func adding(to data: Data?, executable: String, agent slug: String, socket: String?) -> Data? {
        var root: [String: Any] = [:]
        if let data, !data.isEmpty {
            guard let parsed = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return nil }
            root = parsed
        }
        var servers = root["mcpServers"] as? [String: Any] ?? [:]
        servers[server] = configEntry(executable: executable, agent: slug, socket: socket)
        root["mcpServers"] = servers
        return try? JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
    }
}

/// One make_image call (AG-14), checked before any money is spent.
public struct ImageRequest: Equatable {
    public static let aspects = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"]
    public static let maxPrompt = 4000

    public var prompt: String
    public var aspect: String
    /// A bare PNG name inside output/.
    public var file: String

    /// `now` names the file when no name was given.
    public static func make(prompt raw: String, aspect rawAspect: String?, file rawFile: String?, now: Date = Date()) -> Result<ImageRequest, Problem> {
        let prompt = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty else { return .failure(.init("an empty prompt")) }
        guard prompt.count <= maxPrompt else { return .failure(.init("a prompt over \(maxPrompt) characters")) }
        let aspect = (rawAspect ?? "").trimmingCharacters(in: .whitespaces).isEmpty ? "1:1" : rawAspect!.trimmingCharacters(in: .whitespaces)
        guard aspects.contains(aspect) else { return .failure(.init("aspect \(aspect): use one of \(aspects.joined(separator: ", "))")) }
        var file = (rawFile ?? "").trimmingCharacters(in: .whitespaces)
        if file.contains("/") || file.contains("..") || file.hasPrefix(".") { return .failure(.init("file must be a bare name inside output/, not a path")) }
        if file.isEmpty {
            let words = BargeDetector.realWords(prompt).prefix(5).joined(separator: "-")
            let f = DateFormatter()
            f.locale = Locale(identifier: "en_US_POSIX")
            f.dateFormat = "HHmmss"
            file = (words.isEmpty ? "image" : words) + "-" + f.string(from: now)
        }
        file = String(file.map { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" || $0 == "." ? $0 : "-" }).prefix(80).description
        if !file.lowercased().hasSuffix(".png") { file += ".png" }
        return .success(ImageRequest(prompt: prompt, aspect: aspect, file: file))
    }

    public struct Problem: Error, Equatable { public let why: String; public init(_ why: String) { self.why = why } }

    /// OpenRouter's chat completions body for an image-output model.
    public func body(model: String) -> [String: Any] {
        ["model": model,
         "modalities": ["image", "text"],
         "messages": [["role": "user", "content": prompt]],
         "image_config": ["aspect_ratio": aspect]]
    }

    /// The image-output model to use: the first preferred one OpenRouter still lists with image output, else its
    /// newest image model (`models` is /api/v1/models' data).
    public static func pickModel(preferred: [String], models: [[String: Any]]) -> String? {
        let images = models.filter { (($0["architecture"] as? [String: Any])?["output_modalities"] as? [String])?.contains("image") == true }
            .filter { ($0["id"] as? String).map { !$0.hasPrefix("openrouter/") } ?? false }
        let ids = Set(images.compactMap { $0["id"] as? String })
        if let hit = preferred.first(where: ids.contains) { return hit }
        return images.max { ($0["created"] as? Double ?? 0) < ($1["created"] as? Double ?? 0) }?["id"] as? String
    }

    /// The PNG bytes in an OpenRouter reply (`choices[0].message.images[].image_url.url` as data: URLs), or why none.
    public static func images(in reply: [String: Any]) -> Result<[Data], Problem> {
        if let error = reply["error"] as? [String: Any] { return .failure(.init("the image model said: \(error["message"] as? String ?? "an error")")) }
        let message = ((reply["choices"] as? [[String: Any]])?.first?["message"] as? [String: Any]) ?? [:]
        let urls = (message["images"] as? [[String: Any]] ?? []).compactMap { ($0["image_url"] as? [String: Any])?["url"] as? String }
        let pngs = urls.compactMap { url -> Data? in
            guard url.hasPrefix("data:image/"), let comma = url.firstIndex(of: ",") else { return nil }
            return Data(base64Encoded: String(url[url.index(after: comma)...]))
        }
        if pngs.isEmpty {
            let said = (message["content"] as? String).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) } ?? ""
            return .failure(.init(said.isEmpty ? "no image came back" : "no image came back; the model said: \(String(said.prefix(300)))"))
        }
        return .success(pngs)
    }
}

/// A value from a dotenv-style file (`NAME=value` or `export NAME="value"`).
public enum DotEnv {
    public static func value(_ name: String, in text: String) -> String? {
        for raw in text.split(whereSeparator: \.isNewline) {
            var line = raw.trimmingCharacters(in: .whitespaces)
            if line.hasPrefix("export ") { line = String(line.dropFirst(7)).trimmingCharacters(in: .whitespaces) }
            guard line.hasPrefix(name + "=") else { continue }
            let value = line.dropFirst(name.count + 1).trimmingCharacters(in: CharacterSet(charactersIn: "\"' "))
            return value.isEmpty ? nil : value
        }
        return nil
    }
}
