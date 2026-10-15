import Foundation

/// One beat of a spoken answer: the sentence to say and the visual tags that belong to it.
/// A tag written first on a line ("[POINT:...] this is the sidebar.") belongs to the sentence
/// after it; a tag inside or at the end of a sentence belongs to that sentence; tags left at
/// the very end with nothing after them come as a final beat with no words.
public struct Beat: Equatable {
    public var tags: [DotTag]
    public var text: String

    public init(tags: [DotTag], text: String) {
        self.tags = tags
        self.text = text
    }

    public var hasVisual: Bool { tags.contains { $0.isVisual } }
}

/// Turns the model's streamed text into beats as sentences complete, so each visual fires
/// when its sentence is spoken rather than when the whole answer has arrived.
public struct BeatStreamer {
    private var buffer = ""
    private var splitter = SentenceSplitter()
    /// Tags waiting for the next sentence to start (tag-first lines).
    private var leadingTags: [DotTag] = []
    /// Tags seen inside the sentence currently being written.
    private var inlineTags: [DotTag] = []
    public private(set) var allTags: [DotTag] = []
    public private(set) var spokenSoFar = ""

    public init(eagerFirst: Bool = false) { splitter = SentenceSplitter(eagerFirst: eagerFirst) }

    /// Feed a delta; returns every beat whose sentence is now complete, in order.
    public mutating func feed(_ delta: String) -> [Beat] {
        buffer += delta
        var beats: [Beat] = []
        while true {
            let ns = buffer as NSString
            if let match = TagParser.pattern.firstMatch(in: buffer, range: NSRange(location: 0, length: ns.length)) {
                let before = ns.substring(to: match.range.location)
                beats += consume(text: before)
                let kind = ns.substring(with: match.range(at: 1))
                let payloadRange = match.range(at: 2)
                let payload = payloadRange.location == NSNotFound ? "" : ns.substring(with: payloadRange)
                if let tag = TagParser.makeTag(kind: kind, payload: payload) {
                    allTags.append(tag)
                    if splitter.pending.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        leadingTags.append(tag)
                    } else {
                        inlineTags.append(tag)
                    }
                }
                buffer = ns.substring(from: match.range.location + match.range.length)
                continue
            }
            // No complete tag: everything before a possible unfinished "[TAG" is safe to split.
            let (safe, hold) = TagParser.speakablePrefix(buffer)
            beats += consume(text: safe)
            buffer = hold
            break
        }
        return beats
    }

    private mutating func consume(text: String) -> [Beat] {
        guard !text.isEmpty else { return [] }
        var beats: [Beat] = []
        for sentence in splitter.feed(text) {
            beats.append(makeBeat(sentence))
        }
        return beats
    }

    private mutating func makeBeat(_ sentence: String) -> Beat {
        let tags = leadingTags + inlineTags
        leadingTags = []
        inlineTags = []
        let clean = TagParser.tidy(sentence)
        if !clean.isEmpty { spokenSoFar += (spokenSoFar.isEmpty ? "" : " ") + clean }
        return Beat(tags: tags, text: clean)
    }

    /// The stream ended: the last sentence, then any tags still waiting as a wordless beat.
    public mutating func flush() -> [Beat] {
        var beats = feed("")
        let pending = splitter.flush() ?? ""
        let rest = (pending + buffer).trimmingCharacters(in: .whitespacesAndNewlines)
        buffer = ""
        if !rest.isEmpty {
            // A half-open bracket at the end is words, not a tag.
            beats.append(makeBeat(rest))
        }
        let trailing = leadingTags + inlineTags
        leadingTags = []
        inlineTags = []
        if !trailing.isEmpty { beats.append(Beat(tags: trailing, text: "")) }
        return beats
    }

    /// The sentence being written right now, without tags: for a bubble that streams ahead of speech.
    public var partial: String { TagParser.parse(splitter.pending + buffer).spoken }
}
