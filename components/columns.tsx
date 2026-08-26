import type { CellContext, ColumnDef } from "@tanstack/react-table";
import {
  FLEX_POSITIONS,
  FREE_AGENT,
  SUPERFLEX_POSITIONS,
  type PlayerRow,
  type Position,
} from "@/lib/types";
import { MANAGER_ALL, type RosterFilterValue } from "@/lib/views";
import PositionBadge from "./PositionBadge";
import EditableCeilingCell from "./EditableCeilingCell";

/**
 * Null-aware cells (issue #12): engine outputs (Kerf values/ranks, market
 * value, edge) are null until the valuation engine exists, and some real
 * fields are legitimately blank (a free agent's salary, an unranked player's
 * ECR). Blank renders as "—"; blanks sort to the bottom (`sortUndefined`).
 */

const dash = <span className="text-ink-faint">—</span>;
// Auction money is whole dollars (you can't bid $130.26). The engine stores cents
// for drill-down/reconstruction; the table rounds for display. Salaries/market
// prices are already whole, so rounding them is a no-op.
const dollars = (n: number) => `$${Math.round(n)}`;

/** Positional-rank cells render as "WR3" (position + within-position rank). */
const posRankCell = (info: CellContext<PlayerRow, unknown>) => {
  const v = info.getValue<number | undefined>();
  if (v == null) return dash;
  return (
    <span className="tabular-nums">
      {info.row.original.pos}
      {v}
    </span>
  );
};

const num = (info: CellContext<PlayerRow, unknown>) => {
  const v = info.getValue<number | undefined>();
  return v == null ? dash : <span className="tabular-nums">{v}</span>;
};

const money = (info: CellContext<PlayerRow, unknown>) => {
  const v = info.getValue<number | undefined>();
  return v == null ? dash : <span className="tabular-nums">{dollars(v)}</span>;
};

/**
 * Flat column set. Groupings (GartStats / Market / Contract Info) are shown by
 * cell tint + a legend, not by spanning headers. The six rank columns
 * (kerfOvrRank, kerfPosRank, ecr, posEcr, dynastyEcr, dynPosEcr) drive tier bands
 * — see lib/tierRules.ts.
 *
 * Numeric columns use accessorFn with `?? undefined` so TanStack's
 * `sortUndefined: "last"` keeps blank values at the bottom of any sort.
 */
