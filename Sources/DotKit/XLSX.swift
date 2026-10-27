import Foundation

/// A read-only .xlsx reader for the notch viewer (parity H3): the workbook's sheets, shared strings and styles, each
/// sheet's cells (cached values; "=formula" when a formula has none), number formats, fonts and fills, column
/// widths, frozen panes and merges. Never writes. Dot's own code over ZipReader and Foundation's XMLParser.
public struct XLSXWorkbook {
    public let sheets: [XLSXSheet]
    public let date1904: Bool

    public enum Failure: Error, Equatable { case missing(String), xml(String) }

    public init(url: URL, maxCells: Int = 400_000) throws { try self.init(data: Data(contentsOf: url), maxCells: maxCells) }

    public init(data: Data, maxCells: Int = 400_000) throws {
        let zip = try ZipReader(data: data)
        func part(_ name: String) -> Data? { zip.entries[name] == nil ? nil : try? zip.read(name) }

        // the workbook part, from the package rels (almost always xl/workbook.xml)
        let rootRels = part("_rels/.rels").map { XLSXPaths.relationships($0, base: "") } ?? []
        let workbookPath = rootRels.first { $0.type.hasSuffix("/officeDocument") }?.target ?? "xl/workbook.xml"
        guard let workbookXML = part(workbookPath) else { throw Failure.missing(workbookPath) }
        let base = (workbookPath as NSString).deletingLastPathComponent
        let rels = part(XLSXPaths.relsPath(for: workbookPath)).map { XLSXPaths.relationships($0, base: base) } ?? []
        func target(_ suffix: String, _ fallback: String) -> String { rels.first { $0.type.hasSuffix(suffix) }?.target ?? fallback }

        // sheets in tab order, and the date system
        var listed: [(name: String, rel: String, hidden: Bool)] = []
        var date1904 = false
        try XMLWalk.run(workbookXML, start: { name, a in
            switch name {
            case "workbookPr": date1904 = XMLWalk.flag(a["date1904"])
            case "sheet":
                let rel = a.first { $0.key == "id" || $0.key.hasSuffix(":id") }?.value ?? ""
                listed.append((a["name"] ?? "Sheet", rel, (a["state"] ?? "visible") != "visible"))
            default: break
            }
        })
        self.date1904 = date1904

        let strings = try part(target("/sharedStrings", "xl/sharedStrings.xml")).map(XLSXParts.sharedStrings) ?? []
        let theme = try part(target("/theme", "xl/theme/theme1.xml")).map(XLSXParts.theme) ?? []
        let styles = try part(target("/styles", "xl/styles.xml")).map { try XLSXParts.styles($0, theme: theme) } ?? []

        var sheets: [XLSXSheet] = []
        var budget = maxCells
        for (n, entry) in listed.enumerated() {
            let path = rels.first { $0.id == entry.rel }?.target ?? "xl/worksheets/sheet\(n + 1).xml"
            guard let xml = part(path) else { continue }   // a chartsheet or a missing part: no grid to show
            let sheet = try XLSXParts.sheet(xml, name: entry.name, hidden: entry.hidden, strings: strings, styles: styles,
                                            date1904: date1904, maxCells: budget)
            budget = max(0, budget - sheet.cells.count)
            sheets.append(sheet)
        }
        self.sheets = sheets
    }
}

public struct XLSXSheet {
    public let name: String
    public let hidden: Bool
    /// The used extent: one past the last row and column with a cell or a merge.
    public let rowCount: Int
    public let columnCount: Int
    /// Row-major, 0-based coordinates.
    public let cells: [XLSXCell]
    /// Column widths as the file stores them (Excel's digit units, padding included: about 7 px each at 100%), 0-based
    /// columns; others use `defaultWidth`.
    public let widths: [Int: Double]
    public let defaultWidth: Double
    public let hiddenColumns: Set<Int>
    /// Row heights in points, 0-based rows; others use `defaultHeight`.
    public let heights: [Int: Double]
    public let defaultHeight: Double
    public let hiddenRows: Set<Int>
    public let frozenRows: Int
    public let frozenColumns: Int
    public let merges: [XLSXRange]
    /// The cell cap was hit; later cells weren't read.
    public let truncated: Bool

    let index: [Int: Int]

