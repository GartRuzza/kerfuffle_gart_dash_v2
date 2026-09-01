-- 011 — Option B: net current-season actuals out of the ROS projection (issue #30).
--
-- Option A (#28, D-21) scored the refreshed FULL-SEASON projection as the ROS proxy:
-- the ranking was right but the remaining-dollar magnitude ran high, because it still
-- counted games already played. Option B nets each player down to TRUE remaining value:
--
--   remaining points = refreshed full-season projection  −  actuals-to-date (floored at 0)
--
-- The owner chose "net everything" (2026-08-28): the WHOLE ROS lens becomes remaining
-- value — ranks, tiers, PAR, and all three dollar columns flow from the remaining
-- points, not just the dollars. So `projection.kerf_points` for a ROS run now holds the
-- REMAINING points (preseason, actuals are 0, so remaining == full-season and nothing
-- changes — backward compatible). The actuals come from player_actuals (migration 010),
-- recomputed through the parsed scoring config and cross-checked against CBS (owner
-- ruling, #30); the engine reads the freshest week via the latest_player_actuals view.
--
-- These additive columns keep the netting DRILLABLE (the issue's acceptance criterion:
-- season projection → minus actuals → remaining points → PAR → dollars). They are NULL
-- for runs that don't net (weekly #29; and any historical run before this migration).

ALTER TABLE projection ADD COLUMN season_points     REAL;     -- full-season projection, pre-net (NULL if not netted)
ALTER TABLE projection ADD COLUMN actuals_points    REAL;     -- KERFUFFLE points scored to date, subtracted (NULL if not netted)
ALTER TABLE projection ADD COLUMN actuals_as_of_week INTEGER; -- completed weeks the actuals cover (NULL if not netted)
