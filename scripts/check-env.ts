/**
 * check-env.ts
 *
 * Validates that required environment variables are set before starting the dev server.
 * Run via: npm run check-env (also runs automatically as part of npm run dev)
 *
 * Exits with code 1 if required vars are missing, preventing a confusing runtime error.
 */

import { existsSync } from "fs";
import { resolve } from "path";
import "dotenv/config";

// persona_id / replica_id live in config/presets.config.json, not the env.
const REQUIRED = ["TAVUS_API_KEY"] as const;
const OPTIONAL = [] as const;

function main() {
  const envPath = resolve(".env");

  if (!existsSync(envPath)) {
    console.error("\n✗ No .env file found.");
    console.error("  Copy `.env.example` to `.env` and fill in the values.\n");
    process.exit(1);
  }

  console.log("\nChecking environment variables...\n");

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED) {
    if (!process.env[key]) {
      errors.push(key);
    }
  }

  for (const key of OPTIONAL) {
    if (!process.env[key]) {
      warnings.push(key);
    }
  }

  if (errors.length > 0) {
    for (const key of errors) {
      console.error(`  ✗ Missing required: ${key}`);
    }
    console.error("");
    console.error("  Set these in `.env` — see `.env.example` for reference.\n");
  }

  if (warnings.length > 0) {
    for (const key of warnings) {
      console.log(`  ⚠ Missing optional: ${key}`);
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log("  ✓ All environment variables set.");
  } else if (errors.length === 0) {
    console.log("\n  ✓ Required environment variables set.");
  }

  console.log("");

  if (errors.length > 0) {
    process.exit(1);
  }
}

main();