export const columns: ColumnDef<PlayerRow>[] = [
  // --- Identity ---
  {
    accessorKey: "owner",
    header: "Owner",
    // Manager + roster-mode gate. value = { manager, rosterMode }.
    filterFn: (row, columnId, value: RosterFilterValue) => {
      const owner = row.getValue(columnId) as string;
      const isFA = owner === FREE_AGENT;
      const { manager, rosterMode } = value;
      if (rosterMode === "FA") return isFA; // free agents only (manager ignored)
      if (manager !== MANAGER_ALL) return owner === manager; // a specific team
      if (rosterMode === "ROSTERED") return !isFA; // all rostered, no FAs
      return true; // ALL
    },
    cell: (info) => {
      const v = info.getValue<string>();
      return v === "FA" ? (
        <span className="italic text-ink-faint">FA</span>
      ) : (
        <span className="text-ink-muted">{v}</span>
      );
    },
  },
  {
    accessorKey: "name",
    header: "Player",
    cell: (info) => (
      <span className="font-medium text-ink">{info.getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "pos",
    header: "Pos",
    enableSorting: false,
    filterFn: (row, columnId, value: string) => {
      const pos = row.getValue(columnId) as Position;
      if (value === "ALL") return true;
      if (value === "SUPERFLEX") return SUPERFLEX_POSITIONS.includes(pos);
      if (value === "FLEX") return FLEX_POSITIONS.includes(pos);
      return pos === value;
    },
    cell: (info) => <PositionBadge pos={info.getValue<string>()} />,
  },
  { accessorKey: "nflTeam", header: "Team" },

  // --- GartStats (engine outputs — blank until the valuation engine exists) ---
  { id: "kerfOvrRank", accessorFn: (r) => r.kerfOvrRank ?? undefined, sortUndefined: "last", header: "Kerf Ovr Rank", cell: num },
  { id: "kerfPosRank", accessorFn: (r) => r.kerfPosRank ?? undefined, sortUndefined: "last", header: "Kerf Pos Rank", cell: posRankCell },
  { id: "projPts", accessorFn: (r) => r.projPts ?? undefined, sortUndefined: "last", sortDescFirst: true, header: "Proj Points", cell: num },
  {
    id: "kerfValue",
    accessorFn: (r) => r.kerfValue ?? undefined,
    sortUndefined: "last",
    sortDescFirst: true,
    header: "Kerf Value",
    cell: (info) => {
      const v = info.getValue<number | undefined>();
      return v == null ? dash : (
        <span className="font-semibold tabular-nums">{dollars(v)}</span>
      );
    },
  },
  {
    id: "rosterValue",
    accessorFn: (r) => r.rosterValue ?? undefined,
    sortUndefined: "last",
    sortDescFirst: true,
    header: "Roster Value",
    cell: money,
  },
  {
    id: "ceiling",
    accessorFn: (r) => r.ceiling ?? undefined,
    sortUndefined: "last",
    header: "Ceiling",
    enableSorting: true,
    cell: EditableCeilingCell,
  },

  // --- Edge (needs both engine outputs; blank until then) ---
  {
    id: "edge",
    header: "Edge",
    accessorFn: (row) =>
      row.kerfValue != null && row.marketPrice != null
        ? row.kerfValue - row.marketPrice
        : undefined,
    sortUndefined: "last",
    sortDescFirst: true,
    cell: (info) => {
      const v = info.getValue<number | undefined>();
      if (v == null) return dash;
      const sign = v > 0 ? "+" : v < 0 ? "−" : "";
      const cls = v > 0 ? "text-edge-up" : v < 0 ? "text-edge-down" : "text-edge";
      return (
        <span className={`font-medium tabular-nums ${cls}`}>
          {sign}${Math.round(Math.abs(v))}
        </span>
      );
    },
  },

  // --- Market ---
  {
    id: "marketPrice",
    accessorFn: (r) => r.marketPrice ?? undefined,
    sortUndefined: "last",
    sortDescFirst: true,
    header: "Market (Now)",
    cell: money,
  },
  {
    id: "marketPreAuction",
    accessorFn: (r) => r.marketPreAuction ?? undefined,
    sortUndefined: "last",
    sortDescFirst: true,
    header: "Market (Auction)",
    cell: money,
  },
  // Ovr ECR / Dyn Ovr ECR use the UNIQUE derived overall rank (not the raw ECR,
  // which has ties) so the sort order matches the tier ranking and bands stay
  // contiguous. Column ids stay "ecr"/"dynastyEcr" (used by tierRules/views).
  { id: "ecr", accessorFn: (r) => r.ovrEcrRank ?? undefined, sortUndefined: "last", header: "Ovr ECR", cell: num },
  { id: "posEcr", accessorFn: (r) => r.posEcr ?? undefined, sortUndefined: "last", header: "Pos ECR", cell: posRankCell },
  {
    id: "dynastyEcr",
    accessorFn: (r) => r.dynOvrRank ?? undefined,
    sortUndefined: "last",
    header: "Dyn Ovr ECR",
    cell: num,
  },
  { id: "dynPosEcr", accessorFn: (r) => r.dynPosEcr ?? undefined, sortUndefined: "last", header: "Dyn Pos ECR", cell: posRankCell },

  // --- Contract Info ---
  {
    id: "salary",
    accessorFn: (r) => r.salary ?? undefined,
    sortUndefined: "last",
    sortDescFirst: true,
    header: "Salary",
    cell: money,
  },
  {
    id: "contractYears",
    accessorFn: (r) => r.contractYears ?? undefined,
    sortUndefined: "last",
    header: "Contract",
    cell: (info) => {
      const v = info.getValue<number | undefined>();
      return v == null ? dash : <span className="tabular-nums">{v}yr</span>;
    },
  },
];

/** Leaf column ids per group, for cell tinting. */
export const GART_COLUMNS = new Set([
  "kerfOvrRank",
  "kerfPosRank",
  "projPts",
  "kerfValue",
  "rosterValue",
  "ceiling",
]);
export const MARKET_COLUMNS = new Set([
  "marketPrice",
  "marketPreAuction",
  "ecr",
  "posEcr",
  "dynastyEcr",
  "dynPosEcr",
]);
export const CONTRACT_COLUMNS = new Set(["salary", "contractYears"]);
