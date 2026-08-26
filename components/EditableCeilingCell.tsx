import type { CellContext } from "@tanstack/react-table";
import type { PlayerRow } from "@/lib/types";

/**
 * Inline-editable Ceiling ($). Seeded from the player's Kerf Value (the model's
 * suggestion) — null until the valuation engine exists, so it starts blank.
 * A typed value updates the row immediately and holds for the session (resets
 * on reload); clearing the field returns it to blank.
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
  const value = getValue() as number | undefined;

  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      aria-label={`Ceiling for ${row.original.name}`}
      value={value != null && Number.isFinite(value) ? value : ""}
      onChange={(e) => {
        const raw = e.target.value;
        const next = raw === "" ? null : Number(raw);
        table.options.meta?.updateCeiling(
          row.index,
          next !== null && Number.isNaN(next) ? null : next,
        );
      }}
      className="w-16 rounded border border-line-strong bg-surface-raised px-1.5 py-0.5 text-right tabular-nums text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
    />
  );
}
