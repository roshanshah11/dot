import DotKit
import Foundation

/// One notch for both apps (his ask 2026-10-15: "combine dot and murmur notch interface").
/// Murmur keeps recording and pasting; its own notch indicator is off, and Dot's notch shows
/// what Murmur is doing by following its log (`~/Library/Logs/Murmur/murmur-<day>.log`, one
/// JSON line per event): a red dot and a running clock while it records, "transcribing" after,
/// then "pasted into Terminal" or "on your clipboard". Read only; nothing is sent to Murmur.
@MainActor
final class MurmurWatcher {
    private let directory: URL
    private let hud: NotchHUD
    private var timer: Timer?
    private var offset: UInt64 = 0
    private var fileName = ""
    private var recordingSince: Date?
    private var transcribingSince: Date?
    private var recordedSeconds = 0
    private var started = false

    init(directory: String, hud: NotchHUD) {
        self.directory = URL(fileURLWithPath: DotConfig.expand(directory), isDirectory: true)
        self.hud = hud
    }

    func start() {
        guard !started else { return }
        started = true
        // Start at the end of today's file: what happened before Dot launched is not news.
        let today = directory.appendingPathComponent(MurmurEvents.logName(for: Date()))
        fileName = today.lastPathComponent
        offset = (try? FileManager.default.attributesOfItem(atPath: today.path)[.size] as? UInt64) ?? 0
        timer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.poll() }
        }
        Log.info("murmur: mirroring \(directory.path) in the notch")
    }

    private func poll() {
        let name = MurmurEvents.logName(for: Date())
        if name != fileName { fileName = name; offset = 0 }   // midnight: a new file
        let url = directory.appendingPathComponent(name)
        guard let file = try? FileHandle(forReadingFrom: url) else { tick(); return }
        defer { try? file.close() }
        let size = (try? file.seekToEnd()) ?? 0
        if size < offset { offset = 0 }   // the file was replaced
        if size > offset {
            try? file.seek(toOffset: offset)
            let data = (try? file.readToEnd()) ?? Data()
            offset = size
            if let text = String(data: data, encoding: .utf8) {
                for line in text.split(separator: "\n") {
                    if let event = MurmurEvents.parse(line: String(line)) { handle(event) }
                }
            }
        }
        tick()
    }

    private func handle(_ event: MurmurEvent) {
        switch event {
        case .recordingStarted(let at):
            recordingSince = at
            transcribingSince = nil
            hud.flash(status: "murmur is recording; double-tap fn to stop", for: 3)
            Log.info("murmur: recording")
        case .recordingStopped:
            if let since = recordingSince { recordedSeconds = Int(Date().timeIntervalSince(since)) }
            recordingSince = nil
            transcribingSince = Date()
        case .transcribing(let seconds, _):
            recordedSeconds = seconds
            recordingSince = nil
            transcribingSince = Date()
        case .pasted(let chars, let app, _):
            transcribingSince = nil
            hud.model.recordingLine = nil
            let count = chars >= 1000 ? "\(chars / 1000),\(String(format: "%03d", chars % 1000)) characters" : "\(chars) characters"
            hud.notify(NotchNotice(id: "murmur", icon: "text.insert", title: "murmur pasted \(count) into \(app.isEmpty ? "the app" : app.lowercased())", tone: .good, seconds: 6))
            Log.info("murmur: pasted \(chars) chars into \(app)")
        case .notice(let body, _):
            let lower = body.lowercased()
            if !lower.hasPrefix("pasted into") {
                transcribingSince = nil
                hud.model.recordingLine = nil
                if lower.hasPrefix("copied to clipboard"), !lower.contains("empty") {
                    // HeyClicky's dictation clipboard surface: the text is on the clipboard, press command v.
                    hud.notify(NotchNotice(id: "murmur", icon: "doc.on.clipboard", title: "murmur put it on your clipboard", detail: "no field to type into; press command v where it should go", tone: .info, seconds: 10))
                } else {
                    hud.notify(NotchNotice(id: "murmur", icon: lower.contains("empty") ? "mic.slash" : "waveform", title: MurmurEvents.line(forNotice: body), tone: lower.contains("empty") ? .warn : .info, seconds: 6))
                }
                Log.info("murmur: \(body)")
            }
        case .idle:
            if transcribingSince != nil, Date().timeIntervalSince(transcribingSince!) > 1 { transcribingSince = nil }
            if recordingSince == nil, transcribingSince == nil { hud.model.recordingLine = nil }
        case .launched:
            recordingSince = nil
            transcribingSince = nil
            hud.model.recordingLine = nil
        }
        tick()
    }

    /// The pill text, once a second while something is going on.
    private func tick() {
        if let since = recordingSince {
            let line = "recording \(MurmurEvents.clock(Int(Date().timeIntervalSince(since))))"
            if hud.model.recordingLine != line { hud.model.recordingLine = line }
        } else if transcribingSince != nil {
            let line = "murmur transcribing \(recordedSeconds >= 60 ? "\(recordedSeconds / 60) min" : "\(recordedSeconds) s")"
            if hud.model.recordingLine != line { hud.model.recordingLine = line }
        }
    }

    var isRecording: Bool { recordingSince != nil }
}
