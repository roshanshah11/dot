# Dot task list

Kept by hand; one line per item, newest asks at the top of each group. Done items move to the
bottom with the date. "His ask" quotes the message that created the item.

## Now

- [ ] 2026-10-15 Round three, his plan ("dot is okay, but needs to be and can be a lot better"; bar: beyond HeyClicky, parity on the parts that matter):
      1. [x] the lesson stage: one thing at a time, spoken not printed, opaque fixed card, back/next/dots, a conversation not a quiz (Resources/board, Board.swift, Talk.lessonHeld); his verdict pending;
      2. [x] lecture companion: when the held key hears a lecture (Jev "lecture"), Dot reads the screen with OCR, finds the passage and explains it; untested by voice;
      3. [x] suggestions in context: a new document in front gets one quiet offer ("want the gist of this? say yes"), yes/no remembered, three declines retire a kind (Noticer.pollDocument); untested live;
      4. [x] design pass, first cut: marks and label chips in HeyClicky's grammar (dashed rings and boxes, solid chips), the bubble as a caption; Home and card type untouched;
      5. [x] the audit: docs/heyclicky-coverage.md (169 components: 37 built, 48 partial, 63 missing, 21 n/a).
      Out: routines (his other systems), always-on voice, paid realtime voice, onboarding, character editor.
- [x] 2026-10-15 The typed field takes keystrokes (the borderless notch panel could never become key); a turn the CLI drops in under 2 s is sent once more; `Dot --input` opens the field.
- [x] 2026-10-15 The bubble is one sentence, three lines, a small label; none over a lesson. His words: "this looks bad bro".
- [x] 2026-10-15 Visual board: bundled libraries, explain-by-figure pattern, live web cards, web lookups in talk, the biotech course map, the circled-region action bar. His asks: "use real JS libraries, animate it", "bring in real media online", "bio explanations", "research properly", "circle a region, hand it to an agent".
- [ ] Test by hand: control+fn dictation, the circled-region bar, the meeting notice.
- [ ] Board round two: his verdict on the first real lessons (DNA, PCR, fields); a video piece (.figure with <video>); cards that ask him to drag or click (interactive quizzes).

- [x] 2026-10-15 Transcripts saved automatically (md per day + jsonl); the homework guard removed at his ask; agents run with Atlas's full chat prompt and the vault.

- [ ] Math mode, round two: his feedback after the weekend of midterm prep; faster partials (chunk 2.5 s); a "what did I miss" review card from the math-miss memory.
- [ ] Typed questions answered as a text surface in the notch (the response already shows there; make it the primary surface when he typed).

- [x] 2026-10-15 Task bar: a slim bar under the notch (and in Home) listing every running and recent
      task (agents, walkthroughs, board lessons) with status, a live one-line commentary, Stop
      and Open. His ask 2026-10-15: "create a task bar!". Model: HeyClicky's Agent HUD card and
      notch dropdown (docs/heyclicky-session-2026-10-15.md).
- [x] 2026-10-15 Atlas-personalized agents: every agent brief carries a profile block from Atlas
      (facts, preferences, people, current projects, deadlines) and a deliverable-style line;
      agents route deliverables through his skills (powerpoint-design for decks, web-taste for
      pages, research for research, roshan-email for mail, technicals for prep, the xlsx and
      docx skills for files). His ask 2026-10-15: "integrate my atlas with my clicky, so that
      output is tailored to my liking; the pdfs and pptx are not /powerpoint-design or
      /web-taste".
- [x] 2026-10-15 Home and agent-chat UI, rebuilt to HeyClicky's shape: icon rail with unread dots, a
      thread view with step rows, command blocks and a status line, an output column with
      previews, artifact cards, next-action pills, a context menu (archive, pin, unread,
      rename), composer with attachments and voice, a settings scaffold. His ask 2026-10-15:
      "reverse-engineer clicky's UI, the way agent chats are displayed/handled, how you can view them".
- [x] 2026-10-15 Streaming transcription while the key is held (FluidAudio SlidingWindowAsrManager).
- [ ] First-sound latency measured end to end and kept under 1 s for the acknowledgment.
- [x] 2026-10-15 Orb face and expressions (listening, thinking, speaking, idle).
- [ ] Walkthrough: wait for the pane to repaint before the next ring, and say so when it has
      not ("give it a moment, then say continue").
- [ ] Typed-question surface: a text answer in the notch when he types instead of talks.
- [x] 2026-10-15 Dictation: hold-to-dictate into the focused field, clipboard fallback with a notch
      notice, a transcript archive.
- [ ] Board cards for stock quotes and places (the chart piece covers quotes; a place card needs a map).

## Next

- [x] 2026-10-15 Meeting-in-ten-minutes notice (hover line exists; the proactive line does not).
- [x] 2026-10-15 TYPE step: Dot puts the text on the clipboard or types it for him.
- [ ] Browser research flow through agents (hb headless by default, visible on "show me").
- [ ] Morning suggestions card with yes/no history.
- [ ] Routines (scheduled agent runs, pause, log).
- [ ] Onboarding tour and the three starter agents.
- [ ] Quiet when on a call or sharing the screen.
- [ ] Show or hide the orb in screen recordings (window sharing type).

## Done

- [x] 2026-10-15 Math mode: course map, proof coaching, python checks, quiz cards, homework guard (docs: README).
- [x] 2026-10-15 HeyClicky observed session recorded and analyzed (docs/heyclicky-session-2026-10-15.md).
- [x] 2026-10-15 CuaDriver permissions confirmed granted; stale note removed.
- [x] 2026-10-15 The board: cards over the screen with typeset math, step reveal, plots, diagrams.
- [x] 2026-10-15 Instant acknowledgments; voice fix after quiet test turns.
- [x] 2026-10-15 Consent narrowed to outward or irreversible actions.
- [x] 2026-10-15 Drive mode: Dot clicks the ringed steps on "do it for me".
- [x] 2026-10-15 Beats synced to speech, tours, HOVER and SHAPE, walkthrough memory, 56 Atlas talk tools.
