import { describe, expect, it } from "vitest";
import type { Player, Position } from "./types";
import {
  assignTiers,
  buildLineup,
  computeLeague,
  computeStats,
  jenksClasses,
  normalize,
  ordinal,
  rankBand,
  teamStrength,
} from "./powerRankings";

// Minimal Player factory — only the fields the rankings read (pos, owner, projPts).
let seq = 0;
function mk(pos: Position, projPts: number | null, owner = "Team A", name?: string): Player {
  seq += 1;
  return {
    id: `p${seq}`,
    name: name ?? `${pos}-${seq}`,
    pos,
    nflTeam: "NE",
    owner,
    kerfValue: null,
    rosterValue: null,
    marketPrice: null,
    marketPreAuction: null,
    kerfOvrRank: null,
    kerfPosRank: null,
    kerfOvrTier: null,
    kerfPosTier: null,
    salary: null,
    contractYears: null,
    projPts,
    seasonProjPts: null,
    actualsToDate: null,
    actualsAsOfWeek: null,
    opponent: null,
    ecr: null,
    dynastyEcr: null,
    ovrEcrRank: null,
    posEcr: null,
    dynOvrRank: null,
    dynPosEcr: null,
    ovrEcrTier: null,
    posEcrTier: null,
    dynOvrTier: null,
    dynPosTier: null,
  };
}

/** A full, comfortably-deep offensive roster with distinct points per position. */
function fullRoster(owner: string, base: number): Player[] {
  return [
    mk("QB", base + 30, owner),
    mk("QB", base + 10, owner), // backup — should land in SFLEX (superflex)
    mk("RB", base + 25, owner),
    mk("RB", base + 20, owner),
    mk("RB", base + 8, owner), // FLEX candidate
    mk("WR", base + 24, owner),
    mk("WR", base + 18, owner),
    mk("WR", base + 6, owner), // FLEX candidate
    mk("TE", base + 15, owner),
    mk("TE", base + 3, owner), // bench
  ];
}

describe("buildLineup", () => {
  it("fills dedicated slots, then FLEX with best remaining RB/WR/TE, then SFLEX with best QB", () => {
    const lineup = buildLineup(fullRoster("A", 100));
    const bySlot = Object.fromEntries(lineup.map((s) => [s.slot, s]));

    expect(bySlot.QB.player!.pos).toBe("QB");
    expect(bySlot.RB1.points).toBe(125);
    expect(bySlot.RB2.points).toBe(120);
    expect(bySlot.WR1.points).toBe(124);
    expect(bySlot.WR2.points).toBe(118);
    expect(bySlot.TE.points).toBe(115);
    // FLEX takes the two best remaining RB/WR/TE: RB+108 and WR+106.
    expect(bySlot.FLX1.points).toBe(108);
    expect(bySlot.FLX2.points).toBe(106);
    // SFLEX takes the best remaining QB-eligible: the backup QB (110), the
    // superflex premium — higher than the leftover TE (103).
    expect(bySlot.SFLX.player!.pos).toBe("QB");
    expect(bySlot.SFLX.points).toBe(110);
  });

  it("excludes DST and free agents' defenses, and never crashes on a thin roster", () => {
    const thin = [mk("QB", 200, "A"), mk("DST", 90, "A")];
    const lineup = buildLineup(thin);
    expect(lineup.find((s) => s.slot === "QB")!.points).toBe(200);
    // Every other slot is unfilled (no eligible offense) → null / 0, no throw.
    expect(lineup.find((s) => s.slot === "RB1")!.player).toBeNull();
    expect(lineup.find((s) => s.slot === "RB1")!.points).toBe(0);
    // DST is never placed.
    expect(lineup.some((s) => s.player?.pos === "DST")).toBe(false);
  });

  it("ignores offensive players with no projection (null projPts)", () => {
    const lineup = buildLineup([mk("QB", null, "A"), mk("RB", 50, "A")]);
    expect(lineup.find((s) => s.slot === "QB")!.player).toBeNull();
    expect(lineup.find((s) => s.slot === "RB1")!.points).toBe(50);
  });
});

