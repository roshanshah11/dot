#!/usr/bin/env python3
"""dot-spotify-api.py against a stub Spotify: token refresh, devices, play on "phone", transfer, like, queue, not set up."""
import http.server, json, os, subprocess, sys, tempfile, threading, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "dot-spotify-api.py")
CALLS = []
DEVICES = [{"id": "mac1", "name": "Example MacBook", "type": "Computer", "is_active": True},
           {"id": "phone1", "name": "Sam's iPhone", "type": "Smartphone", "is_active": False},
           {"id": "tv1", "name": "Living Room TV", "type": "TV", "is_active": False}]


class Stub(http.server.BaseHTTPRequestHandler):
    def _send(self, code, body=None):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if body is not None:
            self.wfile.write(json.dumps(body).encode())

    def _record(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n).decode() if n else ""
        CALLS.append((self.command, self.path, raw, self.headers.get("Authorization")))

    def do_POST(self):
        self._record()
        if self.path == "/accounts/api/token":
            return self._send(200, {"access_token": "AT-1", "expires_in": 3600, "refresh_token": "RT-2"})
        if self.path.startswith("/v1/me/player/queue"):
            return self._send(204)
        self._send(404, {"error": {"message": "no route"}})

    def do_GET(self):
        self._record()
        if self.path == "/v1/me/player/devices":
            return self._send(200, {"devices": DEVICES})
        if self.path == "/v1/me/player/currently-playing":
            return self._send(200, {"item": {"id": "TRACK0000000000000000A", "name": "Example Song"}})
        self._send(404, {"error": {"message": "no route"}})

    def do_PUT(self):
        self._record()
        if self.path.startswith("/v1/me/player/play") and "device_id=nope" in self.path:
            return self._send(404, {"error": {"message": "Device not found"}})
        self._send(204)

    def log_message(self, *a):
        pass


class SpotifyAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.HTTPServer(("127.0.0.1", 0), Stub)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        CALLS.clear()
        self.tmp = tempfile.mkdtemp()
        self.keys = os.path.join(self.tmp, "keys.json")
        json.dump({"client_id": "CLIENT", "refresh_token": "RT-1"}, open(self.keys, "w"))

    def run_api(self, *args, keys=True):
        env = dict(os.environ, DOT_SPOTIFY_API=self.base + "/v1", DOT_SPOTIFY_ACCOUNTS=self.base + "/accounts",
                   DOT_SPOTIFY_TEST_KEYS=self.keys if keys else os.path.join(self.tmp, "none.json"),
                   DOT_SPOTIFY_TOKEN_FILE=os.path.join(self.tmp, "token.json"))
        p = subprocess.run([sys.executable, SCRIPT, *args], capture_output=True, text=True, env=env, timeout=30)
        return p.returncode, p.stdout.strip()

    def test_not_set_up(self):
        self.assertEqual(self.run_api("status", keys=False), (3, "not set up"))
        code, out = self.run_api("devices", keys=False)
        self.assertEqual(code, 3)
        self.assertTrue(out.startswith("not set up"))

    def test_refresh_rotates_the_token_and_lists_devices(self):
        code, out = self.run_api("devices")
        self.assertEqual(code, 0)
        self.assertIn("phone1\tSam's iPhone\tSmartphone\tidle", out)
        self.assertEqual(json.load(open(self.keys))["refresh_token"], "RT-2", "a rotated refresh token is kept")
        token_call = [c for c in CALLS if c[1] == "/accounts/api/token"][0]
        self.assertIn("grant_type=refresh_token", token_call[2])
        self.assertIn("client_id=CLIENT", token_call[2])
        self.assertEqual(oct(os.stat(os.path.join(self.tmp, "token.json")).st_mode & 0o777), "0o600")

    def test_play_on_my_phone_moves_there_then_plays_the_playlist(self):
        code, out = self.run_api("play", "spotify:playlist:Fixture000000000000001", "my phone")
        self.assertEqual((code, out), (0, "playing spotify:playlist:Fixture000000000000001 on Sam's iPhone"))
        puts = [(c[1], c[2]) for c in CALLS if c[0] == "PUT"]
        self.assertEqual(puts[0], ("/v1/me/player", json.dumps({"device_ids": ["phone1"], "play": False})))
        self.assertEqual(puts[1], ("/v1/me/player/play?device_id=phone1", json.dumps({"context_uri": "spotify:playlist:Fixture000000000000001"})))

    def test_a_track_plays_as_uris_and_no_device_means_where_it_is(self):
        self.run_api("play", "spotify:track:TRACK0000000000000000B")
        put = [c for c in CALLS if c[0] == "PUT"][0]
        self.assertEqual((put[1], put[2]), ("/v1/me/player/play", json.dumps({"uris": ["spotify:track:TRACK0000000000000000B"]})))

    def test_no_such_device(self):
        self.assertEqual(self.run_api("play", "spotify:playlist:Fixture000000000000001", "car"), (4, "no device: car"))

    def test_transfer_like_queue(self):
        self.assertEqual(self.run_api("transfer", "tv"), (0, "moved to Living Room TV"))
        self.assertEqual(self.run_api("like"), (0, "liked Example Song"))
        self.assertTrue(any(c[0] == "PUT" and c[1] == "/v1/me/tracks?ids=TRACK0000000000000000A" for c in CALLS))
        self.assertEqual(self.run_api("queue", "spotify:track:TRACK0000000000000000C"), (0, "queued spotify:track:TRACK0000000000000000C"))


if __name__ == "__main__":
    unittest.main()
