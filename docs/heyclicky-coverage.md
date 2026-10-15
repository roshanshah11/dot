# HeyClicky coverage: one row per HeyClicky component, mapped to Dot

A component ledger of HeyClicky 1.0.53 against Dot, one row per Swift source file named in the HeyClicky binary.
Evidence: `strings` and `otool -L` of the binary (sha256 970569210a71cf1f39790f7d0fc02af2a1d64bacf0259d4741f0fa63e53dbb31) and its Resources listing, read 2026-10-15; static only, neither app was run.

## Summary

The binary names 212 Swift files. 42 are third-party (Sentry 19, PostHog 21, `resource_bundle_accessor`, `GeneratedAssetSymbols`) and one, `macos`, is an extraction artifact of `arm64e-apple-macos.swiftinterface`. That leaves 169 HeyClicky components, including `leanring_buddyApp`, the entry point under the app's original codename ("learning buddy").

| Status | Components | What it means |
|---|---|---|
| built | 51 | Dot has a working counterpart, sometimes built a different way (noted in the row) |
| partial | 40 | Dot covers part of it; the row says what is missing |
| missing | 57 | Nothing in Dot does it |
| n/a | 21 | Exists because HeyClicky is a hosted product (16: accounts, billing, referrals, paywall, analytics, remote config, the Codex runtime bridge, its OpenAI client), the hosted Composio catalog (3), a developer preview (1) and a release announcement (1). Dot runs on Claude Code and has no accounts |
| total | 169 | |

Sparkle updates have no HeyClicky file of their own: `Sparkle.framework` ships in Frameworks and the update UI is strings plus a `SparkleUpdateDelegate` type, so updates count under n/a without a row.

Per group: agents and Home 44, infrastructure 19, talk and voice 14, integrations and skills 13, onboarding and permissions 13, notch 12, dictation 10, character and portraits 10, widgets 7, settings 7, proactive and routines 6, hand-off 5, showing 4, seeing and annotating 3, walkthrough 2.

Dot has, HeyClicky does not:

- The board: model-written cards over the screen with KaTeX and bundled D3, anime.js, Chart.js, three.js, 3Dmol.js, Mermaid, JSXGraph, smiles-drawer and matter.js, steps revealed as Dot speaks them (`Sources/Dot/Board/Board.swift`, `Resources/board/`). In the observed session HeyClicky had no math or teaching UI of its own.
- Atlas: 56 Atlas tools in every talk turn (`Sources/Dot/App/Config.swift`) and the day's brief from `scripts/dot-atlas-today.py` through `Sources/Dot/Brain/AtlasBridge.swift`.
- Claude Code agents that run with his skills, his MCP servers, Atlas's chat prompt and Atlas's tools (the README counts 102), in `Sources/Dot/Agents/AgentManager.swift`.
- A local voice (Kokoro through `scripts/dot-tts-kokoro.py` and `Sources/Dot/Audio/CommandSpeaker.swift`) and local speech recognition (Parakeet in `Sources/Dot/Audio/Transcriber.swift`); HeyClicky sends speech to OpenAI Realtime and Deepgram.
- On-device Vision OCR of a circled region (`Sources/Dot/Screen/TextRecognizer.swift`), behind the region bar's "copy text" and "look it up".
- Web lookups inside talk turns (WebSearch and WebFetch in `Sources/Dot/Brain/Talk.swift`) and live pages on the board (`[WEB:url:title]`).
- A transcript archive of every talk turn, typed question and dictation, as Markdown and JSONL per day (`Sources/Dot/Brain/TranscriptLog.swift`); HeyClicky's observed archive covers dictation only.

## The ledger

Paths in the Dot owner column are relative to the repository root. "(inferred)" marks a description drawn from the file name and nearby strings rather than from copy that states it outright.

