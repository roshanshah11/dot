#!/usr/bin/env python3
"""One probe, two apps: reads the agent state each app left on this Mac and prints one
canonical line per claim, so a reconstruction claim compares like with like.

  agent_facts.py --app heyclicky|dot --claim <claim>

HeyClicky 1.0.53 (Codex 0.152.1 runtime) keeps its agents in
~/Library/Application Support/Clicky: projects/agents/<slug>/ (AGENTS.md, output/, tmp/),
CodexHome/sessions/**/rollout-*.jsonl (one Codex thread per agent), CodexHome/sqlite/logs_2.sqlite
(the app-server's own log, one process_uuid per app launch), HomeSpaceCache/transcript-*.json
(the per-turn record its Home shows), CodexHome/config.toml and cua-driver-policy.yaml.

Dot keeps them in ~/Dot/agents/<slug>/ (CLAUDE.md, output/, tmp/, .dot/transcript.jsonl;
archived agents under .archive/), Claude Code conversations in
~/.claude/projects/-Users-roshanshah-Dot-agents-<slug>/*.jsonl, its log in
~/Library/Logs/Dot/dot.log, agent MCP servers in ~/.config/dot/mcp.json and rules in
~/Dot/rules.json (absent = AgentRules.standard).

Each claim prints the same sentence shape for both apps; only observed facts fill it.
Exit 0 with the line, or exit 3 with "unknown: <reason>" when the records cannot answer.
"""
import argparse, datetime as dt, glob, json, os, re, sqlite3, sys

HOME = os.path.expanduser("~")
HC = os.path.join(HOME, "Library/Application Support/Clicky")
DOT_AGENTS = os.path.join(HOME, "Dot/agents")
DOT_LOG = os.path.join(HOME, "Library/Logs/Dot/dot.log")
CLAUDE_PROJECTS = os.path.join(HOME, ".claude/projects")


def ts(s):
    """ISO 8601 (Z or offset) to an aware datetime."""
    s = s.strip().replace("Z", "+00:00")
    return dt.datetime.fromisoformat(s)


def unknown(reason):
    print(f"unknown: {reason}")
    sys.exit(3)


# ---------------------------------------------------------------- HeyClicky adapter

def hc_agent_folders():
    return sorted(p for p in glob.glob(os.path.join(HC, "projects/agents/*")) if os.path.isdir(p))


def hc_rollouts():
    """Per Codex thread: cwd, id, turns [(start, end)], first user text, tool call names."""
    out = []
    for path in sorted(glob.glob(os.path.join(HC, "CodexHome/sessions/**/rollout-*.jsonl"), recursive=True)):
        meta, turns, started, first_user, tools = None, [], None, None, set()
        for line in open(path, encoding="utf-8"):
            try:
                r = json.loads(line)
            except ValueError:
                continue
            t, p = r.get("type"), r.get("payload") or {}
            if t == "session_meta" and meta is None:
                meta = p
            elif t == "event_msg" and p.get("type") == "task_started":
                started = ts(r["timestamp"])
            elif t == "event_msg" and p.get("type") == "task_complete" and started:
                turns.append((started, ts(r["timestamp"])))
                started = None
            elif t == "response_item":
                kind = p.get("type")
                if kind == "message" and p.get("role") == "user" and first_user is None:
                    first_user = " ".join(c.get("text", "") for c in p.get("content", []) if isinstance(c, dict))
                elif kind in ("function_call", "custom_tool_call", "local_shell_call", "web_search_call"):
                    tools.add(p.get("name") or kind)
        if meta:
            out.append({"cwd": meta.get("cwd"), "id": meta.get("id"), "turns": turns, "first_user": first_user or "", "tools": tools})
    return out


def hc_logs():
    db = os.path.join(HC, "CodexHome/sqlite/logs_2.sqlite")
    if not os.path.exists(db):
        unknown("no Codex log database")
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    return con.cursor()


# ---------------------------------------------------------------- Dot adapter

