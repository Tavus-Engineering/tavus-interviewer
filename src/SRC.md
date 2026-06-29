# Frontend Source Code

## What Lives Here

This is the React + Vite frontend application. It renders the conversation experience — from the lobby through the live CVI session to the results screen.

## Structure

```
src/
├── App.tsx                    Root — FSM routing + media-device state
├── main.tsx                   Vite entry point
├── styles.css                 Global styles — Suisse Intl (UI sans) + Berkeley Mono (eyebrow/dev) typography stack, monochrome palette
├── screens/                   One file per FSM phase
│   ├── LobbyScreen.tsx         Entry screen — two-column customer intro + hair-check: welcome eyebrow / role heading / 10-min description / CTA on the left, live camera preview + device pickers (camera/mic/audio output) on the right
│   ├── InterviewScreen.tsx     Live CVI session in monochrome window-frame; FloatingInspector overlay (always rendered)
│   ├── ResultsScreen.tsx       Thank-you card ("That's a wrap") — tells the actor the casting team will review the tape, with a "View report" button that opens the in-app casting report
│   └── ReportScreen.tsx        In-app casting report — score row (Overall / Craft / Presence / Story structure), summary, perception signals, story breakdown (STAR), transcript key-moment highlights, Markdown export. Data from the persona's `submit_audition_report` post-call tool via useInterviewReport
├── components/
│   ├── video/                 Tavus CVI integration (Daily.js wrappers)
│   │   ├── VideoProvider.tsx     Wraps @daily-co/daily-react DailyProvider
│   │   ├── ConversationView.tsx  Layout wrapper around the scaffolded Conversation
│   │   ├── InteractionBus.tsx    Dispatches `app-message` events to handlers
│   │   ├── components/           Daily-provider, conversation (renders replica camera, or the replica's screenVideo slides when the presentation skill is active), audio-wave
│   │   └── hooks/                use-call, use-local-screenshare, use-replica-ids
│   ├── cvi/                   cvi-ui CLI–installed components
│   │   └── components/
│   │       └── magic-canvas/     Magic Canvas (cvi-ui 0.0.4-beta.1) — vendored CVI component; not mounted in this template
│   ├── interview/             Live-interview overlays
│   │   ├── CallControlBar.tsx       4-button bottom bar (mic / camera / CC / End call)
│   │   ├── ObjectiveProgressBar.tsx Compact "objective N/total" indicator; humanizes the active objective_name (prefixes stripped)
│   │   ├── TranscriptPanel.tsx      In-flow side panel beside video (video shrinks): selectable transcript + Copy-all button + text-message input
│   │   └── GuardrailToast.tsx       Floating toast on guardrail violation
│   ├── lobby/                 Pre-call hair-check
│   │   ├── CameraPreview.tsx     Single getUserMedia({video, audio}) call → one combined permission prompt; audio tracks are stopped/removed before joining so Daily takes over cleanly
│   │   ├── DeviceSelectorBar.tsx Camera / Microphone / Audio output dropdowns
│   │   └── pixelIcons.tsx        Inline pixel-style SVG icons used by the lobby device controls
│   ├── layout/                Inspector overlay scaffolding
│   │   └── FloatingInspector.tsx Right-docked, collapsible dev panel (portaled to document.body) with three zones: Live State vitals strip (VitalsStrip) + Inspector tab (DeveloperInspector) + Events tab (EventsConsole). Always rendered; boots collapsed as a terminal-style toggle and docks full-height against the right edge when expanded. Open/closed state + active tab persisted in localStorage under `ai-interviewer.dev-panel.v3`. Optional "Inject sample answer" affordance reads from persona/sample_answers.json.
│   ├── inspector/
│   │   ├── DeveloperInspector.tsx  Header + columns (objectives / guardrails / combined Perception · Raven stream). Receives ALL data via props from FloatingInspector — no inline constants. Summary mode: objectives tri-state (done/active/not-reached); guardrails column reads "Guardrails configured"; perception columns show "awaiting" if Raven didn't capture any.
│   │   ├── EventsConsole.tsx        Scrolling console of logged CVI events, rendered inside FloatingInspector
│   │   └── VitalsStrip.tsx          Top-of-inspector strip showing conversation status / vitals
│   └── ui/                    Shared primitives (Spinner)
├── hooks/                     State + event-routing hooks
│   ├── useConversation.ts        Creates/ends conversations via /api/conversation/*
│   ├── useInterviewState.ts      FSM + objectives + captured tools + perception observations (with hash-based history sync)
│   ├── useInterviewReport.ts     Polls GET /api/conversation/get (verbose) after the call for the `application.post_call_action_executed` event and parses the `submit_audition_report` tool's body into the casting report; exposes retry() to re-pull if the tool lands late
│   ├── useObjectiveEvents.ts     conversation.objective.{activated,completed} → callbacks
│   ├── useToolCallEvents.ts      conversation.{tool_call,perception_tool_call} → captured-tool callback
│   ├── useUtteranceEvents.ts     conversation.utterance.streaming for BOTH user + replica (keyed by inference_id, ordered by seq) → unified running transcript. Also extracts Raven awareness fields off the single-shot conversation.utterance (its speech payload is ignored).
│   ├── useGuardrailEvents.ts     conversation.perception_tool_call → guardrail trigger + toast
│   ├── useGuardrailResponder.ts  Drives the replica's in-character reply to an actionable guardrail via conversation.respond
│   ├── usePerceptionAnalysis.ts  conversation.perception-analysis → structured observations
│   ├── useSparrowMetrics.ts      Sparrow turn-taking stats (turns / interruptions) for the vitals strip
│   ├── useSpeakingState.ts       Tracks who's speaking (replica / you / silence) for the vitals strip
│   ├── useEventLog.ts            Accumulates CVI events for the Events console (consecutive heartbeats folded)
│   ├── useElapsedTime.ts         MM:SS elapsed-time counter for the title-bar timer
│   ├── useDevPanel.ts            Persists FloatingInspector open/closed state + active tab in localStorage
│   ├── useIsMobile.ts            Viewport check for responsive layout
│   ├── usePersonaObjectives.ts   GET /api/persona/objectives
│   ├── usePersonaGuardrails.ts   GET /api/persona/guardrails
│   └── usePersonaTools.ts        GET /api/persona/tools (LLM + visual + audio + perception_model)
├── lib/
│   ├── config/                Config loading + Zod validation
│   │   ├── loader.ts             Imports JSON configs, strips _comment keys, validates
│   │   └── schema.ts             Zod schema for presets
│   ├── tavus/                 Typed fetch wrappers for the /api/* proxy
│   │   ├── client.ts             apiGet / apiPost
│   │   ├── createConversation.ts
│   │   ├── endConversation.ts
│   │   ├── fetchObjectives.ts
│   │   ├── fetchGuardrails.ts
│   │   └── types.ts              Tavus API response types
│   └── utils/
│       └── formatSummary.ts      Markdown perception-analysis parser
└── types/                     TypeScript type definitions
    ├── config.ts              PresetsConfig, PresetConfig
    ├── events.ts              TavusEvent + per-event-type interfaces
    └── interview.ts           InterviewPhase, ObjectiveProgress, PersonaTool, InterviewResult, etc.
```