    public init(name: String, hidden: Bool = false, cells: [XLSXCell], widths: [Int: Double] = [:], defaultWidth: Double = 9.140625,
                hiddenColumns: Set<Int> = [], heights: [Int: Double] = [:], defaultHeight: Double = 15, hiddenRows: Set<Int> = [],
                frozenRows: Int = 0, frozenColumns: Int = 0, merges: [XLSXRange] = [], truncated: Bool = false) {
        self.name = name; self.hidden = hidden; self.cells = cells; self.widths = widths; self.defaultWidth = defaultWidth
        self.hiddenColumns = hiddenColumns; self.heights = heights; self.defaultHeight = defaultHeight; self.hiddenRows = hiddenRows
        self.frozenRows = frozenRows; self.frozenColumns = frozenColumns; self.merges = merges; self.truncated = truncated
        var index: [Int: Int] = [:]
        var maxRow = -1, maxCol = -1
        for (i, c) in cells.enumerated() {
            index[c.row &* 16_384 &+ c.column] = i
            maxRow = max(maxRow, c.row); maxCol = max(maxCol, c.column)
        }
        for m in merges { maxRow = max(maxRow, m.lastRow); maxCol = max(maxCol, m.lastColumn) }
        self.index = index
        rowCount = maxRow + 1
        columnCount = maxCol + 1
    }

    /// A delimited text file (.csv, .tsv) as a sheet: numbers right-aligned as written, the first row frozen as headers,
    /// columns sized to their longest value (capped).
    public static func table(name: String, text: String, separator: Character = ",", maxCells: Int = 400_000) -> XLSXSheet {
        var cells: [XLSXCell] = []
        var longest: [Int: Int] = [:]
        var truncated = false
        outer: for (r, row) in DelimitedText.rows(text, separator: separator).enumerated() {
            for (c, field) in row.enumerated() where !field.isEmpty {
                if cells.count >= maxCells { truncated = true; break outer }
                let plain = field.trimmingCharacters(in: .whitespaces)
                let number = Double(plain.replacingOccurrences(of: ",", with: "").replacingOccurrences(of: "$", with: "")
                    .replacingOccurrences(of: "%", with: ""))
                var style = XLSXStyle()
                if r == 0 { style.bold = true }
                cells.append(XLSXCell(row: r, column: c, value: number.map { .number($0) } ?? .text(field), formula: nil, shown: field,
                                      formatColor: nil, style: style))
                longest[c] = max(longest[c] ?? 0, field.count)
            }
        }
        let widths = longest.mapValues { min(60, max(9.140625, Double($0) * 1.1 + 2)) }
        return XLSXSheet(name: name, cells: cells, widths: widths, frozenRows: cells.isEmpty ? 0 : 1, truncated: truncated)
    }

    public func cell(row: Int, column: Int) -> XLSXCell? { index[row &* 16_384 &+ column].map { cells[$0] } }
    public func width(column: Int) -> Double { widths[column] ?? defaultWidth }
    public func height(row: Int) -> Double { heights[row] ?? defaultHeight }
    /// The merge covering a cell, if any.
    public func merge(row: Int, column: Int) -> XLSXRange? { merges.first { $0.contains(row: row, column: column) } }
}

public struct XLSXRange: Equatable {
    public let firstRow: Int, firstColumn: Int, lastRow: Int, lastColumn: Int

    public init(firstRow: Int, firstColumn: Int, lastRow: Int, lastColumn: Int) {
        self.firstRow = firstRow; self.firstColumn = firstColumn; self.lastRow = lastRow; self.lastColumn = lastColumn
    }

    /// "B2:D4", or one cell "B2".
    public init?(ref: String) {
        let ends = ref.split(separator: ":").map(String.init)   // "" and ":" give no parts: a damaged file, not a crash
        guard ends.count <= 2, let first = ends.first, let a = XLSXRef.parse(first), let b = XLSXRef.parse(ends.last ?? first) else { return nil }
        self.init(firstRow: min(a.row, b.row), firstColumn: min(a.column, b.column), lastRow: max(a.row, b.row), lastColumn: max(a.column, b.column))
    }

    public func contains(row: Int, column: Int) -> Bool {
        (firstRow...lastRow).contains(row) && (firstColumn...lastColumn).contains(column)
    }
}

public enum XLSXRef {
    /// "AB12" -> row 11, column 27 (0-based); "$A$1" works too.
    public static func parse(_ ref: String) -> (row: Int, column: Int)? {
        var col = 0, row = 0, sawLetter = false, sawDigit = false
        for ch in ref.uppercased() where ch != "$" {
            if let v = ch.asciiValue, (65...90).contains(v), !sawDigit { col = col * 26 + Int(v - 64); sawLetter = true }
            else if let d = ch.wholeNumberValue, sawLetter { row = row * 10 + d; sawDigit = true }
            else { return nil }
        }
        guard sawLetter, sawDigit, row > 0 else { return nil }
        return (row - 1, col - 1)
    }

    /// 0 -> "A", 27 -> "AB".
    public static func column(_ index: Int) -> String {
        var n = index + 1, out = ""
        while n > 0 { let r = (n - 1) % 26; out = String(UnicodeScalar(UInt8(65 + r))) + out; n = (n - 1) / 26 }
        return out
    }
}

