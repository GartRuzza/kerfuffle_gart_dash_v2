import { describe, expect, it } from "vitest";
import { MOCK_PLAYERS, tierFromRank } from "./mockData";
import { POSITIONS } from "./types";

describe("mock data derivation", () => {
  it("has ~80 players and is pre-sorted by Kerf overall rank", () => {
    expect(MOCK_PLAYERS.length).toBe(79);
    MOCK_PLAYERS.forEach((p, i) => expect(p.kerfOvrRank).toBe(i + 1));
  });

  it("assigns unique overall Kerf ranks 1..N, best value first", () => {
    const ranks = MOCK_PLAYERS.map((p) => p.kerfOvrRank).sort((a, b) => a - b);
    expect(ranks).toEqual(Array.from({ length: 79 }, (_, i) => i + 1));
    // #1 overall is the highest Kerf value
    const top = MOCK_PLAYERS.find((p) => p.kerfOvrRank === 1)!;
    const maxKerf = Math.max(...MOCK_PLAYERS.map((p) => p.kerfValue));
    expect(top.kerfValue).toBe(maxKerf);
  });

  it("assigns positional ranks 1..count within each position", () => {
    for (const pos of POSITIONS) {
      const group = MOCK_PLAYERS.filter((p) => p.pos === pos);
      const kerf = group.map((p) => p.kerfPosRank).sort((a, b) => a - b);
      expect(kerf).toEqual(group.map((_, i) => i + 1));
      // best Kerf value in the position is pos-rank 1
      const posTop = group.find((p) => p.kerfPosRank === 1)!;
      expect(posTop.kerfValue).toBe(Math.max(...group.map((p) => p.kerfValue)));
      // ECR / dynasty positional ranks are also a clean 1..count
      expect(group.map((p) => p.posEcr).sort((a, b) => a - b)).toEqual(
        group.map((_, i) => i + 1),
      );
      expect(group.map((p) => p.dynPosEcr).sort((a, b) => a - b)).toEqual(
        group.map((_, i) => i + 1),
      );
    }
  });

  it("keeps every tier within its scheme's range", () => {
    for (const p of MOCK_PLAYERS) {
      for (const t of [p.kerfOvrTier, p.ovrEcrTier, p.dynOvrTier]) {
        expect(t).toBeGreaterThanOrEqual(1);
        expect(t).toBeLessThanOrEqual(8);
      }
      for (const t of [p.kerfPosTier, p.posEcrTier, p.dynPosTier]) {
        expect(t).toBeGreaterThanOrEqual(1);
        expect(t).toBeLessThanOrEqual(6);
      }
    }
  });

  it("overall ECR/Dynasty ranks are unique 1..N and tiers stay contiguous", () => {
    // The two 'overall ECR' columns sort by these unique ranks (not the raw ECR,
    // which has ties) — this is what keeps tier bands from repeating.
    for (const key of ["ovrEcrRank", "dynOvrRank"] as const) {
      const ranks = MOCK_PLAYERS.map((p) => p[key]).sort((a, b) => a - b);
      expect(ranks).toEqual(Array.from({ length: 79 }, (_, i) => i + 1));
    }
    // Ordered by the rank, the matching tier never decreases (contiguous bands).
    const byEcr = [...MOCK_PLAYERS].sort((a, b) => a.ovrEcrRank - b.ovrEcrRank);
    for (let i = 1; i < byEcr.length; i++) {
      expect(byEcr[i].ovrEcrTier).toBeGreaterThanOrEqual(byEcr[i - 1].ovrEcrTier);
    }
  });

  it("bucket helper maps ranks to tiers by break points", () => {
    const breaks = [3, 6, 10];
    expect(tierFromRank(1, breaks)).toBe(1);
    expect(tierFromRank(3, breaks)).toBe(1);
    expect(tierFromRank(4, breaks)).toBe(2);
    expect(tierFromRank(10, breaks)).toBe(3);
    expect(tierFromRank(11, breaks)).toBe(4); // beyond last break
  });
});