### Notch

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| NotchWindowManager | the panel that hangs from the notch, per screen | `Sources/Dot/Notch/NotchHUD.swift` | built | one panel, on the notched (or main) screen |
| NotchPresenter | decides which notch surface shows and reads the feature toggles (inferred) | `Sources/Dot/Notch/NotchHUD.swift` | built | |
| NotchRootView | root view of the notch panel | `Sources/Dot/Notch/NotchHUD.swift` | built | |
| NotchActivitySurface | state line: listening, thinking, speaking, dictating, with a waveform (observed) | `Sources/Dot/Notch/NotchHUD.swift` | built | the line being spoken shows under the state (2026-10-15) |
| NotchAgentSurface | dropdown under the notch: Clickys with last line and artifact thumbnail, suggestions row, Home button (observed) | `Sources/Dot/Notch/NotchHUD.swift` | partial | task bar shows running and recent tasks only; no roster, thumbnails or suggestions row |
| NotchAgentPeekSurface | hover peek of working Clickys and their latest files (settings copy) | `Sources/Dot/Notch/NotchHUD.swift` | partial | hover shows the day line and folded task pills, not files |
| NotchTextInputSurface | typed question field with file attachments and agent follow-up | `Sources/Dot/Notch/NotchHUD.swift` | partial | text only; no attachments or file drop |
| NotchTextResponseSurface | the answer to a typed question, shown in the notch | `Sources/Dot/Notch/NotchHUD.swift` | built | a typed question's answer stays in the notch with copy and close; silent unless `speakTypedAnswers` (2026-10-15) |
| NotchEyeView | eyes drawn on the notch (inferred) | none | missing | the idle tab shows a glowing dot |
| NotchGelActionButtonStyle | button style for notch actions | `Sources/Dot/Notch/NotchHUD.swift` | built | |
| NotchSystemOverlayCoordinator | steps aside for Spotlight, Control Center, Notification Center and the screenshot UI (their bundle IDs sit beside it) | none | missing | Dot's overlay sits above Spotlight by design (`OverlayWindow.swift` comment) |
| ClickyMorphingText | labels that morph from one to the next (`ClickyTextMorphView`) | none | missing | labels swap without animation |

### Talk and voice

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| CompanionManager | the coordinator for voice, screen context and agents | `Sources/Dot/Brain/Talk.swift`, `Sources/Dot/App/AppDelegate.swift` | built | |
| CompanionManager+RealtimeVoice | speech-to-speech session (gpt-realtime-2.1, observed) with voice barge-in, always-on mode and the New Clicky interview | `Sources/Dot/Brain/Talk.swift` | partial | turn-based, key or typed; "listen to the lecture" keeps the ear open for a rolling transcript (`LectureListener`); no voice barge-in |
| RealtimeVoiceClient | websocket client for the realtime model | `Sources/Dot/Brain/ClaudeSession.swift` | partial | Claude Code carries text only; speech in and out are separate engines |
| RealtimeDuplexAudioEngine | full-duplex audio with echo cancellation | none | missing | the base for always-on and talking over Dot |
| RealtimeMicrophoneCapture | mic capture that detects stalls, rebuilds and fails over to the built-in mic | `Sources/Dot/Audio/AudioRecorder.swift`, `Sources/Dot/Audio/AudioDevices.swift` | built | a hold that stays silent names the mic and fails over to the built-in one (`AudioDevices`) |
| RealtimePlayer | streaming playback of the model's audio | `Sources/Dot/Audio/CommandSpeaker.swift`, `Sources/Dot/Audio/Speaker.swift` | built | one WAV per sentence |
| RealtimeProviderAvailabilityDiagnosis | explains a voice provider blocked by the network or the region | `Sources/Dot/Brain/Talk.swift` | partial | only the raw "Claude Code did not start" error |
| ClickyAudioBufferConversion | converts mic buffers to the format a recognizer takes | `Sources/Dot/Audio/AudioRecorder.swift` | built | |
| SystemAudioOutputVolume | checks the output volume and asks him to turn sound back on (inferred) | `Sources/Dot/Audio/AudioDevices.swift`, `Sources/Dot/Brain/Talk.swift` | built | a muted or silent output sends the answer to the notch as text |
| ClickyChimeWarmer | preloads the app's own sounds (agent-done.wav, clicky-text-open.wav, hatching.wav, ...) | `Sources/Dot/Agents/AgentManager.swift`, `Sources/Dot/Notch/NotchHUD.swift` | partial | system sounds only (Glass, Basso, Tink) |
| CompanionManager+EscapeInterrupt | escape stops speech and cancels work | `Sources/Dot/Input/HotkeyMonitor.swift`, `Sources/Dot/Brain/Talk.swift` | built | |
| CompanionManager+ResponsePipeline | parses tags out of the reply and speaks agent updates | `Sources/Dot/Brain/Talk.swift`, `Sources/DotKit/Beats.swift`, `Sources/DotKit/TagParser.swift` | built | agent results are spoken by AgentManager, not by the talk model |
| InlineVoiceRecordingWaveformView | waveform while he speaks | `Sources/Dot/Notch/NotchHUD.swift`, `Sources/Dot/Overlay/OverlayWindow.swift` | built | |
| NotchMicrophoneTroubleSurface | notch card when the mic hears nothing, with a Mic settings button | `Sources/Dot/Brain/Talk.swift` | built | a status line naming the dead mic, no button (2026-10-15) |

