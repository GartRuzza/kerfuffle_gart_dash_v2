// KERFUFFLE projection engine — the DB orchestrator (issue #18).
//
// Reads the normalized store (projection_source = FantasyPros projected volume;
// scoring_rule = parsed KERFUFFLE scoring; player_season_stats = our league's
// 2024+2025 first-down history), runs the pure core, and writes the derived
// layer: one engine_run stamp + one projection row per player.
//
// This is a SEPARATE offline step, run AFTER the data is loaded:
//   npm run ingest              (loads current-season projections + scoring)
//   npm run ingest:historical   (loads the first-down history)
//   npm run engine              (THIS — computes Kerf points / ranks / tiers)
//
// The app then reads the latest engine_run's projection rows through lib/data/.
// No dollars: VORP / replacement / price / Edge are the valuation issue (#20).

import { pathToFileURL } from "node:url";
import { openDb, applyMigrations, DB_PATH } from "../../db/client.mjs";
import { buildScoringMap } from "../ingest/scoring-crosscheck.mjs";
import {
  deriveFirstDownRates,
  derivePlayerRates,
  scoreProjection,
  assignRanks,
  assignTiers,
} from "./core.mjs";

const RATE_SEASONS = [2024, 2025]; // owner, 2026-08-26: pool both for stable rates
const FD_METHOD = "per_player_eb_shrinkage"; // per-player rate shrunk toward position (D-14)
// Shrinkage pseudo-counts — "opportunities of position-average evidence" blended
// in before a player's own rate dominates. Moderate (owner, 2026-08-26): ~half a
// season. The backtest (#19) will calibrate these; they are the one tuning knob.
const SHRINKAGE = { rushK: 75, recK: 40 };
const POSITIONS = ["QB", "RB", "WR", "TE"];

// Number of distinct FantasyPros tiers on the superflex board — the count we
// calibrate our Jenks tiers to, so the Kerf board never shows wildly more or
// fewer bands than the market board the owner is used to reading.
//
// The OP board carries OVERALL-board tier numbers, so `perPos` is the count of
// distinct overall tiers a position SPANS — a proxy for a true positional-tier
// count (FantasyPros' STD/OP position-scoped tiers aren't all archived). It only
// sets `k` for Jenks (with a || fallback), so the effect is cosmetic, and it
// matches how the app already bands positional ECR (posEcrTier = the OP tier).
function fpTierCounts(db, pullId) {
  const overall = db
    .prepare(
      `SELECT COUNT(DISTINCT tier) c FROM market_ranking
       WHERE pull_id = ? AND ranking_type='draft' AND scoring_format='STD'
         AND position_scope='OP' AND tier IS NOT NULL`
    )
    .get(pullId).c;
  const perPos = {};
  for (const row of db
    .prepare(
      `SELECT player_pos, COUNT(DISTINCT tier) c FROM market_ranking
       WHERE pull_id = ? AND ranking_type='draft' AND scoring_format='STD'
         AND position_scope='OP' AND tier IS NOT NULL
       GROUP BY player_pos`
    )
    .all(pullId)) {
    perPos[row.player_pos] = row.c;
  }
  return { overall: overall || 10, perPos };
}

