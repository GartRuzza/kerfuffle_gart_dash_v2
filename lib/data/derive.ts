import { POSITIONS, type Player, type Position } from "../types";

/**
 * Pure derivation: rows from the SQLite `board` view -> the `Player` shape the
 * UI consumes. Kept free of any database/filesystem so it is unit-testable.
 *
 * What is derived here (and why):
 *  - `ovrEcrRank` / `dynOvrRank`: a UNIQUE contiguous overall rank per board
 *    (raw ECR can tie; tier bands and sorting need a strict order — same rule
 *    the prototype used, now on real data).
 *  - `posEcr` / `dynPosEcr`: the number out of FantasyPros' "WR12"-style
 *    positional rank.
 *  - Tiers are FantasyPros' REAL tiers (per board). The positional tier is the
 *    same board's tier: within a single position it groups exactly like the
 *    positional rank, so bands stay contiguous.
 *  - Engine fields (kerf ranks/tiers) come from the latest engine_run's
 *    `projection` rows (issue #18), passed in as `projById`. A player with no
 *    projection (defenses, unprojected players) keeps them null → renders "—".
 *  - Dollar fields (`kerfValue`, `rosterValue`, `marketPrice`, `marketPreAuction`)
 *    come from the latest engine_run's `valuation` rows (issue #20), passed in as
 *    `valById`. Null for players the engine doesn't price (defenses, unprojected).
 *  - `projPts`: for offensive players the engine projects, this is now the
 *    KERFUFFLE-scored projected points (owner, 2026-08-26 — replaces CBS's own
 *    number, and finally gives free agents a projection). Defenses and
 *    unprojected players keep CBS's `proj_points` (or null).
 */

/** One row of the SQLite `board` view (snake_case, as SQL returns it). */
export interface BoardViewRow {
  cbs_player_id: number;
  name: string;
  pos: string;
  nfl_team: string | null;
  owner: string;
  roster_status: string | null;
  salary: number | null;
  contract_years: number | null;
  proj_points: number | null;
  ecr: number | null;
  ecr_pos_rank: string | null;
  ecr_tier: number | null;
  dynasty_ecr: number | null;
  dynasty_pos_rank: string | null;
  dynasty_tier: number | null;
}

/**
 * One player's engine projection (from the latest engine_run's `projection`
 * rows, keyed by cbs_player_id). Only the fields the board needs.
 */
export interface ProjectionRow {
  kerf_points: number;
  kerf_ovr_rank: number | null;
  kerf_pos_rank: number | null;
  kerf_ovr_tier: number | null;
  kerf_pos_tier: number | null;
  // Option B netting (issue #30): the full-season projection before netting, the
  // actuals-to-date subtracted, and the week those actuals cover. Null on runs that
  // don't net (weekly #29, or a ROS run before actuals exist). `kerf_points` itself
  // is the REMAINING value under Option B.
  season_points?: number | null;
  actuals_points?: number | null;
  actuals_as_of_week?: number | null;
}

/**
 * One player's engine valuation (from the latest engine_run's `valuation` rows,
 * keyed by cbs_player_id). Only the fields the board needs (issue #20).
 */
export interface ValuationRow {
  kerf_value: number | null; // league-generic ceiling ($)
  roster_value: number | null; // Raccoons-specific ceiling ($)
  market_in_season: number | null; // current-salary price curve ($)
  market_pre_auction: number | null; // 2025 price curve ($)
}

/** "WR12" -> 12 (FantasyPros pos_rank strings). */
export function posRankNumber(posRank: string | null): number | null {
  if (!posRank) return null;
  const m = posRank.match(/(\d+)$/);
  return m ? Number(m[1]) : null;
}

function assertPosition(pos: string, name: string): Position {
  if (!(POSITIONS as string[]).includes(pos)) {
    throw new Error(
      `board row "${name}" has position "${pos}" — not a position this league rosters. ` +
        `The board view / ingest validation should have prevented this.`
    );
  }
  return pos as Position;
}

/**
 * Assign a unique contiguous 1..n rank over the rows that have a value,
 * ordered by (value asc, name) — the deterministic tie-break.
 */
function uniqueRanks(
  rows: BoardViewRow[],
  value: (r: BoardViewRow) => number | null
): Map<number, number> {
  const ranked = rows
    .filter((r) => value(r) !== null)
    .sort((a, b) => value(a)! - value(b)! || a.name.localeCompare(b.name));
  const map = new Map<number, number>();
  ranked.forEach((r, i) => map.set(r.cbs_player_id, i + 1));
  return map;
}

/**
 * One player's weekly consensus (from the FantasyPros weekly STD/OP board, keyed
 * by cbs_player_id). Weekly boards carry no `tier` — weekly tier bands come from
 * our own Kerf weekly tiers instead (issue #29).
 */
export interface WeeklyConsensusRow {
  rank_ecr: number | null;
  pos_rank: string | null; // "WR12"
  opponent: string | null; // "vs. TB" / "at HOU"
}

/**
 * The WEEKLY-lens dataset (issue #29): the same players as the board, but every
 * value points at THIS WEEK. The `kerf*` fields carry the weekly engine run's
 * Kerf points/ranks/tiers; the `ecr*` fields carry the weekly consensus (its
 * overall rank made unique+contiguous like the ROS lens; its tiers are null —
 * weekly consensus has none, so a weekly tier sort uses the Kerf tiers); `opponent`
 * is the matchup. Dollar fields are null (no weekly auction). Identity, roster,
 * salary and dynasty come from the shared board rows unchanged.
 *
 * Returns null when there is no weekly engine run yet (preseason) — the caller
 * then simply offers no Weekly lens.
 */
