import Foundation

/// Dot's look in one file. Cards wear one of two looks: study (today's dark glass with one
/// accent) and desk (a navy ground, one amber, grey, tabular numerals, a source line under every
/// number, the title read as a claim). The same file says what each context mode does (look,
/// density, voice speed, whether Dot speaks), which system sound plays for each event, and a color
/// per file kind.
///
/// The defaults ship as `Resources/board/tokens.default.json` (a test keeps it equal to
/// `defaultJSON`). His edits live in `~/Dot/style/tokens.json`, outside the app, so a rebuild never
/// overwrites them. They win key by key; a missing file or a bad value falls back to the default
/// for that key, and the bad value is named in `problems`. Pure, so it is tested.
public struct StyleTokens: Equatable {
    public enum LookChoice: String, CaseIterable { case auto, study, desk }
    public enum Density: String, CaseIterable { case compact, regular, roomy }

    /// A color as four 0...1 channels, for NSColor and SwiftUI.
    public struct RGBA: Equatable {
        public var red: Double, green: Double, blue: Double, alpha: Double
        public init(red: Double, green: Double, blue: Double, alpha: Double = 1) {
            self.red = red; self.green = green; self.blue = blue; self.alpha = alpha
        }
        /// "#rrggbb", alpha dropped.
        public var hex: String {
            func byte(_ v: Double) -> Int { Int((min(max(v, 0), 1) * 255).rounded()) }
            return String(format: "#%02x%02x%02x", byte(red), byte(green), byte(blue))
        }
    }

    /// One look: every token by name, already checked, in the text the page gets.
    public struct Look: Equatable {
        public let name: String
        public let values: [String: String]

        public subscript(key: String) -> String? { values[key] }
        public func color(_ key: String) -> RGBA? { values[key].flatMap(StyleTokens.parseColor) }
        public func number(_ key: String) -> Double? { values[key].flatMap(Double.init) }

        public var background: RGBA { color("background") ?? RGBA(red: 0.05, green: 0.047, blue: 0.043) }
        public var backgroundAlpha: Double { number("backgroundAlpha") ?? 0.97 }
        public var stageAlpha: Double { number("stageAlpha") ?? 1 }
        public var border: RGBA { color("border") ?? RGBA(red: 1, green: 1, blue: 1, alpha: 0.12) }
        public var accentHex: String { values["accent"] ?? "#ff6b2c" }
        public var accent: RGBA { color("accent") ?? RGBA(red: 1, green: 0.42, blue: 0.17) }
        public var paper: RGBA { color("paper") ?? RGBA(red: 0.94, green: 0.92, blue: 0.89) }
        public var muted: RGBA { color("muted") ?? RGBA(red: 0.64, green: 0.61, blue: 0.56) }
        public var glass: RGBA { color("glass") ?? RGBA(red: 1, green: 1, blue: 1) }
        public var tabularNumerals: Bool { values["numerals"]?.contains("tabular-nums") ?? false }
    }

    /// What a context mode does (VI-03): the card look, how much goes on a card, the voice speed
    /// (a multiplier of his setting) and whether Dot speaks at all.
    public struct Mode: Equatable {
        public var look: LookChoice
        public var density: Density
        public var voiceRate: Double
        public var speak: Bool
    }

    /// System sound names by event (AU-04); "none" is silence.
    public struct Chimes: Equatable {
        public var launch: String
        public var needsYou: String
        public var done: String
        public var failed: String
        /// The sound for "launch", "needsYou", "done" or "failed"; nil for silence or another word.
        public func sound(for event: String) -> String? {
            let name: String
            switch event {
            case "launch": name = launch
            case "needsYou": name = needsYou
            case "done": name = done
            case "failed": name = failed
            default: return nil
            }
            return name == "none" ? nil : name
        }
    }

    public private(set) var look: LookChoice
    public private(set) var looks: [String: Look]
    public private(set) var modes: [String: Mode]
    public private(set) var chimes: Chimes
    /// Kind ("pdf", "xlsx", "pptx", "docx", "md", "html", "image", "code", "folder", or one he adds) to a color.
    public private(set) var fileColors: [String: String]
    /// One line per value in his file that was not used, and why.
    public private(set) var problems: [String]
    /// Key paths his file set with a good value ("looks.study.accent").
    public private(set) var overrides: Set<String>

