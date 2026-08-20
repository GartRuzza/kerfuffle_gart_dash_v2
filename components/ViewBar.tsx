"use client";

import type { SavedView } from "@/lib/views";

interface Props {
  views: SavedView[]; // default + custom, in display order
  activeId: string;
  activeIsCustom: boolean;
  dirty: boolean; // current settings differ from the active view
  onSelect: (id: string) => void;
  onSaveNew: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}

const btn =
  "rounded-md border border-line-strong bg-surface-raised px-2.5 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-subtle disabled:opacity-40 disabled:hover:bg-surface-raised";

export default function ViewBar({
  views,
  activeId,
  activeIsCustom,
  dirty,
  onSelect,
  onSaveNew,
  onUpdate,
  onDelete,
}: Props) {
  const builtIns = views.filter((v) => v.builtIn);
  const customs = views.filter((v) => !v.builtIn);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          View
        </span>
        <select
          className="rounded-md border border-line-strong bg-surface-raised px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          value={activeId}
          onChange={(e) => onSelect(e.target.value)}
        >
          <optgroup label="Default views">
            {builtIns.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {dirty && v.id === activeId ? " (modified)" : ""}
              </option>
            ))}
          </optgroup>
          {customs.length > 0 && (
            <optgroup label="My views">
              {customs.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {dirty && v.id === activeId ? " (modified)" : ""}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>

      <button type="button" className={btn} onClick={onSaveNew}>
        Save as new
      </button>
      <button
        type="button"
        className={btn}
        onClick={onUpdate}
        disabled={!activeIsCustom || !dirty}
        title={activeIsCustom ? "Update this view" : "Default views can't be overwritten — Save as new"}
      >
        Update
      </button>
      <button
        type="button"
        className={btn}
        onClick={onDelete}
        disabled={!activeIsCustom}
        title={activeIsCustom ? "Delete this view" : "Default views can't be deleted"}
      >
        Delete
      </button>
    </div>
  );
}