### Dictation

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| CompanionManager+Dictation | the dictation flow: focus capture, insertion, clipboard fallback, delivery to Home or the tutorial | `Sources/Dot/Brain/Talk.swift` | built | hold only; no hands-free toggle |
| DictationInsertion | inserts text through the focused element's selected-text attribute | `Sources/Dot/Input/TextInjection.swift` | built | |
| DictationFocusContext | captures the app, site host and text around the cursor for cleanup | `Sources/Dot/Input/TextInjection.swift` | partial | the focused role is checked (a password field never takes dictation); no text around the cursor |
| DictationTranscriptionClient | server transcription and cleanup with known terms; daily archive `DictationTranscripts/<date>.jsonl` (observed) | `Sources/Dot/Audio/Transcriber.swift`, `Sources/DotKit/SentenceSplitter.swift`, `Sources/Dot/Brain/TranscriptLog.swift` | partial | rule-based tidy plus his dictionary (`~/.config/dot/dictionary.txt`); no model cleanup |
| DictationDeepgramTranscriber | streaming cloud transcription over a websocket | `Sources/Dot/Audio/Transcriber.swift` | built | local Parakeet sliding window instead of the cloud |
| AppleSpeechTranscriptionProvider | Apple Speech as a second recognizer | `Sources/Dot/Audio/Transcriber.swift` | partial | one model; its offline pass is the only fallback |
| DictationCorrectionLearner | learns spellings from his corrections into the dictionary (inferred) | `Sources/Dot/Brain/Talk.swift`, `Sources/DotKit/DictationDictionary.swift` | partial | "x is spelled y" and "add x to my dictionary" write the dictionary; nothing is learned from edits |
| DictationAnnouncementWindow | introduces dictation to existing users | none | n/a | a release announcement |
| NotchDictationClipboardSurface | "copied to your clipboard, press ⌘V" when no field takes the text (observed) | `Sources/Dot/Brain/Talk.swift` | built | a status line rather than a card |
| NotchDictionaryLearnedSurface | "added to your dictionary" notice | `Sources/Dot/Notch/NotchHUD.swift` | built | "added to your dictionary" status line |

### Seeing and annotating

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| ScreenAnnotationManager | turns his strokes into words for the model: circled, a line across, scribbled over, several marks in order | `Sources/DotKit/StrokeShape.swift`, `Sources/Dot/Brain/Talk.swift` | built | circled, a line along, scribbled over; several marks per hold, in order (`StrokeClassifier`) |
| AnnotationOverlay | draws his ink and gathers accessibility data inside the marked region | `Sources/Dot/Overlay/OverlayWindow.swift`, `Sources/Dot/Brain/Talk.swift` | built | elements inside the box are marked "(in box)" |
| ElementLocationDetector | asks Claude's computer-use tool for the exact pixel to point at | `Sources/Dot/Screen/AccessibilityContext.swift`, `Sources/Dot/Brain/Jev.swift` | built | accessibility snap plus a Jev pick; a passage is boxed where the OCR sees its words |

### Showing

The visual grammar has no files of its own in HeyClicky (it lives in the response pipeline and the overlay). Every tag its regexes accept, POINT, HIGHLIGHT, TARGET, HOVER, SHAPE and TYPE, is parsed by `Sources/DotKit/TagParser.swift` and acted on in `Sources/Dot/Brain/Talk.swift`; TYPE landed 2026-10-15 (docs/tasks.md), after the earlier ability map was written.

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| OverlayWindow | full-screen click-through overlay for the character and its marks (from open-source Clicky) | `Sources/Dot/Overlay/OverlayWindow.swift` | built | |
| ClickySystemWindowPickerYield | moves its transparent windows aside while the system window picker or screenshot tool is open | none | missing | |
| ClickyWindowCapturePolicy | per-window rule for whether recordings and screen sharing capture HeyClicky (inferred: a Role type, the `setSharingType:` selector, the "Show in screen recordings" setting) | `Sources/Dot/App/AppDelegate.swift` | built | "Show Dot in screen recordings" in the menu sets every window's sharing type |
| ClickyBackgroundCursorControl | changes the system cursor while another app is in front, through a private WindowServer property (inferred) | none | missing | (unclear) what it is used for |

### Walkthrough

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| CompanionManager+Annotation | the guided walkthrough: step history, click-to-advance budget, a fresh look after each click, waiting until the screen settles | `Sources/Dot/Brain/Talk.swift`, `Sources/Dot/Screen/ScreenSettle.swift` | built | `ScreenSettle` waits until two thumbnails match (up to `walkthroughSettleSeconds`) and says when the screen was still changing |
| TextInjectionDelivery | types or pastes prepared text at a point; refuses secure fields; leaves it on the clipboard when the field is wrong | `Sources/Dot/Input/Driver.swift`, `Sources/Dot/Brain/Talk.swift` | partial | TYPE copies and points (pastes in drive mode); dictation refuses secure fields |

