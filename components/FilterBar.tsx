"use client";

import { type PositionFilter } from "@/lib/types";
import { ROSTER_ALL, ROSTER_FA } from "@/lib/views";

interface Props {
  teams: string[];
  roster: string;
  onRosterChange: (v: string) => void;
  includeFA: boolean;
  onIncludeFAChange: (v: boolean) => void;
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
];

const selectCls =
  "rounded-md border border-line-strong bg-surface-raised px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const labelCls =
  "text-xs font-semibold uppercase tracking-wide text-ink-subtle";

export default function FilterBar({
  teams,
  roster,
  onRosterChange,
  includeFA,
  onIncludeFAChange,
  positionFilter,
  onPositionChange,
  shown,
  total,
}: Props) {
  const faOnly = roster === ROSTER_FA;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-sm">
      <label className="flex items-center gap-1.5">
        <span className={labelCls}>Roster</span>
        <select
          className={selectCls}
          value={roster}
          onChange={(e) => onRosterChange(e.target.value)}
        >
          <option value={ROSTER_ALL}>All Players</option>
          <option value={ROSTER_FA}>Free Agents</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label
        className={`flex items-center gap-1.5 ${faOnly ? "opacity-40" : ""}`}
        title={
          faOnly
            ? "Already showing free agents only"
            : "Also include free agents in this view"
        }
      >
        <input
          type="checkbox"
          className="h-4 w-4 accent-accent"
          checked={faOnly ? true : includeFA}
          disabled={faOnly}
          onChange={(e) => onIncludeFAChange(e.target.checked)}
        />
        <span className={labelCls}>Include free agents</span>
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
