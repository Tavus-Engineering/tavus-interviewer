# AI Interviewer — Claude Context

## What This Is

A Tavus CVI-powered AI interviewer template (React + Vite frontend with a platform-agnostic API proxy layer). The shipped experience is currently configured as a **casting audition**: the replica is **Julian**, an AI casting director at **Meridian Pictures** running auditions for the lead in a sci-fi series called **"Starfall"**. The person on camera is the **actor** (not a candidate), and the session is an **audition** (not an interview). The underlying code is still the generic interviewer scaffold — many symbol names (`InterviewScreen`, `useInterviewState`, `InterviewPhase`) keep the original "interview" naming.

## Architecture

- **Screens**: LobbyScreen → InterviewScreen → ResultsScreen
- **FSM**: LOBBY → INTRO → QUESTIONING → RESULTS  *(the app boots directly into LOBBY, which carries the customer-facing copy)*
- **CVI**: @daily-co/daily-react provides DailyProvider, useDailyEvent, and video components
- **API proxy**: Shared handlers in `api/_lib/handlers/` contain all proxy logic. In dev, a Vite plugin (`api/_lib/vite-plugin.ts`) serves them as middleware — no separate backend. In prod, thin platform adapters (`api/conversation/`, `api/persona/`) wrap the same handlers. Shared (non-endpoint) code lives under `api/_lib/` on purpose: Vercel turns every non-`_`-prefixed file under `api/` into a Serverless Function, so the handlers/types/plugin are kept under `_lib/` to avoid deploying ~16 junk functions (which would also exceed the Hobby-tier 12-function cap). See `api/API.md` → "Why `_lib/`?".
- **Config**: `config/presets.config.json` holds the preset(s). Objectives, guardrails, tools, and perception all come from the persona via Tavus API — not from config.
- **Closed captions**: conversations are created with `enable_closed_captions: true` so utterance events flow back. Per Tavus docs, `conversation.utterance.streaming` is the canonical event for **both** user and replica — it fires progressively for each turn with `inference_id`, accumulated `text`, `role`, and a `final` flag, and reflects what was actually spoken (so interruptions are handled correctly). Entries are sorted by Tavus' `seq` (globally monotonic sequence number) so out-of-order arrivals over the data channel still render chronologically. The single-shot `conversation.utterance` event is kept only as a carrier for Raven awareness fields (`user_visual_analysis`, `user_audio_analysis`) — its speech payload is ignored to avoid double-rendering. The TranscriptPanel sits beside the video (in-flow flex, the video shrinks when CC is open) and renders both roles.
- **Call duration**: every conversation is created with `properties.max_call_duration: 600` (Tavus enforces server-side). A live `MM:SS / 10:00` timer in the title bar mirrors the cap and triggers a graceful auto-leave at 10:00.
- **Live persona data**: three hooks fetch from the persona at runtime:
  - `usePersonaObjectives` → `GET /api/persona/objectives`
  - `usePersonaGuardrails` → `GET /api/persona/guardrails`
  - `usePersonaTools`      → `GET /api/persona/tools`  (returns `llmTools`, `visualTools`, `audioTools`, `perceptionModel`)

## How Objectives Work

Objectives are defined on the Tavus persona and drive the conversation flow. The frontend does NOT hardcode them.

1. **On preset selection**: `usePersonaObjectives` → `GET /api/persona/objectives` → fetches the persona from the Tavus API → gets `objectives_id` → fetches objectives → returns the ordered list
2. **`useInterviewState`** seeds the inspector's OBJECTIVES column with the real objective labels from the API
3. **During conversation**: `InteractionBus` subscribes to Daily.js `app-message` events via `useDailyEvent`. CVI fires `conversation.objective.activated` (objective begins) and `conversation.objective.completed` (objective done) events. These flip the inspector entries from pending → active → done in real time.
4. **Dynamic fallback**: If an event arrives for an unknown objective (not in the pre-loaded list), it's added to the inspector list automatically.

## How Interview Selection Works

