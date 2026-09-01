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
import { mapFpBoard, isRosFallback } from "./parse-fp-ingest.mjs";
import { mapProjections } from "./parse-projections.mjs";
import { parseScoring } from "../profile/parse-scoring.mjs";
import { parseStatsActualsPages, joinActuals } from "./parse-cbs-actuals.mjs";
import { buildScoringMap, recomputeKerfPoints } from "./scoring-crosscheck.mjs";
import { actualsAsOfWeek } from "../archive/stats-actuals.mjs";

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

/**
 * Ingest one archived run. ALWAYS call this rather than the inner function:
 * the whole run happens inside one transaction, so a parse error or a failed
 * invariant rolls back everything this run touched and leaves the previous
 * good data intact (the issue's temp-validate-swap requirement). Making the
 * transaction structural here means no caller can forget it.
 */
export function ingestRun(db, runId, handlers, rawRoot = RAW_ROOT) {
  return db.transaction(() => ingestRunInner(db, runId, handlers, rawRoot))();
}

function ingestRunInner(db, runId, { warn, note }, rawRoot) {
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
  for (const table of ["contract", "market_ranking", "scoring_rule", "projection_source"]) {
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
  // Iterate the team ids CBS actually published (above), not a hardcoded 1..12 —
  // a non-contiguous id would otherwise fail as "missing page roster-report-t12"
  // and point at the archiver instead of the real cause.
  for (const { teamId } of teams) {
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
                                 rank_std, total_experts, source_endpoint, fetched_at,
                                 player_opponent, note, tag, recommendation)
     VALUES (@pull_id, @fp_player_id, @cbs_player_id, @player_name, @player_pos,
             @player_team, @bye_week, @ranking_type, @scoring_format, @position_scope,
             @week, @rank_ecr, @pos_rank, @tier, @rank_min, @rank_max, @rank_ave,
             @rank_std, @total_experts, @source_endpoint, @fetched_at,
             @player_opponent, @note, @tag, @recommendation)`
  );

  const boardsSeen = new Set();
  let noCbsId = 0;
  stats.rankingRows = 0;
  stats.boards = 0;
  for (const [name, resp] of pages) {
    if (resp.source !== "fantasypros" || !/^ecr-/.test(name)) continue;
    const json = JSON.parse(readPage(runDir, resp));
    // Preseason, FantasyPros serves the DRAFT board for a ROS request
    // (fallback_for:"ROS"). Detect it explicitly and skip — never let a draft
    // board masquerade as a real ROS board (issue #27). Once the season
    // differentiates ROS, this passes through and the board stores normally.
    if (isRosFallback(name, json)) {
      warn(`fp/${name}: ROS board is FantasyPros' draft-board fallback (preseason) — not stored as ROS`);
      continue;
    }
    const board = mapFpBoard(json, name);
    const grain = [board.rankingType, board.scoringFormat, board.positionScope, board.week ?? ""].join("|");
    if (boardsSeen.has(grain)) {
      // Byte-identical duplicates are normal today (FP's dynasty STD/PPR files,
      // and pre-season /ros returning the draft board). Warn rather than note:
      // if FP ever serves genuinely different data under a duplicate grain, this
      // line is the only place it would show.
      warn(`fp/${name}: declares the same board as an earlier file (${grain}) — skipped as a duplicate`);
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
        player_opponent: r.playerOpponent, note: r.note, tag: r.tag, recommendation: r.recommendation,
      });
      stats.rankingRows++;
    }
  }
  // The boards the UI reads must exist. The display board is draft/STD/OP —
  // superflex, per the owner (this league starts two QBs); the ALL board is
  // still required because it is the only one that ranks team defenses.
  const requireBoard = (where, label) => {
    const n = db
      .prepare(`SELECT COUNT(*) c FROM market_ranking WHERE pull_id = ? AND ${where}`)
      .get(pullId).c;
    if (n === 0) {
      throw new IngestError(`${runId}: the ${label} FantasyPros board is missing — the UI reads it`);
    }
  };
  requireBoard(`ranking_type='draft' AND scoring_format='STD' AND position_scope='OP'`, "draft/STD/OP (superflex)");
  requireBoard(`ranking_type='dynasty' AND position_scope='OP'`, "dynasty/OP (superflex)");
  requireBoard(
    `ranking_type='draft' AND scoring_format='STD' AND position_scope='ALL' AND player_pos='DST'`,
    "draft/STD/ALL (the only board that ranks defenses)"
  );

  // In-season boards (issue #27): the ROS + weekly STD/OP boards the #28/#29
  // lenses will read. LENIENT — a warn, never a rollback — because preseason
  // archives legitimately lack them (ROS is a draft fallback then, weekly may be
  // unpublished), and re-ingesting old runs must not start failing.
  const expectBoard = (where, label) => {
    const n = db
      .prepare(`SELECT COUNT(*) c FROM market_ranking WHERE pull_id = ? AND ${where}`)
      .get(pullId).c;
    if (n === 0) warn(`${runId}: no ${label} board in this pull (expected in-season; fine preseason)`);
  };
  expectBoard(`ranking_type='ros' AND scoring_format='STD' AND position_scope='OP'`, "ROS/STD/OP (superflex)");
  expectBoard(`ranking_type='weekly' AND scoring_format='STD' AND position_scope='OP'`, "weekly/STD/OP (superflex)");

  if (noCbsId > 0) note(`fp: ${noCbsId} ranking row(s) have no cbs_player_id (unjoinable; kept in market_ranking, excluded from the board view)`);

  // ---- FantasyPros PROJECTIONS -> projection_source (the engine's input, #18) ----
  // The projections feed carries fpid, not cbs_player_id, so the join to CBS is
  // bridged through player.fp_player_id (populated from the ECR boards just above).
  // Not required: an older archive run without projections warns rather than fails.
  // The season projection (projections-all → week 0, read by the ROS lens) AND
  // the current week's projection (projections-week-N → week N, read by the weekly
  // lens) both live in projection_source, distinguished by `week` (issue #27).
  const projPages = [...pages.keys()]
    .filter((n) => n === "projections-all" || /^projections-week-\d+$/.test(n))
    .sort();
  if (projPages.length === 0) {
    warn(`${runId}: no projections page — projection_source not updated for this pull (engine has no input)`);
  } else {
    const cbsIdByFp = new Map(
      db.prepare(`SELECT fp_player_id, cbs_player_id FROM player WHERE fp_player_id IS NOT NULL`)
        .all().map((r) => [r.fp_player_id, r.cbs_player_id])
    );
    const insertProjection = db.prepare(
      `INSERT INTO projection_source
         (pull_id, cbs_player_id, fp_player_id, player_name, pos, nfl_team, season, week,
          pass_att, pass_cmp, pass_yds, pass_td, pass_int, rush_att, rush_yds, rush_td,
          rec_rec, rec_yds, rec_td, fumbles, two_pt, fp_points, source_endpoint, fetched_at)
       VALUES
         (@pull_id, @cbs_player_id, @fp_player_id, @player_name, @pos, @nfl_team, @season, @week,
          @pass_att, @pass_cmp, @pass_yds, @pass_td, @pass_int, @rush_att, @rush_yds, @rush_td,
          @rec_rec, @rec_yds, @rec_td, @fumbles, @two_pt, @fp_points, @source_endpoint, @fetched_at)`
    );
    let totalRows = 0;
    let totalUnmatched = 0;
    for (const name of projPages) {
      const resp = pages.get(name);
      const proj = mapProjections(JSON.parse(readPage(runDir, resp)), `${runId}/${name}`);
      // Guard the week↔filename agreement for the per-week file: a projections-week-N
      // file MUST carry week N. If FantasyPros echoed week 0 (or a different week),
      // storing it would either collide with the season row or mislabel the week —
      // skip it loudly rather than corrupt the horizon the weekly lens reads.
      const m = name.match(/^projections-week-(\d+)$/);
      if (m) {
        const expected = Number(m[1]);
        if (proj.week !== expected) {
          warn(
            `projections: ${name} carries week ${proj.week}, expected ${expected} — skipped ` +
              `(FantasyPros may not have published week ${expected} yet)`
          );
          continue;
        }
      }
      for (const r of proj.rows) {
        const cbsId = cbsIdByFp.get(r.fpPlayerId) ?? null;
        if (cbsId === null) totalUnmatched++;
        insertProjection.run({
          pull_id: pullId, cbs_player_id: cbsId, fp_player_id: r.fpPlayerId,
          player_name: r.playerName, pos: r.pos, nfl_team: r.nflTeam,
          season: r.season, week: r.week,
          pass_att: r.pass_att, pass_cmp: r.pass_cmp, pass_yds: r.pass_yds,
          pass_td: r.pass_td, pass_int: r.pass_int, rush_att: r.rush_att,
          rush_yds: r.rush_yds, rush_td: r.rush_td, rec_rec: r.rec_rec,
          rec_yds: r.rec_yds, rec_td: r.rec_td, fumbles: r.fumbles, two_pt: r.two_pt,
          fp_points: r.fpPoints, source_endpoint: name, fetched_at: resp.fetched_at,
        });
      }
      totalRows += proj.rows.length;
    }
    stats.projections = totalRows;
    if (totalUnmatched > 0) {
      note(
        `projections: ${totalUnmatched} projected row(s) across ${projPages.length} file(s) have no cbs_player_id ` +
          `(FantasyPros projects them but they aren't in our league universe; stored with null id, no Kerf projection)`
      );
    }
  }

  // ---- Current-season actuals-to-date -> player_actuals (Option B input, #30) ----
  // The CBS stats pages (standard = volume + FPTS Total; advanced = first downs),
  // captured ytd by the archiver. LENIENT — a warn, never a rollback — because
  // preseason and older archives legitimately lack these pages, and re-ingesting old
  // runs must not start failing. Stored keyed by (season, as_of_week): the latest
  // ingested pull for a given week replaces it wholesale (idempotent).
  const stdPages = [...pages.keys()].filter((n) => /^stats-actuals-standard(-r\d+)?$/.test(n)).sort();
  const advPages = [...pages.keys()].filter((n) => /^stats-actuals-advanced(-r\d+)?$/.test(n)).sort();
  if (stdPages.length === 0 && advPages.length === 0) {
    warn(`${runId}: no current-season actuals pages in this run (expected in-season; fine for older archives) — player_actuals not updated`);
  } else if (stdPages.length === 0 || advPages.length === 0) {
    warn(`${runId}: actuals capture is one-sided (standard:${stdPages.length} advanced:${advPages.length}) — need both to recompute + cross-check; skipping player_actuals`);
  } else {
    // Season + as-of week from the run manifest (the archiver records both). Fall
    // back to deriving the week from the capture date if an older manifest lacks it.
    const season = Number(manifest.sources?.fantasypros?.season) ||
      new Date(manifest.started_at).getUTCFullYear();
    const asOfWeek = Number.isInteger(manifest.sources?.cbs?.actuals_as_of_week)
      ? manifest.sources.cbs.actuals_as_of_week
      : actualsAsOfWeek(manifest.started_at);

    const { standard, advanced } = parseStatsActualsPages({
      standardPages: stdPages.map((n) => readPage(runDir, pages.get(n))),
      advancedPages: advPages.map((n) => readPage(runDir, pages.get(n))),
      context: `${runId}/actuals`,
    });
    const { joined, onlyStandard, onlyAdvanced } = joinActuals({ standard, advanced, context: `${runId}/actuals` });

    // Only players in OUR universe (present in `player`) — the stats pages carry the
    // whole NFL; the rest can't be stored (FK) and aren't ours to net.
    const universe = new Set(db.prepare(`SELECT cbs_player_id FROM player`).all().map((r) => r.cbs_player_id));
    const mine = joined.filter((j) => universe.has(j.cbsPlayerId));

    // Recompute each actual through the parsed scoring config (owner ruling, #30):
    // the netted value is OUR recompute, cross-checked against CBS's FPTS Total.
    const coef = buildScoringMap(db);
    let crosscheckOff = 0;
    const worst = [];
    for (const j of mine) {
      j.kerf_points = recomputeKerfPoints(j, coef);
      if (j.fpts_total != null) {
        const diff = Math.round((j.kerf_points - j.fpts_total) * 100) / 100;
        // Residuals are expected for points the offensive stat page omits (return
        // TDs, etc.), so only NON-trivial gaps on scoring players are worth flagging.
        if (Math.abs(diff) > 1 && j.fpts_total > 0) {
          crosscheckOff++;
          worst.push({ name: j.name, actual: j.fpts_total, computed: j.kerf_points, diff });
        }
      }
    }

    // Latest pull for a given (season, as_of_week) replaces it wholesale.
    db.prepare(`DELETE FROM player_actuals WHERE season = ? AND as_of_week = ?`).run(season, asOfWeek);
    const insertActual = db.prepare(
      `INSERT INTO player_actuals
         (season, as_of_week, cbs_player_id, cbs_name_raw, pos, nfl_team, bye_week,
          pass_att, pass_cmp, pass_yds, pass_td, pass_int, pass_2pt, pass_first_downs,
          rush_att, rush_yds, rush_td, rush_2pt, rush_first_downs,
          rec_tar, rec_rec, rec_yds, rec_td, rec_2pt, rec_first_downs,
          fumbles_lost, fpts_total, fpts_avg, kerf_points, pull_id, fetched_at, imported_at)
       VALUES
         (@season, @as_of_week, @cbs_player_id, @cbs_name_raw, @pos, @nfl_team, @bye_week,
          @pass_att, @pass_cmp, @pass_yds, @pass_td, @pass_int, @pass_2pt, @pass_first_downs,
          @rush_att, @rush_yds, @rush_td, @rush_2pt, @rush_first_downs,
          @rec_tar, @rec_rec, @rec_yds, @rec_td, @rec_2pt, @rec_first_downs,
          @fumbles_lost, @fpts_total, @fpts_avg, @kerf_points, @pull_id, @fetched_at, @imported_at)`
    );
    const importedAt = new Date().toISOString();
    const actualsFetchedAt = pages.get(stdPages[0]).fetched_at;
    for (const j of mine) {
      insertActual.run({
        season, as_of_week: asOfWeek, cbs_player_id: j.cbsPlayerId, cbs_name_raw: j.nameRaw,
        pos: j.pos, nfl_team: j.nflTeam, bye_week: j.byeWeek,
        pass_att: j.pass_att, pass_cmp: j.pass_cmp, pass_yds: j.pass_yds, pass_td: j.pass_td,
        pass_int: j.pass_int, pass_2pt: j.pass_2pt, pass_first_downs: j.pass_first_downs,
        rush_att: j.rush_att, rush_yds: j.rush_yds, rush_td: j.rush_td, rush_2pt: j.rush_2pt,
        rush_first_downs: j.rush_first_downs,
        rec_tar: j.rec_tar, rec_rec: j.rec_rec, rec_yds: j.rec_yds, rec_td: j.rec_td,
        rec_2pt: j.rec_2pt, rec_first_downs: j.rec_first_downs,
        fumbles_lost: j.fumbles_lost, fpts_total: j.fpts_total, fpts_avg: j.fpts_avg,
        kerf_points: j.kerf_points, pull_id: pullId, fetched_at: actualsFetchedAt, imported_at: importedAt,
      });
    }
    stats.actuals = mine.length;
    stats.actualsAsOfWeek = asOfWeek;
    note(
      `actuals: stored ${mine.length} player_actuals for season ${season} as-of week ${asOfWeek} ` +
        `(${joined.length} joined from the stats pages, ${joined.length - mine.length} outside our universe; ` +
        `${onlyStandard.length} standard-only, ${onlyAdvanced.length} advanced-only rows unpaired)`
    );
    if (crosscheckOff > 0) {
      worst.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
      warn(
        `actuals: ${crosscheckOff} scoring player(s) recompute >1pt off CBS's FPTS Total — ` +
          `worst: ${worst.slice(0, 3).map((w) => `${w.name} ${w.computed} vs ${w.actual}`).join("; ")}`
      );
    }
  }

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

  // Skip FP-only historical snapshots (the backtest's 2024/2025 pulls, #19): their
  // manifest shows CBS was not attempted (no cookie), so they carry no rosters/rules
  // and would fail the CBS-required ingest. They are loaded by `npm run backtest`
  // (tools/backtest/load.mjs) into isolated kind='backtest' pulls, never here.
  const isBacktestRun = (runId) => {
    try {
      const m = loadManifest(join(RAW_ROOT, runId));
      return m?.sources?.cbs?.attempted === false;
    } catch {
      return false;
    }
  };
  const skippedBacktest = runs.filter(isBacktestRun);
  const todo = runs.filter((r) => (reingestAll || !already.has(r)) && !isBacktestRun(r));

  console.log(`\nIngest — raw archive -> ${DB_PATH}`);
  console.log(`  archive runs: ${runs.length}  already ingested: ${already.size}  to ingest: ${todo.length}`);
  if (skippedBacktest.length > 0) {
    console.log(`  skipping ${skippedBacktest.length} FP-only historical run(s) (loaded by "npm run backtest"): ${skippedBacktest.join(", ")}`);
  }
  console.log("");

  let failed = 0;
  for (const runId of todo) {
    const warnings = [];
    const notes = [];
    const warn = (m) => warnings.push(m);
    const note = (m) => notes.push(m);
    try {
      const stats = ingestRun(db, runId, { warn, note });
      console.log(
        `  ✔ ${runId}  teams:${stats.teams} players:${stats.rosterPlayers} dead-cap:${stats.deadCapRows} ` +
          `tx:${stats.transactions} rules:${stats.scoringRules} boards:${stats.boards} rankings:${stats.rankingRows} ` +
          `projections:${stats.projections ?? 0} actuals:${stats.actuals ?? 0}${stats.actuals ? `@wk${stats.actualsAsOfWeek}` : ""}`
      );
      for (const n of notes) console.log(`      · ${n}`);
      for (const w of warnings) console.log(`      ⚠ ${w}`);
    } catch (err) {
      failed++;
      console.error(`  ✘ ${runId}  ROLLED BACK — nothing from this run was stored:`);
      console.error(`      ${err.message}`);
      // Warnings collected before the failure are often the context that explains
      // it (e.g. the blank salary behind a cap mismatch) — never swallow them.
      for (const w of warnings) console.error(`      ⚠ (before the failure) ${w}`);
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
