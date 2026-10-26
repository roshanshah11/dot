import XCTest
@testable import DotKit

final class ExcelFormatTests: XCTestCase {
    func shown(_ v: Double, _ code: String) -> String { ExcelFormat.shown(v, code: code).text }

    func testFinanceFormats() {
        let paren = "#,##0.0_);(#,##0.0)"
        XCTAssertEqual(shown(1234.5, paren), "1,234.5 ")
        XCTAssertEqual(shown(-2345.25, paren), "(2,345.3)", "half away from zero, and the negative section drops the sign")
        XCTAssertEqual(shown(0, paren), "0.0 ")
        XCTAssertEqual(shown(0.1234, "0.0%"), "12.3%")
        XCTAssertEqual(shown(-0.05, "0.0%"), "-5.0%")
        XCTAssertEqual(shown(-4690.5, "$#,##0"), "-$4,691")
        XCTAssertEqual(shown(12.345, #"0.0"x""#), "12.3x")
        XCTAssertEqual(shown(12.35, #"0.0"x""#), "12.4x", "12.35 is 12.3499... in binary; Excel rounds its 15 digits")
        XCTAssertEqual(shown(1.005, "0.00"), "1.01")
        XCTAssertEqual(shown(1_234_567.891, #"$#,##0.0,,"mm""#), "$1.2mm")
        XCTAssertEqual(shown(1_234_567, "#,##0,"), "1,235")
        XCTAssertEqual(shown(1_234_567_890, "#,##0"), "1,234,567,890")
        XCTAssertEqual(shown(7, "000"), "007")
        XCTAssertEqual(shown(2.5, "0"), "3")
        XCTAssertEqual(shown(-2.5, "0"), "-3")
        XCTAssertEqual(shown(1, "#.##"), "1.")
        XCTAssertEqual(shown(0.5, ".00"), ".50")
        XCTAssertEqual(shown(1.5, ".00"), "1.50")
        XCTAssertEqual(shown(0.5, "#,##0.00"), "0.50")
        XCTAssertEqual(shown(123_456_789, "000-00-0000"), "123-45-6789")
    }

    func testBuiltinsAndSections() {
        let accounting = ExcelFormat.builtin(44)!
        XCTAssertEqual(shown(0, accounting), " $-   ", "the zero section's dash, with ?? spaces; the * fill is dropped")
        XCTAssertEqual(shown(1234.5, accounting), " $1,234.50 ")
        XCTAssertEqual(shown(-1234.5, accounting), " $(1,234.50)")
        XCTAssertEqual(ExcelFormat.text("Revenue", code: accounting).text, " Revenue ")
        let red = ExcelFormat.shown(-50, code: "#,##0;[Red](#,##0)")
        XCTAssertEqual(red, ExcelFormat.Shown("(50)", color: "Red"))
        XCTAssertNil(ExcelFormat.shown(50, code: "#,##0;[Red](#,##0)").color)
        XCTAssertEqual(shown(-3, "0;;"), "", "an empty section hides its values")
        XCTAssertEqual(shown(0, "0;-0;\"zero\""), "zero")
        XCTAssertEqual(shown(1500, #"[>=1000]#,##0,"K";0"#), "2K")
        XCTAssertEqual(shown(999, #"[>=1000]#,##0,"K";0"#), "999")
        XCTAssertEqual(shown(1234.5, "[$€-407]#,##0.00"), "€1,234.50")
        XCTAssertEqual(shown(5, "General"), "5")
        XCTAssertEqual(shown(5, ""), "5")
        XCTAssertEqual(shown(5, #"General" units""#), "5 units")
        XCTAssertEqual(ExcelFormat.text("abc", code: "@").text, "abc")
        XCTAssertEqual(ExcelFormat.text("abc", code: "0.0").text, "abc")
        XCTAssertEqual(ExcelFormat.builtin(9), "0%")
        XCTAssertNil(ExcelFormat.builtin(164))
    }

    func testGeneral() {
        XCTAssertEqual(ExcelFormat.general(1234.5678), "1234.5678")
        XCTAssertEqual(ExcelFormat.general(1.0 / 3), "0.333333333")
        XCTAssertEqual(ExcelFormat.general(-2.5), "-2.5")
        XCTAssertEqual(ExcelFormat.general(0), "0")
        XCTAssertEqual(ExcelFormat.general(123_456_789_012), "1.23457E+11")
        XCTAssertEqual(ExcelFormat.general(0.1 + 0.2), "0.3")
        XCTAssertEqual(ExcelFormat.general(0.000001234), "1.234E-06")
    }

    func testScientificAndFractions() {
        XCTAssertEqual(shown(12345, "0.00E+00"), "1.23E+04")
        XCTAssertEqual(shown(0.000123, "0.00E+00"), "1.23E-04")
        XCTAssertEqual(shown(99999, "0.0E+00"), "1.0E+05", "rounding up carries into the exponent")
        XCTAssertEqual(shown(12345, "##0.0E+0"), "12.3E+3")
        XCTAssertEqual(shown(1.5, "# ?/?"), "1 1/2")
        XCTAssertEqual(shown(0.25, "?/?"), "1/4")
        XCTAssertEqual(shown(0.3, "# ?/8"), " 2/8")
    }

    func testDatesAndTimes() {
        XCTAssertEqual(shown(46099, "mmm-yy"), "Mar-26")
        XCTAssertEqual(shown(46099, "m/d/yyyy"), "3/18/2026")
        XCTAssertEqual(shown(46099.58680555555, "yyyy-mm-dd hh:mm"), "2026-03-18 14:05")
        XCTAssertEqual(shown(46099, "dddd, mmmm d"), "Wednesday, March 18")
        XCTAssertEqual(shown(46099, "ddd d-mmm"), "Wed 18-Mar")
        XCTAssertEqual(shown(0.75, "h:mm AM/PM"), "6:00 PM")
        XCTAssertEqual(shown(0.25, "h:mm am/pm"), "6:00 am")
        XCTAssertEqual(shown(1.5, "[h]:mm:ss"), "36:00:00")
        XCTAssertEqual(shown(1.5 / 86_400, "mm:ss.0"), "00:01.5")
        XCTAssertEqual(shown(46099, ExcelFormat.builtin(14)!), "3/18/2026")
        // the 1900 system's phantom leap day: serial 59 is Feb 28, 61 is Mar 1, 1 is Jan 1
        XCTAssertEqual(shown(1, "yyyy-mm-dd"), "1900-01-01")
        XCTAssertEqual(shown(59, "yyyy-mm-dd"), "1900-02-28")
        XCTAssertEqual(shown(61, "yyyy-mm-dd"), "1900-03-01")
        XCTAssertEqual(ExcelFormat.shown(0, code: "yyyy-mm-dd", date1904: true).text, "1904-01-01")
        XCTAssertEqual(shown(-1, "yyyy-mm-dd"), "########")
        XCTAssertTrue(ExcelFormat.isDate("mmm-yy"))
        XCTAssertTrue(ExcelFormat.isDate("[h]:mm"))
        XCTAssertFalse(ExcelFormat.isDate("0.0%"))
        XCTAssertFalse(ExcelFormat.isDate(#"0.0"x""#))
        XCTAssertFalse(ExcelFormat.isDate("General"))
    }
}

final class XLSXTests: XCTestCase {
    var fixture: Data { XLSXSample.data }

    func testZipReaderReadsStoredAndDeflated() throws {
        let zip = try ZipReader(data: fixture)
        XCTAssertNotNil(zip.entries["xl/workbook.xml"])
        XCTAssertTrue(try zip.text("xl/sharedStrings.xml").contains("Revenue"), "stored entry")
        XCTAssertTrue(try zip.text("xl/worksheets/sheet1.xml").contains("<sheetData>"), "deflated entry")
        XCTAssertThrowsError(try ZipReader(data: Data("not a zip at all, just words".utf8))) { error in
            XCTAssertEqual(error as? ZipReader.Failure, .notZip)
        }
        XCTAssertThrowsError(try zip.read("xl/nothing.xml"))
    }

    func testWorkbookShape() throws {
        let book = try XLSXWorkbook(data: fixture)
        XCTAssertEqual(book.sheets.map(\.name), ["Model", "Assumptions", "Scratch"])
        XCTAssertEqual(book.sheets.map(\.hidden), [false, false, true])
        XCTAssertFalse(book.date1904)
        let model = book.sheets[0]
        XCTAssertEqual(model.rowCount, 12)
        XCTAssertEqual(model.columnCount, 5)
        XCTAssertEqual(model.frozenRows, 4)
        XCTAssertEqual(model.frozenColumns, 1)
        XCTAssertEqual(model.width(column: 0), 28)
        XCTAssertEqual(model.width(column: 2), 12)
        XCTAssertEqual(model.width(column: 7), 9.140625, "Excel's default: 8 digits plus padding, 64 px")
        XCTAssertEqual(model.merges, [XLSXRange(firstRow: 0, firstColumn: 0, lastRow: 0, lastColumn: 3)])
        XCTAssertNotNil(model.merge(row: 0, column: 2))
        XCTAssertNil(model.merge(row: 1, column: 2))
        XCTAssertNil(model.cell(row: 2, column: 0), "row 3 is empty")
        XCTAssertFalse(model.truncated)
        XCTAssertEqual(book.sheets[1].cell(row: 0, column: 1)?.shown, "21%")
    }

    func testCellsAsExcelShowsThem() throws {
        let model = try XLSXWorkbook(data: fixture).sheets[0]
        func at(_ ref: String) -> XLSXCell? { XLSXRef.parse(ref).flatMap { model.cell(row: $0.row, column: $0.column) } }
        let expected: [String: String] = [
            "A1": "MLV Revenue Model", "A5": "Revenue", "A6": "Growth %", "E5": "note", "C12": "Base case",
            "B4": "FY2024A", "B5": "1,234.5 ", "C5": "(2,345.3)", "D5": "0.0 ", "C6": "12.3%", "D6": "-5.0%",
            "B7": "=B5/B5", "C7": "-$4,691", "B8": "12.3x", "B9": "Mar-26", "C9": "3/18/2026", "D9": "2026-03-18 14:05",
            "B10": "$1.2mm", "B11": " $-   ", "C11": " $1,234.50 ", "D11": "(50)", "A12": "TRUE", "B12": "#DIV/0!",
        ]
        for (ref, text) in expected { XCTAssertEqual(at(ref)?.shown, text, ref) }
        XCTAssertEqual(at("A6")?.value, .text("Growth %"), "rich runs joined, the phonetic run skipped")
        XCTAssertEqual(at("C7")?.value, .number(-4690.5))
        XCTAssertEqual(at("C7")?.formula, "C5*2")
        XCTAssertEqual(at("B7")?.value, .empty, "openpyxl's empty <v> is no cached value")
        XCTAssertEqual(at("B7")?.formula, "B5/B5")
        XCTAssertEqual(at("A12")?.value, .bool(true))
        XCTAssertEqual(at("B12")?.value, .error("#DIV/0!"))
        XCTAssertEqual(at("D11")?.formatColor, "Red")
        XCTAssertTrue(at("B5")?.isNumber == true)
    }

    func testStyles() throws {
        let model = try XLSXWorkbook(data: fixture).sheets[0]
        func style(_ ref: String) -> XLSXStyle? { XLSXRef.parse(ref).flatMap { model.cell(row: $0.row, column: $0.column)?.style } }
        XCTAssertEqual(style("A1")?.bold, true)
        XCTAssertEqual(style("A1")?.size, 14)
        XCTAssertEqual(style("A2")?.italic, true)
        XCTAssertEqual(style("B5")?.fontColor, "0000FF", "the blue input font")
        XCTAssertEqual(style("B5")?.format, "#,##0.0_);(#,##0.0)")
        XCTAssertEqual(style("A5")?.fontColor, "000000", "theme 1 is dk1")
        XCTAssertEqual(style("B4")?.align, "center")
        XCTAssertEqual(style("B4")?.bold, true)
        // theme 4 is accent1 (4F81BD); Excel calls tint 0.8 "Lighter 80%" and shows it as DCE6F1
        let fill = try XCTUnwrap(style("B4")?.fill)
        let want = [0xDC, 0xE6, 0xF1]
        let got = stride(from: 0, to: 6, by: 2).map { Int(fill.dropFirst($0).prefix(2), radix: 16)! }
        for (g, w) in zip(got, want) { XCTAssertLessThanOrEqual(abs(g - w), 1, fill) }
        XCTAssertNil(style("A5")?.fill)
    }

    func testCellCapTruncates() throws {
        let book = try XLSXWorkbook(data: fixture, maxCells: 5)
        XCTAssertEqual(book.sheets[0].cells.count, 5)
        XCTAssertTrue(book.sheets[0].truncated)
    }

    func testRefsAndPaths() {
        XCTAssertEqual(XLSXRef.parse("AB12")?.row, 11)
        XCTAssertEqual(XLSXRef.parse("AB12")?.column, 27)
        XCTAssertEqual(XLSXRef.parse("$A$1")?.column, 0)
        XCTAssertNil(XLSXRef.parse("1A"))
        XCTAssertNil(XLSXRef.parse("A0"))
        XCTAssertEqual(XLSXRef.column(0), "A")
        XCTAssertEqual(XLSXRef.column(27), "AB")
        XCTAssertEqual(XLSXRef.column(701), "ZZ")
        XCTAssertEqual(XLSXRange(ref: "C3"), XLSXRange(firstRow: 2, firstColumn: 2, lastRow: 2, lastColumn: 2))
        XCTAssertEqual(XLSXPaths.resolve("worksheets/sheet1.xml", base: "xl"), "xl/worksheets/sheet1.xml")
        XCTAssertEqual(XLSXPaths.resolve("/xl/styles.xml", base: "xl"), "xl/styles.xml")
        XCTAssertEqual(XLSXPaths.resolve("../customXml/item1.xml", base: "xl"), "customXml/item1.xml")
        XCTAssertEqual(XLSXPaths.relsPath(for: "xl/workbook.xml"), "xl/_rels/workbook.xml.rels")
    }

    func testDelimitedText() {
        let csv = "name,amount,note\r\nAcme,\"1,234.5\",\"said \"\"hi\"\"\"\nBeta,-7,\"two\nlines\"\n,,\n"
        XCTAssertEqual(DelimitedText.rows(csv), [["name", "amount", "note"], ["Acme", "1,234.5", "said \"hi\""],
                                                 ["Beta", "-7", "two\nlines"], ["", "", ""]])
        XCTAssertEqual(DelimitedText.rows("a;b\n1;2", separator: ";"), [["a", "b"], ["1", "2"]])
        XCTAssertEqual(DelimitedText.rows("last,row"), [["last", "row"]], "no final newline")
        XCTAssertEqual(DelimitedText.separator(for: "a;b;c,d\n1;2;3", pathExtension: "csv"), ";")
        XCTAssertEqual(DelimitedText.separator(for: "a,b", pathExtension: "tsv"), "\t")
        let sheet = XLSXSheet.table(name: "t", text: csv)
        XCTAssertEqual(sheet.frozenRows, 1)
        XCTAssertEqual(sheet.rowCount, 3, "the all-empty last row adds no cells")
        XCTAssertEqual(sheet.cell(row: 1, column: 1)?.value, .number(1234.5))
        XCTAssertEqual(sheet.cell(row: 1, column: 1)?.shown, "1,234.5", "shown as written")
        XCTAssertEqual(sheet.cell(row: 0, column: 0)?.style.bold, true)
        XCTAssertEqual(sheet.cell(row: 2, column: 2)?.value, .text("two\nlines"))
    }

    /// His real workbooks open (read only): every sheet parses and the first holds cells. Skipped where they aren't.
    func testHisModelsOpen() throws {
        let folder = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("roshan/Finance")
        let files = ((try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? [])
            .filter { $0.pathExtension == "xlsx" && !$0.lastPathComponent.hasPrefix("~$") }
        guard !files.isEmpty else { throw XCTSkip("no ~/roshan/Finance workbooks here") }
        for url in files {
            let book = try XLSXWorkbook(url: url)
            XCTAssertFalse(book.sheets.isEmpty, url.lastPathComponent)
            XCTAssertTrue(book.sheets.contains { !$0.cells.isEmpty }, url.lastPathComponent)
        }
    }
}
