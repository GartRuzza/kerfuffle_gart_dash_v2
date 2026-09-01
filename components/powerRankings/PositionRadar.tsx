"use client";

import { useState } from "react";
import {
  normalize,
  ordinal,
  POS_GROUPS,
  type PosGroup,
  type RankedTeam,
  type Stats,
} from "@/lib/powerRankings";
import { useTooltip } from "./useTooltip";

/**
 * "Position Strength" radar (issue #32) — the shape of a team's roster across the
 * offensive axes QB/RB/WR/TE/FLEX/SFLX, as a **relative-to-league** view (owner's
 * spec): each axis is independently scaled so the league's WEAKEST team sits at the
 * center and the STRONGEST at the edge (`normalize` over the per-axis distribution).
 * That answers "where do I rank by position, in real value" — not a shared-unit
 * comparison across axes (the usual radar caveat), which is exactly the intent.
 *
 * A **Starters / Bench / Both** pill switches the metric (Starters = the optimal
 * lineup's per-group points; Bench = the team's AVERAGE bench value per position).
 * A dashed **league-median** polygon is the reference; every vertex is hoverable
 * for the actual rank + points. Hand-drawn SVG — no charting dependency.
 */
const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 118;
const RINGS = 4;

type View = "starters" | "bench" | "both";

function point(i: number, n: number, r01: number): [number, number] {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const r = RADIUS * Math.max(0, Math.min(1, r01));
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}
const polygon = (vals: number[]): string =>
  vals.map((v, i) => point(i, vals.length, v).join(",")).join(" ");

interface Series {
  key: "starters" | "bench";
  label: string;
  fill: string; // tailwind fill-* class
  stroke: string; // tailwind stroke-* class
  dot: string; // tailwind bg-* class (written in full so it survives purge)
  value: (g: PosGroup) => number;
  rank: (g: PosGroup) => number;
  stats: (g: PosGroup) => Stats;
}

export default function PositionRadar({
  team,
  teamName,
  groupStats,
  benchAxisStats,
  total,
}: {
  team: RankedTeam;
  teamName?: string;
  /** Starter-axis distributions (= groupStats for POS_GROUPS). */
  groupStats: Record<string, Stats>;
  /** Bench-axis distributions (average bench value per position). */
  benchAxisStats: Record<PosGroup, Stats>;
  total: number;
}) {
  const [view, setView] = useState<View>("starters");
  const tip = useTooltip();
  const axes = POS_GROUPS;

  const starters: Series = {
    key: "starters",
    label: "Starters",
    fill: "fill-radar-starters",
    stroke: "stroke-radar-starters",
    dot: "bg-radar-starters",
    value: (g) => team.groupStarters[g],
    rank: (g) => team.groupRank[g],
    stats: (g) => groupStats[g],
  };
  const bench: Series = {
    key: "bench",
    label: "Bench",
    fill: "fill-radar-bench",
    stroke: "stroke-radar-bench",
    dot: "bg-radar-bench",
    value: (g) => team.benchAvgByGroup[g],
    rank: (g) => team.benchRank[g],
    stats: (g) => benchAxisStats[g],
  };
  const active: Series[] = view === "both" ? [starters, bench] : view === "bench" ? [bench] : [starters];

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">
          {`Position Strength${teamName ? ` — ${teamName}` : ""}`}
        </h3>
        <div className="inline-flex rounded-full border border-line-strong bg-surface-raised p-0.5 text-xs">
          {(["starters", "bench", "both"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-2.5 py-0.5 font-semibold capitalize transition-colors ${
                view === v ? "bg-accent text-accent-contrast shadow" : "text-ink-muted hover:text-ink"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[340px]" role="img" aria-label="Position strength radar">
        {/* Grid rings */}
        {Array.from({ length: RINGS }, (_, i) => (
          <circle key={i} cx={CENTER} cy={CENTER} r={(RADIUS * (i + 1)) / RINGS} fill="none" className="stroke-radar-grid" strokeWidth={1} />
        ))}
        {/* Axis spokes + labels */}
        {axes.map((g, i) => {
          const [x, y] = point(i, axes.length, 1);
          const [lx, ly] = point(i, axes.length, 1.16);
          return (
            <g key={g}>
              <line x1={CENTER} y1={CENTER} x2={x} y2={y} className="stroke-radar-grid" strokeWidth={1} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-ink-muted text-[10px] font-semibold">
                {g}
              </text>
            </g>
          );
        })}

        {active.map((s) => {
          const teamPts = axes.map((g) => normalize(s.value(g), s.stats(g)));
          const medianPts = axes.map((g) => normalize(s.stats(g).median, s.stats(g)));
          return (
            <g key={s.key}>
              {/* League-median reference (dashed) */}
              <polygon points={polygon(medianPts)} fill="none" className={s.stroke} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
              {/* Team shape */}
              <polygon points={polygon(teamPts)} className={`${s.fill} ${s.stroke}`} fillOpacity={0.25} strokeWidth={2} />
              {/* Hoverable vertices */}
              {axes.map((g, i) => {
                const [vx, vy] = point(i, axes.length, teamPts[i]);
                const st = s.stats(g);
                return (
                  <circle
                    key={g}
                    cx={vx}
                    cy={vy}
                    r={4}
                    className={`${s.fill} ${s.stroke}`}
                    strokeWidth={1.5}
                    onMouseEnter={(e) =>
                      tip.show(e, `${g} · ${s.label}`, [
                        { label: "Rank", value: `${ordinal(s.rank(g))} of ${total}`, strong: true },
                        { label: s.key === "bench" ? "Bench avg" : "Kerf pts", value: s.value(g).toFixed(1), strong: true },
                        { label: "League median", value: st.median.toFixed(1) },
                        { label: "League range", value: `${st.min.toFixed(0)}–${st.max.toFixed(0)}` },
                      ])
                    }
                    onMouseMove={tip.move}
                    onMouseLeave={tip.hide}
                    style={{ cursor: "pointer" }}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-ink-subtle">
        {active.map((s) => (
          <span key={s.key} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${s.dot}`} /> {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 border-t border-dashed border-ink-subtle" /> league median
        </span>
      </div>
      <p className="mt-1 text-center text-[10px] text-ink-subtle">
        each axis: league-worst (center) → league-best (edge) · hover a point for rank + points
      </p>
      {tip.node}
    </section>
  );
}
