"use client";

import { normalize, ordinal, type Stats } from "@/lib/powerRankings";
import { bandBg, bandText } from "./colors";
import { useTooltip } from "./useTooltip";

/**
 * A labelled horizontal bar list with a league rank per row (issue #32) — the
 * shared visual behind both "Positional Rankings" and "Starter Rankings".
 *
 * Bar length is **value-relative to the league** (worst team → empty, best → full,
 * `normalize`), so ranks spread out and real gaps show as real gaps. A **median
 * tick** marks the league midpoint on each track. The right label stays the rank;
 * no numbers are printed on the bars (owner: keep them clean) — the actual points,
 * rank, median and range appear on **hover**.
 */
export interface RankBarRow {
  key: string;
  label: string;
  value: number;
  rank: number;
  stats: Stats;
  /** Optional: visually separate a summary row (STARTERS / BENCH). */
  emphasize?: boolean;
}

export default function RankBarList({
  title,
  rows,
  total,
}: {
  title: string;
  rows: RankBarRow[];
  total: number;
}) {
  const tip = useTooltip();
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h3 className="mb-3 text-sm font-bold text-ink">{title}</h3>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const pct = Math.max(2, Math.round(normalize(r.value, r.stats) * 100));
          const medianPct = Math.round(normalize(r.stats.median, r.stats) * 100);
          return (
            <div
              key={r.key}
              className={`flex items-center gap-3 ${r.emphasize ? "border-t border-line-subtle pt-2" : ""}`}
              onMouseEnter={(e) =>
                tip.show(e, r.label, [
                  { label: "Rank", value: `${ordinal(r.rank)} of ${total}`, strong: true },
                  { label: "Kerf pts", value: r.value.toFixed(1), strong: true },
                  { label: "League median", value: r.stats.median.toFixed(1) },
                  { label: "League range", value: `${r.stats.min.toFixed(0)}–${r.stats.max.toFixed(0)}` },
                ])
              }
              onMouseMove={tip.move}
              onMouseLeave={tip.hide}
            >
              <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {r.label}
              </span>
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-rank-track">
                <div className={`h-full rounded-full ${bandBg(r.rank, total)}`} style={{ width: `${pct}%` }} />
                {/* League median tick */}
                <span
                  className="absolute top-0 h-full w-px bg-ink"
                  style={{ left: `${medianPct}%`, opacity: 0.55 }}
                  aria-hidden
                />
              </div>
              <span className={`w-10 shrink-0 text-right text-xs font-bold ${bandText(r.rank, total)}`}>
                {ordinal(r.rank)}
              </span>
            </div>
          );
        })}
      </div>
      {/* Legend for the tick */}
      <p className="mt-3 flex items-center gap-1.5 text-[10px] text-ink-subtle">
        <span className="inline-block h-3 w-px bg-ink opacity-55" /> league median · bar length = value vs. league (worst→best) · hover for points
      </p>
      {tip.node}
    </section>
  );
}
