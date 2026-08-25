import { describe, it, expect } from "vitest";
import { parseSetting, parseScoring, parseSettingsTables } from "./parse-scoring.mjs";

describe("parseSetting", () => {
  it("parses flat point values", () => {
    expect(parseSetting("2 points")).toEqual({ kind: "flat", points: 2 });
    expect(parseSetting("-2 points")).toEqual({ kind: "flat", points: -2 });
    expect(parseSetting("1 point")).toEqual({ kind: "flat", points: 1 });
  });
  it("parses per-unit rates", () => {
    expect(parseSetting("0+ PaYds = .04 points for every 1 PaYd")).toEqual({
      kind: "per_unit", points_per_unit: 0.04, per_units: 1, unit: "PaYd",
    });
    expect(parseSetting("0+ RuYds = .1 points for every 1 RuYd")).toMatchObject({
      kind: "per_unit", points_per_unit: 0.1,
    });
  });
  it("parses tiered Points Against bands", () => {
    const raw =
      "0 - 0 DSTPAs = 10 points 1 - 6 DSTPAs = 7 points 7 - 13 DSTPAs = 4 points " +
      "14 - 20 DSTPAs = 1 point 21 - 27 DSTPAs = 0 points 28 - 35 DSTPAs = -1 point 36+ DSTPAs = -4 points";
    const r = parseSetting(raw);
    expect(r.kind).toBe("tiered");
    expect(r.bands[0]).toEqual({ min: 0, max: 0, points: 10 });
    expect(r.bands[1]).toEqual({ min: 1, max: 6, points: 7 });
    expect(r.bands[r.bands.length - 1]).toEqual({ min: 36, max: null, points: -4 });
    expect(r.bands).toHaveLength(7);
  });
});

// A minimal fixture shaped like CBS /rules scoring + a settings table.
const RULES_FIXTURE = `
<table class="data borderTop">
  <tr class="label"><td>Offensive</td><td>Name</td><td>Settings</td></tr>
  <tr class="row1"><td>PaTD</td><td>Passing TD</td><td>4 points</td></tr>
  <tr class="row2"><td>ReFD</td><td>Receiving First Down</td><td>1 point</td></tr>
  <tr class="label"><td>Defensive</td><td>Name</td><td>Settings</td></tr>
  <tr class="row1"><td>Int</td><td>Interceptions</td><td>2 points</td></tr>
</table>
<table class="data borderTop">
  <tr class="label"><td>Status</td><td>Min</td><td>Max</td></tr>
  <tr class="row1"><td>Starters</td><td>10</td><td>10</td></tr>
  <tr class="row2"><td>Practice Players</td><td>0</td><td>5</td></tr>
</table>
<table class="data borderTop">
  <tr class="label"><td>Description</td><td>Setting</td></tr>
  <tr class="row1"><td>Salary Cap</td><td>$500</td></tr>
</table>`;

describe("parseScoring", () => {
  it("extracts scoring rows tagged by section", () => {
    const rules = parseScoring(RULES_FIXTURE);
    expect(rules).toHaveLength(3);
    expect(rules[0]).toMatchObject({ section: "Offensive", code: "PaTD", parsed: { kind: "flat", points: 4 } });
    const int = rules.find((r) => r.code === "Int");
    expect(int).toMatchObject({ section: "Defensive", parsed: { points: 2 } });
  });
});

describe("parseSettingsTables", () => {
  it("extracts roster limits and general settings", () => {
    const { settings, rosterLimits } = parseSettingsTables(RULES_FIXTURE);
    expect(rosterLimits).toContainEqual({ status: "Starters", min: 10, max: 10 });
    expect(rosterLimits).toContainEqual({ status: "Practice Players", min: 0, max: 5 });
    expect(settings).toContainEqual({ description: "Salary Cap", setting: "$500" });
  });
});
