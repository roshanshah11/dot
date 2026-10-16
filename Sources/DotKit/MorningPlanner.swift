import Foundation

/// One thing Dot could take on today, from Atlas's view of the day: the line he sees on the
/// morning card and the brief an agent gets when he says "do it".
public struct MorningSuggestion: Equatable {
    public let key: String
    public let text: String
    public let brief: String
    public init(key: String, text: String, brief: String) { self.key = key; self.text = text; self.brief = brief }
}

/// Turns the day (deadlines, calls, mail waiting, commitments) into a few offers, after
/// HeyClicky's morning card ("I can do 7 things for you today"). Pure: what to offer is decided
/// here and tested; when and whether to show it is the app's call.
public enum MorningPlanner {
    public static func suggestions(deadlines: [String], today: [String], unanswered: [String], commitments: [String],
                                   date: Date = Date(), declined: Set<String> = [], limit: Int = 5) -> [MorningSuggestion] {
        var out: [MorningSuggestion] = []
        func add(_ s: MorningSuggestion) {
            guard !declined.contains(s.key), !out.contains(where: { $0.key == s.key }) else { return }
            out.append(s)
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let start = Calendar.current.startOfDay(for: date)
        let soon = Calendar.current.date(byAdding: .day, value: 2, to: start) ?? start

        // Deadlines in the next two days: prepare what can be prepared, never submit.
        for line in deadlines {
            guard line.count > 11, let due = formatter.date(from: String(line.prefix(10))), due >= start, due <= soon else { continue }
            let rest = String(line.dropFirst(10)).trimmingCharacters(in: .whitespaces)
            let short = String((rest.split(separator: ":").first.map(String.init) ?? rest).prefix(70)).lowercased()
            let when = Calendar.current.isDate(due, inSameDayAs: start) ? "today" : (Calendar.current.isDate(due, inSameDayAs: Calendar.current.date(byAdding: .day, value: 1, to: start) ?? start) ? "tomorrow" : String(line.prefix(10)))
            add(MorningSuggestion(key: "deadline:" + String(rest.prefix(48)).lowercased(),
                                  text: "prep \(short), due \(when)",
                                  brief: "prepare what this deadline needs, due \(String(line.prefix(10))): \(rest). make the deliverable (a draft, the filled answers, or a checklist of what is still missing) in the output folder. nothing gets submitted or sent."))
        }

        // A call, interview or coffee chat on the calendar with a person in it: a brief before it.
        let callWords = try! NSRegularExpression(pattern: #"(?i)\b(call|interview|coffee chat|chat with|meeting with|1:1|zoom|info session)\b"#)
        let timePattern = try! NSRegularExpression(pattern: #"^\w{3} \d{2}-\d{2} (\d{1,2}:\d{2})[–-]\d{1,2}:\d{2} (.+)$"#)
        for line in today {
            let ns = line as NSString
            guard let m = timePattern.firstMatch(in: line, range: NSRange(location: 0, length: ns.length)) else { continue }
            var title = ns.substring(with: m.range(at: 2))
            if let paren = title.range(of: " (at ") { title = String(title[..<paren.lowerBound]) }
            guard callWords.firstMatch(in: title, range: NSRange(location: 0, length: (title as NSString).length)) != nil else { continue }
            let time = ns.substring(with: m.range(at: 1))
            let who = title.replacingOccurrences(of: #"(?i)^(call|interview|coffee chat|chat|meeting)[: ]+(with )?"#, with: "", options: .regularExpression)
            add(MorningSuggestion(key: "brief:" + String(title.prefix(48)).lowercased(),
                                  text: "a one-page brief on \(String(who.prefix(50)).lowercased()) before \(time)",
                                  brief: "today at \(time) roshan has: \(title). research the person and the firm (public sources, atlas's notes on them) and write a one-page brief: who they are, what the firm does, three talking points and three questions to ask. save it as a pdf in the output folder."))
        }

        // Mail waiting on him: a draft he can send himself.
        for line in unanswered.prefix(3) {
            let parts = line.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            let sender = parts.first ?? line
            let subject = parts.count > 1 ? parts[1].replacingOccurrences(of: #"\s*\(\w{3} \d{2}-\d{2} \d{1,2}\)$"#, with: "", options: .regularExpression) : ""
            let senderShort = sender.split(separator: "@").first.map(String.init) ?? sender
            add(MorningSuggestion(key: "reply:" + String(line.prefix(48)).lowercased(),
                                  text: "draft a reply to \(senderShort)\(subject.isEmpty ? "" : ": " + String(subject.prefix(44)))",
                                  brief: "draft a reply to this email, waiting on roshan: \(line). use the roshan-email skill for the voice, keep it short, leave it as a draft in the right mailbox (outlook for uchicago mail, gmail otherwise). never send."))
        }

        // Open commitments: the message or document, ready for him to send.
        for line in commitments.prefix(2) {
            let short = String(line.prefix(90)).replacingOccurrences(of: #"\s*\(.*$"#, with: "", options: .regularExpression).lowercased()
            add(MorningSuggestion(key: "commit:" + String(line.prefix(48)).lowercased(),
                                  text: "do: \(short)",
                                  brief: "roshan committed to this: \(line). prepare it (the message in his voice, or the document) and leave it in the output folder for him to send."))
        }
        return Array(out.prefix(limit))
    }

    public static func greeting(count: Int, hour: Int) -> String {
        let opener = hour < 12 ? "morning" : (hour < 17 ? "afternoon" : "evening")
        return "\(opener). i can do \(count) thing\(count == 1 ? "" : "s") for you today."
    }
}
