import type { CellContext } from "@tanstack/react-table";
import type { PlayerRow } from "@/lib/types";

/**
 * Inline-editable Ceiling ($). Pre-seeded to the player's KERF Value; a typed
 * value updates the row immediately and holds for the session (resets on reload,
 * which is acceptable for this prototype — Issue #1).
 *
 * Writes back through the table's `meta.updateCeiling`, keyed by `row.index`
 * (the ORIGINAL data index — stable across sort/filter), so edits survive
 * re-sorting and re-filtering.
 */
export default function EditableCeilingCell({
  getValue,
  row,
  table,
}: CellContext<PlayerRow, unknown>) {
  const value = getValue() as number;

  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      aria-label={`Ceiling for ${row.original.name}`}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => {
        const next = e.target.value === "" ? 0 : Number(e.target.value);
        table.options.meta?.updateCeiling(row.index, Number.isNaN(next) ? 0 : next);
      }}
      className="w-16 rounded border border-yours-border bg-surface px-1.5 py-0.5 text-right tabular-nums text-yours-strong shadow-sm focus:border-yours-focus focus:outline-none focus:ring-1 focus:ring-yours-focus"
    />
  );
}
