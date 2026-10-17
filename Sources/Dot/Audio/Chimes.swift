import AppKit
import DotKit

/// Dot's sound set (AU-04): one sound per moment (an agent starts, needs his yes, finishes,
/// fails), loaded into memory up front so the first chime plays at once, and played through
/// this one helper so a call can silence them all (FX-11). The names come from the token
/// file's "chimes" (`ChimeEvent.resolve`); a name that does not load falls back to the default.
/// Nothing calls it yet: the wiring batch moves NotchHUD's Tink and AgentManager's Glass and
/// Basso here.
@MainActor
final class Chimes {
    static let shared = Chimes()

    /// Set by the wiring batch: true while every chime should hold (on a call with quietOnCalls).
    var isSilenced: () -> Bool = { false }

    private var sounds: [ChimeEvent: NSSound] = [:]
    private(set) var names: [ChimeEvent: String] = [:]

    init(names overrides: [String: String] = [:]) {
        configure(names: overrides)
    }

    /// Loads the set again from the token file's "chimes" (an empty dictionary is the defaults).
    func configure(names overrides: [String: String]) {
        sounds = [:]
        names = [:]
        for event in ChimeEvent.allCases {
            guard let name = ChimeEvent.resolve(event, overrides: overrides) else { continue }
            if let sound = Self.load(name) {
                sounds[event] = sound
                names[event] = name
            } else if let sound = Self.load(event.defaultName) {
                Log.warn("chime: \(event.rawValue) sound \"\(name)\" did not load; using \(event.defaultName)")
                sounds[event] = sound
                names[event] = event.defaultName
            }
        }
    }

    func play(_ event: ChimeEvent) {
        guard !isSilenced() else {
            Log.info("chime: \(event.rawValue) held (silenced)")
            return
        }
        guard let sound = sounds[event] else { return }
        // One NSSound plays once at a time: a second chime of the same kind starts it over.
        if sound.isPlaying { sound.stop() }
        sound.play()
        Log.info("chime: \(event.rawValue) (\(names[event] ?? "?"))")
    }

    /// A system sound by name (searched where NSSound looks: ~/Library/Sounds, /Library/Sounds,
    /// /System/Library/Sounds) or a sound file's path, read into memory now rather than on first play.
    static func load(_ name: String) -> NSSound? {
        let expanded = (name as NSString).expandingTildeInPath
        if expanded.contains("/") {
            return FileManager.default.fileExists(atPath: expanded) ? NSSound(contentsOf: URL(fileURLWithPath: expanded), byReference: false) : nil
        }
        let folders = [NSHomeDirectory() + "/Library/Sounds", "/Library/Sounds", "/System/Library/Sounds"]
        for folder in folders {
            for ext in ["aiff", "aif", "caf", "wav", "m4a", "mp3"] {
                let path = "\(folder)/\(name).\(ext)"
                if FileManager.default.fileExists(atPath: path), let sound = NSSound(contentsOf: URL(fileURLWithPath: path), byReference: false) {
                    return sound
                }
            }
        }
        return NSSound(named: NSSound.Name(name))
    }
}
