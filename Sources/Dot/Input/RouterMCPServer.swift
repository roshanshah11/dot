import DotKit
import Foundation

/// `Dot --router-mcp --server <name> --spec <file> [--deny a,b] [--after s]`: the tool router (IN-03) for one MCP server,
/// seen by Claude Code under that server's own name. RouterCore decides; this owns the real server's process, the pipes
/// and the clock. Nothing but JSON-RPC goes to stdout; notes go to stderr. It exits when stdin closes, and the real
/// server goes with it.
enum RouterMCPServer {
    static let queue = DispatchQueue(label: "dot.router")
    nonisolated(unsafe) static var core: RouterCore!
    nonisolated(unsafe) static var entry: [String: Any] = [:]
    nonisolated(unsafe) static var server = ""
    nonisolated(unsafe) static var cacheFile: URL?
    nonisolated(unsafe) static var child: Process?
    nonisolated(unsafe) static var childIn: FileHandle?
    nonisolated(unsafe) static var generation = 0
    nonisolated(unsafe) static var starts = 0

    static var cacheDir: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("Dot/router", isDirectory: true)
    }

    static func run(_ arguments: [String]) -> Never {
        func value(_ flag: String) -> String? {
            guard let i = arguments.firstIndex(of: flag), i + 1 < arguments.count else { return nil }
            return arguments[i + 1]
        }
        signal(SIGPIPE, SIG_IGN)
        server = value("--server") ?? ""
        guard !server.isEmpty, let specPath = value("--spec"), let data = FileManager.default.contents(atPath: specPath),
              let found = RouterConfig.entry(data, server: server) else {
            note("usage: Dot --router-mcp --server <name> --spec <file>; no entry for '\(server)' in \(value("--spec") ?? "no spec")")
            exit(2)
        }
        entry = found
        let denied = Set((value("--deny") ?? "").split(separator: ",").map(String.init))
        let after = value("--after").flatMap(Double.init) ?? 20
        let cache = cacheDir.appendingPathComponent(RouterConfig.cacheKey(server: server, entry: entry) + ".json")
        cacheFile = cache
        var cached: String?
        if let modified = (try? FileManager.default.attributesOfItem(atPath: cache.path))?[.modificationDate] as? Date,
           Date().timeIntervalSince(modified) < 7 * 86400 {
            cached = try? String(contentsOf: cache, encoding: .utf8)
        }
        core = RouterCore(server: server, handleAfter: after, denied: denied, cachedToolList: cached)
        note("up (handle after \(Int(after)) s\(denied.isEmpty ? "" : ", \(denied.count) denied")\(cached == nil ? "" : ", tool list from cache"))")
        let reader = Thread {
            while let line = readLine(strippingNewline: true) {
                guard !line.trimmingCharacters(in: .whitespaces).isEmpty else { continue }
                queue.async { apply(core.clientMessage(line)) }
            }
            queue.sync { stopChild() }
            exit(0)
        }
        reader.start()
        dispatchMain()
    }

    /// Runs on `queue`.
    static func apply(_ actions: [RouterCore.Action]) {
        for action in actions {
            switch action {
            case .toClient(let line):
                FileHandle.standardOutput.write(Data((line + "\n").utf8))
            case .toChild(let line):
                guard let childIn else { continue }
                do { try childIn.write(contentsOf: Data((line + "\n").utf8)) } catch { note("write to \(server) failed: \(error)") }
            case .startChild:
                startChild()
            case .startTimer(let id, let seconds):
                queue.asyncAfter(deadline: .now() + seconds) { apply(core.timerFired(id: id)) }
            case .saveToolList(let list):
                guard let cacheFile else { continue }
                try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
                try? list.write(to: cacheFile, atomically: true, encoding: .utf8)
            }
            if case .toClient(let line) = action, line.contains("its handle is h") { note("a call ran past its time and became a handle") }
        }
    }

    /// Runs on `queue`.
    static func startChild() {
        generation += 1
        let mine = generation
        starts += 1
        let command = entry["command"] as? String ?? ""
        let args = (entry["args"] as? [Any] ?? []).map { "\($0)" }
        let p = Process()
        if command.contains("/") {
            p.executableURL = URL(fileURLWithPath: (command as NSString).expandingTildeInPath)
            p.arguments = args
        } else {
            p.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            p.arguments = [command] + args
        }
        var env = ProcessInfo.processInfo.environment
        for (k, v) in entry["env"] as? [String: Any] ?? [:] { env[k] = "\(v)" }
        p.environment = env
        if let cwd = entry["cwd"] as? String { p.currentDirectoryURL = URL(fileURLWithPath: (cwd as NSString).expandingTildeInPath) }
        let stdin = Pipe(), stdout = Pipe(), stderr = Pipe()
        p.standardInput = stdin
        p.standardOutput = stdout
        p.standardError = stderr
        var buffer = Data()
        stdout.fileHandleForReading.readabilityHandler = { h in
            let chunk = h.availableData
            guard !chunk.isEmpty else { h.readabilityHandler = nil; return }
            buffer.append(chunk)
            while let nl = buffer.firstIndex(of: 0x0A) {
                let lineData = buffer[buffer.startIndex..<nl]
                buffer.removeSubrange(buffer.startIndex...nl)
                guard let line = String(data: lineData, encoding: .utf8), !line.trimmingCharacters(in: .whitespaces).isEmpty else { continue }
                queue.async { if mine == generation { apply(core.childMessage(line)) } }
            }
        }
        stderr.fileHandleForReading.readabilityHandler = { h in
            let chunk = h.availableData
            guard !chunk.isEmpty else { h.readabilityHandler = nil; return }
            FileHandle.standardError.write(chunk)
        }
        p.terminationHandler = { proc in
            queue.async {
                guard mine == generation else { return }
                note("\(server) exited (\(proc.terminationStatus)); the next call starts it again")
                child = nil
                childIn = nil
                generation += 1
                apply(core.childExited())
            }
        }
        do {
            try p.run()
            child = p
            childIn = stdin.fileHandleForWriting
            note("started \(server) (pid \(p.processIdentifier)\(starts > 1 ? ", start \(starts)" : ""))")
        } catch {
            note("couldn't start \(server): \(error)")
            child = nil
            childIn = nil
            queue.async { apply(core.childExited()) }
        }
    }

    /// Runs on `queue`.
    static func stopChild() {
        guard let p = child, p.isRunning else { return }
        generation += 1
        try? childIn?.close()
        p.terminate()
        let deadline = Date().addingTimeInterval(2)
        while p.isRunning && Date() < deadline { usleep(50_000) }
        if p.isRunning { kill(p.processIdentifier, SIGKILL) }
    }

    static func note(_ text: String) {
        FileHandle.standardError.write(Data("dot router[\(server)]: \(text)\n".utf8))
    }
}

extension RouterMCPServer {
    /// `mcp` with its stdio servers routed (IN-03), written to `file` for Claude Code's `--mcp-config`; the real entries
    /// go to `<file>.spec.json` beside it, readable by him only. nil when the config can't be read (the caller keeps the
    /// direct config).
    static func writeRouted(_ mcp: Data, to file: URL, deny: [String]) -> [String]? {
        let exe = Bundle.main.executablePath ?? CommandLine.arguments[0]
        let spec = file.deletingPathExtension().appendingPathExtension("spec.json")
        guard let wrapped = RouterConfig.wrap(mcp, executable: exe, specPath: spec.path, deny: deny) else { return nil }
        do {
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            try wrapped.spec.write(to: spec)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: spec.path)
            try wrapped.config.write(to: file)
        } catch {
            Log.warn("router: couldn't write \(file.lastPathComponent): \(error)")
            return nil
        }
        return wrapped.routed
    }
}
