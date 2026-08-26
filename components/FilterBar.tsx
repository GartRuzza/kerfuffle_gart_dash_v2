"use client";

import { type PositionFilter } from "@/lib/types";
import { MANAGER_ALL, type RosterMode } from "@/lib/views";

interface Props {
  teams: string[];
  manager: string;
  onManagerChange: (v: string) => void;
  rosterMode: RosterMode;
  onRosterModeChange: (v: RosterMode) => void;
  positionFilter: PositionFilter;
  onPositionChange: (v: PositionFilter) => void;
  shown: number;
  total: number;
}

const POSITION_OPTIONS: { value: PositionFilter; label: string }[] = [
  { value: "ALL", label: "All Positions" },
  { value: "SUPERFLEX", label: "SuperFlex (QB/RB/WR/TE)" },
  { value: "FLEX", label: "Flex (RB/WR/TE)" },
  { value: "QB", label: "QB" },
  { value: "RB", label: "RB" },
  { value: "WR", label: "WR" },
  { value: "TE", label: "TE" },
  { value: "DST", label: "DST" },
];

const ROSTER_MODES: { value: RosterMode; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ROSTERED", label: "Rostered" },
  { value: "FA", label: "Free Agents" },
];

const selectCls =
  "rounded-md border border-line-strong bg-surface-raised px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40";
const labelCls = "text-xs font-semibold uppercase tracking-wide text-ink-subtle";

export default function FilterBar({
  teams,
  manager,
  onManagerChange,
  rosterMode,
  onRosterModeChange,
  positionFilter,
  onPositionChange,
  shown,
  total,
}: Props) {
  const faOnly = rosterMode === "FA";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-sm">
      {/* 3-way roster-status toggle (sliding segmented control) */}
      <div className="inline-flex rounded-full border border-line-strong bg-surface-raised p-0.5">
        {ROSTER_MODES.map((m) => {
          const active = rosterMode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => onRosterModeChange(m.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                active
                  ? "bg-accent text-accent-contrast shadow"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-1.5">
        <span className={labelCls}>Manager</span>
        <select
          className={selectCls}
          value={manager}
          disabled={faOnly}
          onChange={(e) => onManagerChange(e.target.value)}
          title={faOnly ? "Not applicable when showing free agents" : undefined}
        >
          <option value={MANAGER_ALL}>All</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className={labelCls}>Position</span>
        <select
          className={selectCls}
          value={positionFilter}
          onChange={(e) => onPositionChange(e.target.value as PositionFilter)}
        >
          {POSITION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <span className="ml-auto text-sm text-ink-subtle">
        Showing <span className="font-semibold text-ink">{shown}</span> of {total}
      </span>
    </div>
  );
}
