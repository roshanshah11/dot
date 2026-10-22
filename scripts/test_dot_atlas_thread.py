#!/usr/bin/env python3
"""dot-atlas-thread.py: Dot's turns become Atlas history records that history() renders as conversation, a replay adds
nothing, and box records pair into his turns (an answer counts only before his next prompt in that chat)."""
import importlib.util, json, os, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("thread", HERE / "dot-atlas-thread.py")
thread = importlib.util.module_from_spec(spec); spec.loader.exec_module(thread)
failures = []


def check(ok, what):
    if not ok: failures.append(what)


with tempfile.TemporaryDirectory() as root:
    env = {**os.environ, "DOT_ATLAS_LOCAL": root, "DOT_ATLAS_NO_SHIP": "1"}
    items = [{"at": "2026-10-22T10:20:00-05:00", "kind": "talk", "asked": "show me flights from ohare to philly", "said": "on it, behind your window."},
             {"at": "2026-10-22T10:21:30-05:00", "kind": "job", "asked": "show me flights from ohare to philly", "said": "done: 3 nonstops around 4 pm"}]
    body = "".join(json.dumps(i) + "\n" for i in items)
    run = lambda: subprocess.run([sys.executable, str(HERE / "dot-atlas-thread.py"), "record"], input=body, capture_output=True, text=True, env=env)
    first, again = run(), run()
    check(first.returncode == 0 and json.loads(first.stdout)["added"] == 3, f"record: {first.stdout} {first.stderr}")
    check(json.loads(again.stdout)["added"] == 0, f"replay added rows: {again.stdout}")
    sys.path.insert(0, str(thread.HARNESS))
    from atlas.chat_memory import history
    text = history(root, session="dot-2026-10-22")
    check("user: Question from him to Dot, out loud on his Mac: show me flights from ohare to philly" in text, "history lacks his words:\n" + text)
    check('Dot\'s job for "show me flights from ohare to philly": done: 3 nonstops' in text, "history lacks the job's end:\n" + text)
    check("Dot said: on it, behind your window." in text, "history lacks dot's answer")

box = [  # newest first, as the box query returns them
    {"seq": 9, "session": "a", "saved": "2026-10-22 15:16:56", "event": "Stop", "said": "he wrote back"},
    {"seq": 8, "session": "a", "saved": "2026-10-22 15:16:45", "event": "UserPromptSubmit", "prompt": "okay he responded"},
    {"seq": 7, "session": "a", "saved": "2026-10-22 15:16:04", "event": "UserPromptSubmit", "prompt": "say i will confirm later"},
    {"seq": 6, "session": "t", "saved": "2026-10-22 15:10:00", "event": "Stop", "said": "booked nothing; two rooms free"},
    {"seq": 5, "session": "t", "saved": "2026-10-22 15:09:00", "event": "UserPromptSubmit",
     "prompt": "Message from him in his Telegram chat with Atlas (turn 3 of this conversation): any rooms free at 4"},
    {"seq": 4, "session": "d", "saved": "2026-10-22 15:08:00", "event": "UserPromptSubmit", "prompt": "Question from him to Dot, out loud on his Mac: hi"},
    {"seq": 3, "session": "p", "saved": "2026-10-22 15:07:00", "event": "UserPromptSubmit", "prompt": "Reply with the single word OK."},
]
turns = thread.pair(box, 6)
check([t["asked"] for t in turns] == ["any rooms free at 4", "say i will confirm later", "okay he responded"], f"turns: {turns}")
check(turns[0]["surface"] == "telegram" and turns[0]["said"] == "booked nothing; two rooms free", f"telegram turn: {turns[0]}")
check(turns[1]["said"] == "", f"an answer after his next prompt was paired: {turns[1]}")
check(turns[2]["said"] == "he wrote back", f"last turn: {turns[2]}")

print("\n".join(failures) if failures else "ok")
sys.exit(1 if failures else 0)
