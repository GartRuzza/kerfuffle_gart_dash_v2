# Gart Dash

**Gart Dash gives the Rangoon Raccoons owner two numbers side by side — what a player is worth in KERFUFFLE and what he costs — so every bid, claim, start, and trade is made on a visible edge instead of a gut feel.**

**Status:** Concept — docs written, no code yet
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
| All layers | **Not chosen yet.** Claude Code proposes (constraint: local-first, web-deployable later), owner approves, logged in [`docs/decision_log.md`](docs/decision_log.md). Roadmap open decision #4. |

## Running it locally

Nothing to run yet — no code exists. This section gets filled in with the first build.

## How we work

```
idea → docs/feature_backlog.md → docs/pm/roadmap.md → GitHub Issue → branch → PR → docs updated → merge
```

Nothing meaningful goes straight to `main`. Every pull request carries a plain-English summary, manual QA steps, and doc updates **in the same diff as the code**.

**For AI agents:** [`CLAUDE.md`](CLAUDE.md) is the rulebook — what to read before starting, what to update before reporting done. Two rules worth repeating here: **one player table, many filters** (never build per-flow screens — see [`docs/user_flows.md`](docs/user_flows.md)) and **auction day stays deliberately dumb** (no live tracking unless the owner decides it).

## Testing and releasing

Follow [`docs/qa_test_plan.md`](docs/qa_test_plan.md) once checks exist. A feature is not "Built" in [`current_state.md`](docs/pm/current_state.md) until its checks pass.

## Known limitations

- Nothing is built. There is no code.
- Neither data source is verified: CBS API access and FantasyPros access are both unproven (roadmap items #2–3).
- Contract-length data may not live in CBS at all (roadmap open decision #1).
- The 2026 Free Agent Auction is the fixed deadline the whole Now column is scoped to.
