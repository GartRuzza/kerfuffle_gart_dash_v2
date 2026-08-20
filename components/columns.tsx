import type { CellContext, ColumnDef } from "@tanstack/react-table";
import {
  FLEX_POSITIONS,
  FREE_AGENT,
  type PlayerRow,
  type Position,
} from "@/lib/types";
import { ROSTER_ALL, ROSTER_FA } from "@/lib/views";
import PositionBadge from "./PositionBadge";
import EditableCeilingCell from "./EditableCeilingCell";

const dollars = (n: number) => `$${n}`;

/** Positional-rank cells render as "WR3" (position + within-position rank). */
const posRankCell = (info: CellContext<PlayerRow, unknown>) => (
  <span className="tabular-nums">
    {info.row.original.pos}
    {info.getValue<number>()}
  </span>
);

const num = (info: CellContext<PlayerRow, unknown>) => (
  <span className="tabular-nums">{info.getValue<number>()}</span>
);

/**
 * Flat column set. Groupings (GartStats / Market / Contract Info) are shown by
 * cell tint + a legend, not by spanning headers. The six rank columns
 * (kerfOvrRank, kerfPosRank, ecr, posEcr, dynastyEcr, dynPosEcr) drive tier bands
 * — see lib/tierRules.ts.
 */
export const columns: ColumnDef<PlayerRow>[] = [
  // --- Identity ---
  {
    accessorKey: "owner",
    header: "Owner",
    // Roster/free-agent gate. value = { roster, includeFA }.
    filterFn: (row, columnId, value: { roster: string; includeFA: boolean }) => {
      const owner = row.getValue(columnId) as string;
      const isFA = owner === FREE_AGENT;
      const { roster, includeFA } = value;
      if (roster === ROSTER_ALL) return isFA ? includeFA : true;
      if (roster === ROSTER_FA) return isFA;
      return owner === roster || (isFA && includeFA);
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
      if (value === "ALL" || value === "SUPERFLEX") return true;
      if (value === "FLEX") return FLEX_POSITIONS.includes(pos);
      return pos === value;
    },
    cell: (info) => <PositionBadge pos={info.getValue<string>()} />,
  },
  { accessorKey: "nflTeam", header: "Team" },

  // --- GartStats ---
  { accessorKey: "kerfOvrRank", header: "Kerf Ovr Rank", cell: num },
  { accessorKey: "kerfPosRank", header: "Kerf Pos Rank", cell: posRankCell },
  { accessorKey: "projPts", header: "Proj Points", cell: num },
  {
    accessorKey: "kerfValue",
    header: "Kerf Value",
    cell: (info) => (
      <span className="font-semibold tabular-nums">
        {dollars(info.getValue<number>())}
      </span>
    ),
  },
  {
    accessorKey: "ceiling",
    header: "Ceiling",
    enableSorting: true,
    cell: EditableCeilingCell,
  },

  // --- Edge (plain, no color) ---
  {
    id: "edge",
    header: "Edge",
    accessorFn: (row) => row.kerfValue - row.marketPrice,
    sortDescFirst: true,
    cell: (info) => {
      const v = info.getValue<number>();
      const sign = v > 0 ? "+" : v < 0 ? "−" : "";
      const cls = v > 0 ? "text-edge-up" : v < 0 ? "text-edge-down" : "text-edge";
      return (
        <span className={`font-medium tabular-nums ${cls}`}>
          {sign}${Math.abs(v)}
        </span>
      );
    },
  },

  // --- Market ---
  {
    accessorKey: "marketPrice",
    header: "Market Value",
    cell: (info) => (
      <span className="tabular-nums">{dollars(info.getValue<number>())}</span>
    ),
  },
  { accessorKey: "ecr", header: "Ovr ECR", cell: num },
  { accessorKey: "posEcr", header: "Pos ECR", cell: posRankCell },
  { accessorKey: "dynastyEcr", header: "Dyn Ovr ECR", cell: num },
  { accessorKey: "dynPosEcr", header: "Dyn Pos ECR", cell: posRankCell },

  // --- Contract Info ---
  {
    accessorKey: "salary",
    header: "Salary",
    cell: (info) => {
      const v = info.getValue<number>();
      return <span className="tabular-nums">{v > 0 ? dollars(v) : "—"}</span>;
    },
  },
  {
    accessorKey: "contractYears",
    header: "Contract",
    cell: (info) => {
      const v = info.getValue<number | null>();
      return <span className="tabular-nums">{v ? `${v}yr` : "—"}</span>;
    },
  },
];

/** Leaf column ids per group, for cell tinting. */
export const GART_COLUMNS = new Set([
  "kerfOvrRank",
  "kerfPosRank",
  "projPts",
  "kerfValue",
  "ceiling",
]);
export const MARKET_COLUMNS = new Set([
  "marketPrice",
  "ecr",
  "posEcr",
  "dynastyEcr",
  "dynPosEcr",
]);
export const CONTRACT_COLUMNS = new Set(["salary", "contractYears"]);
