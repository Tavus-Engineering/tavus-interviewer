# API Proxy Layer

## What Lives Here

This folder contains the API route handlers and platform adapters that proxy requests from the browser to the Tavus API. The browser never talks to Tavus directly — every API call goes through these proxies. This keeps the `TAVUS_API_KEY` on the server and out of the client bundle.

## Architecture

The API layer is split into two parts:

### 1. Shared Handlers (`api/_lib/handlers/`)

Platform-agnostic functions that contain all the business logic. Each handler takes a simple `{ method, body, query }` object and returns `{ status, body }`. They have no dependency on any specific runtime (Vercel, Express, Cloudflare, etc.).

```
api/_lib/
├── vercel.ts                     # VercelRequest / VercelResponse types (no @vercel/node dep)
├── vite-plugin.ts                # Vite dev-server adapter (mounts handlers as middleware)
└── handlers/
    ├── types.ts                  # RouteRequest / RouteResponse interfaces
    ├── index.ts                  # Route registry (path → handler map)
    ├── tavus.ts                  # Shared TAVUS_API_BASE (hardcoded prod URL)
    ├── conversation-create.ts    # POST /api/conversation/create
    ├── conversation-end.ts       # POST /api/conversation/end
    ├── conversation-get.ts       # GET  /api/conversation/get (verbose — carries post-call events)
    ├── post-call-result.ts       # POST /api/conversation/post-call-result (report delivery sink, returns 200)
    ├── PAL-objectives.ts     # GET /api/persona/objectives
    ├── PAL-guardrails.ts     # GET /api/persona/guardrails
    └── PAL-tools.ts          # GET /api/persona/tools
```

> **Why `_lib/`?** Vercel turns *every* file under `api/` into its own Serverless Function — but Vercel ignores any file or folder whose name starts with `_`. The shared handlers, the route registry, the Vite plugin, and the type files are **not** endpoints, so they live under `api/_lib/` to keep them from being deployed as functions. If you move them back up to `api/` (e.g. `api/handlers/`), Vercel will deploy ~17 functions instead of 7 — that exposes the handler internals as public routes, bundles the Vite dev plugin into a deployed function, and **blows past the 12-function limit on Vercel's Hobby tier, breaking the one-click deploy.** Keep non-endpoint code under `_lib/`.

### 2. Platform Adapters

Thin wrappers that convert platform-specific request/response types to/from the shared handler interface. Only these are real endpoints — one file per route, each with a `default` export.

- **Vite dev plugin** (`api/_lib/vite-plugin.ts`) — Mounts handlers as Vite dev server middleware. Used during `npm run dev`. No separate backend process needed.
- **Vercel adapters** (`api/conversation/`, `api/persona/`) — Thin wrappers for Vercel serverless deployment. Each file imports a shared handler and converts `VercelRequest`/`VercelResponse`. There is one adapter per frontend-called route: `conversation/{create,end,get,post-call-result}`, `persona/{objectives,guardrails,tools}`.

## Why This Pattern

The Tavus API authenticates with an `x-api-key` header. If you put that key in the browser (even via `VITE_` environment variables), anyone can extract it from the bundle. The proxy pattern solves this:

```
Browser  →  /api/conversation/create  →  Server-side handler  →  Tavus API
                (no API key)              (adds API key)          (authenticated)
```

By splitting handlers from adapters, the same logic works everywhere:

