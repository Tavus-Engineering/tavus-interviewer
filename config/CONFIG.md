# Config

## What Lives Here

This folder holds the **frontend configuration** — the file that tells the web application which preset to surface. This is separate from the persona definition (managed on Tavus and sent to its API). Config files never leave the browser; they're imported at build time and used by React hooks and components.

There is one config file:

| File | Purpose |
|------|---------|
| `presets.config.json` | Preloaded audition presets shown in the lobby |

Anything that lives on the persona — objectives, guardrails, perception queries, role description — is fetched at runtime from the Tavus API via `/api/persona/*` proxies. There is intentionally no local copy of that data here, because a stale duplicate is a bug magnet.

## presets.config.json

Defines the preloaded audition presets shown in the lobby. Each preset maps to a Tavus persona and replica that already exist in your account.

```json
{
  "presets": [
    {
      "id": "starfall-lead-audition",
      "title": "Starfall Lead",
      "description": "A loose, playful casting audition for the lead in Starfall, a new sci-fi series — a few quick beats and a little improv with Julian, our AI casting director.",
      "icon": "film",
      "persona_id": "p735435f8c36",
      "replica_id": "r92debe21318",
      "default_persona_id": "p735435f8c36"
    }
  ]
}
```

### Fields

| Field | What it does |
|-------|-------------|
| `id` | Unique identifier for the preset. Must be unique across all presets. |
| `title` | Display name shown in the lobby — also used as the role name throughout the UI. |
| `description` | Body text describing the audition. Used in the lobby copy. |
| `icon` | Icon key (kept for forward-compat; not currently rendered). |
| `persona_id` | The Tavus persona ID to use for this audition. Drives objectives, guardrails, and perception. |
| `replica_id` | The Tavus replica ID to use for this audition. |
| `default_persona_id` | Optional. Reference persona that `npm run init` copies into your Tavus account; leave it as shipped unless you want a different reference. |

### Adding or Swapping Presets

The app currently uses `presets[0]` as the single active preset (its `title` becomes the role rendered on the LobbyScreen and InterviewScreen). To add or replace one:

1. Create a persona in the [Tavus dashboard](https://platform.tavus.io/personas) (or `npm run init` to copy a reference one)
2. Add the resulting `persona_id` and `replica_id` to a new entry (or replace an existing one)
3. Run `npm run validate` to verify the file

## Where Persona-Owned Data Lives

| Concept | Source | How the frontend gets it |
|---------|--------|--------------------------|
| Role / audition title | `presets.config.json` → `title` | Read at build time |
| Objective list + labels | Persona → `objectives_id` → objectives | `GET /api/persona/objectives` (labels are humanized from `objective_name` server-side) |
| Guardrails | Persona → `guardrails_id` **or** `guardrail_ids` → guardrails | `GET /api/persona/guardrails` (uses `guardrails_id` if present, else fetches each id in `guardrail_ids`) |
| Perception queries | Persona → `layers.perception` | `GET /api/persona/tools` (and the live `conversation.perception-analysis` event for end-of-call results) |

If you need to change any of those, edit the persona in the Tavus dashboard (or via the Tavus API). Don't add a local override here.

## How Config Connects to Other Parts

- **`presets.config.json`** defines the preloaded auditions. `App.tsx` reads `presets[0]` at build time as the active preset and passes `preset.title` down to the lobby/audition screens as the role name.
- **`src/lib/config/loader.ts`** imports the presets config JSON, strips `_comment` fields, and validates it against the Zod schema. If your config is malformed, the app won't build.
- **`src/lib/config/schema.ts`** defines the Zod validation schemas. If you add new fields to the config, update the schema too.

## Common Mistakes

- **Persona ID points to a persona that no longer exists** — the API call to fetch objectives will fail and the inspector will show an empty objective list. Verify the persona is still live in the Tavus dashboard.
- **Adding `_comment` fields without `_` prefix** — The loader strips keys starting with `_`. If you use `comment` instead of `_comment`, Zod validation will reject the unknown field.
