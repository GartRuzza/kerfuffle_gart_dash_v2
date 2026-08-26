# Ingestion tool (issue #12)

**One line:** run `npm run ingest` to turn your saved raw snapshots (`data/raw/`) into
the normalized SQLite database the app reads (`data/gart-dash.sqlite`).

Reads **local files only** — it never talks to CBS or FantasyPros. The routine:

```bash
npm run archive          # 1. fetch + save a fresh verbatim snapshot (needs credentials)
npm run ingest           # 2. parse new snapshots into the database (validates loudly)
npm run dev              # 3. the table renders the latest pull
```

## What it does

- Applies pending migrations (`db/migrations/*.sql`, recorded in `schema_migration`).
- Walks every `data/raw/{run}/` in date order and ingests each **new** run:
  standings → the 12 teams; all 12 roster reports → players + contract snapshot rows
  (Practice Squad = a status; a salary-without-player row = dead cap, per D-11);
  the full transaction log; the `/rules` scoring config (parsed, never hardcoded);
  every FantasyPros consensus board (trusting the payload's own type/scoring).
- **Validates the constitution loudly, before commit:** exactly 12 teams; every roster
  row is a real player or classified dead cap; team salary sums (incl. IR) ≤ $500;
  contract years 1–4; column mapping by header name (a missing header is a hard stop).
  A failed run **rolls back completely** — the app keeps the last good data.
- **Idempotent:** re-running skips ingested runs; `npm run ingest -- --all` re-ingests
  everything (after a parser fix) without ever duplicating a row.
- **Lineage:** every row carries `pull_id` + `fetched_at` → the raw snapshot it came from.

## Reading the output

- `✔ <run>` — ingested, with counts (teams/players/dead-cap/tx/rules/boards/rankings).
- `· note` — informational (e.g. a duplicate FantasyPros board skipped).
- `⚠ warning` — data oddity worth eyes (e.g. a blank salary on a real roster row),
  stored as unknown rather than guessed.
- `✘ <run> ROLLED BACK` — a validation failure; the reason follows. Nothing was stored.

The database is **disposable by design**: deleting `data/gart-dash.sqlite` and
re-running `npm run ingest` rebuilds it entirely from the raw archive.
