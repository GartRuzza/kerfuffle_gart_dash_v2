// End-to-end ingest tests against a SYNTHETIC fixture archive (issue #12
// acceptance criteria): a full run ingests; re-running is idempotent; a bad
// fixture (salary cap violation) is rejected LOUDLY and rolls back completely.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, applyMigrations } from "../../db/client.mjs";
import { ingestRun } from "./ingest.mjs";

// ---------------------------------------------------------------------------
// Fixture builders (same page shapes as parse-cbs-ingest.test.mjs)
// ---------------------------------------------------------------------------

const ROSTER_HEADER =
  `<tr class="label"><td>Edit</td><td>Pos</td><td>Players</td><td>Bye</td>` +
  `<td>Salary</td><td>Contract</td><td>Proj</td></tr>`;

function playerRow({ slot, name, pos, team, salary, contract, id, proj = "100.5" }) {
  const link = id ? `<a href="/players/playerpage/${id}">${name}</a> ${pos} • ${team}` : name;
  return (
    `<tr class="playerRow all"><td></td><td>${slot}</td><td>${link}</td>` +
    `<td>9</td><td>${salary}</td><td>${contract}</td><td>${proj}</td></tr>`
  );
}

const deadCapRow = (label, salary) =>
  `<tr class="playerRow all"><td></td><td></td><td>${label}</td><td></td><td>${salary}</td><td></td><td></td></tr>`;

const rosterHtml = (rows) => `<table>${ROSTER_HEADER}${rows.join("")}</table>`;

function standingsHtml(teamCount = 12) {
  const rows = [];
  for (let i = 1; i <= teamCount; i++) {
    rows.push(`<tr><td><a href="/teams/${i}">Team ${i}</a></td><td>0</td></tr>`);
  }
  return `<table><tr><td>Test Division</td></tr>${rows.join("")}</table>`;
}

const txHtml = `<table>
  <tr class="label"><td>Date</td><td>Team</td><td>Players</td><td>Effective</td></tr>
  <tr class="row1"><td>8/22/26 5:42 AM ET</td><td>Team 1</td><td>Some Guy RB • IND - Dropped</td><td>1</td></tr>
  <tr class="row2"><td>8/21/26 9:00 AM ET</td><td>Team 2</td><td>Other Guy QB • BUF - Signed</td><td>1</td></tr>
</table>`;

const rulesHtml = `<table>
  <tr class="label"><td>Offensive</td><td>Name</td><td>Settings</td></tr>
  <tr class="row1"><td>PaTD</td><td>Passing TD</td><td>6 points</td></tr>
  <tr class="row2"><td>PaYd</td><td>Passing Yards</td><td>0+ PaYds = .04 points for every 1 PaYd</td></tr>
</table>`;

const fpPlayer = (fp, cbs, name, pos, ecr, posRank, tier) => ({
  player_id: fp, cbs_player_id: cbs, player_name: name, player_position_id: pos,
  player_team_id: "BUF", player_bye_week: "9", rank_ecr: ecr, pos_rank: posRank,
  tier, rank_min: ecr - 1, rank_max: ecr + 1, rank_ave: ecr, rank_std: 1.5,
});

const fpEnvelope = (over) => ({
  ranking_type_name: "draft", type: "Draft", scoring: "STD", position_id: "ALL",
  week: "0", total_experts: 5, public_api_limited: true, tier: "premium",
  ...over,
});

// The display board: superflex (OP) — offensive players only, no defenses.
function fpSuperflexBoard() {
  return fpEnvelope({
    position_id: "OP",
    players: [
      fpPlayer(9001, 111, "Rostered Star", "QB", 1, "QB1", 1), // rostered on team 1
      fpPlayer(9002, 555, "Available Guy", "WR", 2, "WR1", 1), // a free agent
      fpPlayer(9004, null, "No Join Key", "RB", 4, "RB1", 2),  // unjoinable
    ],
  });
}

function fpDynastySuperflexBoard() {
  return fpEnvelope({
    ranking_type_name: "dynasty", type: "Dynasty", scoring: "PPR", position_id: "OP",
    players: [
      fpPlayer(9001, 111, "Rostered Star", "QB", 1, "QB1", 1),
      fpPlayer(9002, 555, "Available Guy", "WR", 3, "WR2", 2),
    ],
  });
}

