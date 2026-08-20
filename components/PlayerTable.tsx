"use client";

import { useCallback, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";

import { MOCK_PLAYERS, TEAMS } from "@/lib/mockData";
import type { PlayerRow } from "@/lib/types";
import { columns, MARKET_COLUMNS, YOURS_COLUMNS } from "./columns";
import FilterBar, { type PosFilter, type RosterFilter } from "./FilterBar";

/** Tint for the group-header cells so "Yours" vs "The Market" is obvious. */
function groupHeaderTint(id: string): string {
  if (id === "yoursGroup") return "bg-sky-100 text-sky-900";
  if (id === "marketGroup") return "bg-slate-200 text-slate-700";
  if (id === "edge") return "bg-emerald-50 text-emerald-800";
  return "text-slate-600";
}

/** Tint for leaf header + body cells so the paired columns read as a block. */
function leafTint(id: string): string {
  if (YOURS_COLUMNS.has(id)) return "bg-sky-50";
  if (MARKET_COLUMNS.has(id)) return "bg-slate-100";
  if (id === "edge") return "bg-emerald-50";
  return "";
}

export default function PlayerTable() {
  // Full dataset lives here; ceilings are pre-seeded to KERF Value. We never
  // pre-filter this array — TanStack does the filtering so that `row.index`
  // stays the original index the editable-ceiling writes are keyed on.
  const [data, setData] = useState<PlayerRow[]>(() =>
    MOCK_PLAYERS.map((p) => ({ ...p, ceiling: p.kerfValue })),
  );

  const [sorting, setSorting] = useState<SortingState>([]);
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("ALL");
  const [posFilter, setPosFilter] = useState<PosFilter>("ALL");

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const f: ColumnFiltersState = [];
    if (rosterFilter !== "ALL") f.push({ id: "owner", value: rosterFilter });
    if (posFilter !== "ALL") f.push({ id: "pos", value: posFilter });
    return f;
  }, [rosterFilter, posFilter]);

  const updateCeiling = useCallback((rowIndex: number, value: number) => {
    setData((old) =>
      old.map((row, i) => (i === rowIndex ? { ...row, ceiling: value } : row)),
    );
  }, []);

  const table = useReactTable({
    data,
    columns,
    // columnFilters is controlled + read-only (derived from the two selects).
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    meta: { updateCeiling },
  });

  const shown = table.getFilteredRowModel().rows.length;

  return (
    <section>
      <FilterBar
        teams={TEAMS}
        rosterFilter={rosterFilter}
        onRosterChange={setRosterFilter}
        posFilter={posFilter}
        onPosChange={setPosFilter}
        shown={shown}
        total={data.length}
      />

      <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-200">
                {headerGroup.headers.map((header) => {
                  const isLeaf = header.subHeaders.length === 0;
                  const canSort = isLeaf && header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const tint = isLeaf
                    ? leafTint(header.column.id)
                    : groupHeaderTint(header.column.id);
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className={`whitespace-nowrap px-3 py-2 text-left align-bottom font-semibold ${tint} ${
                        canSort ? "cursor-pointer select-none hover:bg-black/5" : ""
                      } ${!isLeaf ? "text-center" : ""}`}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {canSort
                        ? { asc: " ▲", desc: " ▼" }[sorted as string] ?? " ↕"
                        : null}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-100 last:border-0 hover:bg-amber-50/40"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`whitespace-nowrap px-3 py-1.5 ${leafTint(cell.column.id)}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {shown === 0 && (
              <tr>
                <td
                  colSpan={table.getAllLeafColumns().length}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  No players match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Blue = <span className="font-semibold text-sky-700">your numbers</span>{" "}
        (KERF Value &amp; Ceiling). Gray ={" "}
        <span className="font-semibold text-slate-600">the market</span> (Price,
        ECR, Dynasty ECR).{" "}
        <span className="font-semibold text-emerald-700">Edge</span> = KERF Value −
        Market Price. Edit any Ceiling; changes hold for this session and reset on
        reload.
      </p>
    </section>
  );
}
