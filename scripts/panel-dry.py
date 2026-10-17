#!/opt/homebrew/bin/python3.13
"""Dry-run explainer-panel turns: the think model gets Dot's real system prompt (`Dot --prompt think`) and a question,
with no screen and no Atlas, and writes its answer; the panel blocks are cut out the way PanelStream does, rendered in
WebKit at the panel's width, and laid out on one sheet with each turn's latency and cost.

    scripts/panel-dry.py questions.json [--out build/panel-dry] [--jobs 2] [--only id,id]

questions.json: [{"id", "you", "app"?, "resume"?: id of an earlier question whose session this one continues}]
Writes <out>/<id>.ui (the panel markup), <id>.said.txt (what Dot would speak), <id>.json (timings, cost), <id>.png,
results.json and sheet.png.
"""
import argparse, concurrent.futures as cf, datetime, json, os, re, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLAUDE = os.path.expanduser("~/.local/bin/claude")


def system_prompt():
    dot = ROOT / ".build" / "debug" / "Dot"
    env = dict(os.environ, DOT_BOARD_DIR=str(ROOT / "Resources" / "board"))
    return subprocess.run([str(dot), "--prompt", "think"], capture_output=True, text=True, env=env, check=True).stdout


def message(q):
    now = datetime.datetime.now().strftime("%A, %B %-d, %Y, %-I:%M %p")
    lines = ["[context]", f"now: {now}"]
    if q.get("app"): lines.append(f"app: {q['app']}")
    lines += ["(dry run: no screenshot this turn)", "[/context]", "", q["you"]]
    return "\n".join(lines)


def split_panels(text):
    """What PanelStream does to the whole answer: (spoken text, [(id, title, markup)])."""
    panels, spoken, pos = [], [], 0
    for m in re.finditer(r"\[PANEL:([^\]:]*)(?::([^\]]*))?\]\s*<<<(.*?)(?:>>>|\Z)", text, re.S):
        spoken.append(text[pos:m.start()]); pos = m.end()
        panels.append(((m.group(1) or "panel").strip(), (m.group(2) or "").strip(), m.group(3)))
    spoken.append(text[pos:])
    return "".join(spoken).strip(), panels


def run_turn(q, prompt, out, sessions, model):
    args = [CLAUDE, "-p", "--model", model, "--output-format", "stream-json", "--verbose", "--include-partial-messages",
            "--system-prompt", prompt, "--setting-sources", "", "--strict-mcp-config", "--permission-mode", "default",
            "--max-turns", "6", "--allowedTools", "Bash(python3:*),Bash(/opt/homebrew/bin/python3.13:*),WebSearch,WebFetch"]
    if q.get("resume") and sessions.get(q["resume"]): args += ["--resume", sessions[q["resume"]]]
    # the question goes in on stdin: --allowedTools takes every argument after it
    t0 = time.time(); first_text = first_panel = None; text = ""; result = {}
    proc = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=str(out))
    proc.stdin.write(message(q)); proc.stdin.close()
    for line in proc.stdout:
        try: ev = json.loads(line)
        except ValueError: continue
        if ev.get("type") == "stream_event":
            d = ev.get("event", {}).get("delta", {})
            if d.get("type") == "text_delta":
                if first_text is None: first_text = time.time() - t0
                text += d.get("text", "")
                if first_panel is None and "<<<" in text: first_panel = time.time() - t0
        elif ev.get("type") == "result":
            result = ev
    proc.wait()
    if not result: rec_err = proc.stderr.read()[-400:]
    else: rec_err = ""
    final = result.get("result") or text
    said, panels = split_panels(final if "[PANEL" in final else text)
    rec = {"id": q["id"], "you": q["you"], "source": q.get("source", ""), "session": result.get("session_id"),
           "first_word_s": round(first_text, 1) if first_text else None, "panel_starts_s": round(first_panel, 1) if first_panel else None,
           "total_s": round(time.time() - t0, 1), "cost_usd": round(result.get("total_cost_usd") or 0, 4),
           "turns": result.get("num_turns"), "error": result.get("is_error") or (rec_err or None), "panels": len(panels), "said": said}
    (out / f"{q['id']}.said.txt").write_text(said + "\n")
    if panels:
        pid, title, markup = panels[-1]
        rec["panel_id"], rec["panel_title"] = pid, title
        (out / f"{q['id']}.ui").write_text(markup.strip() + "\n")
    (out / f"{q['id']}.json").write_text(json.dumps(rec, indent=1))
    return rec


