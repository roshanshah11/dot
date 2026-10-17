#!/opt/homebrew/bin/python3.13
"""Render the explainer panel's fixtures in WebKit (the engine Dot uses) and fail on anything broken.

    scripts/panel-check.py                 # every Resources/board/panel/fixtures/*.ui
    scripts/panel-check.py kernel messy    # some

Each fixture's first line may carry `<!-- expect: .sel .sel:N ; click: label ; slide: var=value ; vars: name ; tolerant -->`.
Checks: no console or page error (a fixture marked tolerant may log handled ones), every expected selector present
(at least N times), no script ran (window.__pwned), streaming the markup in 37-character chunks ends in the same text
as loading it at once, a quiz answer and a chip tap post messages, `click:` presses that button and the named vars
change, `slide:` moves a slider and the text changes. Screenshots at the panel's default width (440) to --out.
"""
import argparse, datetime, http.server, json, re, socket, sys, threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOARD = ROOT / "Resources" / "board"
FIX = BOARD / "panel" / "fixtures"


def serve():
    class Q(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k): super().__init__(*a, directory=str(BOARD), **k)
        def log_message(self, *a): pass
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), Q)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


def parse_expect(text):
    m = re.match(r"\s*<!--\s*expect:(.*?)-->", text)
    spec = {"sel": [], "click": None, "slide": None, "vars": [], "tolerant": False}
    if not m: return spec
    for part in m.group(1).split(";"):
        part = part.strip()
        if part.startswith("click:"): spec["click"] = part[6:].strip()
        elif part.startswith("slide:"): spec["slide"] = part[6:].strip()
        elif part.startswith("vars:"): spec["vars"] = part[5:].split()
        elif part == "tolerant": spec["tolerant"] = True
        elif part: spec["sel"] += part.split()
    return spec


def shoot(page, path):
    # the column scrolls inside #scroller: grow the window to the content so the picture holds all of it
    h = page.evaluate("() => document.getElementById('head').offsetHeight + document.getElementById('scroller').scrollHeight")
    page.set_viewport_size({"width": 440, "height": max(900, min(int(h) + 4, 6000))})
    page.wait_for_timeout(120)
    for _ in range(3):   # WebKit's first capture after a resize sometimes comes back empty
        page.screenshot(path=str(path))
        if Path(path).stat().st_size > 1000: break
        page.wait_for_timeout(300)
    page.set_viewport_size({"width": 440, "height": 900})