### Agents and Home (with computer use)

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| CompanionManager+CodexAgent | starts and keeps agent sessions, their environment and tokens | `Sources/Dot/Agents/AgentManager.swift` | built | Claude Code sessions instead of Codex |
| CompanionManager+CodexAgentTurn | builds and launches an agent turn: brief, screenshots, routine actions, a gate before submit | `Sources/Dot/Agents/AgentManager.swift` | built | no routine actions |
| CodexAgentSession | one agent session; reads its NEXT_ACTIONS, DONE_TITLE, ARTIFACTS, SUMMARY, ROUTINE and COMPUTER_USE_REQUEST blocks | `Sources/Dot/Agents/AgentManager.swift`, `Sources/DotKit/AgentResult.swift` | partial | only a trailing "Next:" line is parsed |
| CodexHomeSpaceCaches | on-disk thread cache and turn journal | `Sources/Dot/Agents/AgentManager.swift` | built | `.dot/transcript.jsonl` and a resumable session id |
| CompanionManager+AgentNotifications | announces when a Clicky starts or finishes (inferred) | `Sources/Dot/Agents/AgentManager.swift` | built | |
| CompanionManager+AgentCommentaryStream | feeds what background agents just did into the voice session as silent context | `Sources/Dot/Brain/Talk.swift` | built | an agents line in every talk turn: who is working, who finished, what they said (`AgentManager.recentRuns`) |
| CompanionManager+ClickyOrganizer | founds named Clickys from earlier threads | `Sources/DotKit/TagParser.swift`, `Sources/Dot/Agents/AgentManager.swift` | partial | `[NEW_AGENT]` founds one per request; no sweep over history |
| CompanionManager+HomeSpace | sends Home messages to a Clicky | `Sources/Dot/Home/HomeWindow.swift`, `Sources/Dot/Agents/AgentManager.swift` | built | |
| ClickyRoster | the Clickys: created, archived, renamed, a portrait each | `Sources/Dot/Agents/AgentManager.swift` | built | no portraits |
| ClickyAgentIconView | picks an agent's icon from words in its job | `Sources/Dot/Home/HomeWindow.swift` | partial | first-letter avatar |
| ClickyAgentTurnCostLedger | cost of each agent turn | `Sources/Dot/Agents/Ledger.swift` | built | |
| CodexHUDWindow | agent card under the notch: avatar, status, live line, Stop, Open (observed) | `Sources/Dot/Notch/NotchHUD.swift` | built | the task bar row |
| CodexHUDHitRegions | click regions for that card (inferred) | none | missing | (unclear) |
| HomeSpaceRootView | the Home window's layout | `Sources/Dot/Home/HomeWindow.swift` | built | |
| HomeSpaceViewModel | Home's state | `Sources/Dot/Home/HomeWindow.swift` | built | |
| HomeSpaceWindowManager | Home as a dropdown from the notch or a detached window | `Sources/Dot/Home/HomeWindow.swift` | partial | an ordinary window only |
| HomeSpaceIconRail | the rail: Clickys with unread dots, suggested and archived sections, usage ring | `Sources/Dot/Home/HomeWindow.swift` | partial | no suggested or archived sections |
| HomeSpaceSearchInput | search across Clickys | `Sources/Dot/Home/HomeWindow.swift` | built | |
| HomeSpaceConversationTranscript | a thread's messages, with an interrupted marker | `Sources/Dot/Home/HomeWindow.swift` | built | result rows show success or failure; no interrupted marker |
| HomeSpaceCoworkTranscript | step rows ("Read a file", "Edited a file") with command and output blocks, copy and collapse | `Sources/Dot/Home/HomeWindow.swift`, `Sources/Dot/Agents/AgentManager.swift` | built | tool rows expand to the tool's output with copy (2026-10-15) |
| HomeSpaceArtifactCards | artifact cards inside the thread | `Sources/Dot/Home/HomeWindow.swift` | partial | outputs sit in a side column, not in the thread |
| HomeSpaceCardViews | card views with a thumbnail per kind (markdown, document, spreadsheet, image, link) | `Sources/Dot/Home/HomeWindow.swift` | partial | icons, not thumbnails |
| HomeSpaceOutputPreviewColumn | right-hand preview: PDF, markdown, QuickLook, open, reveal | `Sources/Dot/Home/HomeWindow.swift` | built | no fold or resize |
| HomeSpaceContextMenu | Archive, Pin, Mark unread, Rename, Move into | `Sources/Dot/Home/HomeWindow.swift` | partial | no mark unread or move into |
| HomeSpaceSwipeToArchive | swipe a row to archive it | none | missing | |
| HomeSpaceTapbackBadge | tapback reactions on messages (tapback-thumbs-up.wav) | none | missing | |
| HomeSpaceComposerDraftStore | keeps unsent drafts per thread | none | missing | one shared composer, not saved |
| HomeSpaceConversationScrollMemory | remembers scroll position per thread | none | missing | always scrolls to the end |
| HomeSpaceFirstMessageSuggestions | suggested first messages in an empty thread | none | missing | |
| HomeSpaceFocusPane | a pane for one suggested or past task, with Send task | none | missing | |
| HomeSpacePromptCardPalette | color palettes for prompt cards (inferred) | none | missing | |
| HomeSpaceNewClickyPage | New Clicky page: a spoken interview that designs the agent (observed) | `Sources/Dot/Home/HomeWindow.swift` | partial | a name and first-task form |
| InterviewThoughtBubbles | thought bubbles during that interview (inferred) | none | missing | |
| HomeSpaceVoicePill | hold-to-talk pill in the Home composer | none | missing | the composer is typed only |
| MarkdownViewerContentView | a markdown document viewer with images | `Sources/Dot/Home/MarkdownViewer.swift` | built | `MarkdownViewer.swift`: marked plus KaTeX, tables, code, images; long results and .md outputs open in it |
| MarkdownViewerTableView | markdown tables in that viewer | `Sources/Dot/Home/MarkdownViewer.swift` | built | tables render in the viewer |
| DocumentAnimatedImageView | animated images inside documents | none | missing | |
| ClickyCuaDriverDaemonController | runs the bundled cua-driver daemon under a policy file | `Sources/Dot/Agents/AgentManager.swift` | partial | cua-driver installed separately and listed in `~/.config/dot/mcp.json` |
| ClickyComputerUseGate | MCP proxy that refuses input tools until he allows the turn | `Sources/Dot/Agents/AgentManager.swift`, `Sources/DotKit/ConsentPolicy.swift` | built | asks only for clicks that read like a send, buy or delete (his rule) |
| CompanionManager+JevUse | wires the Jev fast lane into agents | `Sources/Dot/Brain/Jev.swift` | missing | Jev answers routing, element, consent and notice questions only |
| ClickyJevUseLoop | the step loop: Jev decides each click, about half a second a step | none | missing | |
| ClickyJevUsePolicyHead | picks the accessibility element that advances the goal | none | missing | |
| ClickyJevUseMCPServer | loopback MCP server that gives agents the fast-lane tool | none | missing | |
| ClickyJevUseDriverClient | sends the loop's clicks to cua-driver | none | missing | |