def render(out, recs):
    sys.path.insert(0, str(ROOT / "scripts"))
    import importlib.util
    spec = importlib.util.spec_from_file_location("panel_check", ROOT / "scripts" / "panel-check.py")
    pc = importlib.util.module_from_spec(spec); spec.loader.exec_module(pc)
    from playwright.sync_api import sync_playwright
    from PIL import Image, ImageDraw, ImageFont
    httpd, port = pc.serve()
    errors = {}
    with sync_playwright() as p:
        b = p.webkit.launch()
        for r in recs:
            ui = out / f"{r['id']}.ui"
            if not ui.exists(): continue
            page = b.new_page(viewport={"width": 440, "height": 900})
            errs = []
            page.on("console", lambda m, errs=errs: errs.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
            page.goto(f"http://127.0.0.1:{port}/panel/panel.html")
            page.wait_for_function("window.panel && document.getElementById('content')")
            page.evaluate("([m, t]) => panel.load(m, {id: 'dry', title: t})", [ui.read_text(), r.get("panel_title") or r["id"]])
            page.wait_for_timeout(1500)
            pc.shoot(page, out / f"{r['id']}.png")
            r["render_errors"] = errs[:3]
            page.close()
        b.close()
    httpd.shutdown()
    # the sheet: each panel under a caption with its numbers
    tiles = []
    font = ImageFont.load_default(size=15) if hasattr(ImageFont, "load_default") else None
    for r in recs:
        png = out / f"{r['id']}.png"
        img = Image.open(png).convert("RGB") if png.exists() else Image.new("RGB", (440, 200), "#222")
        img = img.crop((0, 0, 440, min(img.height, 1700)))
        cap = Image.new("RGB", (440, 64), "#2a2a2a"); d = ImageDraw.Draw(cap)
        d.text((10, 6), f"{r['id']}: {r['you'][:52]}", fill="#fff", font=font)
        d.text((10, 30), f"first word {r['first_word_s']} s, panel {r['panel_starts_s']} s, done {r['total_s']} s, ${r['cost_usd']}", fill="#ffb68a", font=font)
        tile = Image.new("RGB", (440, img.height + 64), "#111"); tile.paste(cap, (0, 0)); tile.paste(img, (0, 64)); tiles.append(tile)
    if tiles:
        cols = 5; rows = (len(tiles) + cols - 1) // cols
        rh = [max(t.height for t in tiles[i * cols:(i + 1) * cols]) for i in range(rows)]
        sheet = Image.new("RGB", (cols * 450, sum(rh) + 10 * rows), "#333")
        y = 0
        for i in range(rows):
            for j, t in enumerate(tiles[i * cols:(i + 1) * cols]): sheet.paste(t, (j * 450, y))
            y += rh[i] + 10
        sheet.save(out / "sheet.png")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("questions")
    ap.add_argument("--out", default=str(ROOT / "build" / "panel-dry"))
    ap.add_argument("--jobs", type=int, default=2)
    ap.add_argument("--only")
    ap.add_argument("--model", default="opus")
    ap.add_argument("--render-only", action="store_true")
    a = ap.parse_args()
    qs = json.loads(Path(a.questions).read_text())
    if a.only: qs = [q for q in qs if q["id"] in a.only.split(",")]
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    recs = {}
    if a.render_only:
        recs = {q["id"]: json.loads((out / f"{q['id']}.json").read_text()) for q in qs if (out / f"{q['id']}.json").exists()}
    else:
        prompt = system_prompt()
        sessions = {}
        first = [q for q in qs if not q.get("resume")]; later = [q for q in qs if q.get("resume")]
        with cf.ThreadPoolExecutor(a.jobs) as pool:
            for r in pool.map(lambda q: run_turn(q, prompt, out, sessions, a.model), first):
                recs[r["id"]] = r; sessions[r["id"]] = r.get("session")
                print(f"{r['id']}: {r['total_s']} s, ${r['cost_usd']}, {r['panels']} panel(s)", flush=True)
        for q in later:
            r = run_turn(q, prompt, out, sessions, a.model); recs[r["id"]] = r
            print(f"{r['id']}: {r['total_s']} s, ${r['cost_usd']}, {r['panels']} panel(s)", flush=True)
    ordered = [recs[q["id"]] for q in qs if q["id"] in recs]
    render(out, ordered)
    (out / "results.json").write_text(json.dumps(ordered, indent=1))
    total = sum(r["cost_usd"] for r in ordered)
    print(f"{sum(1 for r in ordered if r['panels'])}/{len(ordered)} wrote a panel; total ${total:.2f}; sheet {out / 'sheet.png'}")


if __name__ == "__main__":
    main()
