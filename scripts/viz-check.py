#!/opt/homebrew/bin/python3.13
"""Check explainer widgets the way the catalog gate needs: render each in WebKit (the engine Dot's board uses)
and fail it on anything a person would notice.

    scripts/viz-check.py lin-span-independence pcr-cycle      # some widgets
    scripts/viz-check.py --all                                # every file in Resources/board/viz/widgets
    scripts/viz-check.py --all --since 2026-10-17T03:00       # only files changed since then

A widget passes when, at its defaults, at every example and at three random settings:
  - the page logs no error and the framework reports no draw error, and no "NaN" reaches the SVG;
  - the diagram has real content (more than 6 SVG elements);
  - every control changes the picture (the SVG markup differs at the param's min, max or other value),
    and a stepped widget looks different at every step;
  - every SVG label renders at 10.5 px or more in the wide layout;
  - nothing is drawn more than 14 units outside the viewBox.
It writes PNGs (wide, narrow, each example) and a contact sheet to --out, and records pass/fail with the reasons
in docs/catalog-status.json (unless --no-ledger). Exit status 1 when anything failed.
"""
import argparse, datetime, fcntl, functools, http.server, json, os, random, socket, sys, threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOARD = ROOT / "Resources" / "board"
WIDGETS = BOARD / "viz" / "widgets"
LEDGER = ROOT / "docs" / "catalog-status.json"


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close(); return port


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k): super().__init__(*a, directory=str(BOARD), **k)
        def log_message(self, *a): pass
    port = free_port()
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


PAGE_PROBE = r"""
() => {
  const inst = window.__vizInstance;
  if (!inst) return {missing: true};
  const svg = inst.svg, vb = svg.viewBox.baseVal, scale = svg.clientWidth / vb.width;
  const small = [];
  svg.querySelectorAll('text').forEach(t => {
    const fs = parseFloat(getComputedStyle(t).fontSize) || parseFloat(t.getAttribute('font-size')) || 0;
    if (t.textContent.trim() && fs * scale < 10.5) small.push(t.textContent.trim().slice(0, 24) + ' (' + (fs * scale).toFixed(1) + 'px)');
  });
  let out = null;
  try {
    const b = svg.getBBox();
    const tol = 14;
    if (b.width && (b.x < -tol || b.y < -tol || b.x + b.width > vb.width + tol || b.y + b.height > vb.height + tol))
      out = [b.x, b.y, b.x + b.width, b.y + b.height].map(x => Math.round(x));
  } catch (e) {}
  const spec = Viz.get(inst.id);
  return {elements: svg.querySelectorAll('*').length, small, out, error: inst.root.dataset.vizError || null,
          nan: svg.outerHTML.includes('NaN'), params: spec.params, steps: (inst.stepLabels || []).length,
          examples: spec.examples || [], title: spec.title || '', shows: spec.shows || '', subject: spec.subject || ''};
}
"""


def check(page, port, wid, outdir):
    fails, shots, errors = [], [], []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "ResizeObserver loop" not in m.text else None)
    page.on("pageerror", lambda e: errors.append(str(e)) if "ResizeObserver loop" not in str(e) else None)

    def load(values=None, width=720):
        errors.clear()
        url = f"http://127.0.0.1:{port}/viz/harness.html?id={wid}&w={width}"
        if values: url += "&values=" + json.dumps(values)
        page.goto(url)
        page.wait_for_function("window.__vizReady === true", timeout=8000)
        page.wait_for_timeout(120)
        return page.evaluate(PAGE_PROBE)

    def frame(): page.wait_for_timeout(60)

    def shot(name):
        path = outdir / f"{wid}--{name}.png"
        page.locator("#host").screenshot(path=str(path)); shots.append(str(path))

    page.set_viewport_size({"width": 760, "height": 640})
    info = load()
    if info.get("missing"):
        return {"status": "fail", "failures": ["widget did not mount: " + "; ".join(errors[:3])], "shots": []}, {}
    meta = {k: info[k] for k in ("title", "shows", "subject")}
    def judge(info, where):
        if errors: fails.append(f"{where}: console error: {errors[0][:160]}")
        if info.get("error"): fails.append(f"{where}: draw error: {info['error'][:160]}")
        if info.get("nan"): fails.append(f"{where}: NaN in the SVG")
        if info.get("elements", 0) <= 6: fails.append(f"{where}: diagram nearly empty ({info.get('elements')} elements)")
        if info.get("small"): fails.append(f"{where}: labels under 10.5 px: {', '.join(info['small'][:4])}")
        if info.get("out"): fails.append(f"{where}: drawn outside the viewBox {info['out']}")
    judge(info, "defaults")
    shot("wide")

    # every control changes the picture
    params = info["params"]
    base = page.evaluate("() => __viz.markup(0)")
    for name, q in params.items():
        tries = []
        if q["kind"] in ("number", "integer"): tries = [q.get("min"), q.get("max")]
        elif q["kind"] == "enum": tries = [v for v in q.get("values", []) if v != q.get("default")][:2]
        elif q["kind"] == "boolean": tries = [not q.get("default")]
        changed = False
        for t in tries:
            if t is None: continue
            page.evaluate("([n, v]) => __viz.set(0, {[n]: v})", [name, t]); frame()
            if page.evaluate("() => __viz.markup(0)") != base:
                changed = True
            page.evaluate("([n, v]) => __viz.set(0, {[n]: v})", [name, q.get("default")]); frame()
            if changed: break
        if not changed and q.get("affects", True):
            fails.append(f"control {name} changes nothing in the diagram")
    if info["steps"]:
        seen = set()
        for s in range(1, info["steps"] + 1):
            page.evaluate("(s) => __viz.set(0, {step: s})", s); frame()
            seen.add(page.evaluate("() => __viz.markup(0)"))
        if len(seen) < info["steps"]: fails.append(f"only {len(seen)} distinct pictures across {info['steps']} steps")
        page.evaluate("() => __viz.set(0, {step: 1})"); frame()

    # narrow layout (the panel at 440 pt)
    page.set_viewport_size({"width": 470, "height": 900})
    judge(load(width=440), "narrow"); shot("narrow")
    page.set_viewport_size({"width": 760, "height": 640})

    for i, ex in enumerate(info["examples"]):
        judge(load(ex.get("values", {})), f"example '{ex.get('name', i)}'"); shot(f"ex{i}")
    rng = random.Random(wid)
    for r in range(3):
        vals = {}
        for name, q in params.items():
            if q["kind"] in ("number", "integer") and q.get("min") is not None:
                x = rng.uniform(q["min"], q["max"]); vals[name] = round(x) if q["kind"] == "integer" else round(x, 2)
            elif q["kind"] == "enum" and q.get("values"): vals[name] = rng.choice(q["values"])
            elif q["kind"] == "boolean": vals[name] = rng.random() < 0.5
        judge(load(vals), f"random {json.dumps(vals)[:80]}")
    seen, uniq = set(), []
    for f in fails:
        key = f.split(":", 1)[-1]
        if key not in seen: seen.add(key); uniq.append(f)
    return {"status": "fail" if uniq else "pass", "failures": uniq[:12], "shots": shots}, meta


