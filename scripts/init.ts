#!/usr/bin/env tsx
/**
 * Init script — bootstraps a new clone of this template.
 *
 * If TAVUS_API_KEY is set and the preset's persona_id has not been customized
 * yet (i.e. it still equals default_persona_id), copy the reference persona
 * (config/presets.config.json `default_persona_id`) via the Tavus clone
 * endpoint, then write the new persona_id back into config/presets.config.json.
 *
 * Skips silently when the preset's persona_id already differs from the default
 * (meaning it was already cloned or pointed at a user-owned persona).
 * Errors clearly when TAVUS_API_KEY is missing or the default isn't configured.
 *
 * Run via: npm run init
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PRESETS_PATH = resolve("config/presets.config.json");

function loadEnv(): Record<string, string> {
  const path = resolve(".env");
  if (!existsSync(path)) return {};
  const text = readFileSync(path, "utf-8");
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function readPresets(): { presets?: Array<Record<string, unknown>> } {
  return JSON.parse(readFileSync(PRESETS_PATH, "utf-8"));
}

function writePresetPersonaId(personaId: string) {
  const presets = readPresets();
  if (!presets.presets?.[0]) {
    throw new Error("config/presets.config.json has no presets[0] to update");
  }
  presets.presets[0].persona_id = personaId;
  writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2) + "\n");
}

async function main() {
  const env = loadEnv();
  const apiKey = env.TAVUS_API_KEY || process.env.TAVUS_API_KEY;

  const presets = readPresets();
  const preset = presets.presets?.[0];
  const personaId = preset?.persona_id as string | undefined;
  const defaultId = preset?.default_persona_id as string | undefined;

  if (personaId && personaId.trim().length > 0 && personaId !== defaultId) {
    console.log("[init] persona_id is already customized in config/presets.config.json — nothing to do.");
    return;
  }
  if (!apiKey || apiKey.trim().length === 0) {
    console.error("[init] TAVUS_API_KEY is not set in .env — cannot copy reference persona.");
    process.exit(1);
  }
  if (!defaultId || defaultId.trim().length === 0 || defaultId.startsWith("p_REPLACE")) {
    console.error(
      "[init] No default_persona_id configured in config/presets.config.json.\n" +
      "       Set the default_persona_id to a Tavus persona you want to copy from."
    );
    process.exit(1);
  }

  console.log(`[init] Cloning reference persona template ${defaultId} via Tavus API...`);
  const res = await fetch(`https://tavusapi.com/v2/personas/templates/${encodeURIComponent(defaultId)}/clone`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[init] Copy failed: ${res.status} ${res.statusText}\n${body}`);
    process.exit(1);
  }
  const data = await res.json() as { persona_id?: string; id?: string };
  const newId = data.persona_id ?? data.id;
  if (!newId) {
    console.error("[init] Tavus API returned 200 but no persona_id in response body:", JSON.stringify(data));
    process.exit(1);
  }

  writePresetPersonaId(newId);
  console.log(`[init] New persona created: ${newId}`);
  console.log("[init] Written to config/presets.config.json as persona_id");
}

main().catch((err) => {
  console.error("[init] Unexpected error:", err);
  process.exit(1);
});
