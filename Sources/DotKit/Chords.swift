import Foundation

/// Dot's two recordable base chords (parity SE-01, SE-02). The conversation chord is three gestures, not three
/// shortcuts: hold to talk, tap to type, drag to ask about a region; Shift added while holding hands the request to an
/// agent. The dictation chord is hold to dictate. A chord is two or more modifiers (today's control+option and
/// control+fn), or modifiers plus one key.
public enum ChordModifier: String, Codable, CaseIterable, Comparable, Sendable {
    case control, option, shift, command, fn

    public var symbol: String {
        switch self {
        case .control: return "⌃ control"
        case .option: return "⌥ option"
        case .shift: return "⇧ shift"
        case .command: return "⌘ command"
        case .fn: return "fn"
        }
    }

    public static func < (a: ChordModifier, b: ChordModifier) -> Bool {
        allCases.firstIndex(of: a)! < allCases.firstIndex(of: b)!
    }
}

public struct Chord: Codable, Equatable, Sendable {
    public var modifiers: Set<ChordModifier>
    /// A virtual key code; nil for a modifier-only chord.
    public var keyCode: UInt16?
    /// How the key reads ("Space", "D").
    public var keyLabel: String?

    public init(_ modifiers: Set<ChordModifier>, keyCode: UInt16? = nil, keyLabel: String? = nil) {
        self.modifiers = modifiers
        self.keyCode = keyCode
        self.keyLabel = keyLabel
    }

    public static let conversationDefault = Chord([.control, .option])
    public static let dictationDefault = Chord([.control, .fn])

    public var keyed: Bool { keyCode != nil }

    /// How a hint says it: "control+option", "option+space".
    public var words: String { (modifiers.sorted().map(\.rawValue) + (keyLabel.map { [$0.lowercased()] } ?? [])).joined(separator: "+") }

    /// Key caps for Settings: the modifiers in a fixed order, then the key.
    public var caps: [String] { modifiers.sorted().map(\.symbol) + (keyLabel.map { [$0] } ?? keyCode.map { ["key \($0)"] } ?? []) }
}

public enum ChordRules {
    /// Chords the system or common habit already own, as (modifiers, key code). Space 49, Tab 48, 3/4/5 = 20/21/23,
    /// arrows 123-126.
    static let system: [(Set<ChordModifier>, UInt16)] = [
        ([.command], 49), ([.control], 49), ([.command, .option], 49), ([.command], 48), ([.command, .shift], 48),
        ([.command, .shift], 20), ([.command, .shift], 21), ([.command, .shift], 23),
        ([.control], 123), ([.control], 124), ([.control], 125), ([.control], 126),
    ]

    /// Why a chord can't be one of Dot's, or nil when it can. `conversation`: Shift is that chord's agent switch.
    public static func problem(_ chord: Chord, conversation: Bool) -> String? {
        if conversation, chord.modifiers.contains(.shift) {
            return "Shift is the agent switch: hold it with the talk chord to hand the request to an agent"
        }
        if let key = chord.keyCode {
            if chord.modifiers.subtracting([.shift, .fn]).isEmpty {
                return "a key needs control, option or command with it, or it fires while you type"
            }
            if system.contains(where: { $0.0 == chord.modifiers && $0.1 == key }) {
                return "macOS already uses that one"
            }
            if key == 53 { return "Escape stops Dot; it can't start it too" }
        } else if chord.modifiers.count < 2 {
            return "one modifier alone fires on ordinary typing; hold two or more, or add a key"
        }
        return nil
    }

    /// Why the pair clashes, or nil. The talk chord with Shift is agent mode, so dictation can't be that either.
    public static func clash(conversation: Chord, dictation: Chord) -> String? {
        if conversation == dictation { return "talk and dictation can't share a chord" }
        if !conversation.keyed, !dictation.keyed, dictation.modifiers == conversation.modifiers.union([.shift]) {
            return "that is the talk chord with Shift, which hands a request to an agent"
        }
        if conversation.keyed, dictation.keyed, conversation.keyCode == dictation.keyCode,
           dictation.modifiers.subtracting([.shift]) == conversation.modifiers {
            return "that is the talk chord with Shift, which hands a request to an agent"
        }
        // A modifier-only chord fires the moment its modifiers are down, and a held chord blocks the other, so the
        // other can't be those modifiers plus more: control+option would start talk before control+option+D's D.
        for (first, name, other, otherName) in [(conversation, "talk", dictation, "dictation"), (dictation, "dictation", conversation, "talk")]
        where !first.keyed && first.modifiers.isSubset(of: other.modifiers) {
            return "\(first.words) starts \(name) before \(other.words) is all down, so \(otherName) could never start; pick chords where neither is the other plus more"
        }
        return nil
    }

    /// The pair to run: the saved one, or the defaults with the reason when it can't be used (a hand-edited config, a
    /// chord this version refuses). Dot says the reason in the notch and keeps the saved one in the file.
    public static func effective(conversation: Chord, dictation: Chord) -> (conversation: Chord, dictation: Chord, fallback: String?) {
        if let why = problem(conversation, conversation: true) ?? problem(dictation, conversation: false) ?? clash(conversation: conversation, dictation: dictation) {
            return (.conversationDefault, .dictationDefault, why)
        }
        return (conversation, dictation, nil)
    }
}

/// What the held keys mean (the event tap's half that needs no CoreGraphics). Matching is exact: the chord's
/// modifiers and nothing else, except Shift on the conversation chord (agent mode). Once a chord is down it stays held
/// while its modifiers are (extra ones don't drop it).
public enum ChordMatch {
    public enum Hit: Equatable { case talk, agent, dictate }

    /// A modifier-only chord going down with this flags change.
    public static func pressed(_ active: Set<ChordModifier>, conversation: Chord, dictation: Chord) -> Hit? {
        if !dictation.keyed, active == dictation.modifiers { return .dictate }
        if !conversation.keyed, active.subtracting([.shift]) == conversation.modifiers { return active.contains(.shift) ? .agent : .talk }
        return nil
    }

    /// A keyed chord going down with this key. Fn is ignored for keys (macOS sets it for arrows and function keys).
    public static func pressed(key: UInt16, _ active: Set<ChordModifier>, conversation: Chord, dictation: Chord) -> Hit? {
        let mods = active.subtracting([.fn])
        if dictation.keyCode == key, mods == dictation.modifiers.subtracting([.fn]) { return .dictate }
        if conversation.keyCode == key, mods.subtracting([.shift]) == conversation.modifiers.subtracting([.fn]) {
            return mods.contains(.shift) ? .agent : .talk
        }
        return nil
    }

    /// Is the chord behind `hit` still held?
    public static func held(_ hit: Hit, _ active: Set<ChordModifier>, conversation: Chord, dictation: Chord) -> Bool {
        let chord = hit == .dictate ? dictation : conversation
        let needed = chord.keyed ? chord.modifiers.subtracting([.fn]) : chord.modifiers
        return needed.isSubset(of: active)
    }
}