describe("teamStrength", () => {
  it("sums the lineup for Starter Strength and everyone for Total Roster; bench is the difference", () => {
    const roster = fullRoster("A", 100);
    const ts = teamStrength("A", roster);
    const starterSum = ts.lineup.reduce((s, l) => s + l.points, 0);
    const totalSum = roster.reduce((s, p) => s + (p.projPts ?? 0), 0);

    expect(ts.starterStrength).toBeCloseTo(starterSum, 5);
    expect(ts.totalRoster).toBeCloseTo(totalSum, 5);
    expect(ts.benchStrength).toBeCloseTo(totalSum - starterSum, 5);
    // The one benched player is the weak TE (103) — appears in bench-by-position.
    expect(ts.benchByPos.TE).toBe(103);
  });

  it("excludes DST from Total Roster", () => {
    const ts = teamStrength("A", [mk("QB", 100, "A"), mk("DST", 90, "A")]);
    expect(ts.totalRoster).toBe(100); // DST's 90 not counted
  });

  it("group starter strength splits QB/RB/WR/TE/FLEX/SFLX without overlap", () => {
    const ts = teamStrength("A", fullRoster("A", 100));
    expect(ts.groupStarters.QB).toBe(130); // dedicated QB slot only
    expect(ts.groupStarters.RB).toBe(125 + 120);
    expect(ts.groupStarters.WR).toBe(124 + 118);
    expect(ts.groupStarters.TE).toBe(115);
    expect(ts.groupStarters.FLEX).toBe(108 + 106);
    expect(ts.groupStarters.SFLX).toBe(110);
    // Groups sum to Starter Strength exactly.
    const groupSum = Object.values(ts.groupStarters).reduce((s, v) => s + v, 0);
    expect(groupSum).toBeCloseTo(ts.starterStrength, 5);
  });
});

describe("computeLeague", () => {
  const players = [
    ...fullRoster("Strong", 100),
    ...fullRoster("Middle", 60),
    ...fullRoster("Weak", 20),
    // A free agent that must be ignored.
    mk("QB", 999, "FA"),
    // A defense that must be ignored.
    mk("DST", 999, "Strong"),
  ];

  it("ranks teams by Starter Strength, strongest first, distinct ranks", () => {
    const league = computeLeague(players);
    expect(league.teams.map((t) => t.team)).toEqual(["Strong", "Middle", "Weak"]);
    expect(league.teams.map((t) => t.rank)).toEqual([1, 2, 3]);
  });

  it("normalizes the top team to a score of 100", () => {
    const league = computeLeague(players);
    expect(league.teams[0].score).toBe(100);
    expect(league.teams[0].score).toBeGreaterThanOrEqual(league.teams[1].score);
  });

  it("tiers the teams (1 = contenders best)", () => {
    const league = computeLeague(players);
    expect(league.teams[0].tier).toBe(1);
    expect(league.teams[2].tier).toBeGreaterThan(league.teams[0].tier);
  });

  it("ignores free agents and defenses entirely", () => {
    const league = computeLeague(players);
    expect(league.teams).toHaveLength(3);
    expect(league.teams.some((t) => t.team === "FA")).toBe(false);
    // "Strong" holds a 999-pt DST; its Total Roster is exactly its 10 offensive
    // players (DST excluded) — the same as a Strong roster with no DST.
    expect(league.teams[0].totalRoster).toBe(
      fullRoster("X", 100).reduce((s, p) => s + (p.projPts ?? 0), 0)
    );
  });

  it("assigns a per-group rank and a per-slot rank to every team", () => {
    const league = computeLeague(players);
    const strong = league.teams[0];
    expect(strong.groupRank.QB).toBe(1);
    expect(strong.groupRank.STARTERS).toBe(1);
    expect(strong.slotRank.RB1).toBe(1);
    // Weakest team ranks last on its groups.
    const weak = league.teams[2];
    expect(weak.groupRank.QB).toBe(3);
  });

  it("exposes per-metric league distributions (min/median/max)", () => {
    const league = computeLeague(players);
    // The top team is the league max on Starter Strength; the bottom is the min.
    expect(league.groupStats.STARTERS.max).toBe(league.teams[0].starterStrength);
    expect(league.groupStats.STARTERS.min).toBe(league.teams[2].starterStrength);
    expect(league.slotStats.QB.max).toBe(league.teams[0].lineup.find((s) => s.slot === "QB")!.points);
    expect(league.benchAxisStats.QB.max).toBeGreaterThanOrEqual(league.benchAxisStats.QB.min);
  });

  it("returns an empty league safely when there is no offense", () => {
    expect(computeLeague([]).teams).toEqual([]);
    expect(computeLeague([mk("DST", 100, "A")]).teams).toEqual([]);
  });

  it("radar bench bucketing double-counts a bench RB across RB/FLEX/SFLX (a shape, not a total)", () => {
    const roster = [
      mk("QB", 300, "A"),
      mk("RB", 250, "A"), mk("RB", 240, "A"),
      mk("WR", 230, "A"), mk("WR", 220, "A"),
      mk("TE", 210, "A"),
      mk("RB", 200, "A"), mk("WR", 190, "A"), // FLEX
      mk("QB", 180, "A"), // SFLEX (backup QB beats the bench RB)
      mk("RB", 50, "A"), // the lone bench player
    ];
    const t = computeLeague(roster).teams[0];
    expect(t.benchByPos.RB).toBe(50);
    expect(t.benchAvgByGroup.RB).toBe(50);
    expect(t.benchAvgByGroup.FLEX).toBe(50); // a bench RB is FLEX depth
    expect(t.benchAvgByGroup.SFLX).toBe(50); // and SFLEX depth
    expect(t.benchAvgByGroup.QB).toBe(0);
  });

  it("bench axis value is an AVERAGE across a team's bench players at the position", () => {
    // Two bench RBs (60, 40) behind a full starting core → bench RB avg = 50.
    const roster = [
      mk("QB", 300, "A"),
      mk("RB", 250, "A"), mk("RB", 240, "A"),
      mk("WR", 230, "A"), mk("WR", 220, "A"),
      mk("TE", 210, "A"),
      mk("RB", 200, "A"), mk("WR", 190, "A"), // FLEX
      mk("QB", 180, "A"), // SFLEX
      mk("RB", 60, "A"), mk("RB", 40, "A"), // two bench RBs
    ];
    const t = computeLeague(roster).teams[0];
    expect(t.benchByPos.RB).toBe(100); // sum
    expect(t.benchCountByPos.RB).toBe(2);
    expect(t.benchAvgByGroup.RB).toBe(50); // mean, not sum
  });

  it("scores 0 (no divide-by-zero) when no team has any starter points", () => {
    const league = computeLeague([mk("QB", null, "A"), mk("RB", null, "A"), mk("WR", 0, "B")]);
    for (const t of league.teams) expect(t.score).toBe(0);
  });
});

