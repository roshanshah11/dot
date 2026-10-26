# How HeyClicky draws on the screen, and Dot's answer

The D0 pass of the parity run (plan: ~/Dot/plans/2026-10-26-heyclicky-parity/01-drawing.md). Read from HeyClicky 1.1.1
(~/Dot/research/heyclicky-1.1.1/HeyClicky-1.1.1.dmg, mounted read-only) for behaviour only: file headers, piece
comments, class names and settings copy. Nothing of its code, prompts or assets is in Dot. Each row names its
evidence so a later reader can check it; "Resources/" is `HeyClicky.app/Contents/Resources/`.

Static reading only. Runtime capture was skipped: 1.1.1 is not installed, and installing it over his 1.0.53 is his call.

## The architecture in one paragraph

The model writes a drawing as a small program (or as data) against a piece library. A JavaScript engine turns the
program into hand-drawn SVG geometry with timing; on the Mac there is no browser, so a shim records what the engine
paints and Swift redraws it with Core Animation (`clicky-draw-native.js` header: "The app reads those records after
every call (__drainRender) and draws them with Core Animation"). 3D parts are meshed by three.js in a separate
JavaScriptCore context and drawn by a Metal stage (`clicky-three-parts.js` header; classes `ScreenDrawing3DStage`,
`DaVinci3DStudioRenderer`).

Dot's answer keeps its own shape: the model writes beats in Dot's tag grammar (TagParser), DotKit turns each tag
into stroke geometry and timing (tested Swift, no JS engine), and OverlayWindow draws it natively. One renderer, no
JavaScriptCore, no model-written code running on his Mac. That costs HeyClicky's open-ended programs (graph(),
timeline(), helper functions); Dot covers those with the panel, which already renders charts, timelines and 3D.

## The look

| HeyClicky behaviour | Evidence | Dot |
|---|---|---|
| Every mark is one ink: the user's cursor colour, with a soft glow in that colour | pieces.js header: "every mark is Clicky's ink, the user's cursor colour, with a soft glow" | D1: Dot's accent from the theme tokens, glow by a blurred copy of the stroke layer |
| Things are named in solid pills of the ink colour with white rounded words | pieces.js header; `label()` comment | D2 `[LABEL]`: pill in the accent, white SF Rounded words |
| Steps are numbered badges in the ink | `num()` comment | D2 `[NUM]` |
| A region is a dashed frame with a faint tint, dragged open from its corner like a selection | `frame()` comment; `__hostMarquee` comment | D2 `[FRAME]`: dashed outline plus 8% tint; the outline draws from the top-left corner |
| Free words are white on dark areas, near-black on light ones, chosen per spot | pieces.js host hooks: `__inkFor(x, y, w, h)` returns `#FFFFFF` or `#15171C` | D1: luminance of the screenshot under the word's box, two tones |
| Paper (sticky, receipt, clipping) only for explanation on calm space, never to name a thing on screen | pieces.js header: "Paper ... is only for an explanation card on calm space" | D2 `[STICKY]` placed by the layout check on the calmest free spot; receipts and clippings stay in the panel |
| A name pill goes beside its mark on the calmest free spot, never on another pill | `__nameMark` and `cost` comments | D2 layout check: candidate spots above, below, right, left, scored by AX text and controls under them |
| A ring hugs its target's shape: pill for wide or thin things, round for small square things, rounded box for big ones | `ring()` and `__ringRadius` comments | D2: the ring shape picked from the target's aspect ratio and size |
| Handwriting font; UI words in Barlow | Resources/ClickyDraw-PatrickHand.ttf, ClickyDraw-Barlow-*.ttf with an OFL licence file | D1: Patrick Hand fetched from its own source (Google Fonts, OFL), recorded in ATTRIBUTION.md; UI words stay SF Rounded |

## The pieces, and which ones Dot builds

Vocabulary from `clicky-draw-pieces.js` (each a function with a one-line comment).

