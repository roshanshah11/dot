#!/usr/bin/env python3
"""Dot's Spotify Web API: his devices, play on one of them (his phone), like the song, add to the queue (2026-10-21).

Spotify's AppleScript can't pick a device, like a song or queue one; the Web API can. One app of his own at
developer.spotify.com (Authorization Code with PKCE, so no client secret), one sign-in, and the refresh token lives in
his login Keychain (service dot-spotify-api). Machine-readable lines only.

  dot-spotify-api.py login <client-id>       sign in once (opens Spotify's page; waits up to 3 min for the redirect)
  dot-spotify-api.py status                  "ready" or "not set up" (exit 3)
  dot-spotify-api.py devices                 one line per device: id<TAB>name<TAB>type<TAB>active|idle
  dot-spotify-api.py play <uri> [<device>]   start a playlist, album, artist or track, on a device by words ("phone")
  dot-spotify-api.py transfer <device>       move what is playing to a device
  dot-spotify-api.py like                    save the song that is playing to his Liked Songs
  dot-spotify-api.py queue <track-uri>       add a track after the current one

Exit codes: 0 ok, 2 usage, 3 not set up, 4 no such device, 5 Spotify refused (the line says why).
"""
import base64, hashlib, http.server, json, os, secrets, subprocess, sys, threading, time, urllib.error, urllib.parse, urllib.request

SERVICE = "dot-spotify-api"
REDIRECT = "http://127.0.0.1:8899/callback"
SCOPES = "user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private user-library-read user-library-modify"
API = os.environ.get("DOT_SPOTIFY_API", "https://api.spotify.com/v1")
ACCOUNTS = os.environ.get("DOT_SPOTIFY_ACCOUNTS", "https://accounts.spotify.com")
TOKEN_FILE = os.path.expanduser(os.environ.get("DOT_SPOTIFY_TOKEN_FILE", "~/Dot/spotify/token.json"))


# Tests point this at a JSON file instead of his Keychain.
TEST_KEYS = os.environ.get("DOT_SPOTIFY_TEST_KEYS")


def keychain_get(account):
    if TEST_KEYS:
        try:
            return json.load(open(TEST_KEYS)).get(account)
        except (OSError, ValueError):
            return None
    p = subprocess.run(["security", "find-generic-password", "-s", SERVICE, "-a", account, "-w"], capture_output=True, text=True)
    return p.stdout.strip() if p.returncode == 0 and p.stdout.strip() else None


def keychain_set(account, value):
    if TEST_KEYS:
        try:
            keys = json.load(open(TEST_KEYS))
        except (OSError, ValueError):
            keys = {}
        keys[account] = value
        json.dump(keys, open(TEST_KEYS, "w"))
        return
    # -U updates an existing item; the value goes through argv, never a file or the log.
    subprocess.run(["security", "add-generic-password", "-U", "-s", SERVICE, "-a", account, "-w", value], capture_output=True, check=True)


