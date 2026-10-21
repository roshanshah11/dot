#!/usr/bin/env python3
"""Dot's bench runner: send one ask at a time to the running Dot in bench mode and check what happened.

    dot-bench.py [--requests ~/Dot/selftests/basics/requests.json] [--rows 1-14,19a,22]
                 [--dry-plan] [--port 8766 | --base http://127.0.0.1:8766] [--comet-port 9471]
                 [--dot ~/Applications/Dot.app/Contents/MacOS/Dot] [--dot-log ~/Library/Logs/Dot/dot.log]
                 [--ledger ~/Dot/ledger.sqlite] [--max-spend 10] [--out-dir ~/Dot/selftests/basics]
                 [--timeout 30] [--settle 3] [--think-timeout 90] [--require-idle 600]
                 [--shot-scale 1.0] [--no-launch] [--keep-comet]

For each row it brings a fixture page to the front (Safari via `open -a Safari`, or the throwaway bench
Comet through its own DevTools port, never 9222), runs `Dot --ask --bench <flags> --comet-port <port> "<ask>"`,
tails ~/Library/Logs/Dot/dot.log from the row's starting offset until the turn is done, reads the bench
server's events (scripts/bench-server.py) and checks the row's expectations. It never launches or quits
Dot, stops when Dot's model spend (the SUM of the ledger's cost column) grows past --max-spend, and
writes results-<stamp>.json and results-<stamp>.md to --out-dir. The row schema and the dot.log line
contract are in Tests/Fixtures/bench/README.md. Stdlib only.
"""
import urllib.request
import argparse, base64, ctypes, hashlib, json, os, re, socket, sqlite3, statistics, struct, subprocess, sys, time
import urllib.error, urllib.request
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

HOME = Path.home()
HERE = Path(__file__).resolve().parent
BENCH_DIR = HOME / 'Dot' / 'selftests' / 'basics'
DEFAULT_REQUESTS = BENCH_DIR / 'requests.json'
DEFAULT_DOT = HOME / 'Applications' / 'Dot.app' / 'Contents' / 'MacOS' / 'Dot'
DEFAULT_DOT_LOG = HOME / 'Library' / 'Logs' / 'Dot' / 'dot.log'
DEFAULT_LEDGER = HOME / 'Dot' / 'ledger.sqlite'
DEFAULT_PORT = 8766          # bench-server.py's default (8765 is taken on the bench Mac)
DEFAULT_COMET_PORT = 9471
FORBIDDEN_CDP_PORTS = {9222}  # the everyday Comet's DevTools port: never connect, never pass to Dot
SCRATCH = Path('/tmp/dot-bench')
FRONTS = ('safari', 'bench-comet', 'textedit', 'finder', 'none')
KINDS = ('regression', 'new')


class BenchError(Exception):
    pass


class RefusedPort(BenchError):
    pass


def check_port(port):
    port = int(port)
    if port in FORBIDDEN_CDP_PORTS:
        raise RefusedPort('refusing DevTools port %d (the everyday Comet); the bench Comet uses its own port' % port)
    return port


# ---------------------------------------------------------------------------------------------------
# dot.log parsing
# ---------------------------------------------------------------------------------------------------

LINE_RE = re.compile(r'^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\.(\d{3}) ([A-Z]+) (.*)$')


def stamp_to_epoch(stamp, ms=0):
    """'2026-10-18 21:31:09' (local time) plus milliseconds -> epoch seconds."""
    return time.mktime(datetime.strptime(stamp, '%Y-%m-%d %H:%M:%S').timetuple()) + int(ms) / 1000.0


class LogLine:
    __slots__ = ('ts', 'stamp', 'level', 'msg')

    def __init__(self, ts, stamp, level, msg):
        self.ts, self.stamp, self.level, self.msg = ts, stamp, level, msg

    def __repr__(self):
        return 'LogLine(%s %s %r)' % (self.stamp, self.level, self.msg[:60])

    def text(self):
        return '%s %s %s' % (self.stamp, self.level, self.msg)


def parse_log(text, into=None):
    """Lines in Dot's format, `YYYY-MM-DD HH:MM:SS.mmm LEVEL message`. A line without the prefix
    continues the previous message (joined with a newline)."""
    out = into if into is not None else []
    for raw in text.splitlines():
        m = LINE_RE.match(raw)
        if m:
            out.append(LogLine(stamp_to_epoch(m.group(1), m.group(2)), '%s.%s' % (m.group(1), m.group(2)), m.group(3), m.group(4)))
        elif out and raw.strip():
            out[-1].msg += '\n' + raw
    return out


class LogTail:
    """Reads dot.log from a recorded position (byte offset and line count) as it grows."""

    def __init__(self, path):
        self.path = Path(path)
        self.offset = 0
        self.start_line = 0
        self.partial = ''

    def mark(self):
        try:
            data = self.path.read_bytes()
        except FileNotFoundError:
            data = b''
        self.offset = len(data)
        self.start_line = data.count(b'\n')
        self.partial = ''
        return self.start_line

    def read(self):
        try:
            size = self.path.stat().st_size
        except FileNotFoundError:
            return []
        if size < self.offset:  # rotated or truncated: start over
            self.offset, self.partial = 0, ''
        if size == self.offset:
            return []
        with self.path.open('rb') as f:
            f.seek(self.offset)
            chunk = f.read(size - self.offset)
        self.offset = size
        text = self.partial + chunk.decode('utf-8', 'replace')
        if not text.endswith('\n'):
            text, _, self.partial = text.rpartition('\n')
            if not text:
                return []
        else:
            self.partial = ''
        return parse_log(text)


# The line contract (see Tests/Fixtures/bench/README.md). Messages only: the timestamp and level are gone.
RE_ASK = re.compile(r'^ask: received bench=(\d) (?:typed |spoken )?text=(.*)$', re.S)
RE_ACT_OK = re.compile(r'^act: (\S+)(?: (.*?))? ok (\d+) ms(?: \(.*\))?$')
RE_ACT_FAIL = re.compile(r'^act: (\S+)(?: (.*?))? fail(?: (.*))?$')
RE_SPAWN = re.compile(r'^bench: would spawn agent ?(.*)$')
RE_BLOCKED = re.compile(r'^bench: blocked action ?(\S*)(?: (.*))?$')
RE_FIRST = re.compile(r'^turn\[talk\] first sentence (\d+) ms')
RE_INTERRUPTED = re.compile(r'^talk: interrupted')
RE_SENT = re.compile(r'^turn\[(\w+)\] sent [^:]*: ?(.*)$', re.S)
RE_SAID = re.compile(r'^turn\[talk\] said: ?(.*)$', re.S)
RE_DONE = re.compile(r'^turn\[(\w+)\] done in (\d+) ms(?:, \$([0-9.]+))?(.*)$', re.S)
RE_BEAT = re.compile(r'^beat (\d+)\b')
RE_NOTHING = re.compile(r'^jev: nothing asked')
RE_AGENT = re.compile(r'^agent\[([^\]]+)\] (created|handoff:)')
RE_TAG_POINT = re.compile(r'\b(point|target)\(x: (-?\d+), y: (-?\d+)')
# The fast lane's jobs (2026-10-20).
RE_JOB_START = re.compile(r'^job\[([^\]]+)\] started placement=(\w+) warm=(\d) model=(\S+) goal=(.*)$', re.S)
RE_JOB_END = re.compile(r'^job\[([^\]]+)\] (done|failed|stopped|paused|dropped)\b(.*)$', re.S)
RE_JOB_RESUMED = re.compile(r'^job\[([^\]]+)\] resumed')
RE_JOB_STEP = re.compile(r'^job\[([^\]]+)\] step (\d+) ')
RE_JOB_POINT = re.compile(r'^job\[([^\]]+)\] (point|rang target)\(x: (-?\d+), y: (-?\d+)\)')
RE_JOB_COST = re.compile(r'^job\[[^\]]+\] (?:done|failed|stopped)\b.*?\$([0-9.]+)')
RE_DRY = re.compile(r'^dry-run: ')


def is_route_line(msg):
    return (msg.startswith('jev[route]') or msg.startswith('route') or msg.startswith('jev: ')
            or msg.startswith('dry-run: route') or msg.startswith('bench: route'))


def is_terminal(msg):
    """The spec's 'done' markers: a finished turn, an action, a bench line, nothing asked, a job's end, a dry run."""
    return bool(msg.startswith('turn[talk] done') or msg.startswith('turn[think] done') or msg.startswith('act: ')
                or msg.startswith('bench: ') or RE_NOTHING.match(msg) or RE_JOB_END.match(msg) or RE_DRY.match(msg))


RELEVANT = ('turn[', 'act: ', 'bench: ', 'beat ', 'talk: ', 'agent[', 'ask: ', 'jev[route]', 'jev: ', 'route', 'job[', 'job:',
            'dry-run', 'proposal:', 'speak:')


def log_spend(lines):
    """Dot's model spend in a window of log lines: talk and think turns and jobs (bench jobs write no ledger rows)."""
    total = 0.0
    for l in lines:
        m = RE_DONE.match(l.msg)
        if m and m.group(3):
            total += float(m.group(3))
            continue
        m = RE_JOB_COST.match(l.msg)
        if m:
            total += float(m.group(1))
    return round(total, 4)


