# Agents in Dot: how they are set up, run and controlled

His ask 2026-10-16: "the agent setup and agent management in clicky: what goes into building out the
agents, how do i control agents, general agents, agent swarms, specific task agents; use logic also
from chatgpt dots or meta's muse". This is the design Dot follows from round six, with the evidence
each part rests on. Captures and quotes: `~/roshan/Learning/Research/2026-10-16-heyclicky-features/`.

## What the three products do

**HeyClicky (Clickys, 1.0.49 to 1.0.53).** A Clicky is a standing agent with "its own name, memory,
conversation, and folder for its files". It is made through a conversation (follow-up questions,
then a Clicky "with that job in mind"), or several in one ask ("make me three Clickys: inbox,
competitor research, and newsletter", up to five). From any app the voice routes to the right one by
name ("tell Launch Scout I like this shirt too") or founds a new one. Routines run on the Mac while
the app is open, with pause, resume, run now and delete in the Clicky's profile; three failed runs in
a row pause one, results land in the chat with an unread dot and no chime. Computer use asks (Allow
once, Always allow, Not now, by voice too) and the yes "applies only to that conversation". A Clicky
can hand "part of the job to a helper agent" (its Codex runtime runs with `multi_agent = true`). Since
1.0.53 a Clicky "does what it can first and then asks you one short set of questions, instead of
inventing details or saying it can't". Proactive agents were turned off in 1.0.46 over privacy
unease; morning suggestions from connected apps stayed.

**OpenAI dots (Sept 29, 2026).** One primary dot per person, named; "teams of dots" planned. Each has
its own cloud computer and browser, learns from feedback, and does read-only "proactive research"
when idle. Control is Custom Rules, one of four behaviors per action: take action without asking,
take action if pre-approved (he asked for it in the prompt), ask before taking action, hand off to
you. Auto-review checks anything that touches accounts or shares information. A profile shows In
progress, Scheduled and Completed; pause and reset. Specialist dots get their own identity and
credentials for one job (enterprise).

**Meta Muse (Sept 8, 2026).** One personal agent on its own secure VM; a separate Sentinel agent
must approve anything that reaches the internet; it "checks with the person before sensitive actions
like sending an email or making a purchase", shows "a complete audit trail of everything it has done
and plans to do", and per app the person chooses how much access it gets (read mail, or also send).

## Dot's model

| Piece | Dot | Where |
|---|---|---|
| General agent | "Dot": one standing agent for anything, always there | `~/Dot/agents/dot` |
| Standing specialists | named agents with a persona, standing preferences and dated notes (CLAUDE.md), their own folder, output and conversation (resumed within 12 h); founded by voice ("make me an agent for my lab reports"), several in one ask (one `[NEW_AGENT]` per agent, up to five), or in Home | `AgentManager.ensureAgent`, `Prompts.talk` |
| Task agents | a one-off brief to Dot or a fresh name; archived from Home when done | `[AGENT:brief]` |
| Helpers (a swarm) | an agent may hand independent parts to helpers (Claude Code subagents, Opus, two at most), merge and report once; the card and Home show "with N helpers". Round seven: helpers run in the foreground, side by side (`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`); Claude Code 2.1.289 ran them in the background, so the agent's turn ended before they did | `Prompts.agentExtras`, `Run.helpers`, `AgentManager.startRun`, Settings › Agents › Helpers |
| Routing by name | "tell Physics the data is in", "ask Email whether it went out", "inbox keeper, skip the newsletters" (a first-word alias like "inbox" counts only after tell, ask, remind or message): the agent it names gets it, working or idle (`[TELL:name:message]` from the model, or straight from his words); "stop Email" stops it (`[STOP_AGENT:name]`); "is Email done", "progress?", "what do i need to do" are answered from what the agents are doing, with no turn for them. A message to a working agent reaches it at its next step. The talk model sees every agent, idle ones too | `DotKit/AgentAddress.swift`, `Talk.route`, `Talk.buildMessage` |
| Permission cards | one card per request, oldest first, "+N waiting" behind it; answering one removes only that one; a "needs you" row brings its agent's card forward; stopping or archiving an agent withdraws its cards; a card is announced (when agent results are spoken) as it comes on show, and a tap in its first half second is ignored. By voice too: "allow", "not now", "allow for this task"; a send, a payment, a delete, a push or a change to the Mac wants the card's own act named ("yes, send it" for a send; "run" never counts); a no or a "wait" after the yes takes it back; a bare yes or no answers only a card that came up in the last 20 seconds, with no walkthrough, lesson or question of Dot's pending. "Allow for this task" lasts until his next brief to that agent and covers that kind of action, with deletes outside the folder and each MCP server Dot doesn't hand agents counted on their own | `DotKit/ConsentQueue.swift`, `NotchHUD`, `ConsentVoice`, `AgentManager.allowanceKey`, `Dot --selftest` |
| Restarts | a quit ends agent processes at once; at the next launch a turn that never finished is marked stopped, a recent one with a "continue where you left off" button, and agent sessions left running without Dot are ended | `AgentManager.prepareForQuit`, `recoverAfterLaunch`, `DotKit/AgentRecovery.swift` |
| Turn record | each turn keeps its steps, its words, the next step it offered and the files it made or changed in output/; Home lists them under the turn | `AgentManager.finished`, `DotKit/TurnArtifacts`, `.dot/transcript.jsonl` |
| Rules (control) | five classes of action (reading, writing, using apps, sending and paying, changing the Mac) × four behaviors (do it, only if I asked, ask first, leave it to me); defaults plus per-agent overrides; "Allow for this task" on a card covers that class for the rest of the run | `DotKit/AgentRules.swift`, `~/Dot/rules.json`, Home › Agents › Rules |
| Guards underneath | protected folders (Atlas private, keychains, dotfiles), always-ask commands, outward tool words, Jev's judgment on unknown shell commands | `DotKit/ConsentPolicy.swift` |
| Audit trail | every allowed, declined, denied and cleared decision in the agent's transcript; cost per turn in the ledger; spend per agent on the Agents page | `.dot/transcript.jsonl`, `~/Dot/ledger.sqlite` |
| Routines | "every morning at eight, have Email draft the replies" (`[ROUTINE:agent:when:brief]`) or the Agents page; the first run happens at once (round seven, as HeyClicky's do), then on schedule; runs while Dot is open, online, not on a call; missed runs happen once after waking; three failures pause with the reason; results in the thread, no chime, no spoken line; pause, resume, run now, delete | `DotKit/Routines.swift`, `RoutineScheduler.swift`, `~/Dot/routines.json` |
| Ask instead of guess | the brief: do everything that needs nothing from him first, one bundled set of questions at the end; a declined card means do the rest and say what was skipped | `Prompts.agent` |
| Memory | Atlas holds facts, deadlines and promises (one owner); the agent's CLAUDE.md holds its own working notes; his talk context folder holds course maps | `Prompts.agent` |

What Dot does not copy: a cloud computer (agents run here, on his Mac, with his logins and tools);
proactive agents that watch activity (HeyClicky dropped them; the morning card comes from Atlas's
day instead); a billing meter (the Max plan covers the turns; the ledger shows the cost).

## Defaults

Reading, writing (under his home, outside protected folders) and using apps run on their own.
Sending and paying ask. Changing the Mac asks. Any class can be made "leave it to me": the agent
prepares the step and stops. A click whose target names a send, a purchase or a delete counts as
sending and paying, not as using an app.

Round seven (2026-10-16 night), after docs/heyclicky-agents-verification.md:
- Agents start in Claude Code's default permission mode, so every edit and command reaches these
  rules (under acceptEdits Claude Code approved edits and deletes inside the agent's folder and
  ~/roshan itself). `agentPermissionMode` in config.json sets it back. Every command starts in the
  agent's folder (`CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR`): Claude Code otherwise carries a cd
  into ~/roshan over to the next command, where a relative path would mean something else.
- A delete inside the agent's own folder or a temp folder runs on its own; any other delete is a
  card, never left to Jev, with or without -r and however it is wrapped (unlink, shred, trash,
  `xargs rm`, `bash -c 'rm ...'`, `find -delete`, `-exec rm`, `git clean`), and it is classed with
  sending ("a delete outside the agent's folder"). The agent's CLAUDE.md and .dot always ask. A move
  counts as a write, not a delete.
- Answering an invitation, inviting people to an event, sharing a file: sending.
- A tool from an MCP server Dot doesn't hand agents (anything outside its mcp.json, the computer-use
  servers and the claude.ai connectors): changing the Mac. Quitting an app: changing the Mac. The
  computer-use script runner and extension installer are off for agents.

## Still to see live

A routine on a real morning; "Allow for this task" on a real card; an agent with helpers on a real
job; the Agents page clicked through; a card answered by voice; two agents asking at once on his
screen (checked by `Dot --selftest` and the replays, not yet by him). Seen live on 10/17 with a
throwaway agent: a due routine running quietly with its next step and file recorded, a leftover agent
session ended at launch, a quit during a command marked and resumable, "tell <name> ..." by voice.
