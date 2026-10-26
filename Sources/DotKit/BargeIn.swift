import Foundation

/// Talking over Dot (parity AU-01, AU-02): while Dot speaks, a listener on the mic (Apple's voice processing cancels
/// Dot's own voice) decides whether he started talking. Both must hold: sound that stands above the floor and above what
/// is left of Dot's own voice for a quarter second, and the recognizer hearing two real words that aren't Dot's own.
/// A cough, a "hmm", or Dot's words leaking back never cut it off.
public struct BargeDetector {
    public struct Tuning: Equatable {
        /// RMS under this is room noise.
        public var floor: Float = 0.012
        /// What of Dot's own output can leak past the canceller, as a share of its level.
        public var leak: Float = 0.35
        /// Loud frames needed in a row, in seconds.
        public var sustain: TimeInterval = 0.25
        /// A loud stretch counts for this long after it ends (the words arrive later than the sound).
        public var memory: TimeInterval = 1.5
        /// Real words needed.
        public var words = 2
        /// Heard words found in what Dot is saying, above this share, are echo.
        public var echoShare = 0.5
        public init() {}
    }

    public enum Verdict: Equatable {
        case quiet
        /// Loud, but no words yet (or only fillers): wait.
        case sound
        /// Words that are Dot's own sentence coming back.
        case echo
        /// He is talking: cut Dot off. `words` are what was heard.
        case barge(words: String)
    }

    public var tuning: Tuning
    private var loudSince: TimeInterval?
    private var lastLoud: TimeInterval = -.infinity
    private var sustained = false

    public init(tuning: Tuning = Tuning()) { self.tuning = tuning }

    /// One mic frame after voice processing, with the level Dot is playing at that moment.
    public mutating func frame(mic: Float, farEnd: Float, at t: TimeInterval) {
        let gate = max(tuning.floor, farEnd * tuning.leak)
        if mic > gate {
            if loudSince == nil { loudSince = t }
            if let start = loudSince, t - start >= tuning.sustain { sustained = true }
            lastLoud = t
        } else if let start = loudSince, t - start < tuning.sustain {
            loudSince = nil   // a click or a cough's burst: under the sustain, forgotten
        } else {
            loudSince = nil
        }
        if sustained, t - lastLoud > tuning.memory { sustained = false }
    }

    /// The recognizer's latest partial for the listening stretch, and what Dot is saying now.
    public func verdict(heard partial: String, dotSaying: String) -> Verdict {
        guard sustained else { return .quiet }
        let heard = Self.realWords(partial)
        guard heard.count >= tuning.words else { return .sound }
        let own = Set(Self.words(dotSaying))
        let echoed = heard.filter { own.contains($0) }.count
        if Double(echoed) / Double(heard.count) > tuning.echoShare { return .echo }
        return .barge(words: heard.joined(separator: " "))
    }

    /// The question after a barge: the words the listener heard, then what the hold recorded, without saying the
    /// overlap twice.
    public static func merge(heard: String, recorded: String) -> String {
        let h = heard.trimmingCharacters(in: .whitespacesAndNewlines)
        let r = recorded.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !h.isEmpty else { return r }
        guard !r.isEmpty else { return h }
        let hw = words(h), rw = words(r)
        // the longest tail of what was heard that the recording starts with
        for k in stride(from: min(hw.count, rw.count), through: 1, by: -1) where Array(hw.suffix(k)) == Array(rw.prefix(k)) {
            return k == hw.count ? r : (hw.dropLast(k).joined(separator: " ") + " " + r)
        }
        return h + " " + r
    }

    public static let fillers: Set<String> = ["um", "uh", "uhm", "umm", "hmm", "hm", "mm", "mhm", "mmm", "ah", "oh", "er", "erm", "eh", "huh", "ahem", "ha", "heh"]

    static func words(_ s: String) -> [String] {
        s.lowercased().split(whereSeparator: { !$0.isLetter && $0 != "'" }).map(String.init).filter { !$0.isEmpty }
    }

