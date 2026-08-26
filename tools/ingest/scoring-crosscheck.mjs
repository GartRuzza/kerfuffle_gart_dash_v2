// Scoring-engine cross-check (issue #17, validation — NOT the engine itself).
//
// Recomputes KERFUFFLE points from a player's parsed stat-line components using
// the scoring config PARSED FROM CBS (scoring_rule table — never hardcoded), and
// compares to CBS's own FPTS Total. If our stat data and our scoring rules agree,
// the recomputed total lands on CBS's FPTS Total (within a documented tolerance).
// This proves the historical stat parse is aligned and de-risks the projection
// engine (#18) before it is built.
//
// Residuals are expected for players with points the offensive stat export does
// not expose — return TDs, offensive fumble-recovery TDs — so the "all players"
// pass uses a looser band than the clean curated sample.

// Map each KERFUFFLE scoring `code` to the coefficient applied per stat unit.
// flat rules -> points per event; per_unit rules -> points per single unit.
export function buildScoringMap(db, pullId) {
  // Default to the latest CURRENT pull, not MAX(pull_id): once the backtest (#19)
  // loads historical pulls, they carry higher ids but NO scoring_rule rows, so
  // MAX(pull_id) would resolve to a scoring-less backtest pull and return an empty
  // map. latest_pull is kind='current' (migration 006); MAX is the final fallback.
  const pid =
    pullId ??
    db.prepare(`SELECT pull_id FROM latest_pull`).get()?.pull_id ??
    db.prepare(`SELECT MAX(pull_id) AS p FROM pull`).get().p;
  const rows = db.prepare(`SELECT value_json FROM scoring_rule WHERE pull_id = ?`).all(pid);
  const coef = {};
  for (const { value_json } of rows) {
    const v = JSON.parse(value_json);
    const code = v.code;
    if (!code) continue;
    if (v.parsed.kind === "flat") coef[code] = v.parsed.points;
    else if (v.parsed.kind === "per_unit") coef[code] = v.parsed.points_per_unit / (v.parsed.per_units || 1);
  }
  return coef;
}

// The offensive scoring terms KERFUFFLE awards, mapping a stat field to its code.
// (Passing first downs are intentionally absent — this league does not score them.)
// Exported so the projection engine (#18) scores PROJECTED stat lines through the
// exact same terms this cross-check validated against CBS actuals.
export const TERMS = [
  ["pass_yds", "PaYd"], ["pass_td", "PaTD"], ["pass_int", "PaInt"], ["pass_2pt", "Pa2P"],
  ["rush_yds", "RuYd"], ["rush_td", "RuTD"], ["rush_first_downs", "RuFD"], ["rush_2pt", "Ru2P"],
  ["rec_yds", "ReYd"], ["rec_td", "ReTD"], ["rec_first_downs", "ReFD"], ["rec_2pt", "Re2P"],
  ["fumbles_lost", "FL"],
];

// Recompute a player's season KERFUFFLE points from components + the scoring map.
export function recomputeKerfPoints(stat, coef) {
  let pts = 0;
  for (const [field, code] of TERMS) {
    const c = coef[code];
    if (c == null) continue;               // rule absent -> that term scores 0
    pts += (stat[field] ?? 0) * c;
  }
  return Math.round(pts * 100) / 100;      // CBS shows 2 decimals
}

// Cross-check every stored stat row for a season. Returns per-row diffs plus a
// summary (counts within tolerance bands, worst offenders).
export function crossCheckSeason(db, season) {
  const coef = buildScoringMap(db);
  const rows = db
    .prepare(`SELECT * FROM player_season_stats WHERE season = ? AND fpts_total IS NOT NULL`)
    .all(season);
  const results = rows.map((s) => {
    const computed = recomputeKerfPoints(s, coef);
    return { name: s.cbs_name_raw, pos: s.pos, actual: s.fpts_total, computed, diff: Math.round((computed - s.fpts_total) * 100) / 100 };
  });
  const within = (t) => results.filter((r) => Math.abs(r.diff) <= t).length;
  results.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return {
    season,
    total: results.length,
    within_0_5: within(0.5),
    within_1: within(1),
    within_5: within(5),
    worst: results.slice(0, 10),
    results,
  };
}
