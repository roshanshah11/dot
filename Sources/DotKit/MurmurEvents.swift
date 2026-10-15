import Foundation

/// Murmur's log is one JSON object per line with a `state` field; Dot mirrors the ones that
/// change what the notch should show, so one notch carries both apps.
public enum MurmurEvent: Equatable {
    case recordingStarted(at: Date)
    case recordingStopped(at: Date)
    case transcribing(recordedSeconds: Int, at: Date)
    case pasted(chars: Int, app: String, at: Date)
    case notice(String, at: Date)
    case idle(at: Date)
    case launched(at: Date)

    public var at: Date {
        switch self {
        case .recordingStarted(let d), .recordingStopped(let d), .idle(let d), .launched(let d): return d
        case .transcribing(_, let d), .pasted(_, _, let d), .notice(_, let d): return d
        }
    }
}

public enum MurmurEvents {
    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let plain = ISO8601DateFormatter()

    public static func parse(line: String) -> MurmurEvent? {
        guard let data = line.data(using: .utf8), let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let state = object["state"] as? String else { return nil }
        let stamp = object["ts"] as? String ?? ""
        let at = iso.date(from: stamp) ?? plain.date(from: stamp) ?? Date()
        switch state {
        case "recording_started": return .recordingStarted(at: at)
        case "recording_stopped": return .recordingStopped(at: at)
        case "pipeline_started":
            let ms = Int((object["recorded_ms"] as? String) ?? "") ?? (object["recorded_ms"] as? Int) ?? 0
            return .transcribing(recordedSeconds: ms / 1000, at: at)
        case "paste_dispatched":
            let chars = Int((object["chars"] as? String) ?? "") ?? (object["chars"] as? Int) ?? 0
            return .pasted(chars: chars, app: (object["target_app"] as? String) ?? "", at: at)
        case "notify":
            guard let body = object["body"] as? String, !body.isEmpty else { return nil }
            return .notice(body, at: at)
        case "state_transition":
            return (object["to"] as? String) == "idle" ? .idle(at: at) : nil
        case "launched": return .launched(at: at)
        default: return nil
        }
    }

    /// Murmur's log file for a day, as it names them (local date).
    public static func logName(for date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        return "murmur-\(f.string(from: date)).log"
    }

    /// "1:23" or "1:02:03".
    public static func clock(_ seconds: Int) -> String {
        let s = max(seconds, 0)
        return s >= 3600 ? String(format: "%d:%02d:%02d", s / 3600, s % 3600 / 60, s % 60) : String(format: "%d:%02d", s / 60, s % 60)
    }

    /// The notice as Dot says it: Murmur's "Pasted into Terminal" and "Copied to clipboard — empty text".
    public static func line(forNotice body: String) -> String {
        let lower = body.lowercased()
        if lower.hasPrefix("pasted into") { return "murmur " + lower }
        if lower.contains("empty") { return "murmur heard nothing" }
        if lower.hasPrefix("copied to clipboard") { return "murmur put it on your clipboard, press command v" }
        return "murmur: " + lower
    }
}
