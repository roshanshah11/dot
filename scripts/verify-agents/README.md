# Agent verification kit

The checks behind docs/heyclicky-agents-verification.md. Run everything from the repo root.

**agent_facts.py**: one probe, two apps. It reads the agent records HeyClicky and Dot left on this
Mac and prints one sentence per claim, so both apps are judged by the same code. It only reads.

    python3.13 scripts/verify-agents/agent_facts.py --app heyclicky|dot --claim <claim>

Claims: spawn.workspace, spawn.identity-in-context, spawn.conversation-rooted, manage.follow-up,
manage.concurrent, manage.resume-after-restart, manage.turn-record, capability.shell-and-web,
capability.computer-use, capability.computer-use-gate, capability.computer-use-envelope. It exits 3
with "unknown: <reason>" when the records cannot answer.

**decision-replay**: what Dot does with one agent tool call, AgentRules first and then
ConsentPolicy, in AgentManager.permission's order. It compiles with Dot's own DotKit; the policy is
built the way AgentManager.consentPolicy(for:) builds it, so keep the two in step.

    swiftc -O -o "${TMPDIR:-/tmp}/dot-decision-replay" Sources/DotKit/*.swift scripts/verify-agents/decision-replay/main.swift
    "${TMPDIR:-/tmp}/dot-decision-replay"

**dot_agent_runtime.py**: Dot's agent launch replayed outside Dot, with Dot's claude arguments, MCP
config and prompt (round seven: default permission mode, background tasks off, the computer-use
script runner and extension installer disallowed; `DOT_PROBE_MODE=acceptEdits` replays round six),
every permission request declined. Generate the prompt first:

    swiftc -O -o "${TMPDIR:-/tmp}/dot-gen-prompts" Sources/DotKit/*.swift Sources/Dot/Brain/Prompts.swift scripts/verify-agents/gen-prompts/main.swift
    P="${TMPDIR:-/tmp}/dot-prompts"; mkdir -p "$P"
    "${TMPDIR:-/tmp}/dot-gen-prompts" append Probe > "$P/append.txt"
    "${TMPDIR:-/tmp}/dot-gen-prompts" claudemd Probe > "$P/claudemd.txt"
    DOT_PROBE_PROMPTS="$P" python3.13 scripts/verify-agents/dot_agent_runtime.py

It is one real Opus turn on his account (about $0.25) with every MCP server his Claude Code loads.
With `DOT_PROBE_ANSWER=allow DOT_PROBE_RECORD=<file>` and a brief that stays in its own folder, it
allows every request and records them; `evaluate-requests` then says which of them Dot's rules would
have shown as a card (round seven's friction check: an ordinary task raised 5 requests and 0 cards):

    swiftc -O -o "${TMPDIR:-/tmp}/dot-evaluate" Sources/DotKit/*.swift scripts/verify-agents/evaluate-requests/main.swift
    "${TMPDIR:-/tmp}/dot-evaluate" <file>
Steps Claude Code approves by itself still run, so keep briefs to scratch paths; the default
`--add-dir` is an empty scratch folder, not ~/roshan. The other settings (`DOT_PROBE_BRIEF`,
`DOT_PROBE_ADD_DIR`, `DOT_PROBE_WATCH`) are in the script's header.

**In the app.** `Dot --selftest` checks the notch's permission-card queue in a throwaway notch (no
agents, no model, no chime). `Dot --ask --dry "<what he might say>"` runs the routing and the talk
turn but only logs the route and the tags (`dry-run:` lines in ~/Library/Logs/Dot/dot.log): no agent
is started, told, stopped or answered. Both need a build from round seven on.

**Under REA.** Each claim was captured once per app with `capture_process_scenario` (executable
/opt/homebrew/bin/python3.13, arguments `agent_facts.py --app <app> --claim <claim>`, working
directory this folder, terminal 240x10 with 50 lines of scrollback, timeouts 60000 ms, normalization
`time_bucket_ms: 60000`), and each pair compared with `compare_process_captures`, passing both
capture records back whole. On macOS REA signs a fail when the sentences differ and "unknown" when
they match (settlement time and sampled process trees never agree), never a pass.
