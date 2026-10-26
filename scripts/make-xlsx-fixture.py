"""Builds DotKit's sample workbook (Sources/DotKit/XLSXSample.swift; XLSXTests and the viewer snapshot use it) and
prints it as base64.

A small model-shaped workbook: a merged title, frozen panes, column widths, finance number formats, a theme-tinted
header fill, a blue input font, dates, a rich-text shared string, a hidden sheet. openpyxl writes no cached formula
values or shared strings, so the script adds a cached value (C7), moves A5 and A6 into a shared-strings part (stored
uncompressed, so both zip methods are read; one entry has a phonetic run to skip) and adds an inline string (E5) by
editing the parts afterwards.

    python3 scripts/make-xlsx-fixture.py > /tmp/fixture.b64   # then paste into XLSXSample.base64
"""
import base64, datetime, io, re, sys, zipfile

import openpyxl
from openpyxl.cell.rich_text import CellRichText, TextBlock
from openpyxl.cell.text import InlineFont
from openpyxl.styles import Alignment, Color, Font, PatternFill

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Model"
ws["A1"] = "MLV Revenue Model"
ws["A1"].font = Font(bold=True, size=14)
ws.merge_cells("A1:D1")
ws["A2"] = "($ in thousands)"
ws["A2"].font = Font(italic=True)
for col, label in zip("BCD", ["FY2024A", "FY2025E", "FY2026E"]):
    c = ws[f"{col}4"]
    c.value = label
    c.font = Font(bold=True)
    c.alignment = Alignment(horizontal="center")
    c.fill = PatternFill("solid", fgColor=Color(theme=4, tint=0.7999816888943144))
paren = "#,##0.0_);(#,##0.0)"
ws["A5"] = "Revenue"
ws["B5"], ws["C5"], ws["D5"] = 1234.5, -2345.25, 0
for col in "BCD":
    ws[f"{col}5"].number_format = paren
ws["B5"].font = Font(color="FF0000FF")
ws["A6"] = "Growth %"
ws["C6"], ws["D6"] = 0.1234, -0.05
ws["C6"].number_format = ws["D6"].number_format = "0.0%"
ws["A7"] = "Check"
ws["B7"] = "=B5/B5"
ws["C7"] = "=C5*2"
ws["C7"].number_format = "$#,##0"
ws["A8"] = "Multiple"
ws["B8"] = 12.345
ws["B8"].number_format = '0.0"x"'
ws["A9"] = "Dates"
ws["B9"] = datetime.datetime(2026, 3, 18)
ws["B9"].number_format = "mmm-yy"
ws["C9"] = datetime.datetime(2026, 3, 18)
ws["C9"].number_format = "m/d/yyyy"
ws["D9"] = datetime.datetime(2026, 3, 18, 14, 5)
ws["D9"].number_format = "yyyy-mm-dd hh:mm"
ws["A10"] = "Size"
ws["B10"] = 1234567.891
ws["B10"].number_format = '$#,##0.0,,"mm"'
ws["A11"] = "Accounting"
ws["B11"], ws["C11"] = 0, 1234.5
ws["B11"].number_format = ws["C11"].number_format = '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)'
ws["D11"] = -50
ws["D11"].number_format = "#,##0;[Red](#,##0)"
ws["A12"] = True
ws["B12"] = "#DIV/0!"
ws["C12"] = CellRichText([TextBlock(InlineFont(b=True), "Base"), " case"])
ws.freeze_panes = "B5"
ws.column_dimensions["A"].width = 28
for col in "BCD":
    ws.column_dimensions[col].width = 12

a = wb.create_sheet("Assumptions")
a["A1"] = "Tax rate"
a["B1"] = 0.21
a["B1"].number_format = "0%"
h = wb.create_sheet("Scratch")
h.sheet_state = "hidden"
h["A1"] = "hidden"

buf = io.BytesIO()
wb.save(buf)
src = zipfile.ZipFile(io.BytesIO(buf.getvalue()))
SHARED = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">'
          '<si><t>Revenue</t></si>'
          '<si><r><t>Growth</t></r><r><rPr><b/></rPr><t xml:space="preserve"> %</t></r><rPh sb="0" eb="1"><t>X</t></rPh></si>'
          '</sst>')
out = io.BytesIO()
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for info in src.infolist():
        data = src.read(info.filename)
        if info.filename == "[Content_Types].xml":
            data = data.replace(b"</Types>", b'<Override PartName="/xl/sharedStrings.xml" ContentType="application/'
                                b'vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>')
        if info.filename == "xl/_rels/workbook.xml.rels":
            data = data.replace(b"</Relationships>", b'<Relationship Id="rId99" Type="http://schemas.openxmlformats.org/'
                                b'officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>')
        if info.filename == "xl/worksheets/sheet1.xml":
            xml = data.decode()
            xml, n = re.subn(r'(<c r="C7"[^>]*>)<f>C5\*2</f><v\s*/?>(</v>)?', r'\1<f>C5*2</f><v>-4690.5</v>', xml)
            assert n == 1, "C7 not found"
            xml, n = re.subn(r'(<c r="D5"[^>]*>.*?</c>)', r'\1<c r="E5" t="inlineStr"><is><t>note</t></is></c>', xml)
            assert n == 1, "D5 not found"
            for ref, index, text in [("A5", 0, "Revenue"), ("A6", 1, "Growth %")]:
                xml, n = re.subn(rf'<c r="{ref}" t="inlineStr"><is><t>{re.escape(text)}</t></is></c>', f'<c r="{ref}" t="s"><v>{index}</v></c>', xml)
                assert n == 1, ref
            data = xml.encode()
        z.writestr(info, data)
    z.writestr(zipfile.ZipInfo("xl/sharedStrings.xml"), SHARED, compress_type=zipfile.ZIP_STORED)
sys.stdout.write(base64.b64encode(out.getvalue()).decode())
