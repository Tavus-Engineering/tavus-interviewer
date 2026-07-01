# AI Interviewer Experience

A forkable starter kit for any structured video conversation, built on [Tavus](https://tavus.io). Clone it, reconfigure the PAL, and ship your own version — AI interviewer, sales coach, HR screener, customer support agent, or anything else that's a guided back-and-forth with a video-first AI.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FTavus-Engineering%2Ftavus-interviewer&project-name=tavus-interviewer&repository-name=tavus-interviewer&env=TAVUS_API_KEY&envDescription=Your%20Tavus%20API%20key%20%28required%29.&envLink=https%3A%2F%2Fmaker.tavus.io%2Fdev%2Fapi-keys)

> One-click deploy to Vercel. You'll be prompted for `TAVUS_API_KEY` (required). The `persona_id`/`replica_id` ship in `config/presets.config.json`, so they aren't deployment env vars.

## Key Terms

If you're new to Tavus, here's a quick glossary of terms used throughout the repo:

| Term | What it means |
|------|--------------|
| **PAL** (Personified Application Layer) | The AI's complete identity — system prompt, behavior rules, and conversation structure. Created via the Tavus API. |
| **Face** | The AI's on-screen likeness and voice — a video avatar trained from real footage. You pick one during setup. |
| **Objective** | A single step in the conversation (e.g., "Ask about prior experience"). Objectives chain together to form the interview flow. |
| **Guardrail** | A behavioral constraint (e.g., "Never reveal the scoring rubric"). Keeps the AI on track. |
| **Raven** | Tavus's perception model. Observes the actor's eye contact, engagement, and body language via the camera. |
| **Sparrow** | Tavus's turn-taking model. Controls when the AI speaks vs. listens, so the conversation feels natural. |


## What You'll Build

- **Real-time video audition** — a Tavus-powered AI that sees, hears, and responds to the actor in real time
- **Structured conversation flow** — objectives guide the audition step by step (intro, cold read, character beat, closing)
- **Hair-check lobby** — live camera preview via a single `getUserMedia({video, audio})` call (one combined browser permission prompt) and dropdown selectors for camera, microphone, and audio output before joining the call
- **Live transcript + text input** — closed-captions panel with the full running transcript (selectable + "Copy all" button) and an inline text-message input (sends `conversation.respond`). Face text streams in progressively via `conversation.utterance.streaming`; user text arrives once on speech-end via `conversation.utterance`. The video shrinks to make room when CC is open (no overlay).
- **10-minute hard cap** — every conversation is created with `properties.max_call_duration: 600` and the title bar shows a live `MM:SS / 10:00` timer; the call auto-leaves at 10:00
- **Perception analysis** — Tavus Raven observes eye contact, engagement, and body language throughout the conversation
- **A preloaded audition preset** that works out of the box (Starfall Lead — a casting audition with Julian, an AI casting director)

## Prerequisites

You'll need basic familiarity with the terminal (running commands, navigating directories). Install these before you start:

| Requirement | How to get it | Verify |
|---|---|---|
| **Node.js v18+** | [nodejs.org](https://nodejs.org) (LTS recommended — this also installs npm) | `node -v` and `npm -v` |
| **Git** | [git-scm.com](https://git-scm.com/downloads) | `git --version` |
| **Tavus account + API key** | Sign up at [maker.tavus.io](https://maker.tavus.io), then go to [API Keys](https://maker.tavus.io/dev/api-keys) | You'll paste the key during setup |
| **Camera + microphone** | Built-in or external — the interview is a live video call with the AI | Test with your browser's permission settings before starting |
| **Modern browser** | Chrome, Firefox, or Edge recommended. Safari has partial WebRTC support. Mobile browsers are not supported. | The app uses WebRTC (via Daily.js) for real-time video — requires a desktop browser. |
| **AI coding assistant** *(recommended)* | [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`npm install -g @anthropic-ai/claude-code`) or [Cursor](https://cursor.com) | Not required, but highly recommended for customization |

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/Tavus-Engineering/tavus-interviewer.git && cd tavus-interviewer && npm install
```

### 2. Configure your environment

Copy the example file and fill in the values:

```bash
cp .env.example .env
```

Open `.env` and set the following:

| Variable | Required | What it is | Where to get it |
|---|---|---|---|
| `TAVUS_API_KEY` | Yes | Your Tavus API key (used server-side; never bundled into the browser) | [maker.tavus.io/dev/api-keys](https://maker.tavus.io/dev/api-keys) |

> The PAL and face IDs are no longer environment variables. They live in `config/presets.config.json` (each preset's `persona_id` and `replica_id`), which is committed to the repo.

> **One-time PAL setup**: After setting `TAVUS_API_KEY` in `.env`, run `npm run init` to copy a reference PAL to your account. The copy command writes the new `persona_id` into `config/presets.config.json` automatically. (Skip this if the preset's `persona_id` is already configured.) You can also point the preset's `persona_id` at any PAL you've created in the [Tavus dashboard](https://maker.tavus.io/dev/pals).

### 3. Start the dev server

```bash
npm run dev
```

Your browser will open automatically to **http://localhost:5173**.

## Your First Audition

Once the app is running, here's what to expect:

1. **Lobby** — the entry screen, showing the role you're auditioning for and a short description of the 10-minute audition, alongside the hair-check: live camera preview plus camera, microphone, and audio output dropdowns. The conversation is created in the background while you pick devices. The browser will ask for camera + microphone permission once (single combined prompt) — click **Allow**, then click **I'm ready, let's play** when you want to join.
2. **Join** — clicking "I'm ready, let's play" connects you to the Tavus conversation that was created on lobby entry (`enable_closed_captions: true` + `max_call_duration: 600` set server-side).
3. **Audition** — the AI face appears and begins the audition. The title bar shows a live `MM:SS / 10:00` timer; the call auto-leaves when it hits 10:00. The 4-button control bar (mic / camera / CC / End call) is the only chrome. Read naturally — Raven observes your engagement, eye contact, and body language in real time. A right-docked, collapsible Developer Inspector panel is always rendered (it boots collapsed as a small terminal-style toggle, and docks full-height against the right edge when expanded). Its always-visible Live State vitals strip shows status, elapsed time, who's speaking, objective progress, and a guardrail counter; an Inspector tab shows live objectives, guardrails, tools, and Raven perception, and an Events tab shows a severity-colored CVI event console. The CC button opens the live transcript panel beside the video (the video shrinks to make room) — text is selectable, has a "Copy all" button, and an inline input lets you type a message.
4. **Results** — when the audition ends, you'll see a thank-you card ("That's a wrap. Thanks for playing.") letting the actor know the casting team will sit with the tape and circle back. A **View report** button opens an in-app casting report.

> **Tip**: The first audition takes about 3-5 minutes. Try it end-to-end before customizing anything — it helps you understand what each config file actually controls.

## Open in Your AI Coding Assistant

Once the app is running, open the project in an AI coding assistant to help you understand and customize the codebase. The repo includes a [CLAUDE.md](CLAUDE.md) file that gives AI assistants full context about the architecture, conventions, and how everything connects.

### Claude Code

```bash
cd tavus-interviewer
claude
```

### Cursor

```bash
cd tavus-interviewer
cursor .
```

Or open Cursor, then **File > Open Folder** and select the project directory.

### Starter prompt

Paste this into your AI assistant to get started:

```
I just cloned the tavus-interviewer repo — a Tavus-powered AI interviewer
built with React + Vite. I need your help customizing it.

Key context:
- The PAL (identity, objectives, guardrails) is managed on Tavus; config/presets.config.json points at it by persona_id
- config/ holds the interview presets
- api/ is the serverless proxy layer that keeps API keys server-side
- Every folder has a .md file explaining its contents
- Setup is just `cp .env.example .env`, fill in keys, then `npm run dev`

Read CLAUDE.md first for full architectural context, then help me
[customize this for a ___ use case / add a new interview role /
deploy to Vercel].
```

Replace the bracketed text with what you actually want to do.

## Deploy or customize without a terminal

Two browser-based paths, for two different goals: **v0 to customize, the Vercel button to deploy.**

- **Deploy** → use the **[Deploy with Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FTavus-Engineering%2Ftavus-interviewer&project-name=tavus-interviewer&repository-name=tavus-interviewer&env=TAVUS_API_KEY&envDescription=Your%20Tavus%20API%20key%20%28required%29.&envLink=https%3A%2F%2Fmaker.tavus.io%2Fdev%2Fapi-keys)** button at the top of this README. It clones the repo into your account and prompts you for the env vars — no local setup required.
- **Customize** → import the repo into [v0](https://v0.app) and edit it with natural-language prompts, then deploy with the Vercel button.

> **Note**: [Lovable](https://lovable.dev) cannot import an existing GitHub repo today, so it isn't a supported path for this starter. Use v0 to customize in the browser, the Vercel button to deploy, or clone locally (see [Quick Start](#quick-start)).

### Edit/Customize in v0 (manual import)

1. Open [v0.app](https://v0.app). You'll need a v0/Vercel account and the [Vercel GitHub App](https://github.com/apps/vercel) installed (import your own fork if you want to push edits back).
2. Use the dropdown next to **New Chat** → **Import from GitHub**, and paste the repo URL: `https://github.com/Tavus-Engineering/tavus-interviewer`
3. Customize with natural-language prompts (starter prompt below).

> **Heads up**: This is a Vite app, so v0's in-chat preview may not boot. Use v0 to *edit* the code, then deploy to Vercel (the **Deploy with Vercel** button at the top) to actually run it.

#### Starter prompt

```
This repo is a Tavus-powered starter kit for structured video conversations
(interviewer, language tutor, sales coach, etc.). Read CLAUDE.md first for
architectural context.

I want to customize it for: [describe your use case — e.g. "a Spanish
language tutor for beginners", "an HR screener for engineering roles"].

Please:
1. Replace the preloaded interviews in config/presets.config.json with ones
   that fit my use case
2. Keep the API proxy layer (api/) and Tavus integration intact — only the
   PAL config needs to change
3. Don't touch .env — I'll set TAVUS_API_KEY myself after deploying.
   The persona_id and replica_id live in config/presets.config.json

Show me the changes before applying them.
```

### 5. Add your API keys and deploy

v0 and Lovable will NOT have your Tavus API key. After the AI edits are merged back to GitHub:

- **v0**: use the **Environment Variables** panel to set `TAVUS_API_KEY`, then deploy to Vercel. The `persona_id`/`replica_id` ship in the committed `config/presets.config.json`, so they are not deployment env vars.
- **Lovable**: set env vars in **Project Settings → Secrets**, then use the built-in Vercel deploy button.

> **Tip**: You can clone your fork locally, set `TAVUS_API_KEY` in `.env`, run `npm run init` to copy a reference PAL into your account, then commit the updated `config/presets.config.json`. v0/Lovable will pick it up on the next sync.

## Preloaded Audition

The app ships with a single preset defined in `config/presets.config.json`:

- **Starfall Lead** — a loose, playful casting audition for the lead in *Starfall*, a new sci-fi series — a few quick beats and a little improv with Julian, an AI casting director at Meridian Pictures

The demo runs the first preset in this file (`presets[0]`). Each preset just needs a `persona_id` and `replica_id` from your Tavus account.

## Customization

### Edit presets (no code, no API calls)

Edit `config/presets.config.json` to change the active interview preset. The app uses `presets[0]` and renders its `title` as the role on the LobbyScreen + InterviewScreen.

### Configure your own PAL

Create or edit a PAL in the [Tavus dashboard](https://maker.tavus.io/dev/pals) (system prompt, objectives, guardrails, layers), then drop its `persona_id` and `replica_id` into `config/presets.config.json` to add or replace an interviewer preset. The app fetches the PAL's objectives, guardrails, and tools live at runtime — nothing local to keep in sync.

## Deployment

Designed for [Vercel](https://vercel.com). The `api/` directory maps directly to Vercel serverless functions.

1. Push your repo to GitHub
2. Import the repo in [Vercel](https://vercel.com/new)
3. Set environment variables in the Vercel dashboard:
   - `TAVUS_API_KEY` *(required)*

   The `persona_id`/`replica_id` ship in the committed `config/presets.config.json`, so they are not set as deployment env vars.
4. Deploy — Vercel automatically maps `api/*.ts` to serverless functions

```bash
# Test the production build locally before deploying
npm run build
npm run preview
```

For other platforms, adapt `api/*.ts` to your serverless runtime or add a lightweight Express server. See [API.md](api/API.md) for details on the proxy layer.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `No .env file found` | Haven't created `.env` yet | Copy `.env.example` to `.env` and fill in values |
| `Missing required: TAVUS_API_KEY` | `.env` exists but key is empty | Add your key to `.env` (see [maker.tavus.io/dev/api-keys](https://maker.tavus.io/dev/api-keys)) |
| Conversation won't start / inspector shows no objectives | Preset's `persona_id` not set correctly | Verify `presets[0].persona_id` in `config/presets.config.json` — pick a PAL at [maker.tavus.io/dev/pals](https://maker.tavus.io/dev/pals) and paste its ID in (or run `npm run init` to copy a reference PAL) |
| `Tavus API error 401` | Invalid API key | Verify your key at [maker.tavus.io/dev/api-keys](https://maker.tavus.io/dev/api-keys) |
| Camera/mic not working | Browser permissions blocked | Click the lock/camera icon in the address bar and allow access. HTTPS is required in production. |
| Inspector shows no objectives | PAL's `objectives_id` points to deleted/missing objectives, or PAL ID is wrong | Verify the PAL in the Tavus dashboard and that the preset's `persona_id` in `config/presets.config.json` is correct |

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server (runs env check + config validation first) |
| `npm run build` | Production build (type-checks then bundles) |
| `npm run preview` | Preview the production build locally |
| `npm run validate` | Validate config files (Zod schemas + cross-file consistency) |
| `npm run check-env` | Verify required environment variables are set |
| `npm run init` | *(Optional)* Copy a reference PAL into your Tavus account and write its `persona_id` into the preset |

## Project Structure

```
├── api/                  Serverless API proxies         → API.md
├── config/               Frontend config (presets)      → CONFIG.md
├── persona/              Dev sample answers             → README.md
├── scripts/              Setup and validation scripts   → SCRIPTS.md
├── src/                  React + Vite frontend          → SRC.md
│   ├── screens/          One screen per FSM phase
│   ├── components/
│   │   ├── video/        Tavus video integration (Daily.js)
│   │   ├── lobby/        Camera preview + device selectors
│   │   ├── interview/    Call control bar, transcript panel, guardrail toast
│   │   ├── layout/       FloatingInspector (right-docked, collapsible dev panel)
│   │   ├── inspector/    DeveloperInspector + EventsConsole + VitalsStrip (rendered inside FloatingInspector)
│   │   └── ui/           Shared UI primitives
│   ├── hooks/            State management hooks
│   ├── lib/              Utilities, API client, config loader
│   └── types/            TypeScript type definitions
└── docs/                 Architecture + customization   → DOCS.md
```

## Deep Dive Documentation

Every folder contains a `.md` file that explains the concept behind it. An AI agent (or developer) can drop into any folder, read the doc, and understand what that piece does, why it exists, and how to modify it.

### PAL (`persona/`)

The PAL is the AI's complete identity — who it is, what it does, and what it won't do. It's managed directly on Tavus (the [dashboard](https://maker.tavus.io/dev/pals) or the Tavus API); see [persona/README.md](persona/README.md). The app references it by `persona_id` and fetches its objectives, guardrails, and tools live at runtime. Concepts: [Objectives](https://docs.tavus.io/sections/conversational-video-interface/pal/objectives), [Guardrails](https://docs.tavus.io/sections/conversational-video-interface/guardrails). The app's per-guardrail reactions live in `src/lib/guardrailActions.ts`.

### Config (`config/`)

Frontend configuration that tells the web app how to display and score the conversation.

| Doc | Teaches you |
|-----|------------|
| [CONFIG.md](config/CONFIG.md) | Preset fields, and how config connects to the PAL-owned data fetched via the Tavus API |

### API Proxy (`api/`)

Serverless functions that keep the Tavus API key on the server.

| Doc | Teaches you |
|-----|------------|
| [API.md](api/API.md) | Why the proxy exists, how each endpoint works, how to add new ones, and security rules |

### Scripts (`scripts/`)

CLI tools for setup, deployment, and validation.

| Doc | Teaches you |
|-----|------------|
| [SCRIPTS.md](scripts/SCRIPTS.md) | Config validation (`validate`), env check (`check-env`), PAL copy (`init`), and how they connect |

### Source Code (`src/`)

The React + Vite frontend. Screens, components, hooks, types.

| Doc | Covers |
|-----|--------|
| [SRC.md](src/SRC.md) | Full directory map, FSM routing, event flow, hooks architecture, what to change for a new use case |

### Architecture & Guides (`docs/`)

| Doc | Covers |
|-----|--------|
| [DOCS.md](docs/DOCS.md) | Index of documentation files and when to read them |
| [architecture.md](docs/architecture.md) | Screen flow, FSM states, data flow, key principles |
| [customization.md](docs/customization.md) | Step-by-step instructions for common changes |
| [tavus-features.md](docs/tavus-features.md) | Which Tavus features are used and how (objectives, guardrails, Raven, Sparrow) |
| [walkthrough.md](docs/walkthrough.md) | End-to-end walkthrough from setup to completed interview |

### Recommended reading order

If you want to understand the system deeply enough to reconfigure it for a completely different use case:

```
1. config/CONFIG.md       ← Frontend labels, presets, perception display
2. api/API.md             ← Server proxy layer
3. scripts/SCRIPTS.md     ← Setup and validation tools
4. src/SRC.md             ← Frontend architecture (only if modifying the app)
```

The PAL itself (identity, objectives, guardrails, layers) is managed on Tavus — see [persona/README.md](persona/README.md) and the [Tavus PAL docs](https://docs.tavus.io/sections/conversational-video-interface/pal/overview). Items 2-4 are needed only if you're changing the infrastructure or frontend code.

## Environment Variables

```bash
# Server-side only (no VITE_ prefix — never in browser bundle)
TAVUS_API_KEY=            # Required — from https://maker.tavus.io/dev/api-keys

# persona_id and replica_id are NOT env vars — they live in config/presets.config.json
```

> **Note**: all Tavus API calls go to production (`https://tavusapi.com`) — the base URL is hardcoded in `api/_lib/handlers/tavus.ts`, not configurable.