def dot_agent_folders():
    live = [p for p in glob.glob(os.path.join(DOT_AGENTS, "*")) if os.path.isdir(p)]
    archived = [p for p in glob.glob(os.path.join(DOT_AGENTS, ".archive/*")) if os.path.isdir(p)]
    return sorted(live + archived)


def dot_project_dir(slug):
    return os.path.join(CLAUDE_PROJECTS, "-" + os.path.join(DOT_AGENTS, slug).strip("/").replace("/", "-"))


def dot_conversations():
    """Per Claude Code conversation of a Dot agent: slug, cwd, human turns, tool names, path."""
    out = []
    for d in sorted(glob.glob(os.path.join(CLAUDE_PROJECTS, "-Users-*-Dot-agents-*"))):
        slug = d.rsplit("-Dot-agents-", 1)[1]
        for path in sorted(glob.glob(os.path.join(d, "*.jsonl"))):
            cwd, human, tools, text = None, [], set(), open(path, encoding="utf-8").read()
            for line in text.splitlines():
                try:
                    r = json.loads(line)
                except ValueError:
                    continue
                if cwd is None and r.get("cwd"):
                    cwd = r["cwd"]
                if cwd is None and isinstance(r.get("attachment"), dict):
                    cwd = (r["attachment"].get("snapshot") or {}).get("workingDirectory")
                m = r.get("message") or {}
                c = m.get("content")
                if r.get("type") == "user" and not r.get("isMeta") and not r.get("isSidechain"):
                    is_prompt = isinstance(c, str) or (isinstance(c, list) and any(x.get("type") == "text" for x in c)
                                                       and not any(x.get("type") == "tool_result" for x in c))
                    if is_prompt and r.get("timestamp"):
                        human.append(ts(r["timestamp"]))
                if r.get("type") == "assistant" and isinstance(c, list):
                    tools.update(x.get("name") for x in c if x.get("type") == "tool_use")
            out.append({"slug": slug, "cwd": cwd, "human": human, "tools": tools, "path": path, "text": text})
    return out


def dot_transcript_intervals():
    """Per agent: [(user ts, next result ts or None)] from .dot/transcript.jsonl."""
    out = {}
    for folder in dot_agent_folders():
        path = os.path.join(folder, ".dot/transcript.jsonl")
        if not os.path.exists(path):
            continue
        rows = []
        for line in open(path, encoding="utf-8"):
            try:
                rows.append(json.loads(line))
            except ValueError:
                pass
        spans, open_start = [], None
        for r in rows:
            if r.get("role") == "user" and open_start is None:
                open_start = ts(r["ts"])
            elif r.get("role") == "result" and open_start is not None:
                spans.append((open_start, ts(r["ts"])))
                open_start = None
        name = os.path.basename(folder).split("-2026-")[0]
        out[name] = spans
    return out


