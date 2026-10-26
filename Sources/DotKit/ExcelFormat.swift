import Foundation

/// Excel number formats (parity H3): a format code and a value in, the text Excel shows out, plus the section's color.
/// Covers sections (positive;negative;zero;text), conditions, literals ("x", \x, _x, *x), grouping and scaling commas,
/// percent, scientific, fractions, [$sym-locale] currency, [Color] tags, dates and times from serials (1900 and 1904
/// systems), elapsed [h]:mm:ss and General. Rounding follows Excel: half away from zero on 15 significant digits.
public enum ExcelFormat {
    public struct Shown: Equatable {
        public let text: String
        public let color: String?
        public init(_ text: String, color: String? = nil) { self.text = text; self.color = color }
    }

    /// The built-in formats an .xlsx refers to by id without spelling out (en-US).
    public static func builtin(_ id: Int) -> String? { builtins[id] }

    static let builtins: [Int: String] = [
        0: "General", 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00",
        5: "$#,##0_);($#,##0)", 6: "$#,##0_);[Red]($#,##0)", 7: "$#,##0.00_);($#,##0.00)", 8: "$#,##0.00_);[Red]($#,##0.00)",
        9: "0%", 10: "0.00%", 11: "0.00E+00", 12: "# ?/?", 13: "# ??/??",
        14: "m/d/yyyy", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy", 18: "h:mm AM/PM", 19: "h:mm:ss AM/PM",
        20: "h:mm", 21: "h:mm:ss", 22: "m/d/yyyy h:mm",
        37: "#,##0_);(#,##0)", 38: "#,##0_);[Red](#,##0)", 39: "#,##0.00_);(#,##0.00)", 40: "#,##0.00_);[Red](#,##0.00)",
        41: #"_(* #,##0_);_(* \(#,##0\);_(* "-"_);_(@_)"#,
        42: #"_("$"* #,##0_);_("$"* \(#,##0\);_("$"* "-"_);_(@_)"#,
        43: #"_(* #,##0.00_);_(* \(#,##0.00\);_(* "-"??_);_(@_)"#,
        44: #"_("$"* #,##0.00_);_("$"* \(#,##0.00\);_("$"* "-"??_);_(@_)"#,
        45: "mm:ss", 46: "[h]:mm:ss", 47: "mm:ss.0", 48: "##0.0E+0", 49: "@",
    ]

    /// Whether a code shows dates or times (its number is a serial).
    public static func isDate(_ code: String) -> Bool {
        sections(code).prefix(1).contains { $0.isDate }
    }

    /// A number under a format code.
    public static func shown(_ value: Double, code: String, date1904: Bool = false) -> Shown {
        shown(value, parsed: code.isEmpty ? [] : sections(code), date1904: date1904)
    }

    /// The same, with the code already split into sections (a reader caches them per code).
    static func shown(_ value: Double, parsed: [Section], date1904: Bool) -> Shown {
        guard !parsed.isEmpty, value.isFinite else { return Shown(general(value)) }
        let (section, minus) = pick(parsed, value)
        guard let section else { return Shown("") }
        if section.isDate {
            if value < 0 { return Shown(String(repeating: "#", count: 8), color: section.color) }
            return Shown(date(value, section.toks, date1904: date1904), color: section.color)
        }
        return Shown(number(abs(value), section.toks, minus: minus), color: section.color)
    }

    /// Text under a format code: the text section (the fourth, or a lone section with @), else the text as is.
    public static func text(_ s: String, code: String) -> Shown { text(s, parsed: sections(code)) }

    static func text(_ s: String, parsed all: [Section]) -> Shown {
        let section: Section? = all.count >= 4 ? all[3] : (all.count == 1 && all[0].toks.contains(.at) ? all[0] : nil)
        guard let section else { return Shown(s) }
        var out = ""
        for t in section.toks {
            switch t {
            case .lit(let l): out += l
            case .at: out += s
            default: break
            }
        }
        return Shown(out, color: section.color)
    }

