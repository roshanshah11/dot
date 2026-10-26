import AppKit
import ApplicationServices
import AVFoundation
import CoreGraphics
import DotKit
import EventKit

/// The probes behind Settings' permission rows and `Dot --permissions` (parity ON-01, ON-03). Each reads a status
/// without asking: nothing here shows a system prompt. The agent host runs the same probes in its own process.
enum PermissionProbe {
    /// This process's grants as a report (PermissionGuide's keys).
    static func report() -> [String: String] {
        var out: [String: String] = [
            "microphone": PermissionGuide.av(AVCaptureDevice.authorizationStatus(for: .audio).rawValue).rawValue,
            "screen": (CGPreflightScreenCaptureAccess() ? PermissionState.granted : .missing).rawValue,
            "accessibility": (AXIsProcessTrusted() ? PermissionState.granted : .missing).rawValue,
            "calendar": PermissionGuide.calendar(EKEventStore.authorizationStatus(for: .event).rawValue).rawValue,
            "fullDisk": fullDisk().rawValue,
        ]
        for target in PermissionGuide.automationTargets { out["automation:\(target.bundle)"] = automation(target.bundle).rawValue }
        return out
    }

    /// TCC.db opens only with Full Disk Access; opening it reads nothing and asks nothing.
    static func fullDisk() -> PermissionState {
        let path = NSHomeDirectory() + "/Library/Application Support/com.apple.TCC/TCC.db"
        let fd = Darwin.open(path, O_RDONLY)
        if fd >= 0 { close(fd); return .granted }
        return PermissionGuide.fullDisk(errno: errno)
    }

    private static let lock = NSLock()
    private static var inFlight = Set<String>()
    private final class Box: @unchecked Sendable { var state = PermissionState.unknown }

    /// Whether this process may send Apple events to `bundle`, without asking (askUserIfNeeded false). The call waits on
    /// the target, and a running app that doesn't answer holds it for good (Spotify, 2026-10-26), so it runs on its own
    /// thread for at most two seconds, one at a time per app; an app that isn't running can't be asked.
    static func automation(_ bundle: String, timeout: TimeInterval = 2) -> PermissionState {
        guard !NSRunningApplication.runningApplications(withBundleIdentifier: bundle).isEmpty else { return .unknown }
        lock.lock()
        guard inFlight.insert(bundle).inserted else { lock.unlock(); return .unknown }
        lock.unlock()
        let box = Box()
        let done = DispatchSemaphore(value: 0)
        Thread.detachNewThread {
            var target = AEAddressDesc()
            if bundle.withCString({ AECreateDesc(typeApplicationBundleID, $0, strlen($0), &target) }) == noErr {
                box.state = PermissionGuide.automation(AEDeterminePermissionToAutomateTarget(&target, typeWildCard, typeWildCard, false))
                AEDisposeDesc(&target)
            }
            lock.lock()
            inFlight.remove(bundle)
            lock.unlock()
            done.signal()
        }
        return done.wait(timeout: .now() + timeout) == .success ? box.state : .unknown
    }

    /// cua-driver answers for its own daemon; nil when it isn't installed or doesn't answer in five seconds.
    static func cuaDriver() -> (json: [String: Any]?, executable: String) {
        let candidates = [NSHomeDirectory() + "/.local/bin/cua-driver", "/opt/homebrew/bin/cua-driver", "/usr/local/bin/cua-driver"]
        guard let path = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) else { return (nil, "cua-driver (not installed)") }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: path)
        process.arguments = ["permissions", "status", "--json"]
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice
        guard (try? process.run()) != nil else { return (nil, path) }
        let deadline = Date().addingTimeInterval(5)
        while process.isRunning, Date() < deadline { usleep(50_000) }
        if process.isRunning { process.terminate(); return (nil, path) }
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        let executable = ((json?["source"] as? [String: Any])?["executable"] as? String) ?? path
        return (json, executable)
    }

    /// Dot, the agent host and cua-driver, each with what macOS gave it. Slow parts (the host's socket, cua-driver)
    /// run off the main thread; call this from a background queue.
    static func holders() -> [PermissionHolder] {
        let dot = Bundle.main.bundlePath.hasSuffix(".app") ? Bundle.main.bundlePath : (CommandLine.arguments.first ?? "Dot")
        var out = [PermissionHolder(id: "dot", name: "Dot", runs: "talk, dictation, jobs and the tools they start", executable: dot,
                                    rows: PermissionGuide.rows(report()))]
        let host = AgentHostCore.permissions(path: HostProtocol.socketPath())
        out.append(PermissionHolder(id: "host", name: "Agent host", runs: "your named agents (it keeps them running when Dot quits)",
                                    executable: dot + " --host", rows: PermissionGuide.rows(host ?? [:], forAgents: true),
                                    note: host == nil ? "not answering (not running, or installed before this check); rows are unknown" : nil))
        let cua = cuaDriver()
        out.append(PermissionHolder(id: "cua", name: "cua-driver", runs: "an agent's clicks and screenshots in other apps", executable: cua.executable,
                                    rows: PermissionGuide.cuaRows(cua.json), note: cua.json == nil ? "its daemon didn't answer; rows are unknown" : nil))
        return out
    }

    static func openPane(_ pane: String) {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?\(pane)") { NSWorkspace.shared.open(url) }
    }
}
