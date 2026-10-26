import AVFoundation
import DotKit

/// Dot's pen sounds (parity D6): the drawing makes its own sound from what it paints. Each piece of a mark sounds at its
/// own share of the mark's time (InkPiece.from...to): a pen stroke is a felt tip on the screen, words are handwriting,
/// words on a sticky are pencil, typed text is keys; a pill pops, a badge stamps, paper lands, a check ticks, a cross
/// says no. A bed's loudness and pitch follow the pen's speed through the stroke, so it starts, swells and lifts with
/// the ink. Accents from Kenney's CC0 packs, beds made by scripts/make-ink-sounds.py; never on a call, never while
/// Dot is muted, and off with Home > Voice > Pen sounds.
@MainActor
final class PenSounds {
    static let shared = PenSounds()

    /// Whether sounds may play now (the setting, and not on a call); AppDelegate sets it.
    var allowed: () -> Bool = { true }

    private var accents: [String: [AVAudioPlayer]] = [:]
    private var beds: [String: [AVAudioPlayer]] = [:]
    private var turn: [String: Int] = [:]
    private var envelopes: [ObjectIdentifier: Timer] = [:]
    private var pending: [DispatchWorkItem] = []

    init() { load() }

    private static var folder: URL? {
        [Bundle.main.resourceURL?.appendingPathComponent("sounds/ink"),
         URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../../Resources/sounds/ink").standardizedFileURL]
            .compactMap { $0 }.first { FileManager.default.fileExists(atPath: $0.path) }
    }

    private func load() {
        guard let folder = Self.folder, let files = try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil) else {
            Log.info("pen sounds: no sound folder; ink is silent")
            return
        }
        for url in files where url.pathExtension == "wav" {
            let name = url.deletingPathExtension().lastPathComponent
            let isBed = name.hasPrefix("bed-")
            let players = (0..<(isBed ? 2 : 3)).compactMap { _ -> AVAudioPlayer? in
                guard let p = try? AVAudioPlayer(contentsOf: url) else { return nil }
                if isBed { p.numberOfLoops = -1; p.enableRate = true }
                p.prepareToPlay()
                return p
            }
            if isBed { beds[String(name.dropFirst(4))] = players } else { accents[name] = players }
        }
    }

    private func player(_ pool: [String: [AVAudioPlayer]], _ name: String) -> AVAudioPlayer? {
        guard let players = pool[name], !players.isEmpty else { return nil }
        let i = turn[name, default: 0]
        turn[name] = (i + 1) % players.count
        return players.first { !$0.isPlaying } ?? players[i]
    }

    private func later(_ delay: TimeInterval, _ body: @escaping () -> Void) {
        let work = DispatchWorkItem(block: body)
        pending.append(work)
        DispatchQueue.main.asyncAfter(deadline: .now() + max(delay, 0), execute: work)
        if pending.count > 64 { pending.removeFirst(pending.count - 64) }
    }

    func accent(_ name: String, after delay: TimeInterval = 0) {
        later(delay) { [weak self] in
            guard let self, self.allowed(), let p = self.player(self.accents, name) else { return }
            p.currentTime = 0
            p.volume = 1
            p.play()
        }
    }

    /// A bed for `duration` seconds after `delay`: louder and a touch higher while the pen moves fastest.
    func bed(_ name: String, after delay: TimeInterval, for duration: TimeInterval) {
        guard duration > 0.05 else { return }
        later(delay) { [weak self] in
            guard let self, self.allowed(), let p = self.player(self.beds, name) else { return }
            let started = ProcessInfo.processInfo.systemUptime
            p.volume = 0
            p.currentTime = Double.random(in: 0..<max(p.duration - 0.05, 0.01))
            p.play()
            let key = ObjectIdentifier(p)
            self.envelopes[key]?.invalidate()
            self.envelopes[key] = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak self] timer in
                MainActor.assumeIsolated {
                    let t = (ProcessInfo.processInfo.systemUptime - started) / duration
                    if t >= 1.0 {
                        p.setVolume(0, fadeDuration: 0.08)
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { if p.volume < 0.01 { p.stop() } }
                        timer.invalidate()
                        self?.envelopes[key] = nil
                        return
                    }
                    // the eased pen's speed (the derivative of smoothstep), 0...1
                    let speed = min(6 * t * (1 - t) / 1.5, 1)
                    p.volume = Float(0.3 + 0.7 * speed)
                    p.rate = Float(0.92 + 0.16 * speed)
                }
            }
        }
    }

    /// One sound in a mark: an accent at `at`, or a bed from `at` for `length` seconds.
    struct Cue: Equatable {
        let name: String
        let bed: Bool
        let at: TimeInterval
        let length: TimeInterval
    }

    /// What one mark sounds like as it draws, piece by piece.
    nonisolated static func cues(_ kind: InkKind, drawing: InkDrawing, after delay: TimeInterval, duration: TimeInterval) -> [Cue] {
        var cues: [Cue] = []
        for piece in drawing.pieces {
            let start = delay + Double(piece.from) * duration
            let length = Double(piece.to - piece.from) * duration
            switch piece.body {
            case .stroke(let s):
                cues.append(Cue(name: s.style == .highlighter ? "highlighter" : "felt", bed: true, at: start, length: length))
            case .text(let t):
                switch t.style {
                case .pill: cues.append(Cue(name: "pop", bed: false, at: start, length: 0))
                case .badge: cues.append(Cue(name: "stamp", bed: false, at: start, length: 0))
                case .hand: cues.append(Cue(name: "writing", bed: true, at: start, length: length))
                case .sticky: cues.append(Cue(name: "pencil", bed: true, at: start, length: length))
                case .typed: cues.append(Cue(name: "keys", bed: true, at: start, length: length))
                }
            case .fill(let f):
                if f.style != .tint { cues.append(Cue(name: "paper", bed: false, at: start, length: 0)) }
            }
        }
        if kind == .check { cues.append(Cue(name: "tick", bed: false, at: delay + duration * 0.85, length: 0)) }
        if kind == .cross { cues.append(Cue(name: "nope", bed: false, at: delay + 0.02, length: 0)) }
        return cues.sorted { $0.at < $1.at }
    }

    func mark(_ kind: InkKind, drawing: InkDrawing, after delay: TimeInterval, duration: TimeInterval) {
        for cue in Self.cues(kind, drawing: drawing, after: delay, duration: duration) {
            if cue.bed { bed(cue.name, after: cue.at, for: cue.length) } else { accent(cue.name, after: cue.at) }
        }
    }

    /// The sounds that loaded, by name (beds without their "bed-" prefix).
    var loaded: (accents: Set<String>, beds: Set<String>) { (Set(accents.keys), Set(beds.keys)) }

    func edit(_ edit: InkEdit) {
        switch edit {
        case .erase, .undo: accent("eraser")
        case .move, .scale: accent("slide")
        case .recolor: bed("felt", after: 0, for: 0.5)
        case .keep: break
        }
    }

    func cleared() { accent("clear") }

    /// Everything waiting goes quiet (Escape, a barge-in).
    func hush() {
        pending.forEach { $0.cancel() }
        pending = []
        for (_, players) in beds { for p in players where p.isPlaying { p.setVolume(0, fadeDuration: 0.06) } }
    }
}
