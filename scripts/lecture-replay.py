#!/usr/bin/env python3
"""Replay a lecture transcript through lecture mode's note writer, the way Dot runs it in class.

One long-lived `claude -p` session in streaming-input mode (Sonnet, no tools, no setting sources, the note
writer's own system prompt: Resources/lecture/notes-system.md with its placeholders filled in). The transcript is
cut into ~45-second chunks (~110 words) and sent as the protocol's cycle messages; each reply is applied with
the parser's rules (append, ~ rewrite, ## title, ? explain logged with its minute). A few of the student's own
edits are simulated partway through. At the end it sends [recall] and [gap-fill].

Writes into --out:
  notes.md          the class section as it lands in the course file (protocol section 1)
  log.md            per-cycle latency, tokens and cost; explain triggers with their minute; recall feedback;
                    gap-fill lines; refused and ignored lines
  conversation.md   every message sent and every raw reply
  run.json          the same numbers, for scripts

Example (paths are placeholders):
  scripts/lecture-replay.py "transcript.txt" --course "BIOS 101, Intro Biology" \\
      --course-map course-map.md --materials slides.pptx --materials reading.pdf \\
      --heading "CLASS 1 (Tue Sep 29)" --time 11:00-12:20 --start-minute 5 --minutes 30 \\
      --his-add "14|exams r 40% total" --his-change "20|+ (on exam)" \\
      --recall "1. ... 2. ... 3. ..." --out /tmp/replay-1

Materials: .pptx (slide text), .pdf (pdftotext), anything else read as text. Slides shown on his screen during
class: --slides FILE, sections headed "[minute N]" with the slide's text under each.
A transcript whose first lines are a Markdown header block ending in a line "---" has that header dropped.
"""

import argparse
import datetime as dt
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PROMPTS = REPO / "Resources" / "lecture"
CHUNK_SECONDS = 45


# ---------------------------------------------------------------- inputs

def read_transcript(path, keep_header=False):
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    if not keep_header:
        for i, line in enumerate(lines[:60]):
            if line.strip() == "---":
                lines = lines[i + 1:]
                break
    lines = [l for l in lines if not l.lstrip().startswith("#")]
    return " ".join(" ".join(lines).split())


def pptx_text(path):
    out = []
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)]
        names.sort(key=lambda n: int(re.search(r"(\d+)", n.rsplit("/", 1)[1]).group(1)))
        for n in names:
            xml = z.read(n).decode("utf-8", errors="replace")
            paras = []
            for p in re.findall(r"<a:p>.*?</a:p>", xml, flags=re.S):
                t = "".join(re.findall(r"<a:t>(.*?)</a:t>", p, flags=re.S))
                t = (t.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                     .replace("&quot;", '"').replace("&apos;", "'")).strip()
                if t:
                    paras.append(t)
            num = re.search(r"(\d+)", n.rsplit("/", 1)[1]).group(1)
            out.append(f"[slide {num}] " + " / ".join(paras))
    return "\n".join(out)


def material_text(path):
    p = Path(path)
    suffix = p.suffix.lower()
    if suffix == ".pptx":
        body = pptx_text(p)
    elif suffix == ".pdf":
        if not shutil.which("pdftotext"):
            sys.exit("pdftotext is needed for .pdf materials (brew install poppler)")
        body = subprocess.run(["pdftotext", "-layout", str(p), "-"], capture_output=True, text=True).stdout
    else:
        body = p.read_text(encoding="utf-8", errors="replace")
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    return f"=== {p.name} ===\n{body}"


def read_slides(path):
    """'[minute N]' sections -> [(minute, text)]."""
    if not path:
        return []
    out, minute, buf = [], None, []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*\[minute\s+(\d+)\]\s*(.*)$", line)
        if m:
            if minute is not None:
                out.append((minute, " ".join(" ".join(buf).split())))
            minute, buf = int(m.group(1)), [m.group(2)]
        elif minute is not None:
            buf.append(line)
    if minute is not None:
        out.append((minute, " ".join(" ".join(buf).split())))
    return sorted(out)