### Hand-off

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| HandoffManager | attaches to a target app and delivers queued screenshots and a note into its input, then presses Return (inferred from "pidTargetedPasteAndReturn", "Pasted into") | `Sources/Dot/Brain/Talk.swift` | partial | Dot hands a region to its own agents, never into another app |
| HandoffRegionSelectOverlay | drag to capture a region, then pick an action | `Sources/Dot/Brain/Talk.swift`, `Sources/Dot/Overlay/ActionBar.swift` | built | |
| HandoffVoiceStopWindow | choose Send with text, Send with voice, or Don't send yet | `Sources/Dot/Overlay/ActionBar.swift` | partial | the note to an agent is typed only |
| HandoffIndicatorWindow | marker on the app the hand-off is attached to, with a refocus click (inferred) | none | missing | |
| NotchHandoffSurface | notch status: regions queued, pasted into the app | none | missing | one region at a time |

### Proactive and routines

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| CompanionManager+Proactive | suggestions and proactive launches; goes quiet on calls (a `ClickyCallPresenceDetector` type; observed) | `Sources/Dot/Brain/Noticer.swift`, `Sources/Dot/App/AppDelegate.swift` | partial | deadline notices, document offers and the meeting notice; quiet on calls (`CallPresence`); no task suggestions |
| ProactiveAgentsClient | fetches proactive agent suggestions | none | missing | no suggestion sweep |
| HomeSpaceSuggestionsPage | suggestion cards with yes, no and "not now because", adjust, a daily sweep | none | missing | |
| NotchMorningSuggestionsSurface | morning card "I can do N things for you today" (observed) | `Sources/Dot/Brain/Talk.swift` | partial | one Atlas line in the bubble, no cards to pick |
| CompanionManager+ClickyRoutines | runs a Clicky's routine and reports what changed since the last run | none | missing | |
| CompanionManager+AgentCrons | scheduled agent runs (a `ScheduledAgentCronsResponse` type) | none | missing | |

### Integrations and skills

