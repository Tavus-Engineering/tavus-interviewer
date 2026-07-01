# End-to-End Walkthrough

This guide traces the complete flow from first clone to a finished audition with results. Follow it step-by-step to see the entire system working before you start customizing.

## 1. Install and Set Up

```bash
git clone https://github.com/YOUR_USERNAME/tavus-interviewer.git
cd tavus-interviewer
npm install
cp .env.example .env
```

Open `.env` and fill in the values:

| Variable | Required | What it is | Where to get it |
|---|---|---|---|
| `TAVUS_API_KEY` | Yes | Server-side Tavus API key | [maker.tavus.io/dev/api-keys](https://maker.tavus.io/dev/api-keys) |

The PAL and face IDs are not env vars — they live in each preset's `persona_id`/`replica_id` in `config/presets.config.json`.

The role shown in the UI comes from the active preset's `title` in `config/presets.config.json`, or from the PAL on the Tavus API at runtime — no role file is written to disk.

## 2. Configure the PAL

The PAL — system prompt, objectives, guardrails, perception (Raven) queries, turn-taking (Sparrow) — is created and edited in the [Tavus dashboard](https://maker.tavus.io/dev/pals) or via the Tavus API. The deployed PAL is the source of truth; there are no local PAL definition files. Point the preset's `persona_id` in `config/presets.config.json` at it (or run `npm run init` to copy a reference PAL into your account and have its ID written for you). The app fetches the PAL's objectives, guardrails, and tools live at runtime.

## 3. Validate Configuration

```bash
npm run validate
```

This runs two passes:

**Schema validation** — checks each config file against its Zod schema (`src/lib/config/schema.ts`):
- Required fields present
- Correct types
- Non-empty arrays

**Cross-file validation** — sanity checks across files:
- Preset IDs are unique within `presets.config.json`

## 4. Start the Dev Server

```bash
npm run dev
```

This chains three checks before Vite starts:
1. `check-env` — verifies `.env` has `TAVUS_API_KEY`
2. `validate` — runs schema + cross-file validation on config files
3. `vite` — starts the development server

The Vite dev server serves the React SPA. The `api/` directory maps to Vercel-style serverless functions (in production) or is proxied by Vite in dev mode.

## 5. The Interview Flow (What Happens at Runtime)

### LobbyScreen

- The entry screen. The PAL's objectives, guardrails, and tools are fetched in parallel via the `usePersonaObjectives` / `usePersonaGuardrails` / `usePersonaTools` hooks in `App.tsx` as the app boots.
- Two-column customer intro + hair-check. Left column: welcome eyebrow ("Welcome in"), role heading ("You're auditioning for the {role}", role e.g. "Starfall Lead"), 10-min description (naming Julian, the casting director, and Meridian Pictures), and the "I'm ready, let's play" CTA. Right column: live camera preview + device pickers (Camera / Microphone / Audio output via `DeviceSelectorBar`).
- Live camera preview via a single `getUserMedia({video, audio})` call (no Daily call yet at this stage). Both video and audio are requested in one shot so the browser shows a single combined permission prompt; the audio tracks are stopped and removed immediately afterwards so Daily can claim mic capture without re-prompting on join.
- Conversation creation is triggered on entry to the LOBBY phase (the effect in `App.tsx` fires once `phase === "LOBBY"`, i.e. on boot). The CTA shows "Connecting..." until the create call resolves.
- On "I'm ready", the app calls `POST /api/conversation/create`
  - The handler reads `TAVUS_API_KEY` from server env, forwards to `POST /v2/conversations`, and merges in `properties.enable_closed_captions: true` + `properties.max_call_duration: 600` (10-minute server-enforced cap)
  - Returns `conversation_url` and `conversation_id` to the browser

### InterviewScreen

- Mounts the CVI session via `@daily-co/daily-react` (DailyProvider + scaffolded ConversationView)
- The face appears and the audition begins
- **FSM transitions**: `INTRO → QUESTIONING` (first objective completes) and eventually `→ RESULTS` (user ends call, `end_conversation` tool fires, or the 10-minute timer hits the cap)
- The title bar shows a live `MM:SS / 10:00` timer; at 10:00 the UI triggers a graceful leave at the same instant Tavus force-ends the call via `max_call_duration: 600`
- As each objective completes, CVI fires `conversation.objective.completed` events. The FloatingInspector overlay flips entries from pending → active → done.
- The 4-button CallControlBar overlays the video: mic, camera, CC (toggles the TranscriptPanel), End call. No red destructive variant for End call.
- The TranscriptPanel sits beside the video as an in-flow flex item when CC is toggled — the video shrinks to make room (no overlay). Per Tavus docs, both user and face text come from `conversation.utterance.streaming` (progressive per-turn, keyed by `inference_id`, accumulated text replaces in place so interruptions display correctly). Entries are ordered by Tavus' `seq` (globally monotonic). The transcript is selectable, has a "Copy all" button next to the close ×, and an inline text input emits a `conversation.respond` interaction.
- Raven perception runs in the background:
  - Ambient awareness queries feed real-time observations to the LLM
  - Perception analysis queries run end-of-call and produce structured analysis (shown in the Developer Inspector's summary mode)
- The **FloatingInspector** always mounts as a right-docked, collapsible dev panel (portaled to `document.body`). It boots collapsed as a small terminal-style toggle so it never covers the face; expanded, it docks full-height against the right edge with three zones: an always-visible Live State vitals strip (status / elapsed / speaker / objective progress / guardrail counter), an Inspector tab wrapping the `DeveloperInspector` (header → divider → columns: Objectives / Guardrails / Perception · Raven), and an Events tab (severity-colored CVI event console). Awareness streams into the Raven column as each `conversation.utterance` arrives. Open/closed state and active tab persist in localStorage under `ai-interviewer.dev-panel.v3`. An "Inject sample answer" button reads `persona/sample_answers.json` keyed by the active objective and sends a `conversation.respond` (dev-only convenience).

### ResultsScreen

- The app calls `POST /api/conversation/end` to end the CVI session
- `usePerceptionAnalysis` parses the `conversation.perception-analysis` event into structured observations (shown in the inspector's summary mode)
- The card shows a thank-you message ("That's a wrap. Thanks for playing." / "The casting team will sit with your tape and circle back. Go enjoy the rest of your day.") plus a "View report" button into the **ReportScreen** — an in-app casting report. The report is driven by the PAL's `submit_audition_report` post-call action tool (Tavus AI fills it in after the call; the frontend reads it from the `application.post_call_action_executed` event via `useInterviewReport`). It shows scores (Overall, Craft, Presence, Story structure), a summary, perception signals over time, a Story breakdown, transcript highlights, and a Markdown export.
- The FloatingInspector renders in summary mode reflecting post-call truth: objectives use a tri-state (`done` / `active` / `not-reached`); the guardrails column reads "Guardrails configured" (we don't track triggers); the Raven stream shows "awaiting" if no observations were captured.

## 6. Deployment

The app is designed for [Vercel](https://vercel.com):

1. Push to GitHub
2. Import the repo in Vercel
3. Set environment variables in the Vercel dashboard:
   - `TAVUS_API_KEY`

   The `persona_id`/`replica_id` ship in the committed `config/presets.config.json`, so they are not deployment env vars.
4. Deploy — Vercel automatically maps `api/*.ts` to serverless functions

For other platforms, adapt `api/*.ts` to your serverless runtime or wrap them in an Express server.

```bash
npm run build    # Type-checks and builds the production bundle
npm run preview  # Preview the production build locally
```

## 7. Adapting for a New Use Case

The fastest path:

```bash
# Edit the PAL in the Tavus dashboard, then point the preset at it
# (set persona_id / replica_id in config/presets.config.json)
npm run validate
npm run dev
```

For a detailed guide on what to change and where, see [customization.md](customization.md).
