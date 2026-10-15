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
cp -R Resources/board "$APP/Contents/Resources/board"
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

PLIST=~/Library/LaunchAgents/com.roshan.dot.plist
sed "s|__HOME__|$HOME|g" com.roshan.dot.plist > "$PLIST"
launchctl bootout "gui/$(id -u)/com.roshan.dot" 2>/dev/null || true
if (( LAUNCH )); then
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "installed $INSTALLED and started it (launchd com.roshan.dot)"
else
  echo "installed $INSTALLED (not started)"
fi
