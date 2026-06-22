# Tavus Features Used

## CVI (Conversational Video Interface)

The core real-time video conversation is powered by Tavus CVI, which uses Daily.js under the hood for WebRTC transport.

- **Component Library**: `@daily-co/daily-react` provides `DailyProvider`, `useDailyEvent`, and video components
- **Custom Hooks**: `use-call`, `use-local-screenshare`, `use-replica-ids` (in `src/components/video/hooks/`)

## Replicas + Personas

A persona bundles system prompt + objectives + guardrails + perception + tool layers. A replica supplies the face and voice. The frontend never creates personas at runtime — they're referenced from a preset in `config/presets.config.json` (whose `persona_id` points at a persona created in the [Tavus dashboard](https://platform.tavus.io/personas) or via the Tavus API). The deployed persona is the source of truth.

## Objectives

Structured interview questions are modeled as Tavus Objectives. Each objective has:
- A prompt that guides the replica
- `confirmation_mode: "auto"` — the replica decides when an objective is satisfied
- `output_variables` — extracted data passed back in the completion event
- `next_required_objective` — enforces question ordering

API: `POST /v2/objectives`

## Guardrails

Behavioral constraints that prevent the replica from deviating:
- No grading disclosure
- No answer assistance
- Stay on topic
- Resist prompt injection

API: `POST /v2/guardrails` (creation), `GET /v2/guardrails/{id}` (read).
The frontend reads the live list via `GET /api/persona/guardrails` and renders it in the FloatingInspector — no hardcoded list, no synthetic fallback. `useGuardrailEvents` humanizes labels from the live `guardrail_name` and matches perception tool calls to visual guardrails by fuzzy name; no guardrail names or labels are hardcoded.

## LLM Tools

Tool functions exposed to the persona's LLM layer (`layers.llm.tools`). When the LLM invokes a tool, a `conversation.tool_call` event fires with the tool name. `useToolCallEvents` forwards the name into the FSM. The interviewer's hero features are awareness queries rather than a column of LLM tools, so the Inspector dropped the legacy "Variables captured" / "LLM Tools" column. The `end_conversation` tool, when present, doubles as the explicit signal to end the call.

## Presentation Skill (on-screen slides)

The persona's **presentation** skill puts a slide on screen mid-call, and it drives the **cold read** (`obj_coldread`). When the cold read begins, Julian brings the Starfall "sides" up on screen; he reads Nova's lines himself (a casting director reading the other part) while the actor reads the captain's lines.

- Attached on the persona via `PUT /v2/personas/{persona_id}/skills/presentation` with `config.document_ids: ["d7-99911a5a81a6"]` (a one-page PDF of the sides in the knowledge base), `slides_trigger: "on_demand"` (the slide appears contextually at the cold read rather than as a guided deck walk), and a `prompt` scoping it to that single page.
- Slides are delivered as a `screenVideo` track on the replica participant over Daily — there is no separate event to subscribe to. The `Conversation` component (`src/components/video/components/conversation/index.tsx`) uses `useScreenShare()` to detect an active remote screen (state `playable`/`loading`) and renders `<DailyVideo type="screenVideo">` (`object-fit: contain`) while one is live, falling back to the replica camera otherwise.
- The skill keeps the screen-share track published after the moment ends — it never drops it — so the client gate is the only teardown. `InterviewScreen` shows the slide while `obj_coldread` is the active beat plus a short grace, then returns to the replica camera. `obj_coldread`'s objective prompt is tightened to complete only after **both** captain lines are read (it's auto-confirmed and otherwise advances after the first line, dropping the slide mid-read); the grace absorbs completion jitter so the last line isn't clipped.
- The scene read is **prompt-driven** (the replica voices Nova, the human voices the captain) — see the system prompt's `## the cold read` section. There's no separate Nova voice and no client `conversation.echo` runner.
- Preview feature — must be enabled for your account on production (the app talks to prod only).

## Perception (Raven)

Raven is Tavus's perception model. It analyzes visual + audio input across three pathways:

