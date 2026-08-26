/**
 * Data-freshness banner (issue #12) — replaces the prototype's MOCK-DATA
 * banner now that the table renders real league data. Concise by owner
 * request: just the fact that matters — how fresh the data is.
 *
 * With no ingested data it flips to a loud "no data" state telling the owner
 * exactly how to fill the store.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "Aug 25, 2026" in the machine's own timezone. Timestamps are stored in UTC,
 * so reading the date straight off the string would show tomorrow's date for
 * any snapshot taken after ~7-8pm Eastern — the owner would see a date he never
 * captured on. This is a server component, so "local" is his machine.
 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function DataBanner({ capturedAt }: { capturedAt: string | null }) {
  if (capturedAt === null) {
    return (
      <div
        role="alert"
        className="sticky top-0 z-50 w-full border-b border-warning-border bg-warning-surface px-4 py-2 text-center text-sm font-semibold text-warning-text shadow-sm"
      >
        ⚠ NO DATA — nothing ingested yet. Run <code>npm run archive</code> then{" "}
        <code>npm run ingest</code>.
      </div>
    );
  }
  return (
    <div className="w-full border-b border-line bg-surface px-4 py-1.5 text-center text-xs text-ink-subtle">
      League data as of <span className="font-semibold text-ink-muted">{formatDate(capturedAt)}</span>
    </div>
  );
}