Also in Resources with no Dot counterpart beyond his own Claude Code skills: `ClickyIntegrationSkills`, `ClickyBundledSkills` and per-app skill docs (notion.md, linear.md, imessage.md, spotify.md, obsidian.md, ...).

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| ClickySkillLibraryBackend | the community skill library (SkillLibraryCache.json, 200 skills, observed) | `Sources/Dot/Agents/AgentManager.swift` | partial | agents load his installed skills; no library to browse |
| HomeSpaceSkillsLibraryPage | the skills library page with filter chips | none | missing | |
| ClickyPowerUp | skills as power-ups: create, activate, remove, three active slots | `Sources/Dot/Agents/AgentManager.swift` | partial | his skills are always on; no create or activate UI |
| PowerUpPanelWindow | panel for making a new skill | none | missing | |
| PowerUpAvatarView | an avatar per skill (inferred) | none | missing | |
| PowerUpSkillFileStore | writes active skills into each agent's folder | `Sources/Dot/Agents/AgentManager.swift` | built | Claude Code loads his skills in every agent session |
| ClickyCustomConnectorCapabilityDeriver | works out what a custom MCP connector does from its tool list | none | missing | |
| ClickyCustomConnectorOAuthClient | OAuth (PKCE) sign-in for a custom connector | none | partial | servers he signs into through Claude Code work for agents; Dot has no sign-in flow |
| HomeSpaceCustomConnectorsSettings | add a connector by URL or command, key kept in the Keychain | `Sources/Dot/App/Config.swift` | partial | `mcp.json` edited by hand; no UI, no Keychain |
| HomeSpaceCustomConnectorDraftStore | keeps a half-filled connector form | none | missing | |
| HomeSpaceIntegrationConnectionFeedback | connection status for catalog (Composio) integrations | none | n/a | hosted catalog; Atlas tools and his MCP servers fill the role |
| IntegrationLogoArtwork | logos for catalog integrations | none | n/a | catalog art |
| IntegrationSuggestionMonitor | suggests connecting the integration for the app or site in front | none | n/a | no catalog to suggest from |

### Widgets (place, stock, image)

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| ResponseCardOverlay | a response card that shows a stock, image or place widget from a tag such as `[IMAGES:` | `Sources/Dot/Board/Board.swift` | partial | cards are model-written HTML; no typed widget payloads |
| StockQuoteAPI | live quote: price, change, day range, sparkline closes (field names) | `Sources/Dot/Brain/Quotes.swift` | built | Yahoo chart endpoint: price, change, a month of closes |
| StockWidget | stock card with a range switch | `Sources/Dot/Brain/Quotes.swift` | built | [STOCK:NVDA] card with a sparkline; no range switch |
| ImageSearchAPI | image search returning source and thumbnail URLs | `Sources/Dot/Brain/Talk.swift`, `Resources/board/board.css` | partial | the model finds and checks image URLs itself for a `.figure` |
| PlaceSearchAPI | place search: rating, photos, phone, maps link | none | missing | web lookup only |
| PlaceWidget | a place card | none | missing | |
| PlaceDetailOverlay | place details with directions | none | missing | |

### Onboarding and permissions

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| OnboardingTutorialWindow | the hands-on tour (say hi, draw demo, Home tour) with a check that its window is visible | none | missing | |
| OnboardingIntroLayout | layout of the intro (inferred) | none | missing | |
| IntroHatchFlightOverlay | the hatch-and-fly intro animation (hatching.wav) | none | missing | |
| IntroSkillPingSurface | a wiggling skill ping during the intro (inferred) | none | missing | |
| OnboardingPhantomAgentsOverlay | demo agents with sample tasks during onboarding | none | missing | |
| OnboardingSquadPicker | pick a starter squad of Clickys | none | missing | |
| OnboardingStarterPlanClient | asks the backend for a starter plan from the interview | none | missing | |
| HomeSpaceStarterCast | starter Clickys (Research Buddy, a web builder) | none | missing | Dot starts with one agent named Dot |
| PermissionFlowCoordinator | step-by-step permission flow, including the ScreenCaptureKit picker | `Sources/Dot/App/AppDelegate.swift`, `Sources/Dot/App/Permissions.swift`, `Sources/Dot/Home/HomeWindow.swift` | partial | system prompts and Grant buttons; no guided flow |
| PermissionGuideAssistant | a floating guide that shows where to drag or toggle in System Settings | none | missing | |
| CompanionManager+PermissionFlow | permission state, a blocked-screen notice, a relaunch helper | `Sources/Dot/App/AppDelegate.swift` | partial | polls Accessibility every 2 s; no relaunch helper |
| WindowPositionManager | permission checks and System Settings links (inferred; carried over from open-source Clicky) | `Sources/Dot/App/Permissions.swift` | built | |
| AgentPermissionsInspector | shows which macOS permissions agents inherit (Automation for Numbers, TextEdit, Preview) | none | missing | Dot lists its own three grants only |

