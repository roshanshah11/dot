# Dot

An open-source companion that lives beside your cursor on macOS and runs on
[Claude Code](https://code.claude.com). A small ember orb with eyes follows the pointer, blinks,
and leans into its motion. Hold a key and talk: Dot looks at your screen, answers out loud in a
sentence or two in a bubble beside itself, flies to the button you need, rings the next thing to
click in a walkthrough, and hands real work to background agents that use your own Claude Code
skills, MCP servers and CLIs. If you run [Atlas](https://github.com/roshanshah11) (a personal
chief-of-staff store), Dot knows your deadlines, calendar, commitments and mail at every turn.

It is a from-scratch, MIT-licensed take on what [HeyClicky](https://www.heyclicky.com)
does, built for people who already live in Claude Code: no account, no subscription
beyond the Claude plan you have, no cloud speech, no bundled runtime. See
[ATTRIBUTION.md](ATTRIBUTION.md) for what was ported from Farza Majeed's open-source
Clicky and from Murmur.

## What it does

| You | Dot |
|---|---|
| Hold **control + option** and talk | Looks at your screen, answers aloud in beats: each sentence lands beside the thing it is about, in a short bubble, as the orb flies there |
| Ask "show me around" or "what is all this" | A tour: three to six beats, each pointing at, outlining or circling one part of the page with one sentence about it |
| Drag while holding | Draws in ink around something; Dot answers about what you circled (the region is cropped and enlarged for the model) |
| Ask "how do I..." | One step at a time: Dot rings the control to click (or to rest on, for hover menus), sees you do it, and gives the next step. Say "next" or "done" to move on, or ask about the step |
| Say "do it" or "you click it" in a walkthrough | Dot glides the real cursor to each ringed step and clicks it while you watch. Anything that reads like a send, a purchase or a delete stays yours. Move the mouse or press a key and it stops |
| Hold **control + option + shift** and talk | Hands the request to a background agent and tells you when it is done |
| Tap **control + option**, or click the tab under the notch | A text field for a typed question |
| Press **escape** | Stops Dot talking |
| Say "go do it", or ask for real work | The request goes to an agent on its own; a confident route skips the talk model entirely |
| Switch to an app that touches a deadline | One quiet line beside the cursor ("heads up: wells fargo coffee chat, due today") |

Every talk turn carries the date and time and 56 Atlas tools: everything that reads
(search, facts, people, calendar, free, commitments, mail, messages, canvas, docs, SEC
filings, a finance calculator), remembers (remember, deadline_add, commit, todo, reminder,
journal) or drafts (draft_email, write_note, calendar_create). Nothing that sends. So "what's
due", "who is she", "what did he say", "remember that" and "draft a reply" work by voice, and
Dot asks Atlas only when the question needs it. The notch tab's hover line and the morning
greeting still come from a direct read of Atlas every ten minutes, with no model call.

### Beats

The model writes its answer as beats: a visual tag first on a line, then the sentence that
goes with it. `[POINT:x,y:label]` flies the orb to a spot, `[HIGHLIGHT:x,y,w,h:label]`
outlines a region, `[SHAPE:arrow:x1,y1;x2,y2:label]` draws an arrow (also line, curve, circle,
polygon), `[TARGET:x,y,r:label]` rings the control to click next, `[HOVER:x,y,r:label]` rings
one to rest on. Dot queues each beat's words with the voice and fires its visual the moment
those words start playing, so a tour reads as the orb moving through the page while it talks,
and the bubble shows one beat at a time instead of a wall of text. The grammar follows what
HeyClicky's binary reveals (see `docs/heyclicky-abilities.md`); the code and the prompt are Dot's.

Agents live in `~/Dot/agents/<name>/`, each with a `CLAUDE.md` that is its identity and
notes, an `output/` folder for deliverables, and a transcript. They run as Claude Code
sessions on Opus with your skills, your MCP servers, and your settings. They work on their
own: reads, writes anywhere under your home, scripts, opening apps and pages, and driving an
app to look at it all pass silently. The Allow / Not now card in the notch appears only for
what goes outward or cannot be undone: a send, a submit, a post, a payment, a delete outside
the agent's folder, a push, a system-wide install, or a click on a control whose label reads
like one of those. Your vault's private store, your keys and your settings stay off limits. When an agent finishes, its row in the notch opens into a card: the
full answer, its files, a "Next: ..." button it suggested, and a reply field. The Dot window
has the same chat with a composer, plus a Day tab with everything Atlas knows about today.

### Quick decisions on Jev

With a TypeSafe key (`TYPESAFE_API_KEY` in the environment or in `jevKeyFile`), Dot asks
[Jev](https://typesafe.ai) the small calibrated questions a companion makes constantly, in
about 150 ms for two hundredths of a cent each: where does this request go (answer, agent,
stronger model, a follow-up for the agent already working), which on-screen element did he
mean (the orb moves before Claude has spoken), is this unrecognised shell command plainly
harmless (cleared without a card; anything on the always-ask list still asks), and does the
window he just switched to touch a deadline. Without a key everything still works; it is just
Claude doing all of it.

## How it works

- **Speech to text** is local: NVIDIA Parakeet TDT 0.6B v3 on the Neural Engine through
  [FluidAudio](https://github.com/FluidInference/FluidAudio). Nothing you say leaves the Mac
  except as text inside your Claude request.
- **The brain** is one persistent `claude -p --input-format stream-json` process per role
  (talk, think, each agent), the same runtime the Claude Agent SDK drives. Screenshots go
  inline as image blocks. Permission prompts come back over the same channel
  (`--permission-prompt-tool stdio`) and Dot answers them from its consent policy or your tap.
- **Pointing** uses the Accessibility tree first: Dot sends the model a numbered list of
  on-screen elements with exact coordinates, and snaps the dot to the matching element's
  frame. The model's own screenshot coordinates are the fallback.
- **Speech output** is Kokoro-82M (Apache 2.0) on the Neural Engine through mlx-audio,
  a calm, even voice that synthesizes a sentence in about half a second on an M3. It runs
  as a worker process speaking a three-line JSON protocol, so Piper or any other engine
  can replace it; Apple's on-device synthesizer is the fallback when no worker is set up.
- **Computer use** for agents is [cua-driver](https://github.com/trycua/cua) (MIT) as a
  stdio MCP server, when you install it. Observation calls pass; input calls ask.

## Install

Requirements: macOS 14.2 or later, Apple silicon recommended, Xcode 16 or later for the
build, and Claude Code installed and logged in (`claude auth status`).

```bash
git clone https://github.com/roshanshah11/dot.git
cd dot
./build.sh
```

`build.sh` builds a release binary, wraps it in `~/Applications/Dot.app`, signs it with your
first Apple Development identity (or ad-hoc), installs a login agent, and launches it. On
first launch, grant Microphone, Screen Recording, and Accessibility when macOS asks; the
Dot window lists what is still missing. Then hold control+option and talk.

The speech-recognition model (about 460 MB) downloads on first use into
`~/Library/Application Support/FluidAudio/Models`. If you run Murmur, it is already there.

### The voice

```bash
scripts/install-tts.sh     # Kokoro in ~/Dot/tts (needs uv; about 1.2 GB with spaCy and mlx)
```

Dot switches to Kokoro on its next launch. `ttsVoice` in the config picks the voice
(`af_heart` is the default; `af_bella`, `am_michael`, `bf_emma` are good too) and
`ttsSpeed` the pace. Without the worker Dot uses Apple's best installed voice; download
an enhanced one in System Settings > Accessibility > Spoken Content if you stay there.
Any other engine works through `ttsCommand`: a process that reads `{"text": ...}` lines
and answers `{"wav": "/path"}` lines, as `scripts/dot-tts-kokoro.py` does.

### Configuration

Phase 2 keys (all optional, defaults shown in `~/.config/dot/config.json` after the first launch):
`showCompanion` (Dot beside the cursor at all times), `bubbleText`, `hudShowsResponse`,
`morningGreeting`, `notchPresence` (the tab under the notch), `atlasRoot`, `atlasHarness`,
`atlasPython`, `todayRefreshMinutes`, `talkSessionMaxTurns`, `talkEffort`, `walkthroughMaxSteps`,
`jevEnabled`, `jevKeyFile`, `jevRouteThreshold`, `proactiveNotices`, `noticeCooldownMinutes`.
Talk-mode Atlas tools come from `~/.config/dot/mcp-talk.json`, which starts Atlas's MCP server
with `ATLAS_MCP_TOOLS=now,search,facts,...` so only those tools ride along.

`~/.config/dot/config.json` is written with defaults on first launch. The useful knobs:

| Key | Default | Meaning |
|---|---|---|
| `talkModel`, `thinkModel`, `agentModel` | `sonnet`, `opus`, `opus` | Claude Code model aliases |
| `voiceIdentifier` | best installed English voice | `Dot --voices` lists them |
| `agentMCPConfig` | `~/.config/dot/mcp.json` | Claude Code `mcp-config` file for agents |
| `talkMCPConfig` | `~/.config/dot/mcp-talk.json` | Read-only MCP tools talk mode may call |
| `allowTools`, `allowToolPrefixes`, `denyTools` | `[]` | Consent policy for agent tool calls |
| `speakAgentResults` | `true` | Read an agent's first sentence aloud when it finishes |
| `screenshotMaxDimension` | `1280` | Long edge of each screenshot sent to the model |
| `contextQuips` | `true` | A small model writes each quip for the moment (the app and window in front, the next Atlas event or deadline within 24 h, the time, an agent's result), and 30 to 60 minutes before an event one line for it, once. Each line is checked (lowercase, 60 characters, nothing from the never-does list); a failed check, an error or more than 6 s falls back to the written lines. `false` uses the written lines only. Home > General has it, beside the chattiness picker. See `docs/alive.md` |
| `quipModel` | `haiku` | The Claude Code model alias that writes the quips: one `claude -p` per quip, no tools, thinking off. `Dot --quip-test` runs three sample moments through it |
| `chattiness` | `2` | How much Dot says unprompted, 0 to 3: 0 nothing, 1 deadline notices only (cooldown 3x) and a quip every 2 hours, 2 notices, offers and a quip every 40 minutes, 3 cooldowns halved and a quip every 20 minutes. Scales `noticeCooldownMinutes` and `suggestionCooldownMinutes`; `proactiveNotices` and `suggestions` still switch their part off. See `docs/persona.md` |
| `orbSize` | `24` | The orb's diameter in points, 16 to 36 (it was 20 before the alive pass). Its eyes, follow offset and bubble scale with it. To pet Dot, rub the cursor gently back and forth over it; a gentle rub is smaller than macOS's shake-to-find-cursor. See `docs/alive.md` |

### Computer use (optional)

```bash
/bin/bash -c "$(curl -fsSL https://cua.ai/driver/install.sh)"
```

Then put the server in `~/.config/dot/mcp.json`:

```json
{ "mcpServers": { "cua-driver": { "command": "/Users/you/.local/bin/cua-driver",
                                  "args": ["mcp", "--claude-code-computer-use-compat"] } } }
```

Grant CuaDriver.app Accessibility and Screen Recording once. Agents can then snapshot a
window's accessibility tree and click by element, in the background, without stealing
your focus; every input action shows Dot's consent card first.

## Layout

```
Sources/DotKit/        pure logic, unit-tested: tags, consent policy, stream-json, geometry
Sources/Dot/Input      control+option push-to-talk on a listen-only CGEvent tap
Sources/Dot/Audio      16 kHz recorder, Parakeet transcriber, Apple speech
Sources/Dot/Screen     ScreenCaptureKit capture, Accessibility context
Sources/Dot/Brain      the Claude Code session, prompts, the talk loop
Sources/Dot/Overlay    the click-through overlay and the dot's flight
Sources/Dot/Notch      the HUD hanging from the notch: state, text, consent card, input
Sources/Dot/Agents     agent folders, runs, consent, the SQLite cost ledger
Sources/Dot/Home       the one window: agents, transcripts, permissions
```

```bash
swift test            # DotKit tests
./build.sh --debug    # debug bundle
Dot --check           # permissions and paths
tail -f ~/Library/Logs/Dot/dot.log
```

### The board

Ask for a worked problem, a formula, a comparison or a quiz and Dot teaches from a card it
puts over your screen: math typeset locally (KaTeX, bundled), steps revealed one at a time as
it explains, plots, number lines, tables and hand-drawn diagrams. In a worked problem it asks
you to try the next step before showing it and grades what you say. "next" reveals, "close it"
or escape clears, and the orb perches on the card's edge pointing at the step it is on. Cards
are small floating panels Dot owns; the model writes them as `[CARD:id:auto:title]` followed by
a `<<< ... >>>` html block, then `[REVEAL:id:n]` before each step. Nothing is fetched.

## Testing it without a voice

`Dot --ask --quiet "show me around this page"` runs a turn with the bubble and the marks but
no speech (beats pace themselves), and `Dot --ask --drive "how do i ..."` lets Dot click the
walkthrough's steps itself. `scripts/dot-try.sh` wraps an ask: it waits for the turn, prints
the route, tool, beat and tag lines from the log, and takes screenshots as the beats land.

## Not yet

Hands-free always-on voice and sub-second speech (HeyClicky's Realtime feel), typing a step
for you, a `drive_until` fast lane for agents' computer use, routines on a schedule, a
meeting countdown in the notch, an onboarding tour, and embedding cua-driver inside Dot.app.
Dictation is left to [Murmur](https://github.com/roshanshah11/murmur).

MIT. Built by Roshan Shah.

## What was added on 2026-10-15 (afternoon)

- **Math, as his tutor.** Dot knows the course it is tutoring from `~/Dot/talk/context/*.md`
  (a map of every numbered definition and result in the notes, the exam dates), cites results
  by number, starts every proof with his attempt, grades a written proof
  for the gaps a proof course marks, checks numbers with python and sympy before saying them
  (the one shell command talk mode may run, `TalkGuard.isComputationCommand`), drills with
  quiz cards and remembers misses in Atlas. (A homework guard shipped that afternoon and was
  removed the same day at his ask; Dot tutors whatever is on screen.)
- **Task bar.** Every running task sits under the notch: agents with their last steps and a
  stop button, a walkthrough with its step, a lesson on the board. Steady work folds into pills
  on the idle tab after twenty seconds; a change or a hover unfolds it.
- **Home, rebuilt** after HeyClicky's shape: a rail of agents with status and unread dots,
  pin, rename and archive in the context menu, a thread with step rows and result footers,
  next-action pills, a composer that takes dropped files, an outputs column with a QuickLook
  preview, a day page and a settings page.
- **Agents know him.** Every brief carries an `[about him]` block from Atlas (preferences,
  facts, priorities) and a routing rule: decks through powerpoint-design, pages through
  web-taste, research through research, mail through roshan-email, and so on.
- **Streaming transcription.** Words show in the notch and on the orb's chip while the key is
  held (FluidAudio's sliding window over the same Parakeet models); the final text is ready
  about half a second after release, with the WAV path as the fallback. `Dot --stt file.wav`
  replays a clip through it.
- **Dictation.** Hold control and fn, talk, release: the text lands in the focused field
  through accessibility, else a paste, else the clipboard with a notch note. Tidied first
  (capital, full stop, fillers dropped), archived in `~/Dot/talk/dictation.jsonl`.
- **TYPE steps.** `[TYPE:x,y:label]` with the text between `<<<` and `>>>`: Dot copies it,
  points at the field, and in drive mode clicks there and pastes.
- **A face.** The orb has a mouth that moves with its voice and brows that tilt: focused while
  he talks, happy when an agent finishes, puzzled when a turn fails.
- **Meeting notice.** Ten minutes before the next calendar event, once: a line in the notch and
  a spoken heads-up when Dot is idle (`meetingNoticeMinutes`, `speakMeetingNotice`).
- **Transcripts, always.** Every talk turn, typed question and dictation lands in
  `~/Dot/transcripts/YYYY-MM-DD.md` (readable) and `transcripts.jsonl` (for tools) as it happens.
- **Agents are Atlas chats.** Each agent runs with Atlas's own chat system prompt (the mandate,
  his facts, deadlines, calendar, journal), the vault's rules, all 102 Atlas tools and the vault
  added as a working directory, so it can do what any Atlas chat can; Dot's consent card still
  covers sends, submits, payments and deletes.
- Per-turn cost: Claude Code reports a session's running total; Dot now records the turn's own cost.

## The visual board (2026-10-15, afternoon)

Cards are real web pages. `Resources/board/vendor` bundles D3, anime.js, Chart.js, three.js
(classic build) with OrbitControls, 3Dmol.js, Mermaid, JSXGraph, smiles-drawer and matter.js, all
MIT or BSD, loaded on demand by `Board.need(...)`; KaTeX typesets math. Ready-made pieces are
classes on a div (`.plot`, `.chart`, `.mermaid`, `.helix`, `.molecule` with a PDB id fetched from
RCSB, `.sequence`, `canvas.smiles`, `.jsx`, `.diagram`, `.timeline`, `.compare`, `.grid`,
`.callout`, `.quiz`, `.annot`, `.figure`), and a card may carry its own script for anything else.
The pattern that teaches: one figure whose parts carry `data-step="n"`, then one step per idea;
as Dot reveals and narrates step n, those parts light up and the rest dims. `[WEB:url:title]`
opens a live page in a card. Talk mode can run WebSearch and WebFetch for facts and media,
and hands real research to an agent running the research skill. Errors inside a card reach
`dot.log` as `board[id]` lines. `Dot --card file.html` renders a card from a file for testing;
`~/Dot/talk/cards/` holds a gallery and a teaching example.

Also that afternoon: a circled region with nothing said shows an action bar (ask, to an agent,
copy text, look it up) with on-device OCR, and an agent hand-off carries the crop and its text;
every talk turn and dictation is saved under `~/Dot/transcripts/`; agents run with Atlas's own
chat prompt, the vault's rules and all of its tools; a BIOS 11140 course map joined the math one
in `~/Dot/talk/context/`.

## Round eight: the box stays on the content, and explanations on a panel (2026-10-17)

His asks: Dot was "awful at keeping the box on the content as i scroll" and at visualizations, "especially when i
want rendered JS to just walk me through and explain things"; bring ChatGPT's way of answering (a written answer
with live figures, a check question and follow-ups) to Dot. What changed:

- **Marks follow what they mark.** A HIGHLIGHT, TARGET, POINT or SHAPE gets an anchor when it lands
  (`Overlay/MarkTracker.swift`, pure parts in `DotKit/MarkAnchor.swift`): an accessibility element that is roughly
  the marked thing (its frame is re-read while he scrolls), else the window's pixels (a listen-only scroll tap moves
  the mark at once; window captures registered with Vision correct it; after the scroll settles the mark's own patch
  is found again, `DotKit/PatchFinder.swift`, so repetitive text cannot leave it a line off). A mark that scrolls out
  of the window hides, a ring leaves a chevron at the edge, and both come back on the content. Switching apps clears
  them. Nothing runs while there are no marks. `Dot --track-selftest` checks it on the real screen inside Dot.app
  (Safari with an element anchor, Preview with a PDF and a pixel anchor; Vision text recognition is the independent
  truth): on 10/17 the pixel mark came back within 4 pt after a 1,800 pt scroll away and back, and the element mark
  followed with 0 pt drift.
- **The explainer panel.** Explanations go on a docked, resizable column on the screen he is on
  (`Panel/ExplainerPanel.swift`), written by Opus in Dot's UI language (`docs/ui-language.md`): text and math,
  steps lit while the voice says them (`[STEP:id:n]`), figures in a house style (`<vec>`, `<dot>`, palette tokens,
  arrowheads), plots, charts, tables, quizzes with feedback and a retry, follow-up chips, interactive explainers from
  the catalog (`<viz id>` or `<viz topic>`), and a small reactive layer (state, sliders, buttons, show/hide, each,
  `{expressions}`) that never runs model-written script. It streams as the model writes (`DotKit/PanelStream.swift`),
  docks away from the content Dot is marking, is saved to `~/Dot/talk/panels` (filed by course, with a "last time"
  recap when he comes back to a course on another day), and reopens by voice ("show the kernel one again").
  A quiz answer comes back as a turn the quick model grades in one line; a chip is a new question; selected panel
  text is what "this" means next. The quick talk model hands panel work to Opus with `[THINK]`.
- **The explainer catalog.** `Resources/board/viz/framework.js` (one register call per widget, sliders and steps
  built from its params, a test hook) and a build queue of interactive explainers for his subjects (linear algebra,
  finance and IB technicals, biology and biotech, statistics); `scripts/viz-check.py` is the gate (no errors, every
  control changes the picture, labels legible, nothing outside the frame, narrow layout), `scripts/viz-find.py`
  searches it, `scripts/viz-index.py` writes the index the panel and the prompt read. The `dot-viz` skill holds the
  build rules.
- **Tests and tools:** `scripts/panel-check.py` (every fixture in WebKit: no errors, streamed equals one-shot, quiz
  and chips post, steppers and sliders change state), `Dot --snapshot <folder> panel` (the app's own WKWebView),
  `Dot --panel file.ui`, `Dot --prompt talk|think`, `scripts/panel-dry.py` (past questions through the real think
  prompt, panels rendered on one sheet with latency and cost; `DOT_BOARD_DIR` points a dev build at a worktree).

## Round six: the notch out of the way, and agents he can control (2026-10-16)

His asks: the bar at the top "is too big and covers a lot of stuff"; replicate HeyClicky's features; "how do i
control agents, general agents, agent swarms, specific task agents", with the logic of OpenAI's dots and Meta's
Muse. What changed:

- **The notch takes only the space it draws.** The window hugs its content (221×42 at rest, larger only while a
  card is up), the way HeyClicky's notch moves between compact, hover and expanded geometries. The old window was
  an invisible 620×620 panel that swallowed every click under it. Escape clears the cards under the notch.
- **Rules for agents** (`~/Dot/rules.json`, Home › Agents): five kinds of action (reading, writing, using apps,
  sending and paying, changing the Mac) each get one of four behaviors: do it, only if I asked, ask first, leave it
  to me. Defaults plus per-agent overrides; the shape is dots' Custom Rules. A consent card offers "Allow for this
  task", HeyClicky's "your yes covers one conversation". Every decision is in the agent's transcript.
- **Routines** (`~/Dot/routines.json`): "every morning at eight, have Email draft the replies" sets one by voice
  (`[ROUTINE:agent:when:brief]`); the Agents page lists them with pause, resume, run now and delete. They run while
  Dot is open and online, never on a call; a run missed while the Mac slept happens once; three failures pause one
  with the reason; results land in the agent's thread with no chime.
- **Helpers.** An agent may hand independent parts to up to two subagents and report once; the card and Home say
  "with N helpers". Standing agents get two-word names that say the job; "make me three agents: …" founds up to five.
- **Spend per agent** on the Agents page, from the ledger.
- **From his chats:** the course-policy refusals are gone (a prompt rule; the refusal came from Atlas's course
  facts, not Dot's code), a too-short tap no longer shows an error, and `docs/agents.md` holds the agent design with
  its evidence. The research behind the round: `~/roshan/Learning/Research/2026-10-16-heyclicky-features/`.

## Round five: how it acts, and what it draws (2026-10-16)

His ask: "build my clicky alternative, not just in the scaffold but in how it acts, plus a professional
level of visualizations". The check behind it is `docs/heyclicky-verification.md`: 90 rows of what
HeyClicky does and draws, each with its evidence and Dot's verdict (68 pass, 5 beyond, 11 fail, 2 partial,
4 n/a). What changed:

- **The notch, HeyClicky's way.** The state in a word with voice bars beside it (listening, hearing you,
  thinking, thinking deeper, speaking, dictating). Typed notices with an icon and buttons: dictation on the
  clipboard, a learned word with undo, a dead microphone with a Sound settings button, a muted Mac with
  "turn sound on", the next meeting at ten minutes with "brief me", and an update once per version with
  "what's new". The agent card (avatar, name and state, the live line, stop and open). Hover the idle tab
  for the day and the agents' latest files as tiles you can drag out. The corners glow when something lands.
- **The morning card.** "morning. i can do four things for you today": deadlines in the next two days,
  calls and interviews on the calendar, mail waiting, open commitments, from Atlas. "show me" lists them
  with "do it" (an agent takes it) and "skip"; yes and no are kept in `~/Dot/suggestions.json` for a week.
  After seven, once you are idle and not on a call; a card closed without deciding comes back twice more.
- **Place and picture cards.** `[PLACE:coffee near campus]` puts Apple Maps results on a map with numbered
  pins, address, distance and links ("near me" is campus; set `homeLatitude` and `homeLongitude`).
  `[IMAGES:artemis ii launch]` puts a strip of Wikimedia Commons pictures with credits. "coffee near me" and
  "show me pictures of x" are answered by Dot itself with no model turn.
- **Marks.** The highlight draws itself on; the target ring springs in and pulses once when the click
  lands; a control behind another window gets a line saying so instead of a ring on thin air.
- **Home.** Voice (Kokoro and Apple voices with preview, speeds), Microphone (a device picker),
  Dictation (the dictionary editor), Shortcuts, Cursor (swatches, presence, recordings, the bubble),
  Skills (your `~/.claude/skills`), Suggestions (toggles and the yes/no history). Saved settings apply live.
- **Snapshots.** `Dot --snapshot [folder] [notch|overlay|cards]` renders every notch state, mark and card
  to PNG with one contact sheet, no screen turn needed. The visuals above were tuned from those files.

## Round four (2026-10-15, late afternoon)

His asks: Dot "struggles with traversing through pdfs" (it only read the pixels on screen), the speech bubble "doesn't look good", "a lot is missing between HeyClicky's binary and what i have; act as a senior dev", and "rethink dot and murmur, the different use cases; bring back murmur".

- **Documents by their words.** `DocumentReader` reads the document in front (PDFKit for a pdf the window names through accessibility or a pdf url, a web page's text, docx, md, txt; cached), `DocumentSearch` scores its passages against the lecturer's sentence or his question, `Navigator` brings the passage on screen with the app's own find box (command F, the phrase, return) or Preview's go-to-page, `ScreenSettle` waits for the redraw, and `TextRecognizer.lines` boxes the match where the OCR sees it. "find the part about x" is answered from the document in under a second with no model call; the lecture companion uses the same path; the model has `[FIND:phrase]` when it wants Dot to search.
- **The notch, not a bubble.** The line being spoken shows under the notch state (HeyClicky's way); the page stays clear. A typed question's answer streams into the notch and stays there with copy and close; typed answers are silent unless `speakTypedAnswers` is on. The orb's brows no longer tilt inward. Greets keep a small, light, two-line bubble.
- **Dot and Murmur.** Dot is the short companion: hold to talk, tap to type, hold control+fn for a sentence of dictation. Murmur (his own app, `/Applications/Murmur.app`) is the long recorder: double-tap fn, speak for as long as a meeting or a long note takes, double-tap again. Murmur runs again under `~/Library/LaunchAgents/com.murmur.app.plist` with history on, and Dot reads its history for "what did i say in the meeting". New in Dot: "listen to the lecture" keeps the ear open (`LectureListener`: a rolling transcript from the streaming recognizer, rolled every three minutes), "what did he just say" is answered from the last minute, "stop listening" saves `~/Dot/transcripts/lectures/<date>.md`, "recap the lecture" summarizes it. The menu has "Listen to the lecture" too, and the CLI has `--listen`, `--stop-listening`, `--find`, `--dictionary`.
- **From the ledger.** Agents' progress and results ride along in every talk turn ("what did the agent find"); a hold that stays silent names the mic and fails over to the built-in one; a muted Mac sends the answer to the notch as text; notices, offers and the meeting heads-up stay quiet on a call (mic in use elsewhere or a meeting app in front); a walkthrough waits for the screen to settle before its next look and says when it has not; a stroke is described as circled, a line along, or scribbled over, and several marks per hold arrive in order; "Show Dot in screen recordings" in the menu; the meeting countdown on the idle tab from thirty minutes out; a dictation dictionary (`~/.config/dot/dictionary.txt`, "add x to my dictionary", "x is spelled y"); a password field never takes dictation; `[STOCK:NVDA]` quote cards from Yahoo; stray fragments the key picks up ("oh uh") are dropped by Jev before they cost a turn; Home opens long results and .md outputs in a Markdown viewer (marked plus KaTeX) and expands a tool row to its output.
- **One notch for both apps.** Murmur's own notch indicator is off; Dot's notch follows Murmur's log (`MurmurWatcher`) and shows a red dot with a running clock while it records, "murmur transcribing" after, then "murmur pasted 1,216 characters into terminal" or "on your clipboard". Murmur's system notifications were never authorized, so this is also where its notices now land.
- Ledger after the round (`docs/heyclicky-coverage.md`): 51 built, 40 partial, 57 missing, 21 not applicable.

## Round three (2026-10-15, early afternoon)

The typed field works: a borderless `NSPanel` refuses to become the key window, so keystrokes
never reached it; `KeyablePanel` in `NotchHUD.swift` fixes that, the field focuses itself, Escape
closes it, and `Dot --input` opens it for tests. A turn the CLI drops in under two seconds (an
`error_during_execution` with nothing said, or a result that is only `[ede_diagnostic]`) is sent
once more and never spoken.

**The stage.** A lesson is one thing at a time. The model writes `<div class="stage process">`
(or `derivation`, `compare`, `concept`) holding one figure whose parts carry `data-step`, plus one
short `.caption` per step and nothing else; the explanation is spoken, not printed (Mayer's
redundancy and segmenting principles). Process and concept stages replace the frame on each
step, derivations accumulate lines and dim the earlier ones, comparisons reveal one side at a
time. The card is opaque and fixed (720 by 470 points), carries a back/dots/next bar and takes
the arrow keys once clicked. Dot speaks step one and holds the rest (`Talk.lessonHeld`) until
"next", the button, or a question; "back" and "again" are local; a question mid-lesson goes to
the model with the card's state and the board stays as it is. No check questions unless asked:
it is a conversation. `~/Dot/talk/cards/stage-pcr.html` is a hand-made example.

**Lecture companion.** When the held key picks up the lecturer rather than him (Jev's route
says "lecture"), Dot reads the screen with on-device OCR, hands the words and the screenshot to
the model, highlights the passage the lecturer is on and explains the concept in two or three
sentences. Transcripts of those turns are saved as `lecture` rows.

**Suggestions in context.** A new document in front (a pdf, slides, a problem set, a paper, by
window title or url) gets one quiet offer beside the cursor ("want the gist of this? say yes."),
chosen by Jev among gist, find today's part, and quiz; "yes" runs it, "no" is remembered, and a
kind turned down three times stops being offered. Ten minutes between offers.

**Design.** The bubble is one sentence, three lines, with a small label. Marks follow
HeyClicky's grammar in Dot's own color: dashed rings for clicks, dotted for hovers, dashed
boxes for highlights, solid label chips with white text (measured from the recorded session).
`docs/heyclicky-coverage.md` maps every one of HeyClicky's 169 components (its source-file
names, recovered from the binary) to a Dot owner and a status.
