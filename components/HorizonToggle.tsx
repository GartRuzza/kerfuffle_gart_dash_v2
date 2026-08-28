"use client";

import type { Horizon } from "@/lib/views";

/**
 * The engine-lens toggle (issue #29): switch the table between the REST-OF-SEASON
 * numbers (season-long value + dollars) and the WEEKLY numbers (this week's
 * re-score — start/sit support, no dollars). Same columns, the data changes with
 * the lens. The Weekly option is disabled until a current-week pull has been
 * ingested and the engine has produced a weekly run (preseason: ROS only).
 *
 * It shows only the active lens's freshness — the Kerf numbers are as fresh as
 * that engine run, which can lag the data-fetch date in the top banner.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

interface Props {
  horizon: Horizon;
  onChange: (h: Horizon) => void;
  weeklyAvailable: boolean;
  weeklyWeek: number | null;
  rosRunAt: string | null;
  weeklyRunAt: string | null;
}

export default function HorizonToggle({
  horizon,
  onChange,
  weeklyAvailable,
  weeklyWeek,
  rosRunAt,
  weeklyRunAt,
}: Props) {
  const options: { value: Horizon; label: string; enabled: boolean; title?: string }[] = [
    { value: "ros", label: "Rest-of-Season", enabled: true },
    {
      value: "weekly",
      label: weeklyWeek ? `Weekly · Wk ${weeklyWeek}` : "Weekly",
      enabled: weeklyAvailable,
      title: weeklyAvailable ? undefined : "Available once a current-week pull is ingested (run archive → ingest → engine in-season)",
    },
  ];
  const freshness =
    horizon === "weekly"
      ? weeklyRunAt && `Week ${weeklyWeek ?? "?"} · updated ${fmt(weeklyRunAt)}`
      : rosRunAt && `updated ${fmt(rosRunAt)}`;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Lens</span>
      <div className="inline-flex rounded-full border border-line-strong bg-surface-raised p-0.5">
        {options.map((o) => {
          const active = horizon === o.value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={!o.enabled}
              title={o.title}
              onClick={() => o.enabled && onChange(o.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                active
                  ? "bg-accent text-accent-contrast shadow"
                  : o.enabled
                    ? "text-ink-muted hover:text-ink"
                    : "cursor-not-allowed text-ink-faint"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {freshness && <span className="text-xs text-ink-subtle">{freshness}</span>}
    </div>
  );
}
