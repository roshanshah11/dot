#!/usr/bin/env python3
"""A made-up coffee chat for `Dot --call-replay`, voiced by Kokoro: me.wav (his side) and them.wav (theirs), aligned
the way call mode records them (each side's track is silent while the other talks), plus prep.md and call.json.
Every name is a placeholder; the companies named are public facts the live helper can explain.

    ~/Dot/tts/venv/bin/python scripts/make-call-fixture.py --out ~/Dot/talk/call-demo
"""
import argparse
import json
import os
import subprocess
import sys
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
RATE = 24000
GAP = 0.7  # seconds between turns

CALL = [
    ("me", "Hey Alex, thanks so much for making the time, I know things are busy right now."),
    ("them", "Of course, happy to. So you're a second year at UChicago?"),
    ("me", "Yeah, second year. I'm really interested in tech banking and wanted to hear how you ended up in the software group."),
    ("them", "Sure. So I started in the generalist pool and got placed on the software team about a year ago. Most of what we do right now is sponsor work, private equity firms buying software companies. Last month we worked on a take private that looked a lot like the Darktrace deal Thoma Bravo did, a cybersecurity company with a ton of recurring revenue."),
    ("me", "That's really interesting. What does sourcing look like day to day for your team?"),
    ("them", "Honestly as an analyst you're not sourcing much. The senior bankers own the relationships. I spend most of my time on the model and the lender presentations. On that deal the financing was a unitranche loan from a private credit fund, which is becoming the default for these."),
    ("me", "Got it. How long did that process take from the first call to signing?"),
    ("them", "About four months. The hardest part was the diligence on churn. The buyer wanted cohort retention by customer size, and the data room was a mess, so we rebuilt it by hand."),
    ("me", "That makes sense. Did the churn numbers end up moving the price?"),
    ("them", "A little. They shaved about half a turn off the multiple. Anyway, tell me about yourself. I'd love to hear about the internship you did this summer."),
    ("me", "Yeah for sure. This summer I was at a small private equity firm, mostly market sizing and building a model for an add on acquisition."),
    ("them", "Nice, that's good experience. Do you know what groups you're targeting?"),
    ("me", "Mostly tech, maybe industrials. I'm still figuring it out."),
    ("them", "That's fine. My advice is talk to as many people as you can, and really know why tech, not just why banking."),
    ("me", "That's really helpful, thank you."),
    ("them", "Of course. I have to jump in a couple minutes, but feel free to email me if you have more questions."),
    ("me", "Will do, thanks again Alex."),
]

PREP = """# Call prep: Alex Example (Northwind Bank, software group)

## Who
- Analyst in the software group, placed from the generalist pool. Bulge bracket.

## Market items
1. Sponsor take-privates of cybersecurity software this year and what drove the pricing.
2. Private credit replacing bank loans in software buyouts.

## Questions
- What does sourcing look like day to day for your team?
- How long does a sponsor sale process take from the first call to signing?
- What made you pick software over the other groups?

## The close
- Ask who else to talk to.
"""


def worker(voice):
    py = os.path.expanduser("~/Dot/tts/venv/bin/python")
    p = subprocess.Popen([py, os.path.join(HERE, "dot-tts-kokoro.py"), "--voice", voice],
                         stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1)
    ready = reply(p)
    if not ready.get("ready"):
        sys.exit(f"tts worker didn't start: {ready}")
    return p


def reply(p):
    """The worker's next JSON line; libraries it loads print other lines first."""
    while True:
        line = p.stdout.readline()
        if not line:
            sys.exit("tts worker ended")
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            continue


def speak(p, text):
    p.stdin.write(json.dumps({"text": text}) + "\n")
    p.stdin.flush()
    answer = reply(p)
    if "wav" not in answer:
        sys.exit(f"tts failed: {answer}")
    with wave.open(answer["wav"]) as w:
        assert w.getframerate() == RATE, w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        if w.getnchannels() > 1:
            data = data.reshape(-1, w.getnchannels())[:, 0]
    os.remove(answer["wav"])
    return data


def write(path, samples):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(samples.astype(np.int16).tobytes())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=os.path.expanduser("~/Dot/talk/call-demo"))
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)
    voices = {"me": worker("am_michael"), "them": worker("af_bella")}
    tracks = {"me": [], "them": []}
    lead = np.zeros(int(RATE * 1.0), dtype=np.int16)
    for side in tracks:
        tracks[side].append(lead)
    for side, text in CALL:
        clip = speak(voices[side], text)
        gap = np.zeros(int(RATE * GAP), dtype=np.int16)
        other = "them" if side == "me" else "me"
        tracks[side] += [clip, gap]
        tracks[other] += [np.zeros(len(clip), dtype=np.int16), gap]
    for p in voices.values():
        p.stdin.close()
        p.terminate()
    me, them = np.concatenate(tracks["me"]), np.concatenate(tracks["them"])
    write(os.path.join(args.out, "me.wav"), me)
    write(os.path.join(args.out, "them.wav"), them)
    with open(os.path.join(args.out, "prep.md"), "w") as f:
        f.write(PREP)
    with open(os.path.join(args.out, "call.json"), "w") as f:
        json.dump({"title": "Call: Alex Example (Northwind Bank)", "person": "Alex Example", "firm": "Northwind Bank"}, f)
    print(f"{args.out}: {len(me) / RATE:.0f} s, {len(CALL)} turns")


if __name__ == "__main__":
    main()
