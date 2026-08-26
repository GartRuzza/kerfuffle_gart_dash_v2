-- 001 — The normalized storage layer (issue #12, decision D-10).
--
-- Grain and lineage rules (docs/data_model.md):
--   * Every normalized row carries `fetched_at` and a `pull_id` -> the raw
--     snapshot it came from (data/raw/{run_id}/).
--   * `contract` is a SNAPSHOT table (observed_at, never overwritten in place):
--     one observation row per roster row per pull. History accrues per pull.
--   * `market_ranking` is never flattened onto `player`; its grain is
--     player x ranking type x scoring format x position scope x pull.
--   * Dead-cap / Practice-Squad modelling per owner decision 2026-08-25 (D-11):
--     Practice Squad is a `roster_status` value on an ordinary player row;
--     dead cap is a team-level `contract` row with row_type='dead_cap' and
--     NO player id (the amount matters, not the player it once was).
--
-- The derived layer (engine_run, projection, valuation, ...) deliberately does
-- NOT exist yet — it lands with the engine issue.

-- One row per ingestion of one raw archive run.
CREATE TABLE pull (
  pull_id       INTEGER PRIMARY KEY,
  run_id        TEXT    NOT NULL UNIQUE,        -- data/raw folder name, e.g. 2026-08-25T23-50-56Z
  raw_path      TEXT    NOT NULL,               -- relative path to the raw snapshot folder
  captured_at   TEXT    NOT NULL,               -- when the raw data was FETCHED (manifest started_at)
  ingested_at   TEXT    NOT NULL,               -- when this ingest ran
  status        TEXT    NOT NULL DEFAULT 'ok' CHECK (status IN ('ok')),
  source_summary TEXT                           -- JSON: per-source ok/failed counts from the manifest
);

-- The league's 12 teams (from the standings page: name + division).
CREATE TABLE fantasy_team (
  team_id    INTEGER PRIMARY KEY,               -- CBS team id (1..12), stable
  name       TEXT    NOT NULL,
  division   TEXT,
  pull_id    INTEGER NOT NULL REFERENCES pull(pull_id),  -- last pull that observed it
  fetched_at TEXT    NOT NULL
);

-- Player identity — the shared join key CBS and FantasyPros both publish.
-- Upserted from both sources; CBS is authoritative for name/team when both have one.
CREATE TABLE player (
  cbs_player_id INTEGER PRIMARY KEY,
  name          TEXT    NOT NULL,
  pos           TEXT    NOT NULL CHECK (pos IN ('QB','RB','WR','TE','K','DST')),
  nfl_team      TEXT,
  bye_week      INTEGER,
  fp_player_id  INTEGER,                        -- FantasyPros' own id, when known
  pull_id       INTEGER NOT NULL REFERENCES pull(pull_id),  -- last pull that observed it
  fetched_at    TEXT    NOT NULL
);

-- Roster/contract observation SNAPSHOT: one row per roster row per pull.
-- Never updated in place — re-ingesting a pull replaces exactly that pull's rows.
CREATE TABLE contract (
  contract_id    INTEGER PRIMARY KEY,
  pull_id        INTEGER NOT NULL REFERENCES pull(pull_id),
  observed_at    TEXT    NOT NULL,              -- fetch time of the roster page
  team_id        INTEGER NOT NULL REFERENCES fantasy_team(team_id),
  row_type       TEXT    NOT NULL CHECK (row_type IN ('player','dead_cap')),
  cbs_player_id  INTEGER REFERENCES player(cbs_player_id),
  label          TEXT,                          -- dead_cap rows: the text CBS shows for the row
  roster_status  TEXT    NOT NULL CHECK (roster_status IN ('Active','Reserves','Injured','Practice')),
  roster_slot    TEXT,                          -- lineup slot as shown (QB, FLEX, RB-WR-TE, DST...) — NOT the position
  salary         INTEGER,                       -- whole dollars; NULL = blank on the page (observed on real rosters)
  contract_years INTEGER CHECK (contract_years IS NULL OR contract_years BETWEEN 1 AND 4),
  proj_points    REAL,                          -- CBS's displayed KERFUFFLE-scored season projection (source data, not engine output)
  fetched_at     TEXT    NOT NULL,
  -- a player row must have a player id; a dead_cap row must not
  CHECK ((row_type = 'player') = (cbs_player_id IS NOT NULL))
);
-- A player is rostered by EXACTLY ONE team at a time, so one contract row per
-- player per pull — deliberately NOT keyed on team_id: that would let a player
-- appear on two rosters in one pull (a mid-trade CBS state or a parser bug) and
-- surface as a duplicate row in the table. Here it is a loud failure instead.
CREATE UNIQUE INDEX contract_one_player_per_pull
  ON contract(pull_id, cbs_player_id) WHERE cbs_player_id IS NOT NULL;
CREATE INDEX contract_by_pull ON contract(pull_id);

-- The CBS transaction log. CBS shows Date / Team / Players / Effective — no type
-- column and no FAB bid column (issue #11), so the row text is kept VERBATIM and
-- the type is a best-effort inference. Upserted on a content-derived natural key:
-- the same event observed by later pulls updates, never duplicates.
CREATE TABLE league_transaction (              -- "transaction" is a SQL keyword
  transaction_id INTEGER PRIMARY KEY,
  tx_date        TEXT    NOT NULL,              -- as shown by CBS, normalized to ISO where possible
  team_id        INTEGER REFERENCES fantasy_team(team_id),
  team_label     TEXT,                          -- the team cell verbatim
  players_text   TEXT    NOT NULL,              -- the players/moves cell verbatim
  effective      TEXT,                          -- the Effective (week) cell verbatim
  inferred_type  TEXT,                          -- best-effort: signed/dropped/traded/lineup/...
  natural_key    TEXT    NOT NULL UNIQUE,       -- hash of (date|team|players|effective)
  first_pull_id  INTEGER NOT NULL REFERENCES pull(pull_id),
  last_pull_id   INTEGER NOT NULL REFERENCES pull(pull_id),
  fetched_at     TEXT    NOT NULL
);

-- FantasyPros expert-consensus rankings SNAPSHOT: one row per player per board per pull.
-- ranking_type/scoring_format come from the PAYLOAD's own declaration (the dynasty
-- board is scoring-agnostic and declares itself PPR whatever was requested).
CREATE TABLE market_ranking (
  ranking_id     INTEGER PRIMARY KEY,
  pull_id        INTEGER NOT NULL REFERENCES pull(pull_id),
  fp_player_id   INTEGER NOT NULL,
  cbs_player_id  INTEGER,                       -- the CBS join key; NULL when FP doesn't publish one
  player_name    TEXT    NOT NULL,
  player_pos     TEXT    NOT NULL,
  player_team    TEXT,
  bye_week       INTEGER,
  ranking_type   TEXT    NOT NULL CHECK (ranking_type IN ('draft','dynasty','ros','weekly')),
  scoring_format TEXT    NOT NULL CHECK (scoring_format IN ('STD','HALF','PPR')),
  position_scope TEXT    NOT NULL,              -- ALL / QB / RB / OP / ...
  week           TEXT,                          -- weekly boards only
  rank_ecr       INTEGER NOT NULL,
  pos_rank       TEXT,                          -- e.g. 'WR12'
  tier           INTEGER,
  rank_min       REAL,
  rank_max       REAL,
  rank_ave       REAL,
  rank_std       REAL,
  total_experts  INTEGER,
  source_endpoint TEXT,                         -- which archived file this board came from
  fetched_at     TEXT    NOT NULL
);
CREATE UNIQUE INDEX market_ranking_grain
  ON market_ranking(pull_id, ranking_type, scoring_format, position_scope, COALESCE(week,''), fp_player_id);
CREATE INDEX market_ranking_by_player ON market_ranking(cbs_player_id);

-- The KERFUFFLE scoring config, parsed from CBS /rules each pull — never hardcoded.
-- Its one downstream job: translating FantasyPros raw stat-line projections into
-- KERFUFFLE points (engine issue). CBS actuals are authoritative — never re-scored.
CREATE TABLE scoring_rule (
  scoring_rule_id INTEGER PRIMARY KEY,
  pull_id         INTEGER NOT NULL REFERENCES pull(pull_id),
  category        TEXT    NOT NULL,             -- scoring table the rule came from
  name            TEXT    NOT NULL,
  value_type      TEXT    NOT NULL CHECK (value_type IN ('flat','per_unit','tiered')),
  value_json      TEXT    NOT NULL,             -- the parsed structured value
  fetched_at      TEXT    NOT NULL,
  UNIQUE (pull_id, category, name)
);

-- ---------------------------------------------------------------------------
-- The flat "board" read view: the one shape the UI consumes (via the
-- data-access module). Rostered players from the latest pull's contract
-- snapshot, plus free agents derived from the latest draft-STD FantasyPros
-- board (owner decision 2026-08-25): a ranked player on no roster is a free
-- agent. Engine outputs (kerf values/tiers, ceilings, edge) do NOT exist yet
-- and are NOT columns here — they land with the engine issue.
-- ---------------------------------------------------------------------------
CREATE VIEW latest_pull AS
  SELECT MAX(pull_id) AS pull_id FROM pull WHERE status = 'ok';

CREATE VIEW board AS
WITH
  lp AS (SELECT pull_id FROM latest_pull),
  draft_rank AS (       -- the display board: draft, STD scoring, ALL positions
    SELECT * FROM market_ranking
    WHERE pull_id = (SELECT pull_id FROM lp)
      AND ranking_type = 'draft' AND scoring_format = 'STD' AND position_scope = 'ALL'
  ),
  dynasty_rank AS (     -- dynasty is one scoring-agnostic board; take ALL positions
    SELECT * FROM market_ranking
    WHERE pull_id = (SELECT pull_id FROM lp)
      AND ranking_type = 'dynasty' AND position_scope = 'ALL'
  ),
  rostered AS (
    SELECT c.cbs_player_id, c.team_id, c.roster_status, c.roster_slot,
           c.salary, c.contract_years, c.proj_points, c.observed_at
    FROM contract c
    WHERE c.pull_id = (SELECT pull_id FROM lp) AND c.row_type = 'player'
  )
-- Rostered players (CBS is the identity source)
SELECT
  p.cbs_player_id                 AS cbs_player_id,
  p.name                          AS name,
  p.pos                           AS pos,
  p.nfl_team                      AS nfl_team,
  t.name                          AS owner,
  r.roster_status                 AS roster_status,
  r.salary                        AS salary,
  r.contract_years                AS contract_years,
  r.proj_points                   AS proj_points,
  dr.rank_ecr                     AS ecr,
  dr.pos_rank                     AS ecr_pos_rank,
  dr.tier                         AS ecr_tier,
  dy.rank_ecr                     AS dynasty_ecr,
  dy.pos_rank                     AS dynasty_pos_rank,
  dy.tier                         AS dynasty_tier,
  r.observed_at                   AS observed_at
FROM rostered r
JOIN player p        ON p.cbs_player_id = r.cbs_player_id
JOIN fantasy_team t  ON t.team_id = r.team_id
LEFT JOIN draft_rank dr   ON dr.cbs_player_id = p.cbs_player_id
LEFT JOIN dynasty_rank dy ON dy.cbs_player_id = p.cbs_player_id
UNION ALL
-- Free agents: ranked on the draft board, on no roster, joinable to CBS
SELECT
  dr.cbs_player_id, dr.player_name, dr.player_pos, dr.player_team,
  'FA'            AS owner,
  NULL            AS roster_status,
  NULL            AS salary,
  NULL            AS contract_years,
  NULL            AS proj_points,
  dr.rank_ecr, dr.pos_rank, dr.tier,
  dy.rank_ecr, dy.pos_rank, dy.tier,
  dr.fetched_at   AS observed_at
FROM draft_rank dr
LEFT JOIN dynasty_rank dy ON dy.cbs_player_id = dr.cbs_player_id
WHERE dr.cbs_player_id IS NOT NULL
  AND dr.cbs_player_id NOT IN (SELECT cbs_player_id FROM rostered)
  -- only positions this league rosters (it has no K slot; DST it does)
  AND dr.player_pos IN ('QB','RB','WR','TE','DST');
