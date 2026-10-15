# What HeyClicky can do: a reverse-engineered inventory

HeyClicky 1.0.53 (the closed app from heyclicky.com), read on 2026-10-14 and 2026-10-15 without
spending any of the account's free turns. Nothing here is copied into Dot: this is the map of
abilities Dot is built against, in Dot's own code and words.

**Evidence** (O = observed in the app's own files, I = inferred from names and prompts):

- `strings` of the app binary from HeyClicky.dmg (tag regexes, prompt fragments, settings copy,
  analytics event names, Swift file names such as `CompanionManager+Annotation.swift`,
  `ScreenAnnotationManager.swift`, `RealtimeWalkthroughSync`, `GuidedClickTarget`).
- Its runtime state in `~/Library/Application Support/Clicky`: the Codex config, the model
  instructions file, `skills/` (cua-driver, vercel-deploy), `SkillLibraryCache.json` (200
  community skills), `HomeSpaceCache` chat transcripts with reasoning steps, artifacts and
  suggested next actions.
- The MIT open-source Clicky (farzaa/clicky) for the cursor body, the bubble and the pointing loop.
- heyclicky.com's own copy.

## 1. A body on the screen

| Ability | Evidence | Dot |
|---|---|---|
| A character that follows the cursor on a spring, blinks and breathes, swoops along an arc to point | O (OSS BlueCursorView; "Idle blinks and breathing for larger Clickys. Hover and task expressions always respond.") | built: ember orb with eyes, lean, blink, breath, bezier flights |
| Character editor: packs, randomize, save; "larger Clickys" sizes | O (`clicky_character_editor_opened`, `clicky_character_pack_selected`, `clicky_character_randomized`) | not built |
| Hide the floating cursor; show or hide it in screen recordings | O (settings "Hide floating cursor", "Show in screen recordings") | presence toggle in the menu; recording visibility not built |
| Lives in the notch: idle black tab, hover peek of Clickys and latest files, click opens Home | O ("Quick peek on notch hover", `NotchHoverDwellRingView`, `IntroNotchHoverDemo`) | built: idle tab, hover line, click opens the field |
| Meeting countdown in the notch, upcoming meetings on Home | O ("Calendar events on Home + a meeting countdown notch") | not built (Atlas calendar is one tool call away) |
| Morning notch with suggestions | O ("Fresh task suggestions every 24 hours, announced through the morning notch.") | partial: morning greeting line; no suggestion cards |

## 2. Talking to it

| Ability | Evidence | Dot |
|---|---|---|
| Hold a key and talk; release to send | O ("Hold to talk to HeyClicky. Release to send.") | built (control+option) |
| Tap to type instead | O ("Press to type to HeyClicky instead of talking.") | built (tap opens the notch field) |
| Realtime voice: a one-second filler, then 5 to 20 s to the real content on screen turns; interruptible; synced with the visuals | O (gpt-realtime-2.1 in its log; measured 2026-10-15, docs/heyclicky-session-2026-10-15.md) | Dot: instant acknowledgment, 2 to 4 s to the first visual; voice quality is the remaining gap |
| Always-on voice mode (no key) | O (`always_on_voice_mode_enabled`) | not built |
| Dictation: hold or toggle, inserts at the cursor, language auto-detect, a 50-word dictionary, paste verification; observed: clipboard fallback with a notch notice when no field can be captured, transcript archive per day | O (settings copy, `dictation_*` events; session 2026-10-15) | not built |
| Voice picker and speed, microphone picker, languages | O (settings pages) | config keys only |
| Short "one sec" preamble when a slow tool is needed | O (prompt fragment) | built via Jev routing ("on it") |

## 3. Seeing

| Ability | Evidence | Dot |
|---|---|---|
| Screenshots of every display, cursor display first, own windows excluded | O (OSS capture utility) | built |
| Accessibility harvest of the frontmost window's elements with frames | O (`AnnotationAccessibilityHarvester`, "AX context") | built (70 elements, 0.6 s budget) |
| Draw on the screen while holding the key (a stroke, not a box); elements inside the mark are harvested; the question is about the marked thing | O (`ScreenAnnotationManager` strokes, "drew a highlight on their screen", `annotation_gesture`) | partial: box drag; stroke ink not built |
| Hand a drawn region to an agent | O (`HandoffRegionSelectOverlay`, `handoff_rect_queued`) | not built |
| Knows the frontmost browser host | O (`frontmost_browser_host`) | url and window title |

## 4. Showing: the visual language

| Ability | Evidence | Dot |
|---|---|---|
| Tags: `[POINT:x,y:label[:screenN]]`, `[HIGHLIGHT:...]`, `[TARGET:x,y,r:label]`, `[HOVER:x,y,r:label]`, `[SHAPE:line\|arrow\|circle\|curve\|polygon:x,y;x,y...:label]`, `[TYPE:x,y:label] <<< text >>>` | O (regexes in the binary) | POINT, HIGHLIGHT, TARGET, HOVER, SHAPE built; TYPE not built |
| Beats: the answer is tag-first lines, each visual lands when its words are spoken | O ("tag-first beat lines", "parsed beats=... visuals=...", beat fractions) | built 2026-10-15: BeatStreamer, speech-synced visuals, one beat per bubble |
| Tours: "look around my screen and draw attention to something interesting", 2 or 3 beats, enclosing circle or polygon; observed: 6 dashed-box beats on a Wikipedia article, first beat 19 s after release | O (tutorial draw-demo prompt; session 2026-10-15) | built: "show me around" walks the page in three to six beats |
| Guided walkthrough: one target per turn; click-to-advance budget; hover targets complete when the cursor rests; reveal vs commit (don't re-ring an opener); never ask to repeat a done step | O (guided prompt fragments, `completed_by_hover_rest`, "remaining click-to-advance turns") | built 2026-10-15 |
| Step-away (user switched app): step back, no nag; off-target clicks end the guide quietly | O ("Guided walkthrough step-away", "off-target click ... ending guide (no nag)") | built |
| Freshness: user acted while the next step was being computed | O ("user_acted_while_waiting", "Important freshness update") | built |
| Walkthrough history fed back ("What has happened so far, oldest first") | O | built (steps so far, steps left) |
| Target occlusion check (is the ringed window visible) | O (`[tour-visibility] occlusionState`) | not built |
| Speaks exactly the one instruction for a rendered step | O | prompt rule |

## 5. Clickys: named agents

| Ability | Evidence | Dot |
|---|---|---|
| Agents run on a bundled Codex runtime with an AGENTS.md identity and notes per Clicky | O (CodexHome config.toml, AGENTS.md templates) | built on Claude Code with CLAUDE.md per agent |
| Starter Clickys made from an onboarding interview (three of them) | O ("HeyClicky makes three new Clickys from your answers") | not built |
| Chat threads per Clicky with reasoning-step commentary, artifact cards, suggested next actions | O (HomeSpaceCache transcripts) | built: result cards, outputs, Next button, reply field |
| Voice announcement when a Clicky starts or finishes; reply streams in a bubble beside the cursor | O (settings) | built (spoken first sentence) |
| Routines: scheduled runs, pause, dispatch log | O (`clicky_routine_*`) | not built |
| Extra-usage and turn-lease approvals, auto-approve | O | n/a (Claude Max) |
| Interrupt, follow up, hand off between agents, archive, legacy agents | O | reply and follow-up built; archive not built |
| "Clicky organizer": founds a new Clicky from a thread | O (`[clicky-organizer] founded`) | NEW_AGENT tag |
| Agent space / dashboard with earlier agents | O (`agent_space_*`) | Dot window |

## 6. Operating the Mac

| Ability | Evidence | Dot |
|---|---|---|
| A computer-use daemon inside the app (Cua) with a per-turn consent card; "Always allow" | O (skills/cua-driver/SKILL.md, `cua-driver-policy.yaml`) | built: agents carry the cua-driver MCP; CuaDriver.app has Accessibility and Screen Recording (checked 2026-10-15 with `cua-driver permissions status`) |
| Jev fast lane: `drive_until` clicks through a window at about half a second a step | O ("Fast computer use (Jev)") | not built; Jev used for routing, element picks, consent, notices |
| Work in the background, own browser window, user's windows read-only | O | agent rules |

## 7. Integrations and skills

| Ability | Evidence | Dot |
|---|---|---|
| Composio integration catalog, account labels, reconnect flow | O | Atlas tools instead (mail, calendar, Canvas, people, notes) |
| Custom MCP connectors (URL or command), tokens in Keychain | O | mcp.json |
| Skill library (200 community skills), 3 active slots, "Create a skill" with deep research | O (SkillLibraryCache.json) | Claude Code skills in each agent's folder |

## 8. Proactive

| Ability | Evidence | Dot |
|---|---|---|
| Suggestion cards with yes/no history and a daily sweep | O ("Reset suggestions... the yes/no history, today's automatic check, and the morning notch") | partial: deadline-aware notices via Jev on app switch |
| Quiet during calls or screen sharing; routines finish quietly in Do Not Disturb | O | not built |

## 9. Onboarding and Home

| Ability | Evidence | Dot |
|---|---|---|
| Intro video, hatch flight, hands-on tour (say hi, draw demo, Home tour beats), interview | O (`IntroHatchFlightOverlay`, tutorial prompts) | not built |
| Home: chat composer with attachments, voice input, settings pages, shortcut help, developer model picker | O | Dot window with chat and composer |
| Sign-in, plans, extra usage, referrals, Sparkle updates, analytics | O | n/a |

## Observed 2026-10-15

A recorded session on his Mac (docs/heyclicky-session-2026-10-15.md) measured the timing, the
marks it draws, the walkthrough loop, the typed and dictation paths, the Agent HUD and the Home
pages. The task list that came out of it is docs/tasks.md.

## What this means for Dot's order of work

Done tonight: beats synced to speech (4), tours (4), the walkthrough mechanics (4), HOVER and
SHAPE (4), Atlas tools wide open instead of a today block (7).

Biggest remaining gaps, in the order they change the feel: realtime voice (2), stroke
annotation and region hand-off (3), TYPE steps and a Jev fast lane for agents (4, 6), routines
(5), meeting countdown and suggestion cards (1, 8), onboarding tour (9).
