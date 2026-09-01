import { describe, it, expect } from "vitest";
import { deriveBoard, deriveWeekly, posRankNumber, type BoardViewRow } from "./derive";

function row(overrides: Partial<BoardViewRow>): BoardViewRow {
  return {
    cbs_player_id: 1,
    name: "Player",
    pos: "WR",
    nfl_team: "BUF",
    owner: "FA",
    roster_status: null,
    salary: null,
    contract_years: null,
    proj_points: null,
    ecr: null,
    ecr_pos_rank: null,
    ecr_tier: null,
    dynasty_ecr: null,
    dynasty_pos_rank: null,
    dynasty_tier: null,
    ...overrides,
  };
}

describe("posRankNumber", () => {
  it("extracts the number from FantasyPros pos_rank strings", () => {
    expect(posRankNumber("WR12")).toBe(12);
    expect(posRankNumber("DST3")).toBe(3);
    expect(posRankNumber(null)).toBeNull();
    expect(posRankNumber("WR")).toBeNull();
  });
});

describe("deriveBoard", () => {
  it("assigns UNIQUE contiguous overall ranks even when raw ECR ties", () => {
    const players = deriveBoard([
      row({ cbs_player_id: 1, name: "Bob", ecr: 5 }),
      row({ cbs_player_id: 2, name: "Alice", ecr: 5 }), // tie — broken by name
      row({ cbs_player_id: 3, name: "Cid", ecr: 2 }),
      row({ cbs_player_id: 4, name: "Dan", ecr: null }), // unranked
    ]);
    const byId = new Map(players.map((p) => [p.id, p]));
    expect(byId.get("3")!.ovrEcrRank).toBe(1);
    expect(byId.get("2")!.ovrEcrRank).toBe(2); // Alice before Bob
    expect(byId.get("1")!.ovrEcrRank).toBe(3);
    expect(byId.get("4")!.ovrEcrRank).toBeNull();
  });

  it("keeps real data and leaves engine outputs null", () => {
    const [p] = deriveBoard([
      row({
        cbs_player_id: 7, name: "Rostered Guy", owner: "Rangoon Raccoons",
        salary: 42, contract_years: 2, proj_points: 250.5,
        ecr: 10, ecr_pos_rank: "WR3", ecr_tier: 2,
        dynasty_ecr: 8, dynasty_pos_rank: "WR2", dynasty_tier: 1,
      }),
    ]);
    expect(p).toMatchObject({
      id: "7", owner: "Rangoon Raccoons", salary: 42, contractYears: 2,
      projPts: 250.5, ecr: 10, posEcr: 3, ovrEcrTier: 2, posEcrTier: 2,
      dynastyEcr: 8, dynPosEcr: 2, dynOvrTier: 1, dynPosTier: 1,
      kerfValue: null, marketPrice: null, kerfOvrRank: null, kerfOvrTier: null,
    });
  });

  it("free agents keep null salary/contract (meaningful: no contract)", () => {
    const [p] = deriveBoard([row({ owner: "FA", ecr: 1 })]);
    expect(p.owner).toBe("FA");
    expect(p.salary).toBeNull();
    expect(p.contractYears).toBeNull();
  });

  it("fails LOUDLY on a position the league doesn't roster", () => {
    expect(() => deriveBoard([row({ pos: "K", name: "Some Kicker" })])).toThrowError(/Some Kicker/);
  });

  it("surfaces the engine projection: Kerf ranks/tiers + Kerf-scored Proj Points (issue #18)", () => {
    const proj = new Map([
      [7, { kerf_points: 288.4, kerf_ovr_rank: 12, kerf_pos_rank: 4, kerf_ovr_tier: 3, kerf_pos_tier: 2 }],
    ]);
    const [p] = deriveBoard(
      [row({ cbs_player_id: 7, name: "Projected Guy", owner: "FA", proj_points: null, ecr: 30 })],
      proj
    );
    expect(p).toMatchObject({
      id: "7",
      kerfOvrRank: 12, kerfPosRank: 4, kerfOvrTier: 3, kerfPosTier: 2,
      projPts: 288.4, // the engine's KERFUFFLE projection, even for a free agent
      kerfValue: null, marketPrice: null, // no valuation row passed → dollars stay "—"
    });
  });

  it("surfaces Option B netting: Proj Points is REMAINING, with full-season + actuals context (issue #30)", () => {
    const proj = new Map([
      // full-season 380, banked 242 through week 8 → remaining 138
      [7, { kerf_points: 138, kerf_ovr_rank: 5, kerf_pos_rank: 2, kerf_ovr_tier: 1, kerf_pos_tier: 1,
            season_points: 380, actuals_points: 242, actuals_as_of_week: 8 }],
    ]);
    const [p] = deriveBoard([row({ cbs_player_id: 7, name: "Netted Guy", owner: "FA", ecr: 3 })], proj);
    expect(p).toMatchObject({
      projPts: 138,        // remaining value drives the lens
      seasonProjPts: 380,  // full-season kept as context
      actualsToDate: 242,  // what was subtracted
      actualsAsOfWeek: 8,  // through which week
    });
  });

  it("with no netting (preseason / Option A), Full-Season falls back to the projection and actuals stay null", () => {
    const proj = new Map([
      [7, { kerf_points: 300, kerf_ovr_rank: 1, kerf_pos_rank: 1, kerf_ovr_tier: 1, kerf_pos_tier: 1 }],
    ]);
    const [p] = deriveBoard([row({ cbs_player_id: 7, name: "Preseason Guy", owner: "FA", ecr: 1 })], proj);
    expect(p.projPts).toBe(300);
    expect(p.seasonProjPts).toBe(300); // falls back to the projection so the column always shows a number
    expect(p.actualsToDate).toBeNull();
    expect(p.actualsAsOfWeek).toBeNull();
  });

  it("surfaces the valuation dollars: Kerf/Roster value + both market prices (issue #20)", () => {
    const val = new Map([
      [7, { kerf_value: 130, roster_value: 110, market_in_season: 201, market_pre_auction: 180 }],
    ]);
    const [p] = deriveBoard(
      [row({ cbs_player_id: 7, name: "Priced Guy", owner: "FA", ecr: 3 })],
      new Map(),
      val
    );
    expect(p).toMatchObject({
      id: "7",
      kerfValue: 130, rosterValue: 110, marketPrice: 201, marketPreAuction: 180,
    });
  });

  it("a player with no valuation keeps every dollar field null (defenses, unpriced)", () => {
    const [p] = deriveBoard(
      [row({ cbs_player_id: 9, name: "Defense", pos: "DST", proj_points: 110 })],
      new Map(),
      new Map() // no valuation row for this player
    );
    expect(p.kerfValue).toBeNull();
    expect(p.rosterValue).toBeNull();
    expect(p.marketPrice).toBeNull();
    expect(p.marketPreAuction).toBeNull();
  });

  it("a player with no projection keeps Kerf fields null and CBS's own Proj Points", () => {
    const [p] = deriveBoard(
      [row({ cbs_player_id: 9, name: "Defense", pos: "DST", proj_points: 110 })],
      new Map() // no projection for this player (e.g. a defense)
    );
    expect(p.kerfOvrRank).toBeNull();
    expect(p.kerfOvrTier).toBeNull();
    expect(p.projPts).toBe(110); // CBS's number, unchanged
  });

  it("ROS lens leaves opponent null (no per-week matchup)", () => {
    const [p] = deriveBoard([row({ cbs_player_id: 7, name: "Guy", ecr: 1 })]);
    expect(p.opponent).toBeNull();
  });
});

