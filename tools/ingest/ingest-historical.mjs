// Historical ingestion — owner-provided CSVs -> normalized SQLite (issue #17).
//
// SEPARATE from `npm run ingest` (the archiver's fetched-HTML walk). Reads the
// manual exports in data/historical/ and loads three tables:
//   * player_season_stats  (2024 & 2025 CBS stat lines, first downs + volume + FPTS)
//   * contract_history      (KERFUFFLE 2025 salaries)
//   * auction_result        (TRUFFLE 2026 — inert reference, is_reference=1, D-15)
//
// Depends on the main store already being populated (the player universe the
// name-matcher resolves against). Run `npm run ingest` first.
//
// IDEMPOTENT: everything upserts on a natural key; re-running loads nothing twice.
// TEMP-VALIDATE-SWAP: each file loads inside one transaction — a parse/anchor
// failure rolls that file back and leaves prior good data intact.
//
// RUN:  npm run ingest:historical            (load)
//       npm run ingest:historical -- --dry-run   (parse + match report, no writes)

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { openDb, applyMigrations, DB_PATH } from "../../db/client.mjs";
import { IngestError } from "./parse-cbs-ingest.mjs";
import { parseStatFile, joinSeason, parseContracts, parseTruffle } from "./parse-historical.mjs";
import { buildPlayerIndex, matchPlayer } from "./match-players.mjs";

// Resolved at call time so tests can point ingestion at a fixture directory.
const histRoot = () => process.env.GART_HIST_ROOT || join(process.cwd(), "data", "historical");

// Anchors that verify the CBS stat files' column layout (issue #17 header note).
const ANCHORS_2025 = [
  { name: "Josh Allen", expect: { pass_first_downs: 177, rush_first_downs: 46 } },
  { name: "Ja'Marr Chase", expect: { rec_first_downs: 73 } },
];

function read(file) {
  const root = histRoot();
  const p = join(root, file);
  if (!existsSync(p)) throw new IngestError(`missing historical file: ${file} (expected in ${root})`);
  return readFileSync(p, "utf8");
}

// ---- season stats -----------------------------------------------------------

