# Gart Dash

**Gart Dash gives the Rangoon Raccoons owner two numbers side by side — what a player is worth in KERFUFFLE and what he costs — so every bid, claim, start, and trade is made on a visible edge instead of a gut feel.**

**Status:** The player table runs on **real league data** (local SQLite store); the valuation engine is next — see [`docs/pm/current_state.md`](docs/pm/current_state.md)
**Live at:** not deployed (local-first by design)

---

## What it is

A single-user decision layer on top of a CBS dynasty fantasy football league (KERFUFFLE: $500 cap, multi-year contracts, PPFD superflex). One valuation engine — KERFUFFLE-adjusted player value against market price, fed by the CBS league API and FantasyPros — serves auction bids, waiver claims, trades, and start/sit as different filters on the same player table. CBS remains the system of record; Gart Dash is where the decisions get made.

**Who it's for:** the owner of the Rangoon Raccoons. One user, one team.

For the full picture: [`docs/product_brief.md`](docs/product_brief.md) is the 60-second working definition; [`docs/pm/product_vision.md`](docs/pm/product_vision.md) is why the product exists at all.

## Where the truth lives

This project's source of truth is its docs, not any chat history. **Start here:**

| To know… | Read |
| --- | --- |
| **What actually exists right now** | [`docs/pm/current_state.md`](docs/pm/current_state.md) — always start here |
| What the product is | [`docs/product_brief.md`](docs/product_brief.md) |
| What's being built next | [`docs/pm/roadmap.md`](docs/pm/roadmap.md) |
| How a user moves through it | [`docs/user_flows.md`](docs/user_flows.md) |
| How the system is built | [`docs/architecture.md`](docs/architecture.md) |
| How the data is shaped | [`docs/data_model.md`](docs/data_model.md) |
| Why we chose what we chose | [`docs/decision_log.md`](docs/decision_log.md) |
| How to test it | [`docs/qa_test_plan.md`](docs/qa_test_plan.md) |
| What changed recently | [`docs/release_notes.md`](docs/release_notes.md) |

**Work pipeline:** [GitHub Issues](../../issues) · [Project board](../../projects)

> **A roadmap item is a plan, not a feature.** Only [`current_state.md`](docs/pm/current_state.md) says what is real.

## Tech stack

| Layer | What we use |
| --- | --- |
| App | **Next.js (App Router) + TypeScript** — one local-first app, web-deployable later. See [`docs/decision_log.md`](docs/decision_log.md) D-01. |
| Table | **TanStack Table** v8 (sort / filter / column show-hide + reorder / editable cells); **@dnd-kit** for header drag |
| Styling | **Tailwind CSS** v3 with a semantic design-token layer, dark theme (D-02, D-03) |
| Testing | **Vitest** — `npm test` (D-04) |
| Persistence | **SQLite** (`better-sqlite3`) for league data (D-10); browser **localStorage** for saved views only (D-05) |
| Data | Real **CBS** (authenticated HTML, D-08) + **FantasyPros** (JSON API, HOF tier, D-09), joined on `cbs_player_id`. Fetched out-of-band, never at page load. |

## Running it locally

Requires [Node.js](https://nodejs.org). From the project folder:

```
npm install     # once

npm run archive  # 1. save a fresh, dated snapshot of CBS + FantasyPros (needs credentials)
npm run ingest   # 2. load those snapshots into the local database (validates loudly)
npm run dev      # 3. open http://localhost:3000
```

Steps 1–2 are the data routine (~weekly, whenever you want fresh data); step 3 is the app.
Credentials live in git-ignored `.env` files — see [`tools/archive/README.md`](tools/archive/README.md);
check yours first with `npm run archive:check-cookie`. The database (`data/gart-dash.sqlite`) is
git-ignored and disposable: delete it and `npm run ingest` rebuilds it from the raw archive.

Run the unit tests with `npm test`.

## How we work

```
idea → docs/feature_backlog.md → docs/pm/roadmap.md → GitHub Issue → branch → PR → docs updated → merge
```

Nothing meaningful goes straight to `main`. Every pull request carries a plain-English summary, manual QA steps, and doc updates **in the same diff as the code**.

**For AI agents:** [`CLAUDE.md`](CLAUDE.md) is the rulebook — what to read before starting, what to update before reporting done. Two rules worth repeating here: **one player table, many filters** (never build per-flow screens — see [`docs/user_flows.md`](docs/user_flows.md)) and **auction day stays deliberately dumb** (no live tracking unless the owner decides it).

## Testing and releasing

Follow [`docs/qa_test_plan.md`](docs/qa_test_plan.md) once checks exist. A feature is not "Built" in [`current_state.md`](docs/pm/current_state.md) until its checks pass.

## Known limitations

- **No valuation engine yet** — Kerf value/ranks/tiers, Market Value, and Edge show "—", and the Ceiling box starts blank. That engine is the next roadmap item; everything it needs is now in the store.
- **Data freshness is manual** — `npm run archive` then `npm run ingest`; nothing is scheduled (a scheduled run with an expired CBS cookie would silently collect nothing). The "League data as of" banner is the tell.
- **Free agents come from the FantasyPros board**, not CBS's own free-agent page (that page is JavaScript-rendered and not captured yet).
- Local only, single user, no login. The 2026 Free Agent Auction is the fixed deadline the whole Now column is scoped to.