def parse_timed(values, what):
    out = []
    for v in values or []:
        if "|" not in v:
            sys.exit(f"{what} wants MINUTE|text, got: {v}")
        minute, text = v.split("|", 1)
        out.append((int(minute), text))
    return sorted(out, key=lambda x: x[0])


def fill(template, values):
    for key, value in values.items():
        template = template.replace("{{" + key + "}}", value)
    left = re.findall(r"\{\{[A-Z_]+\}\}", template)
    if left:
        sys.exit(f"unfilled placeholders: {left}")
    return template


# ---------------------------------------------------------------- the notes (blocks)

class Notes:
    def __init__(self, heading):
        self.heading = heading
        self.title = None
        self.blocks = []          # {id, depth, text, author: dot|him|added}
        self.counters = {"d": 0, "h": 0, "a": 0}
        self.log = []             # (minute, kind, detail)

    def new_id(self, prefix):
        self.counters[prefix] += 1
        return f"{prefix}{self.counters[prefix]}"

    def find(self, bid):
        for i, b in enumerate(self.blocks):
            if b["id"] == bid:
                return i
        return None

    def append(self, depth, text, author):
        bid = self.new_id({"dot": "d", "him": "h", "added": "a"}[author])
        self.blocks.append({"id": bid, "depth": depth, "text": text, "author": author})
        return bid

    def last_dot(self):
        for b in reversed(self.blocks):
            if b["author"] == "dot":
                return b
        return None

    def tail(self, n):
        rows = []
        for b in self.blocks[-n:]:
            who = {"dot": "dot", "him": "his", "added": "added"}[b["author"]]
            rows.append(f'{b["id"]} ({who}, depth {b["depth"]}): {b["text"]}')
        return "\n".join(rows) if rows else "(nothing yet)"

    def all_with_ids(self):
        return self.tail(len(self.blocks)) if self.blocks else "(no notes)"

    def markdown(self):
        head = f"## {self.heading}" + (f": {self.title}" if self.title else "")
        lines = [head]
        for b in self.blocks:
            mark = "⁺ " if b["author"] == "added" else ""
            lines.append("  " * b["depth"] + f"- {mark}{b['text']}")
        return "\n".join(lines) + "\n"


BULLET = re.compile(r"^( *)- (.+)$")
REWRITE = re.compile(r"^~\s*(d\d+)\s*:\s*(.+)$")
TITLE = re.compile(r"^##\s+(.+)$")
EXPLAIN = re.compile(r"^\?\s*(.+)$")
AFTER = re.compile(r"^\+after\s+([a-z]\d+)\s*:\s*(.+)$")
FEEDBACK = re.compile(r"^FEEDBACK:\s*(.+)$")