function loadSeasonStats(db, index, season, anchors, { dryRun, log }) {
  const advanced = parseStatFile(read(`${season}_player_stats_kerfuffle.csv`), {
    kind: "advanced", context: `${season} advanced`,
  });
  const standard = parseStatFile(read(`${season}_player_stats_kerfuffle_standard.csv`), {
    kind: "standard", context: `${season} standard`,
  });
  const { joined, onlyAdvanced } = joinSeason({ advanced, standard, season, anchors });
  if (onlyAdvanced.length) {
    log(`  ⚠ ${season}: ${onlyAdvanced.length} player(s) in the advanced file had no standard-file match (skipped)`);
  }

  // Match to our universe; store ONLY players in it (owner decision 2026-08-26).
  const matched = [];
  const unmatched = [];
  for (const j of joined) {
    const { id } = matchPlayer(j.player, index);
    if (id === null) unmatched.push(j.player);
    else matched.push({ ...j, cbsPlayerId: id });
  }
  log(
    `  ${season} stats: ${joined.length} exported rows → ${matched.length} matched to our ` +
      `${index.size}-player universe, ${unmatched.length} not in universe (skipped by design)`
  );

  // Two raw cells resolving to the same id would silently overwrite on the
  // UNIQUE(season, cbs_player_id) upsert — fail loudly instead (codebase ethos).
  const seenId = new Map();
  for (const m of matched) {
    if (seenId.has(m.cbsPlayerId)) {
      throw new IngestError(
        `${season}: two stat rows resolve to cbs_player_id ${m.cbsPlayerId} ` +
          `("${seenId.get(m.cbsPlayerId)}" and "${m.player.raw}") — refusing to overwrite silently`
      );
    }
    seenId.set(m.cbsPlayerId, m.player.raw);
  }

  if (!dryRun) {
    const stmt = db.prepare(
      `INSERT INTO player_season_stats
         (season, cbs_player_id, cbs_name_raw, pos, nfl_team, bye_week,
          pass_att, pass_cmp, pass_yds, pass_td, pass_int, pass_2pt, pass_first_downs,
          rush_att, rush_yds, rush_td, rush_2pt, rush_first_downs,
          rec_tar, rec_rec, rec_yds, rec_td, rec_2pt, rec_first_downs,
          fumbles_lost, fpts_total, fpts_avg, source, imported_at)
       VALUES
         (@season, @cbs_player_id, @cbs_name_raw, @pos, @nfl_team, @bye_week,
          @pass_att, @pass_cmp, @pass_yds, @pass_td, @pass_int, @pass_2pt, @pass_first_downs,
          @rush_att, @rush_yds, @rush_td, @rush_2pt, @rush_first_downs,
          @rec_tar, @rec_rec, @rec_yds, @rec_td, @rec_2pt, @rec_first_downs,
          @fumbles_lost, @fpts_total, @fpts_avg, @source, @imported_at)
       ON CONFLICT(season, cbs_player_id) DO UPDATE SET
          cbs_name_raw=excluded.cbs_name_raw, pos=excluded.pos, nfl_team=excluded.nfl_team,
          bye_week=excluded.bye_week,
          pass_att=excluded.pass_att, pass_cmp=excluded.pass_cmp, pass_yds=excluded.pass_yds,
          pass_td=excluded.pass_td, pass_int=excluded.pass_int, pass_2pt=excluded.pass_2pt,
          pass_first_downs=excluded.pass_first_downs,
          rush_att=excluded.rush_att, rush_yds=excluded.rush_yds, rush_td=excluded.rush_td,
          rush_2pt=excluded.rush_2pt, rush_first_downs=excluded.rush_first_downs,
          rec_tar=excluded.rec_tar, rec_rec=excluded.rec_rec, rec_yds=excluded.rec_yds,
          rec_td=excluded.rec_td, rec_2pt=excluded.rec_2pt, rec_first_downs=excluded.rec_first_downs,
          fumbles_lost=excluded.fumbles_lost, fpts_total=excluded.fpts_total, fpts_avg=excluded.fpts_avg,
          source=excluded.source, imported_at=excluded.imported_at`
    );
    const importedAt = new Date().toISOString();
    const source = `${season} CBS advanced+standard, imported ${importedAt.slice(0, 10)}`;
    const tx = db.transaction((rows) => {
      // Replace this season wholesale (not merge): a re-match after an alias fix
      // must not leave the player's old-id row behind as a phantom duplicate.
      db.prepare(`DELETE FROM player_season_stats WHERE season = ?`).run(season);
      for (const m of rows) {
        stmt.run({
          season, cbs_player_id: m.cbsPlayerId, cbs_name_raw: m.player.raw,
          pos: m.player.pos, nfl_team: m.player.nflTeam, bye_week: m.byeWeek,
          pass_att: m.pass_att, pass_cmp: m.pass_cmp, pass_yds: m.pass_yds, pass_td: m.pass_td,
          pass_int: m.pass_int, pass_2pt: m.pass_2pt, pass_first_downs: m.pass_first_downs,
          rush_att: m.rush_att, rush_yds: m.rush_yds, rush_td: m.rush_td, rush_2pt: m.rush_2pt,
          rush_first_downs: m.rush_first_downs,
          rec_tar: m.rec_tar, rec_rec: m.rec_rec, rec_yds: m.rec_yds, rec_td: m.rec_td,
          rec_2pt: m.rec_2pt, rec_first_downs: m.rec_first_downs,
          fumbles_lost: m.fumbles_lost, fpts_total: m.fpts_total, fpts_avg: m.fpts_avg,
          source, imported_at: importedAt,
        });
      }
    });
    tx(matched);
  }
  return { matched: matched.length, unmatched };
}

// ---- contracts --------------------------------------------------------------

