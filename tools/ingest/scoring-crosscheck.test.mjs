// Scoring-engine cross-check tests (issue #17). Two layers, per the owner's
// "do both" decision (2026-08-26):
//   1. A PURE unit test of the recompute logic — always runs, no DB. It proves
//      the component-sum reproduces a known KERFUFFLE total exactly.
//   2. A REAL-DATA integration check against the loaded historical store — runs
//      only where the (git-ignored) historical data is present, and reports BOTH
//      a tight curated-sample pass and a loose all-players pass.

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { openDb, DB_PATH } from "../../db/client.mjs";
import { recomputeKerfPoints, buildScoringMap, crossCheckSeason } from "./scoring-crosscheck.mjs";

// The real KERFUFFLE offensive coefficients (parsed from CBS /rules), inlined so
// this unit test needs no database.
const COEF = {
  PaYd: 0.04, PaTD: 4, PaInt: -2, Pa2P: 2,
  RuYd: 0.1, RuTD: 6, RuFD: 1, Ru2P: 2,
  ReYd: 0.1, ReTD: 6, ReFD: 1, Re2P: 2,
  FL: -2,
};

describe("recomputeKerfPoints (pure)", () => {
  it("reproduces Josh Allen's 2025 KERFUFFLE total from components", () => {
    // 3668*.04 + 25*4 - 10*2 + 1*2 + 579*.1 + 14*6 + 46*1 - 3*2 = 410.62
    const allen = {
      pass_yds: 3668, pass_td: 25, pass_int: 10, pass_2pt: 1,
      rush_yds: 579, rush_td: 14, rush_first_downs: 46, rush_2pt: 0,
      rec_yds: 0, rec_td: 0, rec_first_downs: 0, rec_2pt: 0, fumbles_lost: 3,
    };
    expect(recomputeKerfPoints(allen, COEF)).toBe(410.62);
  });

  it("does NOT score passing first downs (KERFUFFLE scores only rush/rec first downs)", () => {
    const base = { pass_yds: 0, pass_first_downs: 50 };
    expect(recomputeKerfPoints(base, COEF)).toBe(0);
  });

  it("scores rushing and receiving first downs at 1 pt each", () => {
    expect(recomputeKerfPoints({ rush_first_downs: 10, rec_first_downs: 5 }, COEF)).toBe(15);
  });
});

// ---- real-data cross-check (skips on a fresh clone without historical data) ----

function hasHistorical() {
  if (!existsSync(DB_PATH)) return false;
  try {
    const db = openDb({ readonly: true });
    const t = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='player_season_stats'`).get();
    const n = t ? db.prepare(`SELECT COUNT(*) c FROM player_season_stats`).get().c : 0;
    db.close();
    return n > 0;
  } catch { return false; }
}

const RUN = hasHistorical();

describe.skipIf(!RUN)("scoring cross-check vs CBS FPTS Total (real loaded data)", () => {
  // Curated clean-profile sample across positions — no return/ST noise, so these
  // should land essentially exactly on CBS's total.
  const SAMPLE = [
    "Josh Allen", "Lamar Jackson",           // QB
    "Bijan Robinson", "Jonathan Taylor", "Saquon Barkley", // RB
    "Ja'Marr Chase", "Puka Nacua",           // WR
    "Trey McBride", "Brock Bowers",          // TE
  ];

  it("tight sample: clean players match CBS FPTS within 0.5 pt (2025)", () => {
    const db = openDb({ readonly: true });
    const r = crossCheckSeason(db, 2025);
    db.close();
    for (const name of SAMPLE) {
      const hit = r.results.find((x) => x.name.toLowerCase().includes(name.toLowerCase()));
      expect(hit, `sample player "${name}" present`).toBeTruthy();
      expect(Math.abs(hit.diff), `${name} diff ${hit?.diff}`).toBeLessThanOrEqual(0.5);
    }
  });

  it("loose all-players: ≥95% within 1 pt, ≥99% within 5 pt, no positive misalignment (2024 & 2025)", () => {
    const db = openDb({ readonly: true });
    for (const season of [2024, 2025]) {
      const r = crossCheckSeason(db, season);
      expect(r.total).toBeGreaterThan(500);
      expect(r.within_1 / r.total, `${season} within 1pt`).toBeGreaterThanOrEqual(0.95);
      expect(r.within_5 / r.total, `${season} within 5pt`).toBeGreaterThanOrEqual(0.99);
      // Every residual is a small NEGATIVE (CBS awards ST/return points the
      // offensive export omits). A positive diff would mean we double-count a
      // column — assert none exceeds a rounding whisker.
      const maxDiff = Math.max(...r.results.map((x) => x.diff));
      const minDiff = Math.min(...r.results.map((x) => x.diff));
      expect(maxDiff, `${season} max diff`).toBeLessThanOrEqual(0.5);
      expect(minDiff, `${season} min diff`).toBeGreaterThanOrEqual(-12);
    }
    db.close();
  });
});
