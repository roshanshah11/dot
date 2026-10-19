#!/bin/zsh
# A throwaway Comet for Dot's bench: its own profile, its own DevTools port, its own PID file.
#
#   bench-comet.sh [start] [url]   launch it (visible, a new window on url; default the bench index)
#   bench-comet.sh stop [--wipe]   kill ONLY the PID in the PID file; --wipe also deletes its profile
#   bench-comet.sh status          print the PID, the port and whether DevTools answers
#
# Env: PORT (default 9471; 9222 is refused, it belongs to the everyday Comet), BENCH_URL (default
# http://127.0.0.1:8766/index.html), HEADLESS=1 (no window, for checking this script itself),
# COMET_BIN (default /Applications/Comet.app/Contents/MacOS/Comet), BENCH_DIR (default ~/Dot/selftests/basics).
#
# Never pkill/killall Comet and never quit Comet by name: another Comet may be running with the
# person's tabs. This script only ever signals the PID it started, after checking that PID's command
# line still carries this bench profile.
set -u

PORT=${PORT:-9471}
BENCH_DIR=${BENCH_DIR:-$HOME/Dot/selftests/basics}
PROFILE_ROOT="$BENCH_DIR/comet-profile"
PROFILE="$PROFILE_ROOT/port-$PORT"
PIDFILE="$BENCH_DIR/bench-comet.pid"
LOGFILE="$BENCH_DIR/bench-comet.log"
COMET_BIN=${COMET_BIN:-/Applications/Comet.app/Contents/MacOS/Comet}
URL_DEFAULT=${BENCH_URL:-http://127.0.0.1:8766/index.html}

die() { print -u2 "bench-comet: $*"; exit 1; }

[[ "$PORT" == <-> ]] || die "PORT must be a number (got '$PORT')"
(( PORT == 9222 )) && die "refusing PORT=9222: that is the everyday Comet's DevTools port"
(( PORT < 1024 || PORT > 65535 )) && die "PORT $PORT out of range"

ours() {  # is PID $1 alive and running with this bench profile?
  local pid=$1 cmd
  [[ "$pid" == <-> ]] || return 1
  cmd=$(ps -o command= -p "$pid" 2>/dev/null) || return 1
  [[ "$cmd" == *"--user-data-dir=$PROFILE "* || "$cmd" == *"--user-data-dir=$PROFILE" ]]
}

devtools_up() { curl -s -m 1 "http://127.0.0.1:$PORT/json/version" 2>/dev/null | grep -q webSocketDebuggerUrl; }

cmd=${1:-start}
[[ $# -gt 0 ]] && shift

case "$cmd" in
  start)
    url=${1:-$URL_DEFAULT}
    [[ -x "$COMET_BIN" ]] || die "no Comet binary at $COMET_BIN (ls /Applications/Comet.app/Contents/MacOS/)"
    mkdir -p "$PROFILE" || die "cannot create $PROFILE"
    if [[ -f "$PIDFILE" ]] && ours "$(<"$PIDFILE")"; then
      print "bench-comet: already running, pid $(<"$PIDFILE"), port $PORT"
      exit 0
    fi
    if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      die "port $PORT is already in use by another process; pick another PORT"
    fi
    args=(--user-data-dir="$PROFILE" --remote-debugging-port="$PORT" --no-first-run --no-default-browser-check
          --use-mock-keychain)
    if [[ "${HEADLESS:-0}" == 1 ]]; then
      args+=(--headless=new "$url")
    else
      args+=(--new-window "$url")
    fi
    : >> "$LOGFILE"
    print "=== $(date '+%F %T') start port $PORT headless=${HEADLESS:-0} url $url" >> "$LOGFILE"
    nohup "$COMET_BIN" "${args[@]}" >> "$LOGFILE" 2>&1 &
    pid=$!
    print "$pid" > "$PIDFILE"
    for _ in {1..60}; do
      devtools_up && break
      ours "$pid" || die "Comet (pid $pid) exited during startup; see $LOGFILE"
      sleep 0.25
    done
    devtools_up || die "DevTools did not answer on port $PORT within 15 s (pid $pid still running; stop it with: $0 stop)"
    print "bench-comet: pid $pid, DevTools on 127.0.0.1:$PORT, profile $PROFILE"
    ;;
  stop)
    wipe=0
    [[ "${1:-}" == --wipe ]] && wipe=1
    if [[ -f "$PIDFILE" ]]; then
      pid=$(<"$PIDFILE")
      if ours "$pid"; then
        kill -TERM "$pid" 2>/dev/null
        for _ in {1..40}; do ours "$pid" || break; sleep 0.25; done
        if ours "$pid"; then
          kill -KILL "$pid" 2>/dev/null
          sleep 0.5
        fi
        ours "$pid" && die "pid $pid did not exit"
        print "bench-comet: stopped pid $pid"
      else
        print "bench-comet: pid ${pid:-?} in $PIDFILE is not running with $PROFILE; nothing killed"
      fi
      rm -f "$PIDFILE"
    else
      print "bench-comet: no PID file ($PIDFILE); nothing killed"
    fi
    # Helpers normally exit with their browser. Report (never kill) anything still holding this profile.
    left=$(ps -axo pid=,command= | grep -F -- "$PROFILE" | grep -v grep | awk '{print $1}' | tr '\n' ' ')
    [[ -n "${left// /}" ]] && print "bench-comet: still running with this profile (not killed): $left"
    if (( wipe )); then
      [[ "$PROFILE" == "$PROFILE_ROOT"/port-* ]] || die "refusing to delete $PROFILE"
      rm -rf -- "$PROFILE" && print "bench-comet: deleted $PROFILE"
      rmdir "$PROFILE_ROOT" 2>/dev/null
    fi
    ;;
  status)
    if [[ -f "$PIDFILE" ]] && ours "$(<"$PIDFILE")"; then
      print -n "bench-comet: running, pid $(<"$PIDFILE"), port $PORT, DevTools "
      devtools_up && print "up" || print "not answering"
    else
      print "bench-comet: not running"
      exit 1
    fi
    ;;
  *)
    die "usage: bench-comet.sh [start [url]] | stop [--wipe] | status"
    ;;
esac
