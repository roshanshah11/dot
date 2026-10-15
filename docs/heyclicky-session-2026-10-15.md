# HeyClicky, observed: the 2026-10-15 session

Roshan ran HeyClicky 1.0.53 on his own Mac from 9:46 to 9:59 while a recorder captured the
screen (10 fps) and the microphone, HeyClicky's own log streamed to a file, and its state
folder was read afterwards. 12 talk turns and 1 agent run were spent (plan file: 16 of 25
messages, 1 of 25 agents used, window resets 2026-11-15). Nothing from HeyClicky's prompts or
assets is copied into Dot; this is what it does and how it feels, as evidence for Dot's gaps.

Artifacts (not in git): `~/Dot/sessions/2026-10-15-heyclicky/` holds session.mp4 (24.5 min),
session.wav, transcript.txt (local Whisper), session.log (unified log, 15k lines),
clicky-lines.txt (HeyClicky's 926 own lines), and key/ (frames at each logged visual).

## Timing, from its own log

HeyClicky logs every Realtime event under `subsystem == "com.humansongs.clicky"` at debug
level (`/usr/bin/log stream --predicate ... --level debug`; nothing persists to `log show`).
Per turn, key release to first audio out of the speaker:

| Turn | Ask | Release to first sound | Release to the real content |
|---|---|---|---|
| 1 | What's on my screen | 2.6 s (session open: token 0.6 s + socket 0.5 s) | same |
| 2 | Show me around this page | 1.6 s ("Sure, one sec") | 19 s: the 6-beat tour began at 09:48:36 after a screenshot tool round trip |
| 3 | Where does it explain the discount rate | 5.1 s | same (one POINT, label "Discount rate") |
| 4 | What is this (circled formula) | 1.0 s ("One sec") | 9.4 s |
| 5 | Walk me through Night Shift | 6.0 s | same (first TARGET "Displays") |
| 5, each click | next step | 3 to 4 s after the click (recapture 1.4 to 2 s, then a Realtime next-step request of 3 s) | |
| 7 | Explain how a DCF works in detail | 1.4 s | 10.8 s to done; he interrupted at 29 s by pressing the key, audio truncated at once |
| 8 | Walk me through x²+6x+5=0 | 1.0 s | 5.8 s first step, 16 s for the 5-beat page walk |
| 9 | Nvidia's stock price | 3.8 s | spoken only: "$216.09, down about 2.35%"; no widget appeared |
| 13 | Chai near campus | 5.3 s | spoken only (Beargrounds Coffee, 5500A S University); no place card |
| 14 | typed question in the New Clicky page | 15 s | the answer appeared as chat bubbles in Home |
| 17 | Agent, research Bridgewater... | 1.6 s | "Research Buddy is on it" at 3.9 s; agent launched 14 s after release |

Model: gpt-realtime-2.1 (ephemeral token from api.heyclicky.com). Each turn carries 25k to
34k input tokens (15k to 30k cached), with one screenshot kept ("prune stale screenshot
keep-latest-1") and three context notes (129, 372 and 1359 chars) resent every turn.

What this means for Dot: HeyClicky's "sub-second" feel is a one-second filler ("one sec",
"mm-hm") followed by 5 to 20 s of real latency on any turn that looks at the screen. Dot's
instant acknowledgment plus a 2 to 4 s first visual is already in the same class; the gap is
voice quality and the tightness of the filler, not the pipeline.

## What it draws

- Highlights are dashed blue rounded rectangles around a text block, heading or equation
  (tour beats, math steps). Targets are dashed blue circles (radius 28) with a small blue
  label chip ("Displays", "Night Shift", "Schedule menu", "Done").
- The character is a small blue triangle that glides to each mark. There is no speech bubble
  during voice turns; the words are only spoken. The notch shows the state as text:
  Listening, Thinking, Thinking deeper, Speaking, Dictating (hands-free), with a waveform.
- The tour of the DCF article was 6 beats: title, warning box, opening paragraph, contents
  list, Application section, right-hand Appearance panel, each boxed as its sentence played.
- Math: no custom UI. It walked the page's own equations, boxing "(x+3)²=4" then
  "x+3=-2 or x+3=2" in sequence while reading the steps, and when asked "can you show it to
  me?" it first said "Click Solving Quadratic Equations in the left contents list" to bring the
  worked example on screen. Dot's board (typeset card, step reveal, grading) has no counterpart.

## Walkthrough mechanics, as logged

`guided max rounds updated from backend 5 → 15`; one target per step; on a hit (distance 2 to
23 px) it records the click, schedules a recapture (1.0 to 2.0 s), asks for the next step,
and arms the next ring. A click while it waits ("user activity while waiting reason=click")
refreshes the capture and retries. When the Displays pane had not repainted yet it said
"Displays is selected, but the main panel hasn't updated yet. Give it a moment, then say
continue once the display settings appear," and the next ring came after "Continue." The
last step closed with a sentence and no visual ("You're all set, Night Shift is scheduled from
sunset to sunrise"). Hover-rest completion and step-away were not exercised.

## Typed, dictated, agent

- Tap-to-type opened the New Clicky interview page in Home (cloud face, a thought bubble
  "One sec.", a "Clicky is speaking..." pill, an "or type your answer" field); its reply came as
  two chat bubbles and a "Hold Control + Option to answer" button. It asked which calendar he
  uses: no calendar was connected, so it could not read tomorrow.
- Dictation (control+fn, or double tap for hands-free) into a terminal could not find a
  field to insert into, so it put the text on the clipboard and showed a notch card "Copied to
  your clipboard. Press ⌘V to paste." The archive at
  `~/Library/Application Support/Clicky/DictationTranscripts/<date>.jsonl` records text, app and time.
- "Agent, research Bridgewater's news..." was answered by voice ("Sure. One sec." then
  "Research Buddy is on it in the background...") and an Agent HUD card appeared under the
  notch at the top right: avatar, "Research Buddy • Working", a live "Thinking..." line, Stop
  and Open buttons. The card was gone 30 s later while the agent still ran. The run took 2:56,
  saved output/bridgewater_news_brief.pdf plus a copy in ~/Downloads (he had asked for
  Downloads), and ended with a spoken summary. Its brief carried a "user memory" profile
  (name, timezone, Mac, role guesses, tools, how he uses it, current focus) built from past
  turns, which is how its agents personalize.
- The morning card "I can do 7 things for you today. Pick what you'd like me to take on.
  [Dismiss] [Show me]" reappeared in the notch every few minutes until dismissed. It had been
  held while the microphone was in use by another app (my recorder): HeyClicky treats mic
  use by another process as "on a call" and goes quiet.

## Home, as seen

- Click on the notch: a dropdown under the notch with an Upgrade pill, a Suggestions row
  (count badge, first suggestion as preview), one row per Clicky (avatar, name, last line,
  artifact thumbnail, time), and a bottom bar (Apps +, Invite & Earn, expand).
- Expanded: a window with Back, a title, and a left sidebar (Account, General, Invite & Earn;
  HeyClicky: Voice, Microphone, Dictation, Shortcuts, Cursor; Work: Agents, Integrations;
  version footer). Shortcuts page: Push to talk ⌃⌥, Text mode ⌃⌃, Dictate ⌃fn, Hands-free
  dictation ⌃fn twice, Reset to defaults. Agents page: Suggest agent tasks, Speak when a Clicky
  starts or finishes, Show updates beside the cursor, See legacy agents, Files & Folders access.
  Cursor page: color swatches and Hide floating cursor. Integrations: the Composio catalog with
  Connect buttons. Invite & Earn: referral tiles and an earnings estimate.
- From the binary's type names, the parts not reached this session: an icon rail with a
  usage ring and unread dots, a thread view with a cowork transcript (step rows, command
  blocks, progress list, status line, interrupted chip, early-stop refund line, turn footer,
  tables), an output preview column (PDF, markdown, QuickLook, fold and resize), artifact
  cards with thumbnails, suggested-action pills, first-message suggestions, a context menu
  (Archive, Pin to the top, Mark as Unread/Read, Rename, Move thread into), swipe to archive,
  tapback badges, a scroll-to-bottom button, sent-attachment bubbles and file drop, a
  skills library page with filter chips, a suggestions page with adjustment controls, a
  markdown viewer window, a power-up panel for creating skills, and response-card widgets
  (stock, images, places) that did not render in this session.

## Still untested (9 messages left this month)

Images request, the hand-off of a dragged region to an agent, step-away during a
walkthrough, "can you click it for me", hover-rest completion, the character editor.