class TurnTracker:
    """Decides when a row is finished:
    - a terminal marker (is_terminal) was logged after the latest `ask: received`;
    - no talk/think turn is still open. Each `turn[X] sent` opens a turn and each `turn[X] done` closes
      one (a turn cut by `talk: interrupted` stops blocking at once, and its own late `done` is paired
      with it rather than with the turn that replaced it);
    - a talk turn that ends `tags think` keeps the row open until the think turn is sent (up to 10 s);
    - the log has been quiet (no RELEVANT line) for `settle` seconds."""

    CUT_GRACE = 5.0
    THINK_GRACE = 10.0

    def __init__(self):
        self.turns = []            # dicts: kind, ts, cut (bool), closed (bool)
        self.pending_think = None  # ts of a talk done that handed off to think
        self.terminal_at = None
        self.last_relevant = None
        self.ask_received = []     # (ts, bench, text)
        self.jobs = {}             # job id -> start ts, for jobs that haven't ended or paused
        self.job_timeout = 120.0

    def feed(self, line):
        msg = line.msg
        m = RE_JOB_START.match(msg)
        if m:
            self.jobs[m.group(1)] = line.ts
        m = RE_JOB_END.match(msg)
        if m:
            self.jobs.pop(m.group(1), None)
        m = RE_JOB_RESUMED.match(msg)
        if m:
            self.jobs[m.group(1)] = line.ts
        if msg.startswith(RELEVANT):
            self.last_relevant = line.ts
        m = RE_ASK.match(msg)
        if m:
            self.ask_received.append((line.ts, m.group(1), m.group(2)))
            self.terminal_at = None
            self.pending_think = None
        m = RE_SENT.match(msg)
        if m:
            self.turns.append({'kind': m.group(1), 'ts': line.ts, 'cut': False, 'closed': False})
            if m.group(1) == 'think':
                self.pending_think = None
        m = RE_DONE.match(msg)
        if m:
            kind = m.group(1)
            open_ = [t for t in self.turns if t['kind'] == kind and not t['closed']]
            victim = next((t for t in open_ if t['cut']), open_[0] if open_ else None)
            if victim:
                victim['closed'] = True
            if kind == 'talk' and not (victim and victim['cut']) and re.search(r'\btags\b.*\bthink\b', m.group(4) or ''):
                self.pending_think = line.ts
        if RE_INTERRUPTED.match(msg):
            live = [t for t in self.turns if t['kind'] == 'talk' and not t['closed'] and not t['cut']]
            if live:
                live[0]['cut'] = True
                live[0]['cut_at'] = line.ts
            self.pending_think = None
        for t in self.turns:  # a cut turn that never logs `done` is forgotten after a grace period
            if t['cut'] and not t['closed'] and line.ts - t.get('cut_at', line.ts) > self.CUT_GRACE:
                t['closed'] = True
        if is_terminal(msg) and self.terminal_at is None:
            self.terminal_at = line.ts

    def busy(self, now=None):
        now = time.time() if now is None else now
        if self.pending_think is not None and now - self.pending_think < self.THINK_GRACE:
            return True
        # a row isn't done while a job it started is still running (up to --job-timeout)
        if any(now - t < self.job_timeout for t in self.jobs.values()):
            return True
        return any(not t['closed'] and not t['cut'] for t in self.turns)

    def done(self, now, settle):
        if self.terminal_at is None or self.busy(now):
            return False
        return now - (self.last_relevant or self.terminal_at) >= settle


# ---------------------------------------------------------------------------------------------------
# Measurements over a row's log window
# ---------------------------------------------------------------------------------------------------

def asks(lines):
    return [(l.ts, m.group(1), m.group(2)) for l in lines for m in [RE_ASK.match(l.msg)] if m]


def act_lines(lines):
    out = []
    for l in lines:
        m = RE_ACT_OK.match(l.msg)
        if m:
            out.append({'ts': l.ts, 'verb': m.group(1), 'target': m.group(2) or '', 'ok': True, 'ms': int(m.group(3)), 'reason': ''})
            continue
        m = RE_ACT_FAIL.match(l.msg)
        if m:
            out.append({'ts': l.ts, 'verb': m.group(1), 'target': m.group(2) or '', 'ok': False, 'ms': None, 'reason': m.group(3) or ''})
    return out


DEFAULT_LATENCY_END = re.compile(r'^(act: \S+(?: .*?)? ok \d+ ms(?: \(.*\))?$|turn\[talk\] first sentence|beat \d+)')


def latency_ms(lines, end_regex=None, ask_index=0):
    """ms from the `ask: received` line (the ask_index-th one) to the first end marker after it:
    an `act: ... ok` line, `turn[talk] first sentence`, or a `beat ` line (or end_regex)."""
    end = re.compile(end_regex, re.I) if isinstance(end_regex, str) else (end_regex or DEFAULT_LATENCY_END)
    received = [i for i, l in enumerate(lines) if RE_ASK.match(l.msg)]
    if len(received) <= ask_index:
        return None
    i0 = received[ask_index]
    t0 = lines[i0].ts
    for l in lines[i0 + 1:]:
        if end.search(l.msg):
            return int(round((l.ts - t0) * 1000))
    return None


def said_lines(lines):
    return [m.group(1) for l in lines for m in [RE_SAID.match(l.msg)] if m]


def beat_lines(lines):
    return [l.msg for l in lines if RE_BEAT.match(l.msg)]


def tag_points(lines):
    pts = []
    for l in lines:
        if l.msg.startswith('turn[') and ' tags ' in l.msg or RE_BEAT.match(l.msg):
            for m in RE_TAG_POINT.finditer(l.msg):
                pts.append((m.group(1), int(m.group(2)), int(m.group(3))))
    return pts


# ---------------------------------------------------------------------------------------------------
# Server events
# ---------------------------------------------------------------------------------------------------

def _match_value(want, have):
    if isinstance(want, dict):  # operators
        for op, v in want.items():
            if op == 'gte' and not (isinstance(have, (int, float)) and have >= v): return False
            if op == 'lte' and not (isinstance(have, (int, float)) and have <= v): return False
            if op == 'gt' and not (isinstance(have, (int, float)) and have > v): return False
            if op == 'lt' and not (isinstance(have, (int, float)) and have < v): return False
            if op == 'eq' and have != v: return False
            if op == 're' and not _match_value(str(v), have): return False
            if op == 'absent' and (have is None) != bool(v): return False
        return True
    if isinstance(want, bool):
        return have is want
    if isinstance(want, (int, float)):
        return isinstance(have, (int, float)) and not isinstance(have, bool) and have == want
    if want is None:
        return have is None
    if have is None:
        return False
    if isinstance(have, list):
        return any(_match_value(want, h) for h in have)
    return re.search(str(want), str(have), re.I) is not None


META_KEYS = ('min_count', 'max_count')


def match_event(pred, ev):
    """pred: {field: want}; strings are case-insensitive regexes (any element of a list field may match),
    booleans/numbers compare exactly, dicts are operators {gte, lte, gt, lt, eq, re, absent}."""
    for k, want in pred.items():
        if k in META_KEYS:
            continue
        if not _match_value(want, ev.get(k)):
            return False
    return True


def scroll_baseline(events_before, page=None):
    """Last known scrollY before the ask (from load, pageshow, scroll or layout events), on `page`
    (a URL path such as /long.html) when given."""
    y = None
    for ev in events_before:
        if page and ev.get('page') != page:
            continue
        if ev.get('type') in ('load', 'pageshow', 'scroll', 'layout') and isinstance(ev.get('scrollY'), (int, float)):
            y = ev['scrollY']
    return y


def scroll_after(events_after, page=None):
    ys = [ev['scrollY'] for ev in events_after if ev.get('type') == 'scroll' and isinstance(ev.get('scrollY'), (int, float))
          and (not page or ev.get('page') == page)]
    return ys[-1] if ys else None


def element_rect(events, elem_id):
    rect = None
    for ev in events:
        r = (ev.get('rects') or {}).get(elem_id)
        if r and r.get('screen'):
            rect = r['screen']
    return rect


# ---------------------------------------------------------------------------------------------------
# Assertions: each takes (want, ctx) and returns (ok, detail). ctx is a dict built by the runner:
#   lines, asks_sent [texts], events_before, events_after, front_before, front_after, mouse_before,
#   mouse_after, latency_ms, limit_ms, shot_scale, comet_tabs_before, comet_tabs_after
# ---------------------------------------------------------------------------------------------------

def _regexes(want):
    return [want] if isinstance(want, str) else list(want)


def a_route(want, ctx):
    routes = [l.msg for l in ctx['lines'] if is_route_line(l.msg)]
    hit = [r for r in routes if re.search(want, r, re.I)]
    return bool(hit), (hit[0] if hit else 'no route line matches /%s/ (saw: %s)' % (want, ' | '.join(r[:90] for r in routes[-3:]) or 'none'))


def a_route_not(want, ctx):
    hit = [l.msg for l in ctx['lines'] if is_route_line(l.msg) and re.search(want, l.msg, re.I)]
    return not hit, ('route matched /%s/: %s' % (want, hit[0][:120]) if hit else 'ok')


def _agent_lines(lines):
    return [l.msg for l in lines if RE_AGENT.match(l.msg) or RE_SPAWN.match(l.msg)]


def a_no_agent(want, ctx):
    hits = _agent_lines(ctx['lines'])
    if not want:
        return True, 'not checked'
    return not hits, (hits[0][:140] if hits else 'no agent started or proposed')


def a_expect_would_spawn(want, ctx):
    hits = [l.msg for l in ctx['lines'] if RE_SPAWN.match(l.msg)]
    if want:
        return bool(hits), (hits[0] if hits else 'no `bench: would spawn agent` line')
    return not hits, (hits[0] if hits else 'no spawn proposed')


def a_no_turn(want, ctx):
    hits = [l.msg for l in ctx['lines'] if RE_SENT.match(l.msg)]
    if not want:
        return True, 'not checked'
    return not hits, (hits[0][:120] if hits else 'no model turn')


def a_act(want, ctx):
    acts = act_lines(ctx['lines'])
    specs = want if isinstance(want, list) else [want]
    for spec in specs:
        if isinstance(spec, str):
            spec = {'verb': spec}
        verb, ok, target = spec.get('verb', '.'), spec.get('ok', True), spec.get('target')
        hits = [a for a in acts if re.fullmatch(verb, a['verb'], re.I) and a['ok'] == ok
                and (target is None or re.search(target, a['target'], re.I))]
        if len(hits) < spec.get('min_count', 1):
            seen = ', '.join('%s %s %s' % (a['verb'], a['target'], 'ok' if a['ok'] else 'fail ' + a['reason']) for a in acts) or 'none'
            return False, 'no act %s%s %s (acts: %s)' % (verb, ' ' + target if target else '', 'ok' if ok else 'fail', seen[:200])
    return True, '; '.join('%s %s %s' % (a['verb'], a['target'], ('ok %s ms' % a['ms']) if a['ok'] else 'fail') for a in acts)[:200]


def a_no_act(want, ctx):
    acts = [a for a in act_lines(ctx['lines']) if a['ok']]
    if want is True:
        bad = acts
    elif want:
        bad = [a for a in acts if any(re.fullmatch(v, a['verb'], re.I) for v in _regexes(want))]
    else:
        return True, 'not checked'
    return not bad, ('acted: %s %s' % (bad[0]['verb'], bad[0]['target']) if bad else 'no action ran')


def a_max_acts(want, ctx):
    n = len([a for a in act_lines(ctx['lines']) if a['verb'] not in ('go', 'look')])
    return n <= int(want), '%d action line(s), limit %d' % (n, int(want))


def a_blocked(want, ctx):
    hits = [l.msg for l in ctx['lines'] if RE_BLOCKED.match(l.msg)]
    ok = [h for h in hits if re.search(want, h, re.I)]
    return bool(ok), (ok[0] if ok else 'no `bench: blocked action` matching /%s/' % want)


