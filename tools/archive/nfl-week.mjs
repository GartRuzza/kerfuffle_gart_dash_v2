// Which NFL week is it? — a deliberately DUMB, VISIBLE date→week table (issue #27).
//
// The in-season archiver must request the CURRENT week's FantasyPros weekly board
// and weekly projections (`week=N`). FantasyPros only publishes the current/imminent
// week, so this has to be right — but it does NOT need to be clever. The owner's
// choice (2026-08-27) is a hardcoded 2026 schedule table over auto-detection: you
// can read it, eyeball it, and correct it in one place.
//
// Safety net: the archiver ALSO records the week FantasyPros echoes back in each
// weekly payload and warns if it disagrees with this table — so an off-by-one here
// surfaces loudly in the manifest rather than silently pulling the wrong week.
//
// The table below is each 2026 regular-season week's FINAL day (the Monday of
// Monday Night Football). The 2026 season opens Wednesday 2026-09-09, so Week 1's
// games conclude Monday 2026-09-14; every later week ends the following Monday.
// (Source: NFL 2026 schedule — Seahawks/Patriots Wed Sept 9 opener.)

/** Each 2026 NFL regular-season week and the calendar date its games conclude. */
export const NFL_2026_WEEK_END_DATES = [
  { week: 1, ends: "2026-09-14" },
  { week: 2, ends: "2026-09-21" },
  { week: 3, ends: "2026-09-28" },
  { week: 4, ends: "2026-10-05" },
  { week: 5, ends: "2026-10-12" },
  { week: 6, ends: "2026-10-19" },
  { week: 7, ends: "2026-10-26" },
  { week: 8, ends: "2026-11-02" },
  { week: 9, ends: "2026-11-09" },
  { week: 10, ends: "2026-11-16" },
  { week: 11, ends: "2026-11-23" },
  { week: 12, ends: "2026-11-30" },
  { week: 13, ends: "2026-12-07" },
  { week: 14, ends: "2026-12-14" },
  { week: 15, ends: "2026-12-21" },
  { week: 16, ends: "2026-12-28" },
  { week: 17, ends: "2027-01-04" },
  { week: 18, ends: "2027-01-11" },
];

/** ISO calendar date (YYYY-MM-DD, UTC) from a Date or an ISO string. */
function isoDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new Error(`nfl-week: invalid date ${date}`);
  return d.toISOString().slice(0, 10);
}

/**
 * The current NFL week for a given date, from the 2026 table above.
 *
 * The "current week" is the first week whose games have not yet finished — i.e.
 * the first week whose end date is on or after `date`. So it flips to the next
 * week each Tuesday (the day after Monday Night Football), which matches when
 * FantasyPros rolls its weekly board forward.
 *
 *  - Any preseason date (before Week 1's Monday) → Week 1, because FantasyPros
 *    already publishes the upcoming week ahead of kickoff (observed 2026-08-26:
 *    `week=1` returned data while `week=2` was empty).
 *  - Any date after the regular season → clamped to Week 18 (the table's last
 *    entry). The archiver's echoed-week check is the tell if that ever matters.
 *
 * @param {Date|string} [date=new Date()]
 * @returns {number} the NFL week (1–18)
 */
export function currentNflWeek(date = new Date()) {
  const today = isoDate(date);
  for (const { week, ends } of NFL_2026_WEEK_END_DATES) {
    if (ends >= today) return week; // ISO dates compare correctly as strings
  }
  return NFL_2026_WEEK_END_DATES[NFL_2026_WEEK_END_DATES.length - 1].week;
}
