import type { ColumnDef } from "@tanstack/react-table";
import type { PlayerRow } from "@/lib/types";
import TierBadge from "./TierBadge";
import EditableCeilingCell from "./EditableCeilingCell";

const dollars = (n: number) => `$${n}`;

/**
 * Column definitions for the player table.
 *
 * The "both numbers" pairing (vision principle 2) is expressed structurally:
 *  - a "Yours" group  → KERF Value + editable Ceiling
 *  - an "Edge" column → KERF Value − Market Price (the gap, as one sortable number)
 *  - a "The Market" group → Market Price + ECR + Dynasty ECR
 *
 * Group/leaf ids are used by PlayerTable to tint the columns (Yours vs Market)
 * so the gap reads at a glance.
 */
export const columns: ColumnDef<PlayerRow>[] = [
  {
    accessorKey: "owner",
    header: "Owner",
    filterFn: "equalsString",
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
    filterFn: "equalsString",
  },
  {
    accessorKey: "nflTeam",
    header: "Team",
  },
  {
    accessorKey: "tier",
    header: "Tier",
    cell: (info) => <TierBadge tier={info.getValue<number>()} />,
  },

  // ---- "Yours" group: the owner's numbers ----
  {
    id: "yoursGroup",
    header: "Yours",
    columns: [
      {
        accessorKey: "kerfRank",
        header: "KERF Rank",
        enableSorting: false, // a positional label (RB1); sort by value/points instead
        cell: (info) => (
          <span className="font-semibold text-yours-text">
            {info.getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "projPts",
        header: "Proj Pts",
        cell: (info) => (
          <span className="tabular-nums">{info.getValue<number>()}</span>
        ),
      },
      {
        accessorKey: "kerfValue",
        header: "KERF Value",
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
    ],
  },

  // ---- Edge: the gap between the two, as one sortable number ----
  {
    id: "edge",
    header: "Edge",
    accessorFn: (row) => row.kerfValue - row.marketPrice,
    sortDescFirst: true,
    cell: (info) => {
      const v = info.getValue<number>();
      const cls =
        v > 0 ? "text-edge-up" : v < 0 ? "text-edge-down" : "text-edge-flat";
      const sign = v > 0 ? "+" : v < 0 ? "−" : "";
      return (
        <span className={`font-bold tabular-nums ${cls}`}>
          {sign}${Math.abs(v)}
        </span>
      );
    },
  },

  // ---- "The Market" group: the consensus / price numbers ----
  {
    id: "marketGroup",
    header: "The Market",
    columns: [
      {
        accessorKey: "marketPrice",
        header: "Market Price",
        cell: (info) => (
          <span className="tabular-nums">{dollars(info.getValue<number>())}</span>
        ),
      },
      {
        accessorKey: "ecr",
        header: "ECR",
        cell: (info) => (
          <span className="tabular-nums">{info.getValue<number>()}</span>
        ),
      },
      {
        accessorKey: "dynastyEcr",
        header: "Dynasty ECR",
        cell: (info) => (
          <span className="tabular-nums">{info.getValue<number>()}</span>
        ),
      },
    ],
  },

  {
    accessorKey: "salary",
    header: "Salary",
    cell: (info) => {
      const v = info.getValue<number>();
      return (
        <span className="tabular-nums">{v > 0 ? dollars(v) : "—"}</span>
      );
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

/** Leaf column ids that belong to the "Yours" group (for tinting). */
export const YOURS_COLUMNS = new Set([
  "kerfRank",
  "projPts",
  "kerfValue",
  "ceiling",
]);
/** Leaf column ids that belong to the "The Market" group (for tinting). */
export const MARKET_COLUMNS = new Set(["marketPrice", "ecr", "dynastyEcr"]);
