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
  // Optional extra CBS pages (e.g. issue #30 current-season actuals stats pages).
  for (const [page, html] of mutate.extraCbs ?? []) addCbs(page, html);
  addFp("ecr-draft-std-op", fpSuperflexBoard());
  addFp("ecr-dynasty-op", fpDynastySuperflexBoard());
  addFp("ecr-draft-std-all", fpAllBoard());
  addFp("ecr-dynasty-ppr-all", fpDynastyAllBoard());
  // Optional in-season pages (issue #27): ROS/weekly boards + per-week projections.
  for (const [page, json] of mutate.extraFp ?? []) addFp(page, json);

  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ run_id: runId, started_at: capturedAt, sources: {}, responses })
  );
}

// ---- issue #30: current-season actuals stats pages (standard + advanced) ----

const STATS_STD_HEADER = ["Action","Avail","Player","Opp","OVP","Bye","Rost","Start","ATT","Comp","Yds","TD","Int","Att","Yds","TD","Tar","Rec","Yds","TD","Lost","Avg","Total"];
const STATS_ADV_HEADER = ["Action","Avail","Player","Opp","OVP","Bye","Rost","Start","Pct","1stD","2Pt","Avg","1stD","2Pt","Avg","1stD","2Pt","Avg","Total"];
const statsAction = (id) => `CBSi.app.Stats.ActionButtons.players.push({${id}:{}});`;

