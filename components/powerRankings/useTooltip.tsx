"use client";

import { type ReactNode, useState } from "react";

/**
 * A tiny hover-tooltip for the hand-drawn power-rankings charts (issue #32) — the
 * owner wants the actual points/ranks on hover instead of printing numbers on the
 * bars. Fixed-position, follows the cursor, works over both HTML rows and SVG
 * vertices (uses viewport clientX/clientY, so no SVG-coordinate math). No portal,
 * no dependency.
 */
export interface TooltipRow {
  label: string;
  value: string;
  /** Optional accent (e.g. the team's own value vs. league reference). */
  strong?: boolean;
}

export function useTooltip() {
  const [tip, setTip] = useState<{ x: number; y: number; title: string; rows: TooltipRow[] } | null>(
    null
  );

  const show = (e: { clientX: number; clientY: number }, title: string, rows: TooltipRow[]) =>
    setTip({ x: e.clientX, y: e.clientY, title, rows });
  const move = (e: { clientX: number; clientY: number }) =>
    setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
  const hide = () => setTip(null);

  const node: ReactNode = tip ? (
    <div
      className="pointer-events-none fixed z-50 rounded-md border border-line-strong bg-surface-raised px-2.5 py-1.5 text-xs shadow-lg"
      style={{ left: tip.x + 14, top: tip.y + 14, maxWidth: 240 }}
    >
      <div className="mb-1 font-bold text-ink">{tip.title}</div>
      <div className="flex flex-col gap-0.5">
        {tip.rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="text-ink-subtle">{r.label}</span>
            <span className={r.strong ? "font-semibold text-accent" : "tabular-nums text-ink-muted"}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return { show, move, hide, node };
}
