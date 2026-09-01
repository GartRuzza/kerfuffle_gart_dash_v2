import { existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { MY_TEAM, type Player } from "../types";
import {
  deriveBoard,
  deriveWeekly,
  type BoardViewRow,
  type ProjectionRow,
  type ValuationRow,
  type WeeklyConsensusRow,
} from "./derive";

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
  /**
   * The active engine lens (issue #28). `horizon` is 'ros' in-season (the
   * rest-of-season re-score) — the Kerf ranks/tiers/dollars reflect it; null
   * before the engine has ever run. `engineRunAt` is when that run was computed
   * (how fresh the Kerf numbers are, distinct from when the data was fetched).
   */
  horizon: string | null;
  engineRunAt: string | null;
  /**
   * The weekly lens (issue #29): the NFL week the weekly re-score covers, and when
   * that weekly run was computed. Both null until a current-week projection has been
   * ingested and the engine has produced a weekly run (preseason: no weekly lens).
   */
  weeklyWeek: number | null;
  weeklyRunAt: string | null;
  /**
   * Option B (issue #30): the number of completed weeks the ROS lens netted actuals
   * through. null or 0 = no netting yet (preseason / no actuals) → the lens is the
   * full-season proxy (Option A). > 0 = the Kerf ranks + dollars are TRUE remaining
   * value through that week.
   */
  actualsAsOfWeek: number | null;
}

export interface BoardData {
  players: Player[];
  /**
   * The WEEKLY-lens dataset (issue #29): the same players with this-week Kerf
   * numbers, weekly consensus, and matchup opponent. null when there is no weekly
   * run yet — the UI then offers no Weekly lens.
   */
  weeklyPlayers: Player[] | null;
  /** The 12 fantasy team names (owner's team first) for the Manager filter. */
  teams: string[];
  /** null = no database / nothing ingested yet. */
  meta: BoardMeta | null;
}

const EMPTY: BoardData = { players: [], weeklyPlayers: null, teams: [], meta: null };

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

    // The latest engine run's per-player projection (issue #18). If no engine
    // run exists yet (engine never run), this is empty and Kerf fields stay "—" —
    // exactly the pre-engine behavior, so the app degrades gracefully.
    const projById = new Map<number, ProjectionRow>();
    const projRows = db
      .prepare(
        `SELECT cbs_player_id, kerf_points, kerf_ovr_rank, kerf_pos_rank,
                kerf_ovr_tier, kerf_pos_tier, season_points, actuals_points, actuals_as_of_week
         FROM projection
         WHERE engine_run_id = (SELECT engine_run_id FROM latest_engine_run)`
      )
      .all() as (ProjectionRow & { cbs_player_id: number })[];
    for (const p of projRows) projById.set(p.cbs_player_id, p);
    // The as-of week the ROS run netted actuals through (Option B, issue #30): 0 or
    // absent preseason, > 0 once games are played. The banner uses it to say the lens
    // is true remaining value "through Week N". All ROS rows share one value.
    const netWeek = projRows.find((p) => p.actuals_as_of_week != null)?.actuals_as_of_week ?? null;

    // The latest engine run's per-player valuation (issue #20). Empty until the
    // engine has run with the valuation layer — dollar fields then stay "—".
    const valById = new Map<number, ValuationRow>();
    const valRows = db
      .prepare(
        `SELECT cbs_player_id, kerf_value, roster_value, market_in_season, market_pre_auction
         FROM valuation
         WHERE engine_run_id = (SELECT engine_run_id FROM latest_engine_run)`
      )
      .all() as (ValuationRow & { cbs_player_id: number })[];
    for (const v of valRows) valById.set(v.cbs_player_id, v);

    // The active engine lens + its freshness (issue #28): the latest ROS run.
    // Null when the engine has never run — the Kerf columns then render "—".
    const engineRun = db
      .prepare(
        `SELECT horizon, created_at FROM engine_run
         WHERE engine_run_id = (SELECT engine_run_id FROM latest_engine_run)`
      )
      .get() as { horizon: string; created_at: string } | undefined;

    // Weekly lens (issue #29): the latest 'weekly' engine run + the weekly consensus
    // board. Both absent preseason — weeklyPlayers stays null and the UI offers no
    // Weekly toggle. The weekly dataset reuses the same board identity rows, with
    // this-week Kerf numbers, weekly consensus ECR, and the matchup opponent.
    const weeklyRun = db
      .prepare(
        `SELECT engine_run_id, created_at FROM engine_run
         WHERE engine_run_id = (SELECT engine_run_id FROM latest_engine_run_by_horizon WHERE horizon = 'weekly')`
      )
      .get() as { engine_run_id: number; created_at: string } | undefined;

    let weeklyPlayers: Player[] | null = null;
    let weeklyWeek: number | null = null;
    let weeklyRunAt: string | null = null;
    if (weeklyRun) {
      weeklyRunAt = weeklyRun.created_at;
      const weeklyProjById = new Map<number, ProjectionRow>();
      const wProj = db
        .prepare(
          `SELECT cbs_player_id, kerf_points, kerf_ovr_rank, kerf_pos_rank, kerf_ovr_tier, kerf_pos_tier
           FROM projection WHERE engine_run_id = ?`
        )
        .all(weeklyRun.engine_run_id) as (ProjectionRow & { cbs_player_id: number })[];
      for (const p of wProj) weeklyProjById.set(p.cbs_player_id, p);

      const weeklyConsensusById = new Map<number, WeeklyConsensusRow>();
      const wkRows = db
        .prepare(
          `SELECT cbs_player_id, rank_ecr, pos_rank, player_opponent, week FROM market_ranking
           WHERE pull_id = (SELECT pull_id FROM latest_pull)
             AND ranking_type = 'weekly' AND scoring_format = 'STD' AND position_scope = 'OP'
             AND cbs_player_id IS NOT NULL`
        )
        .all() as {
        cbs_player_id: number;
        rank_ecr: number | null;
        pos_rank: string | null;
        player_opponent: string | null;
        week: string | null;
      }[];
      for (const w of wkRows) {
        weeklyConsensusById.set(w.cbs_player_id, {
          rank_ecr: w.rank_ecr,
          pos_rank: w.pos_rank,
          opponent: w.player_opponent,
        });
        if (weeklyWeek === null && w.week != null && /^\d+$/.test(String(w.week))) {
          weeklyWeek = Number(w.week);
        }
      }
      weeklyPlayers = deriveWeekly(rows, weeklyProjById, weeklyConsensusById);
    }

    const teamRows = db
      .prepare(`SELECT name FROM fantasy_team ORDER BY name`)
      .all() as { name: string }[];
    const teams = [
      ...teamRows.filter((t) => t.name === MY_TEAM).map((t) => t.name),
      ...teamRows.filter((t) => t.name !== MY_TEAM).map((t) => t.name),
    ];

    return {
      players: deriveBoard(rows, projById, valById),
      weeklyPlayers,
      teams,
      meta: {
        runId: pull.run_id,
        capturedAt: pull.captured_at,
        horizon: engineRun?.horizon ?? null,
        engineRunAt: engineRun?.created_at ?? null,
        weeklyWeek,
        weeklyRunAt,
        actualsAsOfWeek: netWeek,
      },
    };
  } finally {
    db.close();
  }
}