    /// Excel's General: up to 11 characters, scientific when that can't hold the number.
    public static func general(_ v: Double) -> String {
        if v == 0 { return "0" }
        let a = abs(v)
        let sign = v < 0 ? "-" : ""
        if a >= 1e11 || a < 1e-5 {
            let e = Int(floor(log10(a)))
            var m = a / pow(10, Double(e))
            var exp = e
            m = round15(m, places: 5)
            if m >= 10 { m /= 10; exp += 1 }
            var digits = plain(m, places: 5)
            digits = trimZeros(digits)
            return sign + digits + "E" + (exp < 0 ? "-" : "+") + pad(String(abs(exp)), 2)
        }
        let intDigits = max(1, Int(floor(log10(a))) + 1)
        let places = max(0, 10 - intDigits)
        return sign + trimZeros(plain(a, places: places))
    }

    // MARK: Sections and tokens

    indirect enum Tok: Equatable {
        case lit(String)
        case digit(Character)        // 0 # ?
        case point, comma, percent, slash, at, general
        case exp(plus: Bool, digits: Int)
        case date(String)            // y yy yyyy m mm mmm mmmm mmmmm d dd ddd dddd h hh s ss, "ampm", "ap"
        case ampm(String)            // the original AM/PM or A/P text (its case is kept)
        case elapsed(Character, Int) // [h] [mm] [ss]
    }

    struct Condition: Equatable {
        let op: String
        let value: Double
        func holds(_ v: Double) -> Bool {
            switch op {
            case "<": return v < value
            case "<=": return v <= value
            case ">": return v > value
            case ">=": return v >= value
            case "=": return v == value
            case "<>": return v != value
            default: return false
            }
        }
    }

    struct Section: Equatable {
        var toks: [Tok] = []
        var color: String?
        var condition: Condition?
        var isDate: Bool { toks.contains { if case .date = $0 { return true }; if case .elapsed = $0 { return true }; if case .ampm = $0 { return true }; return false } }
        var isGeneral: Bool { toks.contains(.general) }
        var isEmpty: Bool { toks.isEmpty }
    }

    static func sections(_ code: String) -> [Section] {
        var parts: [String] = []
        var cur = ""
        var quoted = false, bracket = false, escape = false
        for ch in code {
            if escape { cur.append(ch); escape = false; continue }
            switch ch {
            case "\\" where !quoted: escape = true; cur.append(ch)
            case "\"": quoted.toggle(); cur.append(ch)
            case "[" where !quoted: bracket = true; cur.append(ch)
            case "]" where !quoted: bracket = false; cur.append(ch)
            case ";" where !quoted && !bracket: parts.append(cur); cur = ""
            default: cur.append(ch)
            }
        }
        parts.append(cur)
        return parts.map(tokenize)
    }

    static let colors = ["black", "blue", "cyan", "green", "magenta", "red", "white", "yellow"]

