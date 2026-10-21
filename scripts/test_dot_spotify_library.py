#!/usr/bin/env python3
"""Unit tests for scripts/dot-spotify-library.py (his own Spotify library) and dot-spotify.sh's library, mine and play.

    python3 scripts/test_dot_spotify_library.py -v

Stdlib only. Nothing here reads Spotify's real cache or plays anything: the LevelDB folders are built here from made-up
records, the library is Tests/Fixtures/spotify/library.json, and every play is DOT_SPOTIFY_DRY=1.
"""
import importlib.util
import json
import os
import struct
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURES = HERE.parent / 'Tests' / 'Fixtures' / 'spotify'
spec = importlib.util.spec_from_file_location('dot_spotify_library', HERE / 'dot-spotify-library.py')
lib = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lib)

USER = 'exampleuser'


def fixture_entries():
    with open(FIXTURES / 'library.json', encoding='utf-8') as f:
        return lib.entries_of(json.load(f))


def pick(words, mine, entries):
    """What Dot plays for a playlist ask (DotKit's SpotifyLibrary.pick)."""
    ranked = lib.rank(words, entries)
    if not ranked:
        return None, None
    best, m = ranked[0]
    return (best['uri'] if mine or m >= lib.EVERY_WORD else None), m


# MARK: Building a LevelDB folder (the formats leveldb writes; Spotify's keys and records, made up)

def varint(n):
    out = bytearray()
    while True:
        b = n & 0x7f
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def snappy_literal(data):
    """Snappy's raw format with literals only (what the decoder must read; leveldb's own output has copies too)."""
    out = bytearray(varint(len(data)))
    for i in range(0, len(data), 60):
        chunk = data[i:i + 60]
        out.append((len(chunk) - 1) << 2)
        out += chunk
    return bytes(out)


def block(entries):
    out = bytearray()
    for k, v in entries:
        out += varint(0) + varint(len(k)) + varint(len(v)) + k + v
    return bytes(out) + struct.pack('<II', 0, 1)


def internal(ukey, seq, typ=1):
    return ukey + struct.pack('<Q', (seq << 8) | typ)


def table(path, blocks, compress=True):
    """A table file: one data block per list of (user key, seq, type, value), in order."""
    data = bytearray()
    index = []
    for entries in blocks:
        raw = block([(internal(k, s, t), v) for k, s, t, v in entries])
        body = snappy_literal(raw) if compress else raw
        index.append((internal(entries[-1][0], entries[-1][1], entries[-1][2]), varint(len(data)) + varint(len(body))))
        data += body + bytes([1 if compress else 0]) + b'\0\0\0\0'
    meta_off = len(data)
    meta = block([])
    data += meta + b'\0\0\0\0\0'
    index_off = len(data)
    idx = block(index)
    data += idx + b'\0\0\0\0\0'
    handles = varint(meta_off) + varint(len(meta)) + varint(index_off) + varint(len(idx))
    data += handles + b'\0' * (40 - len(handles)) + struct.pack('<Q', lib.MAGIC)
    Path(path).write_bytes(bytes(data))


def log(path, seq, writes):
    """A write-ahead log with one batch of (user key, type, value)."""
    batch = struct.pack('<QI', seq, len(writes))
    for k, typ, v in writes:
        batch += bytes([typ]) + varint(len(k)) + k + (varint(len(v)) + v if typ == 1 else b'')
    Path(path).write_bytes(b'\0\0\0\0' + struct.pack('<H', len(batch)) + bytes([1]) + batch)


def lp(text):
    raw = text.encode()
    return bytes([len(raw)]) + raw


def pb(field, data):
    return varint((field << 3) | 2) + varint(len(data)) + data


def pid(n):
    return f'Fixture{n:015d}'


def root_key(user=USER):
    return b'!pl#slc#' + lp(f'spotify:user:{user}:rootlist') + b'#'


def attr_key(n):
    return b'!pl#attr#' + lp(f'spotify:playlist:{pid(n)}') + b'#'


def sidebar(*items):
    return pb(1, b'rev') + pb(5, b''.join(pb(3, pb(1, uri.encode()) + pb(2, b'\x10\x01')) for uri in items))


def attr(name, owner):
    return pb(1, name.encode()) + pb(6, owner.encode())


def playlist_uris(*ns):
    return [f'spotify:playlist:{pid(n)}' for n in ns]


class SnappyTests(unittest.TestCase):
    def test_copies(self):
        # "abc", then a 1-byte-offset copy of 9 from 3 back (it overlaps itself), then a 2-byte-offset copy of 4
        packed = bytes([16]) + bytes([2 << 2]) + b'abc' + bytes([((9 - 4) << 2) | 1, 3]) + bytes([((4 - 1) << 2) | 2, 12, 0])
        self.assertEqual(lib.snappy(packed), b'abcabcabcabcabca')

    def test_literals(self):
        data = bytes(range(256)) * 3
        self.assertEqual(lib.snappy(snappy_literal(data)), data)

    def test_bad_offset(self):
        with self.assertRaises(ValueError):
            lib.snappy(bytes([5, ((5 - 4) << 2) | 1, 9]))