def a_no_blocked(want, ctx):
    hits = [l.msg for l in ctx['lines'] if RE_BLOCKED.match(l.msg)]
    if not want:
        return True, 'not checked'
    return not hits, (hits[0] if hits else 'nothing blocked')


def _event_checks(preds, events, negate=False):
    preds = preds if isinstance(preds, list) else [preds]
    for p in preds:
        n = sum(1 for ev in events if match_event(p, ev))
        if negate:
            if n:
                ev = next(ev for ev in events if match_event(p, ev))
                return False, 'unexpected server event %s' % json.dumps({k: ev.get(k) for k in ('type', 'url', 'text', 'value', 'checked') if k in ev})[:200]
            continue
        lo, hi = p.get('min_count', 1), p.get('max_count')
        if n < lo or (hi is not None and n > hi):
            types = sorted({ev.get('type', '?') for ev in events})
            return False, 'server events matching %s: %d (want %s%s); types seen: %s' % (
                json.dumps({k: v for k, v in p.items() if k not in META_KEYS}), n, '>=%d' % lo, '' if hi is None else ' <=%d' % hi, ','.join(types) or 'none')
    return True, 'ok'


def a_server_event(want, ctx):
    return _event_checks(want, ctx['events_after'])


def a_no_server_event(want, ctx):
    return _event_checks(want, ctx['events_after'], negate=True)


def a_no_server_click_text(want, ctx):
    for rx in _regexes(want):
        hits = [ev for ev in ctx['events_after'] if ev.get('type') == 'click' and re.search(rx, str(ev.get('text', '')), re.I)]
        if hits:
            return False, 'clicked %r on %s' % (hits[0].get('text'), hits[0].get('page', '?'))
    return True, 'no click on %s' % ', '.join(_regexes(want))


def _reply_texts(ctx, scope):
    texts = said_lines(ctx['lines'])
    if scope == 'all':
        texts += beat_lines(ctx['lines'])
    return texts


def a_reply_contains(want, ctx):
    texts = _reply_texts(ctx, ctx.get('reply_scope'))
    if not texts:
        return False, 'no reply line'
    for rx in _regexes(want):
        if not any(re.search(rx, t, re.I) for t in texts):
            return False, 'reply lacks /%s/: %s' % (rx, texts[-1][:120])
    return True, texts[-1][:120]


def a_reply_not_contains(want, ctx):
    texts = _reply_texts(ctx, ctx.get('reply_scope'))
    for rx in _regexes(want):
        for t in texts:
            if re.search(rx, t, re.I):
                return False, 'reply has /%s/: %s' % (rx, t[:120])
    return True, 'ok'


def a_cursor_unchanged(want, ctx):
    if not want:
        return True, 'not checked'
    a, b = ctx.get('mouse_before'), ctx.get('mouse_after')
    if a is None or b is None:
        return False, 'mouse location unreadable'
    moved = abs(a[0] - b[0]) > 1 or abs(a[1] - b[1]) > 1
    return not moved, 'cursor %s (%.0f,%.0f) -> (%.0f,%.0f)' % ('moved' if moved else 'still', a[0], a[1], b[0], b[1])


def _scroll_delta(ctx):
    y0 = scroll_baseline(ctx['events_before'], ctx.get('page'))
    y1 = scroll_after(ctx['events_after'], ctx.get('page'))
    if y1 is None:
        return None, y0, y1
    return y1 - (y0 or 0), y0, y1


def a_scroll_delta_min(want, ctx):
    d, y0, y1 = _scroll_delta(ctx)
    if d is None:
        return False, 'no scroll event after the ask'
    return d >= want, 'scrollY %s -> %s (delta %+d, want >= %+d)' % (y0, y1, d, want)


def a_scroll_delta_max(want, ctx):
    d, y0, y1 = _scroll_delta(ctx)
    if d is None:
        return False, 'no scroll event after the ask'
    return d <= want, 'scrollY %s -> %s (delta %+d, want <= %+d)' % (y0, y1, d, want)


def a_front_app(want, ctx):
    after, before = ctx.get('front_after') or {}, ctx.get('front_before') or {}
    label = lambda f: '%s %s' % (f.get('name', ''), f.get('bundle', ''))
    if not re.search(want, label(after), re.I):
        return False, 'front app after is %s' % (label(after).strip() or 'unknown')
    if re.search(want, label(before), re.I):
        return False, 'front app already matched /%s/ before the ask (%s)' % (want, label(before).strip())
    return True, '%s -> %s' % (before.get('name', '?'), after.get('name', '?'))


def a_front_stays(want, ctx):
    """The app in front before the ask is still in front after it (a behind job never takes focus, J5)."""
    after, before = ctx.get('front_after') or {}, ctx.get('front_before') or {}
    label = lambda f: '%s %s' % (f.get('name', ''), f.get('bundle', ''))
    ok = bool(re.search(want, label(before), re.I)) and bool(re.search(want, label(after), re.I))
    return ok, '%s -> %s' % (label(before).strip() or '?', label(after).strip() or '?')


def a_log_has(want, ctx):
    for rx in _regexes(want):
        if not any(re.search(rx, l.msg, re.I) for l in ctx['lines']):
            return False, 'no log line matches /%s/' % rx
    return True, 'ok'


def a_log_lacks(want, ctx):
    for rx in _regexes(want):
        hit = next((l.msg for l in ctx['lines'] if re.search(rx, l.msg, re.I)), None)
        if hit:
            return False, 'log has /%s/: %s' % (rx, hit[:120])
    return True, 'ok'


def a_log_count(want, ctx):
    specs = want if isinstance(want, list) else [want]
    for s in specs:
        n = sum(1 for l in ctx['lines'] if re.search(s['pattern'], l.msg, re.I))
        if n < s.get('min', 0) or ('max' in s and n > s['max']):
            return False, '/%s/ matched %d line(s) (want %s..%s)' % (s['pattern'], n, s.get('min', 0), s.get('max', 'any'))
    return True, 'ok'


def _after_ask(ctx, k):
    rec = [i for i, l in enumerate(ctx['lines']) if RE_ASK.match(l.msg)]
    if len(rec) <= k:
        return None, None
    return rec[k], ctx['lines'][rec[k]].ts


def a_interrupt_within_ms(want, ctx):
    i, t = _after_ask(ctx, 1)
    if i is None:
        return False, 'no second `ask: received` line'
    for l in ctx['lines'][i + 1:]:
        if RE_INTERRUPTED.match(l.msg):
            ms = int(round((l.ts - t) * 1000))
            return ms <= want, 'interrupted %d ms after the second ask (limit %d)' % (ms, want)
    return False, 'no `talk: interrupted` after the second ask'


def a_not_reasked(want, ctx):
    if not want:
        return True, 'not checked'
    sent = ctx.get('asks_sent') or []
    i, _ = _after_ask(ctx, 1)
    if i is None or not sent:
        return False, 'no second ask'
    first = sent[0].strip().lower()
    for l in ctx['lines'][i + 1:]:
        m = RE_SENT.match(l.msg)
        if m and m.group(2).strip().lower() == first:
            return False, 're-sent the first ask: %s' % l.msg[:120]
    return True, 'first ask not re-sent'


def a_answered_last(want, ctx):
    if not want:
        return True, 'not checked'
    rec = [i for i, l in enumerate(ctx['lines']) if RE_ASK.match(l.msg)]
    if not rec:
        return False, 'no `ask: received` line'
    tail = ctx['lines'][rec[-1] + 1:]
    ok = [l.msg for l in tail if RE_SAID.match(l.msg) or RE_BEAT.match(l.msg) or RE_ACT_OK.match(l.msg)]
    return bool(ok), (ok[0][:120] if ok else 'the last ask got no reply or action')


def a_point_in_element(want, ctx):
    elem = want['id'] if isinstance(want, dict) else want
    pad = want.get('pad', 12) if isinstance(want, dict) else 12
    rect = element_rect(ctx['events_before'] + ctx['events_after'], elem)
    if not rect:
        return False, 'no rect for element %r in the server events' % elem
    scale = float(ctx.get('shot_scale') or 1.0)
    pts = tag_points(ctx['lines'])
    if not pts:
        return False, 'no point(...) or target(...) tag in the log'
    for kind, x, y in pts:
        sx, sy = x / scale, y / scale
        if rect['x'] - pad <= sx <= rect['x'] + rect['w'] + pad and rect['y'] - pad <= sy <= rect['y'] + rect['h'] + pad:
            return True, '%s (%d,%d) inside %s' % (kind, x, y, elem)
    k, x, y = pts[0]
    return False, '%s (%d,%d) / scale %.2f is outside %s %s' % (k, x, y, scale, elem, rect)


def _jobs(lines):
    """Each job in the window: id -> {placement, end, steps, points}."""
    out = {}
    for l in lines:
        m = RE_JOB_START.match(l.msg)
        if m:
            out[m.group(1)] = {'placement': m.group(2), 'end': None, 'steps': 0, 'points': [], 'start': l.ts, 'ended': None}
            continue
        m = RE_JOB_STEP.match(l.msg)
        if m and m.group(1) in out:
            out[m.group(1)]['steps'] = max(out[m.group(1)]['steps'], int(m.group(2)))
            continue
        m = RE_JOB_POINT.match(l.msg)
        if m and m.group(1) in out:
            out[m.group(1)]['points'].append((m.group(2), int(m.group(3)), int(m.group(4))))
            continue
        m = RE_JOB_END.match(l.msg)
        if m and m.group(1) in out and m.group(2) != 'paused':
            out[m.group(1)]['end'] = m.group(2)
            out[m.group(1)]['ended'] = l.ts
    return out


def a_job(want, ctx):
    jobs = _jobs(ctx['lines'])
    if not jobs:
        return False, 'no job[...] started line'
    want = want if isinstance(want, dict) else {}
    for jid, j in jobs.items():
        if want.get('placement') and j['placement'] != want['placement']:
            continue
        if want.get('end') and j['end'] != want['end']:
            continue
        if j['steps'] < int(want.get('min_steps', 0)):
            continue
        return True, 'job[%s] %s %s, %d steps' % (jid, j['placement'], j['end'], j['steps'])
    j = next(iter(jobs.values()))
    return False, 'no job matches %s (first: %s %s, %d steps)' % (want, j['placement'], j['end'], j['steps'])


def a_no_job(want, ctx):
    jobs = _jobs(ctx['lines'])
    if not want:
        return True, 'not checked'
    return not jobs, ('no job' if not jobs else 'job[%s] started' % next(iter(jobs)))


