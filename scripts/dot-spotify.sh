#!/bin/bash
export HB_INST=spotify
# Dot's Spotify: find a playlist, track, album or artist by name on open.spotify.com in a logged-out headless browser
# (Spotify's AppleScript has no search), then play its URI through Spotify's own AppleScript.
#
#   dot-spotify.sh warm                         start the `spotify` headless instance, logged out; prints "warm <port>"
#   dot-spotify.sh find <kind> <words...>       up to 5 lines "spotify:<kind>:<id><TAB><title>"; exit 3 when none
#   dot-spotify.sh play <spotify:kind:id>       play it (DOT_SPOTIFY_DRY=1: print "dry play <uri>" and nothing else)
#   dot-spotify.sh state                        "<state>|<track>|<artist>" or "not running"
#   dot-spotify.sh alive                        "alive", or "dead" (exit 1) when the search instance is down
#
# HB_INST is exported on line 2 and never inherited, so no call here touches hb's default instance (port 9333, a copy
# of his logins that agents use). The instance is a copy of his profile cleared to logged out after every start, so no
# Spotify Connect device of his lives in a headless browser. Machine-readable lines only.
set -u
HB="$HOME/bin/hb"
CH="$HOME/bin/comet-headless"
BASE="${DOT_SPOTIFY_BASE:-https://open.spotify.com}"
CFG="/tmp/ab-hl-spotify.json"

port() { /usr/bin/python3 -c "import json,sys; print(json.load(open('$CFG'))['cdp'])" 2>/dev/null; }
alive() { local p; p=$(port) || return 1; [ -n "$p" ] && curl -s --max-time 2 "http://127.0.0.1:$p/json/version" >/dev/null 2>&1; }

warm() {
  "$CH" start >/dev/null 2>&1 || { echo "warm-failed start"; return 1; }
  local p; p=$(port)
  [ -n "$p" ] || { echo "warm-failed no-port"; return 1; }
  curl -s --max-time 3 "http://127.0.0.1:$p/json/version" >/dev/null 2>&1 || { echo "warm-failed dead $p"; return 1; }
  # Logged out on purpose, after every start (the copy carries his cookies).
  "$HB" open "https://open.spotify.com/" >/dev/null 2>&1
  "$HB" cookies clear >/dev/null 2>&1
  "$HB" storage local clear >/dev/null 2>&1
  "$HB" eval '(async()=>{try{const dbs=await indexedDB.databases(); for (const d of dbs) indexedDB.deleteDatabase(d.name);}catch(e){} return 1})()' >/dev/null 2>&1
  "$HB" open "https://open.spotify.com/" >/dev/null 2>&1
  "$HB" wait 1500 >/dev/null 2>&1
  local state
  state=$("$HB" eval 'JSON.stringify({login: !!document.querySelector("[data-testid=login-button]"), user: !!document.querySelector("[data-testid=user-widget-link]")})' 2>/dev/null \
    | /usr/bin/python3 -c 'import json,sys
try:
    d = json.loads(sys.stdin.read().strip()); d = json.loads(d) if isinstance(d, str) else d
    print("user" if d.get("user") else ("login" if d.get("login") else "unknown"))
except Exception:
    print("unknown")')
  case "$state" in
    user) echo "warm-failed signed-in"; return 1 ;;
    login) echo "warm $p" ;;
    *) echo "warm $p unchecked" ;;
  esac
}

urlencode() { /usr/bin/python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(" ".join(sys.argv[1:])))' "$@"; }

