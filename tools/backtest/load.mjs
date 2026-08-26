// Backtest data loader — historical FantasyPros -> isolated backtest pulls (#19).
//
// The backtest re-runs the projection core (#18) on PAST preseasons, so it needs
// each year's preseason FantasyPros ECR board + component projections in the store.
// Those snapshots are FP-only (captured with no CBS cookie, via the archiver's
// season override) and are CAPTURED today, so they must never look like the
// current board — migration 006 gives every pull a `kind` and `latest_pull` only
// ever resolves to kind='current'. This loader writes them as kind='backtest'.
//
// It is deliberately SEPARATE from tools/ingest/ingest.mjs, which requires CBS
// rosters/rules/standings this FP-only snapshot doesn't have. It reuses the same
// validated FP parsers (mapFpBoard, mapProjections) and touches ONLY:
//   * pull            — one isolated kind='backtest' row per season
//   * market_ranking  — that season's ECR board (the baseline the Kerf re-rank
//                       must beat), scoped to the backtest pull
//   * projection_source — that season's projected stat lines (the engine's input)
//   * player          — the ONE shared (non-pull-scoped) table it writes: INSERTs
//                       missing historical-only players (ON CONFLICT DO NOTHING,
//                       and WITHOUT fp_player_id — see the addPlayer note) purely
//                       to satisfy the projection_source FK. It only ADDS rows a
//                       current pull didn't have; it never edits an existing one.
// It never writes contract / scoring_rule / transactions. The live app and
// `npm run engine` read through latest_pull (kind='current'), so the isolated
// kind='backtest' pulls never surface there; the additive, fp_player_id-free
// player insert is the only shared-table write, and it can't mis-link live data.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { openDb, applyMigrations, DB_PATH } from "../../db/client.mjs";
import { mapFpBoard } from "../ingest/parse-fp-ingest.mjs";
import { mapProjections } from "../ingest/parse-projections.mjs";

const RAW_ROOT = process.env.GART_RAW_ROOT || join(process.cwd(), "data", "raw");

// The seasons the backtest evaluates. The loader picks, for each, the newest raw
// run whose projections payload self-reports that season (self-identifying, so a
// re-pull just adds a newer folder and this keeps working).
export const BACKTEST_SEASONS = [2024, 2025];

// The ECR board the backtest treats as "raw FantasyPros consensus" — the same
// draft / standard / superflex board the live table shows the owner (D-12), so
// the comparison is against the board he actually reads.
const ECR_BOARD_FILE = "ecr-draft-std-op.json";
const PROJECTIONS_FILE = "projections-all.json";

