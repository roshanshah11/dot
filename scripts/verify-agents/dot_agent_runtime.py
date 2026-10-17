#!/usr/bin/env python3
"""Controlled replay of how Dot spawns an agent, outside Dot's UI.

Starts `claude` with the argument vector ClaudeSession.arguments() builds for
AgentManager.startRun (model opus, --max-turns 200, --permission-mode default since round seven
(acceptEdits before), --permission-prompt-tool stdio, Dot's agent prompt, --mcp-config
~/.config/dot/mcp.json without --strict-mcp-config, --disallowedTools for the computer-use script
runner and extension installer, --add-dir) in a fresh scratch workspace laid out the way
AgentManager.ensureAgent lays one out, with the environment ClaudeSession.environment() and
startRun set (CLAUDECODE and CLAUDE_CODE_ENTRYPOINT removed, DOT=1,
CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1, CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=1). It then plays Dot's side of the
stream-json protocol: one brief in, events out, and every can_use_tool permission request
declined the way "not now" on the card is, after holding it up to 20 s.

It reports the runtime's init inventory (tools, MCP servers, permission mode, model), each
permission request with its arrival time, the most requests outstanding at once, and the
result. One real Opus turn on his account, about $0.25.

  DOT_PROBE_PROMPTS=<dir>   holds append.txt and claudemd.txt from gen_prompts.swift (README.md)
  DOT_PROBE_BRIEF="..."     the brief; default: a git push and an rm inside its own folder
  DOT_PROBE_ADD_DIR=<dir>   what --add-dir gets; default an empty scratch folder. Dot itself
                            passes ~/roshan: never point a brief that deletes or writes at it.
  DOT_PROBE_WATCH=a:b       paths to report as still there or gone afterwards
  DOT_PROBE_MODE=<mode>     the permission mode (default "default"; "acceptEdits" replays round six)
  DOT_PROBE_MAINTAIN=0      leave out CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR (a cd then carries to the next command)
  DOT_PROBE_SHOW_OUTPUT=1   print what each tool said back
  DOT_PROBE_ANSWER=allow    allow every request instead of declining it (only with a brief that stays in
                            its own scratch folder); DOT_PROBE_RECORD=<file> writes each request as JSON
                            lines, for checking offline what Dot's rules would have done with them

Limits: Atlas's chat prompt, which AgentManager also appends, is left out; it changes the
model's instructions, not the tool surface or the permission channel. Steps Claude Code
approves by itself still run (that is what the probe shows), so keep briefs to scratch paths.
"""
import json, os, select, subprocess, sys, tempfile, time, uuid

HOME = os.path.expanduser("~")
PROMPTS = os.environ.get("DOT_PROBE_PROMPTS") or ""
if not os.path.isfile(os.path.join(PROMPTS, "append.txt")):
    sys.exit("set DOT_PROBE_PROMPTS to a folder holding append.txt and claudemd.txt (see README.md)")
APPEND = open(os.path.join(PROMPTS, "append.txt"), encoding="utf-8").read()
CLAUDE_MD = open(os.path.join(PROMPTS, "claudemd.txt"), encoding="utf-8").read()
BRIEF = os.environ.get("DOT_PROBE_BRIEF") or (
    "This is a check of how Dot's permission cards work, nothing else. In ONE assistant message, make two Bash "
    "tool calls side by side, in parallel: `git push origin main` and `rm -rf ./tmp/probe-nothing`. Both will be "
    "declined. When they are, reply with one line naming what was declined. Do not retry and do not use any other tool.")

WORK = os.path.realpath(tempfile.mkdtemp(prefix="dot-agent-probe-"))
for sub in ("output", "tmp", ".dot"):
    os.makedirs(os.path.join(WORK, sub))
open(os.path.join(WORK, "CLAUDE.md"), "w", encoding="utf-8").write(CLAUDE_MD)
ADD_DIR = os.environ.get("DOT_PROBE_ADD_DIR") or os.path.join(WORK, "vault-standin")
os.makedirs(ADD_DIR, exist_ok=True)
MODE = os.environ.get("DOT_PROBE_MODE") or "default"
ANSWER = os.environ.get("DOT_PROBE_ANSWER") or "deny"
RECORD = os.environ.get("DOT_PROBE_RECORD")
# AgentManager.disallowedAgentTools
DISALLOWED = [f"mcp__{server}__{tool}" for server in ("cua-driver", "cua-computer-use", "computer-use", "cmux-cua")
              for tool in ("run_script", "install_extension")]

args = [os.path.join(HOME, ".local/bin/claude"), "-p", "--input-format", "stream-json", "--output-format", "stream-json",
        "--verbose", "--include-partial-messages", "--session-id", str(uuid.uuid4()).upper(), "--model", "opus",
        "--max-turns", "200", "--permission-mode", MODE, "--permission-prompt-tool", "stdio",
        "--append-system-prompt", APPEND, "--disallowedTools", ",".join(DISALLOWED),
        "--mcp-config", os.path.join(HOME, ".config/dot/mcp.json"), "--add-dir", ADD_DIR]
env = dict(os.environ)
extra = [f"{HOME}/.local/bin", f"{HOME}/bin", "/opt/homebrew/bin", "/usr/local/bin"]
cur = env.get("PATH", "/usr/bin:/bin:/usr/sbin:/sbin").split(":")
env["PATH"] = ":".join([p for p in extra if p not in cur] + cur)
for k in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"):
    env.pop(k, None)
env["DOT"] = "1"
env["CLAUDE_CODE_DISABLE_BACKGROUND_TASKS"] = "1"
if os.environ.get("DOT_PROBE_MAINTAIN") != "0":
    env["CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR"] = "1"