    static func tokenize(_ s: String) -> Section {
        var sec = Section()
        let c = Array(s)
        var i = 0
        func lit(_ x: String) {
            if case .lit(let prev)? = sec.toks.last { sec.toks[sec.toks.count - 1] = .lit(prev + x) } else { sec.toks.append(.lit(x)) }
        }
        while i < c.count {
            let ch = c[i]
            let lower = Character(ch.lowercased())
            switch ch {
            case "\"":
                var j = i + 1, out = ""
                while j < c.count && c[j] != "\"" { out.append(c[j]); j += 1 }
                lit(out); i = j + 1; continue
            case "\\":
                if i + 1 < c.count { lit(String(c[i + 1])) }
                i += 2; continue
            case "_":
                lit(" "); i += 2; continue
            case "*":
                i += 2; continue
            case "[":
                var j = i + 1, inner = ""
                while j < c.count && c[j] != "]" { inner.append(c[j]); j += 1 }
                i = j + 1
                let low = inner.lowercased()
                if colors.contains(low) { sec.color = inner.prefix(1).uppercased() + low.dropFirst() }
                else if low.hasPrefix("color") { sec.color = inner }
                else if inner.hasPrefix("$") {
                    let body = inner.dropFirst()
                    let sym = body.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? ""
                    if !sym.isEmpty { lit(sym) }
                } else if let first = low.first, "hms".contains(first), low.allSatisfy({ $0 == first }) {
                    sec.toks.append(.elapsed(first, low.count))
                } else if let cond = condition(inner) { sec.condition = cond }
                continue
            case "0", "#", "?":
                sec.toks.append(.digit(ch))
            case ".": sec.toks.append(.point)
            case ",": sec.toks.append(.comma)
            case "%": sec.toks.append(.percent)
            case "/": sec.toks.append(.slash)
            case "@": sec.toks.append(.at)
            case "E" where i + 1 < c.count && (c[i + 1] == "+" || c[i + 1] == "-"),
                 "e" where i + 1 < c.count && (c[i + 1] == "+" || c[i + 1] == "-"):
                let plus = c[i + 1] == "+"
                var j = i + 2, n = 0
                while j < c.count && (c[j] == "0" || c[j] == "#") { n += 1; j += 1 }
                sec.toks.append(.exp(plus: plus, digits: max(1, n)))
                i = j; continue
            default:
                let rest = String(c[i...]).lowercased()
                if rest.hasPrefix("general") { sec.toks.append(.general); i += 7; continue }
                if rest.hasPrefix("am/pm") { sec.toks.append(.ampm(String(c[i..<(i + 5)]))); i += 5; continue }
                if rest.hasPrefix("a/p") { sec.toks.append(.ampm(String(c[i..<(i + 3)]))); i += 3; continue }
                if "ymdhs".contains(lower) {
                    var j = i
                    while j < c.count && Character(c[j].lowercased()) == lower { j += 1 }
                    sec.toks.append(.date(String(repeating: lower, count: j - i)))
                    i = j; continue
                }
                lit(String(ch))
            }
            i += 1
        }
        return sec
    }

    static func condition(_ s: String) -> Condition? {
        for op in ["<=", ">=", "<>", "<", ">", "="] where s.hasPrefix(op) {
            if let v = Double(s.dropFirst(op.count).trimmingCharacters(in: .whitespaces)) { return Condition(op: op, value: v) }
        }
        return nil
    }

    /// Which section shows a value, and whether a minus sign goes in front.
    static func pick(_ all: [Section], _ v: Double) -> (Section?, Bool) {
        let numeric = Array(all.prefix(3))
        if numeric.prefix(2).contains(where: { $0.condition != nil }) {
            if let c = numeric[0].condition, c.holds(v) { return (numeric[0], v < 0) }
            if numeric.count > 1 {
                if let c = numeric[1].condition { if c.holds(v) { return (numeric[1], v < 0) } } else { return (numeric[1], v < 0) }
            }
            if numeric.count > 2 { return (numeric[2], v < 0) }
            return (numeric[0].condition == nil ? numeric[0] : nil, v < 0)
        }
        switch numeric.count {
        case 1: return (numeric[0], v < 0)
        case 2: return v < 0 ? (numeric[1], false) : (numeric[0], false)
        default: return v > 0 ? (numeric[0], false) : v < 0 ? (numeric[1], false) : (numeric[2], false)
        }
    }

    // MARK: Numbers