/// Excel's shared formulas: one master cell holds `<f t="shared" si="0">B2*2</f>` and the cells filled from it hold an
/// empty `<f t="shared" si="0"/>`. Each one's formula is the master's with every relative reference moved by the
/// distance between the two cells, as filling does; `$` parts stay. Strings, quoted sheet names and bracketed parts
/// (tables, other workbooks) are left as written.
public enum XLSXFormula {
    static let maxRow = 1_048_576, maxColumn = 16_384

    public static func shift(_ formula: String, rows: Int, columns: Int) -> String {
        guard rows != 0 || columns != 0 else { return formula }
        let c = Array(formula)
        var out = ""
        var i = 0
        while i < c.count {
            let ch = c[i]
            if ch == "\"" || ch == "'" {
                var j = i + 1
                while j < c.count {
                    if c[j] == ch { if j + 1 < c.count, c[j + 1] == ch { j += 2; continue }; break }
                    j += 1
                }
                let end = min(j, c.count - 1)
                out += String(c[i...end]); i = end + 1
                continue
            }
            if ch == "[" {
                var j = i, depth = 0
                repeat { if c[j] == "[" { depth += 1 } else if c[j] == "]" { depth -= 1 }; j += 1 } while j < c.count && depth > 0
                out += String(c[i..<j]); i = j
                continue
            }
            if i == 0 || !word(c[i - 1]), let end = sheetRange(c, at: i) {   // a 3-D reference's sheets stay as named
                out += String(c[i..<end]); i = end
                continue
            }
            if i == 0 || !word(c[i - 1]), let (text, next) = reference(c, at: i, rows: rows, columns: columns) {
                out += text; i = next
                continue
            }
            out.append(ch); i += 1
        }
        return out
    }

    private static func word(_ ch: Character) -> Bool { ch.isLetter || ch.isNumber || ch == "_" || ch == "." || ch == "$" }

    /// `S1:S3!` at `at`, an unquoted range of sheets: where the names end (at the `!`). Its names can look like cells.
    private static func sheetRange(_ c: [Character], at: Int) -> Int? {
        func name(_ j: Int) -> Int {
            var k = j
            while k < c.count, c[k].isLetter || c[k].isNumber || c[k] == "_" || c[k] == "." { k += 1 }
            return k
        }
        let a = name(at)
        guard a > at, a < c.count, c[a] == ":" else { return nil }
        let b = name(a + 1)
        guard b > a + 1, b < c.count, c[b] == "!" else { return nil }
        return b
    }

    /// `[$]letters` (either case, as Excel reads them) or `[$]digits` from `at`: the part, whether it was absolute, its
    /// text as written, and where it ends.
    private static func part(_ c: [Character], _ at: Int, letters: Bool) -> (value: Int, absolute: Bool, text: String, end: Int)? {
        var j = at
        let absolute = j < c.count && c[j] == "$"
        if absolute { j += 1 }
        var value = 0, count = 0
        while j < c.count, let a = c[j].asciiValue, letters ? (65...90).contains(a) || (97...122).contains(a) : (48...57).contains(a) {
            value = letters ? value * 26 + Int((a >= 97 ? a - 32 : a) - 64) : value * 10 + Int(a - 48)
            count += 1; j += 1
            if count > (letters ? 3 : 7) { return nil }
        }
        return count == 0 ? nil : (value, absolute, String(c[at..<j]), j)
    }

    /// A moved part comes out in capitals (as openpyxl's translator writes it); a `$` part stays as written.
    private static func moved(_ p: (value: Int, absolute: Bool, text: String, end: Int), by: Int, limit: Int, letters: Bool) -> String? {
        if p.absolute { return p.text }
        let v = p.value + by
        guard (1...limit).contains(v) else { return nil }
        return letters ? XLSXRef.column(v - 1) : String(v)
    }

    /// A cell (B2), a column range (B:D) or a row range (2:5) starting at `at`, moved; nil when there is none there.
    private static func reference(_ c: [Character], at: Int, rows: Int, columns: Int) -> (String, Int)? {
        func ends(_ j: Int) -> Bool { j >= c.count || !(word(c[j]) || c[j] == "(" || c[j] == "!") }
        if let col = part(c, at, letters: true), col.value <= maxColumn {
            if let row = part(c, col.end, letters: false), row.value >= 1, row.value <= maxRow, ends(row.end) {
                guard let a = moved(col, by: columns, limit: maxColumn, letters: true),
                      let b = moved(row, by: rows, limit: maxRow, letters: false) else { return ("#REF!", row.end) }
                return (a + b, row.end)
            }
            if col.end < c.count, c[col.end] == ":", let other = part(c, col.end + 1, letters: true), other.value <= maxColumn, ends(other.end) {
                guard let a = moved(col, by: columns, limit: maxColumn, letters: true),
                      let b = moved(other, by: columns, limit: maxColumn, letters: true) else { return ("#REF!", other.end) }
                return (a + ":" + b, other.end)
            }
            return nil
        }
        if let first = part(c, at, letters: false), first.end < c.count, c[first.end] == ":",
           let other = part(c, first.end + 1, letters: false), ends(other.end) {
            guard let a = moved(first, by: rows, limit: maxRow, letters: false),
                  let b = moved(other, by: rows, limit: maxRow, letters: false) else { return ("#REF!", other.end) }
            return (a + ":" + b, other.end)
        }
        return nil
    }
}

