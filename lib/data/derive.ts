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
    // CBS's own number for defenses / unprojected players.
    projPts: proj ? Math.round(proj.kerf_points * 10) / 10 : r.proj_points,

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
