// KERFUFFLE projection engine — pure-core unit tests (issue #18).
//
// No database: every function under test is a deterministic transform. These
// cover the four acceptance-critical behaviors — first-down rate derivation,
// first-down-aware scoring translation (incl. reconstructing points from stored
// components), rank derivation (superflex → QBs rise), and gap-based tiering.

import { describe, it, expect } from "vitest";
import {
  deriveFirstDownRates,
  derivePlayerRates,
  shrinkRate,
  scoreProjection,
  assignRanks,
  assignTiers,
  jenksClasses,
} from "./core.mjs";
import { recomputeKerfPoints } from "../ingest/scoring-crosscheck.mjs";

// The real KERFUFFLE offensive coefficients (parsed from CBS /rules), inlined so
// these tests need no database — same set the #17 cross-check uses.
const COEF = {
  PaYd: 0.04, PaTD: 4, PaInt: -2, Pa2P: 2,
  RuYd: 0.1, RuTD: 6, RuFD: 1, Ru2P: 2,
  ReYd: 0.1, ReTD: 6, ReFD: 1, Re2P: 2,
  FL: -2,
};

describe("deriveFirstDownRates", () => {
  it("pools seasons and computes per-opportunity rates by position", () => {
    const rows = [
      // WR, season A: 50 rec, 30 FD ; 5 carries, 2 rush FD
      { pos: "WR", rec_rec: 50, rec_first_downs: 30, rec_yds: 600, rush_att: 5, rush_first_downs: 2, rush_yds: 40 },
      // WR, season B: 50 rec, 20 FD ; 5 carries, 0 rush FD
      { pos: "WR", rec_rec: 50, rec_first_downs: 20, rec_yds: 700, rush_att: 5, rush_first_downs: 0, rush_yds: 30 },
      // RB: 200 carries, 80 rush FD ; 40 rec, 24 rec FD
      { pos: "RB", rush_att: 200, rush_first_downs: 80, rush_yds: 900, rec_rec: 40, rec_first_downs: 24, rec_yds: 300 },
    ];
    const rates = deriveFirstDownRates(rows);
    // WR receiving: (30+20)/(50+50) = 0.5 ; rushing: (2+0)/(5+5) = 0.2
    expect(rates.WR.recFdPerRec).toBeCloseTo(0.5, 10);
    expect(rates.WR.rushFdPerAtt).toBeCloseTo(0.2, 10);
    // RB rushing: 80/200 = 0.4 ; receiving: 24/40 = 0.6
    expect(rates.RB.rushFdPerAtt).toBeCloseTo(0.4, 10);
    expect(rates.RB.recFdPerRec).toBeCloseTo(0.6, 10);
  });

  it("never divides by zero — a position with no volume gets rate 0", () => {
    const rates = deriveFirstDownRates([{ pos: "TE", rec_rec: 0, rec_first_downs: 0, rush_att: 0, rush_first_downs: 0 }]);
    expect(rates.TE.recFdPerRec).toBe(0);
    expect(rates.TE.rushFdPerAtt).toBe(0);
  });
});

describe("shrinkRate", () => {
  it("returns the prior exactly when there is no personal sample (a rookie)", () => {
    expect(shrinkRate(0, 0, 0.25, 75)).toBeCloseTo(0.25, 10);
  });
  it("stays near the prior for a tiny sample", () => {
    // 10 carries, all first downs (rate 1.0), prior 0.25, K=75 → barely moves
    expect(shrinkRate(10, 10, 0.25, 75)).toBeCloseTo((10 + 75 * 0.25) / 85, 10); // ≈ 0.338
  });
  it("approaches the player's own rate for a large sample", () => {
    // 600 carries at 0.30 vs prior 0.22, K=75 → mostly his own
    const r = shrinkRate(180, 600, 0.22, 75);
    expect(r).toBeGreaterThan(0.28); // pulled only slightly off 0.30
    expect(r).toBeLessThan(0.3);
  });
});

