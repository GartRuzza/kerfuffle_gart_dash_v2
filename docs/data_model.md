# Data Model — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code. **Any change here needs the product owner's approval before it is made** — schema changes are among the hardest things to reverse once real user data exists.
> **Update when:** Entities, fields, relationships, or permission rules change. Update it **with** the migration, not after.
> **This doc contains:** The entities, how they relate, and the rules that protect the data.
> **This doc never contains:** Speculative tables. If it is not in a migration, it is not in this doc — mark planned entities **(planned)** explicitly.

**Last updated:** 2026-08-20 · **Latest migration:** none (no database exists yet)

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

**Informed by the CBS discovery spike (issue #5 — [`cbs_data_discovery.md`](cbs_data_discovery.md)):** CBS is confirmed to expose, per player, a stable **CBS numeric player id** (the intended FantasyPros join key), name, NFL team, position, **salary**, and **contract length** (years remaining, 1–4). Per-team rosters (12 teams), the free-agent pool, the transaction log (2024–26), scoring/settings, and draft/auction values are all reachable read-only. This is **proven source shape, still not a schema** — do not build tables from it until the ingestion issue is scoped and approved. Two fields the engine/lenses will want are **not yet retrievable** and remain open: historical-season data (backtest) and FAB winning-bid amounts (price curve).

## Rules that protect the data

- **No schema is introduced without owner approval.** Introducing a real database/schema is a sensitive change (CLAUDE.md) — stop and flag first.
- **localStorage holds UI config only** — never player, league, or personal data, and nothing sensitive.
- The mock fixture is the **single** place invented data enters (`lib/mockData.ts`); components consume typed shapes and never hard-code data.

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
