#!/opt/homebrew/bin/python3.13
"""Dot's view of Roshan's day, read straight from Atlas (no model call, about 5 s).

Prints one JSON object: a compact `block` for the talk prompt, plus the raw lists and counts
Dot uses for the morning line and the notch. Run by Dot every few minutes; never writes.

    dot-atlas-today.py --root ~/roshan [--harness ~/roshan/Atlas/harness] [--max-chars 2200]
"""
import argparse, json, re, sys, time
from datetime import datetime, timedelta
from pathlib import Path

NOISE = re.compile(r'receipt|reminder|parcel|package|no-?reply|notification|digest|newsletter|unsubscribe|libcal|ridewithvia|alerts@', re.I)


def strip_ids(line):
    line = re.sub(r'\s*\[[0-9a-f]{8}(?:,\s*[0-9a-f]{8})*\]', '', line)
    line = re.sub(r'^\[[ct]:[0-9a-f]{8}\]\s*', '', line)
    return re.sub(r'\s+', ' ', line).strip()


def clip(text, n):
    text = text.strip()
    return text if len(text) <= n else text[: n - 1].rstrip() + '…'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default=str(Path.home() / 'roshan'))
    ap.add_argument('--harness', default=None)
    ap.add_argument('--max-chars', type=int, default=3200)
    args = ap.parse_args()
    root = Path(args.root).expanduser()
    sys.path.insert(0, str(Path(args.harness).expanduser() if args.harness else root / 'Atlas' / 'harness'))
    from atlas.store import Store          # noqa: E402
    from atlas.mcp import Server           # noqa: E402

    t0 = time.time()
    store = Store(root)
    srv = Server(store, session='dot-today')
    now = datetime.now().astimezone()
    d0, d1, d2 = [(now + timedelta(days=i)).date().isoformat() for i in range(3)]
    owner = store.get_runtime('owner_entity')
    out = {'built_at': now.replace(tzinfo=None).isoformat(timespec='minutes'), 'weekday': now.strftime('%A'), 'date': d0}
    with store.batched_decisions():
        live = srv._live(owner) if owner else []
        facts, deadlines = srv._profile(owner, d0, live) if owner else ([], [])
        today = srv.calendar(d0, d1)
        tomorrow = srv.calendar(d1, d2)
        commitments = srv.commitment_lines('open', today=d0)
        todo = srv.commitment_lines('open', predicate='todo', today=d0)
        waiting = srv.decisions_waiting()
        unanswered = srv.unanswered(7)
        try:
            state = srv._state_block()
        except Exception:
            state = ''

    def cal_lines(text):
        lines = []
        for raw in text.splitlines():
            raw = strip_ids(raw)
            if not raw or raw.startswith(('nothing', 'no events', 'coverage')): continue
            raw = raw.split(' | notes:')[0]
            parts = [p.strip() for p in raw.split(' | ')]
            head = parts[0]
            where = next((p for p in parts[1:] if p.startswith('at ')), '')
            lines.append(clip(head + (f' ({where})' if where else ''), 120))
        return lines

    out['deadlines'] = [clip(strip_ids(l).lstrip('- '), 150) for l in deadlines[:10]]
    out['today'] = cal_lines(today)[:8]
    out['tomorrow'] = cal_lines(tomorrow)[:6]
    out['commitments'] = [clip(strip_ids(l), 170) for l in commitments[:6]]
    out['todo'] = [clip(strip_ids(l), 140) for l in todo[:5]]
    out['waiting'] = [clip(strip_ids(l).lstrip('- '), 160) for l in waiting[:4]]
    mail = []
    for raw in unanswered.splitlines():
        raw = strip_ids(raw)
        if not raw or raw.startswith(('nothing', 'coverage:', 'unknown:')) or NOISE.search(raw): continue
        parts = [p.strip() for p in raw.split(' | ')]
        if len(parts) >= 3: mail.append(clip(f'{parts[1] or "?"}: {parts[2]} ({parts[0][:12]})', 110))
    out['unanswered'] = mail[:6]
    out['unanswered_count'] = len(mail)
    prefs = [clip(strip_ids(l).lstrip('- ').replace(' (unconfirmed)', ''), 170) for l in facts
             if re.match(r'-\s*(\w*preference|prefer|style|dislikes|default_|constraint)', l)]
    out['preferences'] = prefs[:6]
    priorities = []
    if state:
        m = re.search(r'### Priorities\n(.*?)(?:\n###|\Z)', state, re.S)
        if m: priorities = [clip(strip_ids(l).lstrip('- '), 220) for l in m.group(1).splitlines() if l.strip().startswith('-')][:3]
        head = state.split('\n', 1)[0]
        out['state_head'] = clip(strip_ids(head.strip('() ')), 300)
    out['priorities'] = priorities

    # The prompt block: what a sharp assistant would know at a glance. Sections are ordered by
    # how often a voice question touches them; trimming drops from the end.
    lines = [f"[today] {out['weekday']} {d0}, built {now.strftime('%H:%M')}"]
    if out['deadlines']:
        lines.append('deadlines next:'); lines += [f'- {l}' for l in out['deadlines'][:6]]
    if out['today']:
        lines.append('calendar today:'); lines += [f'- {l}' for l in out['today']]
    if out['commitments']:
        lines.append('open commitments:'); lines += [f'- {l}' for l in out['commitments'][:3]]
    if out['unanswered']:
        lines.append(f"mail waiting on him ({out['unanswered_count']}):"); lines += [f'- {l}' for l in out['unanswered'][:3]]
    if priorities:
        lines.append('his priorities:'); lines += [f'- {l}' for l in priorities[:2]]
    if prefs:
        lines.append('his preferences:'); lines += [f'- {l}' for l in prefs[:3]]
    if out['tomorrow']:
        lines.append('calendar tomorrow:'); lines += [f'- {l}' for l in out['tomorrow'][:3]]
    lines.append('[/today]')
    block = '\n'.join(lines)
    while len(block) > args.max_chars:
        # drop the last whole section (header line plus its items) until it fits; deadlines go last
        heads = [i for i, l in enumerate(lines) if l.endswith(':') and i > 0]
        if len(heads) <= 1: break
        del lines[heads[-1]:-1]
        block = '\n'.join(lines)
    out['block'] = block
    out['elapsed_s'] = round(time.time() - t0, 2)
    json.dump(out, sys.stdout, ensure_ascii=False)
    print()


if __name__ == '__main__':
    main()
