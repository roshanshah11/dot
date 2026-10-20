#!/usr/bin/env python3
"""Unit tests for scripts/dot-bench.py, scripts/bench-server.py and the bench fixture.

    python3 scripts/test_dot_bench.py -v

Stdlib only. Nothing here talks to Dot, Safari or any Comet: the dot.log snippets are synthetic (in the
line contract of Tests/Fixtures/bench/README.md), the WebSocket peer is a local fake server, and the
bench server runs on a free port with a temporary log.
"""
import importlib.util, json, os, re, socket, sqlite3, struct, subprocess, sys, tempfile, threading, time, unittest
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURE = HERE.parent / 'Tests' / 'Fixtures' / 'bench'
spec = importlib.util.spec_from_file_location('dot_bench', HERE / 'dot-bench.py')
db = importlib.util.module_from_spec(spec)
spec.loader.exec_module(db)


def snippet(text):
    """Synthetic dot.log text -> LogLines. Leading whitespace on each line is ignored."""
    return db.parse_log('\n'.join(l.strip() for l in text.strip().splitlines()))


SIMPLE_TALK = '''
2026-10-19 02:00:00.000 INFO jev[suggest] 120 ms, 798 tokens: offer=none 0.50/0.25
2026-10-19 02:00:01.000 INFO ask: received bench=1 text=what is 17 times 23
2026-10-19 02:00:01.150 INFO jev[route] 148 ms, 1890 tokens: element=none 0.86/0.86 on_screen=0.33 route=answer 0.88/0.80
2026-10-19 02:00:01.160 INFO turn[talk] sent 1 image(s), 3091 chars: what is 17 times 23
2026-10-19 02:00:02.400 INFO turn[talk] first sentence 1240 ms
2026-10-19 02:00:02.900 INFO turn[talk] done in 1740 ms, $0.0246, 0 visual beat(s), tags
2026-10-19 02:00:02.900 INFO turn[talk] said: 17 times 23 is 391.
'''

HANDOFF = '''
2026-10-19 02:01:00.000 INFO ask: received bench=1 text=show me the steps
2026-10-19 02:01:00.120 INFO jev[route] 118 ms, 1896 tokens: element=none 0.93/0.93 route=answer 0.81/0.72
2026-10-19 02:01:00.130 INFO turn[talk] sent 1 image(s), 3065 chars: show me the steps
2026-10-19 02:01:02.000 INFO turn[talk] done in 1870 ms, $0.0250, 0 visual beat(s), tags think
2026-10-19 02:01:02.000 INFO turn[talk] said: putting the steps on the panel.
2026-10-19 02:01:02.200 INFO turn[think] sent 1 image(s), 3376 chars: show me the steps
2026-10-19 02:01:20.000 INFO turn[think] done in 17800 ms, $0.1018, 4 visual beat(s), tags step(id: "s1", n: 1)
2026-10-19 02:01:20.100 INFO beat 1: first, write the matrix down.
'''

INTERRUPT = '''
2026-10-19 02:02:00.000 INFO ask: received bench=1 text=explain how a heat pump works, step by step
2026-10-19 02:02:00.130 INFO jev[route] 130 ms, 1900 tokens: element=none 0.90/0.90 route=answer 0.80/0.70
2026-10-19 02:02:00.140 INFO turn[talk] sent 1 image(s), 3000 chars: explain how a heat pump works, step by step
2026-10-19 02:02:01.500 INFO turn[talk] first sentence 1360 ms
2026-10-19 02:02:02.000 INFO beat 1: a heat pump moves heat instead of making it.
2026-10-19 02:02:02.300 INFO ask: received bench=1 text=actually, what is 12 times 12?
2026-10-19 02:02:02.520 INFO talk: interrupted
2026-10-19 02:02:02.600 INFO turn[talk] sent 1 image(s), 2900 chars: actually, what is 12 times 12?
2026-10-19 02:02:02.700 INFO turn[talk] done in 2560 ms, $0.0000, 0 visual beat(s), tags
2026-10-19 02:02:03.900 INFO turn[talk] first sentence 1300 ms
2026-10-19 02:02:04.300 INFO turn[talk] done in 1700 ms, $0.0200, 0 visual beat(s), tags
2026-10-19 02:02:04.300 INFO turn[talk] said: 144.
'''

ACTS = '''
2026-10-19 02:03:00.000 INFO ask: received bench=1 text=go to settings and turn on email alerts
2026-10-19 02:03:00.090 INFO jev[route] 90 ms, 1900 tokens: element=e3 0.95/0.95 route=act 0.90/0.85
2026-10-19 02:03:00.400 INFO act: click Settings ok 31 ms
2026-10-19 02:03:01.000 INFO act: click Notifications ok 28 ms
2026-10-19 02:03:01.600 INFO act: click Email ok 30 ms
2026-10-19 02:03:02.200 INFO act: click Email alerts ok 25 ms
2026-10-19 02:03:02.300 INFO act: go turn on email alerts ok 2300 ms
'''

NOTHING = '''
2026-10-19 02:04:00.000 INFO ask: received bench=1 text=Yeah.
2026-10-19 02:04:00.180 INFO jev[route] 180 ms, 632 tokens: on_screen=0.16 route=ignore 0.99/0.99
2026-10-19 02:04:00.181 INFO jev: nothing asked (0.99): Yeah.
'''


def ctx(lines, **kw):
    c = {'lines': lines, 'asks_sent': [], 'events_before': [], 'events_after': [], 'front_before': {}, 'front_after': {},
         'mouse_before': (10.0, 10.0), 'mouse_after': (10.0, 10.0), 'latency_ms': None, 'limit_ms': None, 'shot_scale': 1.0,
         'comet_tabs_before': None, 'comet_tabs_after': None, 'page': None}
    c.update(kw)
    return c


