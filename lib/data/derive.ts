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
 *  - Engine fields (kerf*, marketPrice) are null — the engine doesn't exist yet.
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

export function deriveBoard(rows: BoardViewRow[]): Player[] {
  const ovrRank = uniqueRanks(rows, (r) => r.ecr);
  const dynRank = uniqueRanks(rows, (r) => r.dynasty_ecr);

  return rows.map((r) => ({
    id: String(r.cbs_player_id),
    name: r.name,
    pos: assertPosition(r.pos, r.name),
    nflTeam: r.nfl_team ?? "",
    owner: r.owner,

    kerfValue: null,
    marketPrice: null,
    kerfOvrRank: null,
    kerfPosRank: null,
    kerfOvrTier: null,
    kerfPosTier: null,

    salary: r.salary,
    contractYears: r.contract_years,
    projPts: r.proj_points,

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
  }));
}