const statsPage = (header, rows) =>
  `<table><tbody>` +
  `<tr class="label superheader">${header.map(() => "<td></td>").join("")}</tr>` +
  `<tr class="label">${header.map((h) => `<td>${h}</td>`).join("")}</tr>` +
  rows.map((cells, i) => `<tr class="${i % 2 ? "row2" : "row1"}">${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") +
  `</tbody></table>`;

function statsStdRow(id, avail, player, o) {
  const c = Array(23).fill("0");
  c[0] = statsAction(id); c[1] = avail; c[2] = player; c[3] = o.opp ?? "BUF"; c[5] = String(o.bye ?? 9);
  c[10] = String(o.pass_yds ?? 0); c[11] = String(o.pass_td ?? 0);
  c[14] = String(o.rush_yds ?? 0); c[15] = String(o.rush_td ?? 0);
  c[17] = String(o.rec_rec ?? 0); c[18] = String(o.rec_yds ?? 0);
  c[21] = o.total; c[22] = o.total;
  return c;
}
function statsAdvRow(id, avail, player, o) {
  const c = Array(19).fill("0");
  c[0] = statsAction(id); c[1] = avail; c[2] = player; c[3] = o.opp ?? "BUF"; c[5] = String(o.bye ?? 9);
  c[9] = String(o.pass_fd ?? 0); c[12] = String(o.rush_fd ?? 0); c[15] = String(o.rec_fd ?? 0);
  c[18] = o.total;
  return c;
}

// Two players whose KERFUFFLE points come only from passing, so they cross-check
// EXACTLY against the fixture's 2-rule scoring (PaTD 6 + PaYd .04):
//   111: 300 yds*.04 + 3 TD*6 = 30.00 ;  555: 100*.04 + 1*6 = 10.00
function actualsPages() {
  return [
    ["stats-actuals-standard", statsPage(STATS_STD_HEADER, [
      statsStdRow(111, "Team 1", "Rostered Star QB • BUF", { pass_yds: 300, pass_td: 3, total: "30.00" }),
      statsStdRow(555, "FA", "Available Guy WR • BUF", { pass_yds: 100, pass_td: 1, total: "10.00" }),
    ])],
    ["stats-actuals-advanced", statsPage(STATS_ADV_HEADER, [
      statsAdvRow(111, "Team 1", "Rostered Star QB • BUF", { total: "30.00" }),
      statsAdvRow(555, "FA", "Available Guy WR • BUF", { total: "10.00" }),
    ])],
  ];
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

  it("stores in-season feeds (#27): weekly board w/ start-sit lean + both projection weeks; skips ROS fallback", () => {
    // A real weekly STD/OP board (opponent + expert lean), a ROS board that is
    // FantasyPros' preseason DRAFT fallback (must NOT be stored as ROS), and the
    // season (week 0) + current-week (week 2) projections for the same player.
    const weeklyBoard = fpEnvelope({
      ranking_type_name: "weekly", type: "Weekly", scoring: "STD", position_id: "OP", week: "2",
      players: [
        { ...fpPlayer(9001, 111, "Rostered Star", "QB", 1, "QB1", null),
          player_opponent: "@KC", note: "Great matchup", tag: "Must Start", recommendation: "Start" },
      ],
    });
    const rosFallback = fpEnvelope({
      ranking_type_name: "draft", type: "Draft", position_id: "OP", fallback_for: "ROS",
      players: [fpPlayer(9001, 111, "Rostered Star", "QB", 1, "QB1", 1)],
    });
    const projPlayer = (fpid, name, pos) => ({
      fpid, name, position_id: pos, team_id: "BUF",
      stats: { pass_yds: 100, pass_tds: 1, rush_yds: 20, rec_rec: 0, points: 15 },
    });
    const seasonProj = { season: 2026, week: 0, scoring: "STD", players: [projPlayer(9001, "Rostered Star", "QB")] };
    const weekProj = { season: 2026, week: 2, scoring: "STD", players: [projPlayer(9001, "Rostered Star", "QB")] };

    const warnings = [];
    writeFixtureRun(root, "2026-09-16T12-00-00Z", {
      extraFp: [
        ["ecr-weekly-std-op", weeklyBoard],
        ["ecr-ros-std-op", rosFallback],
        ["projections-all", seasonProj],
        ["projections-week-2", weekProj],
      ],
    });
    ingestRun(db, "2026-09-16T12-00-00Z", { warn: (m) => warnings.push(m), note: () => {} }, root);

    // The weekly board is stored, carrying the matchup + expert start/sit lean.
    const weekly = db.prepare(
      `SELECT player_opponent, tag, recommendation, note FROM market_ranking
       WHERE ranking_type='weekly' AND scoring_format='STD' AND position_scope='OP' AND cbs_player_id=111`
    ).get();
    expect(weekly).toMatchObject({ player_opponent: "@KC", tag: "Must Start", recommendation: "Start", note: "Great matchup" });

    // The ROS fallback is NOT stored as a ros board, and it warned.
    const rosCount = db.prepare(`SELECT COUNT(*) c FROM market_ranking WHERE ranking_type='ros'`).get().c;
    expect(rosCount).toBe(0);
    expect(warnings.some((w) => /ROS board is FantasyPros' draft-board fallback/.test(w))).toBe(true);

    // Both projection weeks coexist for the same player (season 0 + week 2).
    const weeks = db.prepare(
      `SELECT week FROM projection_source WHERE cbs_player_id=111 ORDER BY week`
    ).all().map((r) => r.week);
    expect(weeks).toEqual([0, 2]);
  });

  it("board view prefers ROS ECR over draft when a real ROS board is present (#28)", () => {
    // In-season, the market ECR columns read the ROS board; the draft board is the
    // preseason fallback. Give 'Rostered Star' and 'Available Guy' different ranks
    // on a real ROS/STD/OP board and confirm the board view surfaces the ROS ones.
    const rosBoard = fpEnvelope({
      ranking_type_name: "ros", type: "Rest of Season", scoring: "STD", position_id: "OP",
      players: [
        fpPlayer(9001, 111, "Rostered Star", "QB", 7, "QB2", 2), // draft had ecr 1 / QB1 / tier 1
        fpPlayer(9002, 555, "Available Guy", "WR", 9, "WR3", 3), // draft had ecr 2 / WR1 / tier 1
      ],
    });
    writeFixtureRun(root, "2026-09-16T12-00-00Z", { extraFp: [["ecr-ros-std-op", rosBoard]] });
    ingest("2026-09-16T12-00-00Z");

    const star = db.prepare("SELECT ecr, ecr_pos_rank, ecr_tier FROM board WHERE name='Rostered Star'").get();
    expect(star).toMatchObject({ ecr: 7, ecr_pos_rank: "QB2", ecr_tier: 2 }); // ROS, not draft's 1/QB1/1
    const fa = db.prepare("SELECT ecr, ecr_pos_rank FROM board WHERE name='Available Guy'").get();
    expect(fa).toMatchObject({ ecr: 9, ecr_pos_rank: "WR3" }); // ROS preferred on the FA branch too
  });

  it("board view falls back to draft ECR when NO ROS board exists (preseason, #28)", () => {
    // The default fixture has no ROS board — the market ECR must still be the draft
    // board, exactly as before, so preseason display never regresses.
    writeFixtureRun(root, "2026-08-25T12-00-00Z");
    ingest("2026-08-25T12-00-00Z");
    const star = db.prepare("SELECT ecr, ecr_pos_rank, ecr_tier FROM board WHERE name='Rostered Star'").get();
    expect(star).toMatchObject({ ecr: 1, ecr_pos_rank: "QB1", ecr_tier: 1 }); // the draft board
  });

  it("stores current-season actuals (#30): recompute + cross-check, keyed by as-of week", () => {
    // A mid-season run (Week 2 window → as-of week 1) carrying the stats-actuals pages.
    writeFixtureRun(root, "2026-09-16T12-00-00Z", { extraCbs: actualsPages() }, "2026-09-16T12:00:00Z");
    const stats = ingestRun(db, "2026-09-16T12-00-00Z", noop, root);
    expect(stats.actuals).toBe(2);
    expect(stats.actualsAsOfWeek).toBe(1);

    const rows = db.prepare("SELECT * FROM player_actuals ORDER BY cbs_player_id").all();
    expect(rows).toHaveLength(2);
    const star = rows.find((r) => r.cbs_player_id === 111);
    expect(star).toMatchObject({ season: 2026, as_of_week: 1, pos: "QB", nfl_team: "BUF", pass_yds: 300, pass_td: 3 });
    // OUR recompute through the parsed scoring config == CBS's FPTS Total (cross-check clean)
    expect(star.kerf_points).toBe(30);
    expect(star.fpts_total).toBe(30);
    // lineage points at the pull
    const orphan = db.prepare("SELECT COUNT(*) c FROM player_actuals WHERE pull_id NOT IN (SELECT pull_id FROM pull)").get().c;
    expect(orphan).toBe(0);
    // the latest-actuals view resolves to this week's rows
    expect(db.prepare("SELECT COUNT(*) c FROM latest_player_actuals").get().c).toBe(2);
  });

  it("actuals ingest is idempotent — re-ingesting the same week replaces, never duplicates", () => {
    writeFixtureRun(root, "2026-09-16T12-00-00Z", { extraCbs: actualsPages() }, "2026-09-16T12:00:00Z");
    ingest("2026-09-16T12-00-00Z");
    ingest("2026-09-16T12-00-00Z"); // --all path: same run again
    expect(db.prepare("SELECT COUNT(*) c FROM player_actuals").get().c).toBe(2);
  });

  it("only stores actuals for players in our universe (the stats pages carry the whole NFL)", () => {
    // id 424242 isn't rostered and isn't on any FantasyPros board → not in `player`.
    const pages = [
      ["stats-actuals-standard", statsPage(STATS_STD_HEADER, [
        statsStdRow(111, "Team 1", "Rostered Star QB • BUF", { pass_yds: 300, pass_td: 3, total: "30.00" }),
        statsStdRow(424242, "FA", "Random Scrub WR • NYJ", { pass_yds: 50, pass_td: 0, total: "2.00" }),
      ])],
      ["stats-actuals-advanced", statsPage(STATS_ADV_HEADER, [
        statsAdvRow(111, "Team 1", "Rostered Star QB • BUF", { total: "30.00" }),
        statsAdvRow(424242, "FA", "Random Scrub WR • NYJ", { total: "2.00" }),
      ])],
    ];
    writeFixtureRun(root, "2026-09-16T12-00-00Z", { extraCbs: pages }, "2026-09-16T12:00:00Z");
    ingest("2026-09-16T12-00-00Z");
    const ids = db.prepare("SELECT cbs_player_id FROM player_actuals ORDER BY 1").all().map((r) => r.cbs_player_id);
    expect(ids).toEqual([111]); // the scrub is skipped, not FK-violating
  });

  it("skips actuals (lenient) when only one of the two stats views is present", () => {
    const oneSided = [["stats-actuals-standard", statsPage(STATS_STD_HEADER, [
      statsStdRow(111, "Team 1", "Rostered Star QB • BUF", { pass_yds: 300, pass_td: 3, total: "30.00" }),
    ])]];
    const warnings = [];
    writeFixtureRun(root, "2026-09-16T12-00-00Z", { extraCbs: oneSided }, "2026-09-16T12:00:00Z");
    ingestRun(db, "2026-09-16T12-00-00Z", { warn: (m) => warnings.push(m), note: () => {} }, root);
    expect(db.prepare("SELECT COUNT(*) c FROM player_actuals").get().c).toBe(0);
    expect(warnings.some((w) => /actuals capture is one-sided/.test(w))).toBe(true);
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
