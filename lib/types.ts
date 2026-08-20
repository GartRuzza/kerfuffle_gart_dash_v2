import type { RowData } from "@tanstack/react-table";

export type Position = "QB" | "RB" | "WR" | "TE";
export const POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];

/** The owner's own fantasy team. */
export const MY_TEAM = "Rangoon Raccoons";

/** Sentinel `owner` value for an unrostered (free-agent) player. */
export const FREE_AGENT = "FA";

/**
 * One player as shown in the table.
 *
 * ⚠ MOCK-DATA BOUNDARY. This is a flat, hand-authored fixture shape for the UI
 * prototype ONLY — it is deliberately NOT a real data schema. When real CBS /
 * FantasyPros data arrives (roadmap #2–3), `lib/mockData.ts` is the single
 * module that gets replaced. Do not grow a database around this type. If a real
 * schema starts to feel necessary, stop and flag the owner (per Issue #1).
 */
export interface Player {
  id: string;
  name: string;
  pos: Position;
  /** NFL team abbreviation, e.g. "KC". */
  nflTeam: string;
  /** Fantasy team name, or FREE_AGENT ("FA"). Drives the roster filter. */
  owner: string;
  /** Tier group; 1 = best. Small integers — grouping, not a decimal rank. */
  tier: number;
  /** "YOURS": the tool's KERFUFFLE-adjusted value, in $. */
  kerfValue: number;
  /** "THE MARKET": expected auction / market price, in $. */
  marketPrice: number;
  /** "THE MARKET": expert consensus rank (lower = better). */
  ecr: number;
  /** "THE MARKET": dynasty ECR (lower = better) — win-now context. */
  dynastyEcr: number;
  /** Current cap hit, in $. 0 for free agents. */
  salary: number;
  /** Contract years remaining; null for free agents. */
  contractYears: number | null;
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
