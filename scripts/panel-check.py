#!/opt/homebrew/bin/python3.13
"""Render the explainer panel's fixtures in WebKit (the engine Dot uses) and fail on anything broken.

    scripts/panel-check.py                 # every Resources/board/panel/fixtures/*.ui
    scripts/panel-check.py kernel messy    # some

Each fixture's first line may carry `<!-- expect: .sel .sel:N ; click: label ; slide: var=value ; vars: name ; tolerant ;
page: tick t1 i1 ; form f1 ; review r1 ; letter l1 ; light -->`.
Checks: no console or page error (a fixture marked tolerant may log handled ones), every expected selector present
(at least N times), no script ran (window.__pwned), streaming the markup in 13-character chunks, a frame each, ends in the same text
as loading it at once and throws nothing on the way, a quiz answer and a chip tap post messages, `click:` presses that button and the named vars
change, `slide:` moves a slider and the text changes. `page:` works a job page's controls in order and asserts the exact
page_* message each posts (and that a second press posts nothing); `letter` fills the draft through panel.letter and fails if
anything written inside <letter> (the fixture carries a CANARY there) reaches the page. Rows with no id must be inert.
`light` adds screenshots in the light tokens. Screenshots at the panel's default width (440) to --out.
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
    spec = {"sel": [], "click": None, "slide": None, "vars": [], "tolerant": False, "page": [], "light": False}
    if not m: return spec
    for part in m.group(1).split(";"):
        part = part.strip()
        if part.startswith("page:"): spec["page"].append(part[5:].strip())
        elif spec["page"] and re.match(r"(tick|form|review|letter)\b", part): spec["page"].append(part)
        elif part == "light": spec["light"] = True
        elif part.startswith("click:"): spec["click"] = part[6:].strip()
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


def shoot_light(page, path):
    page.evaluate("() => document.documentElement.dataset.theme = 'light'")
    shoot(page, path)
    page.evaluate("() => delete document.documentElement.dataset.theme")


# ---- job pages ---------------------------------------------------------------------------------------------------
EVENT = re.compile(r"^[0-9a-z]{12}$")
# what Dot would hand panel.letter; the markup in it must show as text, never run or render
FILL = {"to": "Prof. Lee <lee@uchicago.edu>", "subject": "Office hours <b>Thursday</b>",
        "body": "Hi Professor Lee,\n\nCould I come by Thursday at 3?\n<img src=x onerror=\"window.__pwned = true\">\nRoshan", "state": "pending"}


def page_posts(page):
    return page.evaluate("() => (window.__posted || []).filter(m => /^page_/.test(m.type))")


def expect_post(page, before, want, label, fails, events):
    got = page_posts(page)[before:]
    if len(got) != 1: fails.append(f"{label}: posted {len(got)} page messages, want 1"); return
    m = dict(got[0]); ev = m.pop("event", None)
    if not isinstance(ev, str) or not EVENT.match(ev): fails.append(f"{label}: event {ev!r} is not 12 base36 characters")
    elif ev in events: fails.append(f"{label}: event id {ev} reused")
    events.add(ev)
    if m != want: fails.append(f"{label}: posted {json.dumps(m)[:240]}, want {json.dumps(want)[:240]}")


def no_post(page, before, label, fails):
    extra = len(page_posts(page)) - before
    if extra: fails.append(f"{label} posted {extra} more page message(s)")
    return not extra


def page_checks(page, name, markup, actions, fails, snap):
    events, version, snapped = set(), "v1", False
    for act in actions:
        kind, *args = act.split()
        n = len(page_posts(page))
        if kind == "tick":
            obj, item = args
            box = page.locator(f'#content .todo[data-id="{obj}"] .todo-item[data-item="{item}"] input')
            if not box.count(): fails.append(f"tick: no item {obj}/{item}"); continue
            was = box.is_checked(); box.click(); page.wait_for_timeout(60)
            expect_post(page, n, {"type": "page_tick", "panel": name, "object": obj, "item": item, "done": not was, "version": version}, "tick", fails, events)
            if box.is_checked() == was: fails.append("tick: the box did not flip on the click")
            if not box.is_disabled(): fails.append("tick: the box stayed live after it posted")
            n = len(page_posts(page)); box.click(force=True); page.wait_for_timeout(60); no_post(page, n, "a second tick", fails)
        elif kind == "form":
            obj = args[0]
            form = page.locator(f'#content .pform[data-id="{obj}"]'); btn = form.locator(".page-bar button")
            if not form.count(): fails.append(f"form: no form {obj}"); continue
            read = lambda: page.evaluate("""(o) => Array.from(document.querySelectorAll(`#content .pform[data-id="${o}"] .pfield`)).map(f => {
                const i = f.querySelector('.pfield-input'), c = f.querySelector('.pchoice.on');
                return {name: f.dataset.name, type: f.dataset.type, req: f.classList.contains('req'), value: i ? i.value : c ? c.dataset.value : ''}; })""", obj)
            fields = read()
            if not any(f["req"] and not f["value"].strip() for f in fields): fails.append("form: the fixture needs an empty required field")
            btn.click(); page.wait_for_timeout(60)
            if not no_post(page, n, "submitting with a required field empty", fails): continue
            if not form.locator(".page-note").inner_text().strip(): fails.append("form: an empty required field showed no note")
            for i, f in enumerate(fields):
                if f["value"].strip(): continue
                pf = form.locator(".pfield").nth(i)
                if f["type"] == "choice": pf.locator(".pchoice").first.click()
                else: pf.locator(".pfield-input").fill({"date": "2026-11-25", "number": "3", "textarea": "line one\nline two"}.get(f["type"], "Nov 25 to 30"))
            want = {f["name"]: f["value"] for f in read() if f["name"]}
            n = len(page_posts(page)); btn.click(); page.wait_for_timeout(60)
            expect_post(page, n, {"type": "page_form", "panel": name, "object": obj, "fields": want, "version": version}, "form", fails, events)
            if not btn.is_disabled(): fails.append("form: the submit stayed live after it posted")
            n = len(page_posts(page)); btn.click(force=True); page.wait_for_timeout(60); no_post(page, n, "a second submit", fails)
        elif kind == "review":
            obj = args[0]
            rv = page.locator(f'#content .review[data-id="{obj}"]'); done = rv.locator(".page-bar button")
            live = rv.locator(".review-row:not(.page-off)")
            if live.count() < 3: fails.append(f"review: {obj} needs three rows with ids"); continue
            done.click(); page.wait_for_timeout(60); no_post(page, n, "Done with nothing decided", fails)
            ids = [live.nth(k).get_attribute("data-item") for k in range(2)]
            live.nth(0).locator(".review-yes").click()
            live.nth(1).locator(".review-no").click(); live.nth(1).locator(".review-note").fill("too far from Chicago")
            live.nth(2).locator(".review-yes").click(); live.nth(2).locator(".review-yes").click()   # a second press undoes it
            n = len(page_posts(page)); done.click(); page.wait_for_timeout(60)
            expect_post(page, n, {"type": "page_review", "panel": name, "object": obj, "version": version, "decisions": [
                {"item": ids[0], "approve": True, "reason": ""}, {"item": ids[1], "approve": False, "reason": "too far from Chicago"}]}, "review", fails, events)
            n = len(page_posts(page)); done.click(force=True); page.wait_for_timeout(60); no_post(page, n, "a second Done", fails)
        elif kind == "letter":
            obj = args[0]
            m = next((m for m in re.finditer(r"<letter\b([^>]*)>(.*?)</letter>", markup, re.S) if f'id="{obj}"' in m.group(1)), None)
            if not m: fails.append(f"letter: the fixture has no <letter id=\"{obj}\">...</letter>"); continue
            proposal = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(1))).get("proposal", "")
            if "CANARY" not in m.group(2): fails.append("letter: put a CANARY string inside the fixture's <letter>")
            def canary(when):
                if page.evaluate("() => document.body.innerHTML.includes('CANARY')"): fails.append(f"letter: text written inside <letter> reached the page ({when})")
            card = page.locator(f'#content .letter[data-id="{obj}"]')
            canary("before the fill")
            if "loading the draft" not in card.inner_text(): fails.append("letter: an unfilled card does not say it is loading the draft")
            page.evaluate("([i, f]) => panel.letter(i, f)", [obj, FILL]); page.wait_for_timeout(100)
            canary("after the fill")
            got = page.evaluate("""(o) => { const c = document.querySelector(`#content .letter[data-id="${o}"]`), b = c.querySelector('.letter-body');
                return {v: Array.from(c.querySelectorAll('.letter-v')).map(e => e.textContent), body: b ? b.textContent : null, text: b ? b.innerText : '',
                        tags: c.querySelectorAll('b, img, script').length}; }""", obj)
            if got["v"] != [FILL["to"], FILL["subject"]] or got["body"] != FILL["body"]: fails.append(f"letter: the card shows {json.dumps(got)[:200]}, not the fill")
            if got["tags"] or page.evaluate("() => !!window.__pwned"): fails.append("letter: fill text became markup")
            if "\n\nCould" not in got["text"]: fails.append("letter: the body lost its line breaks")
            send, edit = card.locator('button[data-choice="send"]'), card.locator('button[data-choice="edit"]')
            n = len(page_posts(page)); send.click(); page.wait_for_timeout(60)
            expect_post(page, n, {"type": "page_letter", "panel": name, "object": obj, "proposal": proposal, "choice": "send", "version": version}, "letter send", fails, events)
            if not (send.is_disabled() and edit.is_disabled()): fails.append("letter: Send and Edit stayed live after Send posted")
            n = len(page_posts(page)); send.click(force=True); edit.click(force=True); page.wait_for_timeout(60); no_post(page, n, "Send or Edit after Send", fails)
            snap(); snapped = True
            # a reload keeps the fill, makes the buttons live again, and the new version rides on the next message
            version = "v2"
            page.evaluate("([m, n, v]) => panel.load(m, {id: n, title: n, version: v})", [markup, name, version]); page.wait_for_timeout(150)
            if card.locator(".letter-v").count() != 2: fails.append("letter: a reload lost the filled draft"); continue
            n = len(page_posts(page)); edit.click(); page.wait_for_timeout(60)
            expect_post(page, n, {"type": "page_letter", "panel": name, "object": obj, "proposal": proposal, "choice": "edit", "version": version}, "letter edit", fails, events)
            page.evaluate("([i, f]) => panel.letter(i, f)", [obj, dict(FILL, state="sent")]); page.wait_for_timeout(60)
            if card.locator("button").count() or not card.locator(".letter-done").count(): fails.append("letter: a sent draft still offers buttons")
            canary("after a reload")
        else:
            fails.append(f"page: unknown action {act!r}")
    live = page.evaluate("() => Array.from(document.querySelectorAll('#content .page-off')).flatMap(r => Array.from(r.querySelectorAll('input, button, textarea'))).filter(c => !c.disabled).length")
    if live: fails.append(f"{live} control(s) in a block or row with no id are live")
    if not snapped: snap()


def check(page, port, name, outdir):
    markup = (FIX / f"{name}.ui").read_text()
    spec = parse_expect(markup)
    errors, fails = [], []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.add_init_script("window.alert = function () { window.__pwned = true; };")
    page.goto(f"http://127.0.0.1:{port}/panel/panel.html")
    page.wait_for_function("document.getElementById('content') !== null && window.panel")
    page.evaluate("([m, n]) => panel.load(m, {id: n, title: n, version: 'v1'})", [markup, name])
    page.wait_for_timeout(900)
    for sel in spec["sel"]:
        s, _, n = sel.partition(":")
        count = page.locator(f"#content {s}").count()
        if count < (int(n) if n else 1): fails.append(f"expected {sel}, found {count}")
    if page.evaluate("() => !!window.__pwned"): fails.append("a script in the markup ran")
    once = page.evaluate("() => document.getElementById('content').innerText")
    shoot(page, outdir / f"{name}.png")
    if spec["light"]: shoot_light(page, outdir / f"{name}--light.png")
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
    if spec["page"]:
        seen = len(errors)
        def snap():
            shoot(page, outdir / f"{name}--after.png")
            if spec["light"]: shoot_light(page, outdir / f"{name}--after-light.png")
        page_checks(page, name, markup, spec["page"], fails, snap)
        if len(errors) > seen: fails.append("working the page logged an error: " + errors[seen][:160])
    # streaming: 13-char chunks end in the same text, and no chunk throws (a half-streamed svg tag did, 2026-10-19)
    seen = len(errors)
    page.goto(f"http://127.0.0.1:{port}/panel/panel.html")
    page.wait_for_function("document.getElementById('content') !== null && window.panel")
    page.evaluate("([n]) => panel.load('', {id: n, title: n})", [name])
    for i in range(0, len(markup), 13):
        # one frame per chunk, as model deltas arrive: the panel renders mid-tag only then
        page.evaluate("([c]) => new Promise(r => { panel.append(c); requestAnimationFrame(() => setTimeout(r, 0)); })", [markup[i:i + 13]])
    page.evaluate("() => panel.finish()"); page.wait_for_timeout(900)
    streamed = page.evaluate("() => document.getElementById('content').innerText")
    if "CANARY" in markup and page.evaluate("() => document.body.innerHTML.includes('CANARY')"):
        fails.append("letter: text written inside <letter> reached the page while streaming")
    if streamed.strip() != once.strip():
        fails.append("streamed render differs from a one-shot render")
    thrown = [e for e in errors[seen:] if "Error" in e]
    if thrown: fails.append(f"streaming threw {len(thrown)}x: " + thrown[0][:160])
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
