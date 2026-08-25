# Data Model — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code. **Any change here needs the product owner's approval before it is made** — schema changes are among the hardest things to reverse once real user data exists.
> **Update when:** Entities, fields, relationships, or permission rules change. Update it **with** the migration, not after.
> **This doc contains:** The entities, how they relate, and the rules that protect the data.
> **This doc never contains:** Speculative tables. If it is not in a migration, it is not in this doc — mark planned entities **(planned)** explicitly.

**Last updated:** 2026-08-24 · **Latest migration:** none (no database exists yet — planned storage entities added from decision [D-10](decision_log.md))

---

## There is no real data model yet — on purpose

Gart Dash is currently a **UI prototype on mock data**. There is **no database, no schema, and no migrations.** This is deliberate: per the roadmap, we do not design real data structures until data discovery (roadmap #2–3) proves what CBS and FantasyPros actually expose. The two data shapes that exist today are **not** a schema and must not be treated as one:

### 1. The mock player fixture — `lib/mockData.ts` / `lib/types.ts`

A flat, hand-authored + derived array of ~80 players (the `Player` type). It is a **fixture for the UI**, not a persisted entity. When real ingestion lands, this whole module is replaced by a server route returning the same shape; the UI does not change. Fields, in brief:

- **Hand-authored:** `id`, `name`, `pos`, `nflTeam`, `owner` (fantasy manager or `FA`), `kerfValue`, `marketPrice`, `ecr`, `dynastyEcr`, `salary`, `contractYears`, plus a legacy `tier` (unused).
- **Derived in code (all mock):** `projPts`; the ranks `kerfOvrRank`, `kerfPosRank`, `ovrEcrRank`, `posEcr`, `dynOvrRank`, `dynPosEcr`; and the six tier dimensions `kerfOvrTier`, `kerfPosTier`, `ovrEcrTier`, `posEcrTier`, `dynOvrTier`, `dynPosTier`. Real values come from the CBS/FantasyPros pipeline and the valuation engine later.
- The editable **`ceiling`** (`PlayerRow`) is in-memory only and resets on reload.

⚠ **Do not grow a database around the `Player` type.** If a real schema becomes necessary, **stop and flag the owner** (per Issue #1).

### 2. Saved-view configs — browser localStorage

The only persisted data. Custom **views** (UI config: which columns show, their order, the sort, the filters) are stored under the key `gartdash.customViews.v1` in the browser's localStorage (see `lib/views.ts`, decision [D-05](decision_log.md)). This is **UI configuration, not domain data** — no player, league, or personal data lives there. It is per-browser and not synced.

## Entities (planned)

**(planned — none built.)** The real entities will be defined during/after data discovery. Expected shape, at a high level (not yet designed, subject to what the sources expose): players, their KERFUFFLE-adjusted values and tiers (engine output), league rosters/contracts/salaries and the transaction log (CBS), and market rankings (FantasyPros). None of this is modelled yet.

**Informed by the CBS discovery spike (issue #5 — [`cbs_data_discovery.md`](cbs_data_discovery.md)):** CBS is confirmed to expose, per player, a stable **CBS numeric player id** (the FantasyPros join key — confirmed reciprocated in spike #7), name, NFL team, position, **salary**, and **contract length** (years remaining, 1–4). Per-team rosters (12 teams), the free-agent pool, the transaction log (2024–26), scoring/settings, and draft/auction values are all reachable read-only. This is **proven source shape, still not a schema** — do not build tables from it until the ingestion issue is scoped and approved. Two fields the engine/lenses will want are **not yet retrievable** and remain open: historical-season data (backtest) and FAB winning-bid amounts (price curve).

**Informed by the FantasyPros discovery spike (issue #7 — [`fantasypros_data_discovery.md`](fantasypros_data_discovery.md)):** FantasyPros' official API returns, per player, **ECR (`rank_ecr`)**, **positional rank (`pos_rank`)**, **tier**, the **expert spread (`rank_min/max/ave/std`)**, name, NFL team, position — across redraft + dynasty + ROS + weekly and all scoring formats. Crucially it also returns a **`cbs_player_id`** on every player that **equals CBS's own id**, so the two sources join on a **single shared key** (`cbs_player_id` ↔ CBS numeric id) — not on fuzzy name/team/position matching. This is the intended relationship between the (planned) **market-rankings** entity (FantasyPros) and the (planned) **player/roster** entities (CBS): a direct id foreign-key. Still **proven source shape, not a schema** — real tables wait for the ingestion issue. Open/assumed: the full 520-player board and the projections/ADP endpoints require the **HOF tier** and a confirming re-run.

### Planned entities from the storage decision (D-10)

**(planned — none built.)** The storage architecture ([D-10](decision_log.md)) is a three-layer store: a raw file archive → a **normalized** SQLite layer → a **derived** SQLite layer, all read/written through a single data-access module returning the flat `Player` shape. The entities below are the intended shape; **none is built until its migration lands**, and the dead-cap/Practice-Squad modelling is explicitly **not final** (see the open decision in [`pm/roadmap.md`](pm/roadmap.md), resolved by issue #11's evidence). **Normalize the store; denormalize the read.**

**Normalized layer** *(planned — lands with issue #12, the storage/ingestion issue):*

| Entity | Grain / key | What it holds |
| --- | --- | --- |
| `player` *(planned)* | PK **`cbs_player_id`** | Identity: name, NFL team, position. The shared join key CBS and FantasyPros both publish. |
| `fantasy_team` *(planned)* | 12 rows | The league's teams (managers). |
| `contract` *(planned)* | **Snapshot table with `observed_at`** — never overwritten state | Salary + contract years (1–4) a team holds a player at, as observed on a given pull. CBS hands you *current* state; history exists only if each observation is captured. |
| `transaction` *(planned)* | per transaction | The transaction log (adds/drops, trades, lineup, FAB). Transaction types to be enumerated by issue #11; FAB bid amounts still unconfirmed. |
| `market_ranking` *(planned)* | **player × ranking type × scoring format × position scope × pull date** — never flattened onto `player` | FantasyPros ECR, positional rank, tier, and the expert spread. One player has many ranking rows. |
| `scoring_rule` *(planned)* | per rule | The KERFUFFLE scoring config **parsed from CBS `/rules`** (not hardcoded — the league changed scoring as recently as 2024). Its one job downstream: translating FantasyPros raw stat-line projections into KERFUFFLE points. |
| `pull` *(planned)* | one row per ingestion run | Lineage: source, URL, timestamp, raw snapshot path, status. Every normalized row carries a `pull_id` pointing back at the raw snapshot it came from. |

**Derived layer** *(planned — lands with the engine issue, **not** issue #12):*

| Entity | Grain / key | What it holds |
| --- | --- | --- |
| `engine_run` *(planned)* | one row per run | Model version, params, timestamp. Everything derived points at one run. |
| `projection` *(planned)* | per player per run | The projected total **with the stat components that produced it** (drillable inputs made structural). FantasyPros carries **no first-down data**, and PPFD first downs are a large share of KERFUFFLE scoring — so first downs are a **distinct named component**, modelled separately on historical CBS actuals. |
| `replacement_level` *(planned)* | per position per season | Stored, not inline. |
| `valuation` *(planned)* | per player per run | VORP, market price, `ceiling_generic`, `ceiling_roster_aware`, edge. |
| `price_curve` *(planned)* | per run | The league price curve (roster salaries + historical FAB wins). |
| `owner_ceiling_override` *(planned)* | per player, owner-edited | **Owner-edited, never written by engine runs.** |

**Read model** *(planned):* one flat **"board"** view/table that joins the normalized (and, later, derived) entities into the `Player` shape the UI consumes — the single boundary `lib/mockData.ts` occupies today.

## Rules that protect the data

- **No schema is introduced without owner approval.** Introducing a real database/schema is a sensitive change (CLAUDE.md) — stop and flag first. *(The storage shape is pre-approved via D-10; the dead-cap/Practice-Squad modelling is not — see the open decision in [`pm/roadmap.md`](pm/roadmap.md).)*
- **localStorage holds UI config only** — never player, league, or personal data, and nothing sensitive.
- The mock fixture is the **single** place invented data enters (`lib/mockData.ts`); components consume typed shapes and never hard-code data.

**Grain and lineage rules (planned, for the storage layer — D-10):**

- **`contract` is a snapshot, not state.** It carries `observed_at` and is **never overwritten in place**. CBS exposes only *current* salary/contract; historical contract state exists only if each pull records a new observation row.
- **`market_ranking` is never flattened onto the player.** Its grain is player × ranking type (draft/dynasty/ROS/weekly) × scoring format (STD/HALF/PPR) × position scope × pull date. One player owns many ranking rows; collapsing them onto the player row destroys the format/type distinctions the engine and tiers depend on.
- **Every normalized row carries lineage:** `fetched_at` and a `pull_id` → the raw snapshot it came from. Re-running a pull **upserts on natural keys** (`cbs_player_id` + season, + week where applicable) — it updates, never duplicates. Writes go **temp → validate → swap**, so a failed fetch never corrupts good data.

**Ingest invariants (planned — validate at ingest, per the [constitution](kerfuffle-fantasy-constitution.md)):** a failed check is a **loud failure**, never a silent pass.

- **12 teams** present.
- **Every active-roster row resolves to a numeric `cbs_player_id`** *or* is classified as a **dead-cap pseudo-row** (an inactive pseudo-player the commissioner manually adds to a roster) — the exact modelling is the open decision above.
- **Team salary sums, including IR, ≤ $500.**
- **Contract years ∈ {1, 2, 3, 4}.**
- **Column mapping is by header text, never by position:** read the header row, build a name→index map, pull cells by name. A missing expected header is a loud failure; positional parsing fails silently with wrong values.

**Scoring-authority rule:** **CBS actuals are authoritative — never recompute scored points for real games.** CBS applied KERFUFFLE settings (including first downs) to every game; recomputing risks disagreeing with the official record. The parsed `scoring_rule` config exists only to translate FantasyPros raw stat-line projections into KERFUFFLE points, not to re-score actuals.

## Access and permissions

Not applicable yet. Single-user, local-only, no accounts, no database, no network. (Vision non-goal: no multi-user, ever, without a deliberate reversal.)

## AI-generated data

None. No field in the prototype is model-generated; all mock values are hand-authored or deterministically derived in code.

## Migrations

| | |
| --- | --- |
| **Where they live** | none yet (no database) |
| **How to run them** | n/a |
| **Rules** | When a database is introduced: never hand-edit it; never edit a migration that has already run — write a new one; and update this doc **with** the migration. |

---

**Related docs:** [`architecture.md`](architecture.md) (where this data sits — the mock-data boundary) · [`decision_log.md`](decision_log.md) (D-05: localStorage for view configs) · [`pm/implementation_reality_log.md`](pm/implementation_reality_log.md) (log it there when a data constraint forces a change to the product plan)
