import { describe, it, expect } from "vitest";
import { mapFpBoard } from "./parse-fp-ingest.mjs";
import { IngestError } from "./parse-cbs-ingest.mjs";

// This module's whole job is surviving FantasyPros changing shape, so the tests
// pin the two behaviours that are easy to get wrong: which field decides the
// board's identity, and what "unknown" means.

const player = (over = {}) => ({
  player_id: 9001,
  cbs_player_id: 111,
  player_name: "Some Player",
  player_position_id: "WR",
  player_team_id: "BUF",
  player_bye_week: "9",
  rank_ecr: 5,
  pos_rank: "WR3",
  tier: 2,
  rank_min: 4,
  rank_max: 7,
  rank_ave: 5.2,
  rank_std: 1.1,
  ...over,
});

const board = (over = {}) => ({
  ranking_type_name: "draft",
  type: "Draft PPR",
  scoring: "STD",
  position_id: "ALL",
  week: "0",
  total_experts: 110,
  players: [player()],
  ...over,
});

describe("board identity comes from the payload, not the file name", () => {
  it("uses ranking_type_name (the machine field), not the display label", () => {
    // The real API sends type:"Draft PPR" on a board requested as STD.
    const b = mapFpBoard(board(), "ecr-draft-std-all");
    expect(b).toMatchObject({ rankingType: "draft", scoringFormat: "STD", positionScope: "ALL" });
  });

  it("falls back to the first word of the display label when the machine field is absent", () => {
    const b = mapFpBoard(board({ ranking_type_name: undefined, type: "Weekly PPR", week: "3" }), "f");
    expect(b.rankingType).toBe("weekly");
    expect(b.week).toBe("3");
  });

  it("reports the dynasty board's OWN scoring, even when a different one was requested", () => {
    // Observed: the dynasty STD and PPR files are byte-identical, both declaring PPR.
    const b = mapFpBoard(board({ ranking_type_name: "dynasty", scoring: "PPR" }), "ecr-dynasty-std-all");
    expect(b).toMatchObject({ rankingType: "dynasty", scoringFormat: "PPR" });
  });

  it("only records a week for weekly boards", () => {
    expect(mapFpBoard(board({ week: "0" }), "f").week).toBeNull();
  });

  it("fails loudly on an unknown ranking type or scoring format", () => {
    expect(() => mapFpBoard(board({ ranking_type_name: "bestball", type: "Bestball" }), "f")).toThrowError(IngestError);
    expect(() => mapFpBoard(board({ scoring: "SUPERPPR" }), "f")).toThrowError(/scoring format/);
  });

  it("fails loudly on an empty board (an HOF board is never empty)", () => {
    expect(() => mapFpBoard(board({ players: [] }), "f")).toThrowError(/no players/);
  });
});

describe("unknown stays unknown (null is not zero)", () => {
  it("keeps an explicit null tier / expert spread as null, never 0", () => {
    const b = mapFpBoard(board({ players: [player({ tier: null, rank_std: null, rank_min: null })] }), "f");
    expect(b.rows[0]).toMatchObject({ tier: null, rankStd: null, rankMin: null });
  });

  it("treats an empty string the same as null", () => {
    const b = mapFpBoard(board({ players: [player({ tier: "", rank_ave: "" })] }), "f");
    expect(b.rows[0].tier).toBeNull();
    expect(b.rows[0].rankAve).toBeNull();
  });

  it("still reads real zero-ish values as numbers", () => {
    const b = mapFpBoard(board({ players: [player({ rank_std: 0, tier: 1 })] }), "f");
    expect(b.rows[0].rankStd).toBe(0);
    expect(b.rows[0].tier).toBe(1);
  });

  it("keeps a non-numeric cbs_player_id as null rather than joining on garbage", () => {
    const b = mapFpBoard(board({ players: [player({ cbs_player_id: "" })] }), "f");
    expect(b.rows[0].cbsPlayerId).toBeNull();
  });
});

describe("row validation", () => {
  it("fails loudly when a row has no player id or no rank", () => {
    expect(() => mapFpBoard(board({ players: [player({ rank_ecr: null })] }), "f")).toThrowError(/rank_ecr/);
    expect(() => mapFpBoard(board({ players: [player({ player_id: null })] }), "f")).toThrowError(/player_id/);
  });

  it("REJECTS two entries sharing one CBS id (that player would appear twice)", () => {
    const dupes = [player({ player_id: 1, player_name: "First" }), player({ player_id: 2, player_name: "Second" })];
    expect(() => mapFpBoard(board({ players: dupes }), "f")).toThrowError(/share cbs_player_id 111/);
  });

  it("allows many rows with NO CBS id — they're merely unjoinable, not duplicates", () => {
    const rows = [player({ player_id: 1, cbs_player_id: null }), player({ player_id: 2, cbs_player_id: null })];
    expect(mapFpBoard(board({ players: rows }), "f").rows).toHaveLength(2);
  });
});