    public static let lookNames = ["study", "desk"]
    public static let modeNames = ["lecture", "call", "study", "desk", "normal"]
    public static let fileKinds = ["pdf", "xlsx", "pptx", "docx", "md", "html", "image", "code", "folder"]

    // MARK: the schema

    enum Kind { case color, triple, alpha, weight, font, numerals }

    /// Every look token: its key in the file, its CSS variable, and what a good value is.
    static let lookKeys: [(key: String, css: String, kind: Kind)] = [
        ("background", "--card-bg", .color), ("backgroundAlpha", "--card-alpha", .alpha), ("stageAlpha", "--stage-alpha", .alpha),
        ("border", "--card-border", .color), ("ink", "--ink", .color), ("paper", "--paper", .color), ("muted", "--muted", .color),
        ("strong", "--strong", .color), ("line", "--line", .color), ("accent", "--accent", .color), ("blue", "--blue", .color),
        ("green", "--green", .color), ("yellow", "--yellow", .color), ("purple", "--purple", .color), ("context", "--context", .color),
        ("up", "--up", .color), ("down", "--down", .color), ("glass", "--glass-rgb", .triple), ("shade", "--shade-rgb", .triple),
        ("node", "--node", .color), ("chartText", "--chart-text", .color), ("chartTick", "--chart-tick", .color),
        ("chartGrid", "--chart-grid", .color), ("font", "--font", .font), ("mono", "--mono", .font),
        ("numerals", "--numerals", .numerals), ("titleWeight", "--title-weight", .weight),
    ]
    static let numeralValues: Set<String> = ["normal", "tabular-nums", "lining-nums", "lining-nums tabular-nums", "oldstyle-nums"]

    // MARK: loading

    /// `~/Dot/style/tokens.json`.
    public static var userFile: URL {
        URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Dot/style/tokens.json")
    }

    /// The shipped defaults alone.
    public static let defaults: StyleTokens = merged(userData: nil)

    /// The defaults with his file over them. A missing file is not a problem; an unreadable one is.
    public static func load(from file: URL = userFile) -> StyleTokens {
        guard FileManager.default.fileExists(atPath: file.path) else { return defaults }
        guard let data = try? Data(contentsOf: file) else {
            var tokens = defaults
            tokens.problems = ["tokens.json: could not be read"]
            return tokens
        }
        return merged(userData: data)
    }

    /// The defaults with `userData` (the bytes of a tokens.json) merged over them.
    public static func merged(userData: Data?) -> StyleTokens {
        let base = (try? JSONSerialization.jsonObject(with: Data(defaultJSON.utf8))) as? [String: Any] ?? [:]
        var problems: [String] = []
        var user: [String: Any] = [:]
        if let userData {
            if let object = (try? JSONSerialization.jsonObject(with: userData)) as? [String: Any] {
                user = object
            } else {
                problems.append("tokens.json: not a JSON object, every default kept")
            }
        }
        var builder = Builder(base: base, user: user, problems: problems)
        return builder.build()
    }

    /// Walks the schema once, taking his value where it is good and the default where it is not.
    struct Builder {
        let base: [String: Any]
        let user: [String: Any]
        var problems: [String]
        var overrides: Set<String> = []

        init(base: [String: Any], user: [String: Any], problems: [String]) {
            self.base = base; self.user = user; self.problems = problems
        }

        func lookup(_ object: [String: Any], _ path: [String]) -> Any? {
            var current: Any? = object
            for key in path { current = (current as? [String: Any])?[key] }
            return current
        }

        /// His value when `check` accepts it, else the default's; nil only when neither is good.
        mutating func pick<T>(_ path: [String], _ check: (Any) -> T?) -> T? {
            let name = path.joined(separator: ".")
            if let mine = lookup(user, path) {
                if let good = check(mine) { overrides.insert(name); return good }
                problems.append("\(name): \(StyleTokens.describe(mine)) is not usable, the default stays")
            }
            return lookup(base, path).flatMap(check)
        }

