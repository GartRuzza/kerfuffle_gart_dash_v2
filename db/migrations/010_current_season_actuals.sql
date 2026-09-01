-- 010 — Current-season actuals-to-date: the input Option B nets against (issue #30).
--
-- The ROS lens ships on Option A (D-21): full-season projection as the proxy, so the
-- ranking is right but the remaining-dollar magnitude runs high (it still counts games
-- already played). Option B nets each player down to TRUE remaining value:
--
--   ROS points = refreshed full-season projection  −  actual KERFUFFLE points to date
--
-- The actuals come from CBS's stats table (year-to-date, `ytd`), captured by the
-- archiver (issue #30, tools/archive/stats-actuals.mjs) in BOTH the standard view
-- (volume + FPTS Total) and the advanced view (rush/rec first downs). `/scoring/live`
-- — the page the issue flagged — turned out to be a JavaScript shell (unusable
-- read-only); the stats table is the parseable, auto-updating source (cbs_data_discovery §9).
--
-- This table MIRRORS player_season_stats (migration 004) — the same components, so the
-- same parsed scoring_rule recompute + CBS-FPTS cross-check the historical loader (#17)
-- runs applies unchanged — and adds `as_of_week` (how many COMPLETED weeks the ytd
-- figure includes; 0 preseason) so the actuals form a weekly accrual history, plus
-- `kerf_points`: OUR recompute of the actual through the parsed scoring config, which is
-- the value the engine subtracts (owner ruling, 2026-08-28 — recompute + cross-check,
-- keeping projection and actual on the identical scoring function). CBS's own fpts_total
-- is stored beside it as the authoritative cross-check (D-14: CBS actuals are the record).
--
-- Additive: nothing else changes. Offense only (the position filter excludes DST/K,
-- which the engine cannot score anyway). Preseason, `ytd` legitimately holds zero games
-- played, so every row reads ~0 and true-ROS ≈ full-season — the correct early-season
-- behavior until actuals accrue.

CREATE TABLE player_actuals (
  actual_id         INTEGER PRIMARY KEY,
  season            INTEGER NOT NULL,
  as_of_week        INTEGER NOT NULL,          -- completed weeks in this ytd snapshot (0 preseason)
  cbs_player_id     INTEGER NOT NULL REFERENCES player(cbs_player_id),
  cbs_name_raw      TEXT    NOT NULL,          -- verbatim "Name POS • TEAM" from the stats row
  pos               TEXT    NOT NULL,
  nfl_team          TEXT,
  bye_week          INTEGER,
  -- Passing (volume from the standard page; fd/2pt from the advanced page)
  pass_att          INTEGER NOT NULL DEFAULT 0,
  pass_cmp          INTEGER NOT NULL DEFAULT 0,
  pass_yds          INTEGER NOT NULL DEFAULT 0,
  pass_td           INTEGER NOT NULL DEFAULT 0,
  pass_int          INTEGER NOT NULL DEFAULT 0,
  pass_2pt          INTEGER NOT NULL DEFAULT 0,
  pass_first_downs  INTEGER NOT NULL DEFAULT 0,   -- not scored by KERFUFFLE; kept for completeness
  -- Rushing
  rush_att          INTEGER NOT NULL DEFAULT 0,
  rush_yds          INTEGER NOT NULL DEFAULT 0,
  rush_td           INTEGER NOT NULL DEFAULT 0,
  rush_2pt          INTEGER NOT NULL DEFAULT 0,
  rush_first_downs  INTEGER NOT NULL DEFAULT 0,
  -- Receiving
  rec_tar           INTEGER NOT NULL DEFAULT 0,
  rec_rec           INTEGER NOT NULL DEFAULT 0,
  rec_yds           INTEGER NOT NULL DEFAULT 0,
  rec_td            INTEGER NOT NULL DEFAULT 0,
  rec_2pt           INTEGER NOT NULL DEFAULT 0,
  rec_first_downs   INTEGER NOT NULL DEFAULT 0,
  -- Misc + scored totals
  fumbles_lost      INTEGER NOT NULL DEFAULT 0,
  fpts_total        REAL,                          -- CBS's KERFUFFLE-scored ytd total (authoritative)
  fpts_avg          REAL,                          -- CBS's per-game average
  kerf_points       REAL,                          -- OUR recompute through scoring_rule (the netted value)
  pull_id           INTEGER NOT NULL REFERENCES pull(pull_id),
  fetched_at        TEXT    NOT NULL,
  imported_at       TEXT    NOT NULL,
  -- One row per player per as-of-week: the latest ingested pull for a given
  -- (season, as_of_week) replaces the earlier one wholesale (ingest deletes then
  -- re-inserts by season+week), so re-ingest is idempotent and never duplicates.
  UNIQUE (season, as_of_week, cbs_player_id)
);

CREATE INDEX player_actuals_by_player ON player_actuals(cbs_player_id);
CREATE INDEX player_actuals_lookup    ON player_actuals(season, as_of_week);

-- The freshest actuals the engine nets against: the highest as-of-week of the
-- latest season present. Empty until the first in-season (or preseason zero) pull
-- lands — the engine falls back to Option A (no netting) when it is empty.
CREATE VIEW latest_player_actuals AS
  SELECT pa.*
  FROM player_actuals pa
  WHERE pa.season = (SELECT MAX(season) FROM player_actuals)
    AND pa.as_of_week = (
      SELECT MAX(as_of_week) FROM player_actuals
      WHERE season = (SELECT MAX(season) FROM player_actuals)
    );