| Piece | What it does there | Dot |
|---|---|---|
| point, ring, target, hover | ring the spot or the control, named; target waits for the click | today: `[POINT]` `[HIGHLIGHT]` `[TARGET]` `[HOVER]` |
| frame | an area: dashed outline, tint, name | D2 `[FRAME]` |
| ink, inkCircle | free strokes and loops | today: `[SHAPE:line,arrow,circle,curve,polygon]`, redrawn as tapered ink in D1 |
| write | free handwriting on calm space | D2 `[WRITE]` |
| label, tag | the name pill | D2 `[LABEL]` |
| num | step badge | D2 `[NUM]` |
| underline, strike | a line under or through words; underline sits below the letters' bottom | D2 `[UNDERLINE]` `[STRIKE]` |
| connect | curved arrow between two things, optional label | D2 `[CONNECT]` |
| trace | closed outline around an irregular region, optional tint | D2 `[TRACE]` |
| check, cross | tick or X beside a thing | D2 `[CHECK]` `[CROSS]` |
| scroll | double chevron "scroll here" | covered by `[POINT]` plus a label; not a new tag |
| sticky | paper note, slightly askew, soft shadow, tape in the ink's light tone | D2 `[STICKY]` |
| photo, tie, searched | a real picture dropped in (never people), a curved arrow from a row to its photo | D2 `[PHOTO]` through Images.swift; `tie` is `[CONNECT]` to the photo's box |
| typeText, copyText, openPage | act for him when the line is heard | today: Dot's action tags and Hands; D2 adds `[TYPE_TEXT]` as typed-on ink that also types (never Return) |
| button, handOff | a pressable button; give work to an agent | today: cards and `[AGENT]`; not drawn |
| sfx | an accent sound for the next mark (ding, nope, stamp, tada, sparkle, whoosh, boing) | D6: accents picked by the mark kind, not a tag |
| spotlight | dim the screen except one opening | not built: no pick for it in his list |
| receipt, clipping, legend, paper, graph, timeline | windows and diagrams drawn on the screen | the panel (round eight), not ink |
| jobTicket, dreamMedal, tuckJobs, showNotch, fadeAway, nextQuestions, tourJob | the drawn welcome tour | out: he did not pick a drawn tour |
| task, waitForUser, onScreen, lessonTitle, plan | walkthrough and bookkeeping lines that draw nothing | today: walkthroughs; `onScreen` is Dot's per-screen overlay choice |

## Timing

| HeyClicky behaviour | Evidence | Dot |
|---|---|---|
| Strokes after a spoken line are released while that line is spoken and spread across it; line times can come from the host | engine.js header, 1.5: "drawing paced to speech" | D3: a beat's marks start with its sentence (today) and their progress spreads over `SpeechActivity.onSentence(duration:)`; 65 ms per character when no duration |
| Pen reveal runs in drawing order | engine.js header: "a pen-reveal animation in drawing order" | D3: marks in one beat draw one after another inside the sentence |
| `finishNow()` draws everything still waiting at once while the voice carries on | engine.js header, 1.5 | D3: on "stop listening" or a cut answer, every pending stroke jumps to done |
| `pause()` holds the pen after the current stroke on a barge-in, `resume()` carries on, nothing is wiped | engine.js header, 1.6; the `pause()` body: held strokes queue until resume | D4: barge-in holds the pen and keeps the drawing |
| A button goes up only once its whole beat is drawn | native.js "buttons wait for their beat's drawing" | not needed: Dot draws no buttons in ink |

## Live edits

| HeyClicky behaviour | Evidence | Dot |
|---|---|---|
| Every part has an id (p1, p2 in program order) and every mark an id (m0, m1); `state()` is that list as short lines for the model | engine.js header, 1.6 | D4: mark ids `m1`, `m2` and an `[on screen]` block in the next turn, one line per mark |
| Edits on the drawing already there, each animated: recolor, restyle, move, moveTo, scale, erase, redraw, add, highlight, undo | engine.js header, 1.6; durations per op (erase staggered per mark, move and scale glide, highlight 0.6 s) | D4: `[EDIT:id:recolor\|move\|scale]`, `[ERASE:id]`, `[UNDO]`, `[ADD:...]`; restyle and redraw fold into an erase plus a new mark |
| Erase runs the pen backwards | engine.js header | D4: erase animates progress from 1 to 0 |
| A new edit can cut into a running one, which jumps to its end | engine.js header: `L.settle()` | D4: an edit settles the mark's running animation first |
| `startOver` clears the page | engine.js edit durations; native.js sounds (`page-clear`) | a new turn clears the last turn's ink (D1), unless it carries `[ADD]` or edits |

## 3D