function loadContracts(db, index, { dryRun, log }) {
  const rows = parseContracts(read("kerfuffle_2025_contracts.csv"), { context: "kerfuffle_2025_contracts" });
  const resolved = rows.map((r) => {
    // Dead-cap rows (Pos='DC') are a team's cap obligation, not a player — no id to match.
    const { id } = r.isDeadCap ? { id: null } : matchPlayer({ name: r.name, pos: r.pos, nflTeam: r.nflTeam }, index);
    return { ...r, cbsPlayerId: id };
  });
  const deadCap = resolved.filter((r) => r.isDeadCap);
  const unmatched = resolved.filter((r) => !r.isDeadCap && r.cbsPlayerId === null);
  log(
    `  contracts: ${rows.length} rows → ${rows.length - unmatched.length - deadCap.length} player-matched, ` +
      `${deadCap.length} dead-cap (null id, expected), ${unmatched.length} unmatched player(s) (stored with null id)`
  );

  // The UNIQUE(season, cbs_name_raw) key would silently collapse two rows sharing
  // a verbatim name (two real players named alike, or two generic dead-cap rows) —
  // losing a contract/cap amount. Catch it loudly instead.
  const seenName = new Set();
  for (const r of resolved) {
    const key = `${r.season}|${r.name}`;
    if (seenName.has(key)) {
      throw new IngestError(
        `contracts: two rows share the name "${r.name}" for ${r.season} — the (season, name) key ` +
          `would drop one. Disambiguate the sheet before re-ingesting.`
      );
    }
    seenName.add(key);
  }

  if (!dryRun) {
    const stmt = db.prepare(
      `INSERT INTO contract_history
         (season, cbs_player_id, cbs_name_raw, pos, trf_team, nfl_team, age, salary,
          contract_years, is_franchise_tag, is_free_agent, schedule_raw, source, imported_at)
       VALUES
         (@season, @cbs_player_id, @cbs_name_raw, @pos, @trf_team, @nfl_team, @age, @salary,
          @contract_years, @is_franchise_tag, @is_free_agent, @schedule_raw, @source, @imported_at)
       ON CONFLICT(season, cbs_name_raw) DO UPDATE SET
          cbs_player_id=excluded.cbs_player_id, pos=excluded.pos, trf_team=excluded.trf_team,
          nfl_team=excluded.nfl_team, age=excluded.age, salary=excluded.salary,
          contract_years=excluded.contract_years, is_franchise_tag=excluded.is_franchise_tag,
          is_free_agent=excluded.is_free_agent, schedule_raw=excluded.schedule_raw,
          source=excluded.source, imported_at=excluded.imported_at`
    );
    const importedAt = new Date().toISOString();
    const source = `KERFUFFLE 2025 contract sheet, imported ${importedAt.slice(0, 10)}`;
    const seasons = [...new Set(resolved.map((r) => r.season))];
    const tx = db.transaction((list) => {
      for (const s of seasons) db.prepare(`DELETE FROM contract_history WHERE season = ?`).run(s);
      for (const r of list) {
        stmt.run({
          season: r.season, cbs_player_id: r.cbsPlayerId, cbs_name_raw: r.name, pos: r.pos,
          trf_team: r.trfTeam, nfl_team: r.nflTeam, age: r.age, salary: r.salary,
          contract_years: r.contractYears, is_franchise_tag: r.isFranchiseTag,
          is_free_agent: r.isFreeAgent, schedule_raw: r.scheduleRaw, source, imported_at: importedAt,
        });
      }
    });
    tx(resolved);
  }
  return { total: rows.length, unmatched: unmatched.map((r) => r.name) };
}

// ---- TRUFFLE auction (reference only) --------------------------------------

function loadTruffle(db, index, { dryRun, log }) {
  const rows = parseTruffle(read("truffle_2026_contracts.csv"), { context: "truffle_2026_contracts" });
  // The file carries a CBS PlayerID directly; note how many join to our universe.
  const known = new Set(db.prepare(`SELECT cbs_player_id FROM player`).all().map((r) => r.cbs_player_id));
  const inUniverse = rows.filter((r) => r.cbsPlayerId != null && known.has(r.cbsPlayerId)).length;
  log(`  TRUFFLE: ${rows.length} auction rows (${inUniverse} join to our universe by CBS id) — reference only, read by no consumer`);

  // UNIQUE(league, season, player_name) would collapse two same-name rows — loud.
  const seenAuction = new Set();
  for (const r of rows) {
    const key = `${r.league}|${r.season}|${r.playerName}`;
    if (seenAuction.has(key)) {
      throw new IngestError(`auction: two rows share "${r.playerName}" for ${r.league} ${r.season} — the (league, season, name) key would drop one`);
    }
    seenAuction.add(key);
  }

  if (!dryRun) {
    const stmt = db.prepare(
      `INSERT INTO auction_result
         (league, season, cbs_player_id, player_name, pos, nfl_team, winning_team,
          final_salary, nomination_order, bid_history_json, is_reference, source, imported_at)
       VALUES
         (@league, @season, @cbs_player_id, @player_name, @pos, @nfl_team, @winning_team,
          @final_salary, @nomination_order, @bid_history_json, 1, @source, @imported_at)
       ON CONFLICT(league, season, player_name) DO UPDATE SET
          cbs_player_id=excluded.cbs_player_id, pos=excluded.pos, nfl_team=excluded.nfl_team,
          winning_team=excluded.winning_team, final_salary=excluded.final_salary,
          nomination_order=excluded.nomination_order, bid_history_json=excluded.bid_history_json,
          is_reference=1, source=excluded.source, imported_at=excluded.imported_at`
    );
    const importedAt = new Date().toISOString();
    const source = `TRUFFLE 2026 auction (reference), imported ${importedAt.slice(0, 10)}`;
    // Only link cbs_player_id when it exists in our universe (FK safety).
    const pairs = [...new Set(rows.map((r) => `${r.league}|${r.season}`))].map((k) => k.split("|"));
    const tx = db.transaction((list) => {
      for (const [lg, sn] of pairs) db.prepare(`DELETE FROM auction_result WHERE league = ? AND season = ?`).run(lg, Number(sn));
      for (const r of list) {
        stmt.run({
          league: r.league, season: r.season,
          cbs_player_id: r.cbsPlayerId != null && known.has(r.cbsPlayerId) ? r.cbsPlayerId : null,
          player_name: r.playerName, pos: r.pos, nfl_team: r.nflTeam, winning_team: r.winningTeam,
          final_salary: r.finalSalary, nomination_order: r.nominationOrder,
          bid_history_json: r.bidHistoryJson, source, imported_at: importedAt,
        });
      }
    });
    tx(rows);
  }
  return { total: rows.length, inUniverse };
}

