import AppKit
import DotKit
import Foundation

/// The Spotify app through its own AppleScript (2026-10-21, "also control my spotify app"): play, pause, next, previous,
/// the place in the song, shuffle, repeat, its own volume, and what's playing, each read back after the change.
extension Hands {
    func spotify(_ c: SpotifyControl) async -> Outcome {
        guard NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.spotify.client") != nil else {
            return Outcome(ok: false, line: "spotify isn't on this mac.", detail: "no spotify app")
        }
        let running = !NSRunningApplication.runningApplications(withBundleIdentifier: "com.spotify.client").isEmpty
        if !running, c == .nowPlaying { return Outcome(ok: true, line: "spotify isn't open, so nothing's playing.", detail: "spotify not running") }
        let action: String
        switch c {
        case .play: action = "play"
        case .pause: action = "pause"
        case .next: action = "next track"
        case .previous: action = "previous track"
        case .restart: action = "set player position to 0"
        case .nowPlaying: action = ""
        case .seek(let n): action = "set player position to (player position + (\(n)))"
        case .shuffle(let on): action = "set shuffling to \(on)"
        case .repeatSong(let on): action = "set repeating to \(on)"
        case .volume(let v):
            switch v {
            case .up: action = "set sound volume to ((sound volume + 12) as integer)"
            case .down: action = "set sound volume to ((sound volume - 12) as integer)"
            case .set(let n): action = "set sound volume to \(n)"
            case .mute: action = "set sound volume to 0"
            case .unmute: action = "set sound volume to 60"
            }
        }
        // One line back: state|track|artist|shuffling|repeating|volume.
        let script = """
        tell application "Spotify"
          \(action)
          delay 0.3
          set t to ""
          set a to ""
          try
            set t to name of current track
            set a to artist of current track
          end try
          return (player state as text) & "|" & t & "|" & a & "|" & (shuffling as text) & "|" & (repeating as text) & "|" & (sound volume as text)
        end tell
        """
        let (code, out) = await Self.run("/usr/bin/osascript", ["-e", script], timeout: 8)
        let parts = out.trimmingCharacters(in: .whitespacesAndNewlines).components(separatedBy: "|")
        guard code == 0, parts.count == 6 else {
            return Outcome(ok: false, line: "spotify didn't answer.", detail: "osascript \(code): \(Log.short(out, 100))")
        }
        let (state, track, artist, shuffling, repeating) = (parts[0], parts[1], parts[2], parts[3] == "true", parts[4] == "true")
        let detail = "spotify \(state), \(track) by \(artist), shuffle \(shuffling), repeat \(repeating), volume \(parts[5])"
        switch c {
        case .nowPlaying:
            if track.isEmpty { return Outcome(ok: true, line: "nothing's playing in spotify.", detail: detail) }
            let paused = state == "paused" ? ", paused" : ""
            return Outcome(ok: true, line: "\(track.lowercased()) by \(artist.lowercased())\(paused).", detail: detail)
        case .shuffle(let on) where shuffling != on, .repeatSong(let on) where repeating != on:
            return Outcome(ok: false, line: "spotify didn't take that.", detail: detail)
        case .next, .previous:
            return Outcome(ok: true, line: track.isEmpty ? c.doneLine : "\(track.lowercased()) by \(artist.lowercased()).", detail: detail)
        default:
            return Outcome(ok: true, line: c.doneLine, detail: detail)
        }
    }
}
