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
| Hold **control + option** and talk | Looks at your screen, answers aloud in a sentence or two (and in a bubble beside the orb), points at the element you asked about |
| Drag while holding | Draws a box; Dot answers about what is inside it (the region is cropped and enlarged for the model) |
| Ask "how do I..." | One step at a time: Dot rings the control to click, sees your click, and gives the next step |
| Hold **control + option + shift** and talk | Hands the request to a background agent and tells you when it is done |
| Tap **control + option**, or click the tab under the notch | A text field for a typed question |
| Press **escape** | Stops Dot talking |
| Say "go do it", or ask for real work | The request goes to an agent on its own; a confident route skips the talk model entirely |
| Switch to an app that touches a deadline | One quiet line beside the cursor ("heads up: wells fargo coffee chat, due today") |

Every talk turn carries a `[today]` block read straight from Atlas (deadlines, calendar,
open commitments, mail waiting, priorities, preferences; no model call, a few seconds in the
background every ten minutes), and a dozen Atlas tools (search, facts, people, calendar,
commitments, canvas, remember, deadline_add, commit) so "what's due", "who is she" and
"remember that" work by voice.

Agents live in `~/Dot/agents/<name>/`, each with a `CLAUDE.md` that is its identity and
notes, an `output/` folder for deliverables, and a transcript. They run as Claude Code
sessions on Opus with your skills, your MCP servers, and your settings. Reads happen
silently. Clicks, keystrokes, sends and writes outside the agent's folder show an Allow / Not
now card in the notch. When an agent finishes, its row in the notch opens into a card: the
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

## Not yet

Hands-free always-on voice, guided multi-step walkthroughs that watch for your click,
draw-to-ask region selection, a `drive_until` fast lane for computer use, and embedding
cua-driver inside Dot.app. Dictation is left to [Murmur](https://github.com/roshanshah11/murmur).

MIT. Built by Roshan Shah.