    static func number(_ x: Double, _ toks: [Tok], minus: Bool) -> String {
        var x = x
        let percents = toks.filter { $0 == .percent }.count
        for _ in 0..<percents { x *= 100 }
        if let slash = toks.firstIndex(of: .slash), toks.contains(where: { if case .digit = $0 { return true }; return false }) {
            return (minus ? "-" : "") + fraction(x, toks, slash: slash)
        }
        let expAt = toks.firstIndex { if case .exp = $0 { return true }; return false }
        let pointAt = toks.firstIndex(of: .point)
        let numberEnd = expAt ?? toks.count
        let intEnd = pointAt.map { min($0, numberEnd) } ?? numberEnd
        let digitAts = toks.indices.filter { if case .digit = toks[$0] { return true }; return false }
        let intAts = digitAts.filter { $0 < intEnd }
        let decAts = digitAts.filter { $0 > intEnd && $0 < numberEnd }

        // commas: grouping between integer digits, scaling (/1000 each) after the last digit placeholder
        var grouping = false, scale = 0
        var commaRole: [Int: Bool] = [:]   // index -> true when it's consumed (grouping or scaling)
        for i in toks.indices where toks[i] == .comma {
            let before = digitAts.contains { $0 < i }
            let laterInt = intAts.contains { $0 > i }
            let laterDigit = digitAts.contains { $0 > i }
            if before && laterInt { grouping = true; commaRole[i] = true }
            else if before && !laterDigit { scale += 1; commaRole[i] = true }
        }
        for _ in 0..<scale { x /= 1000 }

        var expText = ""
        if let expAt, case .exp(let plus, let expDigits) = toks[expAt] {
            let intCount = max(1, intAts.count)
            var e = x == 0 ? 0 : Int(floor(log10(x)))
            let engineering = intCount > 1 && intAts.contains { toks[$0] == .digit("#") }
            if engineering { e = Int(floor(Double(e) / Double(intCount))) * intCount } else { e -= intCount - 1 }
            var m = x / pow(10, Double(e))
            m = round15(m, places: decAts.count)
            if !engineering && m >= pow(10, Double(intCount)) { m /= 10; e += 1 }
            x = m
            expText = "E" + (e < 0 ? "-" : (plus ? "+" : "")) + pad(String(abs(e)), expDigits)
        }

        let fixed = plain(x, places: decAts.count)
        let parts = fixed.split(separator: ".", omittingEmptySubsequences: false)
        var intDigits = String(parts[0])
        let fracDigits = parts.count > 1 ? Array(parts[1]) : []
        if intDigits == "0" { intDigits = "" }

        // integer placeholders: contiguous (grouped, padded) or interleaved with literals (filled right to left)
        var intText: [Int: String] = [:]
        let interleaved = intAts.count > 1 && (intAts.first!..<intAts.last!).contains { i in
            if case .lit = toks[i] { return true }; return false
        }
        if !intAts.isEmpty {
            if interleaved {
                var digits = Array(intDigits)
                for (n, i) in intAts.enumerated().reversed() {
                    var piece = ""
                    if let d = digits.popLast() { piece = String(d) }
                    else if toks[i] == .digit("0") { piece = "0" } else if toks[i] == .digit("?") { piece = " " }
                    if n == 0 { piece = String(digits) + piece; digits = [] }
                    intText[i] = piece
                }
            } else {
                let firstFixed = intAts.firstIndex { toks[$0] != .digit("#") } ?? intAts.count
                let minDigits = intAts.count - firstFixed
                var padded = intDigits
                if padded.count < minDigits {
                    let padChar: Character = intAts[firstFixed...].first.map { toks[$0] == .digit("?") } == true ? " " : "0"
                    padded = String(repeating: padChar, count: minDigits - padded.count) + padded
                }
                if grouping { padded = group(padded) }
                intText[intAts[0]] = padded
                for i in intAts.dropFirst() { intText[i] = "" }
            }
        }

        // decimal placeholders: '#' drops trailing zeros, '?' turns them into spaces
        var decText: [Int: String] = [:]
        var trailing = true
        for (n, i) in decAts.enumerated().reversed() {
            let d = n < fracDigits.count ? fracDigits[n] : "0"
            if trailing && d == "0" && toks[i] != .digit("0") {
                decText[i] = toks[i] == .digit("?") ? " " : ""
            } else {
                trailing = false
                decText[i] = String(d)
            }
        }

        var out = minus ? "-" : ""
        for (i, t) in toks.enumerated() {
            switch t {
            case .lit(let l): out += l
            case .digit:
                if let s = intText[i] { out += s } else if let s = decText[i] { out += s }
            case .point:
                // ".00" has no integer placeholder: a nonzero integer part still shows before the point
                if intAts.isEmpty && !intDigits.isEmpty { out += intDigits }
                out += "."
            case .comma: if commaRole[i] == nil { out += "," }
            case .exp: out += expText
            case .percent: out += "%"
            case .general: out += general(x)
            case .at, .slash, .date, .ampm, .elapsed: break
            }
        }
        return out
    }

