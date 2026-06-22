/**
 * loader.ts
 *
 * Reads and validates config/*.json files. Strips _comment keys at runtime
 * so config objects are clean for consumption by hooks and components.
 *
 * Consumed by: App.tsx, screens
 *
 * NOTE: Only `presets.config.json` lives in the repo. Role/objective/perception
 * data comes from the Tavus persona via the /api/persona/* proxies — there is
 * no local interview/perception config.
 */

import presetsConfigRaw from "@config/presets.config.json";
import { presetsConfigSchema } from "./schema";
import type { PresetsConfig } from "@/types/config";

/** Recursively strips keys starting with "_" (e.g., _comment). */
function stripComments<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(stripComments) as T;
  }
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .filter(([key]) => !key.startsWith("_"))
        .map(([key, value]) => [key, stripComments(value)])
    ) as T;
  }
  return obj;
}

function loadPresetsConfig(): PresetsConfig {
  const cleaned = stripComments(presetsConfigRaw);
  const parsed = presetsConfigSchema.parse(cleaned);
  return parsed as PresetsConfig;
}

export const presetsConfig = loadPresetsConfig();