export function runEngine(db, { log = () => {} } = {}) {
  const latest = db.prepare(`SELECT pull_id FROM latest_pull`).get()?.pull_id;
  if (!latest) throw new Error(`no ingested pull — run "npm run ingest" first`);

  const src = db
    .prepare(
      `SELECT * FROM projection_source
       WHERE pull_id = ? AND cbs_player_id IS NOT NULL AND pos IN ('QB','RB','WR','TE')`
    )
    .all(latest);
  if (src.length === 0) {
    throw new Error(
      `no projection_source rows for the latest pull — run "npm run ingest" ` +
        `(the projections feed must be archived and ingested first)`
    );
  }

  const statRows = db
    .prepare(
      `SELECT cbs_player_id, pos, rush_att, rush_yds, rush_first_downs, rec_rec, rec_yds, rec_first_downs
       FROM player_season_stats WHERE season IN (${RATE_SEASONS.map(() => "?").join(",")})`
    )
    .all(...RATE_SEASONS);
  if (statRows.length === 0) {
    throw new Error(
      `no player_season_stats for seasons ${RATE_SEASONS.join("/")} — run "npm run ingest:historical" ` +
        `(the first-down rates come from league history)`
    );
  }

  const positionRates = deriveFirstDownRates(statRows);
  const playerRates = derivePlayerRates(statRows, positionRates, SHRINKAGE);
  const coef = buildScoringMap(db, latest);

  // Score every projected player with HIS OWN shrunk first-down rate (falling
  // back to the position rate when he has no league history — rookies, etc.).
  const scored = src.map((s) => {
    const r = scoreProjection(s, positionRates, coef, playerRates.get(s.cbs_player_id) ?? null);
    return { src: s, ...r, cbsId: s.cbs_player_id, pos: s.pos };
  });

  // Ranks over the whole pool (one pool → superflex elevates QBs correctly).
  const ranks = assignRanks(scored.map((p) => ({ cbsId: p.cbsId, pos: p.pos, kerfPoints: p.kerfPoints })));

  // Tiers: overall pool + each position, each Jenks-banded to FP's own count.
  const fp = fpTierCounts(db, latest);
  const ovrTiers = assignTiers(
    scored.map((p) => ({ cbsId: p.cbsId, kerfPoints: p.kerfPoints })),
    fp.overall
  );
  const posTiers = new Map();
  for (const pos of POSITIONS) {
    const list = scored.filter((p) => p.pos === pos).map((p) => ({ cbsId: p.cbsId, kerfPoints: p.kerfPoints }));
    const k = fp.perPos[pos] || 6;
    for (const [cbsId, tier] of assignTiers(list, k)) posTiers.set(cbsId, tier);
  }

  // ---- write: one engine_run stamp + one projection row per player ----
  const run = db
    .prepare(
      `INSERT INTO engine_run
         (created_at, projection_pull_id, scoring_pull_id, rate_seasons, fd_method, params_json, notes)
       VALUES (@created_at, @pull, @pull, @rate_seasons, @fd_method, @params, @notes)
       RETURNING engine_run_id`
    )
    .get({
      created_at: new Date().toISOString(),
      pull: latest,
      rate_seasons: JSON.stringify(RATE_SEASONS),
      fd_method: FD_METHOD,
      params: JSON.stringify({ shrinkage: SHRINKAGE, tierCalibration: "fantasypros-op-board", fpTierCounts: fp }),
      notes: `Kerf projection core: ${scored.length} players scored from FantasyPros projections + per-player estimated first downs (shrunk toward position).`,
    });
  const engineRunId = run.engine_run_id;

  const insert = db.prepare(
    `INSERT INTO projection
       (engine_run_id, cbs_player_id, pos, kerf_points, est_rush_first_downs, est_rec_first_downs,
        rush_fd_rate, rec_fd_rate, components_json, kerf_ovr_rank, kerf_pos_rank, kerf_ovr_tier, kerf_pos_tier)
     VALUES
       (@engine_run_id, @cbs_player_id, @pos, @kerf_points, @est_rush_first_downs, @est_rec_first_downs,
        @rush_fd_rate, @rec_fd_rate, @components_json, @kerf_ovr_rank, @kerf_pos_rank, @kerf_ovr_tier, @kerf_pos_tier)`
  );
  for (const p of scored) {
    const rk = ranks.get(p.cbsId);
    insert.run({
      engine_run_id: engineRunId,
      cbs_player_id: p.cbsId,
      pos: p.pos,
      kerf_points: p.kerfPoints,
      est_rush_first_downs: Math.round(p.estRushFD * 100) / 100,
      est_rec_first_downs: Math.round(p.estRecFD * 100) / 100,
      rush_fd_rate: p.rushFdRate,
      rec_fd_rate: p.recFdRate,
      components_json: JSON.stringify({ scored: p.scored, contributions: p.contributions, fd: p.fd }),
      kerf_ovr_rank: rk.ovrRank,
      kerf_pos_rank: rk.posRank,
      kerf_ovr_tier: ovrTiers.get(p.cbsId) ?? null,
      kerf_pos_tier: posTiers.get(p.cbsId) ?? null,
    });
  }

  return { engineRunId, count: scored.length, fp, ranks, scored };
}

// ---------------------------------------------------------------------------

function main() {
  const db = openDb();
  applyMigrations(db, { log: console.log });
  console.log(`\nEngine — projection core -> ${DB_PATH}`);

  let result;
  try {
    result = db.transaction(() => runEngine(db, { log: console.log }))();
  } catch (err) {
    console.error(`  ✘ engine run failed — nothing written:\n      ${err.message}`);
    db.close();
    process.exit(1);
  }

  console.log(`  ✔ engine_run #${result.engineRunId}: ${result.count} players scored`);
  console.log(
    `      tier calibration (from FantasyPros superflex board): overall ${result.fp.overall} tiers · ` +
      `by position ${JSON.stringify(result.fp.perPos)}`
  );

  // Superflex sanity check — a top-5 QB must sit near the top of the OVERALL pool.
  const top = db
    .prepare(
      `SELECT p.kerf_ovr_rank, p.pos, pl.name, ROUND(p.kerf_points,1) pts
       FROM projection p JOIN player pl ON pl.cbs_player_id = p.cbs_player_id
       WHERE p.engine_run_id = ? ORDER BY p.kerf_ovr_rank LIMIT 10`
    )
    .all(result.engineRunId);
  console.log(`\n  Top 10 overall (superflex sanity — QBs should appear high):`);
  for (const r of top) console.log(`      ${String(r.kerf_ovr_rank).padStart(2)}. ${r.pos.padEnd(3)} ${r.name} — ${r.pts} pts`);
  const topQb = db
    .prepare(
      `SELECT MIN(kerf_ovr_rank) r FROM projection WHERE engine_run_id = ? AND pos='QB'`
    )
    .get(result.engineRunId).r;
  console.log(`\n  Best QB overall rank: ${topQb} ${topQb <= 5 ? "✔ (QBs correctly premium in superflex)" : "⚠ unexpectedly low — check the pool"}`);

  db.close();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
