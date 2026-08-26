// KERFUFFLE projection engine — the PURE core (issue #18, decisions D-13, D-14).
//
// No database, no filesystem: every function here is a deterministic transform,
// so it is unit-testable in isolation and reproduces identically each run (an
// acceptance requirement). The DB orchestration lives in run.mjs.
//
// The pipeline this module implements:
//   1. deriveFirstDownRates  — from our OWN league history (CBS 2024+2025 stats),
//      position-level rushing FD-per-carry and receiving FD-per-reception rates.
//   2. derivePlayerRates     — PER-PLAYER rates (pooled 2024+2025), each SHRUNK
//      toward its position rate by sample size (empirical-Bayes / partial
//      pooling): a player with lots of history leans on his own rate; a rookie or
//      thin sample falls back to the position average. This is what lets a back
//      who genuinely converts more first downs than average show up as more
//      valuable (owner, 2026-08-26).
//   3. scoreProjection       — apply the player's (shrunk) rate to his PROJECTED
//      volume → estimated first downs, then run the full projected line INCLUDING
//      those first downs through the parsed KERFUFFLE scoring config → Kerf
//      points, with a per-term + first-down breakdown for drill-down.
//   4. assignRanks / assignTiers — Kerf overall + positional ranks, and gap-based
//      tiers (Jenks natural breaks) calibrated to FantasyPros' own tier counts.

import { recomputeKerfPoints, TERMS } from "../ingest/scoring-crosscheck.mjs";

// ---------------------------------------------------------------------------
// 1. First-down rates from league history (position level, pooled seasons).
// ---------------------------------------------------------------------------

/**
 * Derive position-level first-down rates from player_season_stats rows.
 * Rows are pooled across whatever seasons are passed in (owner: 2024+2025 → more
 * stable rates). Primary rates are PER OPPORTUNITY — receiving FD per reception,
 * rushing FD per carry — because a first down is a per-play event. Per-yard rates
 * are also returned as a documented backstop (unused by the v1 model).
 *
 * Returns { [pos]: { recFdPerRec, rushFdPerAtt, recFdPerYd, rushFdPerYd, totals } }.
 */
export function deriveFirstDownRates(statRows) {
  const agg = {};
  for (const s of statRows) {
    const pos = s.pos;
    if (!agg[pos]) {
      agg[pos] = { recFd: 0, rec: 0, recYds: 0, rushFd: 0, rushAtt: 0, rushYds: 0 };
    }
    const a = agg[pos];
    a.recFd += s.rec_first_downs || 0;
    a.rec += s.rec_rec || 0;
    a.recYds += s.rec_yds || 0;
    a.rushFd += s.rush_first_downs || 0;
    a.rushAtt += s.rush_att || 0;
    a.rushYds += s.rush_yds || 0;
  }
  const rates = {};
  for (const [pos, a] of Object.entries(agg)) {
    rates[pos] = {
      recFdPerRec: a.rec > 0 ? a.recFd / a.rec : 0,
      rushFdPerAtt: a.rushAtt > 0 ? a.rushFd / a.rushAtt : 0,
      recFdPerYd: a.recYds > 0 ? a.recFd / a.recYds : 0, // backstop, unused by v1
      rushFdPerYd: a.rushYds > 0 ? a.rushFd / a.rushYds : 0, // backstop, unused by v1
      totals: { ...a },
    };
  }
  return rates;
}

// ---------------------------------------------------------------------------
// 2. Per-player rates, shrunk toward the position rate by sample size.
// ---------------------------------------------------------------------------

/**
 * Empirical-Bayes shrinkage of a rate toward a prior. With `ownOpp` observed
 * opportunities producing `ownEvents` events, and a prior (position) rate:
 *
 *   shrunk = (ownEvents + K·priorRate) / (ownOpp + K)
 *
 * K is a pseudo-count — "how many opportunities of prior-rate evidence to blend
 * in". Large ownOpp → the player's own rate dominates; ownOpp = 0 (a rookie) →
 * exactly the prior. This is the smooth, cutoff-free fallback for small samples.
 */
export function shrinkRate(ownEvents, ownOpp, priorRate, K) {
  if (ownOpp + K <= 0) return priorRate;
  return (ownEvents + K * priorRate) / (ownOpp + K);
}

/**
 * Per-player first-down rates from league history, each shrunk toward its
 * position rate. Rows are pooled across seasons per player (owner: 2024+2025).
 * `positionRates` is the deriveFirstDownRates output (the shrinkage prior);
 * `K = { rushK, recK }` sets how much personal history is needed before a
 * player's own rate dominates (owner-tunable; the backtest #19 will calibrate).
 *
 * Returns Map cbs_player_id -> { rushFdPerAtt, recFdPerRec (both shrunk),
 * ownRushRate, ownRecRate (raw, or null if no sample), rushAtt, recRec, pos }.
 */
