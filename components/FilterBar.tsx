"use client";

import { FREE_AGENT, MY_TEAM, type PositionFilter } from "@/lib/types";

/** "ALL" = no roster filter; "FA" = free agents; otherwise a fantasy team name. */
export type RosterFilter = string;

interface Props {
  teams: string[];
  rosterFilter: RosterFilter;
  onRosterChange: (v: RosterFilter) => void;
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

const btn = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "bg-accent text-accent-contrast shadow"
      : "bg-surface-raised text-ink-muted ring-1 ring-line-strong hover:bg-surface-subtle"
  }`;

const selectCls =
  "rounded-md border border-line-strong bg-surface-raised px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export default function FilterBar({
  teams,
  rosterFilter,
  onRosterChange,
  positionFilter,
  onPositionChange,
  shown,
  total,
}: Props) {
  const rivals = teams.filter((t) => t !== MY_TEAM);

  return (
    <div className="mb-3 flex flex-col gap-3 rounded-lg border border-line bg-surface p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Roster
        </span>
        <button type="button" className={btn(rosterFilter === "ALL")} onClick={() => onRosterChange("ALL")}>
          All players
        </button>
        <button type="button" className={btn(rosterFilter === MY_TEAM)} onClick={() => onRosterChange(MY_TEAM)}>
          My roster
        </button>
        <button type="button" className={btn(rosterFilter === FREE_AGENT)} onClick={() => onRosterChange(FREE_AGENT)}>
          Free agents
        </button>
        <label className="ml-1 flex items-center gap-1.5 text-sm text-ink-muted">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            A team
          </span>
          <select
            className={selectCls}
            value={rivals.includes(rosterFilter) ? rosterFilter : ""}
            onChange={(e) => {
              if (e.target.value) onRosterChange(e.target.value);
            }}
          >
            <option value="">Choose…</option>
            {rivals.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Position
        </span>
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

        <span className="ml-auto text-sm text-ink-subtle">
          Showing <span className="font-semibold text-ink">{shown}</span> of {total} players
        </span>
      </div>
    </div>
  );
}
