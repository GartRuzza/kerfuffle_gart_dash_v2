// Projection engine — DB integration test (issue #18, review finding R1).
//
// The pure math is covered by core.test.mjs; this exercises the DB orchestration
// runEngine() actually skipped there: reading projection_source, deriving rates
// from player_season_stats, building the scoring map from scoring_rule, the
// FantasyPros tier calibration query, and persisting engine_run + projection.
// It seeds a tiny in-memory store with migrations applied, so it needs no fixture
// files and no real (git-ignored) data.

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runEngine } from "./run.mjs";
import { buildScoringMap, recomputeKerfPoints } from "../ingest/scoring-crosscheck.mjs";

const MIGRATIONS = join(process.cwd(), "db", "migrations");

// The offensive scoring rules the engine uses, in the scoring_rule value_json shape.
const RULES = [
  { code: "PaYd", parsed: { kind: "per_unit", points_per_unit: 0.04, per_units: 1 } },
  { code: "PaTD", parsed: { kind: "flat", points: 4 } },
  { code: "PaInt", parsed: { kind: "flat", points: -2 } },
  { code: "RuYd", parsed: { kind: "per_unit", points_per_unit: 0.1, per_units: 1 } },
  { code: "RuTD", parsed: { kind: "flat", points: 6 } },
  { code: "RuFD", parsed: { kind: "flat", points: 1 } },
  { code: "ReYd", parsed: { kind: "per_unit", points_per_unit: 0.1, per_units: 1 } },
  { code: "ReTD", parsed: { kind: "flat", points: 6 } },
  { code: "ReFD", parsed: { kind: "flat", points: 1 } },
  { code: "FL", parsed: { kind: "flat", points: -2 } },
];

function seed() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  const now = "2026-08-26T00:00:00Z";
  db.prepare(
    `INSERT INTO pull (pull_id, run_id, raw_path, captured_at, ingested_at, status)
     VALUES (1, 'run', 'data/raw/run', ?, ?, 'ok')`
  ).run(now, now);

  const player = db.prepare(
    `INSERT INTO player (cbs_player_id, name, pos, nfl_team, fp_player_id, pull_id, fetched_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`
  );
  player.run(10, "Star QB", "QB", "BUF", 910, now);
  player.run(20, "Star WR", "WR", "CIN", 920, now);

  const rule = db.prepare(
    `INSERT INTO scoring_rule (pull_id, category, name, value_type, value_json, fetched_at)
     VALUES (1, 'Offensive', ?, ?, ?, ?)`
  );
  for (const r of RULES) {
    rule.run(r.code, r.parsed.kind, JSON.stringify({ code: r.code, parsed: r.parsed }), now);
  }

  // League first-down history (2024 + 2025) — gives rates by position.
  const stat = db.prepare(
    `INSERT INTO player_season_stats
       (season, cbs_player_id, cbs_name_raw, pos, rush_att, rush_first_downs, rec_rec, rec_first_downs, source, imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'test', ?)`
  );
  // QB rushing: 100 carries, 40 rush FD -> 0.4/carry
  stat.run(2024, 10, "Star QB", "QB", 50, 20, 0, 0, now);
  stat.run(2025, 10, "Star QB", "QB", 50, 20, 0, 0, now);
  // WR receiving: 100 rec, 50 rec FD -> 0.5/rec ; no carries
  stat.run(2024, 20, "Star WR", "WR", 0, 0, 50, 25, now);
  stat.run(2025, 20, "Star WR", "WR", 0, 0, 50, 25, now);

  // Projected stat lines (the engine input).
  const proj = db.prepare(
    `INSERT INTO projection_source
       (pull_id, cbs_player_id, fp_player_id, player_name, pos, season, week,
        pass_yds, pass_td, pass_int, rush_att, rush_yds, rush_td, rec_rec, rec_yds, rec_td, fumbles, two_pt, fetched_at)
     VALUES (1, ?, ?, ?, ?, 2026, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  );
  // QB: 4000 pass yds, 30 pass TD, 10 INT, 100 carries, 500 rush yds, 5 rush TD
  proj.run(10, 910, "Star QB", "QB", 4000, 30, 10, 100, 500, 5, 0, 0, 0, 0, now);
  // WR: 100 rec, 1200 rec yds, 10 rec TD
  proj.run(20, 920, "Star WR", "WR", 0, 0, 0, 0, 0, 0, 100, 1200, 10, 1, now);

  // FantasyPros superflex (OP) board — supplies the tier-calibration counts.
  const mk = db.prepare(
    `INSERT INTO market_ranking
       (pull_id, fp_player_id, cbs_player_id, player_name, player_pos, ranking_type, scoring_format, position_scope, rank_ecr, tier, fetched_at)
     VALUES (1, ?, ?, ?, ?, 'draft', 'STD', 'OP', ?, ?, ?)`
  );
  mk.run(910, 10, "Star QB", "QB", 1, 1, now);
  mk.run(920, 20, "Star WR", "WR", 2, 2, now);
  return db;
}

// Seed a current-season actuals row (issue #30) — the value the ROS run nets out.
function seedActual(db, { id, name = "Actual", pos = "QB", kerf, week = 5, season = 2026 }) {
  db.prepare(
    `INSERT INTO player_actuals
       (season, as_of_week, cbs_player_id, cbs_name_raw, pos, kerf_points, fpts_total, pull_id, fetched_at, imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')`
  ).run(season, week, id, name, pos, kerf, kerf);
}