### Character and portraits

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| CompanionActorRenderer | the cursor character's animation states: idle, travel, point, speak, guide, agent run, tool use | `Sources/Dot/Overlay/OverlayWindow.swift` | partial | phases, moods and flight; no per-tool or agent-run states |
| ClickyCharacterEditor | character editor: packs, randomize, save | none | missing | |
| ClickyPortraitAppearance | outfits, skin, hair and colors for portraits | none | missing | |
| ClickyClassicCloudPortrait | the classic cloud portrait | none | missing | |
| ClickyCloudPortrait | the cloud portrait renderer | none | missing | |
| ClickyStorybookPortrait | a storybook-style portrait (inferred) | none | missing | |
| ClickyInteractivePortrait | a portrait that looks toward the pointer and reacts | none | missing | |
| ClickyKiCrewHair | an animated hair layer for one character set (inferred) | none | missing | |
| ClickyPortraitThumbnail | portrait thumbnails with a tagline each | none | missing | |
| HomeSpaceCloudFaceView | an agent's cloud face with moods (needs approval, interrupted) | none | missing | Home uses a letter avatar |

### Settings

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| HomeSpaceSettingsPage | settings sidebar: Account, General, Voice, Microphone, Dictation, Shortcuts, Cursor, Agents, Integrations (observed) | `Sources/Dot/Home/HomeWindow.swift` | partial | one page: talking, agents, models, context folder, permissions |
| HomeSpaceSettingsContent | the controls on those pages | `Sources/Dot/Home/HomeWindow.swift`, `Sources/Dot/App/Config.swift` | partial | no mic, voice or language picker, dictionary, cursor color or recordings toggle; the rest lives in config.json |
| ClickyHotkeyConfiguration | four shortcuts (talk, text, dictate, hands-free dictate) with reset | `Sources/Dot/Input/HotkeyMonitor.swift` | partial | fixed chords: control+option, plus shift for an agent, control+fn to dictate; hands-free long dictation is Murmur's (double-tap fn), by his decision 2026-10-15 |
| ClickyHotkeyRecorder | records a new key combination | none | missing | |
| HomeSpaceShortcutHelpButton | shows the shortcuts | none | missing | README only |
| ClickyLabWindow | internal previews and debug window (inferred) | `Sources/Dot/main.swift`, `scripts/dot-try.sh` | partial | command-line hooks (`--ask --quiet`, `--card`, `--stt`), no window |
| ClickyTextMotionExamples | a gallery of text-motion examples (inferred) | none | n/a | developer preview |

### Infrastructure, accounts and billing

| HeyClicky component | What it does | Dot owner | Status | Note |
|---|---|---|---|---|
| leanring_buddyApp | app entry point, named for the original codename | `Sources/Dot/main.swift`, `Sources/Dot/App/AppDelegate.swift` | built | |
| ClaudeAPI | Anthropic Messages client (used for element location) | `Sources/Dot/Brain/ClaudeSession.swift` | built | the Claude Code CLI, not the API |
| DesignSystem | shared colors and type | `Sources/Dot/App/Config.swift`, `Resources/board/board.css` | partial | the accent comes from config; Swift views repeat their colors |
| CodexRuntimeBridge | starts the bundled Codex app-server with its own CODEX_HOME | none | n/a | Dot runs Claude Code |
| CodexProtocolClient | JSON-RPC client to that app-server | none | n/a | `ClaudeSession.swift` plays this role |
| OpenAIAPI | OpenAI chat-completions client with images | none | n/a | Dot calls Claude only |
| AppBundleConfiguration | backend, Supabase, PostHog and Sentry endpoints baked into the build | none | n/a | |
| AppRemoteConfig | remote app config: changelog and community links | none | n/a | |
| SupabaseAuthManager | sign-in and tokens | none | n/a | no accounts |
| BillingClient | plan, usage and referral calls | none | n/a | |
| AccountDeletionClient | deletes the account | none | n/a | |
| AccountDeletionPanel | the account deletion UI | none | n/a | |
| PaywallCardContent | the paywall card | none | n/a | |
| AgentPaywallHUDWindow | the paywall HUD for agents | none | n/a | |
| ReferralProgramModel | referral earnings and codes | none | n/a | |
| HomeSpaceReferralPage | the Invite and Earn page | none | n/a | |
| CompanionManager+EarlyStopRefund | refunds an agent message stopped early | none | n/a | |
| CompanionManager+DiscoveryChannel | asks how he heard about the app | none | n/a | |
| ClickyAITracing | model-call tracing to PostHog | none | n/a | analytics |

## Round four (2026-10-15, late afternoon)

