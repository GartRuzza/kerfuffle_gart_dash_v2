import PlayerTable from "@/components/PlayerTable";
import DataBanner from "@/components/DataBanner";
import { getBoard } from "@/lib/data/board";

// Read the store on every request (never bake data in at build time) — the
// "data as of" banner and the table always reflect the latest ingested pull.
export const dynamic = "force-dynamic";

export default function Home() {
  const { players, teams, meta } = getBoard();

  return (
    <>
      <DataBanner capturedAt={meta?.capturedAt ?? null} />
      <main className="mx-auto max-w-[1500px] px-4 py-6">
        <header className="mb-4">
          <h1 className="text-center text-2xl font-bold tracking-tight text-ink">
            Gart Dash
          </h1>
        </header>
        <PlayerTable players={players} teams={teams} />
      </main>
    </>
  );
}
