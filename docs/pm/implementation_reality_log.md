# Implementation Reality Log — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code (the implementing agent), read by the product owner and PM Claude.
> **Update when:** At the end of every build cycle, before reporting the work complete — one entry per cycle.
> **This doc contains:** Where reality diverged from the plan, and what that means for the product.
> **This doc never contains:** A changelog of everything that shipped. If the work went exactly as planned, the entry is three lines. **This log exists to capture surprises**, not activity.
>
> **Append-only. Newest entry at the top. Never edit or delete an old entry** — a log you can rewrite is a log nobody can trust.
>
> **Why this doc matters:** plans are made without full knowledge of the code. Every build teaches us something the plan did not know. This is where that knowledge goes, so that the next planning conversation starts from reality instead of from the last plan.
>
> *The example entry at the bottom is in italics and refers to a fictional product, "Ledgerly." Delete it once you have a real entry.*

---

## Entry template — copy this block for each build cycle

### [YYYY-MM-DD] — [Short title]

**Ticket / Issue:** [#NN, or a link] · **Branch:** [branch] · **Deviated from plan:** Yes / No

**Original intent**
*What the ticket asked for, in one or two sentences. Written from the plan, not from hindsight.*

**What was actually built**
*What now exists in the code. Be concrete and honest — this is the sentence that either grounds or misleads every future decision.*

**Deviations**
*The gap between the two sections above. If there is none, write "None" and skip the next two sections.*

**Why we deviated**
*The honest reason. Usually one of: the plan assumed something about the code that was not true; the work was larger than it looked; we found a better way; something outside our control changed. If it was a shortcut taken under time pressure, say so plainly — that is exactly the kind of thing this log exists to surface.*

**Product implications**
*The section the product owner reads. In plain English: what can a user now do, or not do, that the plan assumed they could? Does this change the roadmap, the MVP definition, or a promise we have made?*

**Technical tradeoffs and debt**
*What we now owe. Name the cost and what it will take to pay it down — "we will fix this later" with no description is how debt becomes invisible.*

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| [debt] | [reason] | [what it will break, and when] | [rough effort] |

**Follow-up decisions needed from the product owner**
*Questions this build raised that an agent must not answer alone. Anything listed here should be promoted into the Open product decisions table in [`roadmap.md`](roadmap.md). If there are none, write "None."*

- [ ] [Decision needed] — [what it blocks]

---

## Log

<!-- Newest entry goes here, directly below this line. -->

### 2026-08-20 — Table redesign Phase 3: data dictionary shell (placeholders)

**Ticket / Issue:** [#1](../../../../issues/1) (owner design feedback) · **Branch:** feat/issue-1-player-table-prototype · **Deviated from plan:** No (owner asked for structure now, content later)

**Original intent**
Final phase of the redesign: a bottom-of-page overlay defining each field — a concise (<15-word) definition plus an expandable bulleted deep-dive (mechanics + source). Owner explicitly asked to **set up the structure with placeholders now** and fill real content after data discovery.

**What was actually built**
Exactly that. `lib/dataDictionary.ts` holds one entry per column (definition + deep-dive bullets + a `placeholder` flag), with real one-liners for the UI-native fields (Owner, Player, Pos, Team, Ceiling, Edge) and clearly-flagged placeholders for the engine/market fields. `components/DataDictionary.tsx` renders a "📖 Data Dictionary" button that opens a modal (Esc/backdrop/✕ to close) listing every field with an expandable "Details" section. A unit test guarantees every column is documented and every definition stays under 15 words.

**Product implications**
The owner can open a per-column reference now; the honest "Placeholder" chips make clear which entries still need real source/mechanics content. This closes the 3-phase redesign. The next real work is data discovery (roadmap #2–3), after which the placeholders get filled.

**Technical tradeoffs and debt**
- Content is a stub by design — the debt is intentional and tracked by the `placeholder` flags; nothing to pay down until discovery.
- The modal is a lightweight custom overlay (no focus-trap library); fine for a single-user prototype.

**Follow-up decisions needed from the product owner:** None now. The dictionary **content** (real source + mechanics per field) gets written during/after data discovery and the engine build.

---

### 2026-08-20 — Phase 2 polish: filter model + two bug fixes

**Ticket / Issue:** [#1](../../../../issues/1) (owner review of Phase 2) · **Branch:** feat/issue-1-player-table-prototype · **Deviated from plan:** No (owner-requested changes + bug fixes)

**What changed**
- **Filter model** reshaped at owner's request: the roster control is now a 3-way toggle (All / Rostered / Free Agents) beside a renamed **Manager** dropdown (All / team). The old "Free Agents in the dropdown + include-FA checkbox" model was replaced. The saved-views model changed shape accordingly (`{ manager, rosterMode }`), and the default views were remapped (Auction/Waivers → Free Agents; Trades → Rostered; Start/Sit → Manager = Raccoons).
- **Bug 1 (tier bands):** sorting by Ovr ECR / Dyn Ovr ECR produced duplicated, out-of-order bands and a React duplicate-key crash. Root cause: those columns sorted by the **raw** ECR values, which have ties, so the row order didn't match the (unique) tier ranking → non-contiguous tiers. Fix: those columns now sort/display the **unique derived overall rank** (`ovrEcrRank`/`dynOvrRank`), matching the other four rank columns; band keys also made collision-proof. Guarded by a new unit test.
- **Bug 2 (hydration):** @dnd-kit emitted server/client-mismatched accessibility ids. Fix: the drag context now mounts **client-side only** (SSR renders plain, sortable-on-click headers), verified by checking the server HTML is drag-attribute-free.
- **Scroll UX:** the table now lives in a bounded-height container with a **sticky header**, so the horizontal scrollbar is reachable without scrolling to the bottom of a tall table.

**Product implications**
Cleaner, less-ambiguous roster filtering; the tier view is trustworthy on every rank sort; no console errors on load; easier side-to-side scrolling. Still mock data.

**Technical tradeoffs and debt**
- "Ovr ECR" now shows a contiguous 1..N overall rank rather than the raw authored consensus number — arguably more correct, and it's what makes tiers stable. Noted in case the real FantasyPros data wants the raw ECR shown instead (revisit at ingestion).
- The sticky-header `max-height` is a rough `calc(100vh - 15rem)`; may need tuning as the controls above it change.

**Follow-up decisions needed from the product owner:** None new. Phase 3 (data dictionary) content questions still pending.

---

### 2026-08-20 — Table redesign Phase 2: the view system

**Ticket / Issue:** [#1](../../../../issues/1) (owner design feedback) · **Branch:** feat/issue-1-player-table-prototype · **Deviated from plan:** No (built to the agreed Phase 2 scope)

**Original intent**
Phase 2 of the redesign: replace the roster buttons with a single dropdown, add a free-agent toggle, add column show/hide + drag-to-reorder, and add saved custom views (with default views mirroring the user flows), persisted in localStorage.

**What was actually built**
All of it. Roster dropdown (All Players / Free Agents / each team) + a separate "include free agents" toggle; a column picker (show/hide, with "Player" locked visible); drag-to-reorder headers via **@dnd-kit** (bound to TanStack's `columnOrder`); and a saved-views system (`lib/views.ts`) — five built-in default views plus user-created custom views, stored in **localStorage** and unit-tested. Opens to Full.

**Decisions worth noting (owner-resolved this session)**
- **"Free agents only" gap:** the dropdown+toggle model couldn't express "free agents only" (which Auction/Waiver need). Resolved by adding **"Free Agents" as a dropdown option**; the toggle then folds FAs into the All-Players/team views.
- **Opens to Full** (not last-used); **ceilings keep resetting** (owner deferred ceiling persistence); a saved view stores visible columns + order + sort + all filters; the **Player** column is always visible.
- Default-view sorts were all set to **Kerf Ovr Rank** (kept the sort column visible in every preset, so its bands/indicator make sense).

**Product implications**
The owner can now shape the table for each use case and save those arrangements — the mechanism the user flows imply. Still mock data; the default views' column choices are a starting point to react to. Nothing about the real build changed.

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| Two new deps (@dnd-kit; Vitest earlier) | Drag UX + strong validation, both owner-requested | Standard, well-maintained libs | — |
| Saved views persist in localStorage (per-browser, not synced) | Local-first, no backend yet | Views don't follow the owner across machines | Real sync needs a backend — out of scope until deployment |
| No component/interaction tests (drag, save-view wiring) | jsdom + Testing Library is a bigger lift; the *logic* is unit-tested | DOM wiring not regression-guarded | Add Testing Library when it stabilizes |
| `window.prompt` used to name a new view | Simplest for a local prototype | Slightly clunky UX | Swap for an inline input later |

**Follow-up decisions needed from the product owner:** For **Phase 3** (data dictionary): the per-field definitions + how much "source/mechanics" detail to write now, given the engine fields aren't real yet. Comes when we start it.

---

### 2026-08-20 — Table redesign Phase 1: dark theme, columns, tier bands

**Ticket / Issue:** [#1](../../../../issues/1) (owner design feedback) · **Branch:** feat/issue-1-player-table-prototype · **Deviated from plan:** N/A (new, owner-directed redesign, phased 1 of 3)

**Original intent**
Owner feedback asked to mirror a dark Gamecast/FantasyPros aesthetic and substantially expand the table: dark theme, colored position badges, tier *bands* (not a column) with field-specific tier sets and a coupled sort↔position rule set, a position dropdown with SuperFlex/Flex, expanded/renamed rank+ECR columns, group tints + a color key, and a sleeker sort caret. Agreed to build in **three phases**; this is Phase 1 (look + columns + tier logic). Phase 2 = the view system (filter-bar redesign, column show/hide, drag-reorder, saved views on localStorage, via @dnd-kit). Phase 3 = the data-dictionary popup.

**What was actually built**
All of Phase 1. Dark tokens (teal accent, compact) — the design-token layer from D-02 made this a config-level change. Six mock tier dimensions and the sort/position/tier state machine, both **unit-tested** in `lib/tierRules.ts` + `lib/mockData.ts`. The position dropdown, badges, regrouped/renamed columns, plain Edge, group legend. **Vitest** was added as the test runner (14 tests).

**Deviations & decisions worth noting**
- **Scope nudge:** the position dropdown (with SuperFlex/Flex) was pulled into Phase 1 because the tier bands depend on it. The rest of the filter bar stays Phase 2.
- **Default-tier vs revert nuance (owner-resolved):** load shows Kerf-Ovr-Rank tiers ON; leaving a positional sort by picking a multi-position clears the sort → same base order, tiers OFF. Implemented as "bands show only when the *active* sort is a rank column," so clearing the sort naturally removes bands.
- **SuperFlex == All** with the current data (only QB/RB/WR/TE) — kept anyway at owner's request for future-proofing.
- **Tiers are mock** (bucketed by rank). Real tiers come from the engine (Kerf) and FantasyPros (ECR) later.
- Added **Vitest** — a new dev dependency (see decision_log D-04).

**Product implications**
The owner now has the near-final look and the full column/tier behavior to react to, on mock data. Nothing about the real build changed. Interactive view features (hiding/reordering columns, saving views) and the data dictionary are explicitly still to come (Phases 2–3).

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| The sort↔position↔tier coupling is intricate stateful UI | It's the owner's designed behavior | Could grow hard to reason about if scattered | Mitigated: all rules live in `lib/tierRules.ts` with unit tests |
| Six mock tier dimensions bucketed by rank | Real tiering needs the engine/FantasyPros | Bands aren't "real" groupings yet | Replaced when engine/ECR tiers land |
| Legacy `tier` field left on the data (unused) | Avoided editing 79 rows | Minor dead field | Delete when convenient |

**Follow-up decisions needed from the product owner:** None new — Phase 2 questions (free-agent toggle logic, default-view contents, drag UX) come when we start it.

---

### 2026-08-19 — Follow-up: semantic design-token layer for styling

**Ticket / Issue:** [#1](../../../../issues/1) (same build cycle) · **Branch:** feat/issue-1-player-table-prototype · **Deviated from plan:** Yes — an owner-requested structural improvement

**What happened**
Reviewing the styling, the owner asked whether it was built for expandability — specifically whether there was a single style-guide/token file that components pull from, so a second module would stay consistent. There wasn't: colors were hardcoded as raw Tailwind classes (e.g. `bg-sky-50`) repeated across 8 files, and `tailwind.config.ts` defined no palette. At his direction I introduced a **semantic design-token layer** (D-02): the palette is now defined once in `tailwind.config.ts` by role (`yours`, `market`, `edge`, `tier`, `warning`, plus neutral `surface`/`ink`/`line`/`brand`), and all 8 files were refactored to use those tokens.

**Deviations / why:** A structural refactor beyond Issue #1's scope, done because the owner wanted the foundation right before layering on visual feedback — which is sound: the token layer means his coming feedback is a one-file change.

**Product implications**
No user-facing change — the tokens map to the exact shades already in use, so the app looks the same. The one deliberate visual delta: tier badges now use a single subtle neutral ring instead of a per-tier darker ring. Verified: `npm run build` passes, no raw color classes remain in `app/`/`components/`, and each token compiles to its expected color.

**Technical tradeoffs and debt:** None of note. Slight indirection (token name vs. raw color), accepted for the single-source-of-truth payoff. Neutrals are tokenized too, so dark mode later is a config change rather than a rewrite.

**Follow-up decisions needed from the product owner:** None. (The owner has visual feedback coming next — it now lands in `tailwind.config.ts`.)

---

### 2026-08-19 — Follow-up: shared-table columns for the non-auction flows (Proj Pts, KERF Rank)

**Ticket / Issue:** [#1](../../../../issues/1) (same build cycle) · **Branch:** feat/issue-1-player-table-prototype · **Deviated from plan:** Yes — a small, owner-directed scope addition

**What happened**
Reviewing the auction-focused prototype, the owner noted it lacked fields the *other* flows (waivers, trades, start/sit) need — projections and rankings — and asked where they were. Per the product's "one table, many filters" rule, two are genuine shared-table fields, so at his direction I added mock **Proj Pts** (projected KERFUFFLE points) and **KERF Rank** (positional rank from KERFUFFLE value, e.g. "RB1") to the "Yours" column group. Proj Pts is derived from the mock KERF value (not an independent projection); KERF Rank is computed from value ordering — both clearly mock. The remaining fields the review surfaced (waiver bid range, remaining cap, trade side-by-side + cap legality, start/sit matchup data, drill-into-inputs) are per-lens or engine-dependent and were logged to [`../feature_backlog.md`](../feature_backlog.md) rather than faked onto the auction view.

**Product implications**
The prototype now shows a fuller version of the shared table, so the owner's reactions cover the non-auction flows too — not just auction prep. Nothing about scope for the *real* build changed; the per-lens fields still arrive with their flows (roadmap Phase 2 / #6–7).

**Deviations / why:** A deliberate step beyond Issue #1's fixed column list, made on the owner's explicit call during review — the kind of change the UI-only prototype exists to invite. `npm run build` passes; render of both columns verified.

**Follow-up decisions needed from the product owner:** None new.

---

### 2026-08-19 — Player table prototype (UI only, mock data)

**Ticket / Issue:** [#1](../../../../issues/1) · **Branch:** feat/issue-1-player-table-prototype · **Deviated from plan:** No

**Original intent**
Build the centerpiece player table as a clickable local prototype on mock data — one screen, ~80 real-name players with invented salaries, the full column set, sort plus roster/position filters, tier badges, an inline-editable Ceiling, and a permanent "MOCK DATA" indicator — on the keepable stack (Next.js/TypeScript, D-01), so the owner can react before any real data pipeline or valuation engine is built.

**What was actually built**
Exactly that. A single-screen Next.js (App Router) + TypeScript app, styled with Tailwind, table powered by TanStack Table v8. 79 hand-authored mock players across QB/RB/WR/TE spanning the free-agent pool, the Rangoon Raccoons' roster, and three rival rosters. Columns: Owner, Player, Pos, Team, Tier (color badge), KERF Value, Ceiling (editable), Edge, Market Price, ECR, Dynasty ECR, Salary, Contract. Runs with `npm install` then `npm run dev` at http://localhost:3000 — no login, no second screen, no data schema, no engine.

**Deviations**
None from the approved plan. Three owner-approved choices were folded in during planning (confirmed before building, not deviations): a derived **Edge** column (KERF Value − Market Price, color-coded, sortable); an **Owner** column showing the fantasy team; and the Ceiling column **pre-seeded** with each player's KERF Value. All three go slightly beyond the issue's literal column list.

**Product implications**
The owner can now open a realistic auction-prep table locally and feel out what's useful — sort it, filter it to roster views, read tiers, type ceilings — and tell us what to change before we build the real pipeline and engine. It is a prototype: every number is invented and resets on reload; it reflects no real league state.

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| 3 high-severity npm advisories in Next 15's transitive deps (postcss build tooling; sharp image lib) | The only patch bumps Next to v16 — a breaking major-dependency change, which is the owner's call | Negligible for a local, no-image, no-untrusted-input prototype; would matter before any web deployment | ~half a day to move to Next 16 and re-verify |
| Mock data is a flat in-repo fixture (`lib/mockData.ts`), not a schema | Deliberate — no real sources verified yet (roadmap #2–3) | None now, provided it is never mistaken for a real data model | Replaced wholesale when real ingestion lands |
| No automated tests; verification is build/lint + manual QA | Prototype with throwaway data; owner approved in the plan | Sort/filter/edit interactions aren't regression-guarded | Add component tests once the table stabilizes on real data |

**Follow-up decisions needed from the product owner**

- [ ] Upgrade to Next.js 16 to clear the 3 npm advisories? — blocks nothing now; settle it before any web deployment.
- [ ] After using the prototype: which columns / filters / interactions to change — the whole reason it shipped. Feeds roadmap #6 (table on real data).

---

**Related docs:** [`current_state.md`](current_state.md) is the up-to-date snapshot this log rolls into. [`roadmap.md`](roadmap.md) is where follow-up decisions get promoted. [`product_vision.md`](product_vision.md) is what a repeated deviation should eventually make us question.
