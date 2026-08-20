import { MULTI_POSITION_FILTERS, type PositionFilter } from "./types";

/**
 * The sort ↔ position ↔ tier-band state machine, centralized so it stays
 * testable and there is exactly one place to reason about it.
 *
 * Rules (owner-defined):
 *  - Tier bands show ONLY when the active sort is one of the six rank columns.
 *  - The band set matches the sort field (Kerf/ECR/Dynasty × overall/positional).
 *  - Overall-rank sort → overall tiers; the position filter just narrows rows.
 *  - Positional-rank sort needs a single position:
 *      · triggering it while on a multi-position (All/SuperFlex/Flex) auto-switches
 *        the position filter to QB;
 *      · switching TO a multi-position while positionally sorted clears the sort
 *        (back to the default overall order, with NO bands).
 *  - Default/load: active Kerf-Ovr-Rank sort → overall Kerf tiers on.
 */

export type TierField =
  | "kerfOvrTier"
  | "kerfPosTier"
  | "ovrEcrTier"
  | "posEcrTier"
  | "dynOvrTier"
  | "dynPosTier";

interface RankColumn {
  tierField: TierField;
  scope: "overall" | "positional";
}

/** The six rank columns (by column id) that show tier bands. */
export const RANK_COLUMNS: Record<string, RankColumn> = {
  kerfOvrRank: { tierField: "kerfOvrTier", scope: "overall" },
  kerfPosRank: { tierField: "kerfPosTier", scope: "positional" },
  ecr: { tierField: "ovrEcrTier", scope: "overall" }, // "Ovr ECR"
  posEcr: { tierField: "posEcrTier", scope: "positional" },
  dynastyEcr: { tierField: "dynOvrTier", scope: "overall" }, // "Dyn Ovr ECR"
  dynPosEcr: { tierField: "dynPosTier", scope: "positional" },
};

/** The sort applied on load and used as the fallback overall order. */
export const DEFAULT_SORT_ID = "kerfOvrRank";

export function isRankColumn(colId: string | undefined): boolean {
  return !!colId && colId in RANK_COLUMNS;
}

export function isPositionalRankColumn(colId: string | undefined): boolean {
  return !!colId && RANK_COLUMNS[colId]?.scope === "positional";
}

export function isMultiPosition(pf: PositionFilter): boolean {
  return MULTI_POSITION_FILTERS.includes(pf);
}

export interface TierPlan {
  showTiers: boolean;
  tierField: TierField | null;
}

/** Whether/which tier bands to render, given the active sort column + position. */
export function tierPlan(
  sortColId: string | undefined,
  positionFilter: PositionFilter,
): TierPlan {
  if (!isRankColumn(sortColId)) return { showTiers: false, tierField: null };
  const col = RANK_COLUMNS[sortColId as string];
  if (col.scope === "positional" && isMultiPosition(positionFilter)) {
    // positional tiers are meaningless across multiple positions
    return { showTiers: false, tierField: null };
  }
  return { showTiers: true, tierField: col.tierField };
}

/**
 * Effect for clicking a sort header: if it's a positional-rank column while a
 * multi-position is selected, auto-switch the position filter to QB.
 */
export function positionAfterSort(
  sortColId: string,
  positionFilter: PositionFilter,
): PositionFilter {
  if (isPositionalRankColumn(sortColId) && isMultiPosition(positionFilter)) {
    return "QB";
  }
  return positionFilter;
}

/**
 * Effect for changing the position filter: if a positional-rank sort is active
 * and the new position is a multi-position, the sort is invalid → clear it.
 */
export function shouldClearSortOnPositionChange(
  sortColId: string | undefined,
  newPosition: PositionFilter,
): boolean {
  return isPositionalRankColumn(sortColId) && isMultiPosition(newPosition);
}
