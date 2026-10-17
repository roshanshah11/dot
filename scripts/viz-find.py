#!/opt/homebrew/bin/python3.13
"""Find the explainer widget for a topic: scripts/viz-find.py "kernel of a linear map" [--limit 5] [--json]

Reads the id, title, subject and shows line of every widget in Resources/board/viz/widgets and ranks them by word
overlap with the query (ids and titles weigh more). Prints "score  id  title". Dot's panel uses the same idea to
resolve <viz topic="...">.
"""
import argparse, json, re
from pathlib import Path

WIDGETS = Path(__file__).resolve().parent.parent / "Resources" / "board" / "viz" / "widgets"
STOP = set("a an the of and or to in on for with by is are what how why show me explain visual visualize".split())
SYN = {"null": ["kernel"], "kernel": ["null"], "nullspace": ["kernel", "null"], "pv": ["present", "value"], "npv": ["present", "value"],
       "discount": ["discounting", "present"], "det": ["determinant"], "determinant": ["det", "area"], "independence": ["independent"],
       "dependent": ["independence"], "matrix": ["transformation"], "pcr": ["polymerase", "chain"], "sd": ["standard", "deviation"]}


def words(text):
    out = []
    for w in re.findall(r"[a-z0-9]+", text.lower()):
        if w in STOP: continue
        out.append(w[:-1] if len(w) > 4 and w.endswith("s") else w)
    return out


def index():
    items = []
    for f in sorted(WIDGETS.glob("*.js")):
        src = f.read_text()
        meta = {"id": f.stem}
        for key in ("title", "subject", "shows"):
            m = re.search(key + r'\s*:\s*"((?:[^"\\]|\\.)*)"', src)
            meta[key] = m.group(1) if m else ""
        items.append(meta)
    return items


def rank(query, items, limit=5):
    q = words(query)
    q += [s for w in q for s in SYN.get(w, [])]
    scored = []
    for it in items:
        head = set(words(it["id"].replace("-", " ") + " " + it["title"]))
        body = set(words(it["shows"] + " " + it["subject"]))
        score = sum(3 if w in head else 1 if w in body else 0 for w in q)
        if score: scored.append((score, it))
    scored.sort(key=lambda s: (-s[0], s[1]["id"]))
    return scored[:limit]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("--limit", type=int, default=5)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    hits = rank(a.query, index(), a.limit)
    if a.json:
        print(json.dumps([dict(score=s, **it) for s, it in hits]))
    else:
        for s, it in hits: print(f"{s:3d}  {it['id']}  {it['title']}")
