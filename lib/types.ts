import type { RowData } from "@tanstack/react-table";

export type Position = "QB" | "RB" | "WR" | "TE" | "DST";
export const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "DST"];
/** "Flex" grouping — RB/WR/TE (excludes QB and DST). */
export const FLEX_POSITIONS: Position[] = ["RB", "WR", "TE"];
/** "SuperFlex" grouping — QB/RB/WR/TE (excludes DST). */
export const SUPERFLEX_POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];

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
 * One player as shown in the table — REAL league data (issue #12).
 *
 * Produced only by the data-access module (`lib/data/`), which reads the
 * normalized SQLite store's flat `board` view (decision D-10): CBS rosters,
 * salaries and contracts joined with FantasyPros consensus rankings, with
 * free agents derived from the ranking board. `id` is the CBS player id —
 * the join key both sources publish.
 *
 * Nullability is meaningful:
 *  - Engine outputs (`kerfValue`, `rosterValue`, `marketPrice`,
 *    `marketPreAuction`, the `kerf*` ranks/tiers) come from the latest engine run
 *    (projections #18, dollars #20). They are null for players the engine can't
 *    price — team defenses (no offensive projection) and anyone with no
 *    projection — and render as "—".
 *  - `salary`/`contractYears` are null for free agents (meaningfully: no
 *    contract) and, rarely, for rostered players CBS shows blank.
 *  - ECR fields are null for rostered players FantasyPros doesn't rank.
 *  - `projPts` is CBS's own KERFUFFLE-scored season projection (source data,
 *    not engine output); null for free agents for now.
 */
export interface Player {
  /** CBS player id (the CBS↔FantasyPros join key), as a string row id. */
  id: string;
  name: string;
  pos: Position;
  nflTeam: string;
  owner: string; // fantasy team name, or FREE_AGENT ("FA")

  // --- Engine outputs (null until the valuation engine exists) ---
  kerfValue: number | null; // "Kerf Value" ($) — league-generic VORP ceiling
  rosterValue: number | null; // "Roster Value" ($) — Raccoons-specific (replace-your-starter)
  marketPrice: number | null; // "Market (Now)" ($) — in-season current-salary price curve
  marketPreAuction: number | null; // "Market (Auction)" ($) — 2025 pre-auction price curve
  kerfOvrRank: number | null;
  kerfPosRank: number | null;
  kerfOvrTier: number | null;
  kerfPosTier: number | null;

  // --- CBS (contract snapshot, latest pull) ---
  salary: number | null; // whole $; null = free agent / unassigned
  contractYears: number | null; // 1–4; null for free agents
  projPts: number | null; // CBS's KERFUFFLE-scored season projection

  // --- FantasyPros (draft STD board + dynasty board, latest pull) ---
  ecr: number | null; // raw overall ECR (draft, standard scoring)
  dynastyEcr: number | null; // raw overall dynasty ECR
  ovrEcrRank: number | null; // unique contiguous overall rank (display + sort)
  posEcr: number | null; // rank within position
  dynOvrRank: number | null; // unique contiguous overall dynasty rank
  dynPosEcr: number | null; // dynasty rank within position
  ovrEcrTier: number | null; // FantasyPros' real tier (draft board)
  posEcrTier: number | null;
  dynOvrTier: number | null; // FantasyPros' real tier (dynasty board)
  dynPosTier: number | null;
}

/** A table row: a Player plus the owner's editable, in-session ceiling ($). */
export interface PlayerRow extends Player {
  /**
   * Editable; seeded from `kerfValue` (the Kerf model) — which is null until
   * the engine exists, so it starts blank. Resets on reload (by design).
   */
  ceiling: number | null;
}

/**
 * Table-wide callback surface. Augmenting TanStack's `TableMeta` lets the
 * editable Ceiling cell reach the update function in a type-safe way.
 */
declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateCeiling: (rowIndex: number, value: number | null) => void;
  }
}
