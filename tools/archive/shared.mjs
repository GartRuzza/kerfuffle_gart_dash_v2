// Shared helpers for the raw snapshot archival tool (GitHub issue #10).
//
// No dependencies — built-in Node only. Credentials are read from the EXISTING
// spike .env files (the owner's choice for issue #10: reuse them, no re-paste):
//   CBS cookie  -> spikes/cbs-api/.env         (CBS_COOKIE, CBS_LEAGUE_HOST)
//   FP HOF key  -> spikes/fantasypros-api/.env (FP_API_KEY, ...)
// NOTE for a future cleanup: issue #10 leaves the spike *scripts* in place and a
// follow-up will delete spikes/*/pull.mjs once this tool is proven. Do NOT delete
// the spike .env files in that cleanup — this tool reads its credentials from them.

import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const HERE = dirname(fileURLToPath(import.meta.url)); // tools/archive
export const REPO_ROOT = join(HERE, "..", ".."); // repo root
export const DATA_ROOT = join(REPO_ROOT, "data"); // git-ignored (see .gitignore)
export const RAW_ROOT = join(DATA_ROOT, "raw"); // dated snapshot folders live here

// Credentials live in the existing spike folders (owner's choice, issue #10).
export const CBS_ENV_DIR = join(REPO_ROOT, "spikes", "cbs-api");
export const FP_ENV_DIR = join(REPO_ROOT, "spikes", "fantasypros-api");

// Parse .env (+ .env.local) from a directory into a plain object. Same minimal
// KEY=VALUE parser the spikes used — no dependency, blank/# lines skipped.
export function loadEnv(dir) {
  const cfg = {};
  for (const file of [".env", ".env.local"]) {
    const p = join(dir, file);
    if (!existsSync(p)) continue;
    for (const raw of readFileSync(p, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      cfg[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }
  return cfg;
}

// A filesystem-safe, still-sortable run id from the current time. True ISO 8601
// has colons (14:30:00), which are illegal in Windows folder names, so we swap
// them for dashes and drop milliseconds: 2026-08-25T14-30-00Z.
export function makeRunId(date = new Date()) {
  return date.toISOString().slice(0, 19).replace(/:/g, "-") + "Z";
}

export function ensureDir(p) {
  mkdirSync(p, { recursive: true });
  return p;
}