    /// Words of two or more letters that aren't fillers ("I" and "a" alone don't count).
    public static func realWords(_ s: String) -> [String] {
        words(s).filter { $0.count >= 2 && !fillers.contains($0) }
    }
}

/// Where barge-in may listen (AU-02). Voice processing can force Bluetooth headphones into headset mode (16 kHz mono:
/// his music turns into a phone call), so with Bluetooth out it listens only on the built-in mic, only with the lid
/// open, and only on a device whose probe passed. AirPlay and display audio lag too much for the canceller.
public enum BargeRoute {
    public enum Output: String, Codable, Equatable {
        case builtIn, wired, usb, bluetooth, airplay, display, virtual, unknown
    }

    public enum Mic: String, Equatable { case builtIn, systemDefault }

    public enum Plan: Equatable {
        case off(String)
        /// First time on this output: probe it (no speech through it until the probe passes).
        case probe(mic: Mic)
        case listen(mic: Mic)
    }

    public enum Probe: String, Codable, Equatable { case passed, failed }

    public static func plan(enabled: Bool, output: Output, lidClosed: Bool, onCall: Bool, lecture: Bool,
                            probe: Probe?, inputIsBluetooth: Bool) -> Plan {
        guard enabled else { return .off("talk over dot is off") }
        if onCall { return .off("on a call") }
        if lecture { return .off("in lecture mode") }
        let mic: Mic
        switch output {
        case .airplay, .display, .virtual, .unknown:
            return .off("\(output.rawValue) output lags too much to cancel Dot's voice")
        case .bluetooth:
            if lidClosed { return .off("bluetooth out with the lid shut: no built-in mic to listen on") }
            mic = .builtIn
        case .builtIn, .wired, .usb:
            // a Bluetooth mic would put the headset in headset mode: the built-in one listens instead
            mic = inputIsBluetooth ? .builtIn : .systemDefault
            if inputIsBluetooth, lidClosed { return .off("the only mic is bluetooth and the lid is shut") }
        }
        switch probe {
        case .failed?: return .off("voice processing changed this output when it was probed")
        case nil: return .probe(mic: mic)
        case .passed?: return .listen(mic: mic)
        }
    }
}

/// What the output device looked like, before and while voice processing runs (AU-02's probe): any change means
/// voice processing reached the device (a Bluetooth headset dropping to headset mode shows as a new rate or channel
/// count), and the route is marked "no barge-in".
public struct RouteSnapshot: Equatable, Codable {
    public var deviceID: UInt32
    public var transport: String
    public var nominalRate: Double
    public var channels: Int
    public var format: String

    public init(deviceID: UInt32, transport: String, nominalRate: Double, channels: Int, format: String) {
        self.deviceID = deviceID
        self.transport = transport
        self.nominalRate = nominalRate
        self.channels = channels
        self.format = format
    }

    /// What differs, in words; empty when nothing did.
    public func changes(to other: RouteSnapshot) -> [String] {
        var out: [String] = []
        if deviceID != other.deviceID { out.append("device \(deviceID) to \(other.deviceID)") }
        if transport != other.transport { out.append("transport \(transport) to \(other.transport)") }
        if abs(nominalRate - other.nominalRate) > 1 { out.append("rate \(Int(nominalRate)) to \(Int(other.nominalRate))") }
        if channels != other.channels { out.append("channels \(channels) to \(other.channels)") }
        if format != other.format { out.append("format \(format) to \(other.format)") }
        return out
    }
}

/// Each output device's probe result, by its UID, kept in ~/Dot/.barge-routes.json.
public struct BargeRouteMemory: Codable, Equatable {
    public var results: [String: BargeRoute.Probe] = [:]
    public var notes: [String: String] = [:]
    public init() {}

    public static func load(_ url: URL) -> BargeRouteMemory {
        (try? JSONDecoder().decode(BargeRouteMemory.self, from: Data(contentsOf: url))) ?? BargeRouteMemory()
    }

    public func save(_ url: URL) {
        guard let data = try? JSONEncoder().encode(self) else { return }
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: url, options: .atomic)
    }
}
