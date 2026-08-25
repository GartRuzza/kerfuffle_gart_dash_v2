import { describe, it, expect } from "vitest";
import { maskValue, isLeakFree, classifyField, mayListDistinct } from "./sanitize.mjs";

describe("maskValue", () => {
  it("maps letters and digits to shapes, keeps punctuation", () => {
    expect(maskValue("Ja'Marr Chase")).toBe("Aa'Aaaa Aaaaa");
    expect(maskValue("$102")).toBe("$999");
    expect(maskValue("3 yr")).toBe("9 aa");
    expect(maskValue("WR12")).toBe("AA99");
  });
  it("handles null/undefined/number input", () => {
    expect(maskValue(null)).toBe("");
    expect(maskValue(undefined)).toBe("");
    expect(maskValue(102)).toBe("999");
  });
});

describe("isLeakFree — the safety invariant", () => {
  it("a masked value is always leak-free", () => {
    for (const s of ["Ja'Marr Chase", "$102", "Christian McCaffrey $9/1yr", "WR12", "2966320", "-4"]) {
      expect(isLeakFree(maskValue(s))).toBe(true);
    }
  });
  it("any real digit (0-8) or non-a letter fails the check", () => {
    expect(isLeakFree("Chase")).toBe(false); // real letters survive
    expect(isLeakFree("$102")).toBe(false); // real digits survive
    expect(isLeakFree("aaa 9 A")).toBe(true); // only a/A/9 as alphanumerics
  });
});

describe("classifyField", () => {
  it("marks league-private columns private", () => {
    for (const h of ["Salary", "Proj", "PosRnk", "Ovr ECR", "rank_ecr", "player_owned_avg", "tier", "Market Value"]) {
      expect(classifyField(h, { cardinality: 3 })).toBe("private");
    }
  });
  it("marks names private", () => {
    expect(classifyField("Players", { cardinality: 200 })).toBe("private");
    expect(classifyField("player_name", { cardinality: 500 })).toBe("private");
    expect(classifyField("Team", { cardinality: 12 })).toBe("private");
  });
  it("marks ids as identifier", () => {
    expect(classifyField("cbs_player_id", { cardinality: 500 })).toBe("identifier");
    expect(classifyField("player_filename", { cardinality: 500 })).toBe("identifier");
  });
  it("marks non-private low-cardinality enums structural", () => {
    expect(classifyField("Pos", { cardinality: 5 })).toBe("structural");
    expect(classifyField("position_id", { cardinality: 5 })).toBe("structural");
    expect(classifyField("Status", { cardinality: 4 })).toBe("structural");
    expect(classifyField("Contract", { cardinality: 4 })).toBe("structural");
    expect(classifyField("player_bye_week", { cardinality: 14 })).toBe("structural");
    expect(classifyField("scoring", { cardinality: 3 })).toBe("structural");
  });
  it("does not treat a high-cardinality structural-named field as listable", () => {
    // a 'type' column with 500 distinct values must not dump values
    expect(classifyField("type", { cardinality: 500 })).not.toBe("structural");
  });
  it("only structural fields may list distinct values", () => {
    expect(mayListDistinct("structural")).toBe(true);
    expect(mayListDistinct("private")).toBe(false);
    expect(mayListDistinct("identifier")).toBe(false);
    expect(mayListDistinct("freeform")).toBe(false);
  });
});