def a_no_act_after(want, ctx):
    pat = re.compile(want, re.I)
    seen = None
    for i, l in enumerate(ctx['lines']):
        if seen is None and pat.search(l.msg):
            seen = i
            continue
        if seen is not None and RE_ACT_OK.match(l.msg):
            return False, 'an act after /%s/: %s' % (want, l.msg[:100])
    return (seen is not None), ('no act after /%s/' % want if seen is not None else 'never saw /%s/' % want)


def a_stop_within_ms(want, ctx):
    rec = [l for l in ctx['lines'] if RE_ASK.match(l.msg)]
    stops = [l for l in ctx['lines'] if re.match(r'^job\[[^\]]+\] stopped', l.msg)]
    if not rec or not stops:
        return False, 'no stop ask or no job stopped line'
    t_ask = rec[-1].ts
    after = [s.ts for s in stops if s.ts >= t_ask]
    if not after:
        return False, 'the job stopped before the last ask'
    ms = int((after[0] - t_ask) * 1000)
    return ms <= int(want), 'stopped %d ms after the ask (limit %s)' % (ms, want)


def a_job_point_in_element(want, ctx):
    elem = want['id'] if isinstance(want, dict) else want
    pad = want.get('pad', 12) if isinstance(want, dict) else 12
    rect = element_rect(ctx['events_before'] + ctx['events_after'], elem)
    if not rect:
        return False, 'no rect for element %r in the server events' % elem
    pts = [p for j in _jobs(ctx['lines']).values() for p in j['points']]
    if not pts:
        return False, 'no job point(...) line'
    win = ctx.get('comet_window') or {'x': 0, 'y': 0, 'chrome': 0}
    for kind, x, y in pts:
        px, py = x - win['x'], y - win['y'] - win['chrome']
        if rect['x'] - pad <= px <= rect['x'] + rect['w'] + pad and rect['y'] - pad <= py <= rect['y'] + rect['h'] + pad:
            return True, '%s (%d,%d) inside %s' % (kind, x, y, elem)
    return False, 'job points %s outside %s %s' % (pts[:3], elem, rect)


def a_setup_tab_focused(want, ctx):
    focused = ctx.get('setup_tab_focused')
    if focused is None:
        return False, 'setup tab focus unknown'
    return focused == bool(want), 'setup tab focused=%s' % focused


def a_new_tab(want, ctx):
    a, b = ctx.get('comet_tabs_before'), ctx.get('comet_tabs_after')
    if a is None or b is None:
        return False, 'bench Comet tab count unknown'
    return (b > a) == bool(want), 'bench Comet tabs %d -> %d' % (a, b)


def a_ask_received(want, ctx):
    got = asks(ctx['lines'])
    need = len(ctx.get('asks_sent') or [1])
    if not want:
        return True, 'not checked'
    if len(got) < need:
        return False, '%d of %d asks logged `ask: received`' % (len(got), need)
    bad = [g for g in got if g[1] != '1']
    return not bad, ('ask: received bench=%s (not bench mode)' % bad[0][1] if bad else 'bench=1')


ASSERTIONS = {
    'route': a_route, 'route_not': a_route_not, 'no_agent': a_no_agent, 'expect_would_spawn': a_expect_would_spawn,
    'no_turn': a_no_turn, 'act': a_act, 'no_act': a_no_act, 'max_acts': a_max_acts, 'blocked': a_blocked,
    'no_blocked': a_no_blocked, 'server_event': a_server_event, 'no_server_event': a_no_server_event,
    'no_server_click_text': a_no_server_click_text, 'reply_contains': a_reply_contains,
    'reply_not_contains': a_reply_not_contains, 'cursor_unchanged': a_cursor_unchanged,
    'scroll_delta_min': a_scroll_delta_min, 'scroll_delta_max': a_scroll_delta_max, 'front_app': a_front_app, 'front_stays': a_front_stays,
    'log_has': a_log_has, 'log_lacks': a_log_lacks, 'log_count': a_log_count,
    'interrupt_within_ms': a_interrupt_within_ms, 'not_reasked': a_not_reasked, 'answered_last': a_answered_last,
    'job': a_job, 'no_job': a_no_job, 'no_act_after': a_no_act_after, 'stop_within_ms': a_stop_within_ms,
    'job_point_in_element': a_job_point_in_element, 'setup_tab_focused': a_setup_tab_focused,
    'point_in_element': a_point_in_element, 'new_tab': a_new_tab, 'ask_received': a_ask_received,
}
# Keys in expect that tune other checks rather than being checks themselves.
EXPECT_OPTIONS = ('reply_scope',)


def evaluate(expect, ctx):
    """Run every assertion in `expect` (plus ask_received and the latency limit). Returns a list of
    {name, ok, detail}."""
    checks = []
    exp = dict(expect or {})
    exp.setdefault('ask_received', True)
    ctx = dict(ctx)
    ctx['reply_scope'] = exp.get('reply_scope')
    for name, want in exp.items():
        if name in EXPECT_OPTIONS:
            continue
        fn = ASSERTIONS.get(name)
        if fn is None:
            checks.append({'name': name, 'ok': False, 'detail': 'unknown assertion %r' % name})
            continue
        try:
            ok, detail = fn(want, ctx)
        except Exception as e:  # a malformed expectation is a failed check, not a crash
            ok, detail = False, 'error: %s: %s' % (type(e).__name__, e)
        checks.append({'name': name, 'ok': bool(ok), 'detail': detail})
    limit = ctx.get('limit_ms')
    if limit:
        lat = ctx.get('latency_ms')
        if lat is None:
            checks.append({'name': 'latency', 'ok': False, 'detail': 'no latency end marker after `ask: received`'})
        else:
            checks.append({'name': 'latency', 'ok': lat <= limit, 'detail': '%d ms (limit %d)' % (lat, limit)})
    return checks


def aggregate(row, results):
    """A summary row: {aggregate: {group, baseline_ms, tolerance, median_target_ms}} over rows in `group`."""
    spec = row['aggregate']
    group = spec['group']
    lats = [r['latency_ms'] for r in results if r.get('group') == group and r.get('latency_ms') is not None]
    checks = []
    if not lats:
        return {'id': row['id'], 'kind': row.get('kind', 'regression'), 'pass': False, 'latency_ms': None,
                'checks': [{'name': 'aggregate', 'ok': False, 'detail': 'no latencies in group %r' % group}],
                'reasons': ['no latencies in group %r' % group], 'aggregate': {'group': group, 'n': 0}}
    med = int(statistics.median(lats))
    if 'baseline_ms' in spec:
        bound = spec['baseline_ms'] * (1 + spec.get('tolerance', 0.10))
        checks.append({'name': 'median_vs_baseline', 'ok': med <= bound, 'detail': 'median %d ms over %d rows, bound %d ms (baseline %d +%d%%)' % (
            med, len(lats), bound, spec['baseline_ms'], round(spec.get('tolerance', 0.10) * 100))})
    if 'median_max_ms' in spec:
        checks.append({'name': 'median_max', 'ok': med <= spec['median_max_ms'], 'detail': 'median %d ms (max %d)' % (med, spec['median_max_ms'])})
    info = {'group': group, 'n': len(lats), 'median_ms': med, 'p90_ms': int(sorted(lats)[max(0, int(round(0.9 * len(lats))) - 1)])}
    if 'median_target_ms' in spec:
        info['target_met'] = med <= spec['median_target_ms']
        info['median_target_ms'] = spec['median_target_ms']
    ok = all(c['ok'] for c in checks)
    return {'id': row['id'], 'kind': row.get('kind', 'regression'), 'pass': ok, 'latency_ms': med, 'checks': checks,
            'reasons': [c['detail'] for c in checks if not c['ok']], 'aggregate': info}


# ---------------------------------------------------------------------------------------------------
# Request list
# ---------------------------------------------------------------------------------------------------

def substitute(obj, subs):
    if isinstance(obj, str):
        for k, v in subs.items():
            obj = obj.replace('{%s}' % k, v)
        return obj
    if isinstance(obj, list):
        return [substitute(x, subs) for x in obj]
    if isinstance(obj, dict):
        return {k: substitute(v, subs) for k, v in obj.items()}
    return obj


def validate_rows(rows):
    problems, seen = [], set()
    for i, r in enumerate(rows):
        rid = str(r.get('id', ''))
        where = 'row %s' % (rid or '#%d' % i)
        if not rid:
            problems.append('%s: no id' % where)
        if rid in seen:
            problems.append('%s: duplicate id' % where)
        seen.add(rid)
        if r.get('kind') not in KINDS:
            problems.append('%s: kind must be one of %s' % (where, KINDS))
        if 'aggregate' in r:
            continue
        if not str(r.get('ask', '')).strip():
            problems.append('%s: no ask' % where)
        flags = r.get('flags', [])
        if not isinstance(flags, list) or not all(isinstance(f, str) for f in flags):
            problems.append('%s: flags must be a list of strings' % where)
        else:
            for j, f in enumerate(flags):
                if f == '--comet-port':
                    try:
                        check_port(flags[j + 1])
                    except (IndexError, ValueError):
                        problems.append('%s: --comet-port needs a number' % where)
                    except RefusedPort as e:
                        problems.append('%s: %s' % (where, e))
        front = (r.get('setup') or {}).get('front', 'safari')
        if front not in FRONTS:
            problems.append('%s: setup.front must be one of %s' % (where, FRONTS))
        for k in (r.get('expect') or {}):
            if k not in ASSERTIONS and k not in EXPECT_OPTIONS:
                problems.append('%s: unknown expect key %r' % (where, k))
        for step in r.get('then', []):
            if not any(str(step.get(k, '')).strip() for k in ('ask', 'cli', 'open_app', 'new_tab')):
                problems.append('%s: a then-step has no ask, cli, open_app or new_tab' % where)
    return problems


def row_selected(rid, tokens):
    """--rows 1-14,19a,21: exact ids, prefix groups ('21' picks 21.1..21.10, '19' picks 19a/19b) and
    ranges over the leading number."""
    if not tokens:
        return True
    rid = str(rid)
    lead = re.match(r'^(\d+)', rid)
    for tok in tokens:
        tok = tok.strip()
        if not tok:
            continue
        m = re.fullmatch(r'(\d+)-(\d+)', tok)
        if m and lead and int(m.group(1)) <= int(lead.group(1)) <= int(m.group(2)):
            return True
        if rid == tok or rid.startswith(tok + '.') or re.fullmatch(re.escape(tok) + r'[a-z]', rid):
            return True
    return False


