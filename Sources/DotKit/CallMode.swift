import Foundation

// Call mode (his ask 2026-10-28, "build dot for calls/interviews"): coffee chats and real interviews, taken on the Mac
// so Dot hears both sides. Before the call its prep is pinned in a window; during a chat a live helper shows one fact
// and one follow-up when they name a firm, a deal or a term, ticks the prep off and nudges the close ask; an interview
// is listen-only (no live answers in a real interview or a HireVue). After the call an agent writes the recap or the
// debrief, the lessons, the tracker and a thank-you draft. These are the pure pieces; the window, the ear and the
// sessions are in Sources/Dot/Call.

public enum CallKind: String, Equatable, Sendable { case chat, interview }

/// A call or an interview on his calendar.
public struct CallEvent: Equatable, Sendable {
    public var title: String
    public var start: Date
    public var end: Date
    public var kind: CallKind
    /// "Alex Example"; empty when the title doesn't name one.
    public var person: String
    /// "Northwind Bank"; empty when the title doesn't name one.
    public var firm: String
    /// "+15550100199": the number to dial, when the event has one.
    public var phone: String?
    /// The title or notes say they call him ("calls you"): no dial button.
    public var theyCall: Bool

    public init(title: String, start: Date, end: Date, kind: CallKind, person: String = "", firm: String = "", phone: String? = nil, theyCall: Bool = false) {
        self.title = title; self.start = start; self.end = end; self.kind = kind
        self.person = person; self.firm = firm; self.phone = phone; self.theyCall = theyCall
    }

    /// Who the call is with, for headings and file names: the person, else the firm, else the title.
    public var who: String { !person.isEmpty ? person : (!firm.isEmpty ? firm : title) }
}

