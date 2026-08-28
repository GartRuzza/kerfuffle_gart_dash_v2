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
import {
  replacementBaselines,
  replacementPoints,
  par,
  dollarsPerPoint,
  leagueValue,
  rosterReplacementPoints,
  rosterValue,
  buildPriceCurve,
  priceFromCurve,
  PRICED_POSITIONS,
  N_TEAMS,
  TEAM_BUDGET,
  ROSTER_SPOTS_PER_TEAM,
  QB_REPLACEMENT_PER_TEAM,
} from "./valuation.mjs";

const RATE_SEASONS = [2024, 2025]; // owner, 2026-08-26: pool both for stable rates
const FD_METHOD = "per_player_eb_shrinkage_rec_only"; // receiving player-specific; rushing = position (D-16)
// Shrinkage pseudo-counts — "opportunities of position-average evidence" blended
// in before a player's own rate dominates. Moderate (owner, 2026-08-26): ~half a
// season. Applies to RECEIVING (the persistent signal); rushing is not per-player.
const SHRINKAGE = { rushK: 75, recK: 40 };
// FD player-specific policy (D-16, from the #19 backtest): a player's RUSHING
// first-down rate barely persists year to year (ρ≈0.14 — near noise), so
// estimating it per-player added error; his RECEIVING rate persists (ρ≈0.52), so
// it stays player-specific. Rushing falls back to the position average for all.
// Exported so the backtest scores the SAME model the app ships.
export const FD_POLICY = { rushPlayerSpecific: false, recPlayerSpecific: true };
const POSITIONS = ["QB", "RB", "WR", "TE"];
// The owner's own team — the roster the roster-aware ceiling is computed against.
const RACCOONS_TEAM = "Rangoon Raccoons";

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

// ---------------------------------------------------------------------------
// Valuation (issue #20, D-13): Kerf points → auction dollars.
//
// Reads the salaries + the Raccoons roster from the store, turns each scored
// player's points into a league-generic ceiling ($), a Raccoons-specific ceiling
// ($), and two market prices (current-salary + 2025 price curves). All salary/
// roster inputs are optional — a tiny store with no salaries still values points
// (market prices just come back null), so the projection tests keep passing.
// ---------------------------------------------------------------------------
export function computeValuation(db, pullId, scored, ranks) {
  const priced = scored.filter((p) => PRICED_POSITIONS.includes(p.pos));

  // 1. Replacement level (last-starter) + the projected points at each baseline.
  const baselines = replacementBaselines();
  const replPoints = replacementPoints(
    scored.map((p) => ({ pos: p.pos, kerfPoints: p.kerfPoints })),
    baselines
  );

  // 2. Marginal $/point over the priced pool.
  const dpp = dollarsPerPoint(
    priced.map((p) => ({ pos: p.pos, kerfPoints: p.kerfPoints })),
    replPoints
  );

  // 3. The Raccoons' own worst-eligible-starter replacement level.
  const rosterRows = db
    .prepare(
      `SELECT c.cbs_player_id FROM contract c
         JOIN fantasy_team t ON t.team_id = c.team_id
        WHERE c.pull_id = ? AND c.row_type = 'player' AND t.name = ?`
    )
    .all(pullId, RACCOONS_TEAM);
  const rosterIds = new Set(rosterRows.map((r) => r.cbs_player_id));
  const roster = priced
    .filter((p) => rosterIds.has(p.cbsId))
    .map((p) => ({ pos: p.pos, kerfPoints: p.kerfPoints }));
  const rosterRepl = roster.length ? rosterReplacementPoints(roster) : {};

  // 4. Market price curves (two bases). Missing tables/rows → empty curve → null.
  const inSeasonSalaryRows = db
    .prepare(
      `SELECT pl.pos AS pos, c.cbs_player_id AS id, c.salary AS salary FROM contract c
         JOIN player pl ON pl.cbs_player_id = c.cbs_player_id
        WHERE c.pull_id = ? AND c.row_type = 'player' AND c.salary IS NOT NULL AND c.salary > 0`
    )
    .all(pullId);
  const inSeasonSalaries = inSeasonSalaryRows.map((r) => ({ pos: r.pos, salary: r.salary }));
  // Per-player actual salary. "Market (Now)" shows a rostered player's OWN current
  // salary (their true market price today); free agents — who have no salary — fall
  // back to the rank-based price curve below (owner, 2026-08-26; see D-17 addendum).
  const salaryByPlayer = new Map(inSeasonSalaryRows.map((r) => [r.id, r.salary]));
  const preAuctionSalaries = tableExists(db, "contract_history")
    ? db
        .prepare(
          `SELECT pos, salary FROM contract_history
            WHERE season = 2025 AND salary IS NOT NULL AND pos IS NOT NULL`
        )
        .all()
    : [];
  const curveInSeason = buildPriceCurve(inSeasonSalaries);
  const curvePreAuction = buildPriceCurve(preAuctionSalaries);

  // 5. Per-player valuation rows.
  const valuations = priced.map((p) => {
    const repl = replPoints[p.pos];
    const parLeague = par(p.kerfPoints, repl);
    const kerfVal = leagueValue(p.kerfPoints, repl, dpp.dollarsPerPoint);
    const rv = roster.length
      ? rosterValue(p.kerfPoints, p.pos, rosterRepl, replPoints, dpp.dollarsPerPoint)
      : { rosterReplPoints: null, parRoster: null, value: null };
    const posRank = ranks.get(p.cbsId)?.posRank ?? null;
    // Market (Now): a rostered player's actual current salary; a free agent's
    // rank-based curve price. Market (Auction) stays the pre-auction curve for all.
    const actualSalary = salaryByPlayer.get(p.cbsId) ?? null;
    const marketInSeason =
      actualSalary != null ? actualSalary : priceFromCurve(curveInSeason, p.pos, posRank);
    return {
      cbsId: p.cbsId,
      pos: p.pos,
      kerfPoints: p.kerfPoints,
      replPoints: repl,
      parLeague,
      kerfValue: kerfVal,
      rosterReplPoints: rv.rosterReplPoints,
      parRoster: rv.parRoster,
      rosterValue: rv.value,
      marketInSeason,
      marketPreAuction: priceFromCurve(curvePreAuction, p.pos, posRank),
      posRankUsed: posRank,
    };
  });

  // Internal-balance check: Σ (kerfValue − 1) over the priced pool must equal the
  // discretionary money (prices sum to the cap). Trivially true by construction —
  // it exists to catch a $/point wiring bug, not to be a modelling result.
  const excess = valuations.reduce((s, v) => s + (v.kerfValue - 1), 0);
  const capOk = Math.abs(excess - dpp.discretionary) < 1;

  return {
    baselines,
    replPoints,
    dpp,
    rosterRepl,
    rosterCount: roster.length,
    curves: { in_season: curveInSeason, pre_auction: curvePreAuction },
    valuations,
    capCheck: { excess, discretionary: dpp.discretionary, ok: capOk },
  };
}