def check(page, port, name, outdir):
    markup = (FIX / f"{name}.ui").read_text()
    spec = parse_expect(markup)
    errors, fails = [], []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.add_init_script("window.alert = function () { window.__pwned = true; };")
    page.goto(f"http://127.0.0.1:{port}/panel/panel.html")
    page.wait_for_function("document.getElementById('content') !== null && window.panel")
    page.evaluate("([m, n]) => panel.load(m, {id: n, title: n})", [markup, name])
    page.wait_for_timeout(900)
    for sel in spec["sel"]:
        s, _, n = sel.partition(":")
        count = page.locator(f"#content {s}").count()
        if count < (int(n) if n else 1): fails.append(f"expected {sel}, found {count}")
    if page.evaluate("() => !!window.__pwned"): fails.append("a script in the markup ran")
    once = page.evaluate("() => document.getElementById('content').innerText")
    shoot(page, outdir / f"{name}.png")
    if errors and not spec["tolerant"]: fails.append("console error: " + errors[0][:160])
    if spec["tolerant"] and any("Uncaught" in e or "TypeError" in e or "ReferenceError" in e for e in errors):
        fails.append("uncaught error: " + errors[0][:160])
    # quiz answer and chip tap post messages
    if page.locator("#content .quiz:not(.multi) .quiz-option").count():
        # a first wrong pick only gets feedback and another try; the answer that ends it posts
        opts = page.locator("#content .quiz:not(.multi)").first.locator(".quiz-option")
        for k in range(min(opts.count(), 3)):
            opts.nth(k).click(); page.wait_for_timeout(60)
            if page.evaluate("() => (window.__posted || []).some(m => m.type === 'quiz')"): break
        posted = page.evaluate("() => (window.__posted || []).filter(m => m.type === 'quiz')")
        if not posted: fails.append("answering the quiz posted nothing")
        elif not posted[0].get("question"): fails.append("the quiz post carries no question")
    if page.locator("#content .chip").count():
        page.locator("#content .chip").first.click()
        if not page.evaluate("() => (window.__posted || []).some(m => m.type === 'ask')"): fails.append("tapping a chip posted nothing")
    if spec["click"]:
        # press it three times; each named var must take more than one value along the way (a cycle back is fine)
        seen = [page.evaluate("() => panel.vars()")]
        for _ in range(3):
            page.locator("#content button.btn", has_text=spec["click"]).first.click(); page.wait_for_timeout(120)
            seen.append(page.evaluate("() => panel.vars()"))
        for v in spec["vars"]:
            values = {json.dumps(s.get(v)) for s in seen}
            if len(values) < 2: fails.append(f"pressing '{spec['click']}' never changed {v} (stayed {seen[0].get(v)})")
        shoot(page, outdir / f"{name}--after.png")
    if spec["slide"]:
        var, _, val = spec["slide"].partition("=")
        text0 = page.evaluate("() => document.getElementById('content').innerText")
        page.evaluate("([v]) => { const r = document.querySelector('#content .slider-row input'); r.value = v; r.dispatchEvent(new Event('input')); }", [val])
        page.wait_for_timeout(150)
        text1 = page.evaluate("() => document.getElementById('content').innerText")
        got = page.evaluate("() => panel.vars()").get(var)
        if text0 == text1: fails.append("moving the slider changed no text")
        if got is None or abs(float(got) - float(val)) > 1e-9: fails.append(f"slider did not set {var} (got {got})")
        shoot(page, outdir / f"{name}--after.png")
    # streaming: 37-char chunks end in the same text
    page.goto(f"http://127.0.0.1:{port}/panel/panel.html")
    page.wait_for_function("document.getElementById('content') !== null && window.panel")
    page.evaluate("([n]) => panel.load('', {id: n, title: n})", [name])
    for i in range(0, len(markup), 37):
        page.evaluate("([c]) => panel.append(c)", [markup[i:i + 37]])
        if i % 370 == 0: page.wait_for_timeout(20)
    page.evaluate("() => panel.finish()"); page.wait_for_timeout(900)
    streamed = page.evaluate("() => document.getElementById('content').innerText")
    if streamed.strip() != once.strip():
        fails.append("streamed render differs from a one-shot render")
    return {"status": "fail" if fails else "pass", "failures": fails}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*")
    ap.add_argument("--out")
    a = ap.parse_args()
    names = a.names or sorted(p.stem for p in FIX.glob("*.ui"))
    outdir = Path(a.out) if a.out else ROOT / "build" / "panel-check" / datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    outdir.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    httpd, port = serve()
    results = {}
    with sync_playwright() as p:
        b = p.webkit.launch()
        for n in names:
            page = b.new_page(viewport={"width": 440, "height": 900})
            try: results[n] = check(page, port, n, outdir)
            except Exception as e: results[n] = {"status": "fail", "failures": [f"checker crashed: {e}"[:220]]}
            page.close()
            r = results[n]
            print(("PASS  " if r["status"] == "pass" else "FAIL  ") + n + ("" if r["status"] == "pass" else "\n      " + "\n      ".join(r["failures"])), flush=True)
        b.close()
    httpd.shutdown()
    ok = sum(r["status"] == "pass" for r in results.values())
    print(f"{ok}/{len(results)} passed; screenshots in {outdir}")
    sys.exit(0 if ok == len(results) else 1)


if __name__ == "__main__":
    main()
