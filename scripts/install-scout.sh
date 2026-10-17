#!/bin/zsh
# Install Dot's morning scout as a LaunchAgent: scripts/dot-scout.py at 06:30 every day, writing
# ~/Dot/briefs/<date>.json for the morning card. Idempotent: the plist is rewritten and the agent
# reloaded only when it changed. It never runs the scout on load (RunAtLoad false); a Mac asleep at
# 06:30 runs it once on waking. Usage:
#
#   scripts/install-scout.sh            write ~/Library/LaunchAgents/com.roshan.dot-scout.plist and load it
#   scripts/install-scout.sh --print    print the plist only; touches nothing
#   scripts/install-scout.sh --remove   unload it and delete the plist
#
# The script it runs: $DOT_SCOUT_SCRIPT, else the copy inside ~/Applications/Dot.app, else this folder's.
set -euo pipefail

LABEL=com.roshan.dot-scout
PLIST=~/Library/LaunchAgents/$LABEL.plist
LOGS=~/Library/Logs/Dot
PYTHON=${DOT_SCOUT_PYTHON:-/opt/homebrew/bin/python3.13}
SCRIPT=${DOT_SCOUT_SCRIPT:-}
if [[ -z "$SCRIPT" ]]; then
  SCRIPT=~/Applications/Dot.app/Contents/Resources/dot-scout.py
  [[ -f "$SCRIPT" ]] || SCRIPT="${0:A:h}/dot-scout.py"
fi

plist() {
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$LABEL</string>
	<key>ProgramArguments</key>
	<array>
		<string>$PYTHON</string>
		<string>$SCRIPT</string>
	</array>
	<key>StartCalendarInterval</key>
	<dict>
		<key>Hour</key>
		<integer>6</integer>
		<key>Minute</key>
		<integer>30</integer>
	</dict>
	<key>RunAtLoad</key>
	<false/>
	<key>ProcessType</key>
	<string>Background</string>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>$HOME/.local/bin:$HOME/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
	</dict>
	<key>StandardOutPath</key>
	<string>$LOGS/scout.out.log</string>
	<key>StandardErrorPath</key>
	<string>$LOGS/scout.err.log</string>
</dict>
</plist>
EOF
}

case "${1:-}" in
  --print)
    plist
    exit 0 ;;
  --remove)
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "removed $LABEL"
    exit 0 ;;
  "") ;;
  *) echo "usage: $0 [--print|--remove]" >&2; exit 2 ;;
esac

[[ -f "$SCRIPT" ]] || { echo "scout: no script at $SCRIPT" >&2; exit 2 }
mkdir -p "$LOGS" ~/Library/LaunchAgents ~/Dot/briefs
NEW=$(plist)
if [[ -f "$PLIST" ]] && [[ "$(cat "$PLIST")" == "$NEW" ]] && launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo "scout: $LABEL already installed and loaded (06:30 daily)"
  exit 0
fi
print -r -- "$NEW" > "$PLIST"
plutil -lint "$PLIST" >/dev/null
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "scout: installed $LABEL (06:30 daily, $SCRIPT)"
