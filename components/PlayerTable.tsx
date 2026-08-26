"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ColumnOrderState,
  type Header,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Player, PlayerRow, PositionFilter } from "@/lib/types";
import {
  positionAfterSort,
  shouldClearSortOnPositionChange,
  tierPlan,
} from "@/lib/tierRules";
import {
  ALL_COLUMN_IDS,
  DEFAULT_VIEWS,
  DEFAULT_VIEW_ID,
  loadCustomViews,
  nextCustomViewId,
  saveCustomViews,
  visibilityFromHidden,
  type RosterMode,
  type SavedView,
  type ViewState,
} from "@/lib/views";
import { columns, CONTRACT_COLUMNS, GART_COLUMNS, MARKET_COLUMNS } from "./columns";
import FilterBar from "./FilterBar";
import ColumnPicker from "./ColumnPicker";
import ViewBar from "./ViewBar";
import DataDictionary from "./DataDictionary";

function cellTint(id: string): string {
  if (GART_COLUMNS.has(id)) return "bg-group-gart";
  if (MARKET_COLUMNS.has(id)) return "bg-group-market";
  if (CONTRACT_COLUMNS.has(id)) return "bg-group-contract";
  return "";
}

/** Header cell classes. Sticky + opaque bg so it stays readable over scrolling rows. */
function headerClass(id: string, canSort: boolean): string {
  return `sticky top-0 z-10 touch-none whitespace-nowrap px-2.5 py-2 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-ink-muted ${
    cellTint(id) || "bg-surface"
  } ${canSort ? "hover:text-ink" : ""}`;
}

function ariaSort(dir: false | "asc" | "desc") {
  return dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined;
}

function SortCaret({ dir }: { dir: false | "asc" | "desc" }) {
  return (
    <svg width="9" height="9" viewBox="0 0 8 8" aria-hidden className={`ml-1 inline-block ${dir ? "text-accent" : "text-ink-faint"}`}>
      {dir === "asc" ? (
        <path d="M4 1 L7.2 6 L0.8 6 Z" fill="currentColor" />
      ) : (
        <path d="M0.8 2 L7.2 2 L4 7 Z" fill="currentColor" />
      )}
    </svg>
  );
}

/** Plain header (server + pre-mount): sortable-on-click, no drag — avoids the
 * @dnd-kit SSR id mismatch by only enabling drag after the client mounts. */
function PlainHeader({ header }: { header: Header<PlayerRow, unknown> }) {
  const canSort = header.column.getCanSort();
  const sorted = header.column.getIsSorted();
  return (
    <th
      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
      aria-sort={ariaSort(sorted)}
      className={`${headerClass(header.column.id, canSort)} ${canSort ? "cursor-pointer" : ""}`}
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
      {canSort ? <SortCaret dir={sorted} /> : null}
    </th>
  );
}

/** Draggable + sortable header (after mount). */
function SortableHeader({ header }: { header: Header<PlayerRow, unknown> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: header.column.id });
  const canSort = header.column.getCanSort();
  const sorted = header.column.getIsSorted();
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <th
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
      aria-sort={ariaSort(sorted)}
      className={`${headerClass(header.column.id, canSort)} cursor-grab active:cursor-grabbing`}
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
      {canSort ? <SortCaret dir={sorted} /> : null}
    </th>
  );
}

const GROUP_LEGEND = [
  { label: "GartStats", tint: "bg-group-gart" },
  { label: "Market", tint: "bg-group-market" },
  { label: "Contract Info", tint: "bg-group-contract" },
];

const FULL_VIEW = DEFAULT_VIEWS.find((v) => v.id === DEFAULT_VIEW_ID)!;

interface Props {
  /** Real league data from the data-access module (lib/data/board.ts). */
  players: Player[];
  /** The fantasy team names for the Manager filter (owner's team first). */
  teams: string[];
}

