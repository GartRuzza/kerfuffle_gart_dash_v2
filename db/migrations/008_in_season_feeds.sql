-- 008 — In-season feeds: weekly start/sit signals + per-week projections (issue #27).
--
-- Two additive, backward-compatible changes so the store can hold the in-season
-- FantasyPros feeds the ROS (#28) and weekly/start-sit (#29) lenses will read.
-- Nothing here changes the preseason display board or any existing row's meaning;
-- the store is rebuildable from data/raw/ if anything looks off.
--
--   1. market_ranking gains four NULLABLE columns for the weekly consensus board's
--      matchup + expert start/sit signals (player_opponent / note / tag /
--      recommendation). They are absent on draft/dynasty/ros boards and simply
--      stay NULL there — this is the data #29's start/sit lens surfaces.
--
--   2. projection_source's uniqueness widens from (pull_id, fp_player_id) to
--      (pull_id, fp_player_id, week) so one pull can hold BOTH the full-season
--      projection (week 0, read by the ROS lens) AND the current week's projection
--      (week N, read by the weekly lens) for the same player without colliding.
--      SQLite can't alter a table-level UNIQUE in place, so this rebuilds the
--      table (create → copy → drop → rename). No other table references
--      projection_source, so the rebuild is safe under foreign_keys=ON.

-- 1. Weekly consensus extras (nullable; only the weekly board populates them).
ALTER TABLE market_ranking ADD COLUMN player_opponent TEXT;   -- e.g. "@KC", "vs BUF"
ALTER TABLE market_ranking ADD COLUMN note           TEXT;    -- expert note (free text)
ALTER TABLE market_ranking ADD COLUMN tag            TEXT;    -- expert tag, if any
ALTER TABLE market_ranking ADD COLUMN recommendation TEXT;    -- expert start/sit lean

-- 2. Rebuild projection_source with a week-aware unique key.
CREATE TABLE projection_source_new (
  projection_source_id INTEGER PRIMARY KEY,
  pull_id       INTEGER NOT NULL REFERENCES pull(pull_id),
  cbs_player_id INTEGER REFERENCES player(cbs_player_id),
  fp_player_id  INTEGER NOT NULL,
  player_name   TEXT    NOT NULL,
  pos           TEXT    NOT NULL,
  nfl_team      TEXT,
  season        INTEGER NOT NULL,
  week          INTEGER NOT NULL,                 -- 0 = full-season; N = week N
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
  fumbles   REAL NOT NULL DEFAULT 0,
  two_pt    REAL NOT NULL DEFAULT 0,
  fp_points REAL,
  source_endpoint TEXT,
  fetched_at    TEXT    NOT NULL,
  UNIQUE (pull_id, fp_player_id, week)
);
INSERT INTO projection_source_new SELECT * FROM projection_source;
DROP TABLE projection_source;
ALTER TABLE projection_source_new RENAME TO projection_source;
CREATE INDEX projection_source_by_player ON projection_source(cbs_player_id);
