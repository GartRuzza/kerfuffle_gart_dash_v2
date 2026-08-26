-- 007 — The valuation layer: KERFUFFLE points → auction dollars (issue #20, D-13).
--
-- The second derived layer (005 was the projection layer). Turns each player's
-- projected KERFUFFLE points (from `projection`) into the three money numbers the
-- whole product is about — a league-generic ceiling, a Raccoons-specific ceiling,
-- and a market price — with Edge = the gap. Written by `npm run engine` in the
-- SAME run as the projections (it reads `projection`, so it must run after it).
--
-- Method (decision D-13):
--   * Replacement level — the "last-starter" method: baseline N per position from
--     the 12-team superflex lineup (QB24 / RB~34 / WR~34 / TE~17 / DST12), the
--     SFLEX slot counting 100% as a QB and the 24 FLEX slots split RB/WR/TE
--     40/40/20. Replacement points = the projected points of the N-th ranked
--     player at that position. Stored in `replacement_level`.
--   * Kerf Value ($) — marginal $/point VORP: discretionary = ($500 × 12) − $1 per
--     rosterable spot; $/point = discretionary ÷ Σ points-above-replacement (PAR
--     floored at 0); ceiling = $1 + PAR × $/point. Prices sum to the cap.
--   * Roster Value ($) — the same conversion but against the RACCOONS' own worst
--     eligible starter (replace-your-starter), not league replacement: worth to us
--     given who we already roster (owner, 2026-08-26).
--   * Market price — a price curve fit from real salaries (two bases: current
--     roster salaries = in-season; the 2025 KERFUFFLE salaries = pre-auction),
--     read off by the player's Kerf positional rank. Curve knots in `price_curve`.
--
-- DST is NOT priced (the projection layer can't score defenses from the offensive
-- feed — #18); its DST12 baseline is documented for completeness only. The owner's
-- editable Ceiling stays SESSION-ONLY this issue (no owner_ceiling_override table —
-- persisted ceilings are the auction-prep lens, roadmap #10).

-- Per-position replacement baseline + the projected points at that baseline.
CREATE TABLE replacement_level (
  replacement_level_id INTEGER PRIMARY KEY,
  engine_run_id      INTEGER NOT NULL REFERENCES engine_run(engine_run_id),
  pos                TEXT    NOT NULL,
  baseline_n         INTEGER NOT NULL,            -- the "last starter" rank (QB24, RB34, ...)
  replacement_points REAL,                        -- projected points of the N-th ranked player (NULL if fewer than N)
  method             TEXT    NOT NULL,            -- 'last_starter'
  UNIQUE (engine_run_id, pos)
);

-- The market price curve knots — one row per (basis, position, positional rank):
-- "what the Nth-best player at this position costs", fit from real salaries. Kept
-- so the curve BASIS is inspectable (product_vision principle 3, user_flows flow 1).
CREATE TABLE price_curve (
  price_curve_id INTEGER PRIMARY KEY,
  engine_run_id  INTEGER NOT NULL REFERENCES engine_run(engine_run_id),
  basis          TEXT    NOT NULL,                -- 'in_season' (current salaries) | 'pre_auction' (2025 salaries)
  pos            TEXT    NOT NULL,
  pos_rank       INTEGER NOT NULL,                -- 1 = most expensive at the position
  price          REAL    NOT NULL,                -- the salary at that rank (the curve knot)
  UNIQUE (engine_run_id, basis, pos, pos_rank)
);

-- DERIVED per-player valuation. One row per priced player per engine_run.
CREATE TABLE valuation (
  valuation_id   INTEGER PRIMARY KEY,
  engine_run_id  INTEGER NOT NULL REFERENCES engine_run(engine_run_id),
  cbs_player_id  INTEGER NOT NULL REFERENCES player(cbs_player_id),
  pos            TEXT    NOT NULL,
  kerf_points    REAL    NOT NULL,
  -- league-generic ceiling
  replacement_points REAL,                        -- league replacement at this position
  par_league     REAL    NOT NULL DEFAULT 0,      -- points above league replacement, floored at 0
  kerf_value     REAL,                            -- $ ceiling = 1 + par_league × $/point
  -- Raccoons-specific ceiling (replace-your-starter)
  roster_repl_points REAL,                        -- the Raccoons' worst eligible starter's points (NULL if unknown)
  par_roster     REAL,                            -- points above that, floored at 0 (NULL if no roster)
  roster_value   REAL,                            -- $ = 1 + par_roster × $/point (NULL if no roster)
  -- market price (two bases; NULL when that basis has no salary data)
  market_in_season   REAL,
  market_pre_auction REAL,
  pos_rank_used  INTEGER,                          -- the Kerf positional rank used to read the price curve
  components_json TEXT,                            -- {dollarsPerPoint, discretionary, budget, ...} for drill-down
  UNIQUE (engine_run_id, cbs_player_id)
);
CREATE INDEX valuation_by_player ON valuation(cbs_player_id);