class MatchTests(unittest.TestCase):
    """The same answers as DotKit's SpotifyLibraryTests, from Tests/Fixtures/spotify/match-cases.json."""

    @classmethod
    def setUpClass(cls):
        with open(FIXTURES / 'match-cases.json', encoding='utf-8') as f:
            cls.cases = json.load(f)
        cls.entries = fixture_entries()

    def test_fixture(self):
        self.assertEqual(len(self.entries), 14)
        self.assertEqual(self.entries[0], {'uri': 'spotify:user:example:collection', 'name': 'Liked Songs', 'owner_is_him': True, 'order': -1})

    def test_normalize(self):
        self.assertTrue(self.cases['normalize'])
        for raw, want in self.cases['normalize']:
            self.assertEqual(lib.normalize(raw), want, raw)

    def test_picks(self):
        names = {lib.EXACT: 'exact', lib.EVERY_WORD: 'everyWord', lib.FUZZY: 'close', None: None}
        self.assertGreater(len(self.cases['picks']), 20)
        for row in self.cases['picks']:
            got, m = pick(row['words'], row['mine'], self.entries)
            label = ('my ' if row['mine'] else '') + row['words']
            self.assertEqual(got, row['pick'], label)
            self.assertEqual(names[m], row['match'], label)


class ReaderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / 'primary.ldb'
        self.db.mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def tables(self, rootlist_seq=10, rootlist=None):
        rootlist = rootlist or playlist_uris(1, 2, 3)
        # an older table: a stale sidebar and a stale name, both shadowed by the newer ones
        table(self.db / '000005.ldb', [
            [(attr_key(1), 3, 1, attr('Old Name', USER))],
            [(root_key(), 4, 1, sidebar(*playlist_uris(1)))],
        ])
        table(self.db / '000007.ldb', [
            [(b'!col#col#' + lp('spotify:track:' + pid(9)) + b'#', 5, 1, b'x')],
            [(attr_key(1), 6, 1, attr('Study Mix', USER)), (attr_key(2), 7, 1, attr('Road Trip', 'someoneelse')),
             (attr_key(3), 8, 1, attr('', ''))],
            [(b'!pl#slc#' + lp(f'spotify:playlist:{pid(1)}') + b'#', 9, 1, b'tracks'),
             (root_key(), rootlist_seq, 1, sidebar(rootlist[0], 'spotify:start-group:abc:Folder', *rootlist[1:], 'spotify:end-group:abc'))],
            [(b'#pl#slc#items#' + lp(f'spotify:playlist:{pid(1)}') + b'#', 11, 1, b'')],
        ])

    def test_tables_only(self):
        self.tables()
        got = lib.read_library(str(self.db), USER)
        self.assertEqual(got, [
            {'uri': f'spotify:playlist:{pid(1)}', 'name': 'Study Mix', 'owner_is_him': True, 'order': 0},
            {'uri': f'spotify:playlist:{pid(2)}', 'name': 'Road Trip', 'owner_is_him': False, 'order': 1},
        ])   # the third has an empty record (not loaded yet) and is left out

    def test_log_is_newest(self):
        self.tables()
        log(self.db / '000008.log', 20, [
            (root_key(), 1, sidebar(*playlist_uris(2, 1, 4))),
            (attr_key(4), 1, attr('Rainy Days', USER)),
            (attr_key(2), 0, b''),   # deleted: left out
        ])
        got = lib.read_library(str(self.db), USER)
        self.assertEqual([(e['name'], e['order']) for e in got], [('Study Mix', 1), ('Rainy Days', 2)])

    def test_uncompressed_blocks_and_no_sidebar(self):
        table(self.db / '000003.ldb', [[(attr_key(1), 3, 1, attr('Study Mix', USER))]], compress=False)
        with self.assertRaises(SystemExit):
            lib.read_library(str(self.db), USER)
        table(self.db / '000004.ldb', [[(root_key(), 4, 1, sidebar(*playlist_uris(1)))]], compress=False)
        self.assertEqual([e['name'] for e in lib.read_library(str(self.db), USER)], ['Study Mix'])

    def test_torn_files_are_skipped(self):
        self.tables()
        (self.db / '000009.ldb').write_bytes(b'half a table')
        (self.db / '000010.log').write_bytes(b'\0\0\0\0\xff\xff\x01trunc')
        self.assertEqual(len(lib.read_library(str(self.db), USER)), 2)


