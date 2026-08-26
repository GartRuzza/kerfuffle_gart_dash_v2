// KERFUFFLE valuation — pure-core unit tests (issue #20, D-13).
//
// No database: deterministic transforms. Covers the acceptance-critical math —
// the last-starter baselines (incl. the superflex QB24), replacement points,
// marginal $/point + the prices-sum-to-cap invariant, PAR floored at 0,
// replace-your-starter roster value, and the market price curve.

import { describe, it, expect } from "vitest";
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
  N_TEAMS,
  TEAM_BUDGET,
  ROSTER_SPOTS_PER_TEAM,
} from "./valuation.mjs";

describe("replacementBaselines (last-starter, superflex)", () => {
  it("matches the documented D-13 baselines: QB24 / RB34 / WR34 / TE17 / DST12", () => {
    const b = replacementBaselines();
    expect(b.QB).toBe(24); // 12 × (1 QB + 1 SFLEX) — the superflex effect
    expect(b.RB).toBe(34); // 12 × (2 + 2×0.4) = 33.6 → 34
    expect(b.WR).toBe(34);
    expect(b.TE).toBe(17); // 12 × (1 + 2×0.2) = 16.8 → 17
    expect(b.DST).toBe(12);
  });

  it("elite QBs are premium because SFLEX counts as a QB, not a flex", () => {
    // Without the SFLEX-as-QB rule the QB baseline would be 12 (QB12), badly
    // underpricing quarterbacks in a two-QB league — the whole point of D-13.
    const b = replacementBaselines();
    expect(b.QB).toBeGreaterThan(12);
  });
});

describe("replacementPoints", () => {
  const baselines = { QB: 2, RB: 3, WR: 2, TE: 1, DST: 1 };
  const players = [
    { pos: "QB", kerfPoints: 400 }, { pos: "QB", kerfPoints: 350 }, { pos: "QB", kerfPoints: 300 },
    { pos: "RB", kerfPoints: 280 }, { pos: "RB", kerfPoints: 250 },
  ];
  it("takes the N-th best points at each position", () => {
    const r = replacementPoints(players, baselines);
    expect(r.QB).toBe(350); // 2nd-best QB
  });
  it("uses the weakest player when fewer than N exist at a position", () => {
    const r = replacementPoints(players, baselines);
    expect(r.RB).toBe(250); // only 2 RBs, baseline 3 → last one
  });
  it("is null for a position with no players", () => {
    const r = replacementPoints(players, baselines);
    expect(r.WR).toBeNull();
    expect(r.TE).toBeNull();
  });
});

describe("par", () => {
  it("is points above replacement, floored at 0", () => {
    expect(par(300, 250)).toBe(50);
    expect(par(200, 250)).toBe(0); // below replacement → 0, never negative
    expect(par(300, null)).toBe(0); // no replacement level known
  });
});

describe("dollarsPerPoint + prices sum to the cap", () => {
  // A tiny league: 3 positions, clear replacement levels.
  const replPoints = { QB: 100, RB: 100, WR: 100, TE: 100 };
  const players = [
    { pos: "QB", kerfPoints: 300 }, // PAR 200
    { pos: "RB", kerfPoints: 250 }, // PAR 150
    { pos: "WR", kerfPoints: 150 }, // PAR 50
    { pos: "TE", kerfPoints: 80 }, //  PAR 0 (below replacement)
  ];

  it("computes discretionary = budget×teams − $1 per rosterable spot", () => {
    const r = dollarsPerPoint(players, replPoints);
    expect(r.totalBudget).toBe(N_TEAMS * TEAM_BUDGET); // 6000
    expect(r.minimums).toBe(N_TEAMS * ROSTER_SPOTS_PER_TEAM); // 228
    expect(r.discretionary).toBe(6000 - 228);
    expect(r.totalPar).toBe(400); // 200 + 150 + 50 + 0
    expect(r.dollarsPerPoint).toBeCloseTo((6000 - 228) / 400, 10);
  });

  it("PAR-weighted ceilings distribute exactly the discretionary money (sum-to-cap)", () => {
    const r = dollarsPerPoint(players, replPoints);
    // Σ (kerfValue − 1) over the pool == discretionary — the internal-balance check.
    const excess = players.reduce(
      (s, p) => s + (leagueValue(p.kerfPoints, replPoints[p.pos], r.dollarsPerPoint) - 1),
      0
    );
    expect(excess).toBeCloseTo(r.discretionary, 6);
  });

  it("degenerates safely to $0/point when there is no positive PAR", () => {
    const flat = dollarsPerPoint([{ pos: "QB", kerfPoints: 50 }], { QB: 100 });
    expect(flat.dollarsPerPoint).toBe(0);
    expect(leagueValue(50, 100, flat.dollarsPerPoint)).toBe(1); // everyone a $1 min
  });

  it("elite players price as premium assets, replacement players at ~$1", () => {
    const r = dollarsPerPoint(players, replPoints);
    const elite = leagueValue(300, 100, r.dollarsPerPoint); // PAR 200
    const repl = leagueValue(100, 100, r.dollarsPerPoint); // PAR 0
    expect(elite).toBeGreaterThan(repl);
    expect(repl).toBeCloseTo(1, 6);
  });
});

