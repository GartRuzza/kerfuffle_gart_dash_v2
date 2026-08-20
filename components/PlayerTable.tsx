"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";

import { MOCK_PLAYERS, TEAMS } from "@/lib/mockData";
import type { PlayerRow, PositionFilter } from "@/lib/types";
import {
  DEFAULT_SORT_ID,
  positionAfterSort,
  shouldClearSortOnPositionChange,
  tierPlan,
} from "@/lib/tierRules";
import {
  columns,
  CONTRACT_COLUMNS,
  GART_COLUMNS,
  MARKET_COLUMNS,
} from "./columns";
import FilterBar, { type RosterFilter } from "./FilterBar";

/** Subtle group tint for header + body cells. */
function cellTint(id: string): string {
  if (GART_COLUMNS.has(id)) return "bg-group-gart";
  if (MARKET_COLUMNS.has(id)) return "bg-group-market";
  if (CONTRACT_COLUMNS.has(id)) return "bg-group-contract";
  return "";
}

/** Sleeker filled-caret sort indicator. */
function SortCaret({ dir }: { dir: false | "asc" | "desc" }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 8 8"
      aria-hidden
      className={`ml-1 inline-block ${dir ? "text-accent" : "text-ink-faint"}`}
    >
      {dir === "asc" ? (
        <path d="M4 1 L7.2 6 L0.8 6 Z" fill="currentColor" />
      ) : (
        <path d="M0.8 2 L7.2 2 L4 7 Z" fill="currentColor" />
      )}
    </svg>
  );
}

const GROUP_LEGEND = [
  { label: "GartStats", tint: "bg-group-gart" },
  { label: "Market", tint: "bg-group-market" },
  { label: "Contract Info", tint: "bg-group-contract" },
];

export default function PlayerTable() {
  const [data, setData] = useState<PlayerRow[]>(() =>
    MOCK_PLAYERS.map((p) => ({ ...p, ceiling: p.kerfValue })),
  );

  // Default/load: active Kerf-Ovr-Rank sort → overall Kerf tiers on.
  const [sorting, setSorting] = useState<SortingState>([
    { id: DEFAULT_SORT_ID, desc: false },
  ]);
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("ALL");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const f: ColumnFiltersState = [];
    if (rosterFilter !== "ALL") f.push({ id: "owner", value: rosterFilter });
    if (positionFilter !== "ALL") f.push({ id: "pos", value: positionFilter });
    return f;
  }, [rosterFilter, positionFilter]);

  const updateCeiling = useCallback((rowIndex: number, value: number) => {
    setData((old) =>
      old.map((row, i) => (i === rowIndex ? { ...row, ceiling: value } : row)),
    );
  }, []);

  // Sorting can auto-switch the position filter (positional rank on a multi-position).
  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    setSorting(next);
    const newColId = next[0]?.id;
    if (newColId) {
      const newPos = positionAfterSort(newColId, positionFilter);
      if (newPos !== positionFilter) setPositionFilter(newPos);
    }
  };

  // Changing the position can invalidate a positional-rank sort → clear it.
  const handlePositionChange = (newPos: PositionFilter) => {
    if (shouldClearSortOnPositionChange(sorting[0]?.id, newPos)) setSorting([]);
    setPositionFilter(newPos);
  };

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    meta: { updateCeiling },
  });

  const rows = table.getRowModel().rows;
  const leafCount = table.getVisibleLeafColumns().length;
  const { showTiers, tierField } = tierPlan(sorting[0]?.id, positionFilter);

  // Build the body, inserting a tier band whenever the tier value changes.
  const body: ReactNode[] = [];
  let lastTier: number | null = null;
  rows.forEach((row) => {
    if (showTiers && tierField) {
      const t = row.original[tierField] as number;
      if (t !== lastTier) {
        body.push(
          <tr key={`band-${tierField}-${t}`}>
            <td
              colSpan={leafCount}
              className="border-y-2 border-tier-line bg-tier-band px-3 py-1 text-xs font-bold uppercase tracking-wide text-tier-text"
            >
              Tier {t}
            </td>
          </tr>,
        );
        lastTier = t;
      }
    }
    body.push(
      <tr key={row.id} className="border-b border-line-subtle hover:bg-surface-subtle">
        {row.getVisibleCells().map((cell) => (
          <td
            key={cell.id}
            className={`whitespace-nowrap px-2.5 py-1 text-ink ${cellTint(cell.column.id)}`}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>,
    );
  });

  return (
    <section>
      <FilterBar
        teams={TEAMS}
        rosterFilter={rosterFilter}
        onRosterChange={setRosterFilter}
        positionFilter={positionFilter}
        onPositionChange={handlePositionChange}
        shown={rows.length}
        total={data.length}
      />

      {/* Group color key */}
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-ink-subtle">
        <span className="font-semibold uppercase tracking-wide">Groups:</span>
        {GROUP_LEGEND.map((g) => (
          <span key={g.label} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-3 w-4 rounded-sm ring-1 ring-line-strong ${g.tint}`} />
            {g.label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-line bg-surface">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={`whitespace-nowrap px-2.5 py-2 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-ink-muted ${cellTint(
                        header.column.id,
                      )} ${canSort ? "cursor-pointer select-none hover:text-ink" : ""}`}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort ? <SortCaret dir={sorted} /> : null}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {body}
            {rows.length === 0 && (
              <tr>
                <td colSpan={leafCount} className="px-3 py-8 text-center text-ink-subtle">
                  No players match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-ink-subtle">
        Tier bands appear when you sort by a rank column (Kerf/ECR/Dynasty,
        overall or positional). Edit any Ceiling; changes hold for this session and
        reset on reload.
      </p>
    </section>
  );
}
