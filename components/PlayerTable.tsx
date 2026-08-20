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

import { MOCK_PLAYERS, TEAMS } from "@/lib/mockData";
import type { PlayerRow, PositionFilter } from "@/lib/types";
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
  type SavedView,
  type ViewState,
} from "@/lib/views";
import { columns, CONTRACT_COLUMNS, GART_COLUMNS, MARKET_COLUMNS } from "./columns";
import FilterBar from "./FilterBar";
import ColumnPicker from "./ColumnPicker";
import ViewBar from "./ViewBar";

function cellTint(id: string): string {
  if (GART_COLUMNS.has(id)) return "bg-group-gart";
  if (MARKET_COLUMNS.has(id)) return "bg-group-market";
  if (CONTRACT_COLUMNS.has(id)) return "bg-group-contract";
  return "";
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

const GROUP_LEGEND = [
  { label: "GartStats", tint: "bg-group-gart" },
  { label: "Market", tint: "bg-group-market" },
  { label: "Contract Info", tint: "bg-group-contract" },
];

/** A draggable, sortable header cell. */
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
      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
      className={`cursor-grab touch-none whitespace-nowrap px-2.5 py-2 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-ink-muted active:cursor-grabbing ${cellTint(
        header.column.id,
      )} ${canSort ? "hover:text-ink" : ""}`}
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
      {canSort ? <SortCaret dir={sorted} /> : null}
    </th>
  );
}

const FULL_VIEW = DEFAULT_VIEWS.find((v) => v.id === DEFAULT_VIEW_ID)!;

export default function PlayerTable() {
  const [data, setData] = useState<PlayerRow[]>(() =>
    MOCK_PLAYERS.map((p) => ({ ...p, ceiling: p.kerfValue })),
  );

  // Filters + view state (initialized from the "Full" default view).
  const [sorting, setSorting] = useState<SortingState>(FULL_VIEW.state.sorting);
  const [roster, setRoster] = useState<string>(FULL_VIEW.state.roster);
  const [includeFA, setIncludeFA] = useState<boolean>(FULL_VIEW.state.includeFA);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>(FULL_VIEW.state.position);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    visibilityFromHidden(FULL_VIEW.state.hiddenColumns),
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(FULL_VIEW.state.columnOrder);

  const [customViews, setCustomViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>(DEFAULT_VIEW_ID);

  // Load saved custom views (client-only) after mount.
  useEffect(() => setCustomViews(loadCustomViews()), []);

  const allViews = useMemo(() => [...DEFAULT_VIEWS, ...customViews], [customViews]);
  const activeView = allViews.find((v) => v.id === activeViewId) ?? FULL_VIEW;

  const currentState = (): ViewState => ({
    roster,
    includeFA,
    position: positionFilter,
    sorting,
    columnOrder,
    hiddenColumns: ALL_COLUMN_IDS.filter((id) => columnVisibility[id] === false),
  });
  const dirty = JSON.stringify(currentState()) !== JSON.stringify(activeView.state);

  function applyView(view: SavedView) {
    setActiveViewId(view.id);
    setRoster(view.state.roster);
    setIncludeFA(view.state.includeFA);
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
    persist(
      customViews.map((v) => (v.id === activeViewId ? { ...v, state: currentState() } : v)),
    );
  }
  function deleteView() {
    persist(customViews.filter((v) => v.id !== activeViewId));
    applyView(FULL_VIEW);
  }

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const f: ColumnFiltersState = [{ id: "owner", value: { roster, includeFA } }];
    if (positionFilter !== "ALL") f.push({ id: "pos", value: positionFilter });
    return f;
  }, [roster, includeFA, positionFilter]);

  const updateCeiling = (rowIndex: number, value: number) =>
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

  const body: ReactNode[] = [];
  let lastTier: number | null = null;
  rows.forEach((row) => {
    if (showTiers && tierField) {
      const t = row.original[tierField] as number;
      if (t !== lastTier) {
        body.push(
          <tr key={`band-${tierField}-${t}`}>
            <td colSpan={leafCount} className="border-y-2 border-tier-line bg-tier-band px-3 py-1 text-xs font-bold uppercase tracking-wide text-tier-text">
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
          <td key={cell.id} className={`whitespace-nowrap px-2.5 py-1 text-ink ${cellTint(cell.column.id)}`}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>,
    );
  });

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
          onToggle={(id, visible) =>
            setColumnVisibility((prev) => ({ ...prev, [id]: visible }))
          }
        />
      </div>

      <div className="mb-3">
        <FilterBar
          teams={TEAMS}
          roster={roster}
          onRosterChange={setRoster}
          includeFA={includeFA}
          onIncludeFAChange={setIncludeFA}
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

      <div className="overflow-x-auto rounded-lg border border-line shadow-sm">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface">
                <SortableContext items={visibleIds} strategy={horizontalListSortingStrategy}>
                  {headers.map((header) => (
                    <SortableHeader key={header.id} header={header} />
                  ))}
                </SortableContext>
              </tr>
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
        </DndContext>
      </div>

      <p className="mt-3 text-xs text-ink-subtle">
        Drag column headers to reorder · use <span className="text-ink-muted">Columns</span> to
        show/hide · save arrangements as views. Tier bands appear when you sort by a rank column.
        Ceilings reset on reload.
      </p>
    </section>
  );
}
