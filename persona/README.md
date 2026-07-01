# PAL

The Tavus PAL — system prompt, objectives, guardrails, perception (Raven), and conversational flow (Sparrow) — is **managed directly on Tavus** (the [dashboard](https://maker.tavus.io/dev/pals) or the Tavus API). The deployed PAL is the single source of truth; there are no local PAL definition files in this repo.

To use a PAL, point a preset's `persona_id` (and optional `replica_id`) in `config/presets.config.json` at it. The frontend fetches the PAL's objectives, guardrails, and tools live from the Tavus API at runtime — there's nothing local to keep in sync.

- Guardrails: [Tavus Guardrails guide](https://docs.tavus.io/sections/conversational-video-interface/guardrails). How the app *reacts* to a triggered guardrail (face speaks / toast / inspector-only) is configured in `src/lib/guardrailActions.ts`.
- Objectives: [Tavus Objectives guide](https://docs.tavus.io/sections/conversational-video-interface/pal/objectives).

## Files

| File | Purpose |
|------|---------|
| `sample_answers.json` | Dev-only canned actor replies, keyed by `objective_name`. Powers the FloatingInspector's "Inject sample answer" button during a live call. Not sent to Tavus. |
