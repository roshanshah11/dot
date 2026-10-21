#!/usr/bin/env python3
"""Dot's index of his own Spotify library: the playlists in his sidebar, each with its name and whether he made it, and
Liked Songs (2026-10-21: "play my ... playlist" played a stranger's public playlist with the same words).

    dot-spotify-library.py                   JSON lines {uri, name, owner_is_him, order}: Liked Songs first (order -1),
                                             then his playlists in sidebar order (0, 1, ...)
    dot-spotify-library.py match <words...>  "uri<TAB>name" lines, best first (at most 5); exit 3 when none
    dot-spotify-library.py --rebuild         rebuild the index now, then print it as above

Spotify keeps its cache in a LevelDB folder, PersistentCache/Users/<id>-user/primary.ldb, locked while it runs. This reads
a copy (an APFS clone, about 15 ms) in a temporary folder and deletes it after; it reads two kinds of record there and
nothing else of Spotify's: the one that lists his sidebar, and each playlist's name and owner. The index is kept at
~/Dot/spotify/library.json and rebuilt only when the cache folder's newest file time changed.

The matching here is the same as DotKit's SpotifyLibrary (Sources/DotKit/SpotifyLibrary.swift), which is what Dot uses;
Tests/Fixtures/spotify/match-cases.json holds both to the same answers.

Env: DOT_SPOTIFY_LIBRARY  a library.json (a path or an http URL) used as it is, never rebuilt: the bench's fixture
     DOT_SPOTIFY_USERS    the folder of <id>-user folders (default: Spotify's PersistentCache/Users)
     DOT_SPOTIFY_INDEX    where the index is kept (default: ~/Dot/spotify/library.json)
Stdlib only: /usr/bin/python3 has no snappy module, so a small decoder is below.
"""
import json
import os
import re
import struct
import sys
import unicodedata

USERS = os.environ.get('DOT_SPOTIFY_USERS') or os.path.expanduser('~/Library/Application Support/Spotify/PersistentCache/Users')
INDEX = os.environ.get('DOT_SPOTIFY_INDEX') or os.path.expanduser('~/Dot/spotify/library.json')
VERSION = 1
LIKED_NAME = 'Liked Songs'
URI = re.compile(r'^(spotify:playlist:[A-Za-z0-9]{22}|spotify:user:[A-Za-z0-9._-]+:collection)$')


# MARK: The account and its index

def newest_mtime(folder):
    """The newest modification time in the folder (its own included: a file added or removed changes it); None if absent."""
    try:
        times = [os.stat(folder).st_mtime]
        with os.scandir(folder) as it:
            for e in it:
                try:
                    times.append(e.stat().st_mtime)
                except OSError:
                    pass   # deleted by a compaction while we looked
        return max(times)
    except OSError:
        return None


def account():
    """(user id, primary.ldb folder, newest mtime) of the account whose cache changed last, or None."""
    try:
        names = os.listdir(USERS)
    except OSError:
        return None
    best = None
    for n in names:
        if not n.endswith('-user'):
            continue
        db = os.path.join(USERS, n, 'primary.ldb')
        m = newest_mtime(db)
        if m is not None and (best is None or m > best[2]):
            best = (n[:-len('-user')], db, m)
    return best


def liked_uri(user):
    return f'spotify:user:{user}:collection'


def entries_of(doc):
    """The index's lines: Liked Songs first, then the playlists in sidebar order."""
    out = []
    if isinstance(doc.get('liked'), str) and URI.match(doc['liked']):
        out.append({'uri': doc['liked'], 'name': LIKED_NAME, 'owner_is_him': True, 'order': -1})
    for p in doc.get('playlists') or []:
        if isinstance(p, dict) and isinstance(p.get('uri'), str) and URI.match(p['uri']) and isinstance(p.get('name'), str) and p['name']:
            out.append({'uri': p['uri'], 'name': p['name'], 'owner_is_him': bool(p.get('owner_is_him')), 'order': int(p.get('order', len(out)))})
    return out