def apply_reply(notes, reply, minute, mode, result):
    """Parser rules (protocol section 2). Returns counts for the cycle."""
    counts = {"appended": 0, "rewrote": 0, "explain": 0, "title": 0, "added": 0, "feedback": 0, "ignored": 0, "refused": 0}
    after_runs = {}   # anchor id -> id of the last line inserted after it this reply (keeps their order)
    for raw in (reply or "").splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        if line.strip().lower().strip("`.") == "nothing":
            continue
        if mode == "class":
            m = BULLET.match(line)
            if m:
                depth = min(3, len(m.group(1)) // 2)
                bid = notes.append(depth, m.group(2).strip(), "dot")
                counts["appended"] += 1
                continue
            m = REWRITE.match(line)
            if m:
                bid, text = m.group(1), re.sub(r"^\s*-\s+", "", m.group(2)).strip()
                i = notes.find(bid)
                if i is None or notes.blocks[i]["author"] != "dot":
                    why = "no such block" if i is None else "not Dot's block"
                    notes.log.append((minute, "refused", f"{line}  ({why})"))
                    counts["refused"] += 1
                elif notes.blocks[i]["text"] == text:
                    notes.log.append((minute, "unchanged rewrite", bid))
                else:
                    notes.log.append((minute, "rewrite", f'{bid}: "{notes.blocks[i]["text"]}" -> "{text}"'))
                    notes.blocks[i]["text"] = text
                    counts["rewrote"] += 1
                continue
            m = TITLE.match(line)
            if m:
                notes.log.append((minute, "title", m.group(1).strip()))
                notes.title = m.group(1).strip()
                counts["title"] += 1
                continue
            m = EXPLAIN.match(line)
            if m:
                body = m.group(1)
                topic, _, why = body.partition("|")
                result["explains"].append({"minute": minute, "topic": topic.strip(), "why": why.strip()})
                counts["explain"] += 1
                continue
        elif mode == "gapfill":
            m = AFTER.match(line)
            if m:
                anchor, text = m.group(1), re.sub(r"^\s*-\s+", "", m.group(2)).strip()
                text = re.sub(r"^⁺\s*", "", text)
                i = notes.find(after_runs.get(anchor, anchor))
                if i is None:
                    notes.log.append((minute, "refused", f"{line}  (no such block)"))
                    counts["refused"] += 1
                    continue
                depth = notes.blocks[notes.find(anchor)]["depth"]
                # After the anchor's own sub-bullets, so an added line never splits a topic from its details.
                j = i
                while j + 1 < len(notes.blocks) and notes.blocks[j + 1]["depth"] > depth:
                    j += 1
                if j != i:
                    notes.log.append((minute, "gap-fill", f"{anchor} has sub-bullets; placed after {notes.blocks[j]['id']}"))
                i = j
                bid = notes.new_id("a")
                notes.blocks.insert(i + 1, {"id": bid, "depth": depth, "text": text, "author": "added"})
                after_runs[anchor] = bid
                counts["added"] += 1
                continue
        elif mode == "recall":
            m = FEEDBACK.match(line)
            if m:
                result["feedback"].append(m.group(1).strip())
                counts["feedback"] += 1
                continue
        notes.log.append((minute, "ignored", line))
        counts["ignored"] += 1
    return counts


# ---------------------------------------------------------------- the session

class Session:
    def __init__(self, args, system_prompt):
        cmd = [args.claude, "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
               "--session-id", str(uuid.uuid4()), "--model", args.model,
               "--permission-mode", "default", "--system-prompt", system_prompt, "--tools", "",
               "--mcp-config", '{"mcpServers":{}}', "--strict-mcp-config", "--setting-sources", "",
               "--no-session-persistence"]
        if args.effort:
            cmd += ["--effort", args.effort]
        env = dict(os.environ)
        env.pop("CLAUDECODE", None)
        env.pop("CLAUDE_CODE_ENTRYPOINT", None)
        if args.thinking == "off":
            env["MAX_THINKING_TOKENS"] = "0"
        self.cmd_shown = [c if c != system_prompt else f"<system prompt, {len(system_prompt)} chars>" for c in cmd]
        self.proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                     text=True, bufsize=1, env=env, cwd=args.cwd)
        self.events = queue.Queue()
        self.model = None
        self.last_total_cost = 0.0
        threading.Thread(target=self._read, daemon=True).start()
        threading.Thread(target=self._drain_stderr, daemon=True).start()

    def _read(self):
        for line in self.proc.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                self.events.put(json.loads(line))
            except json.JSONDecodeError:
                pass
        self.events.put(None)

    def _drain_stderr(self):
        for line in self.proc.stderr:
            if line.strip():
                sys.stderr.write(f"[claude stderr] {line}")

    def turn(self, text, timeout):
        msg = {"type": "user", "message": {"role": "user", "content": [{"type": "text", "text": text}]},
               "parent_tool_use_id": None, "session_id": ""}
        started = time.time()
        first_token = None
        self.proc.stdin.write(json.dumps(msg) + "\n")
        self.proc.stdin.flush()
        while True:
            try:
                ev = self.events.get(timeout=max(1, timeout - (time.time() - started)))
            except queue.Empty:
                return {"text": None, "error": f"timed out after {timeout}s", "seconds": time.time() - started}
            if ev is None:
                return {"text": None, "error": "claude exited", "seconds": time.time() - started}
            kind = ev.get("type")
            if kind == "system" and ev.get("subtype") == "init":
                self.model = ev.get("model")
            if kind == "assistant" and first_token is None:
                first_token = time.time() - started
            if kind == "result":
                usage = ev.get("usage") or {}
                total = ev.get("total_cost_usd") or 0.0
                cost = max(0.0, total - self.last_total_cost)
                self.last_total_cost = total
                return {
                    "text": ev.get("result") or "",
                    "error": ev.get("subtype") if ev.get("is_error") else None,
                    "seconds": time.time() - started,
                    "first_message_s": first_token,
                    "duration_ms": ev.get("duration_ms"),
                    "input_tokens": usage.get("input_tokens", 0),
                    "cache_read": usage.get("cache_read_input_tokens", 0),
                    "cache_write": usage.get("cache_creation_input_tokens", 0),
                    "output_tokens": usage.get("output_tokens", 0),
                    "thinking_tokens": (usage.get("output_tokens_details") or {}).get("thinking_tokens", 0),
                    "cost_usd": cost,
                }

    def close(self):
        try:
            self.proc.stdin.close()
        except Exception:
            pass
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()