| HeyClicky behaviour | Evidence | Dot |
|---|---|---|
| A figure is built from part recipes: kind, sizes in world units, an axis, an uneven stretch | three-parts.js header | D5: `[FIGURE]` recipes with name, primitive, size, position, rotation, material, colour |
| A vertex cap per part so a runaway recipe cannot stall the kernel | three-parts.js `MAX_VERTICES = 120000` | D5: a vertex cap per part; a failed recipe is skipped with a log line |
| Parts mesh in the background the moment their line runs, long before the beat draws them | three-parts.js header; native.js `__shape3d` | D5: SceneKit geometry built when the tag parses, shown when its beat starts |
| Studio lighting; materials by roughness, metalness, opacity, glow | `DaVinci3DStudioRenderer`, engine.js `MATERIAL_KEYS` | D5: SceneKit physically based materials: matte, glossy, metal, glass |
| Colour names on a figure are the colours real things have, not the candy ink | engine.js `REAL_TONES` comment (2026-10-13) | D5: figure colours from a realistic palette; ink colours stay for 2D |
| Every figure turns on its own, about 80 s a turn, never still | engine.js stage comment (2026-10-09) | D5: a slow idle turn until he drags it |
| Paper never lands on a figure: it steps aside | pieces.js `__clear` comment; engine.js "moved a paper piece off a 3D figure" | D5: the layout check treats a figure panel as busy space |
| A drag handle on the stage | class `ScreenDrawing3DHandle` | D5: drag turns it, scroll zooms |
| Clicking a part to ask about it | not found in static strings | D5 builds it anyway (his pick "3D you can click"): a click on a named part sends `[part] he clicked "<name>"` to talk |

## Sounds

| HeyClicky behaviour | Evidence | Dot |
|---|---|---|
| Every pen stroke and written word gets a texture (felt tip on the screen, pencil on a card, handwriting, eraser) whose loudness and pitch follow the pen's speed, so the sound starts, swells and stops with the ink | native.js "the drawing's sounds" section | D6: a looped bed per texture, gain and rate driven by the stroke's progress speed |
| Moments get their own sound: a card or photo landing, a pill or badge popping in, a click target, typing, a 3D part, slide for move and scale, highlighter, page clear | native.js `soundOf()` | D6: one sound per mark kind at stroke start |
| Accents only when the meaning earns one | pieces.js `sfx()` comment | D6: check gets a tick, cross a soft "nope", the last mark of an answer nothing extra |
| 43 families, 80 files | Resources/*.wav names (pen-screen-bed, pencil-paper-bed, handwriting-bed, eraser-bed, highlighter, badge-pop, gel-pop, sticky-press, tape, paper-place, photo-drop, target-ping, type-keys, slide, page-clear, build-3d, ding, nope, stamp, tada, sparkle, whoosh, boing, ...) | D6: Dot's own CC0 set (Kenney, freesound CC0), each file and source in ATTRIBUTION.md; none of these files |

## Captions

| HeyClicky behaviour | Evidence | Dot |
|---|---|---|
| A setting "Captions while HeyClicky talks": what it says at the bottom of the screen, word by word, while it draws; typed questions always caption | added.sentences (settings copy); key `_voiceCaptionsEnabled`; classes `ScreenDrawingLiveCaption`, `ScreenDrawingNativeCaption` | D7: a strip at the bottom of the screen he is on, words lighting by character share of the sentence's duration; Home > Voice "Captions while Dot talks", off by default; typed questions that draw always caption |
| A debug caption shows the beat number, seconds heard, and each mark's state | native.js `renderSubtitle()` | Dot's log line per beat already carries this; no on-screen debug strip |

## Cursor

| HeyClicky behaviour | Evidence | Dot |
|---|---|---|
| A pen cursor follows the ink and is handed back after | classes `ScreenDrawingPenFollower`, `ScreenDrawingPenHandoff`, `ScreenDrawingPenCursorController`; `__isScreenDrawingPenBorrowed` | SH-02: the private "SetsCursorInBackground" connection property behind a runtime lookup, so Dot can show its cursor while another app is in front; off when the symbol is missing |

## What Dot does not take

- Model-written code running on his Mac (the engine's `live()` programs and its sandbox). Tags are data; DotKit
  validates every coordinate and string before anything draws.
- The welcome tour pieces, spotlight, drawn buttons and the drawings library (he passed on keeping drawings).
- Any HeyClicky file: fonts come from their own sources, sounds from CC0 packs, shapes from Dot's own geometry.
