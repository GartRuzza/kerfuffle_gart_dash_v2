// Backtest metrics — the PURE core (issue #19, the decision gate).
//
// No database, no filesystem: deterministic transforms, unit-testable in
// isolation and reproducible each run (an acceptance requirement). The DB
// orchestration + report live in run.mjs.
//
// The question these metrics answer: does a predictor's ORDER of players match
// how they ACTUALLY finished in KERFUFFLE points?
//   * spearman()      — rank correlation of a predictor's goodness vs actual
//                       points across the whole set (+1 = perfect order, 0 = none).
//   * topNHitRate()   — of a predictor's top N, how many actually finished top N
//                       (the auction-relevant question: did we target the right pool?).
//   * rateSeasonsFor()— which season(s) a first-down rate may use to predict a
//                       target season WITHOUT leakage (strict out-of-sample).

// Fractional ranks, 1-based ascending, ties averaged (standard Spearman tie
// handling). Input order is preserved in the output.
export function averageRanks(values) {
  const idx = values.map((v, i) => i).sort((a, b) => values[a] - values[b] || a - b);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && values[idx[j + 1]] === values[idx[i]]) j++;
    const avg = (i + j) / 2 + 1; // average of positions i..j, converted to 1-based
    for (let k = i; k <= j; k++) ranks[idx[k]] = avg;
    i = j + 1;
  }
  return ranks;
}

/**
 * Spearman rank correlation between two equal-length arrays. `xs` is a predictor's
 * GOODNESS (higher = the predictor rates this player better), `ys` is the actual
 * outcome (higher = actually finished better). Returns ρ in [-1, 1], where +1 is
 * a perfect ordering match. Returns null if fewer than 2 points or no variance.
 */
export function spearman(xs, ys) {
  const n = xs.length;
  if (n !== ys.length) throw new Error("spearman: length mismatch");
  if (n < 2) return null;
  const rx = averageRanks(xs);
  const ry = averageRanks(ys);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(rx);
  const my = mean(ry);
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - mx;
    const dy = ry[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
}

/**
 * Top-N hit rate. `items` are { predRank (1 = best predicted), actual (points,
 * higher = better) }. Of the N best-predicted, how many are among the N actual
 * top scorers? Ties broken deterministically by predRank then actual then index,
 * so the result is reproducible. Returns { n, hits, rate } where n = min(N, size).
 */
export function topNHitRate(items, N) {
  const size = items.length;
  const n = Math.min(N, size);
  if (n === 0) return { n: 0, hits: 0, rate: null };
  const withIdx = items.map((it, i) => ({ ...it, i }));
  const predTop = new Set(
    [...withIdx]
      .sort((a, b) => a.predRank - b.predRank || b.actual - a.actual || a.i - b.i)
      .slice(0, n)
      .map((it) => it.i)
  );
  const actualTop = new Set(
    [...withIdx]
      .sort((a, b) => b.actual - a.actual || a.predRank - b.predRank || a.i - b.i)
      .slice(0, n)
      .map((it) => it.i)
  );
  let hits = 0;
  for (const i of predTop) if (actualTop.has(i)) hits++;
  return { n, hits, rate: hits / n };
}

/**
 * Which season(s) a first-down rate may be derived from to predict `target`
 * WITHOUT leakage. Strict out-of-sample: only seasons strictly before the target.
 * If none are available (the earliest year we hold), fall back to the target's own
 * season and flag it — that year's verdict is in-sample and must be read as
 * optimistic, not as a clean holdout (owner, 2026-08-26: "strict / honest test").
 */
export function rateSeasonsFor(target, availableSeasons) {
  const prior = availableSeasons.filter((s) => s < target).sort((a, b) => a - b);
  if (prior.length > 0) return { seasons: prior, inSample: false };
  return { seasons: [target], inSample: true };
}

/**
 * Compare two predictors over the same actual outcomes and say which ordered the
 * field better. `rows` each have { predRankA, predRankB, actual }. Returns the two
 * Spearman coefficients (goodness = -rank) and the signed edge (A − B).
 */
export function comparePredictors(rows) {
  const actual = rows.map((r) => r.actual);
  const rhoA = spearman(rows.map((r) => -r.predRankA), actual);
  const rhoB = spearman(rows.map((r) => -r.predRankB), actual);
  return { rhoA, rhoB, edge: rhoA != null && rhoB != null ? rhoA - rhoB : null, n: rows.length };
}
