import PlayerTable from "@/components/PlayerTable";

export default function Home() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Gart Dash — Player Table
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Prototype · one table, many filters. Your KERFUFFLE value vs. the
          market, side by side.
        </p>
      </header>
      <PlayerTable />
    </main>
  );
}
