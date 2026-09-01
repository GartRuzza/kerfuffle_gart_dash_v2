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

/** The active engine lens, in words (issue #28). */
const HORIZON_LABEL: Record<string, string> = {
  ros: "Rest-of-Season",
  weekly: "Weekly", // #29
};

export default function DataBanner({
  capturedAt,
  horizon = null,
  engineRunAt = null,
  actualsAsOfWeek = null,
}: {
  capturedAt: string | null;
  horizon?: string | null;
  engineRunAt?: string | null;
  /** Option B (issue #30): completed weeks the ROS lens nets actuals through; >0 = true remaining value. */
  actualsAsOfWeek?: number | null;
}) {
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
  // The Kerf ranks/tiers/dollars are as fresh as the last engine run, which can be
  // older than the data pull — so show both when the engine has run (issue #28).
  const lens = horizon ? HORIZON_LABEL[horizon] ?? horizon : null;
  // Option B (issue #30): once games are played, the ROS lens shows TRUE remaining
  // value (projection minus actuals-to-date), so say so — and through which week.
  const netted = horizon === "ros" && actualsAsOfWeek != null && actualsAsOfWeek > 0;
  return (
    <div className="w-full border-b border-line bg-surface px-4 py-1.5 text-center text-xs text-ink-subtle">
      League data as of <span className="font-semibold text-ink-muted">{formatDate(capturedAt)}</span>
      {lens && engineRunAt && (
        <>
          {" · "}
          <span className="font-semibold text-accent">{lens}</span>
          {netted ? (
            <>
              {" "}
              <span className="text-ink-subtle">remaining value through</span>{" "}
              <span className="font-semibold text-ink-muted">Week {actualsAsOfWeek}</span>
            </>
          ) : (
            " ranks"
          )}
          {" · updated "}
          <span className="font-semibold text-ink-muted">{formatDate(engineRunAt)}</span>
        </>
      )}
    </div>
  );
}