# ---------------------------------------------------------------------------------------------------
# Minimal WebSocket client (RFC 6455, text frames) and DevTools protocol client
# ---------------------------------------------------------------------------------------------------

WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'


def ws_accept(key):
    return base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()


def encode_frame(opcode, payload, mask=True, fin=True, mask_key=None):
    head = bytearray([(0x80 if fin else 0) | (opcode & 0x0F)])
    n = len(payload)
    mbit = 0x80 if mask else 0
    if n < 126:
        head.append(mbit | n)
    elif n < 1 << 16:
        head.append(mbit | 126)
        head += struct.pack('!H', n)
    else:
        head.append(mbit | 127)
        head += struct.pack('!Q', n)
    if mask:
        key = mask_key if mask_key is not None else os.urandom(4)
        head += key
        payload = bytes(b ^ key[i % 4] for i, b in enumerate(payload))
    return bytes(head) + payload


def decode_frame(buf):
    """-> (fin, opcode, payload, consumed) or None when buf holds less than one frame."""
    if len(buf) < 2:
        return None
    b0, b1 = buf[0], buf[1]
    fin, opcode, masked, n = bool(b0 & 0x80), b0 & 0x0F, bool(b1 & 0x80), b1 & 0x7F
    i = 2
    if n == 126:
        if len(buf) < 4:
            return None
        n = struct.unpack('!H', bytes(buf[2:4]))[0]
        i = 4
    elif n == 127:
        if len(buf) < 10:
            return None
        n = struct.unpack('!Q', bytes(buf[2:10]))[0]
        i = 10
    key = None
    if masked:
        if len(buf) < i + 4:
            return None
        key = bytes(buf[i:i + 4])
        i += 4
    if len(buf) < i + n:
        return None
    payload = bytes(buf[i:i + n])
    if key:
        payload = bytes(b ^ key[j % 4] for j, b in enumerate(payload))
    return fin, opcode, payload, i + n


class WebSocketClosed(BenchError):
    pass


class WebSocket:
    def __init__(self, url, timeout=10.0):
        u = urlsplit(url)
        if u.scheme != 'ws':
            raise BenchError('ws:// only: %s' % url)
        host, port = u.hostname, u.port or 80
        if host not in ('127.0.0.1', 'localhost', '::1'):
            raise BenchError('loopback only: %s' % url)
        check_port(port)
        self.sock = socket.create_connection((host, port), timeout=timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        path = (u.path or '/') + ('?' + u.query if u.query else '')
        req = ('GET %s HTTP/1.1\r\nHost: %s:%d\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
               'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n') % (path, host, port, key)
        self.sock.sendall(req.encode())
        resp = b''
        while b'\r\n\r\n' not in resp:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise BenchError('websocket handshake: connection closed')
            resp += chunk
        head, _, rest = resp.partition(b'\r\n\r\n')
        lines = head.decode('latin-1').split('\r\n')
        if ' 101 ' not in lines[0] + ' ':
            raise BenchError('websocket handshake: %s' % lines[0])
        headers = {k.strip().lower(): v.strip() for k, _, v in (l.partition(':') for l in lines[1:])}
        if headers.get('sec-websocket-accept') != ws_accept(key):
            raise BenchError('websocket handshake: bad Sec-WebSocket-Accept')
        self.buf = bytearray(rest)
        self.closed = False

    def send_text(self, text):
        self.sock.sendall(encode_frame(0x1, text.encode('utf-8')))

    def _frame(self, deadline):
        while True:
            got = decode_frame(self.buf)
            if got:
                del self.buf[:got[3]]
                return got
            left = deadline - time.monotonic()
            if left <= 0:
                raise socket.timeout('websocket read timed out')
            self.sock.settimeout(left)
            chunk = self.sock.recv(65536)
            if not chunk:
                self.closed = True
                raise WebSocketClosed('connection closed')
            self.buf += chunk

    def recv_text(self, timeout=10.0):
        deadline = time.monotonic() + timeout
        parts, op0 = [], None
        while True:
            fin, op, payload, _ = self._frame(deadline)
            if op == 0x9:      # ping
                self.sock.sendall(encode_frame(0xA, payload))
                continue
            if op == 0xA:      # pong
                continue
            if op == 0x8:      # close
                try:
                    self.sock.sendall(encode_frame(0x8, payload[:2]))
                except OSError:
                    pass
                self.closed = True
                raise WebSocketClosed('closed by peer')
            if op in (0x1, 0x2):
                op0, parts = op, [payload]
            elif op == 0x0:
                parts.append(payload)
            if fin and op0 is not None:
                data = b''.join(parts)
                if op0 == 0x1:
                    return data.decode('utf-8')
                parts, op0 = [], None  # binary frames are not used by DevTools; skip

    def close(self):
        if not self.closed:
            try:
                self.sock.sendall(encode_frame(0x8, struct.pack('!H', 1000)))
            except OSError:
                pass
        self.closed = True
        try:
            self.sock.close()
        except OSError:
            pass


def http_json(url, timeout=2.0):
    u = urlsplit(url)
    if u.hostname not in ('127.0.0.1', 'localhost'):
        raise BenchError('loopback only: %s' % url)
    if u.path.startswith('/json'):
        check_port(u.port or 80)
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read().decode())


class CDP:
    def __init__(self, port, timeout=10.0):
        self.port = check_port(port)
        ver = http_json('http://127.0.0.1:%d/json/version' % self.port)
        self.ws = WebSocket(ver['webSocketDebuggerUrl'], timeout=timeout)
        self.next_id = 0
        self.events = []
        self.timeout = timeout

    def call(self, method, params=None, session=None, timeout=None):
        self.next_id += 1
        mid = self.next_id
        msg = {'id': mid, 'method': method, 'params': params or {}}
        if session:
            msg['sessionId'] = session
        self.ws.send_text(json.dumps(msg))
        deadline = time.monotonic() + (timeout or self.timeout)
        while True:
            data = json.loads(self.ws.recv_text(max(0.01, deadline - time.monotonic())))
            if data.get('id') == mid:
                if 'error' in data:
                    raise BenchError('%s: %s' % (method, data['error'].get('message')))
                return data.get('result', {})
            if 'method' in data:
                self.events.append(data)

    def wait_event(self, method, session=None, timeout=10.0, since=0):
        deadline = time.monotonic() + timeout
        while True:
            for i, ev in enumerate(self.events[since:], since):
                if ev.get('method') == method and (session is None or ev.get('sessionId') == session):
                    del self.events[i]
                    return ev
            left = deadline - time.monotonic()
            if left <= 0:
                raise socket.timeout('no %s within %.0f s' % (method, timeout))
            data = json.loads(self.ws.recv_text(left))
            if 'method' in data:
                self.events.append(data)

    def pages(self):
        return [t for t in self.call('Target.getTargets')['targetInfos'] if t.get('type') == 'page']

    def close(self):
        self.ws.close()


BLANK_TABS = ('about:blank', 'chrome://newtab/', 'chrome://new-tab-page/')


def comet_show(port, urls, base, log=print):
    """Show urls[-1] in exactly one fixture tab of the bench Comet (visiting urls in order builds
    history), close its other fixture and blank tabs, and activate that tab. Comet's own pages
    (sidecar, onboarding) are left alone. Returns the number of fixture tabs left (1)."""
    cdp = CDP(port, timeout=30.0)  # a just-started bench Comet's first tab can take 10 s or more (row 2 on 10-21)
    try:
        pages = cdp.pages()
        fixture = [p for p in pages if p.get('url', '').startswith(base)]
        blank = [p for p in pages if p.get('url', '') in BLANK_TABS]
        # A fresh tab every row: an earlier row can leave its tab on a leave-page dialog (J19, an edited
        # apply.html), where Page.navigate never answers.
        mine = {'targetId': cdp.call('Target.createTarget', {'url': 'about:blank'})['targetId']}
        closing = {p['targetId'] for p in fixture + blank if p['targetId'] != mine['targetId']}
        for tid in closing:
            cdp.call('Target.closeTarget', {'targetId': tid})
        deadline = time.monotonic() + 3.0  # tabs close asynchronously
        while closing and time.monotonic() < deadline and closing & {p['targetId'] for p in cdp.pages()}:
            time.sleep(0.1)
        sid = cdp.call('Target.attachToTarget', {'targetId': mine['targetId'], 'flatten': True})['sessionId']
        cdp.call('Page.enable', {}, sid)
        for u in urls:
            mark = len(cdp.events)
            try:
                cdp.call('Page.navigate', {'url': u}, sid)
            except (TimeoutError, OSError):
                # a dialog holds the page: accept it, then go on
                try:
                    cdp.call('Page.handleJavaScriptDialog', {'accept': True}, sid)
                except Exception:
                    pass
            cdp.wait_event('Page.loadEventFired', sid, timeout=10, since=mark)
        cdp.call('Target.activateTarget', {'targetId': mine['targetId']})
        cdp.call('Page.bringToFront', {}, sid)
        return len([p for p in cdp.pages() if p.get('url', '').startswith(base)])
    finally:
        cdp.close()


def screen_locked():
    """True when the login window holds the screen: focus and window-order rows mean nothing then."""
    try:
        out = subprocess.run(['ioreg', '-n', 'Root', '-d1', '-a'], capture_output=True, timeout=5).stdout
        import plistlib
        return bool(plistlib.loads(out).get('IOConsoleUsers', [{}])[0].get('CGSSessionScreenIsLocked', False))
    except Exception:
        return False


def setup_tab_focused(port, url):
    """Whether the bench Comet's tab on the setup page still has focus (a behind job must not take it)."""
    try:
        cdp = CDP(port, timeout=3)
    except Exception:
        return None
    try:
        want = url.split('?')[0]
        for p in cdp.pages():
            if str(p.get('url', '')).split('?')[0] != want:
                continue
            a = cdp.call('Target.attachToTarget', {'targetId': p['targetId'], 'flatten': True})
            r = cdp.call('Runtime.evaluate', {'expression': 'document.hasFocus()', 'returnByValue': True}, session=a['sessionId'])
            return bool(((r or {}).get('result') or {}).get('value'))
        return None
    except Exception:
        return None
    finally:
        cdp.close()


def comet_tab_count(port, base=None):
    """Page tabs of the bench Comet; with `base`, only the fixture's tabs (Comet adds its own pages)."""
    try:
        pages = [t for t in http_json('http://127.0.0.1:%d/json/list' % check_port(port)) if t.get('type') == 'page']
    except (OSError, ValueError, BenchError):
        return None
    return len([t for t in pages if t.get('url', '').startswith(base)]) if base else len(pages)