public struct XLSXCell: Equatable {
    public enum Value: Equatable { case number(Double), text(String), bool(Bool), error(String), empty }

    public init(row: Int, column: Int, value: Value, formula: String?, shown: String, formatColor: String?, style: XLSXStyle) {
        self.row = row; self.column = column; self.value = value; self.formula = formula; self.shown = shown
        self.formatColor = formatColor; self.style = style
    }

    public let row: Int
    public let column: Int
    public let value: Value
    public let formula: String?
    /// What Excel shows: the value under the cell's number format.
    public let shown: String
    /// The number format's color tag ("Red" for a red negative), if its section has one.
    public let formatColor: String?
    public let style: XLSXStyle

    public var isNumber: Bool { if case .number = value { return true }; return false }
}

public struct XLSXStyle: Equatable {
    public var format = "General"
    public var bold = false
    public var italic = false
    public var underline = false
    public var size: Double?
    /// "RRGGBB"; nil is the default (automatic) color.
    public var fontColor: String?
    public var fill: String?
    /// The horizontal alignment as written ("left", "center", "right", ...); nil is general.
    public var align: String?
    public var indent = 0

    public init() {}
}

// MARK: Parts

enum XLSXPaths {
    struct Rel { let id: String; let type: String; let target: String }

    static func relsPath(for part: String) -> String {
        let dir = (part as NSString).deletingLastPathComponent
        let file = (part as NSString).lastPathComponent
        return (dir.isEmpty ? "" : dir + "/") + "_rels/" + file + ".rels"
    }

    static func relationships(_ data: Data, base: String) -> [Rel] {
        var out: [Rel] = []
        try? XMLWalk.run(data, start: { name, a in
            guard name == "Relationship", let target = a["Target"], (a["TargetMode"] ?? "") != "External" else { return }
            out.append(Rel(id: a["Id"] ?? "", type: a["Type"] ?? "", target: resolve(target, base: base)))
        })
        return out
    }

    /// A relationship target against its part's folder: "worksheets/sheet1.xml" -> "xl/worksheets/sheet1.xml",
    /// "/xl/x.xml" -> "xl/x.xml", "../a.xml" climbs.
    static func resolve(_ target: String, base: String) -> String {
        if target.hasPrefix("/") { return String(target.dropFirst()) }
        var parts = base.split(separator: "/").map(String.init)
        for piece in target.split(separator: "/").map(String.init) {
            if piece == ".." { _ = parts.popLast() } else if piece != "." { parts.append(piece) }
        }
        return parts.joined(separator: "/")
    }
}

enum XLSXParts {
    /// A formula as Excel's bar shows it: without the file format's future-function prefixes.
    static func readable(_ formula: String) -> String {
        formula.replacingOccurrences(of: "_xlfn._xlws.", with: "").replacingOccurrences(of: "_xlfn.", with: "")
            .replacingOccurrences(of: "_xlws.", with: "").replacingOccurrences(of: "_xlpm.", with: "")
    }

    static func sharedStrings(_ data: Data) throws -> [String] {
        var out: [String] = []
        var cur = "", inT = false, phonetic = 0
        try XMLWalk.run(data, start: { name, _ in
            switch name {
            case "si": cur = ""
            case "rPh": phonetic += 1
            case "t": inT = phonetic == 0
            default: break
            }
        }, end: { name in
            switch name {
            case "si": out.append(cur)
            case "rPh": phonetic -= 1
            case "t": inT = false
            default: break
            }
        }, text: { if inT { cur += $0 } })
        return out
    }

