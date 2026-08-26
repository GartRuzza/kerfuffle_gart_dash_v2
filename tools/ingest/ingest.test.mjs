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

function fpBoard() {
  const p = (fp, cbs, name, pos, ecr, posRank, tier) => ({
    player_id: fp, cbs_player_id: cbs, player_name: name, player_position_id: pos,
    player_team_id: "BUF", player_bye_week: "9", rank_ecr: ecr, pos_rank: posRank,
    tier, rank_min: ecr - 1, rank_max: ecr + 1, rank_ave: ecr, rank_std: 1.5,
  });
  return {
    ranking_type_name: "draft", type: "Draft", scoring: "STD", position_id: "ALL",
    week: "0", total_experts: 5, public_api_limited: true, tier: "premium",
    players: [
      p(9001, 111, "Rostered Star", "QB", 1, "QB1", 1), // rostered on team 1
      p(9002, 555, "Available Guy", "WR", 2, "WR1", 1), // a free agent
      p(9003, 666, "Some Kicker", "K", 3, "K1", 1),     // league rosters no kickers
      p(9004, null, "No Join Key", "RB", 4, "RB1", 2),  // unjoinable
    ],
  };
}

/** Write a full synthetic archive run; `mutate` tweaks pages before writing. */
function writeFixtureRun(root, runId, mutate = {}) {
  const dir = join(root, runId);
  mkdirSync(join(dir, "cbs"), { recursive: true });
  mkdirSync(join(dir, "fantasypros"), { recursive: true });
  const responses = [];
  const addCbs = (page, html) => {
    writeFileSync(join(dir, `cbs/${page}.html`), html);
    responses.push({ source: "cbs", page, file: `cbs/${page}.html`, url: `https://x/${page}`, fetched_at: "2026-08-25T12:00:00Z", status: 200 });
  };
  const addFp = (page, json) => {
    writeFileSync(join(dir, `fantasypros/${page}.json`), JSON.stringify(json));
    responses.push({ source: "fantasypros", page, file: `fantasypros/${page}.json`, url: `https://x/${page}`, fetched_at: "2026-08-25T12:00:00Z", status: 200 });
  };

  addCbs("standings-overall", standingsHtml());
  for (let t = 1; t <= 12; t++) {
    const rows =
      t === 1
        ? [
            playerRow({ slot: "QB", name: "Rostered Star", pos: "QB", team: "BUF", salary: mutate.t1Salary ?? "50", contract: "2", id: 111 }),
            deadCapRow("Former Player (dead cap)", "12"),
          ]
        : [playerRow({ slot: "RB", name: `Runner ${t}`, pos: "RB", team: "DET", salary: "20", contract: "1", id: 1000 + t })];
    addCbs(`roster-report-t${t}`, mutate.rosterHtml?.(t) ?? rosterHtml(rows));
  }
  addCbs("transactions", txHtml);
  addCbs("rules", rulesHtml);
  addFp("ecr-draft-std-all", fpBoard());

  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ run_id: runId, started_at: "2026-08-25T12:00:00Z", sources: {}, responses })
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
const ingest = (runId) => db.transaction(() => ingestRun(db, runId, noop, root))();

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

    // the board: 12 rostered + 1 free agent (the kicker and the unjoinable row are excluded)
    const board = db.prepare("SELECT owner, name, pos FROM board ORDER BY owner, name").all();
    expect(board).toHaveLength(13);
    const fa = board.filter((r) => r.owner === "FA");
    expect(fa).toEqual([{ owner: "FA", name: "Available Guy", pos: "WR" }]);
    // dead cap is stored but not a board row
    expect(board.some((r) => /dead cap/i.test(r.name))).toBe(false);
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