export default function PlayerTable({ players, teams }: Props) {
  const [data, setData] = useState<PlayerRow[]>(() =>
    // Ceiling seeds from the Kerf model's value — null (blank) until the engine exists.
    players.map((p) => ({ ...p, ceiling: p.kerfValue })),
  );

  const [sorting, setSorting] = useState<SortingState>(FULL_VIEW.state.sorting);
  const [manager, setManager] = useState<string>(FULL_VIEW.state.manager);
  const [rosterMode, setRosterMode] = useState<RosterMode>(FULL_VIEW.state.rosterMode);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>(FULL_VIEW.state.position);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    visibilityFromHidden(FULL_VIEW.state.hiddenColumns),
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(FULL_VIEW.state.columnOrder);

  const [customViews, setCustomViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>(DEFAULT_VIEW_ID);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCustomViews(loadCustomViews());
    setMounted(true); // enable drag only after mount (avoids SSR hydration mismatch)
  }, []);

  const allViews = useMemo(() => [...DEFAULT_VIEWS, ...customViews], [customViews]);
  const activeView = allViews.find((v) => v.id === activeViewId) ?? FULL_VIEW;

  const currentState = (): ViewState => ({
    manager,
    rosterMode,
    position: positionFilter,
    sorting,
    columnOrder,
    hiddenColumns: ALL_COLUMN_IDS.filter((id) => columnVisibility[id] === false),
  });
  const dirty = JSON.stringify(currentState()) !== JSON.stringify(activeView.state);

  function applyView(view: SavedView) {
    setActiveViewId(view.id);
    setManager(view.state.manager);
    setRosterMode(view.state.rosterMode);
    setPositionFilter(view.state.position);
    setSorting(view.state.sorting);
    setColumnOrder(view.state.columnOrder);
    setColumnVisibility(visibilityFromHidden(view.state.hiddenColumns));
  }
  function persist(next: SavedView[]) {
    setCustomViews(next);
    saveCustomViews(next);
  }
  function saveNewView() {
    const name = window.prompt("Name this view:")?.trim();
    if (!name) return;
    const view: SavedView = {
      id: nextCustomViewId(customViews),
      name,
      builtIn: false,
      state: currentState(),
    };
    persist([...customViews, view]);
    setActiveViewId(view.id);
  }
  function updateView() {
    persist(customViews.map((v) => (v.id === activeViewId ? { ...v, state: currentState() } : v)));
  }
  function deleteView() {
    persist(customViews.filter((v) => v.id !== activeViewId));
    applyView(FULL_VIEW);
  }

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const f: ColumnFiltersState = [{ id: "owner", value: { manager, rosterMode } }];
    if (positionFilter !== "ALL") f.push({ id: "pos", value: positionFilter });
    return f;
  }, [manager, rosterMode, positionFilter]);

  const updateCeiling = (rowIndex: number, value: number | null) =>
    setData((old) => old.map((row, i) => (i === rowIndex ? { ...row, ceiling: value } : row)));

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    setSorting(next);
    const newColId = next[0]?.id;
    if (newColId) {
      const newPos = positionAfterSort(newColId, positionFilter);
      if (newPos !== positionFilter) setPositionFilter(newPos);
    }
  };
  const handlePositionChange = (newPos: PositionFilter) => {
    if (shouldClearSortOnPositionChange(sorting[0]?.id, newPos)) setSorting([]);
    setPositionFilter(newPos);
  };

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, columnOrder },
    onSortingChange: handleSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    meta: { updateCeiling },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setColumnOrder((prev) => {
      const from = prev.indexOf(active.id as string);
      const to = prev.indexOf(over.id as string);
      return from < 0 || to < 0 ? prev : arrayMove(prev, from, to);
    });
  };

  const rows = table.getRowModel().rows;
  const leafCount = table.getVisibleLeafColumns().length;
  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const visibleIds = headers.map((h) => h.column.id);
  const { showTiers, tierField } = tierPlan(sorting[0]?.id, positionFilter);

  // Build the body, inserting a tier band whenever the tier value changes.
  // A null tier (player not on that ranking board) gets one "Unranked" band —
  // those rows sort to the bottom, so it appears once at the end. Band keys
  // carry a running index so they never collide even if (defensively) a tier
  // value ever appeared in two groups.
  const body: ReactNode[] = [];
  let lastTier: number | null | undefined = undefined;
  let bandIdx = 0;
  rows.forEach((row) => {
    if (showTiers && tierField) {
      const t = row.original[tierField] as number | null;
      if (t !== lastTier) {
        body.push(
          <tr key={`band-${bandIdx++}`}>
            <td colSpan={leafCount} className="border-y-2 border-tier-line bg-tier-band px-3 py-1 text-xs font-bold uppercase tracking-wide text-tier-text">
              {t == null ? "Unranked" : `Tier ${t}`}
            </td>
          </tr>,
        );
        lastTier = t;
      }
    }
    body.push(
      <tr key={row.id} className="border-b border-line-subtle hover:bg-surface-subtle">
        {row.getVisibleCells().map((cell) => (
          <td key={cell.id} className={`whitespace-nowrap px-2.5 py-1 text-ink ${cellTint(cell.column.id)}`}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>,
    );
  });

  const headerCells = mounted ? (
    <SortableContext items={visibleIds} strategy={horizontalListSortingStrategy}>
      {headers.map((header) => (
        <SortableHeader key={header.id} header={header} />
      ))}
    </SortableContext>
  ) : (
    headers.map((header) => <PlainHeader key={header.id} header={header} />)
  );

  const tableEl = (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>{headerCells}</tr>
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
  );

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ViewBar
          views={allViews}
          activeId={activeViewId}
          activeIsCustom={!activeView.builtIn}
          dirty={dirty}
          onSelect={(id) => {
            const v = allViews.find((x) => x.id === id);
            if (v) applyView(v);
          }}
          onSaveNew={saveNewView}
          onUpdate={updateView}
          onDelete={deleteView}
        />
        <ColumnPicker
          order={columnOrder}
          visibility={columnVisibility}
          onToggle={(id, visible) => setColumnVisibility((prev) => ({ ...prev, [id]: visible }))}
        />
      </div>

      <div className="mb-3">
        <FilterBar
          teams={teams}
          manager={manager}
          onManagerChange={setManager}
          rosterMode={rosterMode}
          onRosterModeChange={setRosterMode}
          positionFilter={positionFilter}
          onPositionChange={handlePositionChange}
          shown={rows.length}
          total={data.length}
        />
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-ink-subtle">
        <span className="font-semibold uppercase tracking-wide">Groups:</span>
        {GROUP_LEGEND.map((g) => (
          <span key={g.label} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-3 w-4 rounded-sm ring-1 ring-line-strong ${g.tint}`} />
            {g.label}
          </span>
        ))}
      </div>

      <div className="max-h-[calc(100vh-15rem)] overflow-auto rounded-lg border border-line shadow-sm">
        {mounted ? (
          <DndContext id="players-table" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            {tableEl}
          </DndContext>
        ) : (
          tableEl
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <DataDictionary />
        <p className="text-xs text-ink-subtle">
          Drag column headers to reorder · use <span className="text-ink-muted">Columns</span> to
          show/hide · save arrangements as views. Tier bands appear when you sort by a rank column.
          Ceilings reset on reload.
        </p>
      </div>
    </section>
  );
}
