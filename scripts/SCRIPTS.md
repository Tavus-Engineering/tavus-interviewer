# Scripts

## What Lives Here

This folder contains Node.js scripts that run outside the browser — validation and setup tools. These are CLI tools you run with `npm run <script>`.

| Script | Command | What it does |
|--------|---------|-------------|
| `validate-config.ts` | `npm run validate` | Validates `config/*.json` files against Zod schemas and cross-file consistency |
| `check-env.ts` | `npm run check-env` | Validates required environment variables are set before dev server starts |

> **Setup**: Copy `.env.example` to `.env`, fill in the values, set `persona_id` / `replica_id` in `config/presets.config.json`, then run `npm run dev`. See the root `README.md` for the variable reference.

> **Personas are managed on Tavus directly.** The persona (system prompt, objectives, guardrails, layers) is created and edited via the [Tavus dashboard](https://platform.tavus.io/personas) or the Tavus API — the deployed persona is the source of truth. Point a preset's `persona_id` in `config/presets.config.json` at it. There is no local persona-deployment script.

## validate-config.ts — Config Validation

Validates `config/presets.config.json` against its Zod schema. Other persona-owned data (objectives, guardrails, perception queries) lives on the Tavus API and isn't validated here.

### What it does

1. Reads each config file
2. Strips `_` prefixed keys
3. Parses against the Zod schema defined in `src/lib/config/schema.ts`
4. Reports success or failure with error details
5. Exits with code 1 on failure (can be used as a pre-build check)

### What it catches

**Schema validation** (per-file):
- Missing required fields
- Wrong types (string where number expected, etc.)
- Empty arrays where at least one entry is required
- Structural mismatches

**Cross-file validation**:
- Duplicate preset IDs in `presets.config.json`

### When to modify

- You've added new fields to a config file — update the Zod schema in `src/lib/config/schema.ts` and the TypeScript types in `src/types/config.ts`
- You want to add additional cross-file checks

## check-env.ts — Environment Health Check

Validates that required environment variables are set before the dev server starts. Runs automatically as part of `npm run dev`.

### What it checks

| Variable | Required | Notes |
|----------|----------|-------|
| `TAVUS_API_KEY` | Yes | Must be set — see `.env.example` |

The persona and replica IDs are not env vars — they live in each preset's `persona_id`/`replica_id` in `config/presets.config.json`.

### When to modify

- You've added new required environment variables
- You want to add a connectivity check (e.g., ping the Tavus API)

## How Scripts Connect to Other Parts

- **`config/presets.config.json`** — `validate-config.ts` validates this file.
- **`src/lib/config/schema.ts`** — Zod schema shared between the validation script and the runtime config loader
- **`config/presets.config.json`** — holds each preset's `persona_id` / `replica_id`, pointing at a persona in your Tavus account

## Adding a New Script

1. Create the script in `scripts/`
2. Add an entry to `package.json` under `scripts`:
   ```json
   "your-script": "tsx scripts/your-script.ts"
   ```
3. The script can import from `src/` (like Zod schemas) — the `tsx` runner handles TypeScript

## Common Patterns

- **Tavus API calls**: Use `x-api-key` header, not Bearer token. The proxy handlers use the base URL from `TAVUS_API_BASE` (`api/_lib/handlers/tavus.ts`), hardcoded to prod `https://tavusapi.com`.
- **Stripping comments**: Scripts that read config JSON use the `stripComments` helper to remove `_` prefixed keys before parsing.