describe("presentation helpers", () => {
  it("ordinal", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
  });

  it("rankBand splits a 12-team league into thirds", () => {
    expect(rankBand(1, 12)).toBe("strong");
    expect(rankBand(4, 12)).toBe("strong");
    expect(rankBand(5, 12)).toBe("middle");
    expect(rankBand(8, 12)).toBe("middle");
    expect(rankBand(9, 12)).toBe("weak");
    expect(rankBand(12, 12)).toBe("weak");
  });
});

describe("distribution helpers", () => {
  it("computeStats returns min / median / max (even and odd counts)", () => {
    expect(computeStats([3, 1, 2])).toEqual({ min: 1, median: 2, max: 3 });
    expect(computeStats([10, 20, 30, 40])).toEqual({ min: 10, median: 25, max: 40 });
    expect(computeStats([])).toEqual({ min: 0, median: 0, max: 0 });
  });

  it("normalize maps a value into 0..1 across the league range, clamped", () => {
    const st = { min: 100, median: 150, max: 200 };
    expect(normalize(100, st)).toBe(0); // worst → origin
    expect(normalize(200, st)).toBe(1); // best → far end
    expect(normalize(150, st)).toBeCloseTo(0.5, 5);
    expect(normalize(50, st)).toBe(0); // below min clamps
    expect(normalize(999, st)).toBe(1); // above max clamps
  });

  it("normalize handles a degenerate (all-equal) league without dividing by zero", () => {
    const flat = { min: 7, median: 7, max: 7 };
    expect(normalize(7, flat)).toBe(1);
    expect(normalize(3, flat)).toBe(0);
  });
});

describe("jenks (ported)", () => {
  it("separates two obvious clusters", () => {
    expect(jenksClasses([1, 2, 3, 100, 101, 102], 2)).toEqual([0, 0, 0, 1, 1, 1]);
  });
  it("degrades safely", () => {
    expect(jenksClasses([], 3)).toEqual([]);
    expect(jenksClasses([42], 3)).toEqual([0]);
    expect(assignTiers([])).toEqual([]);
    expect(assignTiers([5])).toEqual([1]);
  });
});
