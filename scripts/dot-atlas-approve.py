#!/opt/homebrew/bin/python3.13
"""A job's queued sends, as Dot's cards (the fast lane, 2026-10-20).

A job sends texts and mail through its `atlas-send` server, an Atlas session named `ask-dot-job-<id>-<stamp>`, where
imessage_send, send_email and reply only queue a proposal. Dot lists them, shows one card each with the exact recipients
and words, and his Allow sends that exact proposal through Atlas's ledger; his Deny records it denied everywhere (Chuk's
drafts card drops it too).

    dot-atlas-approve.py list    --session ask-dot-job-x [--root ~/roshan] [--harness <dir>]
    dot-atlas-approve.py approve --session ask-dot-job-x --proposal P --digest D
    dot-atlas-approve.py deny    --session ask-dot-job-x --proposal P --digest D

Prints one JSON value. Exit 2 on a refusal (wrong digest, another session's proposal, already denied).
"""
import argparse, json, os, sys
from pathlib import Path


def names_for(store, handles):
    """The person each handle belongs to, from Atlas's own names (read-only); '' when unknown."""
    out = []
    for h in handles:
        name = ''
        try:
            norm = h.strip().lower()
            row = store.db.execute("SELECT entity_id FROM entity_names WHERE kind!='name' AND (normalized=? OR lower(name)=?) LIMIT 1",
                                   (norm, norm)).fetchone()
            if row:
                r = store.db.execute("SELECT name FROM entity_names WHERE entity_id=? AND kind='name' ORDER BY rowid LIMIT 1", (row[0],)).fetchone()
                name = r[0] if r else ''
        except Exception:
            name = ''
        out.append(name)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('command', choices=['list', 'approve', 'deny'])
    ap.add_argument('--session', required=True)
    ap.add_argument('--proposal')
    ap.add_argument('--digest')
    ap.add_argument('--root', default=str(Path.home() / 'roshan'))
    ap.add_argument('--harness', default=None)
    args = ap.parse_args(argv)
    if not args.session.startswith('ask-'):
        print(json.dumps({'error': 'only an ask- session queues; nothing to list or approve'})); return 2
    root = Path(args.root).expanduser()
    harness = Path(args.harness).expanduser() if args.harness else root / 'Atlas' / 'harness'
    if str(harness) not in sys.path: sys.path.insert(0, str(harness))
    os.environ['ATLAS_CHAT_SESSION'] = 'dot-approve'
    from atlas.store import Store   # noqa: E402
    from atlas import mcp           # noqa: E402
    store = Store(root)
    try:
        if args.command == 'list':
            cards = mcp.ask_proposals(store, args.session)
            for c in cards: c['names'] = names_for(store, c.get('to') or [])
            print(json.dumps(cards, ensure_ascii=False)); return 0
        if not args.proposal or not args.digest:
            print(json.dumps({'error': 'approve and deny need --proposal and --digest'})); return 2
        if args.command == 'approve':
            # approve_from_app takes the ask id without its "ask-" prefix
            r = mcp.approve_from_app(store, args.proposal, args.digest, args.session[len('ask-'):], via='dot-card')
            print(json.dumps({'status': r.get('status'), 'provider_id': r.get('provider_id')}, ensure_ascii=False)); return 0
        from atlas.app_data import deny_draft   # noqa: E402
        r = deny_draft(store, args.proposal, args.digest, args.session, via='dot-card')   # the full session: its goal check
        print(json.dumps(r, ensure_ascii=False)); return 0
    except Exception as exc:   # a refusal (wrong digest, another session, denied, already run) or a provider error
        print(json.dumps({'error': f'{exc.__class__.__name__}: {exc}'})); return 2


if __name__ == '__main__':
    sys.exit(main())
