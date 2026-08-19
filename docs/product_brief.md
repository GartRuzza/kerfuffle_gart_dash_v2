# Product Brief — Gart Dash

> **Owner:** Product owner, with PM Claude.
**Update when:** The vision changes, or the MVP scope changes. Keep it in step with `pm/product_vision.md`.
**This doc contains:** The working, actionable definition of the product — what an agent needs to know in 60 seconds before touching anything.
**This doc never contains:** Status, progress, or timelines. What exists is in `pm/current_state.md`; what comes next is in `pm/roadmap.md`.
> 
> 
> **Vision vs. brief:** the vision is the north star and argues *why*. This brief is the short operational answer to *what are we building, for whom, and where does it stop*. If they ever disagree, the vision wins and this doc is wrong.
> 

**Last updated:** 2026-08-19

---

## In one sentence

Gart Dash gives the Rangoon Raccoons owner two numbers side by side — what a player is worth in KERFUFFLE and what he costs — so every bid, claim, start, and trade is made on a visible edge instead of a gut feel.

## What it is

A single web application, run locally to start but built so it can be deployed to the web later without rework. One valuation engine — KERFUFFLE-adjusted player value against market price, fed live by the CBS league API and FantasyPros — serves all four decisions (bid, claim, start, trade) as different views of the same data, **not** as three separate modules. It is used in focused sessions: auction-prep week, Tuesday-night waivers, and whenever a trade offer lands.

## Who it serves

| **Primary user** | The owner of the Rangoon Raccoons (KERFUFFLE, Fast Finishers Division). This is a one-person tool. |
| --- | --- |
| **Their job to be done** | Decide what to bid, who to claim, who to start, and whether a trade is good — in a $500-cap, multi-year-contract, PPFD superflex dynasty league whose rules make public rankings systematically wrong. |
| **What they use today** | FantasyPros ECR adjusted in his head, salary math in spreadsheets, TRUFFLEdash for trade cap implications, and the CBS site as the system of record. |
| **Why they would switch** | The edge is the *gap* between KERFUFFLE-true value and what the league is paying — and today that gap is invisible. No public tool knows this league’s scoring, cap, or contract economy. |

## MVP scope

**The MVP is not done without:**

- **Live league data in** — CBS API ingestion (rosters, salaries, contracts, transactions, scoring) plus FantasyPros rankings/ECR, so every view reflects the real league state without manual entry.
- **The valuation engine** — KERFUFFLE-adjusted player values (league scoring, superflex, replacement level defined from data) shown always alongside market price/consensus, with tiers rather than decimal ranks, drillable to the inputs driving each number.
- **Auction view** — the engine pointed at the free-agent pool: value vs. expected price, roster-aware ceiling alongside market-generic value, and cap-space awareness. First view built, because the Free Agent Auction is the nearest real-money decision.
- **Waiver view** — the same engine pointed at the in-season FAB decision: available players, value vs. bid, cap space remaining.
- **Trade view** — both sides of an offer in KERFUFFLE points, roster-aware value to the Raccoons, and contract terms against the league curve, with cap legality checked.

*(One platform, one engine, three lenses. The auction lens is built first; the others reuse its foundation.)*

**Deliberately out of the MVP:** *(see `pm/roadmap.md` for the full deferred list and reasoning)*

- Web deployment — architecture must support it, but hosting, auth, and multi-device polish wait until the tool has proven itself locally.
- Contract-duration recommendations — dynasty ECR is displayed as context; the call stays human (per the vision’s non-goals).
- Lineup/start-sit optimization beyond what the value tiers already imply — start decisions are served by the same numbers before a dedicated view earns its keep.

## Non-goals

- **We do not recommend contract durations.** Duration hinges on real-life NFL contract and depth-chart situations we don’t model. Dynasty ECR is shown as context; the decision is the owner’s.
- **We do not model real-life NFL contracts or depth charts (yet).** The two biggest unmodeled inputs — deferred deliberately, not forgotten.
- **We do not build for the Bench Cup.** It doesn’t factor into the owner’s decisions.
- **We do not build tanking or draft-lottery optimization.** Out of scope entirely.
- **We do not touch TRUFFLE.** KERFUFFLE only.
- **We do not replace CBS.** CBS stays the system of record and execution layer; this product is the decision layer on top of it.
- **We do not build for other users.** No accounts, no sharing, no commissioner tools. One owner, one team.

## How we win

The gap. Every number the league sees is public and league-blind; every number this product shows is KERFUFFLE-true and paired with its market price. If the re-ranked values genuinely beat raw ECR at predicting KERFUFFLE points — and the owner can drill into *why* a player moved — the tool earns trust at the moment of a real-money bid. Transparent and league-correct beats sophisticated and opaque.

---

**Related docs:** `pm/product_vision.md` (the north star this summarizes) · `user_flows.md` (how a user actually moves through it) · `architecture.md` (how it is built)
