# Does Dot act like HeyClicky? A per-claim verification

His ask 2026-10-16: "build my clicky alternative, not just in the scaffold but in how it acts, plus a
professional level of visualizations". This is the check behind round five: one row per thing
HeyClicky does or draws, what the evidence for it is, and whether Dot does the same, with the file
that does it. Pass means Dot has the behavior (its own way, in its own words); fail means it does not;
unknown means the evidence for HeyClicky's side is thin or Dot's side has not been run on a screen.

**Evidence codes.** B = a type or string in the HeyClicky 1.0.53 binary
(sha256 9705692…dbb31; `strings`, 212 Swift file names, 1,247 type names, the analytics event names).
S = the recorded session of 2026-10-15 on his Mac (docs/heyclicky-session-2026-10-15.md: 24 minutes of
screen and microphone, its own log). P = its shipped prompts and state (ClickyModelInstructions.md,
the skills, HomeSpaceCache transcripts). A = its asset catalog (122 records: logos, the character
packs, onboarding stills; read with REA's `inspect_asset_catalog`, nothing copied).

**About the REA verifier.** `verify_reconstruction` wants comparison Evidence from runtime captures of
both apps (`compare_process_captures`) and signs pass only against those. HeyClicky's turns are
metered (9 messages left this month) and its UI cannot be driven from a shell (no assistive access),
so the behavioral rows below rest on the recorded session plus static evidence, graded by hand. They
are not a REA-signed result; the unknowns say what a capture would settle.

Totals: 91 rows. 70 pass, 5 beyond HeyClicky, 10 fail (6 his call or cosmetic, 4 to build), 2 partial, 4 n/a; 8 residual unknowns (below, also recorded with REA on 2026-10-16).

## 1. The notch: surfaces and states

| # | HeyClicky | Evidence | Dot | Verdict |
|---|---|---|---|---|
| 1.1 | Idle: a black tab under the notch, click opens the composer | B NotchPanel, NotchExpandTrigger; S | idle strip, click opens the typed field (NotchHUD.swift idleStrip) | pass |
| 1.2 | The state in a word: Listening, Thinking, Thinking deeper, Speaking, Dictating | S frames 09:46 to 09:58; B NotchActivityPhase | listening, hearing you, thinking, thinking deeper (the stronger model), speaking, dictating (NotchHUDView.headerText, HUDModel.deeper) | pass |
| 1.3 | Voice as a row of bars beside the state word | S; B VoiceWaveformBars, InlineVoiceRecordingWaveformView | VoiceBars: his level while listening, a spoken envelope while Dot talks, a slow wave while it thinks | pass |
| 1.4 | The spoken line is not written on the page | S (no bubble in any voice turn) | the current line in the notch; the cursor bubble is off by default (`cursorBubble`) | pass |
| 1.5 | Hover peek: the day, the agents' latest files as tiles, open Home | B NotchHoverGeometry, NotchAgentPeekFileTile, NotchAgentPeekFileDragSource, NotchAgentPeekExpandHomeButton | hoverPeek: the day line, up to four output files as tiles he can drag out or click, "open dot" (HUDModel.peekFiles, AppDelegate.refreshPeek) | pass |
| 1.6 | A dwell ring while hovering the notch | B NotchHoverDwellRingView, NotchHoverDwellState | nothing | fail |
| 1.7 | Live-event corner glow when something lands | B NotchLiveEventCornerGlow, NotchCornerGlowEdges | the panel's corners glow for 1.4 s on a notice or a finished agent (NotchHUD.pulseGlow) | pass |
| 1.8 | Typed input surface with a close button | B NotchTextInputSurface, NotchTextInputCloseButton; S | the field under the notch, escape and the x close it (KeyablePanel) | pass |
| 1.9 | Typed answers as a text surface that stays | B NotchTextResponseSurface, NotchTextResponsePresentationPolicy | the answer block with copy, ask again, close (presentAnswer) | pass |
| 1.10 | A gallery strip of images in a text response | B NotchTextResponseGalleryStrip | pictures go on the board as a card instead ([IMAGES], Images.swift) | pass, another place |
| 1.11 | Dictation clipboard notice: "Copied to your clipboard, press ⌘V" | S 09:55; B NotchDictationClipboardSurface | a typed notice with the icon and the line (Talk.endDictation, MurmurWatcher for Murmur's) | pass |
| 1.12 | Dictionary learned notice | B NotchDictionaryLearnedSurface | "learned: x" with undo (Talk.addToDictionary) | pass |
| 1.13 | Microphone trouble notice | B NotchMicrophoneTroubleSurface | "x heard nothing", switched to the built-in mic, a button to Sound settings (Talk.microphoneHeardNothing) | pass |
| 1.14 | Muted speaker: the reply as text with a restore-sound button | B NotchMutedSpeakerVoiceReplySurface, MutedSpeakerRestoreSoundButton | the answer goes to the notch as text; "turn sound on" unmutes and lifts a zero volume to half (AudioDevices.restoreOutput) | pass |
| 1.15 | Meeting countdown in the notch with an action | B NotchMeetingCountdownSurface, MeetingJoinButton, `meeting_countdown_action_clicked` | the countdown pill from 30 min; at 10 min a notice with "brief me" (an agent writes a short brief) and dismiss (AppDelegate.noticeMeeting) | pass |
| 1.16 | Morning suggestions card: "I can do N things for you today", dismiss or show me, reappears until dismissed | S 09:4x; B NotchMorningSuggestionsSurface, MorningSuggestionsInvitationPolicy, ProactiveSuggestedAgentCard | the morning card from Atlas's day: deadlines, calls, mail waiting, commitments; show me lists them with do it / skip; yes and no kept in ~/Dot/suggestions.json; back twice more at 20 min (MorningSuggestions.swift, MorningPlanner.swift) | pass |
| 1.17 | App-updated notice | B NotchAppUpdatedSurface | once per version: what changed, "what's new" opens the README (AppDelegate.announceUpdate) | pass |
| 1.18 | Document-access notice (a file it could not read) | B NotchDocumentAccessSurface | a status line when the document in front cannot be read; no typed card | partial |
| 1.19 | Integration connected or suggested, Spotify voice tip, sidecar learning tip | B NotchIntegrationConnectedSurface, NotchIntegrationSuggestionSurface, NotchSpotifyVoiceTipSurface, NotchSidecarLearningSuggestionSurface | n/a: no hosted integrations; Atlas tools are always on | n/a |
| 1.20 | Unread Clickys surface, skill-pinned surface | B NotchUnreadClickysSurface, NotchSkillPinnedSurface | unread dots live in Home's rail; agents finish with a spoken line and a card | pass, another place |
| 1.21 | Hand-off surface and indicator chip | B NotchHandoffSurface, HandoffIndicatorChipView | the region bar's "hand to an agent" and the agent card | pass |
| 1.22 | File drop onto the notch opens the composer | B NotchFileDropComposerOpenSource, `notch_file_drag_composer_opened` | nothing | fail |
| 1.23 | The resting notch is small and takes no clicks beyond its drawing; the window moves between compact, hover and expanded sizes | B NotchWindowManager, notchCompact, notchHover, notchExpanded, NotchPillShape; changelog 1.0.52 ("you told us the notch got too big, so we made it smaller") | the window is sized to its content (221×42 at rest, measured live 16:54; it was 620×620 and swallowed the clicks under it: his report 10/16) | pass |
| 1.23 | Use-case carousel, onboarding card, tutorial invite, signed-out placeholder | B NotchUseCaseCarousel, NotchOnboardingCardSurface, NotchTutorialInviteSurface, NotchSignedOutPlaceholder | n/a (no onboarding, no accounts) | n/a |
| 1.24 | Agent HUD card: avatar, "Name • Working", live line, Stop and Open | S 09:57:14 (Research Buddy card); B CodexHUDWindow, CodexHUDView | the agent card: avatar on its own hue, name • working / done / needs you, elapsed, the live line with a slow ellipsis, stop and open (open shows its thread in Home) | pass |
| 1.25 | The HUD card goes away after 30 s while the agent keeps working | S | running rows fold into pills on the idle tab after 20 s; a change unfolds them | pass |
| 1.26 | The notch holds Murmur's recording state too | his ask 2026-10-15 (not HeyClicky's) | red dot and clock, transcribing, pasted (MurmurWatcher) | pass |

## 2. The companion and its marks

| # | HeyClicky | Evidence | Dot | Verdict |
|---|---|---|---|---|
| 2.1 | A character beside the cursor on a spring, idle blinks and breathing | B CompanionActorChoreography, CompanionActorMotionMode; S | the ember orb: follows with lean, breathes, blinks, a face (OverlayWindow.swift OrbView) | pass |
| 2.2 | It glides along an arc to what it points at | S; OSS Clicky | quadratic bezier flight with smoothstep (OverlayManager.fly) | pass |
| 2.3 | Highlights are dashed rounded rectangles around a block | S frames 09:48:38, 09:50:10 | dashed rounded rectangle in the accent, draws itself on over 0.45 s (highlightProgress) | pass |
| 2.4 | Targets are dashed circles with a label chip | S 09:51 to 09:54 (Displays, Night Shift, Schedule menu, Done) | dashed ring (dotted for hover), a solid chip, springs in, pulses | pass |
| 2.5 | A completed target is marked before the next ring | B `annotation_target_completed`; S (ring vanished on the click) | a filled pulse on the ring, then it goes (OverlayManager.completeRing) | pass |
| 2.6 | Lines, arrows, circles, curves, polygons as drawn marks | B AnnotationShapeKind, AnnotationShapeOverlay | [SHAPE] marks stroke themselves on (ShapeMarkView) | pass |
| 2.7 | The cursor message bubble reveals word by word | B CursorMessageBubbleWordRevealModifier | the greet bubble is static; spoken lines go to the notch | fail, by his choice |
| 2.8 | Drawing on the screen while the key is held: a stroke, elements inside harvested | B ScreenAnnotationManager, AnnotationStroke, AnnotationAccessibilityHarvester | ink strokes, several per hold, classified (circled, a line along, scribbled over), elements inside the box marked for the model | pass |
| 2.9 | A drawn region can be handed to an agent, with an action bar after the drag | B HandoffRegionSelectOverlay, HandoffPostDragActionBarView, `handoff_rect_queued` | the region bar: copy text, look it up, hand to an agent (ActionBar.swift) | pass |
| 2.10 | A voice-stop pill while a hand-off records | B HandoffVoiceStopPillView | the notch header while listening | pass, another place |
| 2.11 | The character hides while a screen recording runs, on a setting | B settings copy "Show in screen recordings" | the menu toggle; every Dot window's sharing type (AppDelegate.applyRecordingVisibility) | pass |
| 2.12 | Character packs, randomize, a lab for the portrait | B ClickyCharacterEditor, ClickyPortraitLab, `clicky_character_randomized`; A ClickyCharacters | the accent color and the orb only (Settings, Cursor page) | fail, his call |
| 2.13 | A pointer-cursor overlay in Home | B HomeSpacePointerCursor, PointerCursorView | nothing | fail, cosmetic |

## 3. Cards and widgets

| # | HeyClicky | Evidence | Dot | Verdict |
|---|---|---|---|---|
| 3.1 | Response cards beside the answer with a status and a gallery strip | B ResponseCardPanel, ResponseCardStatus, ResponseCardGalleryStrip | cards on the board (Board.swift): the title strip, the dark glass, the close button | pass |
| 3.2 | A stock widget with a quote and a range | B StockWidget, StockQuoteAPI, StockQuoteRange; S (spoken only, no widget appeared) | [STOCK:NVDA]: price, change, a month sparkline (Quotes.swift) | pass |
| 3.3 | A place widget: results, a detail overlay with a photo carousel | B PlaceWidget, PlaceDetailOverlay, PlaceDetailPhotoCarousel, PlaceSearchAPI; S (spoken only) | [PLACE:coffee near campus]: Apple Maps results on a map with numbered pins, address, distance, phone, open in Maps; "near me" is campus. No photos | pass, no photos |
| 3.4 | Images in a response | B NotchTextResponseGalleryStrip, DocumentAnimatedImageView | [IMAGES:subject]: a strip of Wikimedia Commons pictures with credits (Images.swift) | pass |
| 3.5 | A markdown viewer window | B MarkdownViewerAnimatedImageAttachmentCell, markdown viewer strings | MarkdownViewer.swift (marked + KaTeX, dotmd scheme) | pass |
| 3.6 | Place and image asks need no backend turn | P (its tools) | "coffee near me" and "show me pictures of x" are answered by Dot itself, no model call (CardAsks.swift, Talk.route) | pass |
| 3.7 | The board: typeset math, step reveal, figures, a lesson stage | nothing in HeyClicky (S: it walked the page's own equations) | Dot only | beyond |

## 4. How a voice turn acts

| # | HeyClicky | Evidence | Dot | Verdict |
|---|---|---|---|---|
| 4.1 | Hold to talk, release to send; tap to type | B settings copy; S | control+option held; a tap opens the field | pass |
| 4.2 | A one-second filler ("one sec") before the real content | S (1.0 to 1.6 s to first sound) | an acknowledgment from a warmed cache inside a second (Talk.acknowledge) | pass |
| 4.3 | Interruptible: pressing the key cuts the audio at once | S turn 7 | a new hold or escape stops the voice and the turn (Talk.interrupt) | pass |
| 4.4 | Tag-first beats: each visual lands as its words are spoken | B "tag-first beat lines", RealtimeWalkthroughSync | BeatStreamer and the speaker's per-sentence onStart | pass |
| 4.5 | Tours: look around the page, several beats, boxes on each | P tutorial prompt; S turn 2 (6 beats) | "show me around" walks the page in three to six beats | pass |
| 4.6 | One target per walkthrough step; click-to-advance budget; hover-rest completion | P guided prompt; S Night Shift | one TARGET per step, `walkthroughMaxSteps`, hover rings complete on rest | pass |
| 4.7 | Step-away and off-target clicks end the guide quietly | B "Guided walkthrough step-away" | appActivated and offTargetClicks in Talk | pass |
| 4.8 | Freshness: he acted while the next step was computed | B "user_acted_while_waiting" | userActedWhileWaiting rides along in the step message | pass |
| 4.9 | Wait for the pane to repaint before the next look | S ("the main panel hasn't updated yet") | ScreenSettle.wait, and the model is told when the screen was still changing | pass |
| 4.10 | Target occlusion check | B `[tour-visibility] occlusionState` | WindowOcclusion: a ring on a control behind another window says so (Talk.target) | pass |
| 4.11 | "Do it for me": the app clicks the steps | B cua-driver, `set_agent_cursor_enabled` | drive mode (Driver.swift) | pass |
| 4.12 | Realtime voice over a socket, 5 to 20 s to real content on screen turns | S timings | local Kokoro voice, 2 to 4 s to the first visual; voice quality is the gap | pass on timing, unknown on quality |
| 4.13 | Always-on voice mode (no key) | B `always_on_voice_mode_enabled` | nothing (his call: Murmur is the hands-free recorder) | fail, his call |
| 4.14 | A short "one sec" preamble when a slow tool is needed | P | Jev routing says "on it" | pass |
| 4.15 | Reads documents by their words, not pixels | nothing in HeyClicky (S: it pointed at the visible heading) | DocumentReader, DocumentSearch, Navigator ([FIND]) | beyond |
| 4.16 | Quiet when the mic is held by another app (on a call) | S (the morning card was held during the recording); B ClickyCallPresenceDetector | CallPresence | pass |
| 4.17 | Fragments ("oh uh") never cost a turn | unknown for HeyClicky | Jev "ignore" | beyond |

## 5. Dictation

| # | HeyClicky | Evidence | Dot | Verdict |
|---|---|---|---|---|
| 5.1 | Hold control+fn for a sentence | B settings copy; S | control+fn (HotkeyMonitor .dictate) | pass |
| 5.2 | Double tap for hands-free dictation | B DictationAnnouncement*, settings copy | Murmur (double-tap fn), mirrored in Dot's notch; not in Dot itself | pass, by Murmur |
| 5.3 | Clipboard fallback with a notice when no field can be captured | S 09:55 | TextInjection falls back to the clipboard; the typed notice | pass |
| 5.4 | A learned-corrections dictionary | B DictationCustomVocabulary, DictationCorrectionLearner | ~/.config/dot/dictionary.txt, "add x to my dictionary", "x is spelled y", the Dictation page editor | pass |
| 5.5 | Transcript archive per day | S DictationTranscripts/<date>.jsonl | ~/Dot/transcripts (md per day + jsonl) | pass |
| 5.6 | Language auto-detect and a language catalog | B DictationLanguageCatalog | English only (Parakeet) | fail |
| 5.7 | A secure field never takes dictation | unknown for HeyClicky | TextInjection refuses secure fields | beyond |

## 6. Agents and Home

| # | HeyClicky | Evidence | Dot | Verdict |
|---|---|---|---|---|
| 6.1 | Named agents with an identity file and notes, run on a bundled runtime | P CodexHome, AGENTS.md | ~/Dot/agents/<slug>/CLAUDE.md on Claude Code (AgentManager) | pass |
| 6.2 | A voice line when an agent starts and finishes; the reply beside the cursor | B settings copy; S | spoken first sentence, the card, the orb's mood | pass |
| 6.3 | Threads with reasoning steps, command blocks, outputs, next-action pills | P HomeSpaceCache; B HomeSpaceCoworkAgentBlock | Home thread view (HomeWindow.swift) | pass |
| 6.4 | Context menu: archive, pin, unread, rename, move thread | B HomeSpaceMoveThreadIntoClickyMenu, ClickyRowActionsMenuButton | archive, pin, unread, rename; no move | pass, minus move |
| 6.5 | Settings pages: Voice, Microphone, Dictation, Shortcuts, Cursor, Agents | S (the sidebar) ; B HomeSpaceVoiceSettingsContent, HomeSpaceDictationSettingsContent, HomeSpaceCursorSettingsContent, HomeSpaceAgentsSettingsContent | General, Voice (Kokoro and Apple voices, preview, speed), Microphone (device picker), Dictation (dictionary editor), Shortcuts, Cursor (swatches, presence, recordings); saved settings apply live (SettingsPages.swift, LibraryPages.swift, AppDelegate.applySettings) | pass |
| 6.6 | Skills library page with filter chips, 3 active slots, create a skill | B HomeSpaceSkillsLibraryPage, HomeSpaceSkillFilterChip, SkillLibraryCache.json | the Skills page lists his ~/.claude/skills with search; every skill is available to every agent, no slots; no creator | pass, minus creator |
| 6.7 | Suggestions page with adjustment controls and history | B HomeSpaceSuggestionsPage, HomeSpaceSuggestionAdjustmentControls | the Suggestions page: toggles, the yes/no history, resets | pass |
| 6.8 | Routines: scheduled runs, pause, a run marker in the thread | B `clicky_routine_*`, HomeSpaceRoutineRunMarkerView; changelog 1.0.49 | round six: routines by voice ([ROUTINE]) or Home › Agents; pause, resume, run now, delete; three failures pause; a quiet result in the thread marked [routine] | pass |
| 6.9 | Three starter agents from an onboarding interview | B HomeSpaceStarterAgent, HomeSpaceNewClickyInterview; S | nothing (his call) | fail, his call |
| 6.10 | A usage ring on the rail | B (the plan window); S | the rail's usage ring from the ledger | pass |
| 6.11 | Jev fast lane: drive_until through a window at half a second a step | B "Fast computer use (Jev)" | Jev routes, picks elements, clears commands; agents drive with cua-driver, no fast lane | fail |
| 6.12 | Approvals for extra usage and turn leases | B agent_extra_effort_approval_shown | n/a (Claude Max) | n/a |

## 7. Proactive

| # | HeyClicky | Evidence | Dot | Verdict |
|---|---|---|---|---|
| 7.1 | A daily sweep of suggestions with a yes/no history | B ProactiveAgentSuggestionHistory, "Reset suggestions… the yes/no history" | the morning card and its file; document offers with a three-declines rule (Noticer) | pass |
| 7.2 | Suggestions are held during calls and screen shares | S; B | quietOnCalls gates notices, offers, the morning card and spoken heads-ups | pass |
| 7.3 | Meeting countdown and the next meeting on Home | B NotchMeetingCountdownSurface; settings copy | the pill, the notice, the Day page | pass |
| 7.4 | A quiet line when an app he switches to touches a deadline | nothing in HeyClicky | Noticer on app switches | beyond |

## 8. Platform

| # | HeyClicky | Evidence | Dot | Verdict |
|---|---|---|---|---|
| 8.1 | Menu bar presence; dock icon optional | B `dock_icon_enabled` | menu bar only (accessory) | pass |
| 8.2 | Sparkle updates, Sentry, PostHog, accounts, paywall, referrals | B frameworks and types | n/a (open source, local) | n/a |
| 8.3 | Sounds for agent launch, done, needs you, text open and close | Resources *.wav | a system sound on a consent card; no sound set of its own | fail, cosmetic |
| 8.4 | Permission flow with a floating guide and a drag demo | B PermissionGuideDragSourceOverlay, `permission_guide_drag_*` | the Home permissions rows and system prompts | partial |

## What a capture would settle (the unknowns)

Recorded with REA `record_unknown` on 2026-10-16 (the ledger is per session; this list is the durable copy).

- The content-sized notch window through a day's use: does it stay out of his way, does the hover peek still open reliably (medium; a CGWindowList sample plus his verdict).
- Agent rules on real tool calls: no send treated as a read, no harmless script as a system change; "Allow for this task" carrying through a run (high; the agents' transcripts after a week).
- A routine on a real morning: due on time, held offline or on a call, a quiet result, three failures pausing it (medium; dot.log and routines.json).
- Helpers in a real agent run, the "with N helpers" line, two at most (low; a two-source brief).
- Voice quality side by side with HeyClicky's realtime voice; timing is settled (medium; a listening test, one metered HeyClicky turn).
- Whether the dwell ring and the file drop onto the notch are worth building (low; his call).
- [PLACE] and [IMAGES] in a real turn, and "coffee near me" on his phrasing (low; the transcript file).
- Whether a Jev fast lane for agents matters for his app-driving briefs (low; time one real brief).

Settled since round five: the morning card showed on a real morning (he dismissed it on 10/16); the notch size was his complaint and is measured; the course-policy refusal was his chats' clearest fault and has a rule.

## Counting

| Verdict | Rows |
|---|---|
| pass (including "another place" and "by Murmur") | 70 |
| beyond HeyClicky | 5 |
| fail | 10 (6 his call or cosmetic: 2.7, 2.12, 2.13, 4.13, 6.9, 8.3; 4 to build: 1.6, 1.22, 5.6, 6.11) |
| partial | 2 |
| n/a | 4 |
| unknown | 8 items above |