class LogParsing(unittest.TestCase):
    def test_lines_and_levels(self):
        lines = snippet(SIMPLE_TALK)
        self.assertEqual(len(lines), 7)
        self.assertEqual(lines[1].level, 'INFO')
        self.assertTrue(lines[1].msg.startswith('ask: received bench=1'))
        self.assertAlmostEqual(lines[4].ts - lines[1].ts, 1.4, places=3)

    def test_continuation_lines_join_the_previous_message(self):
        lines = db.parse_log('2026-10-19 02:00:00.000 WARN first part\n  second part\n2026-10-19 02:00:00.500 INFO next')
        self.assertEqual(len(lines), 2)
        self.assertEqual(lines[0].msg, 'first part\n  second part')
        self.assertEqual(lines[0].level, 'WARN')

    def test_tail_reads_only_new_complete_lines(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'dot.log'
            p.write_text('2026-10-19 01:00:00.000 INFO old line\n')
            t = db.LogTail(p)
            self.assertEqual(t.mark(), 1)
            self.assertEqual(t.read(), [])
            with p.open('a') as f:
                f.write('2026-10-19 01:00:01.000 INFO ask: received bench=1 text=hi\n2026-10-19 01:00:01.100 INFO act: sc')
            got = t.read()
            self.assertEqual([l.msg for l in got], ['ask: received bench=1 text=hi'])
            with p.open('a') as f:
                f.write('roll down ok 2 ms\n')
            self.assertEqual([l.msg for l in t.read()], ['act: scroll down ok 2 ms'])
            p.write_text('2026-10-19 01:00:02.000 INFO after rotation\n')  # truncated: start over
            self.assertEqual([l.msg for l in t.read()], ['after rotation'])


class Tracker(unittest.TestCase):
    def feed(self, text):
        t = db.TurnTracker()
        lines = snippet(text)
        for l in lines:
            t.feed(l)
        return t, lines

    def test_simple_turn_is_done_after_settle(self):
        t, lines = self.feed(SIMPLE_TALK)
        end = lines[-1].ts
        self.assertFalse(t.done(end + 1.0, 3.0))
        self.assertTrue(t.done(end + 3.1, 3.0))

    def test_open_turn_blocks(self):
        t, lines = self.feed('\n'.join(SIMPLE_TALK.strip().splitlines()[:4]))
        self.assertIsNone(t.terminal_at)
        self.assertFalse(t.done(lines[-1].ts + 60, 3.0))

    def test_think_handoff_waits_for_think_done(self):
        text = HANDOFF.strip().splitlines()
        t, lines = self.feed('\n'.join(text[:5]))  # talk done (tags think), think not sent yet
        self.assertTrue(t.busy(lines[-1].ts + 4))
        self.assertFalse(t.done(lines[-1].ts + 4, 3.0))
        t, lines = self.feed('\n'.join(text[:6]))  # think sent
        self.assertFalse(t.done(lines[-1].ts + 10, 3.0))
        t, lines = self.feed(HANDOFF)
        self.assertTrue(t.done(lines[-1].ts + 3.5, 3.0))

    def test_think_handoff_expires(self):
        t, lines = self.feed('\n'.join(HANDOFF.strip().splitlines()[:5]))
        self.assertTrue(t.done(lines[-1].ts + db.TurnTracker.THINK_GRACE + 1, 3.0))

    def test_nothing_asked_is_terminal(self):
        t, lines = self.feed(NOTHING)
        self.assertIsNotNone(t.terminal_at)
        self.assertTrue(t.done(lines[-1].ts + 3.2, 3.0))

    def test_act_is_terminal(self):
        t, lines = self.feed(ACTS)
        self.assertTrue(t.done(lines[-1].ts + 3.2, 3.0))

    def test_interrupt_pairs_the_late_done_with_the_cut_turn(self):
        rows = INTERRUPT.strip().splitlines()
        # Up to the cut turn's late `done` (after the replacement turn was sent): the new turn is still open.
        t, lines = self.feed('\n'.join(rows[:9]))
        self.assertTrue(t.busy(lines[-1].ts))
        self.assertFalse(t.done(lines[-1].ts + 10, 3.0))
        t, lines = self.feed(INTERRUPT)
        self.assertFalse(t.busy(lines[-1].ts))
        self.assertTrue(t.done(lines[-1].ts + 3.1, 3.0))

    def test_new_ask_resets_the_terminal_marker(self):
        t, _ = self.feed(SIMPLE_TALK + '\n2026-10-19 02:00:09.000 INFO ask: received bench=1 text=again')
        self.assertIsNone(t.terminal_at)


class Measures(unittest.TestCase):
    def test_act_lines(self):
        acts = db.act_lines(db.parse_log(
            '2026-10-19 02:00:00.000 INFO act: click Submit application ok 34 ms\n'
            '2026-10-19 02:00:00.100 INFO act: back ok 12 ms\n'
            '2026-10-19 02:00:00.200 INFO act: open chain stream fail no such app\n'
            '2026-10-19 02:00:00.300 INFO act: key fail\n'
            '2026-10-19 02:00:00.400 INFO act: click ok button ok 9 ms'))
        self.assertEqual(acts[0]['verb'], 'click'); self.assertEqual(acts[0]['target'], 'Submit application'); self.assertEqual(acts[0]['ms'], 34)
        self.assertEqual(acts[1]['verb'], 'back'); self.assertEqual(acts[1]['target'], ''); self.assertTrue(acts[1]['ok'])
        self.assertFalse(acts[2]['ok']); self.assertEqual(acts[2]['target'], 'chain stream'); self.assertEqual(acts[2]['reason'], 'no such app')
        self.assertFalse(acts[3]['ok']); self.assertEqual(acts[3]['verb'], 'key')
        self.assertEqual(acts[4]['target'], 'ok button')

    def test_latency_default_and_custom(self):
        self.assertEqual(db.latency_ms(snippet(SIMPLE_TALK)), 1400)
        self.assertEqual(db.latency_ms(snippet(ACTS)), 400)
        self.assertEqual(db.latency_ms(snippet(ACTS), r'^act: go\b'), 2300)
        self.assertEqual(db.latency_ms(snippet(NOTHING), r'^(jev: nothing asked|route)'), 181)
        self.assertIsNone(db.latency_ms(snippet(NOTHING)))
        self.assertEqual(db.latency_ms(snippet(INTERRUPT), ask_index=1), 1600)
        self.assertEqual(db.latency_ms(snippet(HANDOFF)), 20100)  # beat 1 is the first marker

    def test_tag_points(self):
        lines = db.parse_log('2026-10-19 02:00:00.000 INFO turn[talk] done in 900 ms, $0.01, 1 visual beat(s), tags '
                             'point(x: 120, y: 340, label: "export", screen: nil)\n'
                             '2026-10-19 02:00:01.000 INFO beat 2 (quiet): target(x: 50, y: 60, radius: 20, label: "x", screen: nil) click it')
        self.assertEqual(db.tag_points(lines), [('point', 120, 340), ('target', 50, 60)])


class Assertions(unittest.TestCase):
    def check(self, name, want, c):
        return db.ASSERTIONS[name](want, c)

    def test_route(self):
        c = ctx(snippet(SIMPLE_TALK))
        self.assertTrue(self.check('route', 'route=answer', c)[0])
        self.assertFalse(self.check('route', 'route=agent', c)[0])
        self.assertTrue(self.check('route_not', 'route=agent', c)[0])
        self.assertTrue(self.check('route', 'nothing asked', ctx(snippet(NOTHING)))[0])

    def test_no_agent_and_spawn(self):
        clean = ctx(snippet(SIMPLE_TALK))
        self.assertTrue(self.check('no_agent', True, clean)[0])
        self.assertTrue(self.check('expect_would_spawn', False, clean)[0])
        self.assertFalse(self.check('expect_would_spawn', True, clean)[0])
        created = ctx(snippet(SIMPLE_TALK + '\n2026-10-19 02:00:03.000 INFO agent[yeah] created at /tmp/agents/yeah'))
        self.assertFalse(self.check('no_agent', True, created)[0])
        handoff = ctx(snippet(SIMPLE_TALK + '\n2026-10-19 02:00:03.000 INFO agent[notes] handoff: Yeah.'))
        self.assertFalse(self.check('no_agent', True, handoff)[0])
        would = ctx(snippet(SIMPLE_TALK + '\n2026-10-19 02:00:03.000 INFO bench: would spawn agent research'))
        self.assertFalse(self.check('no_agent', True, would)[0])
        self.assertTrue(self.check('expect_would_spawn', True, would)[0])
        self.assertFalse(self.check('expect_would_spawn', False, would)[0])

    def test_no_turn(self):
        self.assertTrue(self.check('no_turn', True, ctx(snippet(NOTHING)))[0])
        self.assertFalse(self.check('no_turn', True, ctx(snippet(SIMPLE_TALK)))[0])

    def test_act_assertions(self):
        c = ctx(snippet(ACTS))
        self.assertTrue(self.check('act', {'verb': 'click', 'target': 'email alerts'}, c)[0])
        self.assertTrue(self.check('act', {'verb': 'click', 'min_count': 4}, c)[0])
        self.assertFalse(self.check('act', {'verb': 'click', 'min_count': 5}, c)[0])
        self.assertFalse(self.check('act', {'verb': 'scroll'}, c)[0])
        self.assertTrue(self.check('act', 'go', c)[0])
        self.assertTrue(self.check('max_acts', 6, c)[0])
        self.assertFalse(self.check('max_acts', 3, c)[0])
        self.assertFalse(self.check('no_act', True, c)[0])
        self.assertFalse(self.check('no_act', ['click'], c)[0])
        self.assertTrue(self.check('no_act', ['scroll', 'key'], c)[0])
        self.assertTrue(self.check('no_act', True, ctx(snippet(SIMPLE_TALK)))[0])
        fail = ctx(db.parse_log('2026-10-19 02:00:00.000 INFO act: open chain stream fail no such app'))
        self.assertTrue(self.check('act', {'verb': 'open', 'ok': False}, fail)[0])
        self.assertTrue(self.check('no_act', ['open'], fail)[0])  # a failed act is not an action that ran

    def test_blocked(self):
        c = ctx(snippet(SIMPLE_TALK + '\n2026-10-19 02:00:03.000 INFO bench: blocked action click front window is not the fixture'))
        self.assertTrue(self.check('blocked', 'click', c)[0])
        self.assertFalse(self.check('no_blocked', True, c)[0])
        self.assertTrue(self.check('no_blocked', True, ctx(snippet(SIMPLE_TALK)))[0])

    def test_server_events(self):
        evs = [{'type': 'click', 'id': 'export', 'text': 'Export', 'trusted': True, 'page': '/form.html'},
               {'type': 'change', 'id': 'email-alerts', 'checked': True},
               {'type': 'scroll', 'scrollY': 3400, 'in_view': ['thermal', 'hydrogen', 'tidal'], 'page': '/long.html'},
               {'type': 'get', 'url': 'http://127.0.0.1:8766/page2.html', 'status': 200}]
        c = ctx([], events_after=evs)
        self.assertTrue(self.check('server_event', {'type': 'click', 'id': '^export$', 'trusted': True}, c)[0])
        self.assertTrue(self.check('server_event', {'type': 'change', 'checked': True}, c)[0])
        self.assertFalse(self.check('server_event', {'type': 'change', 'checked': False}, c)[0])
        self.assertTrue(self.check('server_event', {'type': 'scroll', 'in_view': '^tidal$'}, c)[0])
        self.assertFalse(self.check('server_event', {'type': 'scroll', 'in_view': '^flywheel$'}, c)[0])
        self.assertTrue(self.check('server_event', {'type': 'scroll', 'scrollY': {'gte': 3000}}, c)[0])
        self.assertTrue(self.check('server_event', [{'type': 'get', 'url': r'/page2\.html'}, {'type': 'click'}], c)[0])
        self.assertFalse(self.check('server_event', {'type': 'click', 'max_count': 0}, c)[0])
        self.assertFalse(self.check('server_event', {'type': 'input'}, c)[0])
        self.assertTrue(self.check('no_server_event', {'type': 'input'}, c)[0])
        self.assertFalse(self.check('no_server_event', {'type': 'click'}, c)[0])
        self.assertTrue(self.check('no_server_click_text', ['Submit application', '^Apply$'], c)[0])
        self.assertFalse(self.check('no_server_click_text', 'export', c)[0])
        apply_ = ctx([], events_after=[{'type': 'click', 'text': 'Apply'}])
        self.assertFalse(self.check('no_server_click_text', ['^Apply$'], apply_)[0])
        self.assertTrue(self.check('no_server_click_text', ['^Apply$'], ctx([], events_after=[{'type': 'click', 'text': 'Applied jobs'}]))[0])

    def test_reply(self):
        c = ctx(snippet(SIMPLE_TALK))
        self.assertTrue(self.check('reply_contains', '391', c)[0])
        self.assertFalse(self.check('reply_contains', 'exam', c)[0])
        self.assertTrue(self.check('reply_not_contains', ['exam', 'midterm'], c)[0])
        self.assertFalse(self.check('reply_not_contains', 'times', c)[0])
        self.assertFalse(self.check('reply_contains', 'x', ctx(snippet(NOTHING)))[0])
        beats = ctx(snippet(HANDOFF), reply_scope='all')
        self.assertTrue(self.check('reply_contains', 'write the matrix', beats)[0])
        self.assertFalse(self.check('reply_contains', 'write the matrix', ctx(snippet(HANDOFF)))[0])

    def test_cursor(self):
        self.assertTrue(self.check('cursor_unchanged', True, ctx([]))[0])
        self.assertFalse(self.check('cursor_unchanged', True, ctx([], mouse_after=(40.0, 10.0)))[0])
        self.assertFalse(self.check('cursor_unchanged', True, ctx([], mouse_after=None))[0])

    def test_scroll_delta(self):
        before = [{'type': 'load', 'scrollY': 0, 'page': '/long.html'}, {'type': 'scroll', 'scrollY': 999, 'page': '/other.html'}]
        after = [{'type': 'scroll', 'scrollY': 420, 'page': '/long.html'}, {'type': 'scroll', 'scrollY': 760, 'page': '/long.html'}]
        c = ctx([], events_before=before, events_after=after, page='/long.html')
        self.assertTrue(self.check('scroll_delta_min', 300, c)[0])
        self.assertFalse(self.check('scroll_delta_min', 800, c)[0])
        self.assertTrue(self.check('scroll_delta_max', 1000, c)[0])
        up = ctx([], events_before=[{'type': 'load', 'scrollY': 2000, 'page': '/long.html'}],
                 events_after=[{'type': 'scroll', 'scrollY': 1200, 'page': '/long.html'}], page='/long.html')
        self.assertTrue(self.check('scroll_delta_max', -300, up)[0])
        self.assertFalse(self.check('scroll_delta_min', 300, ctx([], events_before=before, events_after=[], page='/long.html'))[0])

    def test_front_app(self):
        c = ctx([], front_before={'name': 'Safari', 'bundle': 'com.apple.Safari'}, front_after={'name': 'TextEdit', 'bundle': 'com.apple.TextEdit'})
        self.assertTrue(self.check('front_app', 'TextEdit', c)[0])
        self.assertFalse(self.check('front_app', 'Finder', c)[0])
        same = ctx([], front_before={'name': 'TextEdit'}, front_after={'name': 'TextEdit'})
        self.assertFalse(self.check('front_app', 'TextEdit', same)[0])

    def test_log_checks(self):
        c = ctx(snippet(ACTS))
        self.assertTrue(self.check('log_has', [r'act: go', r'route=act'], c)[0])
        self.assertFalse(self.check('log_has', r'turn\[talk\]', c)[0])
        self.assertTrue(self.check('log_lacks', r'agent\[', c)[0])
        self.assertTrue(self.check('log_count', {'pattern': r'^act: click', 'min': 4, 'max': 4}, c)[0])
        self.assertFalse(self.check('log_count', {'pattern': r'^act: click', 'max': 2}, c)[0])

    def test_interrupt_checks(self):
        c = ctx(snippet(INTERRUPT), asks_sent=['explain how a heat pump works, step by step', 'actually, what is 12 times 12?'])
        ok, detail = self.check('interrupt_within_ms', 500, c)
        self.assertTrue(ok, detail)
        self.assertIn('220 ms', detail)
        self.assertFalse(self.check('interrupt_within_ms', 100, c)[0])
        self.assertTrue(self.check('not_reasked', True, c)[0])
        self.assertTrue(self.check('answered_last', True, c)[0])
        reasked = ctx(snippet(INTERRUPT + '\n2026-10-19 02:02:05.000 INFO turn[talk] sent 1 image(s), 3000 chars: explain how a heat pump works, step by step'),
                      asks_sent=c['asks_sent'])
        self.assertFalse(self.check('not_reasked', True, reasked)[0])
        self.assertFalse(self.check('interrupt_within_ms', 500, ctx(snippet(SIMPLE_TALK)))[0])

    def test_point_in_element(self):
        rect = {'x': 300, 'y': 500, 'w': 80, 'h': 32}
        evs = [{'type': 'load', 'rects': {'export': {'x': 0, 'y': 0, 'w': 80, 'h': 32, 'screen': rect}}}]
        line = '2026-10-19 02:00:00.000 INFO turn[talk] done in 900 ms, $0.01, 1 visual beat(s), tags point(x: %d, y: %d, label: "export", screen: nil)'
        inside = ctx(db.parse_log(line % (330, 510)), events_before=evs)
        self.assertTrue(self.check('point_in_element', {'id': 'export'}, inside)[0])
        outside = ctx(db.parse_log(line % (700, 900)), events_before=evs)
        self.assertFalse(self.check('point_in_element', {'id': 'export'}, outside)[0])
        retina = ctx(db.parse_log(line % (660, 1020)), events_before=evs, shot_scale=2.0)
        self.assertTrue(self.check('point_in_element', 'export', retina)[0])
        self.assertFalse(self.check('point_in_element', 'export', ctx(db.parse_log(line % (330, 510))))[0])  # no rect

    def test_new_tab_and_ask_received(self):
        self.assertTrue(self.check('new_tab', True, ctx([], comet_tabs_before=1, comet_tabs_after=2))[0])
        self.assertFalse(self.check('new_tab', True, ctx([], comet_tabs_before=1, comet_tabs_after=1))[0])
        self.assertTrue(self.check('ask_received', True, ctx(snippet(SIMPLE_TALK), asks_sent=['x']))[0])
        live = ctx(db.parse_log('2026-10-19 02:00:00.000 INFO ask: received bench=0 text=hi'), asks_sent=['hi'])
        self.assertFalse(self.check('ask_received', True, live)[0])
        self.assertFalse(self.check('ask_received', True, ctx(snippet(INTERRUPT), asks_sent=['a', 'b', 'c']))[0])

    def test_evaluate_adds_latency_and_flags_unknown_keys(self):
        lines = snippet(SIMPLE_TALK)
        checks = db.evaluate({'route': 'route=answer', 'no_agnet': True}, ctx(lines, asks_sent=['q'], latency_ms=1400, limit_ms=1500))
        by = {c['name']: c for c in checks}
        self.assertTrue(by['route']['ok'])
        self.assertFalse(by['no_agnet']['ok'])
        self.assertTrue(by['latency']['ok'])
        self.assertTrue(by['ask_received']['ok'])
        slow = db.evaluate({}, ctx(lines, asks_sent=['q'], latency_ms=1600, limit_ms=1500))
        self.assertFalse(next(c for c in slow if c['name'] == 'latency')['ok'])
        none = db.evaluate({}, ctx(lines, asks_sent=['q'], latency_ms=None, limit_ms=1500))
        self.assertFalse(next(c for c in none if c['name'] == 'latency')['ok'])
        broken = db.evaluate({'log_count': {'min': 1}}, ctx(lines, asks_sent=['q']))  # missing pattern: a failed check, no crash
        self.assertFalse(next(c for c in broken if c['name'] == 'log_count')['ok'])

    def test_aggregate(self):
        results = [{'group': 'simple', 'latency_ms': v} for v in (1200, 1500, 1700)] + [{'group': 'replay', 'latency_ms': 9000}]
        row = {'id': '22', 'kind': 'regression', 'aggregate': {'group': 'simple', 'baseline_ms': 1600, 'tolerance': 0.10, 'median_target_ms': 1500}}
        r = db.aggregate(row, results)
        self.assertTrue(r['pass'])
        self.assertEqual(r['latency_ms'], 1500)
        self.assertTrue(r['aggregate']['target_met'])
        slow = db.aggregate(row, [{'group': 'simple', 'latency_ms': v} for v in (1800, 1900, 2000)])
        self.assertFalse(slow['pass'])
        self.assertFalse(db.aggregate(row, [])['pass'])


class RequestList(unittest.TestCase):
    def test_row_selection(self):
        toks = ['1-4', '19', '21.3', '22']
        sel = lambda i: db.row_selected(i, toks)
        self.assertTrue(sel('1')); self.assertTrue(sel('4')); self.assertFalse(sel('5'))
        self.assertTrue(sel('19a')); self.assertTrue(sel('19b'))
        self.assertTrue(sel('21.3')); self.assertFalse(sel('21.1'))
        self.assertTrue(sel('22')); self.assertTrue(sel('22.1'))
        self.assertFalse(sel('12')); self.assertTrue(db.row_selected('12', []))
        self.assertTrue(db.row_selected('21.10', ['21']))
        self.assertFalse(db.row_selected('210', ['21']))

    def test_validate(self):
        rows = [{'id': '1', 'kind': 'new', 'ask': 'x', 'flags': ['--comet-port', '9222']},
                {'id': '1', 'kind': 'old', 'ask': ''},
                {'id': '3', 'kind': 'new', 'ask': 'x', 'setup': {'front': 'chrome'}, 'expect': {'nope': 1}},
                {'id': '4', 'kind': 'regression', 'aggregate': {'group': 'g'}}]
        problems = '\n'.join(db.validate_rows(rows))
        self.assertIn('9222', problems)
        self.assertIn('duplicate id', problems)
        self.assertIn('kind must be', problems)
        self.assertIn('no ask', problems)
        self.assertIn('setup.front', problems)
        self.assertIn("unknown expect key 'nope'", problems)
        self.assertNotIn('row 4', problems)

    def test_example_file_is_valid_and_placeholder_only(self):
        args = type('A', (), {'base': 'http://127.0.0.1:8766', 'comet_port': 9471})()
        rows = db.load_rows(FIXTURE / 'requests.example.json', args)
        self.assertEqual(db.validate_rows(rows), [])
        ids = {r['id'] for r in rows}
        for want in [str(i) for i in range(1, 15)] + ['19a', '19b', '20', '22']:
            self.assertIn(want, ids)
        self.assertTrue(any(i.startswith('21.') for i in ids))
        self.assertFalse(any(re.match(r'^1[5-8](\D|$)', i) for i in ids), 'calendar/mail rows stay private')
        text = json.dumps(rows)
        self.assertNotIn('{base}', text)
        self.assertNotIn('9222', text)
        self.assertIn('http://127.0.0.1:8766/form.html', text)

    def test_substitute(self):
        self.assertEqual(db.substitute({'a': ['{base}/x', 'r{2}']}, {'base': 'http://h:1'}), {'a': ['http://h:1/x', 'r{2}']})


class Ports(unittest.TestCase):
    def test_9222_is_refused_everywhere(self):
        with self.assertRaises(db.RefusedPort):
            db.WebSocket('ws://127.0.0.1:9222/devtools/browser/x')
        with self.assertRaises(db.RefusedPort):
            db.CDP(9222)
        with self.assertRaises(db.RefusedPort):
            db.http_json('http://127.0.0.1:9222/json/version')
        with self.assertRaises(db.RefusedPort):
            db.dot_command('/x/Dot', ['--comet-port', '9222'], 'hi', 9471)
        with self.assertRaises(db.RefusedPort):
            db.dot_command('/x/Dot', [], 'hi', 9222)
        with self.assertRaises(db.BenchError):
            db.WebSocket('ws://192.0.2.1:9471/devtools/browser/x')

    def test_dot_command(self):
        self.assertEqual(db.dot_command('/x/Dot', ['--spoken'], 'Yeah.', 9471),
                         ['/x/Dot', '--ask', '--bench', '--spoken', '--comet-port', '9471', 'Yeah.'])
        self.assertEqual(db.dot_command('/x/Dot', ['--comet-port', '9472'], 'hi', 9471),
                         ['/x/Dot', '--ask', '--bench', '--comet-port', '9472', 'hi'])

    def test_dot_supports_bench(self):
        with tempfile.TemporaryDirectory() as d:
            old, new = Path(d) / 'old', Path(d) / 'new'
            old.write_bytes(b'\x00usage: Dot --ask [--quiet] [--drive] [--dry] <question>\x00')
            new.write_bytes(b'\x00ask: received bench=\x00')
            self.assertFalse(db.dot_supports_bench(old))
            self.assertTrue(db.dot_supports_bench(new))
            self.assertFalse(db.dot_supports_bench(Path(d) / 'missing'))


class FakeWSServer(threading.Thread):
    """Accepts one client, completes the handshake, then runs `script(conn)`."""

    def __init__(self, script):
        super().__init__(daemon=True)
        self.sock = socket.socket()
        self.sock.bind(('127.0.0.1', 0))
        self.sock.listen(1)
        self.port = self.sock.getsockname()[1]
        self.script = script
        self.received = []
        self.error = None

    def run(self):
        try:
            conn, _ = self.sock.accept()
            req = b''
            while b'\r\n\r\n' not in req:
                req += conn.recv(4096)
            key = re.search(rb'Sec-WebSocket-Key: (\S+)', req).group(1).decode()
            conn.sendall(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                          'Sec-WebSocket-Accept: %s\r\n\r\n' % db.ws_accept(key)).encode())
            self.script(self, conn)
            conn.close()
        except Exception as e:  # surfaced by the test
            self.error = e
        finally:
            self.sock.close()

    def read_frame(self, conn):
        buf = bytearray()
        while True:
            got = db.decode_frame(buf)
            if got:
                return got, bytes(buf[:2])
            buf += conn.recv(65536)