    static func fraction(_ x: Double, _ toks: [Tok], slash: Int) -> String {
        // numerator: the digit run just before the slash; whole: digits before that run
        var numStart = slash
        while numStart > 0, case .digit = toks[numStart - 1] { numStart -= 1 }
        let wholeAts = toks[..<numStart].indices.filter { if case .digit = toks[$0] { return true }; return false }
        let numCount = slash - numStart
        var denomPlaces = 0
        var fixedDenom: Int?
        var j = slash + 1
        while j < toks.count, case .digit = toks[j] { denomPlaces += 1; j += 1 }
        if denomPlaces == 0, j < toks.count, case .lit(let l) = toks[j], let d = Int(l.prefix(while: \.isNumber)), d > 0 { fixedDenom = d }
        let whole = wholeAts.isEmpty ? 0 : floor(x)
        let part = x - whole
        var num = 0, den = 1
        if let fixedDenom { den = fixedDenom; num = Int((part * Double(den)).rounded(.toNearestOrAwayFromZero)) }
        else {
            let maxDen = max(1, Int(pow(10, Double(max(1, denomPlaces)))) - 1)
            var best = Double.infinity
            for d in 1...maxDen {
                let n = (part * Double(d)).rounded(.toNearestOrAwayFromZero)
                let err = abs(part - n / Double(d))
                if err < best - 1e-12 { best = err; num = Int(n); den = d }
                if err == 0 { break }
            }
        }
        var w = Int(whole)
        if num == den && !wholeAts.isEmpty { w += 1; num = 0 }
        var out = ""
        for t in toks[..<numStart] { if case .lit(let l) = t { out += l } }
        if !wholeAts.isEmpty { out = (w > 0 || num == 0 ? String(w) : "") + out }
        if num == 0 && !wholeAts.isEmpty { return out.trimmingCharacters(in: .whitespaces) }
        out += pad(String(num), numCount, " ") + "/" + (fixedDenom.map(String.init) ?? String(den))
        if fixedDenom == nil && String(den).count < denomPlaces {
            out += String(repeating: " ", count: denomPlaces - String(den).count)
        }
        return out
    }

    static func group(_ digits: String) -> String {
        let c = Array(digits)
        var out = ""
        for (i, ch) in c.enumerated() {
            if i > 0 && (c.count - i) % 3 == 0 && c[i - 1] != " " { out.append(",") }
            out.append(ch)
        }
        return out
    }

    /// x rounded half away from zero to `places`, on its 15 significant digits (how Excel sees a double).
    static func round15(_ x: Double, places: Int) -> Double {
        var d = Decimal(string: String(format: "%.15g", x), locale: posix) ?? Decimal(x)
        var r = Decimal()
        NSDecimalRound(&r, &d, places, .plain)
        return NSDecimalNumber(decimal: r).doubleValue
    }

    /// x as plain digits with exactly `places` decimals, rounded the Excel way.
    static func plain(_ x: Double, places: Int) -> String {
        var d = Decimal(string: String(format: "%.15g", x), locale: posix) ?? Decimal(x)
        var r = Decimal()
        NSDecimalRound(&r, &d, places, .plain)
        var s = NSDecimalNumber(decimal: r).description(withLocale: posix)
        if s.hasPrefix("-") { s.removeFirst() }
        let parts = s.split(separator: ".", omittingEmptySubsequences: false)
        var intPart = String(parts[0]), frac = parts.count > 1 ? String(parts[1]) : ""
        if intPart.isEmpty { intPart = "0" }
        if frac.count < places { frac += String(repeating: "0", count: places - frac.count) }
        return places > 0 ? intPart + "." + frac.prefix(places) : intPart
    }

    static let posix = Locale(identifier: "en_US_POSIX")

    /// "1.500" -> "1.5", "2.0" -> "2".
    public static func trimZeros(_ s: String) -> String {
        guard s.contains(".") else { return s }
        var t = s
        while t.hasSuffix("0") { t.removeLast() }
        if t.hasSuffix(".") { t.removeLast() }
        return t
    }

    static func pad(_ s: String, _ n: Int, _ ch: Character = "0") -> String {
        s.count >= n ? s : String(repeating: ch, count: n - s.count) + s
    }

    // MARK: Dates