export function derivePlayerRates(statRows, positionRates, { rushK, recK }) {
  const agg = new Map();
  for (const s of statRows) {
    const id = s.cbs_player_id;
    if (id == null) continue;
    let a = agg.get(id);
    if (!a) {
      a = { pos: s.pos, rushAtt: 0, rushFd: 0, recRec: 0, recFd: 0 };
      agg.set(id, a);
    }
    a.rushAtt += s.rush_att || 0;
    a.rushFd += s.rush_first_downs || 0;
    a.recRec += s.rec_rec || 0;
    a.recFd += s.rec_first_downs || 0;
  }
  const out = new Map();
  for (const [id, a] of agg) {
    const prior = positionRates[a.pos] || { rushFdPerAtt: 0, recFdPerRec: 0 };
    out.set(id, {
      pos: a.pos,
      rushAtt: a.rushAtt,
      recRec: a.recRec,
      ownRushRate: a.rushAtt > 0 ? a.rushFd / a.rushAtt : null,
      ownRecRate: a.recRec > 0 ? a.recFd / a.recRec : null,
      rushFdPerAtt: shrinkRate(a.rushFd, a.rushAtt, prior.rushFdPerAtt, rushK),
      recFdPerRec: shrinkRate(a.recFd, a.recRec, prior.recFdPerRec, recK),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Estimate first downs and score one projected stat line.
// ---------------------------------------------------------------------------

/**
 * Turn one projection_source row into a scored projection. Returns the estimated
 * first downs (named components), the Kerf points, the per-term breakdown, and an
 * `fd` object showing exactly how the first downs were estimated (drill-down).
 *
 * `src` is a projection_source row (projected volume). `positionRates` is the
 * deriveFirstDownRates output (the fallback). `coef` is the scoring map. When a
 * `playerRate` (from derivePlayerRates) is given, the player's own shrunk rate is
 * used; otherwise (no league history for this player) the position rate is used.
 *
 * `opts` selects WHICH components use the player's own rate vs the position rate:
 *   { rushPlayerSpecific = true, recPlayerSpecific = true }.
 * The engine (and backtest) set `rushPlayerSpecific: false` — the #19 backtest
 * showed a player's rushing FD rate barely persists year to year (ρ≈0.14, near
 * noise), so estimating it per-player added error; receiving FD persists (ρ≈0.52),
 * so it stays player-specific. The pure default keeps BOTH on for backward-compat.
 */
export function scoreProjection(src, positionRates, coef, playerRate = null, opts = {}) {
  const { rushPlayerSpecific = true, recPlayerSpecific = true } = opts;
  const pos = positionRates[src.pos] || { recFdPerRec: 0, rushFdPerAtt: 0 };
  const useRushPlayer = !!playerRate && rushPlayerSpecific;
  const useRecPlayer = !!playerRate && recPlayerSpecific;
  const rushRate = useRushPlayer ? playerRate.rushFdPerAtt : pos.rushFdPerAtt;
  const recRate = useRecPlayer ? playerRate.recFdPerRec : pos.recFdPerRec;
  const estRushFD = (src.rush_att || 0) * rushRate;
  const estRecFD = (src.rec_rec || 0) * recRate;

  // The scored stat line uses the SAME field names as player_season_stats so it
  // flows through the exact scoring terms the #17 cross-check validated. The two
  // estimated first-down fields are the only synthetic inputs.
  // FantasyPros lumps two-point conversions into one figure and does not split
  // them by pass/rush/rec; every KERFUFFLE 2pt rule is worth +2, so folding the
  // whole figure into a single 2pt term yields the identical point total.
  const scored = {
    pass_yds: src.pass_yds || 0,
    pass_td: src.pass_td || 0,
    pass_int: src.pass_int || 0,
    pass_2pt: 0,
    rush_yds: src.rush_yds || 0,
    rush_td: src.rush_td || 0,
    rush_first_downs: estRushFD,
    rush_2pt: src.two_pt || 0, // the whole 2pt figure, folded here (see note above)
    rec_yds: src.rec_yds || 0,
    rec_td: src.rec_td || 0,
    rec_first_downs: estRecFD,
    rec_2pt: 0,
    fumbles_lost: src.fumbles || 0, // FantasyPros projects fumbles LOST (what fantasy scores)
  };

  const kerfPoints = recomputeKerfPoints(scored, coef);

  // Per-term point contribution, for the drill-down panel and reconstruction test.
  // Stored UNROUNDED so the terms sum exactly to kerfPoints (which is round-of-sum);
  // rounding each term here would let a drill-down total drift a cent from the headline.
  const contributions = {};
  for (const [field, code] of TERMS) {
    const c = coef[code];
    if (c == null) continue;
    contributions[code] = (scored[field] ?? 0) * c;
  }

  // How the first downs were estimated — the "why is this back boosted?" record.
  // `source` is kept for back-compat; rush/rec now carry their own source because
  // the policy can differ by component (rushing = position, receiving = player).
  const fd = {
    source: playerRate ? "player_shrunk" : "position",
    rushSource: useRushPlayer ? "player_shrunk" : "position",
    recSource: useRecPlayer ? "player_shrunk" : "position",
    rushRate,
    recRate,
    positionRushRate: pos.rushFdPerAtt,
    positionRecRate: pos.recFdPerRec,
    ownRushRate: playerRate ? playerRate.ownRushRate : null,
    ownRecRate: playerRate ? playerRate.ownRecRate : null,
    rushSampleAtt: playerRate ? playerRate.rushAtt : 0,
    recSampleRec: playerRate ? playerRate.recRec : 0,
  };

  return {
    estRushFD,
    estRecFD,
    rushFdRate: rushRate,
    recFdRate: recRate,
    kerfPoints,
    scored,
    contributions,
    fd,
  };
}

// ---------------------------------------------------------------------------
// 4a. Ranks — one overall pool (superflex → QBs rise) + within-position.
// ---------------------------------------------------------------------------

/**
 * Assign Kerf overall and positional ranks over a set of scored players.
 * `items` each have { cbsId, pos, kerfPoints }. Higher points = better (rank 1).
 * Ties break by cbsId so the order is deterministic across runs.
 * Returns a Map cbsId -> { ovrRank, posRank }.
 */
export function assignRanks(items) {
  const byPoints = (a, b) => b.kerfPoints - a.kerfPoints || a.cbsId - b.cbsId;
  const out = new Map();

  [...items].sort(byPoints).forEach((it, i) => {
    out.set(it.cbsId, { ovrRank: i + 1, posRank: null });
  });

  const byPos = {};
  for (const it of items) (byPos[it.pos] ||= []).push(it);
  for (const list of Object.values(byPos)) {
    [...list].sort(byPoints).forEach((it, i) => {
      out.get(it.cbsId).posRank = i + 1;
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4b. Tiers — Jenks natural breaks (deterministic), calibrated to FP's counts.
// ---------------------------------------------------------------------------

/**
 * Jenks natural-breaks classification of `values` into `k` classes (Fisher's
 * exact 1-D dynamic program: minimize total within-class squared deviation).
 * Returns a class index 0..k-1 per input value, where 0 is the LOWEST band.
 * Deterministic — no randomness, unlike a Gaussian-mixture fit.
 */
export function jenksClasses(values, k) {
  const n = values.length;
  if (n === 0) return [];
  const kk = Math.max(1, Math.min(k, n));
  if (kk === 1) return values.map(() => 0);

  // Sort ascending, keeping original positions to map the result back.
  const order = values.map((v, i) => i).sort((a, b) => values[a] - values[b] || a - b);
  const x = order.map((i) => values[i]);

  // Prefix sums for O(1) within-segment squared deviation.
  const pre = new Float64Array(n + 1);
  const pre2 = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    pre[i + 1] = pre[i] + x[i];
    pre2[i + 1] = pre2[i] + x[i] * x[i];
  }
  const sse = (i, j) => {
    // squared deviation of sorted points i..j (inclusive, 0-based)
    const len = j - i + 1;
    const s = pre[j + 1] - pre[i];
    const s2 = pre2[j + 1] - pre2[i];
    return s2 - (s * s) / len;
  };

  // cost[c][j] = min cost to split the first j points into c classes.
  const cost = Array.from({ length: kk + 1 }, () => new Float64Array(n + 1).fill(Infinity));
  const arg = Array.from({ length: kk + 1 }, () => new Int32Array(n + 1));
  for (let j = 1; j <= n; j++) cost[1][j] = sse(0, j - 1);
  for (let c = 2; c <= kk; c++) {
    for (let j = c; j <= n; j++) {
      let best = Infinity;
      let bm = c - 1;
      for (let m = c - 1; m <= j - 1; m++) {
        const cand = cost[c - 1][m] + sse(m, j - 1);
        if (cand < best) {
          best = cand;
          bm = m;
        }
      }
      cost[c][j] = best;
      arg[c][j] = bm;
    }
  }

  // Backtrack the class boundaries.
  const classOfSorted = new Int32Array(n);
  let j = n;
  for (let c = kk; c >= 1; c--) {
    const m = c === 1 ? 0 : arg[c][j];
    for (let p = m; p < j; p++) classOfSorted[p] = c - 1;
    j = m;
  }

  const out = new Array(n);
  for (let p = 0; p < n; p++) out[order[p]] = classOfSorted[p];
  return out;
}

/**
 * Assign tiers to `items` (each with `kerfPoints`) using Jenks into `k` bands.
 * Tier 1 is the BEST (highest points) — the class order is inverted so the
 * numbering reads like a draft board. Returns a Map cbsId -> tier (1..kUsed).
 */
export function assignTiers(items, k) {
  const out = new Map();
  if (items.length === 0) return out;
  const kUsed = Math.max(1, Math.min(k, items.length));
  const classes = jenksClasses(items.map((it) => it.kerfPoints), kUsed);
  items.forEach((it, i) => {
    out.set(it.cbsId, kUsed - classes[i]); // class kUsed-1 (highest) -> tier 1
  });
  return out;
}
