import { describe, it, expect } from "vitest";
import {
  parseStatsActualsPage,
  parseStatsActualsPages,
  joinActuals,
} from "./parse-cbs-actuals.mjs";

// ---- fixture builders: rows shaped exactly like the real CBS stats pages ----

const actionCell = (id) => `CBSi.app.Stats.ActionButtons.players.push({${id}:{"freeAgent":[]}});`;

function page(headerCells, dataRows) {
  const tr = (cls, cells) => `<tr class="${cls}">${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  return `<table><tbody>
    ${tr("label superheader", headerCells.map(() => ""))}
    ${tr("label", headerCells)}
    ${dataRows.map((cells, i) => tr(i % 2 ? "row2" : "row1", cells)).join("\n")}
  </tbody></table>`;
}

const STD_HEADER = ["Action","Avail","Player","Opp","OVP","Bye","Rost","Start","ATT","Comp","Yds","TD","Int","Att","Yds","TD","Tar","Rec","Yds","TD","Lost","Avg","Total"];
const ADV_HEADER = ["Action","Avail","Player","Opp","OVP","Bye","Rost","Start","Pct","1stD","2Pt","Avg","1stD","2Pt","Avg","1stD","2Pt","Avg","Total"];

// Josh Allen: 300 pass yds, 3 pass TD, 40 rush yds, 1 rush TD; adv: 4 rush 1stD, 15 pass 1stD.
const stdAllen = [actionCell(12345),"FA","Josh Allen QB • BUF","@NYJ","1","7","98%","82%","32","22","300","3","0","6","40","1","0","0","0","0","0","28.50","28.50"];
const advAllen = [actionCell(12345),"FA","Josh Allen QB • BUF","@NYJ","1","7","98%","82%","68.8","15","0","2.10","4","0","1.20","0","0","-","28.50"];
// Bijan Robinson: 120 rush yds, 1 rush TD, 6 rush 1stD; 5 rec, 40 rec yds, 2 rec 1stD.
const stdBijan = [actionCell(67890),"Raccoons","Bijan Robinson RB • ATL","CAR","2","5","100%","100%","0","0","0","0","0","18","120","1","6","5","40","0","1","18.00","18.00"];
const advBijan = [actionCell(67890),"Raccoons","Bijan Robinson RB • ATL","CAR","2","5","100%","100%","0.0","0","0","0.0","6","0","6.7","2","0","8.0","18.00"];

describe("parseStatsActualsPage — standard view", () => {
  const map = parseStatsActualsPage(page(STD_HEADER, [stdAllen, stdBijan]), { kind: "standard", context: "t" });

  it("keys by the CBS id embedded in the Action cell", () => {
    expect([...map.keys()].sort()).toEqual([12345, 67890]);
  });

  it("parses the player cell (name / position / NFL team) off the • separator", () => {
    const a = map.get(12345);
    expect(a.name).toBe("Josh Allen");
    expect(a.pos).toBe("QB");
    expect(a.nflTeam).toBe("BUF");
  });

  it("maps volume columns by the anchored fixed index", () => {
    const a = map.get(12345);
    expect(a.pass_yds).toBe(300);
    expect(a.pass_td).toBe(3);
    expect(a.rush_yds).toBe(40);
    expect(a.rush_td).toBe(1);
    expect(a.fpts_total).toBe(28.5);
    const b = map.get(67890);
    expect(b.rush_yds).toBe(120);
    expect(b.rec_rec).toBe(5);
    expect(b.rec_yds).toBe(40);
  });
});

describe("parseStatsActualsPage — advanced view", () => {
  const map = parseStatsActualsPage(page(ADV_HEADER, [advAllen, advBijan]), { kind: "advanced", context: "t" });

  it("extracts the rush/rec first downs KERFUFFLE scores", () => {
    expect(map.get(12345).rush_first_downs).toBe(4);
    expect(map.get(67890).rush_first_downs).toBe(6);
    expect(map.get(67890).rec_first_downs).toBe(2);
  });
});

describe("header anchoring", () => {
  it("throws loudly if the standard column layout has drifted", () => {
    const drifted = [...STD_HEADER];
    drifted[10] = "YDS"; // CBS renamed/moved a column
    expect(() => parseStatsActualsPage(page(drifted, [stdAllen]), { kind: "standard", context: "t" }))
      .toThrow(/column layout has drifted/);
  });

  it("throws if the page isn't a stats page at all", () => {
    expect(() => parseStatsActualsPage("<table><tr><td>nope</td></tr></table>", { kind: "standard", context: "t" }))
      .toThrow(/could not find the standard column-header row/);
  });
});

describe("joinActuals", () => {
  it("joins standard + advanced by id into one full stat line", () => {
    const standard = parseStatsActualsPage(page(STD_HEADER, [stdAllen, stdBijan]), { kind: "standard", context: "t" });
    const advanced = parseStatsActualsPage(page(ADV_HEADER, [advAllen, advBijan]), { kind: "advanced", context: "t" });
    const { joined, onlyStandard, onlyAdvanced } = joinActuals({ standard, advanced, context: "t" });
    expect(joined).toHaveLength(2);
    expect(onlyStandard).toEqual([]);
    expect(onlyAdvanced).toEqual([]);
    const allen = joined.find((j) => j.cbsPlayerId === 12345);
    // volume from standard, first downs from advanced, both present on one record
    expect(allen.pass_yds).toBe(300);
    expect(allen.rush_first_downs).toBe(4);
    expect(allen.fpts_total).toBe(28.5);
  });

  it("throws if the two pages disagree on a player's FPTS Total (misalignment)", () => {
    const standard = parseStatsActualsPage(page(STD_HEADER, [stdAllen]), { kind: "standard", context: "t" });
    const advDifferent = [...advAllen];
    advDifferent[18] = "99.00"; // advanced FPTS disagrees with standard's 28.50
    const advanced = parseStatsActualsPage(page(ADV_HEADER, [advDifferent]), { kind: "advanced", context: "t" });
    expect(() => joinActuals({ standard, advanced, context: "t" })).toThrow(/FPTS Total disagrees/);
  });

  it("reports players present in only one view rather than dropping them silently", () => {
    const standard = parseStatsActualsPage(page(STD_HEADER, [stdAllen, stdBijan]), { kind: "standard", context: "t" });
    const advanced = parseStatsActualsPage(page(ADV_HEADER, [advAllen]), { kind: "advanced", context: "t" });
    const { joined, onlyStandard } = joinActuals({ standard, advanced, context: "t" });
    expect(joined.map((j) => j.cbsPlayerId)).toEqual([12345]);
    expect(onlyStandard).toEqual([67890]);
  });
});

describe("parseStatsActualsPages — multi-page merge", () => {
  it("merges every start_row page of each category into one map", () => {
    const { standard, advanced } = parseStatsActualsPages({
      standardPages: [page(STD_HEADER, [stdAllen]), page(STD_HEADER, [stdBijan])],
      advancedPages: [page(ADV_HEADER, [advAllen]), page(ADV_HEADER, [advBijan])],
      context: "t",
    });
    expect([...standard.keys()].sort()).toEqual([12345, 67890]);
    expect([...advanced.keys()].sort()).toEqual([12345, 67890]);
  });
});