class IndexTests(unittest.TestCase):
    """The index at DOT_SPOTIFY_INDEX: built from a copy, rebuilt only when the cache folder's newest time changes."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.db = base / 'Users' / f'{USER}-user' / 'primary.ldb'
        self.db.mkdir(parents=True)
        (self.db / 'LOCK').write_bytes(b'')
        table(self.db / '000005.ldb', [
            [(attr_key(1), 3, 1, attr('Study Mix', USER))],
            [(root_key(), 4, 1, sidebar(*playlist_uris(1)))],
        ])
        self.saved = (lib.USERS, lib.INDEX, os.environ.pop('DOT_SPOTIFY_LIBRARY', None))
        lib.USERS = str(base / 'Users')
        lib.INDEX = str(base / 'index' / 'library.json')
        self.builds = 0
        self.real = lib.read_copy

        def counted(db, user):
            self.builds += 1
            return self.real(db, user)
        lib.read_copy = counted

    def tearDown(self):
        lib.USERS, lib.INDEX, fixture = self.saved
        lib.read_copy = self.real
        if fixture is not None:
            os.environ['DOT_SPOTIFY_LIBRARY'] = fixture
        self.tmp.cleanup()

    def test_cached_until_the_folder_changes(self):
        doc = lib.library()
        self.assertEqual(self.builds, 1)
        self.assertEqual(doc['liked'], f'spotify:user:{USER}:collection')
        self.assertEqual([p['name'] for p in doc['playlists']], ['Study Mix'])
        self.assertEqual(oct(os.stat(lib.INDEX).st_mode & 0o777), '0o600')
        lib.library()
        self.assertEqual(self.builds, 1, 'unchanged folder: the index as it is')
        later = time.time() + 5
        log(self.db / '000006.log', 9, [(attr_key(1), 1, attr('Study Mix Two', USER))])
        os.utime(self.db / '000006.log', (later, later))
        doc = lib.library()
        self.assertEqual(self.builds, 2)
        self.assertEqual([p['name'] for p in doc['playlists']], ['Study Mix Two'])
        lib.library(rebuild=True)
        self.assertEqual(self.builds, 3)
        self.assertEqual(sorted(os.listdir(self.db)), ['000005.ldb', '000006.log', 'LOCK'], 'the live folder is only read')

    def test_entries_lines(self):
        lines = lib.entries_of(lib.library())
        self.assertEqual(lines[0]['uri'], f'spotify:user:{USER}:collection')
        self.assertEqual(lines[1], {'uri': f'spotify:playlist:{pid(1)}', 'name': 'Study Mix', 'owner_is_him': True, 'order': 0})


class CommandTests(unittest.TestCase):
    """The script and dot-spotify.sh on the fixture library (DOT_SPOTIFY_LIBRARY), with every play dry."""

    def run_cmd(self, *args):
        env = dict(os.environ, DOT_SPOTIFY_LIBRARY=str(FIXTURES / 'library.json'), DOT_SPOTIFY_DRY='1')
        return subprocess.run(list(args), env=env, capture_output=True, text=True, timeout=30)

    def test_lines(self):
        r = self.run_cmd(sys.executable, str(HERE / 'dot-spotify-library.py'))
        self.assertEqual(r.returncode, 0, r.stderr)
        rows = [json.loads(line) for line in r.stdout.splitlines()]
        self.assertEqual(len(rows), 14)
        self.assertEqual(rows[2]['name'], 'Road Trip \U0001F697')

    def test_mine(self):
        r = self.run_cmd('/bin/bash', str(HERE / 'dot-spotify.sh'), 'mine', 'road', 'trip')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout.splitlines()[:2], [f'spotify:playlist:{pid(2)}\tRoad Trip \U0001F697', f'spotify:playlist:{pid(6)}\troad trip'])
        r = self.run_cmd('/bin/bash', str(HERE / 'dot-spotify.sh'), 'mine', 'white', 'noise')
        self.assertEqual((r.returncode, r.stdout), (3, ''))

    def test_dry_play(self):
        for uri in ('spotify:user:example:collection', f'spotify:playlist:{pid(2)}'):
            r = self.run_cmd('/bin/bash', str(HERE / 'dot-spotify.sh'), 'play', uri)
            self.assertEqual((r.returncode, r.stdout.strip()), (0, f'dry play {uri}'))
        for bad in ('spotify:user:a"b:collection', 'spotify:user:x:rootlist', 'spotify:playlist:short'):
            r = self.run_cmd('/bin/bash', str(HERE / 'dot-spotify.sh'), 'play', bad)
            self.assertEqual((r.returncode, r.stdout.strip()), (2, 'bad uri'), bad)


if __name__ == '__main__':
    unittest.main()