describe("derivePlayerRates", () => {
  const positionRates = { RB: { rushFdPerAtt: 0.22, recFdPerRec: 0.45 } };
  const rows = [
    // Workhorse: 600 carries, 180 rush FD (0.30) across two seasons
    { cbs_player_id: 1, pos: "RB", rush_att: 300, rush_first_downs: 90, rec_rec: 0, rec_first_downs: 0 },
    { cbs_player_id: 1, pos: "RB", rush_att: 300, rush_first_downs: 90, rec_rec: 0, rec_first_downs: 0 },
    // Tiny sample: 12 carries, 8 rush FD (0.67) — should be pulled hard to the prior
    { cbs_player_id: 2, pos: "RB", rush_att: 12, rush_first_downs: 8, rec_rec: 0, rec_first_downs: 0 },
  ];

  it("keeps a big-sample standout near his own (above-average) rate", () => {
    const m = derivePlayerRates(rows, positionRates, { rushK: 75, recK: 40 });
    const p = m.get(1);
    expect(p.ownRushRate).toBeCloseTo(0.3, 6);
    expect(p.rushFdPerAtt).toBeGreaterThan(0.285); // stays well above the 0.22 average
    expect(p.rushAtt).toBe(600);
  });

  it("pulls a tiny-sample outlier back toward the position average", () => {
    const m = derivePlayerRates(rows, positionRates, { rushK: 75, recK: 40 });
    const p = m.get(2);
    expect(p.ownRushRate).toBeCloseTo(8 / 12, 6); // 0.667 raw
    expect(p.rushFdPerAtt).toBeLessThan(0.3); // shrunk far down toward 0.22
    expect(p.rushFdPerAtt).toBeGreaterThan(0.22);
  });

  it("a player with no carries falls exactly to the position rush rate", () => {
    const m = derivePlayerRates(
      [{ cbs_player_id: 3, pos: "RB", rush_att: 0, rush_first_downs: 0, rec_rec: 50, rec_first_downs: 30 }],
      positionRates,
      { rushK: 75, recK: 40 }
    );
    expect(m.get(3).ownRushRate).toBeNull();
    expect(m.get(3).rushFdPerAtt).toBeCloseTo(0.22, 10); // pure prior
  });
});

describe("scoreProjection", () => {
  // A WR with 0.5 rec FD/rec and 0.2 rush FD/carry.
  const rates = { WR: { recFdPerRec: 0.5, rushFdPerAtt: 0.2 } };
  const src = {
    pos: "WR",
    pass_yds: 0, pass_td: 0, pass_int: 0,
    rush_att: 10, rush_yds: 50, rush_td: 0,
    rec_rec: 100, rec_yds: 1200, rec_td: 10,
    fumbles: 1, two_pt: 0,
  };

  it("estimates first downs from projected volume", () => {
    const r = scoreProjection(src, rates, COEF);
    expect(r.estRecFD).toBeCloseTo(50, 10); // 100 rec * 0.5
    expect(r.estRushFD).toBeCloseTo(2, 10); // 10 carries * 0.2
  });

  it("scores the full line including the estimated first downs", () => {
    const r = scoreProjection(src, rates, COEF);
    // 1200*0.1 + 10*6 + 50*1 (recFD) + 50*0.1 + 2*1 (rushFD) + 1*-2
    // = 120 + 60 + 50 + 5 + 2 - 2 = 235
    expect(r.kerfPoints).toBeCloseTo(235, 6);
  });

  it("first downs are a MATERIAL part of the score (the league's edge)", () => {
    const withFd = scoreProjection(src, rates, COEF).kerfPoints;
    const withoutFd = scoreProjection(src, { WR: { recFdPerRec: 0, rushFdPerAtt: 0 } }, COEF).kerfPoints;
    expect(withFd - withoutFd).toBeCloseTo(52, 6); // 50 rec FD + 2 rush FD
  });

  it("kerf points reconstruct deterministically from the stored scored line", () => {
    // Acceptance: a projection row's stored components must reproduce its points.
    const r = scoreProjection(src, rates, COEF);
    const reconstructed = recomputeKerfPoints(r.scored, COEF);
    expect(reconstructed).toBe(r.kerfPoints);
  });

  it("is deterministic — identical inputs give identical output", () => {
    const a = scoreProjection(src, rates, COEF);
    const b = scoreProjection(src, rates, COEF);
    expect(b.kerfPoints).toBe(a.kerfPoints);
    expect(b.estRecFD).toBe(a.estRecFD);
  });

  it("uses the player's OWN rate when supplied, not the position rate", () => {
    // This WR converts first downs well above his position (0.7 vs 0.5).
    const playerRate = { rushFdPerAtt: 0.2, recFdPerRec: 0.7, ownRecRate: 0.72, ownRushRate: 0.21, rushAtt: 30, recRec: 300 };
    const withPlayer = scoreProjection(src, rates, COEF, playerRate);
    const withPosition = scoreProjection(src, rates, COEF, null);
    expect(withPlayer.estRecFD).toBeCloseTo(70, 6); // 100 rec * 0.7 (his own)
    expect(withPlayer.estRecFD).toBeGreaterThan(withPosition.estRecFD); // more valuable than average
    expect(withPlayer.kerfPoints).toBeGreaterThan(withPosition.kerfPoints);
    expect(withPlayer.fd.source).toBe("player_shrunk");
    expect(withPosition.fd.source).toBe("position");
  });

  it("honors the per-component policy: rushing off -> position rate, receiving on -> player rate (D-16)", () => {
    // Player converts BOTH far above position (rush 0.9 vs 0.2, rec 0.7 vs 0.5).
    const playerRate = { rushFdPerAtt: 0.9, recFdPerRec: 0.7, ownRecRate: 0.72, ownRushRate: 0.9, rushAtt: 100, recRec: 300 };
    const r = scoreProjection(src, rates, COEF, playerRate, { rushPlayerSpecific: false, recPlayerSpecific: true });
    // rushing must ignore the player's 0.9 and use the 0.2 position rate...
    expect(r.rushFdRate).toBeCloseTo(0.2, 10);
    expect(r.estRushFD).toBeCloseTo(2, 10); // 10 carries * 0.2 position, not 0.9
    expect(r.fd.rushSource).toBe("position");
    // ...while receiving still uses his own 0.7.
    expect(r.recFdRate).toBeCloseTo(0.7, 10);
    expect(r.estRecFD).toBeCloseTo(70, 6);
    expect(r.fd.recSource).toBe("player_shrunk");
  });
});

