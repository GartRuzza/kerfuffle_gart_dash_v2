// Valuation — DB integration test (issue #20).
//
// The pure math is covered by valuation.test.mjs; this exercises the DB path in
// runEngine(): reading salaries + the Raccoons roster, writing replacement_level /
// price_curve / valuation, the prices-sum-to-cap balance, and that the roster-
// aware ceiling actually differs from the league-generic one in the right
// direction. Seeds a tiny in-memory store with all migrations applied.

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runEngine } from "./run.mjs";

const MIGRATIONS = join(process.cwd(), "db", "migrations");

const RULES = [
  { code: "PaYd", parsed: { kind: "per_unit", points_per_unit: 0.04, per_units: 1 } },
  { code: "PaTD", parsed: { kind: "flat", points: 4 } },
  { code: "RuYd", parsed: { kind: "per_unit", points_per_unit: 0.1, per_units: 1 } },
  { code: "RuTD", parsed: { kind: "flat", points: 6 } },
  { code: "RuFD", parsed: { kind: "flat", points: 1 } },
  { code: "ReYd", parsed: { kind: "per_unit", points_per_unit: 0.1, per_units: 1 } },
  { code: "ReTD", parsed: { kind: "flat", points: 6 } },
  { code: "ReFD", parsed: { kind: "flat", points: 1 } },
];

// A small but position-diverse pool: enough spread that PAR is positive and the
// top players clear replacement. id, pos, projected rush/rec volume, salary (on the
// Raccoons if `rr`), and a 2025 salary for the pre-auction curve.
const P = [
  { id: 1, pos: "RB", ry: 1400, rtd: 12, rec: 60, recy: 500, rr: true, sal: 100, s25: 90 },
  { id: 2, pos: "RB", ry: 1200, rtd: 9, rec: 40, recy: 350, sal: 60, s25: 55 },
  { id: 3, pos: "RB", ry: 600, rtd: 4, rec: 20, recy: 150, rr: true, sal: 8, s25: 10 },
  { id: 4, pos: "WR", ry: 0, rtd: 0, rec: 100, recy: 1400, sal: 40, s25: 45 },
  { id: 5, pos: "WR", ry: 0, rtd: 0, rec: 70, recy: 900, rr: true, sal: 15, s25: 20 },
  { id: 6, pos: "WR", ry: 0, rtd: 0, rec: 45, recy: 500, sal: 3, s25: 5 },
  { id: 7, pos: "QB", ry: 400, rtd: 4, rec: 0, recy: 0, py: 4600, ptd: 34, rr: true, sal: 120, s25: 110 },
  { id: 8, pos: "QB", ry: 100, rtd: 2, rec: 0, recy: 0, py: 4200, ptd: 30, rr: true, sal: 30, s25: 25 },
  { id: 9, pos: "TE", ry: 0, rtd: 0, rec: 65, recy: 750, sal: 20, s25: 22 },
];

