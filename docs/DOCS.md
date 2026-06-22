# Documentation

## What Lives Here

This folder contains architecture and customization documentation for the frontend application. While the concept-level docs live inside each feature folder (`persona/`, `config/`, `api/`, `scripts/`), this folder covers the **React application itself** — how the screens connect, how to customize the experience, and which Tavus features are integrated.

## Files

| File | What it covers |
|------|---------------|
| [architecture.md](architecture.md) | Screen flow, FSM states, data flow diagram, key architectural principles |
| [customization.md](customization.md) | Step-by-step instructions for common changes (role, questions, perception, replica) |
| [tavus-features.md](tavus-features.md) | Inventory of which Tavus platform features are used and how (CVI, objectives, guardrails, Raven, Sparrow) |
| [walkthrough.md](walkthrough.md) | End-to-end walkthrough from `git clone` to a completed conversation with results |

## When to Read These

- **Before making frontend changes**: Read `architecture.md` to understand the screen flow and FSM
- **Before adapting for a new use case**: Read `walkthrough.md` for the full picture, then `customization.md` for specific changes
- **Before integrating new Tavus features**: Read `tavus-features.md` to understand what's already wired up

## How Docs Connect to Other Parts

These docs describe the `src/` codebase. The concept docs in other folders (`config/CONFIG.md`, `persona/README.md`, etc.) describe the Tavus-specific configuration that drives the application. Read the concept docs first to understand *what* the system does, then read these docs to understand *how* the frontend implements it.

## Reading Order for Agents

If you're adapting this repo for a new use case, you don't need these docs — the concept docs in `persona/`, `config/`, `api/`, and `scripts/` are sufficient. These docs are for when you need to modify the frontend code itself (add screens, change the FSM, integrate new event types, etc.).
