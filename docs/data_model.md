# Data Model — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code. **Any change here needs the product owner's approval before it is made** — schema changes are among the hardest things to reverse once real user data exists.
> **Update when:** Entities, fields, relationships, or permission rules change. Update it **with** the migration, not after.
> **This doc contains:** The entities, how they relate, and the rules that protect the data.
> **This doc never contains:** Speculative tables. If it is not in a migration, it is not in this doc — mark planned entities **(planned)** explicitly.

**Last updated:** 2026-08-26 · **Latest migration:** `db/migrations/005_projection_engine.sql` (the issue-#18 projection layer — `projection_source` input + `engine_run`/`projection` derived output; `004` is the issue-#17 historical layer; `003` is the D-12 superflex display board; `002` is the issue-#12 review fixes; `001` is the D-10 normalized layer + the D-11 dead-cap/Practice-Squad decision)

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

## Historical data layer (built — migration 004, issue [#17](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/17))

Owner-provided historical exports, ingested from `data/historical/` (git-ignored) by **`npm run ingest:historical`** — a path **separate** from the automated archiver (they're manual, name-keyed CSVs, not fetched HTML, so they belong to no `pull` and carry a free-text `source` tag instead of pull lineage). See [D-14](decision_log.md) (first-down source) and [D-15](decision_log.md) (TRUFFLE). Depends on the main store being populated first (the `player` universe the matcher resolves against).

| Entity (built) | Grain / key | What it holds |
| --- | --- | --- |
| `player_season_stats` | season × player — **UNIQUE (season, `cbs_player_id`)** | Full stat line per season from CBS: rushing/receiving/passing **first downs** + 2pt (from the "Advanced Categories" export) joined with att/cmp/yds/td, targets/rec/yds/td, fumbles (from the "Standard Categories" export) + FPTS total/avg. Source of the projection's **first-down rates** and the backtest's **actual points**. **Only players in our `player` universe are stored** (owner, 2026-08-26 — the ~1,070 deep-bench rows per season are skipped, count reported); the raw CBS name string is kept. Offense only (the export has no DST/K rows). *Passing first downs are stored for completeness but KERFUFFLE does not score them — only rush/rec first downs, 1 pt each.* |
| `contract_history` | season × player — **UNIQUE (season, `cbs_name_raw`)** | The **2025** KERFUFFLE salary per player (owner, 2026-08-26 — **only 2025 is authoritative**; the `'24` and future-year columns are unreliable, so the full `'24`..`'28` schedule is kept verbatim in `schedule_raw` for **provenance only, read by nothing**), plus contract years, `FT`/`FA` flags, age, KERFUFFLE + NFL team. `cbs_player_id` is **nullable** — an unmatched row (a since-dropped player) is kept with its raw name + null id. Dead-cap sheet rows (`Pos='DC'`) are kept with null id. Feeds the **pre-auction price curve**. |
| `auction_result` | league × season × player — **UNIQUE (league, season, player_name)** | Completed-auction rows: final salary, nomination order, winning team, verbatim **bid history** JSON. Carries `league` + **`is_reference`**. The TRUFFLE 2026 file (69 players) loads here with `league='TRUFFLE'`, `is_reference=1`, its `cbs_player_id` taken directly from the file's `PlayerID`, and **is read by no consumer** (D-15 — a test asserts the board view and `lib/data/` never reference `auction_result`). |

**Name-matching rule (built — `tools/ingest/match-players.mjs`):** the CBS stat files and the KERFUFFLE contract file identify players by name (`"Lamar Jackson QB | BAL"`), not id — ingestion matches them to `cbs_player_id` against the `player` universe on normalized name (+ position, + NFL team as a tiebreak), with **team defenses matched by NFL team** (the sheet names them by nickname, our universe by full city+name) and a small curated **alias** map for spelling gaps (`Josh Palmer`→`Joshua Palmer`, `Marquise Brown`→`Hollywood Brown`). Unmatched rows are **reported loudly and named, never dropped**. Coverage on the real data: **223/234** contract players (+ 1 dead-cap null), **864/≈960** universe players per season; the 11 unmatched contracts are players dropped/retired since 2025 with no id in the current universe. The TRUFFLE file already carries the CBS id → direct join.

**Column-alignment rule (CBS stat files):** the "Advanced"/"Standard" exports have a **3-row grouped header** whose group/column rows are **positionally shifted** and do not align 1:1 with the data rows — so the parser maps by **fixed data-column index**, verified by **anchor assertions** (Josh Allen 2025 = 177 passing + 46 rushing first downs; Chase = 73 receiving) **and** a per-player check that the two files agree on **FPTS Total**. Any layout drift fails the ingest loudly rather than misaligning silently.

## Projection layer (built — migration 005, issue [#18](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/18))

The first derived layer. Populated by a **separate offline step, `npm run engine`** (`tools/engine/`), which runs **after** `npm run ingest` + `npm run ingest:historical` (it needs the current-season projections, the parsed scoring config, and the first-down history all loaded). See [D-13](decision_log.md) (methodology) and [D-14](decision_log.md) (first downs from CBS). **No dollars** — VORP/replacement/price/Edge are the valuation issue (#20).

| Entity (built) | Grain / key | What it holds |
| --- | --- | --- |
| `projection_source` | player × pull — **UNIQUE (pull_id, `fp_player_id`)** | NORMALIZED INPUT, written by `npm run ingest` (parses the archived `projections-all.json`). The FantasyPros projected stat line — pass/rush/rec att/yds/tds, receptions, fumbles — with **no first downs** (the feed doesn't project them; the engine estimates them). Joined to CBS via `fp_player_id → player.fp_player_id` (520/528 offense matched; the ~8 misses are players outside our universe, stored with null id). Kickers and defenses are dropped at parse time. FantasyPros' *own* projected points are kept as `fp_points` for **reference only** — never treated as Kerf points. |
| `engine_run` | one row per `npm run engine` execution | The stamp that makes a result traceable/reproducible: which pull's projections + scoring it used, which seasons the first-down rates came from (`[2024,2025]`), the FD method (`per_opportunity`), and tunable params (tier calibration). Rows accumulate; the app reads the latest via the `latest_engine_run` view. |
| `projection` | player × engine_run — **UNIQUE (engine_run_id, `cbs_player_id`)** | DERIVED OUTPUT. Per player: the projected **KERFUFFLE points** (incl. estimated first downs); the **estimated rushing & receiving first downs as distinct NAMED fields** (D-14 — the league's scoring edge, inspectable), plus the per-player rates applied; a `components_json` breakdown (the scored stat line + per-term point contribution + an `fd` object: applied rate, own rate, position rate, sample size, and whether the player or position rate was used) for drill-down and for the deterministic-reconstruction test; and the derived **Kerf overall/positional ranks + tiers**. |

**First-down estimation (built — `tools/engine/core.mjs`):** **per-player** rates pooled across 2024+2025 from `player_season_stats` — each player's own receiving FD **per reception** and rushing FD **per carry** — **shrunk toward his position's rate by sample size** (empirical-Bayes / partial pooling, owner 2026-08-26). A player with lots of history leans on his own rate (so a back who genuinely converts more first downs than average is correctly more valuable — e.g. Kyren Williams' 575-carry 0.277 stays near 0.277 vs the RB average 0.229); a rookie or thin sample **falls back to the position rate** with no hard cutoff (a 0-carry player gets exactly the position rate). Shrinkage pseudo-counts are `rushK=75`, `recK=40` (~half a season — "moderate", owner's call; the backtest #19 will calibrate them). The applied rate, the player's own rate, the position rate, and the sample size are stored in `projection.components_json.fd` for drill-down. Applied to each player's *projected* receptions/carries → projected first downs.

**Scoring translation (built):** the full projected line, *including* estimated first downs, is scored through the parsed `scoring_rule` config using the **same terms the #17 cross-check validated** (no PPR receptions, no passing first downs — only rush/rec first downs at 1 pt). The scoring-authority rule still holds: this only scores *projections*; CBS actuals are never re-scored.

**Ranks + tiers (built):** ranks are assigned over **one pool** of all projected offense (superflex → QBs correctly rise; verified: best-QB overall rank = 1), and within each position. Tiers use **Jenks natural breaks** (deterministic 1-D clustering by projected-points gaps) with the band count **calibrated to FantasyPros' own tier counts** on the superflex board (owner, 2026-08-26 — so the Kerf board never shows wildly more/fewer bands than the market board). **Team defenses get no Kerf points/ranks/tiers** — the offensive feed can't score defense (owner, 2026-08-26); they keep their market positional rank/tier and render "—" for Kerf.

## Valuation layer (planned — the valuation issue [#20](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/20))

Still not in any migration, so still not real: `replacement_level` (last-starter baselines: QB24/RB~34/WR~34/TE~17/DST12), `valuation` (VORP → cap dollars, both ceiling flavors), `price_curve` (2025 KERFUFFLE + current rosters; TRUFFLE off — [D-15](decision_log.md)), `owner_ceiling_override` (owner-edited, never written by engine runs). Gated behind the backtest (#19).

## The two client-side data shapes (unchanged)

- **`Player` / `PlayerRow`** (`lib/types.ts`) — the flat shape the UI consumes, now produced **only** by `lib/data/`. The **Kerf rank/tier fields** (`kerfOvrRank`/`kerfPosRank`/`kerfOvrTier`/`kerfPosTier`) and `projPts` are now filled from the latest `engine_run`'s `projection` rows (issue #18) for projected offense; the **dollar fields** (`kerfValue`/`marketPrice`) stay `number | null` = null until the valuation issue (#20). Real blanks are null and render as "—" (defenses, unprojected players). Do not grow tables from this shape — it is the read model's output, not a schema.
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
| **How to run them** | `npm run ingest` (and `npm run ingest:historical`) apply pending migrations before ingesting (there is no separate migrate command yet) |
| **Applied** | `001_normalized_schema.sql` — the seven normalized entities + the `board`/`latest_pull` views (2026-08-25); `002_latest_pull_by_capture_time.sql` — recreates both views: `latest_pull` orders by `captured_at` (was ingest order — a stale-data bug found in review) and the board's rostered branch filters to the league's positions (2026-08-25); `003_superflex_display_board.sql` — the board view reads the **superflex** rankings, with defenses on positional rank only ([D-12](decision_log.md), 2026-08-26); `004_historical_data.sql` — the three historical tables (`player_season_stats`, `contract_history`, `auction_result`), loaded by `npm run ingest:historical` ([#17](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/17), 2026-08-26); `005_projection_engine.sql` — the projection layer (`projection_source` input written by `npm run ingest`; `engine_run` + `projection` derived output written by `npm run engine`) + the `latest_engine_run` view ([#18](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/18), 2026-08-26) |
| **Rules** | Never hand-edit the DB; never edit an applied migration — write a new one; update this doc **with** the migration. The DB file is disposable (rebuildable from `data/raw/`), but treat that as a safety net, not a workflow. |

---

**Related docs:** [`architecture.md`](architecture.md) (where this data sits) · [`decision_log.md`](decision_log.md) (D-10 storage, D-11 dead-cap/PS, D-05 localStorage) · [`pm/implementation_reality_log.md`](pm/implementation_reality_log.md) (the issue-#12 build account)
