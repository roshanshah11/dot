# Dot bench

A local fixture site plus three scripts that check what Dot does with its hands, without touching
anything real. Dot runs each ask in bench mode (`Dot --ask --bench`), the fixture pages report every
click, keystroke, scroll and page load to a local server, and the runner compares Dot's log and the
server's log against what each row expects.

Everything here is placeholder content (Sam Rivera, Northwind Bank, example.com). Rows built from real
calendars, mail or people belong in a private request list outside the repo, never in this folder.

| Piece | What it does |
|---|---|
| `Tests/Fixtures/bench/*.html`, `bench.js`, `bench.css` | the fixture site; every page includes `bench.js` |
| `scripts/bench-server.py` | serves the site on 127.0.0.1 and logs every GET and every page event as JSON lines |
| `scripts/bench-comet.sh` | starts and stops a throwaway Comet with its own profile and DevTools port |
| `scripts/dot-bench.py` | the runner: setup, one ask at a time, wait, check, write results |
| `scripts/test_dot_bench.py` | unit tests for the runner, the server and the fixture (`python3 scripts/test_dot_bench.py`) |
| `requests.example.json` | placeholder rows for gate rows 1-14 and 19-22 |

## The fixture site

Every page title starts with `Dot bench` (the index is exactly `Dot bench`), so bench mode can recognise
a fixture window by its title. No page fetches anything from outside 127.0.0.1, and no button leaves the
site.

| Page | Holds |
|---|---|
| `index.html` | links to every page |
| `long.html` | "Grid storage, a field guide": ten sections, each at least 560 px tall (about six screens) |
| `page1.html` -> `page2.html` | a pair of pages for back and forward |
| `settings.html` -> `notifications.html` -> `email.html` | the "Email alerts" switch, three clicks deep from Settings |
| `jobs.html` | "Applied jobs": 12 placeholder rows including "Northwind Bank, Summer Analyst"; a search box (`input type=search role=searchbox`, id `job-q`) that filters as you type and on Enter |
| `job.html?id=N` | the page a row opens (a GET of it means a row was opened) |
| `form.html` | "Name" field (id `name`), Email, Message, and the buttons Export (`export`), Submit application (`submit`), Apply (`apply`); none navigates |

Known depths on `long.html` (section tops as a fraction of the 5936 px page, the same at 800 and 1200 px
wide and 900 px tall, so about 6.6 screens):

| Mark (`data-bench-mark`) | Heading | Depth |
|---|---|---|
| `intro` | Why the grid needs storage | 0.04 |
| `pumped` | Pumped hydro | 0.13 |
| `lithium` | Lithium-ion banks | 0.22 |
| `caverns` | Compressed air caverns | 0.32 |
| `thermal` | Thermal salt tanks | 0.41 |
| `hydrogen` | Hydrogen as a buffer | 0.51 |
| `tidal` | Tidal energy storage (also holds the phrase "slack water") | 0.60 |
| `gravity` | Gravity blocks | 0.70 |
| `flywheel` | Flywheel arrays (also "a spinning steel rotor") | 0.79 |
| `outro` | What to watch next | 0.88 |

Setup query parameters, handled by `bench.js` and stripped from the URL before anything else:
`?go=page2.html` loads the page and then navigates to that page in the same tab (so Safari gets real
history without scripting), and `?scroll=1200` starts the page scrolled.

### Events (`bench.js` -> `POST /event`)

Every event carries `type`, `page` (path), `url`, `title`, `seq` and the page clock `t`; the server adds
`ts` (epoch seconds), `time`, `kind: "event"` and `client`.

