// Historical ingest integration tests (issue #17) against a SYNTHETIC fixture
// directory + a temp DB seeded with a small player universe. Proves: the three
// tables load; matching resolves ids (incl. DST-by-team and an alias); unmatched
// rows are KEPT with a null id (never dropped); re-running is IDEMPOTENT at the
// DB level; and TRUFFLE loads as inert reference read by no consumer (D-15).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { openDb, applyMigrations } from "../../db/client.mjs";
import { ingestHistorical } from "./ingest-historical.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// --- fixtures ---------------------------------------------------------------
const ADV = (season) => [
  `All Players ${season} Season NFL Advanced Categories`,
  ",,,Upcoming,,,Trends,,Passing,,,Rushing,,,Receiving,,,FPTS,,",
  "Avail,Player,Opp,OVP,Bye,Rost,Start,Pct,1stD,2Pt,Avg,1stD,2Pt,Avg,1stD,2Pt,Avg,Total,",
  "FA,Alpha Back RB | AAA,@X,1,9,50,40,0.0,0,0,4.0,30,1,3.0,10,0,12.00,204.00",
  "FA,Nobody Here WR | ZZZ,@Q,3,5,10,5,0.0,0,0,0.0,0,0,1.0,5,0,3.00,51.00",
].join("\n");
const STD = (season) => [
  `All Players ${season} Season NFL Standard Categories`,
  ",,,Upcoming,,,Trends,,Passing,,,,,Rushing,,,Receiving,,,,Fumbles,FPTS,,",
  "Avail,Player,Opp,OVP,Bye,Rost,Start,ATT,Comp,Yds,TD,Int,Att,Yds,TD,Tar,Rec,Yds,TD,Lost,Avg,Total,",
  "FA,Alpha Back RB | AAA,@X,1,9,50,40,0,0,0,0,0,200,900,8,40,30,250,2,1,12.00,204.00",
  "FA,Nobody Here WR | ZZZ,@Q,3,5,10,5,0,0,0,0,0,0,0,0,10,5,50,0,0,3.00,51.00",
].join("\n");
const CONTRACTS = [
  "Pos,Player,TRF,Age,NFL,Salary,Yr,'24,'25,'26,'27,'28",
  "RB,Alpha Back,SBS,25,AAA,120,3,110,120,120,FT,FA",   // matches by name+pos
  "DST,Commanders,PP,,WAS,3,2,3,3,FT,FT,FA",              // matches by DST + team
  "WR,Josh Palmer,MB,26,LAC,1,2,1,1,FT,FT,FA",            // matches by alias
  "WR,Retired Guy,RR,35,FA,5,1,5,FA,-,-,-",               // no id in universe -> null, kept
].join("\n");
const TRUFFLE = [
  "SznPlPos,PlPos,SznLgTrf,LgTrf,Season,TrfLg,TrfTm,NominationOrder,Player,PlayerID,Pos,NFL,Salary,BidHistory",
  `x,y,z,w,2026.0,TRUFFLE,NN,1.0,Alpha Back,111.0,RB,AAA,75.0,"[{""Team"": ""NN"", ""Bid"": 75.0}]"`,
].join("\n");