- **Local dev**: Vite plugin serves `/api/*` routes directly — no separate backend
- **Vercel**: each non-`_`-prefixed file in `api/` auto-deploys as a serverless function (shared code lives under `api/_lib/` so it isn't deployed as functions — see "Why `_lib/`?" above)
- **Other platforms**: Write a thin adapter (see "Adding a New Platform" below)

## How It Works in Development

When you run `npm run dev`, the Vite plugin (`api/_lib/vite-plugin.ts`) registers middleware on the dev server. Any request to `/api/*` is intercepted, matched against the route registry, and handled by the corresponding shared handler — all within the same Vite process. The `.env` file is loaded by Vite automatically.

No separate backend server, no `localhost:3001`, no Docker. Just `npm run dev`.

## Current Endpoints

| Route | Method | Handler | Tavus Endpoint | Purpose |
|-------|--------|---------|---------------|---------|
| `/api/conversation/create` | POST | `conversation-create.ts` | `POST /v2/conversations` | Start a new CVI conversation. Accepts optional `persona_id` / `replica_id`; always sets `properties.enable_closed_captions: true` (so `conversation.utterance` + `conversation.utterance.streaming` events flow to the TranscriptPanel) and `properties.max_call_duration: 600` (10-minute server-enforced cap; the UI mirrors it with an `MM:SS / 10:00` title-bar timer) |
| `/api/conversation/end` | POST | `conversation-end.ts` | `POST /v2/conversations/{id}/end` | End an active conversation |
| `/api/conversation/get` | GET | `conversation-get.ts` | `GET /v2/conversations/{id}?verbose=true` | Fetch a conversation verbosely so the response includes `events[]` — including `application.post_call_action_executed`, which carries the post-call report tool's rendered request body. `useInterviewReport` polls this to read back the casting report |
| `/api/conversation/post-call-result` | POST | `post-call-result.ts` | — (no Tavus call) | Delivery sink for the PAL's `submit_audition_report` post-call action tool; returns `200 { received: true }`. The app reads the report from the conversation event (verbose GET above), not from this endpoint |
| `/api/persona/objectives` | GET | `persona-objectives.ts` | `GET /v2/personas/{id}` → `GET /v2/objectives/{id}` | Fetch PAL's objectives in `next_required_objective` chain order |
| `/api/persona/guardrails` | GET | `persona-guardrails.ts` | `GET /v2/personas/{id}` → `GET /v2/guardrails/{id}` | Fetch the PAL's guardrail definitions (name + prompt + modality). Supports both shapes: legacy single `guardrails_id` (one `GET /v2/guardrails/{guardrails_id}` returning `{ data: [...] }`) and the current `guardrail_ids` array (one `GET /v2/guardrails/{id}` per id, failed ids dropped) — the casting PAL uses the `guardrail_ids` array |
| `/api/persona/tools` | GET | `persona-tools.ts` | `GET /v2/personas/{id}` | Returns `{ llmTools, visualTools, audioTools, perceptionModel }` extracted from `layers.llm.tools` + `layers.perception.{visual,audio}_tools` + `layers.perception.perception_model` |

> There is no **synchronous** analyze endpoint — no `/api/interview/analyze` that returns a report on demand. The casting report is instead produced by the PAL's `submit_audition_report` post-call action tool: after the call, Tavus fills the tool's fields from the transcript and POSTs them to `/api/conversation/post-call-result` (which just returns `200`), and also records the rendered request on the conversation as an `application.post_call_action_executed` event. The frontend reads the report from that event by polling `GET /api/conversation/get?...` (verbose) — see `src/hooks/useInterviewReport.ts`. Separately, Raven's end-of-call perception analysis arrives client-side via the `conversation.perception-analysis` event and is rendered in the Developer Inspector's summary mode.

## Tavus API Base URL

All proxy handlers fetch from a shared base URL exported by `api/_lib/handlers/tavus.ts`:

```typescript
export const TAVUS_API_BASE = "https://tavusapi.com";
```

It is hardcoded to production and is not configurable — every environment talks to prod.

## How a Shared Handler Works

Every handler follows the same pattern — pure function in, plain object out:

```typescript
import type { RouteRequest, RouteResponse } from "./types.js";
import { TAVUS_API_BASE } from "./tavus.js";

export async function myHandler(req: RouteRequest): Promise<RouteResponse> {
  const apiKey = process.env.TAVUS_API_KEY;
  if (!apiKey) {
    return { status: 500, body: { error: "TAVUS_API_KEY not configured" } };
  }

  const response = await fetch(`${TAVUS_API_BASE}/v2/...`, {
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(req.body),
  });

  const data = await response.json();
  return { status: response.status, body: data };
}
```

## How to Add a New Endpoint

### Step 1: Create the shared handler

Create `api/_lib/handlers/my-handler.ts` following the pattern above.

### Step 2: Register the route

Add the handler to `api/_lib/handlers/index.ts`:

```typescript
import { myHandler } from "./my-handler.js";

export const routes: Record<string, RouteHandler> = {
  // ... existing routes
  "/api/my/route": myHandler,
};
```

This automatically makes it available in the Vite dev server.

### Step 3: Add a Vercel adapter (if deploying to Vercel)

Create `api/my/route.ts`:

```typescript
import type { VercelRequest, VercelResponse } from "../_lib/vercel.js";
import { myHandler } from "../_lib/handlers/my-handler.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await myHandler({
    method: req.method ?? "GET",
    body: req.body,
    query: req.query as Record<string, string>,
  });
  return res.status(result.status).json(result.body);
}
```

### Step 4: Add a typed client function

In `src/lib/tavus/`, create a function that the frontend hook will call:

```typescript
export async function myFunction() {
  const res = await fetch("/api/my/route");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
```

### Step 5: Use it from a hook

Call the function from a React hook — never from a component directly.

## Adding a New Platform

To deploy on a platform other than Vercel, write an adapter that converts the platform's request/response to `RouteRequest`/`RouteResponse`.

### Netlify Functions

```typescript
// netlify/functions/conversation-create.ts
import { conversationCreate } from "../../api/_lib/handlers/conversation-create.js";

export async function handler(event) {
  const result = await conversationCreate({
    method: event.httpMethod,
    body: JSON.parse(event.body ?? "{}"),
    query: event.queryStringParameters ?? {},
  });
  return { statusCode: result.status, body: JSON.stringify(result.body) };
}
```

### Express

```typescript
import express from "express";
import { routes } from "./api/_lib/handlers/index.js";

const app = express();
app.use(express.json());

for (const [path, handler] of Object.entries(routes)) {
  app.all(path, async (req, res) => {
    const result = await handler({
      method: req.method,
      body: req.body,
      query: req.query as Record<string, string>,
    });
    res.status(result.status).json(result.body);
  });
}
```

### Cloudflare Workers

```typescript
import { routes } from "./api/_lib/handlers/index.js";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const handler = routes[url.pathname];
    if (!handler) return new Response("Not found", { status: 404 });

    const body = request.method !== "GET" ? await request.json() : undefined;
    const query = Object.fromEntries(url.searchParams);
    const result = await handler({ method: request.method, body, query });

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  },
};
```

## How the API Layer Connects to Other Parts

- **Frontend hooks** (`src/hooks/useConversation.ts`, `src/hooks/usePersonaObjectives.ts`) call these endpoints via `fetch("/api/...")`. They never import the Tavus client directly.
- **`src/lib/tavus/client.ts`** contains the typed fetch wrapper for calling proxy endpoints from the browser.
- **Environment variables**: `TAVUS_API_KEY` must be set in the server environment. Locally, it's in `.env`. On Vercel/Netlify/etc., configure it in project settings. The Tavus base URL is hardcoded to prod (not an env var). The handlers take `persona_id`/`replica_id` from the request body — the frontend sources those from `config/presets.config.json`, not the env.

## Security Rules

- **Never expose `TAVUS_API_KEY` to the client.** No `VITE_` prefix, no `NEXT_PUBLIC_` prefix, no embedding in HTML.
- **Always validate request methods.** A function that expects POST should reject GET.
- **Don't log the API key.** Even in error messages.
- **Keep handlers thin.** These functions should forward requests, not contain business logic. Business logic belongs in hooks or lib functions.
- **Auth pattern**: Always use `x-api-key` header for Tavus API calls. Not `Bearer`, not `Authorization: Basic`.