class WebSocketFraming(unittest.TestCase):
    def test_roundtrip_sizes(self):
        for n in (0, 5, 125, 126, 300, 65535, 70000):
            payload = os.urandom(n)
            for mask in (True, False):
                frame = db.encode_frame(0x1, payload, mask=mask)
                fin, op, data, used = db.decode_frame(bytearray(frame))
                self.assertEqual((fin, op, data, used), (True, 0x1, payload, len(frame)))
                self.assertIsNone(db.decode_frame(bytearray(frame[:-1])) if len(frame) > 2 else None)

    def test_known_masked_frame(self):
        # RFC 6455 section 5.7: a masked "Hello".
        frame = bytes([0x81, 0x85, 0x37, 0xfa, 0x21, 0x3d, 0x7f, 0x9f, 0x4d, 0x51, 0x58])
        self.assertEqual(db.decode_frame(bytearray(frame))[2], b'Hello')
        self.assertEqual(db.encode_frame(0x1, b'Hello', mask_key=bytes([0x37, 0xfa, 0x21, 0x3d])), frame)

    def test_client_against_fake_server(self):
        def script(srv, conn):
            (fin, op, data, _), head = srv.read_frame(conn)
            srv.received.append((op, data, bool(head[1] & 0x80)))
            conn.sendall(db.encode_frame(0x1, b'hel', mask=False, fin=False))
            conn.sendall(db.encode_frame(0x9, b'p1', mask=False))          # ping between fragments
            conn.sendall(db.encode_frame(0x0, b'lo', mask=False, fin=True))
            (fin, op, data, _), _ = srv.read_frame(conn)                     # the pong
            srv.received.append((op, data, True))
            big = json.dumps({'id': 1, 'result': {'pad': 'x' * 70000}}).encode()
            conn.sendall(db.encode_frame(0x1, big, mask=False))
            conn.sendall(db.encode_frame(0x8, struct.pack('!H', 1000), mask=False))
            srv.read_frame(conn)                                             # the close echo
        srv = FakeWSServer(script)
        srv.start()
        ws = db.WebSocket('ws://127.0.0.1:%d/devtools/browser/test' % srv.port, timeout=5)
        ws.send_text('{"id":1}')
        self.assertEqual(ws.recv_text(5), 'hello')
        self.assertEqual(len(json.loads(ws.recv_text(5))['result']['pad']), 70000)
        with self.assertRaises(db.WebSocketClosed):
            ws.recv_text(5)
        ws.close()
        srv.join(5)
        self.assertIsNone(srv.error)
        self.assertEqual(srv.received[0], (0x1, b'{"id":1}', True))   # client frames are masked
        self.assertEqual(srv.received[1][:2], (0xA, b'p1'))           # ping answered with the same payload


