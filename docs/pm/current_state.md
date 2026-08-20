# Current State — Raccoon Command (working name)

> **How to use this doc**
> **Owner:** Claude Code (the implementing agent), verified by the product owner.
> **Update when:** At the end of **every** build cycle, before reporting the work complete. This is not optional — an out-of-date current_state is worse than no current_state, because it is trusted.
> **This doc contains:** Only what exists in the code **right now**.
> **This doc never contains:** Plans, intentions, or anything phrased as "will." If it is not built, it does not get described here as if it were. Plans live in [`roadmap.md`](roadmap.md).
>
> **Read this doc before any planning or building.** It is the grounding doc — it exists to stop us from assuming a feature is built when it is not.

**Last updated:** 2026-08-19 · **Updated by:** Claude Code (Issue #1 build) · **Reflects commit:** feat/issue-1-player-table-prototype

---

## At a glance

**One thing is built: the player table prototype (UI only, mock data).** Everything downstream of real data — ingestion, the engine, the lenses — is still Not built. The prototype runs locally and renders a complete, interactive table, but every number in it is invented; it reflects no real league state.

- **Built** — works end to end, in the product, usable by a real user today.
- **Partial** — some of it exists, but a real user cannot rely on it yet. The gap must be named in the section below.
- **Not built** — no usable implementation exists, even if code has been started.

| Feature / capability | Status | Notes |
| --- | --- | --- |
| Player table (prototype) | **Built** | Local Next.js app, mock data only. Sort, roster + position filters, tier badges, color-coded Edge column, inline-editable Ceiling, permanent MOCK-DATA banner. See details below. |
| Player table (on real data) | Not built | Waits on data ingestion + engine (roadmap #2–6). |
| CBS API ingestion | Not built | Access itself is unproven — spike is roadmap item #2 |
| FantasyPros ingestion | Not built | Access method is an open decision (roadmap decision #2) |
| Valuation engine (core or complete) | Not built | — |
| Backtest | Not built | — |
| Auction prep lens | Not built | — |
| Waiver additions | Not built | — |
| Trade evaluation/construction | Not built | — |

## Partially built — what exactly is missing

Nothing is in a Partial state. The player table prototype is fully Built **as a prototype** — but note precisely what "Built" means here, so it is never mistaken for the real feature:

**Player table prototype — what it does:** runs locally (`npm install`, then `npm run dev`, at http://localhost:3000) as one screen; ~80 real-name players across QB/RB/WR/TE spanning a free-agent pool, the Rangoon Raccoons' roster, and 3 rival rosters; the column set Owner, Player, Pos, Team, Tier, **KERF Rank, Proj Pts,** KERF Value, Ceiling, Edge, Market Price, ECR, Dynasty ECR, Salary, Contract; the "Yours" vs "The Market" columns visually grouped and color-tinted with an Edge column between them; sorting; roster + position filters that combine; colored tier badges; an inline-editable Ceiling pre-seeded to KERF Value that holds for the session; and an always-visible MOCK-DATA banner. (KERF Rank = our positional rank from KERFUFFLE value; Proj Pts = a mock projected-points number — both are shared-table fields serving the waiver/trade/start-sit flows too, added after owner review.)

**What it deliberately does *not* do:** no real data (all values hand-authored), no valuation engine, no drill-into-inputs, no cap-sum check, no suggested/roster-aware ceiling, no persistence (ceilings reset on reload), no accounts, no deployment, no data schema. These are all out of scope for Issue #1 and belong to later roadmap items.

## Current limitations

- **Everything in the table is mock data.** Real NFL names, but invented salaries, values, tiers, and rankings — authored only to exercise the UI. Nothing is computed; nothing is real.
- **No persistence.** Edited ceilings reset on page reload. There is no database, no storage, no accounts.
- **Local only.** The app is not deployed anywhere; it runs on the owner's machine via `npm run dev`.
- Neither data source (CBS API, FantasyPros) is verified to be accessible. All plans downstream of data assume the spikes (roadmap #2–3) succeed in some form.
- Contract-length data location is unknown — possibly not in CBS at all (roadmap open decision #1).
- Next.js 15 pulls in 3 high-severity npm advisories through build-time transitive deps (postcss; sharp, which we don't use). The only patch upgrades Next to v16, a breaking major-dependency change — deferred as a follow-up decision (see reality log). Negligible risk for a local, no-image prototype.

## Known bugs

| # | Bug | Impact | Severity | Status |
| --- | --- | --- | --- | --- |
| — | No code, no bugs | — | — | — |

## Build and deploy status

| | |
| --- | --- |
| **Active branch** | feat/issue-1-player-table-prototype |
| **Deployed to production** | No. Nothing is deployed anywhere. |
| **Environments live** | Local only — `npm run dev` at http://localhost:3000 |
| **Tests** | No automated suite yet. `npm run build` (compile + type-check + lint) passes; render verified. Interactive checks are manual — see [`../qa_test_plan.md`](../qa_test_plan.md). |

## Latest implementation summary

**2026-08-19 — Player table prototype built (Issue #1, UI only, mock data).** The first product code landed: a single-screen Next.js (App Router) + TypeScript app, styled with Tailwind, table powered by TanStack Table v8, on the stack decided in [`../decision_log.md`](../decision_log.md) D-01. It renders 79 hand-authored mock players across QB/RB/WR/TE (free-agent pool + Rangoon Raccoons + 3 rivals) with the full column set, grouped "Yours" vs "The Market" columns and a color-coded Edge column, sorting, combining roster + position filters, colored tier badges, an inline-editable Ceiling pre-seeded to KERF Value, and a permanent MOCK-DATA banner. Runs locally with `npm install` then `npm run dev`. All data is mock; no engine, no schema, no persistence, no deployment. `npm run build` passes; interactive QA is manual (owner sign-off pending) — see [`../qa_test_plan.md`](../qa_test_plan.md). After an owner review the same day, two shared-table columns (KERF Rank, Proj Pts) were added to serve the non-auction flows, and the per-lens fields (waiver bid range, remaining cap, trade compare, matchup) were logged to [`../feature_backlog.md`](../feature_backlog.md).

**2026-08-19 — Project initialized, docs only; stack decided, Issue #1 opened.** The four intent docs (vision, brief, user flows, roadmap) were written and committed. The tech stack was then decided (Next.js + TypeScript — [`../decision_log.md`](../decision_log.md) D-01) and GitHub Issue #1 (player table prototype, UI only) was created and readied for build.

---

**Related docs:** [`roadmap.md`](roadmap.md) is what we plan to build. [`implementation_reality_log.md`](implementation_reality_log.md) is why what we built differs from what we planned.