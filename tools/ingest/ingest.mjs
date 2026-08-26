// Ingestion — raw archive -> normalized SQLite (issue #12, decision D-10).
//
// Reads ONLY from the local raw archive (data/raw/{run}/ — never the network;
// the app never fetches CBS/FantasyPros at request time, and a wrong parse is
// fixed by re-parsing the archive). Each archived run becomes one `pull`; every
// normalized row carries pull_id + fetched_at back to its raw snapshot.
//
// IDEMPOTENT: `npm run ingest` processes runs not yet ingested; re-running
// ingests nothing twice. `npm run ingest -- --all` re-ingests every run (after
// a parser fix): pull rows keep their pull_id, snapshot rows (contract,
// market_ranking, scoring_rule) are replaced per pull, transactions upsert on a
// content-derived natural key. Nothing ever duplicates.
//
// TEMP-VALIDATE-SWAP: each run ingests inside ONE SQLite transaction and the
// constitution invariants are validated BEFORE commit — a bad page or failed
// validation rolls the whole run back and loudly says why; good data is never
// corrupted by a bad fetch.
//
// RUN (from project root):  npm run ingest        (new runs only)
//                           npm run ingest -- --all   (re-ingest everything)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { openDb, applyMigrations, DB_PATH } from "../../db/client.mjs";
import {
  IngestError,
  parseRosterForIngest,
  parseStandingsTeams,
  parseTransactionsPage,
  normalizeTxDate,
} from "./parse-cbs-ingest.mjs";
import { mapFpBoard } from "./parse-fp-ingest.mjs";
import { parseScoring } from "../profile/parse-scoring.mjs";

// Overridable so tests can point ingestion at a synthetic fixture archive.
const RAW_ROOT = process.env.GART_RAW_ROOT || join(process.cwd(), "data", "raw");
const SALARY_CAP = 500; // constitution: team salary sums, including IR, ≤ $500
const TEAM_COUNT = 12;

// ---------------------------------------------------------------------------

