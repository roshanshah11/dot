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
| Helpers (a swarm) | an agent may hand independent parts to helpers (Claude Code subagents, Opus, two at most), merge and report once; the card and Home show "with N helpers" | `Prompts.agentExtras`, `Run.helpers`, Settings › Agents › Helpers |
| Routing by name | "tell Physics the data is in", "what did Email find", "what's running": the agents line in every talk turn and Jev's follow-up question | `Talk.buildMessage`, `Talk.route` |
| Rules (control) | five classes of action (reading, writing, using apps, sending and paying, changing the Mac) × four behaviors (do it, only if I asked, ask first, leave it to me); defaults plus per-agent overrides; "Allow for this task" on a card covers that class for the rest of the run | `DotKit/AgentRules.swift`, `~/Dot/rules.json`, Home › Agents › Rules |
| Guards underneath | protected folders (Atlas private, keychains, dotfiles), always-ask commands, outward tool words, Jev's judgment on unknown shell commands | `DotKit/ConsentPolicy.swift` |
| Audit trail | every allowed, declined, denied and cleared decision in the agent's transcript; cost per turn in the ledger; spend per agent on the Agents page | `.dot/transcript.jsonl`, `~/Dot/ledger.sqlite` |
| Routines | "every morning at eight, have Email draft the replies" (`[ROUTINE:agent:when:brief]`) or the Agents page; runs while Dot is open, online, not on a call; missed runs happen once after waking; three failures pause with the reason; results in the thread, no chime, no spoken line; pause, resume, run now, delete | `DotKit/Routines.swift`, `RoutineScheduler.swift`, `~/Dot/routines.json` |
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

## Still to see live

A routine on a real morning; "Allow for this task" on a real card; an agent with helpers on a real
job; the Agents page clicked through.