// The 1-QB board: the only one that ranks defenses (and kickers, which we drop).
function fpAllBoard() {
  return fpEnvelope({
    position_id: "ALL",
    players: [
      fpPlayer(9001, 111, "Rostered Star", "QB", 20, "QB1", 3),
      fpPlayer(9002, 555, "Available Guy", "WR", 2, "WR1", 1),
      fpPlayer(9003, 666, "Some Kicker", "K", 3, "K1", 1),   // league rosters no kickers
      fpPlayer(9005, 777, "Rostered Defense", "DST", 250, "DST2", 5), // rostered on team 3
      fpPlayer(9006, 888, "Available Defense", "DST", 260, "DST3", 5), // a free agent
    ],
  });
}

function fpDynastyAllBoard() {
  return fpEnvelope({
    ranking_type_name: "dynasty", type: "Dynasty", scoring: "PPR", position_id: "ALL",
    players: [fpPlayer(9005, 777, "Rostered Defense", "DST", 300, "DST4", 6)],
  });
}

/** Write a full synthetic archive run; `mutate` tweaks pages before writing.
 *  `capturedAt` sets the manifest's started_at (when the data was fetched). */
function writeFixtureRun(root, runId, mutate = {}, capturedAt = "2026-08-25T12:00:00Z") {
  const dir = join(root, runId);
  mkdirSync(join(dir, "cbs"), { recursive: true });
  mkdirSync(join(dir, "fantasypros"), { recursive: true });
  const responses = [];
  const addCbs = (page, html) => {
    writeFileSync(join(dir, `cbs/${page}.html`), html);
    responses.push({ source: "cbs", page, file: `cbs/${page}.html`, url: `https://x/${page}`, fetched_at: "2026-08-25T12:00:00Z", status: 200 });
  };
  const addFp = (page, json) => {
    if (mutate.dropBoards?.includes(page)) return; // simulate a board that didn't come back
    writeFileSync(join(dir, `fantasypros/${page}.json`), JSON.stringify(json));
    responses.push({ source: "fantasypros", page, file: `fantasypros/${page}.json`, url: `https://x/${page}`, fetched_at: "2026-08-25T12:00:00Z", status: 200 });
  };

  addCbs("standings-overall", standingsHtml());
  for (let t = 1; t <= 12; t++) {
    let rows;
    if (t === 1) {
      rows = [
        playerRow({ slot: "QB", name: "Rostered Star", pos: "QB", team: "BUF", salary: mutate.t1Salary ?? "50", contract: "2", id: 111 }),
        deadCapRow("Former Player (dead cap)", "12"),
      ];
    } else if (t === 3) {
      rows = [playerRow({ slot: "DST", name: "Rostered Defense", pos: "DST", team: "BUF", salary: "5", contract: "1", id: 777 })];
    } else {
      rows = [playerRow({ slot: "RB", name: `Runner ${t}`, pos: "RB", team: "DET", salary: "20", contract: "1", id: 1000 + t })];
    }
    addCbs(`roster-report-t${t}`, mutate.rosterHtml?.(t) ?? rosterHtml(rows));
  }
  addCbs("transactions", txHtml);
  addCbs("rules", rulesHtml);
  addFp("ecr-draft-std-op", fpSuperflexBoard());
  addFp("ecr-dynasty-op", fpDynastySuperflexBoard());
  addFp("ecr-draft-std-all", fpAllBoard());
  addFp("ecr-dynasty-ppr-all", fpDynastyAllBoard());

  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ run_id: runId, started_at: capturedAt, sources: {}, responses })
  );
}

// ---------------------------------------------------------------------------