function loadManifest(runDir) {
  const path = join(runDir, "manifest.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

// page name -> manifest response entry (ok CBS/FP responses only)
function responseMap(manifest) {
  const map = new Map();
  for (const r of manifest.responses || []) {
    if (r.page && r.file && r.status === 200 && !r.login_redirect) map.set(r.page, r);
  }
  return map;
}

function readPage(runDir, resp) {
  return readFileSync(join(runDir, resp.file), "utf8");
}

// ---------------------------------------------------------------------------

export function ingestRun(db, runId, { warn, note }, rawRoot = RAW_ROOT) {
  const runDir = join(rawRoot, runId);
  const manifest = loadManifest(runDir);
  if (!manifest) throw new IngestError(`${runId}: no manifest.json — not an archive run`);
  const pages = responseMap(manifest);
  const stats = {};

  const requirePage = (name) => {
    const r = pages.get(name);
    if (!r) {
      throw new IngestError(
        `${runId}: required page "${name}" missing/failed in this archive run ` +
          `(expired cookie or failed fetch?) — refusing a partial ingest`
      );
    }
    return r;
  };

  // ---- pull (upsert by run_id; pull_id stays stable across re-ingests) ----
  const pull = db
    .prepare(
      `INSERT INTO pull (run_id, raw_path, captured_at, ingested_at, source_summary)
       VALUES (@run_id, @raw_path, @captured_at, @ingested_at, @source_summary)
       ON CONFLICT(run_id) DO UPDATE SET
         captured_at = excluded.captured_at,
         ingested_at = excluded.ingested_at,
         source_summary = excluded.source_summary
       RETURNING pull_id`
    )
    .get({
      run_id: runId,
      raw_path: `data/raw/${runId}`,
      captured_at: manifest.started_at,
      ingested_at: new Date().toISOString(),
      source_summary: JSON.stringify(manifest.sources ?? null),
    });
  const pullId = pull.pull_id;

  // Replace this pull's snapshot rows (idempotent re-ingest)
  for (const table of ["contract", "market_ranking", "scoring_rule"]) {
    db.prepare(`DELETE FROM ${table} WHERE pull_id = ?`).run(pullId);
  }

  // ---- fantasy_team (standings: names + divisions) ----
  const standings = requirePage("standings-overall");
  const teams = parseStandingsTeams(readPage(runDir, standings));
  const teamIds = new Set(teams.map((t) => t.teamId));
  if (teams.length !== TEAM_COUNT || teamIds.size !== TEAM_COUNT) {
    throw new IngestError(
      `${runId}: constitution invariant violated — expected ${TEAM_COUNT} teams, ` +
        `standings yielded ${teams.length} (${[...teamIds].join(",")})`
    );
  }
  const upsertTeam = db.prepare(
    `INSERT INTO fantasy_team (team_id, name, division, pull_id, fetched_at)
     VALUES (@team_id, @name, @division, @pull_id, @fetched_at)
     ON CONFLICT(team_id) DO UPDATE SET
       name = excluded.name, division = excluded.division,
       pull_id = excluded.pull_id, fetched_at = excluded.fetched_at`
  );
  for (const t of teams) {
    upsertTeam.run({
      team_id: t.teamId, name: t.name, division: t.division,
      pull_id: pullId, fetched_at: standings.fetched_at,
    });
  }
  const teamIdByName = new Map(teams.map((t) => [t.name, t.teamId]));
  stats.teams = teams.length;

  // ---- rosters: player upserts + contract snapshot rows ----
  const upsertCbsPlayer = db.prepare(
    `INSERT INTO player (cbs_player_id, name, pos, nfl_team, bye_week, pull_id, fetched_at)
     VALUES (@cbs_player_id, @name, @pos, @nfl_team, @bye_week, @pull_id, @fetched_at)
     ON CONFLICT(cbs_player_id) DO UPDATE SET
       name = excluded.name, pos = excluded.pos, nfl_team = excluded.nfl_team,
       bye_week = excluded.bye_week, pull_id = excluded.pull_id, fetched_at = excluded.fetched_at`
  );
  const insertContract = db.prepare(
    `INSERT INTO contract (pull_id, observed_at, team_id, row_type, cbs_player_id, label,
                           roster_status, roster_slot, salary, contract_years, proj_points, fetched_at)
     VALUES (@pull_id, @observed_at, @team_id, @row_type, @cbs_player_id, @label,
             @roster_status, @roster_slot, @salary, @contract_years, @proj_points, @fetched_at)`
  );

  stats.rosterPlayers = 0;
  stats.deadCapRows = 0;
  // A player belongs to exactly one roster. Catch a cross-team duplicate here so
  // the failure names the player and both teams, rather than surfacing as a bare
  // UNIQUE-constraint error from contract_one_player_per_pull.
  const rosteredBy = new Map();
  for (let teamId = 1; teamId <= TEAM_COUNT; teamId++) {
    const resp = requirePage(`roster-report-t${teamId}`);
    const roster = parseRosterForIngest(readPage(runDir, resp), teamId);
    roster.warnings.forEach(warn);

    // Constitution invariant: team salary sum, including IR, ≤ $500.
    // (Blank salaries counted $0 — warned above; dead-cap amounts included.)
    const capSum =
      roster.players.reduce((s, p) => s + (p.salary ?? 0), 0) +
      roster.deadCap.reduce((s, d) => s + d.salary, 0);
    if (capSum > SALARY_CAP) {
      throw new IngestError(
        `t${teamId}: constitution invariant violated — roster salary sum $${capSum} > $${SALARY_CAP}`
      );
    }
    if (roster.footer.totalSalary != null && Math.round(roster.footer.totalSalary) !== capSum) {
      warn(
        `t${teamId}: parsed salary sum $${capSum} differs from CBS footer Total Salary ` +
          `$${roster.footer.totalSalary} — check for missed rows`
      );
    }

    for (const p of roster.players) {
      const alreadyOn = rosteredBy.get(p.cbsPlayerId);
      if (alreadyOn !== undefined) {
        throw new IngestError(
          `${p.name} (id ${p.cbsPlayerId}) appears on TWO rosters in this pull — ` +
            `team ${alreadyOn} and team ${teamId}. A player is rostered by exactly one team; ` +
            `this snapshot caught CBS mid-trade or a parser fault. Re-archive and re-ingest.`
        );
      }
      rosteredBy.set(p.cbsPlayerId, teamId);
      upsertCbsPlayer.run({
        cbs_player_id: p.cbsPlayerId, name: p.name, pos: p.pos, nfl_team: p.nflTeam,
        bye_week: p.byeWeek, pull_id: pullId, fetched_at: resp.fetched_at,
      });
      insertContract.run({
        pull_id: pullId, observed_at: resp.fetched_at, team_id: teamId,
        row_type: "player", cbs_player_id: p.cbsPlayerId, label: null,
        roster_status: p.rosterStatus, roster_slot: p.rosterSlot,
        salary: p.salary, contract_years: p.contractYears, proj_points: p.projPoints,
        fetched_at: resp.fetched_at,
      });
      stats.rosterPlayers++;
    }
    for (const d of roster.deadCap) {
      insertContract.run({
        pull_id: pullId, observed_at: resp.fetched_at, team_id: teamId,
        row_type: "dead_cap", cbs_player_id: null, label: d.label,
        roster_status: d.rosterStatus, roster_slot: null,
        salary: d.salary, contract_years: d.contractYears, proj_points: null,
        fetched_at: resp.fetched_at,
      });
      stats.deadCapRows++;
    }
  }

  // ---- transaction log (print-all view + every paged view, unioned) ----
  const txPages = [...pages.keys()].filter((n) => /^transactions(-all|-p\d+)?$/.test(n));
  if (txPages.length === 0) warn(`${runId}: no transaction pages in this run — log not updated`);
  const byKey = new Map();
  let allViewCount = null;
  for (const name of txPages) {
    const resp = pages.get(name);
    const rows = parseTransactionsPage(readPage(runDir, resp), `${runId}/${name}`);
    if (name === "transactions-all") allViewCount = rows.length;
    for (const row of rows) if (!byKey.has(row.naturalKey)) byKey.set(row.naturalKey, { ...row, fetched_at: resp.fetched_at });
  }
  if (allViewCount != null && allViewCount !== byKey.size) {
    warn(
      `transactions: print-all view has ${allViewCount} rows but the union of all views has ` +
        `${byKey.size} — ingested the union; check which view is incomplete`
    );
  }
  const upsertTx = db.prepare(
    `INSERT INTO league_transaction (tx_date, team_id, team_label, players_text, effective,
                                     inferred_type, natural_key, first_pull_id, last_pull_id, fetched_at)
     VALUES (@tx_date, @team_id, @team_label, @players_text, @effective,
             @inferred_type, @natural_key, @first_pull_id, @last_pull_id, @fetched_at)
     ON CONFLICT(natural_key) DO UPDATE SET
       last_pull_id = excluded.last_pull_id, fetched_at = excluded.fetched_at`
  );
  const unknownTeams = new Set();
  for (const row of byKey.values()) {
    const teamId = teamIdByName.get(row.team) ?? null;
    if (teamId === null && row.team) unknownTeams.add(row.team);
    upsertTx.run({
      tx_date: normalizeTxDate(row.date), team_id: teamId, team_label: row.team,
      players_text: row.players, effective: row.effective || null,
      inferred_type: row.inferredType, natural_key: row.naturalKey,
      first_pull_id: pullId, last_pull_id: pullId, fetched_at: row.fetched_at,
    });
  }
  for (const t of unknownTeams) warn(`transactions: team "${t}" doesn't match any fantasy team name — stored without team link`);
  stats.transactions = byKey.size;

  // ---- scoring rules (parsed from /rules — never hardcoded) ----
  const rulesResp = requirePage("rules");
  const rules = parseScoring(readPage(runDir, rulesResp));
  if (rules.length === 0) throw new IngestError(`${runId}: /rules yielded no scoring rules`);
  const unparsed = rules.filter((r) => r.parsed.kind === "unparsed");
  if (unparsed.length > 0) {
    throw new IngestError(
      `${runId}: ${unparsed.length} scoring rule(s) failed to parse (${unparsed
        .map((r) => r.name)
        .join(", ")}) — the engine cannot run on guessed scoring`
    );
  }
  const insertRule = db.prepare(
    `INSERT INTO scoring_rule (pull_id, category, name, value_type, value_json, fetched_at)
     VALUES (@pull_id, @category, @name, @value_type, @value_json, @fetched_at)`
  );
  for (const r of rules) {
    insertRule.run({
      pull_id: pullId, category: r.section ?? "General", name: r.name,
      value_type: r.parsed.kind,
      value_json: JSON.stringify({ code: r.code, raw_setting: r.raw_setting, parsed: r.parsed }),
      fetched_at: rulesResp.fetched_at,
    });
  }
  stats.scoringRules = rules.length;

  // ---- FantasyPros consensus boards -> market_ranking ----
  const upsertFpPlayer = db.prepare(
    `INSERT INTO player (cbs_player_id, name, pos, nfl_team, bye_week, fp_player_id, pull_id, fetched_at)
     VALUES (@cbs_player_id, @name, @pos, @nfl_team, @bye_week, @fp_player_id, @pull_id, @fetched_at)
     ON CONFLICT(cbs_player_id) DO UPDATE SET
       fp_player_id = excluded.fp_player_id,
       bye_week = COALESCE(player.bye_week, excluded.bye_week),
       nfl_team = COALESCE(player.nfl_team, excluded.nfl_team),
       pull_id = excluded.pull_id, fetched_at = excluded.fetched_at`
  );
  const insertRanking = db.prepare(
    `INSERT INTO market_ranking (pull_id, fp_player_id, cbs_player_id, player_name, player_pos,
                                 player_team, bye_week, ranking_type, scoring_format, position_scope,
                                 week, rank_ecr, pos_rank, tier, rank_min, rank_max, rank_ave,
                                 rank_std, total_experts, source_endpoint, fetched_at)
     VALUES (@pull_id, @fp_player_id, @cbs_player_id, @player_name, @player_pos,
             @player_team, @bye_week, @ranking_type, @scoring_format, @position_scope,
             @week, @rank_ecr, @pos_rank, @tier, @rank_min, @rank_max, @rank_ave,
             @rank_std, @total_experts, @source_endpoint, @fetched_at)`
  );

  const boardsSeen = new Set();
  let noCbsId = 0;
  stats.rankingRows = 0;
  stats.boards = 0;
  for (const [name, resp] of pages) {
    if (resp.source !== "fantasypros" || !/^ecr-/.test(name)) continue;
    const board = mapFpBoard(JSON.parse(readPage(runDir, resp)), name);
    const grain = [board.rankingType, board.scoringFormat, board.positionScope, board.week ?? ""].join("|");
    if (boardsSeen.has(grain)) {
      note(`fp/${name}: same board as an earlier file (${grain}) — skipped as a duplicate`);
      continue;
    }
    boardsSeen.add(grain);
    stats.boards++;
    for (const r of board.rows) {
      if (r.cbsPlayerId !== null) {
        upsertFpPlayer.run({
          cbs_player_id: r.cbsPlayerId, name: r.playerName, pos: r.playerPos,
          nfl_team: r.playerTeam, bye_week: r.byeWeek, fp_player_id: r.fpPlayerId,
          pull_id: pullId, fetched_at: resp.fetched_at,
        });
      } else {
        noCbsId++;
      }
      insertRanking.run({
        pull_id: pullId, fp_player_id: r.fpPlayerId, cbs_player_id: r.cbsPlayerId,
        player_name: r.playerName, player_pos: r.playerPos, player_team: r.playerTeam,
        bye_week: r.byeWeek, ranking_type: board.rankingType, scoring_format: board.scoringFormat,
        position_scope: board.positionScope, week: board.week, rank_ecr: r.rankEcr,
        pos_rank: r.posRank, tier: r.tier, rank_min: r.rankMin, rank_max: r.rankMax,
        rank_ave: r.rankAve, rank_std: r.rankStd, total_experts: board.totalExperts,
        source_endpoint: name, fetched_at: resp.fetched_at,
      });
      stats.rankingRows++;
    }
  }
  // The display board the UI reads must exist (owner decision: draft + STD).
  const hasDisplayBoard = db
    .prepare(
      `SELECT COUNT(*) c FROM market_ranking
       WHERE pull_id = ? AND ranking_type='draft' AND scoring_format='STD' AND position_scope='ALL'`
    )
    .get(pullId).c;
  if (hasDisplayBoard === 0) {
    throw new IngestError(`${runId}: the draft/STD/ALL FantasyPros board is missing — the UI's display board`);
  }
  if (noCbsId > 0) note(`fp: ${noCbsId} ranking row(s) have no cbs_player_id (unjoinable; kept in market_ranking, excluded from the board view)`);

  return stats;
}

// ---------------------------------------------------------------------------

function main() {
  const reingestAll = process.argv.includes("--all");
  if (!existsSync(RAW_ROOT)) {
    console.error(`No raw archive at data/raw/ — run "npm run archive" first.`);
    process.exit(1);
  }
  const runs = readdirSync(RAW_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort(); // run ids are timestamps — lexical order = date order

  const db = openDb();
  applyMigrations(db, { log: console.log });
  const already = new Set(db.prepare("SELECT run_id FROM pull").all().map((r) => r.run_id));
  const todo = runs.filter((r) => reingestAll || !already.has(r));

  console.log(`\nIngest — raw archive -> ${DB_PATH}`);
  console.log(`  archive runs: ${runs.length}  already ingested: ${already.size}  to ingest: ${todo.length}\n`);

  let failed = 0;
  for (const runId of todo) {
    const warnings = [];
    const notes = [];
    const warn = (m) => warnings.push(m);
    const note = (m) => notes.push(m);
    try {
      // ONE transaction per run: validation failure rolls the whole run back.
      const stats = db.transaction(() => ingestRun(db, runId, { warn, note }))();
      console.log(
        `  ✔ ${runId}  teams:${stats.teams} players:${stats.rosterPlayers} dead-cap:${stats.deadCapRows} ` +
          `tx:${stats.transactions} rules:${stats.scoringRules} boards:${stats.boards} rankings:${stats.rankingRows}`
      );
      for (const n of notes) console.log(`      · ${n}`);
      for (const w of warnings) console.log(`      ⚠ ${w}`);
    } catch (err) {
      failed++;
      console.error(`  ✘ ${runId}  ROLLED BACK — nothing from this run was stored:`);
      console.error(`      ${err.message}`);
      if (!(err instanceof IngestError)) console.error(err.stack);
    }
  }

  // Board smoke summary — what the UI will actually see.
  const board = db.prepare(`SELECT COUNT(*) c, SUM(owner='FA') fa FROM board`).get();
  const latest = db.prepare(`SELECT run_id FROM pull WHERE pull_id = (SELECT pull_id FROM latest_pull)`).get();
  console.log(`\nBoard view: ${board.c} players (${board.c - (board.fa ?? 0)} rostered, ${board.fa ?? 0} free agents) — latest pull: ${latest?.run_id ?? "none"}`);
  db.close();
  if (failed > 0) process.exit(1);
}

// Run only when executed directly (node tools/ingest/ingest.mjs), not when
// imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