1. **LobbyScreen** — the entry screen: combined customer intro + hair-check. Two-column layout: left side shows the welcome eyebrow ("Welcome in"), role heading ("You're auditioning for the {role}"), and the 10-minute description that names the AI replica (e.g. "Julian") and the studio ("Meridian Pictures"); right side has the live camera preview + three device selectors (camera / mic / audio output) and the "I'm ready, let's play" CTA.
2. **Conversation creation timing** — `App.tsx` fires `useConversation.create()` in an effect that runs when `interview.phase === "LOBBY"` (i.e. as soon as the app boots). The LobbyScreen shows "Connecting…" until the create call resolves.
3. **No SELECT screen, no custom wizard** — both were removed. Adding new interviewers means editing `presets.config.json` to point at a persona created in the Tavus dashboard (or `npm run init` to copy a reference one). The app currently uses `presets[0]` as the single active preset.

## How the Developer Inspector Works

The inspector is always rendered as a **FloatingInspector** (`src/components/layout/FloatingInspector.tsx`): a right-docked, collapsible developer panel rendered through a portal at `document.body` (so an ancestor `transform` can't capture its `position: fixed`). Collapsed, it shows a small terminal-style toggle/launcher; expanded, it docks against the right edge as a full-height panel. Open/closed state and the active tab persist in localStorage under the key `ai-interviewer.dev-panel.v3`, but it always **boots collapsed** so it never covers the replica on call entry.

The expanded panel has **three zones**:

1. **Live State vitals strip** (`VitalsStrip.tsx`) — always visible, pinned below the header so it never scrolls away. Shows the conversation status pill (Active / Shutting down / Ended) + elapsed `MM:SS`, who's speaking right now (Replica / You / Silence), the objective progress counter (`completed/total`) with the active objective label, optional Sparrow turn-taking stats (TURNS / INT), and a guardrail-violation counter (GR) that turns red the instant a violation is recorded.
2. **Inspector tab** — wraps the `DeveloperInspector` (columns described below): objectives / guardrails / tools / Perception · Raven.
3. **Events tab** (`EventsConsole.tsx`) — a severity-colored CVI event console. Consecutive heartbeats (`system.replica_present`) fold into one expandable row; rows are colored by severity (muted / neutral / amber / red); each row expands to its raw `properties` JSON with a per-row copy button; a type filter + "Copy All" + "Clear" toolbar sits on top. Guardrail rows in the Inspector tab can deep-link here.

The two tabs are `"inspector"` and `"events"` (`DevPanelTab` in `useDevPanel.ts`). The FloatingInspector also exposes an optional "Inject sample answer" affordance in the panel header during the live call (reads `persona/sample_answers.json` and sends a `conversation.respond` event for the active objective — dev-only convenience for demoing). The expandable side `TranscriptPanel` (toggled from the CallControlBar's CC button) shows the running list of utterances; it is a separate component, not part of the inspector.

The Inspector tab renders a header (title + status pill) → divider → columns. ALL data flows from props — there are no hardcoded fallbacks. Columns:

- **Objectives** — driven by `usePersonaObjectives` + the `conversation.objective.{activated,completed}` events. In summary mode (post-call), objectives are tri-state: `done` (✓ completed), `active` (○ activated but not completed before the call ended), `not-reached` (— never activated, dim 40% opacity). The activated-but-not-completed state is tracked via an `activated` flag set on `ObjectiveProgress` by `activateObjective` / `completeObjective`.
- **Guardrails** — driven by `usePersonaGuardrails` (`GET /api/persona/guardrails`). Live data from Tavus, not hardcoded. The handler resolves guardrails two ways: a single `guardrails_id` (legacy) **or** an array `guardrail_ids` (the casting persona uses this — 7 guardrails tagged `casting-audition`), fetching each id individually and dropping any that fail. If the API returns an empty list, the column renders empty (no synthetic fallback). Live mode shows the column label as `Guardrails scanning…`; summary mode shows `Guardrails configured` (we don't track guardrail triggers, so we don't claim "passed").
- **Perception · Raven** — combined visual + audio awareness stream. Appends each new observation from `user_visual_analysis` / `user_audio_analysis` (carried on `conversation.utterance` events — the only thing we still read from that event) and types out the latest entry one word at a time. Header dims to "disabled" when the persona's `perception_model` is `off`. Empty state shows `awaiting…`.

- **Tools** — driven by `usePersonaTools` (`GET /api/persona/tools` → `llmTools` + `visualTools` + `audioTools`, deduped by name). A tool flips to ✓ once a matching `conversation.tool_call` / `conversation.perception_tool_call` event fires (tracked by `useToolCallEvents`). The casting persona carries no LLM tools — its tools are Raven perception queries — so for the shipped preset this column is typically empty or perception-only; it renders an empty state rather than a synthetic fallback.

Guardrails are fed exclusively from the API (`usePersonaGuardrails`); `useGuardrailEvents` humanizes labels from the live `guardrail_name` and matches perception tool calls to visual guardrails by fuzzy name — no hardcoded guardrail names, labels, or tool→guardrail tables.

## How the Results Hand-off Works

RESULTS is the final FSM phase, and it hosts two views toggled by `showReport` in `App.tsx`:

1. **ResultsScreen** — a thank-you card ("That's a wrap. Thanks for playing." + "The casting team will sit with your tape and circle back…") with a **"View report"** button.
2. **ReportScreen** — the in-app casting report, shown when "View report" is clicked.

The report is produced by the persona's **`submit_audition_report` post-call action tool** (`trigger_type: post_call`). After the call ends, Tavus' AI fills the tool's fields from the transcript and records the rendered request on the conversation as an `application.post_call_action_executed` event. `useInterviewReport` polls `GET /api/conversation/get` (verbose) until that event appears, then parses `request.body` into an `InterviewAnalysis`. If the tool hasn't landed within ~4 minutes, ReportScreen shows a friendly error with a **Try again** button (`useInterviewReport`'s `retry()`) that re-pulls the conversation and restarts the poll window. The tool also POSTs the body to `/api/conversation/post-call-result` (which just returns `200`; the app reads the report from the event, not the delivery — and Tavus records the event even if delivery fails).

ReportScreen renders (casting-flavored labels over the original score keys): scores **Overall** / **Craft** (`technical`) / **Presence** (`communication`) / **Story structure** (`star_adherence`); a **Summary**; **Perception signals over time** (`perception_bars_json`); a **Story breakdown** with Situation/Task/Action/Result (`star_*`); **Transcript · key moments flagged** (`transcript_highlights_json`); plus a Markdown export. The field *keys* are unchanged from the original interview report — only the display labels and the tool's field descriptions are casting-specific — so the parsing pipeline (`useInterviewReport` → `InterviewAnalysis`) is untouched. The frontend matches the report event by `event_type` (`application.post_call_action_executed`), so the tool's name (`submit_audition_report`, not the account-unique `submit_interview_report`) doesn't matter to it.

## Presentation Skill (on-screen slide) — the cold read

The Tavus **presentation** skill is attached to the persona and drives the **cold read** (`obj_coldread`, the centerpiece beat). When the cold read begins, Julian brings the Starfall "sides" up on screen and **points the actor to them, telling them the lines marked captain are theirs to read**, then the scene plays out: **Julian reads Nova's lines himself** (the casting-reader convention) while the actor reads the captain's lines.

- **Skill config** (on Tavus): attached via `PUT /v2/personas/{persona_id}/skills/presentation` with `config.document_ids: ["d8-e603b929c10b"]` (a one-page slide of the sides, uploaded to the knowledge base), `slides_trigger: "on_demand"` (Julian shows the slide contextually at the cold read), and a `prompt` scoping it to that single page. There is **no** `canvas_show_text` / Magic Canvas tool and **no** separate scene-partner voice — the cold-read prompt was simplified to this. (The `magic_canvas` skill is still attached but every component is disabled and it's unused.)
- **Read mechanism**: prompt-driven, not a client `conversation.echo` runner. Every actor turn already triggers a replica turn, so Julian naturally delivers the next Nova line — an echo runner would collide with that. The exact scene + "read Nova verbatim, one line per turn, never read the captain's lines" lives in the system prompt's `## the cold read` section, which also has Julian open the read by pointing the actor to the on-screen sides and naming which lines are theirs (the one moment he references the screen).
- **Frontend rendering**: slides arrive as a `screenVideo` track on the replica participant (Daily). `MainVideo` in `src/components/video/components/conversation/index.tsx` uses `useScreenShare()` to find any active remote screen (state `playable`/`loading`) and, while one is live, renders `<DailyVideo type="screenVideo">` for that session with `object-fit: contain` as the main surface, while the replica's camera stays visible as a corner PiP (`.replicaPip`) so the interviewer never disappears mid-read; replica audio keeps playing throughout.
- **Dismissal**: the skill leaves the screen-share track published after the moment ends — it never drops it — so the **client gate is the only teardown**. `showPresentation` is true while `obj_coldread` is the active beat plus a short grace (`COLD_READ_SLIDE_GRACE_MS`) after it ends, then `MainVideo` drops back to the replica camera. The grace matters because `obj_coldread`'s objective prompt was tightened to **complete only after both captain lines are read** (it's auto-confirmed and used to advance after the first line, which yanked the slide mid-read); the grace absorbs completion-detection jitter so the actor's final line isn't clipped.
- Presentation is a preview feature; it must be enabled for your account on production (the app talks to prod only — see "Tavus API Base" below).

## Tavus API Base

All proxy handlers route through `TAVUS_API_BASE` exported from `api/_lib/handlers/tavus.ts`, which is **hardcoded to production** (`https://tavusapi.com`). It is not configurable and not an env var — every environment talks to prod.

## Key Conventions

- Hooks own state, components own rendering
- No API calls in components — use hooks or lib functions
- All Tavus API calls from browser go through /api/* proxies (which hit prod `https://tavusapi.com`, hardcoded in `api/_lib/handlers/tavus.ts`)
- TAVUS_API_KEY has no VITE_ prefix — never bundled into client
- Config files use _comment keys, stripped at runtime by loader.ts
- Inspector is data-pure: every value rendered in `DeveloperInspector` / `FloatingInspector` flows from props sourced from the Tavus API or live CVI events. No inline `DEFAULT_*` arrays populate the inspector columns.

## Typography

The app ships two self-hosted typefaces (no Google Fonts):
- **Suisse Intl** (Light / Regular / Medium / Semibold) — UI sans, used for headings, body, and most buttons. Files in `public/fonts/SuisseIntl-*.woff2`, declared in `src/styles.css`.
- **Berkeley Mono** — used for eyebrows, dev-tool labels, and the FloatingInspector chrome.

## Dev-Only Sample Answers

`persona/sample_answers.json` provides pre-canned actor replies keyed by `objective_name` (`intro` / `coldread` / `character` / `closing` — the lookup also tries the name with/without an `obj_` prefix). When a call is live, the FloatingInspector exposes an **Inject sample answer** button that looks up the active objective and sends the matching reply via a `conversation.respond` Daily app-message. This is purely a dev convenience for demoing.

## Tavus API Auth

All Tavus endpoints use `x-api-key` header (not Bearer token).

## Event Types (CVI)

Events arrive via `useDailyEvent("app-message")` from `@daily-co/daily-react`. The event payload is in `event.data` (may be a JSON string or parsed object).

- `conversation.objective.activated`     — objective started, has `properties.objective_name`
- `conversation.objective.completed`     — objective done, has `properties.objective_name` and `properties.output_variables`
- `conversation.tool_call`               — LLM tool fired, has `properties.name` (forwarded by `useToolCallEvents`)
- `conversation.perception_tool_call`    — Raven visual/audio tool fired, has `properties.name`
- `conversation.utterance`               — single-shot final-transcript event. We **do not** consume its speech text (the streaming event is authoritative); we only read the Raven awareness fields `user_visual_analysis` / `user_audio_analysis` that ride on user-role events.
- `conversation.utterance.streaming`     — progressive transcript for **both** user and replica. Has `properties.inference_id` (per-turn ID), `properties.role` (`"user"` | `"replica"`), `properties.text` (accumulated, not delta), `properties.final` (boolean). All transcript text in the app derives from this event. Reflects what was actually spoken (correct on interrupt). Ordered by the event's `seq` field (globally monotonic) so out-of-order arrivals still render chronologically.
- `conversation.perception-analysis`     — end-of-call, has `properties.analysis` (markdown)
- `conversation.respond`                 — outbound interaction emitted by the TranscriptPanel text input

## Scripts

- The persona (system prompt, objectives, guardrails, layers) is managed on Tavus directly (dashboard or API) — the deployed persona is the source of truth. There is no `create-persona` script and no local persona definition files; point `presets[0].persona_id` at a Tavus persona (or `npm run init` to copy a reference one).
- `npm run validate` — Validates config JSON against Zod schemas
- `npm run check-env` — Verifies required environment variables are set

Setup is just `cp .env.example .env`, fill in the keys, then `npm run dev` — there is no interactive bootstrap step.
