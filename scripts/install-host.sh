#!/bin/zsh
# Install Dot's agent host as a LaunchAgent: `Dot --host` from ~/Applications/Dot.app, always running
# (RunAtLoad, KeepAlive). It owns the agents' claude processes, so they keep going across a Dot quit or
# relaunch (AG-12). Idempotent. A reinstall restarts the host only when it runs no live agent: a running
# agent is never killed by a rebuild (the old host keeps going, and the next reinstall with none live
# swaps it). Usage:
#
#   scripts/install-host.sh            write ~/Library/LaunchAgents/com.roshan.dot-host.plist and (re)load it
#   scripts/install-host.sh --print    print the plist only; touches nothing
#   scripts/install-host.sh --remove   unload it (agents it runs end with it) and delete the plist
#
# The binary: $DOT_HOST_BINARY, else the one inside ~/Applications/Dot.app.
set -euo pipefail

LABEL=com.roshan.dot-host
PLIST=~/Library/LaunchAgents/$LABEL.plist
LOGS=~/Library/Logs/Dot
BIN=${DOT_HOST_BINARY:-$HOME/Applications/Dot.app/Contents/MacOS/Dot}

plist() {
  cat <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$LABEL</string>
	<key>ProgramArguments</key>
	<array>
		<string>$BIN</string>
		<string>--host</string>
	</array>
	<key>AssociatedBundleIdentifiers</key>
	<string>com.roshan.dot</string>
	<key>RunAtLoad</key>
	<true/>
	<key>KeepAlive</key>
	<true/>
	<key>ProcessType</key>
	<string>Standard</string>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>$HOME/.local/bin:$HOME/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
	</dict>
	<key>StandardOutPath</key>
	<string>$LOGS/host.out.log</string>
	<key>StandardErrorPath</key>
	<string>$LOGS/host.err.log</string>
</dict>
</plist>
PLIST
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

[[ -x "$BIN" ]] || { echo "host: no binary at $BIN" >&2; exit 2 }
mkdir -p "$LOGS" ~/Library/LaunchAgents ~/Dot
NEW=$(plist)
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  # The running host says what it runs ("not running" counts as none); any protocol version answers list.
  LIVE=$("$BIN" --host list 2>/dev/null | sed -n 's/^host: protocol [0-9]*, \([0-9]*\) live$/\1/p' || true)
  if [[ -n "$LIVE" && "$LIVE" != 0 ]]; then
    [[ -f "$PLIST" && "$(cat "$PLIST")" == "$NEW" ]] || print -r -- "$NEW" > "$PLIST"
    echo "host: $LIVE live agent(s); the running host stays (it restarts at a reinstall with none live)"
    exit 0
  fi
fi
print -r -- "$NEW" > "$PLIST"
plutil -lint "$PLIST" >/dev/null
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "host: installed $LABEL ($BIN --host)"
