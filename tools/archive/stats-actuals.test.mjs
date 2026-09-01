import { describe, it, expect } from "vitest";
import {
  STATS_ACTUALS_POSITIONS,
  statsActualsSeeds,
  statsActualsPageUrl,
  actualsAsOfWeek,
} from "./stats-actuals.mjs";

describe("stats-actuals URL construction (issue #30)", () => {
  it("pins offense-only positions, ytd timeframe, and the stats (actuals) view", () => {
    const seeds = statsActualsSeeds();
    expect(seeds.map((s) => s.name)).toEqual([
      "stats-actuals-standard",
      "stats-actuals-advanced",
    ]);
    for (const s of seeds) {
      // offense-only scope, DST/K excluded
      expect(s.path).toContain(STATS_ACTUALS_POSITIONS);
      expect(s.path).not.toMatch(/DST|:K\b/);
      // year-to-date actuals, NFL scope
      expect(s.path).toContain("/ytd:p/");
      // the actuals view, NOT projections
      expect(s.path).toMatch(/\/stats$/);
      expect(s.path).not.toContain("projections");
    }
  });

  it("captures BOTH standard (volume + FPTS) and advanced (first downs) categories", () => {
    const seeds = statsActualsSeeds();
    const standard = seeds.find((s) => s.name.endsWith("standard"));
    const advanced = seeds.find((s) => s.name.endsWith("advanced"));
    expect(standard.path).toContain("/standard/stats");
    expect(advanced.path).toContain("/advanced/stats");
  });

  it("paginates by pinning our own segments + ?start_row=N (never CBS's hrefs)", () => {
    const [standard] = statsActualsSeeds();
    const url = statsActualsPageUrl(standard.path, 101);
    // the full pinned view is preserved; only start_row is appended
    expect(url).toBe(`${standard.path}?start_row=101`);
    expect(url).toContain("/ytd:p/standard/stats?start_row=101");
  });
});

describe("actuals as-of week (issue #30)", () => {
  it("is 0 preseason — ytd holds zero completed games before Week 1", () => {
    expect(actualsAsOfWeek("2026-08-28")).toBe(0); // before the season opens
    expect(actualsAsOfWeek("2026-09-09")).toBe(0); // Week 1 kickoff, not yet complete
  });

  it("is the last COMPLETED week once games have been played", () => {
    // The Tuesday after Week 1's Monday Night Football: Week 1 done, Week 2 is current.
    expect(actualsAsOfWeek("2026-09-15")).toBe(1);
    // Mid-Week-5: four weeks in the books.
    expect(actualsAsOfWeek("2026-10-08")).toBe(4);
  });

  it("clamps sensibly at the end of the regular season", () => {
    expect(actualsAsOfWeek("2027-01-20")).toBe(17); // after Week 18's end date
  });
});