    /// The theme's colors in Excel's index order: lt1, dk1, lt2, dk2, accent1-6, hlink, folHlink.
    static func theme(_ data: Data) throws -> [String] {
        var scheme: [String: String] = [:]
        var slot: String?
        var inScheme = false
        try XMLWalk.run(data, start: { name, a in
            if name == "clrScheme" { inScheme = true; return }
            guard inScheme else { return }
            if ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"].contains(name) {
                slot = name
            } else if let s = slot, scheme[s] == nil {
                if name == "srgbClr", let v = a["val"] { scheme[s] = v.uppercased() }
                if name == "sysClr", let v = a["lastClr"] { scheme[s] = v.uppercased() }
            }
        }, end: { name in
            if name == "clrScheme" { inScheme = false }
            if name == slot { slot = nil }
        })
        return ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"]
            .map { scheme[$0] ?? "000000" }
    }

    static func styles(_ data: Data, theme: [String]) throws -> [XLSXStyle] {
        // colors are kept as written and resolved at the end: a workbook's own palette (<colors><indexedColors>, common
        // in old banking templates) comes after the fonts and fills that use it
        struct Font { var bold = false, italic = false, underline = false, size: Double?, color: [String: String]? }
        var formats: [Int: String] = [:]
        var fonts: [Font] = [], fills: [[String: String]?] = []
        var palette: [String] = []
        var xfs: [(fmt: Int, font: Int, fill: Int, align: String?, indent: Int)] = []
        var stack: [String] = []
        var font = Font(), fill: [String: String]?, solid = false
        try XMLWalk.run(data, start: { name, a in
            let parent = stack.last ?? ""
            let grand = stack.count > 1 ? stack[stack.count - 2] : ""
            stack.append(name)
            switch name {
            case "numFmt": if let id = a["numFmtId"].flatMap(Int.init), let code = a["formatCode"] { formats[id] = code }
            case "font" where parent == "fonts": font = Font()
            case "b" where parent == "font" && grand == "fonts": font.bold = XMLWalk.flag(a["val"], default: true)
            case "i" where parent == "font" && grand == "fonts": font.italic = XMLWalk.flag(a["val"], default: true)
            case "u" where parent == "font" && grand == "fonts": font.underline = (a["val"] ?? "single") != "none"
            case "sz" where parent == "font" && grand == "fonts": font.size = a["val"].flatMap(Double.init)
            case "color" where parent == "font" && grand == "fonts": font.color = a
            case "fill" where parent == "fills": fill = nil; solid = false
            case "patternFill" where grand == "fills": solid = (a["patternType"] ?? "none") == "solid"
            case "fgColor" where stack.dropLast().suffix(3) == ["fills", "fill", "patternFill"][...]:
                if solid { fill = a }
            case "rgbColor" where parent == "indexedColors": palette.append(String((a["rgb"] ?? "000000").suffix(6)).uppercased())
            case "xf" where parent == "cellXfs":
                xfs.append((Int(a["numFmtId"] ?? "0") ?? 0, Int(a["fontId"] ?? "0") ?? 0, Int(a["fillId"] ?? "0") ?? 0, nil, 0))
            case "alignment" where grand == "cellXfs" && !xfs.isEmpty:
                xfs[xfs.count - 1].align = a["horizontal"].flatMap { $0 == "general" ? nil : $0 }
                xfs[xfs.count - 1].indent = Int(a["indent"] ?? "0") ?? 0
            default: break
            }
        }, end: { name in
            _ = stack.popLast()
            let parent = stack.last ?? ""
            if name == "font" && parent == "fonts" { fonts.append(font) }
            if name == "fill" && parent == "fills" { fills.append(fill) }
        })
        let indexed = palette.count >= 8 ? palette : XLSXColor.indexed
        func resolve(_ a: [String: String]?) -> String? { a.flatMap { XLSXColor.resolve($0, theme: theme, indexed: indexed) } }
        let fontColors = fonts.map { resolve($0.color) }
        let fillColors = fills.map(resolve)
        return xfs.map { xf in
            var s = XLSXStyle()
            s.format = formats[xf.fmt] ?? ExcelFormat.builtin(xf.fmt) ?? "General"
            if fonts.indices.contains(xf.font) {
                let f = fonts[xf.font]
                s.bold = f.bold; s.italic = f.italic; s.underline = f.underline; s.size = f.size; s.fontColor = fontColors[xf.font]
            }
            if fills.indices.contains(xf.fill) { s.fill = fillColors[xf.fill] }
            s.align = xf.align
            s.indent = xf.indent
            return s
        }
    }

    static func sheet(_ data: Data, name: String, hidden: Bool, strings: [String], styles: [XLSXStyle],
                      date1904: Bool, maxCells: Int) throws -> XLSXSheet {
        var cells: [XLSXCell] = []
        var widths: [Int: Double] = [:], hiddenCols: Set<Int> = []
        var heights: [Int: Double] = [:], hiddenRows: Set<Int> = []
        var defaultWidth: Double?, baseWidth: Double?, defaultHeight = 15.0
        var frozenRows = 0, frozenCols = 0, sawView = false
        var merges: [XLSXRange] = []
        var truncated = false
        var row = -1, col = -1
        // the cell being read
        var ref: (row: Int, column: Int)?, type = "n", styleIndex = 0
        var v: String?, f: String?, inline: String?
        var sharedIndex: String?   // the cell's <f t="shared" si>
        var shared: [String: (row: Int, column: Int, text: String)] = [:]   // si -> its master cell's formula
        var capture: String?   // "v", "f" or "t"
        var inIs = false, phonetic = 0
        var parsed: [String: [ExcelFormat.Section]] = [:]   // format code -> sections, tokenized once per sheet
        func sections(_ code: String) -> [ExcelFormat.Section] {
            if let hit = parsed[code] { return hit }
            let made = code.isEmpty ? [] : ExcelFormat.sections(code)
            parsed[code] = made
            return made
        }

        func finishCell() {
            guard let at = ref else { return }
            let style = styles.indices.contains(styleIndex) ? styles[styleIndex] : XLSXStyle()
            var value = XLSXCell.Value.empty
            switch type {
            case "s": if let i = v.flatMap({ Int($0.trimmingCharacters(in: .whitespaces)) }), strings.indices.contains(i) { value = .text(strings[i]) }
            case "inlineStr": if let s = inline ?? v { value = .text(s) }   // no <is> at all is an empty cell
            case "str": if let v { value = .text(v) }
            case "b": if let v { value = .bool(v.trimmingCharacters(in: .whitespaces) == "1" || v.lowercased() == "true") }
            case "e": if let v { value = .error(v) }
            case "d":
                if let v, let date = XLSXDates.iso(v) { value = .number(XLSXDates.serial(date, date1904: date1904)) }
            default: if let n = v.flatMap({ Double($0.trimmingCharacters(in: .whitespaces)) }) { value = .number(n) }
            }
            var formula = f.flatMap { $0.isEmpty ? nil : $0 }
            if let si = sharedIndex {
                if let text = formula { shared[si] = (at.row, at.column, text) }
                else if let master = shared[si] {
                    formula = XLSXFormula.shift(master.text, rows: at.row - master.row, columns: at.column - master.column)
                }
            }
            var shown = ExcelFormat.Shown("")
            switch value {
            case .number(let n): shown = ExcelFormat.shown(n, parsed: sections(style.format), date1904: date1904)
            case .text(let s): shown = ExcelFormat.text(s, parsed: sections(style.format))
            case .bool(let b): shown = ExcelFormat.Shown(b ? "TRUE" : "FALSE")
            case .error(let e): shown = ExcelFormat.Shown(e)
            // a formula with no usable cached value (openpyxl writes an empty <v>): show the formula
            case .empty: if let formula { shown = ExcelFormat.Shown("=" + XLSXParts.readable(formula)) }
            }
            // a styled blank cell adds nothing to the grid but its fill, or a run that centers a heading across it
            if case .empty = value, formula == nil, style.fill == nil, style.align != "centerContinuous" { return }
            if cells.count >= maxCells { truncated = true; return }
            cells.append(XLSXCell(row: at.row, column: at.column, value: value, formula: formula, shown: shown.text,
                                  formatColor: shown.color, style: style))
        }

        try XMLWalk.run(data, start: { name, a in
            switch name {
            case "sheetFormatPr":
                defaultWidth = a["defaultColWidth"].flatMap(Double.init)
                baseWidth = a["baseColWidth"].flatMap(Double.init)
                if let h = a["defaultRowHeight"].flatMap(Double.init) { defaultHeight = h }
            case "pane" where !sawView:
                let state = a["state"] ?? ""
                if state == "frozen" || state == "frozenSplit" {
                    frozenCols = Int(Double(a["xSplit"] ?? "0") ?? 0)
                    frozenRows = Int(Double(a["ySplit"] ?? "0") ?? 0)
                }
            case "col":
                guard let lo = a["min"].flatMap(Int.init), let hi = a["max"].flatMap(Int.init), lo >= 1, hi >= lo else { break }
                for c in (lo - 1)..<min(hi, 16_384) {
                    if let w = a["width"].flatMap(Double.init) { widths[c] = w }
                    if XMLWalk.flag(a["hidden"]) { hiddenCols.insert(c) }
                }
            case "row":
                row = a["r"].flatMap(Int.init).map { $0 - 1 } ?? row + 1
                col = -1
                if let h = a["ht"].flatMap(Double.init), XMLWalk.flag(a["customHeight"]) || h != defaultHeight { heights[row] = h }
                if XMLWalk.flag(a["hidden"]) { hiddenRows.insert(row) }
            case "c":
                if let r = a["r"], let at = XLSXRef.parse(r) { ref = at } else { ref = (max(row, 0), col + 1) }
                col = ref!.column
                type = a["t"] ?? "n"
                styleIndex = Int(a["s"] ?? "0") ?? 0
                v = nil; f = nil; inline = nil; sharedIndex = nil
            case "v": capture = "v"; v = v ?? ""
            case "f":
                capture = "f"; f = f ?? ""
                if a["t"] == "shared" { sharedIndex = a["si"] }
            case "is": inIs = true; inline = inline ?? ""
            case "rPh": phonetic += 1
            case "t" where inIs && phonetic == 0: capture = "t"
            case "mergeCell": if let r = a["ref"], let range = XLSXRange(ref: r) { merges.append(range) }
            default: break
            }
        }, end: { name in
            switch name {
            case "v", "f", "t": capture = nil
            case "is": inIs = false
            case "rPh": phonetic -= 1
            case "c": finishCell(); ref = nil
            case "sheetView": sawView = true
            default: break
            }
        }, text: { s in
            switch capture {
            case "v": v! += s
            case "f": f! += s
            case "t": inline! += s
            default: break
            }
        }, stop: { truncated })

        // Excel's default width when the sheet names none: the base width (8 digits) plus padding, in file units (64 px)
        let fallbackWidth = defaultWidth ?? ((baseWidth ?? 8) + 1.140625)
        return XLSXSheet(name: name, hidden: hidden, cells: cells, widths: widths, defaultWidth: fallbackWidth,
                         hiddenColumns: hiddenCols, heights: heights, defaultHeight: defaultHeight, hiddenRows: hiddenRows,
                         frozenRows: frozenRows, frozenColumns: frozenCols, merges: merges, truncated: truncated)
    }
}

