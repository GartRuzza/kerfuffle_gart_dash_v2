import { existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { MY_TEAM, type Player } from "../types";
import { deriveBoard, type BoardViewRow } from "./derive";

/**
 * THE data-access boundary (decision D-10, issue #12) — the single module the
 * app reads league data through, replacing the old mock fixture.
 *
 * Server-side only. Opens the SQLite store READ-ONLY and reads the flat `board`
 * view (latest successful pull). The app NEVER fetches CBS or FantasyPros at
 * request time — `npm run archive` fetches, `npm run ingest` normalizes, and
 * this module only reads what ingest stored.
 *
 * Deployability (architecture.md): file-SQLite is the one sanctioned
 * filesystem-at-request-time exception, contained to this module — a later
 * swap to Turso/Postgres touches only this file.
 */

const DB_PATH = path.join(process.cwd(), "data", "gart-dash.sqlite");

export interface BoardMeta {
  /** The raw-archive run id the data came from. */
  runId: string;
  /** When that data was fetched from CBS/FantasyPros (ISO). */
  capturedAt: string;
}

export interface BoardData {
  players: Player[];
  /** The 12 fantasy team names (owner's team first) for the Manager filter. */
  teams: string[];
  /** null = no database / nothing ingested yet. */
  meta: BoardMeta | null;
}

const EMPTY: BoardData = { players: [], teams: [], meta: null };

export function getBoard(): BoardData {
  if (!existsSync(DB_PATH)) return EMPTY;
  try {
    return readBoard();
  } catch (err) {
    // A store that exists but can't be read (half-written file, or built before
    // a migration this code expects) is a re-ingest away from fixed. Fall back
    // to the empty state — the banner then tells the owner exactly what to run,
    // which serves them better than a stack trace.
    console.error(
      `[gart-dash] Could not read ${DB_PATH} — showing the no-data state. ` +
        `Run "npm run ingest" to rebuild it.\n`,
      err
    );
    return EMPTY;
  }
}

function readBoard(): BoardData {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    const pull = db
      .prepare(
        `SELECT run_id, captured_at FROM pull
         WHERE pull_id = (SELECT pull_id FROM latest_pull)`
      )
      .get() as { run_id: string; captured_at: string } | undefined;
    if (!pull) return EMPTY;

    const rows = db.prepare(`SELECT * FROM board`).all() as BoardViewRow[];
    const teamRows = db
      .prepare(`SELECT name FROM fantasy_team ORDER BY name`)
      .all() as { name: string }[];
    const teams = [
      ...teamRows.filter((t) => t.name === MY_TEAM).map((t) => t.name),
      ...teamRows.filter((t) => t.name !== MY_TEAM).map((t) => t.name),
    ];

    return {
      players: deriveBoard(rows),
      teams,
      meta: { runId: pull.run_id, capturedAt: pull.captured_at },
    };
  } finally {
    db.close();
  }
}
