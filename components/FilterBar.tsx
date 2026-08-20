"use client";

import { FREE_AGENT, MY_TEAM, POSITIONS, type Position } from "@/lib/types";

/** "ALL" = no roster filter; "FA" = free agents; otherwise a fantasy team name. */
export type RosterFilter = string;
/** "ALL" = no position filter; otherwise a Position. */
export type PosFilter = "ALL" | Position;

interface Props {
  teams: string[];
  rosterFilter: RosterFilter;
  onRosterChange: (v: RosterFilter) => void;
  posFilter: PosFilter;
  onPosChange: (v: PosFilter) => void;
  shown: number;
  total: number;
}

const btn = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "bg-slate-900 text-white shadow"
      : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
  }`;

export default function FilterBar({
  teams,
  rosterFilter,
  onRosterChange,
  posFilter,
  onPosChange,
  shown,
  total,
}: Props) {
  // Rival teams = everyone in the picker who isn't the owner's team.
  const rivals = teams.filter((t) => t !== MY_TEAM);

  return (
    <div className="mb-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Roster
        </span>
        <button
          type="button"
          className={btn(rosterFilter === "ALL")}
          onClick={() => onRosterChange("ALL")}
        >
          All players
        </button>
        <button
          type="button"
          className={btn(rosterFilter === MY_TEAM)}
          onClick={() => onRosterChange(MY_TEAM)}
        >
          My roster
        </button>
        <button
          type="button"
          className={btn(rosterFilter === FREE_AGENT)}
          onClick={() => onRosterChange(FREE_AGENT)}
        >
          Free agents
        </button>

        <label className="ml-1 flex items-center gap-1.5 text-sm text-slate-600">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            A team
          </span>
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Position
        </span>
        <button
          type="button"
          className={btn(posFilter === "ALL")}
          onClick={() => onPosChange("ALL")}
        >
          All
        </button>
        {POSITIONS.map((p) => (
          <button
            key={p}
            type="button"
            className={btn(posFilter === p)}
            onClick={() => onPosChange(p)}
          >
            {p}
          </button>
        ))}

        <span className="ml-auto text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-800">{shown}</span> of{" "}
          {total} players
        </span>
      </div>
    </div>
  );
}
