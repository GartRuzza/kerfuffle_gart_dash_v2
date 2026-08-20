import { describe, expect, it } from "vitest";
import { DATA_DICTIONARY } from "./dataDictionary";
import { ALL_COLUMN_IDS } from "./views";

describe("data dictionary", () => {
  it("documents every column (no undocumented field)", () => {
    const ids = DATA_DICTIONARY.map((d) => d.id).sort();
    expect(ids).toEqual([...ALL_COLUMN_IDS].sort());
  });

  it("keeps definitions short (< 15 words) and always has a term + deep-dive", () => {
    for (const f of DATA_DICTIONARY) {
      expect(f.term.length).toBeGreaterThan(0);
      expect(f.definition.trim().split(/\s+/).length).toBeLessThan(15);
      expect(f.deepDive.length).toBeGreaterThan(0);
    }
  });
});