describe("deriveWeekly (issue #29)", () => {
  const rows = [
    row({ cbs_player_id: 10, name: "Star QB", pos: "QB", owner: "Rangoon Raccoons", salary: 50, contract_years: 2, ecr: 1, dynasty_ecr: 3, dynasty_pos_rank: "QB1", dynasty_tier: 1 }),
    row({ cbs_player_id: 20, name: "Star WR", pos: "WR", owner: "FA", ecr: 2 }),
  ];

  it("fills Kerf fields from the WEEKLY run and ECR from the WEEKLY consensus + opponent", () => {
    const weeklyProj = new Map([
      [10, { kerf_points: 22.5, kerf_ovr_rank: 2, kerf_pos_rank: 1, kerf_ovr_tier: 1, kerf_pos_tier: 1 }],
      [20, { kerf_points: 14.1, kerf_ovr_rank: 40, kerf_pos_rank: 18, kerf_ovr_tier: 5, kerf_pos_tier: 4 }],
    ]);
    const weeklyCons = new Map([
      [10, { rank_ecr: 3, pos_rank: "QB2", opponent: "@KC" }],
      [20, { rank_ecr: 45, pos_rank: "WR20", opponent: "vs. NO" }],
    ]);
    const players = deriveWeekly(rows, weeklyProj, weeklyCons);
    const qb = players.find((p) => p.id === "10")!;
    expect(qb).toMatchObject({
      // Kerf = this week's re-score
      kerfOvrRank: 2, kerfPosRank: 1, kerfOvrTier: 1, kerfPosTier: 1, projPts: 22.5,
      // ECR = weekly consensus (its overall rank made contiguous: QB is #1 here)
      ecr: 3, posEcr: 2, ovrEcrRank: 1,
      // matchup + identity/roster carried through; dollars null (no weekly auction)
      opponent: "@KC", owner: "Rangoon Raccoons", salary: 50, contractYears: 2,
      kerfValue: null, rosterValue: null, marketPrice: null, marketPreAuction: null,
      // weekly consensus has NO tiers — those come from our Kerf tiers instead
      ovrEcrTier: null, posEcrTier: null,
      // dynasty context is unchanged from the board
      dynastyEcr: 3, dynPosEcr: 1,
    });
    expect(players.find((p) => p.id === "20")!.ovrEcrRank).toBe(2); // WR after QB
  });

  it("leaves weekly fields null for a player the weekly feeds don't cover (bye/unranked)", () => {
    const players = deriveWeekly(rows, new Map(), new Map()); // no weekly proj/consensus
    const qb = players.find((p) => p.id === "10")!;
    expect(qb.kerfOvrRank).toBeNull();
    expect(qb.ecr).toBeNull();
    expect(qb.opponent).toBeNull();
    expect(qb.projPts).toBeNull();
    // identity + roster still present
    expect(qb).toMatchObject({ owner: "Rangoon Raccoons", salary: 50 });
  });
});
