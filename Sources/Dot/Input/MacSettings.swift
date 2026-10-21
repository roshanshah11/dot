import AppKit
import DotKit
import Foundation

/// Mac settings he names, flipped at once (2026-10-21: "turn on my bluetooth" became a job that failed after 22 s, and
/// the job's open tool sent System Settings' link to Comet). Each one reads the setting back before saying it's done;
/// what can't be switched from here opens its settings pane and says so.
extension Hands {
    func setting(_ s: MacSetting) async -> Outcome {
        switch s {
        case .bluetooth(let on):
            let (code, out) = await Self.run(Bundle.main.executablePath ?? "", ["--bluetooth", on ? "on" : "off"], timeout: 8)
            let state = out.trimmingCharacters(in: .whitespacesAndNewlines)
            if code == 0, state == (on ? "on" : "off") { return Outcome(ok: true, line: s.doneLine, detail: "bluetooth \(state)") }
            Self.openSettings("x-apple.systempreferences:com.apple.BluetoothSettings")
            return Outcome(ok: false, line: "i couldn't switch bluetooth myself, so its settings are open.",
                           detail: "bluetooth helper exit \(code): \(Log.short(state, 80))")
        case .wifi(let on):
            guard let device = await Self.wifiDevice() else {
                Self.openSettings("x-apple.systempreferences:com.apple.wifi-settings-extension")
                return Outcome(ok: false, line: "i couldn't find the wi-fi device, so its settings are open.", detail: "no wi-fi device")
            }
            _ = await Self.run("/usr/sbin/networksetup", ["-setairportpower", device, on ? "on" : "off"], timeout: 8)
            let (_, out) = await Self.run("/usr/sbin/networksetup", ["-getairportpower", device], timeout: 5)
            let isOn = out.lowercased().hasSuffix(": on\n") || out.lowercased().hasSuffix(": on")
            if isOn == on { return Outcome(ok: true, line: s.doneLine, detail: "wifi \(device) \(on ? "on" : "off")") }
            return Outcome(ok: false, line: "wi-fi didn't switch.", detail: "networksetup said \(Log.short(out, 60))")
        case .darkMode(let on):
            let (code, out) = await Self.run("/usr/bin/osascript", ["-e", "tell application \"System Events\" to tell appearance preferences to set dark mode to \(on)",
                                                                   "-e", "tell application \"System Events\" to tell appearance preferences to return dark mode as text"], timeout: 8)
            if code == 0, out.trimmingCharacters(in: .whitespacesAndNewlines) == (on ? "true" : "false") { return Outcome(ok: true, line: s.doneLine, detail: "dark mode \(on)") }
            return Outcome(ok: false, line: "the appearance didn't change; macos may want you to let dot control system events.", detail: "osascript \(code): \(Log.short(out, 80))")
        case .volume(let change):
            let script: String
            switch change {
            case .mute: script = "set volume with output muted"
            case .unmute: script = "set volume without output muted"
            case .set(let n): script = "set volume without output muted\nset volume output volume \(n)"
            case .up: script = "set volume without output muted\nset volume output volume (((output volume of (get volume settings)) + 12) as integer)"
            case .down: script = "set volume output volume (((output volume of (get volume settings)) - 12) as integer)"
            }
            let (code, out) = await Self.run("/usr/bin/osascript", ["-e", script, "-e", "return (output volume of (get volume settings) as text) & \",\" & (output muted of (get volume settings) as text)"], timeout: 5)
            guard code == 0 else { return Outcome(ok: false, line: "the volume didn't change.", detail: "osascript \(code): \(Log.short(out, 80))") }
            return Outcome(ok: true, line: s.doneLine, detail: "volume now \(out.trimmingCharacters(in: .whitespacesAndNewlines))")
        }
    }

    /// The Wi-Fi interface ("en0"), from networksetup's list of ports.
    private static func wifiDevice() async -> String? {
        let (_, out) = await run("/usr/sbin/networksetup", ["-listallhardwareports"], timeout: 5)
        let lines = out.components(separatedBy: "\n")
        for (i, line) in lines.enumerated() where line.contains("Wi-Fi") || line.contains("AirPort") {
            if i + 1 < lines.count, lines[i + 1].hasPrefix("Device: ") { return String(lines[i + 1].dropFirst("Device: ".count)) }
        }
        return nil
    }

    static func openSettings(_ link: String) {
        if let url = URL(string: link) { NSWorkspace.shared.open(url) }
    }

    /// A command's exit code and output, off the main thread, with a deadline.
    nonisolated static func run(_ executable: String, _ args: [String], timeout: TimeInterval) async -> (code: Int32, out: String) {
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                let p = Process()
                p.executableURL = URL(fileURLWithPath: executable)
                p.arguments = args
                let out = Pipe()
                p.standardOutput = out
                p.standardError = out
                do { try p.run() } catch { continuation.resume(returning: (-1, "\(error)")); return }
                let deadline = Date().addingTimeInterval(timeout)
                while p.isRunning, Date() < deadline { Thread.sleep(forTimeInterval: 0.05) }
                if p.isRunning { p.terminate(); continuation.resume(returning: (-2, "timeout")); return }
                let text = String(data: out.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
                continuation.resume(returning: (p.terminationStatus, text))
            }
        }
    }
}
