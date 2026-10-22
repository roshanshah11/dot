#!/usr/bin/env python3
"""One thread of record between Dot and Atlas (his call, 2026-10-22: "the whole point was dot/atlas integration").

Dot's turns go into Atlas's conversation history, the one his Atlas chats already read: every Atlas chat header carries
the newest history records (atlas.mcp chat_prompt), and the history tool finds older ones. Dot writes them into this
Mac's own history store (~/.local/share/atlas-m3), which atlas-memory-ship sends to Atlas on the agent box; Dot kicks the
shipper so they land in seconds, and a box that is down gets them on its next pass. The other way, Dot reads his newest
Atlas turns (Telegram, the app, his terminal chats) from the box, so "it" can mean what he just told Atlas.

  dot-atlas-thread.py record    JSON lines on stdin: {"at": iso, "kind": "talk|job|agent", "asked": str, "said": str}
  dot-atlas-thread.py recent [--minutes 30] [--limit 6]
                                JSON lines, oldest first: {"at", "surface", "asked", "said"}; nothing when the box is down

Records look like the hook records Atlas keeps (a UserPromptSubmit prompt, a Stop message), so history() and the app
render them as conversation. Each day is one session, dot-YYYY-MM-DD; its prompts start "Question from him", one of the
app's template prefixes, so the app's On-your-Mac list leaves it out (it has no transcript to continue on the phone).
"""
import datetime, hashlib, json, os, subprocess, sys
from pathlib import Path

HARNESS = Path(os.environ.get("DOT_ATLAS_HARNESS", Path.home() / "roshan" / "Atlas" / "harness"))
LOCAL = Path(os.environ.get("DOT_ATLAS_LOCAL", Path.home() / ".local" / "share" / "atlas-m3"))
BOX = os.environ.get("DOT_ATLAS_BOX", "mbp2020")
BOX_DB = "~/roshan/Atlas/private/chat-memory/history.sqlite"
SHIPPER = "com.roshan.atlas.memory-ship"
ASKED = "Question from him to Dot, out loud on his Mac: "
KINDS = {"talk": "Dot said: ", "job": "Dot's job ", "agent": "Dot's agent "}

# Atlas's own wrappers around his words: the surface they came from, and where his words start.
SURFACES = (("Message from him in his Telegram chat with Atlas", "telegram"), ("Message from him in the Atlas app", "atlas app"),
            ("Request from him, typed in the Ask tab", "ask tab"), ("Question from him to Dot", None))
SKIP = ("Proactive run", "Proposal drafting run", "Nightly lesson pass", "Name this chat", "Reply with the single word",
        "<", "Caveat:", "[Request interrupted")


def rows_for(item):
    at = datetime.datetime.fromisoformat(item["at"]).astimezone(datetime.timezone.utc)
    saved = at.strftime("%Y-%m-%d %H:%M:%S")
    session = "dot-" + datetime.datetime.fromisoformat(item["at"]).astimezone().strftime("%Y-%m-%d")
    kind = item.get("kind", "talk")
    out = []
    asked, said = (item.get("asked") or "").strip(), (item.get("said") or "").strip()
    if kind == "talk" and asked:
        out.append({"hook_event_name": "UserPromptSubmit", "prompt": ASKED + asked})
    if said:
        lead = KINDS.get(kind, "Dot said: ")
        text = lead + said if kind == "talk" else f'{lead}for "{asked}": {said}'
        out.append({"hook_event_name": "Stop", "last_assistant_message": text})
    rows = []
    for payload in out:
        body = json.dumps(payload, ensure_ascii=False)
        key = "dot:" + hashlib.sha256((saved + body).encode()).hexdigest()[:32]
        rows.append({"session": session, "key": key, "payload": body, "saved": saved})
    return rows


