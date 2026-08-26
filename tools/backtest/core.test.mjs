// Backtest metrics — pure-core unit tests (issue #19).

import { describe, it, expect } from "vitest";
import {
  averageRanks,
  spearman,
  topNHitRate,
  rateSeasonsFor,
  comparePredictors,
} from "./core.mjs";

describe("averageRanks", () => {
  it("ranks ascending, 1-based", () => {
    expect(averageRanks([30, 10, 20])).toEqual([3, 1, 2]);
  });
  it("averages tied ranks", () => {
    // sorted: 10, 20, 20, 40 -> positions 1, (2,3)->2.5, 4
    expect(averageRanks([10, 20, 20, 40])).toEqual([1, 2.5, 2.5, 4]);
  });
});

describe("spearman", () => {
  it("is +1 for a perfectly aligned ordering", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 10);
  });
  it("is -1 for a perfectly inverted ordering", () => {
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 10);
  });
  it("handles ties via average ranks (monotone but tied)", () => {
    // goodness has a tie; outcome strictly increasing -> strong but <1
    const rho = spearman([1, 2, 2, 3], [10, 20, 30, 40]);
    expect(rho).toBeGreaterThan(0.8);
    expect(rho).toBeLessThan(1);
  });
  it("returns null with <2 points or no variance", () => {
    expect(spearman([1], [2])).toBeNull();
    expect(spearman([5, 5, 5], [1, 2, 3])).toBeNull();
  });
});

describe("topNHitRate", () => {
  it("counts predicted top-N that actually finished top-N", () => {
    // predRank 1..4; actual points reversed so #1 predicted is worst actual.
    const items = [
      { predRank: 1, actual: 10 },
      { predRank: 2, actual: 20 },
      { predRank: 3, actual: 30 },
      { predRank: 4, actual: 40 },
    ];
    // top-2 predicted = ranks 1,2 (actual 10,20); top-2 actual = 40,30 -> 0 overlap
    expect(topNHitRate(items, 2)).toEqual({ n: 2, hits: 0, rate: 0 });
    // top-4 of 4 = everyone -> perfect
    expect(topNHitRate(items, 4)).toEqual({ n: 4, hits: 4, rate: 1 });
  });
  it("is perfect when prediction matches reality", () => {
    const items = [
      { predRank: 1, actual: 40 },
      { predRank: 2, actual: 30 },
      { predRank: 3, actual: 20 },
      { predRank: 4, actual: 10 },
    ];
    expect(topNHitRate(items, 2).rate).toBe(1);
  });
  it("caps n at the set size", () => {
    expect(topNHitRate([{ predRank: 1, actual: 5 }], 10).n).toBe(1);
    expect(topNHitRate([], 5)).toEqual({ n: 0, hits: 0, rate: null });
  });
});

describe("rateSeasonsFor (no-leakage guard)", () => {
  it("predicts a season from PRIOR seasons only (out of sample)", () => {
    expect(rateSeasonsFor(2025, [2024, 2025])).toEqual({ seasons: [2024], inSample: false });
  });
  it("falls back to the season itself, flagged in-sample, when no prior exists", () => {
    expect(rateSeasonsFor(2024, [2024, 2025])).toEqual({ seasons: [2024], inSample: true });
  });
  it("uses ALL prior seasons when more than one exists", () => {
    expect(rateSeasonsFor(2026, [2024, 2025])).toEqual({ seasons: [2024, 2025], inSample: false });
  });
  it("never leaks the target season into an out-of-sample rate set", () => {
    const r = rateSeasonsFor(2025, [2023, 2024, 2025]);
    expect(r.inSample).toBe(false);
    expect(r.seasons).not.toContain(2025);
  });
});

describe("comparePredictors", () => {
  it("gives A the edge when A orders the field better than B", () => {
    // A ranks match actual; B is inverted.
    const rows = [
      { predRankA: 1, predRankB: 4, actual: 40 },
      { predRankA: 2, predRankB: 3, actual: 30 },
      { predRankA: 3, predRankB: 2, actual: 20 },
      { predRankA: 4, predRankB: 1, actual: 10 },
    ];
    const r = comparePredictors(rows);
    expect(r.rhoA).toBeCloseTo(1, 10);
    expect(r.rhoB).toBeCloseTo(-1, 10);
    expect(r.edge).toBeCloseTo(2, 10);
    expect(r.n).toBe(4);
  });
});
