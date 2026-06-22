# Persona

The Tavus persona — system prompt, objectives, guardrails, perception (Raven), and conversational flow (Sparrow) — is **managed directly on Tavus** (the [dashboard](https://platform.tavus.io/personas) or the Tavus API). The deployed persona is the single source of truth; there are no local persona definition files in this repo.

To use a persona, point a preset's `persona_id` (and optional `replica_id`) in `config/presets.config.json` at it. The frontend fetches the persona's objectives, guardrails, and tools live from the Tavus API at runtime — there's nothing local to keep in sync.

- Guardrails: [Tavus Guardrails guide](https://docs.tavus.io/sections/conversational-video-interface/guardrails). How the app *reacts* to a triggered guardrail (replica speaks / toast / inspector-only) is configured in `src/lib/guardrailActions.ts`.
- Objectives: [Tavus Objectives guide](https://docs.tavus.io/sections/conversational-video-interface/persona/objectives).

## Files

| File | Purpose |
|------|---------|
| `sample_answers.json` | Dev-only canned actor replies, keyed by `objective_name`. Powers the FloatingInspector's "Inject sample answer" button during a live call. Not sent to Tavus. |
