// KERFUFFLE valuation — the PURE core (issue #20, decision D-13).
//
// No database, no filesystem: deterministic transforms, unit-tested in isolation.
// The DB orchestration (reading `projection`, salaries, the Raccoons roster;
// writing `valuation`/`replacement_level`/`price_curve`) lives in run.mjs.
//
// The pipeline this module implements, on top of #18's Kerf points:
//   1. replacementBaselines  — the "last-starter" N per position from the 12-team
//      superflex lineup (SFLEX = 100% QB; FLEX split RB/WR/TE 40/40/20).
//   2. replacementPoints     — the projected points at each baseline rank.
//   3. dollarsPerPoint        — marginal $/point: discretionary ÷ Σ PAR.
//   4. leagueValue            — $1 + PAR_league × $/point  (the Kerf Value ceiling).
//   5. rosterReplacementPoints + rosterValue — replace-your-starter, Raccoons-
//      specific: value above our OWN worst eligible starter (owner, 2026-08-26).
//   6. buildPriceCurve / priceFromCurve — market price fit from real salaries,
//      read off by a player's Kerf positional rank.

// ---------------------------------------------------------------------------
// League configuration — the tunable constants D-13 asks us to document.
// ---------------------------------------------------------------------------

// The KERFUFFLE starting lineup (per team), from the constitution.
export const LINEUP = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, SFLEX: 1, DST: 1 };
// Positions the FLEX and SFLEX slots may hold.
export const FLEX_POS = ["RB", "WR", "TE"];
export const SFLEX_POS = ["QB", "RB", "WR", "TE"];
// How the FLEX demand splits across RB/WR/TE (D-13). The SFLEX slot is modelled as
// 100% QB — the superflex effect that makes elite QBs correctly premium (QB24).
export const FLEX_SPLIT = { RB: 0.4, WR: 0.4, TE: 0.2 };
export const N_TEAMS = 12;
export const TEAM_BUDGET = 500;
// Rosterable spots per team that owe a $1 minimum. The constitution allows 10
// starters + 9 bench (+ 2 IR). We fund the ACTIVE roster (starters + bench = 19)
// and leave IR out of the minimum count (owner-tunable — the issue asks us to
// decide bench/IR; bench in, IR out, since IR is an in-season designation not an
// auction buy). Only ~2% of the pool either way.
export const ROSTER_SPOTS_PER_TEAM = 19;
// Positions the dollar engine prices. DST is excluded — the projection layer
// can't score defenses (#18), so it has no PAR (its baseline is documented only).
export const PRICED_POSITIONS = ["QB", "RB", "WR", "TE"];

const roundHalfUp = (x) => Math.floor(x + 0.5);

/**
 * The "last-starter" replacement baseline N per position (D-13). Dedicated slots
 * plus the position's share of the FLEX slots; the SFLEX slot counts 100% as a
 * QB. Rounded to a whole rank. Returns { QB, RB, WR, TE, DST }.
 */
export function replacementBaselines({
  nTeams = N_TEAMS,
  lineup = LINEUP,
  flexSplit = FLEX_SPLIT,
} = {}) {
  const flexSlots = lineup.FLEX; // per team
  const out = {};
  out.QB = roundHalfUp(nTeams * (lineup.QB + lineup.SFLEX)); // SFLEX → 100% QB
  out.RB = roundHalfUp(nTeams * (lineup.RB + flexSlots * flexSplit.RB));
  out.WR = roundHalfUp(nTeams * (lineup.WR + flexSlots * flexSplit.WR));
  out.TE = roundHalfUp(nTeams * (lineup.TE + flexSlots * flexSplit.TE));
  out.DST = roundHalfUp(nTeams * lineup.DST);
  return out;
}

/**
 * The projected points at each position's replacement rank. `players` each have
 * { pos, kerfPoints }. For position P with baseline N, replacement points = the
 * N-th highest kerfPoints among P's players (0-based index N-1). If fewer than N
 * players exist at P, the last (weakest) player's points are used; none → null.
 * Returns { [pos]: number|null }.
 */
export function replacementPoints(players, baselines) {
  const byPos = {};
  for (const p of players) (byPos[p.pos] ||= []).push(p.kerfPoints);
  const out = {};
  for (const pos of Object.keys(baselines)) {
    const list = (byPos[pos] || []).slice().sort((a, b) => b - a);
    if (list.length === 0) {
      out[pos] = null;
      continue;
    }
    const idx = Math.min(baselines[pos] - 1, list.length - 1);
    out[pos] = list[idx];
  }
  return out;
}

/** Points above replacement for a player, floored at 0. */
export function par(kerfPoints, replPoints) {
  if (replPoints == null) return 0;
  return Math.max(0, kerfPoints - replPoints);
}

/**
 * Marginal $/point (D-13). Discretionary money = (budget × teams) − $1 per
 * rosterable spot; $/point = discretionary ÷ total PAR across the priced pool.
 * Returns { dollarsPerPoint, discretionary, totalBudget, minimums, totalPar }.
 * dollarsPerPoint is 0 when there is no positive PAR (degenerate/tiny pools).
 */
export function dollarsPerPoint(pricedPlayers, replPoints, {
  nTeams = N_TEAMS,
  budget = TEAM_BUDGET,
  rosterSpots = ROSTER_SPOTS_PER_TEAM,
} = {}) {
  const totalBudget = nTeams * budget;
  const minimums = nTeams * rosterSpots; // $1 each
  const discretionary = totalBudget - minimums;
  let totalPar = 0;
  for (const p of pricedPlayers) totalPar += par(p.kerfPoints, replPoints[p.pos]);
  const dpp = totalPar > 0 ? discretionary / totalPar : 0;
  return { dollarsPerPoint: dpp, discretionary, totalBudget, minimums, totalPar };
}

