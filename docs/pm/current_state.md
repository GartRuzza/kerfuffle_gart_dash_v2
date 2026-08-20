# Current State — Raccoon Command (working name)

> **How to use this doc**
> **Owner:** Claude Code (the implementing agent), verified by the product owner.
> **Update when:** At the end of **every** build cycle, before reporting the work complete. This is not optional — an out-of-date current_state is worse than no current_state, because it is trusted.
> **This doc contains:** Only what exists in the code **right now**.
> **This doc never contains:** Plans, intentions, or anything phrased as "will." If it is not built, it does not get described here as if it were. Plans live in [`roadmap.md`](roadmap.md).
>
> **Read this doc before any planning or building.** It is the grounding doc — it exists to stop us from assuming a feature is built when it is not.

**Last updated:** 2026-08-20 · **Updated by:** Claude Code (table redesign, Phase 1) · **Reflects commit:** feat/issue-1-player-table-prototype

---

## At a glance

**One thing is built: the player table prototype (UI only, mock data).** Everything downstream of real data — ingestion, the engine, the lenses — is still Not built. The prototype runs locally and renders a complete, interactive table, but every number in it is invented; it reflects no real league state.

- **Built** — works end to end, in the product, usable by a real user today.
- **Partial** — some of it exists, but a real user cannot rely on it yet. The gap must be named in the section below.
- **Not built** — no usable implementation exists, even if code has been started.

| Feature / capability | Status | Notes |
| --- | --- | --- |
| Player table (prototype) | **Built** | Local Next.js app, mock data only. Dark theme; position badges; FantasyPros-style tier bands (rank-sorted); expanded rank/ECR columns; position dropdown (incl. SuperFlex/Flex); inline-editable Ceiling; MOCK-DATA banner. See details below. |
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

**Player table prototype — what it does (after the v2 redesign, Phase 1):** runs locally (`npm install`, then `npm run dev`, at http://localhost:3000) as one screen with a **dark theme**; ~80 real-name players across QB/RB/WR/TE spanning a free-agent pool, the Rangoon Raccoons' roster, and 3 rival rosters; columns Owner, Player, **Pos (colored badge)**, Team, **Kerf Ovr Rank, Kerf Pos Rank,** Proj Points, Kerf Value, Ceiling, Edge (plain), Market Value, **Ovr ECR, Pos ECR, Dyn Ovr ECR, Dyn Pos ECR,** Salary, Contract; columns tinted into **GartStats / Market / Contract Info** groups with a color-key legend (no spanning headers); sorting with a sleek filled-caret; **FantasyPros-style tier bands** that appear only when sorted by one of the six rank columns, with the band set specific to the sort field (Kerf/ECR/Dynasty × overall/positional) and the coupled sort↔position rules (auto-switch to QB / revert to no-tiers) centralized in `lib/tierRules.ts`; a **position dropdown** (All, SuperFlex, Flex, QB/RB/WR/TE); the existing roster filter (restyled); an inline-editable Ceiling; and an always-visible MOCK-DATA banner.

**What it deliberately does *not* do:** no real data (all values, ranks, and the six mock tier dimensions are hand-authored or derived, not computed by an engine); no filter-bar redesign (single team dropdown + free-agent toggle + column picker + saved/custom views — that's **Phase 2**); no column show/hide or drag-reorder yet (Phase 2); no data-dictionary popup (**Phase 3**); no persistence (ceilings reset on reload); no accounts, no deployment, no real data schema. DST has a badge color but no DST players exist in the mock data.

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
| **Tests** | **Vitest unit tests** (`npm test`) — 14 passing, covering mock-data derivation and the tier/sort/position rules. `npm run build` (compile + type-check + lint) passes; render verified. UI interaction checks remain manual — see [`../qa_test_plan.md`](../qa_test_plan.md). |

## Latest implementation summary

**2026-08-20 — Table redesign, Phase 1 of 3 (dark theme + columns + tier bands).** On owner feedback, the prototype was redesigned toward a dark, Gamecast-style dashboard (teal accent, compact rows, centered "Gart Dash" title). Position cells became colored badges (QB/RB/WR/TE/DST). The single tier column was replaced by **FantasyPros-style tier bands** driven by six mock tier dimensions (Kerf/ECR/Dynasty × overall/positional); bands appear only under a matching rank sort, with the coupled sort↔position behaviour (auto-switch to QB, revert-to-no-tiers) centralized and unit-tested in `lib/tierRules.ts`. Columns were expanded/renamed (Kerf Ovr + Pos Rank; Ovr/Pos ECR; Dyn Ovr/Pos ECR; Market Value; Proj Points), regrouped into GartStats/Market/Contract-Info tints with a color key, and Edge made plain. A position dropdown (incl. SuperFlex/Flex) was added. **Vitest** was introduced (14 tests). This is Phase 1; the filter-bar/view system (Phase 2) and data dictionary (Phase 3) are not yet built. Validated by unit tests + clean build + rendered-DOM checks.

**2026-08-19 — Player table prototype built (Issue #1, UI only, mock data).** The first product code landed: a single-screen Next.js (App Router) + TypeScript app, styled with Tailwind, table powered by TanStack Table v8, on the stack decided in [`../decision_log.md`](../decision_log.md) D-01. It renders 79 hand-authored mock players across QB/RB/WR/TE (free-agent pool + Rangoon Raccoons + 3 rivals) with the full column set, grouped "Yours" vs "The Market" columns and a color-coded Edge column, sorting, combining roster + position filters, colored tier badges, an inline-editable Ceiling pre-seeded to KERF Value, and a permanent MOCK-DATA banner. Runs locally with `npm install` then `npm run dev`. All data is mock; no engine, no schema, no persistence, no deployment. `npm run build` passes; interactive QA is manual (owner sign-off pending) — see [`../qa_test_plan.md`](../qa_test_plan.md). After an owner review the same day, two shared-table columns (KERF Rank, Proj Pts) were added to serve the non-auction flows, and the per-lens fields (waiver bid range, remaining cap, trade compare, matchup) were logged to [`../feature_backlog.md`](../feature_backlog.md). Styling was then refactored onto a semantic design-token layer (all colors defined once in `tailwind.config.ts`, components reference role-based tokens) — no visual change; see [`../decision_log.md`](../decision_log.md) D-02.

**2026-08-19 — Project initialized, docs only; stack decided, Issue #1 opened.** The four intent docs (vision, brief, user flows, roadmap) were written and committed. The tech stack was then decided (Next.js + TypeScript — [`../decision_log.md`](../decision_log.md) D-01) and GitHub Issue #1 (player table prototype, UI only) was created and readied for build.

---

**Related docs:** [`roadmap.md`](roadmap.md) is what we plan to build. [`implementation_reality_log.md`](implementation_reality_log.md) is why what we built differs from what we planned.