cmd="${1:-}"; [ $# -gt 0 ] && shift
case "$cmd" in
  warm)
    warm
    ;;
  alive)
    alive && echo alive || { echo dead; exit 1; }
    ;;
  find)
    kind="${1:-playlist}"; [ $# -gt 0 ] && shift
    case "$kind" in playlist|track|album|artist) ;; *) echo "usage: find <playlist|track|album|artist> <words>"; exit 2 ;; esac
    [ $# -gt 0 ] || { echo "usage: find <kind> <words>"; exit 2; }
    if ! alive; then echo "warming"; warm >/dev/null || { echo "warm-failed"; exit 4; }; fi
    q=$(urlencode "$@")
    # A fresh load every time: in-page navigation between searches gave wrong results twice (G 1d).
    "$HB" open "$BASE/search/$q/${kind}s" >/dev/null 2>&1
    "$HB" wait "a[href*=\"/$kind/\"]" >/dev/null 2>&1
    js="JSON.stringify([...document.querySelectorAll('a[href*=\"/$kind/\"]')].map(a=>[a.getAttribute('href').split('/$kind/')[1].split('?')[0], a.textContent.trim().slice(0,60)]).filter((x,i,r)=>x[0]&&r.findIndex(y=>y[0]===x[0])===i).slice(0,5))"
    out=$("$HB" eval "$js" 2>/dev/null)
    lines=$(/usr/bin/python3 - "$kind" "$out" <<'PY'
import json, re, sys
kind, raw = sys.argv[1], sys.argv[2]
try:
    data = json.loads(raw)
    if isinstance(data, str): data = json.loads(data)
except Exception:
    data = []
seen = set()
for item in data or []:
    if not isinstance(item, list) or len(item) < 1: continue
    i = str(item[0]); title = (str(item[1]) if len(item) > 1 else '').replace('\t', ' ').replace('\n', ' ')
    if not re.fullmatch(r'[A-Za-z0-9]{22}', i) or i in seen: continue
    seen.add(i)
    print(f'spotify:{kind}:{i}\t{title}')
PY
)
    [ -n "$lines" ] || exit 3
    echo "$lines"
    ;;
  play)
    uri="${1:-}"
    [[ "$uri" =~ ^spotify:(playlist|track|album|artist):[A-Za-z0-9]{22}$ ]] || { echo "bad uri"; exit 2; }
    if [ "${DOT_SPOTIFY_DRY:-0}" = 1 ]; then echo "dry play $uri"; exit 0; fi
    osascript -e "tell application \"Spotify\" to play track \"$uri\"" >/dev/null 2>&1 || { echo "play-failed"; exit 5; }
    "$0" state
    ;;
  play-in)
    track="${1:-}"; ctx="${2:-}"
    [[ "$track" =~ ^spotify:track:[A-Za-z0-9]{22}$ && "$ctx" =~ ^spotify:(playlist|album):[A-Za-z0-9]{22}$ ]] || { echo "bad uri"; exit 2; }
    if [ "${DOT_SPOTIFY_DRY:-0}" = 1 ]; then echo "dry play $track in $ctx"; exit 0; fi
    osascript -e "tell application \"Spotify\" to play track \"$track\" in context \"$ctx\"" >/dev/null 2>&1 || { echo "play-failed"; exit 5; }
    "$0" state
    ;;
  first-track)
    pl="${1:-}"
    [[ "$pl" =~ ^spotify:playlist:([A-Za-z0-9]{22})$ ]] || { echo "bad uri"; exit 2; }
    id="${BASH_REMATCH[1]}"
    alive || warm >/dev/null || exit 4
    "$HB" open "$BASE/playlist/$id" >/dev/null 2>&1
    "$HB" wait 'a[href*="/track/"]' >/dev/null 2>&1
    t=$("$HB" eval '(document.querySelector("a[href*=\"/track/\"]")||{}).getAttribute ? document.querySelector("a[href*=\"/track/\"]").getAttribute("href").split("/track/")[1].split("?")[0] : ""' 2>/dev/null | tr -d '"')
    [[ "$t" =~ ^[A-Za-z0-9]{22}$ ]] || exit 3
    echo "spotify:track:$t"
    ;;
  state)
    osascript -e 'if application "Spotify" is running then
  tell application "Spotify" to return (player state as text) & "|" & (name of current track) & "|" & (artist of current track)
else
  return "not running"
end if' 2>/dev/null || echo "not running"
    ;;
  *)
    echo "usage: dot-spotify.sh warm | find <kind> <words> | play <uri> | play-in <track> <context> | first-track <playlist uri> | state"
    exit 2
    ;;
esac
