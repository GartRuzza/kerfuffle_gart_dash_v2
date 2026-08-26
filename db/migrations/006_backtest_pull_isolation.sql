-- 006 — Isolate BACKTEST pulls from the live board (issue #19, the decision gate).
--
-- The backtest (#19) needs each PAST season's preseason FantasyPros data — 2024
-- and 2025 boards + projections — loaded alongside the current-season data so the
-- projection core can be re-run on history. Problem: that historical data is
-- CAPTURED today, so its `pull.captured_at` is the newest of all. `latest_pull`
-- orders by captured_at, so a naive load would make a 2025 preseason board render
-- as the CURRENT board in the app and feed the live engine — a silent regression,
-- with the banner still showing today's date. (See tools/backtest/.)
--
-- The fix is one additive, default-preserving marker:
--   * pull.kind    — 'current' (default; every existing row + every live archive
--                    run) vs 'backtest' (the historical seasons the backtest loads).
--   * pull.season  — the season a BACKTEST pull's data belongs to (2024/2025);
--                    NULL for current pulls (their season is implicit/now).
-- and re-scoping `latest_pull` to consider ONLY current pulls. Every live consumer
-- (the app's board view, `npm run engine`) reads through latest_pull, so this one
-- WHERE clause makes the backtest data invisible to them while it lives in the
-- same market_ranking / projection_source tables (full lineage, parser reuse).
--
-- Backtest rows still carry status='ok' (they loaded fine); `kind` is the axis
-- that separates them, not `status`. Nothing about current-season behavior changes:
-- kind defaults to 'current', so latest_pull resolves exactly as it did before.

ALTER TABLE pull ADD COLUMN kind   TEXT NOT NULL DEFAULT 'current'; -- 'current' | 'backtest'
ALTER TABLE pull ADD COLUMN season INTEGER;                         -- set for backtest pulls only

-- Re-scope latest_pull to current pulls only. Recreate `board` too (it embeds a
-- reference to latest_pull): dropping in dependency order and recreating `board`
-- verbatim from migration 003 keeps the live view byte-for-byte identical — the
-- only behavioral change is that latest_pull can never resolve to a backtest pull.
DROP VIEW board;
DROP VIEW latest_pull;

CREATE VIEW latest_pull AS
  SELECT pull_id FROM pull
  WHERE status = 'ok' AND kind = 'current'
  ORDER BY captured_at DESC, pull_id DESC
  LIMIT 1;

-- board — recreated verbatim from migration 003 (the superflex display board).
CREATE VIEW board AS
WITH
  lp AS (SELECT pull_id FROM latest_pull),
  sf AS (
    SELECT * FROM market_ranking
    WHERE pull_id = (SELECT pull_id FROM lp)
      AND ranking_type = 'draft' AND scoring_format = 'STD' AND position_scope = 'OP'
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
SELECT
  p.cbs_player_id                       AS cbs_player_id,
  p.name                                AS name,
  p.pos                                 AS pos,
  p.nfl_team                            AS nfl_team,
  t.name                                AS owner,
  r.roster_status                       AS roster_status,
  r.salary                              AS salary,
  r.contract_years                      AS contract_years,
  r.proj_points                         AS proj_points,
  sf.rank_ecr                           AS ecr,
  COALESCE(sf.pos_rank, dst.pos_rank)   AS ecr_pos_rank,
  COALESCE(sf.tier, dst.tier)           AS ecr_tier,
  sfd.rank_ecr                          AS dynasty_ecr,
  COALESCE(sfd.pos_rank, dstd.pos_rank) AS dynasty_pos_rank,
  COALESCE(sfd.tier, dstd.tier)         AS dynasty_tier,
  r.observed_at                         AS observed_at
FROM rostered r
JOIN player p       ON p.cbs_player_id = r.cbs_player_id
JOIN fantasy_team t ON t.team_id = r.team_id
LEFT JOIN sf      sf   ON sf.cbs_player_id   = p.cbs_player_id
LEFT JOIN sf_dyn  sfd  ON sfd.cbs_player_id  = p.cbs_player_id
LEFT JOIN dst     dst  ON dst.cbs_player_id  = p.cbs_player_id
LEFT JOIN dst_dyn dstd ON dstd.cbs_player_id = p.cbs_player_id
WHERE p.pos IN ('QB','RB','WR','TE','DST')

UNION ALL

SELECT
  sf.cbs_player_id, sf.player_name, sf.player_pos, sf.player_team,
  'FA'          AS owner,
  NULL          AS roster_status,
  NULL          AS salary,
  NULL          AS contract_years,
  NULL          AS proj_points,
  sf.rank_ecr, sf.pos_rank, sf.tier,
  sfd.rank_ecr, sfd.pos_rank, sfd.tier,
  sf.fetched_at AS observed_at
FROM sf
LEFT JOIN sf_dyn sfd ON sfd.cbs_player_id = sf.cbs_player_id
WHERE sf.cbs_player_id IS NOT NULL
  AND sf.cbs_player_id NOT IN (SELECT cbs_player_id FROM rostered)
  AND sf.player_pos IN ('QB','RB','WR','TE')

UNION ALL

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