// `freeAgents` are extra players with a projection (so they get scored + Kerf-
// ranked) but NO contract row — i.e. unrostered, no salary — to exercise the
// Market (Now) curve fallback.
function seed({ freeAgents = [] } = {}) {
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

  db.prepare(`INSERT INTO fantasy_team (team_id, name, pull_id, fetched_at) VALUES (1,'Rangoon Raccoons',1,?)`).run(now);
  db.prepare(`INSERT INTO fantasy_team (team_id, name, pull_id, fetched_at) VALUES (2,'Rival Team',1,?)`).run(now);

  const player = db.prepare(
    `INSERT INTO player (cbs_player_id, name, pos, fp_player_id, pull_id, fetched_at) VALUES (?, ?, ?, ?, 1, ?)`
  );
  const rule = db.prepare(
    `INSERT INTO scoring_rule (pull_id, category, name, value_type, value_json, fetched_at) VALUES (1,'Offensive',?,?,?,?)`
  );
  for (const r of RULES) rule.run(r.code, r.parsed.kind, JSON.stringify({ code: r.code, parsed: r.parsed }), now);

  const proj = db.prepare(
    `INSERT INTO projection_source
       (pull_id, cbs_player_id, fp_player_id, player_name, pos, season, week,
        pass_yds, pass_td, pass_int, rush_att, rush_yds, rush_td, rec_rec, rec_yds, rec_td, fumbles, two_pt, fetched_at)
     VALUES (1, ?, ?, ?, ?, 2026, 0, ?, ?, 0, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
  );
  const contract = db.prepare(
    `INSERT INTO contract (pull_id, observed_at, team_id, row_type, cbs_player_id, roster_status, salary, fetched_at)
     VALUES (1, ?, ?, 'player', ?, 'Active', ?, ?)`
  );
  const hist = db.prepare(
    `INSERT INTO contract_history (season, cbs_player_id, cbs_name_raw, pos, salary, source, imported_at)
     VALUES (2025, ?, ?, ?, ?, 'test', ?)`
  );
  const mk = db.prepare(
    `INSERT INTO market_ranking (pull_id, fp_player_id, cbs_player_id, player_name, player_pos, ranking_type, scoring_format, position_scope, rank_ecr, tier, fetched_at)
     VALUES (1, ?, ?, ?, ?, 'draft', 'STD', 'OP', ?, ?, ?)`
  );
  // First-down history (2024+2025) so the engine can derive rates. Modest volume;
  // the exact rate isn't what this suite checks — it just needs to score.
  const stat = db.prepare(
    `INSERT INTO player_season_stats (season, cbs_player_id, cbs_name_raw, pos, rush_att, rush_first_downs, rec_rec, rec_first_downs, source, imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'test', ?)`
  );

  P.forEach((p, i) => {
    player.run(p.id, `Player ${p.id}`, p.pos, 900 + p.id, now);
    proj.run(p.id, 900 + p.id, `Player ${p.id}`, p.pos, p.py || 0, p.ptd || 0, p.ry ? Math.round(p.ry / 5) : 0, p.ry || 0, p.rtd || 0, p.rec || 0, p.recy || 0, 0, now);
    // rostered: Raccoons for rr players, Rival otherwise — every player has a salary.
    contract.run(now, p.rr ? 1 : 2, p.id, p.sal, now);
    hist.run(p.id, `Player ${p.id}`, p.pos, p.s25, now);
    mk.run(900 + p.id, p.id, `Player ${p.id}`, p.pos, i + 1, Math.min(i + 1, 5), now);
    for (const season of [2024, 2025]) {
      const ra = p.ry ? Math.round(p.ry / 5) : 0;
      stat.run(season, p.id, `Player ${p.id}`, p.pos, ra, Math.round(ra * 0.25), p.rec || 0, Math.round((p.rec || 0) * 0.5), now);
    }
  });

  // Free agents: projected + rankable, but no contract (no salary).
  freeAgents.forEach((p) => {
    player.run(p.id, `FA ${p.id}`, p.pos, 900 + p.id, now);
    proj.run(p.id, 900 + p.id, `FA ${p.id}`, p.pos, p.py || 0, p.ptd || 0, p.ry ? Math.round(p.ry / 5) : 0, p.ry || 0, p.rtd || 0, p.rec || 0, p.recy || 0, 0, now);
  });
  return db;
}

describe("runEngine valuation (DB integration)", () => {
  let db, res;
  beforeEach(() => {
    db = seed();
    res = runEngine(db);
  });

  it("writes one valuation row per priced (offense) player", () => {
    const n = db.prepare(`SELECT COUNT(*) c FROM valuation WHERE engine_run_id=?`).get(res.engineRunId).c;
    expect(n).toBe(P.length); // all 9 are QB/RB/WR/TE
  });

  it("records the last-starter baselines in replacement_level", () => {
    const rows = db.prepare(`SELECT pos, baseline_n FROM replacement_level WHERE engine_run_id=?`).all(res.engineRunId);
    const byPos = Object.fromEntries(rows.map((r) => [r.pos, r.baseline_n]));
    expect(byPos).toMatchObject({ QB: 30, RB: 34, WR: 34, TE: 17, DST: 12 });
  });

  it("prices sum to the cap: Σ(kerf_value − 1) == discretionary", () => {
    const rows = db.prepare(`SELECT kerf_value FROM valuation WHERE engine_run_id=?`).all(res.engineRunId);
    const excess = rows.reduce((s, r) => s + (r.kerf_value - 1), 0);
    expect(excess).toBeCloseTo(res.val.dpp.discretionary, 0); // within $1 (rows are rounded to cents)
  });

  it("builds both market price curves and prices a top player from each", () => {
    const curves = db.prepare(`SELECT DISTINCT basis FROM price_curve WHERE engine_run_id=?`).all(res.engineRunId).map((r) => r.basis);
    expect(curves.sort()).toEqual(["in_season", "pre_auction"]);
    const rb1 = db.prepare(`SELECT * FROM valuation WHERE engine_run_id=? AND cbs_player_id=1`).get(res.engineRunId);
    expect(rb1.market_in_season).not.toBeNull();
    expect(rb1.market_pre_auction).not.toBeNull();
  });

  it("Market (Now) is a rostered player's ACTUAL salary, not a curve price", () => {
    // Player 1 is rostered at $100. Its Kerf pos rank is RB1, but the top RB salary
    // knot is also 100 here — so to prove it's the salary (not the rank-1 knot) we
    // rely on the free-agent test below where the two diverge. Here we assert the
    // straightforward invariant: a rostered player's Market (Now) == its own salary.
    const rows = db.prepare(`SELECT cbs_player_id, market_in_season FROM valuation WHERE engine_run_id=?`).all(res.engineRunId);
    const salaries = Object.fromEntries(P.map((p) => [p.id, p.sal]));
    for (const r of rows) {
      expect(r.market_in_season).toBe(salaries[r.cbs_player_id]); // every seeded player is rostered
    }
  });

  it("free agents fall back to the curve; rostered players keep their actual salary", () => {
    // An unrostered RB with volume between players 2 and 3 → no salary of its own.
    const db2 = seed({ freeAgents: [{ id: 20, pos: "RB", ry: 900, rtd: 6, rec: 35, recy: 300 }] });
    const r2 = runEngine(db2);
    const fa = db2.prepare(`SELECT * FROM valuation WHERE engine_run_id=? AND cbs_player_id=20`).get(r2.engineRunId);

    // It has no contract, so Market (Now) must come from the in-season RB curve,
    // read (and clamped) by its Kerf positional rank — mirroring priceFromCurve.
    const knots = db2
      .prepare(`SELECT price FROM price_curve WHERE engine_run_id=? AND basis='in_season' AND pos='RB' ORDER BY pos_rank`)
      .all(r2.engineRunId)
      .map((k) => k.price);
    const idx = Math.min(Math.max(1, fa.pos_rank_used), knots.length) - 1;
    expect(fa.market_in_season).toBe(knots[idx]);

    // ...while a rostered player still shows its real salary.
    const rb1 = db2.prepare(`SELECT market_in_season FROM valuation WHERE engine_run_id=? AND cbs_player_id=1`).get(r2.engineRunId);
    expect(rb1.market_in_season).toBe(100);
  });

  it("computes a Raccoons-specific roster value that differs from the generic ceiling", () => {
    // The Raccoons roster a startable WR (player 5). Its worst WR-eligible starter
    // therefore beats the league's weakest WR, so the roster-aware bar is HIGHER
    // than league replacement → an added WR is worth LESS to us than league-generic.
    const wr = db.prepare(`SELECT * FROM valuation WHERE engine_run_id=? AND cbs_player_id=4`).get(res.engineRunId);
    expect(wr.roster_value).not.toBeNull();
    expect(wr.roster_repl_points).toBeGreaterThan(wr.replacement_points);
    expect(wr.roster_value).toBeLessThan(wr.kerf_value);
  });

  it("stamps the valuation params on the engine_run", () => {
    const stamp = db.prepare(`SELECT params_json FROM engine_run WHERE engine_run_id=?`).get(res.engineRunId);
    const v = JSON.parse(stamp.params_json).valuation;
    expect(v.rosterSpotsPerTeam).toBe(19);
    expect(v.rosterAwareTeam).toBe("Rangoon Raccoons");
    expect(v.dollarsPerPoint).toBeGreaterThan(0);
  });
});