let root, db;
const noop = { warn: () => {}, note: () => {} };
const counts = () => ({
  pulls: db.prepare("SELECT COUNT(*) c FROM pull").get().c,
  teams: db.prepare("SELECT COUNT(*) c FROM fantasy_team").get().c,
  players: db.prepare("SELECT COUNT(*) c FROM player").get().c,
  contracts: db.prepare("SELECT COUNT(*) c FROM contract").get().c,
  tx: db.prepare("SELECT COUNT(*) c FROM league_transaction").get().c,
  rankings: db.prepare("SELECT COUNT(*) c FROM market_ranking").get().c,
  rules: db.prepare("SELECT COUNT(*) c FROM scoring_rule").get().c,
});
// ingestRun wraps itself in a transaction — callers can't forget it.
const ingest = (runId) => ingestRun(db, runId, noop, root);
const latestRun = () =>
  db.prepare(`SELECT run_id FROM pull WHERE pull_id = (SELECT pull_id FROM latest_pull)`).get()?.run_id;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gart-ingest-test-"));
  db = openDb({ path: ":memory:" });
  applyMigrations(db);
});
afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe("ingest end-to-end (synthetic archive)", () => {
  it("ingests a full run: rosters + dead cap + transactions + rules + rankings", () => {
    writeFixtureRun(root, "2026-08-25T12-00-00Z");
    const stats = ingest("2026-08-25T12-00-00Z");
    expect(stats).toMatchObject({ teams: 12, rosterPlayers: 12, deadCapRows: 1, transactions: 2, scoringRules: 2 });
    expect(counts()).toMatchObject({ pulls: 1, teams: 12, contracts: 13, tx: 2, rules: 2 });

    // lineage: every normalized row points at the pull
    const orphan = db.prepare("SELECT COUNT(*) c FROM contract WHERE pull_id NOT IN (SELECT pull_id FROM pull)").get().c;
    expect(orphan).toBe(0);

    // the board: 12 rostered + 2 free agents (one flex player, one defense).
    // The kicker and the row with no CBS id are excluded.
    const board = db.prepare("SELECT owner, name, pos FROM board ORDER BY owner, name").all();
    expect(board).toHaveLength(14);
    const fa = board.filter((r) => r.owner === "FA").map((r) => r.name).sort();
    expect(fa).toEqual(["Available Defense", "Available Guy"]);
    expect(board.some((r) => /Kicker/.test(r.name))).toBe(false);
    // dead cap is stored but not a board row
    expect(board.some((r) => /dead cap/i.test(r.name))).toBe(false);
  });

  it("ranks from the SUPERFLEX board, not the 1-QB board", () => {
    writeFixtureRun(root, "2026-08-25T12-00-00Z");
    ingest("2026-08-25T12-00-00Z");
    // The QB is #1 on the superflex board and #20 on the 1-QB board.
    const qb = db.prepare("SELECT ecr, ecr_pos_rank FROM board WHERE name='Rostered Star'").get();
    expect(qb).toMatchObject({ ecr: 1, ecr_pos_rank: "QB1" });
    // Both boards are still stored at full grain — only the display changed.
    const scopes = db
      .prepare(`SELECT DISTINCT position_scope FROM market_ranking WHERE ranking_type='draft' ORDER BY 1`)
      .all().map((r) => r.position_scope);
    expect(scopes).toEqual(["ALL", "OP"]);
  });

  it("gives defenses a positional rank but NO overall rank (owner decision)", () => {
    writeFixtureRun(root, "2026-08-25T12-00-00Z");
    ingest("2026-08-25T12-00-00Z");
    for (const name of ["Rostered Defense", "Available Defense"]) {
      const d = db.prepare("SELECT * FROM board WHERE name=?").get(name);
      expect(d.pos).toBe("DST");
      expect(d.ecr).toBeNull(); // never mix the two boards' overall scales
      expect(d.dynasty_ecr).toBeNull();
      expect(d.ecr_pos_rank).toMatch(/^DST\d+$/); // from the 1-QB board
      expect(d.ecr_tier).toBe(5);
    }
    // the rostered defense still carries its real contract
    const rostered = db.prepare("SELECT salary, contract_years, owner FROM board WHERE name='Rostered Defense'").get();
    expect(rostered).toMatchObject({ salary: 5, contract_years: 1 });
    expect(rostered.owner).not.toBe("FA");
  });

  it("REJECTS a run whose superflex display board is missing", () => {
    writeFixtureRun(root, "2026-08-25T12-00-00Z", { dropBoards: ["ecr-draft-std-op"] });
    expect(() => ingest("2026-08-25T12-00-00Z")).toThrowError(/superflex.*board is missing/);
    expect(counts().pulls).toBe(0);
  });

  it("re-running the same run is IDEMPOTENT — no duplicate rows anywhere", () => {
    writeFixtureRun(root, "2026-08-25T12-00-00Z");
    ingest("2026-08-25T12-00-00Z");
    const first = counts();
    ingest("2026-08-25T12-00-00Z"); // same run again (--all path)
    expect(counts()).toEqual(first);
  });

  it("a second pull adds contract history but never duplicates identity/transactions", () => {
    writeFixtureRun(root, "2026-08-25T12-00-00Z");
    writeFixtureRun(root, "2026-08-26T12-00-00Z");
    ingest("2026-08-25T12-00-00Z");
    ingest("2026-08-26T12-00-00Z");
    const c = counts();
    expect(c.pulls).toBe(2);
    expect(c.contracts).toBe(26); // snapshot history: 13 per pull
    expect(c.tx).toBe(2); // same events, upserted not duplicated
    expect(c.teams).toBe(12);
  });

  it("REJECTS a roster whose salary sum exceeds the $500 cap — loudly, rolling back everything", () => {
    writeFixtureRun(root, "2026-08-25T12-00-00Z", { t1Salary: "600" });
    expect(() => ingest("2026-08-25T12-00-00Z")).toThrowError(/salary sum \$612 > \$500/);
    // temp-validate-swap: NOTHING from the failed run was stored
    expect(counts()).toEqual({ pulls: 0, teams: 0, players: 0, contracts: 0, tx: 0, rankings: 0, rules: 0 });
  });

  it("REJECTS a run whose roster page lost an expected column header", () => {
    writeFixtureRun(root, "2026-08-25T12-00-00Z", {
      rosterHtml: () => `<table><tr class="label"><td>Pos</td><td>Players</td></tr></table>`,
    });
    expect(() => ingest("2026-08-25T12-00-00Z")).toThrowError(/expected column header/);
    expect(counts().pulls).toBe(0);
  });

  it("serves the latest CAPTURED pull, even when an older run is ingested last", () => {
    // The documented workflow — a run fails, gets fixed, and is re-ingested later
    // — must not make a stale snapshot 'latest' and silently show old rosters.
    writeFixtureRun(root, "2026-08-24T12-00-00Z", {}, "2026-08-24T12:00:00Z"); // older data
    writeFixtureRun(root, "2026-08-26T12-00-00Z", {}, "2026-08-26T12:00:00Z"); // newer data
    ingest("2026-08-26T12-00-00Z"); // newer ingested FIRST (lower pull_id)
    ingest("2026-08-24T12-00-00Z"); // older ingested LAST (higher pull_id)
    expect(latestRun()).toBe("2026-08-26T12-00-00Z");
  });

  it("REJECTS a player who appears on two rosters in one pull (would duplicate in the table)", () => {
    // Team 2's roster also lists team 1's player — a mid-trade CBS state or a parser fault.
    writeFixtureRun(root, "2026-08-25T12-00-00Z", {
      rosterHtml: (t) =>
        t === 2
          ? rosterHtml([
              playerRow({ slot: "QB", name: "Rostered Star", pos: "QB", team: "BUF", salary: "50", contract: "2", id: 111 }),
            ])
          : undefined,
    });
    expect(() => ingest("2026-08-25T12-00-00Z")).toThrowError(/appears on TWO rosters/);
    expect(counts().pulls).toBe(0);
  });

  it("REJECTS a run missing a required page (no partial ingest)", () => {
    writeFixtureRun(root, "2026-08-25T12-00-00Z");
    rmSync(join(root, "2026-08-25T12-00-00Z", "cbs", "roster-report-t7.html"));
    // manifest still lists it, but with the file gone the read fails loudly either way:
    // simulate the manifest marking it failed instead
    const mPath = join(root, "2026-08-25T12-00-00Z", "manifest.json");
    const m = JSON.parse(readFileSync(mPath, "utf8"));
    m.responses = m.responses.filter((r) => r.page !== "roster-report-t7");
    writeFileSync(mPath, JSON.stringify(m));
    expect(() => ingest("2026-08-25T12-00-00Z")).toThrowError(/required page/);
    expect(counts().pulls).toBe(0);
  });
});
