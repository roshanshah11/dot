#!/usr/bin/env python3
"""Dot's text-to-speech worker for Kokoro-82M on Apple silicon (mlx-audio).

Protocol, one JSON object per line on stdin and stdout:
    -> {"text": "a sentence to speak"}
    <- {"wav": "/path/to/file.wav", "ms": 412}      or   {"error": "..."}
On startup the worker prints {"ready": true, "engine": "kokoro", "voice": "af_heart"}.

Install with scripts/install-tts.sh (a venv under ~/Dot/tts with mlx-audio, misaki[en] and
spaCy's en_core_web_sm). The model (mlx-community/Kokoro-82M-bf16, about 330 MB) downloads
on first run. Voices: af_heart (default, warm and even), af_bella, af_nicole, am_michael,
am_adam, bf_emma, bm_george.
"""
import argparse
import json
import os
import sys
import tempfile
import time

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
# spaCy (misaki's tokenizer) installs its model through uv on first use and needs to know
# which environment it is in; pointing it at ours keeps that from failing silently.
os.environ.setdefault("VIRTUAL_ENV", sys.prefix)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="mlx-community/Kokoro-82M-bf16")
    parser.add_argument("--voice", default="af_heart")
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--lang", default="a", help="Kokoro lang code: a = American English, b = British")
    args = parser.parse_args()

    try:
        import mlx.core as mx
        from mlx_audio.audio_io import write as audio_write
        from mlx_audio.tts.utils import load_model
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": f"mlx-audio import failed: {exc}"}), flush=True)
        return 2

    try:
        model = load_model(args.model)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": f"model load failed: {exc}"}), flush=True)
        return 3

    out_dir = os.path.join(tempfile.gettempdir(), "dot-tts")
    os.makedirs(out_dir, exist_ok=True)

    def synthesize(text: str) -> str:
        pieces = []
        rate = 24000
        for result in model.generate(text=text, voice=args.voice, speed=args.speed, lang_code=args.lang, verbose=False):
            pieces.append(result.audio)
            rate = result.sample_rate
        if not pieces:
            raise RuntimeError("no audio produced")
        audio = pieces[0] if len(pieces) == 1 else mx.concatenate(pieces, axis=0)
        path = os.path.join(out_dir, f"{int(time.time() * 1000)}-{os.getpid()}.wav")
        audio_write(path, audio, rate, format="wav")
        return path

    # Warm the graph once so the first real sentence is not the slow one.
    try:
        warm = synthesize("ready.")
        os.remove(warm)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": f"warm-up failed: {exc}"}), flush=True)
        return 4

    print(json.dumps({"ready": True, "engine": "kokoro", "voice": args.voice, "model": args.model}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            print(json.dumps({"error": "bad json"}), flush=True)
            continue
        text = (request.get("text") or "").strip()
        if not text:
            print(json.dumps({"error": "empty text"}), flush=True)
            continue
        started = time.time()
        try:
            path = synthesize(text)
            print(json.dumps({"wav": path, "ms": int((time.time() - started) * 1000)}), flush=True)
        except Exception as exc:  # noqa: BLE001
            print(json.dumps({"error": str(exc)}), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
