/**
 * validate-config.ts
 *
 * Validates config/*.json files against Zod schemas before the dev server starts,
 * then performs cross-file checks where useful.
 * Run via: npm run validate
 *
 * Exits with code 1 if validation fails, preventing the dev server from starting
 * with invalid configuration.
 *
 * NOTE: Only `presets.config.json` lives in the repo. Role/objective/perception
 * data comes from the Tavus persona via the API and is not duplicated here.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { presetsConfigSchema } from "../src/lib/config/schema";

function stripComments<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(stripComments) as T;
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .filter(([key]) => !key.startsWith("_"))
        .map(([key, value]) => [key, stripComments(value)])
    ) as T;
  }
  return obj;
}

function readJson(path: string): unknown {
  return stripComments(JSON.parse(readFileSync(resolve(path), "utf-8")));
}

function validateFile(path: string, schema: { parse: (data: unknown) => unknown }, label: string) {
  try {
    const raw = JSON.parse(readFileSync(resolve(path), "utf-8"));
    const cleaned = stripComments(raw);
    schema.parse(cleaned);
    console.log(`  ✓ ${label}`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${label}`);
    if (err instanceof Error) {
      console.error(`    ${err.message}`);
    }
    return false;
  }
}

// ── Cross-file validation ────────────────────────────────────────────────

function validatePresetIds(): boolean {
  const presets = readJson("config/presets.config.json") as {
    presets: { id: string }[];
  };

  const ids = presets.presets.map((p) => p.id);
  const seen = new Set<string>();
  let ok = true;

  for (const id of ids) {
    if (seen.has(id)) {
      console.error(`  ✗ duplicate preset id: "${id}"`);
      ok = false;
    }
    seen.add(id);
  }

  if (ok) console.log("  ✓ preset IDs are unique");
  return ok;
}

// ── Main ─────────────────────────────────────────────────────────────────

console.log("\nValidating configuration files...\n");

console.log("Schema validation:");
const schemaResults = [
  validateFile("config/presets.config.json", presetsConfigSchema, "presets.config.json"),
];

console.log("\nCross-file validation:");
const crossResults = [
  validatePresetIds(),
];

const allPassed = [...schemaResults, ...crossResults].every(Boolean);

if (allPassed) {
  console.log("\n✓ All configuration files are valid.\n");
  process.exit(0);
} else {
  console.error("\n✗ Configuration validation failed. Fix errors above before continuing.\n");
  process.exit(1);
}