/// RFC 4180 rows: quoted fields may hold the separator, doubled quotes and line breaks; CRLF or LF ends a row.
public enum DelimitedText {
    public static func rows(_ text: String, separator: Character = ",") -> [[String]] {
        var rows: [[String]] = []
        var row: [String] = []
        var field = ""
        var quoted = false, atStart = true
        var chars = text.makeIterator()
        var pending: Character? = nil
        func next() -> Character? { if let p = pending { pending = nil; return p }; return chars.next() }
        while let ch = next() {
            if quoted {
                if ch == "\"" {
                    if let after = next() {
                        if after == "\"" { field.append("\"") } else { quoted = false; pending = after }
                    } else { quoted = false }
                } else { field.append(ch) }
                continue
            }
            switch ch {
            case "\"" where atStart: quoted = true; atStart = false
            case separator: row.append(field); field = ""; atStart = true
            case "\n", "\r\n", "\r":
                row.append(field); rows.append(row); row = []; field = ""; atStart = true
            default: field.append(ch); atStart = false
            }
        }
        if !field.isEmpty || !row.isEmpty { row.append(field); rows.append(row) }
        return rows
    }

    /// The separator a file most likely uses: tab for .tsv, else whichever of , ; tab is most common in the first line.
    public static func separator(for text: String, pathExtension: String) -> Character {
        if pathExtension.lowercased() == "tsv" { return "\t" }
        let first = text.prefix { $0 != "\n" && $0 != "\r\n" }
        return ([",", ";", "\t"] as [Character]).max { a, b in first.filter { $0 == a }.count < first.filter { $0 == b }.count } ?? ","
    }
}

