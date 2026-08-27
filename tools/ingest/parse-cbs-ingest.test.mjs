import { describe, it, expect } from "vitest";
import {
  IngestError,
  headerMap,
  coerceSalary,
  coerceContractYears,
  parsePlayersCell,
  parseRosterForIngest,
  parseStandingsTeams,
  parseTransactionsPage,
  normalizeTxDate,
  txNaturalKey,
} from "./parse-cbs-ingest.mjs";

// ---------------------------------------------------------------------------
// Synthetic CBS-shaped fixtures (structure copied from the real pages; the
// class names are what tools/profile/parse-cbs.mjs keys on).
// ---------------------------------------------------------------------------

const ROSTER_HEADER =
  `<tr class="label"><td>Edit</td><td>Pos</td><td>Players</td><td>Bye</td>` +
  `<td>Salary</td><td>Contract</td><td>Proj</td></tr>`;

function playerRow({ slot, name, pos, team, bye = "9", salary, contract, proj = "100.5", id }) {
  const link = id ? `<a href="/players/playerpage/${id}">${name}</a> ${pos} • ${team}` : name;
  return (
    `<tr class="playerRow all"><td></td><td>${slot}</td><td>${link}</td>` +
    `<td>${bye}</td><td>${salary}</td><td>${contract}</td><td>${proj}</td></tr>`
  );
}

const subtitle = (label) =>
  `<tr class="playerRow all subtitle benchPlayer"><td colspan="7">${label}</td></tr>`;

function rosterHtml(rows, footer = "") {
  return `<html><body><table>${ROSTER_HEADER}${rows.join("")}${footer}</table></body></html>`;
}

// ---------------------------------------------------------------------------

describe("headerMap", () => {
  it("maps names to indexes", () => {
    const h = headerMap(["A", "B", "C"], ["B"], "ctx");
    expect(h.get("B")).toBe(1);
  });
  it("fails LOUDLY on a missing expected header (never positional)", () => {
    expect(() => headerMap(["A", "B"], ["Salary"], "ctx")).toThrowError(IngestError);
    expect(() => headerMap(["A", "B"], ["Salary"], "ctx")).toThrowError(/Salary/);
  });
});

describe("deliberate coercion", () => {
  it("salary: '$34' and '34' -> 34; blank/dash -> null (meaningful, not missing)", () => {
    expect(coerceSalary("$34", "c")).toBe(34);
    expect(coerceSalary("34", "c")).toBe(34);
    expect(coerceSalary("", "c")).toBeNull();
    expect(coerceSalary("—", "c")).toBeNull();
  });
  it("salary: non-whole-dollar is a loud failure", () => {
    expect(() => coerceSalary("12.50", "c")).toThrowError(IngestError);
    expect(() => coerceSalary("abc", "c")).toThrowError(IngestError);
  });
  it("contract years: 1-4 pass, 0 = unassigned -> null, outside the domain fails loudly", () => {
    expect(coerceContractYears("3", "c")).toBe(3);
    // "0" is a just-assigned player whose term isn't set yet (post-auction) — unknown, not a failure
    expect(coerceContractYears("0", "c")).toBeNull();
    expect(() => coerceContractYears("5", "c")).toThrowError(/domain/);
    expect(() => coerceContractYears("", "c")).toThrowError(IngestError);
    expect(coerceContractYears("", "c", { allowBlank: true })).toBeNull();
  });
});

describe("parsePlayersCell", () => {
  it("reads name / position / NFL team", () => {
    expect(parsePlayersCell("Caleb Williams QB • CHI", "c")).toEqual({
      name: "Caleb Williams", pos: "QB", nflTeam: "CHI",
    });
  });
  it("handles DST rows", () => {
    expect(parsePlayersCell("Rams DST • LAR", "c")).toEqual({
      name: "Rams", pos: "DST", nflTeam: "LAR",
    });
  });
  it("fails loudly on an unrecognizable cell", () => {
    expect(() => parsePlayersCell("??", "c")).toThrowError(IngestError);
  });
});

