# Dot task list

Kept by hand; one line per item, newest asks at the top of each group. Done items move to the
bottom with the date. "His ask" quotes the message that created the item.

## Now

- [x] 2026-10-17 Round eight, overnight (plan: the round-eight overnight plan agreed in /grilling), his asks ("my dot is awful at 1. keeping the box on the content as i scroll. 2. the visualizations ... especially when i want rendered JS to just walk me through and explain things"; "bring chatgpt's intelligent UI to dot"):
      1. [x] P1 marks follow scrolled content: element anchors, pixel anchors (scroll tap, Vision registration, settle-time patch re-find), hide/chevron/return, app switch clears; MarkAnchor, ImageRegistration, PatchFinder tests; `Dot --track-selftest` live on 10/17 (Preview pixel mark back within 4 pt after a 1,800 pt round trip; Safari element mark 0 pt drift in the run where Safari took the scrolls).
      2. [x] P2 the explainer panel and Dot's UI language: renderer, 18 fixtures (every old card re-expressed), panel-check, ExplainerPanel/PanelMessage/PanelDock/PanelStream/CourseTag with tests, an Opus review against ChatGPT's answers applied.
      3. [x] P4/P5 the widget framework, viz-check, the dot-viz skill (a fresh Opus agent built wacc from the skill alone).
      4. [ ] P6 the catalog build (8 Opus builders overnight; resumes from docs/catalog-status.json; tier 1 first).
      5. [x] P7 wired into talk: explain route to Opus, [PANEL]/[STEP], panel rules (his ChatGPT habits, the course maps' notation, finance pieces), quiz turns, per-course recap; dry run of ten past questions twice (first word median 17.3 s then 13.4 s; about $0.12 a panel).
      6. [ ] his verdicts: a real explanation on the panel in class, the box on a PDF in Comet while he scrolls, a quiz answer by tap.

- [x] 2026-10-16 Round seven, overnight (the plan agreed in /grilling), his ask ("fix all of this overnight", after the agent verification in docs/heyclicky-agents-verification.md):
      1. [x] F1 one card per request, oldest first, "+N waiting"; a stopped agent's cards go with it; a waiting row brings its card forward (DotKit/ConsentQueue.swift, NotchHUD; `Dot --selftest`).
      2. [x] F3 agents in Claude Code's default permission mode (config `agentPermissionMode`); a delete inside the agent's folder or a temp folder passes, any other delete asks.
      3. [x] F4 RSVPs, invitations with guests and Drive shares ask; tools of MCP servers Dot doesn't hand agents ask; kill_app asks; the script runner and extension installer are off; the rm pattern fixed.
      4. [x] F5 (found tonight) helpers ran in the background, so an agent's turn ended before they did: agents get CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1, and a result is progress while background tasks are open.
      5. [x] F2 a quit ends agent processes (SIGTERM now quits cleanly); at launch, leftovers are ended and an unfinished turn is marked, a recent one with "continue where you left off".
      6. [x] G1 each turn keeps its next step and the files it made (transcript "next" and "artifact" rows; Home lists them).
      7. [x] G2 [TELL:name:message], [STOP_AGENT:name], "tell/ask/stop X", "is X done", "progress?"; a message to a working agent reaches it at its next step (probed: Claude Code delivers it mid-turn, it does not wait for the turn to end); cards answered by voice, a send or a delete needs the act named; `Dot --ask --dry`.
      8. [x] G3 a new routine runs once at once, then on schedule.
      9. [x] installed 10/17 01:48 and live-checked on a throwaway agent; REA ev_65bc7e11 (turn record now matches; the two computer-use claims stay open); committed 555f36b and after; the push waits for him. Not in round seven: image generation (his call), the per-turn computer-use gate (his 10/15 call), and from the deep pass (3.1) the PreToolUse hook, per-agent MCP servers and agents that outlive Dot.

- [ ] 2026-10-16 Deep research pass (no code; separate from the round-seven agent fixes another session has in progress), his ask ("please reverse engineer all of clicky's functionality /research i am missing a bunch. especially thinking about how to make it better, with agent orchestration, integrations, tailoring visuals and styles to what i need etc."):
      1. [x] the deep pass: docs/heyclicky-deep-pass.md (321 ledger claims in ~/roshan/Learning/Research/2026-10-16-heyclicky-deep-pass, every quote located; also an Apple Note). New: the voice layer's ~24 agent tools and routing rules, the server researcher's morning briefs (seven written for him on 10/15), the agent turn contract, the "what HeyClicky knows" profile, the skill library, the Jev contract, agent-activity animations, colors by file type, voices by study use, the public board's top asks, a phone app in the works. Corrected: the per-app skill files are an unwired onboarding picker, and HeyClicky does not hand work to Claude Code or Codex.
      2. [x] his picks from the plan (section 3): first tier is the PreToolUse hook and per-agent MCP servers (on top of the in-progress F1 to F4 fixes), the turn contract, voice approve, stop and steer, morning briefs from a scout over Atlas, the token file with study and desk looks, the finance kit, context modes.
      3. [x] 2026-10-17 the full write-up, his ask ("make a full document detailing all of the things that are different and need to be added"): docs/heyclicky-gaps.md, 211 rows (198 gaps in 24 areas, 13 fixes, 30 prompt lines), each with HeyClicky, Dot today, where the code goes and a test, plus the playbook for tonight's /overnight run of the fixes and his 13 picks (contract, voice, scout, tokens, outlive, sentinel, lines, appskills, finance, modes, orb, interactive, hook; phone deferred until mbp2020 is reachable).
      4. [x] 2026-10-17 the overnight run, his ask ("run the fixes and the 13 additions in docs/heyclicky-gaps.md"): the fixes and the 13 additions on main, each batch tested and installed (commits in docs/heyclicky-gaps.md, "What the overnight run did"; log ~/.claude/overnight/runs/2026-10-17-0107-...). Partial: AG-08 (the gate covers inherited servers; strict mode would drop the claude.ai connectors). Phone still deferred. His verdicts: a finance card in both looks, the 06:30 brief on the morning card, "what did X find", quitting Dot during an agent run and reopening it.

- [ ] 2026-10-16 Round six, his asks ("research all features in myclicky and try to replicate; audit residual unknowns; read my chats: what is good, what needs to get fixed, what else would be useful to add"; "the bar at the top is too big and covers a lot of stuff, very inconvenient, please fix, look how it's done in clicky"; "the agent setup and agent management in clicky: how do i control agents, general agents, agent swarms, specific task agents; use logic also from chatgpt dots or meta's muse"):
      1. [x] the notch window is sized to what it draws (221×42 at rest; it was an invisible 620×620 window that took every click under it). HeyClicky did the same in 1.0.52 ("you told us the notch got too big, so we made it smaller"). Escape clears the cards under the notch (its 1.0.50). Installed 16:54.
      2. [x] his chats read: the 60 Dot asks of 10/15 and 10/16 (~/Dot/transcripts), his two HeyClicky agent threads, 391 of his own Claude Code messages since 10/13. Findings and the feature list: ~/roshan/Learning/Research/2026-10-16-heyclicky-features/answer.md (also an Apple Note).
      3. [x] fixed from the chats: Dot argued three turns on 10/16 about a syllabus ban on ai he had told it to drop on 10/15 (the refusal came from Atlas's course facts; a talk-prompt rule now ends it); a tap too short for a word showed "Invalid audio data provided" as an error (now a quiet "didn't catch that"); the deeper turn answering the screen instead of the question had been fixed on 10/15 (the handoff carries the question).
      4. [x] agents, after HeyClicky's Clickys, dots' custom rules and Muse's checks: rules (five kinds of action × do it / only if I asked / ask first / leave it to me; defaults and per-agent; ~/Dot/rules.json; Home › Agents), "Allow for this task" on a consent card, routines ([ROUTINE:agent:when:brief] by voice or the Agents page; pause, resume, run now, delete; wait for the internet and for a call to end; three failures pause with the reason; results land quietly in the thread), helpers (an agent may hand independent parts to two subagents; the card says "with N helpers"), two-word names and several agents in one ask, spend per agent. The design and its evidence: docs/agents.md.
      5. [x] HeyClicky's whole feature history captured from its changelog (Apr 6 to Oct 2, 2026) and ledgered with quotes; 1.0.53 is current (appcast Oct 2). REA's Ghidra pass timed out on the 40 MB binary; the strings and the changelog carried the investigation; eight residual unknowns recorded with REA and listed in docs/heyclicky-verification.md.
      6. [ ] his verdicts: the smaller notch through a day, the Agents page, a routine on a real morning, "Allow for this task" on a real card, an agent with helpers, the course-policy rule in a real homework question.
      Not built, his calls or out of scope: a notch dwell ring, file drop onto the notch, other-language dictation, the Jev fast lane for agents, HeyClicky's onboarding interview and starter cast, the character editor, its sound set, place photos, a cloud computer per agent (dots and Muse), proactive activity watching (HeyClicky dropped it).
- [ ] 2026-10-16 Round five, his ask ("build my clicky alternative, not just in the scaffold but in how it acts, plus a professional level of visualizations"; sent as /verify_reconstruction):
      1. [x] the check: docs/heyclicky-verification.md, 90 rows of what HeyClicky does and draws, each with its evidence (binary, the recorded session, its prompts, the asset catalog) and Dot's verdict: 68 pass, 5 beyond, 11 fail (7 his call or cosmetic), 2 partial, 4 n/a. Not a REA-signed result: the verifier wants runtime captures of both apps and HeyClicky's turns are metered.
      2. [x] the notch, HeyClicky's way: the state in a word (listening, hearing you, thinking, thinking deeper, speaking, dictating) with voice bars; typed notices with an icon and up to two buttons (clipboard, learned word with undo, dead mic with a Sound settings button, muted Mac with "turn sound on", the meeting at 10 min with "brief me", an update once per version with "what's new"); the agent card (avatar, name and state, live line, stop, open); the hover peek with the agents' latest files as tiles he can drag out; the corner glow when something lands.
      3. [x] the morning card: "morning. i can do N things for you today" from Atlas's day (deadlines in two days, calls and interviews, mail waiting, commitments); show me lists them with do it (an agent) and skip; yes and no remembered in ~/Dot/suggestions.json for a week; after seven, once idle, back twice at twenty minutes.
      4. [x] cards: [PLACE:what near where] (Apple Maps on a map with numbered pins, address, distance, links; "near me" is campus) and [IMAGES:subject] (a Wikimedia Commons strip with credits); "coffee near me" and "show me pictures of x" are answered by Dot itself with no model turn; links in cards open outside.
      5. [x] marks: the highlight draws itself on, the target ring springs in and pulses once when the click lands; a ring on a control behind another window says so (WindowOcclusion).
      6. [x] Home: Voice, Microphone, Dictation (the dictionary editor), Shortcuts, Cursor, Skills and Suggestions pages; saved settings apply live (presence, recordings, accent color, the microphone).
      7. [x] `Dot --snapshot [folder] [notch|overlay|cards]`: every notch state, mark and card to PNG and one contact sheet, no screen turn; the visuals were tuned from those files.
      8. [ ] his verdicts: the notch header and bars, the agent card, the morning card on a real morning, a place and a picture card in a real turn, the settings pages clicked through, the peek's drag into another app.
      Not built, his calls or cosmetic: a notch dwell ring, file drop onto the notch, dictation in other languages, the Jev fast lane for agents, routines, starter agents, the character editor, HeyClicky's sound set, place photos.
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
      5. [x] the audit: docs/heyclicky-coverage.md (169 components; 54 built, 37 partial, 57 missing, 21 n/a after round five).
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