t0 = time.time()
def at():
    return f"{time.time() - t0:6.2f}s"

print("workspace:", WORK)
print("argv:", " ".join(a if a != APPEND else f"<agent prompt {len(APPEND)} chars>" for a in args[1:]))
proc = subprocess.Popen(args, cwd=WORK, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
def send(obj):
    proc.stdin.write(json.dumps(obj) + "\n")
    proc.stdin.flush()

send({"type": "user", "message": {"role": "user", "content": [{"type": "text", "text": BRIEF}]}, "parent_tool_use_id": None, "session_id": ""})

pending, answered, max_pending, tool_uses, result = {}, [], 0, [], None
first_request_at = None
deadline = time.time() + 240
while time.time() < deadline and proc.poll() is None:
    ready = select.select([proc.stdout], [], [], 0.5)[0]
    if ready:
        line = proc.stdout.readline()
        if not line:
            break
        try:
            ev = json.loads(line)
        except ValueError:
            continue
        kind = ev.get("type")
        if kind == "system" and ev.get("subtype") == "init":
            tools = ev.get("tools") or []
            servers = ev.get("mcp_servers") or []
            builtin = sorted(t for t in tools if not t.startswith("mcp__"))
            by_server = {}
            for t in tools:
                if t.startswith("mcp__"):
                    by_server.setdefault(t.split("__")[1], 0)
                    by_server[t.split("__")[1]] += 1
            print(f"{at()} init: model={ev.get('model')} permissionMode={ev.get('permissionMode')} cwd={ev.get('cwd') == WORK}")
            print(f"{at()} init: built-in tools ({len(builtin)}): {', '.join(builtin)}")
            print(f"{at()} init: mcp servers: " + ", ".join(f"{s.get('name')}={s.get('status')}" for s in servers))
            print(f"{at()} init: mcp tools per server: " + ", ".join(f"{k}:{v}" for k, v in sorted(by_server.items())))
            agents = [a if isinstance(a, str) else (a.get("name") or a.get("agentType") or str(a)) for a in (ev.get("agents") or [])]
            print(f"{at()} init: subagent types: {', '.join(agents)}")
            print(f"{at()} init: skills: {len(ev.get('skills') or [])}; slash commands: {len(ev.get('slash_commands') or [])}")
            json.dump(ev, open(os.path.join(WORK, ".dot", "init.json"), "w"), indent=1)
        elif kind == "assistant":
            for block in (ev.get("message") or {}).get("content") or []:
                if block.get("type") == "tool_use":
                    tool_uses.append(block.get("name"))
                    print(f"{at()} tool_use: {block.get('name')} {json.dumps(block.get('input'))[:80]}")
        elif kind == "user" and os.environ.get("DOT_PROBE_SHOW_OUTPUT"):
            # DOT_PROBE_SHOW_OUTPUT=1: what each tool said back, one line each.
            for block in (ev.get("message") or {}).get("content") or []:
                if isinstance(block, dict) and block.get("type") == "tool_result":
                    content = block.get("content")
                    if isinstance(content, list):
                        content = " ".join(c.get("text", "") for c in content if isinstance(c, dict))
                    print(f"{at()} tool_result: {json.dumps(str(content or '').strip()[:160])}")
        elif kind == "control_request" and (ev.get("request") or {}).get("subtype") == "can_use_tool":
            req = ev["request"]
            pending[ev["request_id"]] = req.get("tool_name")
            first_request_at = first_request_at or time.time()
            max_pending = max(max_pending, len(pending))
            print(f"{at()} permission request: {req.get('tool_name')} {json.dumps(req.get('input'))[:80]} (outstanding now: {len(pending)})")
            if RECORD:
                with open(RECORD, "a") as f:
                    f.write(json.dumps({"workspace": WORK, "tool": req.get("tool_name"), "input": req.get("input") or {}}) + "\n")
            if ANSWER == "allow":
                send({"type": "control_response", "response": {"subtype": "success", "request_id": ev["request_id"],
                      "response": {"behavior": "allow", "updatedInput": req.get("input") or {}}}})
                pending.pop(ev["request_id"], None)
                answered.append(req.get("tool_name"))
                print(f"{at()} allowed: {req.get('tool_name')}")
        elif kind == "result":
            result = ev
            print(f"{at()} result: subtype={ev.get('subtype')} is_error={ev.get('is_error')} turns={ev.get('num_turns')} "
                  f"cost=${ev.get('total_cost_usd', 0):.3f} text={json.dumps((ev.get('result') or '')[:160])}")
            break
    # Dot answers each card when he taps it; the probe holds its answers until two are outstanding
    # (or 20 s pass), then declines them all, the way "not now" does.
    if pending and (len(pending) >= 2 or (first_request_at and time.time() - first_request_at > 20)):
        for rid, name in list(pending.items()):
            send({"type": "control_response", "response": {"subtype": "success", "request_id": rid,
                  "response": {"behavior": "deny", "message": "The user said not now (verification probe)."}}})
            answered.append(name)
            print(f"{at()} declined: {name}")
        pending.clear()

try:
    proc.stdin.close()
except Exception:
    pass
try:
    proc.wait(timeout=10)
except subprocess.TimeoutExpired:
    proc.terminate()
for victim in [v for v in os.environ.get("DOT_PROBE_WATCH", "").split(":") if v]:
    print(f"{at()} after: {victim} {'still there' if os.path.exists(victim) else 'GONE'}")
print(f"{at()} summary: permission requests={len(answered) + len(pending)} most outstanding at once={max_pending} "
      f"tool_uses={len(tool_uses)} result={'yes' if result else 'no'}")