# ---------------------------------------------------------------- the replay

def cycle_message(minute, words, slide, edits, notes, tail_n):
    parts = [f"[minute {minute}] new speech (machine transcribed; names and terms may be misspelled):",
             f'"{words}"']
    if slide is not None:
        parts.append(f'slide on his screen (OCR): "{slide}"')
    if edits:
        parts.append("his edits since last time:")
        parts += [f"- {e}" for e in edits]
    parts.append("the notes end like this now:")
    parts.append(notes.tail(tail_n))
    return "\n".join(parts)


def simulate_edits(notes, minute, adds, changes, deletes):
    """His edits due by this minute, applied to the notes; returns the protocol's edit lines."""
    edits = []
    while adds and adds[0][0] <= minute:
        _, text = adds.pop(0)
        m = re.match(r"^( *)- (.+)$", text)
        depth, body = (min(3, len(m.group(1)) // 2), m.group(2)) if m else (0, text)
        after = notes.blocks[-1]["id"] if notes.blocks else None
        bid = notes.append(depth, body, "him")
        edits.append(f'he wrote {bid} after {after}: "{body}"' if after else f'he wrote {bid}: "{body}"')
        notes.log.append((minute, "his edit", edits[-1]))
    while changes and changes[0][0] <= minute:
        _, spec = changes.pop(0)
        b = notes.last_dot()
        if not b:
            continue
        b["text"] = b["text"] + spec[1:] if spec.startswith("+") else spec.lstrip("=")
        b["author"] = "him"
        edits.append(f'he changed {b["id"]} to: "{b["text"]}"')
        notes.log.append((minute, "his edit", edits[-1]))
    while deletes and deletes[0] <= minute:
        deletes.pop(0)
        b = notes.last_dot()
        if not b:
            continue
        notes.blocks.remove(b)
        edits.append(f'he deleted {b["id"]}')
        notes.log.append((minute, "his edit", f'{edits[-1]} ("{b["text"]}")'))
    return edits


def stats(values):
    v = sorted(x for x in values if x is not None)
    if not v:
        return {}
    pick = lambda q: v[min(len(v) - 1, int(round(q * (len(v) - 1))))]
    return {"n": len(v), "mean": sum(v) / len(v), "p50": pick(0.5), "p90": pick(0.9), "max": v[-1], "min": v[0]}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("transcript")
    ap.add_argument("--course", default="(course not given)", help='"CODE, Title"')
    ap.add_argument("--course-map", help="the course map text, added to {{COURSE}}")
    ap.add_argument("--materials", action="append", default=[], help="today's slides or readings (repeatable)")
    ap.add_argument("--style", help="style block file (default: Resources/lecture/notes-style-default.md)")
    ap.add_argument("--heading", default=None, help='class heading, e.g. "CLASS 7 (Thu Oct 22)"')
    ap.add_argument("--time", default="", help="class time for the [start] line, e.g. 11:00-12:20")
    ap.add_argument("--start-minute", type=int, default=0, help="minute of class at which the transcript starts")
    ap.add_argument("--minutes", type=float, default=None, help="replay only this many minutes of transcript")
    ap.add_argument("--words-per-chunk", type=int, default=110, help="~45 seconds of speech (default 110)")
    ap.add_argument("--slides", help='slides on his screen: "[minute N]" sections')
    ap.add_argument("--his-add", action="append", help='MINUTE|text: he types a line at the end ("  - " sets depth)')
    ap.add_argument("--his-change", action="append", help="MINUTE|+suffix or MINUTE|=text: he edits Dot's latest block")
    ap.add_argument("--his-delete", action="append", type=int, help="MINUTE: he deletes Dot's latest block")
    ap.add_argument("--recall", help="his 3 big ideas (omit to skip [recall])")
    ap.add_argument("--no-gapfill", action="store_true")
    ap.add_argument("--tail", type=int, default=12, help="blocks shown to the writer each cycle")
    ap.add_argument("--model", default="sonnet")
    ap.add_argument("--thinking", choices=["on", "off"], default="off",
                    help="off sets MAX_THINKING_TOKENS=0, as Dot's quick sessions do")
    ap.add_argument("--effort", default=None)
    ap.add_argument("--prompts", default=str(PROMPTS))
    ap.add_argument("--claude", default=shutil.which("claude") or "claude")
    ap.add_argument("--cwd", default=None, help="working directory for claude (default: a temp folder in --out)")
    ap.add_argument("--timeout", type=int, default=120, help="seconds per turn")
    ap.add_argument("--out", default=None)
    ap.add_argument("--dry-run", action="store_true", help="write the system prompt and messages, call nothing")
    args = ap.parse_args()

    prompts = Path(args.prompts)
    out = Path(args.out or f"lecture-replay-{dt.datetime.now():%Y%m%d-%H%M%S}")
    out.mkdir(parents=True, exist_ok=True)
    args.cwd = args.cwd or str(out / "cwd")
    Path(args.cwd).mkdir(parents=True, exist_ok=True)

    heading = args.heading or f"CLASS 1 ({dt.date.today():%a %b} {dt.date.today().day})"
    course_text = args.course
    if args.course_map:
        course_text += "\n\n" + Path(args.course_map).read_text(encoding="utf-8").strip()
    materials = "\n\n".join(material_text(m) for m in args.materials) if args.materials else ""
    style = Path(args.style or prompts / "notes-style-default.md").read_text(encoding="utf-8").strip()
    system_prompt = fill((prompts / "notes-system.md").read_text(encoding="utf-8"), {
        "STYLE": style, "COURSE": course_text, "CLASS": heading,
        "MATERIALS": materials or "(none yet)"})
    (out / "system-prompt.md").write_text(system_prompt, encoding="utf-8")

    words = read_transcript(args.transcript).split()
    per_minute = args.words_per_chunk * 60 / CHUNK_SECONDS
    if args.minutes:
        words = words[: int(args.minutes * per_minute)]
    chunks = [" ".join(words[i:i + args.words_per_chunk]) for i in range(0, len(words), args.words_per_chunk)]
    slides = read_slides(args.slides)
    adds = parse_timed(args.his_add, "--his-add")
    changes = parse_timed(args.his_change, "--his-change")
    deletes = sorted(args.his_delete or [])

    notes = Notes(heading)
    result = {"explains": [], "feedback": [], "cycles": [], "end": {}}
    convo = [f"# Replay of {Path(args.transcript).name}\n", f"system prompt: {len(system_prompt)} chars (system-prompt.md)\n"]

    start_line = f"[start] {heading}, {args.course}" + (f", {args.time}" if args.time else "")
    session = None if args.dry_run else Session(args, system_prompt)

    def run_turn(label, text, minute, mode):
        convo.append(f"\n## >>> {label}\n```\n{text}\n```\n")
        if session is None:
            return {"text": "nothing", "seconds": 0}, {}
        r = session.turn(text, args.timeout)
        convo.append(f"## <<< reply ({r['seconds']:.1f}s)\n```\n{r['text'] if r['text'] is not None else r['error']}\n```\n")
        counts = apply_reply(notes, r["text"] or "", minute, mode, result)
        if r.get("error"):
            notes.log.append((minute, "error", r["error"]))
        return r, counts

    try:
        r, _ = run_turn("start", start_line, args.start_minute, "class")
        result["start"] = {k: r.get(k) for k in ("seconds", "cost_usd", "cache_write", "input_tokens")}
        slide_i = 0
        current_slide = None
        for i, chunk in enumerate(chunks):
            minute = args.start_minute + int((i + 1) * CHUNK_SECONDS / 60)
            slide = None
            while slide_i < len(slides) and slides[slide_i][0] <= minute:
                if slides[slide_i][1] != current_slide:
                    slide = current_slide = slides[slide_i][1]
                slide_i += 1
            edits = simulate_edits(notes, minute, adds, changes, deletes)
            msg = cycle_message(minute, chunk, slide, edits, notes, args.tail)
            r, counts = run_turn(f"cycle {i + 1}, minute {minute}", msg, minute, "class")
            row = {"cycle": i + 1, "minute": minute, **{k: r.get(k) for k in (
                "seconds", "first_message_s", "input_tokens", "cache_read", "cache_write", "output_tokens",
                "thinking_tokens", "cost_usd", "error")}, **counts, "reply": r.get("text")}
            result["cycles"].append(row)
            print(f"cycle {i + 1:3d} min {minute:3d}  {r.get('seconds', 0):5.1f}s  "
                  f"+{counts.get('appended', 0)} ~{counts.get('rewrote', 0)} ?{counts.get('explain', 0)}"
                  f"{'  ' + r['error'] if r.get('error') else ''}", flush=True)
        end_minute = args.start_minute + int(len(chunks) * CHUNK_SECONDS / 60)
        # The end-of-class messages are built the way Dot builds them (LectureSession.recall / gapFill): the protocol
        # line, the instructions file, then (gap-fill) the slides and readings and every block with its id.
        if args.recall:
            text = f'[recall] his 3 big ideas: "{args.recall}"\n\n' + (prompts / "notes-recall.md").read_text(encoding="utf-8")
            r, _ = run_turn("recall", text.strip(), end_minute, "recall")
            result["end"]["recall"] = {k: r.get(k) for k in ("seconds", "cost_usd", "text")}
        if not args.no_gapfill and materials:
            text = ("[gap-fill]\n" + (prompts / "notes-gapfill.md").read_text(encoding="utf-8")
                    + "\n\nslides and readings:\n" + materials
                    + "\n\nthe whole class's notes, with ids:\n" + notes.all_with_ids())
            r, _ = run_turn("gap-fill", text.strip(), end_minute, "gapfill")
            result["end"]["gapfill"] = {k: r.get(k) for k in ("seconds", "cost_usd", "text")}
    finally:
        if session:
            session.close()

    md = notes.markdown()
    (out / "notes.md").write_text(md, encoding="utf-8")
    (out / "conversation.md").write_text("".join(convo), encoding="utf-8")

    cycles = result["cycles"]
    lat = stats([c["seconds"] for c in cycles])
    body_words = sum(len(b["text"].split()) for b in notes.blocks if b["author"] == "dot")
    total_cost = sum((c.get("cost_usd") or 0) for c in cycles) + sum(
        (v.get("cost_usd") or 0) for v in result["end"].values()) + (result.get("start", {}).get("cost_usd") or 0)
    summary = {
        "model": session.model if session else None, "thinking": args.thinking, "chunks": len(chunks),
        "minutes_replayed": round(len(chunks) * CHUNK_SECONDS / 60, 1),
        "dot_blocks": sum(1 for b in notes.blocks if b["author"] == "dot"),
        "dot_words": body_words, "added_blocks": sum(1 for b in notes.blocks if b["author"] == "added"),
        "nothing_cycles": sum(1 for c in cycles if not (c.get("appended") or c.get("rewrote") or c.get("explain"))),
        "explains": len(result["explains"]), "latency_s": lat, "total_cost_usd": round(total_cost, 4),
        "cache_read_tokens": sum(c.get("cache_read") or 0 for c in cycles),
        "thinking_tokens": sum(c.get("thinking_tokens") or 0 for c in cycles),
        "output_tokens": sum(c.get("output_tokens") or 0 for c in cycles),
    }
    result["summary"] = summary
    (out / "run.json").write_text(json.dumps(result, indent=2), encoding="utf-8")

    log = [f"# Replay log: {Path(args.transcript).name}\n",
           f"model {summary['model']}, thinking {args.thinking}; {summary['chunks']} cycles "
           f"({summary['minutes_replayed']} min); Dot wrote {summary['dot_blocks']} blocks, {body_words} words; "
           f"{summary['nothing_cycles']} cycles added nothing; total cost ${summary['total_cost_usd']}\n"]
    if lat:
        log.append(f"latency per cycle: mean {lat['mean']:.1f}s, p50 {lat['p50']:.1f}s, p90 {lat['p90']:.1f}s, "
                   f"max {lat['max']:.1f}s, min {lat['min']:.1f}s\n")
    log.append("\n## Explain triggers\n")
    log += [f"- min {e['minute']}: {e['topic']} | {e['why']}\n" for e in result["explains"]] or ["- none\n"]
    gaps = [b["minute"] - a["minute"] for a, b in zip(result["explains"], result["explains"][1:])]
    close = [g for g in gaps if g < 3]
    if close:
        log.append(f"- {len(close)} pair(s) closer than 3 minutes apart\n")
    log.append("\n## Recall feedback\n")
    log += [f"- {f}\n" for f in result["feedback"]] or ["- none\n"]
    log.append("\n## Edits, rewrites, titles, refused and ignored lines\n")
    log += [f"- min {m} {kind}: {detail}\n" for m, kind, detail in notes.log] or ["- none\n"]
    log.append("\n## Per cycle\n\n| cycle | min | s | in | cache read | cache write | out | think | cost | + | ~ | ? |\n"
               "|---|---|---|---|---|---|---|---|---|---|---|---|\n")
    for c in cycles:
        log.append(f"| {c['cycle']} | {c['minute']} | {c['seconds'] or 0:.1f} | {c.get('input_tokens') or 0} | "
                   f"{c.get('cache_read') or 0} | {c.get('cache_write') or 0} | {c.get('output_tokens') or 0} | "
                   f"{c.get('thinking_tokens') or 0} | {c.get('cost_usd') or 0:.4f} | {c.get('appended', 0)} | "
                   f"{c.get('rewrote', 0)} | {c.get('explain', 0)} |\n")
    for k, v in result["end"].items():
        log.append(f"\n{k}: {v.get('seconds') or 0:.1f}s, ${v.get('cost_usd') or 0:.4f}\n")
    (out / "log.md").write_text("".join(log), encoding="utf-8")

    print("\n" + md)
    print("".join(log[:3]))
    print(f"wrote {out}/notes.md, log.md, conversation.md, run.json")


if __name__ == "__main__":
    main()
