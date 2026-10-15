import Foundation

/// Murmur is his other recorder: double-tap fn, speak as long as a meeting or a long note
/// takes, double-tap again, and the transcript pastes itself and lands in its history. Dot
/// stays the short-exchange companion; when he asks "what did i say in the meeting" or "my
/// last recording", Dot reads Murmur's history (`~/Library/Application Support/Murmur/history.jsonl`)
/// and answers from it. Read only; Murmur owns the file.
enum MurmurHistory {
    struct Entry {
        let at: Date
        let text: String
        let app: String
        let seconds: Int
    }

    static func entries(file: String, limit: Int = 5) -> [Entry] {
        let path = DotConfig.expand(file)
        guard let data = try? Data(contentsOf: URL(fileURLWithPath: path)), let content = String(data: data, encoding: .utf8) else { return [] }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        var out: [Entry] = []
        for line in content.split(separator: "\n").suffix(400) {
            guard let object = try? JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any],
                  let text = (object["cleaned"] as? String) ?? (object["raw"] as? String), !text.isEmpty else { continue }
            let stamp = object["ts"] as? String ?? ""
            let at = iso.date(from: stamp) ?? plain.date(from: stamp) ?? Date.distantPast
            out.append(Entry(at: at, text: text, app: object["target_app"] as? String ?? "", seconds: ((object["duration_ms"] as? Int) ?? 0) / 1000))
        }
        return Array(out.sorted { $0.at > $1.at }.prefix(limit))
    }

    /// A block for the model: the newest recordings first, long ones trimmed.
    static func block(file: String, limit: Int = 3, maxChars: Int = 7000) -> String? {
        let recent = entries(file: file, limit: limit)
        guard !recent.isEmpty else { return nil }
        let clock = DateFormatter(); clock.dateFormat = "EEE h:mm a"; clock.locale = Locale(identifier: "en_US")
        var lines = ["murmur recordings (his long dictations and meetings, newest first):"]
        var budget = maxChars
        for entry in recent {
            let text = entry.text.count > budget ? String(entry.text.prefix(max(budget, 200))) + "…" : entry.text
            budget -= text.count
            let length = entry.seconds >= 60 ? "\(entry.seconds / 60) min" : "\(entry.seconds) s"
            lines.append("- \(clock.string(from: entry.at)), \(length)\(entry.app.isEmpty ? "" : ", into \(entry.app)"): \"\(text)\"")
            if budget <= 200 { break }
        }
        return lines.joined(separator: "\n")
    }

    static let askWords = try! NSRegularExpression(pattern: #"(?i)\b(murmur|my (?:last |latest |recent )?(?:recording|dictation|transcript)|(?:the |that |my )?meeting (?:transcript|recording|notes)|what (?:did|was) i (?:say|dictate|record)|what was said in (?:the|my) (?:meeting|call|recording))\b"#)

    static func asksAboutRecordings(_ text: String) -> Bool {
        askWords.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) != nil
    }
}
