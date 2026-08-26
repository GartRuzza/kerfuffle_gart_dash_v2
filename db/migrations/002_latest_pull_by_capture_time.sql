-- 002 — Two view corrections found in review of issue #12.
--
-- (1) `latest_pull` picked MAX(pull_id) — the last-INGESTED run, not the
--     latest-CAPTURED one. pull_id is assigned on first successful ingest, so
--     the documented "fix the parser, then re-ingest an older run" workflow
--     (npm run ingest -- --all) could give an OLD snapshot the HIGHEST id and
--     silently serve stale rosters, with the banner showing the stale date.
--     Order by captured_at (when CBS/FantasyPros were actually fetched) instead.
--
-- (2) The board view's free-agent branch filtered to positions this league
--     rosters, but the ROSTERED branch did not — so a rostered kicker would
--     reach the UI's display domain and take the whole page down. Filter both.
--
-- Views are stateless, so this is a safe drop-and-recreate: no data is touched.

DROP VIEW board;
DROP VIEW latest_pull;

CREATE VIEW latest_pull AS
  SELECT pull_id FROM pull
  WHERE status = 'ok'
  ORDER BY captured_at DESC, pull_id DESC
  LIMIT 1;

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
-- same display domain as the free-agent branch below
WHERE p.pos IN ('QB','RB','WR','TE','DST')
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
