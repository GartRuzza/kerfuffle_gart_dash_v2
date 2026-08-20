"use client";

import { useEffect, useRef, useState } from "react";
import { ALWAYS_VISIBLE, COLUMN_LABELS } from "@/lib/views";

interface Props {
  /** Column ids in current display order. */
  order: string[];
  /** Visibility map (id → visible). */
  visibility: Record<string, boolean>;
  onToggle: (id: string, visible: boolean) => void;
}

/** A dropdown of checkboxes to show/hide columns. Reordering is done by dragging
 * the column headers. "Player" is always visible. */
export default function ColumnPicker({ order, visibility, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const shownCount = order.filter((id) => visibility[id] !== false).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-line-strong bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-subtle"
      >
        Columns ({shownCount}) ▾
      </button>
      {open && (
        <div className="absolute z-40 mt-1 max-h-80 w-56 overflow-y-auto rounded-md border border-line-strong bg-surface p-1 shadow-lg">
          {order.map((id) => {
            const locked = id === ALWAYS_VISIBLE;
            const visible = visibility[id] !== false;
            return (
              <label
                key={id}
                className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                  locked ? "opacity-60" : "hover:bg-surface-subtle"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent"
                  checked={visible}
                  disabled={locked}
                  onChange={(e) => onToggle(id, e.target.checked)}
                />
                <span className="text-ink">{COLUMN_LABELS[id] ?? id}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
