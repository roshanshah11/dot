#!/bin/zsh
# Set up Dot's local neural voice: Kokoro-82M on Apple silicon through mlx-audio, in its
# own venv under ~/Dot/tts so nothing touches the system Python. About 1.2 GB on disk
# (mlx, spaCy, the model). Dot picks it up automatically (ttsProvider "auto").
set -euo pipefail
DIR=~/Dot/tts
mkdir -p "$DIR"
cd "$DIR"

if ! command -v uv >/dev/null; then
  echo "uv is required: brew install uv" >&2
  exit 2
fi
PYTHON=${DOT_TTS_PYTHON:-$(command -v python3.13 || command -v python3)}
[[ -d venv ]] || uv venv -q --python "$PYTHON" venv
VENV_PY="$DIR/venv/bin/python"

echo "installing mlx-audio, misaki (Kokoro's phonemizer) and soundfile..."
uv pip install -q --python "$VENV_PY" mlx-audio soundfile 'misaki[en]'

# misaki's English G2P needs spaCy's small English model. spaCy would try to install it
# itself through uv at first use and fail inside a bare venv, so install it here.
SPACY=$("$VENV_PY" -c 'import spacy; v=spacy.__version__.split("."); print(v[0]+"."+v[1])')
uv pip install -q --python "$VENV_PY" \
  "https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-${SPACY}.0/en_core_web_sm-${SPACY}.0-py3-none-any.whl"

echo "downloading the Kokoro model (about 330 MB) and checking one sentence..."
SCRIPT="${0:A:h}/dot-tts-kokoro.py"
[[ -f "$SCRIPT" ]] || SCRIPT=~/Applications/Dot.app/Contents/Resources/dot-tts-kokoro.py
cp "$SCRIPT" "$DIR/dot-tts-kokoro.py"
printf '%s\n' '{"text": "hi, this is dot."}' | "$VENV_PY" "$DIR/dot-tts-kokoro.py" 2>/dev/null | grep -E '"(ready|wav|error)"' | tail -2
echo "done. Restart Dot (launchctl kickstart -k gui/\$(id -u)/com.roshan.dot) and it will speak with Kokoro."