| type | extra fields |
|---|---|
| `load` | `nav_type`, `referrer`, `history_length`, `scrollY`, `maxScrollY`, `fraction`, `in_view`, `window`, `rects`, `setup` |
| `pageshow` | only on a back/forward cache restore: `persisted`, `scrollY`, `in_view` |
| `pagehide`, `popstate`, `hashchange`, `visibility` | navigation and tab state |
| `click` | `text`, `role`, `id`, `tag`, `href`, `label`, `trusted` (false for `element.click()`), `x`, `y`, `screen_x`, `screen_y` |
| `input` | `label`, `value`, `id`, `role`, `input_type`, `trusted` |
| `change` | `label`, `id`, `role`, and `checked` (switches) or `value` |
| `focus` | `label`, `id`, `role` of a field |
| `key` | named keys and chords only: `key`, `meta`, `ctrl`, `alt`, `shift`, field `label`/`role`/`id` |
| `search` | Enter in a searchbox: `label`, `value`, `id` |
| `selection` | the selected text (debounced 300 ms) |
| `scroll` | `scrollY`, `maxScrollY`, `fraction`, `in_view` (marks on screen); at most one per 250 ms, first and last always sent |
| `layout` | `rects` and `window` after scrolling settles or a resize (pages with `data-bench-rect` elements) |
| `filter` | jobs.html: `query`, `visible_count`, `visible` (first five rows) |

`rects` maps each `data-bench-rect` id (`export`, `submit`, `apply`, `name`, `search`, `email-alerts`) to
its viewport rectangle plus `screen`, an estimate in screen points (window origin plus the browser's top
chrome; assumes no bottom bar and 100% zoom).

## bench-server.py

    scripts/bench-server.py [--port 8766] [--root Tests/Fixtures/bench]
                            [--log ~/Dot/selftests/basics/server-events.jsonl] [--reset] [--reset-only] [--quiet]

- Listens on 127.0.0.1 only, threaded. Every response is `Cache-Control: no-store`, so each open is a
  logged GET.
- Each log line is one JSON object with `ts`, `time`, `kind` (`get` or `event`) and `type` (`get` for a
  GET, with `path`, `url`, `status`, `referer`). The log's directory is created.
- `GET /events?since=<epoch seconds>[&type=click][&kind=event]` returns the logged lines after that time
  as NDJSON. `GET /health` answers `{"ok": true, ...}`. Neither is logged.
- `--reset` truncates the log and serves; `--reset-only` truncates and exits.
- The default port is 8766 because 8765 is often held by other local tools; pass `--port` to both the
  server and the runner to change it.

## bench-comet.sh

    PORT=9471 scripts/bench-comet.sh [start [url]]   # visible, a new window on url (default the bench index)
    PORT=9471 scripts/bench-comet.sh stop [--wipe]   # kill only the PID it started; --wipe deletes the profile
    PORT=9471 scripts/bench-comet.sh status
    HEADLESS=1 ... start                             # no window (for checking the script itself)

- Runs `/Applications/Comet.app/Contents/MacOS/Comet --user-data-dir=~/Dot/selftests/basics/comet-profile/port-$PORT
  --remote-debugging-port=$PORT --no-first-run --no-default-browser-check --use-mock-keychain --new-window <url>`.
  `--use-mock-keychain` keeps the throwaway profile away from the login keychain.
- Writes the PID to `~/Dot/selftests/basics/bench-comet.pid` and waits up to 15 s for DevTools.
- Refuses `PORT=9222`, the everyday Comet's DevTools port, and refuses a port something else holds.
- `stop` signals only the PID in the PID file, and only after checking that the PID's command line still
  carries this bench profile. It never uses `pkill`, `killall` or a quit by app name, because another
  Comet with real tabs may be running.
- Comet opens a few pages of its own in a fresh profile (a new tab, a sidecar, onboarding). The runner
  leaves those alone and keeps exactly one fixture tab.

