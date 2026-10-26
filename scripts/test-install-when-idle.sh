#!/bin/zsh
# Tests for scripts/install-when-idle --check against stub control and host sockets (no real Dot, nothing installed).
# Usage: scripts/test-install-when-idle.sh   (needs .build/debug/Dot: swift build first)
set -u
cd "${0:A:h}/.."
BIN=.build/debug/Dot
[[ -x $BIN ]] || { echo "no $BIN; run swift build"; exit 2 }
TMP=$(mktemp -d /tmp/dot-idle-test.XXXX)
fails=0

stub() {  # stub <socket> <reply-json>: answers every line with the reply, in the background
  /usr/bin/python3 -I - "$1" "$2" <<'PY' &
import os, socket, sys
path, reply = sys.argv[1], sys.argv[2]
if os.path.exists(path): os.unlink(path)
s = socket.socket(socket.AF_UNIX); s.bind(path); s.listen(8)
while True:
    c, _ = s.accept(); f = c.makefile("rb")
    if f.readline(): c.sendall(reply.encode() + b"\n")
    c.close()
PY
  STUBS+=($!)
  for _ in {1..50}; do [[ -S $1 ]] && return; sleep 0.05; done
}

run_case() {  # run_case <name> <control reply or ""> <host reply> <expected exit>
  STUBS=()
  local ctl="$TMP/$1.ctl" hst="$TMP/$1.host"
  [[ -n $2 ]] && stub "$ctl" "$2"
  stub "$hst" "$3"
  DOT_BIN=$BIN DOT_CONTROL_SOCKET="$ctl" DOT_HOST_SOCKET="$hst" DOT_LOG="$TMP/empty.log" scripts/install-when-idle --check > "$TMP/$1.out" 2>&1
  local code=$?
  kill $STUBS 2>/dev/null
  if [[ $code == $4 ]]; then echo "ok   $1 (exit $code)"; else echo "FAIL $1: exit $code, wanted $4"; sed 's/^/     /' "$TMP/$1.out"; fails=$((fails+1)); fi
}

: > "$TMP/empty.log"
NOHOST='{"v":1,"processes":[]}'
IDLE='{"v":1,"idle":true,"reasons":[],"queued":0,"workingAgents":[],"cardsWaiting":0,"lecture":false,"jobs":[]}'
BUSYJOB='{"v":1,"idle":false,"reasons":["job ab12cd running: x"],"queued":0,"workingAgents":[],"cardsWaiting":0,"lecture":false,"jobs":[{"id":"ab12cd","phase":"running","goal":"x","waitingOnHim":false}]}'
LECTURE='{"v":1,"idle":false,"reasons":[],"queued":0,"workingAgents":[],"cardsWaiting":0,"lecture":true,"jobs":[]}'
OLD='{"error":"unknown verb jobs"}'
LIVEHOST='{"v":1,"processes":[{"id":"agent-email","pid":123,"alive":true,"lastSeq":4,"pending":[],"attached":true}]}'

run_case idle "$IDLE" "$NOHOST" 0
run_case running-job "$BUSYJOB" "$NOHOST" 1
run_case lecture "$LECTURE" "$NOHOST" 1
run_case live-hosted-agent "$IDLE" "$LIVEHOST" 1
run_case old-dot-empty-log "$OLD" "$NOHOST" 0
print -r -- "$(date '+%Y-%m-%d %H:%M:%S').000 INFO job[zz99yy] started placement=behind warm=1 model=sonnet goal=x" > "$TMP/open.log"
STUBS=(); stub "$TMP/o.ctl" "$OLD"; stub "$TMP/o.host" "$NOHOST"
DOT_BIN=$BIN DOT_CONTROL_SOCKET="$TMP/o.ctl" DOT_HOST_SOCKET="$TMP/o.host" DOT_LOG="$TMP/open.log" scripts/install-when-idle --check > "$TMP/o.out" 2>&1
code=$?; kill $STUBS 2>/dev/null
if [[ $code == 1 ]]; then echo "ok   old-dot-open-job-in-log (exit 1)"; else echo "FAIL old-dot-open-job-in-log: exit $code"; cat "$TMP/o.out"; fails=$((fails+1)); fi

log_case() {  # log_case <name> <log line> <expected exit>: an older Dot (no jobs verb), so the log decides
  print -r -- "$2" > "$TMP/$1.log"
  STUBS=(); stub "$TMP/$1.ctl" "$OLD"; stub "$TMP/$1.host" "$NOHOST"
  DOT_BIN=$BIN DOT_CONTROL_SOCKET="$TMP/$1.ctl" DOT_HOST_SOCKET="$TMP/$1.host" DOT_LOG="$TMP/$1.log" scripts/install-when-idle --check > "$TMP/$1.out" 2>&1
  local code=$?; kill $STUBS 2>/dev/null
  if [[ $code == $3 ]]; then echo "ok   $1 (exit $code)"; else echo "FAIL $1: exit $code, wanted $3"; sed 's/^/     /' "$TMP/$1.out"; fails=$((fails+1)); fi
}
NOW=$(date '+%Y-%m-%d %H:%M:%S')
log_case message-text-says-lectures "$NOW.000 INFO atlas thread: 6 atlas turns; newest terminal: i finished the lectures" 0
log_case lecture-still-on "2026-10-25 09:00:00.000 INFO lecture: mode on for BIOS 11140, class" 1
log_case spare-is-not-a-job "$NOW.000 INFO job: spare ready in 15 ms" 0
log_case spare-warming-is-not-a-job "$NOW.000 INFO job: spare warming
$NOW.001 INFO session[job:kfzwy3] started pid 40526 model sonnet cwd /tmp/kfzwy3
$NOW.002 INFO job[kfzwy3] bash on (atlas permissions)
$NOW.003 INFO job: spare ready in 11 ms" 0
log_case claimed-spare-is-a-job "$NOW.000 INFO job: spare warming
$NOW.001 INFO session[job:kfzwy3] started pid 40526 model sonnet cwd /tmp/kfzwy3
$NOW.002 INFO job[kfzwy3] bash on (atlas permissions)
$NOW.004 INFO job[kfzwy3] started: book the room" 1

rm -rf "$TMP"
(( fails == 0 )) && echo "all cases passed" || { echo "$fails failed"; exit 1 }