def contact_sheet(results, outdir):
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return None
    tiles = [(wid, r["shots"][0]) for wid, r in results.items() if r.get("shots")]
    if not tiles: return None
    W, cols = 520, 3
    ims = []
    for wid, path in tiles:
        im = Image.open(path).convert("RGB"); im = im.resize((W, int(im.height * W / im.width))); ims.append((wid, im))
    h = max(im.height for _, im in ims) + 26
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (W + 10), rows * h), "#222")
    d = ImageDraw.Draw(sheet)
    for i, (wid, im) in enumerate(ims):
        x, y = (i % cols) * (W + 10), (i // cols) * h
        d.text((x + 6, y + 6), f"{wid}  [{results[wid]['status']}]", fill="#fff" if results[wid]["status"] == "pass" else "#f87171")
        sheet.paste(im, (x, y + 24))
    path = outdir / "sheet.png"; sheet.save(path); return str(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--since")
    ap.add_argument("--out")
    ap.add_argument("--no-ledger", action="store_true")
    a = ap.parse_args()
    ids = a.ids
    if a.all:
        files = sorted(WIDGETS.glob("*.js"))
        if a.since:
            t = datetime.datetime.fromisoformat(a.since).timestamp()
            files = [f for f in files if f.stat().st_mtime >= t]
        ids = [f.stem for f in files]
    if not ids: ap.error("name widgets or pass --all")
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    outdir = Path(a.out) if a.out else ROOT / "build" / "viz-check" / stamp
    outdir.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    httpd, port = serve()
    results, metas = {}, {}
    with sync_playwright() as p:
        browser = p.webkit.launch()
        for wid in ids:
            page = browser.new_page()
            try:
                results[wid], metas[wid] = check(page, port, wid, outdir)
            except Exception as e:
                results[wid], metas[wid] = {"status": "fail", "failures": [f"checker crashed: {e}"[:200]], "shots": []}, {}
            page.close()
            r = results[wid]
            print(f"{'PASS' if r['status'] == 'pass' else 'FAIL'}  {wid}" + ("" if r["status"] == "pass" else "\n      " + "\n      ".join(r["failures"])))
        browser.close()
    httpd.shutdown()
    sheet = contact_sheet(results, outdir)
    if not a.no_ledger:
        # several builders run this at once: hold an exclusive lock around the read-modify-write
        LEDGER.parent.mkdir(parents=True, exist_ok=True)
        lock = open(LEDGER.with_suffix(".lock"), "w"); fcntl.flock(lock, fcntl.LOCK_EX)
        ledger = json.loads(LEDGER.read_text()) if LEDGER.exists() else {"widgets": {}}
        now = datetime.datetime.now().isoformat(timespec="seconds")
        for wid, r in results.items():
            entry = ledger["widgets"].get(wid, {})
            entry.update({"status": r["status"], "failures": r["failures"], "checked": now})
            entry.update({k: v for k, v in metas.get(wid, {}).items() if v})
            ledger["widgets"][wid] = entry
        st = [w["status"] for w in ledger["widgets"].values()]
        ledger["counts"] = {"pass": st.count("pass"), "fail": st.count("fail"), "total": len(st)}
        tmp = LEDGER.with_suffix(".tmp"); tmp.write_text(json.dumps(ledger, indent=1, sort_keys=True) + "\n"); tmp.replace(LEDGER)
        fcntl.flock(lock, fcntl.LOCK_UN); lock.close()
    passed = sum(r["status"] == "pass" for r in results.values())
    print(f"{passed}/{len(results)} passed; shots in {outdir}" + (f"; sheet {sheet}" if sheet else ""))
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