describe("parseRosterForIngest", () => {
  it("parses players with sections, slots, and the roster status", () => {
    const html = rosterHtml([
      playerRow({ slot: "QB", name: "Alpha Man", pos: "QB", team: "BUF", salary: "50", contract: "2", id: 111 }),
      subtitle("Reserves"),
      playerRow({ slot: "RB", name: "Beta Guy", pos: "RB", team: "DET", salary: "10", contract: "1", id: 222 }),
      subtitle("Practice"),
      playerRow({ slot: "WR", name: "Gamma Kid", pos: "WR", team: "KC", salary: "3", contract: "3", id: 333 }),
    ]);
    const r = parseRosterForIngest(html, 1);
    expect(r.players).toHaveLength(3);
    expect(r.players[0]).toMatchObject({
      cbsPlayerId: 111, name: "Alpha Man", pos: "QB", nflTeam: "BUF",
      rosterStatus: "Active", rosterSlot: "QB", salary: 50, contractYears: 2,
    });
    expect(r.players[1].rosterStatus).toBe("Reserves");
    expect(r.players[2].rosterStatus).toBe("Practice");
    expect(r.deadCap).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });

  it("classifies a no-id row WITH a salary as dead cap (owner decision 2026-08-25)", () => {
    const html = rosterHtml([
      playerRow({ slot: "QB", name: "Alpha Man", pos: "QB", team: "BUF", salary: "50", contract: "2", id: 111 }),
      subtitle("Reserves"),
      playerRow({ slot: "", name: "Former Player (dead cap)", pos: "", team: "", salary: "12", contract: "", id: null }),
    ]);
    const r = parseRosterForIngest(html, 1);
    expect(r.players).toHaveLength(1);
    expect(r.deadCap).toHaveLength(1);
    expect(r.deadCap[0]).toMatchObject({ salary: 12, rosterStatus: "Reserves", contractYears: null });
    expect(r.deadCap[0].label).toContain("Former Player");
  });

  it("REFUSES to classify a no-id, no-salary row silently", () => {
    const html = rosterHtml([
      playerRow({ slot: "QB", name: "Mystery Row", pos: "", team: "", salary: "", contract: "", id: null }),
    ]);
    expect(() => parseRosterForIngest(html, 1)).toThrowError(/Refusing to classify/);
  });

  it("blank salary on a real player row -> null + a warning (observed on real rosters)", () => {
    const html = rosterHtml([
      playerRow({ slot: "WR", name: "New Pickup", pos: "WR", team: "SF", salary: "", contract: "2", id: 444 }),
    ]);
    const r = parseRosterForIngest(html, 7);
    expect(r.players[0].salary).toBeNull();
    expect(r.warnings.join(" ")).toMatch(/blank salary/);
  });

  it("fails loudly when an expected column header is missing", () => {
    const html = `<table><tr class="label"><td>Pos</td><td>Players</td></tr></table>`;
    expect(() => parseRosterForIngest(html, 1)).toThrowError(IngestError);
  });

  it("reads the footer totals for the cap cross-check", () => {
    const html = rosterHtml(
      [playerRow({ slot: "QB", name: "Alpha Man", pos: "QB", team: "BUF", salary: "50", contract: "2", id: 111 })],
      `<tr class="footer"><td colspan="7">Active: 1 Active Salary: 50.00 Total Salary: 50.00</td></tr>`,
    );
    expect(parseRosterForIngest(html, 1).footer.totalSalary).toBe(50);
  });
});

describe("parseStandingsTeams", () => {
  it("collects teams with ids and divisions, deduped across tables", () => {
    const html = `<table>
      <tr><td>North Division</td></tr>
      <tr><td><a href="/teams/3">Rangoon Raccoons</a></td><td>0</td></tr>
      <tr><td><a href="/teams/7">Laguna Beach Cougars</a></td><td>0</td></tr>
      <tr><td>South Division</td></tr>
      <tr><td><a href="/teams/2">Cooper Park Centurions</a></td><td>0</td></tr>
      <tr><td><a href="/teams/3">Rangoon Raccoons</a></td><td>dupe</td></tr>
    </table>`;
    const teams = parseStandingsTeams(html);
    expect(teams).toHaveLength(3);
    expect(teams[0]).toEqual({ teamId: 3, name: "Rangoon Raccoons", division: "North Division" });
    expect(teams[2]).toEqual({ teamId: 2, name: "Cooper Park Centurions", division: "South Division" });
  });
});

describe("parseTransactionsPage", () => {
  const TX_HTML = `<table>
    <tr class="label"><td>Date</td><td>Team</td><td>Players</td><td>Effective</td></tr>
    <tr class="row1"><td>8/22/26 5:42 AM ET</td><td>Peachtree City Panthers</td><td>DJ Giddens RB • IND - Dropped</td><td>1</td></tr>
    <tr class="row2"><td>8/21/26 11:44 AM ET</td><td>Park Slope Lovers</td><td>Josh Allen QB • BUF - Signed</td><td>1</td></tr>
  </table>`;

  it("parses rows by header name with an inferred type", () => {
    const rows = parseTransactionsPage(TX_HTML, "t");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ team: "Peachtree City Panthers", inferredType: "Dropped", effective: "1" });
    expect(rows[1].inferredType).toBe("Signed");
  });
  it("natural keys are stable and unique per row content", () => {
    const rows = parseTransactionsPage(TX_HTML, "t");
    expect(rows[0].naturalKey).not.toBe(rows[1].naturalKey);
    expect(rows[0].naturalKey).toBe(txNaturalKey(rows[0]));
  });
  it("fails loudly when the table shape is missing", () => {
    expect(() => parseTransactionsPage("<table><tr><td>nope</td></tr></table>", "t")).toThrowError(IngestError);
  });
});

describe("normalizeTxDate", () => {
  it("normalizes CBS dates to sortable ISO-ish strings", () => {
    expect(normalizeTxDate("8/22/26 5:42 AM ET")).toBe("2026-08-22T05:42");
    expect(normalizeTxDate("8/22/26 12:15 PM ET")).toBe("2026-08-22T12:15");
    expect(normalizeTxDate("12/1/26 12:05 AM ET")).toBe("2026-12-01T00:05");
    expect(normalizeTxDate("9/3/26")).toBe("2026-09-03T00:00");
  });
  it("keeps unparseable dates verbatim rather than guessing", () => {
    expect(normalizeTxDate("sometime later")).toBe("sometime later");
  });
});