export function deriveWeekly(
  rows: BoardViewRow[],
  weeklyProjById: Map<number, ProjectionRow>,
  weeklyConsensusById: Map<number, WeeklyConsensusRow>
): Player[] {
  // Unique contiguous overall rank over the weekly consensus ECR (ties broken by
  // name), so weekly tier/sort behaves like the ROS lens.
  const weeklyOvr = new Map<number, number>();
  rows
    .map((r) => ({ id: r.cbs_player_id, name: r.name, ecr: weeklyConsensusById.get(r.cbs_player_id)?.rank_ecr ?? null }))
    .filter((r) => r.ecr !== null)
    .sort((a, b) => a.ecr! - b.ecr! || a.name.localeCompare(b.name))
    .forEach((r, i) => weeklyOvr.set(r.id, i + 1));
  const dynRank = uniqueRanks(rows, (r) => r.dynasty_ecr);

  return rows.map((r) => {
    const proj = weeklyProjById.get(r.cbs_player_id) ?? null;
    const wk = weeklyConsensusById.get(r.cbs_player_id) ?? null;
    return {
      id: String(r.cbs_player_id),
      name: r.name,
      pos: assertPosition(r.pos, r.name),
      nflTeam: r.nfl_team ?? "",
      owner: r.owner,

      // Weekly has no dollars (no weekly auction — issue #29 out of scope).
      kerfValue: null,
      rosterValue: null,
      marketPrice: null,
      marketPreAuction: null,
      // Kerf fields = THIS WEEK's re-score.
      kerfOvrRank: proj?.kerf_ovr_rank ?? null,
      kerfPosRank: proj?.kerf_pos_rank ?? null,
      kerfOvrTier: proj?.kerf_ovr_tier ?? null,
      kerfPosTier: proj?.kerf_pos_tier ?? null,

      salary: r.salary,
      contractYears: r.contract_years,
      projPts: proj ? Math.round(proj.kerf_points * 10) / 10 : null,
      // Weekly re-score is this-week points, not season remaining — no netting context.
      seasonProjPts: null,
      actualsToDate: null,
      actualsAsOfWeek: null,
      opponent: wk?.opponent ?? null,

      // ECR fields = the WEEKLY consensus (no weekly tiers → null).
      ecr: wk?.rank_ecr ?? null,
      dynastyEcr: r.dynasty_ecr,
      ovrEcrRank: weeklyOvr.get(r.cbs_player_id) ?? null,
      posEcr: posRankNumber(wk?.pos_rank ?? null),
      dynOvrRank: dynRank.get(r.cbs_player_id) ?? null,
      dynPosEcr: posRankNumber(r.dynasty_pos_rank),
      ovrEcrTier: null,
      posEcrTier: null,
      dynOvrTier: r.dynasty_tier,
      dynPosTier: r.dynasty_tier,
    };
  });
}

export function deriveBoard(
  rows: BoardViewRow[],
  projById: Map<number, ProjectionRow> = new Map(),
  valById: Map<number, ValuationRow> = new Map()
): Player[] {
  const ovrRank = uniqueRanks(rows, (r) => r.ecr);
  const dynRank = uniqueRanks(rows, (r) => r.dynasty_ecr);

  return rows.map((r) => {
    const proj = projById.get(r.cbs_player_id) ?? null;
    const val = valById.get(r.cbs_player_id) ?? null;
    return {
    id: String(r.cbs_player_id),
    name: r.name,
    pos: assertPosition(r.pos, r.name),
    nflTeam: r.nfl_team ?? "",
    owner: r.owner,

    kerfValue: val?.kerf_value ?? null, // dollars — the valuation engine (#20)
    rosterValue: val?.roster_value ?? null,
    marketPrice: val?.market_in_season ?? null,
    marketPreAuction: val?.market_pre_auction ?? null,
    kerfOvrRank: proj?.kerf_ovr_rank ?? null,
    kerfPosRank: proj?.kerf_pos_rank ?? null,
    kerfOvrTier: proj?.kerf_ovr_tier ?? null,
    kerfPosTier: proj?.kerf_pos_tier ?? null,

    salary: r.salary,
    contractYears: r.contract_years,
    // The engine's KERFUFFLE-scored projection for offense (incl. free agents);
    // CBS's own number for defenses / unprojected players. Under Option B (#30) the
    // engine's number is the REMAINING value in-season (full-season − actuals-to-date).
    projPts: proj ? Math.round(proj.kerf_points * 10) / 10 : r.proj_points,
    // Netting context (drill-down): full-season projection, actuals subtracted, and the
    // week they cover. season falls back to the remaining value when a run didn't net
    // (so the Full-Season column always shows a number for a projected player).
    seasonProjPts: proj ? Math.round((proj.season_points ?? proj.kerf_points) * 10) / 10 : null,
    actualsToDate: proj && proj.actuals_points != null ? Math.round(proj.actuals_points * 10) / 10 : null,
    actualsAsOfWeek: proj?.actuals_as_of_week ?? null,
    opponent: null, // ROS lens has no per-week matchup (issue #29 fills this weekly)

    ecr: r.ecr,
    dynastyEcr: r.dynasty_ecr,
    ovrEcrRank: ovrRank.get(r.cbs_player_id) ?? null,
    posEcr: posRankNumber(r.ecr_pos_rank),
    dynOvrRank: dynRank.get(r.cbs_player_id) ?? null,
    dynPosEcr: posRankNumber(r.dynasty_pos_rank),
    ovrEcrTier: r.ecr_tier,
    posEcrTier: r.ecr_tier,
    dynOvrTier: r.dynasty_tier,
    dynPosTier: r.dynasty_tier,
    };
  });
}