def post_form(url, fields):
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def access_token():
    """A token good for a minute more, refreshed with the Keychain's refresh token when needed; None when not set up."""
    try:
        cached = json.load(open(TOKEN_FILE))
        if cached.get("expires_at", 0) > time.time() + 60:
            return cached["access_token"]
    except (OSError, ValueError, KeyError):
        pass
    client_id, refresh = keychain_get("client_id"), keychain_get("refresh_token")
    if not client_id or not refresh:
        return None
    tok = post_form(ACCOUNTS + "/api/token", {"grant_type": "refresh_token", "refresh_token": refresh, "client_id": client_id})
    if tok.get("refresh_token"):   # PKCE refresh tokens rotate
        keychain_set("refresh_token", tok["refresh_token"])
    os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
    fd = os.open(TOKEN_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump({"access_token": tok["access_token"], "expires_at": time.time() + int(tok.get("expires_in", 3600))}, f)
    return tok["access_token"]


def call(method, path, body=None, query=None):
    token = access_token()
    if not token:
        print("not set up: run dot-spotify-api.py login <client-id>")
        sys.exit(3)
    url = API + path + ("?" + urllib.parse.urlencode(query) if query else "")
    data = json.dumps(body).encode() if body is not None else (b"" if method in ("PUT", "POST") else None)
    req = urllib.request.Request(url, data=data, method=method, headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        try:
            reason = json.loads(e.read()).get("error", {}).get("message", "")
        except ValueError:
            reason = ""
        print(f"refused: {e.code} {reason}".strip())
        sys.exit(5)


def pick_device(devices, words):
    """The device his words name: "phone" is a Smartphone, "mac" or "computer" a Computer, "tv", "speaker"; else the
    name containing every word. None when nothing fits."""
    w = words.lower().strip()
    kinds = {"phone": "smartphone", "iphone": "smartphone", "mac": "computer", "computer": "computer", "laptop": "computer",
             "tv": "tv", "speaker": "speaker", "ipad": "tablet", "tablet": "tablet"}
    for word, kind in kinds.items():
        if word in w.split() or w == word:
            hits = [d for d in devices if (d.get("type") or "").lower() == kind]
            if hits:
                return sorted(hits, key=lambda d: not d.get("is_active"))[0]
    tokens = [t for t in w.replace("my ", "").split() if t]
    for d in devices:
        name = (d.get("name") or "").lower()
        if tokens and all(t in name for t in tokens):
            return d
    return None


def devices():
    return call("GET", "/me/player/devices").get("devices", [])


def login(client_id):
    verifier = secrets.token_urlsafe(64)[:96]
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(16)
    got = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            if q.get("state", [""])[0] == state:
                got["code"], got["error"] = q.get("code", [None])[0], q.get("error", [None])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<p style='font:16px -apple-system'>Dot is signed in to Spotify. You can close this tab.</p>")

        def log_message(self, *a):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 8899), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = ACCOUNTS + "/authorize?" + urllib.parse.urlencode({
        "client_id": client_id, "response_type": "code", "redirect_uri": REDIRECT, "scope": SCOPES,
        "code_challenge_method": "S256", "code_challenge": challenge, "state": state})
    subprocess.run(["open", url])
    deadline = time.time() + 180
    while "code" not in got and "error" not in got and time.time() < deadline:
        time.sleep(0.2)
    server.shutdown()
    if not got.get("code"):
        print(f"login-failed {got.get('error') or 'timeout'}")
        sys.exit(5)
    tok = post_form(ACCOUNTS + "/api/token", {"grant_type": "authorization_code", "code": got["code"], "redirect_uri": REDIRECT,
                                            "client_id": client_id, "code_verifier": verifier})
    keychain_set("client_id", client_id)
    keychain_set("refresh_token", tok["refresh_token"])
    print("ready")


def main(argv):
    if not argv:
        print(__doc__.strip().splitlines()[0])
        return 2
    cmd, rest = argv[0], argv[1:]
    if cmd == "login" and rest:
        login(rest[0])
    elif cmd == "status":
        if keychain_get("client_id") and keychain_get("refresh_token"):
            print("ready")
        else:
            print("not set up")
            return 3
    elif cmd == "devices":
        for d in devices():
            print(f"{d.get('id')}\t{d.get('name')}\t{d.get('type')}\t{'active' if d.get('is_active') else 'idle'}")
    elif cmd == "play" and rest:
        uri, where = rest[0], " ".join(rest[1:])
        query = None
        if where:
            d = pick_device(devices(), where)
            if not d:
                print(f"no device: {where}")
                return 4
            query = {"device_id": d["id"]}
            if not d.get("is_active"):
                call("PUT", "/me/player", {"device_ids": [d["id"]], "play": False})
                time.sleep(0.6)
        body = {"uris": [uri]} if uri.startswith("spotify:track:") else {"context_uri": uri}
        call("PUT", "/me/player/play", body, query)
        print(f"playing {uri}" + (f" on {d['name']}" if where else ""))
    elif cmd == "transfer" and rest:
        d = pick_device(devices(), " ".join(rest))
        if not d:
            print(f"no device: {' '.join(rest)}")
            return 4
        call("PUT", "/me/player", {"device_ids": [d["id"]], "play": True})
        print(f"moved to {d['name']}")
    elif cmd == "like":
        now = call("GET", "/me/player/currently-playing") or {}
        item = now.get("item") or {}
        if not item.get("id"):
            print("nothing playing")
            return 5
        call("PUT", "/me/tracks", query={"ids": item["id"]})
        print(f"liked {item.get('name', '')}")
    elif cmd == "queue" and rest:
        call("POST", "/me/player/queue", query={"uri": rest[0]})
        print(f"queued {rest[0]}")
    else:
        print("usage: login <client-id> | status | devices | play <uri> [device] | transfer <device> | like | queue <uri>")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]) or 0)