| Pathway | When | Use |
|---|---|---|
| `visual_awareness_queries` | Continuously | Replica reacts to visual cues |
| `audio_awareness_queries`  | Continuously | Replica senses tone/delivery |
| `perception_analysis_queries` | Once, end of call | Post-call analysis (shown in the Developer Inspector's summary mode) |
| `visual_tools`             | Triggered    | Tool functions Raven invokes when a visual condition matches → `conversation.perception_tool_call` |
| `audio_tools`              | Triggered    | Tool functions Raven invokes on audio matches |

`perception_model` is one of `raven-1`, `raven-0`, or `off`. The FloatingInspector reads the live value via `GET /api/persona/tools`; the Raven awareness stream dims to a "disabled" placeholder when the model is `off`.

The end-of-call analysis arrives as a single `conversation.perception-analysis` event — markdown that `formatSummary.parsePerceptionAnalysis` splits into structured observations.

## Closed Captions / Live Transcription

Conversations are created with `enable_closed_captions: true` (set in `api/_lib/handlers/conversation-create.ts`). With that flag, Tavus emits two utterance event types:

- `conversation.utterance` (role=user) — single final event when the user stops speaking, carries `text` and Raven awareness fields (`user_visual_analysis`, `user_audio_analysis`)
- `conversation.utterance.streaming` (role=replica) — progressive events while the replica speaks. Each chunk has an `inference_id` (per-turn ID), `text` (accumulated, not delta), and `final` (boolean). Subsequent chunks for the same `inference_id` REPLACE the existing entry's text in `useUtteranceEvents`, so the displayed text reflects what was actually spoken (correctly truncated if the user interrupts).

`useUtteranceEvents` merges both paths into a single transcript. The TranscriptPanel renders it as an in-flow flex item beside the video — the video shrinks when CC is open (no overlay). The transcript is user-selectable and has a "Copy all" button.

## Call Duration Cap

Conversations are also created with `properties.max_call_duration: 600` (in seconds). Tavus force-ends the call after 10 minutes server-side. The InterviewScreen mirrors the cap with a live `MM:SS / 10:00` timer in the title bar and triggers a graceful leave at 10:00 so the UI ends cleanly at the same moment.

## Text Input

Inside the TranscriptPanel, the user can type a message. The panel emits a `conversation.respond` interaction via `daily.sendAppMessage`, and the replica handles it as if the user had spoken.

## Noise Cancellation

Daily's audio processor is set to `noise-cancellation` automatically on `joined-meeting` via a `daily.updateInputSettings` call mounted in the CallControlBar. There is no user-facing toggle — noise cancellation is applied silently as the desired default for the entire call.

## Conversational Flow (Sparrow)

Turn-taking is managed by Sparrow:
- `turn_detection_model: "sparrow-1"`
- `turn_taking_patience: "medium"` — how long the replica waits before speaking
- `replica_interruptibility: "medium"` — how easily the user can interrupt

## Tavus API Base

The proxy handlers fetch from `TAVUS_API_BASE` (exported from `api/_lib/handlers/tavus.ts`), which is hardcoded to production (`https://tavusapi.com`). It is not configurable and not an env var.

## Event Types

| Event | When | Payload |
|---|---|---|
| `conversation.objective.activated`     | Objective begins | `{ objective_name }` |
| `conversation.objective.completed`     | Objective satisfied | `{ objective_name, output_variables }` |
| `conversation.tool_call`               | LLM tool fires | `{ name, arguments }` |
| `conversation.perception_tool_call`    | Raven visual/audio tool fires | `{ name, modality, arguments, frames? }` |
| `conversation.utterance`               | Final user speech transcript (requires `enable_closed_captions: true`); fires once when the user stops speaking | `{ role: "user", text, user_visual_analysis?, user_audio_analysis? }` |
| `conversation.utterance.streaming`     | Progressive replica speech (requires `enable_closed_captions: true`); fires repeatedly per turn | `{ inference_id, text, final, content_index? }` |
| `conversation.perception-analysis`     | Once, end of call | `{ analysis: string }` (markdown) |
| `conversation.respond`                 | Outbound — sent by the TranscriptPanel text input | `{ text }` |