describe("assignRanks", () => {
  const items = [
    { cbsId: 1, pos: "QB", kerfPoints: 400 },
    { cbsId: 2, pos: "RB", kerfPoints: 380 },
    { cbsId: 3, pos: "QB", kerfPoints: 350 },
    { cbsId: 4, pos: "WR", kerfPoints: 300 },
    { cbsId: 5, pos: "QB", kerfPoints: 300 }, // tie with #4 on points
  ];

  it("ranks the whole pool by points (superflex: a QB tops the overall pool)", () => {
    const r = assignRanks(items);
    expect(r.get(1).ovrRank).toBe(1); // the QB
    expect(r.get(2).ovrRank).toBe(2);
    expect(r.get(3).ovrRank).toBe(3);
  });

  it("breaks ties by cbsId so ordering is deterministic", () => {
    const r = assignRanks(items);
    // #4 and #5 both 300 — lower cbsId (4) ranks ahead of 5
    expect(r.get(4).ovrRank).toBe(4);
    expect(r.get(5).ovrRank).toBe(5);
  });

  it("assigns positional ranks within each position", () => {
    const r = assignRanks(items);
    expect(r.get(1).posRank).toBe(1); // QB1
    expect(r.get(3).posRank).toBe(2); // QB2
    expect(r.get(5).posRank).toBe(3); // QB3
    expect(r.get(2).posRank).toBe(1); // RB1
    expect(r.get(4).posRank).toBe(1); // WR1
  });
});

describe("jenksClasses / assignTiers", () => {
  it("separates two obvious clusters into two classes", () => {
    const classes = jenksClasses([1, 2, 3, 100, 101, 102], 2);
    // low cluster shares one class, high cluster the other
    expect(new Set(classes.slice(0, 3)).size).toBe(1);
    expect(new Set(classes.slice(3)).size).toBe(1);
    expect(classes[0]).not.toBe(classes[3]);
  });

  it("tier 1 is the BEST (highest points), and count matches k", () => {
    const items = [
      { cbsId: 1, kerfPoints: 300 },
      { cbsId: 2, kerfPoints: 295 },
      { cbsId: 3, kerfPoints: 100 },
      { cbsId: 4, kerfPoints: 95 },
    ];
    const tiers = assignTiers(items, 2);
    expect(tiers.get(1)).toBe(1); // top cluster -> tier 1
    expect(tiers.get(2)).toBe(1);
    expect(tiers.get(3)).toBe(2);
    expect(tiers.get(4)).toBe(2);
  });

  it("clamps k to the item count and never errors on tiny inputs", () => {
    expect(jenksClasses([], 5)).toEqual([]);
    expect(jenksClasses([42], 5)).toEqual([0]);
    const t = assignTiers([{ cbsId: 9, kerfPoints: 1 }], 5);
    expect(t.get(9)).toBe(1);
  });

  it("is deterministic across runs", () => {
    const vals = [5, 9, 9, 12, 40, 41, 90];
    expect(jenksClasses(vals, 3)).toEqual(jenksClasses(vals, 3));
  });
});