## Key Patterns

### FSM-Based Routing

`App.tsx` renders the current screen based on `InterviewPhase`:

```
LOBBY → INTRO → QUESTIONING → RESULTS
```

The app boots directly into LOBBY, where the customer-facing copy lives. An effect in `App.tsx` watches `phase === "LOBBY"` and fires `useConversation.create()` on boot (guarded so it runs once per session even if the user navigates back via the browser).

`useInterviewState` owns the FSM. It transitions based on:
- User actions ("I'm ready" → INTRO)
- CVI events (first objective completed → QUESTIONING, end_conversation tool or user click → RESULTS)
- RESULTS is the terminal phase — a thank-you card (ResultsScreen) whose "View report" button swaps in the in-app casting report (ReportScreen); both live inside RESULTS via a `showReport` toggle in `App.tsx`.
- Phase changes are mirrored to `window.location.hash` so back/forward buttons move between phases (with INTRO/QUESTIONING blocked from popstate entry).

### Hooks Own State, Components Own Rendering

All state logic lives in `src/hooks/`. Screens consume hooks and pass data as props to components. Components never make API calls or manage complex state.

### CVI Event Flow

1. `VideoProvider` wraps the live screen in `DailyProvider` from `@daily-co/daily-react`
2. `InteractionBus` subscribes to `app-message` events via `useDailyEvent` and fans them out to every registered handler
3. Handlers in `InterviewScreen`:
   - `useObjectiveEvents` — objective activated / completed
   - `useToolCallEvents` — LLM + perception tool calls
   - `useUtteranceEvents` — running transcript
   - `useGuardrailEvents` — visual guardrail triggers (drives the toast)
   - `usePerceptionAnalysis` — end-of-call markdown summary
   - An inline handler watches for the `end_conversation` tool to start the leave flow
4. `useInterviewState` reacts to objective updates and advances the FSM

### API Calls Go Through Proxies

Frontend code in `src/lib/tavus/` calls `/api/*` endpoints, never the Tavus API directly. The API proxy layer (`api/_lib/handlers/`) adds the `TAVUS_API_KEY` server-side.

## What to Change for a New Use Case

For most use case changes (different role, different questions, different persona), you **don't need to modify any frontend code**. The persona, objectives, guardrails, and config files drive the experience. See the concept docs in `persona/` and `config/`.

You'd only modify `src/` if you need to:
- Add or remove screens (change the FSM in `useInterviewState` and `App.tsx`)
- Display new types of CVI events (add an event handler in `InteractionBus`, create a new hook)
- Change the results display (modify `ResultsScreen` and its components)
- Add new API proxy calls (add a wrapper in `src/lib/tavus/`, a hook in `src/hooks/`)