/** League-generic ceiling: $1 + PAR × $/point. */
export function leagueValue(kerfPoints, replPointsForPos, dpp) {
  return 1 + par(kerfPoints, replPointsForPos) * dpp;
}

// ---------------------------------------------------------------------------
// Roster-aware: replace-your-starter (the Raccoons-specific ceiling).
// ---------------------------------------------------------------------------

/**
 * Build a team's optimal superflex starting lineup from its roster and return, per
 * priced position, the points of the WEAKEST current starter that a new player at
 * that position could displace (the roster-specific replacement level).
 *
 * `roster` = the team's players, each { pos, kerfPoints } (unprojected players,
 * e.g. DST or no projection, are ignored). Slots are filled greedily by points:
 * dedicated slots first, then FLEX (best remaining RB/WR/TE), then SFLEX (best
 * remaining QB/RB/WR/TE) — the standard optimal-lineup order. A candidate at
 * position P can bump the lowest-scoring starter among the slots P is eligible for
 * (QB→QB/SFLEX; RB→RB/FLEX/SFLEX; WR→WR/FLEX/SFLEX; TE→TE/FLEX/SFLEX).
 *
 * Returns { [pos]: points|null } — null when the team fills no slot P is eligible
 * for (an incomplete roster), so the caller can fall back to league replacement.
 */
export function rosterReplacementPoints(roster) {
  // Candidate pools per slot, sorted by points desc; fill without reuse.
  const pool = roster
    .filter((p) => PRICED_POSITIONS.includes(p.pos) && typeof p.kerfPoints === "number")
    .map((p) => ({ pos: p.pos, pts: p.kerfPoints }))
    .sort((a, b) => b.pts - a.pts);

  const used = new Set();
  // Each starter records the slot TYPE it fills, so eligibility can be checked.
  const starters = []; // { slot: 'QB'|'RB'|'WR'|'TE'|'FLEX'|'SFLEX', pts }

  const take = (eligible, count) => {
    for (let c = 0; c < count; c++) {
      let pick = -1;
      for (let i = 0; i < pool.length; i++) {
        if (used.has(i)) continue;
        if (eligible.includes(pool[i].pos)) {
          pick = i;
          break; // pool is sorted desc → first eligible is the best
        }
      }
      if (pick === -1) return; // roster can't fill this slot
      used.add(pick);
      return pool[pick];
    }
  };

  const fill = (slotName, eligible, count) => {
    for (let c = 0; c < count; c++) {
      const p = take(eligible, 1);
      if (p) starters.push({ slot: slotName, pts: p.pts });
    }
  };

  fill("QB", ["QB"], LINEUP.QB);
  fill("RB", ["RB"], LINEUP.RB);
  fill("WR", ["WR"], LINEUP.WR);
  fill("TE", ["TE"], LINEUP.TE);
  fill("FLEX", FLEX_POS, LINEUP.FLEX);
  fill("SFLEX", SFLEX_POS, LINEUP.SFLEX);

  // Slots each position is eligible to displace.
  const eligibleSlots = {
    QB: ["QB", "SFLEX"],
    RB: ["RB", "FLEX", "SFLEX"],
    WR: ["WR", "FLEX", "SFLEX"],
    TE: ["TE", "FLEX", "SFLEX"],
  };
  const out = {};
  for (const pos of PRICED_POSITIONS) {
    const eligible = starters.filter((s) => eligibleSlots[pos].includes(s.slot));
    out[pos] = eligible.length ? Math.min(...eligible.map((s) => s.pts)) : null;
  }
  return out;
}

/**
 * Roster-aware value: $1 + PAR_roster × $/point, where PAR_roster is measured
 * against the team's own worst eligible starter. Falls back to the league
 * replacement for a position the roster doesn't cover. Same $/point as the
 * league-generic ceiling, so the two dollar numbers are directly comparable.
 */
export function rosterValue(kerfPoints, pos, rosterRepl, leagueRepl, dpp) {
  const repl = rosterRepl[pos] != null ? rosterRepl[pos] : leagueRepl[pos];
  return { rosterReplPoints: repl, parRoster: par(kerfPoints, repl), value: 1 + par(kerfPoints, repl) * dpp };
}

// ---------------------------------------------------------------------------
// Market price curve — "what the Nth-best player at this position costs".
// ---------------------------------------------------------------------------

/**
 * Build a per-position price curve from real salaries. `salaries` = rows of
 * { pos, salary }. Within each position, salaries are sorted DESCENDING so knot
 * rank r (1-based) is the r-th most expensive salary — a monotonic non-increasing
 * "what the Nth-best player costs" curve. Zero/blank salaries are dropped.
 * Returns { [pos]: number[] } (index 0 = rank 1 = priciest).
 */
export function buildPriceCurve(salaries) {
  const byPos = {};
  for (const s of salaries) {
    if (s.salary == null || s.salary <= 0) continue;
    if (!PRICED_POSITIONS.includes(s.pos)) continue;
    (byPos[s.pos] ||= []).push(s.salary);
  }
  for (const pos of Object.keys(byPos)) byPos[pos].sort((a, b) => b - a);
  return byPos;
}

/**
 * Read a market price off the curve for a player at positional rank `posRank`
 * (1-based). The rank is clamped into the curve; beyond the last knot the curve
 * flattens to its cheapest observed salary (a deep player is a min-price player).
 * Returns null when the position has no salary data (can't price it).
 */
export function priceFromCurve(curve, pos, posRank) {
  const knots = curve[pos];
  if (!knots || knots.length === 0 || posRank == null) return null;
  const idx = Math.min(Math.max(1, posRank), knots.length) - 1;
  return knots[idx];
}
