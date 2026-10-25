import AppKit
import DotKit
import Foundation

/// The Spotify app through its own AppleScript (2026-10-21, "also control my spotify app"): play, pause, next, previous,
/// the place in the song, shuffle, repeat, its own volume, and what's playing, each read back after the change.
extension Hands {
    func spotify(_ c: SpotifyControl) async -> Outcome {
        // What AppleScript can't do goes through Spotify's Web API (scripts/dot-spotify-api.py).
        switch c {
        case .like:
            let (code, out) = await Self.spotifyAPI(["like"])
            return code == 0 ? Outcome(ok: true, line: c.doneLine, detail: out) : Self.apiTrouble(code, out, doing: "like songs")
        case .moveTo(let device):
            let (code, out) = await Self.spotifyAPI(["transfer", device])
            if code == 0 { return Outcome(ok: true, line: c.doneLine, detail: out) }
            if code == 4 { return Outcome(ok: false, line: "i don't see your \(device) in spotify; open spotify on it first.", detail: out) }
            return Self.apiTrouble(code, out, doing: "move music between devices")
        default: break
        }
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
        case .like, .moveTo: action = ""
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
    /// Spotify's Web API script: its exit code and its one line. 3: not set up, 4: no such device, 5: Spotify refused.
    nonisolated static func spotifyAPI(_ args: [String]) async -> (code: Int32, out: String) {
        guard let script = DotConfig.bundledScript("dot-spotify-api.py", fallback: "~/Projects/dot/scripts/dot-spotify-api.py") else { return (-1, "no dot-spotify-api.py") }
        let (code, out) = await run("/usr/bin/python3", [script] + args, timeout: 15)
        return (code, out.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    /// What he hears when the Web API can't do it: not set up yet, or Spotify said no.
    static func apiTrouble(_ code: Int32, _ out: String, doing: String) -> Outcome {
        if code == 3 { return Outcome(ok: false, line: "to \(doing) i need spotify's web api set up; send me the client id from your spotify developer app.", detail: "spotify api: not set up") }
        let why = out.hasPrefix("refused:") ? String(out.dropFirst("refused:".count)).trimmingCharacters(in: .whitespaces) : out
        return Outcome(ok: false, line: "spotify said no: \(Log.short(why.lowercased(), 80)).", detail: "spotify api exit \(code): \(Log.short(out, 120))")
    }
}
