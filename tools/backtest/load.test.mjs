// Backtest loader — DB integration test (issue #19).
//
// Exercises loadBacktestSeason against a synthetic FP-only archive fixture (no
// git-ignored data, no network): the season stamp, the ECR + projections rows,
// the FK-satisfying player insert, idempotency, and — the safety property that
// justifies the whole design — that a backtest pull NEVER becomes latest_pull.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverBacktestRuns, loadBacktestSeason } from "./load.mjs";

const MIGRATIONS = join(process.cwd(), "db", "migrations");
const RUN_ID = "2099-01-01T00-00-00Z"; // far-future capture: proves isolation isn't luck

function migratedDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  return db;
}

// A minimal FP-only raw run: ECR board + projections + manifest (CBS not attempted).
function writeFixture(root) {
  const runDir = join(root, RUN_ID);
  mkdirSync(join(runDir, "fantasypros"), { recursive: true });

  const board = {
    ranking_type_name: "draft",
    scoring: "STD",
    position_id: "OP",
    total_experts: 10,
    players: [
      { player_id: 910, cbs_player_id: "10", player_name: "Star QB", player_position_id: "QB", player_team_id: "BUF", rank_ecr: 1, pos_rank: "QB1", tier: 1 },
      { player_id: 920, cbs_player_id: "20", player_name: "Star WR", player_position_id: "WR", player_team_id: "CIN", rank_ecr: 2, pos_rank: "WR1", tier: 1 },
    ],
  };
  const projections = {
    season: 2024,
    week: 0,
    players: [
      { fpid: 910, name: "Star QB", position_id: "QB", team_id: "BUF", stats: { pass_yds: 4000, pass_tds: 30, rush_att: 60, rush_yds: 400 } },
      { fpid: 920, name: "Star WR", position_id: "WR", team_id: "CIN", stats: { rec_rec: 100, rec_yds: 1300, rec_tds: 10 } },
      // fpid 930 is NOT on the ECR board -> no cbs id -> stored with null id.
      { fpid: 930, name: "Ghost RB", position_id: "RB", team_id: "FA", stats: { rush_att: 100, rush_yds: 500 } },
    ],
  };
  const manifest = {
    run_id: RUN_ID,
    started_at: "2099-01-01T00:00:00.000Z",
    sources: { cbs: { attempted: false, ok: 0, failed: 0 }, fantasypros: { attempted: true, ok: 2, failed: 0 } },
    responses: [
      { source: "fantasypros", page: "ecr-draft-std-op", file: "fantasypros/ecr-draft-std-op.json", status: 200, fetched_at: "2099-01-01T00:00:01.000Z" },
      { source: "fantasypros", page: "projections-all", file: "fantasypros/projections-all.json", status: 200, fetched_at: "2099-01-01T00:00:02.000Z" },
    ],
  };
  writeFileSync(join(runDir, "fantasypros", "ecr-draft-std-op.json"), JSON.stringify(board));
  writeFileSync(join(runDir, "fantasypros", "projections-all.json"), JSON.stringify(projections));
  writeFileSync(join(runDir, "manifest.json"), JSON.stringify(manifest));
  return runDir;
}

describe("backtest loader", () => {
  let db, root;
  beforeEach(() => {
    db = migratedDb();
    root = mkdtempSync(join(tmpdir(), "gd-backtest-"));
    writeFixture(root);
  });
  afterEach(() => {
    db.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("discovers the run by the season stamped in its projections payload", () => {
    expect(discoverBacktestRuns(root, [2024])).toEqual([
      { season: 2024, runId: RUN_ID, capturedAt: "2099-01-01T00:00:00.000Z" },
    ]);
    expect(discoverBacktestRuns(root, [2025])).toEqual([]); // wrong season -> not found
  });

  it("loads an isolated backtest pull with the right rows", () => {
    const s = loadBacktestSeason(db, { season: 2024, runId: RUN_ID }, root);
    expect(s.rankingRows).toBe(2);
    expect(s.projections).toBe(3);
    expect(s.projMatched).toBe(2); // 910, 920 join; 930 does not

    const pull = db.prepare(`SELECT kind, season, status FROM pull WHERE pull_id = ?`).get(s.pullId);
    expect(pull).toEqual({ kind: "backtest", season: 2024, status: "ok" });

    const mr = db.prepare(`SELECT COUNT(*) c FROM market_ranking WHERE pull_id = ?`).get(s.pullId).c;
    expect(mr).toBe(2);

    const ps = db
      .prepare(`SELECT COUNT(*) c, SUM(CASE WHEN cbs_player_id IS NULL THEN 1 ELSE 0 END) nulls FROM projection_source WHERE pull_id = ?`)
      .get(s.pullId);
    expect(ps.c).toBe(3);
    expect(ps.nulls).toBe(1); // the unmatched Ghost RB

    // Missing players were inserted to satisfy the FK (identity added, not skipped).
    expect(db.prepare(`SELECT name FROM player WHERE cbs_player_id = 10`).get().name).toBe("Star QB");
  });

  it("NEVER lets a backtest pull become latest_pull", () => {
    // A current pull captured LONG BEFORE the (far-future) backtest run.
    db.prepare(
      `INSERT INTO pull (pull_id, run_id, raw_path, captured_at, ingested_at, status, kind)
       VALUES (1, 'current', 'data/raw/current', '2026-08-26T00:00:00Z', '2026-08-26T00:00:00Z', 'ok', 'current')`
    ).run();

    loadBacktestSeason(db, { season: 2024, runId: RUN_ID }, root);

    // Even though the backtest pull's captured_at is in 2099, latest_pull must
    // resolve to the 2026 CURRENT pull — the kind filter, not the date, decides.
    const latest = db.prepare(`SELECT pull_id FROM latest_pull`).get().pull_id;
    expect(latest).toBe(1);
  });

  it("is idempotent — re-loading replaces, never duplicates", () => {
    const a = loadBacktestSeason(db, { season: 2024, runId: RUN_ID }, root);
    const b = loadBacktestSeason(db, { season: 2024, runId: RUN_ID }, root);
    expect(b.pullId).toBe(a.pullId); // same pull (upsert on run_id)
    expect(db.prepare(`SELECT COUNT(*) c FROM market_ranking WHERE pull_id = ?`).get(a.pullId).c).toBe(2);
    expect(db.prepare(`SELECT COUNT(*) c FROM projection_source WHERE pull_id = ?`).get(a.pullId).c).toBe(3);
  });

  it("rejects a run whose projections season doesn't match the requested season", () => {
    expect(() => loadBacktestSeason(db, { season: 2025, runId: RUN_ID }, root)).toThrow(/season/);
  });
});
