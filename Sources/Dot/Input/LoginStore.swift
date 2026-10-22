import Foundation
import DotKit

/// His password store (gopass), read inside Dot's own process: names to match a page, one password at the moment of a
/// login. Nothing it reads is logged, and a job's own Bash can't reach the store (JobGate.atlasBash, 10-22).
/// The bench reads a fixture instead (DOT_LOGIN_STORE, honoured only there), so a bench run never touches the store.
enum LoginStore {
    static let gopass = "/opt/homebrew/bin/gopass"
    static var mapPath: String { NSHomeDirectory() + "/Dot/jobs/logins.json" }

    struct Bench { let names: [String]; let map: [String: [String]]; let secrets: [String: String] }

    static func bench() -> Bench? {
        guard let path = ProcessInfo.processInfo.environment["DOT_LOGIN_STORE"], let data = FileManager.default.contents(atPath: path),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return Bench(names: json["names"] as? [String] ?? [], map: json["map"] as? [String: [String]] ?? [:],
                     secrets: json["secrets"] as? [String: String] ?? [:])
    }

    static func names(bench: Bool) async -> [String] {
        if bench { return Self.bench()?.names ?? [] }
        let (code, out) = await run(["ls", "--flat"])
        guard code == 0 else { return [] }
        return out.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    static func map(bench: Bool) -> [String: [String]] {
        bench ? (Self.bench()?.map ?? [:]) : Logins.loadMap(mapPath)
    }

    enum Read: Equatable { case password(String), empty, unreadable }

    /// One login's password, the entry's first line. Only a login-shaped name is ever asked for. An entry saved with no
    /// password (10-22: Enter at gopass insert's prompt left jobs/<firm> empty) is `.empty`, so he hears what to fix.
    static func password(_ name: String, bench: Bool) async -> Read {
        guard Logins.entry(name) != nil else { return .unreadable }
        if bench { return Self.bench()?.secrets[name].map { $0.isEmpty ? .empty : .password($0) } ?? .unreadable }
        let (code, out) = await run(["show", "-n", "--", name])
        guard code == 0 else { return .unreadable }
        let first = out.split(separator: "\n", omittingEmptySubsequences: false).first.map(String.init) ?? ""
        return first.isEmpty ? .empty : .password(first)
    }

    /// gopass with no shell, no terminal and no prompt: stdin from /dev/null, GPG_TTY dropped, stderr thrown away (it can
    /// name the entry, never the secret, but nothing needs it), a 20 s deadline.
    nonisolated static func run(_ args: [String], timeout: TimeInterval = 20) async -> (code: Int32, out: String) {
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                let p = Process()
                p.executableURL = URL(fileURLWithPath: gopass)
                p.arguments = args
                var env = ProcessInfo.processInfo.environment
                env.removeValue(forKey: "GPG_TTY")
                // launchd starts Dot with /usr/bin:/bin:/usr/sbin:/sbin, and gopass finds gpg on PATH.
                env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:" + (env["PATH"] ?? "/usr/bin:/bin:/usr/sbin:/sbin")
                env["PINENTRY_USER_DATA"] = "USE_CURSES=0"
                env["GOPASS_NO_NOTIFY"] = "true"
                p.environment = env
                let out = Pipe()
                p.standardOutput = out
                p.standardError = FileHandle.nullDevice
                p.standardInput = FileHandle.nullDevice
                do { try p.run() } catch { continuation.resume(returning: (-1, "")); return }
                var data = Data()
                let reader = DispatchWorkItem { data = out.fileHandleForReading.readDataToEndOfFile() }
                DispatchQueue.global(qos: .userInitiated).async(execute: reader)
                let deadline = Date().addingTimeInterval(timeout)
                while p.isRunning, Date() < deadline { Thread.sleep(forTimeInterval: 0.05) }
                if p.isRunning { p.terminate(); continuation.resume(returning: (-2, "")); return }
                reader.wait()
                continuation.resume(returning: (p.terminationStatus, String(data: data, encoding: .utf8) ?? ""))
            }
        }
    }
}