def load_fixture(where):
    if where.startswith('http://') or where.startswith('https://'):
        import urllib.request
        with urllib.request.urlopen(where, timeout=3) as r:
            return json.loads(r.read().decode('utf-8'))
    with open(os.path.expanduser(where), encoding='utf-8') as f:
        return json.load(f)


def library(rebuild=False):
    """The index as a dict {version, mtime, liked, playlists}: the cached one when the cache folder is unchanged."""
    fixture = os.environ.get('DOT_SPOTIFY_LIBRARY')
    if fixture:
        return load_fixture(fixture)
    acct = account()
    if acct is None:
        raise SystemExit('no spotify cache')
    user, db, mtime = acct
    if not rebuild:
        try:
            with open(INDEX, encoding='utf-8') as f:
                doc = json.load(f)
            if doc.get('version') == VERSION and doc.get('mtime') == mtime and doc.get('liked') == liked_uri(user):
                return doc
        except (OSError, ValueError):
            pass
    playlists = read_copy(db, user)
    doc = {'version': VERSION, 'mtime': mtime, 'liked': liked_uri(user), 'playlists': playlists}
    os.makedirs(os.path.dirname(INDEX), exist_ok=True)
    tmp = f'{INDEX}.{os.getpid()}.tmp'   # two rebuilds at once each write their own, and the last rename wins
    with open(os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False)
    os.replace(tmp, INDEX)
    return doc


