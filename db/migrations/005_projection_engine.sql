-- 005 — The projection layer: FantasyPros component projections in, KERFUFFLE
-- projected points + ranks + tiers out (issue #18, decisions D-13, D-14).
--
-- This is the FIRST derived layer the store has carried. Three tables:
--
--   * projection_source — NORMALIZED INPUT. One row per FantasyPros projected
--     stat line per player per pull, written by `npm run ingest` (like the ECR
--     boards). FantasyPros projects yards/TDs/receptions/carries but NOT first
--     downs (the league's scoring edge) — so this table holds the raw projected
--     volume, and the engine estimates first downs from it. Carries pull lineage.
--
--   * engine_run — one row per `npm run engine` execution: a stamped, traceable
--     run recording exactly which pull's projections + scoring it used and which
--     seasons the first-down rates came from. Reproducibility lives here.
--
--   * projection — DERIVED OUTPUT. One row per player per engine_run: the
--     KERFUFFLE projected points, the ESTIMATED first-down components as distinct
--     named fields (D-14), the full component breakdown for drill-down, and the
--     derived Kerf overall/positional ranks + tiers.
--
-- Scoring-authority rule (data_model.md) is preserved: CBS actuals are never
-- re-scored. The scoring_rule config only translates PROJECTED stat lines here.
-- No dollars — VORP/replacement/price/Edge are the valuation issue (#20).

-- Normalized INPUT: the FantasyPros projected stat line per player per pull.
-- FantasyPros' OWN projected points (fp_points) are kept for reference only —
-- they are NOT KERFUFFLE-scored and no consumer treats them as Kerf points.
CREATE TABLE projection_source (
  projection_source_id INTEGER PRIMARY KEY,
  pull_id       INTEGER NOT NULL REFERENCES pull(pull_id),
  cbs_player_id INTEGER REFERENCES player(cbs_player_id),  -- NULL: FantasyPros projects a player not in our universe
  fp_player_id  INTEGER NOT NULL,
  player_name   TEXT    NOT NULL,
  pos           TEXT    NOT NULL,                 -- FantasyPros' position_id (QB/RB/WR/TE/K/DST)
  nfl_team      TEXT,
  season        INTEGER NOT NULL,
  week          INTEGER NOT NULL,                 -- 0 = full-season projection
  -- projected component stat line, exactly as FantasyPros projects it (no first downs)
  pass_att  REAL NOT NULL DEFAULT 0,
  pass_cmp  REAL NOT NULL DEFAULT 0,
  pass_yds  REAL NOT NULL DEFAULT 0,
  pass_td   REAL NOT NULL DEFAULT 0,
  pass_int  REAL NOT NULL DEFAULT 0,
  rush_att  REAL NOT NULL DEFAULT 0,
  rush_yds  REAL NOT NULL DEFAULT 0,
  rush_td   REAL NOT NULL DEFAULT 0,
  rec_rec   REAL NOT NULL DEFAULT 0,
  rec_yds   REAL NOT NULL DEFAULT 0,
  rec_td    REAL NOT NULL DEFAULT 0,
  fumbles   REAL NOT NULL DEFAULT 0,              -- FantasyPros projects fumbles LOST (what fantasy scores)
  two_pt    REAL NOT NULL DEFAULT 0,              -- FP's lumped 2pt projection (not split by pass/rush/rec)
  fp_points REAL,                                 -- FantasyPros' own projected points — REFERENCE ONLY, never Kerf
  source_endpoint TEXT,                           -- the archived file this came from
  fetched_at    TEXT    NOT NULL,
  UNIQUE (pull_id, fp_player_id)
);
CREATE INDEX projection_source_by_player ON projection_source(cbs_player_id);

-- One row per engine execution — the stamp that makes a result traceable.
CREATE TABLE engine_run (
  engine_run_id      INTEGER PRIMARY KEY,
  created_at         TEXT    NOT NULL,
  projection_pull_id INTEGER NOT NULL REFERENCES pull(pull_id),  -- whose FP projections fed this run
  scoring_pull_id    INTEGER NOT NULL REFERENCES pull(pull_id),  -- whose parsed scoring_rule config fed this run
  rate_seasons       TEXT    NOT NULL,            -- JSON array, e.g. "[2024,2025]" — seasons the FD rates came from
  fd_method          TEXT    NOT NULL,            -- 'per_opportunity' (rec FD/reception, rush FD/carry) — the v1 method
  params_json        TEXT,                        -- tunables (tier calibration, etc.), for reproducibility
  notes              TEXT
);

-- DERIVED per-player projection. Kerf points recompute deterministically from the
-- stored components (a unit test reconstructs them), and the estimated first downs
-- are stored as distinct NAMED fields so a drill-down can show the league's edge.
CREATE TABLE projection (
  projection_id INTEGER PRIMARY KEY,
  engine_run_id INTEGER NOT NULL REFERENCES engine_run(engine_run_id),
  cbs_player_id INTEGER NOT NULL REFERENCES player(cbs_player_id),
  pos           TEXT    NOT NULL,
  kerf_points   REAL    NOT NULL,                 -- projected KERFUFFLE points (incl. estimated first downs)
  -- the ESTIMATED first-down components (D-14) — named, inspectable, the scoring edge
  est_rush_first_downs REAL NOT NULL DEFAULT 0,
  est_rec_first_downs  REAL NOT NULL DEFAULT 0,
  rush_fd_rate  REAL,                             -- the position rate applied (drill-down: FD per carry)
  rec_fd_rate   REAL,                             -- the position rate applied (drill-down: FD per reception)
  components_json TEXT  NOT NULL,                 -- {scored stat line + per-term point contribution} for drill-down
  -- derived, deterministic; ranked over the whole projection pool (superflex → QBs rise)
  kerf_ovr_rank INTEGER,
  kerf_pos_rank INTEGER,
  kerf_ovr_tier INTEGER,
  kerf_pos_tier INTEGER,
  UNIQUE (engine_run_id, cbs_player_id)
);
CREATE INDEX projection_by_player ON projection(cbs_player_id);

-- The latest engine run — the one the app reads (mirrors latest_pull).
CREATE VIEW latest_engine_run AS
  SELECT MAX(engine_run_id) AS engine_run_id FROM engine_run;
