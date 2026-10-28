#!/bin/zsh
# Build Dot.app, sign it with a stable identity (so macOS keeps the Microphone,
# Screen Recording and Accessibility grants across rebuilds), install it to
# ~/Applications, and (re)load the login agent. Usage:
#
#   ./build.sh            release build, install, relaunch
#   ./build.sh --debug    debug build
#   ./build.sh --no-launch
#
# Signing identity: $DOT_SIGN_IDENTITY, else the first "Apple Development" identity
# in the keychain, else ad-hoc (TCC grants are then lost on every rebuild).
set -euo pipefail
cd "${0:A:h}"

CONFIG=release
LAUNCH=1
INSTALL=1
for arg in "$@"; do
  case "$arg" in
    --debug) CONFIG=debug ;;
    --no-launch) LAUNCH=0 ;;
    --no-install) INSTALL=0; LAUNCH=0 ;;   # build and sign build/Dot.app only; leave the running app alone
  esac
done

echo "swift build -c $CONFIG"
swift build -c "$CONFIG" 2>&1 | grep -vE '^\s*$' | tail -20

BIN=".build/$CONFIG/Dot"
[[ -x "$BIN" ]] || { echo "no binary at $BIN" >&2; exit 2 }

APP="build/Dot.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/Dot"
cp Resources/Info.plist "$APP/Contents/Info.plist"
[[ -f Resources/AppIcon.icns ]] && cp Resources/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"
cp scripts/dot-tts-kokoro.py "$APP/Contents/Resources/dot-tts-kokoro.py"
cp scripts/dot-atlas-today.py "$APP/Contents/Resources/dot-atlas-today.py"
cp scripts/dot-scout.py "$APP/Contents/Resources/dot-scout.py"
cp scripts/dot-atlas-approve.py "$APP/Contents/Resources/dot-atlas-approve.py"
cp scripts/dot-spotify.sh "$APP/Contents/Resources/dot-spotify.sh" && chmod +x "$APP/Contents/Resources/dot-spotify.sh"
cp scripts/dot-spotify-library.py "$APP/Contents/Resources/dot-spotify-library.py"
cp scripts/dot-spotify-api.py "$APP/Contents/Resources/dot-spotify-api.py"
cp scripts/dot-atlas-thread.py "$APP/Contents/Resources/dot-atlas-thread.py"
cp -R Resources/board "$APP/Contents/Resources/board"
rm -rf "$APP/Contents/Resources/sounds"
cp -R Resources/sounds "$APP/Contents/Resources/sounds"
rm -rf "$APP/Contents/Resources/fonts"
cp -R Resources/fonts "$APP/Contents/Resources/fonts"
rm -rf "$APP/Contents/Resources/jobs"
cp -R Resources/jobs "$APP/Contents/Resources/jobs"
rm -rf "$APP/Contents/Resources/lecture"
cp -R Resources/lecture "$APP/Contents/Resources/lecture"
rm -rf "$APP/Contents/Resources/call"
cp -R Resources/call "$APP/Contents/Resources/call"
# SwiftPM resource bundles (FluidAudio ships none today; copy whatever exists).
for bundle in .build/$CONFIG/*.bundle(N); do
  cp -R "$bundle" "$APP/Contents/Resources/"
done
printf 'APPL????' > "$APP/Contents/PkgInfo"

IDENTITY="${DOT_SIGN_IDENTITY:-}"
if [[ -z "$IDENTITY" ]]; then
  IDENTITY=$(security find-identity -v -p codesigning 2>/dev/null | grep -oE '"Apple Development: [^"]+"' | head -1 | tr -d '"' || true)
fi
if [[ -n "$IDENTITY" ]]; then
  echo "codesign with: $IDENTITY"
  codesign --force --deep --timestamp=none --sign "$IDENTITY" "$APP"
else
  echo "codesign ad-hoc (set DOT_SIGN_IDENTITY for stable TCC grants)"
  codesign --force --deep --sign - "$APP"
fi
codesign --verify --deep --strict "$APP"
if (( ! INSTALL )); then
  echo "built and signed $APP (not installed)"
  exit 0
fi
# A relaunch ends a class lecture mode is writing or finishing, and it does not come back on its own (2026-10-27: an
# install at 13:17 cut a seminar off two minutes in). The running Dot says so itself (`Dot --jobs`: lecture is true from
# the start of class to the end of the after-class pass, retranscription included), asked through the binary just built
# since an older one may not know the flag. A Dot that says false, or doesn't answer, is checked against its claude
# children too: the note writer and the after-class pass, whose system prompts open with these words. A Dot from before
# f8c9d68 says false all through the after-class pass (review, 10-28). DOT_INSTALL_DURING_LECTURE=1 installs anyway.
lecture_busy() {
  local report
  report=$("$BIN" --jobs --json 2>/dev/null || true)   # exits 1 when busy, 3 when Dot doesn't answer
  [[ "$report" == *'"lecture":true'* || "$report" == *'"call":true'* ]] && return 0   # call mode: a relaunch loses the call
  # A Dot from before call mode's busy report doesn't say (no "call" in it) and can still be on a call: its log does, a
  # call line in the last 3 hours that the after-call pass hasn't closed.
  if [[ "$report" != *'"call":'* ]]; then
    local last
    last=$(grep -E "^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9:.]+ [A-Z]+ call: (on with|ended|after:)" "${DOT_LOG:-$HOME/Library/Logs/Dot/dot.log}" 2>/dev/null | tail -1)
    [[ -n "$last" && "$last" != *"call: after:"* && "${last[1,19]}" > "$(date -v-3H '+%Y-%m-%d %H:%M:%S')" ]] && return 0
  fi
  pgrep -f "You take a student's class notes for him, live|Class is over. During it, Dot wrote these notes live" >/dev/null
}
if [[ -z "${DOT_INSTALL_DURING_LECTURE:-}" ]] && lecture_busy; then
  echo "lecture or call mode is on now: built and signed $APP, not installed (a relaunch would end the class or the call)" >&2
  echo "install after class, or set DOT_INSTALL_DURING_LECTURE=1 to end it" >&2
  exit 3
fi

mkdir -p ~/Applications
INSTALLED=~/Applications/Dot.app
if pgrep -xq Dot; then
  echo "stopping running Dot"
  osascript -e 'tell application id "com.roshan.dot" to quit' 2>/dev/null || pkill -x Dot || true
  sleep 1
fi
rm -rf "$INSTALLED"
cp -R "$APP" "$INSTALLED"
mkdir -p ~/.local/bin
ln -sf "$INSTALLED/Contents/MacOS/Dot" ~/.local/bin/dotctl
# The agent host's LaunchAgent (AG-12), before Dot starts so its agents find it. A host with live agents
# is left running; it is restarted on the new binary only when it runs none.
scripts/install-host.sh || echo "host: install failed; run scripts/install-host.sh to see why (agents run inside Dot meanwhile)" >&2

PLIST=~/Library/LaunchAgents/com.roshan.dot.plist
sed "s|__HOME__|$HOME|g" com.roshan.dot.plist > "$PLIST"
launchctl bootout "gui/$(id -u)/com.roshan.dot" 2>/dev/null || true
if (( LAUNCH )); then
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "installed $INSTALLED and started it (launchd com.roshan.dot)"
else
  echo "installed $INSTALLED (not started)"
fi
# The morning scout's LaunchAgent (06:30, runs the bundled dot-scout.py; never on load).
scripts/install-scout.sh || echo "scout: install failed; run scripts/install-scout.sh to see why" >&2