# ---------------------------------------------------------------------------------------------------
# macOS probes: front app, mouse location, idle time, activation by PID
# ---------------------------------------------------------------------------------------------------

def front_app():
    try:
        asn = subprocess.run(['lsappinfo', 'front'], capture_output=True, text=True, timeout=3).stdout.strip()
        out = subprocess.run(['lsappinfo', 'info', '-only', 'name', '-only', 'pid', '-only', 'bundleid', asn],
                             capture_output=True, text=True, timeout=3).stdout
    except (OSError, subprocess.SubprocessError):
        return {}
    info = {}
    for key, field in (('LSDisplayName', 'name'), ('pid', 'pid'), ('CFBundleIdentifier', 'bundle')):
        m = re.search(r'"%s"\s*=\s*"?([^"\n]*)"?' % key, out)
        if m:
            info[field] = int(m.group(1)) if field == 'pid' and m.group(1).isdigit() else m.group(1)
    return info


class _CGPoint(ctypes.Structure):
    _fields_ = [('x', ctypes.c_double), ('y', ctypes.c_double)]


_AS = None


def mouse_location():
    """Global mouse location in points, via CGEventGetLocation(CGEventCreate(NULL))."""
    global _AS
    try:
        if _AS is None:
            _AS = ctypes.cdll.LoadLibrary('/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices')
            _AS.CGEventCreate.restype = ctypes.c_void_p
            _AS.CGEventCreate.argtypes = [ctypes.c_void_p]
            _AS.CGEventGetLocation.restype = _CGPoint
            _AS.CGEventGetLocation.argtypes = [ctypes.c_void_p]
            _AS.CFRelease.argtypes = [ctypes.c_void_p]
        ev = _AS.CGEventCreate(None)
        if not ev:
            return None
        p = _AS.CGEventGetLocation(ev)
        _AS.CFRelease(ev)
        return (p.x, p.y)
    except (OSError, AttributeError):
        return None


def hid_idle_seconds():
    try:
        out = subprocess.run(['ioreg', '-c', 'IOHIDSystem', '-d', '4'], capture_output=True, text=True, timeout=5).stdout
        m = re.search(r'"HIDIdleTime"\s*=\s*(\d+)', out)
        return int(m.group(1)) / 1e9 if m else None
    except (OSError, subprocess.SubprocessError):
        return None


ACTIVATE_SWIFT = r'''
import AppKit
guard CommandLine.arguments.count == 2, let pid = Int32(CommandLine.arguments[1]),
      let app = NSRunningApplication(processIdentifier: pid) else { print("usage: benchactivate <pid>"); exit(2) }
let ok = app.activate(options: [.activateAllWindows])
print(ok ? "activated \(pid)" : "refused \(pid)")
exit(ok ? 0 : 1)
'''


def activate_pid(pid, bench_dir):
    """Bring one process (by PID, never by name) to the front with a tiny Swift helper compiled once."""
    src = bench_dir / 'benchactivate.swift'
    exe = bench_dir / 'benchactivate'
    digest = hashlib.sha1(ACTIVATE_SWIFT.encode()).hexdigest()[:12]
    stamp = bench_dir / 'benchactivate.sha'
    if not exe.exists() or not stamp.exists() or stamp.read_text().strip() != digest:
        bench_dir.mkdir(parents=True, exist_ok=True)
        src.write_text(ACTIVATE_SWIFT)
        r = subprocess.run(['swiftc', '-O', '-o', str(exe), str(src)], capture_output=True, text=True, timeout=180)
        if r.returncode != 0:
            return False, 'swiftc failed: %s' % r.stderr.strip()[:200]
        stamp.write_text(digest)
    r = subprocess.run([str(exe), str(int(pid))], capture_output=True, text=True, timeout=10)
    return r.returncode == 0, r.stdout.strip()


def wait_front(pred, timeout=6.0):
    deadline = time.monotonic() + timeout
    f = {}
    while time.monotonic() < deadline:
        f = front_app()
        if pred(f):
            return True, f
        time.sleep(0.2)
    return False, f


# ---------------------------------------------------------------------------------------------------
# Spend: Dot's ledger, read-only
# ---------------------------------------------------------------------------------------------------

def ledger_total(path):
    """SUM of the cost column of Dot's ledger (table and column discovered, e.g. turns.cost_usd)."""
    path = Path(path)
    if not path.exists():
        return None
    con = sqlite3.connect('file:%s?mode=ro' % path, uri=True, timeout=5)
    try:
        tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        for t in sorted(tables, key=lambda t: t != 'turns'):
            cols = [r[1] for r in con.execute('PRAGMA table_info("%s")' % t.replace('"', ''))]
            cost = next((c for c in cols if c == 'cost_usd'), None) or next((c for c in cols if 'cost' in c.lower()), None)
            if cost:
                return float(con.execute('SELECT COALESCE(SUM("%s"),0) FROM "%s"' % (cost, t)).fetchone()[0])
        return None
    finally:
        con.close()


# ---------------------------------------------------------------------------------------------------
# The runner
# ---------------------------------------------------------------------------------------------------

def server_events(base, since):
    url = '%s/events?since=%.3f' % (base.rstrip('/'), since)
    with urllib.request.urlopen(url, timeout=3) as r:
        return [json.loads(l) for l in r.read().decode().splitlines() if l.strip()]


def server_up(base):
    try:
        with urllib.request.urlopen(base.rstrip('/') + '/health', timeout=1.5) as r:
            return json.loads(r.read().decode()).get('ok') is True
    except (OSError, ValueError):
        return False


def dot_running(dot_path):
    try:
        out = subprocess.run(['ps', '-axo', 'pid=,command='], capture_output=True, text=True, timeout=5).stdout
    except (OSError, subprocess.SubprocessError):
        return False
    exe = str(dot_path)
    for line in out.splitlines():
        cmd = line.strip().split(None, 1)[1] if len(line.strip().split(None, 1)) == 2 else ''
        if (cmd == exe or cmd.startswith(exe + ' ')) and '--host' not in cmd and '--ask' not in cmd:
            return True
    return False


def dot_supports_bench(dot_path):
    """An old Dot reads `--bench` as part of the question and runs it for real, so look for the bench
    strings in the binary before sending anything (no process is started)."""
    try:
        data = Path(dot_path).read_bytes()
    except OSError:
        return False
    return b'ask: received bench=' in data or b'--bench' in data


def dot_command(dot, row_flags, ask, comet_port):
    flags = list(row_flags or [])
    if '--comet-port' in flags:
        check_port(flags[flags.index('--comet-port') + 1])
    else:
        flags += ['--comet-port', str(check_port(comet_port))]
    return [str(dot), '--ask', '--bench'] + flags + [ask]


def setup_plan(row, base, comet_port):
    s = row.get('setup') or {}
    front = s.get('front', 'safari')
    url = s.get('open_url') or (base + '/index.html' if front in ('safari', 'bench-comet') else None)
    history = s.get('history')
    steps = []
    if front == 'safari':
        if history:
            first, rest = history[0], history[1:]
            # bench.js follows ?go=<page> in the same tab, so Safari gets real history without scripting.
            chain = first + ('&' if '?' in first else '?') + 'go=' + rest[-1].rsplit('/', 1)[-1] if rest else first
            steps.append(['open', '-a', 'Safari', chain])
        else:
            steps.append(['open', '-a', 'Safari', url])
    elif front == 'bench-comet':
        steps.append('cdp :%d show %s' % (comet_port, ' -> '.join(history or [url])))
        steps.append('activate bench Comet by PID')
    elif front == 'textedit':
        steps.append(['open', '-a', 'TextEdit', str(SCRATCH / 'notes.txt')])
    elif front == 'finder':
        steps.append(['open', str(SCRATCH)])
    return front, (history[-1] if history else url), steps


