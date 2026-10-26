#!/usr/bin/env python3
"""Builds Dot's ink sounds (parity D6) into Resources/sounds/ink/.

Accents come from Kenney's CC0 packs (kenney.nl: interface-sounds, rpg-audio, impact-sounds), converted to
mono 44.1 kHz 16-bit and levelled quiet. The beds that loop while a stroke draws (felt pen, pencil, handwriting,
highlighter, keys) are Dot's own, made here from seeded noise, so a rebuild makes the same files.

    scripts/make-ink-sounds.py <folder with the unzipped kenney packs>   (needs ffmpeg and numpy)
"""
import subprocess, sys, wave, pathlib
import numpy as np

SR = 44100
OUT = pathlib.Path(__file__).resolve().parent.parent / "Resources" / "sounds" / "ink"

# name -> (pack file, peak dBFS)
ACCENTS = {
    "pop": ("interface/Audio/pluck_002.ogg", -14),        # a name pill pops in
    "stamp": ("impact/Audio/impactGeneric_light_001.ogg", -12),  # a step badge lands
    "tick": ("interface/Audio/tick_004.ogg", -14),        # a check
    "nope": ("interface/Audio/error_004.ogg", -16),       # a cross
    "paper": ("rpg/Audio/bookPlace2.ogg", -13),           # a sticky or a photo lands
    "clear": ("rpg/Audio/bookFlip3.ogg", -14),            # the drawing goes
    "eraser": ("rpg/Audio/cloth2.ogg", -15),              # one mark is erased
    "slide": ("rpg/Audio/cloth4.ogg", -16),               # a mark moves or scales
}


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "quiet", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def trim(x, floor=0.004):
    idx = np.nonzero(np.abs(x) > floor * np.abs(x).max())[0]
    if not len(idx):
        return x
    x = x[max(idx[0] - 64, 0): idx[-1] + 512]
    fade = min(len(x) // 4, 441)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x


def write(name, x, peak_db=None, rms_db=None):
    if peak_db is not None:
        x = x / max(np.abs(x).max(), 1e-9) * 10 ** (peak_db / 20)
    if rms_db is not None:
        x = x / max(np.sqrt((x ** 2).mean()), 1e-9) * 10 ** (rms_db / 20)
        x = np.clip(x, -0.5, 0.5)
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    print(f"{name}.wav {len(x) / SR:.2f}s")


def band(noise, lo, hi, slope=1.0):
    spec = np.fft.rfft(noise)
    f = np.fft.rfftfreq(len(noise), 1 / SR)
    mask = np.clip((f - lo * 0.6) / (lo * 0.4), 0, 1) * np.clip((hi * 1.4 - f) / (hi * 0.4), 0, 1)
    mask = mask / np.maximum(f / lo, 1) ** (0.5 * slope)   # a little darker as it rises, like paper
    return np.fft.irfft(spec * mask, len(noise))


def loop(x, seconds):
    """A seamless loop: the tail crossfaded into the head."""
    n, fade = int(seconds * SR), int(0.12 * SR)
    body, tail = x[:n].copy(), x[n:n + fade]
    ramp = np.linspace(0, 1, fade)
    body[:fade] = body[:fade] * ramp + tail * (1 - ramp)
    return body


def bed(seed, lo, hi, seconds=1.6, grain=0.25, grain_hz=(14, 38), stroke_hz=None, stroke_depth=0.0, crackle=0.0):
    rng = np.random.default_rng(seed)
    n = int((seconds + 0.2) * SR)
    t = np.arange(n) / SR
    x = band(rng.standard_normal(n), lo, hi)
    am = 1 + grain * np.sin(2 * np.pi * rng.uniform(*grain_hz) * t + rng.uniform(0, 6.28)) * np.sin(2 * np.pi * 0.7 * t)
    if stroke_hz:
        am *= (1 - stroke_depth) + stroke_depth * (0.5 + 0.5 * np.sin(2 * np.pi * stroke_hz * t + 1.3 * np.sin(2 * np.pi * 1.1 * t))) ** 2
    x *= am
    if crackle:
        clicks = np.zeros(n)
        idx = rng.integers(0, n, int(crackle * seconds))
        clicks[idx] = rng.uniform(-1, 1, len(idx))
        x += band(clicks, lo * 1.5, hi, slope=0) * 6
    return loop(x, seconds)


def keys(seed, seconds=1.6):
    rng = np.random.default_rng(seed)
    n = int((seconds + 0.2) * SR)
    x = np.zeros(n)
    t = 0.0
    while t < seconds + 0.15:
        start = int(t * SR)
        k = int(0.006 * SR)
        burst = band(rng.standard_normal(k * 4), 1800, 7000)[:k] * np.exp(-np.arange(k) / (0.0012 * SR)) * rng.uniform(0.5, 1)
        x[start:start + k] += burst[: max(0, min(k, n - start))]
        t += rng.uniform(0.07, 0.13)
    return loop(x, seconds)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    packs = pathlib.Path(sys.argv[1])
    for name, (rel, peak) in ACCENTS.items():
        write(name, trim(load(packs / rel)), peak_db=peak)
    write("bed-felt", bed(11, 1800, 7000), rms_db=-33)
    write("bed-pencil", bed(12, 2500, 10000, grain=0.4, crackle=90), rms_db=-34)
    write("bed-writing", bed(13, 1500, 6000, stroke_hz=7, stroke_depth=0.7), rms_db=-33)
    write("bed-highlighter", bed(14, 800, 4000, grain=0.12), rms_db=-35)
    write("bed-keys", keys(15), rms_db=-31)


if __name__ == "__main__":
    main()
