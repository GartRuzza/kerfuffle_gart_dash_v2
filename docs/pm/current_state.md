# Current State — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code (the implementing agent), verified by the product owner.
> **Update when:** At the end of **every** build cycle, before reporting the work complete. This is not optional — an out-of-date current_state is worse than no current_state, because it is trusted.
> **This doc contains:** Only what exists in the code **right now**.
> **This doc never contains:** Plans, intentions, or anything phrased as "will." If it is not built, it does not get described here as if it were. Plans live in [`roadmap.md`](roadmap.md).
>
> **Read this doc before any planning or building.** It is the grounding doc — it exists to stop us from assuming a feature is built when it is not.

**Last updated:** 2026-08-20 · **Updated by:** Claude Code (FantasyPros data discovery spike, issue #7) · **Reflects:** FantasyPros spike (issue #7) on top of the CBS spike (issue #5)

---

## At a glance

**One thing is built: the player table prototype (UI only, mock data).** Everything downstream of real data — ingestion, the engine, the lenses — is still Not built. The prototype runs locally and renders a complete, interactive table, but every number in it is invented; it reflects no real league state.

- **Built** — works end to end, in the product, usable by a real user today.
- **Partial** — some of it exists, but a real user cannot rely on it yet. The gap must be named in the section below.
- **Not built** — no usable implementation exists, even if code has been started.

| Feature / capability | Status | Notes |
| --- | --- | --- |
| Player table (prototype) | **Built** | Local Next.js app, mock data only. Dark theme; position badges; tier bands; expanded columns; roster/manager + position filters; column show/hide + drag-reorder; saved views (localStorage); inline-editable Ceiling; **data-dictionary overlay (placeholder content)**; MOCK-DATA banner. The 3-phase redesign is complete. See details below. |
| Player table (on real data) | Not built | Waits on data ingestion + engine (roadmap #2–6). |
| CBS API ingestion | Not built | **Access now PROVEN read-only** (spike, issue #5): auth via the owner's session cookie; data is server-rendered **HTML** at clean league URLs (old JSON API is dead); **contract length confirmed present**. The ingestion module itself is not built. Full findings: [`../cbs_data_discovery.md`](../cbs_data_discovery.md). |
| FantasyPros ingestion | Not built | **Access now PROVEN** (spike, issue #7): official JSON API, `x-api-key` auth; returns ECR, positional rank, **tiers**, expert spread, redraft + dynasty, all scoring formats. The CBS↔FantasyPros join is a **direct `cbs_player_id` match** (no fuzzy matching). Free tier is a 10-of-520 preview; the full board needs the **HOF tier (~$9/mo)** — owner upgraded, cap-lift pending confirmation. The ingestion module itself is not built. Full findings: [`../fantasypros_data_discovery.md`](../fantasypros_data_discovery.md). |
| Valuation engine (core or complete) | Not built | — |
| Backtest | Not built | — |
| Auction prep lens | Not built | — |
| Waiver additions | Not built | — |
| Trade evaluation/construction | Not built | — |

## Partially built — what exactly is missing

Nothing is in a Partial state. The player table prototype is fully Built **as a prototype** — but note precisely what "Built" means here, so it is never mistaken for the real feature:

**Player table prototype — what it does (v2 redesign, Phases 1–2):** runs locally (`npm install`, then `npm run dev`, at http://localhost:3000) as one screen with a **dark theme**; ~80 real-name players across QB/RB/WR/TE spanning a free-agent pool, the Rangoon Raccoons' roster, and 3 rival rosters; columns Owner, Player, **Pos (colored badge)**, Team, Kerf Ovr Rank, Kerf Pos Rank, Proj Points, Kerf Value, Ceiling, Edge (green +/red −), Market Value, Ovr ECR, Pos ECR, Dyn Ovr ECR, Dyn Pos ECR, Salary, Contract, tinted into **GartStats / Market / Contract Info** groups with a color-key legend; sorting with a filled caret; **FantasyPros-style tier bands** driven by six mock tier dimensions (bands appear only under a matching rank sort; the coupled sort↔position rules live in `lib/tierRules.ts`).

**Phase 2 (view system) adds:** a 3-way **roster toggle** (All / Rostered / Free Agents) beside a **Manager dropdown** (All / each team); the **position dropdown** (All/SuperFlex/Flex/QB/RB/WR/TE); a **column picker** to show/hide columns; **drag-to-reorder** column headers (@dnd-kit, mounted client-side to stay SSR-safe); and **saved views** — five built-in default views (Full, Auction Prep, Waivers, Trades, Start/Sit) plus user-created custom views, **persisted in browser localStorage**. Opens to Full. The table scrolls inside a bounded, sticky-header container so both scrollbars stay on screen. (Ovr ECR / Dyn Ovr ECR display the unique overall rank so tier bands stay contiguous.)

**Phase 3 adds:** a **Data Dictionary** overlay (button at the bottom) that defines each column — a one-line definition plus an expandable bulleted deep-dive (mechanics + source). **The structure is built but most content is placeholder** (flagged "Placeholder"), to be filled after data discovery (roadmap #2–3) and the engine (#4–6).

**What it deliberately does *not* do:** no real data (all values, ranks, and the six mock tier dimensions are hand-authored or derived, not computed by an engine); the data-dictionary content is mostly placeholder; ceilings still reset on reload (only view configs persist); no accounts, no deployment, no real data schema. DST has a badge color but no DST players exist in the mock data.

## Current limitations

- **Everything in the table is mock data.** Real NFL names, but invented salaries, values, tiers, and rankings — authored only to exercise the UI. Nothing is computed; nothing is real.
- **Limited persistence.** Custom *views* persist in browser localStorage (per browser, not synced); everything else — including edited ceilings — resets on reload. No database, no accounts.
- **Local only.** The app is not deployed anywhere; it runs on the owner's machine via `npm run dev`.
- **Both data sources are now access-proven (read-only).** CBS via the session-cookie + HTML-parse method (spike #5); **FantasyPros via its official JSON API** (spike #7), and the CBS↔FantasyPros join is a direct `cbs_player_id` match. One FantasyPros item is assumed but **not yet confirmed**: that the **HOF (~$9/mo) tier lifts the free tier's 10-of-520 preview cap** and opens the projections/metadata/ADP/news endpoints (owner upgraded 2026-08-20; a re-run must confirm before the engine build). See [`../fantasypros_data_discovery.md`](../fantasypros_data_discovery.md).
- **Contract-length location resolved (spike #5): CBS exposes per-player contract length** (a "Contract" column, 1–4 yrs, on roster pages) — this closes roadmap open decision #1. Two things remain unsolved in CBS: programmatic **historical-season** retrieval (the year filter is JS/POST-driven) and **FAB winning-bid amounts** in the transaction log. See [`../cbs_data_discovery.md`](../cbs_data_discovery.md).
- Next.js 15 pulls in 3 high-severity npm advisories through build-time transitive deps (postcss; sharp, which we don't use). The only patch upgrades Next to v16, a breaking major-dependency change — deferred as a follow-up decision (see reality log). Negligible risk for a local, no-image prototype.

## Known bugs

| # | Bug | Impact | Severity | Status |
| --- | --- | --- | --- | --- |
| 1 | Tier bands duplicated/out-of-order + a React duplicate-key crash when sorting by Ovr ECR / Dyn Ovr ECR | Broken tier display on those sorts | High | **Fixed 2026-08-20** — those columns now sort by a unique derived rank (raw ECR had ties); band keys made collision-proof |
| 2 | Hydration mismatch console error from @dnd-kit (server vs client accessibility ids) | Console error on load; no functional break | Medium | **Fixed 2026-08-20** — drag context now mounts only on the client (SSR renders plain headers) |

## Build and deploy status

| | |
| --- | --- |
| **Active branch** | feat/issue-1-player-table-prototype |
| **Deployed to production** | No. Nothing is deployed anywhere. |
| **Environments live** | Local only — `npm run dev` at http://localhost:3000 |
| **Tests** | **Vitest unit tests** (`npm test`) — 21 passing, covering mock-data derivation (incl. the unique-rank invariant), the tier/sort/position rules, the saved-views model, and data-dictionary coverage. `npm run build` passes; render verified. UI interaction checks (drag, show/hide, save view, open dictionary) remain manual — see [`../qa_test_plan.md`](../qa_test_plan.md). |

## Latest implementation summary

**2026-08-20 — FantasyPros data discovery spike (issue #7, roadmap #3).** Proved, against the live FantasyPros JSON API, that we can pull expert-consensus rankings read-only — and settled the roadmap's "expected ugliest part" (matching players across the two sources) in the best possible way. Access is a self-serve `x-api-key` (the API is **not** approval-gated as the roadmap assumed). Rankings return **ECR (`rank_ecr`), positional rank (`pos_rank`), tiers, and the expert spread (`rank_min/max/ave/std`)** across **redraft + dynasty + ROS + weekly** and **PPR / half / standard**, from 99 experts. **The join is a direct id match: FantasyPros publishes a `cbs_player_id` on every player** that equals CBS's own id — confirmed against real CBS ids (Chase `2966320`, Nacua `3121687`, McCaffrey `2136743`). Cost/limit: the **free** tier is a **top-10-of-520 preview** (`public_api_limited: true`) and blocks projections/metadata/ADP/news (`403`); the full board needs the **HOF tier (~$9/mo)** — the owner upgraded, but the cap-lift + endpoint unlock **still need a confirming re-run** (the key had not yet propagated to HOF at write-time). Deliverables: a discovery report ([`../fantasypros_data_discovery.md`](../fantasypros_data_discovery.md)) and throwaway read-only tooling in `spikes/fantasypros-api/` (`pull.mjs`, `match.mjs`; not part of the app). No product code, schema, or app change. Resolves roadmap open decision #2 ([`../decision_log.md`](../decision_log.md) D-09). Nothing was ever written to FantasyPros; the API key and pulled data are git-ignored.

**2026-08-20 — CBS data discovery spike (issue #5, roadmap #2).** Proved, against the real KERFUFFLE league, that we can pull live data read-only. The old CBS v3 JSON API is dead; the working path is **authenticated HTML fetch + parse** — the modern league site renders data into page tables, gated only by the owner's **session cookie**. Reachable read-only: every team's roster (`/teams/roster-report/{teamId}/1`, teams 1–12) with **salary and contract length**, the free-agent pool (`/players`), the transaction log (`/transactions`, filterable 2024–26), league scoring/settings (`/rules`), and draft/auction values (`/draft/results`). **Contract length is present** (closes open decision #1); players carry a stable **CBS numeric id** (the FantasyPros join key). Validated by parsing the owner's real roster and confirming the numbers with him. Deliverables: a discovery report ([`../cbs_data_discovery.md`](../cbs_data_discovery.md)) and throwaway read-only tooling in `spikes/cbs-api/` (not part of the app). No product code, schema, or app change. Unsolved follow-ups: historical-season fetch and FAB bid amounts. Nothing was ever written to CBS; the cookie and pulled data are git-ignored.

**2026-08-20 — Table redesign, Phase 3 of 3 (data dictionary shell).** Added the Data Dictionary overlay: a button at the bottom opens a modal defining each column — a one-line definition (kept under 15 words) plus an expandable bulleted deep-dive (mechanics + source). Content is intentionally **mostly placeholder** (flagged per field) pending data discovery and the engine; the structure (`lib/dataDictionary.ts` + `components/DataDictionary.tsx`) is stable so later issues just fill in text. A coverage unit test guarantees every column has an entry (21 tests total). This completes the 3-phase redesign. Validated: unit tests + clean build + rendered-DOM check.

**2026-08-20 — Phase 2 polish: filter model, two bug fixes, sticky scroll.** On owner review: the roster control became a 3-way toggle (All / Rostered / Free Agents) next to a renamed **Manager** dropdown (All / team). Fixed two bugs the owner found — broken/duplicated **tier bands** when sorting by the overall-ECR columns (they sorted by raw ECR, which had ties; now they sort by a unique derived rank, and band keys are collision-proof) and a **@dnd-kit hydration** console error (drag now mounts client-side only). Table now scrolls in a bounded container with a **sticky header** so scrollbars stay on screen. 19 unit tests (added the unique-rank invariant). Validated: unit tests + clean build + rendered-DOM checks (SSR headers confirmed drag-free).

**2026-08-20 — Table redesign, Phase 2 of 3 (the view system).** Added the interactive view layer: the roster filter became a dropdown (All Players / Free Agents / each team) with a separate "include free agents" toggle; a column picker (show/hide); drag-to-reorder column headers via **@dnd-kit**; and **saved views** — five built-in default views mirroring the user flows (Full, Auction Prep, Waivers, Trades, Start/Sit) plus user-created custom views, persisted in **browser localStorage** (D-05). Opens to Full. Two new dependencies (@dnd-kit, plus the earlier Vitest). Validated: 18 unit tests (added the views model) + clean build + rendered-DOM checks. Phase 3 (data-dictionary popup) is next. Deferred by owner: ceiling persistence (still resets).

**2026-08-20 — Table redesign, Phase 1 of 3 (dark theme + columns + tier bands).** On owner feedback, the prototype was redesigned toward a dark, Gamecast-style dashboard (teal accent, compact rows, centered "Gart Dash" title). Position cells became colored badges (QB/RB/WR/TE/DST). The single tier column was replaced by **FantasyPros-style tier bands** driven by six mock tier dimensions (Kerf/ECR/Dynasty × overall/positional); bands appear only under a matching rank sort, with the coupled sort↔position behaviour (auto-switch to QB, revert-to-no-tiers) centralized and unit-tested in `lib/tierRules.ts`. Columns were expanded/renamed (Kerf Ovr + Pos Rank; Ovr/Pos ECR; Dyn Ovr/Pos ECR; Market Value; Proj Points), regrouped into GartStats/Market/Contract-Info tints with a color key, and Edge made plain. A position dropdown (incl. SuperFlex/Flex) was added. **Vitest** was introduced (14 tests). This is Phase 1; the filter-bar/view system (Phase 2) and data dictionary (Phase 3) are not yet built. Validated by unit tests + clean build + rendered-DOM checks.

**2026-08-19 — Player table prototype built (Issue #1, UI only, mock data).** The first product code landed: a single-screen Next.js (App Router) + TypeScript app, styled with Tailwind, table powered by TanStack Table v8, on the stack decided in [`../decision_log.md`](../decision_log.md) D-01. It renders 79 hand-authored mock players across QB/RB/WR/TE (free-agent pool + Rangoon Raccoons + 3 rivals) with the full column set, grouped "Yours" vs "The Market" columns and a color-coded Edge column, sorting, combining roster + position filters, colored tier badges, an inline-editable Ceiling pre-seeded to KERF Value, and a permanent MOCK-DATA banner. Runs locally with `npm install` then `npm run dev`. All data is mock; no engine, no schema, no persistence, no deployment. `npm run build` passes; interactive QA is manual (owner sign-off pending) — see [`../qa_test_plan.md`](../qa_test_plan.md). After an owner review the same day, two shared-table columns (KERF Rank, Proj Pts) were added to serve the non-auction flows, and the per-lens fields (waiver bid range, remaining cap, trade compare, matchup) were logged to [`../feature_backlog.md`](../feature_backlog.md). Styling was then refactored onto a semantic design-token layer (all colors defined once in `tailwind.config.ts`, components reference role-based tokens) — no visual change; see [`../decision_log.md`](../decision_log.md) D-02.

**2026-08-19 — Project initialized, docs only; stack decided, Issue #1 opened.** The four intent docs (vision, brief, user flows, roadmap) were written and committed. The tech stack was then decided (Next.js + TypeScript — [`../decision_log.md`](../decision_log.md) D-01) and GitHub Issue #1 (player table prototype, UI only) was created and readied for build.

---

**Related docs:** [`roadmap.md`](roadmap.md) is what we plan to build. [`implementation_reality_log.md`](implementation_reality_log.md) is why what we built differs from what we planned.