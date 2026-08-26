// Historical CSV parser tests (issue #17): the grouped/shifted CBS stat headers
// parse to the right columns (anchored), the advanced+standard files join on FPTS
// agreement, misalignment fails LOUDLY, and the contract/TRUFFLE files parse.

import { describe, it, expect } from "vitest";
import {
  parseCsv, parseStatPlayerCell, parseStatFile, joinSeason, parseContracts, parseTruffle,
} from "./parse-historical.mjs";
import { IngestError } from "./parse-cbs-ingest.mjs";

// --- fixtures: the real 3-row header shapes + one data row per file ----------
// Advanced cols: ...,Pct,[pass 1stD,2Pt,Avg],[rush 1stD,2Pt,Avg],[rec 1stD,2Pt],[fpts Avg,Total]
const ADV = [
  "All Players 2025  Season NFL Advanced Categories",
  ",,,Upcoming,,,Trends,,Passing,,,Rushing,,,Receiving,,,FPTS,,",
  "Avail,Player,Opp,OVP,Bye,Rost,Start,Pct,1stD,2Pt,Avg,1stD,2Pt,Avg,1stD,2Pt,Avg,Total,",
  "FA,Testy Passer QB | AAA,@X,1,9,50,40,60.0,100,1,5.0,20,0,0.0,0,0,11.76,200.00",
  "Some Team,Testy Catcher WR | BBB,@Y,2,7,90,80,0.0,0,0,4.7,0,0,9.1,55,1,10.00,170.00",
].join("\n");

// Standard cols: ...,Start,ATT,Comp,Yds,TD,Int,Att,Yds,TD,Tar,Rec,Yds,TD,Lost,Avg,Total
const STD = [
  "All Players 2025  Season NFL Standard Categories",
  ",,,Upcoming,,,Trends,,Passing,,,,,Rushing,,,Receiving,,,,Fumbles,FPTS,,",
  "Avail,Player,Opp,OVP,Bye,Rost,Start,ATT,Comp,Yds,TD,Int,Att,Yds,TD,Tar,Rec,Yds,TD,Lost,Avg,Total,",
  "FA,Testy Passer QB | AAA,@X,1,9,50,40,400,280,3000,20,8,60,300,4,0,0,0,0,2,11.76,200.00",
  "Some Team,Testy Catcher WR | BBB,@Y,2,7,90,80,0,0,0,0,0,3,15,0,110,80,900,6,1,10.00,170.00",
].join("\n");

describe("parseCsv", () => {
  it("keeps commas inside quoted fields (TRUFFLE bid JSON)", () => {
    const rows = parseCsv(`a,b,"[{""x"":1}, {""y"":2}]"\n`);
    expect(rows[0]).toEqual(["a", "b", '[{"x":1}, {"y":2}]']);
  });
});

describe("parseStatPlayerCell", () => {
  it("reads name/pos/team from 'Name POS | TEAM'", () => {
    expect(parseStatPlayerCell("Christian McCaffrey RB | SF ")).toMatchObject({ name: "Christian McCaffrey", pos: "RB", nflTeam: "SF" });
  });
  it("returns null for non-data rows (headers/footers)", () => {
    expect(parseStatPlayerCell("Report Updated as of 8/26/26")).toBeNull();
  });
});

describe("parseStatFile — anchored column alignment", () => {
  it("puts first downs in the right columns (advanced)", () => {
    const m = parseStatFile(ADV, { kind: "advanced", context: "adv" });
    const qb = m.get("Testy Passer QB | AAA");
    expect(qb).toMatchObject({ pass_first_downs: 100, pass_2pt: 1, rush_first_downs: 20, rec_first_downs: 0, fpts_total: 200 });
    const wr = m.get("Testy Catcher WR | BBB");
    expect(wr).toMatchObject({ rec_first_downs: 55, rec_2pt: 1, fpts_total: 170 });
  });
  it("reads volume columns (standard)", () => {
    const m = parseStatFile(STD, { kind: "standard", context: "std" });
    expect(m.get("Testy Passer QB | AAA")).toMatchObject({ pass_yds: 3000, pass_td: 20, pass_int: 8, rush_yds: 300, fumbles_lost: 2, fpts_total: 200 });
    expect(m.get("Testy Catcher WR | BBB")).toMatchObject({ rec_rec: 80, rec_yds: 900, rec_td: 6, fpts_total: 170 });
  });
  it("fails loudly if the column-header row is absent", () => {
    expect(() => parseStatFile("garbage\nno,headers,here\n", { kind: "advanced", context: "x" })).toThrow(IngestError);
  });
});