let dir, dbPath, db;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "gart-hist-"));
  mkdirSync(join(dir, "historical"), { recursive: true });
  const h = join(dir, "historical");
  for (const s of [2024, 2025]) {
    writeFileSync(join(h, `${s}_player_stats_kerfuffle.csv`), ADV(s));
    writeFileSync(join(h, `${s}_player_stats_kerfuffle_standard.csv`), STD(s));
  }
  writeFileSync(join(h, "kerfuffle_2025_contracts.csv"), CONTRACTS);
  writeFileSync(join(h, "truffle_2026_contracts.csv"), TRUFFLE);
  process.env.GART_HIST_ROOT = h;

  dbPath = join(dir, "test.sqlite");
  db = openDb({ path: dbPath });
  applyMigrations(db);
  // Seed a tiny player universe. Josh Palmer stored as "Joshua Palmer" (alias),
  // Commanders as full name (DST-by-team), Alpha Back exact.
  const ins = db.prepare(
    `INSERT INTO player (cbs_player_id, name, pos, nfl_team, pull_id, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  // a pull row for FK
  db.prepare(`INSERT INTO pull (run_id, raw_path, captured_at, ingested_at) VALUES ('t','p','2026-01-01','2026-01-01')`).run();
  const pid = db.prepare(`SELECT pull_id FROM pull`).get().pull_id;
  ins.run(111, "Alpha Back", "RB", "AAA", pid, "2026-01-01");
  ins.run(1929, "Washington Commanders", "DST", "WAS", pid, "2026-01-01");
  ins.run(2867325, "Joshua Palmer", "WR", "BUF", pid, "2026-01-01");
});
afterEach(() => {
  db.close();
  delete process.env.GART_HIST_ROOT;
  rmSync(dir, { recursive: true, force: true });
});

describe("ingestHistorical", () => {
  it("loads the three tables and matches ids (name, DST-by-team, alias)", () => {
    ingestHistorical(db, { anchors: { 2024: [], 2025: [] } });
    // season stats: only players in the universe are stored (Alpha Back), Nobody Here is skipped
    const stats = db.prepare(`SELECT season, cbs_player_id, cbs_name_raw FROM player_season_stats ORDER BY season`).all();
    expect(stats).toHaveLength(2); // 2024 + 2025, one matched player each
    expect(stats[0].cbs_player_id).toBe(111);
    // contracts: 3 matched (Alpha Back, Commanders via team, Josh Palmer via alias) + 1 null
    const c = db.prepare(`SELECT cbs_name_raw, cbs_player_id FROM contract_history ORDER BY cbs_name_raw`).all();
    expect(c.find((r) => r.cbs_name_raw === "Commanders").cbs_player_id).toBe(1929);
    expect(c.find((r) => r.cbs_name_raw === "Josh Palmer").cbs_player_id).toBe(2867325);
    expect(c.find((r) => r.cbs_name_raw === "Alpha Back").cbs_player_id).toBe(111);
  });

  it("keeps unmatched rows with a null id — never drops them", () => {
    ingestHistorical(db, { anchors: { 2024: [], 2025: [] } });
    const retired = db.prepare(`SELECT cbs_player_id, salary, is_free_agent FROM contract_history WHERE cbs_name_raw = 'Retired Guy'`).get();
    expect(retired).toBeTruthy();
    expect(retired.cbs_player_id).toBeNull();
    // '25 cell was 'FA' → no plain 2025 salary (null), flagged free agent. The row is still kept.
    expect(retired.salary).toBeNull();
    expect(retired.is_free_agent).toBe(1);
  });

  it("loads TRUFFLE as reference (is_reference=1) and links its CBS id", () => {
    ingestHistorical(db, { anchors: { 2024: [], 2025: [] } });
    const a = db.prepare(`SELECT league, is_reference, cbs_player_id, bid_history_json FROM auction_result`).get();
    expect(a).toMatchObject({ league: "TRUFFLE", is_reference: 1, cbs_player_id: 111 });
    expect(JSON.parse(a.bid_history_json)).toHaveLength(1);
  });

  it("is idempotent at the DB level — re-running loads nothing twice", () => {
    ingestHistorical(db, { anchors: { 2024: [], 2025: [] } });
    const count = () => ({
      stats: db.prepare(`SELECT COUNT(*) c FROM player_season_stats`).get().c,
      contracts: db.prepare(`SELECT COUNT(*) c FROM contract_history`).get().c,
      auctions: db.prepare(`SELECT COUNT(*) c FROM auction_result`).get().c,
    });
    const first = count();
    ingestHistorical(db, { anchors: { 2024: [], 2025: [] } });
    ingestHistorical(db, { anchors: { 2024: [], 2025: [] } });
    expect(count()).toEqual(first);
  });

  it("re-ingest replaces a season wholesale — a stale-id row from a prior mismatch is removed", () => {
    ingestHistorical(db, { anchors: { 2024: [], 2025: [] } });
    // Simulate a row stored under a since-corrected id (1929 exists as a player).
    db.prepare(
      `INSERT INTO player_season_stats (season, cbs_player_id, cbs_name_raw, pos, source, imported_at)
       VALUES (2024, 1929, 'Stale Row RB | AAA', 'RB', 'stale', 'x')`
    ).run();
    expect(db.prepare(`SELECT COUNT(*) c FROM player_season_stats WHERE season=2024`).get().c).toBe(2);
    ingestHistorical(db, { anchors: { 2024: [], 2025: [] } });
    const rows2024 = db.prepare(`SELECT cbs_player_id FROM player_season_stats WHERE season=2024`).all();
    expect(rows2024).toHaveLength(1);          // the stale row is gone, not a phantom duplicate
    expect(rows2024[0].cbs_player_id).toBe(111);
  });

  it("fails loudly if two stat rows resolve to the same player id", () => {
    const h = process.env.GART_HIST_ROOT;
    // A second "Alpha Back RB" (different team) matches the same universe id 111.
    writeFileSync(join(h, "2025_player_stats_kerfuffle.csv"), ADV(2025).replace("FA,Nobody Here WR | ZZZ", "FA,Alpha Back RB | BBB"));
    writeFileSync(join(h, "2025_player_stats_kerfuffle_standard.csv"), STD(2025).replace("FA,Nobody Here WR | ZZZ", "FA,Alpha Back RB | BBB"));
    expect(() => ingestHistorical(db, { anchors: { 2024: [], 2025: [] } })).toThrow(/resolve to cbs_player_id 111/);
  });

  it("fails loudly if two contract rows share a verbatim name", () => {
    const h = process.env.GART_HIST_ROOT;
    writeFileSync(join(h, "kerfuffle_2025_contracts.csv"), CONTRACTS + "\nRB,Alpha Back,XX,26,BBB,50,1,50,FA,-,-,-");
    expect(() => ingestHistorical(db, { anchors: { 2024: [], 2025: [] } })).toThrow(/share the name "Alpha Back"/);
  });

  it("refuses to run against an empty player universe (needs the main ingest first)", () => {
    const empty = openDb({ path: join(dir, "empty.sqlite") });
    applyMigrations(empty);
    expect(() => ingestHistorical(empty, { anchors: { 2024: [], 2025: [] } })).toThrow(/player universe is empty/);
    empty.close();
  });
});

// Structural guard for D-15: no consumer path reads auction_result / TRUFFLE data.
// Globs the whole app + data-access + migrations rather than a fixed file list, so
// a future consumer (e.g. the #20 price curve) can't slip a TRUFFLE read past it.
describe("TRUFFLE is read by no consumer (D-15)", () => {
  const roots = ["../../lib", "../../app", "../../components", "../../db/migrations"];
  const collect = (dir) => {
    const abs = join(HERE, dir);
    if (!existsSync(abs)) return [];
    return readdirSync(abs, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && /\.(ts|tsx|js|jsx|mjs|sql)$/.test(e.name))
      .map((e) => join(e.parentPath ?? e.path, e.name));
  };
  it("no app/data-access/migration file references auction_result", () => {
    const offenders = [];
    for (const root of roots) {
      for (const file of collect(root)) {
        // 004 DEFINES the table (CREATE TABLE) — that's not a consumer read.
        if (file.endsWith("004_historical_data.sql")) continue;
        if (readFileSync(file, "utf8").includes("auction_result")) offenders.push(file);
      }
    }
    expect(offenders, `these consumer files reference auction_result (D-15 violation): ${offenders.join(", ")}`).toEqual([]);
  });
});
