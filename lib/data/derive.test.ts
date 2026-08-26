import { describe, it, expect } from "vitest";
import { deriveBoard, posRankNumber, type BoardViewRow } from "./derive";

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
});