    static let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    static let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    /// A serial's calendar date and time of day. The 1900 system counts from 1899-12-30 (Excel's phantom 1900-02-29
    /// makes serials under 61 one day off from that base, so they count from 1899-12-31).
    public static func components(_ serial: Double, date1904: Bool = false, subsecondPlaces: Int = 0) -> DateComponents {
        var days = floor(serial)
        let scale = pow(10, Double(subsecondPlaces))
        var secs = ((serial - days) * 86_400 * scale).rounded(.toNearestOrAwayFromZero) / scale
        if secs >= 86_400 { days += 1; secs -= 86_400 }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let base = date1904 ? DateComponents(year: 1904, month: 1, day: 1) : DateComponents(year: 1899, month: 12, day: serial < 61 ? 31 : 30)
        let start = cal.date(from: base)!
        let day = cal.date(byAdding: .day, value: Int(days), to: start)!
        var out = cal.dateComponents([.year, .month, .day, .weekday], from: day)
        let whole = Int(secs)
        out.hour = whole / 3600
        out.minute = (whole % 3600) / 60
        out.second = whole % 60
        out.nanosecond = Int(((secs - Double(whole)) * 1e9).rounded())
        return out
    }

    static func date(_ serial: Double, _ toks: [Tok], date1904: Bool) -> String {
        // sub-second places: a point and zeros right after seconds
        var places = 0
        for (i, t) in toks.enumerated() where t == .point {
            var j = i + 1
            while j < toks.count && toks[j] == .digit("0") { places += 1; j += 1 }
        }
        let c = components(serial, date1904: date1904, subsecondPlaces: places)
        let twelve = toks.contains { if case .ampm = $0 { return true }; return false }
        let dateAts = toks.indices.filter { if case .date = toks[$0] { return true }; if case .elapsed = toks[$0] { return true }; return false }
        func kind(_ i: Int) -> Character? {
            switch toks[i] {
            case .date(let s): return s.first
            case .elapsed(let ch, _): return ch
            default: return nil
            }
        }
        var out = ""
        var i = 0
        while i < toks.count {
            let t = toks[i]
            switch t {
            case .lit(let l): out += l
            case .date(let s):
                let n = s.count
                switch s.first! {
                case "y": out += n <= 2 ? pad(String(c.year! % 100), 2) : String(c.year!)
                case "d":
                    switch n {
                    case 1: out += String(c.day!)
                    case 2: out += pad(String(c.day!), 2)
                    case 3: out += String(days[c.weekday! - 1].prefix(3))
                    default: out += days[c.weekday! - 1]
                    }
                case "h":
                    var h = c.hour!
                    if twelve { h = h % 12 == 0 ? 12 : h % 12 }
                    out += n >= 2 ? pad(String(h), 2) : String(h)
                case "s": out += n >= 2 ? pad(String(c.second!), 2) : String(c.second!)
                case "m":
                    let at = dateAts.firstIndex(of: i)!
                    let prev = at > 0 ? kind(dateAts[at - 1]) : nil
                    let next = at + 1 < dateAts.count ? kind(dateAts[at + 1]) : nil
                    if n <= 2 && (prev == "h" || next == "s") {
                        out += n == 2 ? pad(String(c.minute!), 2) : String(c.minute!)
                    } else {
                        let name = months[c.month! - 1]
                        switch n {
                        case 1: out += String(c.month!)
                        case 2: out += pad(String(c.month!), 2)
                        case 3: out += String(name.prefix(3))
                        case 4: out += name
                        default: out += String(name.prefix(1))
                        }
                    }
                default: break
                }
            case .ampm(let original):
                let pm = c.hour! >= 12
                let word = original.count == 5 ? (pm ? "PM" : "AM") : (pm ? "P" : "A")
                out += original.first!.isLowercase ? word.lowercased() : word
            case .elapsed(let ch, let n):
                let total = serial * 86_400
                let v: Int
                switch ch {
                case "h": v = Int(floor((total + 0.5) / 3600))
                case "m": v = Int(floor((total + 0.5) / 60))
                default: v = Int(total.rounded())
                }
                out += pad(String(v), n)
            case .point:
                if places > 0 {
                    let frac = Double(c.nanosecond!) / 1e9
                    let digits = String(format: "%.\(places)f", frac).split(separator: ".").last.map(String.init) ?? ""
                    out += "." + digits
                    i += places
                } else { out += "." }
            case .digit(let d): out.append(d)
            case .comma: out += ","
            case .slash: out += "/"
            case .percent: out += "%"
            default: break
            }
            i += 1
        }
        return out
    }
}