Rows moved by the round: NotchTextResponseSurface, NotchActivitySurface, RealtimeMicrophoneCapture, SystemAudioOutputVolume, NotchMicrophoneTroubleSurface, NotchDictionaryLearnedSurface, ScreenAnnotationManager, ClickyWindowCapturePolicy, CompanionManager+Annotation, CompanionManager+AgentCommentaryStream, HomeSpaceCoworkTranscript, MarkdownViewerContentView, MarkdownViewerTableView, StockQuoteAPI, StockWidget to built; DictationFocusContext, DictationCorrectionLearner, CompanionManager+RealtimeVoice (the lecture ear), CompanionManager+Proactive (quiet on calls) to partial. Beyond the ledger: documents read by their text (PDFKit, pages, docx), passages found by words and scrolled to with the app's own find box, matches boxed from OCR line boxes, the FIND tag, the lecture ear with its saved transcript and recap, Murmur's history in talk.

## What finishing means

The missing or partial rows that a student using Dot to be tutored, to dictate and to run agents would notice most, in order:

1. NotchTextResponseSurface: in class or the library he types, yet the answer is spoken aloud and shown in a bubble that fades after about four seconds; it should stay readable in the notch where he typed.
2. DictationTranscriptionClient: dictation has no word list and no model cleanup, so course terms and names come out as the recognizer heard them (DictationCorrectionLearner and DictationFocusContext build on it).
3. CompanionManager+AgentCommentaryStream: "what did the agent find?" by voice fails today because the talk model is never told an agent's progress or result.
4. ClickyHotkeyConfiguration: no hands-free dictation, so a long answer or a page of notes means holding two keys the whole time.
5. ScreenAnnotationManager: tutoring on a proof needs two marks ("why does this line follow from this one"), and the model should know a line was crossed out rather than circled.
6. CompanionManager+RealtimeVoice: a tutoring exchange runs back and forth; without interrupting by voice or an always-on mode, every reply costs a key press.
7. RealtimeMicrophoneCapture: when headphones connect or the mic stalls, Dot hears nothing and shows "didn't catch that"; failover and a NotchMicrophoneTroubleSurface-style card would name the cause.
8. CompanionManager+ClickyRoutines: recurring agent work (a weekly problem-set check, a daily recruiting news brief) has to be asked for every time; CompanionManager+AgentCrons is the scheduler.
9. CompanionManager+Annotation: a walkthrough step can land before the pane repaints; waiting until the screen settles is already on docs/tasks.md.
10. HomeSpaceCoworkTranscript: checking an agent's work means reading one-line steps with no command output to open.
11. MarkdownViewerContentView: agents write Markdown with tables, and Home shows it through QuickLook or as inline text (MarkdownViewerTableView is the table half).
12. CompanionManager+Proactive: in office hours or a call Dot can still speak a meeting notice; going quiet on calls is on docs/tasks.md, as is ClickyWindowCapturePolicy for hiding the orb from a screen share.
13. SystemAudioOutputVolume: with the Mac muted in class, a spoken answer is silently lost.
14. ClickyJevUseLoop: agents that operate an app move one model call per click; the Jev fast lane is about half a second a step.

## Method

Static evidence only. File names come from `strings` of the HeyClicky binary (sha256 above); what each file does comes from the file name, the strings beside its path, analytics event names (for example `clicky_routine_*`, `dictation_*`, `annotation_*`), the settings copy, the Resources listing and the observed session. A file appears in the binary only when its compiled code embeds its own path (from an assertion or a forced unwrap), so the list undercounts: the meeting countdown and the call-presence detector show up only as type names and strings, not as files. A row's name establishes that a component exists, not how well it works; docs/heyclicky-session-2026-10-15.md covers behavior as observed, and docs/heyclicky-abilities.md is the coarser ability map this ledger refines. Dot owners were checked against the source tree on 2026-10-15; a "built" row means the code path exists, not that it was exercised for this audit.

Frameworks (`otool -L`, REA evidence ev_afcef19c5c5adeb432251f34eaa1c05d32a114b1786cf9e22bae740ee80f99f7 and ev_bffa10fc9f4a2a16800c3aa0fdc449580e19203b62ac376acfe0d818db8a050c): HeyClicky links Speech, EventKit, Contacts, MapKit for SwiftUI, Charts, PDFKit, Photos, CoreData, Carbon, Network, CryptoKit, ServiceManagement, CoreLocation (weak) and CoreMediaIO, which Dot does not; Dot links Vision, NaturalLanguage, CoreML and WebKit, which HeyClicky does not; both link ScreenCaptureKit. The gaps line up with rows above: Speech with AppleSpeechTranscriptionProvider, MapKit with the place widgets, Charts with StockWidget, PDFKit with the output preview, ServiceManagement with launch at login (Dot uses a launchd agent from `build.sh` instead). Dot reads the calendar through Atlas, not EventKit.