def dot_launches():
    pat = re.compile(r"^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+) INFO Dot \S+ launching")
    local = dt.datetime.now().astimezone().tzinfo
    out = []
    for line in open(DOT_LOG, encoding="utf-8", errors="replace"):
        m = pat.match(line)
        if m:
            out.append(dt.datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S.%f").replace(tzinfo=local))
    return out


def dot_cua_tools():
    """Ask the computer-use MCP server named in ~/.config/dot/mcp.json for its tools (initialize, tools/list)."""
    import select, subprocess, time
    mcp = json.load(open(os.path.join(HOME, ".config/dot/mcp.json"), encoding="utf-8"))["mcpServers"]
    entry = next((v for v in mcp.values() if "cua-driver" in v.get("command", "")), None)
    if not entry:
        return set()
    p = subprocess.Popen([entry["command"], *entry.get("args", [])], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.DEVNULL, text=True)
    def send(o):
        p.stdin.write(json.dumps(o) + "\n"); p.stdin.flush()
    def recv(i, timeout=20):
        end = time.time() + timeout
        while time.time() < end:
            if select.select([p.stdout], [], [], 0.5)[0]:
                line = p.stdout.readline()
                if not line:
                    return None
                try:
                    o = json.loads(line)
                except ValueError:
                    continue
                if o.get("id") == i:
                    return o
    send({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "agent_facts", "version": "1"}}})
    recv(1)
    send({"jsonrpc": "2.0", "method": "notifications/initialized"})
    send({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    listed = recv(2) or {}
    p.terminate()
    return {t["name"] for t in (listed.get("result") or {}).get("tools", [])}


def hc_cua_allowed():
    """HeyClicky's computer-use surface: the tools enabled for agents in config.toml."""
    cfg = open(os.path.join(HC, "CodexHome/config.toml"), encoding="utf-8").read()
    m = re.search(r'\[mcp_servers\.computer-use\][^\[]*enabled_tools\s*=\s*\[([^\]]*)\]', cfg, re.S)
    return set(re.findall(r'"([a-z_]+)"', m.group(1))) if m else set()


def claim_computer_use_envelope(app):
    """Whether the computer-use surface refuses the inputs that act outside the agent's own window:
    moving his real pointer (desktop-scope input), killing apps, reading the clipboard, running scripts."""
    risky = {"kill_app", "clipboard_read", "run_script", "move_cursor", "drag", "install_extension", "set_config"}
    if app == "heyclicky":
        exposed = hc_cua_allowed()
        rego = open(os.path.join(HC, "cua-driver-managed-policy.rego"), encoding="utf-8").read()
        desktop_refused = 'input.arguments.scope == "desktop"' in rego and "default allow := false" in rego
    else:
        # Round seven: AgentManager.disallowedAgentTools keeps the script runner and extension installer from agents.
        exposed = dot_cua_tools() - {"run_script", "install_extension"}
        desktop_refused = False  # ~/.cua-driver holds no policy; get_config shows none
    if not exposed:
        unknown("no computer-use tools found")
    fenced = desktop_refused and not (exposed & risky)
    return f"computer-use surface fenced to background input in the app's own windows: {'yes' if fenced else 'no'}"


# ---------------------------------------------------------------- claims

def every(flags):
    return "every one" if flags and all(flags) else "not every one"


def claim_spawn_workspace(app):
    if app == "heyclicky":
        folders, ident = hc_agent_folders(), "AGENTS.md"
    else:
        folders, ident = dot_agent_folders(), "CLAUDE.md"
    if not folders:
        unknown("no agent folders")
    has_id = [os.path.isfile(os.path.join(f, ident)) for f in folders]
    has_out = [os.path.isdir(os.path.join(f, "output")) for f in folders]
    has_tmp = [os.path.isdir(os.path.join(f, "tmp")) for f in folders]
    return (f"agent workspaces: identity file in {every(has_id)}; output/ in {every(has_out)}; "
            f"tmp/ in {every(has_tmp)}")


def claim_identity_in_context(app):
    if app == "heyclicky":
        convs = hc_rollouts()
        flags = [c["first_user"].startswith(f"# AGENTS.md instructions for {c['cwd']}") for c in convs]
    else:
        convs = dot_conversations()
        # Claude Code's claudeMd context; it must arrive with the first prompt of the conversation.
        flags = []
        for c in convs:
            needle = f"Contents of {c['cwd']}/CLAUDE.md"
            pos = c["text"].find(needle)
            first_assistant = c["text"].find('"type":"assistant"')
            flags.append(pos != -1 and (first_assistant == -1 or pos < first_assistant))
    if not convs:
        unknown("no recorded agent conversations")
    return f"identity file in the agent's context before its first reply: {every(flags)}"


def claim_conversation_rooted(app):
    if app == "heyclicky":
        roots = set(hc_agent_folders())
        convs = hc_rollouts()
        flags = [os.path.normpath(c["cwd"] or "") in roots for c in convs]
    else:
        roots = {os.path.join(DOT_AGENTS, os.path.basename(f).split("-2026-")[0]) for f in dot_agent_folders()}
        convs = dot_conversations()
        flags = [os.path.normpath(c["cwd"] or "") in roots for c in convs]
    if not convs:
        unknown("no recorded agent conversations")
    return f"recorded agent conversations rooted at their agent's workspace: {every(flags)}"


def claim_follow_up(app):
    if app == "heyclicky":
        convs = hc_rollouts()
        multi = any(len(c["turns"]) >= 2 for c in convs)
    else:
        convs = dot_conversations()
        multi = any(len(c["human"]) >= 2 for c in convs)
    if not convs:
        unknown("no recorded agent conversations")
    return f"a later request to the same agent continued its conversation: {'yes' if multi else 'no'}"


def overlaps(a, b):
    return a[0] < b[1] and b[0] < a[1]


def claim_concurrent(app):
    if app == "heyclicky":
        spans = {c["id"]: c["turns"] for c in hc_rollouts()}
    else:
        now = dt.datetime.now(dt.timezone.utc)
        spans = dot_transcript_intervals()
    names = sorted(spans)
    hit = any(overlaps(x, y) for i, a in enumerate(names) for b in names[i + 1:] for x in spans[a] for y in spans[b])
    if len(names) < 2:
        unknown("fewer than two agents with recorded turns")
    return f"two agents had turns in flight at the same time: {'yes' if hit else 'no'}"


def claim_resume_after_restart(app):
    if app == "heyclicky":
        cur = hc_logs()
        started, resumed = {}, []
        for body, proc in cur.execute("select feedback_log_body, process_uuid from logs where feedback_log_body like '%rpc.method=\"thread/%'"):
            m = re.search(r'rpc\.method="(thread/start|thread/resume)".*?thread_id=([0-9a-f-]{36})', body or "")
            if not m:
                continue
            if m.group(1) == "thread/start":
                started.setdefault(m.group(2), proc)
            else:
                resumed.append((m.group(2), proc))
        hit = any(tid in started and started[tid] != proc for tid, proc in resumed)
        if not started:
            unknown("no thread/start in the app-server log")
    else:
        launches = dot_launches()
        hit = False
        for c in dot_conversations():
            h = sorted(c["human"])
            hit |= any(any(a < l < b for l in launches) for a, b in zip(h, h[1:]))
        if not launches:
            unknown("no launches in dot.log")
    return f"an agent's conversation continued after the app restarted: {'yes' if hit else 'no'}"


SHELL = {"heyclicky": {"exec_command", "local_shell_call", "shell"}, "dot": {"Bash"}}
WEB = {"heyclicky": {"web_search_call"}, "dot": {"WebSearch"}}


def claim_shell_and_web(app):
    tools = set()
    for c in (hc_rollouts() if app == "heyclicky" else dot_conversations()):
        tools |= c["tools"]
    if not tools:
        unknown("no recorded tool calls")
    return (f"recorded agent runs used a shell: {'yes' if tools & SHELL[app] else 'no'}; "
            f"searched the web: {'yes' if tools & WEB[app] else 'no'}")


def claim_turn_record(app):
    """Which per-turn fields the app keeps for its Home/notch: canonical names, observed schema."""
    fields = []
    if app == "heyclicky":
        files = glob.glob(os.path.join(HC, "HomeSpaceCache/transcript-*.json"))
        if not files:
            unknown("no HomeSpaceCache transcripts")
        keys = set()
        for f in files:
            for turn in json.load(open(f, encoding="utf-8")):
                keys |= set(turn)
        mapping = [("summary", "assistantMessages"), ("steps", "reasoningSteps"), ("next actions", "suggestedNextActions"),
                   ("artifacts", "artifactEntries"), ("failure flag", "didFail"), ("interruption flag", "wasInterrupted")]
        fields = [name for name, key in mapping if key in keys]
    else:
        roles = set()
        files = glob.glob(os.path.join(DOT_AGENTS, "*/.dot/transcript.jsonl")) + glob.glob(os.path.join(DOT_AGENTS, ".archive/*/.dot/transcript.jsonl"))
        if not files:
            unknown("no Dot transcripts")
        results = []
        for f in files:
            for line in open(f, encoding="utf-8"):
                try:
                    r = json.loads(line)
                except ValueError:
                    continue
                roles.add(r.get("role"))
                if r.get("role") == "result":
                    results.append(r.get("text", ""))
        # AgentManager.finished writes "<subtype> in <ms> ms, $<cost>": the subtype (success, error_*) marks a failed turn.
        has_fail = any(re.match(r"^(success|error_\w+) in \d+ ms", t) for t in results)
        has_stop = any(t.startswith("stopped") for t in results)
        mapping = [("summary", "assistant" in roles), ("steps", "tool" in roles), ("next actions", "next" in roles),
                   ("artifacts", "artifact" in roles), ("failure flag", has_fail), ("interruption flag", has_stop)]
        fields = [name for name, present in mapping if present]
    return "per-turn record keeps: " + ", ".join(fields)


def claim_computer_use_configured(app):
    if app == "heyclicky":
        cfg = open(os.path.join(HC, "CodexHome/config.toml"), encoding="utf-8").read()
        m = re.search(r'\[mcp_servers\.computer-use\][^\[]*enabled_tools\s*=\s*\[([^\]]*)\]', cfg, re.S)
        tools = set(re.findall(r'"([a-z_]+)"', m.group(1))) if m else set()
        server = bool(m)
    else:
        tools = dot_cua_tools()
        server = bool(tools)
    has_input = {"click", "type_text"} <= tools
    return f"agents have computer-use tools that click and type in apps: {'yes' if server and has_input else 'no'}"


def claim_computer_use_gate(app):
    """Whether, by the shipped/current configuration, an agent's click or keystroke into an app
    needs his yes for that turn before it runs."""
    if app == "heyclicky":
        # The policy file HeyClicky writes says so in its header comment (wrapped over two lines),
        # and the shipped binary carries the gate's refusal text for input tools.
        policy = open(os.path.join(HC, "cua-driver-policy.yaml"), encoding="utf-8").read()
        header = " ".join(line.lstrip("#").strip() for line in policy.splitlines() if line.startswith("#"))
        binary = "/Volumes/HeyClicky/HeyClicky.app/Contents/MacOS/HeyClicky"
        if not os.path.exists(binary):
            unknown("HeyClicky.app is not mounted at /Volumes/HeyClicky")
        with open(binary, "rb") as f:
            refusal = b"computer use input is off until the user allows this turn" in f.read()
        gated = "Per-turn consent is enforced in front of the daemon" in header and refusal
    else:
        rules_path = os.path.join(HOME, "Dot/rules.json")
        if os.path.exists(rules_path):
            rules = json.load(open(rules_path, encoding="utf-8"))
            behavior = (rules.get("defaults") or {}).get("computer", "act")
        else:
            behavior = "act"  # AgentRules.standard: computer -> .act
        gated = behavior in ("ask", "ifAsked", "mine")
    return f"an agent's clicks and keystrokes in his apps need his yes for that turn: {'yes' if gated else 'no'}"


CLAIMS = {
    "spawn.workspace": claim_spawn_workspace,
    "spawn.identity-in-context": claim_identity_in_context,
    "spawn.conversation-rooted": claim_conversation_rooted,
    "manage.follow-up": claim_follow_up,
    "manage.concurrent": claim_concurrent,
    "manage.resume-after-restart": claim_resume_after_restart,
    "manage.turn-record": claim_turn_record,
    "capability.shell-and-web": claim_shell_and_web,
    "capability.computer-use": claim_computer_use_configured,
    "capability.computer-use-gate": claim_computer_use_gate,
    "capability.computer-use-envelope": claim_computer_use_envelope,
}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--app", choices=["heyclicky", "dot"], required=True)
    ap.add_argument("--claim", choices=sorted(CLAIMS), required=True)
    ap.add_argument("--hold", type=float, default=0.0, help="seconds to stay alive after printing, so a process capture can sample this process")
    a = ap.parse_args()
    print(CLAIMS[a.claim](a.app), flush=True)
    if a.hold:
        import time
        time.sleep(a.hold)
