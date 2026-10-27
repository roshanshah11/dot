"""Compares Dot's xlsx reader (Dot --xlsx-dump --json) with openpyxl's cached values, read only.

    python3 scripts/check-xlsx-reader.py [Dot binary] file.xlsx ...

Per file: sheets, frozen panes, merges, every cell value (numbers to 1e-9 relative; openpyxl's dates and times are
turned back into serials) and every formula must match; openpyxl expands shared formulas (`<f t="shared" si="0"/>`)
itself, so the cells filled from one master check Dot's expansion. Prints one line per file and the mismatches;
exits 1 on any.
"""
import datetime, json, math, subprocess, sys

import openpyxl
from openpyxl.utils.datetime import to_excel
from openpyxl.worksheet.formula import ArrayFormula

args = sys.argv[1:]
dot = args.pop(0) if args and not args[0].endswith(".xlsx") else ".build/debug/Dot"
bad = 0
for path in args:
    dump = json.loads(subprocess.run([dot, "--xlsx-dump", path, "--json"], capture_output=True, text=True, check=True).stdout)
    wb = openpyxl.load_workbook(path, data_only=True)
    wbf = openpyxl.load_workbook(path)   # the formulas
    problems = []
    formulas = 0
    names = [s["name"] for s in dump["sheets"]]
    want_names = [ws.title for ws in wb.worksheets]
    if names != want_names:
        problems.append(f"sheets {names} != {want_names}")
    cells = 0
    for sheet in dump["sheets"]:
        if sheet["name"] not in wb.sheetnames:
            continue
        ws = wb[sheet["name"]]
        # the split, not openpyxl's freeze_panes (that is the pane's scrolled top-left cell)
        fr, fc = 0, 0
        pane = ws.sheet_view.pane
        if pane is not None and pane.state in ("frozen", "frozenSplit"):
            fr, fc = int(pane.ySplit or 0), int(pane.xSplit or 0)
        if sheet["frozen"] != [fr, fc]:
            problems.append(f"{sheet['name']}: frozen {sheet['frozen']} != {[fr, fc]}")
        if sorted(sheet["merges"]) != sorted(str(m) for m in ws.merged_cells.ranges):
            problems.append(f"{sheet['name']}: merges differ ({len(sheet['merges'])} vs {len(ws.merged_cells.ranges)})")
        # a cached empty string ("" from a formula or an empty shared string) shows as nothing, like openpyxl's None
        got = {c["ref"]: (None if c["value"] == "" else c["value"]) for c in sheet["cells"]}
        seen = set()
        for row in ws.iter_rows():
            for cell in row:
                v = cell.value
                if v is None or v == "":
                    continue
                ref = cell.coordinate
                seen.add(ref)
                cells += 1
                mine = got.get(ref, "<missing>")
                if isinstance(v, (datetime.datetime, datetime.date, datetime.time, datetime.timedelta)):
                    if isinstance(v, datetime.timedelta):
                        v = v.total_seconds() / 86400
                    elif isinstance(v, datetime.time):
                        v = (v.hour * 3600 + v.minute * 60 + v.second + v.microsecond / 1e6) / 86400
                    else:
                        v = to_excel(v, wb.epoch)
                if isinstance(v, bool):
                    ok = mine is v
                elif isinstance(v, (int, float)):
                    ok = isinstance(mine, (int, float)) and not isinstance(mine, bool) and math.isclose(mine, v, rel_tol=1e-9, abs_tol=1e-9)
                elif isinstance(v, str) and v.startswith("#") and isinstance(mine, dict):
                    ok = mine.get("error") == v
                else:
                    ok = mine == str(v)
                if not ok and len(problems) < 12:
                    problems.append(f"{sheet['name']}!{ref}: dot {mine!r} != openpyxl {v!r}")
                bad += 0 if ok else 1
        extra = [r for r, val in got.items() if r not in seen and val is not None]
        if extra and len(problems) < 12:
            problems.append(f"{sheet['name']}: {len(extra)} values openpyxl doesn't have, e.g. {extra[:3]}")
        bad += len(extra)
        got_f = {c["ref"]: c.get("formula") for c in sheet["cells"]}
        for row in wbf[sheet["name"]].iter_rows():
            for cell in row:
                v = cell.value
                want = v.text if isinstance(v, ArrayFormula) else v
                # a formula cell; text that starts with "=" is data type "s", and a data table's formula is skipped
                if cell.data_type != "f" or not (isinstance(want, str) and want.startswith("=")):
                    continue
                formulas += 1
                mine = got_f.get(cell.coordinate)
                if mine != want[1:]:
                    if len(problems) < 12:
                        problems.append(f"{sheet['name']}!{cell.coordinate}: formula dot {mine!r} != openpyxl {want[1:]!r}")
                    bad += 1
    bad += len([p for p in problems if "sheets" in p or "frozen" in p or "merges" in p])
    print(f"{'ok  ' if not problems else 'DIFF'} {dump['ms']:5d} ms {cells:6d} cells {formulas:6d} formulas  {path.split('/')[-1]}")
    for p in problems:
        print("     ", p)
sys.exit(1 if bad else 0)
