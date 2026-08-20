import { describe, expect, it } from "vitest";
import {
  positionAfterSort,
  shouldClearSortOnPositionChange,
  tierPlan,
} from "./tierRules";

describe("tierPlan — which bands show", () => {
  it("overall-rank sort → overall tiers, regardless of position filter", () => {
    expect(tierPlan("kerfOvrRank", "ALL")).toEqual({
      showTiers: true,
      tierField: "kerfOvrTier",
    });
    expect(tierPlan("ecr", "QB")).toEqual({
      showTiers: true,
      tierField: "ovrEcrTier",
    });
    expect(tierPlan("dynastyEcr", "FLEX")).toEqual({
      showTiers: true,
      tierField: "dynOvrTier",
    });
  });

  it("positional-rank sort needs a single position", () => {
    expect(tierPlan("kerfPosRank", "QB")).toEqual({
      showTiers: true,
      tierField: "kerfPosTier",
    });
    expect(tierPlan("posEcr", "WR")).toEqual({
      showTiers: true,
      tierField: "posEcrTier",
    });
    // multi-position → no bands
    for (const multi of ["ALL", "SUPERFLEX", "FLEX"] as const) {
      expect(tierPlan("kerfPosRank", multi).showTiers).toBe(false);
      expect(tierPlan("dynPosEcr", multi).showTiers).toBe(false);
    }
  });

  it("non-rank sort and no sort → no bands", () => {
    expect(tierPlan("projPts", "QB").showTiers).toBe(false);
    expect(tierPlan("kerfValue", "ALL").showTiers).toBe(false);
    expect(tierPlan(undefined, "ALL").showTiers).toBe(false);
  });
});

describe("positionAfterSort — auto-switch to QB", () => {
  it("switches to QB when starting a positional sort on a multi-position", () => {
    expect(positionAfterSort("kerfPosRank", "ALL")).toBe("QB");
    expect(positionAfterSort("posEcr", "SUPERFLEX")).toBe("QB");
    expect(positionAfterSort("dynPosEcr", "FLEX")).toBe("QB");
  });
  it("leaves a single position alone", () => {
    expect(positionAfterSort("kerfPosRank", "RB")).toBe("RB");
  });
  it("does nothing for overall-rank sorts", () => {
    expect(positionAfterSort("kerfOvrRank", "ALL")).toBe("ALL");
    expect(positionAfterSort("ecr", "FLEX")).toBe("FLEX");
  });
});

describe("shouldClearSortOnPositionChange — revert to no-tier default", () => {
  it("clears when a positional sort is active and you pick a multi-position", () => {
    expect(shouldClearSortOnPositionChange("kerfPosRank", "ALL")).toBe(true);
    expect(shouldClearSortOnPositionChange("posEcr", "SUPERFLEX")).toBe(true);
    expect(shouldClearSortOnPositionChange("dynPosEcr", "FLEX")).toBe(true);
  });
  it("does not clear when moving to another single position", () => {
    expect(shouldClearSortOnPositionChange("kerfPosRank", "WR")).toBe(false);
  });
  it("does not clear for overall sorts or no sort", () => {
    expect(shouldClearSortOnPositionChange("kerfOvrRank", "ALL")).toBe(false);
    expect(shouldClearSortOnPositionChange(undefined, "ALL")).toBe(false);
  });
});
