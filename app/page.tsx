import PlayerTable from "@/components/PlayerTable";

export default function Home() {
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6">
      <header className="mb-4">
        <h1 className="text-center text-2xl font-bold tracking-tight text-ink">
          Gart Dash
        </h1>
      </header>
      <PlayerTable />
    </main>
  );
}