public enum CallCalendar {
    /// "Call: Alex Example (Northwind Bank)": what the networking skill puts on his calendar for a set call.
    static let callTitle = try! NSRegularExpression(pattern: #"^\s*call\s*[:\-–]\s*([^()]+?)\s*(?:\(([^)]*)\))?\s*$"#, options: .caseInsensitive)
    /// "Roshan Shah / Alex Example": the Outlook invite he sends.
    static let inviteTitle = try! NSRegularExpression(pattern: #"^\s*roshan(?: shah)?\s*/\s*(.+?)\s*$"#, options: .caseInsensitive)
    /// What makes an event an interview.
    static let interviewWords = try! NSRegularExpression(
        pattern: #"\b(interviews?|superday|super day|first[- ]round|second[- ]round|final[- ]round|hr screen|phone screen|recruiter screen|screening call|hirevue)\b"#,
        options: .caseInsensitive)
    /// A coffee chat by its own name.
    static let chatWords = try! NSRegularExpression(pattern: #"\b(coffee chat|networking call|informational)\b"#, options: .caseInsensitive)
    /// Not a call even with the word in it: prep blocks, practice, a finished assessment, a mock.
    static let notACall = try! NSRegularExpression(
        pattern: #"\b(prep|preparation|practice|mock|assessment|study|review|deadline|due|apply|application|office hours|lecture|class)\b|^\s*done\s*:"#,
        options: .caseInsensitive)
    static let theyCallWords = try! NSRegularExpression(pattern: #"\b(calls? (?:you|me|roshan)|will call|is calling|they call)\b"#, options: .caseInsensitive)
    static let phoneNumber = try! NSRegularExpression(pattern: #"(?<![\d])(?:\+?1[\s.\-]?)?\(?(\d{3})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})(?![\d])"#)
    /// "Casey Example calls you": a capitalized name before "calls".
    static let callerName = try! NSRegularExpression(pattern: #"([A-Z][a-z]+(?:\s+[A-Z][a-z'\-]+){1,2})\s+(?:calls|will call|is calling)"#)

    public static func event(_ item: CalendarItem) -> CallEvent? {
        guard !item.allDay else { return nil }
        let title = item.title.trimmingCharacters(in: .whitespaces)
        let all = title + "\n" + item.location + "\n" + item.notes
        let phone = number(in: title) ?? number(in: item.location) ?? number(in: item.notes)
        let theyCall = matches(theyCallWords, all)
        if let m = callTitle.firstMatch(in: title, range: full(title)) {
            let person = group(m, 1, title)
            return CallEvent(title: title, start: item.start, end: item.end, kind: .chat, person: person, firm: group(m, 2, title), phone: phone, theyCall: theyCall)
        }
        if let m = inviteTitle.firstMatch(in: title, range: full(title)), !matches(notACall, title) {
            return CallEvent(title: title, start: item.start, end: item.end, kind: .chat, person: group(m, 1, title), phone: phone, theyCall: theyCall)
        }
        guard !matches(notACall, title) else { return nil }
        if let m = interviewWords.firstMatch(in: title, range: full(title)) {
            // the firm is what comes before the word: "Northwind Partners interview (2028 summer)" -> "Northwind Partners"
            let before = (title as NSString).substring(to: m.range.location)
            let firm = before.replacingOccurrences(of: #"(?i)\b(phone|video|zoom|teams|virtual|in[- ]person)\s*$"#, with: "", options: .regularExpression)
                .trimmingCharacters(in: CharacterSet(charactersIn: " :-–|,"))
            let caller = callerName.firstMatch(in: all, range: full(all)).map { group($0, 1, all) } ?? ""
            return CallEvent(title: title, start: item.start, end: item.end, kind: .interview, person: caller, firm: firm, phone: phone, theyCall: theyCall)
        }
        if chatWords.firstMatch(in: title, range: full(title)) != nil {
            let name = title.replacingOccurrences(of: #"(?i)\b(coffee chat|networking call|informational)\b\s*(with)?"#, with: "", options: .regularExpression)
                .trimmingCharacters(in: CharacterSet(charactersIn: " :-–|,()"))
            return CallEvent(title: title, start: item.start, end: item.end, kind: .chat, person: name, phone: phone, theyCall: theyCall)
        }
        return nil
    }

    /// The call on now: started, or starting within `early` (the 10-minute card), and not over.
    public static func current(_ items: [CalendarItem], now: Date, early: TimeInterval = 15 * 60) -> CallEvent? {
        items.compactMap(event).filter { $0.start.addingTimeInterval(-early) <= now && now < $0.end }.min { $0.start < $1.start }
    }

    /// The call a meeting card is for. The card's title is the brief's, cut to `TodayBrief.titleLimit` characters, so a
    /// title that long only has to start the calendar's (a whole-title match left a 58-character "<Firm> video interview,
    /// hiring manager (confirmed, Teams)" with a "brief me" card, 10-28); a shorter one is whole and must match exactly.
    public static func current(_ items: [CalendarItem], now: Date, early: TimeInterval = 15 * 60, titled title: String) -> CallEvent? {
        let wanted = title.trimmingCharacters(in: .whitespaces).lowercased()
        guard !wanted.isEmpty else { return nil }
        let clipped = title.count >= TodayBrief.titleLimit
        return items.compactMap(event).filter { call in
            let name = call.title.lowercased()
            return call.start.addingTimeInterval(-early) <= now && now < call.end && (clipped ? name.hasPrefix(wanted) : name == wanted)
        }.min { $0.start < $1.start }
    }

    /// Tomorrow's calls and interviews, in order (the 9 PM prep).
    public static func tomorrow(_ items: [CalendarItem], now: Date, calendar: Calendar = .current) -> [CallEvent] {
        guard let day = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)),
              let next = calendar.date(byAdding: .day, value: 1, to: day) else { return [] }
        return items.compactMap(event).filter { $0.start >= day && $0.start < next }.sorted { $0.start < $1.start }
    }

    /// "+15550100199" from "(555) 010-0199", "555.010.0199", "+1 555 010 0199".
    public static func number(in text: String) -> String? {
        guard let m = phoneNumber.firstMatch(in: text, range: full(text)) else { return nil }
        return "+1" + group(m, 1, text) + group(m, 2, text) + group(m, 3, text)
    }

    static func full(_ s: String) -> NSRange { NSRange(location: 0, length: (s as NSString).length) }
    static func matches(_ re: NSRegularExpression, _ s: String) -> Bool { re.firstMatch(in: s, range: full(s)) != nil }
    static func group(_ m: NSTextCheckingResult, _ i: Int, _ s: String) -> String {
        guard m.numberOfRanges > i, let r = Range(m.range(at: i), in: s) else { return "" }
        return String(s[r]).trimmingCharacters(in: .whitespaces)
    }
}

/// One stretch of speech: who said it and when, in seconds from the call's start.
public struct CallLine: Equatable, Sendable {
    public enum Side: String, Sendable { case me, them }
    public var at: TimeInterval
    public var side: Side
    public var text: String

    public init(at: TimeInterval, side: Side, text: String) { self.at = at; self.side = side; self.text = text }
}

public enum CallTranscript {
    /// The two sides' paragraphs (each from its own recording) in time order, with each side's recording start
    /// (seconds after the call began) added to its times.
    public static func interleave(me: [(start: TimeInterval, text: String)], meOffset: TimeInterval = 0,
                                  them: [(start: TimeInterval, text: String)], themOffset: TimeInterval = 0) -> [CallLine] {
        let lines = me.map { CallLine(at: $0.start + meOffset, side: .me, text: $0.text) } + them.map { CallLine(at: $0.start + themOffset, side: .them, text: $0.text) }
        return merged(droppingEcho(lines.filter { !$0.text.trimmingCharacters(in: .whitespaces).isEmpty }.sorted { $0.at < $1.at }))
    }

    /// His lines that are their words picked up by his mic (on speakers), judged against what they said 20 s either side.
    public static func droppingEcho(_ lines: [CallLine]) -> [CallLine] {
        lines.filter { line in
            guard line.side == .me else { return true }
            let theirs = lines.filter { $0.side == .them && abs($0.at - line.at) <= 20 }.map(\.text).joined(separator: " ")
            return !CallEcho.isEcho(line.text, theirRecent: theirs)
        }
    }

    /// One side's recording as turns: a new paragraph where that side went quiet for `gap` seconds (the other one was
    /// talking), or at a sentence's end once it runs `seconds`. Tokens are the recognizer's ("▁" starts a word).
    public static func turns(_ tokens: [TranscriptParagraphs.Token], gap: TimeInterval = 1.5, seconds: TimeInterval = 45) -> [(start: TimeInterval, text: String)] {
        var out: [(start: TimeInterval, text: String)] = []
        var text = ""
        var start: TimeInterval = 0
        var last: TimeInterval = 0
        func flush() {
            let t = text.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces)
            if !t.isEmpty { out.append((start, t)) }
            text = ""
        }
        for token in tokens {
            let piece = token.text.replacingOccurrences(of: "\u{2581}", with: " ")
            // a sentence's period comes stamped at the next word, after the other side's turn: it ends this turn
            // and says nothing about when this side last spoke
            if !text.isEmpty, piece.trimmingCharacters(in: .whitespaces).allSatisfy({ $0.isPunctuation }) {
                text += piece.trimmingCharacters(in: .whitespaces)
                continue
            }
            let startsWord = piece.hasPrefix(" ") || text.isEmpty
            if !text.isEmpty, startsWord,
               token.start - last >= gap || (token.start - start >= seconds && text.last.map({ ".?!".contains($0) }) == true) { flush() }
            if text.isEmpty { start = token.start }
            text += piece
            last = token.start
        }
        flush()
        return out
    }

    /// The whole-file pass with what only the live one caught (the whole-file recognizer drops a recording's last
    /// seconds): a live line whose words are mostly missing from its side's whole-file text within 30 s goes in.
    public static func filling(_ batch: [CallLine], from live: [CallLine]) -> [CallLine] {
        var out = batch
        for line in live {
            let words = PrepChecklist.words(line.text)
            guard words.count >= 2 else { continue }
            let near = Set(PrepChecklist.words(batch.filter { $0.side == line.side && abs($0.at - line.at) <= 30 }.map(\.text).joined(separator: " ")))
            let found = words.filter(near.contains).count
            if Double(found) / Double(words.count) < 0.5 { out.append(line) }
        }
        return merged(out.sorted { $0.at < $1.at })
    }

    /// Back-to-back lines from the same side become one.
    public static func merged(_ lines: [CallLine]) -> [CallLine] {
        var out: [CallLine] = []
        for line in lines {
            if let last = out.last, last.side == line.side { out[out.count - 1].text += " " + line.text.trimmingCharacters(in: .whitespaces) }
            else { out.append(CallLine(at: line.at, side: line.side, text: line.text.trimmingCharacters(in: .whitespaces))) }
        }
        return out
    }

    /// The transcript file: a heading, then "**Roshan** (03:12): ..." paragraphs.
    public static func markdown(heading: String, lines: [CallLine], me: String = "Roshan", them: String) -> String {
        var out = "# \(heading)\n\n"
        for line in lines {
            out += "**\(line.side == .me ? me : them)** (\(clock(line.at))): \(line.text)\n\n"
        }
        return out
    }

    /// "03:12", "1:02:40".
    public static func clock(_ seconds: TimeInterval) -> String {
        let s = max(0, Int(seconds.rounded()))
        return s >= 3600 ? String(format: "%d:%02d:%02d", s / 3600, s / 60 % 60, s % 60) : String(format: "%02d:%02d", s / 60, s % 60)
    }
}

/// On speakers his microphone also hears them: a line of "his" that is mostly their recent words is their echo.
public enum CallEcho {
    public static func isEcho(_ mine: String, theirRecent: String) -> Bool {
        let words = PrepChecklist.words(mine)
        guard words.count >= 3 else { return false }
        let theirs = Set(PrepChecklist.words(theirRecent))
        guard !theirs.isEmpty else { return false }
        let shared = words.filter(theirs.contains).count
        return Double(shared) / Double(words.count) >= 0.7
    }
}

/// The close every recap missed ("Ask the close ('anyone else I should talk to?') on the call itself", his lessons, 10/11).
public enum CloseAsk {
    static let asked = try! NSRegularExpression(
        pattern: #"\b(any(one|body) else|who else|someone else|somebody else|other (people|folks|analysts|associates)|anyone (on your team|you('d| would) recommend)|point me (to|toward)|introduce me|connect me|pass (my|me) along|reach out to next|should (i )?(talk|speak|reach out) to)\b"#,
        options: .caseInsensitive)

    public static func wasAsked(_ myWords: String) -> Bool {
        asked.firstMatch(in: myWords, range: NSRange(location: 0, length: (myWords as NSString).length)) != nil
    }

    /// Three minutes before the calendar's end, until ten minutes past it, and never in the call's first two minutes
    /// (a call started late on a short slot); twenty minutes in when the calendar has no end still ahead. Only while it
    /// hasn't been asked.
    public static func nudgeDue(now: Date, began: Date, endsAt: Date?, asked: Bool) -> Bool {
        guard !asked else { return false }
        let elapsed = now.timeIntervalSince(began)
        if let endsAt, endsAt > began.addingTimeInterval(180) {
            let left = endsAt.timeIntervalSince(now)
            return left <= 180 && left > -600 && elapsed >= 120
        }
        return elapsed >= 20 * 60
    }
}

/// The prep file's questions and talking points, ticked off as they come up.
public enum PrepChecklist {
    static let headings = try! NSRegularExpression(pattern: #"(?i)(question|ask|talking point|bring up|topics?|stor(y|ies)|market|deals?|points?|to cover|close)"#)
    static let stop: Set<String> = ["what", "when", "where", "which", "while", "with", "would", "could", "should", "about", "your", "their", "they",
                                    "them", "that", "this", "these", "those", "have", "from", "into", "like", "more", "most", "much", "some", "than",
                                    "then", "there", "were", "will", "been", "being", "does", "doing", "done", "just", "also", "very", "really",
                                    "how", "why", "the", "and", "for", "you", "are", "was", "can", "did", "has", "had", "its", "it's", "any", "our",
                                    "ask", "asks", "think", "thing", "things", "know", "time", "make", "made", "kind", "sort", "yeah", "okay"]

    /// Bullets and numbered lines under a heading about questions, points, stories or the close; the first `cap`.
    public static func items(from markdown: String, cap: Int = 8) -> [String] {
        var out: [String] = []
        var inSection = false
        for raw in markdown.components(separatedBy: "\n") {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.hasPrefix("#") || (line.hasPrefix("**") && line.hasSuffix("**") && line.count < 80) {
                inSection = headings.firstMatch(in: line, range: NSRange(location: 0, length: (line as NSString).length)) != nil
                continue
            }
            guard inSection, let item = bullet(line), item.count >= 8 else { continue }
            out.append(item)
            if out.count >= cap { break }
        }
        return out
    }

    /// "- **Ask about X.** more" -> "Ask about X. more"; nil for a line that isn't a bullet.
    static func bullet(_ line: String) -> String? {
        guard let m = line.range(of: #"^(?:[-*•]|\d+[.)])\s+"#, options: .regularExpression) else { return nil }
        let text = String(line[m.upperBound...])
            .replacingOccurrences(of: #"\*\*|__|`"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"\[([^\]]+)\]\([^)]+\)"#, with: "$1", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        return text.isEmpty ? nil : text
    }

    /// The words that carry meaning: lowercased, four letters or more (or a number), not filler.
    public static func words(_ text: String) -> [String] {
        text.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber && $0 != "'" }).map(String.init)
            .filter { ($0.count >= 4 || $0.allSatisfy(\.isNumber)) && !stop.contains($0) }
    }

    /// Enough of the item's own words were said: at least two, and at least half of them (stems compared on five letters).
    public static func covered(_ item: String, by spoken: String) -> Bool {
        let want = Array(Set(words(item).map(stem)))
        guard want.count >= 2 else { return false }
        let said = Set(words(spoken).map(stem))
        let hit = want.filter(said.contains).count
        return hit >= 2 && Double(hit) / Double(want.count) >= 0.5
    }

    static func stem(_ word: String) -> String { String(word.prefix(5)) }
}

/// The live helper's reply (Resources/call/helper-system.md): a fact line, a follow-up, an asked-for story, the prep
/// items now covered, or NONE.
public struct CallHelp: Equatable, Sendable {
    public var fact: String?
    public var ask: String?
    public var nudge: String?
    public var done: [Int]

    public init(fact: String? = nil, ask: String? = nil, nudge: String? = nil, done: [Int] = []) {
        self.fact = fact; self.ask = ask; self.nudge = nudge; self.done = done
    }

    public var isEmpty: Bool { fact == nil && ask == nil && nudge == nil && done.isEmpty }

    public static func parse(_ reply: String) -> CallHelp {
        var help = CallHelp()
        for raw in reply.components(separatedBy: "\n") {
            let line = raw.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: #"^[-*]\s*"#, with: "", options: .regularExpression)
            guard let colon = line.firstIndex(of: ":") else { continue }
            let key = line[..<colon].trimmingCharacters(in: .whitespaces).uppercased()
            let value = String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
            guard !value.isEmpty, value.uppercased() != "NONE" else { continue }
            switch key {
            case "FACT": help.fact = clip(value, 200)
            case "ASK": help.ask = clip(value, 200)
            case "NUDGE": help.nudge = clip(value, 140)
            case "DONE": help.done = value.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) }
            default: break
            }
        }
        return help
    }

    static func clip(_ s: String, _ n: Int) -> String {
        // no dashes in what he reads (his rule for anything under his name; the follow-up is in his words)
        let t = s.replacingOccurrences(of: #"\s*—\s*"#, with: ", ", options: .regularExpression).replacingOccurrences(of: "–", with: "-")
        return t.count <= n ? t : String(t.prefix(n - 1)) + "…"
    }
}

/// Where a call's files go, by the names his folders already use.
public enum CallFiles {
    /// "Alex Example" -> "Alex_Example"; "Northwind & Co." -> "Northwind_Co".
    public static func slug(_ name: String) -> String {
        name.components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }.joined(separator: "_")
    }

    public static func day(_ date: Date, calendar: Calendar = .current) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX"); f.calendar = calendar
        f.timeZone = calendar.timeZone
        return f.string(from: date)
    }

    static func base(_ event: CallEvent) -> String {
        event.kind == .chat ? slug(event.who) : slug(event.firm.isEmpty ? event.who : event.firm)
    }

    /// "2026-10-11_Alex_Example_call_prep.md" (Interview Prep), "2026-10-21_Northwind_interview_prep.md".
    public static func prepName(_ event: CallEvent) -> String {
        "\(day(event.start))_\(base(event))_\(event.kind == .chat ? "call" : "interview")_prep.md"
    }

    /// The transcript: Networking for a chat, Interview Prep for an interview. `n` is the call's number that day (callNumber).
    public static func transcriptName(_ event: CallEvent, n: Int = 1) -> String {
        "\(day(event.start))_\(base(event))_\(event.kind == .chat ? "call" : "interview")_transcript\(n > 1 ? "_\(n)" : "").md"
    }

    /// "2026-10-11_Alex_Example_coffee_chat_recap.md" (Networking) or "2026-10-21_Northwind_interview_debrief.md".
    public static func recapName(_ event: CallEvent, n: Int = 1) -> String {
        "\(day(event.start))_\(base(event))_\(event.kind == .chat ? "coffee_chat_recap" : "interview_debrief")\(n > 1 ? "_\(n)" : "").md"
    }

    /// The call's number among the day's calls with the same person or firm: the first n whose transcript and recap are
    /// both free in `folder`. The transcript is written under it at once, so the next call skips n even while this one's
    /// recap agent is still writing; the recap takes the same n, so two agents never get one path.
    public static func callNumber(_ event: CallEvent, in folder: URL, exists: (URL) -> Bool = { FileManager.default.fileExists(atPath: $0.path) }) -> Int {
        var n = 1
        while exists(folder.appendingPathComponent(transcriptName(event, n: n))) || exists(folder.appendingPathComponent(recapName(event, n: n))) { n += 1 }
        return n
    }

    static let firmWords: Set<String> = ["co", "inc", "llc", "lp", "llp", "ltd", "plc", "the", "and"]
    static let kindWords: Set<String> = ["call", "interview", "prep", "coffee", "chat"]

    /// A prep file already written for this call: dated the call's day or the day before, with "prep" in its name, and
    /// named for the person in full, else the firm in full ("Alex_Example", "Northwind"). Only when none is, one named
    /// for the first name or the firm's first word alone ("2026-10-11_Alex_call_prep.md"): never one with another
    /// surname after it, so an Alex Jones call doesn't pin Alex Smith's prep. Newest first.
    public static func findPrep(in names: [String], for event: CallEvent, calendar: Calendar = .current) -> String? {
        let days = [day(event.start, calendar: calendar), calendar.date(byAdding: .day, value: -1, to: event.start).map { day($0, calendar: calendar) }].compactMap { $0 }
        func words(_ s: String) -> [String] { slug(s).lowercased().split(separator: "_").map(String.init) }
        let keys = [words(event.person), words(event.firm).filter { !firmWords.contains($0) }].filter { !$0.isEmpty }
        guard !keys.isEmpty else { return nil }
        let candidates = names.filter { name in
            let n = name.lowercased()
            return n.hasSuffix(".md") && n.contains("prep") && days.contains(where: { n.hasPrefix($0) })
        }.map { (name: $0, words: words(String($0.dropLast(3)))) }
        func has(_ w: [String], _ key: [String]) -> Bool {
            w.count >= key.count && (0...(w.count - key.count)).contains { Array(w[$0..<$0 + key.count]) == key }
        }
        for key in keys {
            if let hit = candidates.filter({ has($0.words, key) }).map(\.name).sorted(by: >).first { return hit }
        }
        return candidates.filter { c in
            keys.contains { key in key.count > 1 && c.words.indices.contains { i in
                c.words[i] == key[0] && (i + 1 == c.words.count || kindWords.contains(c.words[i + 1]))
            } }
        }.map(\.name).sorted(by: >).first
    }
}

public enum CallPrepSchedule {
    /// The next `hour`:00 after `now` (today's if it is still ahead).
    public static func nextRun(after now: Date, hour: Int, calendar: Calendar = .current) -> Date {
        let today = calendar.date(bySettingHour: hour, minute: 0, second: 0, of: now) ?? now
        return today > now ? today : (calendar.date(byAdding: .day, value: 1, to: today) ?? today.addingTimeInterval(86_400))
    }
}
