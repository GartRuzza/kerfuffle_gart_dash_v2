import DataBanner from "@/components/DataBanner";
import Nav from "@/components/Nav";
import PowerRankings from "@/components/PowerRankings";
import { getBoard } from "@/lib/data/board";

// Read the store on every request (never bake data in at build time) — the
// banner and the rankings always reflect the latest ingested pull + engine run.
export const dynamic = "force-dynamic";

// Format engine-run freshness on the SERVER (server-local, like DataBanner) so the
// client component never re-formats a timestamp and risks a hydration mismatch.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtUpdated(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export default function PowerRankingsPage() {
  const { players, weeklyPlayers, meta } = getBoard();

  return (
    <>
      <DataBanner
        capturedAt={meta?.capturedAt ?? null}
        horizon={meta?.horizon ?? null}
        engineRunAt={meta?.engineRunAt ?? null}
        actualsAsOfWeek={meta?.actualsAsOfWeek ?? null}
      />
      <Nav />
      <main className="mx-auto max-w-[1500px] px-4 py-6">
        <header className="mb-4">
          <h1 className="text-center text-2xl font-bold tracking-tight text-ink">
            League Power Rankings
          </h1>
          <p className="mt-1 text-center text-sm text-ink-subtle">
            All 12 teams by roster strength — the engine&apos;s per-player Kerf points, added up.
            Pick a team for its positional breakdown, starters, and lineup.
          </p>
        </header>
        <PowerRankings
          players={players}
          weeklyPlayers={weeklyPlayers}
          weeklyWeek={meta?.weeklyWeek ?? null}
          rosUpdated={fmtUpdated(meta?.engineRunAt)}
          weeklyUpdated={fmtUpdated(meta?.weeklyRunAt)}
        />
      </main>
    </>
  );
}