def read_copy(db, user):
    """His playlists, read from a throwaway copy of the LevelDB folder (never the live one: Spotify holds its lock)."""
    import shutil
    import subprocess
    import tempfile
    tmp = tempfile.mkdtemp(prefix='dot-spotify-')
    try:
        copy = os.path.join(tmp, 'primary.ldb')
        cloned = subprocess.run(['/bin/cp', '-cR', db, copy], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        if not cloned:
            # no clone (another volume), or a file went away mid-copy: copy what is there, one file at a time
            os.makedirs(copy, exist_ok=True)
            for name in os.listdir(db):
                if name != 'LOCK' and not os.path.exists(os.path.join(copy, name)):
                    try:
                        shutil.copy2(os.path.join(db, name), os.path.join(copy, name))
                    except OSError:
                        pass
        return read_library(copy, user)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# MARK: LevelDB, read-only (tables and the write-ahead log)

MAGIC = 0xdb4775248b80fb57


def varint(b, i):
    r = s = 0
    while True:
        c = b[i]
        i += 1
        r |= (c & 0x7f) << s
        if c < 0x80:
            return r, i
        s += 7


def snappy(b):
    """Snappy's raw format (what LevelDB compresses blocks with)."""
    _, i = varint(b, 0)
    out = bytearray()
    n = len(b)
    while i < n:
        tag = b[i]
        i += 1
        t = tag & 3
        if t == 0:
            ln = tag >> 2
            if ln >= 60:
                k = ln - 59
                ln = int.from_bytes(b[i:i + k], 'little')
                i += k
            ln += 1
            out += b[i:i + ln]
            i += ln
            continue
        if t == 1:
            ln = ((tag >> 2) & 7) + 4
            off = ((tag >> 5) << 8) | b[i]
            i += 1
        elif t == 2:
            ln = (tag >> 2) + 1
            off = b[i] | (b[i + 1] << 8)
            i += 2
        else:
            ln = (tag >> 2) + 1
            off = int.from_bytes(b[i:i + 4], 'little')
            i += 4
        if off == 0 or off > len(out):
            raise ValueError('bad snappy offset')
        st = len(out) - off
        if off >= ln:
            out += out[st:st + ln]
        else:
            while ln > 0:   # an overlapping copy repeats the last `off` bytes
                chunk = out[st:st + min(off, ln)]
                out += chunk
                ln -= len(chunk)
    return bytes(out)


def block_entries(blk):
    """(key, value) pairs of a table block, in order (prefix-compressed keys, restart array at the end)."""
    restarts = struct.unpack('<I', blk[-4:])[0]
    end = len(blk) - 4 - 4 * restarts
    i = 0
    key = b''
    while i < end:
        shared, i = varint(blk, i)
        unshared, i = varint(blk, i)
        vlen, i = varint(blk, i)
        key = key[:shared] + blk[i:i + unshared]
        i += unshared
        yield key, blk[i:i + vlen]
        i += vlen


def key_parts(ukey, depth):
    """A user key as Spotify's comparator orders it, to `depth` parts: the namespace byte, the plain parts up to '#', then
    length-prefixed parts by their content ("!pl#attr#<len>spotify:playlist:...#" is (b'!', b'pl', b'attr', b'spotify:...'))."""
    out = [ukey[:1]]
    i = 1
    n = len(ukey)
    while len(out) < depth and i < n:
        if len(out) >= 3:
            ln = ukey[i]
            out.append(ukey[i + 1:i + 1 + ln])
            i += ln + 2
            continue
        j = ukey.find(b'#', i)
        if j < 0:
            out.append(ukey[i:])
            break
        out.append(ukey[i:j])
        i = j + 1
    return tuple(out)


class Table:
    def __init__(self, path):
        self.f = open(path, 'rb')
        try:
            self.open()
        except Exception:
            self.f.close()
            raise

    def open(self):
        size = os.fstat(self.f.fileno()).st_size
        if size < 48:
            raise ValueError('short table')
        self.f.seek(size - 48)
        foot = self.f.read(48)
        if struct.unpack('<Q', foot[-8:])[0] != MAGIC:
            raise ValueError('not a table')
        _, i = varint(foot, 0)
        _, i = varint(foot, i)
        off, i = varint(foot, i)
        ln, i = varint(foot, i)
        self.index = [(k[:-8], h) for k, h in block_entries(self.read(off, ln))]

    def read(self, off, size):
        self.f.seek(off)
        raw = self.f.read(size + 5)
        if len(raw) < size + 1:
            raise ValueError('short block')
        kind = raw[size]
        if kind == 1:
            return snappy(raw[:size])
        if kind == 0:
            return raw[:size]
        raise ValueError(f'compression {kind}')

    def scan(self, target):
        """(user key, seq, type, value) of every entry in the blocks that can hold keys at `target`: a block holds the keys
        after the previous index key, up to its own."""
        depth = len(target)
        prev = None
        for ukey, handle in self.index:
            here = key_parts(ukey, depth)
            if (prev is None or prev <= target) and here >= target:
                off, i = varint(handle, 0)
                ln, _ = varint(handle, i)
                for k, v in block_entries(self.read(off, ln)):
                    tail = struct.unpack('<Q', k[-8:])[0]
                    yield k[:-8], tail >> 8, tail & 0xff, v
            prev = here

    def close(self):
        self.f.close()


def wal(path):
    """(key, seq, type, value) of every write in a LevelDB log file; a torn last record is skipped."""
    with open(path, 'rb') as f:
        d = f.read()
    i = 0
    buf = b''
    size = 32768
    while i + 7 <= len(d):
        left = size - (i % size)
        if left < 7:
            i += left
            continue
        ln = struct.unpack('<H', d[i + 4:i + 6])[0]
        kind = d[i + 6]
        frag = d[i + 7:i + 7 + ln]
        i += 7 + ln
        if kind == 1:
            batch = frag
        elif kind == 2:
            buf = frag
            continue
        elif kind == 3:
            buf += frag
            continue
        elif kind == 4:
            batch = buf + frag
            buf = b''
        else:
            continue
        if len(batch) < 12:
            continue
        seq, count = struct.unpack('<QI', batch[:12])
        j = 12
        try:
            for n in range(count):
                typ = batch[j]
                j += 1
                kl, j = varint(batch, j)
                k = batch[j:j + kl]
                j += kl
                v = b''
                if typ == 1:
                    vl, j = varint(batch, j)
                    v = batch[j:j + vl]
                    j += vl
                yield k, seq + n, typ, v
        except IndexError:
            pass


def number(name):
    m = re.match(r'^(\d+)\.', name)
    return int(m.group(1)) if m else -1


# MARK: Spotify's records (protobuf, read by field number)

def fields(b):
    i = 0
    out = []
    while i < len(b):
        tag, i = varint(b, i)
        f, w = tag >> 3, tag & 7
        if w == 0:
            v, i = varint(b, i)
        elif w == 2:
            ln, i = varint(b, i)
            v = b[i:i + ln]
            i += ln
        elif w == 1:
            v = b[i:i + 8]
            i += 8
        elif w == 5:
            v = b[i:i + 4]
            i += 4
        else:
            raise ValueError(f'wire type {w}')
        if i > len(b):
            raise ValueError('truncated')
        out.append((f, v))
    return out


def text(v):
    return v.decode('utf-8', 'replace') if isinstance(v, bytes) else ''


def sidebar_uris(value):
    """The playlist uris in his sidebar record, in order (folders and anything that isn't a playlist are skipped)."""
    out = []
    for f, contents in fields(value):
        if f != 5 or not isinstance(contents, bytes):
            continue
        for g, item in fields(contents):
            if g != 3 or not isinstance(item, bytes):
                continue
            uri = next((text(v) for h, v in fields(item) if h == 1 and isinstance(v, bytes)), '')
            if re.fullmatch(r'spotify:playlist:[A-Za-z0-9]{22}', uri) and uri not in out:
                out.append(uri)
    return out


def read_library(folder, user):
    """[{uri, name, owner_is_him, order}] for the playlists in his sidebar, from a copy of primary.ldb."""
    root_uri = f'spotify:user:{user}:rootlist'.encode()
    root_key = b'!pl#slc#' + bytes([len(root_uri)]) + root_uri + b'#'
    attr = b'!pl#attr#'
    found = {}

    def keep(k, seq, typ, v):
        if k not in found or seq > found[k][0]:
            found[k] = (seq, typ, v)

    names = sorted(os.listdir(folder), key=number, reverse=True)
    for name in names:
        if name.endswith('.log'):
            try:
                for k, seq, typ, v in wal(os.path.join(folder, name)):
                    if k == root_key or k.startswith(attr):
                        keep(k, seq, typ, v)
            except (OSError, ValueError, IndexError, struct.error):
                pass
    tables = []
    for name in names:
        if name.endswith('.ldb') or name.endswith('.sst'):
            try:
                tables.append(Table(os.path.join(folder, name)))
            except (OSError, ValueError, IndexError, struct.error):
                pass   # a table half-written when the copy was taken

    def scan(target, want):
        for t in tables:
            try:
                for k, seq, typ, v in t.scan(target):
                    if want(k):
                        keep(k, seq, typ, v)
            except (OSError, ValueError, IndexError, struct.error):
                pass

    try:
        scan((b'!', b'pl', b'slc', root_uri), lambda k: k == root_key)
        if root_key not in found:
            # the comparator ordered it somewhere else: every block of the sidebar records (slower, still correct)
            scan((b'!', b'pl', b'slc'), lambda k: k == root_key)
        scan((b'!', b'pl', b'attr'), lambda k: k.startswith(attr))
    finally:
        for t in tables:
            t.close()
    root = found.get(root_key)
    if root is None or root[1] != 1:
        raise SystemExit('no sidebar record in the spotify cache')
    attrs = {}
    for k, (seq, typ, v) in found.items():
        if k.startswith(attr) and typ == 1:
            m = re.search(rb'spotify:playlist:[A-Za-z0-9]{22}', k)
            if m:
                attrs[m.group(0).decode()] = v
    out = []
    for order, uri in enumerate(sidebar_uris(root[2])):
        try:
            fs = fields(attrs.get(uri, b''))
        except (ValueError, IndexError):
            continue
        name = next((text(v) for f, v in fs if f == 1), '').strip()
        owner = next((text(v) for f, v in fs if f == 6), '')
        if name:   # a playlist Spotify hasn't loaded yet has an empty record; it is left out
            out.append({'uri': uri, 'name': name, 'owner_is_him': owner == user, 'order': order})
    return out


# MARK: Matching (the same rules as DotKit's SpotifyLibrary)

LIKED_ALIASES = {'liked songs', 'liked song', 'liked', 'likes', 'liked music', 'liked tracks', 'saved songs', 'saved tracks',
                 'saved music', 'favorite songs', 'favourite songs', 'favorites', 'favourites', 'songs'}
EXACT, EVERY_WORD, FUZZY = 3, 2, 1


def normalize(name):
    """Lowercase letters and digits, one space between words: no emoji, accents, marks or punctuation ("&" is "and"), and
    no trailing "playlist(s)" or leading "my" when other words are left."""
    out = []
    for ch in unicodedata.normalize('NFKD', name).lower():
        cat = unicodedata.category(ch)
        if cat[0] == 'M' or ch in "'‘’`":
            continue
        if cat[0] in 'LN':
            out.append(ch)
        elif ch == '&':
            out.append(' and ')
        else:
            out.append(' ')
    words = ''.join(out).split()
    if len(words) > 1 and words[-1] in ('playlist', 'playlists'):
        words.pop()
    if len(words) > 1 and words[0] == 'my':
        words.pop(0)
    return ' '.join(words)


def stem(word):
    return word[:-1] if len(word) > 3 and word.endswith('s') else word


def distance(a, b):
    """Levenshtein distance between two strings."""
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def close_word(a, b):
    if a == b or stem(a) == stem(b):
        return True
    return min(len(a), len(b)) >= 4 and distance(a, b) <= 1


def grade(ask, name, liked=False):
    """(match, closeness) of a normalized ask against a normalized name; match 0 is none. Closeness: lower is closer."""
    if not ask or not name:
        return 0, 0
    if liked and ask in LIKED_ALIASES:
        return EXACT, 0
    a, n = ask.split(), name.split()
    ac, nc = ''.join(a), ''.join(n)
    if ask == name or ac == nc:
        return EXACT, 0
    nstems = {stem(w) for w in n}
    if all(stem(w) in nstems for w in a):
        return EVERY_WORD, len(n) - len(a)
    d = distance(ac, nc)
    if len(nc) >= 4 and d <= max(1, min(3, len(nc) // 4)):
        return FUZZY, d
    if all(any(close_word(w, x) for x in n) for w in a):
        return FUZZY, 1 + abs(len(n) - len(a))
    astems = {stem(w) for w in a}
    if len(nc) >= 4 and len(a) - len(n) <= 2 and all(stem(w) in astems for w in n):
        return FUZZY, 2 + len(a) - len(n)
    return 0, 0


def rank(words, entries):
    """The entries that match the words, best first: exact, then every word present, then close; his own before ones he
    follows; then the closer, then the higher in his sidebar."""
    ask = normalize(words)
    scored = []
    for e in entries:
        m, closeness = grade(ask, normalize(e['name']), liked=e['uri'].endswith(':collection'))
        if m:
            scored.append(((-m, not e['owner_is_him'], closeness, e['order'], e['uri']), m, e))
    scored.sort(key=lambda s: s[0])
    return [(e, m) for _, m, e in scored]


def main(argv):
    sys.stdout.reconfigure(encoding='utf-8')
    rebuild = '--rebuild' in argv
    args = [a for a in argv if a != '--rebuild']
    try:
        doc = library(rebuild=rebuild)
    except SystemExit as e:
        print(e.code if isinstance(e.code, str) else 'no library', file=sys.stderr)
        return 4
    except (OSError, ValueError) as e:
        print(f'library unreadable: {e}', file=sys.stderr)
        return 4
    entries = entries_of(doc)
    if args and args[0] == 'match':
        hits = rank(' '.join(args[1:]), entries)[:5]
        if not hits:
            return 3
        for e, _ in hits:
            print(e['uri'] + '\t' + e['name'].replace('\t', ' ').replace('\n', ' '))
        return 0
    if args:
        print('usage: dot-spotify-library.py [--rebuild] | match <words...>', file=sys.stderr)
        return 2
    for e in entries:
        print(json.dumps(e, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
