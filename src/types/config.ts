/**
 * config.ts
 *
 * TypeScript interfaces mirroring the JSON config file shapes.
 * Used by the Zod schemas in lib/config/schema.ts for runtime validation.
 *
 * Consumed by: lib/config/loader.ts, hooks, screens
 */

export interface PresetConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
  persona_id: string;
  replica_id: string;
}

export interface PresetsConfig {
  presets: PresetConfig[];
}