describe("runEngine (DB integration)", () => {
  let db;
  beforeEach(() => {
    db = seed();
  });

  it("scores every projection_source row and writes one projection per player", () => {
    const res = runEngine(db);
    expect(res.count).toBe(2);
    const rows = db
      .prepare(`SELECT * FROM projection WHERE engine_run_id = ?`)
      .all(res.engineRunId);
    expect(rows).toHaveLength(2);
  });

  it("estimates first downs from projected volume via the league rates", () => {
    const res = runEngine(db);
    const qb = db.prepare(`SELECT * FROM projection WHERE engine_run_id=? AND cbs_player_id=10`).get(res.engineRunId);
    const wr = db.prepare(`SELECT * FROM projection WHERE engine_run_id=? AND cbs_player_id=20`).get(res.engineRunId);
    // QB: 100 carries * 0.4 = 40 rush FD ; WR: 100 rec * 0.5 = 50 rec FD
    expect(qb.est_rush_first_downs).toBeCloseTo(40, 6);
    expect(wr.est_rec_first_downs).toBeCloseTo(50, 6);
    expect(qb.rush_fd_rate).toBeCloseTo(0.4, 6);
    expect(wr.rec_fd_rate).toBeCloseTo(0.5, 6);
  });

  it("ranks the pool by points (QB tops it) and assigns tiers", () => {
    const res = runEngine(db);
    const qb = db.prepare(`SELECT * FROM projection WHERE engine_run_id=? AND cbs_player_id=10`).get(res.engineRunId);
    const wr = db.prepare(`SELECT * FROM projection WHERE engine_run_id=? AND cbs_player_id=20`).get(res.engineRunId);
    // QB: 160 (pass yd) + 120 (pass td) - 20 (int) + 50 (rush yd) + 30 (rush td) + 40 (rush FD) = 380
    // WR: 120 (rec yd) + 60 (rec td) + 50 (rec FD) - 2 (fumble) = 288
    expect(qb.kerf_points).toBeGreaterThan(wr.kerf_points);
    expect(qb.kerf_ovr_rank).toBe(1);
    expect(wr.kerf_ovr_rank).toBe(2);
    expect(qb.kerf_pos_rank).toBe(1); // QB1
    expect(wr.kerf_pos_rank).toBe(1); // WR1
    expect(qb.kerf_ovr_tier).not.toBeNull();
    expect(wr.kerf_ovr_tier).not.toBeNull();
  });

  it("stored components reconstruct the points deterministically (drill-down integrity)", () => {
    const res = runEngine(db);
    const coef = buildScoringMap(db, 1);
    for (const p of db.prepare(`SELECT * FROM projection WHERE engine_run_id=?`).all(res.engineRunId)) {
      const { scored } = JSON.parse(p.components_json);
      expect(recomputeKerfPoints(scored, coef)).toBe(p.kerf_points);
    }
  });

  it("stamps the run with its inputs, and re-running makes the latest run current", () => {
    const first = runEngine(db);
    const stamp = db.prepare(`SELECT * FROM engine_run WHERE engine_run_id=?`).get(first.engineRunId);
    expect(JSON.parse(stamp.rate_seasons)).toEqual([2024, 2025]);
    expect(stamp.fd_method).toBe("per_player_eb_shrinkage_rec_only"); // D-16: rushing = position avg
    expect(JSON.parse(stamp.params_json).shrinkage).toEqual({ rushK: 75, recK: 40 });
    expect(JSON.parse(stamp.params_json).fdPolicy).toEqual({ rushPlayerSpecific: false, recPlayerSpecific: true });
    expect(stamp.projection_pull_id).toBe(1);
    expect(stamp.horizon).toBe("ros"); // the rest-of-season lens (issue #28, Option A)

    const second = runEngine(db);
    expect(second.engineRunId).toBeGreaterThan(first.engineRunId);
    const latest = db.prepare(`SELECT engine_run_id FROM latest_engine_run`).get().engine_run_id;
    expect(latest).toBe(second.engineRunId);
  });

  it("labels the run 'ros' and latest_engine_run resolves to the latest ROS run (issue #28)", () => {
    const res = runEngine(db);
    const run = db.prepare(`SELECT horizon FROM engine_run WHERE engine_run_id=?`).get(res.engineRunId);
    expect(run.horizon).toBe("ros");
    // latest_engine_run is now scoped to ROS; the by-horizon view exposes each lens.
    const latestRos = db.prepare(`SELECT engine_run_id FROM latest_engine_run`).get().engine_run_id;
    expect(latestRos).toBe(res.engineRunId);
    const byHorizon = db
      .prepare(`SELECT horizon, engine_run_id FROM latest_engine_run_by_horizon`)
      .all();
    expect(byHorizon).toEqual([{ horizon: "ros", engine_run_id: res.engineRunId }]);
  });

  it("also produces a WEEKLY run (horizon='weekly', no dollars) when a week-N projection exists (#29)", () => {
    // Add a current-week (week 1) projection for the same players — smaller lines
    // than the season, but the SAME engine scores them.
    const wproj = db.prepare(
      `INSERT INTO projection_source
         (pull_id, cbs_player_id, fp_player_id, player_name, pos, season, week,
          pass_yds, pass_td, pass_int, rush_att, rush_yds, rush_td, rec_rec, rec_yds, rec_td, fumbles, two_pt, fetched_at)
       VALUES (1, ?, ?, ?, ?, 2026, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '2026-09-10T00:00:00Z')`
    );
    wproj.run(10, 910, "Star QB", "QB", 250, 2, 1, 6, 30, 0, 0, 0, 0, 0); // QB week line
    wproj.run(20, 920, "Star WR", "WR", 0, 0, 0, 0, 0, 0, 6, 80, 1, 0);   // WR week line

    const res = runEngine(db);
    expect(res.weeklyWeek).toBe(1);
    expect(res.weekly).not.toBeNull();
    expect(res.weekly.engineRunId).not.toBe(res.ros.engineRunId); // a SEPARATE run

    // The weekly run is horizon='weekly' with its own projection rows...
    const wrun = db.prepare(`SELECT horizon FROM engine_run WHERE engine_run_id=?`).get(res.weekly.engineRunId);
    expect(wrun.horizon).toBe("weekly");
    expect(db.prepare(`SELECT COUNT(*) c FROM projection WHERE engine_run_id=?`).get(res.weekly.engineRunId).c).toBe(2);
    // ...and NO dollars (weekly cap value is meaningless).
    expect(db.prepare(`SELECT COUNT(*) c FROM valuation WHERE engine_run_id=?`).get(res.weekly.engineRunId).c).toBe(0);
    // The ROS run is separate and DID get valuation.
    expect(db.prepare(`SELECT COUNT(*) c FROM valuation WHERE engine_run_id=?`).get(res.ros.engineRunId).c).toBeGreaterThan(0);

    // latest_engine_run stays ROS; the by-horizon view now exposes BOTH lenses.
    expect(db.prepare(`SELECT engine_run_id FROM latest_engine_run`).get().engine_run_id).toBe(res.ros.engineRunId);
    const byH = db.prepare(`SELECT horizon, engine_run_id FROM latest_engine_run_by_horizon ORDER BY horizon`).all();
    expect(byH.map((r) => r.horizon)).toEqual(["ros", "weekly"]);
  });

  it("skips the weekly run when only a season projection exists (preseason)", () => {
    const res = runEngine(db); // seed has only week-0 projections
    expect(res.weeklyWeek).toBeNull();
    expect(res.weekly).toBeNull();
    const horizons = db.prepare(`SELECT DISTINCT horizon FROM engine_run`).all().map((r) => r.horizon);
    expect(horizons).toEqual(["ros"]);
  });

  // ---- Option B: net current-season actuals (issue #30) ----

  it("with no actuals ingested, the ROS run is Option A — full-season, nothing netted", () => {
    const res = runEngine(db); // seed has no player_actuals rows
    expect(res.ros.net).toBeNull();
    const qb = db.prepare(`SELECT * FROM projection WHERE engine_run_id=? AND cbs_player_id=10`).get(res.engineRunId);
    expect(qb.kerf_points).toBeCloseTo(380, 6); // full-season, unchanged
    expect(qb.season_points).toBeNull(); // no netting → context columns stay null
    expect(qb.actuals_points).toBeNull();
  });

  it("nets actuals to REMAINING points and re-ranks the whole lens (owner: net everything)", () => {
    // QB full-season ≈ 380, WR ≈ 228. Bank 300 of the QB's points → 80 remaining,
    // which drops him BELOW the WR: the ROS ranking flips, not just the dollars.
    seedActual(db, { id: 10, name: "Star QB", pos: "QB", kerf: 300, week: 5 });
    const res = runEngine(db);

    expect(res.ros.net).toMatchObject({ asOfWeek: 5, playersWithActuals: 1 });
    const qb = db.prepare(`SELECT * FROM projection WHERE engine_run_id=? AND cbs_player_id=10`).get(res.engineRunId);
    const wr = db.prepare(`SELECT * FROM projection WHERE engine_run_id=? AND cbs_player_id=20`).get(res.engineRunId);

    // drill-down: full-season → minus actuals → remaining (= kerf_points)
    expect(qb.season_points).toBeCloseTo(380, 6);
    expect(qb.actuals_points).toBeCloseTo(300, 6);
    expect(qb.kerf_points).toBeCloseTo(80, 6);
    expect(qb.actuals_as_of_week).toBe(5);
    // the WR had no actuals: remaining == full-season
    expect(wr.actuals_points).toBe(0);
    expect(wr.kerf_points).toBeCloseTo(228, 0);

    // net EVERYTHING: the ranking now reflects remaining value — WR passes the QB.
    expect(wr.kerf_ovr_rank).toBe(1);
    expect(qb.kerf_ovr_rank).toBe(2);

    // dollars price the REMAINING points (valuation.kerf_points is the netted value).
    const qbVal = db.prepare(`SELECT kerf_points FROM valuation WHERE engine_run_id=? AND cbs_player_id=10`).get(res.engineRunId);
    expect(qbVal.kerf_points).toBeCloseTo(80, 6);
  });

  it("floors remaining at 0 — a player who outscored his projection nets to zero, never negative", () => {
    seedActual(db, { id: 10, name: "Star QB", pos: "QB", kerf: 500, week: 8 }); // 500 > 380 projection
    const res = runEngine(db);
    const qb = db.prepare(`SELECT * FROM projection WHERE engine_run_id=? AND cbs_player_id=10`).get(res.engineRunId);
    expect(qb.season_points).toBeCloseTo(380, 6);
    expect(qb.actuals_points).toBeCloseTo(500, 6);
    expect(qb.kerf_points).toBe(0); // floored, not -120
    // PAR/value also floor at 0 → the minimum $1 ceiling, never negative.
    const qbVal = db.prepare(`SELECT par_league, kerf_value FROM valuation WHERE engine_run_id=? AND cbs_player_id=10`).get(res.engineRunId);
    expect(qbVal.par_league).toBe(0);
    expect(qbVal.kerf_value).toBeLessThanOrEqual(1);
  });

  it("stamps the netting on the engine_run params for transparency", () => {
    seedActual(db, { id: 10, name: "Star QB", pos: "QB", kerf: 120, week: 6 });
    const res = runEngine(db);
    const params = JSON.parse(db.prepare(`SELECT params_json FROM engine_run WHERE engine_run_id=?`).get(res.engineRunId).params_json);
    expect(params.netActuals).toMatchObject({ asOfWeek: 6, playersWithActuals: 1 });
  });
});