function tableExists(db, name) {
  return !!db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?`)
    .get(name);
}

// Write one engine_run (stamped with its `horizon`) + its projection rows, and —
// only when `val` is supplied (the ROS lens) — the valuation layer. Weekly runs
// (#29) pass val=null: Kerf weekly points/ranks/tiers, NO dollars (a weekly
// auction doesn't exist). Returns the new engine_run_id.
function writeRun(db, latest, { horizon, week, scored, ranks, ovrTiers, posTiers, fp, val }) {
  const run = db
    .prepare(
      `INSERT INTO engine_run
         (created_at, projection_pull_id, scoring_pull_id, rate_seasons, fd_method, horizon, params_json, notes)
       VALUES (@created_at, @pull, @pull, @rate_seasons, @fd_method, @horizon, @params, @notes)
       RETURNING engine_run_id`
    )
    .get({
      created_at: new Date().toISOString(),
      pull: latest,
      rate_seasons: JSON.stringify(RATE_SEASONS),
      fd_method: FD_METHOD,
      horizon,
      params: JSON.stringify({
        week,
        shrinkage: SHRINKAGE,
        fdPolicy: FD_POLICY,
        tierCalibration: "fantasypros-op-board",
        fpTierCounts: fp,
        valuation: val
          ? {
              baselines: val.baselines,
              qbReplacementPerTeam: QB_REPLACEMENT_PER_TEAM, // superflex QB depth (D-19)
              nTeams: N_TEAMS,
              budget: TEAM_BUDGET,
              rosterSpotsPerTeam: ROSTER_SPOTS_PER_TEAM,
              discretionary: val.dpp.discretionary,
              dollarsPerPoint: val.dpp.dollarsPerPoint,
              totalPar: val.dpp.totalPar,
              rosterAwareTeam: RACCOONS_TEAM,
              rosterAwarePlayers: val.rosterCount,
            }
          : null,
      }),
      notes: val
        ? `Kerf projection + valuation (ROS, week ${week}): ${scored.length} scored, ${val.valuations.length} priced (VORP $${val.dpp.dollarsPerPoint.toFixed(3)}/pt).`
        : `Kerf weekly re-score (week ${week}): ${scored.length} scored, no dollars.`,
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

  if (!val) return engineRunId; // weekly: no dollars

  const insertRepl = db.prepare(
    `INSERT INTO replacement_level (engine_run_id, pos, baseline_n, replacement_points, method)
     VALUES (?, ?, ?, ?, 'last_starter')`
  );
  for (const pos of Object.keys(val.baselines)) {
    insertRepl.run(engineRunId, pos, val.baselines[pos], val.replPoints[pos] ?? null);
  }
  const insertCurve = db.prepare(
    `INSERT INTO price_curve (engine_run_id, basis, pos, pos_rank, price) VALUES (?, ?, ?, ?, ?)`
  );
  for (const [basis, curve] of Object.entries(val.curves)) {
    for (const [pos, knots] of Object.entries(curve)) {
      knots.forEach((price, i) => insertCurve.run(engineRunId, basis, pos, i + 1, price));
    }
  }
  const insertVal = db.prepare(
    `INSERT INTO valuation
       (engine_run_id, cbs_player_id, pos, kerf_points, replacement_points, par_league, kerf_value,
        roster_repl_points, par_roster, roster_value, market_in_season, market_pre_auction,
        pos_rank_used, components_json)
     VALUES
       (@engine_run_id, @cbs_player_id, @pos, @kerf_points, @replacement_points, @par_league, @kerf_value,
        @roster_repl_points, @par_roster, @roster_value, @market_in_season, @market_pre_auction,
        @pos_rank_used, @components_json)`
  );
  const round2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
  for (const v of val.valuations) {
    insertVal.run({
      engine_run_id: engineRunId,
      cbs_player_id: v.cbsId,
      pos: v.pos,
      kerf_points: v.kerfPoints,
      replacement_points: round2(v.replPoints),
      par_league: round2(v.parLeague),
      kerf_value: round2(v.kerfValue),
      roster_repl_points: round2(v.rosterReplPoints),
      par_roster: round2(v.parRoster),
      roster_value: round2(v.rosterValue),
      market_in_season: round2(v.marketInSeason),
      market_pre_auction: round2(v.marketPreAuction),
      pos_rank_used: v.posRankUsed,
      components_json: JSON.stringify({
        dollarsPerPoint: val.dpp.dollarsPerPoint,
        discretionary: val.dpp.discretionary,
        budget: TEAM_BUDGET,
        nTeams: N_TEAMS,
        rosterSpotsPerTeam: ROSTER_SPOTS_PER_TEAM,
      }),
    });
  }
  return engineRunId;
}

// Score one horizon's projection week (rank + tier), reusing shared rate/scoring
// inputs so every horizon scores the identical model. Returns null if that week
// has no projection rows. Writes via writeRun.
function scoreHorizon(db, { latest, week, horizon, positionRates, playerRates, coef, fp, withValuation }) {
  const src = db
    .prepare(
      `SELECT * FROM projection_source
       WHERE pull_id = ? AND week = ? AND cbs_player_id IS NOT NULL AND pos IN ('QB','RB','WR','TE')`
    )
    .all(latest, week);
  if (src.length === 0) return null;

  const scored = src.map((s) => {
    const r = scoreProjection(s, positionRates, coef, playerRates.get(s.cbs_player_id) ?? null, FD_POLICY);
    return { src: s, ...r, cbsId: s.cbs_player_id, pos: s.pos };
  });
  const ranks = assignRanks(scored.map((p) => ({ cbsId: p.cbsId, pos: p.pos, kerfPoints: p.kerfPoints })));
  const ovrTiers = assignTiers(scored.map((p) => ({ cbsId: p.cbsId, kerfPoints: p.kerfPoints })), fp.overall);
  const posTiers = new Map();
  for (const pos of POSITIONS) {
    const list = scored.filter((p) => p.pos === pos).map((p) => ({ cbsId: p.cbsId, kerfPoints: p.kerfPoints }));
    const k = fp.perPos[pos] || 6;
    for (const [cbsId, tier] of assignTiers(list, k)) posTiers.set(cbsId, tier);
  }
  const val = withValuation ? computeValuation(db, latest, scored, ranks) : null;
  const engineRunId = writeRun(db, latest, { horizon, week, scored, ranks, ovrTiers, posTiers, fp, val });
  return { engineRunId, count: scored.length, scored, ranks, val, week, horizon };
}

export function runEngine(db, { log = () => {} } = {}) {
  const latest = db.prepare(`SELECT pull_id FROM latest_pull`).get()?.pull_id;
  if (!latest) throw new Error(`no ingested pull — run "npm run ingest" first`);

  // Shared inputs — computed once so EVERY horizon scores the identical model
  // (same first-down rates, same scoring config, same tier-band counts).
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
  const fp = fpTierCounts(db, latest);

  // ROS lens (Option A, #28): score the refreshed full-season projection (week 0),
  // WITH the dollar valuation. This run is required.
  const ros = scoreHorizon(db, {
    latest, week: 0, horizon: "ros",
    positionRates, playerRates, coef, fp, withValuation: true,
  });
  if (!ros) {
    throw new Error(
      `no week-0 projection_source rows for the latest pull — run "npm run ingest" ` +
        `(the projections feed must be archived and ingested first)`
    );
  }

  // Weekly lens (#29): if the current week's projection was ingested (week N > 0),
  // score it as a SEPARATE 'weekly' run — Kerf weekly points/ranks/tiers, NO dollars
  // (a weekly auction doesn't exist). Optional: preseason there is no week N yet.
  const weeklyWeek =
    db.prepare(
      `SELECT MAX(week) w FROM projection_source
       WHERE pull_id = ? AND week > 0 AND cbs_player_id IS NOT NULL`
    ).get(latest)?.w ?? null;
  const weekly =
    weeklyWeek != null
      ? scoreHorizon(db, {
          latest, week: weeklyWeek, horizon: "weekly",
          positionRates, playerRates, coef, fp, withValuation: false,
        })
      : null;

  // Back-compat: the ROS run's fields stay at the top level (existing callers/tests
  // read engineRunId/count/val/scored/ranks); the weekly run is additive.
  return {
    engineRunId: ros.engineRunId, count: ros.count, fp,
    ranks: ros.ranks, scored: ros.scored, val: ros.val,
    ros, weekly, weeklyWeek,
  };
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

  // ---- valuation (issue #20) ----
  const v = result.val;
  console.log(`\n  Valuation (VORP → dollars):`);
  console.log(
    `      replacement baselines: ${Object.entries(v.baselines).map(([p, n]) => `${p}${n}`).join(" / ")}`
  );
  console.log(
    `      replacement points:    ${Object.entries(v.replPoints).map(([p, x]) => `${p} ${x == null ? "—" : x.toFixed(0)}`).join(" / ")}`
  );
  console.log(
    `      $/point ${v.dpp.dollarsPerPoint.toFixed(3)} · discretionary $${v.dpp.discretionary} · total PAR ${v.dpp.totalPar.toFixed(0)} · roster-aware players ${v.rosterCount}`
  );
  console.log(
    `      prices-sum-to-cap check: Σ(kerfValue−1)=$${v.capCheck.excess.toFixed(0)} vs discretionary $${v.capCheck.discretionary} — ${v.capCheck.ok ? "✔ balanced" : "⚠ OFF (check $/point)"}`
  );
  const topVal = db
    .prepare(
      `SELECT pl.name, va.pos, ROUND(va.kerf_value) kv, ROUND(va.roster_value) rv,
              ROUND(va.market_in_season) mkt
       FROM valuation va JOIN player pl ON pl.cbs_player_id = va.cbs_player_id
       WHERE va.engine_run_id = ? ORDER BY va.kerf_value DESC LIMIT 8`
    )
    .all(result.engineRunId);
  console.log(`\n  Top 8 by Kerf Value ($): (Kerf / Roster / Market)`);
  for (const r of topVal) {
    console.log(
      `      ${r.pos.padEnd(3)} ${r.name.padEnd(22)} $${String(r.kv).padStart(3)}  ·  RR $${String(r.rv ?? "—").padStart(3)}  ·  Mkt $${r.mkt ?? "—"}`
    );
  }

  // ---- weekly lens (issue #29) ----
  if (result.weekly) {
    console.log(
      `\n  Weekly lens (Week ${result.weeklyWeek}): engine_run #${result.weekly.engineRunId}, ` +
        `${result.weekly.count} players re-scored on the current-week projection (no dollars).`
    );
  } else {
    console.log(`\n  Weekly lens: no current-week projection ingested yet — skipped (ROS only).`);
  }

  db.close();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