enum XLSXDates {
    static func iso(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        for options: ISO8601DateFormatter.Options in [[.withInternetDateTime], [.withFullDate, .withTime, .withColonSeparatorInTime],
                                                      [.withFullDate]] {
            f.formatOptions = options
            f.timeZone = TimeZone(identifier: "UTC")
            if let d = f.date(from: s) { return d }
        }
        return nil
    }

    static func serial(_ date: Date, date1904: Bool) -> Double {
        let base = date1904 ? -2_082_844_800.0 : -2_209_161_600.0   // 1904-01-01 and 1899-12-30, UTC
        return (date.timeIntervalSince1970 - base) / 86_400
    }
}

enum XLSXColor {
    /// The legacy 64-color palette for `indexed` colors (64 and up are the system colors: automatic).
    static let indexed = [
        "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF",
        "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF",
        "800000", "008000", "000080", "808000", "800080", "008080", "C0C0C0", "808080",
        "9999FF", "993366", "FFFFCC", "CCFFFF", "660066", "FF8080", "0066CC", "CCCCFF",
        "000080", "FF00FF", "FFFF00", "00FFFF", "800080", "800000", "008080", "0000FF",
        "00CCFF", "CCFFFF", "CCFFCC", "FFFF99", "99CCFF", "FF99CC", "CC99FF", "FFCC99",
        "3366FF", "33CCCC", "99CC00", "FFCC00", "FF9900", "FF6600", "666699", "969696",
        "003366", "339966", "003300", "333300", "993300", "993366", "333399", "333333",
    ]

