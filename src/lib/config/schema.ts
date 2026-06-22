/**
 * schema.ts
 *
 * Zod schemas for runtime validation of config/*.json files.
 * Used by loader.ts and scripts/validate-config.ts.
 *
 * Consumed by: lib/config/loader.ts, scripts/validate-config.ts
 */

import { z } from "zod";

export const presetSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().min(1),
  persona_id: z.string().min(1),
  replica_id: z.string().min(1),
  default_persona_id: z.string().optional(),
});

export const presetsConfigSchema = z.object({
  _comment: z.string().optional(),
  presets: z.array(presetSchema).min(1),
});
