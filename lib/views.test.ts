import { describe, expect, it } from "vitest";
import {
  ALL_COLUMN_IDS,
  ALWAYS_VISIBLE,
  DEFAULT_VIEWS,
  DEFAULT_VIEW_ID,
  visibilityFromHidden,
} from "./views";
import { MY_TEAM } from "./types";

describe("default views", () => {
  it("every default view is internally consistent", () => {
    for (const v of DEFAULT_VIEWS) {
      // column order is a permutation of all columns
      expect([...v.state.columnOrder].sort()).toEqual([...ALL_COLUMN_IDS].sort());
      // hidden columns are all real
      for (const h of v.state.hiddenColumns) {
        expect(ALL_COLUMN_IDS).toContain(h);
      }
      // the Player column is never hidden
      expect(v.state.hiddenColumns).not.toContain(ALWAYS_VISIBLE);
      // the sort column is visible (so its bands/indicator make sense)
      const sortId = v.state.sorting[0]?.id;
      if (sortId) expect(v.state.hiddenColumns).not.toContain(sortId);
    }
  });

  it("the load view exists and is 'Full' (all columns visible)", () => {
    const full = DEFAULT_VIEWS.find((v) => v.id === DEFAULT_VIEW_ID)!;
    expect(full).toBeTruthy();
    expect(full.state.hiddenColumns).toHaveLength(0);
  });

  it("view presets match the intended use cases", () => {
    const byId = Object.fromEntries(DEFAULT_VIEWS.map((v) => [v.id, v]));
    expect(byId["view-auction"].state.rosterMode).toBe("FA");
    expect(byId["view-waivers"].state.rosterMode).toBe("FA");
    expect(byId["view-trades"].state.rosterMode).toBe("ROSTERED");
    expect(byId["view-startsit"].state.manager).toBe(MY_TEAM);
  });
});

describe("visibilityFromHidden", () => {
  it("marks hidden columns false and the rest true", () => {
    const vis = visibilityFromHidden(["owner", "salary"]);
    expect(vis.owner).toBe(false);
    expect(vis.salary).toBe(false);
    expect(vis.name).toBe(true);
    expect(vis.kerfValue).toBe(true);
    // covers every column
    expect(Object.keys(vis).sort()).toEqual([...ALL_COLUMN_IDS].sort());
  });
});