## dot-bench.py

    scripts/dot-bench.py [--requests ~/Dot/selftests/basics/requests.json] [--rows 1-14,19,22]
                         [--dry-plan] [--port 8766 | --base http://127.0.0.1:8766] [--comet-port 9471]
                         [--dot ~/Applications/Dot.app/Contents/MacOS/Dot] [--dot-log ~/Library/Logs/Dot/dot.log]
                         [--ledger ~/Dot/ledger.sqlite] [--max-spend 10] [--out-dir ~/Dot/selftests/basics]
                         [--timeout 30] [--settle 3] [--think-timeout 90] [--require-idle 600]
                         [--shot-scale 1.0] [--no-launch] [--keep-comet]

Before the first ask it checks, and stops on any failure:
1. the Dot binary contains the bench strings (`--bench` or `ask: received bench=`). An old Dot would read
   `--bench` as part of the question and run it for real, so nothing is sent to one;
2. Dot is already running (the runner never launches, quits or relaunches Dot);
3. the Mac has been idle (HIDIdleTime) for `--require-idle` seconds; between rows, fresh input stops the run;
4. the bench server answers (started as a child unless `--no-launch`), and a bench Comet is up when a
   row needs one (started with bench-comet.sh, stopped and wiped at the end unless `--keep-comet`).

For each row: setup, record the dot.log position (byte offset and line count), the front app and the mouse
location, run `Dot --ask --bench <flags> --comet-port <port> "<ask>"` (the port is always passed; 9222 is
refused), wait, then check. A row whose setup fails is not asked. The run stops when `ask: received`
says `bench=0`, when two rows in a row get no `ask: received`, or when Dot's spend since the start
(the delta of `SUM(cost_usd)` in the ledger's `turns` table, opened read-only) passes `--max-spend`.

Waiting: a row is done when a completion marker was logged after the latest `ask: received`
(`turn[talk] done`, `turn[think] done`, an `act: ` line, a `bench: ` line or `jev: nothing asked`), no
talk or think turn is still open (a talk turn ending `tags think` waits for the think turn), and the log
has been quiet for `--settle` seconds. No marker in `--timeout` seconds, or a turn still open after
`--think-timeout`, ends the wait and is noted.

Output: a markdown table (row, kind, pass/fail, latency, reason) on stdout and in
`results-<stamp>.md`, and everything (checks, wait notes, relevant log lines, server events, front app,
mouse, per-row cost) in `results-<stamp>.json`, both in `--out-dir`. Exit status 0 when every row passed.

`--dry-plan` prints each row's setup commands, Dot command line and checks, and touches nothing.

### Row schema

```json
{"id": "7", "kind": "new", "ask": "click export", "flags": [],
 "setup": {"front": "safari", "open_url": "{base}/form.html"},
 "expect": {"server_event": {"type": "click", "id": "^export$"}, "cursor_unchanged": true},
 "limit_ms": 2000}
```

- `id` (string; `--rows 21` selects 21.1, 21.2 ...; `--rows 19` selects 19a and 19b; ranges like `1-14`).
- `kind`: `regression` or `new`. `group`: a label for aggregate rows.
- `ask`, `flags` (e.g. `--spoken`, `--shift`, `--comet-port 9471`).
- `then`: more asks in the same row, `[{"ask": "...", "after": "<regex>", "delay_ms": 0, "flags": [...]}]`.
  Without `after`, a step waits for the previous turn to finish; with it, it is sent as soon as a log line
  after the previous `ask: received` matches (e.g. `^beat 1\b`).
- `setup.front`: `safari` (`open -a Safari <url>`, then waits for the page's load event), `bench-comet`
  (DevTools on the bench port only: one fixture tab, `Target.activateTarget`, `Page.bringToFront`, then
  the process is activated by PID), `textedit` (`/tmp/dot-bench/notes.txt`), `finder` (`/tmp/dot-bench`)
  or `none`. `setup.open_url` defaults to the index; `setup.history: [first, second]` builds back history.
- `limit_ms` and `latency_to`: latency is the time from the `ask: received` line to the first
  `act: ... ok`, `turn[talk] first sentence` or `beat ` line, or to the first line matching `latency_to`.
- `aggregate`: `{"group": "simple", "baseline_ms": 1600, "tolerance": 0.10, "median_target_ms": 1500}`
  turns the row into a summary over the group's latencies: it passes when the median is within
  baseline + tolerance, and reports whether the target was met.
- Placeholders in any string: `{base}` (server URL), `{host}` (host:port), `{bench_dir}` (`/tmp/dot-bench`),
  `{comet_port}`.

`expect` checks (regexes are case-insensitive Python regexes):

| key | passes when |
|---|---|
| `route` / `route_not` | a route line (`jev[route]`, `route...`, `jev: ...`, `bench: route...`) matches / none matches |
| `no_agent` | no `agent[<name>] created`, no `agent[<name>] handoff:`, no `bench: would spawn agent` |
| `expect_would_spawn` | true: a `bench: would spawn agent` line; false: none |
| `no_turn` | no `turn[...] sent` line (no model turn) |
| `act` | `{verb, target?, ok: true, min_count: 1}` (or a list of them): matching `act:` lines |
| `no_act` | `true`: no `act: ... ok` at all; a list of verbs: none of those ran |
| `max_acts` | at most N `act:` lines, not counting the `go` summary |
| `blocked` / `no_blocked` | a `bench: blocked action` line matches / there is none |
| `server_event` | each predicate matches at least `min_count` (default 1, optional `max_count`) events after the ask |
| `no_server_event` | no event after the ask matches the predicate(s) |
| `no_server_click_text` | no `click` event whose text matches |
| `reply_contains` / `reply_not_contains` | on the `turn[talk] said:` lines (`"reply_scope": "all"` adds `beat` lines) |
| `cursor_unchanged` | the mouse location (CGEventGetLocation) moved at most 1 point |
| `scroll_delta_min` / `scroll_delta_max` | last `scroll` scrollY after the ask minus the last known before, on the setup page |
| `front_app` | the front app after matches and did not already match before |
| `point_in_element` | `{id, pad}`: a `point(x: ..., y: ...)` or `target(...)` tag, divided by `--shot-scale`, lands in the element's screen rect |
| `new_tab` | the bench Comet has more fixture tabs after than before |
| `log_has` / `log_lacks` / `log_count` | regexes over the row's dot.log lines; `log_count: {pattern, min, max}` |
| `interrupt_within_ms` | `talk: interrupted` within N ms of the second `ask: received` |
| `not_reasked` | the first ask's text is not sent again after the second ask |
| `answered_last` | after the last `ask: received`: a said line, a beat or an `act: ... ok` |
| `ask_received` | (always on) every ask logged `ask: received bench=1` |

Event predicates: string values are regexes (any element of a list field may match), booleans and numbers
compare exactly, and `{"gte": 300}`, `lte`, `gt`, `lt`, `eq`, `re`, `absent` are operators.

## The dot.log line contract

Lines are `YYYY-MM-DD HH:MM:SS.mmm LEVEL message` in local time; a line without that prefix continues the
previous message. Messages the runner reads:

| message | meaning |
|---|---|
| `ask: received bench=<0\|1> text=<ask>` | an `--ask` arrived; latency starts here |
| `act: <verb> <target> ok <ms> ms` | an action ran and was checked; `<target>` may contain spaces or be empty |
| `act: <verb> <target> fail <reason>` | an action failed or was refused |
| `act: go <goal> ok <ms> ms` / `act: go <goal> fail <reason>` | the end of a multi-step "go" or "find" loop (the example rows 10 and 11 time to it) |
| `bench: would spawn agent <name>` | bench mode stopped an agent from starting |
| `bench: blocked action <verb> <reason>` | bench mode refused an action (e.g. the fixture is not in front) |
| `turn[talk] first sentence <ms> ms` | the first sentence of a talk turn is ready |
| `talk: interrupted` | a newer request cut the turn in flight |
| `jev[route] ...` and `route...` | the route decision (a fixed-phrase route may log `route: phrase <verb> ...`) |
| `jev: nothing asked (...)` | the ignore route: no turn |
| `turn[talk\|think] sent ...: <text>` | a model turn started |
| `turn[talk] said: <text>` | what the talk turn said |
| `turn[talk\|think] done in <ms> ms, $<cost>, ..., tags <tags>` | a model turn ended; `tags think` means a think turn follows |
| `beat <n> ...` | a visual beat |
| `agent[<name>] created ...` / `agent[<name>] handoff: ...` | an agent started or was handed work |