// ---- main -------------------------------------------------------------------

export function ingestHistorical(db, { dryRun = false, log = () => {}, anchors } = {}) {
  const A = anchors ?? { 2024: [], 2025: ANCHORS_2025 }; // 2024 verified by cross-file FPTS + the scoring cross-check
  const index = buildPlayerIndex(db);
  if (index.size === 0) {
    throw new IngestError(
      `the player universe is empty — run "npm run ingest" first so the name-matcher has players to resolve against`
    );
  }
  // Whole-run atomicity: all four loads happen inside ONE transaction, so a
  // failure in any file (a bad anchor, an id collision, invalid TRUFFLE JSON)
  // rolls back everything and leaves the previous good historical data intact —
  // the temp-validate-swap invariant the main ingest also holds. The loaders'
  // own db.transaction() calls become savepoints under this outer one.
  const run = () => {
    const s2024 = loadSeasonStats(db, index, 2024, A[2024] ?? [], { dryRun, log });
    const s2025 = loadSeasonStats(db, index, 2025, A[2025] ?? [], { dryRun, log });
    const contracts = loadContracts(db, index, { dryRun, log });
    const truffle = loadTruffle(db, index, { dryRun, log });
    return { s2024, s2025, contracts, truffle };
  };
  return dryRun ? run() : db.transaction(run)();
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!existsSync(histRoot())) {
    console.error(`No data/historical/ directory — nothing to ingest.`);
    process.exit(1);
  }
  const db = openDb();
  applyMigrations(db, { log: console.log });
  console.log(`\nHistorical ingest — data/historical/ -> ${DB_PATH}${dryRun ? "   (DRY RUN — no writes)" : ""}\n`);

  try {
    const r = ingestHistorical(db, { dryRun, log: (m) => console.log(m) });
    // Loud, named coverage report (issue #17 acceptance criterion).
    console.log("");
    if (r.contracts.unmatched.length === 0) {
      console.log(`  ✔ KERFUFFLE contract players: all matched`);
    } else {
      console.log(
        `  ⚠ KERFUFFLE contract players: ${r.contracts.unmatched.length} not in the current player ` +
          `universe (dropped/retired/unranked since 2025 — no CBS id exists to match). Stored with the ` +
          `raw name + null id, as the issue anticipates ("players since dropped/now free agents"):`
      );
      for (const n of r.contracts.unmatched) console.log(`      · ${n}`);
    }
    console.log(
      `\nSummary: 2024 stats ${r.s2024.matched} rows · 2025 stats ${r.s2025.matched} rows · ` +
        `contracts ${r.contracts.total - r.contracts.unmatched.length}/${r.contracts.total} matched · ` +
        `TRUFFLE ${r.truffle.total} reference rows`
    );
    if (!dryRun) console.log(`\nDone. (Historical tables loaded; TRUFFLE is reference-only and read by no consumer.)`);
  } catch (err) {
    console.error(`\n✘ ROLLED BACK — nothing was stored:\n    ${err.message}`);
    if (!(err instanceof IngestError)) console.error(err.stack);
    db.close();
    process.exit(1);
  }
  db.close();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
