"use client";

import { normalize, ordinal, type RankedTeam, type StarterSlot, type Stats } from "@/lib/powerRankings";
import { bandBg, bandText } from "./colors";
import { useTooltip } from "./useTooltip";

/**
 * "Starting Lineup" chart (issue #32) — one vertical bar per offensive starter
 * slot. Height is **value-relative to the league** at that slot (worst → floor,
 * best → full, `normalize`), with a **league-median** guide line, so a #9 slot
 * reads clearly shorter than a #1. No player photos (no image source) — the name +
 * slot label stand in; actual points/rank/range appear on hover.
 */
const CHART_H = 150; // px, the plot height

export default function StartingLineup({
  team,
  teamName,
  slotStats,
  total,
}: {
  team: RankedTeam;
  teamName?: string;
  slotStats: Record<StarterSlot, Stats>;
  total: number;
}) {
  const tip = useTooltip();
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h3 className="mb-3 text-sm font-bold text-ink">
        {`Starting Lineup${teamName ? ` — ${teamName}` : ""}`}
      </h3>
      <div className="flex items-end justify-between gap-1 overflow-x-auto">
        {team.lineup.map((slot) => {
          const st = slotStats[slot.slot];
          const h = slot.player ? Math.max(6, Math.round(normalize(slot.points, st) * CHART_H)) : 0;
          const medianH = Math.round(normalize(st.median, st) * CHART_H);
          const rank = team.slotRank[slot.slot];
          return (
            <div
              key={slot.slot}
              className="flex min-w-[3rem] flex-1 flex-col items-center gap-1"
              onMouseEnter={(e) =>
                tip.show(e, `${slot.label}${slot.player ? ` — ${slot.player.name}` : ""}`, [
                  { label: "Rank", value: `${ordinal(rank)} of ${total}`, strong: true },
                  { label: "Kerf pts", value: slot.points.toFixed(1), strong: true },
                  { label: "League median", value: st.median.toFixed(1) },
                  { label: "League range", value: `${st.min.toFixed(0)}–${st.max.toFixed(0)}` },
                ])
              }
              onMouseMove={tip.move}
              onMouseLeave={tip.hide}
            >
              <span className={`text-[11px] font-bold ${bandText(rank, total)}`}>#{rank}</span>
              <div className="relative flex h-[150px] w-full items-end justify-center">
                {/* League median guide */}
                <span
                  className="absolute left-0 w-full border-t border-dashed border-ink"
                  style={{ bottom: `${medianH}px`, opacity: 0.4 }}
                  aria-hidden
                />
                {slot.player ? (
                  <div className={`w-8 rounded-t ${bandBg(rank, total)}`} style={{ height: `${h}px` }} />
                ) : (
                  <div className="pb-2 text-ink-faint">—</div>
                )}
              </div>
              <span
                className="line-clamp-1 h-4 w-full text-center text-[10px] text-ink-muted"
                title={slot.player?.name ?? ""}
              >
                {slot.player ? abbrevName(slot.player.name) : ""}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                {slot.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[10px] text-ink-subtle">
        <span className="inline-block w-3 border-t border-dashed border-ink opacity-40" /> league median · height = value vs. league · hover for points
      </p>
      {tip.node}
    </section>
  );
}

/** "Christian McCaffrey" -> "C. McCaffrey" to fit the narrow columns. */
function abbrevName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}
