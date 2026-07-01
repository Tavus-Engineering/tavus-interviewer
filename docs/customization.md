# Customization Guide

## Changing the Interview Role

The role shown in the UI is the `title` field of the active entry in `config/presets.config.json`:

```json
{
  "id": "senior-frontend-engineer",
  "title": "Senior Frontend Engineer",
  "description": "Practice a structured interview covering...",
  "icon": "engineer",
  "persona_id": "p…",
  "replica_id": "r…"
}
```

The role lives on the preset (and, on the PAL side, in the PAL's system prompt). There is no separate role-config file in the repo.

## Adding/Removing Questions

Questions are defined as objectives on the PAL — not in this repo's config files. Edit the PAL's objectives in the [Tavus dashboard](https://maker.tavus.io/dev/pals) (or via the Tavus API).

The frontend fetches objectives from the Tavus API at runtime via `GET /api/persona/objectives`. Labels in the inspector are humanized from `objective_name` automatically.

## Customizing Guardrails

Guardrails are managed directly on the PAL — via the Tavus dashboard or the [Guardrails API](https://docs.tavus.io/api-reference/guardrails/create-guardrails) — and the deployed PAL is the source of truth. Create each guardrail (`POST /v2/guardrails`) and attach it to the PAL via `guardrail_ids` / `guardrail_tags`. Each guardrail has:
- `guardrail_name` — unique identifier (alphanumeric + underscores)
- `guardrail_prompt` — the behavioral rule
- `modality` — `"verbal"` or `"visual"`

How the app *reacts* to a triggered guardrail (face speaks / toast / inspector-only) is decided per guardrail in `src/lib/guardrailActions.ts`.

## Perception Queries

Perception queries live on the PAL — edit them in the Tavus dashboard (or via the Tavus API). There is no local mirror.

- **perception_analysis_queries** — End-of-call analysis, surfaced via the `conversation.perception-analysis` event and shown on ResultsScreen
- **visual_awareness_queries** — Real-time visual awareness, fed to the LLM during conversation
- **audio_awareness_queries** — Real-time audio awareness, fed to the LLM during conversation

The end-of-call analysis is rendered directly from the markdown returned by Tavus — no client-side label mapping required.

## Changing the Preloaded Interviewers

Edit `config/presets.config.json` — the app currently uses `presets[0]` as the single active interview, and `preset.title` becomes the role rendered on the LobbyScreen and InterviewScreen. Each preset needs a `persona_id` and `replica_id` (create PALs in the [Tavus dashboard](https://maker.tavus.io/dev/pals)). See [CONFIG.md](../config/CONFIG.md) for field details.

## Typography

The app self-hosts **Suisse Intl** (UI sans, four weights in `public/fonts/SuisseIntl-*.woff2`) and **Berkeley Mono** (used for eyebrows and the FloatingInspector chrome). Both are declared via `@font-face` in `src/styles.css` — swap the WOFF2 files (or replace the `@font-face` declarations) to rebrand the typography stack. No external font CDN is loaded.

## Sample Answers (dev-only)

`persona/sample_answers.json` maps objective names to pre-canned actor replies (the current file holds audition answers keyed `intro` / `coldread` / `character` / `closing` — the lookup also tries each name with/without an `obj_` prefix). The FloatingInspector renders an "Inject sample answer" button during the live call that sends the matching reply via `conversation.respond` — handy when demoing the conversation flow without having to actually talk through every objective. Edit the JSON to tune the demo answers.

## Changing the Face

Update the preset's `replica_id` in `config/presets.config.json` with the new face ID from [maker.tavus.io/dev/faces](https://maker.tavus.io/dev/faces). This overrides the PAL's `default_replica_id` for that preset.
