# Do Dot's agents act like HeyClicky's? A per-claim verification

His ask 2026-10-16, through REA's verify_reconstruction: check the build "especially within the
agent's abilities itself. not just visually. also from how agents are spawned, managed, and
capabilties (+ the more stuff we added)". docs/heyclicky-verification.md covers the notch and the
visuals; this ledger covers the agents: how one starts, how it is managed while it works, what it can
do, and what it may do without asking him. Round seven (built overnight 2026-10-16 to 10-17) fixed F1
to F4, a fifth defect found on the way (F5), and built G1 to G3: section 10 has the state after it. Checked against HeyClicky 1.0.53 (its bundled Codex 0.152.1
runtime) and Dot at e1bb539 (round six) on 2026-10-16. Times are Chicago time.

**Evidence codes.** R = records on his Mac. HeyClicky: ~/Library/Application Support/Clicky (two
Clickys, their Codex threads, the app-server's own log CodexHome/sqlite/logs_2.sqlite, the Home
transcripts). Dot: ~/Dot/agents/*/.dot/transcript.jsonl (four agents, three of them archived on 10/16),
the agents' Claude Code conversations, ~/Library/Logs/Dot/dot.log, ~/Dot/ledger.sqlite.
P = the shared probe, scripts/verify-agents/agent_facts.py (sha256 741a44a8…): one script reads both
apps' records and prints the same sentence for a claim, so the two apps are judged by the same code.
X = controlled replays: Dot's agent launch run outside Dot with Dot's own arguments, MCP config and
prompt, every permission request declined (dot_agent_runtime.py); Dot's permission decision for a tool
call, from DotKit's own classifier and policy (decision-replay); `codex features list` from
HeyClicky's bundled runtime with an empty CODEX_HOME.
S = source and shipped files: Dot file:line at e1bb539; HeyClicky's CodexHome/config.toml, its
cua-driver policy files, prompts and binary strings; the vendor changelog quoted in docs/agents.md.
T = Dot's unit tests: 18 agent tests (AgentRules, AlwaysAsk, ConsentPolicy, Routines, AgentResult,
StreamJSON), all pass.

**About the REA verifier.** All 11 probe claims were captured on both apps with
`capture_process_scenario` under one comparison contract, compared with `compare_process_captures`
and verified together: 0 pass, 3 fail, 8 unknown. On macOS, REA 6.5.0 can sign a fail here but not a
pass: its exit comparison includes settlement time (115 ms against 146 ms for the same sentence) and it
samples process trees, so identical output still comes back "unknown". The 8 unknowns are exactly the
claims where both apps printed the same sentence; this ledger calls them "match" on the probe's
evidence, not on REA's signature. The 3 fails are REA-signed. The replays ran under REA too; every
evidence ID is in section 8.

Totals: 11 probe claims, 8 match and 3 fail. Beyond the probe: 3 confirmed defects with dated records
or replays (F1 to F3), a set of consent holes (F4), 4 gaps to build, 1 difference by his call, 8
additions verified. 5 open unknowns are recorded with REA; 1 more was resolved by a replay.

## 1. Starting an agent

| # | HeyClicky | Evidence | Dot | Verdict |
|---|---|---|---|---|
| 1.1 | Each Clicky has its own folder: AGENTS.md (who it is), output/, tmp/ | R projects/agents/<slug> | ~/Dot/agents/<slug>: CLAUDE.md, output/, tmp/, .dot/ (AgentManager.ensureAgent, line 158) | match (P) |
| 1.2 | The identity file is in the agent's context before its first reply | R every Codex thread | R every Claude Code conversation | match (P) |
| 1.3 | Each conversation runs in the agent's own folder | R | R (cwd ~/Dot/agents/<slug>) | match (P) |
| 1.4 | One Codex app-server per app launch, one thread per Clicky (thread/start, thread/resume, turn/start over JSON-RPC) | R logs_2.sqlite | one `claude -p` stream-json process per agent, resumed by session id | same shape, own runtime |
| 1.5 | gpt-6-luna, reasoning high | S config.toml | Opus (claude-opus-5-5 in X) | his choice |
| 1.6 | Founded by voice, several in one ask, up to five | S changelog; the sessions_spawn voice tool | `[NEW_AGENT:name:brief]`, one per agent, up to five; `[AGENT:brief]` goes to the default agent "Dot" (Talk.swift:1782-1785, AgentManager.swift:182); live on 10/16 at 15:24, "agent[homework] handoff: You were just created for this" | match |

## 2. Managing agents while they work

| # | HeyClicky | Evidence | Dot | Verdict |
|---|---|---|---|---|
| 2.1 | A later request to the same agent continues its conversation | R | R (`--resume`) | match (P) |
| 2.2 | Two agents can work at the same time | R | R | match (P) |
| 2.3 | An agent's conversation continues after the app restarts | R | R; resumed within 12 h (AgentManager.swift:244) | match (P); a turn that was running when the app quit is lost (2.6) |
| 2.4 | Each finished turn keeps a summary, steps, next actions, artifacts, a failure flag and an interruption flag | R Home transcripts | summary, steps, failure flag, interruption flag; NEXT lines become buttons (AgentResult.swift:9-16) but next actions and artifacts are not kept with the turn | fail (REA), to build |
| 2.5 | Two agents asking him at the same time: both questions stay answerable | not observed | one card slot: the second card replaces the first, which is never answered, and that agent waits until stopped | fail: defect F1 |
| 2.6 | The app quits while a turn runs | not observed | the turn is lost without a record and the old agent process keeps working unseen | fail: defect F2 |
| 2.7 | A follow-up during a turn goes into that turn (app-server turn/steer; runtime feature `steer` on) | S, X | queued until the turn ends (AgentManager.handoff: "is still busy; queued") | gap; HeyClicky's side is static evidence only |
| 2.8 | Talking to a named agent by voice ("tell Launch Scout I like this shirt too"; the sessions_send voice tool) | S | `[AGENT]` always goes to the default agent; a named agent is reached only if the model reuses its exact name in `[NEW_AGENT]`, which the prompt frames as founding one (Prompts.swift:74); Jev's follow-up route picks the most recently started running agent (Talk.swift:1221, 1284; AgentManager.swift:61-64); talk's agents line lists only agents working now or finished in the last 45 minutes (AgentManager.recentRuns, line 75) | fail, to build |
| 2.9 | Stop or approve by voice (sessions_interrupt, sessions_answer_request; "by voice too") | S | clicks only; the talk prompt says "a stop is his to click on the card, say so" (Prompts.swift:79) | fail, to build |
| 2.10 | Idle agents close; threads can be archived (thread/archive) | S | the process closes after 15 idle minutes (config agentIdleMinutes); archived agents move to ~/Dot/agents/.archive/<slug>-<date> (AgentManager.archive, line 527; three on 10/16) | match |
| 2.11 | Routines: first run at once, then every N minutes or hours; later runs report only what is new; three failures in a row pause one | S prompts, changelog | daily, weekdays, weekly or every N hours; the first run waits for the next slot (Routines.swift:172); three failures pause; T 5 tests | partial; neither app has ever run one (dot.log "routines: 0 on file, 0 active"; none on file in HeyClicky) |
| 2.12 | Helpers inside an agent (Codex `multi_agent` on) | X | the Agent tool, Opus general-purpose helpers, two at most by prompt (Prompts.swift:130); used twice in recorded runs (R) | Dot seen working; HeyClicky not observed |

## 3. What an agent can do

| # | HeyClicky | Evidence | Dot | Verdict |
|---|---|---|---|---|
| 3.1 | Shell commands and web search | R | R | match (P) |
| 3.2 | Computer-use tools that click and type in apps | S config.toml | cua-driver in every agent: 60 tools (X) | match (P) |
| 3.3 | Clicks and keystrokes in his apps need his yes for that turn (Allow once, Always allow, Not now) | S the binary's refusal text, the gate on 127.0.0.1:63478; never seen at runtime | no gate: driving apps runs on its own, by his call on 2026-10-15 ("give dots more permissions it asks me for everything"); a click whose input names a send, a purchase or a delete still asks | fail (REA), his call |
| 3.4 | The computer-use surface is fenced: 16 tools (check_permissions, click, get_config, get_screen_size, get_window_state, health_report, hotkey, launch_app, list_apps, list_windows, page, press_key, right_click, scroll, set_value, type_text), background-only input, a rego deny list | S config.toml, cua-driver-policy.yaml, the managed rego | all 60 cua-driver tools, among them run_script, kill_app, clipboard_read and clipboard_write, browser_navigate, browser_click, browser_type, install_extension, desktop-scope clicks (X) | fail (REA); run_script is a hole in Dot's own rule (F4) |
| 3.5 | Connected apps (Codex `apps` on) | X | claude.ai Gmail (30 tools), Google Calendar (9), Google Drive (11) and Claude Docs (8) in every agent (X) | match |
| 3.6 | A browser (`browser_use`, `in_app_browser` on) | X | cua-driver's browser tools, and his hb CLI through the shell (R: the homework agent read Canvas and Gradescope with it) | match, another route |
| 3.7 | Making and viewing images (`image_generation`, `view_image` on) | X | views images (Read); no image-making tool in the agent's inventory (X) | gap |
| 3.8 | Skills that ship with the app | S | his 143 skills and 193 slash commands in every agent (X) | beyond |
| 3.9 | Memory (the clicky_memory voice tool; Codex `memories` off) | S, X | Atlas, 100 tools (remember, facts, journal, deadline_add, calendar, canvas_*), used in recorded runs (R) | beyond |

## 4. What an agent may do without asking him

HeyClicky's agents run with `approval_policy = never` and `sandbox_mode = danger-full-access` (S
config.toml): apart from computer use, nothing asks. Dot asks before sending, paying and changing the
Mac (docs/agents.md, Defaults), which is beyond HeyClicky, so these rows test Dot against its own rule.
The decisions come from the decision replay (X: DotKit's code, his rules file absent, so the
defaults); 4.5 and 4.12 come from the runtime replays.

| # | Step | What Dot does | Against its rule |
|---|---|---|---|
| 4.1 | git push; `gmail send`; Gmail send_message and trash_thread; Atlas calendar_delete, imessage_send, send_email; a click on an element named Send | card | as designed |
| 4.2 | A Write to ~/.ssh/config | card | as designed |
| 4.3 | `rm -rf ~/Documents/old-drafts` | card, from the always-ask list; AgentRules files it as a read because its pattern wants a word boundary right after `~` (AgentRules.swift:120) | as designed; latent bug |
| 4.4 | An unrecognised shell command | Jev judges and runs it at risk 0.4 or less; in the recorded runs Jev cleared 157, 30 were allowed, none declined | as designed |
| 4.5 | `rm -rf` or a Write inside ~/roshan or the agent's own folder | runs, and Dot is never asked (X) | hole: defect F3 |
| 4.6 | Declining a calendar invitation (respond_to_event) | runs; filed as a read | hole: it tells the organizer |
| 4.7 | Creating an event with attendees | runs; filed as a write | hole: it sends invitations |
| 4.8 | Sharing a Drive file with someone | runs; filed as a write | hole: it shares outward |
| 4.9 | Computer use: a desktop-scope click, cmd+L, kill_app, clipboard_read | runs | as designed (his call 10/15) |
| 4.10 | run_script with `do shell script "git push origin main"` | runs | hole: a shell with no gate |
| 4.11 | Tools on MCP servers the agent inherits: REA's capture_process_scenario running git push or `/bin/rm -rf`, Blender's execute_blender_code with shutil.rmtree | runs; filed as reads | hole: agents load every server he has (no `--strict-mcp-config`); 8 were connected, among them rea (207 tools) and blender (X) |
| 4.12 | Several tool calls in one message | Claude Code asks one at a time; the next request arrives about 10 ms after the last answer (X) | n/a; it shapes F1 |
| 4.13 | "Allow for this task", "his brief asked for it", "leave it to me" | in code and tests (T); no recorded run has reached them (R: 0 rows) | not seen live |

## 5. Confirmed defects

### F1. One consent slot: a second card replaces the first, and that agent waits until stopped

2026-10-16 (R: the agents' transcripts and Claude Code conversations):
- 15:23:17 to 15:23:18 the email agent asked to delete three calendar events in one message. Claude
  Code sends one permission request at a time (4.12).
- 15:23:23 he allowed the first; the second request went out at once.
- 15:23:53 the physics agent asked to run a command (saving an email draft). Its card replaced the
  email agent's: `present` sets `model.consent = card` (NotchHUD.swift:384-385).
- 15:24:35 he allowed the physics card. Its `onAllow` calls `dismissConsent()`, which sets
  `model.consent = nil` (AgentManager.swift:438-439, NotchHUD.swift:390-391). Nothing showed the email
  agent's question again.
- For 78 minutes the email agent's row said "waiting for you" with no card behind it. Two follow-ups
  ("progress?" at 16:34, another at 16:41) queued behind the turn. At 16:41:55 he stopped it from the
  task bar, and its two pending calls ended "AbortError: Tool permission stream closed before
  response" and "AbortError: Stream closed".

`present` and `dismissConsent` read the same in d7e1fac, the last commit before that afternoon, and in e1bb539.
Fix: a queue of cards keyed by request id. Show the oldest; answering removes that card only and shows
the next; stopping an agent removes its cards and answers them "deny"; tapping a "waiting for you" row
brings its card back. Check it with the runtime replay and two agents that ask within seconds of each
other.

### F2. Relaunching Dot loses the running turn, and the old agent keeps working unseen

2026-10-15 (R): at 10:22:01 the dot agent got a Gmail clean-up brief; 10:23:05 was its last progress
line; at 10:24:23 Jev cleared its next command; at 10:24:35 Dot relaunched ("Dot 0.3.0 launching" in
dot.log). The old `claude` process lived on without Dot: four permission requests failed "AbortError:
Stream closed" between 10:24:34 and 10:25:17, and at 10:25:23 it still edited its own CLAUDE.md
(Claude Code approved that by itself, F3). No result row was ever written; the transcript's next row is
an unrelated brief at 10:32:55. HeyClicky's behaviour in the same spot was not observed.
Fix: on quit, interrupt running agents or say they will be lost; on launch, find any agent whose last
row is a brief with no result, mark that turn interrupted and offer to continue it (the conversation
itself resumes, 2.3); end agent processes left without a parent.

### F3. Agents delete and write inside ~/roshan and their own folder without Dot being asked

AgentManager.swift:233-234 starts agents with `--add-dir ~/roshan` and `--permission-mode acceptEdits`.
Under acceptEdits, Claude Code approves edits and filesystem commands inside its working folders by
itself, so those calls never reach Dot's permission handler. Replayed with a scratch folder in place of
~/roshan (X): `rm -rf` inside the added folder ran and REA saw the folder go, while the same command
outside asked; a Write to <added folder>/Atlas/private/probe.txt ran and REA saw the file appear, while
a Write outside asked. So Dot's own guards (rm -rf asks; Atlas/private, Atlas/objects and
Atlas/qmd-state are protected) never see anything inside the vault.
Fix: start agents with `--permission-mode default`, so every edit and command comes to Dot, where the
rules and ConsentPolicy already pass ordinary writes without a card; or keep acceptEdits and give
Claude Code deny or ask rules for the protected folders and for `rm` (untested: check it with the
replay before relying on it).

### F4. Consent holes against Dot's own rule (rows 4.3, 4.6 to 4.8, 4.10, 4.11)

Calendar replies, invitations with attendees and Drive shares run without a card; so do run_script
(an AppleScript `do shell script` is a shell) and command-running tools on inherited MCP servers.
Fix: judge connector calls by effect (attendees, share and respond count as sending), treat run_script
like Bash, and load only the MCP servers agents need (first check whether `--strict-mcp-config` also
drops the claude.ai connectors the agents use). Drop the `\b` after `~` in
AgentRules.outwardCommandWords (AgentRules.swift:120); the always-ask list masks it today.

## 6. Gaps to build (HeyClicky has them, Dot does not)

- G1. The per-turn record: keep next actions and artifacts with each turn (2.4).
- G2. Voice control of running agents: route to a named agent, steer a running turn, stop and approve
  by voice, and let talk see idle agents (2.7 to 2.9).
- G3. A routine's first run at once (2.11).
- G4. An image-making tool for agents (3.7).

Different by his call: no per-turn computer-use gate (3.3).

## 7. Added beyond HeyClicky, verified

| Addition | Evidence | State |
|---|---|---|
| A consent gate on sending, deleting, pushing and changing the Mac (HeyClicky asks only for computer use) | X: git push, sudo, an rm and a Write outside the working folders all reached the handler; R: 30 allowed and 157 cleared by Jev on 10/15 and 10/16 | works, with F1, F3, F4 |
| Jev clears unknown shell commands (risk 0.4 or less) | R dot.log: 70 to 230 ms per call | works |
| Rules: five classes × four behaviors, per-agent overrides (~/Dot/rules.json; absent means the defaults) | T 4 tests; X | works in tests; never reached live |
| Routines | T 5 tests | never run |
| Helpers (Opus, two at most) | R 2 uses | works |
| Atlas in every agent (100 tools) | X; R | works |
| His skills (143) and slash commands (193) in every agent | X | works |
| A per-turn cost ledger | R ~/Dot/ledger.sqlite (model, tokens, cost and time per turn; 25 agent turns) | works |

## 8. Open unknowns and the REA record

| Unknown | Question | Severity | What settles it |
|---|---|---|---|
| unk_8db7465f… | HeyClicky's computer-use gate at runtime | high | one metered HeyClicky turn that types into TextEdit, with its log stream and rollout |
| unk_f4fdffce… | Can helpers inside one Dot agent leave two permission requests outstanding at once (F1 inside one agent) | resolved: yes | ev_3c424a9a: two requests open at once, with round seven's launch (section 10) |
| unk_213d806c… | Routines on a real schedule, either app | medium | one hourly Dot routine watched for two hours; one HeyClicky routine (metered) |
| unk_3245fc10… | HeyClicky's mid-turn steer | medium | one metered agent turn with a follow-up sent while it works; turn/steer in logs_2.sqlite |
| unk_ef678aa1… | HeyClicky's voice control of running agents, and its helpers | medium | two metered voice turns while a Clicky works |
| unk_98ea8c58… | Do edits inside ~/roshan reach Dot's handler | resolved: no (F3) | |

Each comparison also carries REA's residual "process captures disagree across exit, filesystem,
process", the macOS limit described at the top.

```
verify_reconstruction (11 claims)  ev_792345b18d3a2ada02514c164685ffb6713a0a58e8523c91475b491ce9ce9248

claim                             HeyClicky capture / Dot capture / comparison
spawn.workspace                   ev_17b9d1fa213c82a1d76a7d76fbb9fb7239dd77f75366f196f250b243876fd3cd
                                  ev_276667ab07ea83a4dd861a33e2737b800faadcf7575494c655462f61712326b4
                                  ev_86caabdf7ffe2de0df9aacf16c66bdae48dabd3888bb1607ed574078126e2f02
spawn.identity-in-context         ev_c42ea205c90d1343ad1af7c572731cbf60d1739fc79dbffd474b2ac9e9152858
                                  ev_1e8a64d418a57d6872febcf5f1ad19aec7e6ff815817e4c536d4b958e5065749
                                  ev_620af8f69efd306d30b557e0c0f9fa588e3df83c2b777da89b9f26fbaff367cc
spawn.conversation-rooted         ev_0827fa25ade12ebae2d3ec386c496e02c161471852c5650ad846e3b2efb12ab7
                                  ev_8c8293198dfeff019b132c471dd944e6a03cfbd34957405fffeb1edb9ebacd9b
                                  ev_08b4ea4c0f5933379f97621cbe707fe5a6a99052275cfbd0e155fb83577d944d
manage.follow-up                  ev_236bd211b92e34a996a5be73a39b2f7ec28a3a207088e2252b3e68ce9d5c5e22
                                  ev_5e89f73612866047a294fe2db8820f691c876116a328b16b2a24140239531a5b
                                  ev_d1eb413adc0c00eafcfefbd75d78d616e6c88af57bb12e68a77d2eea36266f45
manage.concurrent                 ev_6756d31d285c17c9f505cd6ebf47be3bd8e0756111fcb39e87612344bc9a7e73
                                  ev_8b1460459ee54341ff78524159240e1c2f4a2302716059b49c60fa551553254c
                                  ev_1561d0524ed6aac02a03d8566ff3964ac35a1c0b739e09402cd8d385a5b53283
manage.resume-after-restart       ev_d2d90f476acfe27370dd4d793ad96c483685a24a769b4ae5c180d01728ee6aa4
                                  ev_7b2f92ab638f1c02eb469119564624f99ba746e319489eb1f5d0096281fbe1e4
                                  ev_2093634fc4deab64f70e4f62c0bb98fdfb0161dd3b34e9b2814be119f47f93c3
manage.turn-record (fail)         ev_510ba4f8f2a1c95b30aaa3eb4829c31df64b982e4a5d9558109bdc0a368e1233
                                  ev_fa1f7263cf3d139457ce0f5b3edadcb112a3865001b2ae03d40026194c3f7e39
                                  ev_66b734ba594f67adb5b2299e361a3b227caae2db6c2495f4fc4271b5da91c0a7
capability.shell-and-web          ev_f34b6c3018b4463e9bdd1d7f786f88a0616410bcc81994e3acab8bb16390fa24
                                  ev_224dcde27bee3808abaca818bb8d5788214e1782e4f09b64f5d2b236a2bd2b64
                                  ev_4a3ba5fcc49029dafc297d7b9d859aa6d698979bfc49d51617550f8b2285ed92
capability.computer-use           ev_b9c33498392b4ecbc5aaf5805d963c4e479f7085c4ec932cf2af2865e4e10e57
                                  ev_ac8eb7b96f349a23f7821e627f9aad3faacb05636e81e1f99f2c48396f517e0a
                                  ev_726895eee8f131a3f4b27d2afe5e19ae0722d399a633ab568ef54f84976c5041
capability.computer-use-gate (fail)
                                  ev_1097cc879731c09b5f43eee2835f16f3b3c86260c8aabb1c76de2272e29f181c
                                  ev_2626cbba25b76f62fc5831ed1422a6541d1895d979ad94927c452db8d99d7e08
                                  ev_44f96624257ce57f1a18fe9e46ef14e58b432e90a82cd6f0f453fe6f45b6382d
capability.computer-use-envelope (fail)
                                  ev_1becb00694e3393d5acdd4566856934aaad43a726981b5960c2705b6dc981400
                                  ev_95b01712615b7b85e18e18c37a0dc838632f0bfc336dce29dce6ddc069abc3ad
                                  ev_fee25b27391595c9653293917c782473761ac183ceeaf6c4ef7cec4bff6cb707

unit tests, 18 pass               ev_408d6e046ba09896707e6e008e299643ff750201da06ce408c155209d233253d
decision replay                   ev_1c3d87aa130ddfc87759cdab9e6a6f9d56c9834fa0c29dd0f7b7af9a087f6d94
runtime: inventory, one request   ev_368b20d5f586ab916385d20264e9d1b20cb6f915e4867f10400380fc82e01faf
runtime: rm inside and outside    ev_03e35cc442641eed4d03ca1bb3d85ca03fb5d6f2be89da8bff90753702ff6721
runtime: Write inside and outside ev_3e17676eea90a522a179a73c1dc45fddf5e327a9deaf9d80c8a083aaf795b236
HeyClicky codex features list     ev_861fc8c861eca1ee33a7206447dcacd2e4e9bcfa4c72fb53809f856fe5904ced

unk_8db7465f211a070b155ff9e675eed493691ca4658736b270352b91c1ff39b961  computer-use gate (HeyClicky)
unk_f4fdffce994973e060a27333ae16a81937baa6ea0e89547991169fe4e3654eab  helpers, two requests at once
unk_213d806c61e4dbb94be1c7640ab9151566da199586127bac4c9d3bd1eaaa84d1  routines
unk_3245fc10ff944a94dd1758c9b23ac811cedd1f22bb212a301f418ea94a684728  mid-turn steer
unk_ef678aa1722fd9afd3ede352a5b4af7f19ce50f17a10caa11d52911b6d3eca07  voice control, helpers (HeyClicky)
unk_98ea8c584a4bac74e68508ee0ea34fe6cf9849c2a0726d204a5089c94de20016  edits inside ~/roshan (resolved)
```

## 9. Rerunning

scripts/verify-agents/README.md has the commands. The probe and the decision replay cost nothing; the
runtime replay is one Opus turn (about $0.25). After fixing F1 to F3, rerun row 4.5 (a request should
now reach Dot), two agents asking within seconds of each other, and a relaunch during a turn.