class Runner:
    def __init__(self, args):
        self.args = args
        self.base = args.base.rstrip('/')
        self.tail = LogTail(args.dot_log)
        self.children = []
        self.started_comet = False
        self.spend0 = None
        self.out = Path(args.out_dir).expanduser()

    def say(self, *a):
        print(*a, file=sys.stderr, flush=True)

    # --- environment -------------------------------------------------------------------------------
    def ensure_scratch(self):
        SCRATCH.mkdir(parents=True, exist_ok=True)
        for name, text in (('README.txt', 'Scratch folder for the Dot bench (placeholder files only).\n'),
                           ('notes.txt', 'Placeholder notes for the Dot bench.\n')):
            p = SCRATCH / name
            if not p.exists():
                p.write_text(text)

    def ensure_server(self):
        if server_up(self.base):
            return
        if self.args.no_launch:
            raise BenchError('bench server not answering at %s (start scripts/bench-server.py)' % self.base)
        port = urlsplit(self.base).port or DEFAULT_PORT
        self.out.mkdir(parents=True, exist_ok=True)
        logf = open(self.out / 'bench-server.out', 'a')
        p = subprocess.Popen([sys.executable, str(HERE / 'bench-server.py'), '--port', str(port), '--quiet'],
                             stdout=logf, stderr=subprocess.STDOUT)
        self.children.append(p)
        for _ in range(50):
            if server_up(self.base):
                self.say('bench: started bench-server.py (pid %d) on %s' % (p.pid, self.base))
                return
            time.sleep(0.1)
        raise BenchError('bench server did not start on %s' % self.base)

    def comet_pid(self):
        try:
            return int((self.out / 'bench-comet.pid').read_text().strip())
        except (OSError, ValueError):
            return None

    def ensure_comet(self):
        if comet_tab_count(self.args.comet_port) is not None and self.comet_pid():
            return
        if self.args.no_launch:
            raise BenchError('bench Comet not answering on :%d (scripts/bench-comet.sh start)' % self.args.comet_port)
        env = dict(os.environ, PORT=str(self.args.comet_port), BENCH_URL=self.base + '/index.html', BENCH_DIR=str(self.out))
        r = subprocess.run(['zsh', str(HERE / 'bench-comet.sh'), 'start'], env=env, capture_output=True, text=True, timeout=40)
        if r.returncode != 0:
            raise BenchError('bench-comet.sh start: %s' % (r.stderr or r.stdout).strip()[:300])
        self.started_comet = True
        self.say(r.stdout.strip())

    def cleanup(self):
        if self.started_comet and not self.args.keep_comet:
            env = dict(os.environ, PORT=str(self.args.comet_port), BENCH_DIR=str(self.out))
            r = subprocess.run(['zsh', str(HERE / 'bench-comet.sh'), 'stop', '--wipe'], env=env, capture_output=True, text=True, timeout=30)
            self.say((r.stdout + r.stderr).strip())
        for p in self.children:
            p.terminate()
            try:
                p.wait(5)
            except subprocess.TimeoutExpired:
                p.kill()

    def check_idle(self, first=False):
        need = self.args.require_idle
        if not need:
            return
        idle = hid_idle_seconds()
        if idle is None:
            raise BenchError('cannot read HIDIdleTime; pass --require-idle 0 to skip the check')
        if first:
            if idle < need:
                raise BenchError('he looks active (idle %.0f s < %d s); not sending asks' % (idle, need))
            return
        if idle < 2.0:
            time.sleep(5)
            idle2 = hid_idle_seconds() or 0
            if idle2 < 5.0:
                raise BenchError('input during the bench (idle %.1f s); stopping' % idle2)

    # --- one row -----------------------------------------------------------------------------------
    def setup(self, row):
        front, url, _ = setup_plan(row, self.base, self.args.comet_port)
        s = row.get('setup') or {}
        t0 = time.time()
        if front == 'none':
            return True, 'no setup'
        if front == 'safari':
            _, _, steps = setup_plan(row, self.base, self.args.comet_port)
            subprocess.run(steps[0], check=False, timeout=10)
            ok, f = wait_front(lambda f: f.get('bundle') == 'com.apple.Safari')
            if not ok:
                return False, 'Safari not in front (front: %s)' % f.get('name')
        elif front == 'bench-comet':
            self.ensure_comet()
            urls = s.get('history') or [url]
            comet_show(self.args.comet_port, urls, self.base)
            pid = self.comet_pid()
            if pid is None:
                return False, 'no bench Comet PID'
            okk, msg = activate_pid(pid, self.out)
            ok, f = wait_front(lambda f: f.get('pid') == pid, timeout=4)
            if not ok:
                return False, 'bench Comet (pid %s) not in front (front: %s %s; activate: %s)' % (pid, f.get('name'), f.get('pid'), msg)
        elif front == 'textedit':
            subprocess.run(['open', '-a', 'TextEdit', str(SCRATCH / 'notes.txt')], check=False, timeout=10)
            ok, f = wait_front(lambda f: f.get('bundle') == 'com.apple.TextEdit')
            if not ok:
                return False, 'TextEdit not in front (front: %s)' % f.get('name')
            return True, 'TextEdit in front'
        elif front == 'finder':
            subprocess.run(['open', str(SCRATCH)], check=False, timeout=10)
            ok, f = wait_front(lambda f: f.get('bundle') == 'com.apple.finder')
            if not ok:
                return False, 'Finder not in front (front: %s)' % f.get('name')
            return True, 'Finder in front'
        # A fixture page: wait for its load (or bfcache pageshow) event so the baseline is known.
        want = re.escape(url.split('?')[0])
        deadline = time.time() + 10
        while time.time() < deadline:
            evs = server_events(self.base, t0 - 0.5)
            if any(ev.get('type') in ('load', 'pageshow') and re.match(want, str(ev.get('url', '')).split('?')[0]) for ev in evs):
                time.sleep(0.4)
                return True, 'fixture %s in front' % url
            time.sleep(0.2)
        return False, 'fixture page %s never reported a load' % url

    def send_ask(self, row, ask, flags):
        cmd = dot_command(self.args.dot, flags, ask, self.args.comet_port)
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return r.returncode == 0, (r.stdout + r.stderr).strip()

    def wait_done(self, tracker, lines, t_ask, until=None, from_index=None, timeout=None):
        """Poll dot.log until the tracker says done, or until a line from `from_index` on matches the
        `until` regex. Returns a short note ('done', 'saw /x/', or a timeout)."""
        deadline = t_ask + (timeout or self.args.timeout)
        hard = t_ask + max(self.args.timeout, self.args.think_timeout)
        pat = re.compile(until, re.I) if until else None
        start = len(lines) if from_index is None else from_index
        while True:
            for l in self.tail.read():
                lines.append(l)
                tracker.feed(l)
            now = time.time()
            if pat is not None:
                if any(pat.search(l.msg) for l in lines[start:]):
                    return 'saw /%s/' % until
                if now > deadline:
                    return 'timeout waiting for /%s/' % until
            else:
                if tracker.done(now, self.args.settle):
                    return 'done'
                if tracker.terminal_at is None and now > deadline:
                    return 'timeout: no completion marker in %d s' % self.args.timeout
                if now > hard:
                    return 'timeout: a turn was still open after %d s' % self.args.think_timeout
            time.sleep(0.1)

    def run_row(self, row):
        rid = str(row['id'])
        res = {'id': rid, 'kind': row.get('kind'), 'ask': row.get('ask'), 'group': row.get('group'),
               'limit_ms': row.get('limit_ms'), 'started': datetime.now().isoformat(timespec='seconds')}
        if row.get('needs_unlocked') and screen_locked():
            # focus and window order can't be judged on a locked screen: skipped and reported, never passed
            res.update({'pass': None, 'skipped': 'needs_unlocked: the screen is locked', 'latency_ms': None, 'checks': [], 'reasons': ['skipped: screen locked']})
            return res
        ok, note = self.setup(row)
        res['setup'] = note
        if not ok:
            res.update({'pass': False, 'latency_ms': None, 'checks': [{'name': 'setup', 'ok': False, 'detail': note}],
                        'reasons': ['setup: ' + note], 'skipped_ask': True})
            return res
        spend_before = ledger_total(self.args.ledger)
        tabs_before = comet_tab_count(self.args.comet_port, self.base) if (row.get('setup') or {}).get('front') == 'bench-comet' else None
        self.tail.mark()
        res['dot_log_start_line'] = self.tail.start_line
        t_start = time.time()
        front_before, mouse_before = front_app(), mouse_location()
        tracker, lines, notes, asks_sent = TurnTracker(), [], [], []
        tracker.job_timeout = float(getattr(self.args, 'job_timeout', 120))
        steps = [{'ask': row['ask'], 'flags': row.get('flags', [])}] + list(row.get('then', []))
        ask_index = 0  # index in `lines` of the latest `ask: received`
        for k, step in enumerate(steps):
            if k > 0:
                if step.get('after'):
                    notes.append(self.wait_done(tracker, lines, time.time(), until=step['after'], from_index=ask_index))
                else:
                    notes.append(self.wait_done(tracker, lines, time.time()))
                time.sleep(step.get('delay_ms', 0) / 1000.0)
            if step.get('open_app'):
                # bring another app in front mid-row (J10b: Escape with Finder in front must not stop the job)
                subprocess.run(['open', '-a', step['open_app']], check=False, timeout=10)
                notes.append('open_app %s' % step['open_app'])
                continue
            if step.get('new_tab'):
                # another bench tab opened by the runner during a job (J18)
                url = step['new_tab'].replace('{base}', self.base)
                try:
                    urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d/json/new?%s' % (self.args.comet_port, url), method='PUT'), timeout=3).read()
                    notes.append('new_tab %s' % url)
                except Exception as e:
                    notes.append('new_tab failed: %s' % e)
                continue
            if step.get('cli'):
                # `--stop`, `--job-test click`: Dot's own commands, not an ask
                r = subprocess.run([str(self.args.dot)] + str(step['cli']).split(), capture_output=True, text=True, timeout=15)
                notes.append('cli %s: %s' % (step['cli'], (r.stdout + r.stderr).strip()[:80]))
                continue
            n_before = len(asks(lines))
            sent_ok, out = self.send_ask(row, step['ask'], step.get('flags', row.get('flags', [])))
            asks_sent.append(step['ask'])
            if not sent_ok:
                notes.append('Dot --ask failed: %s' % out[:200])
                break
            got = self.wait_done(tracker, lines, time.time(), until=r'^ask: received', timeout=5)
            rec = asks(lines)
            if len(rec) > n_before:
                ask_index = max(i for i, l in enumerate(lines) if RE_ASK.match(l.msg))
                # The candidate must answer in bench mode: stop the whole run if it says bench=0.
                if rec[-1][1] != '1':
                    res.update({'pass': False, 'checks': [{'name': 'bench_mode', 'ok': False, 'detail': 'ask: received bench=%s' % rec[-1][1]}],
                                'reasons': ['Dot is not in bench mode (bench=%s); run stopped' % rec[-1][1]], 'latency_ms': None, 'abort': True})
                    return res
            else:
                notes.append('no `ask: received` line within 5 s (%s)' % got)
        notes.append(self.wait_done(tracker, lines, time.time()))
        front_after, mouse_after = front_app(), mouse_location()
        time.sleep(0.3)
        evs = server_events(self.base, t_start - 30)
        events_before = [e for e in evs if e.get('ts', 0) < t_start]
        events_after = [e for e in evs if e.get('ts', 0) >= t_start]
        lat = latency_ms(lines, row.get('latency_to'))
        page_url = setup_plan(row, self.base, self.args.comet_port)[1]
        ctx = {'lines': lines, 'asks_sent': asks_sent, 'events_before': events_before, 'events_after': events_after,
               'page': urlsplit(page_url).path if page_url and page_url.startswith('http') else None,
               'front_before': front_before, 'front_after': front_after, 'mouse_before': mouse_before,
               'mouse_after': mouse_after, 'latency_ms': lat, 'limit_ms': row.get('limit_ms'),
               'shot_scale': self.args.shot_scale, 'comet_tabs_before': tabs_before,
               'comet_tabs_after': comet_tab_count(self.args.comet_port, self.base) if tabs_before is not None else None,
               'setup_tab_focused': setup_tab_focused(self.args.comet_port, page_url) if page_url and page_url.startswith('http') else None}
        checks = evaluate(row.get('expect'), ctx)
        spend_after = ledger_total(self.args.ledger)
        res.update({
            'pass': all(c['ok'] for c in checks), 'latency_ms': lat, 'checks': checks,
            'reasons': [('%s: %s' % (c['name'], c['detail'])) for c in checks if not c['ok']],
            'wait': notes, 'cost_usd': log_spend(lines) + (0 if spend_before is None or spend_after is None else round(spend_after - spend_before, 4)),
            'front_before': front_before, 'front_after': front_after, 'mouse_before': mouse_before, 'mouse_after': mouse_after,
            'log': [l.text() for l in lines if l.msg.startswith(RELEVANT)][:120],
            'server_events': [{k: e.get(k) for k in ('time', 'type', 'url', 'text', 'label', 'value', 'checked', 'scrollY', 'in_view') if k in e}
                              for e in events_after][:80],
            'ended': datetime.now().isoformat(timespec='seconds'),
        })
        if not asks(lines):
            res['no_ask_received'] = True
        return res

    # --- whole run ---------------------------------------------------------------------------------
    def run(self, rows):
        results, misses = [], 0
        stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        meta = {'stamp': stamp, 'base': self.base, 'dot': str(self.args.dot), 'comet_port': self.args.comet_port,
                'requests': str(self.args.requests), 'max_spend': self.args.max_spend}
        if not Path(self.args.dot).exists():
            raise BenchError('no Dot binary at %s' % self.args.dot)
        if not dot_supports_bench(self.args.dot):
            raise BenchError('%s has no --bench support (an old Dot would run the asks for real); not sending anything' % self.args.dot)
        if not dot_running(self.args.dot):
            raise BenchError('Dot is not running (the bench never launches it)')
        self.check_idle(first=True)
        self.ensure_scratch()
        self.ensure_server()
        self.spend0 = ledger_total(self.args.ledger)
        meta['spend_start'] = self.spend0
        stopped = None
        try:
            for row in rows:
                if 'aggregate' in row:
                    continue
                # the ledger misses bench turns and jobs; the log lines' $ amounts carry them
                spent = sum(r.get('cost_usd') or 0 for r in results if isinstance(r, dict) and 'aggregate' not in r)
                if spent > self.args.max_spend:
                    stopped = 'spend cap: $%.2f > $%.2f' % (spent, self.args.max_spend)
                    break
                self.check_idle()
                self.say('bench: row %s: %s' % (row['id'], row.get('ask')))
                try:
                    r = self.run_row(row)
                except Exception as e:  # one row's runner error is that row's failure, never the whole bench's
                    r = {'id': str(row['id']), 'kind': row.get('kind'), 'ask': row.get('ask'), 'group': row.get('group'), 'pass': False,
                         'reasons': ['runner error: %s: %s' % (type(e).__name__, str(e)[:160])], 'checks': [], 'latency_ms': None}
                results.append(r)
                self.say('bench: row %s %s %s' % (r['id'], 'PASS' if r['pass'] else 'FAIL', '; '.join(r.get('reasons', []))[:200]))
                if r.get('abort'):
                    stopped = r['reasons'][0]
                    break
                misses = misses + 1 if r.get('no_ask_received') else 0
                if misses >= 2:
                    stopped = 'two rows in a row without `ask: received`: is the candidate Dot running?'
                    break
        except BenchError as e:
            stopped = str(e)
        finally:
            self.cleanup()
        ran = {r['id'] for r in results}
        for row in rows:
            if 'aggregate' in row:
                results.append(aggregate(row, results))
            elif str(row['id']) not in ran:
                results.append({'id': str(row['id']), 'kind': row.get('kind'), 'pass': False, 'latency_ms': None,
                                'reasons': ['not run' + (' (%s)' % stopped if stopped else '')], 'checks': [], 'skipped': True})
        meta['spend_end'] = ledger_total(self.args.ledger)
        meta['spend_delta'] = None if meta['spend_end'] is None or self.spend0 is None else round(meta['spend_end'] - self.spend0, 4)
        meta['stopped'] = stopped
        return meta, results