        mutating func build() -> StyleTokens {
            let look = pick(["look"]) { StyleTokens.text($0).flatMap(LookChoice.init(rawValue:)) } ?? .auto
            var looks: [String: Look] = [:]
            for name in StyleTokens.lookNames {
                var values: [String: String] = [:]
                for spec in StyleTokens.lookKeys {
                    if let value = pick(["looks", name, spec.key], { StyleTokens.check($0, spec.kind) }) { values[spec.key] = value }
                }
                looks[name] = Look(name: name, values: values)
            }
            var modes: [String: Mode] = [:]
            for name in StyleTokens.modeNames {
                let path = ["modes", name]
                modes[name] = Mode(
                    look: pick(path + ["look"]) { StyleTokens.text($0).flatMap(LookChoice.init(rawValue:)) } ?? .auto,
                    density: pick(path + ["density"]) { StyleTokens.text($0).flatMap(Density.init(rawValue:)) } ?? .regular,
                    voiceRate: pick(path + ["voiceRate"]) { StyleTokens.number($0).flatMap { (0.5...2).contains($0) ? $0 : nil } } ?? 1,
                    speak: pick(path + ["speak"]) { StyleTokens.flag($0) } ?? true)
            }
            func chime(_ key: String, _ fallback: String) -> String {
                pick(["chimes", key]) { StyleTokens.text($0).flatMap(StyleTokens.soundName) } ?? fallback
            }
            let chimes = Chimes(launch: chime("launch", "Pop"), needsYou: chime("needsYou", "Tink"),
                                done: chime("done", "Glass"), failed: chime("failed", "Basso"))
            var fileColors: [String: String] = [:]
            let extra = ((user["fileColors"] as? [String: Any])?.keys).map(Array.init) ?? []
            for kind in StyleTokens.fileKinds + extra.sorted() where fileColors[kind] == nil {
                guard kind.range(of: #"^[a-z0-9]{1,12}$"#, options: .regularExpression) != nil else {
                    problems.append("fileColors.\(kind): a kind is up to twelve lowercase letters or digits")
                    continue
                }
                if let value = pick(["fileColors", kind], { StyleTokens.check($0, .color) }) { fileColors[kind] = value }
            }
            return StyleTokens(look: look, looks: looks, modes: modes, chimes: chimes, fileColors: fileColors,
                               problems: problems, overrides: overrides)
        }
    }

    // MARK: values

    static func text(_ value: Any) -> String? { (value as? String)?.trimmingCharacters(in: .whitespaces) }

    /// A JSON number that is not a boolean.
    static func number(_ value: Any) -> Double? {
        guard let n = value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() else { return nil }
        let v = n.doubleValue
        return v.isFinite ? v : nil
    }

    static func flag(_ value: Any) -> Bool? {
        guard let n = value as? NSNumber, CFGetTypeID(n) == CFBooleanGetTypeID() else { return nil }
        return n.boolValue
    }

