/**
 * Data-freshness banner (issue #12) — replaces the prototype's MOCK-DATA
 * banner now that the table renders real league data. Concise by owner
 * request: just the fact that matters — how fresh the data is.
 *
 * With no ingested data it flips to a loud "no data" state telling the owner
 * exactly how to fill the store.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deterministic, locale-independent "Aug 25, 2026" (safe for SSR). */
function formatDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
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
