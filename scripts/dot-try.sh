#!/bin/zsh
# Ask the running Dot a question and watch what it does: the log lines of that turn (route,
# tools, beats, tags) and screenshots as the beats land. For the testing loop.
#
#   scripts/dot-try.sh [--quiet] [--shots N] [--every S] "question"
#
# Screenshots go to $DOT_TRY_DIR (default /tmp/dot-try) as <stamp>-<n>.png.
set -u
QUIET=""; DRIVE=""; SHOTS=3; EVERY=3
while [[ $# -gt 1 ]]; do
  case "$1" in
    --quiet) QUIET="--quiet"; shift ;;
    --drive) DRIVE="--drive"; shift ;;
    --shots) SHOTS=$2; shift 2 ;;
    --every) EVERY=$2; shift 2 ;;
    *) break ;;
  esac
done
Q="$1"
LOG=~/Library/Logs/Dot/dot.log
DIR=${DOT_TRY_DIR:-/tmp/dot-try}
mkdir -p "$DIR"
STAMP=$(date +%H%M%S)
MARK=$(wc -l < "$LOG")
~/Applications/Dot.app/Contents/MacOS/Dot --ask $QUIET $DRIVE "$Q" >/dev/null
for i in {1..120}; do
  sleep 1
  if tail -n +$((MARK+1)) "$LOG" | grep -qE 'turn\[(talk|think)\] done|jev: follow-up|handoff|turn\[talk\] .*error'; then break; fi
done
# Beats land after the result; give the first ones a moment, then shoot.
for n in $(seq 1 $SHOTS); do
  sleep $EVERY
  screencapture -x "$DIR/$STAMP-$n.png"
done
echo "--- log"
tail -n +$((MARK+1)) "$LOG" | grep -E 'jev\[route|turn\[|beat |talk: tool|walkthrough|drive|agent|error|warn' | sed 's/^[0-9-]* //' | cut -c1-260
echo "--- shots: $DIR/$STAMP-{1..$SHOTS}.png"
