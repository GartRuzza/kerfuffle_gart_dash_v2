import type { RowData } from "@tanstack/react-table";

export type Position = "QB" | "RB" | "WR" | "TE";
export const POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];
/** "Flex" grouping — RB/WR/TE (excludes QB). */
export const FLEX_POSITIONS: Position[] = ["RB", "WR", "TE"];

/** Position filter value: individual positions plus the multi-position groups. */
export type PositionFilter = "ALL" | "SUPERFLEX" | "FLEX" | Position;
/** The multi-position selections — positional-rank sorting is invalid for these. */
export const MULTI_POSITION_FILTERS: PositionFilter[] = [
  "ALL",
  "SUPERFLEX",
  "FLEX",
];

/** The owner's own fantasy team. */
export const MY_TEAM = "Rangoon Raccoons";
/** Sentinel `owner` value for an unrostered (free-agent) player. */
export const FREE_AGENT = "FA";

/**
 * One player as shown in the table.
 *
 * ⚠ MOCK-DATA BOUNDARY. A flat, hand-authored + derived fixture shape for the UI
 * prototype ONLY — NOT a real data schema. When real CBS / FantasyPros data
 * arrives (roadmap #2–3), `lib/mockData.ts` is the single module replaced. The
 * six `*Tier` fields and the derived ranks below are mock: real tiers come from
 * the engine (Kerf) and FantasyPros (ECR). If a real schema becomes necessary,
 * stop and flag the owner (per Issue #1).
 */
export interface Player {
  id: string;
  name: string;
  pos: Position;
  nflTeam: string;
  owner: string; // fantasy team, or FREE_AGENT ("FA")

  // --- Hand-authored ---
  /** @deprecated Legacy single tier; superseded by the six `*Tier` fields. */
  tier: number;
  kerfValue: number; // "Kerf Value" ($)
  marketPrice: number; // displayed as "Market Value" ($)
  ecr: number; // "Ovr ECR" — overall expert consensus rank (lower = better)
  dynastyEcr: number; // "Dyn Ovr ECR" — overall dynasty rank (lower = better)
  salary: number; // $ (0 for FAs)
  contractYears: number | null; // years remaining; null for FAs

  // --- Derived (computed in mockData.ts) ---
  projPts: number; // "Proj Points" — mock projected KERFUFFLE points
  kerfOvrRank: number; // "Kerf Ovr Rank" — overall, by Kerf value
  kerfPosRank: number; // "Kerf Pos Rank" — within position, by Kerf value
  posEcr: number; // "Pos ECR" — within position, by ECR
  dynPosEcr: number; // "Dyn Pos ECR" — within position, by dynasty ECR

  // --- Six tier dimensions (one per rank column that shows tier bands) ---
  kerfOvrTier: number;
  kerfPosTier: number;
  ovrEcrTier: number;
  posEcrTier: number;
  dynOvrTier: number;
  dynPosTier: number;
}

/** A table row: a Player plus the owner's editable, in-session ceiling ($). */
export interface PlayerRow extends Player {
  /** Editable; initialized to `kerfValue`. Resets on reload (by design). */
  ceiling: number;
}

/**
 * Table-wide callback surface. Augmenting TanStack's `TableMeta` lets the
 * editable Ceiling cell reach the update function in a type-safe way.
 */
declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateCeiling: (rowIndex: number, value: number) => void;
  }
}
