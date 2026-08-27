// FantasyPros projections parser tests (issue #18).

import { describe, it, expect } from "vitest";
import { mapProjections } from "./parse-projections.mjs";
import { IngestError } from "./parse-cbs-ingest.mjs";

function payload(players) {
  return { season: 2026, week: 0, scoring: "STD", positions: "QB,RB,WR,TE,K,DST", players };
}

describe("mapProjections", () => {
  it("maps the component stat line and season/week", () => {
    const { season, week, rows } = mapProjections(
      payload([
        {
          fpid: 100, name: "Test QB", position_id: "QB", team_id: "BUF",
          stats: { pass_yds: 4000, pass_tds: 30, pass_ints: 10, rush_att: 100, rush_yds: 500, rush_tds: 5, fumbles: 4, "2pt_tds": 1, points: 350 },
        },
      ])
    );
    expect(season).toBe(2026);
    expect(week).toBe(0);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.fpPlayerId).toBe(100);
    expect(r.pos).toBe("QB");
    expect(r.pass_yds).toBe(4000);
    expect(r.pass_td).toBe(30);
    expect(r.pass_int).toBe(10);
    expect(r.rush_att).toBe(100);
    expect(r.fumbles).toBe(4);
    expect(r.two_pt).toBe(1);
    expect(r.fpPoints).toBe(350); // reference only
  });

  it("excludes kickers and defenses (offense-only engine)", () => {
    const { rows } = mapProjections(
      payload([
        { fpid: 1, name: "A WR", position_id: "WR", stats: { rec_rec: 90, rec_yds: 1100, rec_tds: 8 } },
        { fpid: 2, name: "A Kicker", position_id: "K", stats: { points: 140 } },
        { fpid: 3, name: "A Defense", position_id: "DST", stats: { def_sack: 40 } },
      ])
    );
    expect(rows.map((r) => r.pos)).toEqual(["WR"]);
  });

  it("missing projected categories coerce to 0, not null", () => {
    const { rows } = mapProjections(
      payload([{ fpid: 5, name: "Sparse", position_id: "TE", stats: { rec_rec: 50 } }])
    );
    expect(rows[0].rec_rec).toBe(50);
    expect(rows[0].rush_att).toBe(0);
    expect(rows[0].pass_yds).toBe(0);
  });

  it("refuses two rows sharing an fpid (would double-count in the pool)", () => {
    expect(() =>
      mapProjections(
        payload([
          { fpid: 7, name: "One", position_id: "RB", stats: {} },
          { fpid: 7, name: "Two", position_id: "RB", stats: {} },
        ])
      )
    ).toThrow(IngestError);
  });

  it("refuses an empty payload", () => {
    expect(() => mapProjections(payload([]), "x")).toThrow(IngestError);
  });

  it("carries a per-week (week=N) payload through unchanged (issue #27)", () => {
    // The weekly lens (#29) reads the current week's projection, in the SAME shape
    // as the season line — mapProjections just reports whichever week FP echoes.
    const weekly = { season: 2026, week: 2, scoring: "STD", players: [
      { fpid: 100, name: "Test QB", position_id: "QB", team_id: "BUF",
        stats: { pass_yds: 260, pass_tds: 2, rush_yds: 20, points: 21.4 } },
    ] };
    const { season, week, rows } = mapProjections(weekly, "projections-week-2");
    expect(season).toBe(2026);
    expect(week).toBe(2);
    expect(rows[0]).toMatchObject({ fpPlayerId: 100, pos: "QB", pass_yds: 260, week: 2 });
  });
});