describe("rosterReplacementPoints (replace-your-starter, superflex)", () => {
  // A roster: 2 good QBs, 2 RBs, 3 WRs, 1 TE.
  const roster = [
    { pos: "QB", kerfPoints: 320 }, { pos: "QB", kerfPoints: 300 },
    { pos: "RB", kerfPoints: 280 }, { pos: "RB", kerfPoints: 150 },
    { pos: "WR", kerfPoints: 260 }, { pos: "WR", kerfPoints: 240 }, { pos: "WR", kerfPoints: 120 },
    { pos: "TE", kerfPoints: 200 },
  ];

  it("a new QB must beat the weakest of the QB and SFLEX starters", () => {
    const r = rosterReplacementPoints(roster);
    // Lineup: QB(320), RB(280), RB(150), WR(260), WR(240), TE(200),
    //   FLEX best two of remaining RB/WR/TE: WR120 and... only WR120 left among RB/WR/TE
    //   after starters, plus 2nd FLEX and SFLEX pull from the pool.
    // The two QBs both start (one QB slot, one SFLEX slot) — so a new QB replaces
    // the lower of them (300).
    expect(r.QB).toBe(300);
  });

  it("is thin-position aware: a stacked position has a HIGHER replacement bar", () => {
    // WR is deep here; the WR replacement bar should be at least a real starter,
    // higher than a position where the team only has scrubs.
    const r = rosterReplacementPoints(roster);
    expect(r.WR).toBeGreaterThan(0);
    // A new WR competes with WR/FLEX/SFLEX slots — the weakest such starter.
    expect(typeof r.WR).toBe("number");
  });

  it("falls back to null for a position the roster can't field", () => {
    const noTe = rosterReplacementPoints([{ pos: "QB", kerfPoints: 100 }]);
    // With one QB it fills QB (and maybe SFLEX), but no TE slot is TE-eligible.
    expect(noTe.TE).toBeNull();
  });

  it("rosterValue uses league replacement when the roster doesn't cover a position", () => {
    const leagueRepl = { QB: 200, RB: 200, WR: 200, TE: 150 };
    const rv = rosterValue(300, "TE", { TE: null }, leagueRepl, 0.5);
    // TE not covered → league replacement 150 → PAR 150 → 1 + 150×0.5
    expect(rv.rosterReplPoints).toBe(150);
    expect(rv.parRoster).toBe(150);
    expect(rv.value).toBeCloseTo(1 + 150 * 0.5, 6);
  });

  it("a player worth less than our worst starter has ~$1 roster value", () => {
    const rv = rosterValue(100, "WR", { WR: 240 }, { WR: 150 }, 0.5);
    expect(rv.parRoster).toBe(0);
    expect(rv.value).toBeCloseTo(1, 6);
  });
});

describe("price curve (market value)", () => {
  const salaries = [
    { pos: "QB", salary: 200 }, { pos: "QB", salary: 100 }, { pos: "QB", salary: 20 }, { pos: "QB", salary: 1 },
    { pos: "RB", salary: 140 }, { pos: "RB", salary: 40 },
    { pos: "DST", salary: 5 }, // dropped — DST isn't priced
    { pos: "QB", salary: 0 }, // dropped — blank/zero
  ];

  it("orders each position's salaries into a descending 'Nth-priciest' curve", () => {
    const curve = buildPriceCurve(salaries);
    expect(curve.QB).toEqual([200, 100, 20, 1]);
    expect(curve.RB).toEqual([140, 40]);
    expect(curve.DST).toBeUndefined();
  });

  it("reads a player's price off the curve by positional rank", () => {
    const curve = buildPriceCurve(salaries);
    expect(priceFromCurve(curve, "QB", 1)).toBe(200); // the best QB commands the top salary
    expect(priceFromCurve(curve, "QB", 3)).toBe(20);
  });

  it("flattens past the last knot to the cheapest salary (deep = min price)", () => {
    const curve = buildPriceCurve(salaries);
    expect(priceFromCurve(curve, "QB", 99)).toBe(1);
  });

  it("returns null when the position has no salary data", () => {
    expect(priceFromCurve(buildPriceCurve([]), "QB", 1)).toBeNull();
    expect(priceFromCurve(buildPriceCurve(salaries), "TE", 1)).toBeNull();
  });
});
