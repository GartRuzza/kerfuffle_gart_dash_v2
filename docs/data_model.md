# Data Model — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code. **Any change here needs the product owner's approval before it is made** — schema changes are among the hardest things to reverse once real user data exists.
> **Update when:** Entities, fields, relationships, or permission rules change. Update it **with** the migration, not after.
> **This doc contains:** The entities, how they relate, and the rules that protect the data.
> **This doc never contains:** Speculative tables. If it is not in a migration, it is not in this doc — mark planned entities **(planned)** explicitly.

**Last updated:** 2026-08-26 · **Latest migration:** `db/migrations/003_superflex_display_board.sql` (the D-12 superflex display board; `002` is the issue-#12 review fixes; `001` is the D-10 normalized layer + the D-11 dead-cap/Practice-Squad decision)

---

## The store, in one paragraph

Three layers (decision [D-10](decision_log.md)): the **raw archive** (`data/raw/{run}/`, verbatim fetched responses, append-only, git-ignored) → the **normalized SQLite layer** (below — built, migration 001) → a **derived layer** (engine outputs — **planned**, lands with the engine issue). One database file, `data/gart-dash.sqlite` (git-ignored; deleting it is safe — `npm run ingest` rebuilds it from the raw archive). All app reads go through the single data-access module (`lib/data/`), which reads the flat **`board`** view and returns the `Player` shape the UI consumes. **Normalize the store; denormalize the read.**

## Normalized entities (built — migration 001)

| Entity | Grain / key | What it holds |
| --- | --- | --- |
| `pull` | one row per ingested archive run (`run_id` unique) | Lineage root: the raw folder path, when the data was **fetched** (`captured_at`), when it was ingested, per-source summary. Every normalized row's `pull_id` points here → its raw snapshot. |
| `fantasy_team` | PK `team_id` (CBS 1–12) | The league's 12 teams: name + division (parsed from standings). |
| `player` | PK **`cbs_player_id`** | Identity: name, position (QB/RB/WR/TE/K/DST), NFL team, bye week, FantasyPros id. The shared join key both sources publish. Upserted from both; CBS is authoritative for name/position when both have one. |
| `contract` | **snapshot**: one row per roster row per pull (`observed_at`, never overwritten) | What a team holds and at what price, as observed on a given pull: salary (whole $; **NULL = blank on CBS**, observed on real rosters), contract years (1–4), lineup slot, **`roster_status`** (`Active`/`Reserves`/`Injured`/`Practice` — D-11: Practice Squad is a status), CBS's own KERFUFFLE-scored `proj_points`, and **`row_type`** `player` \| `dead_cap` — a dead-cap row has **no `cbs_player_id`**, just the label text and the amount (D-11: the amount matters, not the player it once was). A CHECK enforces player-rows-have-ids and dead-cap-rows-don't. |
| `league_transaction` | one row per real transaction; **UNIQUE `natural_key`** (content hash) | The CBS log: date (ISO-normalized), team, the players/moves cell **verbatim**, effective week, and a best-effort `inferred_type` ("Dropped", "Signed", … — CBS has no type column, issue #11). Re-observing the same event updates `last_pull_id`, never duplicates. *(Named `league_transaction` because `TRANSACTION` is a SQL keyword.)* |
| `market_ranking` | **player × ranking type × scoring format × position scope (× week) × pull** — never flattened onto `player` | FantasyPros consensus per board per pull: `rank_ecr`, `pos_rank` ("WR12"), **tier**, expert spread (min/max/ave/std), expert count. Type/scoring come from the **payload's own declaration**, not the file name (the dynasty board is scoring-agnostic; pre-season "ROS" returns the draft board). A second file declaring an already-ingested grain is **skipped in ingestion code with a warning** (the unique index would abort the run instead). FantasyPros nulls stay **null, never 0** — an untiered player must not render as "Tier 0" or hand the engine a fake expert consensus. |
| `scoring_rule` | per rule per pull (`pull_id`+`category`+`name` unique) | The KERFUFFLE scoring config **parsed from CBS `/rules` on every pull — never hardcoded** (the league changed scoring as recently as 2024, and CBS diverges from the written constitution: CBS is authoritative). Parsed value kinds: `flat` / `per_unit` / `tiered`; an unparseable rule fails ingest loudly. |

**Read model (built):** the **`board`** SQL view — the **latest-captured** pull's roster snapshot (`latest_pull` orders by `captured_at`, **not** by ingest order: re-ingesting an older run after a parser fix must never make stale rosters "current") joined with player/team identity and the display boards, **union** free agents (ranked players on no roster). **Both branches filter to the positions this league rosters** (no kickers) so the display domain can't be violated from either side. Dead-cap rows are stored but are not board rows.

**Which boards the view displays ([D-12](decision_log.md)):** `draft`/`STD`/**`OP`** (standard scoring, **superflex**) and `dynasty`/**`OP`**. This league starts two QBs, so a 1-QB board would rank them ~20 spots too low. **Team defenses** are absent from superflex boards (`OP` = *offensive* player): they take their **positional** rank and tier from the `ALL` board via `COALESCE`, and their **overall rank stays NULL** — mixing the two boards' overall scales would float defenses into mid-pack, and NULL also sorts them last, which is correct here. **All boards stay ingested at full grain**; changing what the table displays is a view migration, never a re-fetch. `lib/data/derive.ts` adds the display derivations (unique contiguous overall ranks, "WR12"→12, engine fields as null).

## Derived layer (planned — lands with the engine issue, not before)

`engine_run`, `projection` (with first downs as a distinct named component), `replacement_level`, `valuation`, `price_curve`, `owner_ceiling_override` (owner-edited, never written by engine runs) — unchanged from D-10's plan; see [`decision_log.md`](decision_log.md). None of these exists in a migration, so none of them is real.

## The two client-side data shapes (unchanged)

- **`Player` / `PlayerRow`** (`lib/types.ts`) — the flat shape the UI consumes, now produced **only** by `lib/data/`. Engine fields are `number | null` (null until the engine exists); real blanks are null and render as "—". Do not grow tables from this shape — it is the read model's output, not a schema.
- **Saved-view configs** — browser localStorage (`gartdash.customViews.v1`), UI config only, never domain data (D-05).

## Rules that protect the data

- **No schema change without owner approval** (CLAUDE.md). Migration 001's shape was pre-approved (D-10) plus the owner's D-11 decision; anything further needs a new conversation.
- **Never edit an applied migration — write a new numbered one.** The runner (`db/client.mjs`) applies `db/migrations/*.sql` in filename order, each recorded in `schema_migration`.
- **`contract` is a snapshot, not state**: new observation rows per pull, never in-place updates. History accrues because each pull records what it saw.
- **`market_ranking` is never flattened onto `player`** — one player owns many ranking rows; collapsing them destroys the type/format distinctions the engine and tiers depend on.
- **Every normalized row carries lineage**: `fetched_at` + `pull_id` → the raw snapshot it came from.
- **Idempotent ingestion:** stateful entities upsert on natural keys (`cbs_player_id`, `team_id`, transaction content hash); per-pull snapshots are replaced per pull. Re-running never duplicates (unit-tested at the DB level).
- **Temp-validate-swap:** each run ingests inside one SQLite transaction; a failed parse or validation **rolls the whole run back** — a bad fetch can never corrupt good data.
- **Column mapping is by header text, never by position**; a missing expected header is a loud failure.
- **localStorage holds UI config only** — never player, league, or personal data.

**Ingest invariants (enforced, loud — from the [constitution](kerfuffle-fantasy-constitution.md)):**

- Exactly **12 teams**.
- Every roster row **resolves to a numeric `cbs_player_id`** *or* is **classified dead-cap** (salary but no player link — D-11). A row that is neither is a refusal, not a guess.
- **One roster per player per pull** — enforced both by a unique index (`contract_one_player_per_pull`) and by a named check during ingest. A player showing on two rosters (CBS caught mid-trade, or a parser fault) would otherwise appear **twice in the table**; instead the run fails loudly naming the player and both teams.
- **One FantasyPros entry per CBS player per board** — the board grain is keyed on FantasyPros' own id, but the UI joins on `cbs_player_id`, so two entries sharing one CBS id would duplicate that player in the table. Ingestion refuses the board, naming both entries.
- **Team salary sums, including IR (and Practice Squad), ≤ $500** — dead-cap amounts included; blank salaries counted $0 with a warning; cross-checked against CBS's own footer total (warning on mismatch).
- **Contract years ∈ {1, 2, 3, 4}** on player rows.
- The **boards the UI reads** must be present in the pull: `draft/STD/OP` and `dynasty/OP` (the superflex display boards) and the `DST` rows of `draft/STD/ALL` (the only board that ranks defenses).

**Scoring-authority rule:** **CBS actuals are authoritative — never recompute scored points for real games.** The parsed `scoring_rule` config exists only to translate FantasyPros raw stat-line projections into KERFUFFLE points (engine issue). `contract.proj_points` is CBS's *displayed* projection, stored as observed source data — not an engine output.

## Access and permissions

Single-user, local-only. The app opens the DB **read-only**; only `npm run ingest` writes. No accounts, no network reads at request time.

## AI-generated data

None. Every stored value is parsed from a CBS page or a FantasyPros payload; every derived display value is deterministic code.

## Migrations

| | |
| --- | --- |
| **Where they live** | `db/migrations/*.sql`, applied by `db/client.mjs` (`applyMigrations`), recorded in `schema_migration` |
| **How to run them** | `npm run ingest` applies pending migrations before ingesting (there is no separate migrate command yet) |
| **Applied** | `001_normalized_schema.sql` — the seven normalized entities + the `board`/`latest_pull` views (2026-08-25); `002_latest_pull_by_capture_time.sql` — recreates both views: `latest_pull` orders by `captured_at` (was ingest order — a stale-data bug found in review) and the board's rostered branch filters to the league's positions (2026-08-25); `003_superflex_display_board.sql` — the board view reads the **superflex** rankings, with defenses on positional rank only ([D-12](decision_log.md), 2026-08-26) |
| **Rules** | Never hand-edit the DB; never edit an applied migration — write a new one; update this doc **with** the migration. The DB file is disposable (rebuildable from `data/raw/`), but treat that as a safety net, not a workflow. |

---

**Related docs:** [`architecture.md`](architecture.md) (where this data sits) · [`decision_log.md`](decision_log.md) (D-10 storage, D-11 dead-cap/PS, D-05 localStorage) · [`pm/implementation_reality_log.md`](pm/implementation_reality_log.md) (the issue-#12 build account)
