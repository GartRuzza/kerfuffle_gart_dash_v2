-- 004 — The historical data layer (issue #17, decisions D-14, D-15).
--
-- Owner-provided manual CSV exports, ingested from data/historical/ on a path
-- SEPARATE from the automated archiver (npm run ingest:historical). These are
-- name-keyed CSVs, not fetched HTML, so they do not belong to a `pull` and carry
-- a free-text `source` tag (filename + import time) instead of pull lineage.
--
-- Grain and sourcing rules (docs/data_model.md):
--   * player_season_stats — season x player. First downs + 2pt (from the CBS
--     "Advanced Categories" export) joined with volume (from the "Standard
--     Categories" export). Source of the projection's first-down RATES and the
--     backtest's ACTUAL KERFUFFLE points. Only players in our `player` universe
--     are stored (owner decision 2026-08-26); the raw CBS name string is kept.
--   * contract_history — season x player. Only the 2025 salary is authoritative
--     (owner decision 2026-08-26 — the '24 and future-year columns are unreliable);
--     the full multi-year schedule is kept verbatim in schedule_raw for provenance
--     ONLY and is read by nothing. Feeds the pre-auction price curve.
--   * auction_result — league x season x player. TRUFFLE 2026 loads here with
--     is_reference=1 and is READ BY NO CONSUMER (D-15 — non-goal qualified).
--
-- Name matching (CBS stat + KERFUFFLE contract files are name-keyed): rows are
-- matched to cbs_player_id against the `player` universe and unmatched rows are
-- REPORTED loudly, never dropped. The TRUFFLE file already carries the CBS id.

-- Full season stat line per player. Offense only (the CBS export has no DST/K
-- rows). Passing first downs are stored for completeness but are NOT scored by
-- KERFUFFLE (only rushing/receiving first downs are) — see scoring_rule.
CREATE TABLE player_season_stats (
  stat_id           INTEGER PRIMARY KEY,
  season            INTEGER NOT NULL,
  cbs_player_id     INTEGER NOT NULL REFERENCES player(cbs_player_id),
  cbs_name_raw      TEXT    NOT NULL,          -- the verbatim "Name POS | TEAM" string from CBS
  pos               TEXT    NOT NULL,
  nfl_team          TEXT,
  bye_week          INTEGER,
  -- Passing (volume from the standard file; fd/2pt from the advanced file)
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
  fpts_total        REAL,                          -- CBS's KERFUFFLE-scored season total (authoritative actual)
  fpts_avg          REAL,                          -- CBS's per-game average
  source            TEXT    NOT NULL,              -- e.g. "2025 CBS advanced+standard, imported 2026-08-26"
  imported_at       TEXT    NOT NULL,
  UNIQUE (season, cbs_player_id)
);
CREATE INDEX player_season_stats_by_player ON player_season_stats(cbs_player_id);

-- KERFUFFLE contract sheet, per season. Only the 2025 salary is authoritative
-- (owner, 2026-08-26). cbs_player_id is NULLABLE: an unmatched contract row is
-- kept with its raw name and a null id, and reported — never dropped.
CREATE TABLE contract_history (
  contract_history_id INTEGER PRIMARY KEY,
  season            INTEGER NOT NULL,
  cbs_player_id     INTEGER REFERENCES player(cbs_player_id),  -- NULL when unmatched
  cbs_name_raw      TEXT    NOT NULL,              -- the "Player" cell verbatim
  pos               TEXT,
  trf_team          TEXT,                          -- KERFUFFLE team abbrev (the sheet's "TRF" column)
  nfl_team          TEXT,
  age               INTEGER,
  salary            INTEGER,                       -- the authoritative 2025 salary (whole $); NULL if the cell was FT/FA/blank
  contract_years    INTEGER,                       -- the sheet's "Yr" column
  is_franchise_tag  INTEGER NOT NULL DEFAULT 0,    -- the 2025 cell read 'FT'
  is_free_agent     INTEGER NOT NULL DEFAULT 0,    -- the 2025 cell read 'FA'
  schedule_raw      TEXT,                          -- JSON of the full '24..'28 row — PROVENANCE ONLY, read by nothing
  source            TEXT    NOT NULL,
  imported_at       TEXT    NOT NULL,
  UNIQUE (season, cbs_name_raw)
);
CREATE INDEX contract_history_by_player ON contract_history(cbs_player_id);

-- Completed-auction rows with full bid histories. Carries a `league` and an
-- `is_reference` flag. The TRUFFLE 2026 file loads here as inert reference data
-- (is_reference=1) and is read by NO consumer — enforced by a test (D-15).
CREATE TABLE auction_result (
  auction_result_id INTEGER PRIMARY KEY,
  league            TEXT    NOT NULL,              -- e.g. 'TRUFFLE'
  season            INTEGER NOT NULL,
  cbs_player_id     INTEGER REFERENCES player(cbs_player_id),  -- from the file's PlayerID (direct join); NULL if unknown to our universe
  player_name       TEXT    NOT NULL,
  pos               TEXT,
  nfl_team          TEXT,
  winning_team      TEXT,                          -- the TRUFFLE team that won the player
  final_salary      INTEGER,
  nomination_order  INTEGER,
  bid_history_json  TEXT,                          -- the BidHistory cell kept VERBATIM
  is_reference      INTEGER NOT NULL DEFAULT 1,    -- 1 = inert reference, read by no consumer (D-15)
  source            TEXT    NOT NULL,
  imported_at       TEXT    NOT NULL,
  UNIQUE (league, season, player_name)
);
CREATE INDEX auction_result_by_player ON auction_result(cbs_player_id);
