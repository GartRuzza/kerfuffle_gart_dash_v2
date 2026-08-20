/**
 * Persistent "this is not real data" banner.
 *
 * Required by Issue #1: a clear, always-visible indicator so the prototype's
 * hand-authored numbers are never mistaken for real CBS / FantasyPros data.
 * Lives in the root layout so it is structurally on every render.
 */
export default function MockDataBanner() {
  return (
    <div
      role="alert"
      className="sticky top-0 z-50 w-full border-b border-amber-500 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow-sm"
    >
      ⚠ MOCK DATA — not real league data. Invented salaries &amp; values, for
      layout only.
    </div>
  );
}
