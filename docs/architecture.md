# Architecture

## Overview

The AI Interviewer is a single-page React app that uses Tavus Conversational Video Interface (CVI) to conduct structured auditions. The architecture separates concerns into layers:

```
Browser                          Server (Vercel Serverless)          Tavus API
──────                           ──────────────────────────          ─────────
src/screens/*                    api/conversation/create.ts   →     POST /v2/conversations
  ↕                              api/conversation/end.ts      →     POST /v2/conversations/{id}/end
src/hooks/*
  ↕
src/components/cvi/*  ←→  @daily-co/daily-react (Daily.js)  ←→  Tavus CVI Events
```

## Data Flow

1. **LobbyScreen** — The entry screen: two-column customer intro + hair-check. Left column: welcome eyebrow ("Welcome in"), role heading ("You're auditioning for the {role}", role e.g. "Starfall Lead"), 10-minute description (naming Julian, the casting director, and Meridian Pictures), and the "I'm ready, let's play" CTA. Right column: live camera preview via a single `getUserMedia({video, audio})` call (one combined permission prompt), three device dropdowns (camera, microphone, audio output). The conversation is created on entry to this phase (an effect in `App.tsx` fires `useConversation.create()` when `phase === "LOBBY"`); the CTA shows "Connecting…" until ready. The audio tracks acquired during the permission prompt are stopped and removed before joining so Daily takes over device capture cleanly without re-prompting.
2. **InterviewScreen** — Mounts the CVI session inside a monochrome window-frame. The title bar renders a live `MM:SS / 10:00` timer that mirrors the server-enforced `max_call_duration: 600` and triggers an auto-leave at 10:00. The InteractionBus dispatches Daily.js `app-message` events to `useObjectiveEvents`, `usePerceptionAnalysis`, `useGuardrailEvents`, `useToolCallEvents`, and `useUtteranceEvents`. The 4-button CallControlBar (mic / camera / CC / End call) overlays the video; noise cancellation is applied automatically on `joined-meeting` (no user toggle). The TranscriptPanel sits beside the video as an in-flow flex item when CC is toggled — the video shrinks to make room — and houses the running transcript (selectable, with "Copy all") and a text-message input that emits `conversation.respond`. A right-docked, collapsible **FloatingInspector** panel always renders through a portal at `document.body`; it boots collapsed as a small terminal-style toggle and docks full-height against the right edge when expanded. Open/closed state and the active tab persist in localStorage under `ai-interviewer.dev-panel.v3`, but it always boots collapsed so it never covers the replica on entry.
3. **ResultsScreen** — Renders a thank-you card (the FSM's terminal phase): "That's a wrap. Thanks for playing." / "The casting team will sit with your tape and circle back. Go enjoy the rest of your day." A "View report" button opens the **ReportScreen** — an in-app casting report driven by the persona's `submit_audition_report` post-call action tool (Tavus AI fills it in after the call; the frontend reads it from the `application.post_call_action_executed` event via `useInterviewReport`), showing scores (Overall, Craft, Presence, Story structure), a summary, perception signals, a Story breakdown, transcript highlights, and a Markdown export. The FloatingInspector mounts in summary mode. Summary-mode inspector truth: objectives are tri-state (`done` / `active` / `not-reached`); the perception stream shows "awaiting" if Raven didn't capture any; the guardrails column header reads "Guardrails configured" (we don't track triggers).

## Key Principles

- **One screen, one file.** Screens consume hooks and pass data down as props
- **CVI plumbing lives under `src/components/video/`** (Daily.js wrappers, hooks, and the InteractionBus)
- **Hooks own state, components own rendering.** No API calls in components
- **API keys stay server-side.** The `api/` directory proxies all Tavus API calls
- **Persona is the source of truth.** Objectives, guardrails, and tools are fetched live from the Tavus API per persona; the frontend doesn't hardcode them. The Developer Inspector is data-pure — every value it renders flows from props sourced from the API or live CVI events.
- **Typography is self-hosted.** Suisse Intl (UI sans) lives under `public/fonts/SuisseIntl-*.woff2`; Berkeley Mono powers eyebrows and dev-tool chrome. No external font CDN.

## FSM States

```
LOBBY → INTRO → QUESTIONING → RESULTS
```

There is no SELECT phase and no custom-persona wizard — the active preset is read from `presets.config.json[0]` and rendered on the LobbyScreen (customer-facing copy + hair-check). The app boots directly into LOBBY. Transitions are owned by `useInterviewState`:

- LOBBY → INTRO        — user clicks "I'm ready" (conversation creation kicked off on entry to LOBBY)
- INTRO → QUESTIONING  — first `conversation.objective.completed` fires (intro objective wraps)
- QUESTIONING → RESULTS — user ends call OR `end_conversation` tool fires

RESULTS is the terminal phase. Phase changes are mirrored to the URL hash, so back/forward moves between phases (with INTRO/QUESTIONING blocked from popstate entry to avoid landing on an empty live screen).

## Conversation Properties

Conversations are always created with two `properties` flags set server-side in `api/_lib/handlers/conversation-create.ts`:

- `enable_closed_captions: true` — emits `conversation.utterance.streaming` events for **both** user and replica (per Tavus docs, this is the canonical event for both — it fires progressively per turn with `inference_id`, accumulated `text`, `role`, and a `final` flag, and reflects what was actually spoken so interruptions are handled correctly). Entries are sorted by Tavus' `seq` (globally monotonic) so out-of-order arrivals over the data channel still render chronologically. The single-shot `conversation.utterance` is kept only as a carrier for Raven awareness fields (`user_visual_analysis` / `user_audio_analysis`) — its speech payload is ignored.
- `max_call_duration: 600` — Tavus force-ends the call after 10 minutes. The InterviewScreen mirrors this with a `MM:SS / 10:00` timer in the title bar that runs a graceful leave at the same instant.

The Developer Inspector is always rendered as a right-docked, collapsible **FloatingInspector** panel (`src/components/layout/FloatingInspector.tsx`) — portaled to `document.body`, not an inline panel — so the actor-facing layout stays untouched. It boots collapsed as a small terminal-style toggle so it never covers the replica; expanded, it docks full-height against the right edge. It has three zones: an always-visible Live State vitals strip, an Inspector tab (objectives / guardrails / tools / Perception · Raven), and an Events tab (severity-colored CVI event console). Open/closed state and active tab persist in localStorage under `ai-interviewer.dev-panel.v3`.
