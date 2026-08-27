-- 009 — The rest-of-season (ROS) lens: horizon-label engine runs, and read the
-- ROS consensus as the in-season market column (issue #28, Option A).
--
-- Option A (owner, 2026-08-27): the in-season ROS ranking is the EXISTING engine
-- re-run on FantasyPros' refreshed full-season projection each week. So there is
-- no new math here — only labeling and surfacing:
--
--   1. engine_run.horizon — tags each run 'ros' (this issue) vs 'weekly' (#29), so
--      the app can tell the lenses apart. Existing runs default to 'ros' (in-season
--      the full-season re-score IS the ROS lens). `latest_engine_run` is re-scoped
--      to the latest ROS run (so the app's default stays ROS even once #29 adds
--      weekly runs), and a by-horizon view is added for #29 to read weekly from.
--
--   2. board view — the market ECR columns now prefer the ROS/STD/OP board when it
--      exists, falling back to the draft board preseason (COALESCE(ros, draft)).
--      This is the "market comparison = ROS ECR in-season" requirement, done in SQL
--      so no column changes meaning twice. DST is unaffected (ROS is OP = offense
--      only). The draft board stays ingested at full grain (a future Preseason
--      horizon can surface it); the FA universe still derives from the draft board
--      so preseason display is unchanged.
--
-- Additive and backward-compatible: preseason (no ROS board, no horizon variety)
-- behaves exactly as before.

-- 1. Horizon on engine runs.
ALTER TABLE engine_run ADD COLUMN horizon TEXT NOT NULL DEFAULT 'ros'; -- 'ros' | 'weekly'

DROP VIEW latest_engine_run;
-- The app's default lens is ROS: the latest run tagged 'ros'.
CREATE VIEW latest_engine_run AS
  SELECT MAX(engine_run_id) AS engine_run_id FROM engine_run WHERE horizon = 'ros';

-- The latest run per horizon — #29's weekly lens reads its row from here.
CREATE VIEW latest_engine_run_by_horizon AS
  SELECT horizon, MAX(engine_run_id) AS engine_run_id FROM engine_run GROUP BY horizon;

-- 2. Recreate the board view with ROS-preferring market columns.
DROP VIEW board;

CREATE VIEW board AS
WITH
  lp AS (SELECT pull_id FROM latest_pull),
  -- Draft, standard scoring, SUPERFLEX (the preseason display board + FA universe).
  sf AS (
    SELECT * FROM market_ranking
    WHERE pull_id = (SELECT pull_id FROM lp)
      AND ranking_type = 'draft' AND scoring_format = 'STD' AND position_scope = 'OP'
  ),
  -- Rest-of-season, standard scoring, SUPERFLEX — the in-season market board (#27/#28).
  -- Absent preseason (the ROS request falls back to draft and ingest skips it), so
  -- the COALESCEs below fall through to the draft board until the season differentiates.
  ros AS (
    SELECT * FROM market_ranking
    WHERE pull_id = (SELECT pull_id FROM lp)
      AND ranking_type = 'ros' AND scoring_format = 'STD' AND position_scope = 'OP'
  ),
  sf_dyn AS (
    SELECT * FROM market_ranking
    WHERE pull_id = (SELECT pull_id FROM lp)
      AND ranking_type = 'dynasty' AND position_scope = 'OP'
  ),
  dst AS (
    SELECT * FROM market_ranking
    WHERE pull_id = (SELECT pull_id FROM lp)
      AND ranking_type = 'draft' AND scoring_format = 'STD' AND position_scope = 'ALL'
      AND player_pos = 'DST'
  ),
  dst_dyn AS (
    SELECT * FROM market_ranking
    WHERE pull_id = (SELECT pull_id FROM lp)
      AND ranking_type = 'dynasty' AND position_scope = 'ALL'
      AND player_pos = 'DST'
  ),
  rostered AS (
    SELECT c.cbs_player_id, c.team_id, c.roster_status, c.roster_slot,
           c.salary, c.contract_years, c.proj_points, c.observed_at
    FROM contract c
    WHERE c.pull_id = (SELECT pull_id FROM lp) AND c.row_type = 'player'
  )
-- Rostered players (CBS is the identity source). Market ECR prefers ROS, then draft.
SELECT
  p.cbs_player_id                                    AS cbs_player_id,
  p.name                                             AS name,
  p.pos                                              AS pos,
  p.nfl_team                                         AS nfl_team,
  t.name                                             AS owner,
  r.roster_status                                    AS roster_status,
  r.salary                                           AS salary,
  r.contract_years                                   AS contract_years,
  r.proj_points                                      AS proj_points,
  COALESCE(ros.rank_ecr, sf.rank_ecr)                AS ecr,            -- NULL for DST, by design
  COALESCE(ros.pos_rank, sf.pos_rank, dst.pos_rank)  AS ecr_pos_rank,
  COALESCE(ros.tier, sf.tier, dst.tier)              AS ecr_tier,
  sfd.rank_ecr                                       AS dynasty_ecr,    -- NULL for DST, by design
  COALESCE(sfd.pos_rank, dstd.pos_rank)              AS dynasty_pos_rank,
  COALESCE(sfd.tier, dstd.tier)                      AS dynasty_tier,
  r.observed_at                                      AS observed_at
FROM rostered r
JOIN player p       ON p.cbs_player_id = r.cbs_player_id
JOIN fantasy_team t ON t.team_id = r.team_id
LEFT JOIN sf      sf   ON sf.cbs_player_id   = p.cbs_player_id
LEFT JOIN ros     ros  ON ros.cbs_player_id  = p.cbs_player_id
LEFT JOIN sf_dyn  sfd  ON sfd.cbs_player_id  = p.cbs_player_id
LEFT JOIN dst     dst  ON dst.cbs_player_id  = p.cbs_player_id
LEFT JOIN dst_dyn dstd ON dstd.cbs_player_id = p.cbs_player_id
WHERE p.pos IN ('QB','RB','WR','TE','DST')

UNION ALL

-- Free agents at QB/RB/WR/TE: the FA universe is the draft superflex board (broad,
-- present preseason); the ROS board is preferred for the ECR value where it ranks them.
SELECT
  sf.cbs_player_id, sf.player_name, sf.player_pos, sf.player_team,
  'FA'          AS owner,
  NULL          AS roster_status,
  NULL          AS salary,
  NULL          AS contract_years,
  NULL          AS proj_points,
  COALESCE(ros.rank_ecr, sf.rank_ecr),
  COALESCE(ros.pos_rank, sf.pos_rank),
  COALESCE(ros.tier, sf.tier),
  sfd.rank_ecr, sfd.pos_rank, sfd.tier,
  sf.fetched_at AS observed_at
FROM sf
LEFT JOIN ros    ros ON ros.cbs_player_id = sf.cbs_player_id
LEFT JOIN sf_dyn sfd ON sfd.cbs_player_id = sf.cbs_player_id
WHERE sf.cbs_player_id IS NOT NULL
  AND sf.cbs_player_id NOT IN (SELECT cbs_player_id FROM rostered)
  AND sf.player_pos IN ('QB','RB','WR','TE')

UNION ALL

-- Free-agent defenses: unchanged — ROS is offense-only (OP), so DST keeps the 1-QB
-- board's positional rank and tier, and no overall rank.
SELECT
  dst.cbs_player_id, dst.player_name, dst.player_pos, dst.player_team,
  'FA'           AS owner,
  NULL           AS roster_status,
  NULL           AS salary,
  NULL           AS contract_years,
  NULL           AS proj_points,
  NULL           AS ecr,
  dst.pos_rank, dst.tier,
  NULL           AS dynasty_ecr,
  dstd.pos_rank, dstd.tier,
  dst.fetched_at AS observed_at
FROM dst
LEFT JOIN dst_dyn dstd ON dstd.cbs_player_id = dst.cbs_player_id
WHERE dst.cbs_player_id IS NOT NULL
  AND dst.cbs_player_id NOT IN (SELECT cbs_player_id FROM rostered);