    /// A <color> element's attributes as "RRGGBB": rgb (ARGB), theme + tint, or indexed; nil for automatic.
    static func resolve(_ a: [String: String], theme: [String], indexed palette: [String] = indexed) -> String? {
        var base: String?
        if let rgb = a["rgb"], rgb.count >= 6 { base = String(rgb.suffix(6)).uppercased() }
        else if let t = a["theme"].flatMap(Int.init), theme.indices.contains(t) { base = theme[t] }
        else if let i = a["indexed"].flatMap(Int.init), palette.indices.contains(i) { base = palette[i] }
        guard let base else { return nil }
        guard let tint = a["tint"].flatMap(Double.init), tint != 0 else { return base }
        return tinted(base, tint)
    }

    /// Excel's tint: lightness scaled toward black (negative) or white (positive) in HLS.
    static func tinted(_ hex: String, _ tint: Double) -> String {
        guard let v = Int(hex, radix: 16) else { return hex }
        let r = Double((v >> 16) & 255) / 255, g = Double((v >> 8) & 255) / 255, b = Double(v & 255) / 255
        let mx = max(r, g, b), mn = min(r, g, b)
        var h = 0.0, s = 0.0
        var l = (mx + mn) / 2
        if mx != mn {
            let d = mx - mn
            s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
            if mx == r { h = (g - b) / d + (g < b ? 6 : 0) } else if mx == g { h = (b - r) / d + 2 } else { h = (r - g) / d + 4 }
            h /= 6
        }
        l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint
        func channel(_ p: Double, _ q: Double, _ t0: Double) -> Double {
            var t = t0
            if t < 0 { t += 1 }
            if t > 1 { t -= 1 }
            if t < 1.0 / 6 { return p + (q - p) * 6 * t }
            if t < 0.5 { return q }
            if t < 2.0 / 3 { return p + (q - p) * (2.0 / 3 - t) * 6 }
            return p
        }
        let (rr, gg, bb): (Double, Double, Double)
        if s == 0 { (rr, gg, bb) = (l, l, l) } else {
            let q = l < 0.5 ? l * (1 + s) : l + s - l * s
            let p = 2 * l - q
            (rr, gg, bb) = (channel(p, q, h + 1.0 / 3), channel(p, q, h), channel(p, q, h - 1.0 / 3))
        }
        func byte(_ x: Double) -> Int { Int((min(1, max(0, x)) * 255).rounded()) }
        return String(format: "%02X%02X%02X", byte(rr), byte(gg), byte(bb))
    }
}

/// Foundation's XMLParser as three callbacks, with namespace prefixes dropped from element names and attributes keyed
/// as written. `stop` ends the walk early (not an error).
final class XMLWalk: NSObject, XMLParserDelegate {
    private let onStart: (String, [String: String]) -> Void
    private let onEnd: (String) -> Void
    private let onText: (String) -> Void
    private let shouldStop: () -> Bool
    private(set) var stopped = false

    private init(start: @escaping (String, [String: String]) -> Void, end: @escaping (String) -> Void,
                 text: @escaping (String) -> Void, stop: @escaping () -> Bool) {
        onStart = start; onEnd = end; onText = text; shouldStop = stop
    }

    static func run(_ data: Data, start: @escaping (String, [String: String]) -> Void, end: @escaping (String) -> Void = { _ in },
                    text: @escaping (String) -> Void = { _ in }, stop: @escaping () -> Bool = { false }) throws {
        let walk = XMLWalk(start: start, end: end, text: text, stop: stop)
        let parser = XMLParser(data: data)
        parser.shouldResolveExternalEntities = false
        parser.delegate = walk
        if !parser.parse() && !walk.stopped {
            throw XLSXWorkbook.Failure.xml(parser.parserError?.localizedDescription ?? "unreadable XML")
        }
    }

    static func local(_ name: String) -> String {
        guard let colon = name.lastIndex(of: ":") else { return name }
        return String(name[name.index(after: colon)...])
    }

    /// An OOXML boolean attribute ("1", "true", "on").
    static func flag(_ s: String?, default fallback: Bool = false) -> Bool {
        guard let s else { return fallback }
        return ["1", "true", "on"].contains(s.lowercased())
    }

    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?, qualifiedName qName: String?,
                attributes attributeDict: [String: String] = [:]) {
        onStart(Self.local(elementName), attributeDict)
        if shouldStop() { stopped = true; parser.abortParsing() }
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName qName: String?) {
        onEnd(Self.local(elementName))
        if shouldStop() { stopped = true; parser.abortParsing() }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) { onText(string) }

    func parser(_ parser: XMLParser, foundCDATA CDATABlock: Data) { onText(String(decoding: CDATABlock, as: UTF8.self)) }
}
