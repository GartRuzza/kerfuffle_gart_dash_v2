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

**Old failed runs re-appear on every ingest — usually that's fine.** Ingest re-tries every
`data/raw/` folder it hasn't successfully stored *yet*, so a run that can never ingest keeps
printing its `✘ ROLLED BACK` line each time. Two common cases, both harmless — **read the
newest `✔` line at the bottom, not the old `✘` ones above it:**

- **Pre-in-season archives** (before the STD/superflex board was added, issue #27) fail with
  *"the draft/STD/OP (superflex) FantasyPros board is missing"* — they physically lack a board
  the app now requires, so they can never ingest.
- **Incomplete captures** (e.g. one CBS roster page that didn't fetch → *"roster tN: no
  parseable roster table"*) stay failed until re-captured.

These don't affect your current data — the latest **`✔`** run is what the app reads (see the
closing `Board view: … latest pull: <run>` line). If the repeated `✘` noise bothers you,
**deleting those stale `data/raw/<run>/` folders is safe** (the archive is append-only history,
not the database; the DB is rebuilt from whatever folders remain).

The database is **disposable by design**: deleting `data/gart-dash.sqlite` and
re-running `npm run ingest` rebuilds it entirely from the raw archive.

## Historical data — a separate path (issue #17)

`npm run ingest:historical` loads the owner's **manual CSV exports** from
`data/historical/` (git-ignored) into three tables — `player_season_stats`
(2024/25 CBS stat lines incl. first downs), `contract_history` (KERFUFFLE 2025
salaries), and `auction_result` (TRUFFLE 2026, reference-only, read by nothing).

These are name-keyed CSVs, not fetched HTML, so they are **not** part of the
`data/raw/` archive walk above and belong to no `pull`. Run **`npm run ingest`
first** — the name→`cbs_player_id` matcher resolves against the player universe.

```bash
npm run ingest:historical -- --dry-run   # parse + match report, no writes
npm run ingest:historical                # load the three tables (idempotent)
```

- The 3-row grouped CBS stat headers are mapped by **anchored column index**
  (verified against Josh Allen 177/46 and Chase 73 first downs) with a per-player
  **FPTS-Total agreement** check between the advanced+standard files — drift fails loudly.
- Unmatched rows are **named and kept with a null id**, never dropped.
- The **scoring cross-check** (`scoring-crosscheck.mjs`, unit-tested) recomputes
  KERFUFFLE points from components and confirms they match CBS's FPTS Total.
- See [`data/historical/README.md`](../../data/historical/README.md) for provenance
  and [`docs/data_model.md`](../../docs/data_model.md) for the table shapes.
