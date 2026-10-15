# Dot task list

Kept by hand; one line per item, newest asks at the top of each group. Done items move to the
bottom with the date. "His ask" quotes the message that created the item.

## Now

- [ ] 2026-10-15 Round four, his asks ("it struggles with traversing through pdfs", "this doesn't look good" (the bubble), "a lot missing between HeyClicky's binary and what i have; act as a senior dev and build out its entirety of features", and "rethink dot and murmur, the different use cases; bring back murmur"):
      1. [x] documents, not pixels: Dot reads the document in front (PDFKit for a pdf the window names or a pdf url, a page's text, docx, md, txt; cached), finds the passage by its words (DocumentSearch), scrolls the app there with its own find box or Preview's go-to-page (Navigator), and boxes the match where the OCR sees it (TextRecognizer.lines). "find the part about x" is answered from the document with no model call; the lecture companion uses the same path; the model has [FIND:phrase] for the rest. Untested on his screen: needs a pdf in front.
      2. [x] the bubble is gone from spoken answers: the line being said shows in the notch (HeyClicky's way), typed questions get a readable answer that stays in the notch with copy and close, and they are silent unless `speakTypedAnswers` is on. The orb's brows no longer tilt inward (it read as angry). A one-line greet bubble stays, lighter and two lines at most.
      3. [x] the two recorders, decided: Dot is short (hold to talk, tap to type, hold control+fn for a sentence of dictation); Murmur is long (double-tap fn: meetings, long notes, pastes and keeps history). Murmur is running again under a launch agent (com.murmur.app, history on); Dot reads its history when he asks "what did i say in the meeting". No hands-free dictation in Dot; that is Murmur's. New in Dot: "listen to the lecture" (the ear: a rolling transcript, "what did he just say" answered from the last minute, "stop listening" saves ~/Dot/transcripts/lectures/<date>.md, "recap the lecture").
      4. [x] from the coverage ledger: agents' progress and results in the talk context ("what did the agent find"), a dead mic named and failed over to the built-in one, a muted Mac sends the answer to the notch as text, quiet on calls (mic in use elsewhere or a meeting app in front), the walkthrough waits for the screen to settle before the next look, stroke shapes (circled, a line along, scribbled over) and several marks per hold, Dot hidden from screen recordings on a menu toggle, the meeting countdown on the idle tab, a dictionary for dictation (~/.config/dot/dictionary.txt, "add x to my dictionary", "x is spelled y"), a password field never takes dictation, [STOCK:NVDA] quote cards, stray fragments ("oh uh") dropped before the model, a markdown viewer and expandable tool output in Home.
      5. [x] one notch for both apps (his ask 2026-10-15 16:20, "combine dot and murmur notch interface"): Dot's notch mirrors Murmur from its log (`MurmurWatcher`: a red dot and a running clock while it records, "murmur transcribing", then "pasted into terminal" or "on your clipboard"); Murmur's own notch indicator is off in its config (`showNotch: false`, applies at its next launch). The hover hint names all three: click to type, hold control+option to talk, double-tap fn to record.
      6. [ ] his verdicts: the notch caption while Dot speaks, the typed answer surface, the lecture ear on a real lecture, Murmur back in his hands, the combined notch.
      Still out (his calls earlier): routines, always-on voice answering, paid realtime voice, onboarding, character editor, billing. Not built this round: the Jev fast lane for agents, place cards, hand-off into another app, the skills library page, settings pages for voice and mic (config.json still), hands-free dictation in Dot (Murmur's job).
- [ ] Murmur: the installed 1.2.1 build (Sep 29, ad-hoc signed) predates the daily Markdown transcript commit of 2026-10-15; rebuilding it would drop its mic and accessibility grants until Scripts/setup_signing.sh makes the "Murmur Local Signer". Dot reads history.jsonl, which 1.2.1 writes. His uncommitted notch work in ~/Projects/murmur is untouched.

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
- [x] 2026-10-15 Typed questions answered as a text surface in the notch (round four).

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
- [x] 2026-10-15 Walkthrough: wait for the pane to repaint before the next ring (ScreenSettle), and say so when it has not.
- [x] 2026-10-15 Dictation: hold-to-dictate into the focused field, clipboard fallback with a notch
      notice, a transcript archive.
- [ ] Place cards (a map, directions); stock quote cards landed 2026-10-15 ([STOCK:NVDA]).

## Next

- [x] 2026-10-15 Meeting-in-ten-minutes notice (hover line exists; the proactive line does not).
- [x] 2026-10-15 TYPE step: Dot puts the text on the clipboard or types it for him.
- [ ] Browser research flow through agents (hb headless by default, visible on "show me").
- [ ] Morning suggestions card with yes/no history.
- [ ] Routines (scheduled agent runs, pause, log).
- [ ] Onboarding tour and the three starter agents.
- [x] 2026-10-15 Quiet when on a call (CallPresence: mic in use elsewhere, a meeting app in front).
- [x] 2026-10-15 Show or hide Dot in screen recordings (menu toggle, window sharing type).

## Done

- [x] 2026-10-15 Math mode: course map, proof coaching, python checks, quiz cards, homework guard (docs: README).
- [x] 2026-10-15 HeyClicky observed session recorded and analyzed (docs/heyclicky-session-2026-10-15.md).
- [x] 2026-10-15 CuaDriver permissions confirmed granted; stale note removed.
- [x] 2026-10-15 The board: cards over the screen with typeset math, step reveal, plots, diagrams.
- [x] 2026-10-15 Instant acknowledgments; voice fix after quiet test turns.
- [x] 2026-10-15 Consent narrowed to outward or irreversible actions.
- [x] 2026-10-15 Drive mode: Dot clicks the ringed steps on "do it for me".
- [x] 2026-10-15 Beats synced to speech, tours, HOVER and SHAPE, walkthrough memory, 56 Atlas talk tools.
