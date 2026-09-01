// Current-season actuals-to-date — the CBS stats-page source (issue #30).
//
// The /scoring/live page the issue flagged turned out to be a JavaScript shell
// (no parseable data read-only — see docs/cbs_data_discovery.md §9). The parseable,
// AUTO-UPDATING source is the CBS stats table, whose every filter is a plain URL
// PATH SEGMENT we can pin:
//
//   /stats/stats-main/{scope:positions}/{timeframe:league}/{category}/{view}
//     scope:positions  all:QB:RB:WR:TE:RB-WR-TE:FLEX   offense only (DST/K excluded)
//     timeframe:league ytd:p    year-to-date, NFL — actuals SO FAR this season
//     category         standard (volume + FPTS Total) | advanced (adds first downs)
//     view             stats    (actuals; the other view is `projections`)
//
// We capture BOTH categories (standard = volume + KERFUFFLE FPTS Total; advanced =
// the rush/rec first downs KERFUFFLE scores), so ingestion can recompute points from
// components and cross-check them against CBS's authoritative FPTS Total — the same
// validation the historical loader (#17) runs. Pagination is ?start_row=N (the
// transaction-log pattern). Preseason, `ytd` legitimately holds zero games played.

import { currentNflWeek } from "./nfl-week.mjs";

/** Offense-only position filter (DST/K carry no offensive projection — excluded). */
export const STATS_ACTUALS_POSITIONS = "all:QB:RB:WR:TE:RB-WR-TE:FLEX";

/**
 * The two seed pages for current-season actuals-to-date: standard + advanced,
 * both year-to-date (`ytd`), offense only, the `stats` (actuals) view.
 * @returns {{name: string, path: string}[]}
 */
export function statsActualsSeeds() {
  const base = `/stats/stats-main/${STATS_ACTUALS_POSITIONS}/ytd:p`;
  return [
    { name: "stats-actuals-standard", path: `${base}/standard/stats` },
    { name: "stats-actuals-advanced", path: `${base}/advanced/stats` },
  ];
}

/**
 * Build a paginated URL from a seed path by pinning OUR segments and appending
 * ?start_row=N — never following CBS's own pager hrefs, which may drop the path
 * segments and fall back to the default (standard/current) view.
 * @param {string} seedPath
 * @param {number} startRow
 * @returns {string}
 */
export function statsActualsPageUrl(seedPath, startRow) {
  return `${seedPath}?start_row=${startRow}`;
}

/**
 * How many COMPLETED weeks the current `ytd` figure includes, for lineage.
 * currentNflWeek is the first UNFINISHED week, so completed weeks = it minus 1;
 * preseason (currentNflWeek === 1) → 0, i.e. no games played yet.
 * @param {Date|string} [date=new Date()]
 * @returns {number} 0–18
 */
export function actualsAsOfWeek(date = new Date()) {
  return Math.max(0, currentNflWeek(date) - 1);
}
