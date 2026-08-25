import { describe, it, expect } from "vitest";
import {
  isBlank, inferValueType, dominantType, pct, profileColumn,
} from "./profile-core.mjs";
import { isLeakFree } from "./sanitize.mjs";

describe("isBlank", () => {
  it("treats empty and dash placeholders as blank", () => {
    for (const b of ["", " ", "-", "--", "—", "N/A", "na", "null"]) expect(isBlank(b)).toBe(true);
    expect(isBlank("0")).toBe(false);
    expect(isBlank("QB")).toBe(false);
  });
});

describe("inferValueType", () => {
  it("classifies common cell shapes", () => {
    expect(inferValueType("$102")).toBe("money");
    expect(inferValueType("99%")).toBe("percent");
    expect(inferValueType("12")).toBe("integer");
    expect(inferValueType("12.4")).toBe("decimal");
    expect(inferValueType("2966320")).toBe("id");
    expect(inferValueType("8/25/26 9:15 PM ET")).toBe("datetime");
    expect(inferValueType("QB")).toBe("string");
    expect(inferValueType("Yes")).toBe("boolean");
  });
});

describe("dominantType", () => {
  it("picks the most common non-blank type and flags mixed", () => {
    expect(dominantType(["1", "2", "3"])).toMatchObject({ type: "integer", mixed: false });
    const r = dominantType(["1", "2", "x"]);
    expect(r.type).toBe("integer");
    expect(r.mixed).toBe(true);
  });
  it("returns empty for all-blank columns", () => {
    expect(dominantType(["", "-", "—"])).toMatchObject({ type: "empty" });
  });
});

describe("pct", () => {
  it("rounds a rate to whole percent", () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(0, 0)).toBe(0);
    expect(pct(1, 3)).toBe(33);
  });
});

describe("profileColumn", () => {
  it("profiles a private column shape-only (no distinct values, masked example)", () => {
    const f = profileColumn("Salary", ["$9", "$102", "", "$45"]);
    expect(f.category).toBe("private");
    expect(f.type).toBe("money");
    expect(f.distinct_values).toBeUndefined();
    expect(isLeakFree(f.example)).toBe(true);
    expect(f.null_blank_rate_pct).toBe(25);
    expect(f.cardinality).toBe(3);
  });

  it("publishes distinct values for a structural enum", () => {
    const f = profileColumn("Pos", ["QB", "RB", "WR", "TE", "QB", "WR"]);
    expect(f.category).toBe("structural");
    expect(f.distinct_values).toEqual(["QB", "RB", "TE", "WR"]);
    // example is still masked shape
    expect(isLeakFree(f.example)).toBe(true);
  });

  it("never leaks a real player name", () => {
    const f = profileColumn("Players", ["Ja'Marr Chase WR • CIN", "Puka Nacua WR • LAR"]);
    expect(f.category).toBe("private");
    expect(f.distinct_values).toBeUndefined();
    expect(f.example).not.toMatch(/Chase|Nacua|Marr|Puka/);
    expect(isLeakFree(f.example)).toBe(true);
  });
});