    static func soundName(_ name: String) -> String? {
        name.range(of: #"^[A-Za-z0-9 _.-]{1,40}$"#, options: .regularExpression) != nil ? name : nil
    }

    static func describe(_ value: Any) -> String {
        if let s = value as? String { return "\"\(s.count > 40 ? String(s.prefix(40)) + "..." : s)\"" }
        if let n = value as? NSNumber { return CFGetTypeID(n) == CFBooleanGetTypeID() ? (n.boolValue ? "true" : "false") : "\(n)" }
        return "a \(value is [Any] ? "list" : "group")"
    }

    /// The value as the page gets it, or nil when it is not a good value of its kind. Everything
    /// lands inside a <style> block, so only plain colors, numbers and font names pass.
    static func check(_ value: Any, _ kind: Kind) -> String? {
        switch kind {
        case .color, .triple:
            guard let s = text(value), parseColor(s) != nil else { return nil }
            return s
        case .alpha:
            guard let v = number(value), (0...1).contains(v) else { return nil }
            return cssNumber(v)
        case .weight:
            guard let v = number(value), v == v.rounded(), (100...900).contains(v) else { return nil }
            return String(Int(v))
        case .font:
            guard let s = text(value), s.range(of: #"^[A-Za-z0-9 ,"'-]{1,200}$"#, options: .regularExpression) != nil else { return nil }
            return s
        case .numerals:
            guard let s = text(value), numeralValues.contains(s) else { return nil }
            return s
        }
    }

    static func cssNumber(_ v: Double) -> String {
        v == v.rounded() ? String(Int(v)) : String(format: "%g", v)
    }

    /// "#rgb", "#rrggbb", "#rrggbbaa", "rgb(r, g, b)" or "rgba(r, g, b, a)".
    public static func parseColor(_ text: String) -> RGBA? {
        let s = text.trimmingCharacters(in: .whitespaces).lowercased()
        if s.hasPrefix("#") {
            var digits = String(s.dropFirst())
            guard digits.range(of: #"^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$"#, options: .regularExpression) != nil else { return nil }
            if digits.count == 3 { digits = digits.map { "\($0)\($0)" }.joined() }
            if digits.count == 6 { digits += "ff" }
            guard let value = UInt32(digits, radix: 16) else { return nil }
            return RGBA(red: Double((value >> 24) & 0xFF) / 255, green: Double((value >> 16) & 0xFF) / 255,
                        blue: Double((value >> 8) & 0xFF) / 255, alpha: Double(value & 0xFF) / 255)
        }
        let pattern = #"^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*(?:,\s*([0-9]*\.?[0-9]+)\s*)?\)$"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: s, range: NSRange(location: 0, length: (s as NSString).length)) else { return nil }
        func part(_ i: Int) -> Double? {
            let range = match.range(at: i)
            return range.location == NSNotFound ? nil : Double((s as NSString).substring(with: range))
        }
        guard let r = part(1), let g = part(2), let b = part(3), r <= 255, g <= 255, b <= 255 else { return nil }
        let a = part(4) ?? 1
        guard a <= 1 else { return nil }
        guard s.hasPrefix("rgba") == (match.range(at: 4).location != NSNotFound) else { return nil }
        return RGBA(red: r / 255, green: g / 255, blue: b / 255, alpha: a)
    }

    // MARK: reading

    /// A look by name; anything else is study.
    public func look(_ name: String) -> Look { looks[name] ?? looks["study"] ?? Look(name: "study", values: [:]) }

    /// A mode by name; anything else is normal.
    public func mode(_ name: String) -> Mode {
        modes[name] ?? modes["normal"] ?? Mode(look: .auto, density: .regular, voiceRate: 1, speak: true)
    }

    public func fileColor(_ kind: String) -> RGBA? { fileColors[kind.lowercased()].flatMap(Self.parseColor) }

    /// A finance piece (.football, .sens, .comps) anywhere in a card's html.
    public static func hasFinancePiece(_ html: String) -> Bool {
        html.range(of: #"class\s*=\s*["'][^"']*\b(football|sens|comps)\b"#, options: .regularExpression) != nil
    }

    /// The look a card wears: a finance piece always wears desk; else his choice in the file; on
    /// auto, the context mode's look; else study.
    public func lookName(forHTML html: String, mode: String? = nil) -> String {
        if Self.hasFinancePiece(html) { return "desk" }
        if look != .auto { return look.rawValue }
        if let mode, let choice = modes[mode]?.look, choice != .auto { return choice.rawValue }
        return "study"
    }

    /// The study accent follows his pointer color from Settings unless his token file names one.
    public func applyingPointerAccent(_ hex: String) -> StyleTokens {
        guard !overrides.contains("looks.study.accent"), Self.parseColor(hex) != nil, var study = looks["study"]?.values else { return self }
        study["accent"] = hex.trimmingCharacters(in: .whitespaces)
        var copy = self
        copy.looks["study"] = Look(name: "study", values: study)
        return copy
    }

    /// One look's variables as declarations ("--accent: #ff6b2c; ...").
    func declarations(_ look: Look) -> String {
        Self.lookKeys.compactMap { spec -> String? in
            guard var value = look.values[spec.key] else { return nil }
            if spec.kind == .triple, let c = Self.parseColor(value) {
                value = "\(Int((c.red * 255).rounded())), \(Int((c.green * 255).rounded())), \(Int((c.blue * 255).rounded()))"
            }
            return "\(spec.css): \(value);"
        }.joined(separator: " ")
    }

    /// The CSS variable block for a card page: `:root` carries the named look, and one
    /// `:root[data-look="..."]` block per look lets the page switch (board.js sets desk when a
    /// finance piece is present; the attribute outranks `:root` and the accent line after it).
    public func cssVariables(look name: String) -> String {
        var lines = [":root { \(declarations(look(name))) }"]
        for other in Self.lookNames { lines.append(":root[data-look=\"\(other)\"] { \(declarations(look(other))) }") }
        return lines.joined(separator: "\n")
    }

    /// The card page from board.html: the look on <html>, the variables at {{TOKENS}}, the look's
    /// accent at {{ACCENT}}, the content last so nothing inside it is replaced.
    public func cardPage(template: String, content: String, mode: String? = nil) -> (html: String, look: String) {
        let name = lookName(forHTML: content, mode: mode)
        var page = template
        if let tag = page.range(of: "<html>") { page.replaceSubrange(tag, with: "<html data-look=\"\(name)\">") }
        page = page.replacingOccurrences(of: "{{TOKENS}}", with: cssVariables(look: name))
            .replacingOccurrences(of: "{{ACCENT}}", with: look(name).accentHex)
            .replacingOccurrences(of: "{{CONTENT}}", with: content)
        return (page, name)
    }

    /// The shipped defaults, the same as Resources/board/tokens.default.json (a test compares them).
    public static let defaultJSON = #"""
    {
      "look": "auto",
      "looks": {
        "study": {
          "background": "#0d0c0b", "backgroundAlpha": 0.97, "stageAlpha": 1, "border": "rgba(255,255,255,0.12)",
          "ink": "#15120f", "paper": "#f0ebe3", "muted": "#a39b90", "strong": "#ffffff", "line": "rgba(255,255,255,0.09)",
          "accent": "#ff6b2c", "blue": "#7cc7ff", "green": "#9ef0b6", "yellow": "#ffd166", "purple": "#c79bff",
          "context": "#6f675e", "up": "#4cc38a", "down": "#f06a5e", "glass": "#ffffff", "shade": "#000000", "node": "#2a2420",
          "chartText": "#eeeeee", "chartTick": "#bbbbbb", "chartGrid": "#333333",
          "font": "-apple-system, \"SF Pro Text\", \"Helvetica Neue\", sans-serif", "mono": "\"SF Mono\", Menlo, monospace",
          "numerals": "normal", "titleWeight": 650
        },
        "desk": {
          "background": "#0c1828", "backgroundAlpha": 0.97, "stageAlpha": 1, "border": "rgba(255,255,255,0.12)",
          "ink": "#081120", "paper": "#e6ebf2", "muted": "#8d99ab", "strong": "#ffffff", "line": "rgba(255,255,255,0.1)",
          "accent": "#f2a93b", "blue": "#8fb4e3", "green": "#7fcf9f", "yellow": "#f2a93b", "purple": "#b3a6e0",
          "context": "#4f5f76", "up": "#5cb88a", "down": "#e0675c", "glass": "#ffffff", "shade": "#000000", "node": "#16263d",
          "chartText": "#e6ebf2", "chartTick": "#8d99ab", "chartGrid": "#22324a",
          "font": "-apple-system, \"SF Pro Text\", \"Helvetica Neue\", sans-serif", "mono": "\"SF Mono\", Menlo, monospace",
          "numerals": "tabular-nums", "titleWeight": 600
        }
      },
      "modes": {
        "lecture": {"look": "study", "density": "compact", "voiceRate": 1, "speak": false},
        "call": {"look": "auto", "density": "compact", "voiceRate": 1, "speak": false},
        "study": {"look": "study", "density": "regular", "voiceRate": 0.95, "speak": true},
        "desk": {"look": "desk", "density": "regular", "voiceRate": 1.1, "speak": true},
        "normal": {"look": "auto", "density": "regular", "voiceRate": 1, "speak": true}
      },
      "chimes": {"launch": "Pop", "needsYou": "Tink", "done": "Glass", "failed": "Basso"},
      "fileColors": {
        "pdf": "#e5534b", "xlsx": "#4cb782", "pptx": "#f0784a", "docx": "#5b8def", "md": "#a39b90",
        "html": "#e9a23b", "image": "#c79bff", "code": "#5ccfd1", "folder": "#7cc7ff"
      }
    }
    """#
}
