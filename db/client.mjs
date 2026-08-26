// The one place that knows where the SQLite database lives and how to open it
// (decision D-10: one DB file, better-sqlite3). Used by the ingest tool and the
// migration runner; the app's read path (lib/data/) opens the same file with the
// same pragmas on the TypeScript side.
//
// The DB file lives in data/ (git-ignored) next to the raw archive it is built
// from. Deleting it is always safe: `npm run ingest` rebuilds it from data/raw/.

import Database from "better-sqlite3";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DB_PATH = join(ROOT, "data", "gart-dash.sqlite");
export const MIGRATIONS_DIR = join(ROOT, "db", "migrations");

export function openDb({ path = DB_PATH, readonly = false } = {}) {
  if (!readonly) mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { readonly, fileMustExist: readonly });
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

// Apply every db/migrations/*.sql not yet recorded in schema_migration, in
// filename order, each inside its own transaction. Never edit an applied
// migration — write a new numbered file (docs/data_model.md).
export function applyMigrations(db, { log = () => {} } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migration (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set(
    db.prepare("SELECT name FROM schema_migration").all().map((r) => r.name)
  );
  const files = existsSync(MIGRATIONS_DIR)
    ? readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()
    : [];
  const run = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migration (name, applied_at) VALUES (?, ?)")
        .run(file, new Date().toISOString());
    })();
    log(`  migration applied: ${file}`);
    run.push(file);
  }
  return run;
}
