# Dot, alive: a really cute pet with a little mischief (build spec)

Start it with:

```
/overnight build Dot's alive pass from ~/Projects/dot/docs/alive.md
```

The research behind every number is in `~/roshan/Learning/Research/2026-10-17-dot-alive-persona/`:

- `answer.md` is the summary.
- `branch-craft.md`, `branch-science.md`, `branch-persona.md`, `branch-rea.md` and `branch-cute.md` are the detail.
- `ledger.json` holds each claim with its verbatim quote. Ids like (science-C29) or (cute-C31) point into it.

A value marked *my call* is a design choice, not a sourced number. The run may tune these if the previews
show a problem, and it logs each change.

## Decisions (settled with Roshan on 2026-10-17; the run treats them as fixed)

| Decision | Setting |
|---|---|
| Phases | 0 (architecture), 1 (eyes and motion), 2 (a pet's day), 3 (persona) |
| Persona | **Little mischief, and "a really really cute pet"** (his words). Teasing and affectionate, never mean. It teases the work (the deadlines, the 80-page PDF), not him. |
| Face | Bigger, lower eyes with a white highlight. No mouth at rest; a tiny mouth only for speaking and happy. Blush when petted or praised. Brows removed. |
| Size | **24 px by default**, through a new `orbSize` setting. Previews at 20, 24 and 28. The px values below are for a 20 px orb; scale them by orbSize / 20. |
| On-screen mischief | **Pet antics only at breaks**: it chases a flung cursor, pounces, and naps on a window edge. Never while he types or reads. It never clicks, never drags, and never covers what he's reading. |
| Petting | **Rub it with the cursor** (a gentle back-and-forth over Dot). |
| Quips | One cheeky line at a break, **at most every 40 minutes**, as a bubble with no voice. |
| Install | **Yes, at the end of the run**, after every check below passes. If any install check fails, reinstall main. |
| Push | **No.** The branch stays local, rebased on the newest main. |

## Ground rules

- **Work in a worktree**, so the other Dot sessions on main are untouched:
  `git -C ~/Projects/dot fetch origin && git -C ~/Projects/dot worktree add ~/Projects/dot-alive -b alive origin/main`.
  Commit there in small steps, one per checklist item that passes. Never touch main's working tree, and never push.
- **Keep what already works:**
  - Reduce Motion: a still pose, no flights. It now also turns off hops, tilts, wobbles and antics, but
    keeps blinks and expressions (cute-C50).
  - The orb rests while its window is covered.
  - The agent glyph orbit and the waiting pulse.
  - Marks, bubbles and chips.
  - The `Dot --snapshot` states.
- **Checks:**
  - `swift build` and `swift test` pass in the worktree.
  - New logic lives in DotKit, where it can be tested.
  - Every item below names its check, and an item is ticked only after that check passed.
- **Cost:** the animator step stays cheap (a test measures it). The SwiftUI timeline keeps pausing when
  nothing moves: asleep between breaths, covered, or Reduce Motion.

## Phase 0: architecture and previews

1. **A pure animator.** Add `Sources/DotKit/OrbAnimator.swift`:
   - It holds no SwiftUI or AppKit. It takes an injected clock and a seeded random generator.
   - Inputs:
     - the phase, the mood and the motion (following, flying, parked);
     - the cursor position and velocity;
     - the seconds since the last mouse, key or scroll input;
     - the frontmost window's frame.
   - Event calls: `sentenceStarted`, `answerStarting`, `answerEnding(in:)`, `micPause`,
     `flightWillStart(toward:)`, `react(_:)`, `onCall`, `recording`, `agentWorking`, `reduceMotion`.
   - Output: an `OrbPose` struct:
     - per eye: openness, upper lid, lower lid, scale, tilt and highlight position;
     - the shared eye offset;
     - the body's scaleX, scaleY, rotation and offset (for hops);
     - blush, glow, mouth open and mouth curve;
     - an optional glyph ("z", "!");
     - a `restingUntil` hint, so the view can pause its timeline.
2. **The view draws the pose.** `OrbView` in `Sources/Dot/Overlay/OverlayWindow.swift` draws one
   `OrbPose`. `OverlayManager` owns one animator per `CompanionModel` and calls it from its existing
   60 Hz tick. The view keeps no animation logic of its own.
3. **The `orbSize` setting.** Add it in `Config.swift` in the existing `get(.key, default)` pattern,
   default 24, clamped to 16-36, and list it in README's configuration table. The follow offset and the
   bubble placement scale with it.
4. **The previews.** Add a `Dot --snapshot alive` group:
   - **Stills:** a contact sheet at 4x of every mood and phase, plus mid-blink, petted, drowsy and
     asleep, at 20, 24 and 28 px, plus eye gaps of 0.16, 0.20 and 0.24.
   - **Reels:** scripted scenarios rendered from the animator at 30 fps and joined into GIFs by
     `~/.local/bin/ffmpeg`:
     - idle with darts and a blink;
     - listening with pauses;
     - thinking, then the answer;
     - speaking three sentences;
     - a flight to a target;
     - a fling chase and pounce;
     - a rub;
     - the pet routine through to sleep, then waking;
     - agent done and agent failed.
   - **Before:** render main's current orb first, as stills and as the same reels where they apply.
   - Write everything to `~/Dot/snapshots/alive-<stamp>/before|after/`.
   - *Check:* both sets exist. Open the after contact sheet and three reels and look at them before
     calling the run done.

## Phase 1: eyes and motion

Each item gets unit tests in `Tests/DotKitTests/OrbAnimatorTests.swift`. Simulate 10 minutes with a fixed
random seed.

1. **Blink shape.**
   - Close in 100 ms, shut for 30 ms, open in 200 ms, with an ease-out on the opening. Closing is faster
     than opening (science-C5, C6; Vector's fast-close and slow-settle, craft-A2-13).
   - The eye widens up to 1.2x as it flattens (craft-A2-12; the cap is my call).
   - *Check:* sample the openness curve; closing time is under opening time, and the total is 330 ms ± 1 frame.
2. **Blink timing by moment.**
   - **Idle:** about 12 a minute, with jittered (not uniform) intervals. People blink 17/min at rest and
     4.5/min while reading (science-C1, C2); Vector blinks every 3-10 s (craft-A2-04). 12 is my call.
   - **Speaking:** blink at about 70% of `sentenceStarted` events, 0-200 ms after the start (blinks cluster
     at punctuation, science-C10; the 70% is my call).
   - **Listening:** blink 0.25-0.5 s after a `micPause`, where a pause is mic level below the floor for
     at least 300 ms (science-C12, C13). The rest of the time, blink at about 10/min.
   - **Also:** one blink at each gaze shift larger than half the eye travel and at each flight takeoff
     (science-C14), and one when Dot appears on a screen (rea-C7).
   - *Check:* the simulated per-minute rate per phase lands in its band (idle 9-15, listening 8-20,
     speaking 15-30). No blink starts within 150 ms of the previous one ending.
3. **Eye jumps snap.**
   - A jump takes 2-3 frames (25 ms + 2.4 ms per degree, science-C20). Today's 0.9 decay drift goes away.
   - Most jumps are small, 90% under a third of the travel (science-C19). Draw them from a distribution,
     not a uniform pick (science-C24, C25).
   - *Check:* a jump completes in 3 frames or fewer. The 90th percentile of jump size is at most a third
     of the travel.
4. **Idle darts.**
   - Only after the cursor has rested 1.5 s (*my call*): every 1-2.25 s (craft-A2-05), at most 1.6 px
     (craft-A2-06 scaled). While the cursor moves, the eyes lead the motion as they do today.
   - *Check:* no dart fires while the cursor moves, and every offset stays within the scaled cap.
5. **Where Dot looks** (science-C29 to C34).
   - **Thinking:** look up and to the right for at most 3.5 s, with a blink at the start. Return to
     center at `answerStarting`, or after 3.5 s, whichever comes first.
   - **Speaking:** glance aside for about 2 s, with about 4.75 s between glances (jittered). From
     `answerEnding(in: 2.4)` on, the eyes are centered and stay there.
   - **Listening:** eyes centered, with a glance aside of about 1.1 s and about 7.2 s between glances.
     The offset stays small (craft-A2-06).
   - **Before a flight:** the eyes jump toward the target 150 ms before takeoff (*my call*, from
     anticipation, craft-A1-04).
   - *Check:* a thinking aversion never outlasts 3.5 s or `answerStarting`. There are no aversions after
     `answerEnding`. A flight's first eye offset points toward the target.
6. **Follow on a spring.**
   - Replace the 0.28 lerp in `OverlayManager.tick` with a spring of about 0.3 s and bounce about 0.12
     that keeps its velocity when the cursor moves again (craft-A5-02, A5-03; the 0.3 s is my call,
     craft-A1-09).
   - *Check:* following a cursor that reverses direction, the velocity stays continuous, and overshoot
     is under 15% of the move.
7. **Squash keeps volume.**
   - Body scaleX x scaleY = 1 at every frame (craft-A1-05). Today's lean reaches 1.25 x 0.87 = 1.09.
     Stretch along the direction of travel, at most 1.3 / 0.77.
   - *Check:* |sx·sy − 1| < 1e-6 for every simulated frame.
8. **Flights.**
   - 150 ms of anticipation first: a squash away from the target plus the eye glance.
   - Then stretch along the path instead of today's 1.3x swell, which reads as looming (science-C55)
     and came from Clicky (rea-C24).
   - The eyes trail the body by one frame (craft-A1-13). The landing squashes with a small overshoot,
     settling in about 200 ms.
   - *Check:* the body area never exceeds 1.0 during a flight. The anticipation starts before any
     position change.
9. **Breath and glow.**
   - Keep a steady sine (science-C47), slowed from 2.6 s to about 5 s, with amplitude ≤2% (*my call*;
     science-C48).
   - Glow brightness drifts on slow 1D noise within 0.92-1.14x (craft-A2-14).
   - *Check:* the breath period is 5 s ± 0.1. Glow stays inside the band over 10 minutes.
10. **The cute face.** The fractions are of the orb's diameter.
    - **Eyes:** each 0.20 wide and 0.40 tall. Today's are 0.17 x 0.34. Larger eyes are the main
      baby-schema cue, and 0.20 stays inside Glocker's limit of +2 SD from the infant average
      (cute-C31, C32, C33).
    - **Placement:** centered 0.05 below the orb's middle (low-set eyes, cute-C52; the offset is my call).
      The gap stays 0.20, and the previews show 0.16 and 0.24 too.
    - **Highlight:** one white dot per eye, 0.06 of the orb, upper left and inset 25% from the top of the
      eye. It sits on the same side in both eyes and stays fixed to the light as the eyes look around
      (cute-C9, C10; the size is my call).
    - **Moods are eyelid poses**, blended on a spring with zero bounce (rea-C11; Cozmo's slit happy eyes,
      craft-A2-18):
      - happy: lower lids up into slits;
      - puzzled: the right eye at 0.85x, plus a head tilt (Phase 2, item 7);
      - focused: both upper lids down 15%;
      - sleepy: both upper lids down 55%.
    - **Brows** are removed from `face(body:talking:t:)`.
    - **Mouth:** none at rest (Hello Kitty has none, cute-C13). A tiny mouth, at most 0.20 of the orb
      wide, appears only while speaking and for happy (a small "w" or curve). A small mouth is the cute
      end of the scale (cute-C32).
    - **Blush:** two soft rose ellipses, each 0.18 x 0.10 of the orb at about 30% opacity, below and
      outside each eye. Shown only when petted or praised (my call; no study tested blush, cute-C35).
      Check it against the ember orange in the previews.
    - *Check:* snapshots of every mood at three sizes. The 4x sheet shows highlights in both eyes on the
      same side, no brows, and no mouth in neutral idle.
11. **The mouth follows the voice.**
    - In `CommandSpeaker` (the AVAudioPlayer at line 214), set `isMeteringEnabled`. Read
      `averagePower(forChannel:)` every 80 ms (craft-A6-06), convert it to 0-1, ignore anything below a
      0.05 floor (craft-A6-07), and send it to the overlay as a speech level.
    - The mouth opens with it, up to the size cap above, and closes in pauses.
    - Keep the two-sine mouth only for the Apple-voice fallback.
    - *Check:* a unit test on the dB-to-openness mapping (the floor holds, the range is monotonic). In a
      reel, the mouth is closed between sentences.

## Phase 2: a pet's day

"Input" means mouse, keys or scroll, read with `CGEventSource.secondsSinceLastEventType` (the way
`TrackSelfTest.swift` reads mouse and keys; add scroll). "Typing" means a key in the last 2 s.

1. **Calm while he works.**
   - Input within the last 60 s: normal (Phase 1).
   - 60 s to 3 minutes without input: he's most likely reading, so Dot gets calmer, with darts every
     4-8 s and blinks about 6 a minute (readers blink 4.5/min, science-C2; motion onsets pull attention,
     science-C54).
   - Nothing pet-like happens in this window.
2. **The pet routine.** Only after 3 minutes without input (*my call*, so that reading isn't treated as
   a break). It follows oneko's order (cute-C38 to C47), slowed down for a pet that's on screen all day.
   - **First, move off his text.** Dot trots (a squash-and-stretch gait) to the top edge of the
     frontmost window near the cursor, using its frame from `CGWindowListCopyWindowInfo`. With no
     window, it goes to the nearest screen edge. It never parks over window content (cute-C21).
   - **Then, measured from arrival:**
     - settle 1.5 s;
     - groom: a small side-to-side wiggle with eyes half closed;
     - scratch: a tilt and a jiggle;
     - yawn: squash tall with eyes shut, held long (oneko's authors lengthened it);
     - drowsy at about 5 minutes since the last input: lids down 45%, breath 7 s;
     - asleep at about 15 minutes: closed slits, breath 9 s, glow 0.7x, and a small "z" every 6 s. The
       timeline rests between breaths.
   - Between steps, a random idle beat about every 20 s (cute-C47).
   - Against a screen edge, it scratches the edge instead of grooming (oneko's "togi").
   - *Check:* the simulated routine starts at 3 minutes and not before, and reaches each step on time.
     Dot's frame never overlaps the window's content rectangle. It stays put and awake when `onCall`,
     `recording`, `agentWorking` or Reduce Motion is set.
3. **Waking up.**
   - Cursor movement over 6 px (cute-C43), then a 0.7 s alert look with the eyes wide and a "!"
     (cute-C44).
   - Then a hop of 0.3 of the orb, about 300 ms, with a 1.15 x 0.85 landing squash for 80 ms (bounce is
     the top cute motion, cute-C3; the sizes are my call).
   - Then it trots back to the cursor and follows. Coming back is a break, so a quip may follow (Phase 3).
   - *Check:* the wake sequence order and durations, and no wake from movements of 6 px or less.
4. **Fling chase.**
   - When the cursor moves faster than about 2,500 px/s for at least 80 ms, and he isn't typing, Dot
     gives chase: a looser spring, a trot gait, a skid past the stop point, then a pounce (squash down,
     small hop).
   - At most one chase every 30 s. The threshold is my call.
   - *Check:* a recorded ordinary pointing move (a click on a toolbar button across the screen) stays
     under the threshold, a fling triggers a chase, and the 30 s cooldown holds.
5. **Petting: rub it.**
   - **Lazy zone:** when the cursor moves toward Dot and comes within 1.5x its radius, Dot holds still
     instead of following, for up to 1.5 s or until the cursor leaves the zone, so he can reach it.
   - **The rub:** the cursor over Dot changes horizontal direction 3 or more times within 1.2 s
     (*my call*; no screen pet documents a threshold, see branch-cute.md).
   - **The reaction:**
     - happy squint and blush;
     - it leans into the rub direction;
     - a 2 Hz purr wobble and a brighter glow;
     - it lasts while the rubbing continues, plus 0.8 s.
   - It never gets annoyed. The full reaction can repeat after 10 s; until then a rub just keeps the
     squint.
   - Mention in the README that a gentle rub is smaller than macOS's shake-to-find-cursor.
   - *Check:* tests for the rub detector (3 reversals in 1.2 s fires; 2 doesn't; fast straight motion
     doesn't). The lazy zone releases after 1.5 s.
6. **Reactions.** Each is a one-shot under about 600 ms, and blinks and darts pause while it plays
   (craft-A2-03).
   - **Agent done:** a hop and a happy squint.
   - **Agent failed:** a droop, sinking 2 px with lids at 40%, and no hop. Both replace the timed
     `setMood` at the `.dotAgentFinished` observer in `AppDelegate`.
   - **App switch:** a glance in the direction of the new window and a blink, at most once every 10 s
     (science-C62). Hook it where `Noticer` sees the switch.
   - **"Thanks" or "thank you"** in his transcript: a happy squint and a blush.
   - **A notice he dismissed:** a small nod, then the eyes look away.
   - *Check:* each reaction returns to the base pose within its duration. Keep-alive events are
     suppressed during it and resume after.
7. **Head tilt.** 12-15 degrees toward the orb's right, reached within 0.5 s and held 0.8-1.5 s, when
   puzzled or curious (a fast tilt reads as cutest, cute-C6, C7; the degrees are my call).
8. **Mischief guard, enforced in code and tested.**
   - Never move or hide the real cursor (cute-C19).
   - Never cover window content while idle (cute-C21).
   - No antics or quips while typing, on a call, while recording or sharing the screen, or with Reduce
     Motion on.
9. **Not built:** a boop or drag. The overlay is click-through, so clicks go to the app underneath.
   No new sounds; the chime set already covers agent events.
10. **Agent pace (optional).** If the agent stream already reports output tokens cheaply, the orbiting
    glyph's period goes from 3.6 s toward 2 s as the token rate rises (rea-C3). Skip it, and log why,
    if that needs new plumbing.

## Phase 3: persona, a cute pet with a little mischief

1. **`docs/persona.md`, the character sheet.** Sections:
   - **Purpose and audience.**
   - **Three or four specific traits,** each with one line Dot would say (persona-C47, C49). Draft
     direction: playful and teasing; loyal and on his side; a little lazy (it naps); proud of finished
     things.
   - **Wants and three small facts.** Ember-true facts are good: it glows brighter when something lands,
     and it naps on window edges.
   - **Stance:** on his side, honest that it's an AI, affectionate without flattering (persona-C66, C67).
   - **Never does:**
     - flatter or agree just to please (persona-C29, C72);
     - repeat an offer he waved off (persona-C15);
     - stretch a session or chase engagement (persona-C30, C64);
     - interrupt mid-task (persona-C75, C77);
     - guilt-trip him or ask for care;
     - tease him about grades, people, money, his looks or anything private. It teases the work.
   - **What it remembers about him.**
   - **How each trait shows** in words, Kokoro's voice, eyes, motion and glow. One set of traits drives
     every channel (persona-C37, C38, C39).
   - **When ignored:** a short "later", then quiet until the context changes (persona-C6, C7).
   - **When it speaks up.**
   - **Ten out-of-character lines** to test prompts against.

   *Check:* the sheet has every section.
2. **The prompt.** Add a compact character block of at most about 120 words to `Prompts.talk` and
   `Prompts.think`. `docs/persona.md` quotes it exactly.
   - Keep today's voice rule ("lowercase, warm, casual, a little dry").
   - The answer always comes first. At most one light playful touch per answer, and none in
     walkthroughs, teaching steps, explainer panels, agent briefs or permission cards.
   - *Check:* `.build/debug/Dot --prompt talk` in the worktree contains the block. Then run five ordinary
     questions and the ten out-of-character bait lines through
     `claude -p --model opus --system-prompt "<that prompt>"`. The answers stay correct and in character,
     with at most one playful touch each. (`Dot --ask` goes to the installed main build, so it can't
     test this.)
3. **The quip bank.** Add `Sources/DotKit/Quips.swift`: written lines, no model call.
   - **Situations:**
     - back after a short idle (3-15 minutes);
     - back after a long idle (over 15 minutes, a wake);
     - first sight in the morning;
     - late night (after 1 am);
     - the fifth switch to the same app within 10 minutes;
     - agent done;
     - agent failed;
     - a deadline due today;
     - petted.
   - At least 8 lines per situation, lowercase, at most 60 characters, written from the sheet. The
     example voice he picked: "oh good, you're up. the deadlines missed you." / "third time's the
     charm?" / "done. you're welcome, as usual." / "put it on my tab."
   - **Rules:**
     - a bubble only, no voice;
     - only at breaks: an app switch, or coming back from idle;
     - at most one quip every 40 minutes;
     - no line repeats within 7 days, with history kept in UserDefaults (Clippy's repeat failure,
       persona-C15);
     - never while typing, on a call, or while recording.
   - *Check:* DotKit tests for the cooldown, the no-repeat window, the situation keys and the chattiness
     gate.
4. **A chattiness setting.** Add a `chattiness` config key, 0-3, default 2, in `Config.swift`. It maps
   onto the existing knobs rather than replacing them:
   - **0:** no unprompted lines (`proactiveNotices` off, no app-skill offers, no quips).
   - **1:** deadline notices only, cooldown at 3x, one quip every 2 hours at most.
   - **2:** today's notices, plus a quip every 40 minutes at most.
   - **3:** cooldowns at 0.5x, plus a quip every 20 minutes at most.

   This is Lumière's user-set threshold (persona-C5). *Check:* a DotKit test of the mapping. README lists
   the key.
5. **Backing off, extended.** Build on what `Noticer` already does: its cooldowns, the `noticed` items,
   and `record` / `allowed`, which retire a kind after three declines.
   - Add only what's missing: a notice that times out with no reply counts as a soft decline (two soft
     declines equal one decline). The same item isn't noticed again until its due date or the app in
     front changes (persona-C7).
   - Put the counting logic in DotKit so it can be tested.
   - *Check:* tests for soft declines, retirement, and re-offering after the context changes.

## Finish: check, install, report

1. **Baseline.** Before installing anything, sample the running Dot's CPU every 5 s for 60 s with the
   cursor idle (`ps -o %cpu= -p $(pgrep -x Dot)`) and record the mean.
2. **Rebase.** Fetch, then rebase `alive` onto the newest main: local `main` if it contains origin/main,
   otherwise origin/main. If they have diverged, use origin/main and log it. Resolve conflicts keeping
   main's changes.
3. **Build and preview.** `swift build`, `swift test` and `./build.sh --no-install` in the worktree. Then
   render the previews with `build/Dot.app/Contents/MacOS/Dot --snapshot alive <dir>` and look at them.
4. **Tell the other sessions.** `ListAgents`, then send one line to each live Dot session: "installing
   branch alive (<sha>) for Roshan to try overnight; a reinstall from main will replace it".
5. **Install.** `./build.sh` in the worktree, then verify:
   - Dot is running (`pgrep -x Dot`);
   - the installed binary's SHA-256 equals `build/Dot.app`'s;
   - `Dot --check` still shows Microphone, Screen Recording and Accessibility granted;
   - the idle CPU, sampled the same way, is at most baseline + 1.0 percentage point.
6. **If any install check fails,** put main back (`cd ~/Projects/dot && ./build.sh`), log why, and report it.
7. **`ON needs-you` items:**
   - "the new Dot is installed; to go back: `cd ~/Projects/dot && ./build.sh`";
   - "merge or push `alive` when you like it";
   - "tune `orbSize` (20/24/28) after looking at the previews".
8. **The morning report** lists every *my call* value the run changed and why, the before and after
   CPU numbers, and the path to the previews.

## As built (2026-10-17, overnight run)

Where the build departs from the spec above, and why. Each one is in the run's decision log with how to undo it.

- **Fling threshold:** 6,000 px/s held for 100 ms over 900 px, not 2,500 px/s for 80 ms. A simulated fast pointing move (1,500 px in
  0.5 s) peaks at 5,600 px/s and covers about 700 px at speed; a fling covers about 1,200. The pounce also waits 0.5 s and is
  skipped if he clicks, because a pointing move ends in a click. `FlingDetector` in `Sources/DotKit/OrbKit.swift`.
- **Follow spring:** 0.25 s with bounce 0.12, not 0.3 s. Main's lerp settled in about 0.05 s; 0.3 s trailed noticeably.
- **Speaking blinks:** 0.85 of sentence starts get a blink, plus a 4.5 s base interval, not 0.7. At 0.7 the rate came out at
  14.4/min, under the 15-30 band; people blink 26/min in conversation (science-C1).
- **Lazy zone (petting):** holds only for a slow approach (under 600 px/s) within 1.25x the follow distance, for at most 1.2 s
  unless a rub starts. The spec's version would have frozen Dot on any slow move down and to the right.
- **Listening squint:** dropped. A 10% upper lid carved small notches into the eyes at 20-28 px.
- **Faces:** happy and petted eyes hand over to a stroked arch (^ ^) as the lower lid rises, and the upper lid's edge bows down so
  a drowsy eye reads sleepy, not bored. The speaking mouth is a small round "o" that grows with the voice.
- **Quiet-on-calls check:** every 10 s, not every frame or 2 s. `CallPresence.isOnCall()` can read the front window's title
  through Accessibility on the main thread.
- **Agent pace (2.10):** not built. Output tokens reach Dot only when a turn ends (the ledger), so a live rate needs new plumbing.
- **Before reels:** only main's stills are in `before/`. The old orb's motion lived in its timers, not in a pose that can be
  replayed frame by frame.
- **Recording guard:** Dot has no signal for a screen recording or share outside a call, so `recording` stays false and the
  quiet-on-calls check covers shares made on calls. A share outside a call can still show antics (open item).

Previews: `Dot --snapshot <folder> alive` (stills at 20/24/28 px, eye gaps 0.16/0.20/0.24, and nine GIF reels).

## Round two (2026-10-17, decided with Roshan)

Research for this round: `~/roshan/Learning/Research/2026-10-17-dot-petting-fling/` (answer.md, ledger.json). Pets people touch
stay put until you go far (oneko.js idles within 48 px, cute-C45). Every throw found is a grab and release: VS Code Pets'
"click and throw" launches the ball on mouse-up with the last movement as its velocity, Shimeji is "dragged around by hand and
thrown", Android measures a fling's velocity. A fast cursor move alone can't be told apart from aimed pointing.

**Petting: the leash and the call-over** (his pick: both)
- The leash: Dot stays where it is while the cursor is within about 90 px (scaled by orbSize / 24), and trots to its spot beside the
  cursor once the cursor goes past that. Then it sits again. Pointing, talking and the pet routine are unchanged.
- To pet, move onto Dot and wiggle (the rub detector). To boop, rest on Dot and click: a squish, a giggle wobble, a happy squint.
- The call-over: a gentle wiggle anywhere (3+ horizontal reversals in 1.2 s, within about 40 px, under 800 px/s, not on Dot)
  makes Dot scoot under the cursor so the wiggle becomes a pet. macOS's shake-to-find is big and fast, so it doesn't call it.
- Dot's body takes clicks only after the cursor has rested on it for 0.3 s or is rubbing it (a small panel over the orb that is
  otherwise click-through). A fast approach (over 900 px/s) makes Dot hop aside, so a click meant for what is under it lands.

**Throwing: grab and toss Dot** (his pick)
- Press on Dot and drag: it's picked up and dangles under the cursor (stretched a little, eyes wide).
- Let go: the release speed (averaged over the drag's last 50 ms, capped at 4,000 px/s) throws it. It slows with friction rather
  than falling, bounces off the screen edges with a squash at 60% speed, lands dizzy for about 1 s (spiral eyes), shakes it off and
  trots back on the leash. A release under 300 px/s just sets it down there.
- The cursor-speed fling guess and its chase are removed.

**Context lines (Haiku)** (his idea: "good luck on math!!", "u gonna ace this test")
- A small model writes the quip for the moment instead of the written bank: `quipModel` (default "haiku") through Dot's own
  `claude -p` sessions, no tools. It sees the front app and window title, the next Atlas event or deadline within 24 h, the time of
  day and a just-finished agent; no screenshot.
- Lowercase, texting-casual like his examples, 60 characters or fewer, no emoji, encouragement welcome, no flattery about his work,
  never teasing grades, people, money or looks (docs/persona.md). Each line is checked before it shows; a failed check, an error or
  more than 6 s falls back to the written bank.
- Same gates: a bubble, at breaks, at most every 40 minutes, never while typing or on calls. New: about 30-60 minutes before an Atlas
  event or deadline, one line for it ("good luck on math!!") at the next break, once per event, past the 40-minute cap.
- Home Settings gains a chattiness picker (0-3) and a size picker (20, 24, 28).

**Ship:** tests, an independent review, previews and the CPU check; then merge `alive` into main, push, and install from main.

### As built, round two

- Petting: `Leash` (90 px scaled by orbSize / 24), `RubDetector` over the orb, `CallOverDetector` anywhere else, all in
  `Sources/DotKit/OrbKit.swift`. The click target is `OrbHandle` in `OverlayWindow.swift`: a non-activating panel over the orb
  that paints an almost invisible disc (fully clear pixels let clicks fall through) and ignores the mouse until he has rested on
  Dot for 0.3 s or is rubbing it. A press boops; a drag over 4 px picks Dot up; letting go throws it (`Toss`), or sets it down
  under 300 px/s or with Reduce Motion on. A fast approach (over 900 px/s) hops Dot aside (`Dodge`).
- Throwing: `Toss` (friction 0.45 s, restitution 0.6, cap 4,000 px/s, release velocity over the last 50 ms). The animator stretches
  a held Dot, tumbles a thrown one, squashes it on each bounce, gives it spiral eyes for 1 s after it lands and a shake-off for 0.4 s.
- Context lines: `QuipContext`, `QuipPrompt` and `QuipLine` in DotKit; the writer runs one `claude -p` per quip on `quipModel`
  (default haiku) with thinking off and nothing saved, checks the line, and falls back to the written bank. `contextQuips` turns it
  off. Live check on 2026-10-17: "math midterm in an hour, you got this", "yo welcome back, math exam in like 11 hours btw",
  "yo i crushed that handoff" (1.3-2.6 s each). `Dot --quip-test` runs it by hand.
- Home: chattiness and context lines on General, the size picker on Cursor.
- The notch (a side fix the same day): HeyClicky's resting notch, measured from its window, is exactly the camera housing (black
  from x 663 to 849 pt, 33 pt tall, on a notch that spans 663-848 by 32). Dot's idle tab was the notch plus 18 pt a side and a 10 pt lip, and a folded task made it
  415 x 57, covering the status items beside the notch. Now the resting tab is the notch, and anything wider hangs below the menu
  bar from a notch-wide stem (`NotchSilhouette`, after HeyClicky's `NotchSilhouetteShape`, `menuBarBandHeight`, `stemWidth`).
  The window still spans the tab, so in the menu bar band beside the stem it lets clicks through (`NotchGeometry.passesThrough`).
  At rest Dot is invisible, part of the notch; hover the notch to see it.