class Ledger(unittest.TestCase):
    def test_sum_and_discovery(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'ledger.sqlite'
            con = sqlite3.connect(p)
            con.execute('CREATE TABLE turns(id INTEGER PRIMARY KEY, ts REAL, kind TEXT, model TEXT, cost_usd REAL NOT NULL DEFAULT 0)')
            con.executemany('INSERT INTO turns(ts, kind, model, cost_usd) VALUES (?,?,?,?)', [(1, 'talk', 'm', 0.25), (2, 'think', 'm', 0.5)])
            con.commit(); con.close()
            self.assertAlmostEqual(db.ledger_total(p), 0.75)
            q = Path(d) / 'other.sqlite'
            con = sqlite3.connect(q)
            con.execute('CREATE TABLE spend(id INTEGER PRIMARY KEY, total_cost REAL)')
            con.execute('INSERT INTO spend(total_cost) VALUES (1.5)')
            con.commit(); con.close()
            self.assertAlmostEqual(db.ledger_total(q), 1.5)
            self.assertIsNone(db.ledger_total(Path(d) / 'missing.sqlite'))

    def test_markdown(self):
        md = db.markdown({'stamp': 's', 'requests': 'r', 'base': 'b', 'spend_delta': 0.12},
                         [{'id': '4', 'kind': 'new', 'pass': True, 'latency_ms': 210, 'reasons': []},
                          {'id': '7', 'kind': 'new', 'pass': False, 'latency_ms': None, 'reasons': ['act: no act click | ok']}])
        self.assertIn('| row | kind | result | latency | reason |', md)
        self.assertIn('| 4 | new | pass | 210 ms |  |', md)
        self.assertIn('| 7 | new | FAIL | - | act: no act click / ok |', md)


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


class BenchServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.log = Path(cls.tmp.name) / 'events.jsonl'
        cls.port = free_port()
        cls.proc = subprocess.Popen([sys.executable, str(HERE / 'bench-server.py'), '--port', str(cls.port), '--log', str(cls.log), '--reset', '--quiet'],
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        cls.base = 'http://127.0.0.1:%d' % cls.port
        for _ in range(50):
            if db.server_up(cls.base):
                break
            time.sleep(0.1)

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(5)
        cls.proc.stdout.close()
        cls.tmp.cleanup()

    def test_get_post_and_since(self):
        t0 = time.time() - 0.01
        with urllib.request.urlopen(self.base + '/form.html', timeout=3) as r:
            self.assertEqual(r.status, 200)
            self.assertEqual(r.headers['Cache-Control'], 'no-store')
            self.assertIn(b'Submit application', r.read())
        req = urllib.request.Request(self.base + '/event', data=json.dumps({'type': 'click', 'text': 'Export', 'id': 'export'}).encode(),
                                     headers={'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(req, timeout=3) as r:
            self.assertTrue(json.loads(r.read())['ok'])
        evs = db.server_events(self.base, t0)
        gets = [e for e in evs if e['type'] == 'get']
        clicks = [e for e in evs if e['type'] == 'click']
        self.assertTrue(any(e['path'] == '/form.html' and e['status'] == 200 for e in gets))
        self.assertEqual(clicks[-1]['text'], 'Export')
        self.assertEqual(clicks[-1]['kind'], 'event')
        self.assertFalse(any(e.get('path') in ('/events', '/health') for e in evs), '/events and /health are not logged')
        later = db.server_events(self.base, clicks[-1]['ts'])
        self.assertFalse(any(e.get('type') == 'click' for e in later))
        lines = [json.loads(l) for l in self.log.read_text().splitlines()]
        self.assertTrue(all('ts' in l and 'time' in l and 'kind' in l for l in lines))

    def test_bad_post_and_404_are_logged(self):
        t0 = time.time() - 0.01
        req = urllib.request.Request(self.base + '/event', data=b'not json', method='POST')
        with self.assertRaises(urllib.error.HTTPError):
            urllib.request.urlopen(req, timeout=3)
        with self.assertRaises(urllib.error.HTTPError):
            urllib.request.urlopen(self.base + '/missing.html', timeout=3)
        evs = db.server_events(self.base, t0)
        self.assertTrue(any(e['type'] == 'bad_event' for e in evs))
        self.assertTrue(any(e['type'] == 'get' and e['status'] == 404 for e in evs))

    def test_reset_only(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'sub' / 'log.jsonl'
            p.parent.mkdir()
            p.write_text('{"ts": 1}\n')
            subprocess.run([sys.executable, str(HERE / 'bench-server.py'), '--log', str(p), '--reset-only'], check=True, capture_output=True)
            self.assertEqual(p.read_text(), '')


class Fixture(unittest.TestCase):
    PAGES = ['index', 'long', 'page1', 'page2', 'settings', 'notifications', 'email', 'jobs', 'job', 'form']

    def read(self, name):
        return (FIXTURE / (name + '.html')).read_text()

    def test_every_page_has_bench_js_title_and_no_external_urls(self):
        for name in self.PAGES:
            html = self.read(name)
            self.assertIn('<script src="bench.js"></script>', html, name)
            title = re.search(r'<title>([^<]*)</title>', html).group(1)
            self.assertTrue(title.startswith('Dot bench'), (name, title))
            self.assertIsNone(re.search(r'(src|href)="(https?:)?//', html), name)
        self.assertEqual(re.search(r'<title>([^<]*)</title>', self.read('index')).group(1), 'Dot bench')
        js = (FIXTURE / 'bench.js').read_text()
        self.assertNotRegex(js, r'https?://')
        self.assertIn("ENDPOINT = '/event'", js)

    def test_pages_hold_what_the_rows_need(self):
        jobs = self.read('jobs')
        self.assertEqual(len(re.findall(r'<tr data-row=', jobs)), 12)
        self.assertIn('Northwind Bank, Summer Analyst', jobs)
        self.assertRegex(jobs, r'<input type="search" role="searchbox"')
        form = self.read('form')
        for label in ('>Export<', '>Submit application<', '>Apply<', 'for="name">Name<'):
            self.assertIn(label, form)
        self.assertEqual(len(re.findall(r'type="button"', form)), 3)
        self.assertIn('onsubmit="return false"', form)
        self.assertIn('for="email-alerts">Email alerts<', self.read('email'))
        self.assertIn('href="notifications.html"', self.read('settings'))
        self.assertIn('href="email.html"', self.read('notifications'))
        self.assertNotIn('email.html', self.read('settings'))   # three clicks deep, no shortcut
        self.assertIn('href="page2.html"', self.read('page1'))

    def test_tidal_section_sits_near_sixty_percent(self):
        long = self.read('long')
        marks = re.findall(r'data-bench-mark="([a-z]+)"', long)
        self.assertEqual(len(marks), 10)
        self.assertEqual(marks.index('tidal'), 6)  # equal 560 px sections: top of the 7th is about 60% down
        self.assertIn('<h2>Tidal energy storage</h2>', long)
        self.assertIn('slack water', long)



JOB_RUN = '''
2026-10-20 22:00:00.000 INFO ask: received bench=1 typed text=open page one, then page two, then go back
2026-10-20 22:00:00.200 INFO route: job placement=front (front verb)
2026-10-20 22:00:00.210 INFO job[ab12cd] started placement=front warm=1 model=sonnet goal=open page one, then page two, then go back
2026-10-20 22:00:01.900 INFO job[ab12cd] step 1 mcp__dot__click ref e3
2026-10-20 22:00:02.300 INFO act: click e3 ok 400 ms (job ab12cd: clicked Page 1)
2026-10-20 22:00:02.300 INFO job[ab12cd] point(x: 317, y: 134) e3
2026-10-20 22:00:03.100 INFO job[ab12cd] step 2 mcp__dot__click ref e7
2026-10-20 22:00:03.500 INFO act: click e7 ok 369 ms (job ab12cd: clicked Continue to page 2)
2026-10-20 22:00:04.000 INFO job[ab12cd] step 3 mcp__dot__back
2026-10-20 22:00:04.400 INFO act: back  ok 375 ms (job ab12cd: went back)
2026-10-20 22:00:06.000 INFO job[ab12cd] done in 5790 ms, 3 steps, $0.1267
2026-10-20 22:00:06.000 INFO act: go open page one, then page two, then go back ok 5790 ms
'''


class JobRows(unittest.TestCase):
    def ctx(self, lines):
        return {'lines': lines, 'events_before': [], 'events_after': [], 'asks_sent': ['x']}

    def test_job_assertion_and_spend(self):
        lines = snippet(JOB_RUN)
        ok, detail = db.a_job({'placement': 'front', 'end': 'done', 'min_steps': 3}, self.ctx(lines))
        self.assertTrue(ok, detail)
        ok, _ = db.a_job({'placement': 'behind'}, self.ctx(lines))
        self.assertFalse(ok)
        self.assertFalse(db.a_no_job(True, self.ctx(lines))[0])
        self.assertAlmostEqual(db.log_spend(lines), 0.1267)

    def test_a_running_job_keeps_the_row_open(self):
        lines = snippet(JOB_RUN)
        t = db.TurnTracker()
        for l in lines[:6]:
            t.feed(l)
        self.assertTrue(t.busy(now=lines[5].ts + 3))
        self.assertFalse(t.done(lines[5].ts + 10, settle=1.5), 'an act line alone does not end a job row')
        for l in lines[6:]:
            t.feed(l)
        self.assertFalse(t.busy(now=lines[-1].ts + 3))
        self.assertTrue(t.done(lines[-1].ts + 3, settle=1.5))

    def test_paused_job_does_not_hold_the_row(self):
        lines = snippet('''
        2026-10-20 22:00:00.000 INFO ask: received bench=1 typed text=go to settings
        2026-10-20 22:00:00.200 INFO job[zz9] started placement=front warm=1 model=sonnet goal=go to settings
        2026-10-20 22:00:02.000 INFO act: click e2 ok 300 ms (job zz9: clicked Settings)
        2026-10-20 22:00:02.500 INFO job[zz9] paused (he clicked)
        ''')
        t = db.TurnTracker()
        for l in lines:
            t.feed(l)
        self.assertFalse(t.busy(now=lines[-1].ts + 1))

    def test_no_act_after_and_stop_within(self):
        lines = snippet('''
        2026-10-20 22:00:00.000 INFO ask: received bench=1 typed text=go to settings, then notifications
        2026-10-20 22:00:00.200 INFO job[q1] started placement=front warm=1 model=sonnet goal=go
        2026-10-20 22:00:02.000 INFO act: click e2 ok 300 ms (job q1: clicked Settings)
        2026-10-20 22:00:03.000 INFO ask: received bench=1 typed text=stop
        2026-10-20 22:00:03.300 INFO job[q1] stopped (he said stop)
        ''')
        self.assertTrue(db.a_no_act_after(r'job\[.*\] stopped', self.ctx(lines))[0])
        ok, detail = db.a_stop_within_ms(800, self.ctx(lines))
        self.assertTrue(ok, detail)
        self.assertFalse(db.a_stop_within_ms(100, self.ctx(lines))[0])

    def test_dry_run_route_is_terminal(self):
        self.assertTrue(db.is_terminal('dry-run: route job(behind) model=sonnet (result only) for "x"'))
        self.assertTrue(db.is_terminal('job[ab] failed in 900 ms ($0.0100): blocked: no such page'))


if __name__ == '__main__':
    unittest.main()