function loadManifest(runDir) {
  const p = join(runDir, "manifest.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

function readJson(runDir, rel) {
  const p = join(runDir, "fantasypros", rel);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

/**
 * Discover which raw run holds each backtest season. Returns
 * [{ season, runId, capturedAt }] — the NEWEST run per target season, identified
 * by the season stamped inside its projections payload (not the folder name).
 */
export function discoverBacktestRuns(rawRoot = RAW_ROOT, seasons = BACKTEST_SEASONS) {
  if (!existsSync(rawRoot)) return [];
  const runs = readdirSync(rawRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort(); // timestamp folders — lexical order = chronological
  const bySeason = new Map();
  for (const runId of runs) {
    const runDir = join(rawRoot, runId);
    const proj = readJson(runDir, PROJECTIONS_FILE);
    const season = proj && Number.isFinite(Number(proj.season)) ? Number(proj.season) : null;
    if (season === null || !seasons.includes(season)) continue;
    const manifest = loadManifest(runDir);
    // later run overwrites earlier for the same season (runs is sorted ascending)
    bySeason.set(season, { season, runId, capturedAt: manifest?.started_at ?? runId });
  }
  return seasons.map((s) => bySeason.get(s)).filter(Boolean);
}

/**
 * Load one season's historical FantasyPros snapshot into an isolated backtest
 * pull. Idempotent: re-running replaces that pull's market_ranking +
 * projection_source rows. Returns a small stats object.
 */
export function loadBacktestSeason(db, { season, runId }, rawRoot = RAW_ROOT) {
  const runDir = join(rawRoot, runId);
  const manifest = loadManifest(runDir);
  if (!manifest) throw new Error(`${runId}: no manifest.json — not an archive run`);

  const boardJson = readJson(runDir, ECR_BOARD_FILE);
  if (!boardJson) throw new Error(`${runId}: missing ${ECR_BOARD_FILE} — the ECR baseline board`);
  const projJson = readJson(runDir, PROJECTIONS_FILE);
  if (!projJson) throw new Error(`${runId}: missing ${PROJECTIONS_FILE} — the projection input`);
  if (Number(projJson.season) !== season) {
    throw new Error(`${runId}: projections season ${projJson.season} != expected ${season}`);
  }

  // ---- pull: one isolated kind='backtest' row per run (upsert on run_id) ----
  const pull = db
    .prepare(
      `INSERT INTO pull (run_id, raw_path, captured_at, ingested_at, status, kind, season, source_summary)
       VALUES (@run_id, @raw_path, @captured_at, @ingested_at, 'ok', 'backtest', @season, @source_summary)
       ON CONFLICT(run_id) DO UPDATE SET
         captured_at = excluded.captured_at, ingested_at = excluded.ingested_at,
         kind = 'backtest', season = excluded.season, source_summary = excluded.source_summary
       RETURNING pull_id`
    )
    .get({
      run_id: runId,
      raw_path: `data/raw/${runId}`,
      captured_at: manifest.started_at,
      ingested_at: new Date().toISOString(),
      season,
      source_summary: JSON.stringify(manifest.sources ?? null),
    });
  const pullId = pull.pull_id;

  // idempotent replace of this pull's snapshot rows
  db.prepare(`DELETE FROM market_ranking WHERE pull_id = ?`).run(pullId);
  db.prepare(`DELETE FROM projection_source WHERE pull_id = ?`).run(pullId);

  // ---- ECR board -> market_ranking (the baseline) ----
  const board = mapFpBoard(boardJson, `${runId}/${ECR_BOARD_FILE}`);
  const fetchedAt =
    manifest.responses?.find((r) => r.file?.endsWith(ECR_BOARD_FILE))?.fetched_at ??
    manifest.started_at;

  // Add ONLY missing players so the projection_source FK holds and the ECR/actuals
  // joins resolve; never overwrite a current player's identity row.
  //
  // We deliberately DO NOT write fp_player_id here (review finding, 2026-08-26).
  // The live ingest builds its projection→player link from an UN-pull-scoped
  // `SELECT fp_player_id, cbs_player_id FROM player` (ingest.mjs), and fp_player_id
  // has no UNIQUE constraint — so a historical-only player whose fpid later collides
  // with a current player's fpid (a cross-season FantasyPros remap) could mis-link a
  // LIVE projection. The loader joins fpid→cbsid via its own in-memory `cbsIdByFp`
  // (below), so it never needs player.fp_player_id; leaving it NULL keeps the shared
  // player table's fp_player_id sourced purely from current pulls.
  const addPlayer = db.prepare(
    `INSERT INTO player (cbs_player_id, name, pos, nfl_team, bye_week, pull_id, fetched_at)
     VALUES (@cbs_player_id, @name, @pos, @nfl_team, @bye_week, @pull_id, @fetched_at)
     ON CONFLICT(cbs_player_id) DO NOTHING`
  );
  const insertRanking = db.prepare(
    `INSERT INTO market_ranking (pull_id, fp_player_id, cbs_player_id, player_name, player_pos,
                                 player_team, bye_week, ranking_type, scoring_format, position_scope,
                                 week, rank_ecr, pos_rank, tier, rank_min, rank_max, rank_ave,
                                 rank_std, total_experts, source_endpoint, fetched_at)
     VALUES (@pull_id, @fp_player_id, @cbs_player_id, @player_name, @player_pos,
             @player_team, @bye_week, @ranking_type, @scoring_format, @position_scope,
             @week, @rank_ecr, @pos_rank, @tier, @rank_min, @rank_max, @rank_ave,
             @rank_std, @total_experts, @source_endpoint, @fetched_at)`
  );

  const cbsIdByFp = new Map();
  let rankingRows = 0;
  for (const r of board.rows) {
    if (r.cbsPlayerId !== null) {
      cbsIdByFp.set(r.fpPlayerId, r.cbsPlayerId);
      addPlayer.run({
        cbs_player_id: r.cbsPlayerId, name: r.playerName, pos: r.playerPos,
        nfl_team: r.playerTeam, bye_week: r.byeWeek,
        pull_id: pullId, fetched_at: fetchedAt,
      });
    }
    insertRanking.run({
      pull_id: pullId, fp_player_id: r.fpPlayerId, cbs_player_id: r.cbsPlayerId,
      player_name: r.playerName, player_pos: r.playerPos, player_team: r.playerTeam,
      bye_week: r.byeWeek, ranking_type: board.rankingType, scoring_format: board.scoringFormat,
      position_scope: board.positionScope, week: board.week, rank_ecr: r.rankEcr,
      pos_rank: r.posRank, tier: r.tier, rank_min: r.rankMin, rank_max: r.rankMax,
      rank_ave: r.rankAve, rank_std: r.rankStd, total_experts: board.totalExperts,
      source_endpoint: ECR_BOARD_FILE, fetched_at: fetchedAt,
    });
    rankingRows++;
  }

  // ---- projections -> projection_source (the engine's input) ----
  const proj = mapProjections(projJson, `${runId}/${PROJECTIONS_FILE}`);
  const projFetchedAt =
    manifest.responses?.find((r) => r.file?.endsWith(PROJECTIONS_FILE))?.fetched_at ??
    manifest.started_at;
  const insertProjection = db.prepare(
    `INSERT INTO projection_source
       (pull_id, cbs_player_id, fp_player_id, player_name, pos, nfl_team, season, week,
        pass_att, pass_cmp, pass_yds, pass_td, pass_int, rush_att, rush_yds, rush_td,
        rec_rec, rec_yds, rec_td, fumbles, two_pt, fp_points, source_endpoint, fetched_at)
     VALUES
       (@pull_id, @cbs_player_id, @fp_player_id, @player_name, @pos, @nfl_team, @season, @week,
        @pass_att, @pass_cmp, @pass_yds, @pass_td, @pass_int, @rush_att, @rush_yds, @rush_td,
        @rec_rec, @rec_yds, @rec_td, @fumbles, @two_pt, @fp_points, @source_endpoint, @fetched_at)`
  );
  let projMatched = 0;
  for (const r of proj.rows) {
    const cbsId = cbsIdByFp.get(r.fpPlayerId) ?? null;
    if (cbsId !== null) projMatched++;
    insertProjection.run({
      pull_id: pullId, cbs_player_id: cbsId, fp_player_id: r.fpPlayerId,
      player_name: r.playerName, pos: r.pos, nfl_team: r.nflTeam,
      season: r.season, week: r.week,
      pass_att: r.pass_att, pass_cmp: r.pass_cmp, pass_yds: r.pass_yds,
      pass_td: r.pass_td, pass_int: r.pass_int, rush_att: r.rush_att,
      rush_yds: r.rush_yds, rush_td: r.rush_td, rec_rec: r.rec_rec,
      rec_yds: r.rec_yds, rec_td: r.rec_td, fumbles: r.fumbles, two_pt: r.two_pt,
      fp_points: r.fpPoints, source_endpoint: PROJECTIONS_FILE, fetched_at: projFetchedAt,
    });
  }

  return { season, runId, pullId, rankingRows, projections: proj.rows.length, projMatched };
}

/** Load every discovered backtest season inside one transaction per season. */
export function loadAllBacktest(db, rawRoot = RAW_ROOT, seasons = BACKTEST_SEASONS) {
  const found = discoverBacktestRuns(rawRoot, seasons);
  return found.map((f) => db.transaction(() => loadBacktestSeason(db, f, rawRoot))());
}

// ---------------------------------------------------------------------------

function main() {
  const db = openDb();
  applyMigrations(db, { log: console.log });
  console.log(`\nBacktest loader — historical FantasyPros -> ${DB_PATH}`);

  const found = discoverBacktestRuns();
  if (found.length === 0) {
    console.error(
      `  No historical FP snapshots found in ${RAW_ROOT}.\n` +
        `  Capture them first: set FP_SEASON=2024 (then 2025) and run "npm run archive"\n` +
        `  with the CBS cookie blank (FP-only), then re-run this loader.`
    );
    db.close();
    process.exit(1);
  }

  for (const f of found) {
    try {
      const s = db.transaction(() => loadBacktestSeason(db, f))();
      console.log(
        `  ✔ ${s.season}  run ${s.runId}  pull #${s.pullId}  ` +
          `ecr:${s.rankingRows}  projections:${s.projections} (matched ${s.projMatched})`
      );
    } catch (err) {
      console.error(`  ✘ ${f.season} (${f.runId}) — ${err.message}`);
      db.close();
      process.exit(1);
    }
  }
  console.log(`\n  Loaded ${found.length} backtest season(s), isolated as kind='backtest' (invisible to the live board).`);
  db.close();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
