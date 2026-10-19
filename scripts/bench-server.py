#!/usr/bin/env python3
"""Serve Dot's bench fixture site on loopback and log everything that happens on it.

The log is the bench's ground truth: one JSON object per line for every GET of a fixture file and
every event the pages POST to /event (bench.js: load, click, input, change, scroll, navigation...).
scripts/dot-bench.py reads it back through GET /events?since=<epoch seconds>.

    bench-server.py [--port 8766] [--root Tests/Fixtures/bench] [--log ~/Dot/selftests/basics/server-events.jsonl]
                    [--reset] [--reset-only] [--quiet]

Endpoints:
    GET  /<file>                 a fixture file (Cache-Control: no-store, so every open is a logged GET)
    POST /event                  a JSON object from bench.js; logged with the server's timestamp
    GET  /events?since=<ts>      NDJSON of logged lines with ts > since (optional &type=<type>, &kind=get|event)
    GET  /health                 {"ok": true, ...}
/events and /health are not logged themselves (the runner polls them).

Every log line has: ts (epoch seconds, float), time (local ISO with ms), kind ("get" or "event"),
type ("get" for a GET, else the bench.js event type), url, client. Stdlib only.
"""
import argparse, json, os, sys, threading, time
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

HERE = Path(__file__).resolve().parent
DEFAULT_ROOT = HERE.parent / 'Tests' / 'Fixtures' / 'bench'
DEFAULT_LOG = Path.home() / 'Dot' / 'selftests' / 'basics' / 'server-events.jsonl'
# 8765 is the documented first choice, but on the bench Mac it is held by another long-running tool,
# so the default is the next port. Pass --port to change it; dot-bench.py takes the same --port.
DEFAULT_PORT = 8766
MAX_BODY = 256 * 1024


class EventLog:
    def __init__(self, path):
        self.path = Path(path).expanduser()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()

    def reset(self):
        with self.lock:
            self.path.write_text('')

    def append(self, record):
        now = round(time.time(), 3)
        line = {'ts': now, 'time': datetime.fromtimestamp(now).isoformat(timespec='milliseconds')}
        line.update(record)
        line['ts'] = now  # the server's clock wins over anything the page sent
        text = json.dumps(line, ensure_ascii=False, separators=(',', ':'))
        with self.lock:
            with self.path.open('a', encoding='utf-8') as f:
                f.write(text + '\n')
        return line

    def since(self, ts, type_=None, kind=None):
        out = []
        with self.lock:
            if not self.path.exists():
                return out
            with self.path.open(encoding='utf-8') as f:
                for raw in f:
                    raw = raw.strip()
                    if not raw:
                        continue
                    try:
                        rec = json.loads(raw)
                    except ValueError:
                        continue
                    if rec.get('ts', 0) <= ts:
                        continue
                    if type_ and rec.get('type') != type_:
                        continue
                    if kind and rec.get('kind') != kind:
                        continue
                    out.append(raw)
        return out


def make_handler(root, log, quiet):
    class Handler(SimpleHTTPRequestHandler):
        server_version = 'DotBench/1'

        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(root), **kw)

        def log_message(self, fmt, *args):
            if not quiet:
                sys.stderr.write('bench-server: %s %s\n' % (self.address_string(), fmt % args))

        def end_headers(self):
            self.send_header('Cache-Control', 'no-store')
            super().end_headers()

        def _json(self, code, obj, ctype='application/json'):
            body = obj if isinstance(obj, (bytes, bytearray)) else json.dumps(obj).encode()
            self.send_response(code)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _url(self):
            host = self.headers.get('Host') or '%s:%d' % self.server.server_address[:2]
            return 'http://%s%s' % (host, self.path)

        def do_GET(self):
            parts = urlsplit(self.path)
            if parts.path == '/health':
                return self._json(200, {'ok': True, 'pid': os.getpid(), 'root': str(root), 'log': str(log.path), 'ts': time.time()})
            if parts.path == '/events':
                q = parse_qs(parts.query)
                try:
                    since = float(q.get('since', ['0'])[0] or 0)
                except ValueError:
                    return self._json(400, {'error': 'since must be epoch seconds'})
                lines = log.since(since, (q.get('type') or [None])[0], (q.get('kind') or [None])[0])
                body = ('\n'.join(lines) + ('\n' if lines else '')).encode()
                return self._json(200, body, 'application/x-ndjson')
            super().do_GET()

        def send_response(self, code, message=None):
            # Log every fixture GET with its status (send_response runs once per request).
            if self.command in ('GET', 'HEAD') and urlsplit(self.path).path not in ('/health', '/events'):
                log.append({'kind': 'get', 'type': 'get', 'method': self.command, 'path': urlsplit(self.path).path,
                            'url': self._url(), 'status': code, 'client': self.client_address[0],
                            'referer': self.headers.get('Referer', ''), 'ua': self.headers.get('User-Agent', '')[:160]})
            super().send_response(code, message)

        def do_POST(self):
            parts = urlsplit(self.path)
            if parts.path != '/event':
                return self._json(404, {'error': 'POST /event only'})
            try:
                n = int(self.headers.get('Content-Length') or 0)
            except ValueError:
                n = 0
            if n <= 0 or n > MAX_BODY:
                return self._json(413 if n > MAX_BODY else 400, {'error': 'body size'})
            raw = self.rfile.read(n)
            try:
                payload = json.loads(raw.decode('utf-8'))
                if not isinstance(payload, dict):
                    raise ValueError('not an object')
            except (ValueError, UnicodeDecodeError) as e:
                log.append({'kind': 'event', 'type': 'bad_event', 'error': str(e)[:200], 'client': self.client_address[0]})
                return self._json(400, {'error': 'JSON object expected'})
            record = dict(payload)
            record['kind'] = 'event'
            record.setdefault('type', 'unknown')
            record['client'] = self.client_address[0]
            if 'ts' in payload:
                record['client_ts'] = payload['ts']
            line = log.append(record)
            self._json(200, {'ok': True, 'ts': line['ts']})

    return Handler


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--port', type=int, default=DEFAULT_PORT)
    ap.add_argument('--root', default=str(DEFAULT_ROOT))
    ap.add_argument('--log', default=str(DEFAULT_LOG))
    ap.add_argument('--reset', action='store_true', help='truncate the log, then serve')
    ap.add_argument('--reset-only', action='store_true', help='truncate the log and exit')
    ap.add_argument('--quiet', action='store_true', help='no per-request lines on stderr')
    args = ap.parse_args(argv)

    root = Path(args.root).expanduser().resolve()
    if not (root / 'index.html').exists():
        sys.exit('bench-server: no index.html under %s' % root)
    log = EventLog(args.log)
    if args.reset or args.reset_only:
        log.reset()
        print('bench-server: truncated %s' % log.path, flush=True)
        if args.reset_only:
            return 0
    try:
        httpd = ThreadingHTTPServer(('127.0.0.1', args.port), make_handler(root, log, args.quiet))
    except OSError as e:
        sys.exit('bench-server: cannot listen on 127.0.0.1:%d (%s); pass --port' % (args.port, e))
    httpd.daemon_threads = True
    print('bench-server: http://127.0.0.1:%d/ serving %s, logging to %s (pid %d)' % (httpd.server_address[1], root, log.path, os.getpid()), flush=True)
    try:
        httpd.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
