// Shared helpers for the source-profiling generator (issue #11).
// Pure I/O + path resolution; no parsing logic lives here.

import { readdirSync, existsSync, readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = join(HERE, "..", "..");
export const RAW_ROOT = join(PROJECT_ROOT, "data", "raw");
export const PROFILE_OUT = join(PROJECT_ROOT, "docs", "profiles");

// The raw archive folders are named with sortable UTC timestamps
// (e.g. 2026-08-25T21-54-26Z), so lexical max == most recent run.
export function findLatestRun() {
  if (!existsSync(RAW_ROOT)) return null;
  const runs = readdirSync(RAW_ROOT)
    .filter((n) => statSync(join(RAW_ROOT, n)).isDirectory())
    .sort();
  return runs.length ? join(RAW_ROOT, runs[runs.length - 1]) : null;
}

export function readManifest(runDir) {
  const p = join(runDir, "manifest.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

export function readText(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

export function readJson(path) {
  const t = readText(path);
  if (t == null) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// Deterministic JSON write (2-space, trailing newline) so re-runs diff cleanly.
export function writeJson(path, obj) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");
}

export function writeTextFile(path, text) {
  ensureDir(dirname(path));
  writeFileSync(path, text.endsWith("\n") ? text : text + "\n");
}

// Collapse whitespace (incl. non-breaking spaces) and trim.
export function clean(s) {
  return (s || "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