def record(lines):
    rows = [r for line in lines if line.strip() for r in rows_for(json.loads(line))]
    if not rows:
        print(json.dumps({"received": 0, "added": 0}))
        return 0
    sys.path.insert(0, str(HARNESS))
    try:
        from atlas.chat_memory import import_records
    except ImportError as e:
        print(f"no atlas harness at {HARNESS}: {e}", file=sys.stderr)
        return 4
    result = import_records(str(LOCAL), rows)
    print(json.dumps(result))
    if result.get("added") and not os.environ.get("DOT_ATLAS_NO_SHIP"):
        # Ship now rather than at the next 2-minute pass; kickstart returns at once.
        subprocess.run(["launchctl", "kickstart", f"gui/{os.getuid()}/{SHIPPER}"], capture_output=True, timeout=5)
    return 0


def surface_of(prompt):
    for prefix, name in SURFACES:
        if prompt.startswith(prefix):
            words = prompt.split(": ", 1)[1] if ": " in prompt[: len(prefix) + 80] else prompt
            return name, words.strip()
    return "terminal", prompt.strip()


def pair(records, limit):
    """Box records, newest first, into his turns oldest first: each prompt with the next Stop in its session."""
    answers, turns, next_prompt = {}, [], {}
    for r in records:   # newest first: a prompt's answer is its session's first Stop before his next prompt there
        if r["event"] == "Stop" and r.get("said"):
            answers.setdefault(r["session"], []).append(r)
        elif r["event"] == "UserPromptSubmit" and r.get("prompt"):
            prompt = r["prompt"]
            if prompt.lstrip().startswith(SKIP) or len(prompt.strip()) < 2:
                continue
            surface, words = surface_of(prompt)
            if surface is None:
                continue   # Dot's own records, already in Dot's context
            until = next_prompt.get(r["session"], 1 << 62)
            later = [a for a in answers.get(r["session"], []) if r["seq"] < a["seq"] < until]
            said = min(later, key=lambda a: a["seq"])["said"] if later else ""
            next_prompt[r["session"]] = r["seq"]
            turns.append({"at": r["saved"], "surface": surface, "asked": words[:600], "said": said[:600]})
        if len(turns) >= limit:
            break
    return list(reversed(turns))


def recent(minutes, limit):
    sql = f"""SELECT json_object('seq', seq, 'session', session, 'saved', saved, 'event', json_extract(payload, '$.hook_event_name'),
               'prompt', json_extract(payload, '$.prompt'), 'said', json_extract(payload, '$.last_assistant_message'))
             FROM records WHERE seq > (SELECT max(seq) FROM records) - 8000 AND session NOT LIKE 'dot-%'
               AND saved > datetime('now', '-{int(minutes)} minutes')
               AND json_extract(payload, '$.hook_event_name') IN ('UserPromptSubmit', 'Stop')
             ORDER BY seq DESC LIMIT 200;"""
    try:
        p = subprocess.run(["ssh", "-o", "ConnectTimeout=4", "-o", "BatchMode=yes", BOX, f"sqlite3 {BOX_DB}"],
                           input=sql, capture_output=True, text=True, timeout=12)
    except subprocess.TimeoutExpired:
        print("box timed out", file=sys.stderr)
        return 0
    if p.returncode:
        print("box unreachable: " + p.stderr.strip()[-200:], file=sys.stderr)
        return 0
    records = [json.loads(l) for l in p.stdout.splitlines() if l.startswith("{")]
    for t in pair(records, limit):
        t["at"] = datetime.datetime.strptime(t["at"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=datetime.timezone.utc).isoformat()
        print(json.dumps(t, ensure_ascii=False))
    return 0


def main(argv):
    if argv[:1] == ["record"]:
        return record(sys.stdin.read().splitlines())
    if argv[:1] == ["recent"]:
        minutes = int(argv[argv.index("--minutes") + 1]) if "--minutes" in argv else 30
        limit = int(argv[argv.index("--limit") + 1]) if "--limit" in argv else 6
        return recent(minutes, limit)
    print(__doc__.strip().splitlines()[0])
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
