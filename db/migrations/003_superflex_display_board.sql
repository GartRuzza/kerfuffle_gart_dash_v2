-- 003 — The table's display board becomes SUPERFLEX (owner decision, 2026-08-26).
--
-- KERFUFFLE starts two quarterbacks. A 1-QB ("ALL") consensus board ranks QBs
-- roughly twenty spots too low for this league: the first five QBs sit at
-- overall 23/27/35/43/50 there, versus 1/2/3/4/5 on the superflex board. Showing
-- the 1-QB board next to a $500 cap would systematically undervalue the most
-- expensive position on the roster.
--
-- FantasyPros exposes superflex as position_scope 'OP' (offensive player), and
-- 'draft' + 'STD' + 'OP' is a genuinely distinct board (verified: 475 of 521
-- shared players rank differently from the PPR superflex board). So the owner's
-- preference for standard scoring AND superflex is satisfiable at once.
--
-- DST: 'OP' means *offensive* player, so team defenses are absent from it. Per
-- the owner (2026-08-26), defenses keep their POSITIONAL rank and tier (from the
-- 1-QB board, which does rank them) but get NO overall rank — mixing the two
-- boards' overall scales would float defenses into mid-pack. Blank overall rank
-- also sorts them to the bottom, which is where defenses belong here.
--
-- Every board remains ingested at full grain in market_ranking; this migration
-- only changes which one the read view displays.

DROP VIEW board;

CREATE VIEW board AS
WITH
  lp AS (SELECT pull_id FROM latest_pull),
  -- The display board: draft, standard scoring, SUPERFLEX (QB/RB/WR/TE only).
  sf AS (
    SELECT * FROM market_ranking
    WHERE pull_id = (SELECT pull_id FROM lp)
      AND ranking_type = 'draft' AND scoring_format = 'STD' AND position_scope = 'OP'
  ),
  -- Dynasty, superflex. Dynasty is scoring-agnostic (FantasyPros serves one
  -- dynasty board per position scope), so scoring_format is not filtered.
  sf_dyn AS (
    SELECT * FROM market_ranking
    WHERE pull_id = (SELECT pull_id FROM lp)
      AND ranking_type = 'dynasty' AND position_scope = 'OP'
  ),
  -- Defenses only, from the 1-QB board — positional rank and tier, never overall.
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
-- Rostered players (CBS is the identity source)
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
  sf.rank_ecr                           AS ecr,            -- NULL for DST, by design
  COALESCE(sf.pos_rank, dst.pos_rank)   AS ecr_pos_rank,
  COALESCE(sf.tier, dst.tier)           AS ecr_tier,
  sfd.rank_ecr                          AS dynasty_ecr,    -- NULL for DST, by design
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

-- Free agents at QB/RB/WR/TE: on the superflex board, on no roster
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

-- Free-agent defenses: same rule as rostered ones — positional rank, no overall.
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