describe("joinSeason", () => {
  it("joins advanced+standard per player and merges fields", () => {
    const advanced = parseStatFile(ADV, { kind: "advanced", context: "adv" });
    const standard = parseStatFile(STD, { kind: "standard", context: "std" });
    const { joined } = joinSeason({ season: 2025, advanced, standard });
    const qb = joined.find((j) => j.player.name === "Testy Passer");
    expect(qb).toMatchObject({ pass_yds: 3000, pass_first_downs: 100, rush_first_downs: 20, fpts_total: 200 });
  });
  it("throws if the two files disagree on FPTS Total (misalignment)", () => {
    const advanced = parseStatFile(ADV, { kind: "advanced", context: "adv" });
    const badStd = parseStatFile(STD.replace("11.76,200.00", "11.76,999.00"), { kind: "standard", context: "std" });
    expect(() => joinSeason({ season: 2025, advanced, standard: badStd })).toThrow(/FPTS Total disagrees/);
  });
  it("throws if an anchor first-down count is wrong (layout drift)", () => {
    const advanced = parseStatFile(ADV, { kind: "advanced", context: "adv" });
    const standard = parseStatFile(STD, { kind: "standard", context: "std" });
    const anchors = [{ name: "Testy Passer", expect: { pass_first_downs: 999 } }];
    expect(() => joinSeason({ season: 2025, advanced, standard, anchors })).toThrow(/anchor check FAILED/);
  });
});

describe("parseContracts", () => {
  const CSV = [
    "Pos,Player,TRF,Age,NFL,Salary,Yr,'24,'25,'26,'27,'28",
    "QB,Lamar Jackson,SBS,29,BAL,201,4,201,201,201,201,FT",
    "DST,Commanders,PP,,WAS,3,2,3,3,FT,FT,FA",
    "DC,Mark Andrews Dead Cap,PP,,BAL,8,1,8,FA,FT,FA,-",
  ].join("\n");
  it("uses the 2025 salary and reads Yr/age/team", () => {
    const rows = parseContracts(CSV, { context: "c" });
    const lamar = rows.find((r) => r.name === "Lamar Jackson");
    expect(lamar).toMatchObject({ season: 2025, salary: 201, contractYears: 4, age: 29, trfTeam: "SBS", nflTeam: "BAL" });
  });
  it("flags dead-cap rows (Pos='DC')", () => {
    const rows = parseContracts(CSV, { context: "c" });
    expect(rows.find((r) => r.name.includes("Dead Cap")).isDeadCap).toBe(true);
    expect(rows.find((r) => r.name === "Lamar Jackson").isDeadCap).toBe(false);
  });
  it("keeps the full schedule verbatim for provenance", () => {
    const rows = parseContracts(CSV, { context: "c" });
    expect(JSON.parse(rows[0].scheduleRaw)["'28"]).toBe("FT");
  });
});

describe("parseTruffle", () => {
  const CSV = [
    "SznPlPos,PlPos,SznLgTrf,LgTrf,Season,TrfLg,TrfTm,NominationOrder,Player,PlayerID,Pos,NFL,Salary,BidHistory",
    `x,y,z,w,2026.0,TRUFFLE,NN,1.0,AJ Brown,2258303.0,WR,NE,75.0,"[{""Team"": ""CRB"", ""Bid"": 1.0}, {""Team"": ""NN"", ""Bid"": 75.0}]"`,
  ].join("\n");
  it("reads the CBS PlayerID directly and keeps bid history verbatim", () => {
    const rows = parseTruffle(CSV, { context: "t" });
    expect(rows[0]).toMatchObject({ cbsPlayerId: 2258303, playerName: "AJ Brown", finalSalary: 75, nominationOrder: 1, league: "TRUFFLE", winningTeam: "NN" });
    expect(JSON.parse(rows[0].bidHistoryJson)).toHaveLength(2);
  });
  it("rejects invalid bid-history JSON", () => {
    const bad = CSV.replace('"[{""Team"": ""CRB"", ""Bid"": 1.0}, {""Team"": ""NN"", ""Bid"": 75.0}]"', '"not json"');
    expect(() => parseTruffle(bad, { context: "t" })).toThrow(IngestError);
  });
});