def markdown(meta, results):
    lines = ['# Dot bench %s' % meta.get('stamp', ''), '',
             'Requests: `%s`. Fixture: %s. Spend: %s. %s' % (
                 meta.get('requests'), meta.get('base'),
                 '$%.4f' % meta['spend_delta'] if meta.get('spend_delta') is not None else 'unknown',
                 ('Stopped: %s.' % meta['stopped']) if meta.get('stopped') else ''), '',
             '| row | kind | result | latency | reason |', '|---|---|---|---|---|']
    for r in results:
        lat = '%d ms' % r['latency_ms'] if r.get('latency_ms') is not None else '-'
        if r.get('aggregate'):
            a = r['aggregate']
            lat += ' (median of %d)' % a.get('n', 0)
        result = 'skip' if r.get('skipped') else ('pass' if r.get('pass') else 'FAIL')
        reason = '; '.join(r.get('reasons') or [])
        reason = reason.replace('|', '/').replace('\n', ' ')
        lines.append('| %s | %s | %s | %s | %s |' % (r['id'], r.get('kind') or '', result, lat, reason[:180]))
    n = [r for r in results if not r.get('skipped')]
    reg = [r for r in n if r.get('kind') == 'regression']
    lines += ['', 'Passed %d of %d run rows; regression rows %d of %d.' % (
        sum(1 for r in n if r.get('pass')), len(n), sum(1 for r in reg if r.get('pass')), len(reg))]
    return '\n'.join(lines) + '\n'


def dry_plan(rows, args):
    out = []
    base = args.base.rstrip('/')
    for row in rows:
        out.append('row %s [%s]%s' % (row['id'], row.get('kind'), ' group=%s' % row['group'] if row.get('group') else ''))
        if 'aggregate' in row:
            out.append('  aggregate over group %r: %s' % (row['aggregate'].get('group'), json.dumps(row['aggregate'])))
            continue
        front, url, steps = setup_plan(row, base, args.comet_port)
        out.append('  setup: front=%s%s' % (front, ' url=%s' % url if url else ''))
        for s in steps:
            out.append('    $ %s' % (' '.join(s) if isinstance(s, list) else s))
        asks_ = [{'ask': row['ask'], 'flags': row.get('flags', [])}] + list(row.get('then', []))
        for k, st in enumerate(asks_):
            if k:
                out.append('  then (after %s%s):' % ('/%s/' % st['after'] if st.get('after') else 'the previous turn is done',
                                                    ', +%d ms' % st['delay_ms'] if st.get('delay_ms') else ''))
            if not st.get('ask'):
                kind = next(k for k in ('cli', 'open_app', 'new_tab') if st.get(k))
                out.append('    $ %s' % ('%s %s' % (args.dot, st['cli']) if kind == 'cli' else 'open -a %s' % st['open_app'] if kind == 'open_app' else 'cdp /json/new %s' % st['new_tab']))
                continue
            out.append('    $ %s' % ' '.join(json.dumps(a) if ' ' in a else a for a in dot_command(args.dot, st.get('flags', row.get('flags', [])), st['ask'], args.comet_port)))
        out.append('  wait: tail %s until done (timeout %d s, then %d s quiet)' % (args.dot_log, args.timeout, args.settle))
        exp = row.get('expect') or {}
        for k, v in exp.items():
            out.append('  expect %s: %s' % (k, json.dumps(v)))
        if row.get('limit_ms'):
            out.append('  limit: %d ms (ask: received -> %s)' % (row['limit_ms'], row.get('latency_to') or 'act ok | first sentence | beat'))
    return '\n'.join(out)


def load_rows(path, args):
    data = json.loads(Path(path).expanduser().read_text())
    rows = data['rows'] if isinstance(data, dict) else data
    u = urlsplit(args.base)
    subs = {'base': args.base.rstrip('/'), 'host': u.netloc, 'bench_dir': str(SCRATCH), 'comet_port': str(args.comet_port)}
    rows = [substitute(r, subs) for r in rows]
    for r in rows:
        r['id'] = str(r.get('id', ''))
    return rows


def main(argv=None):
    ap = argparse.ArgumentParser(description='Run Dot bench rows one at a time and check them.')
    ap.add_argument('--requests', default=str(DEFAULT_REQUESTS))
    ap.add_argument('--rows', default='', help='comma list: ids, prefixes (21 = 21.x) and ranges (1-14)')
    ap.add_argument('--dry-plan', action='store_true', help='print what would run; touch nothing')
    ap.add_argument('--port', type=int, default=DEFAULT_PORT, help='bench server port (ignored with --base)')
    ap.add_argument('--base', default=None, help='bench server base URL (default http://127.0.0.1:<port>)')
    ap.add_argument('--comet-port', type=int, default=DEFAULT_COMET_PORT)
    ap.add_argument('--dot', default=str(DEFAULT_DOT))
    ap.add_argument('--dot-log', default=str(DEFAULT_DOT_LOG))
    ap.add_argument('--ledger', default=str(DEFAULT_LEDGER))
    ap.add_argument('--max-spend', type=float, default=10.0, help='stop when Dot spend since the start exceeds this (USD)')
    ap.add_argument('--out-dir', default=str(BENCH_DIR))
    ap.add_argument('--timeout', type=int, default=30, help='seconds to the first completion marker')
    ap.add_argument('--job-timeout', type=int, default=120, help='a row stays open this long while a job it started runs')
    ap.add_argument('--settle', type=float, default=3.0, help='quiet seconds after completion')
    ap.add_argument('--think-timeout', type=int, default=90, help='hard cap per ask while a turn is still open')
    ap.add_argument('--require-idle', type=int, default=600, help='HIDIdleTime seconds needed at the start (0 = skip)')
    ap.add_argument('--shot-scale', type=float, default=1.0, help='screenshot pixels per screen point, for point_in_element')
    ap.add_argument('--no-launch', action='store_true', help='never start the bench server or the bench Comet')
    ap.add_argument('--keep-comet', action='store_true', help='leave a bench Comet this run started running')
    args = ap.parse_args(argv)
    args.base = (args.base or 'http://127.0.0.1:%d' % args.port).rstrip('/')
    try:
        check_port(args.comet_port)
    except RefusedPort as e:
        ap.error(str(e))
    if urlsplit(args.base).hostname not in ('127.0.0.1', 'localhost'):
        ap.error('--base must be loopback')

    rows = load_rows(args.requests, args)
    problems = validate_rows(rows)
    if problems:
        print('bench: the request list has problems:\n  ' + '\n  '.join(problems), file=sys.stderr)
        return 2
    tokens = [t for t in args.rows.split(',') if t.strip()]
    rows = [r for r in rows if row_selected(r['id'], tokens)]
    if not rows:
        print('bench: no rows selected', file=sys.stderr)
        return 2
    if args.dry_plan:
        print(dry_plan(rows, args))
        return 0

    runner = Runner(args)
    try:
        meta, results = runner.run(rows)
    except BenchError as e:
        print('bench: %s' % e, file=sys.stderr)
        return 2
    out = Path(args.out_dir).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    md = markdown(meta, results)
    (out / ('results-%s.json' % meta['stamp'])).write_text(json.dumps({'meta': meta, 'rows': results}, indent=1, default=str))
    (out / ('results-%s.md' % meta['stamp'])).write_text(md)
    print(md)
    print('bench: wrote %s' % (out / ('results-%s.json' % meta['stamp'])), file=sys.stderr)
    return 0 if all(r.get('pass') for r in results) else 1


if __name__ == '__main__':
    sys.exit(main())
