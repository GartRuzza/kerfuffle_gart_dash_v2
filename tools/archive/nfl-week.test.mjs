import { describe, it, expect } from "vitest";
import { currentNflWeek, NFL_2026_WEEK_END_DATES } from "./nfl-week.mjs";

// The whole point of this table is being transparent and correct, so the tests
// pin the boundary behaviour: the Tuesday flip, the preseason default, and the
// post-season clamp.

describe("currentNflWeek — 2026 date→week table", () => {
  it("returns Week 1 for any preseason date (FP publishes the upcoming week early)", () => {
    expect(currentNflWeek("2026-08-27")).toBe(1); // the day this was built
    expect(currentNflWeek("2026-09-08")).toBe(1); // day before the Wed opener
  });

  it("stays on Week 1 through its final game (Monday 2026-09-14)", () => {
    expect(currentNflWeek("2026-09-13")).toBe(1); // Sunday
    expect(currentNflWeek("2026-09-14")).toBe(1); // Monday Night Football
  });

  it("flips to Week 2 the next day (Tuesday 2026-09-15)", () => {
    expect(currentNflWeek("2026-09-15")).toBe(2);
    expect(currentNflWeek("2026-09-21")).toBe(2); // Week 2's own Monday
  });

  it("tracks a mid-season week correctly", () => {
    expect(currentNflWeek("2026-11-12")).toBe(10); // Thu after Week 9's Monday (11-09)
    expect(currentNflWeek("2026-11-16")).toBe(10); // Week 10's Monday
    expect(currentNflWeek("2026-11-17")).toBe(11); // flips Tuesday
  });

  it("clamps to Week 18 after the regular season ends", () => {
    expect(currentNflWeek("2027-01-11")).toBe(18); // Week 18's Monday
    expect(currentNflWeek("2027-02-01")).toBe(18); // deep offseason → clamped
  });

  it("accepts a Date object as well as an ISO string", () => {
    expect(currentNflWeek(new Date("2026-09-20T18:00:00Z"))).toBe(2);
  });

  it("throws on an unparseable date rather than guessing a week", () => {
    expect(() => currentNflWeek("not-a-date")).toThrowError(/invalid date/);
  });

  it("has a monotonically increasing, gap-free 18-week table", () => {
    expect(NFL_2026_WEEK_END_DATES).toHaveLength(18);
    for (let i = 0; i < NFL_2026_WEEK_END_DATES.length; i++) {
      expect(NFL_2026_WEEK_END_DATES[i].week).toBe(i + 1);
      if (i > 0) {
        expect(NFL_2026_WEEK_END_DATES[i].ends > NFL_2026_WEEK_END_DATES[i - 1].ends).toBe(true);
      }
    }
  });
});
