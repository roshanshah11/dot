import CryptoKit
import Foundation

/// The talk log's storage contract (parity batch 6, Codex review #10). ~/Dot/transcripts holds a Markdown file per day
/// and one transcripts.jsonl; those files are never rewritten. New rows carry a stable `id` (a ULID) and a `thread`
/// (`dot`, `agent:<slug>`, `job:<id>`); rows written before that get a deterministic id computed on read (sha1 of time,
/// kind and words, 16 hex) and the `dot` thread, never written back. Home's own state (drafts, scroll, reactions)
/// keys on these ids and lives elsewhere.
public struct TranscriptRow: Equatable {
    public let id: String
    public let thread: String
    public let at: Date
    public let kind: String
    public let you: String
    public let dot: String?
    public let app: String?
    /// The id was computed on read (a row from before ids).
    public let legacy: Bool

    public static let dotThread = "dot"

    /// One JSONL line; nil when it isn't a row.
    public static func parse(_ line: Substring) -> TranscriptRow? {
        guard let data = line.data(using: .utf8), let row = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let ts = row["ts"] as? String, let at = iso.date(from: ts) else { return nil }
        let kind = row["kind"] as? String ?? "talk"
        let you = row["you"] as? String ?? ""
        let stored = (row["id"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        let thread = (row["thread"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? dotThread
        return TranscriptRow(id: stored ?? legacyID(ts: ts, kind: kind, text: you), thread: thread, at: at, kind: kind, you: you,
                             dot: row["dot"] as? String, app: row["app"] as? String, legacy: stored == nil)
    }

    public static func parseAll(_ jsonl: String) -> [TranscriptRow] {
        jsonl.split(whereSeparator: \.isNewline).compactMap(parse)
    }

    /// A row from before ids: sha1 of "ts|kind|you", first 16 hex characters.
    public static func legacyID(ts: String, kind: String, text: String) -> String {
        let digest = Insecure.SHA1.hash(data: Data("\(ts)|\(kind)|\(text)".utf8))
        return digest.map { String(format: "%02x", $0) }.joined().prefix(16).description
    }

    nonisolated(unsafe) static let iso = ISO8601DateFormatter()
}

/// ULIDs for new rows: 48 bits of milliseconds then 80 random bits, Crockford base32, 26 characters, sorting by time.
public enum ULID {
    static let alphabet = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")

    public static func make(at date: Date = Date(), random: [UInt8]? = nil) -> String {
        let ms = UInt64(max(0, date.timeIntervalSince1970 * 1000))
        var bytes = [UInt8](repeating: 0, count: 16)
        for i in 0..<6 { bytes[i] = UInt8((ms >> (8 * UInt64(5 - i))) & 0xff) }
        let tail = random ?? (0..<10).map { _ in UInt8.random(in: 0...255) }
        for i in 0..<10 { bytes[6 + i] = tail[i] }
        // 128 bits as 26 base32 digits (the first carries 3 bits)
        var out: [Character] = []
        var acc: UInt32 = 0
        var bits = 2   // 130 bits of digits for 128 bits of data: two leading zero bits
        for byte in bytes {
            acc = (acc << 8) | UInt32(byte)
            bits += 8
            while bits >= 5 {
                bits -= 5
                out.append(alphabet[Int((acc >> UInt32(bits)) & 31)])
            }
        }
        return String(out)
    }

    public static func isValid(_ s: String) -> Bool {
        s.count == 26 && s.allSatisfy { alphabet.contains($0) }
    }
}

/// Which thread a new row belongs to.
public enum ThreadID {
    public static func agent(_ slug: String) -> String { "agent:\(slug)" }
    public static func job(_ id: String) -> String { "job:\(id)" }
}

/// Where a thread's view opens (HO-08): where he left it, unless something new came since; then the end, with a pill.
public enum ScrollRestore: Equatable {
    case end
    case anchor(String)
    case endWithNew(Int)

    /// `saved`: the turn id he was looking at and the newest turn id when he left; `turns`: the thread's ids, oldest first.
    public static func decide(savedAnchor: String?, savedNewest: String?, turns: [String]) -> ScrollRestore {
        guard let anchor = savedAnchor, turns.contains(anchor) else { return .end }
        guard let newest = savedNewest, let at = turns.firstIndex(of: newest) else { return .anchor(anchor) }
        let since = turns.count - 1 - at
        return since > 0 ? .endWithNew(since) : .anchor(anchor)
    }
}
